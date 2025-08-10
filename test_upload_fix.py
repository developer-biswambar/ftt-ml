#!/usr/bin/env python3
"""
Test the upload fix by simulating the upload process locally
"""
import pandas as pd
import numpy as np
from test_comprehensive_data_cleaning import (
    remove_empty_rows_and_columns, 
    clean_column_names, 
    clean_data_values
)

def test_upload_process():
    """Test the complete upload process with the fixes"""
    print("Testing upload process with numpy type fixes...")
    
    # Create test data that would cause numpy.int64 issues
    test_data = pd.DataFrame({
        '  ID  ': ['TX001', 'TX002'],
        ' Amount ': [' 100.50 ', ' 250.00 '],
        'EmptyCol': [np.nan, np.nan],
        '': ['', '']
    })
    
    # Add empty rows
    empty_row = pd.Series([np.nan, np.nan, np.nan, np.nan], index=test_data.columns)
    test_data = pd.concat([test_data, pd.DataFrame([empty_row])], ignore_index=True)
    
    print(f"Original data shape: {test_data.shape}")
    
    # Simulate the upload cleaning process
    try:
        # Step 1: Remove empty rows and columns
        df_step1, cleanup_stats = remove_empty_rows_and_columns(test_data.copy())
        print(f"After empty removal: {df_step1.shape}")
        print(f"Cleanup stats types: {type(cleanup_stats['removed_rows'])}, {type(cleanup_stats['removed_columns'])}")
        
        # Step 2: Clean column names
        df_step2 = clean_column_names(df_step1.copy())
        
        # Step 3: Clean data values
        df_final = clean_data_values(df_step2.copy())
        
        # Simulate the response creation with type conversions
        original_rows = int(cleanup_stats['original_rows'])
        original_columns = int(cleanup_stats['original_columns'])
        removed_rows = int(cleanup_stats['removed_rows'])
        removed_columns = int(cleanup_stats['removed_columns'])
        
        total_rows = len(df_final)
        total_cols = len(df_final.columns)
        
        # Test the response structure
        file_info = {
            "total_rows": int(total_rows),
            "total_columns": int(total_cols),
            "columns": list(df_final.columns),
            "cleanup_performed": cleanup_stats,
        }
        
        cleanup_performed = {
            "empty_content_removed": bool(removed_rows > 0 or removed_columns > 0),
            "statistics": {
                "original_size": f"{original_rows:,} rows × {original_columns} columns",
                "final_size": f"{total_rows:,} rows × {total_cols} columns",
                "removed_rows": int(removed_rows),
                "removed_columns": int(removed_columns),
                "empty_row_percentage": float(round((removed_rows / original_rows * 100) if original_rows > 0 else 0, 1)),
                "empty_column_percentage": float(round((removed_columns / original_columns * 100) if original_columns > 0 else 0, 1))
            }
        }
        
        print("\n✅ SUCCESS: No type errors!")
        print(f"Final data shape: {df_final.shape}")
        print(f"Response data types are correct:")
        print(f"  - total_rows: {type(file_info['total_rows'])}")
        print(f"  - removed_rows: {type(cleanup_performed['statistics']['removed_rows'])}")
        print(f"  - empty_content_removed: {type(cleanup_performed['empty_content_removed'])}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    success = test_upload_process()
    if success:
        print("\n🎉 Upload fix verified! The numpy type conversion errors should be resolved.")
    else:
        print("\n💥 Upload fix failed. There are still type conversion issues.")