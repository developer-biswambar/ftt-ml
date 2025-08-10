#!/usr/bin/env python3
"""
Debug Excel reconciliation issues with values like "01", "07"
Investigate why reconciliation fails when manual verification shows they should match
"""
import sys
import pandas as pd
from io import BytesIO
import numpy as np

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def create_test_excel_files():
    """Create test Excel files similar to your real data"""
    print("📊 CREATING TEST EXCEL FILES WITH '01', '07' DATA")
    print("=" * 60)
    
    # File A data
    file_a_data = {
        'TransactionID': ['01', '02', '07', '10', '05'],
        'Amount': [100.0, 200.0, 700.0, 1000.0, 500.0],
        'Status': ['Active', 'Pending', 'Active', 'Complete', 'Active'],
        'Date': ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19']
    }
    
    # File B data (should match File A)
    file_b_data = {
        'RefID': ['01', '02', '07', '10', '05'],  # Same values as TransactionID
        'Value': [100.0, 200.0, 700.0, 1000.0, 500.0],
        'State': ['Active', 'Pending', 'Active', 'Complete', 'Active'],
        'ProcessDate': ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19']
    }
    
    # Create DataFrames
    df_a = pd.DataFrame(file_a_data)
    df_b = pd.DataFrame(file_b_data)
    
    # Save as Excel files in memory
    excel_a = BytesIO()
    excel_b = BytesIO()
    
    df_a.to_excel(excel_a, index=False, engine='openpyxl')
    df_b.to_excel(excel_b, index=False, engine='openpyxl')
    
    excel_a.seek(0)
    excel_b.seek(0)
    
    print("✅ Created test Excel files:")
    print("   File A: TransactionID with '01', '02', '07', '10', '05'")
    print("   File B: RefID with '01', '02', '07', '10', '05'")
    print("   Expected: All 5 records should match")
    print()
    
    return excel_a, excel_b, df_a, df_b

def test_excel_reading_behavior():
    """Test how Excel files are read by the reconciliation service"""
    print("🔍 TESTING EXCEL FILE READING BEHAVIOR")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        
        excel_a, excel_b, original_a, original_b = create_test_excel_files()
        
        # Create mock upload files
        class MockUploadFile:
            def __init__(self, content: BytesIO, filename: str):
                self.file = content
                self.filename = filename
        
        mock_file_a = MockUploadFile(excel_a, 'test_file_a.xlsx')
        mock_file_b = MockUploadFile(excel_b, 'test_file_b.xlsx')
        
        processor = OptimizedFileProcessor()
        
        # Read both files through reconciliation service
        print("📖 Reading files through reconciliation service...")
        df_a = processor.read_file(mock_file_a)
        df_b = processor.read_file(mock_file_b)
        
        print(f"\n📊 File A after reconciliation service reading:")
        print(f"   Shape: {df_a.shape}")
        for col in df_a.columns:
            sample_vals = df_a[col].head(3).tolist()
            dtype = df_a[col].dtype
            print(f"   {col}: {sample_vals} (dtype: {dtype})")
        
        print(f"\n📊 File B after reconciliation service reading:")
        print(f"   Shape: {df_b.shape}")
        for col in df_b.columns:
            sample_vals = df_b[col].head(3).tolist()
            dtype = df_b[col].dtype
            print(f"   {col}: {sample_vals} (dtype: {dtype})")
        
        # Check specific values that should match
        print(f"\n🔍 DETAILED VALUE INSPECTION:")
        print("=" * 40)
        
        for i in range(min(len(df_a), len(df_b))):
            val_a = df_a['TransactionID'].iloc[i]
            val_b = df_b['RefID'].iloc[i]
            
            # Check various properties
            print(f"\nRow {i}:")
            print(f"   File A TransactionID: {val_a!r} (type: {type(val_a).__name__})")
            print(f"   File B RefID: {val_b!r} (type: {type(val_b).__name__})")
            print(f"   Exact equality: {val_a == val_b}")
            print(f"   String equality: {str(val_a) == str(val_b)}")
            print(f"   Case-insensitive: {str(val_a).lower() == str(val_b).lower()}")
            
            # Check for hidden characters
            if isinstance(val_a, str) and isinstance(val_b, str):
                print(f"   Length A: {len(val_a)}, Length B: {len(val_b)}")
                print(f"   ASCII A: {[ord(c) for c in val_a]}")
                print(f"   ASCII B: {[ord(c) for c in val_b]}")
            
            # Test the reconciliation equals method directly
            try:
                equals_result = processor._check_equals_match(val_a, val_b)
                print(f"   _check_equals_match result: {equals_result}")
            except Exception as e:
                print(f"   _check_equals_match ERROR: {e}")
        
        return df_a, df_b
        
    except Exception as e:
        print(f"❌ Error testing Excel reading: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def test_actual_reconciliation():
    """Test the actual reconciliation process"""
    print(f"\n🔄 TESTING ACTUAL RECONCILIATION PROCESS")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        excel_a, excel_b, original_a, original_b = create_test_excel_files()
        
        # Create mock upload files
        class MockUploadFile:
            def __init__(self, content: BytesIO, filename: str):
                self.file = content
                self.filename = filename
        
        mock_file_a = MockUploadFile(excel_a, 'test_file_a.xlsx')
        mock_file_b = MockUploadFile(excel_b, 'test_file_b.xlsx')
        
        processor = OptimizedFileProcessor()
        
        # Read files
        df_a = processor.read_file(mock_file_a)
        df_b = processor.read_file(mock_file_b)
        
        # Create reconciliation rule
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="TransactionID",
                RightFileColumn="RefID",
                MatchType="equals"
            )
        ]
        
        print("🔍 Running reconciliation with 'equals' match type...")
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        unmatched_a_count = len(results['unmatched_file_a'])
        unmatched_b_count = len(results['unmatched_file_b'])
        
        print(f"\n📈 RECONCILIATION RESULTS:")
        print(f"   Total records in File A: {len(df_a)}")
        print(f"   Total records in File B: {len(df_b)}")
        print(f"   Matched records: {matched_count}")
        print(f"   Unmatched from File A: {unmatched_a_count}")
        print(f"   Unmatched from File B: {unmatched_b_count}")
        print(f"   Expected matches: 5 (all records should match)")
        
        if matched_count > 0:
            print(f"\n✅ SAMPLE MATCHED RECORDS:")
            for i in range(min(3, len(results['matched']))):
                match = results['matched'].iloc[i]
                print(f"   Match {i+1}: '{match['FileA_TransactionID']}' ↔ '{match['FileB_RefID']}'")
        
        if unmatched_a_count > 0:
            print(f"\n❌ UNMATCHED FROM FILE A:")
            for i in range(min(3, len(results['unmatched_file_a']))):
                unmatched = results['unmatched_file_a'].iloc[i]
                print(f"   Unmatched: '{unmatched['TransactionID']}'")
        
        if unmatched_b_count > 0:
            print(f"\n❌ UNMATCHED FROM FILE B:")
            for i in range(min(3, len(results['unmatched_file_b']))):
                unmatched = results['unmatched_file_b'].iloc[i]
                print(f"   Unmatched: '{unmatched['RefID']}'")
        
        # Analyze why matches failed
        if matched_count < 5:
            print(f"\n🔍 ANALYZING WHY MATCHES FAILED:")
            print("=" * 40)
            
            # Check each expected match manually
            for i in range(len(df_a)):
                val_a = df_a['TransactionID'].iloc[i]
                
                # Find if this value exists in file B
                matching_rows_b = df_b[df_b['RefID'] == val_a]
                
                if len(matching_rows_b) == 0:
                    print(f"   '{val_a}' from File A not found in File B")
                    # Check with string conversion
                    str_matching_rows_b = df_b[df_b['RefID'].astype(str) == str(val_a)]
                    if len(str_matching_rows_b) > 0:
                        print(f"     But '{val_a}' found with string conversion")
                        actual_b_val = df_b['RefID'].iloc[i]
                        print(f"     File B value: {actual_b_val!r} vs File A value: {val_a!r}")
        
        return results
        
    except Exception as e:
        print(f"❌ Error testing reconciliation: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_standard_pandas_excel_reading():
    """Test how standard pandas reads Excel vs our enhanced reading"""
    print(f"\n📊 COMPARING STANDARD vs ENHANCED EXCEL READING")
    print("=" * 50)
    
    excel_a, excel_b, original_a, original_b = create_test_excel_files()
    
    # Test 1: Standard pandas reading
    excel_a.seek(0)
    df_standard = pd.read_excel(excel_a, engine='openpyxl')
    
    print(f"📖 Standard pandas.read_excel():")
    for col in df_standard.columns:
        sample_vals = df_standard[col].head(3).tolist()
        dtype = df_standard[col].dtype
        print(f"   {col}: {sample_vals} (dtype: {dtype})")
    
    # Test 2: Our enhanced reading with leading zero detection
    try:
        from app.routes.file_routes import detect_leading_zero_columns
        
        excel_a.seek(0)
        content = excel_a.read()
        dtype_mapping = detect_leading_zero_columns(content, 'test.xlsx')
        
        excel_a.seek(0)
        df_enhanced = pd.read_excel(excel_a, engine='openpyxl', dtype=dtype_mapping if dtype_mapping else None)
        
        print(f"\n📖 Enhanced reading with leading zero detection:")
        print(f"   Dtype mapping: {dtype_mapping}")
        for col in df_enhanced.columns:
            sample_vals = df_enhanced[col].head(3).tolist()
            dtype = df_enhanced[col].dtype
            print(f"   {col}: {sample_vals} (dtype: {dtype})")
        
        # Compare specific values
        print(f"\n🔍 VALUE COMPARISON:")
        for i in range(3):
            std_val = df_standard['TransactionID'].iloc[i]
            enh_val = df_enhanced['TransactionID'].iloc[i]
            print(f"   Row {i}: Standard={std_val!r} vs Enhanced={enh_val!r}")
            
    except Exception as e:
        print(f"❌ Error testing enhanced reading: {e}")

def main():
    print("EXCEL RECONCILIATION DEBUG INVESTIGATION")
    print("=" * 60)
    print("Debugging why reconciliation fails for Excel data like '01', '07'")
    print("when manual verification shows they should match.")
    print()
    
    # Test 1: Compare standard vs enhanced Excel reading
    test_standard_pandas_excel_reading()
    
    # Test 2: Test Excel reading behavior through reconciliation service
    df_a, df_b = test_excel_reading_behavior()
    
    # Test 3: Test actual reconciliation process
    results = test_actual_reconciliation()
    
    print(f"\n{'='*60}")
    print("🎯 EXCEL RECONCILIATION DEBUG SUMMARY")
    print("=" * 60)
    
    if df_a is not None and df_b is not None:
        print("🔍 POTENTIAL ISSUES FOUND:")
        
        # Check if data types are preserved correctly
        id_dtype_a = df_a['TransactionID'].dtype
        id_dtype_b = df_b['RefID'].dtype
        
        if id_dtype_a != id_dtype_b:
            print(f"   ❌ Data type mismatch: File A ({id_dtype_a}) vs File B ({id_dtype_b})")
        
        # Check for hidden characters or encoding issues
        sample_a = str(df_a['TransactionID'].iloc[0])
        sample_b = str(df_b['RefID'].iloc[0])
        
        if len(sample_a) != len(sample_b):
            print(f"   ❌ Length mismatch: '{sample_a}' ({len(sample_a)}) vs '{sample_b}' ({len(sample_b)})")
        
        print(f"\n📝 DEBUGGING CHECKLIST:")
        print(f"   1. ✓ Check if leading zero detection is working")
        print(f"   2. ✓ Check data types after Excel reading")
        print(f"   3. ✓ Check for hidden characters or encoding issues")
        print(f"   4. ✓ Test reconciliation matching logic directly")
        print(f"   5. ✓ Compare values manually vs programmatically")
        
        if results and len(results['matched']) < 5:
            print(f"\n⚠️  RECONCILIATION ISSUE CONFIRMED:")
            print(f"   Expected 5 matches, got {len(results['matched'])}")
            print(f"   This confirms there's an issue with Excel reconciliation")
        else:
            print(f"\n✅ RECONCILIATION WORKING:")
            print(f"   All expected matches found")
            
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()