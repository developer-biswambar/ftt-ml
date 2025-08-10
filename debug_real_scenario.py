#!/usr/bin/env python3
"""
Debug real-world reconciliation scenario
Check for other potential issues that could cause matching failures
"""
import sys
import pandas as pd
from io import BytesIO

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_potential_issues():
    """Test various potential issues that could cause reconciliation failures"""
    print("🔍 TESTING POTENTIAL RECONCILIATION ISSUES")
    print("=" * 60)
    
    # Scenario 1: Different column names
    print("📊 SCENARIO 1: Different column names between files")
    file_a_data = {
        'TransactionID': ["'01", "'07", "'10"],  # Column name: TransactionID
        'Amount': [100, 700, 1000]
    }
    file_b_data = {
        'ID': ["'01", "'07", "'10"],  # Column name: ID (different!)
        'Value': [100, 700, 1000]
    }
    
    df_a = pd.DataFrame(file_a_data)
    df_b = pd.DataFrame(file_b_data)
    
    print(f"   File A columns: {list(df_a.columns)}")
    print(f"   File B columns: {list(df_b.columns)}")
    print(f"   ❌ Issue: Column names don't match (TransactionID vs ID)")
    print()
    
    # Scenario 2: Case sensitivity in column names
    print("📊 SCENARIO 2: Case sensitivity in column names")
    file_a_case = {
        'TransactionID': ["'01", "'07", "'10"],
        'Amount': [100, 700, 1000]
    }
    file_b_case = {
        'transactionid': ["'01", "'07", "'10"],  # lowercase
        'amount': [100, 700, 1000]
    }
    
    df_a_case = pd.DataFrame(file_a_case)
    df_b_case = pd.DataFrame(file_b_case)
    
    print(f"   File A columns: {list(df_a_case.columns)}")
    print(f"   File B columns: {list(df_b_case.columns)}")
    print(f"   ❌ Issue: Column case doesn't match (TransactionID vs transactionid)")
    print()
    
    # Scenario 3: Hidden characters or encoding issues
    print("📊 SCENARIO 3: Hidden characters or encoding")
    test_values = [
        ("'01", "'01"),  # Normal case
        ("'01", "'01 "),  # Trailing space in second value
        ("'01", " '01"),  # Leading space in second value
        ("'01", "'01\n"),  # Hidden newline
        ("'01", "'０1"),  # Different character (fullwidth zero)
    ]
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        processor = OptimizedFileProcessor()
        
        for i, (val_a, val_b) in enumerate(test_values):
            print(f"   Test {i+1}: {val_a!r} vs {val_b!r}")
            result = processor._check_equals_match(val_a, val_b)
            print(f"            Match: {result}")
            
            if not result and i > 0:  # Skip the normal case
                print(f"            Length A: {len(val_a)}, Length B: {len(val_b)}")
                print(f"            ASCII A: {[ord(c) for c in val_a]}")
                print(f"            ASCII B: {[ord(c) for c in val_b]}")
            print()
            
    except Exception as e:
        print(f"   ❌ Error testing hidden characters: {e}")
    
    # Scenario 4: Data type mismatches after reading
    print("📊 SCENARIO 4: Mixed data types")
    mixed_data_a = {
        'ID': ["'01", 2, "'07"],  # Mixed strings and integers
        'Amount': [100, 200, 700]
    }
    mixed_data_b = {
        'ID': [1, "'02", 7],  # Different mix
        'Amount': [100, 200, 700]
    }
    
    df_mixed_a = pd.DataFrame(mixed_data_a)
    df_mixed_b = pd.DataFrame(mixed_data_b)
    
    print(f"   File A ID values: {df_mixed_a['ID'].tolist()}")
    print(f"   File A ID types: {[type(x).__name__ for x in df_mixed_a['ID'].tolist()]}")
    print(f"   File B ID values: {df_mixed_b['ID'].tolist()}")
    print(f"   File B ID types: {[type(x).__name__ for x in df_mixed_b['ID'].tolist()]}")
    print(f"   ❌ Issue: Mixed data types can cause match failures")
    print()

def test_reconciliation_rule_configuration():
    """Test if reconciliation rule configuration might be the issue"""
    print("🔍 TESTING RECONCILIATION RULE CONFIGURATION")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # Create simple test data
        file_a_data = {
            'TransactionID': ["'01", "'07", "'10"],
            'Amount': [100, 700, 1000]
        }
        file_b_data = {
            'RefID': ["'01", "'07", "'10"], 
            'Value': [100, 700, 1000]
        }
        
        df_a = pd.DataFrame(file_a_data)
        df_b = pd.DataFrame(file_b_data)
        
        processor = OptimizedFileProcessor()
        
        # Test different rule configurations
        test_rules = [
            {
                "name": "Correct mapping",
                "rule": ReconciliationRule(
                    LeftFileColumn="TransactionID",
                    RightFileColumn="RefID",
                    MatchType="equals"
                )
            },
            {
                "name": "Wrong left column",
                "rule": ReconciliationRule(
                    LeftFileColumn="ID",  # Wrong column name
                    RightFileColumn="RefID",
                    MatchType="equals"
                )
            },
            {
                "name": "Wrong right column", 
                "rule": ReconciliationRule(
                    LeftFileColumn="TransactionID",
                    RightFileColumn="ID",  # Wrong column name
                    MatchType="equals"
                )
            },
            {
                "name": "Case sensitive column",
                "rule": ReconciliationRule(
                    LeftFileColumn="transactionid",  # Wrong case
                    RightFileColumn="RefID",
                    MatchType="equals"
                )
            }
        ]
        
        for test_config in test_rules:
            print(f"🧪 Testing: {test_config['name']}")
            try:
                results = processor.reconcile_files_optimized(df_a, df_b, [test_config['rule']])
                matched = len(results['matched'])
                print(f"   Result: {matched} matches (expected: 3)")
                if matched < 3:
                    print(f"   ❌ Issue confirmed: {test_config['name']}")
                else:
                    print(f"   ✅ Working correctly")
            except Exception as e:
                print(f"   ❌ Error: {e}")
            print()
            
    except Exception as e:
        print(f"❌ Error testing rules: {e}")

def create_debug_checklist():
    """Create a checklist for debugging real reconciliation issues"""
    print("📝 RECONCILIATION DEBUG CHECKLIST")
    print("=" * 50)
    
    checklist = [
        "1. ✓ Column names match exactly between files",
        "2. ✓ Column case matches (TransactionID vs transactionid)",
        "3. ✓ Data values match (including apostrophe prefix)",
        "4. ✓ No hidden characters (spaces, newlines, tabs)",
        "5. ✓ Consistent data types (all strings or all numbers)",
        "6. ✓ Reconciliation rules point to correct columns", 
        "7. ✓ Match type is appropriate (equals vs tolerance)",
        "8. ✓ Files read correctly by reconciliation service",
        "9. ✓ Leading zero detection working (if needed)",
        "10. ✓ No encoding issues (UTF-8 vs other encodings)"
    ]
    
    for item in checklist:
        print(f"   {item}")
    
    print(f"\n🔧 DEBUGGING STEPS:")
    print("   1. Check your reconciliation rule configuration")
    print("   2. Verify column names match exactly (case-sensitive)")
    print("   3. Sample a few records and test matching manually")
    print("   4. Check for hidden characters in cell values")
    print("   5. Ensure both files use consistent apostrophe prefix")

def main():
    print("REAL-WORLD RECONCILIATION DEBUG")
    print("=" * 60)
    print("Since apostrophe prefix works in tests, checking other issues")
    print()
    
    # Test potential issues
    test_potential_issues()
    
    # Test rule configuration
    test_reconciliation_rule_configuration()
    
    # Create debug checklist
    create_debug_checklist()
    
    print(f"\n{'='*60}")
    print("🎯 NEXT STEPS FOR YOUR RECONCILIATION ISSUE")
    print("=" * 60)
    
    print("✅ CONFIRMED WORKING:")
    print("   • Apostrophe prefix ('01) handling works correctly")
    print("   • Basic reconciliation matching logic is sound")
    
    print(f"\n🔍 LIKELY CAUSES OF YOUR ISSUE:")
    print("   1. ❌ Column name mismatch (TransactionID vs ID)")
    print("   2. ❌ Case sensitivity (TransactionID vs transactionid)")
    print("   3. ❌ Hidden characters in data (spaces, newlines)")
    print("   4. ❌ Inconsistent apostrophe prefix usage")
    print("   5. ❌ Wrong reconciliation rule configuration")
    
    print(f"\n🛠️ IMMEDIATE ACTIONS:")
    print("   1. Check your reconciliation rule column mappings")
    print("   2. Verify column names match exactly between files")
    print("   3. Sample 2-3 records and test matching manually")
    print("   4. Share your actual rule configuration for review")
    
    print(f"\n💡 MANUAL VERIFICATION QUESTION:")
    print("   When you manually verify '01 matches '01, are you:")
    print("   • Looking at the same column names in both files?")
    print("   • Using the same match criteria as your reconciliation rule?")
    print("   • Checking the exact same records that reconciliation processed?")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()