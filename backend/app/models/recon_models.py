from typing import List, Optional, Union, Dict, Any

from pydantic import BaseModel, Field


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
    Extract: Optional[List[ExtractRule]] = []  # Made optional with default empty list
    Filter: Optional[List[FilterRule]] = []  # Made optional with default empty list


class ReconciliationRule(BaseModel):
    LeftFileColumn: str
    RightFileColumn: str
    MatchType: str  # Now supports: "equals", "tolerance", "date_equals"
    ToleranceValue: Optional[float] = None


class ColumnSelectionConfig(BaseModel):
    """Configuration for column selection in reconciliation results"""
    file_a_columns: Optional[List[str]] = Field(None, description="Columns to include from File A")
    file_b_columns: Optional[List[str]] = Field(None, description="Columns to include from File B")
    include_mandatory: bool = Field(True, description="Always include columns used in reconciliation rules")
    output_format: str = Field("standard", description="Output format: standard, summary, detailed")


class OptimizedRulesConfig(BaseModel):
    """Enhanced rules configuration with column selection"""
    Files: List[FileRule]
    ReconciliationRules: List[ReconciliationRule]
    ColumnSelection: Optional[ColumnSelectionConfig] = None
    ProcessingOptions: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {
            "batch_size": 1000,
            "use_parallel_processing": True,
            "memory_optimization": True
        }
    )


class ReconciliationSummary(BaseModel):
    total_records_file_a: int
    total_records_file_b: int
    matched_records: int
    unmatched_file_a: int
    unmatched_file_b: int
    match_percentage: float
    processing_time_seconds: float


class DataQualityMetrics(BaseModel):
    """Additional data quality metrics for reconciliation"""
    file_a_match_rate: float = Field(description="Percentage of File A records that found matches")
    file_b_match_rate: float = Field(description="Percentage of File B records that found matches")
    overall_completeness: float = Field(description="Overall data completeness percentage")
    duplicate_records_a: int = Field(default=0, description="Duplicate records found in File A")
    duplicate_records_b: int = Field(default=0, description="Duplicate records found in File B")
    data_consistency_score: float = Field(default=100.0, description="Data consistency score")


class EnhancedReconciliationSummary(ReconciliationSummary):
    """Enhanced summary with additional metrics"""
    data_quality: Optional[DataQualityMetrics] = None
    column_statistics: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None


class ReconciliationResponse(BaseModel):
    success: bool
    summary: Union[ReconciliationSummary, EnhancedReconciliationSummary]
    reconciliation_id: str
    errors: List[str] = []
    warnings: List[str] = []
    processing_info: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {
            "optimization_used": True,
            "hash_based_matching": True,
            "vectorized_extraction": True
        }
    )


class PaginatedResultsRequest(BaseModel):
    """Request model for paginated results"""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(1000, ge=1, le=10000, description="Records per page")
    result_type: str = Field("all", description="Type of results: all, matched, unmatched_a, unmatched_b")
    include_columns: Optional[List[str]] = Field(None, description="Specific columns to include")


class DownloadRequest(BaseModel):
    """Request model for downloading results"""
    format: str = Field("excel", description="Download format: excel, csv, json")
    result_type: str = Field("all", description="Type of results to download")
    compress: bool = Field(True, description="Whether to compress the download")
    include_summary: bool = Field(True, description="Include summary sheet/data")


class ReconciliationStatus(BaseModel):
    """Status model for tracking reconciliation progress"""
    reconciliation_id: str
    status: str = Field(description="Status: pending, processing, completed, failed")
    progress_percentage: float = Field(0.0, ge=0.0, le=100.0)
    current_step: str = Field(description="Current processing step")
    estimated_completion_time: Optional[str] = None
    error_message: Optional[str] = None


class BulkReconciliationRequest(BaseModel):
    """Request model for bulk reconciliation operations"""
    reconciliation_configs: List[OptimizedRulesConfig]
    parallel_processing: bool = Field(True, description="Enable parallel processing")
    priority: str = Field("normal", description="Processing priority: low, normal, high")


# Performance optimization models
class ProcessingMetrics(BaseModel):
    """Metrics for monitoring reconciliation performance"""
    total_processing_time: float
    file_reading_time: float
    extraction_time: float
    filtering_time: float
    reconciliation_time: float
    result_generation_time: float
    memory_usage_mb: float
    records_processed_per_second: float


class CacheConfig(BaseModel):
    """Configuration for caching optimization"""
    enable_pattern_caching: bool = Field(True, description="Cache compiled regex patterns")
    enable_result_caching: bool = Field(True, description="Cache intermediate results")
    cache_ttl_seconds: int = Field(3600, description="Cache time-to-live in seconds")
    max_cache_size_mb: int = Field(512, description="Maximum cache size in MB")


# Update forward references
PatternCondition.model_rebuild()
OptimizedRulesConfig.model_rebuild()
