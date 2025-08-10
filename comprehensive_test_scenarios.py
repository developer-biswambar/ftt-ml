#!/usr/bin/env python3
"""
Comprehensive test scenarios for data cleaning functionality
This script validates the complete data cleaning pipeline
"""
import pandas as pd
import numpy as np

def analyze_test_file(filepath):
    """Analyze the test file to show what issues will be cleaned"""
    print("=" * 80)
    print("COMPREHENSIVE DATA CLEANING TEST FILE ANALYSIS")
    print("=" * 80)
    
    # Read the original file
    df_original = pd.read_csv(filepath)
    
    print(f"\n📁 ORIGINAL FILE ANALYSIS:")
    print(f"   File: {filepath}")
    print(f"   Size: {df_original.shape[0]:,} rows × {df_original.shape[1]} columns")
    print(f"   Columns: {list(df_original.columns)}")
    
    print(f"\n📊 RAW DATA PREVIEW:")
    print(df_original.to_string(max_rows=15))
    
    # Analyze issues in the file
    print(f"\n🔍 DATA QUALITY ISSUES DETECTED:")
    
    # 1. Column name issues
    column_issues = []
    for i, col in enumerate(df_original.columns):
        original_name = repr(col)
        cleaned_name = str(col).strip() if col is not None else f"Unnamed_{i}"
        if str(col) != cleaned_name or col is None:
            column_issues.append(f"   • Column {i}: {original_name} → '{cleaned_name}'")
    
    if column_issues:
        print(f"\n   🏷️  COLUMN NAME ISSUES ({len(column_issues)} found):")
        for issue in column_issues[:10]:  # Show first 10
            print(issue)
        if len(column_issues) > 10:
            print(f"   ... and {len(column_issues) - 10} more")
    
    # 2. Empty columns detection
    empty_columns = []
    for col in df_original.columns:
        non_empty_values = df_original[col].dropna()
        if len(non_empty_values) == 0:
            empty_columns.append(col)
        else:
            string_values = [str(val).strip() for val in non_empty_values if pd.notna(val)]
            non_empty_strings = [val for val in string_values if val != '']
            if len(non_empty_strings) == 0:
                empty_columns.append(col)
    
    if empty_columns:
        print(f"\n   🗑️  EMPTY COLUMNS ({len(empty_columns)} found):")
        for col in empty_columns[:10]:
            print(f"   • '{col}' (completely empty)")
        if len(empty_columns) > 10:
            print(f"   ... and {len(empty_columns) - 10} more")
    
    # 3. Empty rows detection
    def is_row_empty(row):
        for val in row:
            if pd.notna(val) and str(val).strip() != '':
                return False
        return True
    
    empty_row_mask = df_original.apply(is_row_empty, axis=1)
    empty_row_count = empty_row_mask.sum()
    
    if empty_row_count > 0:
        print(f"\n   📋 EMPTY ROWS ({empty_row_count} found):")
        empty_row_indices = df_original[empty_row_mask].index.tolist()
        print(f"   • Row indices: {empty_row_indices[:10]}")
        if len(empty_row_indices) > 10:
            print(f"   ... and {len(empty_row_indices) - 10} more")
    
    # 4. Data value issues (spaces)
    data_value_issues = []
    for col in df_original.columns:
        if df_original[col].dtype == 'object':
            non_null_values = df_original[col].dropna()
            if len(non_null_values) > 0:
                sample_values = non_null_values.head(10)
                string_count = sum(1 for val in sample_values if isinstance(val, str))
                
                if string_count >= len(sample_values) * 0.5:
                    values_with_spaces = []
                    for val in sample_values:
                        if isinstance(val, str) and val != val.strip():
                            values_with_spaces.append(f"'{val}' → '{val.strip()}'")
                    
                    if values_with_spaces:
                        data_value_issues.append({
                            'column': col,
                            'examples': values_with_spaces[:3]
                        })
    
    if data_value_issues:
        print(f"\n   ✂️  DATA VALUES WITH SPACES ({len(data_value_issues)} columns affected):")
        for issue in data_value_issues:
            print(f"   • Column '{issue['column']}': {', '.join(issue['examples'])}")
    
    # 5. Duplicate column names
    original_columns = list(df_original.columns)
    cleaned_columns = []
    duplicates_found = []
    
    for i, col in enumerate(original_columns):
        cleaned_col = str(col).strip() if col is not None else f"Unnamed_{i}"
        original_cleaned = cleaned_col
        counter = 1
        while cleaned_col in cleaned_columns:
            cleaned_col = f"{original_cleaned}_{counter}"
            counter += 1
            if counter == 2:  # First duplicate
                duplicates_found.append(f"'{original_cleaned}' → '{cleaned_col}'")
        cleaned_columns.append(cleaned_col)
    
    if duplicates_found:
        print(f"\n   🔄 DUPLICATE COLUMN NAMES ({len(duplicates_found)} found):")
        for dup in duplicates_found:
            print(f"   • {dup}")
    
    # Calculate cleanup predictions
    print(f"\n📈 PREDICTED CLEANUP RESULTS:")
    
    final_rows = df_original.shape[0] - empty_row_count
    final_columns = df_original.shape[1] - len(empty_columns)
    
    empty_row_percentage = (empty_row_count / df_original.shape[0] * 100) if df_original.shape[0] > 0 else 0
    empty_col_percentage = (len(empty_columns) / df_original.shape[1] * 100) if df_original.shape[1] > 0 else 0
    
    print(f"   📊 Size Change: {df_original.shape[0]} × {df_original.shape[1]} → {final_rows} × {final_columns}")
    print(f"   📋 Empty Rows: {empty_row_count} removed ({empty_row_percentage:.1f}%)")
    print(f"   🗑️  Empty Columns: {len(empty_columns)} removed ({empty_col_percentage:.1f}%)")
    print(f"   🏷️  Column Names: {len(column_issues)} cleaned")
    print(f"   ✂️  Data Values: {len(data_value_issues)} columns will be trimmed")
    print(f"   🔄 Duplicate Columns: {len(duplicates_found)} renamed")
    
    # Generate expected warnings
    warnings = []
    if empty_row_percentage >= 30:
        warnings.append(f"⚠️  High number of empty rows ({empty_row_percentage:.1f}%)")
    if empty_col_percentage >= 20:
        warnings.append(f"⚠️  High number of empty columns ({empty_col_percentage:.1f}%)")
    if empty_row_count > 100 or len(empty_columns) > 10:
        warnings.append("💡 Tip: Consider cleaning your Excel/CSV files before upload")
    
    if warnings:
        print(f"\n⚠️  EXPECTED UPLOAD WARNINGS:")
        for warning in warnings:
            print(f"   {warning}")
    else:
        print(f"\n✅ FILE QUALITY: Good (no warnings expected)")
    
    # Show what the upload message will look like
    upload_message = f"File uploaded successfully - {final_rows:,} rows processed"
    cleanup_details = []
    if empty_row_count > 0:
        cleanup_details.append(f"{empty_row_count} empty rows removed")
    if len(empty_columns) > 0:
        cleanup_details.append(f"{len(empty_columns)} empty columns removed")
    if cleanup_details:
        upload_message += f". ⚡ Data cleanup: {', '.join(cleanup_details)}"
    
    print(f"\n📤 EXPECTED UPLOAD MESSAGE:")
    print(f"   {upload_message}")
    
    print("\n" + "=" * 80)
    print("✅ FILE ANALYSIS COMPLETE!")
    print("This file tests all data cleaning scenarios:")
    print("• Column names with leading/trailing spaces")
    print("• Data values with leading/trailing spaces") 
    print("• Completely empty rows and columns")
    print("• Duplicate column names after cleaning")
    print("• Mixed data types (strings, numbers, dates)")
    print("• Various empty cell representations (NaN, empty string, spaces)")
    print("=" * 80)

def create_additional_test_files():
    """Create additional specialized test files for edge cases"""
    
    # Test File 1: Extreme Excel messiness
    print("\n📁 Creating extreme_excel_mess.csv...")
    extreme_data = {
        '   ': [''] * 5,  # Empty column with just spaces as name
        '  ID  ': ['  TX001  ', ' TX002', 'TX003 ', '  TX004  ', '   TX005   '],
        'Amount': [' 100.50 ', '250', ' 300.75', '400.25 ', '  500.00  '],
        '': [np.nan] * 5,  # Unnamed empty column
        '   Date   ': [' 2024-01-01 ', '2024-01-02', ' 2024-01-03 ', '2024-01-04', ' 2024-01-05 '],
        'EmptyCol1': [np.nan] * 5,
        'EmptyCol2': ['', '', '', '', ''],
        'EmptyCol3': ['   ', '  ', '   ', ' ', '    '],
        'Status': [' Active ', 'Pending', ' Completed ', 'Active', ' Pending '],
        'Notes': ['  Payment  ', ' Transfer ', '  Invoice  ', ' Subscription ', '  Refund  '],
        'Unnamed: 10': [np.nan] * 5,
        'Unnamed: 11': [''] * 5,
    }
    
    extreme_df = pd.DataFrame(extreme_data)
    
    # Add many empty rows at various positions
    empty_rows = []
    for _ in range(15):  # Add 15 empty rows
        empty_row = [np.nan if np.random.random() > 0.5 else '' for _ in range(len(extreme_df.columns))]
        empty_rows.append(empty_row)
    
    empty_df = pd.DataFrame(empty_rows, columns=extreme_df.columns)
    extreme_df = pd.concat([extreme_df.iloc[:2], empty_df.iloc[:5], extreme_df.iloc[2:4], 
                           empty_df.iloc[5:10], extreme_df.iloc[4:], empty_df.iloc[10:]], 
                          ignore_index=True)
    
    extreme_df.to_csv('extreme_excel_mess.csv', index=False)
    print(f"   Created: extreme_excel_mess.csv ({extreme_df.shape[0]} rows × {extreme_df.shape[1]} columns)")
    
    # Test File 2: Financial data with various issues
    print("\n📁 Creating financial_data_messy.csv...")
    financial_data = pd.DataFrame({
        '  Account ID  ': ['  ACC001  ', ' ACC002 ', 'ACC003', '  ACC004  ', ' ACC005'],
        ' Balance ': [' 1,234.56 ', '2,345.67', ' 3,456.78 ', '4,567.89', ' 5,678.90 '],
        'Currency  ': [' USD ', 'EUR', ' GBP ', 'USD', ' EUR '],
        '   Last Updated   ': [' 2024-01-15 ', '2024-01-16', ' 2024-01-17 ', '2024-01-18', ' 2024-01-19 '],
        ' Account Type ': ['  Savings  ', ' Checking ', 'Investment', ' Savings ', ' Checking '],
        '': [np.nan] * 5,  # Empty column
        'Branch  ': ['  Main St  ', ' Downtown ', 'Uptown', '  Mall  ', ' Airport '],
        ' Status ': [' Active ', 'Active', ' Closed ', 'Active', ' Pending '],
        'EmptyCol': [np.nan, np.nan, np.nan, np.nan, np.nan],
    })
    
    # Add some empty rows
    financial_empty = pd.DataFrame([[np.nan] * len(financial_data.columns)] * 3, columns=financial_data.columns)
    financial_df = pd.concat([financial_data, financial_empty], ignore_index=True)
    
    financial_df.to_csv('financial_data_messy.csv', index=False)
    print(f"   Created: financial_data_messy.csv ({financial_df.shape[0]} rows × {financial_df.shape[1]} columns)")
    
    print("\n✅ Additional test files created successfully!")
    return ['extreme_excel_mess.csv', 'financial_data_messy.csv']

if __name__ == "__main__":
    # Analyze the main comprehensive test file
    analyze_test_file('/Users/biswambarpradhan/UpSkill/ftt-ml/comprehensive_test_file.csv')
    
    # Create additional test files
    additional_files = create_additional_test_files()
    
    print(f"\n📋 TEST FILES SUMMARY:")
    print(f"   1. comprehensive_test_file.csv - Main test file with all scenarios")
    print(f"   2. extreme_excel_mess.csv - Extreme Excel messiness simulation")  
    print(f"   3. financial_data_messy.csv - Financial data with typical issues")
    print(f"\n🧪 Upload these files to your application to test the enhanced data cleaning!")