#!/usr/bin/env python3
"""
Quick debug helper - copy your actual column names and values here to test
"""
import sys
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def debug_your_data():
    """
    Replace the values below with your actual data to debug
    """
    print("🔍 DEBUGGING YOUR ACTUAL DATA")
    print("=" * 40)
    
    # TODO: Replace these with your actual values
    file_a_columns = ["TransactionID", "Amount"]  # ← Put your File A column names here
    file_b_columns = ["RefID", "Value"]           # ← Put your File B column names here
    
    # TODO: Replace these with actual values from your files
    file_a_sample_value = "'01"  # ← Put actual value from File A here  
    file_b_sample_value = "'01"  # ← Put actual value from File B here
    
    # TODO: Replace with your actual reconciliation rule
    left_column = "TransactionID"   # ← Your rule's LeftFileColumn
    right_column = "RefID"          # ← Your rule's RightFileColumn
    
    print(f"📊 Your File A columns: {file_a_columns}")
    print(f"📊 Your File B columns: {file_b_columns}")
    print()
    
    print(f"🔍 Your reconciliation rule:")
    print(f"   LeftFileColumn: '{left_column}'")
    print(f"   RightFileColumn: '{right_column}'")
    print()
    
    # Check if rule columns exist in files
    left_exists = left_column in file_a_columns
    right_exists = right_column in file_b_columns
    
    print(f"✓ Column existence check:")
    print(f"   '{left_column}' in File A: {'✅' if left_exists else '❌'}")
    print(f"   '{right_column}' in File B: {'✅' if right_exists else '❌'}")
    
    if not left_exists or not right_exists:
        print(f"\n❌ ISSUE FOUND: Column names in rule don't match file columns!")
        print(f"   Fix: Update your reconciliation rule to use correct column names")
        return False
    
    print(f"\n🔍 Sample value comparison:")
    print(f"   File A value: {file_a_sample_value!r}")
    print(f"   File B value: {file_b_sample_value!r}")
    print(f"   Length A: {len(file_a_sample_value)}")
    print(f"   Length B: {len(file_b_sample_value)}")
    print(f"   ASCII A: {[ord(c) for c in file_a_sample_value]}")
    print(f"   ASCII B: {[ord(c) for c in file_b_sample_value]}")
    print(f"   Direct equality: {file_a_sample_value == file_b_sample_value}")
    
    # Test reconciliation matching
    try:
        from app.services.reconciliation_service import OptimizedFileProcessor
        processor = OptimizedFileProcessor()
        
        match_result = processor._check_equals_match(file_a_sample_value, file_b_sample_value)
        print(f"   Reconciliation match: {match_result}")
        
        if not match_result:
            print(f"   ❌ VALUES DON'T MATCH IN RECONCILIATION!")
        else:
            print(f"   ✅ Values match in reconciliation")
            
    except Exception as e:
        print(f"   ❌ Error testing match: {e}")
    
    return True

def main():
    print("QUICK DEBUG HELPER")
    print("=" * 40)
    print("Update this script with your actual data to debug the issue")
    print()
    
    # Run debug with your data
    success = debug_your_data()
    
    print(f"\n{'='*40}")
    print("🎯 NEXT STEPS:")
    print("=" * 40)
    
    if success:
        print("1. ✅ Update the values in this script with your actual data")
        print("2. ✅ Run this script again to see the exact issue")
        print("3. ✅ Share the output to get specific help")
    else:
        print("1. ❌ Fix your reconciliation rule column names")
        print("2. ❌ Ensure column names match exactly (case-sensitive)")
    
    print(f"\n💬 TO GET HELP:")
    print("Share these details:")
    print("1. Your File A column names")
    print("2. Your File B column names") 
    print("3. Your reconciliation rule configuration")
    print("4. Sample values that should match but don't")

if __name__ == "__main__":
    main()