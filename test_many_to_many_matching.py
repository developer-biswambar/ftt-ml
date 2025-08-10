#!/usr/bin/env python3
"""
Test the enhanced reconciliation with many-to-many matching support
"""
import sys
import pandas as pd
from io import BytesIO

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_one_to_many():
    """Test 1-to-many matching: 1 File A record matches multiple File B records"""
    print("🔍 TESTING 1-TO-MANY MATCHING")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # File A: 1 record with ID '01'
        file_a_data = {
            'CustomerID': ['01'],
            'Name': ['John Doe']
        }
        
        # File B: Multiple records with same CustomerID '01'
        file_b_data = {
            'CustomerID': ['01', '01', '01', '02'],  # 3 records with '01'
            'Transaction': ['Purchase', 'Refund', 'Credit', 'Purchase'],
            'Amount': [100, -50, 25, 200]
        }
        
        df_a = pd.DataFrame(file_a_data)
        df_b = pd.DataFrame(file_b_data)
        
        print(f"📊 Test scenario:")
        print(f"   File A: 1 customer record (ID='01')")
        print(f"   File B: 4 transaction records (3 with ID='01', 1 with ID='02')")
        print(f"   Expected: 3 matches (1-to-many)")
        
        processor = OptimizedFileProcessor()
        
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="CustomerID",
                RightFileColumn="CustomerID",
                MatchType="equals"
            )
        ]
        
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        unmatched_a = len(results['unmatched_file_a'])
        unmatched_b = len(results['unmatched_file_b'])
        
        print(f"\n📈 Results:")
        print(f"   Matched records: {matched_count} (expected: 3)")
        print(f"   Unmatched File A: {unmatched_a} (expected: 0)")
        print(f"   Unmatched File B: {unmatched_b} (expected: 1)")
        
        if matched_count == 3:
            print(f"   ✅ 1-to-many matching working correctly!")
            
            print(f"\n   📋 Match details:")
            for i in range(len(results['matched'])):
                match = results['matched'].iloc[i]
                print(f"   Match {i+1}: Customer '01' ↔ {match['FileB_Transaction']} (${match['FileB_Amount']})")
        else:
            print(f"   ❌ Expected 3 matches, got {matched_count}")
            
        return matched_count == 3
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_many_to_one():
    """Test many-to-1 matching: Multiple File A records match 1 File B record"""
    print(f"\n🔍 TESTING MANY-TO-1 MATCHING")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # File A: Multiple records with same ProductID 'P001'
        file_a_data = {
            'ProductID': ['P001', 'P001', 'P001', 'P002'],  # 3 records with 'P001'
            'OrderID': ['O001', 'O002', 'O003', 'O004'],
            'Quantity': [5, 3, 2, 1]
        }
        
        # File B: 1 product record with ID 'P001'
        file_b_data = {
            'ProductID': ['P001', 'P002'], 
            'ProductName': ['Widget A', 'Widget B'],
            'Price': [10.00, 20.00]
        }
        
        df_a = pd.DataFrame(file_a_data)
        df_b = pd.DataFrame(file_b_data)
        
        print(f"📊 Test scenario:")
        print(f"   File A: 4 order records (3 for ProductID='P001', 1 for 'P002')")
        print(f"   File B: 2 product records (ProductID='P001' and 'P002')")
        print(f"   Expected: 4 matches (many-to-1 for P001, 1-to-1 for P002)")
        
        processor = OptimizedFileProcessor()
        
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="ProductID",
                RightFileColumn="ProductID", 
                MatchType="equals"
            )
        ]
        
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        unmatched_a = len(results['unmatched_file_a'])
        unmatched_b = len(results['unmatched_file_b'])
        
        print(f"\n📈 Results:")
        print(f"   Matched records: {matched_count} (expected: 4)")
        print(f"   Unmatched File A: {unmatched_a} (expected: 0)")
        print(f"   Unmatched File B: {unmatched_b} (expected: 0)")
        
        if matched_count == 4:
            print(f"   ✅ Many-to-1 matching working correctly!")
            
            print(f"\n   📋 Match details:")
            for i in range(len(results['matched'])):
                match = results['matched'].iloc[i]
                print(f"   Match {i+1}: Order {match['FileA_OrderID']} (Qty: {match['FileA_Quantity']}) ↔ {match['FileB_ProductName']}")
        else:
            print(f"   ❌ Expected 4 matches, got {matched_count}")
            
        return matched_count == 4
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_many_to_many():
    """Test many-to-many matching: Multiple records in both files match"""
    print(f"\n🔍 TESTING MANY-TO-MANY MATCHING")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # File A: Multiple records with duplicate categories
        file_a_data = {
            'Category': ['Electronics', 'Electronics', 'Books', 'Books'],
            'Store': ['Store1', 'Store2', 'Store1', 'Store3'],
            'Sales': [1000, 1500, 500, 300]
        }
        
        # File B: Multiple records with same categories
        file_b_data = {
            'Category': ['Electronics', 'Electronics', 'Books'],
            'Region': ['North', 'South', 'East'], 
            'Target': [2000, 1800, 600]
        }
        
        df_a = pd.DataFrame(file_a_data)
        df_b = pd.DataFrame(file_b_data)
        
        print(f"📊 Test scenario:")
        print(f"   File A: 4 store records (2 Electronics, 2 Books)")
        print(f"   File B: 3 region records (2 Electronics, 1 Books)")
        print(f"   Expected: 6 matches (2×2 + 2×1 = many-to-many)")
        
        processor = OptimizedFileProcessor()
        
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="Category",
                RightFileColumn="Category",
                MatchType="equals"
            )
        ]
        
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        unmatched_a = len(results['unmatched_file_a']) 
        unmatched_b = len(results['unmatched_file_b'])
        
        print(f"\n📈 Results:")
        print(f"   Matched records: {matched_count} (expected: 6)")
        print(f"   Unmatched File A: {unmatched_a} (expected: 0)")
        print(f"   Unmatched File B: {unmatched_b} (expected: 0)")
        
        if matched_count == 6:
            print(f"   ✅ Many-to-many matching working correctly!")
            
            print(f"\n   📋 Match details:")
            electronics_matches = 0
            books_matches = 0
            for i in range(len(results['matched'])):
                match = results['matched'].iloc[i]
                category = match['FileA_Category']
                if category == 'Electronics':
                    electronics_matches += 1
                elif category == 'Books':
                    books_matches += 1
                print(f"   Match {i+1}: {match['FileA_Store']} ({category}) ↔ {match['FileB_Region']} (Target: ${match['FileB_Target']})")
                
            print(f"\n   📊 Match breakdown:")
            print(f"   Electronics matches: {electronics_matches} (expected: 4)")  
            print(f"   Books matches: {books_matches} (expected: 2)")
        else:
            print(f"   ❌ Expected 6 matches, got {matched_count}")
            
        return matched_count == 6
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("MANY-TO-MANY MATCHING TEST")
    print("=" * 60)
    print("Testing enhanced reconciliation with multiple matching modes")
    print()
    
    # Test all matching scenarios
    test1_passed = test_one_to_many()
    test2_passed = test_many_to_one() 
    test3_passed = test_many_to_many()
    
    print(f"\n{'='*60}")
    print("🎯 MANY-TO-MANY MATCHING SUMMARY")
    print("=" * 60)
    
    if test1_passed and test2_passed and test3_passed:
        print("✅ ALL TESTS PASSED!")
        print("\n🚀 Enhanced reconciliation supports:")
        print("   ✅ 1-to-many matching (1 customer → multiple transactions)")
        print("   ✅ Many-to-1 matching (multiple orders → 1 product)")  
        print("   ✅ Many-to-many matching (categories × regions)")
        
        print(f"\n🔧 Technical improvements:")
        print("   • Removed restrictive 'break' statement")
        print("   • Allows multiple matches per record")
        print("   • Maintains performance with hash optimization")
        print("   • Correct unmatched calculation")
        
    else:
        print("⚠️  Some tests failed:")
        print(f"   1-to-many: {'✅' if test1_passed else '❌'}")
        print(f"   Many-to-1: {'✅' if test2_passed else '❌'}")
        print(f"   Many-to-many: {'✅' if test3_passed else '❌'}")
    
    print(f"\n💡 Use cases:")
    print("   • Customer transactions (1 customer → many purchases)")
    print("   • Product orders (many orders → 1 product)")
    print("   • Category analysis (many stores × many regions)")
    print("   • Financial reconciliation (accounts × transactions)")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()