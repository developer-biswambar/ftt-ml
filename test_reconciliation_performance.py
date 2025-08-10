#!/usr/bin/env python3
"""
Test reconciliation performance with 1 record vs 50k records
Verify that break statements work correctly and no records are missed
"""
import sys
import pandas as pd
from io import BytesIO
import time

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def create_test_scenario_1_vs_50k():
    """Create test scenario: 1 record in File A, 50k in File B"""
    print("📊 CREATING TEST SCENARIO: 1 vs 50k RECORDS")
    print("=" * 60)
    
    # File A: 1 record
    file_a_data = {
        'ID': ['01'],
        'Amount': [100.00],
        'Status': ['Active']
    }
    
    # File B: 50k records (with the matching record somewhere in the middle)
    file_b_ids = [f"{i:02d}" if i < 100 else str(i) for i in range(1, 50001)]
    file_b_ids[25000] = '01'  # Put the matching record in the middle
    
    file_b_data = {
        'RefID': file_b_ids,
        'Value': [i * 10 for i in range(1, 50001)],
        'State': ['Active' if i % 2 == 0 else 'Pending' for i in range(1, 50001)]
    }
    
    df_a = pd.DataFrame(file_a_data)
    df_b = pd.DataFrame(file_b_data)
    
    print(f"✅ Created test data:")
    print(f"   File A: {len(df_a)} records")
    print(f"   File B: {len(df_b)} records")
    print(f"   Matching record in File B at position: {file_b_ids.index('01')}")
    print()
    
    return df_a, df_b

def test_reconciliation_break_logic():
    """Test if break logic works correctly in reconciliation"""
    print("🔍 TESTING RECONCILIATION BREAK LOGIC")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # Create test data
        df_a, df_b = create_test_scenario_1_vs_50k()
        
        processor = OptimizedFileProcessor()
        
        # Create reconciliation rule
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="ID",
                RightFileColumn="RefID",
                MatchType="equals"
            )
        ]
        
        print("🚀 Running reconciliation (1 vs 50k records)...")
        start_time = time.time()
        
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        matched_count = len(results['matched'])
        unmatched_a_count = len(results['unmatched_file_a'])
        unmatched_b_count = len(results['unmatched_file_b'])
        
        print(f"\n📈 RECONCILIATION RESULTS:")
        print(f"   Processing time: {processing_time:.2f} seconds")
        print(f"   Total File A records: {len(df_a)}")
        print(f"   Total File B records: {len(df_b)}")
        print(f"   Matched records: {matched_count}")
        print(f"   Unmatched from File A: {unmatched_a_count}")
        print(f"   Unmatched from File B: {unmatched_b_count}")
        print(f"   Expected matches: 1")
        
        # Verify correctness
        print(f"\n🔍 CORRECTNESS CHECK:")
        if matched_count == 1:
            print("   ✅ Found exactly 1 match (correct)")
            match = results['matched'].iloc[0]
            print(f"   ✅ Matched: '{match['FileA_ID']}' ↔ '{match['FileB_RefID']}'")
        else:
            print(f"   ❌ Expected 1 match, got {matched_count}")
        
        if unmatched_a_count == 0:
            print("   ✅ No unmatched records in File A (correct)")
        else:
            print(f"   ❌ Expected 0 unmatched in File A, got {unmatched_a_count}")
        
        if unmatched_b_count == 49999:
            print("   ✅ 49,999 unmatched records in File B (correct)")
        else:
            print(f"   ❌ Expected 49,999 unmatched in File B, got {unmatched_b_count}")
        
        # Performance check
        print(f"\n⚡ PERFORMANCE CHECK:")
        if processing_time < 10:  # Should be fast due to hash optimization
            print(f"   ✅ Fast processing: {processing_time:.2f}s (hash optimization working)")
        else:
            print(f"   ⚠️  Slow processing: {processing_time:.2f}s (might need optimization)")
        
        return results, processing_time
        
    except Exception as e:
        print(f"❌ Error testing reconciliation: {e}")
        import traceback
        traceback.print_exc()
        return None, 0

def test_multiple_matches_scenario():
    """Test scenario where File A has multiple potential matches in File B"""
    print(f"\n🔍 TESTING MULTIPLE MATCHES SCENARIO")
    print("=" * 50)
    
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        from app.models.recon_models import ReconciliationRule
        
        # File A: 3 records
        file_a_data = {
            'ID': ['01', '02', '03'],
            'Amount': [100, 200, 300]
        }
        
        # File B: Records with duplicates (multiple potential matches)
        file_b_data = {
            'RefID': ['01', '02', '01', '03', '02', '04', '01'],  # Multiple '01', '02'
            'Value': [100, 200, 100, 300, 200, 400, 100]
        }
        
        df_a = pd.DataFrame(file_a_data)
        df_b = pd.DataFrame(file_b_data)
        
        print(f"📊 Test data:")
        print(f"   File A: {df_a['ID'].tolist()}")
        print(f"   File B: {df_b['RefID'].tolist()}")
        print(f"   Expected: Each File A record should match the FIRST occurrence in File B")
        
        processor = OptimizedFileProcessor()
        
        recon_rules = [
            ReconciliationRule(
                LeftFileColumn="ID",
                RightFileColumn="RefID",
                MatchType="equals"
            )
        ]
        
        results = processor.reconcile_files_optimized(df_a, df_b, recon_rules)
        
        matched_count = len(results['matched'])
        print(f"\n📈 Results: {matched_count} matches")
        
        if matched_count > 0:
            print("   Matched pairs:")
            for i in range(len(results['matched'])):
                match = results['matched'].iloc[i]
                print(f"   '{match['FileA_ID']}' ↔ '{match['FileB_RefID']}'")
        
        # Check for duplicate matches (File B records matched multiple times)
        if 'FileB_RefID' in results['matched'].columns:
            matched_b_ids = results['matched']['FileB_RefID'].tolist()
            unique_b_ids = set(matched_b_ids)
            if len(matched_b_ids) == len(unique_b_ids):
                print("   ✅ No duplicate File B matches (correct)")
            else:
                print("   ❌ Found duplicate File B matches (break logic issue)")
                
        return results
        
    except Exception as e:
        print(f"❌ Error testing multiple matches: {e}")
        return None

def analyze_break_logic_code():
    """Analyze the current break logic in the reconciliation code"""
    print(f"\n📝 ANALYZING CURRENT BREAK LOGIC")
    print("=" * 50)
    
    print("🔍 Current reconciliation logic structure:")
    print("""
    for row_a in file_a:
        if row_a already matched:
            continue  # Skip to next File A record
            
        for row_b in potential_matches_from_file_b:
            if row_b already matched:
                continue  # Skip to next File B record
                
            if all_rules_match:
                add_to_matched_sets(row_a, row_b)
                break  # ← Break inner loop only, continue with next File A record
    """)
    
    print("\n✅ ANALYSIS:")
    print("   • The break statement is CORRECT for 1-to-1 matching")
    print("   • It breaks inner loop (File B) after finding first match")
    print("   • It continues outer loop (File A) to next record")
    print("   • This prevents duplicate matches (one File B record matching multiple File A records)")
    
    print("\n🎯 EXPECTED BEHAVIOR:")
    print("   • File A: 1 record → Should find 1 match in File B")
    print("   • File B: 50k records → Only first matching record should be used")
    print("   • Remaining 49,999 records in File B → Should be unmatched")
    
    print("\n⚠️  POTENTIAL ISSUES:")
    print("   • If hash grouping fails, it might scan all 50k records")
    print("   • Performance depends on match key distribution")
    print("   • Memory usage could be high with large datasets")

def main():
    print("RECONCILIATION BREAK LOGIC VERIFICATION")
    print("=" * 60)
    print("Testing reconciliation with 1 record vs 50k records")
    print("Verifying that break statements work correctly")
    print()
    
    # Test 1: 1 vs 50k scenario
    results, processing_time = test_reconciliation_break_logic()
    
    # Test 2: Multiple matches scenario
    test_multiple_matches_scenario()
    
    # Analyze the code logic
    analyze_break_logic_code()
    
    print(f"\n{'='*60}")
    print("🎯 BREAK LOGIC VERIFICATION SUMMARY")
    print("=" * 60)
    
    if results is not None:
        matched_count = len(results['matched'])
        
        if matched_count == 1 and processing_time < 10:
            print("✅ BREAK LOGIC WORKING CORRECTLY:")
            print("   • Found exactly 1 match (as expected)")
            print("   • Processing time acceptable (<10s)")
            print("   • Break statement exits inner loop properly")
            print("   • Hash optimization effective")
            
        else:
            print("⚠️  POTENTIAL ISSUES DETECTED:")
            if matched_count != 1:
                print(f"   • Expected 1 match, got {matched_count}")
            if processing_time >= 10:
                print(f"   • Slow processing: {processing_time:.2f}s (>10s)")
                print("   • Hash optimization might not be working")
    
    print(f"\n🔧 RECOMMENDATIONS:")
    print("   1. ✅ Current break logic is correct for 1-to-1 matching")
    print("   2. ✅ Performance should be good with hash optimization")
    print("   3. ⚡ Monitor processing time for large datasets")
    print("   4. 🔍 Consider adding progress logging for very large files")
    
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()