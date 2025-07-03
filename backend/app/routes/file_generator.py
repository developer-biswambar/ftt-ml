import io
import json
import os
import re
import uuid
from datetime import datetime
from typing import List, Any, Optional, Union

import numpy as np
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# Enhanced Pydantic models for request/response
class RowCondition(BaseModel):
    """Defines conditions for which row this value applies to"""
    row_index: Optional[int] = None  # 0-based index (0 for first duplicate, 1 for second, etc.)
    condition: Optional[str] = None  # e.g., "first", "second", "last", "odd", "even"


class ConditionalValue(BaseModel):
    """Defines different values for different rows when multiplying"""
    condition: RowCondition
    value: Union[str, int, float, None]


class ColumnMapping(BaseModel):
    output_column: str
    source_column: Optional[str] = None  # None for static values
    static_value: Optional[str] = None
    transformation: Optional[str] = None  # For any data transformations
    # New fields for row multiplication
    conditional_values: Optional[List[ConditionalValue]] = None  # Different values per row


class RowMultiplication(BaseModel):
    """Defines how many rows to generate per source row"""
    enabled: bool = False
    count: int = 1  # Number of rows to generate per source row
    description: Optional[str] = None


class GenerationRule(BaseModel):
    output_filename: str
    columns: List[ColumnMapping]
    description: str
    # New field for row multiplication
    row_multiplication: Optional[RowMultiplication] = RowMultiplication()


class GenerationSummary(BaseModel):
    total_input_records: int
    total_output_records: int
    columns_generated: List[str]
    processing_time_seconds: float
    rules_applied: str
    # New field
    row_multiplication_factor: int = 1


class GenerationResponse(BaseModel):
    success: bool
    summary: GenerationSummary
    generation_id: str
    rules_used: GenerationRule
    errors: List[str] = []
    warnings: List[str] = []


# Create router
router = APIRouter(prefix="/file-generator", tags=["file-generator"])


class RuleBasedFileGenerator:
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

    def parse_prompt_with_openai(self, user_prompt: str, available_columns: List[str]) -> GenerationRule:
        """Use OpenAI to parse user prompt and generate rules"""
        try:
            system_prompt = f"""
            You are a data transformation expert. Parse the user's request to generate a file transformation rule.

            Available columns in the source file: {', '.join(available_columns)}

            The user may request:
            1. Simple column mapping (source column → output column)
            2. Static values (always the same value)
            3. ROW MULTIPLICATION: Generate multiple rows from each source row
            4. CONDITIONAL VALUES: Different values in the same column for different generated rows
            5. MATHEMATICAL OPERATIONS: Calculate values like half, percentage, etc.

            Based on the user's prompt, create a JSON response with the following structure:
            {{
                "output_filename": "descriptive_filename.csv",
                "row_multiplication": {{
                    "enabled": false,
                    "count": 1,
                    "description": "explanation if multiplication is used"
                }},
                "columns": [
                    {{
                        "output_column": "column_name_in_output",
                        "source_column": "source_column_name_or_null",
                        "static_value": "static_value_or_null",
                        "transformation": "description_of_any_transformation_or_null",
                        "conditional_values": [
                            {{
                                "condition": {{"row_index": 0, "condition": "first"}},
                                "value": "value_for_first_row_or_mathematical_expression"
                            }},
                            {{
                                "condition": {{"row_index": 1, "condition": "second"}},
                                "value": "value_for_second_row_or_mathematical_expression"
                            }}
                        ]
                    }}
                ],
                "description": "Brief description of what this transformation does"
            }}

            CRITICAL Rules for ROW MULTIPLICATION:
            1. Look for phrases like "generate X rows", "create multiple rows", "duplicate each row", "2 rows for each", etc.
            2. If user wants multiple rows, set row_multiplication.enabled = true and count = X
            3. For CONDITIONAL VALUES, use conditional_values array instead of static_value
            4. Row indices start at 0 (first duplicate = 0, second = 1, etc.)
            5. Condition can be "first", "second", "third", "last", "odd", "even", or use row_index

            CRITICAL Rules for MATHEMATICAL OPERATIONS:
            1. For "half value", "half amount", "divide by 2", use: "half" or "original/2"
            2. For percentages like "50%", use: "50%" 
            3. For other math like "amount * 0.3", use: "original * 0.3"
            4. The system will automatically find the source numeric column for calculations
            5. Use "original", "source", or "value" to refer to the source column value

            Examples:
            - "generate 2 rows for each source row, amount 100 in first row, amount 0 in second"
            - "create 2 rows per source, half value in first row, other half in second row"
            - "duplicate each row twice, 70% amount in first, 30% amount in second"
            - "generate 3 rows for each source, original amount in first, half in second, quarter in third"

            For STATIC VALUES: set "source_column" to null and provide "static_value"
            For MAPPED COLUMNS: set "source_column" to the source field and "static_value" to null
            For CONDITIONAL VALUES: use "conditional_values" array and set both "source_column" and "static_value" to null
            For MATHEMATICAL CONDITIONS: use expressions like "half", "50%", "original/2", "original * 0.5" in the value field

            Respond ONLY with valid JSON, no additional text.
            """

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )

            response_content = response.choices[0].message.content.strip()

            # Try to parse the JSON response
            try:
                rule_data = json.loads(response_content)
                return GenerationRule(**rule_data)
            except json.JSONDecodeError:
                # If JSON parsing fails, try to extract JSON from the response
                json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
                if json_match:
                    rule_data = json.loads(json_match.group())
                    return GenerationRule(**rule_data)
                else:
                    raise ValueError("Could not parse OpenAI response as JSON")

        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse prompt with OpenAI: {str(e)}. Please clarify your request."
            )

    def validate_rules(self, rules: GenerationRule, available_columns: List[str]) -> List[str]:
        """Validate that all source columns exist in the DataFrame"""
        errors = []

        for column_mapping in rules.columns:
            if column_mapping.source_column and column_mapping.source_column not in available_columns:
                errors.append(
                    f"Column '{column_mapping.source_column}' not found in source file. "
                    f"Available columns: {', '.join(available_columns)}"
                )

        # Validate row multiplication rules
        if rules.row_multiplication and rules.row_multiplication.enabled:
            if rules.row_multiplication.count < 1:
                errors.append("Row multiplication count must be at least 1")
            if rules.row_multiplication.count > 100:
                errors.append("Row multiplication count cannot exceed 100 (to prevent memory issues)")

        return errors

    def get_conditional_value(self, column_mapping: ColumnMapping, row_index: int, total_rows: int,
                              source_row_data: dict = None) -> Any:
        """Get the appropriate value for a column based on row conditions"""
        if not column_mapping.conditional_values:
            return None

        for conditional_value in column_mapping.conditional_values:
            condition = conditional_value.condition

            # Check row_index condition
            if condition.row_index is not None and condition.row_index == row_index:
                return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)

            # Check string condition
            if condition.condition:
                cond = condition.condition.lower()
                if cond == "first" and row_index == 0:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)
                elif cond == "second" and row_index == 1:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)
                elif cond == "third" and row_index == 2:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)
                elif cond == "last" and row_index == total_rows - 1:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)
                elif cond == "odd" and row_index % 2 == 1:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)
                elif cond == "even" and row_index % 2 == 0:
                    return self.process_conditional_value(conditional_value.value, source_row_data, column_mapping)

        return None

    def process_conditional_value(self, value, source_row_data: dict, column_mapping: ColumnMapping) -> Any:
        """Process conditional values with mathematical operations support"""
        if value is None or source_row_data is None:
            return value

        # Convert value to string for processing
        value_str = str(value).lower().strip()

        # Handle mathematical expressions
        if any(keyword in value_str for keyword in ['half', '/2', '* 0.5', 'divide by 2']):
            # Try to find the source column value for calculation
            source_value = None
            if column_mapping.source_column and column_mapping.source_column in source_row_data:
                source_value = source_row_data[column_mapping.source_column]

            # If no explicit source column, try to find a numeric column
            if source_value is None:
                for col_name, col_value in source_row_data.items():
                    if self.is_numeric_value(col_value):
                        source_value = col_value
                        break

            if source_value is not None and self.is_numeric_value(source_value):
                try:
                    numeric_value = float(source_value)
                    if 'half' in value_str or '/2' in value_str or 'divide by 2' in value_str:
                        return numeric_value / 2
                    elif '* 0.5' in value_str:
                        return numeric_value * 0.5
                except (ValueError, TypeError):
                    self.warnings.append(f"Could not convert '{source_value}' to numeric for mathematical operation")

        # Handle percentage operations
        elif '%' in value_str or 'percent' in value_str:
            # Extract percentage value
            import re
            percent_match = re.search(r'(\d+(?:\.\d+)?)\s*%', value_str)
            if percent_match:
                percentage = float(percent_match.group(1)) / 100

                # Find source value
                source_value = None
                if column_mapping.source_column and column_mapping.source_column in source_row_data:
                    source_value = source_row_data[column_mapping.source_column]

                if source_value is None:
                    for col_name, col_value in source_row_data.items():
                        if self.is_numeric_value(col_value):
                            source_value = col_value
                            break

                if source_value is not None and self.is_numeric_value(source_value):
                    try:
                        return float(source_value) * percentage
                    except (ValueError, TypeError):
                        pass

        # Handle other mathematical operations
        elif any(op in value_str for op in ['*', '/', '+', '-']):
            # Try to evaluate simple mathematical expressions with source value
            source_value = None
            if column_mapping.source_column and column_mapping.source_column in source_row_data:
                source_value = source_row_data[column_mapping.source_column]

            if source_value is not None and self.is_numeric_value(source_value):
                try:
                    # Replace common terms with actual values
                    expression = value_str
                    expression = expression.replace('original', str(source_value))
                    expression = expression.replace('source', str(source_value))
                    expression = expression.replace('value', str(source_value))

                    # Simple safety check - only allow basic math operations
                    if all(c in '0123456789+-*/.() ' for c in expression):
                        try:
                            return eval(expression)
                        except:
                            pass
                except (ValueError, TypeError):
                    pass

        # Return original value if no mathematical operation detected
        return value

    def is_numeric_value(self, value) -> bool:
        """Check if a value can be converted to a number"""
        if value is None or pd.isna(value):
            return False
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False

    def apply_transformation_rules(self, df: pd.DataFrame, rules: GenerationRule) -> pd.DataFrame:
        """Apply transformation rules to create new DataFrame with row multiplication support"""
        output_rows = []

        # Determine how many rows to generate per source row
        multiplication_factor = 1
        if rules.row_multiplication and rules.row_multiplication.enabled:
            multiplication_factor = rules.row_multiplication.count

        # Process each source row
        for source_idx, source_row in df.iterrows():
            # Convert source row to dict for easier access
            source_row_dict = source_row.to_dict()

            # Generate multiple rows for this source row
            for row_copy_idx in range(multiplication_factor):
                output_row = {}

                # Process each column mapping
                for column_mapping in rules.columns:
                    column_name = column_mapping.output_column

                    # Handle conditional values (for row multiplication)
                    if column_mapping.conditional_values:
                        value = self.get_conditional_value(column_mapping, row_copy_idx, multiplication_factor,
                                                           source_row_dict)
                        if value is not None:
                            output_row[column_name] = value
                        else:
                            # If no conditional value matches, use default logic
                            if column_mapping.source_column:
                                output_row[column_name] = source_row[column_mapping.source_column]
                            elif column_mapping.static_value is not None:
                                output_row[column_name] = column_mapping.static_value
                            else:
                                output_row[column_name] = None

                    # Handle static values
                    elif column_mapping.static_value is not None:
                        output_row[column_name] = column_mapping.static_value

                    # Handle source column mapping
                    elif column_mapping.source_column:
                        if column_mapping.transformation:
                            # Apply transformation
                            value = source_row[column_mapping.source_column]
                            transformed_value = self.apply_single_value_transformation(value,
                                                                                       column_mapping.transformation)
                            output_row[column_name] = transformed_value
                        else:
                            # Direct mapping
                            output_row[column_name] = source_row[column_mapping.source_column]

                    else:
                        output_row[column_name] = None
                        self.warnings.append(
                            f"Column '{column_name}' has no source, static value, or conditional values defined"
                        )

                output_rows.append(output_row)

        output_df = pd.DataFrame(output_rows)

        print(f"Generated {len(output_df)} rows from {len(df)} source rows (factor: {multiplication_factor})")
        return output_df

    def apply_single_value_transformation(self, value, transformation: str):
        """Apply transformation to a single value"""
        if pd.isna(value):
            return value

        transformation = transformation.lower().strip()

        try:
            if "uppercase" in transformation or "upper" in transformation:
                return str(value).upper()
            elif "lowercase" in transformation or "lower" in transformation:
                return str(value).lower()
            elif "title" in transformation or "capitalize" in transformation:
                return str(value).title()
            elif "strip" in transformation or "trim" in transformation:
                return str(value).strip()
            else:
                self.warnings.append(f"Unknown transformation: {transformation}. Applying no transformation.")
                return value
        except Exception as e:
            self.warnings.append(f"Error applying transformation '{transformation}': {str(e)}")
            return value

    def apply_column_transformation(self, series: pd.Series, transformation: str) -> pd.Series:
        """Apply simple transformations to a pandas Series"""
        return series.apply(lambda x: self.apply_single_value_transformation(x, transformation))


# Store generation results temporarily
generation_storage = {}


@router.post("/validate-prompt")
async def validate_prompt_parsing(
        source_file: UploadFile = File(...),
        user_prompt: str = Form(...),
        sheet_name: Optional[str] = Form(None)
):
    """Validate how the prompt gets parsed without generating the file"""
    generator = RuleBasedFileGenerator()

    try:
        # Read source file to get columns
        df = generator.read_file(source_file, sheet_name)
        available_columns = df.columns.tolist()

        # Parse user prompt with OpenAI
        rules = generator.parse_prompt_with_openai(user_prompt, available_columns)

        # Enhanced validation response
        validation_response = {
            "success": True,
            "user_prompt": user_prompt,
            "available_columns": available_columns,
            "parsed_rules": rules.dict(),
            "validation": {
                "static_columns": [
                    {
                        "column": col.output_column,
                        "static_value": col.static_value
                    }
                    for col in rules.columns if col.static_value is not None
                ],
                "mapped_columns": [
                    {
                        "output": col.output_column,
                        "source": col.source_column
                    }
                    for col in rules.columns if col.source_column is not None
                ],
                "conditional_columns": [
                    {
                        "column": col.output_column,
                        "conditions": [
                            {
                                "condition": cv.condition.dict(),
                                "value": cv.value
                            }
                            for cv in col.conditional_values
                        ]
                    }
                    for col in rules.columns if col.conditional_values
                ],
                "row_multiplication": rules.row_multiplication.dict() if rules.row_multiplication else None
            }
        }

        return validation_response

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "user_prompt": user_prompt
        }


@router.post("/generate", response_model=GenerationResponse)
async def generate_file_from_rules(
        source_file: UploadFile = File(...),
        user_prompt: str = Form(...),
        sheet_name: Optional[str] = Form(None)
):
    """Generate a new file based on user prompt and rules"""
    start_time = datetime.now()
    generator = RuleBasedFileGenerator()

    try:
        # Read source file
        df = generator.read_file(source_file, sheet_name)
        available_columns = df.columns.tolist()

        # Parse user prompt with OpenAI
        try:
            rules = generator.parse_prompt_with_openai(user_prompt, available_columns)
        except HTTPException as e:
            if "clarify" in str(e.detail).lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not understand your request. Please clarify: {e.detail}"
                )
            raise e

        # Validate rules against available columns
        validation_errors = generator.validate_rules(rules, available_columns)
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Column validation failed",
                    "errors": validation_errors,
                    "available_columns": available_columns,
                    "suggestion": "Please check column names and try again"
                }
            )

        # Apply transformation rules (now with row multiplication support)
        print(f"Applying rules: {rules.dict()}")
        output_df = generator.apply_transformation_rules(df, rules)

        # Generate unique ID for this generation
        generation_id = str(uuid.uuid4())

        # Store results
        generation_storage[generation_id] = {
            'output_data': output_df,
            'rules': rules,
            'timestamp': datetime.now(),
            'source_filename': source_file.filename
        }

        # Calculate summary
        processing_time = (datetime.now() - start_time).total_seconds()
        multiplication_factor = 1
        if rules.row_multiplication and rules.row_multiplication.enabled:
            multiplication_factor = rules.row_multiplication.count

        summary = GenerationSummary(
            total_input_records=len(df),
            total_output_records=len(output_df),
            columns_generated=output_df.columns.tolist(),
            processing_time_seconds=round(processing_time, 3),
            rules_applied=rules.description,
            row_multiplication_factor=multiplication_factor
        )

        return GenerationResponse(
            success=True,
            summary=summary,
            generation_id=generation_id,
            rules_used=rules,
            errors=generator.errors,
            warnings=generator.warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/results/{generation_id}")
async def get_generation_results(generation_id: str):
    """Get generation results as JSON"""
    if generation_id not in generation_storage:
        raise HTTPException(status_code=404, detail="Generation ID not found")

    results = generation_storage[generation_id]

    # Handle NaN and infinite values before converting to JSON
    def clean_dataframe(df):
        df = df.replace({np.nan: None})
        df = df.replace({np.inf: None, -np.inf: None})
        return df.to_dict(orient='records')

    return {
        'data': clean_dataframe(results['output_data']),
        'rules': results['rules'].dict(),
        'source_filename': results['source_filename'],
        'timestamp': results['timestamp'].isoformat()
    }


@router.get("/download/{generation_id}")
async def download_generated_file(
        generation_id: str,
        format: str = "csv"
):
    """Download generated file as CSV or Excel"""
    if generation_id not in generation_storage:
        raise HTTPException(status_code=404, detail="Generation ID not found")

    results = generation_storage[generation_id]
    output_df = results['output_data']
    rules = results['rules']

    # Use the filename from rules or generate a default one
    base_filename = rules.output_filename.replace('.csv', '').replace('.xlsx', '')

    if format.lower() == "excel":
        # Create Excel file
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            output_df.to_excel(writer, sheet_name='Generated Data', index=False)

            # Add rules sheet for reference
            rules_data = []
            for col_mapping in rules.columns:
                rule_info = {
                    'Output Column': col_mapping.output_column,
                    'Source Column': col_mapping.source_column or 'N/A',
                    'Static Value': col_mapping.static_value or 'N/A',
                    'Transformation': col_mapping.transformation or 'None',
                    'Has Conditional Values': 'Yes' if col_mapping.conditional_values else 'No'
                }

                if col_mapping.conditional_values:
                    for i, cv in enumerate(col_mapping.conditional_values):
                        rule_info[f'Condition {i + 1}'] = f"{cv.condition.dict()} = {cv.value}"

                rules_data.append(rule_info)

            rules_df = pd.DataFrame(rules_data)
            rules_df.to_excel(writer, sheet_name='Rules Applied', index=False)

            # Add metadata sheet
            metadata = {
                'Property': ['Description', 'Generated On', 'Source File', 'Total Records', 'Row Multiplication'],
                'Value': [
                    rules.description,
                    results['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                    results['source_filename'],
                    len(output_df),
                    f"{rules.row_multiplication.count}x" if rules.row_multiplication and rules.row_multiplication.enabled else "None"
                ]
            }
            pd.DataFrame(metadata).to_excel(writer, sheet_name='Metadata', index=False)

        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={base_filename}.xlsx"}
        )

    else:  # CSV format
        output = io.StringIO()
        output_df.to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={base_filename}.csv"}
        )


@router.get("/preview/{generation_id}")
async def preview_generated_file(generation_id: str, limit: int = 10):
    """Preview first few rows of generated file"""
    if generation_id not in generation_storage:
        raise HTTPException(status_code=404, detail="Generation ID not found")

    results = generation_storage[generation_id]
    output_df = results['output_data']

    # Get preview data
    preview_df = output_df.head(limit)

    # Clean data for JSON response
    preview_data = preview_df.replace({np.nan: None, np.inf: None, -np.inf: None})

    return {
        'preview_data': preview_data.to_dict(orient='records'),
        'total_records': len(output_df),
        'columns': output_df.columns.tolist(),
        'showing_records': len(preview_df),
        'rules_description': results['rules'].description,
        'row_multiplication': results['rules'].row_multiplication.dict() if results[
            'rules'].row_multiplication else None
    }


@router.delete("/results/{generation_id}")
async def delete_generation_results(generation_id: str):
    """Delete generation results from storage"""
    if generation_id not in generation_storage:
        raise HTTPException(status_code=404, detail="Generation ID not found")

    del generation_storage[generation_id]
    return {"message": f"Generation {generation_id} deleted successfully"}


@router.get("/list-generations")
async def list_generations():
    """List all stored generation results"""
    generations = []
    for gen_id, data in generation_storage.items():
        multiplication_info = ""
        if data['rules'].row_multiplication and data['rules'].row_multiplication.enabled:
            multiplication_info = f" ({data['rules'].row_multiplication.count}x multiplication)"

        generations.append({
            'generation_id': gen_id,
            'rules_description': data['rules'].description + multiplication_info,
            'output_filename': data['rules'].output_filename,
            'source_filename': data['source_filename'],
            'record_count': len(data['output_data']),
            'row_multiplication_factor': data['rules'].row_multiplication.count if data['rules'].row_multiplication and
                                                                                   data[
                                                                                       'rules'].row_multiplication.enabled else 1,
            'timestamp': data['timestamp'].isoformat()
        })

    return {
        'generations': sorted(generations, key=lambda x: x['timestamp'], reverse=True),
        'total_count': len(generations)
    }

# Example usage in your main.py:
# from your_module import router as file_generator_router
# app.include_router(file_generator_router)
