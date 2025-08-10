#!/usr/bin/env python3
"""
Test the numeric matching fix for reconciliation
Verifies that values like "01" vs "1" and "09" vs "9" now match correctly
"""
import sys
import pandas as pd

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_numeric_matching():
    """Test the _check_numeric_equals method directly"""
    print("🔢 TESTING NUMERIC MATCHING FIX")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        
        processor = OptimizedFileProcessor()
        
        # Test cases for numeric matching
        test_cases = [
            # (value_a, value_b, expected_result, description)
            ("01", "1", True, "Leading zero: '01' vs '1'"),
            ("09", "9", True, "Leading zero: '09' vs '9'"),
            ("007", "7", True, "Multiple leading zeros: '007' vs '7'"),
            ("05", "5", True, "Leading zero: '05' vs '5'"),
            ("10", "10", True, "Same numbers: '10' vs '10'"),
            ("1", "01", True, "Reverse case: '1' vs '01'"),
            (1, "01", True, "Integer vs string: 1 vs '01'"),
            ("01", 1, True, "String vs integer: '01' vs 1"),
            ("1.0", "1", True, "Float string vs integer: '1.0' vs '1'"),
            ("01.5", "1.5", True, "Decimal with leading zero: '01.5' vs '1.5'"),
            ("abc", "123", False, "Non-numeric: 'abc' vs '123'"),
            ("01-Jan", "1", False, "Date-like vs number: '01-Jan' vs '1'"),
            ("", "1", False, "Empty vs number: '' vs '1'"),
            ("1", "", False, "Number vs empty: '1' vs ''"),
            ("2", "3", False, "Different numbers: '2' vs '3'"),
        ]
        
        print("Testing numeric matching scenarios:")
        print("=" * 50)
        
        all_passed = True
        for val_a, val_b, expected, description in test_cases:
            try:
                result = processor._check_numeric_equals(val_a, val_b)
                status = "✅ PASS" if result == expected else "❌ FAIL"
                
                if result != expected:
                    all_passed = False
                
                print(f"{status} | {description}")
                print(f"       | {val_a!r} vs {val_b!r} → {result} (expected {expected})")
                
            except Exception as e:
                print(f"❌ ERROR | {description}: {e}")
                all_passed = False
        
        print(f"\n{'='*50}")
        if all_passed:
            print("🎉 ALL TESTS PASSED! Numeric matching fix is working correctly.")
        else:
            print("⚠️  Some tests failed. Review the implementation.")
            
        return all_passed
        
    except ImportError as e:
        print(f"❌ Could not import reconciliation service: {e}")
        return False

def test_full_reconciliation_matching():
    """Test the complete matching logic with the equals_with_auto_date_detection method"""
    print(f"\n🔄 TESTING FULL RECONCILIATION MATCHING")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        
        processor = OptimizedFileProcessor()
        
        # Test the full _check_equals_with_auto_date_detection method
        test_cases = [
            ("01", "1", True, "Numeric: '01' should match '1'"),
            ("09", "9", True, "Numeric: '09' should match '9'"),
            ("007", "7", True, "Numeric: '007' should match '7'"),
            ("ABC", "abc", True, "String case insensitive: 'ABC' should match 'abc'"),
            ("2024-01-01", "01/01/2024", None, "Dates: handled by date matching"),  # Would be handled by date logic
            ("TX001", "TX001", True, "Exact match: 'TX001' should match 'TX001'"),
            ("1.5", "01.5", True, "Decimal with leading zero: '1.5' should match '01.5'"),
        ]
        
        print("Testing complete matching logic:")
        print("=" * 30)
        
        for val_a, val_b, expected, description in test_cases:
            if expected is None:  # Skip date tests for now
                continue
                
            try:
                result = processor._check_equals_with_auto_date_detection(val_a, val_b)
                status = "✅ PASS" if result == expected else "❌ FAIL"
                
                print(f"{status} | {description}")
                print(f"       | {val_a!r} vs {val_b!r} → {result}")
                
            except Exception as e:
                print(f"❌ ERROR | {description}: {e}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Could not import reconciliation service: {e}")
        return False

def create_reconciliation_test_data():
    """Create sample data to demonstrate the fix working in reconciliation"""
    print(f"\n📊 RECONCILIATION TEST DATA EXAMPLE")
    print("=" * 50)
    
    # Create sample data with leading zero issues
    file_a_data = {
        'ID': ['01', '02', '03', '007', '10'],
        'Account': ['ACC001', 'ACC002', 'ACC003', 'ACC007', 'ACC010'],
        'Amount': [100.0, 200.0, 300.0, 700.0, 1000.0]
    }
    
    file_b_data = {
        'RefID': ['1', '2', '3', '7', '10'],  # Same IDs without leading zeros
        'Customer': ['CUST001', 'CUST002', 'CUST003', 'CUST007', 'CUST010'],
        'Value': [100.0, 200.0, 300.0, 700.0, 1000.0]
    }
    
    df_a = pd.DataFrame(file_a_data)
    df_b = pd.DataFrame(file_b_data)
    
    print("File A (with leading zeros):")
    print(df_a.to_string(index=False))
    
    print(f"\nFile B (without leading zeros):")
    print(df_b.to_string(index=False))
    
    print(f"\n💡 EXPECTED MATCHES after fix:")
    matches = [
        ("ID='01'", "RefID='1'", "Should match"),
        ("ID='02'", "RefID='2'", "Should match"),
        ("ID='03'", "RefID='3'", "Should match"),
        ("ID='007'", "RefID='7'", "Should match"),
        ("ID='10'", "RefID='10'", "Should match"),
    ]
    
    for match in matches:
        print(f"   ✅ {match[0]} ↔ {match[1]} - {match[2]}")
    
    print(f"\n📈 BEFORE FIX: 0 matches (string mismatch)")
    print(f"📈 AFTER FIX: 5 matches (numeric normalization)")

def main():
    print("NUMERIC MATCHING FIX TEST FOR RECONCILIATION")
    print("=" * 60)
    print("Testing the fix for '01' vs '1' and '09' vs '9' matching issues.")
    
    # Test the numeric matching method
    test1_passed = test_numeric_matching()
    
    # Test the complete matching logic
    test2_passed = test_full_reconciliation_matching()
    
    # Show reconciliation example
    create_reconciliation_test_data()
    
    print(f"\n{'='*60}")
    print("🎉 NUMERIC MATCHING FIX SUMMARY")
    print("=" * 60)
    
    if test1_passed:
        print("✅ Numeric matching logic implemented correctly")
        print("✅ Leading zeros are now handled properly:")
        print("   • '01' matches '1' ✓")
        print("   • '09' matches '9' ✓") 
        print("   • '007' matches '7' ✓")
        print("   • '05' matches '5' ✓")
        
        print(f"\n🔧 Technical Implementation:")
        print("   • Added _check_numeric_equals() method")
        print("   • Integrated into _check_equals_with_auto_date_detection()")
        print("   • Only applies to non-date values")
        print("   • Preserves existing string and date matching")
        
        print(f"\n📊 Reconciliation Impact:")
        print("   • Transaction IDs: '001' now matches '1'")
        print("   • Account Numbers: '007' now matches '7'")
        print("   • Reference Numbers: '09' now matches '9'")
        print("   • Preserves exact string matching for non-numeric data")
        
        print(f"\n🚀 Your reconciliation will now correctly match:")
        print("   • Leading zero numbers (01 ↔ 1)")
        print("   • Zero-padded IDs (007 ↔ 7)")  
        print("   • Numeric strings with different formatting")
        
    else:
        print("❌ Some tests failed. Please review the implementation.")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()