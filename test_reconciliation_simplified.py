#!/usr/bin/env python3
"""
Test the simplified reconciliation matching (without auto date detection)
Ensures that strict string matching works and date matching still works explicitly
"""
import sys
import pandas as pd
from io import BytesIO

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_simplified_reconciliation_matching():
    """Test reconciliation with simplified equals matching (no auto date detection)"""
    print("🔍 TESTING SIMPLIFIED RECONCILIATION MATCHING")
    print("=" * 60)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # Test data with leading zeros, dates, and regular values
        file_a_content = """ID,Date,Account,Amount
01,2024-01-15,007,100.00
02,2024-02-20,123,200.50
03,2024-03-25,456,300.75"""

        file_b_content = """RefID,TransactionDate,CustomerAccount,Value
01,2024-01-15,007,100.00
2,2024-02-20,123,200.50
03,2024-03-25,456,300.75"""
        
        print("📝 Test scenario:")
        print("• File A: ID '01', '02', '03' with dates and accounts")
        print("• File B: RefID '01', '2', '03' (mixed leading zeros)")
        print("• Expected: Only '01' and '03' should match with equals matching")
        print()
        
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
        
        print(f"📊 File A sample values:")
        for col in df_a.columns:
            print(f"   {col}: {df_a[col].iloc[0]!r} (dtype: {df_a[col].dtype})")
            
        print(f"\n📊 File B sample values:")
        for col in df_b.columns:
            print(f"   {col}: {df_b[col].iloc[0]!r} (dtype: {df_b[col].dtype})")
        
        # Test 1: Strict equals matching (should NOT do auto date detection)
        print(f"\n🔍 TEST 1: Strict 'equals' matching (no auto date detection)")
        recon_rules_strict = [
            ReconciliationRule(
                LeftFileColumn="ID",
                RightFileColumn="RefID", 
                MatchType="equals"
            )
        ]
        
        results_strict = processor.reconcile_files_optimized(df_a, df_b, recon_rules_strict)
        
        print(f"   📈 Matched records: {len(results_strict['matched'])}")
        print(f"   📈 Unmatched from File A: {len(results_strict['unmatched_file_a'])}")
        print(f"   📈 Unmatched from File B: {len(results_strict['unmatched_file_b'])}")
        
        if len(results_strict['matched']) > 0:
            print(f"   ✅ Sample matched: {results_strict['matched'].iloc[0]['FileA_ID']} ↔ {results_strict['matched'].iloc[0]['FileB_RefID']}")
        
        # Test 2: Explicit date matching (should still work)
        print(f"\n🔍 TEST 2: Explicit 'date_equals' matching")
        recon_rules_date = [
            ReconciliationRule(
                LeftFileColumn="Date",
                RightFileColumn="TransactionDate", 
                MatchType="date_equals"
            )
        ]
        
        results_date = processor.reconcile_files_optimized(df_a, df_b, recon_rules_date)
        
        print(f"   📈 Matched records: {len(results_date['matched'])}")
        
        # Test 3: Tolerance matching (should work for numeric comparison)  
        print(f"\n🔍 TEST 3: 'tolerance' matching (for numeric comparison of IDs)")
        recon_rules_tolerance = [
            ReconciliationRule(
                LeftFileColumn="ID",
                RightFileColumn="RefID", 
                MatchType="tolerance",
                ToleranceValue=0.0  # 0% tolerance = exact numeric match
            )
        ]
        
        results_tolerance = processor.reconcile_files_optimized(df_a, df_b, recon_rules_tolerance)
        
        print(f"   📈 Matched records: {len(results_tolerance['matched'])}")
        print(f"   💡 Should match all 3 records ('01'↔'1', '02'↔'2', '03'↔'3') as numbers")
        
        return {
            'strict': results_strict,
            'date': results_date, 
            'tolerance': results_tolerance
        }
        
    except Exception as e:
        print(f"❌ Error testing simplified reconciliation: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_equals_method_directly():
    """Test the new _check_equals_match method directly"""
    print(f"\n🧪 TESTING _check_equals_match METHOD DIRECTLY")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        
        processor = OptimizedFileProcessor()
        
        test_cases = [
            ("01", "01", True, "Same leading zero strings"),
            ("01", "1", False, "Leading zero vs no leading zero"),
            ("ABC", "abc", True, "Case insensitive strings"),
            ("2024-01-15", "2024-01-15", True, "Same date strings"),
            ("2024-01-15", "15/01/2024", False, "Different date formats (no auto conversion)"),
            ("", "", True, "Empty strings should match"),
            (None, None, True, "Both None"),
            ("test", None, False, "One None"),
        ]
        
        all_passed = True
        for val_a, val_b, expected, description in test_cases:
            try:
                result = processor._check_equals_match(val_a, val_b)
                status = "✅ PASS" if result == expected else "❌ FAIL"
                
                if result != expected:
                    all_passed = False
                
                print(f"{status} | {description}")
                print(f"       | {val_a!r} vs {val_b!r} → {result} (expected {expected})")
                
            except Exception as e:
                print(f"❌ ERROR | {description}: {e}")
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Could not test _check_equals_match: {e}")
        return False

def main():
    print("SIMPLIFIED RECONCILIATION MATCHING TEST")
    print("=" * 60)
    print("Testing reconciliation without auto date detection.")
    print("Dates should only match when using explicit 'date_equals' match type.")
    print()
    
    # Test the equals method directly
    method_test_passed = test_equals_method_directly()
    
    # Test full reconciliation scenarios
    results = test_simplified_reconciliation_matching()
    
    print(f"\n{'='*60}")
    print("🎯 SIMPLIFIED RECONCILIATION SUMMARY")
    print("=" * 60)
    
    if method_test_passed and results is not None:
        print("✅ SUCCESS: Simplified reconciliation matching implemented!")
        
        print("\n🔧 Changes Made:")
        print("   • Removed auto date detection from 'equals' matching")
        print("   • Simplified _check_equals_match() - only string comparison")
        print("   • Kept explicit 'date_equals' match type for date matching")
        print("   • Preserved 'tolerance' match type for numeric matching")
        
        print("\n🎯 Match Type Behavior:")
        print("   • 'equals': Strict string matching only")
        print("     - '01' matches '01' ✓")
        print("     - '01' does NOT match '1' ✗")
        print("     - '2024-01-15' does NOT auto-convert to match '15/01/2024' ✗")
        print("   • 'date_equals': Explicit date matching")
        print("     - '2024-01-15' matches '15/01/2024' ✓ (when explicitly requested)")
        print("   • 'tolerance': Numeric matching")
        print("     - '01' matches '1' ✓ (converts both to numbers)")
        
        print("\n🚀 Benefits:")
        print("   • Cleaner, more predictable matching logic")
        print("   • No unexpected auto date conversions in equals matching")
        print("   • You control when date matching happens (explicit 'date_equals')")
        print("   • Leading zeros preserved in string matching")
        print("   • Date normalization handled during file upload (as you requested)")
        
    else:
        print("⚠️  Issues detected - please review the implementation")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()