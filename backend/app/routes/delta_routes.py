import io
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.utils.uuid_generator import generate_uuid

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/delta", tags=["delta-generation"])


class DeltaKeyRule(BaseModel):
    """Delta generation rule for key field matching (composite keys)"""
    LeftFileColumn: str
    RightFileColumn: str
    MatchType: str = "equals"  # equals, case_insensitive, numeric_tolerance
    ToleranceValue: Optional[float] = None
    IsKey: bool = True  # True for key fields, False for optional comparison fields


class DeltaComparisonRule(BaseModel):
    """Delta generation rule for optional field comparison"""
    LeftFileColumn: str
    RightFileColumn: str
    MatchType: str = "equals"  # equals, case_insensitive, numeric_tolerance
    ToleranceValue: Optional[float] = None
    IsKey: bool = False  # Always False for comparison fields


class DeltaFileRule(BaseModel):
    """File configuration for delta generation"""
    Name: str  # FileA (older), FileB (newer)
    SheetName: Optional[str] = None
    Extract: Optional[List[Dict[str, Any]]] = []  # Optional extraction rules
    Filter: Optional[List[Dict[str, Any]]] = []  # Optional filter rules


class DeltaRulesConfig(BaseModel):
    """Complete delta generation configuration"""
    Files: List[DeltaFileRule]
    KeyRules: List[DeltaKeyRule]  # Rules for composite key matching
    ComparisonRules: Optional[List[DeltaComparisonRule]] = []  # Rules for optional field comparison


class DeltaSummary(BaseModel):
    """Delta generation summary"""
    total_records_file_a: int
    total_records_file_b: int
    unchanged_records: int
    amended_records: int
    deleted_records: int
    newly_added_records: int
    processing_time_seconds: float


class DeltaResponse(BaseModel):
    """Delta generation response"""
    success: bool
    summary: DeltaSummary
    delta_id: str
    errors: List[str] = []
    warnings: List[str] = []


class DeltaFileReference(BaseModel):
    """File reference for JSON-based delta generation"""
    file_id: str
    role: str  # file_0 (older), file_1 (newer)
    label: str


class DeltaGenerationConfig(BaseModel):
    """Delta generation configuration from JSON input"""
    Files: List[Dict[str, Any]]
    KeyRules: List[Dict[str, Any]]  # Composite key rules for matching
    ComparisonRules: Optional[List[Dict[str, Any]]] = []  # Optional field comparison rules
    selected_columns_file_a: Optional[List[str]] = None
    selected_columns_file_b: Optional[List[str]] = None
    user_requirements: Optional[str] = None
    files: Optional[List[DeltaFileReference]] = None


class JSONDeltaRequest(BaseModel):
    """JSON-based delta generation request"""
    process_type: str
    process_name: str
    user_requirements: str
    files: List[DeltaFileReference]
    delta_config: DeltaGenerationConfig


# Storage for delta results
delta_storage = {}


class DeltaProcessor:
    """Delta generation processor"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def read_file_from_storage(self, file_id: str):
        """Read file from storage service"""
        from app.services.storage_service import uploaded_files

        if file_id not in uploaded_files:
            raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")

        try:
            file_data = uploaded_files[file_id]
            return file_data["data"]  # Return the DataFrame directly
        except Exception as e:
            logger.error(f"Error retrieving file {file_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")

    def validate_rules_against_columns(self, df: pd.DataFrame, columns_needed: List[str], file_name: str) -> List[str]:
        """Validate that all required columns exist in the DataFrame"""
        errors = []
        df_columns = df.columns.tolist()

        for column in columns_needed:
            if column not in df_columns:
                errors.append(f"Column '{column}' not found in {file_name}. Available columns: {df_columns}")

        return errors

    def create_composite_key(self, df: pd.DataFrame, key_columns: List[str], rules: List[DeltaKeyRule]) -> pd.Series:
        """Create composite key for matching records with proper NaN handling"""
        keys = []
        for i, col in enumerate(key_columns):
            if i < len(rules):
                rule = rules[i]
                # Handle NaN values first by converting to string representation
                series_data = df[col].fillna('__NULL__')  # Replace NaN with placeholder

                if rule.MatchType == "case_insensitive":
                    keys.append(series_data.astype(str).str.lower().str.strip())
                elif rule.MatchType == "numeric_tolerance":
                    # For numeric tolerance, we still need exact key matching
                    keys.append(series_data.astype(str).str.strip())
                else:
                    keys.append(series_data.astype(str).str.strip())
            else:
                # Handle NaN values for columns without specific rules
                series_data = df[col].fillna('__NULL__')
                keys.append(series_data.astype(str).str.strip())

        # Create composite key by joining all key components
        composite_keys = []
        for idx in range(len(df)):
            key_parts = [str(keys[j].iloc[idx]) for j in range(len(keys))]
            composite_key = '|'.join(key_parts)
            composite_keys.append(composite_key)

        composite_series = pd.Series(composite_keys, index=df.index)

        # Debug: Check for duplicates and log them
        duplicates = composite_series.duplicated()
        if duplicates.any():
            duplicate_keys = composite_series[duplicates].unique()
            logger.warning(f"Found {len(duplicate_keys)} duplicate composite keys: {duplicate_keys[:5]}...")
            self.warnings.append(f"Found {len(duplicate_keys)} duplicate composite keys in data")

        return composite_series

    def compare_records(self, row_a: pd.Series, row_b: pd.Series, comparison_rules: List[DeltaComparisonRule]) -> tuple[
        bool, List[str]]:
        """Compare two records based on comparison rules to determine if they are identical
        Returns (is_identical, list_of_changes)"""
        changes = []

        for rule in comparison_rules:
            col_a = rule.LeftFileColumn
            col_b = rule.RightFileColumn

            val_a = row_a.get(col_a)
            val_b = row_b.get(col_b)

            # Handle NaN values
            if pd.isna(val_a) and pd.isna(val_b):
                continue
            elif pd.isna(val_a) or pd.isna(val_b):
                changes.append(f"{col_a}: '{val_a}' -> '{val_b}'")
                continue

            # Apply comparison based on rule type
            values_match = False

            if rule.MatchType == "case_insensitive":
                values_match = str(val_a).strip().lower() == str(val_b).strip().lower()
            elif rule.MatchType == "numeric_tolerance":
                try:
                    num_a = float(val_a)
                    num_b = float(val_b)
                    if rule.ToleranceValue is not None:
                        if num_b != 0:
                            percentage_diff = abs(num_a - num_b) / abs(num_b) * 100
                            values_match = percentage_diff <= rule.ToleranceValue
                        else:
                            values_match = num_a == 0
                    else:
                        values_match = num_a == num_b
                except (ValueError, TypeError):
                    values_match = str(val_a).strip() == str(val_b).strip()
            else:  # equals
                values_match = str(val_a).strip() == str(val_b).strip()

            if not values_match:
                changes.append(f"{col_a}: '{val_a}' -> '{val_b}'")

        return len(changes) == 0, changes

    def generate_delta(self, df_a: pd.DataFrame, df_b: pd.DataFrame,
                       key_rules: List[DeltaKeyRule],
                       comparison_rules: Optional[List[DeltaComparisonRule]] = None,
                       selected_columns_a: Optional[List[str]] = None,
                       selected_columns_b: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate delta between two DataFrames based on key rules and comparison rules"""

        # Extract key columns for matching (composite key)
        key_columns_a = [rule.LeftFileColumn for rule in key_rules]
        key_columns_b = [rule.RightFileColumn for rule in key_rules]

        # Create copies for processing
        df_a_work = df_a.copy()
        df_b_work = df_b.copy()

        # Select only specified columns if provided
        if selected_columns_a:
            # Ensure key columns are included
            all_cols_a = list(set(selected_columns_a + key_columns_a))
            df_a_work = df_a_work[all_cols_a]

        if selected_columns_b:
            # Ensure key columns are included
            all_cols_b = list(set(selected_columns_b + key_columns_b))
            df_b_work = df_b_work[all_cols_b]

        # Create composite keys for matching
        df_a_work['_composite_key'] = self.create_composite_key(df_a_work, key_columns_a, key_rules)
        df_b_work['_composite_key'] = self.create_composite_key(df_b_work, key_columns_b, key_rules)

        # Reset index to ensure uniqueness before operations
        df_a_work = df_a_work.reset_index(drop=True)
        df_b_work = df_b_work.reset_index(drop=True)

        # Create sets for faster lookup
        keys_a = set(df_a_work['_composite_key'])
        keys_b = set(df_b_work['_composite_key'])

        # Initialize result lists
        unchanged_records = []
        amended_records = []
        deleted_records = []
        newly_added_records = []

        # Create lookup dictionaries using iterrows instead of set_index to avoid duplicate index issues
        dict_a = {}
        dict_b = {}

        # Build lookup dictionaries manually to handle potential duplicates
        for idx, row in df_a_work.iterrows():
            composite_key = row['_composite_key']
            if composite_key not in dict_a:
                dict_a[composite_key] = []
            dict_a[composite_key].append(row.to_dict())

        for idx, row in df_b_work.iterrows():
            composite_key = row['_composite_key']
            if composite_key not in dict_b:
                dict_b[composite_key] = []
            dict_b[composite_key].append(row.to_dict())

        # Check for duplicate keys and handle them
        duplicates_a = [k for k, v in dict_a.items() if len(v) > 1]
        duplicates_b = [k for k, v in dict_b.items() if len(v) > 1]

        if duplicates_a:
            logger.warning(f"Found duplicate composite keys in File A: {duplicates_a[:5]}...")
            self.warnings.append(f"Found {len(duplicates_a)} duplicate composite keys in File A")

        if duplicates_b:
            logger.warning(f"Found duplicate composite keys in File B: {duplicates_b[:5]}...")
            self.warnings.append(f"Found {len(duplicates_b)} duplicate composite keys in File B")

        # Process records that exist in both files (same composite key)
        common_keys = keys_a.intersection(keys_b)

        for key in common_keys:
            # Handle potential duplicates by taking the first occurrence
            row_a_dict = dict_a[key][0] if dict_a[key] else {}
            row_b_dict = dict_b[key][0] if dict_b[key] else {}

            row_a = pd.Series(row_a_dict)
            row_b = pd.Series(row_b_dict)

            # Compare optional fields using comparison rules
            if comparison_rules:
                is_identical, changes = self.compare_records(row_a, row_b, comparison_rules)
            else:
                # If no comparison rules, assume records are unchanged if keys match
                is_identical = True
                changes = []

            # Create base record with data from both files
            record = {}
            for col in df_a_work.columns:
                if not col.startswith('_'):
                    record[f"FileA_{col}"] = row_a.get(col)
            for col in df_b_work.columns:
                if not col.startswith('_'):
                    record[f"FileB_{col}"] = row_b.get(col)

            if is_identical:
                # Records are identical - UNCHANGED
                record['Delta_Type'] = 'UNCHANGED'
                unchanged_records.append(record)
            else:
                # Records have differences in optional fields - AMENDED
                record['Delta_Type'] = 'AMENDED'
                record['Changes'] = '; '.join(changes[:5])  # Limit to first 5 changes
                record['Total_Changes'] = len(changes)
                amended_records.append(record)

        # Process records only in File A (older) - DELETED
        deleted_keys = keys_a - keys_b
        for key in deleted_keys:
            row_a_dict = dict_a[key][0] if dict_a[key] else {}
            row_a = pd.Series(row_a_dict)
            record = {}
            for col in df_a_work.columns:
                if not col.startswith('_'):
                    record[f"FileA_{col}"] = row_a.get(col)
            # Add empty FileB columns for consistency
            for col in df_b_work.columns:
                if not col.startswith('_'):
                    record[f"FileB_{col}"] = None
            record['Delta_Type'] = 'DELETED'
            record['Changes'] = 'Record deleted from newer file'
            deleted_records.append(record)

        # Process records only in File B (newer) - NEWLY ADDED
        new_keys = keys_b - keys_a
        for key in new_keys:
            row_b_dict = dict_b[key][0] if dict_b[key] else {}
            row_b = pd.Series(row_b_dict)
            record = {}
            # Add empty FileA columns for consistency
            for col in df_a_work.columns:
                if not col.startswith('_'):
                    record[f"FileA_{col}"] = None
            for col in df_b_work.columns:
                if not col.startswith('_'):
                    record[f"FileB_{col}"] = row_b.get(col)
            record['Delta_Type'] = 'NEWLY_ADDED'
            record['Changes'] = 'New record added in newer file'
            newly_added_records.append(record)

        return {
            'unchanged': pd.DataFrame(unchanged_records),
            'amended': pd.DataFrame(amended_records),
            'deleted': pd.DataFrame(deleted_records),
            'newly_added': pd.DataFrame(newly_added_records),
            'all_changes': pd.DataFrame(amended_records + deleted_records + newly_added_records)
        }


async def get_file_by_id(file_id: str):
    """Retrieve file DataFrame by ID from storage service"""
    from app.services.storage_service import uploaded_files

    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")

    try:
        file_data = uploaded_files[file_id]
        return file_data["data"]  # Return DataFrame directly
    except Exception as e:
        logger.error(f"Error retrieving file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")


@router.post("/process/", response_model=DeltaResponse)
async def process_delta_generation(request: JSONDeltaRequest):
    """Process delta generation with JSON input - File ID Version"""
    start_time = datetime.now()
    processor = DeltaProcessor()

    try:
        # Validate request
        if len(request.files) != 2:
            raise HTTPException(status_code=400, detail="Exactly 2 files are required for delta generation")

        # Sort files by role to ensure consistent mapping
        files_sorted = sorted(request.files, key=lambda x: x.role)
        file_0 = next((f for f in files_sorted if f.role == "file_0"), None)  # Older file
        file_1 = next((f for f in files_sorted if f.role == "file_1"), None)  # Newer file

        if not file_0 or not file_1:
            raise HTTPException(status_code=400, detail="Files must have roles 'file_0' (older) and 'file_1' (newer)")

        # Retrieve files by ID
        try:
            df_a = await get_file_by_id(file_0.file_id)  # Older file
            df_b = await get_file_by_id(file_1.file_id)  # Newer file
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Failed to retrieve files: {str(e)}")

        # Convert delta config to proper format
        key_rules = []
        for rule_dict in request.delta_config.KeyRules:
            key_rule = DeltaKeyRule(
                LeftFileColumn=rule_dict.get('LeftFileColumn'),
                RightFileColumn=rule_dict.get('RightFileColumn'),
                MatchType=rule_dict.get('MatchType', 'equals'),
                ToleranceValue=rule_dict.get('ToleranceValue'),
                IsKey=True
            )
            key_rules.append(key_rule)

        # Convert comparison rules if provided
        comparison_rules = []
        if request.delta_config.ComparisonRules:
            for rule_dict in request.delta_config.ComparisonRules:
                comparison_rule = DeltaComparisonRule(
                    LeftFileColumn=rule_dict.get('LeftFileColumn'),
                    RightFileColumn=rule_dict.get('RightFileColumn'),
                    MatchType=rule_dict.get('MatchType', 'equals'),
                    ToleranceValue=rule_dict.get('ToleranceValue'),
                    IsKey=False
                )
                comparison_rules.append(comparison_rule)

        # Validate key rules
        if not key_rules:
            raise HTTPException(status_code=400, detail="At least one key rule is required for composite key matching")

        # Extract columns needed for validation
        key_columns_a = [rule.LeftFileColumn for rule in key_rules]
        key_columns_b = [rule.RightFileColumn for rule in key_rules]

        comparison_columns_a = [rule.LeftFileColumn for rule in comparison_rules]
        comparison_columns_b = [rule.RightFileColumn for rule in comparison_rules]

        all_columns_a = key_columns_a + comparison_columns_a
        all_columns_b = key_columns_b + comparison_columns_b

        # Validate rules against columns
        errors_a = processor.validate_rules_against_columns(df_a, all_columns_a, "FileA (Older)")
        errors_b = processor.validate_rules_against_columns(df_b, all_columns_b, "FileB (Newer)")

        if errors_a or errors_b:
            processor.errors.extend(errors_a + errors_b)
            raise HTTPException(status_code=400, detail={"errors": processor.errors})

        print(f"Processing delta: FileA {len(df_a)} rows, FileB {len(df_b)} rows")
        print(f"Key rules: {len(key_rules)}, Comparison rules: {len(comparison_rules)}")

        # Extract column selections
        columns_a = request.delta_config.selected_columns_file_a
        columns_b = request.delta_config.selected_columns_file_b

        # Perform delta generation
        print("Starting delta generation...")
        delta_results = processor.generate_delta(
            df_a, df_b,
            key_rules,
            comparison_rules if comparison_rules else None,
            columns_a,
            columns_b
        )

        # Generate delta ID
        delta_id = generate_uuid('delta')

        # Store results
        delta_storage[delta_id] = {
            'unchanged': delta_results['unchanged'],
            'amended': delta_results['amended'],
            'deleted': delta_results['deleted'],
            'newly_added': delta_results['newly_added'],
            'all_changes': delta_results['all_changes'],
            'timestamp': datetime.now(),
            'file_a':file_0.file_id,
            'file_b':file_1.file_id,
            'row_counts': {
                'unchanged': len(delta_results['unchanged']),
                'amended': len(delta_results['amended']),
                'deleted': len(delta_results['deleted']),
                'newly_added': len(delta_results['newly_added'])
            }
        }

        # Calculate summary
        processing_time = (datetime.now() - start_time).total_seconds()
        total_a = len(df_a)
        total_b = len(df_b)

        summary = DeltaSummary(
            total_records_file_a=total_a,
            total_records_file_b=total_b,
            unchanged_records=len(delta_results['unchanged']),
            amended_records=len(delta_results['amended']),
            deleted_records=len(delta_results['deleted']),
            newly_added_records=len(delta_results['newly_added']),
            processing_time_seconds=round(processing_time, 3)
        )

        print(f"Delta generation completed in {processing_time:.2f}s")
        print(f"Unchanged: {len(delta_results['unchanged'])}, Amended: {len(delta_results['amended'])}")
        print(f"Deleted: {len(delta_results['deleted'])}, New: {len(delta_results['newly_added'])}")

        return DeltaResponse(
            success=True,
            summary=summary,
            delta_id=delta_id,
            errors=processor.errors,
            warnings=processor.warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Delta generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/results/{delta_id}")
async def get_delta_results(
        delta_id: str,
        result_type: Optional[str] = "all",  # all, unchanged, amended, deleted, newly_added, all_changes
        page: Optional[int] = 1,
        page_size: Optional[int] = 1000
):
    """Get delta generation results with pagination"""

    if delta_id not in delta_storage:
        raise HTTPException(status_code=404, detail="Delta ID not found")

    results = delta_storage[delta_id]

    # Calculate pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    def paginate_results(data_list):
        return data_list[start_idx:end_idx]

    def clean_dataframe(df):
        # Ensure we have a clean DataFrame with unique index
        df = df.reset_index(drop=True)
        # Replace NaN with None (which becomes null in JSON)
        df = df.replace({np.nan: None})
        # Replace infinite values with None
        df = df.replace({np.inf: None, -np.inf: None})
        return df.to_dict(orient='records')

    response_data = {
        'delta_id': delta_id,
        'timestamp': results['timestamp'].isoformat(),
        'row_counts': results['row_counts'],
        'pagination': {
            'page': page,
            'page_size': page_size,
            'start_index': start_idx
        }
    }

    if result_type == "all":
        response_data.update({
            'unchanged': paginate_results(clean_dataframe(results['unchanged'])),
            'amended': paginate_results(clean_dataframe(results['amended'])),
            'deleted': paginate_results(clean_dataframe(results['deleted'])),
            'newly_added': paginate_results(clean_dataframe(results['newly_added']))
        })
    elif result_type == "unchanged":
        response_data['unchanged'] = paginate_results(clean_dataframe(results['unchanged']))
    elif result_type == "amended":
        response_data['amended'] = paginate_results(clean_dataframe(results['amended']))
    elif result_type == "deleted":
        response_data['deleted'] = paginate_results(clean_dataframe(results['deleted']))
    elif result_type == "newly_added":
        response_data['newly_added'] = paginate_results(clean_dataframe(results['newly_added']))
    elif result_type == "all_changes":
        response_data['all_changes'] = paginate_results(clean_dataframe(results['all_changes']))
    else:
        raise HTTPException(status_code=400,
                            detail="Invalid result_type. Use: all, unchanged, amended, deleted, newly_added, all_changes")

    return response_data


@router.get("/download/{delta_id}")
async def download_delta_results(
        delta_id: str,
        format: str = "csv",
        result_type: str = "all",  # all, unchanged, amended, deleted, newly_added, all_changes
        compress: bool = True
):
    """Download delta generation results with optimized streaming for large files"""

    if delta_id not in delta_storage:
        raise HTTPException(status_code=404, detail="Delta ID not found")

    results = delta_storage[delta_id]

    try:
        # Convert back to DataFrames for download
        unchanged_df = results['unchanged']
        amended_df = results['amended']
        deleted_df = results['deleted']
        newly_added_df = results['newly_added']
        all_changes_df = results['all_changes']

        if format.lower() == "excel":
            # Create Excel file with multiple sheets
            output = io.BytesIO()

            with pd.ExcelWriter(output, engine='xlsxwriter', options={'strings_to_urls': False}) as writer:
                if result_type == "all":
                    # Write all result types to separate sheets
                    if len(unchanged_df) > 0:
                        unchanged_df.to_excel(writer, sheet_name='Unchanged Records', index=False)
                    if len(amended_df) > 0:
                        amended_df.to_excel(writer, sheet_name='Amended Records', index=False)
                    if len(deleted_df) > 0:
                        deleted_df.to_excel(writer, sheet_name='Deleted Records', index=False)
                    if len(newly_added_df) > 0:
                        newly_added_df.to_excel(writer, sheet_name='Newly Added Records', index=False)

                    # Add summary sheet
                    summary_data = pd.DataFrame({
                        'Delta_Type': ['Unchanged', 'Amended', 'Deleted', 'Newly Added'],
                        'Count': [
                            results['row_counts']['unchanged'],
                            results['row_counts']['amended'],
                            results['row_counts']['deleted'],
                            results['row_counts']['newly_added']
                        ],
                        'Percentage': [
                            f"{(results['row_counts']['unchanged'] / max(sum(results['row_counts'].values()), 1) * 100):.2f}%",
                            f"{(results['row_counts']['amended'] / max(sum(results['row_counts'].values()), 1) * 100):.2f}%",
                            f"{(results['row_counts']['deleted'] / max(sum(results['row_counts'].values()), 1) * 100):.2f}%",
                            f"{(results['row_counts']['newly_added'] / max(sum(results['row_counts'].values()), 1) * 100):.2f}%"
                        ]
                    })
                    summary_data.to_excel(writer, sheet_name='Summary', index=False)

                elif result_type == "unchanged" and len(unchanged_df) > 0:
                    unchanged_df.to_excel(writer, sheet_name='Unchanged Records', index=False)
                elif result_type == "amended" and len(amended_df) > 0:
                    amended_df.to_excel(writer, sheet_name='Amended Records', index=False)
                elif result_type == "deleted" and len(deleted_df) > 0:
                    deleted_df.to_excel(writer, sheet_name='Deleted Records', index=False)
                elif result_type == "newly_added" and len(newly_added_df) > 0:
                    newly_added_df.to_excel(writer, sheet_name='Newly Added Records', index=False)
                elif result_type == "all_changes" and len(all_changes_df) > 0:
                    all_changes_df.to_excel(writer, sheet_name='All Changes', index=False)

            output.seek(0)

            filename = f"delta_{delta_id}_{result_type}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif format.lower() == "csv":
            # For CSV, return the requested result type
            if result_type == "unchanged":
                df_to_export = unchanged_df
            elif result_type == "amended":
                df_to_export = amended_df
            elif result_type == "deleted":
                df_to_export = deleted_df
            elif result_type == "newly_added":
                df_to_export = newly_added_df
            elif result_type == "all_changes":
                df_to_export = all_changes_df
            else:  # "all"
                # For "all", combine all data with type indicator
                df_to_export = pd.concat([
                    unchanged_df.assign(Delta_Category='UNCHANGED') if len(unchanged_df) > 0 else pd.DataFrame(),
                    amended_df.assign(Delta_Category='AMENDED') if len(amended_df) > 0 else pd.DataFrame(),
                    deleted_df.assign(Delta_Category='DELETED') if len(deleted_df) > 0 else pd.DataFrame(),
                    newly_added_df.assign(Delta_Category='NEWLY_ADDED') if len(newly_added_df) > 0 else pd.DataFrame()
                ], ignore_index=True)

            output = io.StringIO()
            df_to_export.to_csv(output, index=False)
            output.seek(0)

            # Convert to bytes for streaming
            output = io.BytesIO(output.getvalue().encode('utf-8'))
            filename = f"delta_{delta_id}_{result_type}.csv"
            media_type = "text/csv"

        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'excel' or 'csv'")

        return StreamingResponse(
            output,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")


@router.get("/results/{delta_id}/summary")
async def get_delta_summary(delta_id: str):
    """Get a quick summary of delta generation results"""

    if delta_id not in delta_storage:
        raise HTTPException(status_code=404, detail="Delta ID not found")

    results = delta_storage[delta_id]
    row_counts = results['row_counts']
    total_records = sum(row_counts.values())

    return {
        'delta_id': delta_id,
        'timestamp': results['timestamp'].isoformat(),
        'summary': {
            'total_records_compared': total_records,
            'unchanged_records': row_counts['unchanged'],
            'amended_records': row_counts['amended'],
            'deleted_records': row_counts['deleted'],
            'newly_added_records': row_counts['newly_added'],
            'change_metrics': {
                'stability_percentage': round((row_counts['unchanged'] / max(total_records, 1)) * 100, 2),
                'amendment_rate': round((row_counts['amended'] / max(total_records, 1)) * 100, 2),
                'deletion_rate': round((row_counts['deleted'] / max(total_records, 1)) * 100, 2),
                'addition_rate': round((row_counts['newly_added'] / max(total_records, 1)) * 100, 2),
                'overall_change_rate': round(((row_counts['amended'] + row_counts['deleted'] + row_counts[
                    'newly_added']) / max(total_records, 1)) * 100, 2)
            }
        }
    }


@router.delete("/results/{delta_id}")
async def delete_delta_results(delta_id: str):
    """Delete delta generation results to free up memory"""

    if delta_id not in delta_storage:
        raise HTTPException(status_code=404, detail="Delta ID not found")

    # Remove from storage
    del delta_storage[delta_id]
    return {"success": True, "message": f"Delta results {delta_id} deleted successfully"}


@router.get("/health")
async def delta_health_check():
    """Health check for delta generation service"""
    storage_count = len(delta_storage)

    return {
        "status": "healthy",
        "service": "delta_generation",
        "active_deltas": storage_count,
        "features": [
            "composite_key_matching",
            "optional_field_comparison",
            "change_categorization",
            "amendment_tracking",
            "column_selection",
            "paginated_results",
            "streaming_downloads",
            "json_input_support",
            "file_id_retrieval"
        ]
    }