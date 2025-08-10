#!/usr/bin/env python3
"""
Test script for enhanced upload feedback functionality
Simulates various file scenarios to demonstrate user feedback
"""
import pandas as pd
import numpy as np
import tempfile
import os
import json

def create_test_files():
    """Create test files with different levels of empty content"""
    
    # Test File 1: Minimal empty content (good quality)
    good_data = pd.DataFrame({
        'ID': ['TX001', 'TX002', 'TX003', 'TX004'],
        'Amount': [100.50, 250.00, 300.75, 400.25],
        'Date': ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'],
        'Status': ['Active', 'Pending', 'Completed', 'Active']
    })
    good_data.to_csv('test_good_file.csv', index=False)
    
    # Test File 2: Moderate empty content (acceptable)
    moderate_data = pd.DataFrame({
        '  ID  ': ['TX001', 'TX002', 'TX003', 'TX004'],
        ' Amount ': [' 100.50 ', 250.00, ' 300.75', 400.25],
        'Date ': ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'],
        ' Status': [' Active ', 'Pending', 'Completed', ' Active'],
        'EmptyCol1': [np.nan, np.nan, np.nan, np.nan],  # 1 empty column
        '': ['', '', '', ''],  # 1 more empty column
    })
    # Add 2 empty rows
    empty_rows = pd.DataFrame([[np.nan] * len(moderate_data.columns)] * 2, 
                             columns=moderate_data.columns)
    moderate_data = pd.concat([moderate_data, empty_rows], ignore_index=True)
    moderate_data.to_csv('test_moderate_file.csv', index=False)
    
    # Test File 3: High empty content (poor quality)
    poor_data = pd.DataFrame({
        '  Transaction ID  ': ['TX001', 'TX002'],
        ' Amount ': [' 100.50 ', ' 250.00 '],
        ' Date ': ['2024-01-01 ', ' 2024-01-02'],
        'Status  ': [' Active ', ' Pending  '],
    })
    
    # Add many empty columns (simulate Excel with lots of empty columns)
    for i in range(15):  # 15 empty columns
        poor_data[f'Empty_{i}'] = [np.nan] * len(poor_data)
        poor_data[f'  '] = ['', ''] if i % 2 == 0 else [np.nan, np.nan]
    
    # Add many empty rows (simulate Excel with many empty rows)
    empty_rows = pd.DataFrame([[np.nan] * len(poor_data.columns)] * 20,  # 20 empty rows
                             columns=poor_data.columns)
    poor_data = pd.concat([poor_data, empty_rows], ignore_index=True)
    poor_data.to_csv('test_poor_file.csv', index=False)
    
    print("✅ Test files created:")
    print(f"  - test_good_file.csv: {good_data.shape[0]} rows, {good_data.shape[1]} columns")
    print(f"  - test_moderate_file.csv: {moderate_data.shape[0]} rows, {moderate_data.shape[1]} columns") 
    print(f"  - test_poor_file.csv: {poor_data.shape[0]} rows, {poor_data.shape[1]} columns")

def simulate_upload_feedback(filepath):
    """Simulate the upload process and show expected feedback"""
    print(f"\n{'='*60}")
    print(f"SIMULATING UPLOAD: {os.path.basename(filepath)}")
    print(f"{'='*60}")
    
    # Read the file
    df_original = pd.read_csv(filepath)
    original_shape = df_original.shape
    
    print(f"\n📁 Original File:")
    print(f"   Size: {original_shape[0]:,} rows × {original_shape[1]} columns")
    print(f"   Columns: {list(df_original.columns)}")
    
    # Simulate the cleaning process (copy functions from file_routes.py)
    from test_comprehensive_data_cleaning import (
        remove_empty_rows_and_columns, 
        clean_column_names, 
        clean_data_values
    )
    
    # Step 1: Remove empty rows and columns
    df_step1, cleanup_stats = remove_empty_rows_and_columns(df_original.copy())
    
    # Step 2: Clean column names
    df_step2 = clean_column_names(df_step1.copy())
    
    # Step 3: Clean data values  
    df_final = clean_data_values(df_step2.copy())
    
    final_shape = df_final.shape
    
    # Calculate percentages (matching the enhanced upload logic)
    removed_rows = cleanup_stats['removed_rows']
    removed_columns = cleanup_stats['removed_columns']
    empty_row_percentage = (removed_rows / original_shape[0] * 100) if original_shape[0] > 0 else 0
    empty_col_percentage = (removed_columns / original_shape[1] * 100) if original_shape[1] > 0 else 0
    
    # Build user feedback
    print(f"\n🧹 Data Cleaning Results:")
    print(f"   Final size: {final_shape[0]:,} rows × {final_shape[1]} columns")
    print(f"   Removed: {removed_rows} empty rows, {removed_columns} empty columns")
    
    # Generate cleanup details
    cleanup_details = []
    if removed_rows > 0:
        cleanup_details.append(f"{removed_rows} empty rows removed")
    if removed_columns > 0:
        cleanup_details.append(f"{removed_columns} empty columns removed")
        if cleanup_stats.get('empty_column_names'):
            empty_col_names = cleanup_stats['empty_column_names'][:5]
            if len(cleanup_stats['empty_column_names']) > 5:
                cleanup_details.append(f"Empty columns included: {', '.join(empty_col_names[:3])}, and {len(cleanup_stats['empty_column_names']) - 3} more")
            else:
                cleanup_details.append(f"Empty columns: {', '.join(empty_col_names)}")
    
    # Generate warnings
    cleanup_warnings = []
    if empty_row_percentage >= 30:
        cleanup_warnings.append(f"⚠️  High number of empty rows detected ({empty_row_percentage:.1f}% of original file)")
    if empty_col_percentage >= 20:
        cleanup_warnings.append(f"⚠️  High number of empty columns detected ({empty_col_percentage:.1f}% of original file)")
    if removed_rows > 100 or removed_columns > 10:
        cleanup_warnings.append("💡 Tip: Consider cleaning your Excel/CSV files before upload to improve processing speed")
    
    # Simulate API response
    response_message = f"File uploaded successfully - {final_shape[0]:,} rows processed"
    if cleanup_details:
        response_message += f". ⚡ Data cleanup: {', '.join(cleanup_details)}"
    
    print(f"\n📤 Upload Response Message:")
    print(f"   {response_message}")
    
    if cleanup_warnings:
        print(f"\n⚠️  Quality Warnings:")
        for warning in cleanup_warnings:
            print(f"   {warning}")
    
    print(f"\n📊 Detailed Statistics:")
    print(f"   Original size: {original_shape[0]:,} rows × {original_shape[1]} columns")
    print(f"   Final size: {final_shape[0]:,} rows × {final_shape[1]} columns")
    print(f"   Empty row percentage: {empty_row_percentage:.1f}%")
    print(f"   Empty column percentage: {empty_col_percentage:.1f}%")
    
    # Simulate the full API response
    api_response = {
        "success": True,
        "message": response_message,
        "cleanup_performed": {
            "empty_content_removed": bool(removed_rows > 0 or removed_columns > 0),
            "statistics": {
                "original_size": f"{original_shape[0]:,} rows × {original_shape[1]} columns",
                "final_size": f"{final_shape[0]:,} rows × {final_shape[1]} columns", 
                "removed_rows": int(removed_rows),
                "removed_columns": int(removed_columns),
                "empty_row_percentage": float(round(empty_row_percentage, 1)),
                "empty_column_percentage": float(round(empty_col_percentage, 1))
            },
            "warnings": list(cleanup_warnings),
            "details": list(cleanup_details)
        }
    }
    
    print(f"\n🔧 API Response (cleanup_performed section):")
    print(json.dumps(api_response["cleanup_performed"], indent=2))
    
    return api_response

def main():
    print("ENHANCED UPLOAD FEEDBACK TESTING")
    print("=" * 50)
    print("This test demonstrates the enhanced user feedback")
    print("for files with varying amounts of empty content.")
    
    # Create test files
    create_test_files()
    
    # Test each file type
    test_files = [
        'test_good_file.csv',
        'test_moderate_file.csv', 
        'test_poor_file.csv'
    ]
    
    for filepath in test_files:
        simulate_upload_feedback(filepath)
    
    print(f"\n{'='*60}")
    print("✅ ENHANCED UPLOAD FEEDBACK TEST COMPLETED!")
    print("\nKey improvements implemented:")
    print("• Detailed statistics showing original vs final file sizes")
    print("• Percentage-based warnings for excessive empty content")
    print("• User-friendly cleanup details with specific information")
    print("• Quality warnings when files have poor structure")
    print("• Tips for improving file quality before upload")
    print("• Comprehensive API response with cleanup metadata")
    print("=" * 60)
    
    # Cleanup test files
    for filepath in test_files:
        if os.path.exists(filepath):
            os.remove(filepath)
    print("\n🗑️  Test files cleaned up")

if __name__ == "__main__":
    main()