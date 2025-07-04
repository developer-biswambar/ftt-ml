import io
import re
from functools import lru_cache
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from fastapi import UploadFile, HTTPException

from app.models.recon_models import PatternCondition, FileRule, ExtractRule, FilterRule, ReconciliationRule

# Update forward reference
PatternCondition.model_rebuild()


class OptimizedFileProcessor:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self._pattern_cache = {}  # Cache compiled regex patterns

    def read_file(self, file: UploadFile, sheet_name: Optional[str] = None) -> pd.DataFrame:
        """Read CSV or Excel file into DataFrame with optimized settings"""
        try:
            content = file.file.read()
            file.file.seek(0)

            if file.filename.endswith('.csv'):
                return pd.read_csv(
                    io.BytesIO(content),
                    low_memory=False,
                    engine='c'  # Use C engine for better performance
                )
            elif file.filename.endswith(('.xlsx', '.xls')):
                if sheet_name:
                    return pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, engine='openpyxl')
                else:
                    return pd.read_excel(io.BytesIO(content), engine='openpyxl')
            else:
                raise ValueError(f"Unsupported file format: {file.filename}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading file {file.filename}: {str(e)}")

    def validate_rules_against_columns(self, df: pd.DataFrame, file_rule: FileRule) -> List[str]:
        """Validate that all columns mentioned in rules exist in the DataFrame"""
        errors = []
        df_columns = df.columns.tolist()

        # Check extract rules - Handle optional Extract
        if hasattr(file_rule, 'Extract') and file_rule.Extract:
            for extract in file_rule.Extract:
                if extract.SourceColumn not in df_columns:
                    errors.append(
                        f"Column '{extract.SourceColumn}' not found in file '{file_rule.Name}'. Available columns: {df_columns}")

        # Check filter rules - Handle optional Filter
        if hasattr(file_rule, 'Filter') and file_rule.Filter:
            for filter_rule in file_rule.Filter:
                if filter_rule.ColumnName not in df_columns:
                    errors.append(
                        f"Column '{filter_rule.ColumnName}' not found in file '{file_rule.Name}'. Available columns: {df_columns}")

        return errors

    @lru_cache(maxsize=1000)
    def _get_compiled_pattern(self, pattern: str) -> re.Pattern:
        """Cache compiled regex patterns for better performance"""
        return re.compile(pattern)

    def evaluate_pattern_condition(self, text: str, condition: PatternCondition) -> bool:
        """Recursively evaluate pattern conditions with caching"""
        if condition.pattern:
            try:
                compiled_pattern = self._get_compiled_pattern(condition.pattern)
                return bool(compiled_pattern.search(str(text)))
            except re.error as e:
                self.errors.append(f"Invalid regex pattern '{condition.pattern}': {str(e)}")
                return False

        elif condition.patterns:
            results = []
            for pattern in condition.patterns:
                try:
                    compiled_pattern = self._get_compiled_pattern(pattern)
                    results.append(bool(compiled_pattern.search(str(text))))
                except re.error as e:
                    self.errors.append(f"Invalid regex pattern '{pattern}': {str(e)}")
                    results.append(False)

            if condition.operator == "AND":
                return all(results)
            else:  # Default OR
                return any(results)

        elif condition.conditions:
            results = []
            for sub_condition in condition.conditions:
                results.append(self.evaluate_pattern_condition(text, sub_condition))

            if condition.operator == "AND":
                return all(results)
            else:  # Default OR
                return any(results)

        return False

    def extract_patterns_vectorized(self, df: pd.DataFrame, extract_rule: ExtractRule) -> pd.Series:
        """Optimized pattern extraction using vectorized operations"""

        def extract_from_text(text):
            if pd.isna(text):
                return None

            text = str(text)

            # Special handling for amount extraction with optimized patterns
            if extract_rule.ResultColumnName.lower() in ['amount', 'extractedamount', 'value']:
                amount_patterns = [
                    r'(?:Amount:?\s*)?(?:[\$€£¥₹]\s*)([\d,]+(?:\.\d{2})?)',
                    r'(?:Amount|Price|Value|Cost|Total):\s*([\d,]+(?:\.\d{2})?)',
                    r'\b((?:\d{1,3},)+\d{3}(?:\.\d{2})?)\b(?!\d)',
                    r'(?:[\$€£¥₹]\s*)(\d+(?:\.\d{2})?)\b'
                ]

                for pattern in amount_patterns:
                    try:
                        compiled_pattern = self._get_compiled_pattern(pattern)
                        match = compiled_pattern.search(text)
                        if match:
                            amount_str = match.group(1).replace(',', '').replace('$', '')
                            try:
                                amount = float(amount_str)
                                if amount > 0:  # Valid amount
                                    return amount_str
                            except ValueError:
                                continue
                    except re.error:
                        continue

            # Handle new nested condition format
            if hasattr(extract_rule, 'Conditions') and extract_rule.Conditions:
                if self.evaluate_pattern_condition(text, extract_rule.Conditions):
                    matched_value = self.extract_first_match(text, extract_rule.Conditions)
                    return matched_value

            # Handle legacy format
            elif hasattr(extract_rule, 'Patterns') and extract_rule.Patterns:
                for pattern in extract_rule.Patterns:
                    try:
                        compiled_pattern = self._get_compiled_pattern(pattern)
                        match = compiled_pattern.search(text)
                        if match:
                            return match.group(0)
                    except re.error as e:
                        self.errors.append(f"Invalid regex pattern '{pattern}': {str(e)}")

            return None

        # Use vectorized operations where possible
        column_data = df[extract_rule.SourceColumn].astype(str)
        return column_data.apply(extract_from_text)

    def extract_first_match(self, text: str, condition: PatternCondition) -> Optional[str]:
        """Extract the first matching value from text"""
        if condition.pattern:
            try:
                compiled_pattern = self._get_compiled_pattern(condition.pattern)
                match = compiled_pattern.search(text)
                if match:
                    return match.group(0)
            except re.error:
                pass

        elif condition.patterns:
            for pattern in condition.patterns:
                try:
                    compiled_pattern = self._get_compiled_pattern(pattern)
                    match = compiled_pattern.search(text)
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

    def apply_filters_optimized(self, df: pd.DataFrame, filters: List[FilterRule]) -> pd.DataFrame:
        """Apply filter rules to DataFrame with optimized operations"""
        if not filters:
            return df

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
                    numeric_col = pd.to_numeric(filtered_df[column], errors='coerce')
                    filtered_df = filtered_df[numeric_col > value]
                elif match_type == "less_than":
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

    def get_mandatory_columns(self, recon_rules: List[ReconciliationRule],
                              file_a_rules: Optional[FileRule], file_b_rules: Optional[FileRule]) -> Tuple[
        Set[str], Set[str]]:
        """Get mandatory columns that must be included in results"""
        mandatory_a = set()
        mandatory_b = set()

        # Add reconciliation rule columns
        for rule in recon_rules:
            mandatory_a.add(rule.LeftFileColumn)
            mandatory_b.add(rule.RightFileColumn)

        # Add extracted columns - Handle optional rules
        if file_a_rules and hasattr(file_a_rules, 'Extract') and file_a_rules.Extract:
            for extract_rule in file_a_rules.Extract:
                mandatory_a.add(extract_rule.ResultColumnName)

        if file_b_rules and hasattr(file_b_rules, 'Extract') and file_b_rules.Extract:
            for extract_rule in file_b_rules.Extract:
                mandatory_b.add(extract_rule.ResultColumnName)

        # Add filter columns - Handle optional filters
        if file_a_rules and hasattr(file_a_rules, 'Filter') and file_a_rules.Filter:
            for filter_rule in file_a_rules.Filter:
                mandatory_a.add(filter_rule.ColumnName)

        if file_b_rules and hasattr(file_b_rules, 'Filter') and file_b_rules.Filter:
            for filter_rule in file_b_rules.Filter:
                mandatory_b.add(filter_rule.ColumnName)

        return mandatory_a, mandatory_b

    def create_optimized_match_keys(self, df: pd.DataFrame,
                                    recon_rules: List[ReconciliationRule],
                                    file_prefix: str) -> pd.DataFrame:
        """Create optimized match keys for faster reconciliation"""
        df_work = df.copy()

        # Create composite match key for exact matches
        exact_match_cols = []
        tolerance_rules = []

        for rule in recon_rules:
            col_name = rule.LeftFileColumn if file_prefix == 'A' else rule.RightFileColumn

            if rule.MatchType.lower() == "equals":
                exact_match_cols.append(col_name)
            elif rule.MatchType.lower() == "tolerance":
                tolerance_rules.append(rule)

        # Create composite key for exact matches
        if exact_match_cols:
            df_work['_match_key'] = df_work[exact_match_cols].astype(str).agg('|'.join, axis=1)
        else:
            df_work['_match_key'] = df_work.index.astype(str)

        return df_work, tolerance_rules

    def reconcile_files_optimized(self, df_a: pd.DataFrame, df_b: pd.DataFrame,
                                  recon_rules: List[ReconciliationRule],
                                  selected_columns_a: Optional[List[str]] = None,
                                  selected_columns_b: Optional[List[str]] = None) -> Dict[str, pd.DataFrame]:
        """Optimized reconciliation using hash-based matching for large datasets"""

        # Create working copies with indices
        df_a_work, tolerance_rules_a = self.create_optimized_match_keys(df_a, recon_rules, 'A')
        df_b_work, tolerance_rules_b = self.create_optimized_match_keys(df_b, recon_rules, 'B')

        df_a_work['_orig_index_a'] = range(len(df_a_work))
        df_b_work['_orig_index_b'] = range(len(df_b_work))

        # Group by match key for faster lookups
        grouped_b = df_b_work.groupby('_match_key')

        matched_indices_a = set()
        matched_indices_b = set()
        matches = []

        # Process matches in batches for better memory management
        batch_size = 1000
        for start_idx in range(0, len(df_a_work), batch_size):
            end_idx = min(start_idx + batch_size, len(df_a_work))
            batch_a = df_a_work.iloc[start_idx:end_idx]

            for idx_a, row_a in batch_a.iterrows():
                if row_a['_orig_index_a'] in matched_indices_a:
                    continue

                match_key = row_a['_match_key']

                # Get potential matches from grouped data
                if match_key in grouped_b.groups:
                    potential_matches = grouped_b.get_group(match_key)

                    for idx_b, row_b in potential_matches.iterrows():
                        if row_b['_orig_index_b'] in matched_indices_b:
                            continue

                        # Check tolerance rules if any
                        tolerance_match = True
                        for rule in recon_rules:
                            if rule.MatchType.lower() == "tolerance":
                                val_a = row_a[rule.LeftFileColumn]
                                val_b = row_b[rule.RightFileColumn]

                                if not self._check_tolerance_match(val_a, val_b, rule.ToleranceValue):
                                    tolerance_match = False
                                    break

                        if tolerance_match:
                            matched_indices_a.add(row_a['_orig_index_a'])
                            matched_indices_b.add(row_b['_orig_index_b'])

                            # Create match record with selected columns
                            match_record = self._create_match_record(
                                row_a, row_b, df_a, df_b,
                                selected_columns_a, selected_columns_b,
                                recon_rules
                            )
                            matches.append(match_record)
                            break

        # Create result DataFrames with selected columns
        matched_df = pd.DataFrame(matches) if matches else pd.DataFrame()

        unmatched_a = self._select_result_columns(
            df_a_work[~df_a_work['_orig_index_a'].isin(matched_indices_a)].drop(['_orig_index_a', '_match_key'],
                                                                                axis=1),
            selected_columns_a, recon_rules, 'A'
        )

        unmatched_b = self._select_result_columns(
            df_b_work[~df_b_work['_orig_index_b'].isin(matched_indices_b)].drop(['_orig_index_b', '_match_key'],
                                                                                axis=1),
            selected_columns_b, recon_rules, 'B'
        )

        return {
            'matched': matched_df,
            'unmatched_file_a': unmatched_a,
            'unmatched_file_b': unmatched_b
        }

    def _check_tolerance_match(self, val_a, val_b, tolerance: float) -> bool:
        """Check if two values match within tolerance"""
        try:
            if pd.isna(val_a) or pd.isna(val_b):
                return pd.isna(val_a) and pd.isna(val_b)

            num_a = float(val_a)
            num_b = float(val_b)

            if num_b != 0:
                percentage_diff = abs(num_a - num_b) / abs(num_b) * 100
                return percentage_diff <= tolerance
            else:
                return num_a == 0
        except (ValueError, TypeError):
            return False

    def _create_match_record(self, row_a, row_b, df_a, df_b,
                             selected_columns_a, selected_columns_b,
                             recon_rules) -> Dict:
        """Create a match record with selected columns"""
        match_record = {}

        # Get mandatory columns
        mandatory_a, mandatory_b = self.get_mandatory_columns(recon_rules, None, None)

        # Determine which columns to include
        cols_a = selected_columns_a if selected_columns_a else df_a.columns.tolist()
        cols_b = selected_columns_b if selected_columns_b else df_b.columns.tolist()

        # Ensure mandatory columns are included
        cols_a = list(set(cols_a) | mandatory_a)
        cols_b = list(set(cols_b) | mandatory_b)

        # Add columns from both files
        for col in cols_a:
            if col in row_a:
                match_record[f"FileA_{col}"] = row_a[col]

        for col in cols_b:
            if col in row_b:
                match_record[f"FileB_{col}"] = row_b[col]

        return match_record

    def _select_result_columns(self, df: pd.DataFrame, selected_columns: Optional[List[str]],
                               recon_rules: List[ReconciliationRule], file_type: str) -> pd.DataFrame:
        """Select only requested columns plus mandatory ones"""
        if selected_columns is None:
            return df

        # Get mandatory columns based on reconciliation rules
        mandatory_cols = set()
        for rule in recon_rules:
            if file_type == 'A':
                mandatory_cols.add(rule.LeftFileColumn)
            else:
                mandatory_cols.add(rule.RightFileColumn)

        # Combine selected and mandatory columns
        final_columns = list(set(selected_columns) | mandatory_cols)

        # Filter to only existing columns
        existing_columns = [col for col in final_columns if col in df.columns]

        return df[existing_columns] if existing_columns else df


# Create optimized storage for results with compression
class OptimizedReconciliationStorage:
    def __init__(self):
        self.storage = {}

    def store_results(self, recon_id: str, results: Dict[str, pd.DataFrame]) -> bool:
        """Store results with optimized format"""
        try:
            # Convert to optimized format for storage
            optimized_results = {
                'matched': results['matched'].to_dict('records'),
                'unmatched_file_a': results['unmatched_file_a'].to_dict('records'),
                'unmatched_file_b': results['unmatched_file_b'].to_dict('records'),
                'timestamp': pd.Timestamp.now(),
                'row_counts': {
                    'matched': len(results['matched']),
                    'unmatched_a': len(results['unmatched_file_a']),
                    'unmatched_b': len(results['unmatched_file_b'])
                }
            }

            self.storage[recon_id] = optimized_results
            return True
        except Exception as e:
            print(f"Error storing results: {e}")
            return False

    def get_results(self, recon_id: str) -> Optional[Dict]:
        """Get stored results"""
        return self.storage.get(recon_id)


# Global instances
optimized_reconciliation_storage = OptimizedReconciliationStorage()
