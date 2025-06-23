import asyncio
import json
import logging
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple

import numpy as np
import pandas as pd
from app.storage import uploaded_files, comparisons
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")


# Enhanced configuration
class ComparisonConfig:
    # Sampling
    MIN_SAMPLE_SIZE = 20
    MAX_SAMPLE_SIZE = 100
    STRATIFIED_SAMPLING = True

    # Pattern Detection
    DETECT_PATTERNS = True
    PATTERN_CONFIDENCE_THRESHOLD = 0.7

    # AI Processing
    MAX_TOKENS_PER_REQUEST = 4000
    CHUNK_SIZE_FOR_LARGE_FILES = 1000

    # Validation
    VALIDATE_ON_FULL_DATASET = True
    CONFIDENCE_CALCULATION = True


# Setup logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder":
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI client initialized for comparisons")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenAI client: {e}")


# Pydantic models for file comparison
class ColumnMapping(BaseModel):
    file_a_column: str
    file_b_column: str
    comparison_type: str = "exact"  # exact, fuzzy, semantic, numerical
    confidence: Optional[float] = None


class ComparisonRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    analysis_prompt: str = Field(..., description="Natural language prompt describing what to analyze")
    column_mappings: Optional[List[ColumnMapping]] = None
    join_columns: Optional[Dict[str, str]] = None  # {"file_a_col": "file_b_col"}
    comparison_mode: str = "ai_guided"  # ai_guided, manual_mapping, auto_detect
    advanced_options: Optional[Dict[str, Any]] = None  # For advanced configuration


class AnalysisResult(BaseModel):
    comparison_id: str
    status: str
    summary: Dict[str, Any]
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    confidence_scores: Dict[str, float]
    data_characteristics: Dict[str, Any]
    created_at: str
    processing_time: float


# Create router
router = APIRouter(prefix="/api/v1/compare", tags=["comparison"])


# Enhanced utility functions

async def get_intelligent_sample(df: pd.DataFrame, sample_size: int = 50) -> pd.DataFrame:
    """Get a representative sample of the data using stratified sampling"""

    total_rows = len(df)

    if total_rows <= sample_size:
        return df

    # Strategy 1: Include first, middle, and last rows for pattern evolution
    indices = []

    # First 10 rows
    indices.extend(range(min(10, total_rows)))

    # Middle 10 rows
    middle_start = total_rows // 2 - 5
    indices.extend(range(max(0, middle_start), min(total_rows, middle_start + 10)))

    # Last 10 rows
    indices.extend(range(max(0, total_rows - 10), total_rows))

    # Strategy 2: Random sampling for remaining slots
    remaining = sample_size - len(set(indices))
    if remaining > 0:
        available_indices = [i for i in range(total_rows) if i not in indices]
        if available_indices:
            random_indices = np.random.choice(
                available_indices,
                size=min(remaining, len(available_indices)),
                replace=False
            )
            indices.extend(random_indices)

    # Remove duplicates and sort
    indices = sorted(list(set(indices)))

    return df.iloc[indices]


async def analyze_data_patterns(df: pd.DataFrame, column: str) -> Dict:
    """Analyze patterns in a column across the entire dataset"""

    patterns = {
        "data_types": [],
        "common_formats": [],
        "extracted_components": defaultdict(list),
        "statistics": {},
        "sample_values": []
    }

    # Get column data
    col_data = df[column].dropna()

    if col_data.empty:
        return patterns

    # Sample more rows for pattern detection (up to 1000)
    sample_size = min(1000, len(col_data))
    if sample_size < len(col_data):
        sample = col_data.sample(sample_size, random_state=42)
    else:
        sample = col_data

    patterns["sample_values"] = sample.head(10).tolist()

    # Analyze each value for patterns
    for value in sample:
        str_value = str(value)

        # Detect ISINs (12-character alphanumeric identifier)
        isin_matches = re.findall(r'\b[A-Z]{2}[A-Z0-9]{9}\d\b', str_value)
        if isin_matches:
            patterns["extracted_components"]["isins"].extend(isin_matches)

        # Detect CUSIPs (9-character identifier)
        cusip_matches = re.findall(r'\b[0-9]{3}[A-Z0-9]{6}\b', str_value)
        if cusip_matches:
            patterns["extracted_components"]["cusips"].extend(cusip_matches)

        # Detect amounts with currency
        amount_patterns = [
            r'[$€£¥]\s*[\d,]+\.?\d*',  # Currency symbol first
            r'[\d,]+\.?\d*\s*(?:USD|EUR|GBP|JPY|CHF)',  # Currency code after
            r'\b\d+(?:,\d{3})*(?:\.\d+)?\b'  # Generic number pattern
        ]
        for pattern in amount_patterns:
            amount_matches = re.findall(pattern, str_value)
            if amount_matches:
                patterns["extracted_components"]["amounts"].extend(amount_matches)

        # Detect dates in various formats
        date_patterns = [
            r'\b\d{4}-\d{2}-\d{2}\b',  # YYYY-MM-DD
            r'\b\d{2}/\d{2}/\d{4}\b',  # MM/DD/YYYY
            r'\b\d{2}-\d{2}-\d{4}\b',  # DD-MM-YYYY
            r'\b\d{8}\b',  # YYYYMMDD
            r'\b\d{2}-[A-Za-z]{3}-\d{4}\b'  # DD-MMM-YYYY
        ]
        for pattern in date_patterns:
            date_matches = re.findall(pattern, str_value)
            if date_matches:
                patterns["extracted_components"]["dates"].extend(date_matches)

        # Detect trade IDs or reference numbers
        trade_id_patterns = [
            r'\bTRD\d+\b',
            r'\b[A-Z]{2,4}\d{4,8}\b',
            r'\b\d{6,10}\b'  # Generic reference number
        ]
        for pattern in trade_id_patterns:
            id_matches = re.findall(pattern, str_value)
            if id_matches:
                patterns["extracted_components"]["trade_ids"].extend(id_matches)

    # Calculate statistics
    patterns["statistics"] = {
        "total_values": len(col_data),
        "unique_values": col_data.nunique(),
        "null_count": df[column].isna().sum(),
        "most_common": col_data.value_counts().head(5).to_dict() if col_data.nunique() < 1000 else None
    }

    # Deduplicate extracted components
    for key in patterns["extracted_components"]:
        patterns["extracted_components"][key] = list(set(patterns["extracted_components"][key]))[:20]

    return patterns


async def detect_all_patterns(df: pd.DataFrame) -> Dict[str, Dict]:
    """Detect patterns across all columns in the dataframe"""

    all_patterns = {}

    for column in df.columns:
        logger.info(f"Analyzing patterns in column: {column}")
        all_patterns[column] = await analyze_data_patterns(df, column)

    return all_patterns


class UnstructuredDataProcessor:
    """Handle completely unstructured or poorly structured data"""

    async def identify_data_structure(self, df: pd.DataFrame) -> Dict:
        """Identify structure in seemingly unstructured data"""

        structure_info = {
            "columns_are_meaningful": True,
            "structure_hints": [],
            "data_quality_score": 0.0,
            "recommendations": []
        }

        # Check if columns have meaningful names
        generic_patterns = [r'^Unnamed', r'^Col\d+$', r'^Column\d+$', r'^F\d+$']

        meaningful_count = 0
        for col in df.columns:
            is_generic = any(re.match(pattern, str(col)) for pattern in generic_patterns)
            if not is_generic:
                meaningful_count += 1

        structure_info["columns_are_meaningful"] = meaningful_count >= len(df.columns) * 0.5

        if not structure_info["columns_are_meaningful"]:
            # Columns are not meaningful, analyze content
            structure_info["structure_hints"] = await self.analyze_content_structure(df)
            structure_info["recommendations"].append(
                "Column names appear to be generic. Consider renaming based on content analysis."
            )

        # Calculate data quality score
        structure_info["data_quality_score"] = self.calculate_data_quality_score(df)

        return structure_info

    async def analyze_content_structure(self, df: pd.DataFrame) -> List[Dict]:
        """Analyze content when column names are not helpful"""

        structure_hints = []

        for col in df.columns:
            # Get sample of non-null values
            sample = df[col].dropna().head(20)

            if sample.empty:
                continue

            # Analyze content patterns
            col_patterns = await analyze_data_patterns(df, col)

            # Determine likely data type
            hint = {
                "column": col,
                "current_name": str(col),
                "identified_patterns": [],
                "suggested_name": None,
                "confidence": 0.0
            }

            # Check what patterns were found
            components = col_patterns.get("extracted_components", {})

            if components.get("isins"):
                hint["identified_patterns"].append("ISIN codes")
                hint["suggested_name"] = "ISIN"
                hint["confidence"] = 0.9
            elif components.get("amounts"):
                hint["identified_patterns"].append("Monetary amounts")
                hint["suggested_name"] = "Amount"
                hint["confidence"] = 0.85
            elif components.get("dates"):
                hint["identified_patterns"].append("Dates")
                hint["suggested_name"] = "Date"
                hint["confidence"] = 0.85
            elif components.get("trade_ids"):
                hint["identified_patterns"].append("Trade/Reference IDs")
                hint["suggested_name"] = "TradeID"
                hint["confidence"] = 0.8

            # Check if it's a description field with multiple components
            if len([k for k, v in components.items() if v]) > 2:
                hint["identified_patterns"].append("Mixed content field")
                hint["suggested_name"] = "Description"
                hint["confidence"] = 0.7

            structure_hints.append(hint)

        return structure_hints

    def calculate_data_quality_score(self, df: pd.DataFrame) -> float:
        """Calculate a data quality score from 0 to 1"""

        scores = []

        # Check for null values
        null_ratio = df.isna().sum().sum() / (len(df) * len(df.columns))
        scores.append(1 - null_ratio)

        # Check for duplicate rows
        duplicate_ratio = df.duplicated().sum() / len(df)
        scores.append(1 - duplicate_ratio)

        # Check for consistent data types
        type_consistency = sum(1 for col in df.columns if df[col].dtype != 'object') / len(df.columns)
        scores.append(type_consistency)

        return sum(scores) / len(scores)


async def multi_pass_analysis(df_a: pd.DataFrame, df_b: pd.DataFrame,
                              request: ComparisonRequest) -> Dict:
    """Perform multi-pass analysis for comprehensive comparison"""

    analysis_results = {
        "passes": [],
        "final_results": None,
        "confidence_metrics": {}
    }

    # Pass 1: Structure Understanding
    logger.info("Pass 1: Understanding data structure")

    processor = UnstructuredDataProcessor()
    structure_a = await processor.identify_data_structure(df_a)
    structure_b = await processor.identify_data_structure(df_b)

    structure_context = {
        "file_a": {
            "columns": list(df_a.columns),
            "shape": df_a.shape,
            "structure_analysis": structure_a
        },
        "file_b": {
            "columns": list(df_b.columns),
            "shape": df_b.shape,
            "structure_analysis": structure_b
        }
    }

    # Pass 2: Pattern Detection
    logger.info("Pass 2: Detecting patterns across entire dataset")

    patterns_a = await detect_all_patterns(df_a)
    patterns_b = await detect_all_patterns(df_b)

    # Pass 3: Intelligent Sampling
    logger.info("Pass 3: Creating intelligent samples")

    sample_a = await get_intelligent_sample(df_a, ComparisonConfig.MAX_SAMPLE_SIZE)
    sample_b = await get_intelligent_sample(df_b, ComparisonConfig.MAX_SAMPLE_SIZE)

    # Pass 4: Column Relationship Detection
    logger.info("Pass 4: Detecting column relationships")

    column_relationships = await detect_column_relationships_enhanced(
        df_a, df_b, patterns_a, patterns_b
    )

    # Pass 5: AI-Powered Analysis
    logger.info("Pass 5: AI-powered deep analysis")

    sample_a = sample_a.astype(object)
    sample_b = sample_a.astype(object)

    comprehensive_context = {
        "structure": structure_context,
        "patterns": {
            "file_a": patterns_a,
            "file_b": patterns_b
        },
        "samples": {
            "file_a": sample_a.to_dict(orient='records'),
            "file_b": sample_b.to_dict(orient='records')
        },
        "detected_relationships": column_relationships,
        "user_requirements": request.analysis_prompt
    }

    ai_results = await analyze_with_openai_enhanced(
        request.analysis_prompt,
        comprehensive_context
    )

    # Pass 6: Validation on Full Dataset
    if ComparisonConfig.VALIDATE_ON_FULL_DATASET:
        logger.info("Pass 6: Validating findings on full dataset")

        validation_results = await validate_ai_findings(
            df_a, df_b, ai_results, column_relationships
        )

        ai_results["validation"] = validation_results

    analysis_results["final_results"] = ai_results
    analysis_results["confidence_metrics"] = calculate_confidence_scores(
        ai_results, validation_results if ComparisonConfig.VALIDATE_ON_FULL_DATASET else None
    )

    return analysis_results


async def detect_column_relationships_enhanced(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                               patterns_a: Dict, patterns_b: Dict) -> List[Dict]:
    """Enhanced column relationship detection using pattern analysis"""

    relationships = []

    for col_a in df_a.columns:
        for col_b in df_b.columns:
            # Skip if columns are empty
            if df_a[col_a].dropna().empty or df_b[col_b].dropna().empty:
                continue

            relationship = {
                "file_a_column": col_a,
                "file_b_column": col_b,
                "relationship_type": None,
                "confidence": 0.0,
                "evidence": []
            }

            # Check for exact name match
            if col_a.lower() == col_b.lower():
                relationship["relationship_type"] = "name_match"
                relationship["confidence"] = 0.9
                relationship["evidence"].append("Exact column name match")

            # Check for partial name match
            elif col_a.lower() in col_b.lower() or col_b.lower() in col_a.lower():
                relationship["relationship_type"] = "partial_name_match"
                relationship["confidence"] = 0.7
                relationship["evidence"].append("Partial column name match")

            # Check pattern similarity
            patterns_col_a = patterns_a.get(col_a, {}).get("extracted_components", {})
            patterns_col_b = patterns_b.get(col_b, {}).get("extracted_components", {})

            pattern_matches = 0
            for pattern_type in ["isins", "cusips", "amounts", "dates", "trade_ids"]:
                if patterns_col_a.get(pattern_type) and patterns_col_b.get(pattern_type):
                    # Check for overlap in extracted patterns
                    set_a = set(patterns_col_a[pattern_type])
                    set_b = set(patterns_col_b[pattern_type])
                    if set_a.intersection(set_b):
                        pattern_matches += 1
                        relationship["evidence"].append(f"Common {pattern_type} found")

            if pattern_matches > 0:
                relationship["relationship_type"] = "pattern_match"
                relationship["confidence"] = min(0.6 + (pattern_matches * 0.1), 0.95)

            # Check for data type compatibility and value overlap
            try:
                sample_a = df_a[col_a].dropna().head(1000)
                sample_b = df_b[col_b].dropna().head(1000)

                # Check data types
                if str(sample_a.dtype) == str(sample_b.dtype):
                    relationship["confidence"] += 0.1
                    relationship["evidence"].append("Same data type")

                # Check value overlap
                set_a = set(sample_a.astype(str))
                set_b = set(sample_b.astype(str))
                overlap = len(set_a.intersection(set_b))

                if overlap > 0:
                    overlap_ratio = overlap / min(len(set_a), len(set_b))
                    if overlap_ratio > 0.1:  # At least 10% overlap
                        if not relationship["relationship_type"]:
                            relationship["relationship_type"] = "value_overlap"

                        relationship["confidence"] = max(
                            relationship["confidence"],
                            min(overlap_ratio, 0.9)
                        )
                        relationship["evidence"].append(
                            f"{overlap} common values ({overlap_ratio:.1%} overlap)"
                        )
            except Exception as e:
                logger.warning(f"Error comparing {col_a} and {col_b}: {e}")

            # Only include relationships with meaningful confidence
            if relationship["confidence"] >= 0.3:
                relationships.append(relationship)

    # Sort by confidence
    relationships.sort(key=lambda x: x["confidence"], reverse=True)

    return relationships


async def analyze_with_openai_enhanced(prompt: str, comprehensive_context: Dict) -> Dict:
    """Enhanced OpenAI analysis with comprehensive context"""

    system_prompt = """You are an expert data analyst specializing in financial data comparison and reconciliation.
You excel at finding patterns, discrepancies, and relationships between datasets, even when data is unstructured or poorly formatted.

You have been provided with:
1. Data structure analysis showing column meanings and quality
2. Pattern detection results from analyzing the ENTIRE dataset (not just samples)
3. Intelligent samples from beginning, middle, and end of the datasets
4. Detected column relationships with confidence scores
5. The user's specific analysis requirements

Your analysis should include:
1. Key findings based on the comprehensive pattern analysis
2. Data quality assessment and recommendations
3. Specific matches and mismatches with examples
4. Confidence levels for your findings
5. Actionable recommendations for data improvement

Remember: The pattern analysis covers the ENTIRE dataset, so you can make confident statements about data characteristics.

Return your analysis as a structured JSON object with these keys:
{
    "summary": {
        "total_rows_analyzed": {"file_a": number, "file_b": number},
        "key_insights": ["insight1", "insight2"],
        "data_quality": {"file_a": score, "file_b": score},
        "overall_match_confidence": percentage
    },
    "column_mappings": [
        {
            "file_a_column": "col_name",
            "file_b_column": "col_name",
            "mapping_confidence": percentage,
            "mapping_type": "exact|fuzzy|semantic",
            "evidence": ["reason1", "reason2"]
        }
    ],
    "findings": [
        {
            "type": "match|mismatch|pattern|anomaly|quality_issue",
            "description": "detailed description",
            "severity": "high|medium|low",
            "affected_columns": ["col1", "col2"],
            "examples": [{"file_a_example": "...", "file_b_example": "..."}],
            "estimated_impact": "X% of records affected"
        }
    ],
    "data_quality_issues": [
        {
            "file": "a|b|both",
            "issue": "description",
            "columns_affected": ["col1", "col2"],
            "severity": "high|medium|low",
            "recommendation": "how to fix"
        }
    ],
    "recommendations": [
        {
            "priority": "high|medium|low",
            "action": "specific action to take",
            "expected_benefit": "what this will achieve"
        }
    ]
}"""

    def convert_numpy(obj):
        if isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    # Build user prompt with comprehensive context
    user_prompt = f"""
Analysis Request: {prompt}

=== DATA STRUCTURE ANALYSIS ===
File A Structure:
{json.dumps(comprehensive_context['structure']['file_a'], indent=2,default=convert_numpy)}

File B Structure:
{json.dumps(comprehensive_context['structure']['file_b'], indent=2)}

=== PATTERN ANALYSIS (Entire Dataset) ===
Note: These patterns were detected across the ENTIRE dataset, not just samples.

File A Patterns:
{json.dumps(comprehensive_context['patterns']['file_a'], indent=2,default=convert_numpy)}

File B Patterns:
{json.dumps(comprehensive_context['patterns']['file_b'], indent=2,default=convert_numpy)}

=== DETECTED COLUMN RELATIONSHIPS ===
Top relationships found:
{json.dumps(comprehensive_context['detected_relationships'][:10], indent=2)}

=== SAMPLE DATA ===
File A Sample (intelligently selected from beginning, middle, and end):
{json.dumps(comprehensive_context['samples']['file_a'][:10], indent=2)}

File B Sample (intelligently selected from beginning, middle, and end):
{json.dumps(comprehensive_context['samples']['file_b'][:10], indent=2)}

Please provide a comprehensive analysis based on this enhanced context."""

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        logger.error(f"Enhanced OpenAI analysis error: {e}")
        raise


async def validate_ai_findings(df_a: pd.DataFrame, df_b: pd.DataFrame,
                               ai_results: Dict, column_relationships: List[Dict]) -> Dict:
    """Validate AI findings against the full dataset"""

    validation_results = {
        "validated_mappings": [],
        "validation_errors": [],
        "actual_statistics": {}
    }

    # Validate column mappings
    for mapping in ai_results.get("column_mappings", []):
        col_a = mapping.get("file_a_column")
        col_b = mapping.get("file_b_column")

        if col_a not in df_a.columns or col_b not in df_b.columns:
            validation_results["validation_errors"].append({
                "type": "invalid_column",
                "mapping": mapping,
                "error": "Column not found in dataset"
            })
            continue

        # Perform actual comparison on full dataset
        comparison_result = await compare_column_values(
            df_a, df_b, col_a, col_b, mapping.get("mapping_type", "exact")
        )

        validated_mapping = mapping.copy()
        validated_mapping["actual_match_rate"] = comparison_result.get("matches", {}).get("match_rate", 0)
        validated_mapping["validation_status"] = "confirmed" if validated_mapping[
                                                                    "actual_match_rate"] > 0.1 else "rejected"

        validation_results["validated_mappings"].append(validated_mapping)

    # Calculate actual statistics
    validation_results["actual_statistics"] = {
        "file_a": {
            "total_rows": len(df_a),
            "total_columns": len(df_a.columns),
            "null_percentage": (df_a.isna().sum().sum() / (len(df_a) * len(df_a.columns))) * 100
        },
        "file_b": {
            "total_rows": len(df_b),
            "total_columns": len(df_b.columns),
            "null_percentage": (df_b.isna().sum().sum() / (len(df_b) * len(df_b.columns))) * 100
        }
    }

    return validation_results


def calculate_confidence_scores(ai_results: Dict, validation_results: Optional[Dict]) -> Dict:
    """Calculate confidence scores for the analysis"""

    confidence_scores = {
        "overall_confidence": 0.0,
        "mapping_confidence": 0.0,
        "pattern_confidence": 0.0,
        "validation_confidence": 0.0
    }

    # Calculate mapping confidence
    mappings = ai_results.get("column_mappings", [])
    if mappings:
        mapping_confidences = [m.get("mapping_confidence", 0) for m in mappings]
        confidence_scores["mapping_confidence"] = sum(mapping_confidences) / len(mapping_confidences)

    # Calculate pattern confidence based on evidence
    if validation_results:
        validated_mappings = validation_results.get("validated_mappings", [])
        if validated_mappings:
            validation_scores = [
                1.0 if m.get("validation_status") == "confirmed" else 0.0
                for m in validated_mappings
            ]
            confidence_scores["validation_confidence"] = sum(validation_scores) / len(validation_scores)

    # Overall confidence is weighted average
    weights = {
        "mapping_confidence": 0.4,
        "validation_confidence": 0.6 if validation_results else 0.0
    }

    if not validation_results:
        weights["mapping_confidence"] = 1.0

    confidence_scores["overall_confidence"] = sum(
        confidence_scores[key] * weight
        for key, weight in weights.items()
    )

    return confidence_scores


async def compare_column_values(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                col_a: str, col_b: str,
                                comparison_type: str = "exact") -> Dict:
    """Enhanced column comparison with multiple comparison types"""

    values_a = df_a[col_a].dropna()
    values_b = df_b[col_b].dropna()

    result = {
        "column_a": col_a,
        "column_b": col_b,
        "comparison_type": comparison_type,
        "statistics": {
            "file_a_count": len(values_a),
            "file_b_count": len(values_b),
            "file_a_unique": values_a.nunique(),
            "file_b_unique": values_b.nunique()
        }
    }

    if comparison_type == "exact":
        set_a = set(values_a.astype(str))
        set_b = set(values_b.astype(str))

        intersection = set_a.intersection(set_b)
        union = set_a.union(set_b)

        result["matches"] = {
            "in_both": list(intersection)[:100],  # Limit to 100 examples
            "only_in_a": list(set_a - set_b)[:100],
            "only_in_b": list(set_b - set_a)[:100],
            "match_rate": len(intersection) / len(union) if union else 0,
            "match_count": len(intersection)
        }

    elif comparison_type == "numerical":
        try:
            nums_a = pd.to_numeric(values_a, errors='coerce').dropna()
            nums_b = pd.to_numeric(values_b, errors='coerce').dropna()

            result["numerical_stats"] = {
                "file_a": {
                    "mean": float(nums_a.mean()),
                    "std": float(nums_a.std()),
                    "min": float(nums_a.min()),
                    "max": float(nums_a.max()),
                    "median": float(nums_a.median())
                },
                "file_b": {
                    "mean": float(nums_b.mean()),
                    "std": float(nums_b.std()),
                    "min": float(nums_b.min()),
                    "max": float(nums_b.max()),
                    "median": float(nums_b.median())
                },
                "differences": {
                    "mean_diff": float(abs(nums_a.mean() - nums_b.mean())),
                    "mean_diff_pct": float(
                        abs(nums_a.mean() - nums_b.mean()) / nums_a.mean() * 100) if nums_a.mean() != 0 else 0
                }
            }
        except Exception as e:
            result["numerical_stats"] = {"error": f"Could not convert to numerical values: {str(e)}"}
    elif comparison_type == "fuzzy":
        # Fuzzy string matching for similar but not exact values
        from difflib import SequenceMatcher

        matches = []
        threshold = 0.8  # 80% similarity threshold

        # Sample for performance (fuzzy matching is expensive)
        sample_a = values_a.sample(min(100, len(values_a))).astype(str)
        sample_b = values_b.astype(str)

        for val_a in sample_a:
            best_match = None
            best_score = 0

            for val_b in sample_b:
                score = SequenceMatcher(None, val_a, val_b).ratio()
                if score > best_score and score >= threshold:
                    best_score = score
                    best_match = val_b

            if best_match:
                matches.append({
                    "value_a": val_a,
                    "value_b": best_match,
                    "similarity": best_score
                })

        result["fuzzy_matches"] = matches[:50]  # Top 50 matches
        result["fuzzy_match_count"] = len(matches)

    return result


async def process_comparison_enhanced(comparison_id: str, request: ComparisonRequest):
    """Enhanced comparison processing with all improvements"""

    start_time = datetime.utcnow()

    try:
        # Update status
        comparisons[comparison_id]["status"] = "processing"
        comparisons[comparison_id]["processing_steps"] = []

        def log_step(step: str):
            comparisons[comparison_id]["processing_steps"].append({
                "step": step,
                "timestamp": datetime.utcnow().isoformat()
            })

        log_step("Starting enhanced comparison")

        # Get file data
        file_a_data = uploaded_files.get(request.file_a_id)
        file_b_data = uploaded_files.get(request.file_b_id)

        if not file_a_data or not file_b_data:
            raise ValueError("One or both files not found")

        df_a = file_a_data["data"]
        df_b = file_b_data["data"]

        log_step("Files loaded successfully")

        # Check if advanced options are provided
        config = ComparisonConfig()
        if request.advanced_options:
            for key, value in request.advanced_options.items():
                if hasattr(config, key):
                    setattr(config, key, value)

        # Perform analysis based on mode
        if request.comparison_mode == "ai_guided":
            log_step("Starting AI-guided multi-pass analysis")

            # Use enhanced multi-pass analysis
            analysis_result = await multi_pass_analysis(df_a, df_b, request)

            # Extract the final results
            analysis_result = analysis_result.get("final_results", {})
            analysis_result["confidence_scores"] = analysis_result.get("confidence_scores", {})

        elif request.comparison_mode == "manual_mapping":
            log_step("Starting manual mapping comparison")

            if not request.column_mappings:
                raise ValueError("Column mappings required for manual mode")

            # First detect patterns for context
            patterns_a = await detect_all_patterns(df_a)
            patterns_b = await detect_all_patterns(df_b)

            comparison_results = []
            for mapping in request.column_mappings:
                result = await compare_column_values(
                    df_a, df_b,
                    mapping.file_a_column,
                    mapping.file_b_column,
                    mapping.comparison_type
                )

                # Add pattern context
                result["patterns"] = {
                    "file_a": patterns_a.get(mapping.file_a_column, {}),
                    "file_b": patterns_b.get(mapping.file_b_column, {})
                }

                comparison_results.append(result)

            analysis_result = {
                "summary": {
                    "columns_compared": len(request.column_mappings),
                    "comparison_mode": "manual_mapping"
                },
                "comparison_results": comparison_results,
                "findings": [],
                "recommendations": ["Review the detailed comparison results for each column pair"]
            }

        else:  # auto_detect mode
            log_step("Starting auto-detect comparison")

            # Detect patterns first
            patterns_a = await detect_all_patterns(df_a)
            patterns_b = await detect_all_patterns(df_b)

            # Enhanced relationship detection
            relationships = await detect_column_relationships_enhanced(
                df_a, df_b, patterns_a, patterns_b
            )

            # Compare top relationships
            comparison_results = []
            for rel in relationships[:10]:  # Top 10 relationships
                result = await compare_column_values(
                    df_a, df_b,
                    rel["file_a_column"],
                    rel["file_b_column"],
                    "exact" if rel["confidence"] > 0.8 else "fuzzy"
                )
                result["relationship"] = rel
                comparison_results.append(result)

            analysis_result = {
                "summary": {
                    "auto_detected_relationships": len(relationships),
                    "relationships_analyzed": len(comparison_results),
                    "comparison_mode": "auto_detect"
                },
                "findings": comparison_results,
                "detected_relationships": relationships,
                "recommendations": [
                    "Review auto-detected column relationships",
                    f"Found {len(relationships)} potential column matches",
                    "Consider using AI-guided mode for deeper analysis"
                ]
            }

        log_step("Analysis completed")

        # Add data characteristics to all results
        processor = UnstructuredDataProcessor()
        analysis_result["data_characteristics"] = {
            "file_a": await processor.identify_data_structure(df_a),
            "file_b": await processor.identify_data_structure(df_b)
        }

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update comparison record
        comparisons[comparison_id].update({
            "status": "completed",
            "result": analysis_result,
            "completed_at": datetime.utcnow().isoformat(),
            "processing_time": processing_time,
            "rows_processed": {
                "file_a": len(df_a),
                "file_b": len(df_b)
            }
        })

        logger.info(f"Enhanced comparison {comparison_id} completed in {processing_time:.2f}s")

    except Exception as e:
        logger.error(f"Enhanced comparison failed for {comparison_id}: {e}")
        comparisons[comparison_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })


# API Routes

@router.post("/")
async def start_comparison(request: ComparisonRequest):
    """Start a new file comparison analysis with enhanced processing"""

    try:
        # Validate files exist
        if request.file_a_id not in uploaded_files:
            raise HTTPException(404, f"File A not found: {request.file_a_id}")

        if request.file_b_id not in uploaded_files:
            raise HTTPException(404, f"File B not found: {request.file_b_id}")

        # Create comparison ID
        comparison_id = str(uuid.uuid4())

        # Initialize comparison record
        comparisons[comparison_id] = {
            "comparison_id": comparison_id,
            "file_a_id": request.file_a_id,
            "file_b_id": request.file_b_id,
            "file_a_name": uploaded_files[request.file_a_id]["info"]["filename"],
            "file_b_name": uploaded_files[request.file_b_id]["info"]["filename"],
            "analysis_prompt": request.analysis_prompt,
            "comparison_mode": request.comparison_mode,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "enhanced_processing": True  # Flag for enhanced processing
        }

        # Start enhanced async processing
        asyncio.create_task(process_comparison_enhanced(comparison_id, request))

        return {
            "success": True,
            "message": "Enhanced comparison analysis started",
            "data": {
                "comparison_id": comparison_id,
                "status": "processing",
                "estimated_time": "30-60 seconds",
                "processing_features": [
                    "Full dataset pattern analysis",
                    "Intelligent sampling",
                    "Multi-pass processing",
                    "Confidence scoring"
                ]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting comparison: {e}")
        raise HTTPException(400, f"Failed to start comparison: {str(e)}")


@router.get("/{comparison_id}")
async def get_comparison_status(comparison_id: str):
    """Get status and results of a comparison"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    # Include processing steps for transparency
    response_data = {
        "success": True,
        "message": "Comparison details retrieved",
        "data": comparison
    }

    # Add progress percentage if still processing
    if comparison["status"] == "processing" and "processing_steps" in comparison:
        total_steps = 6  # Total steps in enhanced processing
        completed_steps = len(comparison.get("processing_steps", []))
        response_data["data"]["progress_percentage"] = (completed_steps / total_steps) * 100

    return response_data


@router.get("/{comparison_id}/results")
async def get_comparison_results(comparison_id: str):
    """Get detailed results of a completed comparison"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    if comparison["status"] != "completed":
        return {
            "success": False,
            "message": f"Comparison not completed. Status: {comparison['status']}",
            "data": {
                "status": comparison["status"],
                "progress": comparison.get("progress_percentage", 0)
            }
        }

    return {
        "success": True,
        "message": "Comparison results retrieved",
        "data": {
            "comparison_info": {
                "comparison_id": comparison_id,
                "file_a": comparison["file_a_name"],
                "file_b": comparison["file_b_name"],
                "analysis_prompt": comparison["analysis_prompt"],
                "mode": comparison["comparison_mode"],
                "processing_time": comparison.get("processing_time", 0),
                "rows_processed": comparison.get("rows_processed", {}),
                "enhanced_processing": comparison.get("enhanced_processing", False)
            },
            "results": comparison.get("result", {}),
            "confidence_scores": comparison.get("result", {}).get("confidence_scores", {}),
            "data_quality": comparison.get("result", {}).get("data_characteristics", {})
        }
    }


@router.get("/")
async def list_comparisons(skip: int = 0, limit: int = 20):
    """List all comparisons with pagination"""

    comparison_list = []
    for comp_id, comp_data in comparisons.items():
        comparison_list.append({
            "comparison_id": comp_id,
            "file_a": comp_data.get("file_a_name"),
            "file_b": comp_data.get("file_b_name"),
            "status": comp_data.get("status"),
            "created_at": comp_data.get("created_at"),
            "mode": comp_data.get("comparison_mode"),
            "enhanced": comp_data.get("enhanced_processing", False)
        })

    # Sort by creation date
    comparison_list.sort(key=lambda x: x["created_at"], reverse=True)

    # Apply pagination
    total = len(comparison_list)
    comparison_list = comparison_list[skip:skip + limit]

    return {
        "success": True,
        "message": f"Found {total} comparisons",
        "data": {
            "comparisons": comparison_list,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }


@router.post("/{comparison_id}/export")
async def export_comparison_results(comparison_id: str, format: str = "json"):
    """Export comparison results in different formats"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    if comparison["status"] != "completed":
        raise HTTPException(400, "Comparison not completed")

    result_data = comparison.get("result", {})

    if format == "json":
        return result_data
    elif format == "csv":
        # Convert findings to CSV format
        findings = result_data.get("findings", [])
        if findings:
            df = pd.DataFrame(findings)
            csv_data = df.to_csv(index=False)
            return {
                "success": True,
                "message": "Results exported as CSV",
                "data": {"csv": csv_data}
            }

    return {
        "success": True,
        "message": f"Results exported as {format}",
        "data": result_data
    }


@router.get("/templates")
async def get_analysis_templates():
    """Get pre-defined analysis prompt templates"""

    templates = [
        {
            "name": "Trade Reconciliation",
            "description": "Compare trade data between two sources",
            "prompt": "Compare the trade records between these two files. Identify matching trades based on trade ID, ISIN, and amount. Find any discrepancies in dates, amounts, or missing trades. Pay special attention to currency differences and date format variations.",
            "suggested_mappings": [
                {"file_a_column": "Trade ID", "file_b_column": "Trade ID", "comparison_type": "exact"},
                {"file_a_column": "ISIN", "file_b_column": "ISIN", "comparison_type": "exact"},
                {"file_a_column": "Amount", "file_b_column": "Amount", "comparison_type": "numerical"}
            ],
            "advanced_options": {
                "VALIDATE_ON_FULL_DATASET": True,
                "MIN_SAMPLE_SIZE": 50
            }
        },
        {
            "name": "Data Quality Check",
            "description": "Identify data quality issues between files",
            "prompt": "Analyze data quality between these files. Look for: missing values, format inconsistencies, duplicate records, and data type mismatches. Identify which file has better data quality and suggest improvements.",
            "suggested_mappings": [],
            "advanced_options": {
                "DETECT_PATTERNS": True,
                "MAX_SAMPLE_SIZE": 100
            }
        },
        {
            "name": "Unstructured Data Analysis",
            "description": "Analyze files with poor column structure",
            "prompt": "These files may have unstructured or poorly labeled columns. First, identify what type of data each column contains. Then find relationships between the files. Extract structured information from text fields where possible.",
            "suggested_mappings": [],
            "advanced_options": {
                "STRATIFIED_SAMPLING": True,
                "PATTERN_CONFIDENCE_THRESHOLD": 0.6
            }
        },
        {
            "name": "Security Master Comparison",
            "description": "Compare security reference data",
            "prompt": "Compare security master data between files. Match securities by ISIN, CUSIP, or ticker. Identify discrepancies in security names, currencies, exchange codes, or other attributes. Highlight any securities present in one file but not the other.",
            "suggested_mappings": [
                {"file_a_column": "ISIN", "file_b_column": "ISIN", "comparison_type": "exact"},
                {"file_a_column": "Security Name", "file_b_column": "Security Name", "comparison_type": "fuzzy"}
            ]
        },
        {
            "name": "Transaction Matching",
            "description": "Match transactions across systems",
            "prompt": "Match transactions between the two files using flexible criteria. Consider transactions as potential matches even with small differences in amounts (up to 0.1%) or dates (within 2 days). Identify unmatched transactions and possible reasons.",
            "suggested_mappings": [],
            "advanced_options": {
                "VALIDATE_ON_FULL_DATASET": True
            }
        }
    ]

    return {
        "success": True,
        "message": "Analysis templates retrieved",
        "data": templates
    }


@router.get("/config")
async def get_comparison_config():
    """Get current comparison configuration"""

    config = ComparisonConfig()

    return {
        "success": True,
        "message": "Comparison configuration retrieved",
        "data": {
            "sampling": {
                "min_sample_size": config.MIN_SAMPLE_SIZE,
                "max_sample_size": config.MAX_SAMPLE_SIZE,
                "stratified_sampling": config.STRATIFIED_SAMPLING
            },
            "pattern_detection": {
                "enabled": config.DETECT_PATTERNS,
                "confidence_threshold": config.PATTERN_CONFIDENCE_THRESHOLD
            },
            "processing": {
                "max_tokens_per_request": config.MAX_TOKENS_PER_REQUEST,
                "chunk_size_for_large_files": config.CHUNK_SIZE_FOR_LARGE_FILES
            },
            "validation": {
                "validate_on_full_dataset": config.VALIDATE_ON_FULL_DATASET,
                "confidence_calculation": config.CONFIDENCE_CALCULATION
            }
        }
    }  # comparison_routes.py - Enhanced File Comparison and Analysis Routes