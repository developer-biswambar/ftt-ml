"""
FTT-ML API Python Client Examples

This module provides example code for interacting with the FTT-ML API
using Python requests library.
"""

import requests
import json
import time
from typing import Dict, List, Optional, Any
from pathlib import Path


class FTTMLClient:
    """Python client for FTT-ML API"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def health_check(self) -> Dict[str, Any]:
        """Check API health status"""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def upload_file(self, file_path: str) -> Dict[str, Any]:
        """Upload a file to the API"""
        file_path = Path(file_path)
        
        with open(file_path, 'rb') as f:
            files = {'files': (file_path.name, f, 'application/octet-stream')}
            response = self.session.post(f"{self.base_url}/upload", files=files)
        
        response.raise_for_status()
        return response.json()
    
    def get_file_info(self, file_id: str) -> Dict[str, Any]:
        """Get information about an uploaded file"""
        response = self.session.get(f"{self.base_url}/files/{file_id}")
        response.raise_for_status()
        return response.json()
    
    def preview_file(self, file_id: str, rows: int = 10) -> Dict[str, Any]:
        """Preview file data"""
        params = {'rows': rows}
        response = self.session.get(f"{self.base_url}/files/{file_id}/preview", params=params)
        response.raise_for_status()
        return response.json()
    
    def generate_transformation_config(self, requirements: str, source_files: List[Dict]) -> Dict[str, Any]:
        """Generate AI-powered transformation configuration"""
        payload = {
            "requirements": requirements,
            "source_files": source_files
        }
        
        response = self.session.post(
            f"{self.base_url}/transformation/generate-config/",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def process_transformation(self, source_files: List[Dict], transformation_config: Dict, 
                             preview_only: bool = False) -> Dict[str, Any]:
        """Process data transformation"""
        payload = {
            "source_files": source_files,
            "transformation_config": transformation_config,
            "preview_only": preview_only
        }
        
        response = self.session.post(
            f"{self.base_url}/transformation/process/",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def get_transformation_results(self, transformation_id: str, page: int = 1, 
                                 page_size: int = 100) -> Dict[str, Any]:
        """Get transformation results with pagination"""
        params = {'page': page, 'page_size': page_size}
        response = self.session.get(
            f"{self.base_url}/transformation/results/{transformation_id}",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def download_transformation_results(self, transformation_id: str, format: str = "csv",
                                      output_path: str = None) -> str:
        """Download transformation results"""
        params = {'format': format}
        response = self.session.get(
            f"{self.base_url}/transformation/download/{transformation_id}",
            params=params,
            stream=True
        )
        response.raise_for_status()
        
        if output_path is None:
            output_path = f"transformation_{transformation_id}.{format}"
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return output_path
    
    def process_reconciliation(self, file_a_id: str, file_b_id: str, 
                             reconciliation_config: Dict) -> Dict[str, Any]:
        """Process financial reconciliation"""
        payload = {
            "file_a_id": file_a_id,
            "file_b_id": file_b_id,
            "reconciliation_config": reconciliation_config
        }
        
        response = self.session.post(
            f"{self.base_url}/reconciliation/process/",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def get_reconciliation_results(self, reconciliation_id: str, category: str = "matched",
                                 page: int = 1, page_size: int = 100) -> Dict[str, Any]:
        """Get reconciliation results by category"""
        params = {'category': category, 'page': page, 'page_size': page_size}
        response = self.session.get(
            f"{self.base_url}/reconciliation/results/{reconciliation_id}",
            params=params
        )
        response.raise_for_status()
        return response.json()


def example_transformation_workflow():
    """Complete transformation workflow example"""
    client = FTTMLClient()
    
    # Step 1: Check API health
    print("🔍 Checking API health...")
    health = client.health_check()
    print(f"✅ API Status: {health.get('status', 'unknown')}")
    
    # Step 2: Upload source file
    print("\n📁 Uploading source file...")
    file_path = "sample_data/customer_data.csv"  # Adjust path as needed
    
    try:
        upload_result = client.upload_file(file_path)
        file_id = upload_result['data']['file_id']
        columns = upload_result['data']['columns']
        print(f"✅ File uploaded: {file_id}")
        print(f"📊 Columns: {columns}")
    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return
    
    # Step 3: Preview file data
    print("\n👀 Previewing file data...")
    preview = client.preview_file(file_id, rows=5)
    print(f"📋 Preview data: {json.dumps(preview['data'][:2], indent=2)}")
    
    # Step 4: Generate AI configuration
    print("\n🤖 Generating AI transformation configuration...")
    requirements = """
    Transform customer data to create a summary report with:
    - Full customer name (combine first and last name)
    - Email address
    - Total amount including tax calculation
    - Customer tier based on amount (Premium: >=1000, Gold: >=500, Standard: <500)
    """
    
    source_file_info = {
        "file_id": file_id,
        "filename": upload_result['data']['filename'],
        "columns": columns,
        "totalRows": upload_result['data']['total_rows']
    }
    
    config_result = client.generate_transformation_config(requirements, [source_file_info])
    transformation_config = config_result['data']
    print("✅ AI configuration generated")
    
    # Step 5: Preview transformation
    print("\n🔍 Previewing transformation...")
    source_files = [{
        "file_id": file_id,
        "alias": file_id,
        "purpose": "Primary data source"
    }]
    
    preview_result = client.process_transformation(
        source_files=source_files,
        transformation_config=transformation_config,
        preview_only=True
    )
    
    if preview_result.get('preview_data'):
        print(f"📋 Preview results: {json.dumps(preview_result['preview_data'][:2], indent=2)}")
    
    # Step 6: Process full transformation
    print("\n⚙️ Processing full transformation...")
    transform_result = client.process_transformation(
        source_files=source_files,
        transformation_config=transformation_config,
        preview_only=False
    )
    
    transformation_id = transform_result['transformation_id']
    print(f"✅ Transformation completed: {transformation_id}")
    print(f"📊 Input rows: {transform_result['total_input_rows']}")
    print(f"📊 Output rows: {transform_result['total_output_rows']}")
    print(f"⏱️ Processing time: {transform_result['processing_time_seconds']}s")
    
    # Step 7: Get results
    print("\n📋 Retrieving transformation results...")
    results = client.get_transformation_results(transformation_id, page=1, page_size=10)
    print(f"📊 Total rows: {results['total_rows']}")
    print(f"📋 Sample data: {json.dumps(results['data'][:2], indent=2)}")
    
    # Step 8: Download results
    print("\n💾 Downloading results...")
    csv_file = client.download_transformation_results(transformation_id, format="csv")
    excel_file = client.download_transformation_results(transformation_id, format="excel")
    
    print(f"✅ CSV downloaded: {csv_file}")
    print(f"✅ Excel downloaded: {excel_file}")
    
    return transformation_id


def example_reconciliation_workflow():
    """Complete reconciliation workflow example"""
    client = FTTMLClient()
    
    print("🔄 Starting reconciliation workflow...")
    
    # Upload two files for reconciliation
    file_a_path = "sample_data/bank_statements.csv"
    file_b_path = "sample_data/internal_records.csv"
    
    try:
        print("📁 Uploading files...")
        upload_a = client.upload_file(file_a_path)
        upload_b = client.upload_file(file_b_path)
        
        file_a_id = upload_a['data']['file_id']
        file_b_id = upload_b['data']['file_id']
        
        print(f"✅ File A uploaded: {file_a_id}")
        print(f"✅ File B uploaded: {file_b_id}")
        
    except FileNotFoundError as e:
        print(f"❌ File not found: {e}")
        return
    
    # Configure reconciliation
    reconciliation_config = {
        "name": "Bank vs Internal Reconciliation",
        "description": "Match bank statements with internal records",
        "matching_criteria": [
            {
                "field_a": "transaction_id",
                "field_b": "reference_id",
                "match_type": "exact",
                "weight": 0.4
            },
            {
                "field_a": "amount",
                "field_b": "value",
                "match_type": "tolerance",
                "tolerance": 0.01,
                "weight": 0.4
            },
            {
                "field_a": "date",
                "field_b": "transaction_date",
                "match_type": "date",
                "tolerance_days": 1,
                "weight": 0.2
            }
        ],
        "match_threshold": 0.8,
        "auto_match": True
    }
    
    # Process reconciliation
    print("\n⚙️ Processing reconciliation...")
    recon_result = client.process_reconciliation(file_a_id, file_b_id, reconciliation_config)
    
    reconciliation_id = recon_result['reconciliation_id']
    print(f"✅ Reconciliation completed: {reconciliation_id}")
    print(f"📊 Match rate: {recon_result['match_rate']:.2f}%")
    print(f"🎯 Matched pairs: {recon_result['matched_pairs']}")
    print(f"❓ Unmatched A: {recon_result['unmatched_a']}")
    print(f"❓ Unmatched B: {recon_result['unmatched_b']}")
    
    # Get matched results
    print("\n📋 Retrieving matched records...")
    matched_results = client.get_reconciliation_results(reconciliation_id, category="matched", page_size=5)
    print(f"📊 Matched records: {matched_results['total_records']}")
    
    # Get unmatched results
    print("\n❓ Retrieving unmatched records...")
    unmatched_a = client.get_reconciliation_results(reconciliation_id, category="unmatched_a", page_size=5)
    unmatched_b = client.get_reconciliation_results(reconciliation_id, category="unmatched_b", page_size=5)
    
    print(f"📊 Unmatched from file A: {unmatched_a['total_records']}")
    print(f"📊 Unmatched from file B: {unmatched_b['total_records']}")
    
    return reconciliation_id


def example_batch_processing():
    """Example of processing multiple files in batch"""
    client = FTTMLClient()
    
    file_paths = [
        "sample_data/file1.csv",
        "sample_data/file2.csv", 
        "sample_data/file3.csv"
    ]
    
    uploaded_files = []
    
    print("📁 Batch uploading files...")
    for file_path in file_paths:
        try:
            result = client.upload_file(file_path)
            uploaded_files.append(result['data'])
            print(f"✅ Uploaded: {result['data']['filename']}")
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
            continue
    
    print(f"\n📊 Successfully uploaded {len(uploaded_files)} files")
    
    # Process transformations for each file
    transformation_ids = []
    
    for file_info in uploaded_files:
        file_id = file_info['file_id']
        
        # Generate configuration for each file
        requirements = f"Standardize data format for {file_info['filename']}"
        config_result = client.generate_transformation_config(requirements, [file_info])
        
        # Process transformation
        source_files = [{"file_id": file_id, "alias": file_id, "purpose": "Primary data source"}]
        transform_result = client.process_transformation(
            source_files=source_files,
            transformation_config=config_result['data'],
            preview_only=False
        )
        
        transformation_ids.append(transform_result['transformation_id'])
        print(f"✅ Processed: {file_info['filename']} -> {transform_result['transformation_id']}")
    
    # Download all results
    print("\n💾 Downloading all results...")
    for i, transform_id in enumerate(transformation_ids):
        output_file = client.download_transformation_results(transform_id, format="csv")
        print(f"✅ Downloaded: {output_file}")
    
    return transformation_ids


def main():
    """Main example function"""
    print("🚀 FTT-ML API Python Client Examples")
    print("=" * 50)
    
    try:
        # Run transformation workflow example
        print("\n1️⃣ Running Transformation Workflow Example...")
        transformation_id = example_transformation_workflow()
        
        print(f"\n✅ Transformation workflow completed: {transformation_id}")
        
        # Uncomment to run other examples:
        # print("\n2️⃣ Running Reconciliation Workflow Example...")
        # reconciliation_id = example_reconciliation_workflow()
        
        # print("\n3️⃣ Running Batch Processing Example...")  
        # batch_ids = example_batch_processing()
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to FTT-ML API. Make sure it's running on http://localhost:8000")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")


if __name__ == "__main__":
    main()