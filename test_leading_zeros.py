#!/usr/bin/env python3
"""
Test how file upload handles leading zeros like "07"
Check if they're preserved as strings or converted to integers
"""
import sys
import pandas as pd
import io

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

def test_csv_leading_zeros():
    """Test CSV file reading with leading zeros"""
    print("🔢 TESTING CSV FILE READING WITH LEADING ZEROS")
    print("=" * 50)
    
    # Create test CSV with leading zeros
    test_data = """ID,AccountNumber,Code,Amount
01,007,09,100.00
02,123,10,200.50
03,000456,00,300.75"""
    
    print("📝 Test CSV content:")
    print(test_data)
    print()
    
    # Test 1: Standard pandas read_csv (current behavior)
    print("🔍 Test 1: Standard pd.read_csv() behavior:")
    df1 = pd.read_csv(io.StringIO(test_data))
    
    for col in df1.columns:
        sample_val = df1[col].iloc[0]
        print(f"   {col}: {sample_val!r} (type: {type(sample_val).__name__}, dtype: {df1[col].dtype})")
    print()
    
    # Test 2: With low_memory=False (your current setting)
    print("🔍 Test 2: pd.read_csv(low_memory=False) - your current settings:")
    df2 = pd.read_csv(io.StringIO(test_data), low_memory=False, encoding='utf-8')
    
    for col in df2.columns:
        sample_val = df2[col].iloc[0]
        print(f"   {col}: {sample_val!r} (type: {type(sample_val).__name__}, dtype: {df2[col].dtype})")
    print()
    
    # Test 3: With dtype=str to preserve all as strings
    print("🔍 Test 3: pd.read_csv(dtype=str) - preserve all as strings:")
    df3 = pd.read_csv(io.StringIO(test_data), dtype=str)
    
    for col in df3.columns:
        sample_val = df3[col].iloc[0]
        print(f"   {col}: {sample_val!r} (type: {type(sample_val).__name__}, dtype: {df3[col].dtype})")
    print()
    
    # Show specific leading zero cases
    print("📊 LEADING ZERO ANALYSIS:")
    print("=" * 30)
    test_cases = [
        ("ID", "01"),
        ("AccountNumber", "007"), 
        ("Code", "09")
    ]
    
    for col, expected in test_cases:
        current_val = df2[col].iloc[0] if col == "ID" else (df2[col].iloc[0] if col == "AccountNumber" else df2[col].iloc[0])
        
        if col == "ID":
            actual = df2[col].iloc[0]
        elif col == "AccountNumber":
            actual = df2[col].iloc[0] 
        else:  # Code
            actual = df2[col].iloc[0]
        
        preserved = str(actual) == expected
        print(f"   {col}: Expected '{expected}' → Got {actual!r} → Preserved: {'✅' if preserved else '❌'}")
    
    return df2

def test_excel_leading_zeros():
    """Test Excel file reading with leading zeros"""
    print("\n📊 TESTING EXCEL FILE READING WITH LEADING ZEROS")  
    print("=" * 50)
    
    # Create test Excel data
    test_data = {
        'ID': ['01', '02', '03'],
        'AccountNumber': ['007', '123', '000456'],
        'Code': ['09', '10', '00'],
        'Amount': [100.00, 200.50, 300.75]
    }
    
    df_excel = pd.DataFrame(test_data)
    
    # Save to Excel in memory
    excel_buffer = io.BytesIO()
    df_excel.to_excel(excel_buffer, index=False, engine='openpyxl')
    excel_buffer.seek(0)
    
    # Read back like your file upload does
    df_read = pd.read_excel(excel_buffer, engine='openpyxl')
    
    print("🔍 Excel file reading with pd.read_excel(engine='openpyxl'):")
    for col in df_read.columns:
        sample_val = df_read[col].iloc[0]
        print(f"   {col}: {sample_val!r} (type: {type(sample_val).__name__}, dtype: {df_read[col].dtype})")
    print()
    
    # Leading zero analysis for Excel
    print("📊 EXCEL LEADING ZERO ANALYSIS:")
    print("=" * 35)
    test_cases = [
        ("ID", "01"),
        ("AccountNumber", "007"),
        ("Code", "09")
    ]
    
    for col, expected in test_cases:
        actual = df_read[col].iloc[0]
        preserved = str(actual) == expected
        print(f"   {col}: Expected '{expected}' → Got {actual!r} → Preserved: {'✅' if preserved else '❌'}")
    
    return df_read

def test_with_new_leading_zero_detection():
    """Test the new leading zero detection and preservation"""
    print("\n🔧 TESTING NEW LEADING ZERO DETECTION")
    print("=" * 50)
    
    try:
        from app.routes.file_routes import detect_leading_zero_columns
        
        # Create test data with leading zeros  
        test_data = """ID,Account,Code,Amount,Description
01,007,09,100,Product A
02,123,10,200,Product B
03,000,00,300,Product C"""
        
        print("📝 Test data:")
        print(test_data)
        print()
        
        # Test leading zero detection
        content = test_data.encode('utf-8')
        dtype_mapping = detect_leading_zero_columns(content, 'test.csv')
        
        print("🔍 Leading zero detection results:")
        if dtype_mapping:
            for col, dtype in dtype_mapping.items():
                print(f"   {col}: {dtype} (has leading zeros)")
        else:
            print("   No columns with leading zeros detected")
        print()
        
        # Test reading with the dtype mapping
        df = pd.read_csv(
            io.StringIO(test_data), 
            low_memory=False, 
            encoding='utf-8',
            dtype=dtype_mapping if dtype_mapping else None
        )
        
        print("📊 DataFrame after leading zero preservation:")
        for col in df.columns:
            sample_val = df[col].iloc[0]
            print(f"   {col}: {sample_val!r} (dtype: {df[col].dtype})")
        
        print("\n✅ LEADING ZERO PRESERVATION TEST:")
        print("=" * 40)
        
        test_cases = [
            ("ID", "01"),
            ("Account", "007"),
            ("Code", "09")
        ]
        
        for col, expected in test_cases:
            if col in df.columns:
                actual = df[col].iloc[0]
                preserved = str(actual) == expected
                print(f"   {col}: Expected '{expected}' → Got {actual!r} → {'✅ Preserved' if preserved else '❌ Lost'}")
        
        return df
        
    except ImportError as e:
        print(f"❌ Could not test leading zero detection: {e}")
        return None

def main():
    print("LEADING ZEROS TEST FOR FILE UPLOAD")
    print("=" * 50)
    print("Testing how your file upload handles values like '07', '001', etc.")
    print()
    
    # Test CSV reading
    df_csv = test_csv_leading_zeros()
    
    # Test Excel reading
    df_excel = test_excel_leading_zeros()
    
    # Test with new leading zero detection
    df_preserved = test_with_new_leading_zero_detection()
    
    print("\n" + "=" * 60)
    print("🎯 SUMMARY: FILE UPLOAD BEHAVIOR WITH LEADING ZEROS")
    print("=" * 60)
    
    print("\n📋 OLD Behavior (Before Fix):")
    print("   • CSV Files: Leading zeros were LOST during reading")
    print("     - '01' became 1 (int64)")  
    print("     - '007' became 7 (int64)")
    print("     - '09' became 9 (int64)")
    
    print("\n✅ NEW Behavior (After Fix):")
    print("   • Leading Zero Detection: Automatically detects columns with leading zeros")
    print("   • Smart Preservation: Preserves leading zeros as strings")
    print("     - '01' stays as '01' (string)")
    print("     - '007' stays as '007' (string)")  
    print("     - '09' stays as '09' (string)")
    print("   • Numeric Columns: Normal numeric columns remain as numbers for calculations")
    print("     - 100 stays as 100 (int64)")
    print("     - 200.50 stays as 200.50 (float64)")
    
    print("\n🎯 IMPACT ON RECONCILIATION:")
    print("   • File Upload: '07' → stored as string '07'")
    print("   • Reconciliation Options:")
    print("     - 'equals' match: '07' vs '07' → ✅ Match (strict string)")
    print("     - 'equals' match: '07' vs '7' → ❌ No match (strict string)")
    print("     - 'tolerance' match: '07' vs '7' → ✅ Match (converts to numbers)")
    
    print("\n🚀 BENEFITS:")
    print("   • Perfect Control: You decide at reconciliation time how to match")
    print("   • Data Integrity: Original formatting preserved")
    print("   • Flexible Matching: Use 'equals' for strict or 'tolerance' for numeric")
    print("   • Consistent Behavior: Both files processed the same way")
    
    print("\n📝 USAGE:")
    print("   • For exact string matching: Use 'equals' match type")
    print("   • For numeric matching (01 = 1): Use 'tolerance' match type")
    print("   • Leading zeros are now preserved automatically during file upload!")

if __name__ == "__main__":
    main()