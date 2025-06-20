# backend/app/services/extraction_service.py
import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import List, Dict, Optional

from app.config.settings import settings
from app.services.file_service import file_service
from app.services.openai_service import openai_service
from app.utils.financial_validators import FinancialValidators

from app.models.schemas import (
    ExtractionRequest, ExtractionResult, ExtractionStatus,
    ExtractionRow
)

logger = logging.getLogger(__name__)


class ExtractionService:
    def __init__(self):
        self.batch_size = settings.BATCH_SIZE
        self.active_extractions: Dict[str, ExtractionResult] = {}
        self.validators = FinancialValidators()

    async def start_extraction(self, request: ExtractionRequest) -> str:
        """
        Starts the extraction process asynchronously.

        Args:
            request (ExtractionRequest): The extraction request containing file ID, source column, 
                                         extraction prompt, and optional batch size.

        Returns:
            str: The unique extraction ID for tracking the extraction process.

        Raises:
            Exception: If the extraction request validation or initialization fails.
        """
        try:
            # Validate request
            file_service.validate_extraction_request(request.file_id, request.source_column)

            # Generate extraction ID
            extraction_id = str(uuid.uuid4())

            # Get file info
            file_info = file_service.get_file_info(request.file_id)

            # Initialize extraction result
            extraction_result = ExtractionResult(
                extraction_id=extraction_id,
                file_id=request.file_id,
                status=ExtractionStatus.PENDING,
                total_rows=file_info.total_rows,
                processed_rows=0,
                successful_extractions=0,
                failed_extractions=0,
                overall_confidence=None,
                processing_time=0.0,
                extracted_columns=[],
                sample_results=[],
                created_at=datetime.utcnow(),
                completed_at=None
            )

            # Store in active extractions
            self.active_extractions[extraction_id] = extraction_result

            # Start processing asynchronously
            asyncio.create_task(self._process_extraction(request, extraction_id))

            logger.info(f"Started extraction {extraction_id} for file {request.file_id}")
            return extraction_id

        except Exception as e:
            logger.error(f"Error starting extraction: {str(e)}")
            raise

    async def _process_extraction(self, request: ExtractionRequest, extraction_id: str):
        """
        Processes the extraction request asynchronously.

        Args:
            request (ExtractionRequest): The extraction request containing file ID, source column, 
                                         extraction prompt, and optional batch size.
            extraction_id (str): The unique ID of the extraction process.

        Updates:
            Updates the extraction status, processes data in batches, and calculates final statistics.

        Raises:
            Exception: If any error occurs during the extraction process.
        """
        start_time = time.time()

        try:
            # Update status to processing
            self.active_extractions[extraction_id].status = ExtractionStatus.PROCESSING

            # Prepare data for extraction
            source_data = file_service.prepare_data_for_extraction(
                request.file_id,
                request.source_column
            )

            # Process in batches
            all_extraction_rows = []
            batch_size = request.batch_size or self.batch_size

            for i in range(0, len(source_data), batch_size):
                batch = source_data[i:i + batch_size]

                if not any(text.strip() for text in batch):
                    # Skip empty batches
                    continue

                logger.info(f"Processing batch {i // batch_size + 1} for extraction {extraction_id}")

                # Extract data using OpenAI
                extraction_rows = await openai_service.extract_financial_data(
                    batch,
                    request.extraction_prompt,
                    request.source_column
                )

                # Enhance with regex patterns and validation
                enhanced_rows = await self._enhance_extractions(extraction_rows)

                all_extraction_rows.extend(enhanced_rows)

                # Update progress
                self.active_extractions[extraction_id].processed_rows = len(all_extraction_rows)

                # Small delay to prevent rate limiting
                await asyncio.sleep(0.1)

            # Calculate final statistics
            processing_time = time.time() - start_time

            successful_extractions = sum(
                1 for row in all_extraction_rows
                if row.extracted_fields and not row.error_message
            )

            failed_extractions = len(all_extraction_rows) - successful_extractions

            # Calculate overall confidence
            confidences = []
            for row in all_extraction_rows:
                for field in row.extracted_fields:
                    if field.confidence:
                        confidences.append(field.confidence)

            overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            # Get unique extracted columns
            extracted_columns = list(set(
                field.field_name for row in all_extraction_rows
                for field in row.extracted_fields
            ))

            # Get sample results (first 10 successful extractions)
            sample_results = [
                row for row in all_extraction_rows[:10]
                if row.extracted_fields and not row.error_message
            ]

            # Update final result
            final_result = ExtractionResult(
                extraction_id=extraction_id,
                file_id=request.file_id,
                status=ExtractionStatus.COMPLETED,
                total_rows=len(source_data),
                processed_rows=len(all_extraction_rows),
                successful_extractions=successful_extractions,
                failed_extractions=failed_extractions,
                overall_confidence=overall_confidence,
                processing_time=processing_time,
                extracted_columns=extracted_columns,
                sample_results=sample_results,
                created_at=self.active_extractions[extraction_id].created_at,
                completed_at=datetime.utcnow()
            )

            self.active_extractions[extraction_id] = final_result

            logger.info(f"Completed extraction {extraction_id} in {processing_time:.2f}s")

        except Exception as e:
            logger.error(f"Error processing extraction {extraction_id}: {str(e)}")

            # Update status to failed
            if extraction_id in self.active_extractions:
                self.active_extractions[extraction_id].status = ExtractionStatus.FAILED
                self.active_extractions[extraction_id].completed_at = datetime.utcnow()

    async def _enhance_extractions(self, extraction_rows: List[ExtractionRow]) -> List[ExtractionRow]:
        """
        Enhances LLM extractions with regex patterns and validation.

        Args:
            extraction_rows (List[ExtractionRow]): List of rows extracted by the LLM.

        Returns:
            List[ExtractionRow]: Enhanced rows with validated and corrected fields.
        """
        enhanced_rows = []

        for row in extraction_rows:
            enhanced_fields = []

            for field in row.extracted_fields:
                enhanced_field = field.copy()

                # Apply validation based on field type
                if field.field_name.upper() in ['ISIN']:
                    validation_result = self.validators.validate_isin(str(field.field_value))
                    if not validation_result and field.field_value:
                        # Try to extract ISIN using regex
                        regex_isin = self.validators.extract_isin_from_text(row.original_text)
                        if regex_isin:
                            enhanced_field.field_value = regex_isin
                            enhanced_field.extraction_method = "regex_fallback"
                            enhanced_field.confidence = 0.7

                elif field.field_name.upper() in ['CUSIP']:
                    if not self.validators.validate_cusip(str(field.field_value)) and field.field_value:
                        regex_cusip = self.validators.extract_cusip_from_text(row.original_text)
                        if regex_cusip:
                            enhanced_field.field_value = regex_cusip
                            enhanced_field.extraction_method = "regex_fallback"
                            enhanced_field.confidence = 0.7

                elif field.field_name.upper() in ['AMOUNT', 'VALUE']:
                    if field.field_value:
                        cleaned_amount = self.validators.extract_amount(str(field.field_value))
                        if cleaned_amount is not None:
                            enhanced_field.field_value = cleaned_amount

                elif field.field_name.upper() in ['CURRENCY']:
                    if not field.field_value:
                        currency = self.validators.extract_currency(row.original_text)
                        if currency:
                            enhanced_field.field_value = currency
                            enhanced_field.extraction_method = "regex_fallback"
                            enhanced_field.confidence = 0.8

                enhanced_fields.append(enhanced_field)

            # Create enhanced row
            enhanced_row = ExtractionRow(
                row_index=row.row_index,
                original_text=row.original_text,
                extracted_fields=enhanced_fields,
                processing_time=row.processing_time,
                error_message=row.error_message
            )

            enhanced_rows.append(enhanced_row)

        return enhanced_rows

    def get_extraction_status(self, extraction_id: str) -> Optional[ExtractionResult]:
        """
        Retrieves the status of an extraction.

        Args:
            extraction_id (str): The unique ID of the extraction.

        Returns:
            Optional[ExtractionResult]: The extraction result if found, otherwise None.
        """
        return self.active_extractions.get(extraction_id)

    def get_all_extractions(self) -> List[ExtractionResult]:
        """Get all extractions"""
        return list(self.active_extractions.values())

    async def export_results(self, extraction_id: str, format: str = "csv") -> Optional[bytes]:
        """
        Exports extraction results in the specified format.

        Args:
            extraction_id (str): The unique ID of the extraction.
            format (str): The format for export (csv, excel, or json).

        Returns:
            Optional[bytes]: The exported data in the specified format, or None if extraction is incomplete.
        """
        extraction_result = self.get_extraction_status(extraction_id)

        if not extraction_result or extraction_result.status != ExtractionStatus.COMPLETED:
            return None

        # Get full extraction data (in production, this would come from database)
        file_data = file_service.get_file_data(extraction_result.file_id)
        if file_data is None:
            return None

        # Create results DataFrame
        results_data = []

        for row in extraction_result.sample_results:  # In production, get all results
            result_row = {"row_index": row.row_index, "original_text": row.original_text}

            for field in row.extracted_fields:
                result_row[field.field_name] = field.field_value
                result_row[f"{field.field_name}_confidence"] = field.confidence

            results_data.append(result_row)

        import pandas as pd
        results_df = pd.DataFrame(results_data)

        if format.lower() == "csv":
            return results_df.to_csv(index=False).encode()
        elif format.lower() == "excel":
            import io
            buffer = io.BytesIO()
            results_df.to_excel(buffer, index=False)
            return buffer.getvalue()
        else:
            return results_df.to_json().encode()

    def cleanup_extraction(self, extraction_id: str) -> bool:
        """Remove extraction from active extractions"""
        try:
            if extraction_id in self.active_extractions:
                del self.active_extractions[extraction_id]
                logger.info(f"Cleaned up extraction {extraction_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error cleaning up extraction {extraction_id}: {str(e)}")
            return False


# Singleton instance
extraction_service = ExtractionService()
