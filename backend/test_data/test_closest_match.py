#!/usr/bin/env python3
"""
Quick test script to verify closest match functionality
"""
import requests
import json
import os

BASE_URL = "http://localhost:8000"

def upload_test_file(file_path):
    """Upload a test file and return the file ID"""
    url = f"{BASE_URL}/upload"
    
    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f, 'text/csv')}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        data = response.json()
        file_id = data['data']['file_id']
        print(f"✓ Uploaded {os.path.basename(file_path)} -> File ID: {file_id}")
        return file_id
    else:
        print(f"✗ Failed to upload {file_path}: {response.text}")
        return None

def test_reconciliation(file_a_id, file_b_id, find_closest_matches=False):
    """Test reconciliation with or without closest matches"""
    url = f"{BASE_URL}/reconciliation/process/"
    
    payload = {
        "process_type": "reconciliation",
        "process_name": "Closest Match Test",
        "user_requirements": "Test reconciliation with closest match functionality",
        "find_closest_matches": find_closest_matches,
        "files": [
            {"file_id": file_a_id, "role": "file_0", "label": "Test File A"},
            {"file_id": file_b_id, "role": "file_1", "label": "Test File B"}
        ],
        "reconciliation_config": {
            "Files": [
                {"Name": "FileA", "Extract": [], "Filter": []},
                {"Name": "FileB", "Extract": [], "Filter": []}
            ],
            "ReconciliationRules": [
                {
                    "LeftFileColumn": "transaction_id",
                    "RightFileColumn": "ref_id",
                    "MatchType": "equals",
                    "ToleranceValue": 0
                },
                {
                    "LeftFileColumn": "amount",
                    "RightFileColumn": "value",
                    "MatchType": "tolerance",
                    "ToleranceValue": 0.01
                }
            ]
        }
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        recon_id = data['reconciliation_id']
        summary = data['summary']
        
        print(f"\n{'='*60}")
        print(f"RECONCILIATION RESULTS (Closest Match: {find_closest_matches})")
        print(f"{'='*60}")
        print(f"Reconciliation ID: {recon_id}")
        print(f"Matched Records: {summary['matched_records']}")
        print(f"Unmatched File A: {summary['unmatched_file_a']}")
        print(f"Unmatched File B: {summary['unmatched_file_b']}")
        print(f"Match Percentage: {summary['match_percentage']}%")
        print(f"Processing Time: {summary['processing_time_seconds']}s")
        
        return recon_id
    else:
        print(f"✗ Reconciliation failed: {response.text}")
        return None

def get_unmatched_results(recon_id, result_type="unmatched_a"):
    """Get unmatched results to check closest match columns"""
    url = f"{BASE_URL}/reconciliation/results/{recon_id}?result_type={result_type}"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        records = data.get(f"unmatched_file_{result_type[-1]}", [])
        
        print(f"\n{'-'*50}")
        print(f"UNMATCHED {result_type.upper()} RESULTS ({len(records)} records)")
        print(f"{'-'*50}")
        
        for i, record in enumerate(records[:3]):  # Show first 3 records
            print(f"\nRecord {i+1}:")
            for key, value in record.items():
                if key.startswith('closest_match'):
                    print(f"  {key}: {str(value)[:100]}...")
                else:
                    print(f"  {key}: {value}")
        
        # Check if closest match columns exist
        if records:
            has_closest_match = any(key.startswith('closest_match') for key in records[0].keys())
            print(f"\n✓ Closest match columns present: {has_closest_match}")
            
            if has_closest_match:
                scores = [r.get('closest_match_score', 0) for r in records if r.get('closest_match_score')]
                if scores:
                    avg_score = sum(scores) / len(scores)
                    print(f"✓ Average similarity score: {avg_score:.1f}")
        
        return records
    else:
        print(f"✗ Failed to get results: {response.text}")
        return []

def main():
    """Main test function"""
    print("Starting Closest Match Reconciliation Test...")
    print("="*60)
    
    # File paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_a_path = os.path.join(script_dir, "recon_test_file_a.csv")
    file_b_path = os.path.join(script_dir, "recon_test_file_b.csv")
    
    # Check if files exist
    if not os.path.exists(file_a_path) or not os.path.exists(file_b_path):
        print("✗ Test files not found. Please ensure files are in the test_data directory.")
        return
    
    # Upload files
    file_a_id = upload_test_file(file_a_path)
    file_b_id = upload_test_file(file_b_path)
    
    if not file_a_id or not file_b_id:
        print("✗ Failed to upload test files")
        return
    
    # Test 1: Basic reconciliation (without closest matches)
    print(f"\n{'='*60}")
    print("TEST 1: Basic Reconciliation (No Closest Matches)")
    print(f"{'='*60}")
    recon_id_basic = test_reconciliation(file_a_id, file_b_id, find_closest_matches=False)
    
    if recon_id_basic:
        get_unmatched_results(recon_id_basic, "unmatched_a")
    
    # Test 2: Reconciliation with closest matches
    print(f"\n{'='*60}")
    print("TEST 2: Reconciliation WITH Closest Matches")
    print(f"{'='*60}")
    recon_id_closest = test_reconciliation(file_a_id, file_b_id, find_closest_matches=True)
    
    if recon_id_closest:
        get_unmatched_results(recon_id_closest, "unmatched_a")
        get_unmatched_results(recon_id_closest, "unmatched_b")
    
    print(f"\n{'='*60}")
    print("TEST COMPLETED")
    print(f"{'='*60}")
    print("✓ If you see closest_match_* columns in Test 2 but not Test 1, the feature works!")
    print("✓ Check similarity scores - they should be high (>90) for near-matches")
    print("✓ View full results in the frontend at http://localhost:5174")

if __name__ == "__main__":
    main()