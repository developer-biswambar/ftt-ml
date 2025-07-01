# backend/app/routes/reconciliation_routes.py - Advanced Vector DB Reconciliation
import logging
import os
import uuid
import asyncio
import time
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.storage_service import uploaded_files

# Vector DB imports (add these to requirements.txt)
try:
    import chromadb
    from sentence_transformers import SentenceTransformer

    VECTOR_DB_AVAILABLE = True
except ImportError:
    VECTOR_DB_AVAILABLE = False
    logging.warning("Vector DB dependencies not installed. Install: pip install chromadb sentence-transformers")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])

# Global vector DB components
vector_client = None
embedding_model = None
reconciliation_results = {}  # Store reconciliation results in memory


# Pydantic models
class ReconciliationRequest(BaseModel):
    source_a_file_id: str
    source_b_file_id: str
    source_a_key_fields: Optional[List[str]] = None
    source_b_key_fields: Optional[List[str]] = None
    similarity_threshold: float = 0.8
    max_matches_per_record: int = 3
    normalize_data: bool = True
    reconciliation_name: Optional[str] = None


class AdvancedReconciliationRequest(BaseModel):
    source_a_file_id: str
    source_b_file_id: str
    field_mapping: Dict[str, str]  # Map source_a fields to source_b fields
    matching_strategy: str = "semantic"  # "exact", "fuzzy", "semantic"
    similarity_threshold: float = 0.8
    tolerance_settings: Optional[Dict[str, float]] = None  # Price tolerance, date tolerance
    business_rules: Optional[List[str]] = None


class ReconciliationResult(BaseModel):
    reconciliation_id: str
    reconciliation_name: str
    source_a_file: str
    source_b_file: str
    total_matches: int
    high_confidence_matches: int
    probable_matches: int
    possible_matches: int
    low_confidence_matches: int
    source_a_total: int
    source_a_matched: int
    source_a_unmatched: int
    source_b_total: int
    source_b_matched: int
    source_b_unmatched: int
    processing_time_seconds: float
    created_at: str
    status: str


class MatchDetail(BaseModel):
    match_id: str
    source_a_id: str
    source_b_id: str
    similarity_score: float
    match_rank: int
    recommendation: str
    differences: List[str]
    source_a_data: Dict
    source_b_data: Dict


# Vector DB utility functions
def initialize_vector_db():
    """Initialize vector database and embedding model"""
    global vector_client, embedding_model

    if not VECTOR_DB_AVAILABLE:
        raise HTTPException(500,
                            "Vector DB dependencies not installed. Install: pip install chromadb sentence-transformers")

    try:
        if vector_client is None:
            # Disable ChromaDB telemetry to avoid errors
            os.environ["ANONYMIZED_TELEMETRY"] = "False"
            vector_client = chromadb.Client()
            logger.info("✅ ChromaDB client initialized")

        if embedding_model is None:
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Sentence transformer model loaded")

        return True
    except Exception as e:
        logger.error(f"Failed to initialize vector DB: {e}")
        raise HTTPException(500, f"Vector DB initialization failed: {str(e)}")


def create_record_text(row: pd.Series, key_fields: List[str] = None) -> str:
    """Convert CSV row to text representation for embedding"""
    if key_fields is None:
        # Use all non-null fields
        key_fields = [col for col in row.index if pd.notna(row[col])]

    text_parts = []
    for field in key_fields:
        if field in row.index and pd.notna(row[field]):
            value = str(row[field]).strip()
            if value and value.lower() not in ['nan', 'none', '']:
                # Create more natural text for better semantic matching
                text_parts.append(f"{value}")

    # Join with spaces for better semantic understanding
    result = " ".join(text_parts)

    # Log the text representation for debugging
    if len(text_parts) > 0:
        print(f"DEBUG: Created text representation: '{result}'")

    return result


def safe_json_serialize(obj):
    """Safely serialize objects to JSON-compatible format"""
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif pd.isna(obj):
        return None
    else:
        return str(obj)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize dataframe for better matching"""
    df_normalized = df.copy()

    # Normalize string columns
    for col in df_normalized.select_dtypes(include=['object']).columns:
        df_normalized[col] = (df_normalized[col]
                              .astype(str)
                              .str.strip()
                              .str.upper()
                              .str.replace(r'\s+', ' ', regex=True)
                              .replace('NAN', ''))

    # Normalize numeric columns (round to 2 decimal places)
    for col in df_normalized.select_dtypes(include=[np.number]).columns:
        # Handle potential NaN values
        df_normalized[col] = df_normalized[col].fillna(0).round(2)

    # Convert any remaining object columns that might contain mixed types
    for col in df_normalized.columns:
        if df_normalized[col].dtype == 'object':
            try:
                # Try to convert to numeric if possible
                df_normalized[col] = pd.to_numeric(df_normalized[col], errors='ignore')
            except:
                # Keep as string if conversion fails
                df_normalized[col] = df_normalized[col].astype(str)

    return df_normalized


def get_match_recommendation(similarity: float, diff_count: int) -> str:
    """Get recommendation based on similarity and differences"""
    if similarity >= 0.95 and diff_count == 0:
        return "EXACT_MATCH"
    elif similarity >= 0.90 and diff_count <= 2:
        return "HIGH_CONFIDENCE_MATCH"
    elif similarity >= 0.80 and diff_count <= 5:
        return "PROBABLE_MATCH"
    elif similarity >= 0.70:
        return "POSSIBLE_MATCH"
    else:
        return "LOW_CONFIDENCE"


def calculate_differences(data_a: Dict, data_b: Dict, field_mapping: Dict = None) -> List[str]:
    """Calculate differences between two records"""
    differences = []

    if field_mapping:
        # Use field mapping to compare
        for field_a, field_b in field_mapping.items():
            if field_a in data_a and field_b in data_b:
                val_a = str(data_a[field_a]).strip()
                val_b = str(data_b[field_b]).strip()
                if val_a != val_b and val_a.upper() != val_b.upper():
                    differences.append(f"{field_a}({val_a}) vs {field_b}({val_b})")
    else:
        # Compare all matching field names
        common_fields = set(data_a.keys()) & set(data_b.keys())
        for field in common_fields:
            val_a = str(data_a[field]).strip()
            val_b = str(data_b[field]).strip()
            if val_a != val_b and val_a.upper() != val_b.upper():
                differences.append(f"{field}: {val_a} vs {val_b}")

    return differences


# Routes

@router.get("/health")
async def reconciliation_health_check():
    """Check if reconciliation service is available"""
    try:
        vector_available = initialize_vector_db()
        return {
            "success": True,
            "message": "Reconciliation service is healthy",
            "data": {
                "vector_db_available": vector_available,
                "active_reconciliations": len(reconciliation_results)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Reconciliation service error: {str(e)}",
            "data": {"vector_db_available": False}
        }


@router.post("/basic", response_model=Dict)
async def basic_reconciliation(
        request: ReconciliationRequest,
        background_tasks: BackgroundTasks
):
    """Perform basic vector-based reconciliation between two CSV files"""

    # Initialize vector DB
    initialize_vector_db()

    # Validate files exist
    if request.source_a_file_id not in uploaded_files:
        raise HTTPException(404, f"Source A file not found: {request.source_a_file_id}")

    if request.source_b_file_id not in uploaded_files:
        raise HTTPException(404, f"Source B file not found: {request.source_b_file_id}")

    # Generate reconciliation ID
    recon_id = str(uuid.uuid4())
    recon_name = request.reconciliation_name or f"Reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Start background reconciliation task
    background_tasks.add_task(
        process_basic_reconciliation,
        recon_id,
        request,
        recon_name
    )

    return {
        "success": True,
        "message": "Reconciliation started successfully",
        "data": {
            "reconciliation_id": recon_id,
            "reconciliation_name": recon_name,
            "status": "PROCESSING"
        }
    }


@router.post("/advanced", response_model=Dict)
async def advanced_reconciliation(
        request: AdvancedReconciliationRequest,
        background_tasks: BackgroundTasks
):
    """Perform advanced reconciliation with field mapping and business rules"""

    # Initialize vector DB
    initialize_vector_db()

    # Validate files exist
    if request.source_a_file_id not in uploaded_files:
        raise HTTPException(404, f"Source A file not found: {request.source_a_file_id}")

    if request.source_b_file_id not in uploaded_files:
        raise HTTPException(404, f"Source B file not found: {request.source_b_file_id}")

    # Generate reconciliation ID
    recon_id = str(uuid.uuid4())
    recon_name = f"Advanced_Reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Start background reconciliation task
    background_tasks.add_task(
        process_advanced_reconciliation,
        recon_id,
        request,
        recon_name
    )

    return {
        "success": True,
        "message": "Advanced reconciliation started successfully",
        "data": {
            "reconciliation_id": recon_id,
            "reconciliation_name": recon_name,
            "status": "PROCESSING"
        }
    }


@router.get("/results")
async def list_reconciliation_results():
    """List all reconciliation results"""
    results = []
    for recon_id, result_data in reconciliation_results.items():
        results.append({
            "reconciliation_id": recon_id,
            "reconciliation_name": result_data.get("name"),
            "status": result_data.get("status"),
            "created_at": result_data.get("created_at"),
            "total_matches": result_data.get("summary", {}).get("total_matches", 0),
            "processing_time": result_data.get("summary", {}).get("processing_time_seconds", 0)
        })

    return {
        "success": True,
        "message": f"Retrieved {len(results)} reconciliation results",
        "data": {"reconciliations": results}
    }


@router.get("/results/{reconciliation_id}")
async def get_reconciliation_result(reconciliation_id: str):
    """Get detailed reconciliation results"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_data = reconciliation_results[reconciliation_id]

    return {
        "success": True,
        "message": "Reconciliation result retrieved",
        "data": result_data
    }


@router.get("/results/{reconciliation_id}/matches")
async def get_reconciliation_matches(
        reconciliation_id: str,
        page: int = 1,
        page_size: int = 50,
        recommendation_filter: Optional[str] = None
):
    """Get paginated match details from reconciliation result"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_data = reconciliation_results[reconciliation_id]
    matches = result_data.get("matches", [])

    # Apply recommendation filter
    if recommendation_filter:
        matches = [m for m in matches if m.get("recommendation") == recommendation_filter]

    # Apply pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_matches = matches[start_idx:end_idx]

    return {
        "success": True,
        "message": f"Retrieved {len(paginated_matches)} matches",
        "data": {
            "matches": paginated_matches,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_matches": len(matches),
                "total_pages": (len(matches) + page_size - 1) // page_size
            }
        }
    }


@router.get("/results/{reconciliation_id}/unmatched/{source}")
async def get_unmatched_records(reconciliation_id: str, source: str):
    """Get unmatched records from a specific source"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    if source not in ["source_a", "source_b"]:
        raise HTTPException(400, "Source must be 'source_a' or 'source_b'")

    result_data = reconciliation_results[reconciliation_id]
    unmatched_key = f"unmatched_{source}"
    unmatched_records = result_data.get(unmatched_key, [])

    return {
        "success": True,
        "message": f"Retrieved {len(unmatched_records)} unmatched records from {source}",
        "data": {"unmatched_records": unmatched_records}
    }


@router.delete("/results/{reconciliation_id}")
async def delete_reconciliation_result(reconciliation_id: str):
    """Delete a reconciliation result"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_name = reconciliation_results[reconciliation_id].get("name", "Unknown")
    del reconciliation_results[reconciliation_id]

    return {
        "success": True,
        "message": f"Reconciliation result '{result_name}' deleted successfully"
    }


@router.post("/results/{reconciliation_id}/export")
async def export_reconciliation_results(reconciliation_id: str, export_format: str = "csv"):
    """Export reconciliation results to different formats"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    # This would generate export files - implement based on your needs
    # For now, return the data structure that could be exported

    result_data = reconciliation_results[reconciliation_id]

    if export_format.lower() == "csv":
        # Convert matches to CSV-friendly format
        matches_for_export = []
        for match in result_data.get("matches", []):
            export_row = {
                "Match_ID": match.get("match_id"),
                "Similarity_Score": match.get("similarity_score"),
                "Recommendation": match.get("recommendation"),
                "Differences": "; ".join(match.get("differences", [])),
                "Source_A_ID": match.get("source_a_id"),
                "Source_B_ID": match.get("source_b_id")
            }
            # Add source A data fields
            for key, value in match.get("source_a_data", {}).items():
                export_row[f"SourceA_{key}"] = value
            # Add source B data fields
            for key, value in match.get("source_b_data", {}).items():
                export_row[f"SourceB_{key}"] = value

            matches_for_export.append(export_row)

        return {
            "success": True,
            "message": "Export data prepared",
            "data": {
                "export_format": export_format,
                "matches": matches_for_export,
                "summary": result_data.get("summary"),
                "unmatched_source_a": result_data.get("unmatched_source_a", []),
                "unmatched_source_b": result_data.get("unmatched_source_b", [])
            }
        }

    raise HTTPException(400, "Unsupported export format")


# Background processing functions

async def process_basic_reconciliation(recon_id: str, request: ReconciliationRequest, recon_name: str):
    """Background task for basic reconciliation processing"""
    start_time = time.time()

    try:
        # Initialize result structure
        reconciliation_results[recon_id] = {
            "name": recon_name,
            "status": "PROCESSING",
            "created_at": datetime.utcnow().isoformat(),
            "request": request.dict()
        }

        # Get data
        df_a = uploaded_files[request.source_a_file_id]["data"]
        df_b = uploaded_files[request.source_b_file_id]["data"]

        file_a_name = uploaded_files[request.source_a_file_id]["info"]["filename"]
        file_b_name = uploaded_files[request.source_b_file_id]["info"]["filename"]

        # Normalize data if requested
        if request.normalize_data:
            df_a = normalize_dataframe(df_a)
            df_b = normalize_dataframe(df_b)

        # Create collection for this reconciliation
        collection_name = f"recon_{recon_id}"
        collection = vector_client.get_or_create_collection(name=collection_name)

        # Process source A
        logger.info(f"Processing Source A: {len(df_a)} records")
        embeddings_a = []
        documents_a = []
        metadatas_a = []
        ids_a = []

        # Debug: Check the actual column names
        logger.info(f"Source A columns: {list(df_a.columns)}")
        logger.info(f"Source A key fields requested: {request.source_a_key_fields}")

        for idx, row in df_a.iterrows():
            try:
                text_repr = create_record_text(row, request.source_a_key_fields)
                if not text_repr.strip():  # Skip empty text representations
                    logger.warning(f"Empty text representation for Source A row {idx}")
                    logger.warning(f"Row data: {row.to_dict()}")
                    continue

                embedding = embedding_model.encode(text_repr)

                # Convert row data to JSON string for ChromaDB compatibility
                row_data_json = json.dumps(row.to_dict(), default=safe_json_serialize)

                embeddings_a.append(embedding.tolist())
                documents_a.append(text_repr)
                metadatas_a.append({
                    "source": "source_a",
                    "row_index": int(idx),
                    "row_data_json": row_data_json
                })
                ids_a.append(f"a_{idx}")
            except Exception as e:
                logger.error(f"Error processing Source A row {idx}: {str(e)}")
                continue

        # Process source B
        logger.info(f"Processing Source B: {len(df_b)} records")
        embeddings_b = []
        documents_b = []
        metadatas_b = []
        ids_b = []

        # Debug: Check the actual column names
        logger.info(f"Source B columns: {list(df_b.columns)}")
        logger.info(f"Source B key fields requested: {request.source_b_key_fields}")

        for idx, row in df_b.iterrows():
            try:
                text_repr = create_record_text(row, request.source_b_key_fields)
                if not text_repr.strip():  # Skip empty text representations
                    logger.warning(f"Empty text representation for Source B row {idx}")
                    logger.warning(f"Row data: {row.to_dict()}")
                    continue

                embedding = embedding_model.encode(text_repr)

                # Convert row data to JSON string for ChromaDB compatibility
                row_data_json = json.dumps(row.to_dict(), default=safe_json_serialize)

                embeddings_b.append(embedding.tolist())
                documents_b.append(text_repr)
                metadatas_b.append({
                    "source": "source_b",
                    "row_index": int(idx),
                    "row_data_json": row_data_json
                })
                ids_b.append(f"b_{idx}")
            except Exception as e:
                logger.error(f"Error processing Source B row {idx}: {str(e)}")
                continue

        # Store all embeddings
        try:
            logger.info(f"Storing {len(embeddings_a)} Source A + {len(embeddings_b)} Source B embeddings")

            if not embeddings_a and not embeddings_b:
                raise Exception("No valid embeddings generated from either source")

            collection.add(
                embeddings=embeddings_a + embeddings_b,
                documents=documents_a + documents_b,
                metadatas=metadatas_a + metadatas_b,
                ids=ids_a + ids_b
            )
            logger.info(f"Successfully stored {len(embeddings_a + embeddings_b)} embeddings in ChromaDB")
        except Exception as e:
            logger.error(f"Failed to store embeddings in ChromaDB: {str(e)}")
            # Log a sample metadata for debugging
            if metadatas_a:
                logger.error(f"Sample metadata A: {metadatas_a[0]}")
            if metadatas_b:
                logger.error(f"Sample metadata B: {metadatas_b[0]}")
            raise Exception(f"ChromaDB storage failed: {str(e)}")

        # Find matches
        logger.info("Finding matches...")
        matches = []
        matched_a_ids = set()
        matched_b_ids = set()

        # Debug: Log sample embeddings
        logger.info(f"Sample Source A text: {documents_a[0] if documents_a else 'None'}")
        logger.info(f"Sample Source B text: {documents_b[0] if documents_b else 'None'}")

        for i, (doc_id, document, metadata) in enumerate(zip(ids_a, documents_a, metadatas_a)):
            logger.info(f"Processing Source A record {i + 1}/{len(ids_a)}: {document[:100]}...")

            # Search for similar records in source B
            embedding = embeddings_a[i]

            try:
                similar_records = collection.query(
                    query_embeddings=[embedding],
                    n_results=min(request.max_matches_per_record, len(embeddings_b)),
                    where={"source": "source_b"}
                )

                logger.info(f"Found {len(similar_records['ids'][0])} potential matches")

                for j, (match_id, match_doc, match_meta, distance) in enumerate(zip(
                        similar_records['ids'][0],
                        similar_records['documents'][0],
                        similar_records['metadatas'][0],
                        similar_records['distances'][0]
                )):
                    similarity = 1 - distance
                    logger.info(
                        f"  Match {j + 1}: {match_doc[:50]}... | Similarity: {similarity:.4f} | Threshold: {request.similarity_threshold}")

                    if similarity >= request.similarity_threshold:
                        # Parse JSON strings back to dictionaries
                        source_a_data = json.loads(metadata['row_data_json'])
                        source_b_data = json.loads(match_meta['row_data_json'])

                        differences = calculate_differences(source_a_data, source_b_data)

                        recommendation = get_match_recommendation(similarity, len(differences))

                        match_info = {
                            "match_id": f"M_{len(matches) + 1:04d}",
                            "source_a_id": doc_id,
                            "source_b_id": match_id,
                            "similarity_score": round(similarity, 4),
                            "match_rank": j + 1,
                            "recommendation": recommendation,
                            "differences": differences,
                            "source_a_data": source_a_data,
                            "source_b_data": source_b_data
                        }

                        matches.append(match_info)
                        matched_a_ids.add(doc_id)
                        matched_b_ids.add(match_id)

                        logger.info(f"  ✅ MATCH FOUND: {recommendation} (similarity: {similarity:.4f})")
                    else:
                        logger.info(f"  ❌ Below threshold: {similarity:.4f} < {request.similarity_threshold}")

            except Exception as e:
                logger.error(f"Error searching for matches for record {doc_id}: {str(e)}")
                continue

        # Calculate unmatched records
        unmatched_a = []
        for i, (doc_id, metadata) in enumerate(zip(ids_a, metadatas_a)):
            if doc_id not in matched_a_ids:
                source_a_data = json.loads(metadata['row_data_json'])
                unmatched_a.append(source_a_data)

        unmatched_b = []
        for i, (doc_id, metadata) in enumerate(zip(ids_b, metadatas_b)):
            if doc_id not in matched_b_ids:
                source_b_data = json.loads(metadata['row_data_json'])
                unmatched_b.append(source_b_data)

        # Calculate summary statistics
        recommendation_counts = {}
        for match in matches:
            rec = match['recommendation']
            recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1

        processing_time = time.time() - start_time

        # Store final results
        reconciliation_results[recon_id].update({
            "status": "COMPLETED",
            "summary": {
                "reconciliation_id": recon_id,
                "reconciliation_name": recon_name,
                "source_a_file": file_a_name,
                "source_b_file": file_b_name,
                "total_matches": len(matches),
                "high_confidence_matches": recommendation_counts.get("HIGH_CONFIDENCE_MATCH", 0),
                "probable_matches": recommendation_counts.get("PROBABLE_MATCH", 0),
                "possible_matches": recommendation_counts.get("POSSIBLE_MATCH", 0),
                "low_confidence_matches": recommendation_counts.get("LOW_CONFIDENCE", 0),
                "exact_matches": recommendation_counts.get("EXACT_MATCH", 0),
                "source_a_total": len(df_a),
                "source_a_matched": len(matched_a_ids),
                "source_a_unmatched": len(unmatched_a),
                "source_b_total": len(df_b),
                "source_b_matched": len(matched_b_ids),
                "source_b_unmatched": len(unmatched_b),
                "processing_time_seconds": round(processing_time, 2),
                "similarity_threshold": request.similarity_threshold
            },
            "matches": matches,
            "unmatched_source_a": unmatched_a,
            "unmatched_source_b": unmatched_b
        })

        logger.info(f"Reconciliation {recon_id} completed successfully")

        # Clean up temporary collection
        try:
            # Check if collection exists before trying to delete
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
                logger.info(f"Cleaned up temporary collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to clean up collection {collection_name}: {str(e)}")

    except Exception as e:
        logger.error(f"Reconciliation {recon_id} failed: {str(e)}")

        # Clean up temporary collection on error
        try:
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
        except:
            pass

        reconciliation_results[recon_id].update({
            "status": "FAILED",
            "error": str(e),
            "processing_time_seconds": time.time() - start_time
        })


async def process_advanced_reconciliation(recon_id: str, request: AdvancedReconciliationRequest, recon_name: str):
    """Background task for advanced reconciliation processing"""
    start_time = time.time()

    try:
        # Initialize result structure
        reconciliation_results[recon_id] = {
            "name": recon_name,
            "status": "PROCESSING",
            "created_at": datetime.utcnow().isoformat(),
            "request": request.dict()
        }

        # Get data
        df_a = uploaded_files[request.source_a_file_id]["data"]
        df_b = uploaded_files[request.source_b_file_id]["data"]

        file_a_name = uploaded_files[request.source_a_file_id]["info"]["filename"]
        file_b_name = uploaded_files[request.source_b_file_id]["info"]["filename"]

        logger.info(f"Advanced reconciliation started for {file_a_name} vs {file_b_name}")
        logger.info(f"Field mapping: {request.field_mapping}")
        logger.info(f"Matching strategy: {request.matching_strategy}")
        logger.info(f"Tolerance settings: {request.tolerance_settings}")

        # Apply field mapping to create normalized datasets
        df_a_mapped, df_b_mapped = apply_field_mapping(df_a, df_b, request.field_mapping)

        # Apply business rules
        if request.business_rules:
            df_a_mapped = apply_business_rules(df_a_mapped, request.business_rules, "source_a")
            df_b_mapped = apply_business_rules(df_b_mapped, request.business_rules, "source_b")

        # Normalize data
        df_a_mapped = normalize_dataframe(df_a_mapped)
        df_b_mapped = normalize_dataframe(df_b_mapped)

        # Create collection for this reconciliation
        collection_name = f"adv_recon_{recon_id}"
        collection = vector_client.get_or_create_collection(name=collection_name)

        # Generate embeddings using mapped fields
        embeddings_a, documents_a, metadatas_a, ids_a = generate_advanced_embeddings(
            df_a_mapped, df_a, "source_a", request.matching_strategy
        )

        embeddings_b, documents_b, metadatas_b, ids_b = generate_advanced_embeddings(
            df_b_mapped, df_b, "source_b", request.matching_strategy
        )

        # Store embeddings
        collection.add(
            embeddings=embeddings_a + embeddings_b,
            documents=documents_a + documents_b,
            metadatas=metadatas_a + metadatas_b,
            ids=ids_a + ids_b
        )

        # Advanced matching with tolerance and business rules
        matches = perform_advanced_matching(
            collection, embeddings_a, metadatas_a, ids_a,
            request.similarity_threshold, request.tolerance_settings,
            request.field_mapping, request.max_matches_per_record or 3
        )

        # Calculate unmatched records
        matched_a_ids = {match['source_a_id'] for match in matches}
        matched_b_ids = {match['source_b_id'] for match in matches}

        unmatched_a = []
        for i, metadata in enumerate(metadatas_a):
            if ids_a[i] not in matched_a_ids:
                source_a_data = json.loads(metadata['row_data_json'])
                unmatched_a.append(source_a_data)

        unmatched_b = []
        for i, metadata in enumerate(metadatas_b):
            if ids_b[i] not in matched_b_ids:
                source_b_data = json.loads(metadata['row_data_json'])
                unmatched_b.append(source_b_data)

        # Calculate summary statistics
        recommendation_counts = {}
        for match in matches:
            rec = match['recommendation']
            recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1

        processing_time = time.time() - start_time

        # Store final results
        reconciliation_results[recon_id].update({
            "status": "COMPLETED",
            "summary": {
                "reconciliation_id": recon_id,
                "reconciliation_name": recon_name,
                "source_a_file": file_a_name,
                "source_b_file": file_b_name,
                "total_matches": len(matches),
                "high_confidence_matches": recommendation_counts.get("HIGH_CONFIDENCE_MATCH", 0),
                "probable_matches": recommendation_counts.get("PROBABLE_MATCH", 0),
                "possible_matches": recommendation_counts.get("POSSIBLE_MATCH", 0),
                "low_confidence_matches": recommendation_counts.get("LOW_CONFIDENCE", 0),
                "exact_matches": recommendation_counts.get("EXACT_MATCH", 0),
                "source_a_total": len(df_a),
                "source_a_matched": len(matched_a_ids),
                "source_a_unmatched": len(unmatched_a),
                "source_b_total": len(df_b),
                "source_b_matched": len(matched_b_ids),
                "source_b_unmatched": len(unmatched_b),
                "processing_time_seconds": round(processing_time, 2),
                "similarity_threshold": request.similarity_threshold,
                "matching_strategy": request.matching_strategy,
                "field_mapping_applied": request.field_mapping,
                "business_rules_applied": request.business_rules or [],
                "tolerance_settings": request.tolerance_settings or {}
            },
            "matches": matches,
            "unmatched_source_a": unmatched_a,
            "unmatched_source_b": unmatched_b
        })

        # Clean up temporary collection
        try:
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
                logger.info(f"Cleaned up temporary collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to clean up collection {collection_name}: {str(e)}")

        logger.info(f"Advanced reconciliation {recon_id} completed successfully")

    except Exception as e:
        logger.error(f"Advanced reconciliation {recon_id} failed: {str(e)}")

        # Clean up temporary collection on error
        try:
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
        except:
            pass

        reconciliation_results[recon_id].update({
            "status": "FAILED",
            "error": str(e),
            "processing_time_seconds": time.time() - start_time
        })


def apply_field_mapping(df_a: pd.DataFrame, df_b: pd.DataFrame, field_mapping: Dict[str, str]) -> tuple:
    """Apply field mapping to create normalized column structure"""

    # Create mapped versions of the dataframes
    df_a_mapped = df_a.copy()
    df_b_mapped = df_b.copy()

    # Rename columns in df_b according to mapping
    reverse_mapping = {v: k for k, v in field_mapping.items()}
    df_b_mapped = df_b_mapped.rename(columns=reverse_mapping)

    # Ensure both dataframes have the same columns for comparison
    common_columns = set(df_a_mapped.columns) & set(df_b_mapped.columns)

    if common_columns:
        df_a_mapped = df_a_mapped[list(common_columns)]
        df_b_mapped = df_b_mapped[list(common_columns)]

    logger.info(f"Field mapping applied. Common columns: {list(common_columns)}")
    return df_a_mapped, df_b_mapped


def apply_business_rules(df: pd.DataFrame, business_rules: List[str], source: str) -> pd.DataFrame:
    """Apply business rules to the dataframe"""
    df_processed = df.copy()

    for rule in business_rules:
        if rule == "exclude_cancelled_trades":
            if 'Status' in df_processed.columns:
                df_processed = df_processed[df_processed['Status'] != 'CANCELLED']
                logger.info(f"Applied rule '{rule}' to {source}: excluded cancelled trades")

        elif rule == "normalize_counterparty_names":
            if 'Counterparty' in df_processed.columns:
                # Normalize common bank name variations
                name_mapping = {
                    'GOLDMAN SACHS': 'GOLDMAN_SACHS_GROUP',
                    'GOLDMAN SACHS INTERNATIONAL': 'GOLDMAN_SACHS_GROUP',
                    'GOLDMAN SACHS & CO': 'GOLDMAN_SACHS_GROUP',
                    'JP MORGAN': 'JPMORGAN_CHASE',
                    'JPMORGAN CHASE & CO': 'JPMORGAN_CHASE',
                    'JP MORGAN SECURITIES': 'JPMORGAN_CHASE',
                    'MORGAN STANLEY': 'MORGAN_STANLEY',
                    'MORGAN STANLEY & CO LLC': 'MORGAN_STANLEY',
                    'CITIGROUP': 'CITIGROUP',
                    'CITIGROUP GLOBAL MARKETS': 'CITIGROUP',
                    'CITI GLOBAL MARKETS': 'CITIGROUP'
                }

                for original, normalized in name_mapping.items():
                    df_processed.loc[df_processed['Counterparty'].str.contains(original, case=False,
                                                                               na=False), 'Counterparty'] = normalized

                logger.info(f"Applied rule '{rule}' to {source}: normalized counterparty names")

        elif rule == "handle_side_terminology":
            if 'Side' in df_processed.columns:
                # Normalize BUY/SELL vs PURCHASE/SALE
                df_processed.loc[df_processed['Side'].str.upper() == 'PURCHASE', 'Side'] = 'BUY'
                df_processed.loc[df_processed['Side'].str.upper() == 'SALE', 'Side'] = 'SELL'
                logger.info(f"Applied rule '{rule}' to {source}: normalized side terminology")

        elif rule == "match_same_day_only":
            # This would be applied during matching, not data preprocessing
            logger.info(f"Rule '{rule}' will be applied during matching phase")

    return df_processed


def generate_advanced_embeddings(df_mapped: pd.DataFrame, df_original: pd.DataFrame, source: str,
                                 strategy: str) -> tuple:
    """Generate embeddings using advanced strategies"""

    embeddings = []
    documents = []
    metadatas = []
    ids = []

    for idx, (mapped_row, original_row) in enumerate(zip(df_mapped.iterrows(), df_original.iterrows())):
        mapped_row = mapped_row[1]  # Get the actual row data
        original_row = original_row[1]

        try:
            if strategy == "semantic":
                # Create semantic text representation
                text_repr = create_semantic_text(mapped_row)
            elif strategy == "exact":
                # Create exact matching text
                text_repr = create_exact_text(mapped_row)
            elif strategy == "fuzzy":
                # Create fuzzy matching text
                text_repr = create_fuzzy_text(mapped_row)
            else:
                # Default semantic
                text_repr = create_semantic_text(mapped_row)

            if not text_repr.strip():
                logger.warning(f"Empty text representation for {source} row {idx}")
                continue

            embedding = embedding_model.encode(text_repr)
            row_data_json = json.dumps(original_row.to_dict(), default=safe_json_serialize)

            embeddings.append(embedding.tolist())
            documents.append(text_repr)
            metadatas.append({
                "source": source,
                "row_index": int(idx),
                "row_data_json": row_data_json,
                "strategy": strategy
            })
            ids.append(f"{source[7]}_{idx}")  # source_a -> a, source_b -> b

        except Exception as e:
            logger.error(f"Error generating embedding for {source} row {idx}: {str(e)}")
            continue

    logger.info(f"Generated {len(embeddings)} embeddings for {source} using {strategy} strategy")
    return embeddings, documents, metadatas, ids


def create_semantic_text(row: pd.Series) -> str:
    """Create semantic text optimized for meaning-based matching"""
    important_fields = []

    # Prioritize fields that carry semantic meaning
    for field, value in row.items():
        if pd.notna(value) and str(value).strip():
            value_str = str(value).strip()
            if field.lower() in ['counterparty', 'bank', 'client', 'customer', 'company']:
                important_fields.append(f"entity {value_str}")
            elif field.lower() in ['instrument', 'security', 'product', 'item']:
                important_fields.append(f"instrument {value_str}")
            elif field.lower() in ['side', 'direction', 'type']:
                important_fields.append(f"action {value_str}")
            elif field.lower() in ['quantity', 'shares', 'amount', 'volume']:
                important_fields.append(f"quantity {value_str}")
            elif field.lower() in ['price', 'unit_price', 'cost']:
                important_fields.append(f"price {value_str}")
            else:
                important_fields.append(value_str)

    return " ".join(important_fields)


def create_exact_text(row: pd.Series) -> str:
    """Create text for exact matching"""
    values = [str(val).strip().upper() for val in row.values if pd.notna(val) and str(val).strip()]
    return " ".join(values)


def create_fuzzy_text(row: pd.Series) -> str:
    """Create text optimized for fuzzy matching"""
    # Similar to semantic but with less structure
    values = [str(val).strip() for val in row.values if pd.notna(val) and str(val).strip()]
    return " ".join(values)


def perform_advanced_matching(collection, embeddings_a, metadatas_a, ids_a,
                              similarity_threshold, tolerance_settings, field_mapping, max_matches):
    """Perform advanced matching with tolerance and business rules"""

    matches = []

    for i, (embedding, metadata, doc_id) in enumerate(zip(embeddings_a, metadatas_a, ids_a)):
        try:
            # Search for similar records in source B
            similar_records = collection.query(
                query_embeddings=[embedding],
                n_results=max_matches,
                where={"source": "source_b"}
            )

            source_a_data = json.loads(metadata['row_data_json'])

            for j, (match_id, match_doc, match_meta, distance) in enumerate(zip(
                    similar_records['ids'][0],
                    similar_records['documents'][0],
                    similar_records['metadatas'][0],
                    similar_records['distances'][0]
            )):
                similarity = 1 - distance

                if similarity >= similarity_threshold:
                    source_b_data = json.loads(match_meta['row_data_json'])

                    # Apply tolerance-based matching
                    tolerance_passed, tolerance_details = check_tolerance_match(
                        source_a_data, source_b_data, tolerance_settings, field_mapping
                    )

                    if tolerance_passed:
                        # Calculate differences with tolerance awareness
                        differences = calculate_advanced_differences(
                            source_a_data, source_b_data, field_mapping, tolerance_settings
                        )

                        # Advanced recommendation based on tolerance and business rules
                        recommendation = get_advanced_recommendation(
                            similarity, len(differences), tolerance_details
                        )

                        match_info = {
                            "match_id": f"ADV_M_{len(matches) + 1:04d}",
                            "source_a_id": doc_id,
                            "source_b_id": match_id,
                            "similarity_score": round(similarity, 4),
                            "match_rank": j + 1,
                            "recommendation": recommendation,
                            "differences": differences,
                            "tolerance_details": tolerance_details,
                            "source_a_data": source_a_data,
                            "source_b_data": source_b_data
                        }

                        matches.append(match_info)

                        logger.info(f"Advanced match found: {doc_id} -> {match_id} (similarity: {similarity:.4f})")

        except Exception as e:
            logger.error(f"Error in advanced matching for record {doc_id}: {str(e)}")
            continue

    return matches


def check_tolerance_match(source_a_data: Dict, source_b_data: Dict,
                          tolerance_settings: Dict, field_mapping: Dict) -> tuple:
    """Check if records match within specified tolerances"""

    if not tolerance_settings:
        return True, {}

    tolerance_details = {}
    tolerance_passed = True

    # Check price tolerance
    if "price_tolerance" in tolerance_settings:
        price_fields_a = find_fields_by_type(source_a_data, ['price', 'unit_price', 'cost'])
        price_fields_b = find_fields_by_type(source_b_data, ['price', 'unit_price', 'cost'])

        for field_a in price_fields_a:
            # Find corresponding field in source B
            field_b = field_mapping.get(field_a, field_a)

            if field_b in price_fields_b:
                price_a = float(source_a_data.get(field_a, 0))
                price_b = float(source_b_data.get(field_b, 0))

                if price_a > 0 and price_b > 0:  # Only check if both prices exist
                    price_diff_pct = abs(price_a - price_b) / max(price_a, price_b)
                    tolerance = tolerance_settings["price_tolerance"]

                    price_within_tolerance = price_diff_pct <= tolerance
                    tolerance_details[f"price_{field_a}"] = {
                        "source_a_value": price_a,
                        "source_b_value": price_b,
                        "difference_pct": round(price_diff_pct, 4),
                        "tolerance": tolerance,
                        "within_tolerance": price_within_tolerance
                    }

                    if not price_within_tolerance:
                        tolerance_passed = False

    # Check amount tolerance
    if "amount_tolerance" in tolerance_settings:
        amount_fields_a = find_fields_by_type(source_a_data, ['amount', 'total', 'notional'])
        amount_fields_b = find_fields_by_type(source_b_data, ['amount', 'total', 'notional'])

        for field_a in amount_fields_a:
            field_b = field_mapping.get(field_a, field_a)

            if field_b in amount_fields_b:
                amount_a = float(source_a_data.get(field_a, 0))
                amount_b = float(source_b_data.get(field_b, 0))

                if amount_a > 0 and amount_b > 0:
                    amount_diff = abs(amount_a - amount_b)
                    tolerance = tolerance_settings["amount_tolerance"]

                    amount_within_tolerance = amount_diff <= tolerance
                    tolerance_details[f"amount_{field_a}"] = {
                        "source_a_value": amount_a,
                        "source_b_value": amount_b,
                        "difference": round(amount_diff, 2),
                        "tolerance": tolerance,
                        "within_tolerance": amount_within_tolerance
                    }

                    if not amount_within_tolerance:
                        tolerance_passed = False

    # Check date tolerance
    if "date_tolerance" in tolerance_settings:
        date_fields_a = find_fields_by_type(source_a_data, ['date', 'time'])
        date_fields_b = find_fields_by_type(source_b_data, ['date', 'time'])

        for field_a in date_fields_a:
            field_b = field_mapping.get(field_a, field_a)

            if field_b in date_fields_b:
                try:
                    date_a = pd.to_datetime(source_a_data.get(field_a))
                    date_b = pd.to_datetime(source_b_data.get(field_b))

                    date_diff_days = abs((date_a - date_b).days)
                    tolerance = tolerance_settings["date_tolerance"]

                    date_within_tolerance = date_diff_days <= tolerance
                    tolerance_details[f"date_{field_a}"] = {
                        "source_a_value": date_a.strftime('%Y-%m-%d'),
                        "source_b_value": date_b.strftime('%Y-%m-%d'),
                        "difference_days": date_diff_days,
                        "tolerance": tolerance,
                        "within_tolerance": date_within_tolerance
                    }

                    if not date_within_tolerance:
                        tolerance_passed = False

                except Exception as e:
                    logger.warning(f"Error parsing dates for tolerance check: {str(e)}")

    return tolerance_passed, tolerance_details


def find_fields_by_type(data: Dict, field_types: List[str]) -> List[str]:
    """Find fields in data that match certain types based on field names"""
    matching_fields = []

    for field_name in data.keys():
        field_lower = field_name.lower()
        for field_type in field_types:
            if field_type in field_lower:
                matching_fields.append(field_name)
                break

    return matching_fields


def calculate_advanced_differences(source_a_data: Dict, source_b_data: Dict,
                                   field_mapping: Dict, tolerance_settings: Dict) -> List[str]:
    """Calculate differences with tolerance awareness"""
    differences = []

    # Check mapped fields
    for field_a, field_b in field_mapping.items():
        if field_a in source_a_data and field_b in source_b_data:
            val_a = source_a_data[field_a]
            val_b = source_b_data[field_b]

            # Skip if both values are essentially the same
            if str(val_a).strip().upper() == str(val_b).strip().upper():
                continue

            # Check if this is a numeric field with tolerance
            if is_numeric_field(field_a) and tolerance_settings:
                tolerance_key = get_tolerance_key(field_a)
                if tolerance_key in tolerance_settings:
                    try:
                        num_a = float(val_a)
                        num_b = float(val_b)
                        tolerance = tolerance_settings[tolerance_key]

                        if tolerance_key == "price_tolerance":
                            diff_pct = abs(num_a - num_b) / max(num_a, num_b)
                            if diff_pct <= tolerance:
                                differences.append(
                                    f"{field_a}: {val_a} vs {val_b} (within {tolerance * 100}% tolerance)")
                                continue
                        elif tolerance_key == "amount_tolerance":
                            diff_abs = abs(num_a - num_b)
                            if diff_abs <= tolerance:
                                differences.append(f"{field_a}: {val_a} vs {val_b} (within ${tolerance} tolerance)")
                                continue
                    except (ValueError, TypeError):
                        pass

            # Regular difference (outside tolerance or non-numeric)
            differences.append(f"{field_a}({val_a}) vs {field_b}({val_b})")

    return differences


def is_numeric_field(field_name: str) -> bool:
    """Check if field name indicates a numeric field"""
    numeric_indicators = ['price', 'amount', 'cost', 'value', 'total', 'quantity', 'shares']
    field_lower = field_name.lower()
    return any(indicator in field_lower for indicator in numeric_indicators)


def get_tolerance_key(field_name: str) -> str:
    """Get the appropriate tolerance key for a field"""
    field_lower = field_name.lower()

    if any(indicator in field_lower for indicator in ['price', 'unit_price', 'cost']):
        return "price_tolerance"
    elif any(indicator in field_lower for indicator in ['amount', 'total', 'notional', 'value']):
        return "amount_tolerance"
    elif any(indicator in field_lower for indicator in ['quantity', 'shares', 'volume']):
        return "quantity_tolerance"
    elif any(indicator in field_lower for indicator in ['date', 'time']):
        return "date_tolerance"

    return "general_tolerance"


def get_advanced_recommendation(similarity: float, diff_count: int, tolerance_details: Dict) -> str:
    """Get advanced recommendation based on similarity, differences, and tolerance checks"""

    # Count tolerance passes
    tolerance_passes = sum(1 for details in tolerance_details.values()
                           if details.get('within_tolerance', True))
    total_tolerance_checks = len(tolerance_details)

    # High similarity with all tolerances passed
    if similarity >= 0.95 and diff_count == 0:
        return "EXACT_MATCH"
    elif similarity >= 0.95 and tolerance_passes == total_tolerance_checks:
        return "EXACT_MATCH_WITH_TOLERANCE"
    elif similarity >= 0.90 and tolerance_passes >= total_tolerance_checks * 0.8:
        return "HIGH_CONFIDENCE_MATCH"
    elif similarity >= 0.85 and tolerance_passes >= total_tolerance_checks * 0.7:
        return "PROBABLE_MATCH"
    elif similarity >= 0.75 and tolerance_passes >= total_tolerance_checks * 0.6:
        return "POSSIBLE_MATCH"
    elif similarity >= 0.65:
        return "LOW_CONFIDENCE_MATCH"
    else:
        return "POOR_MATCH"


@router.post("/debug/test-advanced-functions")
async def test_advanced_functions():
    """Debug endpoint to test advanced reconciliation functions"""
    try:
        # Test the helper functions
        sample_data_a = {
            "Counterparty": "Goldman Sachs",
            "Instrument": "AAPL",
            "Side": "BUY",
            "Price": 150.25,
            "Notional_Value": 150250.00
        }

        sample_data_b = {
            "Bank": "Goldman Sachs International",
            "Security": "AAPL",
            "Direction": "PURCHASE",
            "Unit_Price": 150.27,
            "Total_Amount": 150270.00
        }

        field_mapping = {
            "Counterparty": "Bank",
            "Instrument": "Security",
            "Side": "Direction",
            "Price": "Unit_Price",
            "Notional_Value": "Total_Amount"
        }

        tolerance_settings = {
            "price_tolerance": 0.05,
            "amount_tolerance": 1000.0
        }

        # Test tolerance checking
        tolerance_passed, tolerance_details = check_tolerance_match(
            sample_data_a, sample_data_b, tolerance_settings, field_mapping
        )

        # Test advanced differences
        differences = calculate_advanced_differences(
            sample_data_a, sample_data_b, field_mapping, tolerance_settings
        )

        # Test recommendation
        recommendation = get_advanced_recommendation(0.95, len(differences), tolerance_details)

        return {
            "success": True,
            "data": {
                "sample_data_a": sample_data_a,
                "sample_data_b": sample_data_b,
                "field_mapping": field_mapping,
                "tolerance_settings": tolerance_settings,
                "tolerance_passed": tolerance_passed,
                "tolerance_details": tolerance_details,
                "differences": differences,
                "recommendation": recommendation,
                "functions_working": True
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "functions_working": False
        }


# Add this at the end of the file to ensure all functions are complete
# backend/app/routes/reconciliation_routes.py - Advanced Vector DB Reconciliation
import logging
import os
import uuid
import asyncio
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.storage_service import uploaded_files

# Vector DB imports (add these to requirements.txt)
try:
    import chromadb
    from sentence_transformers import SentenceTransformer

    VECTOR_DB_AVAILABLE = True
except ImportError:
    VECTOR_DB_AVAILABLE = False
    logging.warning("Vector DB dependencies not installed. Install: pip install chromadb sentence-transformers")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])

# Global vector DB components
vector_client = None
embedding_model = None
reconciliation_results = {}  # Store reconciliation results in memory


# Pydantic models
class ReconciliationRequest(BaseModel):
    source_a_file_id: str
    source_b_file_id: str
    source_a_key_fields: Optional[List[str]] = None
    source_b_key_fields: Optional[List[str]] = None
    similarity_threshold: float = 0.8
    max_matches_per_record: int = 3
    normalize_data: bool = True
    reconciliation_name: Optional[str] = None


class AdvancedReconciliationRequest(BaseModel):
    source_a_file_id: str
    source_b_file_id: str
    field_mapping: Dict[str, str]  # Map source_a fields to source_b fields
    matching_strategy: str = "semantic"  # "exact", "fuzzy", "semantic"
    similarity_threshold: float = 0.8
    tolerance_settings: Optional[Dict[str, float]] = None  # Price tolerance, date tolerance
    business_rules: Optional[List[str]] = None


class ReconciliationResult(BaseModel):
    reconciliation_id: str
    reconciliation_name: str
    source_a_file: str
    source_b_file: str
    total_matches: int
    high_confidence_matches: int
    probable_matches: int
    possible_matches: int
    low_confidence_matches: int
    source_a_total: int
    source_a_matched: int
    source_a_unmatched: int
    source_b_total: int
    source_b_matched: int
    source_b_unmatched: int
    processing_time_seconds: float
    created_at: str
    status: str


class MatchDetail(BaseModel):
    match_id: str
    source_a_id: str
    source_b_id: str
    similarity_score: float
    match_rank: int
    recommendation: str
    differences: List[str]
    source_a_data: Dict
    source_b_data: Dict


# Vector DB utility functions
def initialize_vector_db():
    """Initialize vector database and embedding model"""
    global vector_client, embedding_model

    if not VECTOR_DB_AVAILABLE:
        raise HTTPException(500,
                            "Vector DB dependencies not installed. Install: pip install chromadb sentence-transformers")

    try:
        if vector_client is None:
            # Disable ChromaDB telemetry to avoid errors
            os.environ["ANONYMIZED_TELEMETRY"] = "False"
            vector_client = chromadb.Client()
            logger.info("✅ ChromaDB client initialized")

        if embedding_model is None:
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Sentence transformer model loaded")

        return True
    except Exception as e:
        logger.error(f"Failed to initialize vector DB: {e}")
        raise HTTPException(500, f"Vector DB initialization failed: {str(e)}")


def create_record_text(row: pd.Series, key_fields: List[str] = None) -> str:
    """Convert CSV row to text representation for embedding"""
    if key_fields is None:
        # Use all non-null fields
        key_fields = [col for col in row.index if pd.notna(row[col])]

    text_parts = []
    for field in key_fields:
        if field in row.index and pd.notna(row[field]):
            value = str(row[field]).strip()
            if value and value.lower() not in ['nan', 'none', '']:
                # Create more natural text for better semantic matching
                text_parts.append(f"{value}")

    # Join with spaces for better semantic understanding
    result = " ".join(text_parts)

    # Log the text representation for debugging
    if len(text_parts) > 0:
        print(f"DEBUG: Created text representation: '{result}'")

    return result


def safe_json_serialize(obj):
    """Safely serialize objects to JSON-compatible format"""
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif pd.isna(obj):
        return None
    else:
        return str(obj)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize dataframe for better matching"""
    df_normalized = df.copy()

    # Normalize string columns
    for col in df_normalized.select_dtypes(include=['object']).columns:
        df_normalized[col] = (df_normalized[col]
                              .astype(str)
                              .str.strip()
                              .str.upper()
                              .str.replace(r'\s+', ' ', regex=True)
                              .replace('NAN', ''))

    # Normalize numeric columns (round to 2 decimal places)
    for col in df_normalized.select_dtypes(include=[np.number]).columns:
        # Handle potential NaN values
        df_normalized[col] = df_normalized[col].fillna(0).round(2)

    # Convert any remaining object columns that might contain mixed types
    for col in df_normalized.columns:
        if df_normalized[col].dtype == 'object':
            try:
                # Try to convert to numeric if possible
                df_normalized[col] = pd.to_numeric(df_normalized[col], errors='ignore')
            except:
                # Keep as string if conversion fails
                df_normalized[col] = df_normalized[col].astype(str)

    return df_normalized


def get_match_recommendation(similarity: float, diff_count: int) -> str:
    """Get recommendation based on similarity and differences"""
    if similarity >= 0.95 and diff_count == 0:
        return "EXACT_MATCH"
    elif similarity >= 0.90 and diff_count <= 2:
        return "HIGH_CONFIDENCE_MATCH"
    elif similarity >= 0.80 and diff_count <= 5:
        return "PROBABLE_MATCH"
    elif similarity >= 0.70:
        return "POSSIBLE_MATCH"
    else:
        return "LOW_CONFIDENCE"


def calculate_differences(data_a: Dict, data_b: Dict, field_mapping: Dict = None) -> List[str]:
    """Calculate differences between two records"""
    differences = []

    if field_mapping:
        # Use field mapping to compare
        for field_a, field_b in field_mapping.items():
            if field_a in data_a and field_b in data_b:
                val_a = str(data_a[field_a]).strip()
                val_b = str(data_b[field_b]).strip()
                if val_a != val_b and val_a.upper() != val_b.upper():
                    differences.append(f"{field_a}({val_a}) vs {field_b}({val_b})")
    else:
        # Compare all matching field names
        common_fields = set(data_a.keys()) & set(data_b.keys())
        for field in common_fields:
            val_a = str(data_a[field]).strip()
            val_b = str(data_b[field]).strip()
            if val_a != val_b and val_a.upper() != val_b.upper():
                differences.append(f"{field}: {val_a} vs {val_b}")

    return differences


# Routes

@router.get("/health")
async def reconciliation_health_check():
    """Check if reconciliation service is available"""
    try:
        vector_available = initialize_vector_db()
        return {
            "success": True,
            "message": "Reconciliation service is healthy",
            "data": {
                "vector_db_available": vector_available,
                "active_reconciliations": len(reconciliation_results)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Reconciliation service error: {str(e)}",
            "data": {"vector_db_available": False}
        }


@router.post("/basic", response_model=Dict)
async def basic_reconciliation(
        request: ReconciliationRequest,
        background_tasks: BackgroundTasks
):
    """Perform basic vector-based reconciliation between two CSV files"""

    # Initialize vector DB
    initialize_vector_db()

    # Validate files exist
    if request.source_a_file_id not in uploaded_files:
        raise HTTPException(404, f"Source A file not found: {request.source_a_file_id}")

    if request.source_b_file_id not in uploaded_files:
        raise HTTPException(404, f"Source B file not found: {request.source_b_file_id}")

    # Generate reconciliation ID
    recon_id = str(uuid.uuid4())
    recon_name = request.reconciliation_name or f"Reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Start background reconciliation task
    background_tasks.add_task(
        process_basic_reconciliation,
        recon_id,
        request,
        recon_name
    )

    return {
        "success": True,
        "message": "Reconciliation started successfully",
        "data": {
            "reconciliation_id": recon_id,
            "reconciliation_name": recon_name,
            "status": "PROCESSING"
        }
    }


@router.post("/advanced", response_model=Dict)
async def advanced_reconciliation(
        request: AdvancedReconciliationRequest,
        background_tasks: BackgroundTasks
):
    """Perform advanced reconciliation with field mapping and business rules"""

    # Initialize vector DB
    initialize_vector_db()

    # Validate files exist
    if request.source_a_file_id not in uploaded_files:
        raise HTTPException(404, f"Source A file not found: {request.source_a_file_id}")

    if request.source_b_file_id not in uploaded_files:
        raise HTTPException(404, f"Source B file not found: {request.source_b_file_id}")

    # Generate reconciliation ID
    recon_id = str(uuid.uuid4())
    recon_name = f"Advanced_Reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Start background reconciliation task
    background_tasks.add_task(
        process_advanced_reconciliation,
        recon_id,
        request,
        recon_name
    )

    return {
        "success": True,
        "message": "Advanced reconciliation started successfully",
        "data": {
            "reconciliation_id": recon_id,
            "reconciliation_name": recon_name,
            "status": "PROCESSING"
        }
    }


@router.get("/results")
async def list_reconciliation_results():
    """List all reconciliation results"""
    results = []
    for recon_id, result_data in reconciliation_results.items():
        results.append({
            "reconciliation_id": recon_id,
            "reconciliation_name": result_data.get("name"),
            "status": result_data.get("status"),
            "created_at": result_data.get("created_at"),
            "total_matches": result_data.get("summary", {}).get("total_matches", 0),
            "processing_time": result_data.get("summary", {}).get("processing_time_seconds", 0)
        })

    return {
        "success": True,
        "message": f"Retrieved {len(results)} reconciliation results",
        "data": {"reconciliations": results}
    }


@router.get("/results/{reconciliation_id}")
async def get_reconciliation_result(reconciliation_id: str):
    """Get detailed reconciliation results"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_data = reconciliation_results[reconciliation_id]

    return {
        "success": True,
        "message": "Reconciliation result retrieved",
        "data": result_data
    }


@router.get("/results/{reconciliation_id}/matches")
async def get_reconciliation_matches(
        reconciliation_id: str,
        page: int = 1,
        page_size: int = 50,
        recommendation_filter: Optional[str] = None
):
    """Get paginated match details from reconciliation result"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_data = reconciliation_results[reconciliation_id]
    matches = result_data.get("matches", [])

    # Apply recommendation filter
    if recommendation_filter:
        matches = [m for m in matches if m.get("recommendation") == recommendation_filter]

    # Apply pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_matches = matches[start_idx:end_idx]

    return {
        "success": True,
        "message": f"Retrieved {len(paginated_matches)} matches",
        "data": {
            "matches": paginated_matches,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_matches": len(matches),
                "total_pages": (len(matches) + page_size - 1) // page_size
            }
        }
    }


@router.get("/results/{reconciliation_id}/unmatched/{source}")
async def get_unmatched_records(reconciliation_id: str, source: str):
    """Get unmatched records from a specific source"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    if source not in ["source_a", "source_b"]:
        raise HTTPException(400, "Source must be 'source_a' or 'source_b'")

    result_data = reconciliation_results[reconciliation_id]
    unmatched_key = f"unmatched_{source}"
    unmatched_records = result_data.get(unmatched_key, [])

    return {
        "success": True,
        "message": f"Retrieved {len(unmatched_records)} unmatched records from {source}",
        "data": {"unmatched_records": unmatched_records}
    }


@router.delete("/results/{reconciliation_id}")
async def delete_reconciliation_result(reconciliation_id: str):
    """Delete a reconciliation result"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    result_name = reconciliation_results[reconciliation_id].get("name", "Unknown")
    del reconciliation_results[reconciliation_id]

    return {
        "success": True,
        "message": f"Reconciliation result '{result_name}' deleted successfully"
    }


@router.post("/results/{reconciliation_id}/export")
async def export_reconciliation_results(reconciliation_id: str, export_format: str = "csv"):
    """Export reconciliation results to different formats"""
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(404, "Reconciliation result not found")

    # This would generate export files - implement based on your needs
    # For now, return the data structure that could be exported

    result_data = reconciliation_results[reconciliation_id]

    if export_format.lower() == "csv":
        # Convert matches to CSV-friendly format
        matches_for_export = []
        for match in result_data.get("matches", []):
            export_row = {
                "Match_ID": match.get("match_id"),
                "Similarity_Score": match.get("similarity_score"),
                "Recommendation": match.get("recommendation"),
                "Differences": "; ".join(match.get("differences", [])),
                "Source_A_ID": match.get("source_a_id"),
                "Source_B_ID": match.get("source_b_id")
            }
            # Add source A data fields
            for key, value in match.get("source_a_data", {}).items():
                export_row[f"SourceA_{key}"] = value
            # Add source B data fields
            for key, value in match.get("source_b_data", {}).items():
                export_row[f"SourceB_{key}"] = value

            matches_for_export.append(export_row)

        return {
            "success": True,
            "message": "Export data prepared",
            "data": {
                "export_format": export_format,
                "matches": matches_for_export,
                "summary": result_data.get("summary"),
                "unmatched_source_a": result_data.get("unmatched_source_a", []),
                "unmatched_source_b": result_data.get("unmatched_source_b", [])
            }
        }

    raise HTTPException(400, "Unsupported export format")


# Background processing functions

async def process_basic_reconciliation(recon_id: str, request: ReconciliationRequest, recon_name: str):
    """Background task for basic reconciliation processing"""
    start_time = time.time()

    try:
        # Initialize result structure
        reconciliation_results[recon_id] = {
            "name": recon_name,
            "status": "PROCESSING",
            "created_at": datetime.utcnow().isoformat(),
            "request": request.dict()
        }

        # Get data
        df_a = uploaded_files[request.source_a_file_id]["data"]
        df_b = uploaded_files[request.source_b_file_id]["data"]

        file_a_name = uploaded_files[request.source_a_file_id]["info"]["filename"]
        file_b_name = uploaded_files[request.source_b_file_id]["info"]["filename"]

        # Normalize data if requested
        if request.normalize_data:
            df_a = normalize_dataframe(df_a)
            df_b = normalize_dataframe(df_b)

        # Create collection for this reconciliation
        collection_name = f"recon_{recon_id}"
        collection = vector_client.get_or_create_collection(name=collection_name)

        # Process source A
        logger.info(f"Processing Source A: {len(df_a)} records")
        embeddings_a = []
        documents_a = []
        metadatas_a = []
        ids_a = []

        # Debug: Check the actual column names
        logger.info(f"Source A columns: {list(df_a.columns)}")
        logger.info(f"Source A key fields requested: {request.source_a_key_fields}")

        for idx, row in df_a.iterrows():
            try:
                text_repr = create_record_text(row, request.source_a_key_fields)
                if not text_repr.strip():  # Skip empty text representations
                    logger.warning(f"Empty text representation for Source A row {idx}")
                    logger.warning(f"Row data: {row.to_dict()}")
                    continue

                embedding = embedding_model.encode(text_repr)

                # Convert row data to JSON string for ChromaDB compatibility
                row_data_json = json.dumps(row.to_dict(), default=safe_json_serialize)

                embeddings_a.append(embedding.tolist())
                documents_a.append(text_repr)
                metadatas_a.append({
                    "source": "source_a",
                    "row_index": int(idx),
                    "row_data_json": row_data_json
                })
                ids_a.append(f"a_{idx}")
            except Exception as e:
                logger.error(f"Error processing Source A row {idx}: {str(e)}")
                continue

        # Process source B
        logger.info(f"Processing Source B: {len(df_b)} records")
        embeddings_b = []
        documents_b = []
        metadatas_b = []
        ids_b = []

        # Debug: Check the actual column names
        logger.info(f"Source B columns: {list(df_b.columns)}")
        logger.info(f"Source B key fields requested: {request.source_b_key_fields}")

        for idx, row in df_b.iterrows():
            try:
                text_repr = create_record_text(row, request.source_b_key_fields)
                if not text_repr.strip():  # Skip empty text representations
                    logger.warning(f"Empty text representation for Source B row {idx}")
                    logger.warning(f"Row data: {row.to_dict()}")
                    continue

                embedding = embedding_model.encode(text_repr)

                # Convert row data to JSON string for ChromaDB compatibility
                row_data_json = json.dumps(row.to_dict(), default=safe_json_serialize)

                embeddings_b.append(embedding.tolist())
                documents_b.append(text_repr)
                metadatas_b.append({
                    "source": "source_b",
                    "row_index": int(idx),
                    "row_data_json": row_data_json
                })
                ids_b.append(f"b_{idx}")
            except Exception as e:
                logger.error(f"Error processing Source B row {idx}: {str(e)}")
                continue

        # Store all embeddings
        try:
            logger.info(f"Storing {len(embeddings_a)} Source A + {len(embeddings_b)} Source B embeddings")

            if not embeddings_a and not embeddings_b:
                raise Exception("No valid embeddings generated from either source")

            collection.add(
                embeddings=embeddings_a + embeddings_b,
                documents=documents_a + documents_b,
                metadatas=metadatas_a + metadatas_b,
                ids=ids_a + ids_b
            )
            logger.info(f"Successfully stored {len(embeddings_a + embeddings_b)} embeddings in ChromaDB")
        except Exception as e:
            logger.error(f"Failed to store embeddings in ChromaDB: {str(e)}")
            # Log a sample metadata for debugging
            if metadatas_a:
                logger.error(f"Sample metadata A: {metadatas_a[0]}")
            if metadatas_b:
                logger.error(f"Sample metadata B: {metadatas_b[0]}")
            raise Exception(f"ChromaDB storage failed: {str(e)}")

        # Find matches
        logger.info("Finding matches...")
        matches = []
        matched_a_ids = set()
        matched_b_ids = set()

        # Debug: Log sample embeddings
        logger.info(f"Sample Source A text: {documents_a[0] if documents_a else 'None'}")
        logger.info(f"Sample Source B text: {documents_b[0] if documents_b else 'None'}")

        for i, (doc_id, document, metadata) in enumerate(zip(ids_a, documents_a, metadatas_a)):
            logger.info(f"Processing Source A record {i + 1}/{len(ids_a)}: {document[:100]}...")

            # Search for similar records in source B
            embedding = embeddings_a[i]

            try:
                similar_records = collection.query(
                    query_embeddings=[embedding],
                    n_results=min(request.max_matches_per_record, len(embeddings_b)),
                    where={"source": "source_b"}
                )

                logger.info(f"Found {len(similar_records['ids'][0])} potential matches")

                for j, (match_id, match_doc, match_meta, distance) in enumerate(zip(
                        similar_records['ids'][0],
                        similar_records['documents'][0],
                        similar_records['metadatas'][0],
                        similar_records['distances'][0]
                )):
                    similarity = 1 - distance
                    logger.info(
                        f"  Match {j + 1}: {match_doc[:50]}... | Similarity: {similarity:.4f} | Threshold: {request.similarity_threshold}")

                    if similarity >= request.similarity_threshold:
                        # Parse JSON strings back to dictionaries
                        source_a_data = json.loads(metadata['row_data_json'])
                        source_b_data = json.loads(match_meta['row_data_json'])

                        differences = calculate_differences(source_a_data, source_b_data)

                        recommendation = get_match_recommendation(similarity, len(differences))

                        match_info = {
                            "match_id": f"M_{len(matches) + 1:04d}",
                            "source_a_id": doc_id,
                            "source_b_id": match_id,
                            "similarity_score": round(similarity, 4),
                            "match_rank": j + 1,
                            "recommendation": recommendation,
                            "differences": differences,
                            "source_a_data": source_a_data,
                            "source_b_data": source_b_data
                        }

                        matches.append(match_info)
                        matched_a_ids.add(doc_id)
                        matched_b_ids.add(match_id)

                        logger.info(f"  ✅ MATCH FOUND: {recommendation} (similarity: {similarity:.4f})")
                    else:
                        logger.info(f"  ❌ Below threshold: {similarity:.4f} < {request.similarity_threshold}")

            except Exception as e:
                logger.error(f"Error searching for matches for record {doc_id}: {str(e)}")
                continue

        # Calculate unmatched records
        unmatched_a = []
        for i, (doc_id, metadata) in enumerate(zip(ids_a, metadatas_a)):
            if doc_id not in matched_a_ids:
                source_a_data = json.loads(metadata['row_data_json'])
                unmatched_a.append(source_a_data)

        unmatched_b = []
        for i, (doc_id, metadata) in enumerate(zip(ids_b, metadatas_b)):
            if doc_id not in matched_b_ids:
                source_b_data = json.loads(metadata['row_data_json'])
                unmatched_b.append(source_b_data)

        # Calculate summary statistics
        recommendation_counts = {}
        for match in matches:
            rec = match['recommendation']
            recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1

        processing_time = time.time() - start_time

        # Store final results
        reconciliation_results[recon_id].update({
            "status": "COMPLETED",
            "summary": {
                "reconciliation_id": recon_id,
                "reconciliation_name": recon_name,
                "source_a_file": file_a_name,
                "source_b_file": file_b_name,
                "total_matches": len(matches),
                "high_confidence_matches": recommendation_counts.get("HIGH_CONFIDENCE_MATCH", 0),
                "probable_matches": recommendation_counts.get("PROBABLE_MATCH", 0),
                "possible_matches": recommendation_counts.get("POSSIBLE_MATCH", 0),
                "low_confidence_matches": recommendation_counts.get("LOW_CONFIDENCE", 0),
                "exact_matches": recommendation_counts.get("EXACT_MATCH", 0),
                "source_a_total": len(df_a),
                "source_a_matched": len(matched_a_ids),
                "source_a_unmatched": len(unmatched_a),
                "source_b_total": len(df_b),
                "source_b_matched": len(matched_b_ids),
                "source_b_unmatched": len(unmatched_b),
                "processing_time_seconds": round(processing_time, 2),
                "similarity_threshold": request.similarity_threshold
            },
            "matches": matches,
            "unmatched_source_a": unmatched_a,
            "unmatched_source_b": unmatched_b
        })

        logger.info(f"Reconciliation {recon_id} completed successfully")

        # Clean up temporary collection
        try:
            # Check if collection exists before trying to delete
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
                logger.info(f"Cleaned up temporary collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to clean up collection {collection_name}: {str(e)}")

    except Exception as e:
        logger.error(f"Reconciliation {recon_id} failed: {str(e)}")

        # Clean up temporary collection on error
        try:
            existing_collections = [col.name for col in vector_client.list_collections()]
            if collection_name in existing_collections:
                vector_client.delete_collection(collection_name)
        except:
            pass

        reconciliation_results[recon_id].update({
            "status": "FAILED",
            "error": str(e),
            "processing_time_seconds": time.time() - start_time
        })


async def process_advanced_reconciliation(recon_id: str, request: AdvancedReconciliationRequest, recon_name: str):
    """Background task for advanced reconciliation processing"""
    # This would implement more sophisticated matching logic
    # For now, we'll use similar logic to basic reconciliation but with field mapping

    start_time = time.time()

    try:
        # Initialize result structure
        reconciliation_results[recon_id] = {
            "name": recon_name,
            "status": "PROCESSING",
            "created_at": datetime.utcnow().isoformat(),
            "request": request.dict()
        }

        # Implementation would be similar to basic but with:
        # 1. Field mapping applied
        # 2. Business rules processing
        # 3. Tolerance settings for numeric comparisons
        # 4. Different matching strategies

        # For demonstration, mark as completed
        reconciliation_results[recon_id].update({
            "status": "COMPLETED",
            "summary": {
                "reconciliation_id": recon_id,
                "reconciliation_name": recon_name,
                "total_matches": 0,
                "processing_time_seconds": time.time() - start_time,
                "message": "Advanced reconciliation logic would be implemented here"
            },
            "matches": [],
            "unmatched_source_a": [],
            "unmatched_source_b": []
        })

    except Exception as e:
        logger.error(f"Advanced reconciliation {recon_id} failed: {str(e)}")
        reconciliation_results[recon_id].update({
            "status": "FAILED",
            "error": str(e),
            "processing_time_seconds": time.time() - start_time
        })