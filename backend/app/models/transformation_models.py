from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from enum import Enum


class ColumnType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    DECIMAL = "decimal"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    ARRAY = "array"


class TransformationType(str, Enum):
    DIRECT = "direct"
    EXPRESSION = "expression"
    CUSTOM_FUNCTION = "custom_function"
    LLM_TRANSFORM = "llm_transform"
    AGGREGATE = "aggregate"
    STATIC = "static"
    SEQUENCE = "sequence"
    LOOKUP = "lookup"
    CONDITIONAL = "conditional"


class ExpansionType(str, Enum):
    DUPLICATE = "duplicate"
    FIXED_EXPANSION = "fixed_expansion"
    CONDITIONAL_EXPANSION = "conditional_expansion"
    EXPAND_FROM_LIST = "expand_from_list"
    EXPAND_FROM_FILE = "expand_from_file"
    DYNAMIC_EXPANSION = "dynamic_expansion"


class SourceFile(BaseModel):
    file_id: str
    alias: str
    purpose: Optional[str] = None


class OutputColumn(BaseModel):
    id: str
    name: str
    type: ColumnType
    format: Optional[str] = None
    description: Optional[str] = None
    allowed_values: Optional[List[str]] = None
    default_value: Optional[Any] = None


class OutputDefinition(BaseModel):
    columns: List[OutputColumn]
    format: str = "csv"  # csv, excel, json, xml, fixed_width
    delimiter: Optional[str] = ","
    include_headers: bool = True


class ExpansionStrategy(BaseModel):
    type: ExpansionType
    config: Dict[str, Any]


class RowGenerationRule(BaseModel):
    id: str
    name: str
    type: str = "expand"
    enabled: bool = True
    condition: Optional[str] = None
    strategy: ExpansionStrategy
    priority: int = 0  # For ordering multiple rules


class TransformationConfig(BaseModel):
    type: TransformationType
    config: Dict[str, Any]


class ColumnMapping(BaseModel):
    id: str = Field(default_factory=lambda: f"map_{datetime.now().timestamp()}")
    target_column: str
    mapping_type: TransformationType
    source: Optional[str] = None  # For direct mapping
    transformation: Optional[TransformationConfig] = None
    enabled: bool = True


class ValidationRule(BaseModel):
    id: str
    name: str
    type: str  # required, format, range, custom
    config: Dict[str, Any]
    error_message: str
    severity: str = "error"  # error, warning


class TransformationTemplate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    tags: List[str] = []
    source_requirements: Dict[str, Any] = {}  # Expected source columns/structure
    output_definition: OutputDefinition
    row_generation_rules: List[RowGenerationRule] = []
    column_mappings: List[ColumnMapping] = []
    validation_rules: List[ValidationRule] = []
    sample_input: Optional[Dict[str, Any]] = None
    sample_output: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class TransformationConfig(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    source_files: List[SourceFile]
    output_definition: OutputDefinition
    row_generation_rules: List[RowGenerationRule] = []
    column_mappings: List[ColumnMapping] = []
    validation_rules: List[ValidationRule] = []
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class TransformationRequest(BaseModel):
    process_name: str
    description: Optional[str] = None
    source_files: List[SourceFile]
    transformation_config: TransformationConfig
    preview_only: bool = False
    row_limit: Optional[int] = None  # For preview mode


class TransformationResult(BaseModel):
    success: bool
    transformation_id: str
    total_input_rows: int
    total_output_rows: int
    processing_time_seconds: float
    validation_summary: Dict[str, Any]
    warnings: List[str] = []
    errors: List[str] = []
    preview_data: Optional[List[Dict[str, Any]]] = None


class LLMAssistanceRequest(BaseModel):
    assistance_type: str  # suggest_mappings, generate_transformation, validate_output
    source_columns: Optional[Dict[str, List[str]]] = None
    target_schema: Optional[OutputDefinition] = None
    sample_data: Optional[List[Dict[str, Any]]] = None
    examples: Optional[List[Dict[str, Any]]] = None
    context: Optional[str] = None


class LLMAssistanceResponse(BaseModel):
    suggestions: List[Dict[str, Any]]
    confidence_scores: Dict[str, float] = {}
    explanation: Optional[str] = None
    warnings: List[str] = []