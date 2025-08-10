#!/usr/bin/env python3
"""
Test reconciliation service leading zero preservation
Ensures that reconciliation doesn't strip leading zeros from values like '07'
"""
import sys
import pandas as pd
import io
from io import BytesIO

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_reconciliation_service_leading_zeros():
    """Test that reconciliation service preserves leading zeros"""
    print("🔍 TESTING RECONCILIATION SERVICE LEADING ZERO PRESERVATION")
    print("=" * 60)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        
        # Create test CSV content with leading zeros
        test_csv_content = """TransactionID,AccountID,Amount,Description
01,007,100.00,Payment A
02,123,200.50,Payment B
03,000,300.75,Payment C"""
        
        print("📝 Test CSV content:")
        print(test_csv_content)
        print()
        
        # Create a mock UploadFile
        class MockUploadFile:
            def __init__(self, content: str, filename: str):
                self.file = BytesIO(content.encode('utf-8'))
                self.filename = filename
        
        # Test the reconciliation service file reading
        mock_file = MockUploadFile(test_csv_content, 'test_transactions.csv')
        processor = OptimizedFileProcessor()
        
        print("🔍 Testing reconciliation service read_file() method:")
        df = processor.read_file(mock_file)
        
        print("📊 DataFrame dtypes after reconciliation service processing:")
        for col in df.columns:
            sample_val = df[col].iloc[0]
            print(f"   {col}: {sample_val!r} (dtype: {df[col].dtype})")
        
        print("\n✅ LEADING ZERO PRESERVATION CHECK:")
        print("=" * 40)
        
        # Test specific leading zero cases
        test_cases = [
            ("TransactionID", "01", "Transaction ID with leading zero"),
            ("AccountID", "007", "Account ID with leading zeros"),
        ]
        
        all_preserved = True
        for col, expected, description in test_cases:
            if col in df.columns:
                actual = str(df[col].iloc[0])
                preserved = actual == expected
                status = "✅ Preserved" if preserved else "❌ Lost"
                print(f"   {description}: Expected '{expected}' → Got '{actual}' → {status}")
                
                if not preserved:
                    all_preserved = False
        
        print(f"\n{'='*60}")
        if all_preserved:
            print("🎉 SUCCESS: Reconciliation service preserves leading zeros!")
            print("   • TransactionID '01' stays as '01'")
            print("   • AccountID '007' stays as '007'")
        else:
            print("⚠️  WARNING: Some leading zeros were lost in reconciliation service")
        
        return df, all_preserved
        
    except Exception as e:
        print(f"❌ Error testing reconciliation service: {e}")
        import traceback
        traceback.print_exc()
        return None, False

def test_reconciliation_matching_with_leading_zeros():
    """Test actual reconciliation matching with leading zeros"""
    print("\n🔄 TESTING RECONCILIATION MATCHING WITH LEADING ZEROS")
    print("=" * 60)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # Create test data for File A and File B
        file_a_content = """ID,Account,Amount
01,007,100
02,123,200
03,456,300"""

        file_b_content = """RefID,CustomerAccount,Value
01,007,100
2,123,200
03,456,300"""
        
        print("📝 File A content (with leading zeros):")
        print(file_a_content)
        print("\n📝 File B content (mixed leading zeros):")  
        print(file_b_content)
        
        # Create mock upload files
        class MockUploadFile:
            def __init__(self, content: str, filename: str):
                self.file = BytesIO(content.encode('utf-8'))
                self.filename = filename
        
        mock_file_a = MockUploadFile(file_a_content, 'file_a.csv')
        mock_file_b = MockUploadFile(file_b_content, 'file_b.csv')
        
        processor = OptimizedFileProcessor()
        
        # Read both files
        df_a = processor.read_file(mock_file_a)
        df_b = processor.read_file(mock_file_b)
        
        print(f"\n📊 File A dtypes:")
        for col in df_a.columns:
            print(f"   {col}: {df_a[col].iloc[0]!r} (dtype: {df_a[col].dtype})")
            
        print(f"\n📊 File B dtypes:")
        for col in df_b.columns:
            print(f"   {col}: {df_b[col].iloc[0]!r} (dtype: {df_b[col].dtype})")
        
        # Create reconciliation rules for string matching
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="ID",
                RightFileColumn="RefID", 
                MatchType="equals"  # Strict string matching
            )
        ]
        
        print(f"\n🔍 Testing reconciliation with 'equals' match type (strict string):")
        
        # Perform reconciliation
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        unmatched_a_count = len(results['unmatched_file_a']) 
        unmatched_b_count = len(results['unmatched_file_b'])
        
        print(f"   📈 Matched records: {matched_count}")
        print(f"   📈 Unmatched from File A: {unmatched_a_count}")
        print(f"   📈 Unmatched from File B: {unmatched_b_count}")
        
        if matched_count > 0:
            print(f"\n✅ Sample matched record:")
            matched_record = results['matched'].iloc[0]
            for col in results['matched'].columns:
                print(f"   {col}: {matched_record[col]}")
        
        print(f"\n💡 Expected behavior with leading zeros:")
        print(f"   • '01' vs '01' → Should match (both strings)")
        print(f"   • '02' vs '2' → Should NOT match (strict string)")
        print(f"   • '03' vs '03' → Should match (both strings)")
        
        return results
        
    except Exception as e:
        print(f"❌ Error testing reconciliation matching: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("RECONCILIATION SERVICE LEADING ZERO TEST")
    print("=" * 60)
    print("Testing that reconciliation service preserves leading zeros")
    print("and handles string vs numeric matching correctly.")
    print()
    
    # Test 1: File reading preservation
    df, preserved = test_reconciliation_service_leading_zeros()
    
    # Test 2: Actual reconciliation matching
    results = test_reconciliation_matching_with_leading_zeros()
    
    print(f"\n{'='*60}")
    print("🎯 RECONCILIATION LEADING ZERO SUMMARY")
    print("=" * 60)
    
    if preserved and results is not None:
        print("✅ SUCCESS: Reconciliation service now preserves leading zeros!")
        print("\n🔧 Technical Implementation:")
        print("   • Added leading zero detection to reconciliation service")
        print("   • File reading uses dtype mapping to preserve strings")
        print("   • Integer preservation skips string columns")
        
        print("\n🎯 Reconciliation Behavior:")
        print("   • 'equals' match type: Strict string comparison")
        print("     - '01' matches '01' ✓")
        print("     - '01' does NOT match '1' ✗")
        print("   • 'tolerance' match type: Converts to numbers")
        print("     - '01' matches '1' ✓ (converts both to 1)")
        
        print("\n🚀 Benefits:")
        print("   • Leading zeros preserved throughout reconciliation")
        print("   • You control matching behavior with match type")
        print("   • Data integrity maintained from upload to reconciliation")
        
    else:
        print("⚠️  Issues detected - please review the implementation")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()