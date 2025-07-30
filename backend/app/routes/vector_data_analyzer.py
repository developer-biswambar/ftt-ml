# def parse_and_execute_query(self, user_prompt: str) -> Dict[str, Any]:
#     """Parse user prompt and execute data queries/filters dynamically"""
#     import re
#
#     results = {
#         "original_query": user_prompt,
#         "executed_operations": [],
#         "filtered_data": None,
#         "summary": {},
#         "query_interpretation": ""
#     }
#
#     # Make a copy of the dataframe for operations
#     working_df = self.df.copy()
#     original_count = len(working_df)
#
#     try:
#         # Get all column names for dynamic matching
#         columns = working_df.columns.tolist()
#         numeric_columns = working_df.select_dtypes(include=[np.number]).columns.tolist()
#         text_columns = working_df.select_dtypes(include=['object']).columns.tolist()
#
#         prompt_lower = user_prompt.lower()
#
#         # 1. Handle comparison operations dynamically
#         comparison_patterns = [
#             (r'(\w+)\s*(?:is\s+)?(?:greater than|higher than|above|>)\s*(\d+(?:\.\d+)?)', '>'),
#             (r'(\w+)\s*(?:is\s+)?(?:less than|lower than|below|<)\s*(\d+(?:\.\d+)?)', '<'),
#             (r'(\w+)\s*(?:is\s+)?(?:equal to|equals|=)\s*(\d+(?:\.\d+)?)', '=='),
#             (r'(\w+)\s*(?:is\s+)?(?:not equal to|!=)\s*(\d+(?:\.\d+)?)', '!='),
#             (r'(\w+)\s*(?:is\s+)?(?:between)\s*(\d+(?:\.\d+)?)\s*(?:and)\s*(\d+(?:\.\d+)?)', 'between')
#         ]
#
#         for pattern, operation in comparison_patterns:
#             matches = re.findall(pattern, prompt_lower)
#             for match in matches:
#                 if operation == 'between':
#                     col_name, val1, val2 = match
#                     val1, val2 = float(val1), float(val2)
#                 else:
#                     col_name, value = match
#                     value = float(value)
#
#                 # Find matching column (fuzzy match)
#                 matched_col = self._find_matching_column(col_name, columns)
#                 if matched_col and matched_col in numeric_columns:
#                     if operation == '>':
#                         working_df = working_df[working_df[matched_col] > value]
#                         results["executed_operations"].append(f"Filtered {matched_col} > {value}")
#                     elif operation == '<':
#                         working_df = working_df[working_df[matched_col] < value]
#                         results["executed_operations"].append(f"Filtered {matched_col} < {value}")
#                     elif operation == '==':
#                         working_df = working_df[working_df[matched_col] == value]
#                         results["executed_operations"].append(f"Filtered {matched_col} = {value}")
#                     elif operation == '!=':
#                         working_df = working_df[working_df[matched_col] != value]
#                         results["executed_operations"].append(f"Filtered {matched_col} != {value}")
#                     elif operation == 'between':
#                         working_df = working_df[(working_df[matched_col] >= val1) & (working_df[matched_col] <= val2)]
#                         results["executed_operations"].append(f"Filtered {matched_col} between {val1} and {val2}")
#
#         # 2. Handle text/string matching dynamically
#         text_patterns = [
#             (r'(\w+)\s*(?:contains|has|includes)\s*["\']([^"\']+)["\']', 'contains'),
#             (r'(\w+)\s*(?:contains|has|includes)\s*(\w+)', 'contains'),
#             (r'(\w+)\s*(?:equals|is|=)\s*["\']([^"\']+)["\']', 'equals'),
#             (r'(\w+)\s*(?:equals|is|=)\s*(\w+)', 'equals'),
#             (r'(\w+)\s*(?:starts with|begins with)\s*["\']([^"\']+)["\']', 'startswith'),
#             (r'(\w+)\s*(?:ends with)\s*["\']([^"\']+)["\']', 'endswith')
#         ]
#
#         for pattern, operation in text_patterns:
#             matches = re.findall(pattern, prompt_lower)
#             for match in matches:
#                 col_name, text_value = match
#
#                 # Find matching column
#                 matched_col = self._find_matching_column(col_name, columns)
#                 if matched_col and matched_col in text_columns:
#                     if operation == 'contains':
#                         working_df = working_df[working_df[matched_col].str.contains(text_value, case=False, na=False)]
#                         results["executed_operations"].append(f"Filtered {matched_col} contains '{text_value}'")
#                     elif operation == 'equals':
#                         working_df = working_df[working_df[matched_col].str.lower() == text_value.lower()]
#                         results["executed_operations"].append(f"Filtered {matched_col} equals '{text_value}'")
#                     elif operation == 'startswith':
#                         working_df = working_df[
#                             working_df[matched_col].str.lower().str.startswith(text_value.lower(), na=False)]
#                         results["executed_operations"].append(f"Filtered {matched_col} starts with '{text_value}'")
#                     elif operation == 'endswith':
#                         working_df = working_df[
#                             working_df[matched_col].str.lower().str.endswith(text_value.lower(), na=False)]
#                         results["executed_operations"].append(f"Filtered {matched_col} ends with '{text_value}'")
#
#         # 3. Handle sorting dynamically
#         sort_patterns = [
#             (r'sort by (\w+) (?:desc|descending|highest|high to low)', 'desc'),
#             (r'sort by (\w+) (?:asc|ascending|lowest|low to high)', 'asc'),
#             (r'sort by (\w+)', 'asc'),  # default to ascending
#             (r'order by (\w+) (?:desc|descending)', 'desc'),
#         from fastapi import FastAPI, UploadFile, File, HTTPException, Form
#         from fastapi.responses import JSONResponse
#         import pandas as pd
#         import numpy as np
#         import openai
#         from openai import OpenAI
#         import faiss
#         from sklearn.metrics.pairwise import cosine_similarity
#         from sklearn.cluster import KMeans
#         import os
#         from dotenv import load_dotenv
#         import io
#         import json
#         from typing import List, Dict, Any, Optional
#         import time
#
#         # Load environment variables
#         load_dotenv()
#
#         app = FastAPI()
#
#         # Initialize OpenAI client
#         client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
#
#
# class CSVAnalyzer:
#     def __init__(self):
#         self.df = None
#         self.embeddings = None
#         self.faiss_index = None
#         self.embedding_model = "text-embedding-3-small"
#
#     def load_csv(self, file_content: bytes) -> pd.DataFrame:
#         """Load CSV from uploaded file"""
#         try:
#             # Try different encodings
#             for encoding in ['utf-8', 'latin-1', 'cp1252']:
#                 try:
#                     self.df = pd.read_csv(io.StringIO(file_content.decode(encoding)))
#                     break
#                 except UnicodeDecodeError:
#                     continue
#
#             if self.df is None:
#                 raise ValueError("Could not decode file with any supported encoding")
#
#             return self.df
#         except Exception as e:
#             raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")
#
#     def get_embedding(self, text: str) -> List[float]:
#         """Generate embedding for a single text"""
#         try:
#             response = client.embeddings.create(
#                 input=str(text)[:8000],  # Limit token length
#                 model=self.embedding_model
#             )
#             return response.data[0].embedding
#         except Exception as e:
#             print(f"Error generating embedding: {e}")
#             return [0.0] * 1536  # Return zero vector on error
#
#     def get_embeddings_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
#         """Generate embeddings in batches for efficiency"""
#         embeddings = []
#
#         for i in range(0, len(texts), batch_size):
#             batch = texts[i:i + batch_size]
#             # Clean and limit text length
#             cleaned_batch = [str(text)[:8000] if pd.notna(text) else "" for text in batch]
#
#             try:
#                 response = client.embeddings.create(
#                     input=cleaned_batch,
#                     model=self.embedding_model
#                 )
#                 batch_embeddings = [data.embedding for data in response.data]
#                 embeddings.extend(batch_embeddings)
#
#                 # Rate limiting
#                 time.sleep(0.1)
#
#             except Exception as e:
#                 print(f"Batch embedding error: {e}")
#                 # Return zero vectors for failed batch
#                 embeddings.extend([[0.0] * 1536] * len(batch))
#
#         return embeddings
#
#     def create_combined_text_column(self, columns_to_embed: List[str]) -> List[str]:
#         """Combine specified columns into single text for embedding"""
#         combined_texts = []
#
#         for _, row in self.df.iterrows():
#             text_parts = []
#             for col in columns_to_embed:
#                 if col in self.df.columns and pd.notna(row[col]):
#                     text_parts.append(f"{col}: {row[col]}")
#
#             combined_text = " | ".join(text_parts) if text_parts else "No data"
#             combined_texts.append(combined_text)
#
#         return combined_texts
#
#     def generate_embeddings(self, columns_to_embed: Optional[List[str]] = None):
#         """Generate embeddings for the dataset"""
#         if self.df is None:
#             raise ValueError("No CSV data loaded")
#
#         # If no columns specified, use text columns
#         if columns_to_embed is None:
#             columns_to_embed = self.df.select_dtypes(include=['object']).columns.tolist()
#
#         # Filter valid columns
#         columns_to_embed = [col for col in columns_to_embed if col in self.df.columns]
#
#         if not columns_to_embed:
#             raise ValueError("No valid text columns found for embedding")
#
#         print(f"Generating embeddings for columns: {columns_to_embed}")
#
#         # Create combined text for each row
#         combined_texts = self.create_combined_text_column(columns_to_embed)
#
#         # Generate embeddings in batches
#         self.embeddings = self.get_embeddings_batch(combined_texts)
#
#         # Create FAISS index for fast similarity search
#         self.create_faiss_index()
#
#         return len(self.embeddings)
#
#     def create_faiss_index(self):
#         """Create FAISS index for fast similarity search"""
#         if not self.embeddings:
#             return
#
#         embeddings_array = np.array(self.embeddings, dtype=np.float32)
#         dimension = embeddings_array.shape[1]
#
#         # Create FAISS index
#         self.faiss_index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
#
#         # Normalize embeddings for cosine similarity
#         faiss.normalize_L2(embeddings_array)
#         self.faiss_index.add(embeddings_array)
#
#     def similarity_search(self, query_text: str, top_k: int = 10) -> List[Dict]:
#         """Find most similar records to query"""
#         if self.faiss_index is None:
#             return []
#
#         # Generate embedding for query
#         query_embedding = np.array([self.get_embedding(query_text)], dtype=np.float32)
#         faiss.normalize_L2(query_embedding)
#
#         # Search
#         scores, indices = self.faiss_index.search(query_embedding, top_k)
#
#         results = []
#         for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
#             if idx < len(self.df):
#                 result = {
#                     "rank": i + 1,
#                     "similarity_score": float(score),
#                     "record": self.df.iloc[idx].to_dict()
#                 }
#                 results.append(result)
#
#         return results
#
#     def cluster_analysis(self, n_clusters: int = 5) -> Dict[str, Any]:
#         """Perform clustering analysis on embeddings"""
#         if not self.embeddings:
#             return {}
#
#         embeddings_array = np.array(self.embeddings)
#
#         # Perform K-means clustering
#         kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
#         cluster_labels = kmeans.fit_predict(embeddings_array)
#
#         # Add cluster labels to dataframe
#         df_with_clusters = self.df.copy()
#         df_with_clusters['cluster'] = cluster_labels
#
#         # Analyze clusters
#         cluster_analysis = {}
#         for cluster_id in range(n_clusters):
#             cluster_data = df_with_clusters[df_with_clusters['cluster'] == cluster_id]
#
#             cluster_analysis[f"cluster_{cluster_id}"] = {
#                 "size": len(cluster_data),
#                 "percentage": len(cluster_data) / len(self.df) * 100,
#                 "sample_records": cluster_data.head(3).to_dict('records')
#             }
#
#         return {
#             "n_clusters": n_clusters,
#             "cluster_distribution": cluster_analysis,
#             "total_records": len(self.df)
#         }
#
#     def parse_and_execute_query(self, user_prompt: str) -> Dict[str, Any]:
#         """Parse user prompt and execute data queries/filters"""
#         results = {
#             "original_query": user_prompt,
#             "executed_operations": [],
#             "filtered_data": None,
#             "summary": {}
#         }
#
#         # Make a copy of the dataframe for operations
#         working_df = self.df.copy()
#
#         # Convert user prompt to lowercase for easier parsing
#         prompt_lower = user_prompt.lower()
#
#         try:
#             # Handle numerical filters
#             if "purchase" in prompt_lower and any(
#                     op in prompt_lower for op in ["higher than", "greater than", "above", ">"]):
#                 # Extract the number
#                 import re
#                 numbers = re.findall(r'\d+(?:\.\d+)?', user_prompt)
#                 if numbers:
#                     threshold = float(numbers[0])
#                     if "purchase_amount" in working_df.columns:
#                         working_df = working_df[working_df['purchase_amount'] > threshold]
#                         results["executed_operations"].append(f"Filtered records with purchase_amount > {threshold}")
#
#             elif "purchase" in prompt_lower and any(
#                     op in prompt_lower for op in ["lower than", "less than", "below", "<"]):
#                 import re
#                 numbers = re.findall(r'\d+(?:\.\d+)?', user_prompt)
#                 if numbers:
#                     threshold = float(numbers[0])
#                     if "purchase_amount" in working_df.columns:
#                         working_df = working_df[working_df['purchase_amount'] < threshold]
#                         results["executed_operations"].append(f"Filtered records with purchase_amount < {threshold}")
#
#             elif "purchase" in prompt_lower and any(op in prompt_lower for op in ["equal", "equals", "="]):
#                 import re
#                 numbers = re.findall(r'\d+(?:\.\d+)?', user_prompt)
#                 if numbers:
#                     threshold = float(numbers[0])
#                     if "purchase_amount" in working_df.columns:
#                         working_df = working_df[working_df['purchase_amount'] == threshold]
#                         results["executed_operations"].append(f"Filtered records with purchase_amount = {threshold}")
#
#             # Handle rating filters
#             if "rating" in prompt_lower and any(
#                     op in prompt_lower for op in ["higher than", "greater than", "above", ">"]):
#                 import re
#                 numbers = re.findall(r'\d+(?:\.\d+)?', user_prompt)
#                 if numbers:
#                     threshold = float(numbers[0])
#                     if "rating" in working_df.columns:
#                         working_df = working_df[working_df['rating'] > threshold]
#                         results["executed_operations"].append(f"Filtered records with rating > {threshold}")
#
#             # Handle age filters
#             if "age" in prompt_lower and any(
#                     op in prompt_lower for op in ["higher than", "greater than", "above", "older than", ">"]):
#                 import re
#                 numbers = re.findall(r'\d+(?:\.\d+)?', user_prompt)
#                 if numbers:
#                     threshold = float(numbers[0])
#                     if "age" in working_df.columns:
#                         working_df = working_df[working_df['age'] > threshold]
#                         results["executed_operations"].append(f"Filtered records with age > {threshold}")
#
#             # Handle category filters
#             categories = ["electronics", "fashion", "sports", "books", "beauty", "home", "garden"]
#             for category in categories:
#                 if category in prompt_lower and "product_category" in working_df.columns:
#                     working_df = working_df[working_df['product_category'].str.lower().str.contains(category, na=False)]
#                     results["executed_operations"].append(f"Filtered records with category containing '{category}'")
#
#             # Handle city filters
#             if "city" in prompt_lower and "from" in prompt_lower:
#                 import re
#                 # Look for city names (basic pattern)
#                 cities = ["new york", "los angeles", "san francisco", "chicago", "boston", "seattle", "denver", "miami",
#                           "portland", "phoenix"]
#                 for city in cities:
#                     if city in prompt_lower and "city" in working_df.columns:
#                         working_df = working_df[working_df['city'].str.lower().str.contains(city, na=False)]
#                         results["executed_operations"].append(f"Filtered records from city containing '{city}'")
#
#             # Handle sorting
#             if "sort" in prompt_lower or "order" in prompt_lower:
#                 if "purchase" in prompt_lower:
#                     if "desc" in prompt_lower or "highest" in prompt_lower:
#                         working_df = working_df.sort_values('purchase_amount', ascending=False)
#                         results["executed_operations"].append("Sorted by purchase_amount (descending)")
#                     else:
#                         working_df = working_df.sort_values('purchase_amount', ascending=True)
#                         results["executed_operations"].append("Sorted by purchase_amount (ascending)")
#                 elif "rating" in prompt_lower:
#                     if "desc" in prompt_lower or "highest" in prompt_lower:
#                         working_df = working_df.sort_values('rating', ascending=False)
#                         results["executed_operations"].append("Sorted by rating (descending)")
#                     else:
#                         working_df = working_df.sort_values('rating', ascending=True)
#                         results["executed_operations"].append("Sorted by rating (ascending)")
#
#             # Handle limit/top queries
#             if any(word in prompt_lower for word in ["top", "first", "limit"]):
#                 import re
#                 numbers = re.findall(r'\b(\d+)\b', user_prompt)
#                 if numbers:
#                     limit = int(numbers[0])
#                     working_df = working_df.head(limit)
#                     results["executed_operations"].append(f"Limited to top {limit} records")
#
#             # Store filtered data
#             results["filtered_data"] = working_df.to_dict('records')
#
#             # Generate summary
#             results["summary"] = {
#                 "total_records_
#
#     def generate_ai_report(self, user_prompt: str, analysis_data: Dict) -> str:
#         """Generate AI-powered report based on analysis"""
#         try:
#             # Create context from analysis
#             context = f"""
#             Dataset Overview:
#             - Total records: {len(self.df)}
#             - Columns: {list(self.df.columns)}
#             - Data types: {self.df.dtypes.to_dict()}
#
#             Statistical Summary:
#             {self.df.describe(include='all').to_string()}
#
#             Analysis Results:
#             {json.dumps(analysis_data, indent=2, default=str)}
#             """
#
#             # Generate report using OpenAI
#             response = client.chat.completions.create(
#                 model="gpt-4",
#                 messages=[
#                     {
#                         "role": "system",
#                         "content": "You are a data analyst. Generate a comprehensive report based on the provided dataset analysis and user requirements. Focus on actionable insights and key findings."
#                     },
#                     {
#                         "role": "user",
#                         "content": f"User Request: {user_prompt}\n\nDataset Context:\n{context}\n\nPlease provide a detailed analysis report."
#                     }
#                 ],
#                 max_tokens=2000,
#                 temperature=0.3
#             )
#
#             return response.choices[0].message.content
#
#         except Exception as e:
#             return f"Error generating AI report: {str(e)}"
#
#
# # Global analyzer instance
# analyzer = CSVAnalyzer()
#
#
# @app.post("/analyze-csv")
# async def analyze_csv(
#         file: UploadFile = File(...),
#         user_prompt: str = Form(...),
#         columns_to_embed: Optional[str] = Form(None),
#         similarity_query: Optional[str] = Form(None),
#         n_clusters: int = Form(5),
#         top_k_similar: int = Form(10)
# ):
#     """
#     Upload CSV file and generate analysis report based on user prompt
#
#     Parameters:
#     - file: CSV file to analyze
#     - user_prompt: User's analysis requirements
#     - columns_to_embed: Comma-separated column names to embed (optional)
#     - similarity_query: Query text for similarity search (optional)
#     - n_clusters: Number of clusters for analysis
#     - top_k_similar: Number of similar records to return
#     """
#
#     try:
#         # Validate file type
#         if not file.filename.lower().endswith('.csv'):
#             raise HTTPException(status_code=400, detail="Only CSV files are supported")
#
#         # Read file content
#         file_content = await file.read()
#
#         # Load CSV
#         df = analyzer.load_csv(file_content)
#
#         print(f"Loaded CSV with {len(df)} records and {len(df.columns)} columns")
#
#         # Parse columns to embed
#         embed_columns = None
#         if columns_to_embed:
#             embed_columns = [col.strip() for col in columns_to_embed.split(',')]
#
#         # Generate embeddings
#         embedding_count = analyzer.generate_embeddings(embed_columns)
#
#         print(f"Generated {embedding_count} embeddings")
#
#         # Perform analysis
#         analysis_results = analyzer.filter_and_transform_data(user_prompt)
#
#         # Similarity search if query provided
#         if similarity_query:
#             similar_records = analyzer.similarity_search(similarity_query, top_k_similar)
#             analysis_results["similarity_search"] = {
#                 "query": similarity_query,
#                 "results": similar_records
#             }
#
#         # Cluster analysis
#         if n_clusters > 1 and n_clusters <= len(df):
#             cluster_results = analyzer.cluster_analysis(n_clusters)
#             analysis_results["cluster_analysis"] = cluster_results
#
#         # Generate AI-powered report
#         ai_report = analyzer.generate_ai_report(user_prompt, analysis_results)
#
#         # Prepare response
#         response = {
#             "status": "success",
#             "analysis_results": analysis_results,
#             "ai_report": ai_report,
#             "processing_info": {
#                 "embeddings_generated": embedding_count,
#                 "model_used": analyzer.embedding_model,
#                 "processing_time": "< 1 minute"
#             }
#         }
#
#         return JSONResponse(content=response)
#
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
#
#
# @app.get("/health")
# async def health_check():
#     """Health check endpoint"""
#     return {"status": "healthy", "service": "CSV Vector Analysis API"}
#
#
# if __name__ == "__main__":
#     import uvicorn
#
#     uvicorn.run(app, host="0.0.0.0", port=8000)