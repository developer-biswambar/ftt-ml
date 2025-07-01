from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Dict, List, Any, Optional, Union
import pandas as pd
import numpy as np
import json
import io
import os
from datetime import datetime
import uuid
from pydantic import BaseModel, Field
import openai
from openai import OpenAI
import re

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# Pydantic models for request/response
class ColumnMapping(BaseModel):
    output_column: str
    source_column: Optional[str] = None  # None for static values
    static_value: Optional[str] = None
    transformation: Optional[str] = None  # For any data transformations


class GenerationRule(BaseModel):
    output_filename: str
    columns: List[ColumnMapping]
    description: str


class GenerationSummary(BaseModel):
    total_input_records: int
    total_output_records: int
    columns_generated: List[str]
    processing_time_seconds: float
    rules_applied: str


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

            Based on the user's prompt, create a JSON response with the following structure:
            {{
                "output_filename": "descriptive_filename.csv",
                "columns": [
                    {{
                        "output_column": "column_name_in_output",
                        "source_column": "source_column_name_or_null",
                        "static_value": "static_value_or_null",
                        "transformation": "description_of_any_transformation_or_null"
                    }}
                ],
                "description": "Brief description of what this transformation does"
            }}

            CRITICAL Rules:
            1. For STATIC VALUES: set "source_column" to null and provide the exact "static_value"
               Example: "jurisdiction is always italy" → {{"source_column": null, "static_value": "italy"}}
            2. For MAPPED COLUMNS: set "source_column" to the source field and "static_value" to null
               Example: "trade_id from Trade_ID" → {{"source_column": "Trade_ID", "static_value": null}}
            3. Pay attention to phrases like "always", "is always", "fixed", "constant"
            4. Only use columns that exist in the available columns list
            5. Be precise about static values - use exactly what the user specifies

            Example for "jurisdiction is always italy, header is always 'XYZ'":
            - jurisdiction: {{"source_column": null, "static_value": "italy"}}
            - header: {{"source_column": null, "static_value": "XYZ"}}

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

        return errors

    def apply_transformation_rules(self, df: pd.DataFrame, rules: GenerationRule) -> pd.DataFrame:
        """Apply transformation rules to create new DataFrame"""
        output_df = pd.DataFrame()

        # Ensure we have the same number of rows as input
        num_rows = len(df)

        for column_mapping in rules.columns:
            if column_mapping.static_value is not None:
                # Static value column - ensure it's not empty string and repeat for all rows
                static_val = column_mapping.static_value
                if static_val == "":
                    static_val = None
                output_df[column_mapping.output_column] = [static_val] * num_rows
                print(
                    f"Applied static value '{static_val}' to column '{column_mapping.output_column}' for {num_rows} rows")
            elif column_mapping.source_column:
                # Mapped column
                if column_mapping.transformation:
                    # Apply transformation if specified
                    output_df[column_mapping.output_column] = self.apply_column_transformation(
                        df[column_mapping.source_column],
                        column_mapping.transformation
                    )
                else:
                    # Direct mapping
                    output_df[column_mapping.output_column] = df[column_mapping.source_column]
                print(f"Mapped column '{column_mapping.source_column}' to '{column_mapping.output_column}'")
            else:
                self.warnings.append(
                    f"Column '{column_mapping.output_column}' has no source or static value defined"
                )
                print(f"WARNING: No mapping for column '{column_mapping.output_column}'")

        return output_df

    def apply_column_transformation(self, series: pd.Series, transformation: str) -> pd.Series:
        """Apply simple transformations to a pandas Series"""
        transformation = transformation.lower().strip()

        try:
            if "uppercase" in transformation or "upper" in transformation:
                return series.astype(str).str.upper()
            elif "lowercase" in transformation or "lower" in transformation:
                return series.astype(str).str.lower()
            elif "title" in transformation or "capitalize" in transformation:
                return series.astype(str).str.title()
            elif "strip" in transformation or "trim" in transformation:
                return series.astype(str).str.strip()
            else:
                self.warnings.append(f"Unknown transformation: {transformation}. Applying no transformation.")
                return series
        except Exception as e:
            self.warnings.append(f"Error applying transformation '{transformation}': {str(e)}")
            return series


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

        return {
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
                ]
            }
        }

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

        # Apply transformation rules
        print(f"Applying rules: {rules.dict()}")
        output_df = generator.apply_transformation_rules(df, rules)

        # Debug: Check if static values were applied correctly
        for column_mapping in rules.columns:
            if column_mapping.static_value is not None:
                if column_mapping.output_column in output_df.columns:
                    unique_vals = output_df[column_mapping.output_column].unique()
                    print(f"Column '{column_mapping.output_column}': unique values = {unique_vals}")
                    if len(unique_vals) == 1 and unique_vals[0] != column_mapping.static_value:
                        generator.warnings.append(
                            f"Static value mismatch for '{column_mapping.output_column}': "
                            f"expected '{column_mapping.static_value}', got '{unique_vals[0]}'"
                        )

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

        summary = GenerationSummary(
            total_input_records=len(df),
            total_output_records=len(output_df),
            columns_generated=output_df.columns.tolist(),
            processing_time_seconds=round(processing_time, 3),
            rules_applied=rules.description
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
                rules_data.append({
                    'Output Column': col_mapping.output_column,
                    'Source Column': col_mapping.source_column or 'N/A',
                    'Static Value': col_mapping.static_value or 'N/A',
                    'Transformation': col_mapping.transformation or 'None'
                })

            rules_df = pd.DataFrame(rules_data)
            rules_df.to_excel(writer, sheet_name='Rules Applied', index=False)

            # Add metadata sheet
            metadata = {
                'Property': ['Description', 'Generated On', 'Source File', 'Total Records'],
                'Value': [
                    rules.description,
                    results['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                    results['source_filename'],
                    len(output_df)
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
        'rules_description': results['rules'].description
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
        generations.append({
            'generation_id': gen_id,
            'rules_description': data['rules'].description,
            'output_filename': data['rules'].output_filename,
            'source_filename': data['source_filename'],
            'record_count': len(data['output_data']),
            'timestamp': data['timestamp'].isoformat()
        })

    return {
        'generations': sorted(generations, key=lambda x: x['timestamp'], reverse=True),
        'total_count': len(generations)
    }

# Example usage in your main.py:
# from your_module import router as file_generator_router
# app.include_router(file_generator_router)