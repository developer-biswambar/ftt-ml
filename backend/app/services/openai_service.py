# backend/app/services/openai_service.py
import asyncio
import json
import logging
import time
from typing import List

from openai import AsyncOpenAI

from app.config.settings import settings
from app.models.schemas import ExtractedField, ExtractionRow

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.max_tokens = settings.OPENAI_MAX_TOKENS
        self.temperature = settings.OPENAI_TEMPERATURE

    async def extract_financial_data(
            self,
            text_batch: List[str],
            extraction_prompt: str,
            source_column: str
    ) -> List[ExtractionRow]:
        """
        Extract financial data from a batch of text using OpenAI GPT
        """
        try:
            system_prompt = self._build_system_prompt()
            user_prompt = self._build_user_prompt(text_batch, extraction_prompt, source_column)

            start_time = time.time()

            response = await self._call_openai_api(system_prompt, user_prompt)

            processing_time = time.time() - start_time

            # Parse response and create ExtractionRow objects
            extraction_rows = self._parse_openai_response(
                response, text_batch, processing_time
            )

            return extraction_rows

        except Exception as e:
            logger.error(f"Error in OpenAI extraction: {str(e)}")
            # Return failed extraction rows
            return self._create_failed_rows(text_batch, str(e))

    def _build_system_prompt(self) -> str:
        """Build the system prompt for financial data extraction"""
        return """
You are an expert financial data extraction specialist. Your task is to extract structured financial information from unstructured text data.

FINANCIAL DATA TYPES:
- ISIN: 12-character international securities identifier (e.g., US0378331005)
- CUSIP: 9-character US securities identifier (e.g., 037833100)
- SEDOL: 7-character UK securities identifier (e.g., 2000019)
- Ticker: Stock ticker symbol (e.g., AAPL, MSFT)
- Amount: Monetary values with or without currency symbols
- Currency: 3-letter ISO currency codes (USD, EUR, GBP, etc.)
- Date: Transaction or settlement dates in various formats
- Trade ID: Transaction reference numbers
- Account ID: Account identifiers
- Counterparty: Trading counterparty names
- Description: Additional trade details

EXTRACTION RULES:
1. Extract ONLY the requested fields from the user prompt
2. Return null for missing or unclear values
3. Validate financial identifiers using standard formats
4. Provide confidence scores (0.0-1.0) for each extraction
5. Return results as valid JSON array

OUTPUT FORMAT:
Return a JSON array where each object represents one input text with extracted fields:
[
  {
    "row_index": 0,
    "extracted_fields": [
      {
        "field_name": "ISIN",
        "field_value": "US0378331005",
        "confidence": 0.95,
        "extraction_method": "llm"
      }
    ],
    "error_message": null
  }
]

IMPORTANT: 
- Always return valid JSON
- Include row_index for each input text
- Set confidence based on certainty of extraction
- Use null for missing values, not empty strings
"""

    def _build_user_prompt(
            self,
            text_batch: List[str],
            extraction_prompt: str,
            source_column: str
    ) -> str:
        """Build the user prompt with specific extraction instructions"""

        # Format the text batch with indices
        formatted_texts = []
        for i, text in enumerate(text_batch):
            formatted_texts.append(f"Index {i}: {text}")

        texts_str = "\n".join(formatted_texts)

        return f"""
EXTRACTION REQUEST:
{extraction_prompt}

SOURCE COLUMN: {source_column}

INPUT DATA:
{texts_str}

Please extract the requested financial data from each text entry and return as JSON array following the specified format.
"""

    async def _call_openai_api(self, system_prompt: str, user_prompt: str) -> str:
        """Make async call to OpenAI API"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )

            return response.choices[0].message.content

        except Exception as e:
            if "rate_limit" in str(e).lower():
                logger.warning("OpenAI rate limit hit, waiting...")
                await asyncio.sleep(10)
                return await self._call_openai_api(system_prompt, user_prompt)
            else:
                logger.error(f"OpenAI API error: {str(e)}")
                raise

    def _parse_openai_response(
            self,
            response: str,
            original_texts: List[str],
            processing_time: float
    ) -> List[ExtractionRow]:
        """Parse OpenAI response into ExtractionRow objects"""
        try:
            # Try to parse as JSON
            if response.startswith('```json'):
                response = response.replace('```json', '').replace('```', '').strip()

            parsed_data = json.loads(response)

            # Handle if response is wrapped in an object
            if isinstance(parsed_data, dict) and 'results' in parsed_data:
                parsed_data = parsed_data['results']
            elif isinstance(parsed_data, dict) and 'extractions' in parsed_data:
                parsed_data = parsed_data['extractions']

            if not isinstance(parsed_data, list):
                raise ValueError("Response is not a list")

            extraction_rows = []

            for item in parsed_data:
                row_index = item.get('row_index', 0)

                # Ensure we don't exceed original texts length
                if row_index >= len(original_texts):
                    continue

                extracted_fields = []
                for field_data in item.get('extracted_fields', []):
                    extracted_fields.append(
                        ExtractedField(
                            field_name=field_data.get('field_name'),
                            field_value=field_data.get('field_value'),
                            confidence=field_data.get('confidence', 0.8),
                            extraction_method=field_data.get('extraction_method', 'llm')
                        )
                    )

                extraction_rows.append(
                    ExtractionRow(
                        row_index=row_index,
                        original_text=original_texts[row_index],
                        extracted_fields=extracted_fields,
                        processing_time=processing_time / len(original_texts),
                        error_message=item.get('error_message')
                    )
                )

            return extraction_rows

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {str(e)}")
            logger.error(f"Raw response: {response}")
            return self._create_failed_rows(original_texts, f"JSON parsing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error parsing OpenAI response: {str(e)}")
            return self._create_failed_rows(original_texts, str(e))

    def _create_failed_rows(self, original_texts: List[str], error_message: str) -> List[ExtractionRow]:
        """Create failed extraction rows for error cases"""
        failed_rows = []
        for i, text in enumerate(original_texts):
            failed_rows.append(
                ExtractionRow(
                    row_index=i,
                    original_text=text,
                    extracted_fields=[],
                    processing_time=0.0,
                    error_message=error_message
                )
            )
        return failed_rows

    async def test_connection(self) -> bool:
        """Test OpenAI API connection"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a test assistant."},
                    {"role": "user", "content": "Respond with 'OK' if you can hear me."}
                ],
                max_tokens=10,
                temperature=0
            )
            return "OK" in response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI connection test failed: {str(e)}")
            return False


# Singleton instance
openai_service = OpenAIService()
