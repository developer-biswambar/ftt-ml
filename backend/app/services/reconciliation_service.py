import io
import re
from datetime import datetime
from functools import lru_cache
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from fastapi import UploadFile, HTTPException
from rapidfuzz import fuzz, process
import numpy as np

from app.models.recon_models import PatternCondition, FileRule, ExtractRule, FilterRule, ReconciliationRule

# Update forward reference
PatternCondition.model_rebuild()


class OptimizedFileProcessor:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self._pattern_cache = {}  # Cache compiled regex patterns
        self._date_cache = {}  # Cache parsed dates for performance

    def read_file(self, file: UploadFile, sheet_name: Optional[str] = None) -> pd.DataFrame:
        """Read CSV or Excel file into DataFrame with leading zero preservation and optimized settings"""
        try:
            content = file.file.read()
            file.file.seek(0)

            # Import the leading zero detection from file_routes
            from app.routes.file_routes import detect_leading_zero_columns
            
            # Step 1: Detect columns with leading zeros first
            dtype_mapping = detect_leading_zero_columns(content, file.filename, sheet_name)

            if file.filename.endswith('.csv'):
                df = pd.read_csv(
                    io.BytesIO(content),
                    low_memory=False,
                    engine='c',  # Use C engine for better performance
                    dtype=dtype_mapping if dtype_mapping else None  # Preserve leading zero columns as strings
                )
            elif file.filename.endswith(('.xlsx', '.xls')):
                if sheet_name:
                    df = pd.read_excel(
                        io.BytesIO(content), 
                        sheet_name=sheet_name, 
                        engine='openpyxl',
                        dtype=dtype_mapping if dtype_mapping else None  # Preserve leading zero columns as strings
                    )
                else:
                    df = pd.read_excel(
                        io.BytesIO(content), 
                        engine='openpyxl',
                        dtype=dtype_mapping if dtype_mapping else None  # Preserve leading zero columns as strings
                    )
            else:
                raise ValueError(f"Unsupported file format: {file.filename}")
            
            # Fix: Preserve integer types to prevent 15 -> 15.0 conversion (only for non-string columns)
            df = self._preserve_integer_types(df)
            return df
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading file {file.filename}: {str(e)}")
    
    def _preserve_integer_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Convert float columns back to integers where all values are whole numbers.
        This prevents 15 from being displayed as 15.0 in reconciliation results.
        IMPORTANT: Skip string columns that contain preserved leading zeros.
        """
        try:
            for col in df.columns:
                # Skip string/object columns (these may contain preserved leading zeros like '01')
                if df[col].dtype == 'object':
                    continue
                    
                if df[col].dtype == 'float64':
                    # Check if all non-null values are whole numbers
                    non_null_values = df[col].dropna()
                    if len(non_null_values) > 0:
                        # Check if all values are integers (no decimal part)
                        if all(float(val).is_integer() for val in non_null_values):
                            # Convert to Int64 (pandas nullable integer type) to handle NaN values
                            df[col] = df[col].astype('Int64')
                            
            return df
        except Exception as e:
            # If conversion fails, return original dataframe
            self.warnings.append(f"Warning: Could not preserve integer types: {str(e)}")
            return df

    def _calculate_composite_similarity(self, val_a, val_b, column_type: str = "text") -> float:
        """
        Calculate composite similarity score using multiple algorithms based on data type
        
        Args:
            val_a: Value from file A
            val_b: Value from file B  
            column_type: Type of data - "text", "numeric", "date", "identifier"
            
        Returns:
            Similarity score between 0.0 and 100.0
        """
        # Handle null values
        if pd.isna(val_a) and pd.isna(val_b):
            return 100.0
        if pd.isna(val_a) or pd.isna(val_b):
            return 0.0
            
        # Convert to strings for comparison
        str_a = str(val_a).strip()
        str_b = str(val_b).strip()
        
        # Exact match gets perfect score
        if str_a == str_b:
            return 100.0
            
        # Different algorithms based on data type
        if column_type == "numeric":
            return self._calculate_numeric_similarity(val_a, val_b)
        elif column_type == "date":
            return self._calculate_date_similarity(val_a, val_b)
        elif column_type == "identifier":
            return self._calculate_identifier_similarity(str_a, str_b)
        else:  # text/default
            return self._calculate_text_similarity(str_a, str_b)
    
    def _calculate_text_similarity(self, str_a: str, str_b: str) -> float:
        """Calculate text similarity using multiple fuzzy algorithms"""
        if not str_a or not str_b:
            return 0.0
            
        # Multiple fuzzy matching algorithms with weights
        algorithms = {
            'ratio': fuzz.ratio(str_a, str_b) * 0.3,              # Basic similarity
            'partial_ratio': fuzz.partial_ratio(str_a, str_b) * 0.2,  # Partial matching
            'token_sort_ratio': fuzz.token_sort_ratio(str_a, str_b) * 0.25,  # Token order independent
            'token_set_ratio': fuzz.token_set_ratio(str_a, str_b) * 0.25    # Token set comparison
        }
        
        # Weighted composite score
        composite_score = sum(algorithms.values())
        return min(composite_score, 100.0)
    
    def _calculate_numeric_similarity(self, val_a, val_b) -> float:
        """Calculate numeric similarity with tolerance handling"""
        try:
            num_a = float(val_a)
            num_b = float(val_b)
            
            # Exact match
            if num_a == num_b:
                return 100.0
            
            # Calculate percentage difference
            if num_b != 0:
                percentage_diff = abs(num_a - num_b) / abs(num_b) * 100
            else:
                return 100.0 if num_a == 0 else 0.0
            
            # Convert to similarity score (inverse of difference)
            # 0% difference = 100% similarity
            # 1% difference = 99% similarity, etc.
            similarity = max(0, 100 - percentage_diff)
            return similarity
            
        except (ValueError, TypeError):
            # Fall back to string comparison for non-numeric values
            return self._calculate_text_similarity(str(val_a), str(val_b))
    
    def _calculate_date_similarity(self, val_a, val_b) -> float:
        """Calculate date similarity with format tolerance"""
        try:
            # Try to parse dates in multiple formats
            date_a = pd.to_datetime(val_a, errors='coerce')
            date_b = pd.to_datetime(val_b, errors='coerce')
            
            if pd.isna(date_a) or pd.isna(date_b):
                # Fall back to string comparison if date parsing fails
                return self._calculate_text_similarity(str(val_a), str(val_b))
            
            # Exact date match
            if date_a == date_b:
                return 100.0
            
            # Calculate day difference
            day_diff = abs((date_a - date_b).days)
            
            # Similarity decreases with day difference
            # Same day = 100%, 1 day = 95%, 7 days = 65%, 30 days = 0%
            if day_diff == 0:
                return 100.0
            elif day_diff <= 1:
                return 95.0
            elif day_diff <= 7:
                return max(0, 95 - (day_diff - 1) * 5)  # 95, 90, 85, 80, 75, 70, 65
            elif day_diff <= 30:
                return max(0, 65 - (day_diff - 7) * 2.8)  # Gradual decrease to 0
            else:
                return 0.0
                
        except Exception:
            # Fall back to string comparison
            return self._calculate_text_similarity(str(val_a), str(val_b))
    
    def _calculate_identifier_similarity(self, str_a: str, str_b: str) -> float:
        """Calculate similarity for identifiers (account numbers, transaction IDs, etc.)"""
        if not str_a or not str_b:
            return 0.0
        
        # For identifiers, we're more strict but allow for minor variations
        algorithms = {
            'ratio': fuzz.ratio(str_a, str_b) * 0.4,              # Basic similarity (higher weight)
            'partial_ratio': fuzz.partial_ratio(str_a, str_b) * 0.3,  # Partial matching
            'token_sort_ratio': fuzz.token_sort_ratio(str_a, str_b) * 0.3   # Token order independent
        }
        
        composite_score = sum(algorithms.values())
        return min(composite_score, 100.0)
    
    def _detect_column_type(self, column_name: str, sample_values: List) -> str:
        """
        Detect the most likely data type of a column based on name and sample values
        """
        column_name_lower = column_name.lower()
        
        # Date detection
        date_keywords = ['date', 'time', 'created', 'updated', 'timestamp', 'day', 'month', 'year']
        if any(keyword in column_name_lower for keyword in date_keywords):
            return "date"
        
        # Numeric detection  
        numeric_keywords = ['amount', 'value', 'price', 'cost', 'total', 'sum', 'balance', 'quantity', 'qty']
        if any(keyword in column_name_lower for keyword in numeric_keywords):
            return "numeric"
        
        # Identifier detection
        id_keywords = ['id', 'ref', 'reference', 'number', 'account', 'code', 'key']
        if any(keyword in column_name_lower for keyword in id_keywords):
            return "identifier"
        
        # Analyze sample values
        if sample_values:
            non_null_values = [v for v in sample_values if not pd.isna(v)][:10]  # Sample first 10 non-null values
            
            if non_null_values:
                # Check if most values are numeric
                numeric_count = 0
                for val in non_null_values:
                    try:
                        float(val)
                        numeric_count += 1
                    except (ValueError, TypeError):
                        pass
                
                if numeric_count >= len(non_null_values) * 0.7:  # 70% are numeric
                    return "numeric"
                
                # Check if most values look like dates
                date_count = 0
                for val in non_null_values:
                    if pd.to_datetime(val, errors='coerce') is not pd.NaT:
                        date_count += 1
                
                if date_count >= len(non_null_values) * 0.7:  # 70% are dates
                    return "date"
        
        # Default to text
        return "text"

    def _check_equals_match(self, val_a, val_b) -> bool:
        """Check equality with STRICT string matching (no auto date detection)"""
        # Handle null values
        if pd.isna(val_a) and pd.isna(val_b):
            return True
        if pd.isna(val_a) or pd.isna(val_b):
            return False

        # Try exact match first (fastest path)
        if val_a == val_b:
            return True

        # Convert to strings and strip whitespace
        str_a = str(val_a).strip()
        str_b = str(val_b).strip()
        
        # Don't match empty strings (they should be explicit matches)
        if not str_a or not str_b:
            return False

        # Case-insensitive string comparison (preserves leading zeros)
        return str_a.lower() == str_b.lower()

    def _check_date_equals_match(self, val_a, val_b) -> bool:
        """Check if two values match as dates using shared date utilities (for explicit date_equals match type)"""
        from app.utils.date_utils import check_date_equals_match
        return check_date_equals_match(val_a, val_b)

    def _check_numeric_equals(self, val_a, val_b) -> bool:
        """
        Check if two values are numerically equal, handling cases like:
        - "01" vs "1" → True
        - "09" vs "9" → True  
        - "007" vs "7" → True
        Only for non-date values.
        """
        try:
            # Convert both values to strings first
            str_a = str(val_a).strip()
            str_b = str(val_b).strip()
            
            # Skip if either value is empty
            if not str_a or not str_b:
                return False
            
            # Try to convert both to numbers
            # This handles integers, floats, and numeric strings
            try:
                num_a = float(str_a)
                num_b = float(str_b)
                
                # Check if both are integers (no decimal part)
                if num_a.is_integer() and num_b.is_integer():
                    # Compare as integers: "01" (1.0) == "1" (1.0) → True
                    return int(num_a) == int(num_b)
                else:
                    # For decimals, use float comparison
                    return num_a == num_b
                    
            except (ValueError, TypeError):
                # If either value can't be converted to number, not a numeric match
                return False
                
        except Exception:
            # If anything goes wrong, not a numeric match
            return False

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
        """Cache compiled regex patterns for better performance with case insensitive flag"""
        return re.compile(pattern, re.IGNORECASE)

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
                    # Case insensitive string comparison for equals
                    if isinstance(value, str):
                        filtered_df = filtered_df[filtered_df[column].astype(str).str.lower() == str(value).lower()]
                    else:
                        filtered_df = filtered_df[filtered_df[column] == value]
                elif match_type == "not_equals":
                    # Case insensitive string comparison for not_equals
                    if isinstance(value, str):
                        filtered_df = filtered_df[filtered_df[column].astype(str).str.lower() != str(value).lower()]
                    else:
                        filtered_df = filtered_df[filtered_df[column] != value]
                elif match_type == "greater_than":
                    numeric_col = pd.to_numeric(filtered_df[column], errors='coerce')
                    filtered_df = filtered_df[numeric_col > value]
                elif match_type == "less_than":
                    numeric_col = pd.to_numeric(filtered_df[column], errors='coerce')
                    filtered_df = filtered_df[numeric_col < value]
                elif match_type == "contains":
                    # Case insensitive contains
                    filtered_df = filtered_df[filtered_df[column].astype(str).str.contains(str(value), case=False, na=False)]
                elif match_type == "in":
                    if isinstance(value, str):
                        value = [v.strip() for v in value.split(',')]
                    # Case insensitive in operation
                    if all(isinstance(v, str) for v in value):
                        # Convert both column values and filter values to lowercase for comparison
                        value_lower = [str(v).lower() for v in value]
                        filtered_df = filtered_df[filtered_df[column].astype(str).str.lower().isin(value_lower)]
                    else:
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
                                    file_prefix: str) -> Tuple[
        pd.DataFrame, List[ReconciliationRule], List[ReconciliationRule]]:
        """Create optimized match keys for faster reconciliation"""
        df_work = df.copy()

        # Create composite match key for exact matches (excluding date_equals and tolerance)
        exact_match_cols = []
        tolerance_rules = []
        date_rules = []

        for rule in recon_rules:
            col_name = rule.LeftFileColumn if file_prefix == 'A' else rule.RightFileColumn

            if rule.MatchType.lower() == "equals":
                exact_match_cols.append(col_name)
            elif rule.MatchType.lower() == "tolerance":
                tolerance_rules.append(rule)
            elif rule.MatchType.lower() == "date_equals":
                date_rules.append(rule)

        # Create composite key for exact matches only (dates and tolerance handled separately)
        if exact_match_cols:
            # Make match key case insensitive by converting to lowercase
            df_work['_match_key'] = df_work[exact_match_cols].astype(str).apply(lambda x: x.str.lower()).agg('|'.join, axis=1)
        else:
            df_work['_match_key'] = df_work.index.astype(str)

        return df_work, tolerance_rules, date_rules

    def reconcile_files_optimized(self, df_a: pd.DataFrame, df_b: pd.DataFrame,
                                  recon_rules: List[ReconciliationRule],
                                  selected_columns_a: Optional[List[str]] = None,
                                  selected_columns_b: Optional[List[str]] = None,
                                  match_mode: str = "one_to_one",
                                  find_closest_matches: bool = False) -> Dict[str, pd.DataFrame]:
        """
        Optimized reconciliation using hash-based matching for large datasets with date support
        
        Args:
            match_mode: Matching behavior
                - "one_to_one": Each record matches at most once (default, fastest)
                - "one_to_many": File A records can match multiple File B records  
                - "many_to_one": Multiple File A records can match same File B record
                - "many_to_many": Full cartesian matching (slowest)
        """

        # Create working copies with indices and separate rule types
        df_a_work, tolerance_rules_a, date_rules_a = self.create_optimized_match_keys(df_a, recon_rules, 'A')
        df_b_work, tolerance_rules_b, date_rules_b = self.create_optimized_match_keys(df_b, recon_rules, 'B')

        df_a_work['_orig_index_a'] = range(len(df_a_work))
        df_b_work['_orig_index_b'] = range(len(df_b_work))

        # Group by match key for faster lookups (only for exact matches)
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
                # Removed: Skip already matched records (allows many-to-many)
                
                match_key = row_a['_match_key']

                # Get potential matches from grouped data
                if match_key in grouped_b.groups:
                    potential_matches = grouped_b.get_group(match_key)

                    for idx_b, row_b in potential_matches.iterrows():
                        # Removed: Skip already matched records (allows many-to-many)

                        # Check all reconciliation rules
                        all_rules_match = True

                        for rule in recon_rules:
                            val_a = row_a[rule.LeftFileColumn]
                            val_b = row_b[rule.RightFileColumn]

                            if rule.MatchType.lower() == "equals":
                                # Use strict string matching for equals
                                if not self._check_equals_match(val_a, val_b):
                                    all_rules_match = False
                                    break
                            elif rule.MatchType.lower() == "date_equals":
                                # Explicit date matching
                                if not self._check_date_equals_match(val_a, val_b):
                                    all_rules_match = False
                                    break
                            elif rule.MatchType.lower() == "tolerance":
                                # Tolerance matching
                                if not self._check_tolerance_match(val_a, val_b, rule.ToleranceValue):
                                    all_rules_match = False
                                    break
                            elif rule.MatchType.lower() == "fuzzy":
                                # Fuzzy matching (case insensitive)
                                if not self._check_fuzzy_match(val_a, val_b, rule.ToleranceValue):
                                    all_rules_match = False
                                    break

                        if all_rules_match:
                            # Create match record with selected columns
                            match_record = self._create_match_record(
                                row_a, row_b, df_a, df_b,
                                selected_columns_a, selected_columns_b,
                                recon_rules
                            )
                            matches.append(match_record)
                            
                            # Track matched records for unmatched calculation
                            matched_indices_a.add(row_a['_orig_index_a'])
                            matched_indices_b.add(row_b['_orig_index_b'])
                            # No break - allows many-to-many matching

        # Create result DataFrames with selected columns
        matched_df = pd.DataFrame(matches) if matches else pd.DataFrame()

        # Unmatched records are calculated based on matched_indices sets

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

        # Add closest match functionality if requested
        if find_closest_matches and len(unmatched_a) > 0 and len(unmatched_b) > 0:
            print(f"Finding closest matches for {len(unmatched_a)} unmatched A records and {len(unmatched_b)} unmatched B records...")
            unmatched_a = self._add_closest_matches(unmatched_a, unmatched_b, recon_rules, 'A')
            unmatched_b = self._add_closest_matches(unmatched_b, unmatched_a, recon_rules, 'B')

        return {
            'matched': matched_df,
            'unmatched_file_a': unmatched_a,
            'unmatched_file_b': unmatched_b
        }

    def _add_closest_matches(self, unmatched_source: pd.DataFrame, unmatched_target: pd.DataFrame, 
                            recon_rules: List[ReconciliationRule], source_file: str) -> pd.DataFrame:
        """
        Add closest match columns to unmatched records using composite similarity scoring
        
        Args:
            unmatched_source: Unmatched records from source file
            unmatched_target: Unmatched records from target file (for comparison)
            recon_rules: Reconciliation rules to determine which columns to compare
            source_file: 'A' or 'B' to indicate which file is the source
            
        Returns:
            DataFrame with closest match information added
        """
        if len(unmatched_source) == 0 or len(unmatched_target) == 0:
            return unmatched_source
            
        # Make a copy to avoid modifying the original
        result_df = unmatched_source.copy()
        
        # Initialize closest match columns
        result_df['closest_match_record'] = None
        result_df['closest_match_score'] = 0.0
        result_df['closest_match_details'] = None
        
        # Get columns to compare based on reconciliation rules
        compare_columns = []
        for rule in recon_rules:
            if source_file == 'A':
                source_col = rule.LeftFileColumn
                target_col = rule.RightFileColumn
            else:
                source_col = rule.RightFileColumn  
                target_col = rule.LeftFileColumn
                
            if source_col in unmatched_source.columns and target_col in unmatched_target.columns:
                compare_columns.append((source_col, target_col))
        
        if not compare_columns:
            print(f"Warning: No comparable columns found for closest match analysis")
            return result_df
            
        print(f"Comparing {len(compare_columns)} column pairs for closest matches")
        
        # Process each unmatched record
        for idx, source_row in unmatched_source.iterrows():
            best_match_score = 0.0
            best_match_record = None
            best_match_details = {}
            
            # Compare with each record in the target file
            for target_idx, target_row in unmatched_target.iterrows():
                # Calculate composite similarity across all comparable columns
                column_scores = {}
                total_weighted_score = 0.0
                
                for source_col, target_col in compare_columns:
                    source_val = source_row[source_col]
                    target_val = target_row[target_col]
                    
                    # Detect column type for appropriate similarity calculation
                    column_type = self._detect_column_type(
                        source_col, 
                        unmatched_source[source_col].head(10).tolist()
                    )
                    
                    # Calculate similarity
                    similarity = self._calculate_composite_similarity(source_val, target_val, column_type)
                    column_scores[f"{source_col}_vs_{target_col}"] = {
                        'score': similarity,
                        'source_value': source_val,
                        'target_value': target_val,
                        'type': column_type
                    }
                    
                    # Weight each column equally for now (could be enhanced to use rule-specific weights)
                    total_weighted_score += similarity
                
                # Average score across all columns
                if compare_columns:
                    avg_score = total_weighted_score / len(compare_columns)
                else:
                    avg_score = 0.0
                
                # Update best match if this is better
                if avg_score > best_match_score:
                    best_match_score = avg_score
                    best_match_record = target_row.to_dict()
                    best_match_details = column_scores
            
            # Add closest match information to result
            if best_match_score > 0:
                # Create simplified record summary instead of full JSON
                if best_match_record:
                    record_summary = []
                    for key, value in list(best_match_record.items())[:3]:  # Show first 3 key fields
                        record_summary.append(f"{key}: {value}")
                    result_df.at[idx, 'closest_match_record'] = "; ".join(record_summary)
                else:
                    result_df.at[idx, 'closest_match_record'] = "No match details available"
                result_df.at[idx, 'closest_match_score'] = round(best_match_score, 2)
                
                # Create simple closest match details showing only mismatched columns
                details_list = []
                for column_key, details in best_match_details.items():
                    source_val = details['source_value']
                    target_val = details['target_value']
                    score = details['score']
                    
                    # Only include columns that don't match exactly (score < 100)
                    if score < 100:
                        # Extract just the column name from the key (e.g., "transaction_id_vs_ref_id" -> "transaction_id")
                        column_name = column_key.split('_vs_')[0]
                        details_list.append(f"{column_name}: '{source_val}' → '{target_val}'")
                
                if details_list:
                    result_df.at[idx, 'closest_match_details'] = "; ".join(details_list)
                else:
                    result_df.at[idx, 'closest_match_details'] = "All columns match exactly"
                
        print(f"Added closest match information to {len(result_df)} records")
        return result_df

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

    def _check_fuzzy_match(self, val_a, val_b, threshold: float) -> bool:
        """Check if two string values match using fuzzy matching (case insensitive)"""
        try:
            if pd.isna(val_a) or pd.isna(val_b):
                return pd.isna(val_a) and pd.isna(val_b)

            str_a = str(val_a).strip().lower()
            str_b = str(val_b).strip().lower()
            
            # Simple fuzzy matching using character overlap ratio
            if len(str_a) == 0 and len(str_b) == 0:
                return True
            if len(str_a) == 0 or len(str_b) == 0:
                return False
            
            # Calculate similarity ratio
            # Use a simple approach: common characters / max length
            common_chars = sum(1 for c in str_a if c in str_b)
            max_len = max(len(str_a), len(str_b))
            similarity = common_chars / max_len
            
            return similarity >= threshold
            
        except Exception:
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
