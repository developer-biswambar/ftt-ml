import json
import logging
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Optional, Any

import pandas as pd
from fastapi import APIRouter
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.storage import uploaded_files, reconciliations

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")

# Setup logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder":
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI client initialized for reconciliation")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenAI client: {e}")

# Create router
router = APIRouter(prefix="/api/v1/reconcile", tags=["reconciliation"])


# Pydantic models
class ReconciliationRule(BaseModel):
    rule_type: str  # 'match', 'filter', 'extract', 'transform', 'composite'
    source_column: str
    target_column: str
    operation: str  # 'exact', 'fuzzy', 'contains', 'numerical', 'date', 'composite'
    parameters: Dict[str, Any]
    confidence: float
    description: Optional[str] = None


class ReconciliationRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    user_requirements: str = Field(..., description="Natural language description of reconciliation requirements")
    match_columns: Optional[List[Dict[str, str]]] = None  # Manual column mappings if provided
    tolerance_settings: Optional[Dict[str, Any]] = None  # Various tolerances
    output_unmatched: bool = True
    sample_size: Optional[int] = Field(default=100, description="Sample size for LLM analysis")
    enable_composite_matching: bool = Field(default=True, description="Enable matching on multiple columns")


class ReconciliationResult(BaseModel):
    reconciliation_id: str
    status: str
    matched_count: int
    unmatched_file_a_count: int
    unmatched_file_b_count: int
    match_rate: float
    applied_rules: List[Dict[str, Any]]
    processing_time: float
    created_at: str
    completed_at: Optional[str]


# Enhanced pattern detection for various financial data types
class FinancialPatternDetector:
    """Detects patterns in financial data columns"""

    def __init__(self):
        self.patterns = {
            # Security identifiers
            'isin': r'\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b',
            'cusip': r'\b[0-9]{3}[A-Z0-9]{6}\b',
            'sedol': r'\b[B-DF-HJ-NP-TV-Z0-9]{7}\b',
            'ticker': r'\b[A-Z]{1,5}\b(?:\.[A-Z]{1,2})?',
            'ric': r'\b[A-Z0-9]+\.[A-Z]{1,2}\b',

            # Reference numbers
            'trade_ref': r'\b(?:TRD|REF|TX|TRADE|ORD|ORDER)[A-Z0-9-]+\b',
            'account': r'\b(?:ACC|ACCT|ACCOUNT|AC)[A-Z0-9-]+\b',
            'portfolio': r'\b(?:PORT|PF|PORTFOLIO)[A-Z0-9-]+\b',

            # Monetary values
            'amount': r'[+-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?',
            'currency': r'\b(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|CNY|HKD|SGD|SEK|NOK|DKK)\b',

            # Dates
            'date_iso': r'\b\d{4}-\d{2}-\d{2}\b',
            'date_us': r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
            'date_eu': r'\b\d{1,2}\.\d{1,2}\.\d{2,4}\b',

            # Percentages and rates
            'percentage': r'[+-]?\d+(?:\.\d+)?%',
            'rate': r'\b\d+(?:\.\d+)?(?:bp|bps|%)\b',

            # Quantities
            'quantity': r'\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:shares?|units?|lots?)\b',

            # Legal entities
            'lei': r'\b[A-Z0-9]{20}\b',
            'company': r'\b(?:Inc|Corp|Ltd|LLC|plc|GmbH|SA|SpA|AG)\b',

            # Status indicators
            'status': r'\b(?:PENDING|COMPLETED|SETTLED|FAILED|ACTIVE|CANCELLED|MATCHED|UNMATCHED)\b',
            'buy_sell': r'\b(?:BUY|SELL|B|S|BOUGHT|SOLD|LONG|SHORT)\b'
        }

    def detect_patterns(self, series: pd.Series) -> Dict[str, Any]:
        """Detect all patterns in a data series"""
        detected = defaultdict(list)
        stats = {}

        # Sample values for pattern detection
        sample_size = min(1000, len(series))
        if sample_size < len(series):
            sample = series.dropna().sample(sample_size, random_state=42)
        else:
            sample = series.dropna()

        # Check each pattern
        for pattern_name, pattern_regex in self.patterns.items():
            matches = []
            for value in sample:
                str_value = str(value)
                found = re.findall(pattern_regex, str_value, re.IGNORECASE)
                if found:
                    matches.extend(found)

            if matches:
                detected[pattern_name] = list(set(matches[:20]))  # Keep unique samples

        # Detect data type characteristics
        stats['is_numeric'] = pd.api.types.is_numeric_dtype(series)
        stats['is_date'] = pd.api.types.is_datetime64_any_dtype(series)
        stats['unique_ratio'] = series.nunique() / len(series) if len(series) > 0 else 0
        stats['null_ratio'] = series.isna().sum() / len(series) if len(series) > 0 else 0

        # Try to parse as date if not already
        if not stats['is_date'] and series.dtype == 'object':
            try:
                pd.to_datetime(sample.head(10), errors='coerce')
                stats['likely_date'] = True
            except:
                stats['likely_date'] = False

        return {
            'patterns': dict(detected),
            'statistics': stats,
            'sample_values': sample.head(10).tolist()
        }


# Utility functions
async def analyze_file_schema(df: pd.DataFrame, detector: FinancialPatternDetector) -> Dict[str, Any]:
    """Comprehensive analysis of file schema and data patterns"""
    schema_info = {
        "columns": list(df.columns),
        "row_count": len(df),
        "column_analysis": {}
    }

    for col in df.columns:
        col_analysis = detector.detect_patterns(df[col])

        schema_info["column_analysis"][col] = {
            "dtype": str(df[col].dtype),
            "patterns": col_analysis['patterns'],
            "statistics": col_analysis['statistics'],
            "sample_values": col_analysis['sample_values'],
            "null_count": int(df[col].isna().sum()),
            "unique_count": int(df[col].nunique())
        }

    return schema_info


async def generate_reconciliation_rules(schema_a: Dict, schema_b: Dict, user_requirements: str) -> List[
    ReconciliationRule]:
    """Generate reconciliation rules using LLM based on detected patterns"""

    if not openai_client:
        return generate_fallback_rules(schema_a, schema_b)

    system_prompt = """You are an expert in financial data reconciliation. Generate reconciliation rules based on user requirements and detected data patterns.

Analyze the data patterns and statistics to determine the best matching strategy. Consider:

1. **Identifier Matching**: Use exact matching for unique identifiers (trade IDs, ISINs, account numbers)
2. **Numerical Matching**: Use tolerance-based matching for amounts, quantities, percentages
3. **Date Matching**: Allow configurable day tolerance for dates
4. **Text Matching**: Use fuzzy matching for names, descriptions
5. **Composite Matching**: Combine multiple fields when no single unique identifier exists
6. **Status Matching**: Consider business logic (e.g., PENDING vs COMPLETED might be acceptable)

Return a JSON array of reconciliation rules:
[
    {
        "rule_type": "match|filter|extract|transform|composite",
        "source_column": "column_from_file_a",
        "target_column": "column_from_file_b",
        "operation": "exact|fuzzy|contains|numerical|date|composite",
        "parameters": {
            "threshold": 0.95,  // for fuzzy matching
            "tolerance": 0.01,  // for numerical (1% tolerance)
            "tolerance_type": "percentage|absolute",
            "date_tolerance_days": 2,  // for date matching
            "pattern": "regex_pattern",  // for extraction
            "composite_columns": ["col1", "col2"],  // for composite matching
            "case_sensitive": false
        },
        "confidence": 0.9,
        "description": "Explanation of the rule"
    }
]

Prioritize rules based on:
- Data uniqueness (unique identifiers get higher priority)
- Pattern confidence (clear patterns get higher priority)
- User requirements alignment"""

    # Build detailed context for LLM
    user_prompt = f"""
User Requirements: {user_requirements}

File A Analysis:
Columns: {json.dumps([col for col in schema_a['columns']], indent=2)}
Column Details:
{json.dumps({col: {
        'patterns': details['patterns'],
        'is_numeric': details['statistics'].get('is_numeric', False),
        'unique_ratio': details['statistics'].get('unique_ratio', 0),
        'sample': details['sample_values'][:3]
    } for col, details in schema_a['column_analysis'].items()}, indent=2)}

File B Analysis:
Columns: {json.dumps([col for col in schema_b['columns']], indent=2)}
Column Details:
{json.dumps({col: {
        'patterns': details['patterns'],
        'is_numeric': details['statistics'].get('is_numeric', False),
        'unique_ratio': details['statistics'].get('unique_ratio', 0),
        'sample': details['sample_values'][:3]
    } for col, details in schema_b['column_analysis'].items()}, indent=2)}

Generate comprehensive reconciliation rules that will effectively match records between these files based on the detected patterns and user requirements.
"""

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=3000,
            response_format={"type": "json_object"}
        )

        # Parse the response
        response_content = response.choices[0].message.content
        rules_data = json.loads(response_content)

        # Handle different response formats
        if isinstance(rules_data, dict):
            if 'rules' in rules_data:
                rules_data = rules_data['rules']
            elif 'reconciliation_rules' in rules_data:
                rules_data = rules_data['reconciliation_rules']
            else:
                rules_data = [rules_data]

        rules = []
        for rule_data in rules_data:
            rule = ReconciliationRule(**rule_data)
            rules.append(rule)

        return rules

    except Exception as e:
        logger.error(f"Error generating rules with LLM: {e}")
        return generate_fallback_rules(schema_a, schema_b)


def generate_fallback_rules(schema_a: Dict, schema_b: Dict) -> List[ReconciliationRule]:
    """Generate intelligent fallback rules based on pattern detection"""
    rules = []

    # Analyze columns from both files
    cols_a = schema_a['column_analysis']
    cols_b = schema_b['column_analysis']

    # Priority 1: Match unique identifiers
    for col_a, details_a in cols_a.items():
        for col_b, details_b in cols_b.items():
            # Check for similar identifier patterns
            common_patterns = set(details_a['patterns'].keys()) & set(details_b['patterns'].keys())

            # High confidence for unique identifiers
            if common_patterns & {'isin', 'cusip', 'sedol', 'trade_ref', 'account', 'lei'}:
                if details_a['statistics']['unique_ratio'] > 0.8 and details_b['statistics']['unique_ratio'] > 0.8:
                    rules.append(ReconciliationRule(
                        rule_type="match",
                        source_column=col_a,
                        target_column=col_b,
                        operation="exact",
                        parameters={"case_sensitive": False},
                        confidence=0.95,
                        description=f"Match on {list(common_patterns)[0]} identifier"
                    ))

    # Priority 2: Match amounts and numerical values
    for col_a, details_a in cols_a.items():
        if details_a['statistics'].get('is_numeric', False):
            for col_b, details_b in cols_b.items():
                if details_b['statistics'].get('is_numeric', False):
                    # Check if column names suggest same data
                    if any(term in col_a.lower() and term in col_b.lower()
                           for term in ['amount', 'value', 'price', 'quantity', 'balance']):
                        rules.append(ReconciliationRule(
                            rule_type="match",
                            source_column=col_a,
                            target_column=col_b,
                            operation="numerical",
                            parameters={"tolerance": 0.01, "tolerance_type": "percentage"},
                            confidence=0.85,
                            description=f"Match {col_a} with {col_b} allowing 1% tolerance"
                        ))

    # Priority 3: Match dates
    for col_a, details_a in cols_a.items():
        if details_a['statistics'].get('is_date') or details_a['patterns'].get('date_iso'):
            for col_b, details_b in cols_b.items():
                if details_b['statistics'].get('is_date') or details_b['patterns'].get('date_iso'):
                    if any(term in col_a.lower() and term in col_b.lower()
                           for term in ['date', 'time', 'settlement', 'trade', 'value']):
                        rules.append(ReconciliationRule(
                            rule_type="match",
                            source_column=col_a,
                            target_column=col_b,
                            operation="date",
                            parameters={"date_tolerance_days": 1},
                            confidence=0.8,
                            description=f"Match dates allowing 1 day difference"
                        ))

    # Priority 4: Exact name matches
    for col_a in cols_a:
        for col_b in cols_b:
            if col_a.lower() == col_b.lower():
                rules.append(ReconciliationRule(
                    rule_type="match",
                    source_column=col_a,
                    target_column=col_b,
                    operation="fuzzy",
                    parameters={"threshold": 0.9},
                    confidence=0.7,
                    description=f"Column name match: {col_a}"
                ))

    return rules


def apply_transformation(value: Any, transformation: str, parameters: Dict = None) -> Any:
    """Apply various transformations to values"""
    if pd.isna(value):
        return value

    value_str = str(value)

    if transformation == 'upper':
        return value_str.upper()
    elif transformation == 'lower':
        return value_str.lower()
    elif transformation == 'strip':
        return value_str.strip()
    elif transformation == 'remove_spaces':
        return value_str.replace(' ', '')
    elif transformation == 'extract_pattern' and parameters:
        pattern = parameters.get('pattern', '')
        match = re.search(pattern, value_str)
        return match.group(0) if match else value_str
    elif transformation == 'normalize_date':
        try:
            return pd.to_datetime(value_str).strftime('%Y-%m-%d')
        except:
            return value_str

    return value


def is_match(value_a: Any, value_b: Any, rule: ReconciliationRule) -> bool:
    """Enhanced matching logic for various data types"""
    if pd.isna(value_a) or pd.isna(value_b):
        return False

    operation = rule.operation
    params = rule.parameters

    if operation == 'exact':
        if params.get('case_sensitive', True):
            return str(value_a) == str(value_b)
        else:
            return str(value_a).lower().strip() == str(value_b).lower().strip()

    elif operation == 'fuzzy':
        # For production, use fuzzywuzzy or similar
        threshold = params.get('threshold', 0.85)
        # Simplified implementation
        str_a, str_b = str(value_a).lower(), str(value_b).lower()
        if str_a == str_b:
            return True
        # Check if one contains the other
        if len(str_a) > 3 and len(str_b) > 3:
            return str_a in str_b or str_b in str_a
        return False

    elif operation == 'contains':
        str_a, str_b = str(value_a).lower(), str(value_b).lower()
        return str_a in str_b or str_b in str_a

    elif operation == 'numerical':
        try:
            # Remove common formatting
            num_a = float(str(value_a).replace(',', '').replace('$', '').replace('€', '').replace('£', ''))
            num_b = float(str(value_b).replace(',', '').replace('$', '').replace('€', '').replace('£', ''))

            tolerance = params.get('tolerance', 0.0)
            tolerance_type = params.get('tolerance_type', 'percentage')

            if tolerance_type == 'percentage':
                if num_a == 0 and num_b == 0:
                    return True
                avg = (abs(num_a) + abs(num_b)) / 2
                return abs(num_a - num_b) / avg <= tolerance if avg != 0 else False
            else:  # absolute
                return abs(num_a - num_b) <= tolerance
        except:
            return False

    elif operation == 'date':
        try:
            date_a = pd.to_datetime(value_a)
            date_b = pd.to_datetime(value_b)
            tolerance_days = params.get('date_tolerance_days', 0)
            return abs((date_a - date_b).days) <= tolerance_days
        except:
            return False

    return False


async def apply_reconciliation_rules(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                     rules: List[ReconciliationRule]) -> Dict[str, Any]:
    """Apply reconciliation rules with support for composite matching"""

    # Prepare dataframes
    df_a_processed = df_a.copy()
    df_b_processed = df_b.copy()

    # Apply transformation rules
    for rule in rules:
        if rule.rule_type == 'transform':
            transformation = rule.parameters.get('transformation', '')
            if rule.source_column in df_a_processed.columns:
                col_name = f"{rule.source_column}_transformed"
                df_a_processed[col_name] = df_a_processed[rule.source_column].apply(
                    lambda x: apply_transformation(x, transformation, rule.parameters)
                )
            if rule.target_column in df_b_processed.columns:
                col_name = f"{rule.target_column}_transformed"
                df_b_processed[col_name] = df_b_processed[rule.target_column].apply(
                    lambda x: apply_transformation(x, transformation, rule.parameters)
                )

    # Track matches
    matched_indices_a = set()
    matched_indices_b = set()
    matches = []

    # Sort rules by confidence (highest first)
    match_rules = [r for r in rules if r.rule_type == 'match']
    match_rules.sort(key=lambda x: x.confidence, reverse=True)

    # Apply matching rules
    for rule in match_rules:
        source_col = rule.source_column
        target_col = rule.target_column

        # Check for transformed columns
        if f"{source_col}_transformed" in df_a_processed.columns:
            source_col = f"{source_col}_transformed"
        if f"{target_col}_transformed" in df_b_processed.columns:
            target_col = f"{target_col}_transformed"

        # Skip if columns don't exist
        if source_col not in df_a_processed.columns or target_col not in df_b_processed.columns:
            continue

        # For composite matching
        if rule.operation == 'composite':
            composite_cols_a = rule.parameters.get('composite_columns_a', [source_col])
            composite_cols_b = rule.parameters.get('composite_columns_b', [target_col])

            for idx_a, row_a in df_a_processed.iterrows():
                if idx_a in matched_indices_a:
                    continue

                for idx_b, row_b in df_b_processed.iterrows():
                    if idx_b in matched_indices_b:
                        continue

                    # Check all composite columns
                    all_match = True
                    for col_a, col_b in zip(composite_cols_a, composite_cols_b):
                        if col_a in df_a_processed.columns and col_b in df_b_processed.columns:
                            if not is_match(row_a[col_a], row_b[col_b], rule):
                                all_match = False
                                break

                    if all_match:
                        matches.append({
                            'index_a': idx_a,
                            'index_b': idx_b,
                            'matched_on': f"Composite: {', '.join(composite_cols_a)}",
                            'match_type': rule.operation,
                            'confidence': rule.confidence,
                            'rule_description': rule.description
                        })
                        matched_indices_a.add(idx_a)
                        matched_indices_b.add(idx_b)
                        break
        else:
            # Standard matching
            for idx_a, row_a in df_a_processed.iterrows():
                if idx_a in matched_indices_a:
                    continue

                for idx_b, row_b in df_b_processed.iterrows():
                    if idx_b in matched_indices_b:
                        continue

                    if is_match(row_a[source_col], row_b[target_col], rule):
                        matches.append({
                            'index_a': idx_a,
                            'index_b': idx_b,
                            'matched_on': f"{rule.source_column} <-> {rule.target_column}",
                            'match_type': rule.operation,
                            'confidence': rule.confidence,
                            'rule_description': rule.description
                        })
                        matched_indices_a.add(idx_a)
                        matched_indices_b.add(idx_b)
                        break

    # Create result dataframes
    matched_records = []
    for match in matches:
        row_a = df_a.loc[match['index_a']]
        row_b = df_b.loc[match['index_b']]

        matched_row = {}
        # Add all columns from file A with prefix
        for col in df_a.columns:
            matched_row[f"FileA_{col}"] = row_a[col]

        # Add all columns from file B with prefix
        for col in df_b.columns:
            matched_row[f"FileB_{col}"] = row_b[col]

        # Add match metadata
        matched_row['match_type'] = match['match_type']
        matched_row['matched_on'] = match['matched_on']
        matched_row['confidence'] = match['confidence']
        matched_row['rule_description'] = match.get('rule_description', '')

        matched_records.append(matched_row)

    matched_df = pd.DataFrame(matched_records)
    unmatched_a = df_a[~df_a.index.isin(matched_indices_a)]
    unmatched_b = df_b[~df_b.index.isin(matched_indices_b)]

    return {
        "matched_records": matched_df,
        "unmatched_file_a": unmatched_a,
        "unmatched_file_b": unmatched_b,
        "match_statistics": {
            "total_file_a": len(df_a),
            "total_file_b": len(df_b),
            "matched_count": len(matched_df),
            "unmatched_file_a_count": len(unmatched_a),
            "unmatched_file_b_count": len(unmatched_b),
            "match_rate": len(matched_df) / max(len(df_a), len(df_b)) * 100 if max(len(df_a), len(df_b)) > 0 else 0,
            "match_confidence_avg": matched_df['confidence'].mean() if len(matched_df) > 0 else 0
        }
    }


async def process_reconciliation(reconciliation_id: str, request: ReconciliationRequest):
    """Process reconciliation in the background"""
    start_time = datetime.utcnow()

    try:
        # Update status
        reconciliations[reconciliation_id]["status"] = "processing"

        # Get file data
        file_a_data = uploaded_files.get(request.file_a_id)
        file_b_data = uploaded_files.get(request.file_b_id)

        if not file_a_data or not file_b_data:
            raise ValueError("One or both files not found")

        df_a = file_a_data["data"]
        df_b = file_b_data["data"]

        logger.info(
            f"Processing reconciliation between {file_a_data['info']['filename']} and {file_b_data['info']['filename']}")

        # Initialize pattern detector
        detector = FinancialPatternDetector()

        # Analyze file schemas with pattern detection
        logger.info("Analyzing file patterns...")
        schema_a = await analyze_file_schema(df_a, detector)
        schema_b = await analyze_file_schema(df_b, detector)

        # Generate reconciliation rules
        if request.match_columns:
            # Convert manual mappings to rules
            rules = []
            for mapping in request.match_columns:
                rules.append(ReconciliationRule(
                    rule_type="match",
                    source_column=mapping.get("file_a_column"),
                    target_column=mapping.get("file_b_column"),
                    operation=mapping.get("operation", "exact"),
                    parameters=mapping.get("parameters", {}),
                    confidence=0.9,
                    description="User-defined mapping"
                ))
        else:
            # Generate rules using LLM with pattern analysis
            logger.info("Generating reconciliation rules...")
            rules = await generate_reconciliation_rules(schema_a, schema_b, request.user_requirements)

        logger.info(f"Generated {len(rules)} reconciliation rules")

        # Apply reconciliation rules
        logger.info("Applying reconciliation rules...")
        result = await apply_reconciliation_rules(df_a, df_b, rules)

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update reconciliation record
        reconciliations[reconciliation_id].update({
            "status": "completed",
            "result": {
                "matched_count": result["match_statistics"]["matched_count"],
                "unmatched_file_a_count": result["match_statistics"]["unmatched_file_a_count"],
                "unmatched_file_b_count": result["match_statistics"]["unmatched_file_b_count"],
                "match_rate": result["match_statistics"]["match_rate"],
                "match_confidence_avg": result["match_statistics"]["match_confidence_avg"],
                "matched_records": result["matched_records"].to_dict('records')[:100],  # First 100 matches
                "unmatched_file_a": result["unmatched_file_a"].to_dict('records')[
                                    :50] if request.output_unmatched else [],
                "unmatched_file_b": result["unmatched_file_b"].to_dict('records')[
                                    :50] if request.output_unmatched else [],
                "applied_rules": [rule.dict() for rule in rules],
                "pattern_analysis": {
                    "file_a": {col: info['patterns'] for col, info in schema_a['column_analysis'].items()},
                    "file_b": {col: info['patterns'] for col, info in schema_b['column_analysis'].items()}
                }
            },
            "processing_time": processing_time,
            "completed_at": datetime.utcnow().isoformat()
        })

        logger.info(f"Reconciliation {reconciliation_id} completed successfully in {processing_time:.2f}s")

    except Exception as e:
        logger.error(f"Reconciliation failed for {reconciliation_id}: {e}")
        reconciliations[reconciliation_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })
