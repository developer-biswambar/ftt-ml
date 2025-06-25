from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Dict, List, Any, Optional, Union
import pandas as pd
import numpy as np
import re
import json
import io
from datetime import datetime
import uuid
from pydantic import BaseModel, Field, validator


# Pydantic models for request/response
class PatternCondition(BaseModel):
    operator: Optional[str] = None
    pattern: Optional[str] = None
    patterns: Optional[List[str]] = None
    conditions: Optional[List['PatternCondition']] = None


class ExtractRule(BaseModel):
    ResultColumnName: str
    SourceColumn: str
    MatchType: str
    Conditions: Optional[PatternCondition] = None
    # Legacy support
    Patterns: Optional[List[str]] = None


class FilterRule(BaseModel):
    ColumnName: str
    MatchType: str
    Value: Union[str, int, float]


class FileRule(BaseModel):
    Name: str
    SheetName: Optional[str] = None  # For Excel files
    Extract: List[ExtractRule]
    Filter: Optional[List[FilterRule]] = []


class ReconciliationRule(BaseModel):
    LeftFileColumn: str
    RightFileColumn: str
    MatchType: str
    ToleranceValue: Optional[float] = None


class RulesConfig(BaseModel):
    Files: List[FileRule]
    ReconciliationRules: List[ReconciliationRule]


class ReconciliationSummary(BaseModel):
    total_records_file_a: int
    total_records_file_b: int
    matched_records: int
    unmatched_file_a: int
    unmatched_file_b: int
    match_percentage: float
    processing_time_seconds: float


class ReconciliationResponse(BaseModel):
    success: bool
    summary: ReconciliationSummary
    reconciliation_id: str
    errors: List[str] = []
    warnings: List[str] = []


# Update forward reference
PatternCondition.model_rebuild()

# Create router
router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


class FileProcessor:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def read_file(self, file: UploadFile, sheet_name: Optional[str] = None) -> pd.DataFrame:
        """Read CSV or Excel file into DataFrame"""
        try:
            content = file.file.read()
            file.file.seek(0)

            if file.filename.endswith('.csv'):
                return pd.read_csv(io.BytesIO(content))
            elif file.filename.endswith(('.xlsx', '.xls')):
                if sheet_name:
                    return pd.read_excel(io.BytesIO(content), sheet_name=sheet_name)
                else:
                    return pd.read_excel(io.BytesIO(content))
            else:
                raise ValueError(f"Unsupported file format: {file.filename}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading file {file.filename}: {str(e)}")

    def validate_rules_against_columns(self, df: pd.DataFrame, file_rule: FileRule) -> List[str]:
        """Validate that all columns mentioned in rules exist in the DataFrame"""
        errors = []
        df_columns = df.columns.tolist()

        # Check extract rules
        for extract in file_rule.Extract:
            if extract.SourceColumn not in df_columns:
                errors.append(
                    f"Column '{extract.SourceColumn}' not found in file '{file_rule.Name}'. Available columns: {df_columns}")

        # Check filter rules
        for filter_rule in file_rule.Filter or []:
            if filter_rule.ColumnName not in df_columns:
                errors.append(
                    f"Column '{filter_rule.ColumnName}' not found in file '{file_rule.Name}'. Available columns: {df_columns}")

        return errors

    def evaluate_pattern_condition(self, text: str, condition: PatternCondition) -> bool:
        """Recursively evaluate pattern conditions"""
        if condition.pattern:
            # Single pattern
            try:
                return bool(re.search(condition.pattern, str(text)))
            except re.error as e:
                self.errors.append(f"Invalid regex pattern '{condition.pattern}': {str(e)}")
                return False

        elif condition.patterns:
            # Multiple patterns with OR operator (default)
            results = []
            for pattern in condition.patterns:
                try:
                    results.append(bool(re.search(pattern, str(text))))
                except re.error as e:
                    self.errors.append(f"Invalid regex pattern '{pattern}': {str(e)}")
                    results.append(False)

            if condition.operator == "AND":
                return all(results)
            else:  # Default OR
                return any(results)

        elif condition.conditions:
            # Nested conditions
            results = []
            for sub_condition in condition.conditions:
                results.append(self.evaluate_pattern_condition(text, sub_condition))

            if condition.operator == "AND":
                return all(results)
            else:  # Default OR
                return any(results)

        return False

    def extract_patterns(self, df: pd.DataFrame, extract_rule: ExtractRule) -> pd.Series:
        """Extract patterns from source column based on rules"""

        def extract_from_text(text):
            if pd.isna(text):
                return None

            text = str(text)

            # Special handling for amount extraction
            if extract_rule.ResultColumnName.lower() in ['amount', 'extractedamount', 'value']:
                # Use a more specific pattern for amounts that avoids ISINs
                amount_patterns = [
                    r'(?:Amount:?\s*)?(?:[\$€£¥₹]\s*)([\d,]+(?:\.\d{2})?)',  # With currency symbol
                    r'(?:Amount|Price|Value|Cost|Total):\s*([\d,]+(?:\.\d{2})?)',  # With label
                    r'\b((?:\d{1,3},)+\d{3}(?:\.\d{2})?)\b(?!\d)',  # Formatted number with commas
                    r'(?:[\$€£¥₹]\s*)(\d+(?:\.\d{2})?)\b'  # Simple currency
                ]

                for pattern in amount_patterns:
                    try:
                        match = re.search(pattern, text, re.IGNORECASE)
                        if match:
                            # Extract the numeric group and clean it
                            amount_str = match.group(1).replace(',', '').replace('$', '')
                            try:
                                # Validate it's a reasonable amount (not an ID)
                                amount = float(amount_str)
                                if amount > 100:  # Likely a real amount, not part of an ID
                                    return amount_str
                            except ValueError:
                                continue
                    except re.error:
                        continue

            # Handle new nested condition format
            if extract_rule.Conditions:
                if self.evaluate_pattern_condition(text, extract_rule.Conditions):
                    # Extract the actual value using the first matching pattern
                    matched_value = self.extract_first_match(text, extract_rule.Conditions)
                    return matched_value

            # Handle legacy format
            elif extract_rule.Patterns:
                for pattern in extract_rule.Patterns:
                    try:
                        match = re.search(pattern, text)
                        if match:
                            return match.group(0)
                    except re.error as e:
                        self.errors.append(f"Invalid regex pattern '{pattern}': {str(e)}")

            return None

        return df[extract_rule.SourceColumn].apply(extract_from_text)

    def extract_first_match(self, text: str, condition: PatternCondition) -> Optional[str]:
        """Extract the first matching value from text"""
        if condition.pattern:
            try:
                match = re.search(condition.pattern, text)
                if match:
                    return match.group(0)
            except re.error:
                pass

        elif condition.patterns:
            for pattern in condition.patterns:
                try:
                    match = re.search(pattern, text)
                    if match:
                        return match.group(0)
                except re.error:
                    pass

        elif condition.conditions:
            for sub_condition in condition.conditions:
                result = self.extract_first_match(text, sub_condition)
                if result:
                    return result

        return None

    def apply_filters(self, df: pd.DataFrame, filters: List[FilterRule]) -> pd.DataFrame:
        """Apply filter rules to DataFrame"""
        filtered_df = df.copy()

        for filter_rule in filters:
            column = filter_rule.ColumnName
            value = filter_rule.Value
            match_type = filter_rule.MatchType.lower()

            try:
                if match_type == "equals":
                    filtered_df = filtered_df[filtered_df[column] == value]
                elif match_type == "not_equals":
                    filtered_df = filtered_df[filtered_df[column] != value]
                elif match_type == "greater_than":
                    # Convert to numeric and handle NaN values
                    numeric_col = pd.to_numeric(filtered_df[column], errors='coerce')
                    filtered_df = filtered_df[numeric_col > value]
                elif match_type == "less_than":
                    # Convert to numeric and handle NaN values
                    numeric_col = pd.to_numeric(filtered_df[column], errors='coerce')
                    filtered_df = filtered_df[numeric_col < value]
                elif match_type == "contains":
                    filtered_df = filtered_df[filtered_df[column].astype(str).str.contains(str(value), na=False)]
                elif match_type == "in":
                    if isinstance(value, str):
                        value = [v.strip() for v in value.split(',')]
                    filtered_df = filtered_df[filtered_df[column].isin(value)]
                else:
                    self.warnings.append(f"Unknown filter match type: {match_type}")
            except Exception as e:
                self.errors.append(f"Error applying filter on column '{column}': {str(e)}")

        return filtered_df

    def reconcile_files(self, df_a: pd.DataFrame, df_b: pd.DataFrame,
                        recon_rules: List[ReconciliationRule]) -> Dict[str, pd.DataFrame]:
        """Reconcile two DataFrames based on rules"""
        # Create copies for reconciliation
        df_a_work = df_a.copy()
        df_b_work = df_b.copy()

        # Add unique identifiers
        df_a_work['_orig_index_a'] = range(len(df_a_work))
        df_b_work['_orig_index_b'] = range(len(df_b_work))

        # Build matching conditions
        matched_indices_a = set()
        matched_indices_b = set()
        matches = []

        for idx_a, row_a in df_a_work.iterrows():
            for idx_b, row_b in df_b_work.iterrows():
                if idx_b in matched_indices_b:
                    continue

                all_rules_match = True

                for rule in recon_rules:
                    val_a = row_a[rule.LeftFileColumn]
                    val_b = row_b[rule.RightFileColumn]

                    if rule.MatchType.lower() == "equals":
                        if pd.isna(val_a) and pd.isna(val_b):
                            continue
                        if val_a != val_b:
                            all_rules_match = False
                            break

                    elif rule.MatchType.lower() == "tolerance":
                        try:
                            # Handle NaN values properly
                            if pd.isna(val_a) or pd.isna(val_b):
                                all_rules_match = False
                                break

                            num_a = float(val_a)
                            num_b = float(val_b)

                            if num_b != 0:
                                percentage_diff = abs(num_a - num_b) / abs(num_b) * 100
                                if percentage_diff > rule.ToleranceValue:
                                    all_rules_match = False
                                    break
                            elif num_a != 0:
                                # If B is 0 but A is not, they don't match
                                all_rules_match = False
                                break
                            # If both are 0, they match
                        except (ValueError, TypeError):
                            self.warnings.append(
                                f"Could not convert values to numeric for tolerance comparison: {val_a}, {val_b}")
                            all_rules_match = False
                            break

                if all_rules_match:
                    matched_indices_a.add(row_a['_orig_index_a'])
                    matched_indices_b.add(row_b['_orig_index_b'])

                    # Merge the matched records
                    match_record = {}
                    for col in df_a.columns:
                        match_record[f"FileA_{col}"] = row_a[col]
                    for col in df_b.columns:
                        match_record[f"FileB_{col}"] = row_b[col]
                    matches.append(match_record)
                    break

        # Create result DataFrames
        matched_df = pd.DataFrame(matches) if matches else pd.DataFrame()
        unmatched_a = df_a_work[~df_a_work['_orig_index_a'].isin(matched_indices_a)].drop('_orig_index_a', axis=1)
        unmatched_b = df_b_work[~df_b_work['_orig_index_b'].isin(matched_indices_b)].drop('_orig_index_b', axis=1)

        return {
            'matched': matched_df,
            'unmatched_file_a': unmatched_a,
            'unmatched_file_b': unmatched_b
        }


# Store reconciliation results temporarily (in production, use proper storage)
reconciliation_storage = {}


@router.post("/process", response_model=ReconciliationResponse)
async def process_reconciliation(
        fileA: UploadFile = File(...),
        fileB: UploadFile = File(...),
        rules: str = Form(...)
):
    """Process file reconciliation based on provided rules"""
    start_time = datetime.now()
    processor = FileProcessor()

    try:
        # Parse rules
        rules_config = RulesConfig.parse_raw(rules)

        # Validate we have rules for both files
        if len(rules_config.Files) != 2:
            raise HTTPException(status_code=400, detail="Rules must contain exactly 2 file configurations")

        # Read files
        file_rule_a = next((f for f in rules_config.Files if f.Name == "FileA"), None)
        file_rule_b = next((f for f in rules_config.Files if f.Name == "FileB"), None)

        if not file_rule_a or not file_rule_b:
            raise HTTPException(status_code=400, detail="Rules must contain configurations for 'FileA' and 'FileB'")

        df_a = processor.read_file(fileA, file_rule_a.SheetName)
        df_b = processor.read_file(fileB, file_rule_b.SheetName)

        # Validate rules against columns
        errors_a = processor.validate_rules_against_columns(df_a, file_rule_a)
        errors_b = processor.validate_rules_against_columns(df_b, file_rule_b)

        if errors_a or errors_b:
            processor.errors.extend(errors_a + errors_b)
            raise HTTPException(status_code=400, detail={"errors": processor.errors})

        # Process FileA
        for extract_rule in file_rule_a.Extract:
            df_a[extract_rule.ResultColumnName] = processor.extract_patterns(df_a, extract_rule)

        if file_rule_a.Filter:
            df_a = processor.apply_filters(df_a, file_rule_a.Filter)

        # Process FileB
        for extract_rule in file_rule_b.Extract:
            df_b[extract_rule.ResultColumnName] = processor.extract_patterns(df_b, extract_rule)

        if file_rule_b.Filter:
            df_b = processor.apply_filters(df_b, file_rule_b.Filter)

        # Validate reconciliation columns exist
        recon_errors = []
        for rule in rules_config.ReconciliationRules:
            if rule.LeftFileColumn not in df_a.columns:
                recon_errors.append(
                    f"Reconciliation column '{rule.LeftFileColumn}' not found in FileA after extraction")
            if rule.RightFileColumn not in df_b.columns:
                recon_errors.append(
                    f"Reconciliation column '{rule.RightFileColumn}' not found in FileB after extraction")

        if recon_errors:
            processor.errors.extend(recon_errors)
            raise HTTPException(status_code=400, detail={"errors": processor.errors})

        # Perform reconciliation
        reconciliation_results = processor.reconcile_files(df_a, df_b, rules_config.ReconciliationRules)

        # Generate reconciliation ID
        recon_id = str(uuid.uuid4())

        # Store results
        reconciliation_storage[recon_id] = {
            'matched': reconciliation_results['matched'],
            'unmatched_file_a': reconciliation_results['unmatched_file_a'],
            'unmatched_file_b': reconciliation_results['unmatched_file_b'],
            'timestamp': datetime.now()
        }

        # Calculate summary
        processing_time = (datetime.now() - start_time).total_seconds()
        total_a = len(df_a)
        total_b = len(df_b)
        matched = len(reconciliation_results['matched'])

        # Handle division by zero for match percentage
        if max(total_a, total_b) > 0:
            match_percentage = round((matched / max(total_a, total_b)) * 100, 2)
        else:
            match_percentage = 0.0

        summary = ReconciliationSummary(
            total_records_file_a=total_a,
            total_records_file_b=total_b,
            matched_records=matched,
            unmatched_file_a=len(reconciliation_results['unmatched_file_a']),
            unmatched_file_b=len(reconciliation_results['unmatched_file_b']),
            match_percentage=match_percentage,
            processing_time_seconds=round(processing_time, 3)
        )

        return ReconciliationResponse(
            success=True,
            summary=summary,
            reconciliation_id=recon_id,
            errors=processor.errors,
            warnings=processor.warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/results/{reconciliation_id}")
async def get_reconciliation_results(reconciliation_id: str):
    """Get reconciliation results as JSON"""
    if reconciliation_id not in reconciliation_storage:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    results = reconciliation_storage[reconciliation_id]

    # Handle NaN and infinite values before converting to JSON
    def clean_dataframe(df):
        # Replace NaN with None (which becomes null in JSON)
        df = df.replace({np.nan: None})
        # Replace infinite values with None
        df = df.replace({np.inf: None, -np.inf: None})
        return df.to_dict(orient='records')

    return {
        'matched': clean_dataframe(results['matched']),
        'unmatched_file_a': clean_dataframe(results['unmatched_file_a']),
        'unmatched_file_b': clean_dataframe(results['unmatched_file_b']),
        'timestamp': results['timestamp'].isoformat()
    }


@router.get("/download/{reconciliation_id}")
async def download_reconciliation_results(
        reconciliation_id: str,
        format: str = "excel"
):
    """Download reconciliation results as Excel or CSV"""
    if reconciliation_id not in reconciliation_storage:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    results = reconciliation_storage[reconciliation_id]

    if format.lower() == "excel":
        # Create Excel file with multiple sheets
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            results['matched'].to_excel(writer, sheet_name='Matched Records', index=False)
            results['unmatched_file_a'].to_excel(writer, sheet_name='Unmatched FileA', index=False)
            results['unmatched_file_b'].to_excel(writer, sheet_name='Unmatched FileB', index=False)

            # Add summary sheet
            summary_data = {
                'Metric': ['Total Records FileA', 'Total Records FileB', 'Matched Records',
                           'Unmatched FileA', 'Unmatched FileB'],
                'Count': [
                    len(results['matched']) + len(results['unmatched_file_a']),
                    len(results['matched']) + len(results['unmatched_file_b']),
                    len(results['matched']),
                    len(results['unmatched_file_a']),
                    len(results['unmatched_file_b'])
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)

        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{reconciliation_id}.xlsx"}
        )

    else:  # CSV format - return matched records only
        output = io.StringIO()
        results['matched'].to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{reconciliation_id}_matched.csv"}
        )

# Example usage in your main.py:
# from reconciliation_routes import router as reconciliation_router
# app.include_router(reconciliation_router)