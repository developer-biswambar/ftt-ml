from typing import List, Optional, Union

from pydantic import BaseModel


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
