# extraction_routes.py - Extraction Related Routes

import asyncio
import json
import logging
import math
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional

import pandas as pd
from app.storage import uploaded_files, extractions
from fastapi import APIRouter, Form, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))

# Setup logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder":
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize OpenAI client: {e}")
else:
    print("⚠️ OpenAI client not initialized - check API key")


# Pydantic models for multi-column extraction
class ColumnRule(BaseModel):
    column_name: str
    extraction_prompt: str
    priority: int = 1  # Higher number = higher priority


class MultiColumnExtractionRequest(BaseModel):
    file_id: str
    column_rules: List[ColumnRule]
    batch_size: Optional[int] = None
    combine_results: bool = True  # Whether to combine results from multiple columns


# Create router
router = APIRouter()


async def process_batch_with_openai(batch_data: list, prompt: str, batch_number: int) -> dict:
    """Process a single batch of data with OpenAI (original single-column method)"""

    system_prompt = """You are a financial data extraction expert. 
Extract the requested information from the provided data and return as JSON.

Return a JSON object with this structure:
{
  "extractions": [
    {
      "index": 0,
      "original_text": "input text here",
      "extracted_data": {"field1": "value1", "field2": "value2"},
      "confidence": 0.95,
      "status": "success"
    }
  ]
}

For each input text, extract the requested fields. If extraction fails, set status to "error"."""

    # Format the batch data
    formatted_batch = []
    for i, text in enumerate(batch_data):
        formatted_batch.append(f"[{i}] {text}")

    user_prompt = f"""
Extract the following information: {prompt}

Process these {len(batch_data)} entries:
{chr(10).join(formatted_batch)}

Return JSON with extracted data for each entry using the index numbers."""

    try:
        logger.info(f"Processing batch {batch_number} with {len(batch_data)} entries")

        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=3000
        )

        response_content = response.choices[0].message.content.strip()

        # Clean JSON formatting
        if response_content.startswith('```json'):
            response_content = response_content.replace('```json', '').replace('```', '').strip()

        # Parse the JSON response
        try:
            parsed_response = json.loads(response_content)
            extractions_list = parsed_response.get('extractions', [])

            # Process results for each batch item
            results = []
            for i, original_text in enumerate(batch_data):
                matching_result = None
                for extraction in extractions_list:
                    if extraction.get('index') == i:
                        matching_result = extraction
                        break

                if matching_result:
                    results.append({
                        "index": i,
                        "original_text": original_text,
                        "extracted_data": matching_result.get('extracted_data', {}),
                        "confidence": matching_result.get('confidence', 0.8),
                        "status": matching_result.get('status', 'success')
                    })
                else:
                    results.append({
                        "index": i,
                        "original_text": original_text,
                        "extracted_data": {},
                        "confidence": 0.0,
                        "status": "error",
                        "error_message": "No extraction result returned"
                    })

            return {
                "batch_number": batch_number,
                "results": results,
                "status": "success",
                "processed_count": len(results)
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")

            # Return error results
            error_results = []
            for i, text in enumerate(batch_data):
                error_results.append({
                    "index": i,
                    "original_text": text,
                    "extracted_data": {},
                    "confidence": 0.0,
                    "status": "error",
                    "error_message": f"JSON parsing failed: {str(e)}"
                })

            return {
                "batch_number": batch_number,
                "results": error_results,
                "status": "json_error",
                "processed_count": len(error_results)
            }

    except Exception as e:
        logger.error(f"OpenAI API error: {e}")

        # Return error results
        error_results = []
        for i, text in enumerate(batch_data):
            error_results.append({
                "index": i,
                "original_text": text,
                "extracted_data": {},
                "confidence": 0.0,
                "status": "error",
                "error_message": str(e)
            })

        return {
            "batch_number": batch_number,
            "results": error_results,
            "status": "api_error",
            "processed_count": len(error_results)
        }


async def process_multi_column_batch(batch_data: List[Dict], column_rules: List[ColumnRule], batch_number: int) -> dict:
    """Process a batch with multiple columns and rules"""

    system_prompt = """You are a financial data extraction expert. 
You will be given data from multiple columns with specific extraction rules for each column.
Extract the requested information and return as JSON.

Return a JSON object with this structure:
{
  "extractions": [
    {
      "row_index": 0,
      "column_extractions": {
        "column_name_1": {
          "original_text": "text from column 1",
          "extracted_data": {"field1": "value1", "field2": "value2"},
          "confidence": 0.95,
          "status": "success"
        },
        "column_name_2": {
          "original_text": "text from column 2", 
          "extracted_data": {"field3": "value3"},
          "confidence": 0.90,
          "status": "success"
        }
      },
      "combined_result": {
        "field1": "value1",
        "field2": "value2", 
        "field3": "value3"
      }
    }
  ]
}

For each row and column combination, extract the requested fields."""

    # Format the batch data for processing
    formatted_data = []
    for i, row_data in enumerate(batch_data):
        row_text = f"Row {i}:"
        for column_name, text_content in row_data.items():
            if column_name != 'row_index':
                # Find the rule for this column
                rule = next((r for r in column_rules if r.column_name == column_name), None)
                if rule:
                    row_text += f"\n  {column_name}: {text_content}"
                    row_text += f"\n  Rule for {column_name}: {rule.extraction_prompt}"
        formatted_data.append(row_text)

    user_prompt = f"""
Process these {len(batch_data)} rows with the following column rules:

Column Rules:
{chr(10).join([f"- {rule.column_name}: {rule.extraction_prompt} (Priority: {rule.priority})" for rule in column_rules])}

Data to process:
{chr(10).join(formatted_data)}

Return JSON with extracted data for each row and column combination."""

    try:
        logger.info(f"Processing multi-column batch {batch_number} with {len(batch_data)} rows")

        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=4000
        )

        response_content = response.choices[0].message.content.strip()

        # Clean JSON formatting
        if response_content.startswith('```json'):
            response_content = response_content.replace('```json', '').replace('```', '').strip()

        # Parse the JSON response
        try:
            parsed_response = json.loads(response_content)
            extractions_list = parsed_response.get('extractions', [])

            # Process results for each batch item
            results = []
            for i, row_data in enumerate(batch_data):
                # Find matching result by row_index
                matching_result = None
                for extraction in extractions_list:
                    if extraction.get('row_index') == i:
                        matching_result = extraction
                        break

                if matching_result:
                    # Process column extractions
                    column_extractions = {}
                    combined_result = {}
                    overall_confidence = 0
                    successful_columns = 0

                    for rule in column_rules:
                        column_name = rule.column_name
                        column_extraction = matching_result.get('column_extractions', {}).get(column_name, {})

                        if column_extraction:
                            column_extractions[column_name] = {
                                "original_text": row_data.get(column_name, ""),
                                "extracted_data": column_extraction.get('extracted_data', {}),
                                "confidence": column_extraction.get('confidence', 0.8),
                                "status": column_extraction.get('status', 'success'),
                                "rule": rule.extraction_prompt
                            }

                            # Add to combined result
                            extracted_data = column_extraction.get('extracted_data', {})
                            for key, value in extracted_data.items():
                                # Prefix with column name if there are conflicts
                                result_key = key
                                if result_key in combined_result:
                                    result_key = f"{column_name}_{key}"
                                combined_result[result_key] = value

                            if column_extraction.get('confidence', 0) > 0:
                                overall_confidence += column_extraction.get('confidence', 0)
                                successful_columns += 1
                        else:
                            # No extraction for this column
                            column_extractions[column_name] = {
                                "original_text": row_data.get(column_name, ""),
                                "extracted_data": {},
                                "confidence": 0.0,
                                "status": "error",
                                "error_message": "No extraction result returned",
                                "rule": rule.extraction_prompt
                            }

                    # Calculate average confidence
                    avg_confidence = overall_confidence / len(column_rules) if column_rules else 0

                    results.append({
                        "row_index": i,
                        "column_extractions": column_extractions,
                        "combined_result": combined_result,
                        "overall_confidence": round(avg_confidence, 2),
                        "successful_columns": successful_columns,
                        "total_columns": len(column_rules)
                    })
                else:
                    # No result found for this row
                    column_extractions = {}
                    for rule in column_rules:
                        column_extractions[rule.column_name] = {
                            "original_text": row_data.get(rule.column_name, ""),
                            "extracted_data": {},
                            "confidence": 0.0,
                            "status": "error",
                            "error_message": "No extraction result returned",
                            "rule": rule.extraction_prompt
                        }

                    results.append({
                        "row_index": i,
                        "column_extractions": column_extractions,
                        "combined_result": {},
                        "overall_confidence": 0.0,
                        "successful_columns": 0,
                        "total_columns": len(column_rules)
                    })

            return {
                "batch_number": batch_number,
                "results": results,
                "status": "success",
                "processed_count": len(results),
                "columns_processed": [rule.column_name for rule in column_rules]
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")

            # Return error results for all rows
            error_results = []
            for i, row_data in enumerate(batch_data):
                column_extractions = {}
                for rule in column_rules:
                    column_extractions[rule.column_name] = {
                        "original_text": row_data.get(rule.column_name, ""),
                        "extracted_data": {},
                        "confidence": 0.0,
                        "status": "error",
                        "error_message": f"JSON parsing failed: {str(e)}",
                        "rule": rule.extraction_prompt
                    }

                error_results.append({
                    "row_index": i,
                    "column_extractions": column_extractions,
                    "combined_result": {},
                    "overall_confidence": 0.0,
                    "successful_columns": 0,
                    "total_columns": len(column_rules)
                })

            return {
                "batch_number": batch_number,
                "results": error_results,
                "status": "json_error",
                "processed_count": len(error_results),
                "columns_processed": [rule.column_name for rule in column_rules]
            }

    except Exception as e:
        logger.error(f"OpenAI API error: {e}")

        # Return error results for all rows
        error_results = []
        for i, row_data in enumerate(batch_data):
            column_extractions = {}
            for rule in column_rules:
                column_extractions[rule.column_name] = {
                    "original_text": row_data.get(rule.column_name, ""),
                    "extracted_data": {},
                    "confidence": 0.0,
                    "status": "error",
                    "error_message": str(e),
                    "rule": rule.extraction_prompt
                }

            error_results.append({
                "row_index": i,
                "column_extractions": column_extractions,
                "combined_result": {},
                "overall_confidence": 0.0,
                "successful_columns": 0,
                "total_columns": len(column_rules)
            })

        return {
            "batch_number": batch_number,
            "results": error_results,
            "status": "api_error",
            "processed_count": len(error_results),
            "columns_processed": [rule.column_name for rule in column_rules]
        }


async def process_extraction_in_batches(extraction_id: str, df: pd.DataFrame, column: str, prompt: str):
    """Process single-column extraction using batch calls (original method)"""
    try:
        logger.info(f"Starting single-column extraction for {extraction_id}")

        # Get data from column
        column_data = df[column].fillna('').astype(str)
        non_empty_data = [text.strip() for text in column_data.tolist() if text.strip()]

        if not non_empty_data:
            raise ValueError(f"No valid data found in column '{column}'")

        logger.info(f"Processing {len(non_empty_data)} rows in batches of {BATCH_SIZE}")

        # Calculate number of batches
        total_batches = math.ceil(len(non_empty_data) / BATCH_SIZE)

        # Initialize results
        all_results = []
        successful_extractions = 0
        failed_extractions = 0

        if openai_client:
            # Process data in batches
            for i in range(0, len(non_empty_data), BATCH_SIZE):
                batch_data = non_empty_data[i:i + BATCH_SIZE]
                batch_number = (i // BATCH_SIZE) + 1

                logger.info(f"Processing batch {batch_number}/{total_batches}")

                # Process the batch
                batch_result = await process_batch_with_openai(batch_data, prompt, batch_number)

                # Add results
                all_results.extend(batch_result["results"])

                # Count successes and failures
                for result in batch_result["results"]:
                    if result["status"] == "success":
                        successful_extractions += 1
                    else:
                        failed_extractions += 1

                # Update progress
                progress_percentage = (batch_number / total_batches) * 100
                extractions[extraction_id]["progress"] = {
                    "current_batch": batch_number,
                    "total_batches": total_batches,
                    "processed_rows": len(all_results),
                    "total_rows": len(non_empty_data),
                    "percentage": round(progress_percentage, 1)
                }

                logger.info(f"Batch {batch_number} completed - Progress: {progress_percentage:.1f}%")

                # Delay between batches
                if batch_number < total_batches:
                    await asyncio.sleep(1)

            # Compile final results
            final_result = {
                "extraction_summary": {
                    "total_rows_processed": len(non_empty_data),
                    "successful_extractions": successful_extractions,
                    "failed_extractions": failed_extractions,
                    "success_rate": round((successful_extractions / len(all_results)) * 100, 2) if all_results else 0,
                    "total_batches_processed": total_batches,
                    "batch_size_used": BATCH_SIZE
                },
                "extraction_results": all_results[:20],  # First 20 results
                "processing_details": {
                    "model_used": OPENAI_MODEL,
                    "batch_processing": True,
                    "batches_completed": total_batches,
                    "extraction_type": "single_column"
                }
            }

        else:
            # No OpenAI client
            final_result = {
                "status": "no_openai_key",
                "message": "OpenAI API key not configured",
                "sample_data": non_empty_data[:5],
                "total_rows": len(non_empty_data)
            }

        # Update extraction record
        extractions[extraction_id].update({
            "status": "completed",
            "result": final_result,
            "processed_rows": len(non_empty_data),
            "successful_extractions": successful_extractions,
            "failed_extractions": failed_extractions,
            "completed_at": datetime.utcnow().isoformat(),
            "extraction_type": "single_column",
            "batch_info": {
                "total_batches": total_batches,
                "batch_size": BATCH_SIZE,
                "model_used": OPENAI_MODEL
            }
        })

        logger.info(f"Single-column extraction {extraction_id} completed successfully")

    except Exception as e:
        logger.error(f"Single-column extraction failed for {extraction_id}: {e}")
        extractions[extraction_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })


async def process_multi_column_extraction(extraction_id: str, df: pd.DataFrame, column_rules: List[ColumnRule]):
    """Process multi-column extraction using batch calls"""
    try:
        logger.info(f"Starting multi-column extraction for {extraction_id}")

        # Validate columns exist
        missing_columns = []
        for rule in column_rules:
            if rule.column_name not in df.columns:
                missing_columns.append(rule.column_name)

        if missing_columns:
            raise ValueError(f"Columns not found: {missing_columns}")

        # Prepare data for processing
        batch_data = []
        for index, row in df.iterrows():
            row_data = {"row_index": index}
            for rule in column_rules:
                text_content = str(row[rule.column_name]).strip() if pd.notna(row[rule.column_name]) else ""
                row_data[rule.column_name] = text_content

            # Only include rows that have at least one non-empty column
            if any(row_data[rule.column_name] for rule in column_rules):
                batch_data.append(row_data)

        if not batch_data:
            raise ValueError("No valid data found in any of the specified columns")

        logger.info(f"Processing {len(batch_data)} rows across {len(column_rules)} columns")

        # Calculate number of batches
        total_batches = math.ceil(len(batch_data) / BATCH_SIZE)

        # Initialize results
        all_results = []
        successful_extractions = 0
        failed_extractions = 0
        column_stats = {rule.column_name: {"successful": 0, "failed": 0} for rule in column_rules}

        if openai_client:
            # Process data in batches
            for i in range(0, len(batch_data), BATCH_SIZE):
                batch = batch_data[i:i + BATCH_SIZE]
                batch_number = (i // BATCH_SIZE) + 1

                logger.info(f"Processing batch {batch_number}/{total_batches}")

                # Process the batch
                batch_result = await process_multi_column_batch(batch, column_rules, batch_number)

                # Add results
                all_results.extend(batch_result["results"])

                # Count successes and failures
                for result in batch_result["results"]:
                    if result["successful_columns"] > 0:
                        successful_extractions += 1
                    else:
                        failed_extractions += 1

                    # Update column statistics
                    for column_name, extraction in result["column_extractions"].items():
                        if extraction["status"] == "success":
                            column_stats[column_name]["successful"] += 1
                        else:
                            column_stats[column_name]["failed"] += 1

                # Update progress
                progress_percentage = (batch_number / total_batches) * 100
                extractions[extraction_id]["progress"] = {
                    "current_batch": batch_number,
                    "total_batches": total_batches,
                    "processed_rows": len(all_results),
                    "total_rows": len(batch_data),
                    "percentage": round(progress_percentage, 1)
                }

                logger.info(f"Batch {batch_number} completed - Progress: {progress_percentage:.1f}%")

                # Delay between batches
                if batch_number < total_batches:
                    await asyncio.sleep(1)

            # Compile final results
            final_result = {
                "extraction_summary": {
                    "total_rows_processed": len(batch_data),
                    "successful_extractions": successful_extractions,
                    "failed_extractions": failed_extractions,
                    "success_rate": round((successful_extractions / len(all_results)) * 100, 2) if all_results else 0,
                    "total_batches_processed": total_batches,
                    "batch_size_used": BATCH_SIZE,
                    "columns_processed": len(column_rules)
                },
                "column_statistics": column_stats,
                "column_rules": [
                    {
                        "column_name": rule.column_name,
                        "extraction_prompt": rule.extraction_prompt,
                        "priority": rule.priority
                    }
                    for rule in column_rules
                ],
                "extraction_results": all_results[:20],  # First 20 results
                "processing_details": {
                    "model_used": OPENAI_MODEL,
                    "batch_processing": True,
                    "batches_completed": total_batches,
                    "multi_column_processing": True
                }
            }

        else:
            # No OpenAI client
            final_result = {
                "status": "no_openai_key",
                "message": "OpenAI API key not configured",
                "column_rules": [
                    {
                        "column_name": rule.column_name,
                        "extraction_prompt": rule.extraction_prompt,
                        "priority": rule.priority
                    }
                    for rule in column_rules
                ],
                "total_rows": len(batch_data)
            }

        # Update extraction record
        extractions[extraction_id].update({
            "status": "completed",
            "result": final_result,
            "processed_rows": len(batch_data),
            "successful_extractions": successful_extractions,
            "failed_extractions": failed_extractions,
            "completed_at": datetime.utcnow().isoformat(),
            "batch_info": {
                "total_batches": total_batches,
                "batch_size": BATCH_SIZE,
                "model_used": OPENAI_MODEL,
                "columns_processed": len(column_rules)
            }
        })

        logger.info(f"Multi-column extraction {extraction_id} completed successfully")

    except Exception as e:
        logger.error(f"Multi-column extraction failed for {extraction_id}: {e}")
        extractions[extraction_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })


# API Routes

@router.post("/extract-multi-column")
async def start_multi_column_extraction(request: MultiColumnExtractionRequest):
    """Start multi-column extraction with different rules for each column"""
    try:
        if request.file_id not in uploaded_files:
            raise HTTPException(404, "File not found")

        file_data = uploaded_files[request.file_id]
        df = file_data["data"]

        # Validate all columns exist
        missing_columns = []
        for rule in request.column_rules:
            if rule.column_name not in df.columns:
                missing_columns.append(rule.column_name)

        if missing_columns:
            available_columns = list(df.columns)
            raise HTTPException(400, f"Columns not found: {missing_columns}. Available: {available_columns}")

        # Sort rules by priority (higher priority first)
        sorted_rules = sorted(request.column_rules, key=lambda x: x.priority, reverse=True)

        extraction_id = str(uuid.uuid4())

        # Calculate estimated rows and batches
        estimated_rows = len(df)
        effective_batch_size = request.batch_size if request.batch_size else BATCH_SIZE
        effective_batch_size = max(5, min(50, effective_batch_size))
        estimated_batches = math.ceil(estimated_rows / effective_batch_size)

        extractions[extraction_id] = {
            "extraction_id": extraction_id,
            "file_id": request.file_id,
            "status": "processing",
            "extraction_type": "multi_column",
            "column_rules": [
                {
                    "column_name": rule.column_name,
                    "extraction_prompt": rule.extraction_prompt,
                    "priority": rule.priority
                }
                for rule in sorted_rules
            ],
            "combine_results": request.combine_results,
            "created_at": datetime.utcnow().isoformat(),
            "total_rows": len(df),
            "batch_size": effective_batch_size,
            "estimated_batches": estimated_batches
        }

        # Start processing
        asyncio.create_task(process_multi_column_extraction(extraction_id, df, sorted_rules))

        logger.info(f"Started multi-column extraction {extraction_id}")

        return {
            "success": True,
            "message": "Multi-column batch extraction started",
            "data": {
                "extraction_id": extraction_id,
                "estimated_batches": estimated_batches,
                "batch_size": effective_batch_size,
                "total_rows_to_process": estimated_rows,
                "columns_to_process": [rule.column_name for rule in sorted_rules],
                "extraction_type": "multi_column"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multi-column extraction error: {e}")
        raise HTTPException(400, f"Failed to start multi-column extraction: {str(e)}")


@router.post("/extract")
async def start_extraction(
        file_id: str = Form(...),
        extraction_prompt: str = Form(...),
        source_column: str = Form(...),
        batch_size: int = Form(None)
):
    """Start single-column extraction (original method - unchanged)"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, "File not found")

        file_data = uploaded_files[file_id]
        df = file_data["data"]

        if source_column not in df.columns:
            available_columns = list(df.columns)
            raise HTTPException(400, f"Column '{source_column}' not found. Available: {available_columns}")

        # Use custom batch size if provided
        effective_batch_size = batch_size if batch_size else BATCH_SIZE
        effective_batch_size = max(5, min(50, effective_batch_size))

        extraction_id = str(uuid.uuid4())

        # Calculate estimated batches
        non_empty_count = len([x for x in df[source_column].fillna('').astype(str) if x.strip()])
        estimated_batches = math.ceil(non_empty_count / effective_batch_size)

        extractions[extraction_id] = {
            "extraction_id": extraction_id,
            "file_id": file_id,
            "status": "processing",
            "extraction_type": "single_column",
            "prompt": extraction_prompt,
            "column": source_column,
            "created_at": datetime.utcnow().isoformat(),
            "total_rows": len(df),
            "non_empty_rows": non_empty_count,
            "batch_size": effective_batch_size,
            "estimated_batches": estimated_batches
        }

        # Start processing using original single-column method
        asyncio.create_task(process_extraction_in_batches(extraction_id, df, source_column, extraction_prompt))

        logger.info(f"Started single-column extraction {extraction_id}")

        return {
            "success": True,
            "message": "Single-column batch extraction started",
            "data": {
                "extraction_id": extraction_id,
                "estimated_batches": estimated_batches,
                "batch_size": effective_batch_size,
                "total_rows_to_process": non_empty_count,
                "extraction_type": "single_column"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single-column extraction error: {e}")
        raise HTTPException(400, f"Failed to start extraction: {str(e)}")


@router.get("/extractions/{extraction_id}")
async def get_extraction_status(extraction_id: str):
    if extraction_id not in extractions:
        available_ids = list(extractions.keys())[-5:]
        raise HTTPException(404, f"Extraction not found. Recent extractions: {len(available_ids)}")

    return {
        "success": True,
        "message": "Extraction status retrieved",
        "data": extractions[extraction_id]
    }


@router.get("/extractions/{extraction_id}/results")
async def get_extraction_results(extraction_id: str):
    """Get clean, formatted extraction results"""
    if extraction_id not in extractions:
        raise HTTPException(404, "Extraction not found")

    extraction_data = extractions[extraction_id]

    if extraction_data.get("status") != "completed":
        return {
            "success": False,
            "message": f"Extraction status: {extraction_data.get('status', 'unknown')}",
            "data": {
                "status": extraction_data.get("status"),
                "progress": extraction_data.get("progress", {})
            }
        }

    result = extraction_data.get("result", {})

    formatted_response = {
        "extraction_info": {
            "extraction_id": extraction_id,
            "file_id": extraction_data.get("file_id"),
            "extraction_type": extraction_data.get("extraction_type", "single_column"),
            "column_rules": extraction_data.get("column_rules", []),
            "created_at": extraction_data.get("created_at"),
            "completed_at": extraction_data.get("completed_at")
        },
        "summary": result.get("extraction_summary", {}),
        "column_statistics": result.get("column_statistics", {}),
        "results": result.get("extraction_results", []),
        "processing_details": result.get("processing_details", {})
    }

    return {
        "success": True,
        "message": "Extraction results retrieved",
        "data": formatted_response
    }
