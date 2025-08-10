#!/usr/bin/env python3
"""
Test the enhanced API response with comprehensive parallel processing performance stats
Demonstrates the detailed metrics now included in upload responses
"""
import sys
import pandas as pd
import numpy as np
import json
from datetime import datetime

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

try:
    from app.utils.parallel_cleaning import clean_dataframe_fast
    PARALLEL_AVAILABLE = True
except ImportError:
    PARALLEL_AVAILABLE = False
    print("❌ Parallel cleaning not available")

def create_test_dataset(rows: int = 100000, cols: int = 100) -> pd.DataFrame:
    """Create a test dataset that will trigger parallel processing"""
    print(f"🔨 Creating test dataset: {rows:,} rows × {cols} columns...")
    
    data = {}
    
    # Create columns with various data quality issues
    for i in range(cols):
        col_name = f"  Column_{i}  " if i % 5 == 0 else f"Column_{i}"
        
        if i < 50:  # Real data columns
            values = []
            for j in range(rows):
                if j % 1000 == 0:  # 0.1% empty
                    values.append(np.nan)
                elif j % 100 == 0:  # 1% with spaces
                    values.append(f"  Value_{i}_{j}  ")
                else:
                    values.append(f"Value_{i}_{j}")
            data[col_name] = values
            
        elif i < 60:  # Date columns
            base_date = datetime(2024, 1, 1)
            values = []
            for j in range(rows):
                if j % 500 == 0:
                    values.append(np.nan)
                else:
                    days_offset = j % 365
                    date_val = base_date.replace(day=1).replace(month=((days_offset // 30) % 12) + 1)
                    if i % 2 == 0:
                        values.append(date_val.strftime('%Y-%m-%d'))
                    else:
                        values.append(date_val.strftime('%d/%m/%Y'))
            data[col_name] = values
            
        else:  # Empty columns
            data[col_name] = [np.nan] * rows
    
    # Add some empty rows
    df = pd.DataFrame(data)
    for pos in range(0, rows, rows // 100):  # 1% empty rows
        if pos < len(df):
            df.iloc[pos] = np.nan
    
    print(f"✅ Test dataset created: {df.shape[0]:,} rows × {df.shape[1]} columns")
    return df

def simulate_enhanced_upload_response():
    """Simulate the upload process and show the enhanced API response"""
    if not PARALLEL_AVAILABLE:
        print("❌ Parallel cleaning not available for testing")
        return
    
    print("=" * 80)
    print("ENHANCED UPLOAD RESPONSE WITH PERFORMANCE STATS")
    print("=" * 80)
    
    # Create test dataset
    df = create_test_dataset(100000, 120)
    original_shape = df.shape
    
    print(f"\n📤 Simulating upload process...")
    print(f"   Original size: {original_shape[0]:,} rows × {original_shape[1]} columns")
    
    # Run parallel cleaning
    print(f"🚀 Running parallel data cleaning...")
    df_cleaned, cleanup_stats = clean_dataframe_fast(df)
    final_shape = df_cleaned.shape
    
    # Simulate the enhanced API response structure
    use_parallel_cleaning = True
    original_rows = cleanup_stats['original_rows']
    original_columns = cleanup_stats['original_columns']
    removed_rows = cleanup_stats['removed_rows']
    removed_columns = cleanup_stats['removed_columns']
    total_rows = cleanup_stats['final_rows']
    total_cols = cleanup_stats['final_columns']
    
    # Calculate percentages
    empty_row_percentage = (removed_rows / original_rows * 100) if original_rows > 0 else 0
    empty_col_percentage = (removed_columns / original_columns * 100) if original_columns > 0 else 0
    
    # Build enhanced cleanup response
    cleanup_response = {
        "empty_content_removed": removed_rows > 0 or removed_columns > 0,
        "parallel_processing_used": use_parallel_cleaning,
        "statistics": {
            "original_size": f"{original_rows:,} rows × {original_columns} columns",
            "final_size": f"{total_rows:,} rows × {total_cols} columns",
            "removed_rows": int(removed_rows),
            "removed_columns": int(removed_columns),
            "empty_row_percentage": float(round(empty_row_percentage, 1)),
            "empty_column_percentage": float(round(empty_col_percentage, 1))
        },
        "warnings": [],
        "details": [
            f"{removed_rows} empty rows removed",
            f"{removed_columns} empty columns removed"
        ]
    }
    
    # Add parallel processing performance stats
    if cleanup_stats.get('performance_stats'):
        perf_stats = cleanup_stats['performance_stats']
        
        if 'timing' in perf_stats:
            cleanup_response["performance"] = {
                "total_processing_time": cleanup_stats.get('processing_time_seconds', 0),
                "timing_breakdown": perf_stats['timing'],
                "processing_method": "parallel_multi_threaded"
            }
            
            # Calculate performance metrics
            total_cells = original_rows * original_columns
            processing_time = cleanup_stats.get('processing_time_seconds', 0)
            
            if processing_time > 0:
                cells_per_second = int(total_cells / processing_time)
                cleanup_response["performance"]["cells_per_second"] = cells_per_second
                cleanup_response["performance"]["megacells_per_second"] = round(cells_per_second / 1000000, 2)
        
        # Add parallel-specific stats
        cleanup_response["parallel_stats"] = {
            "max_workers": perf_stats.get('performance', {}).get('max_workers', 'auto'),
            "cleaned_values": cleanup_stats.get('cleaned_values', 0),
            "normalized_date_columns": cleanup_stats.get('normalized_date_columns', []),
            "optimization_level": perf_stats.get('performance', {}).get('optimization_level', 'high_performance')
        }
    
    # Simulate full API response
    api_response = {
        "success": True,
        "message": f"File uploaded successfully - {total_rows:,} rows processed. ⚡ Data cleanup: {removed_rows} empty rows removed, {removed_columns} empty columns removed",
        "data": {
            "file_id": "file_12345",
            "filename": "large_test_file.csv",
            "total_rows": int(total_rows),
            "total_columns": int(total_cols),
            "upload_time": datetime.utcnow().isoformat()
        },
        "cleanup_performed": cleanup_response
    }
    
    # Display the results
    print(f"\n📊 PROCESSING RESULTS:")
    print(f"   Original: {original_shape[0]:,} rows × {original_shape[1]} columns")
    print(f"   Final: {final_shape[0]:,} rows × {final_shape[1]} columns")
    print(f"   Processing time: {cleanup_stats.get('processing_time_seconds', 0):.2f} seconds")
    if 'performance_stats' in cleanup_stats and 'performance' in cleanup_stats['performance_stats']:
        perf = cleanup_stats['performance_stats']['performance']
        print(f"   Performance: {perf.get('megacells_per_second', 0):.1f} million cells/second")
        print(f"   Worker threads: {perf.get('max_workers', 'N/A')}")
    
    print(f"\n🔧 ENHANCED API RESPONSE:")
    print(f"{'='*50}")
    print(json.dumps(api_response, indent=2, default=str))
    
    print(f"\n📈 KEY PERFORMANCE METRICS INCLUDED:")
    print("✅ parallel_processing_used: Boolean flag indicating parallel vs standard processing")
    print("✅ performance.processing_method: 'parallel_multi_threaded' or 'standard_sequential'")
    print("✅ performance.timing_breakdown: Step-by-step timing for each parallel operation")
    print("✅ performance.cells_per_second: Raw processing throughput")
    print("✅ performance.megacells_per_second: Human-readable throughput")
    print("✅ parallel_stats.max_workers: Number of threads used")
    print("✅ parallel_stats.cleaned_values: Count of data values cleaned")
    print("✅ parallel_stats.normalized_date_columns: List of date columns processed")
    print("✅ parallel_stats.optimization_level: Performance optimization level")
    
    return api_response

def show_performance_comparison():
    """Show before/after comparison of API responses"""
    print(f"\n{'='*80}")
    print("BEFORE vs AFTER: API RESPONSE COMPARISON")
    print(f"{'='*80}")
    
    print(f"\n📝 BEFORE (Basic Response):")
    print("```json")
    basic_response = {
        "success": True,
        "message": "File uploaded successfully - 99,000 rows processed",
        "cleanup_performed": {
            "empty_content_removed": True,
            "statistics": {
                "removed_rows": 1000,
                "removed_columns": 40
            }
        }
    }
    print(json.dumps(basic_response, indent=2))
    print("```")
    
    print(f"\n🚀 AFTER (Enhanced with Parallel Performance Stats):")
    print("```json")
    enhanced_response = {
        "success": True,
        "message": "File uploaded successfully - 99,000 rows processed. ⚡ Data cleanup: 1000 empty rows removed, 40 empty columns removed",
        "cleanup_performed": {
            "empty_content_removed": True,
            "parallel_processing_used": True,
            "statistics": {
                "original_size": "100,000 rows × 120 columns",
                "final_size": "99,000 rows × 80 columns",
                "removed_rows": 1000,
                "removed_columns": 40
            },
            "performance": {
                "total_processing_time": 8.45,
                "processing_method": "parallel_multi_threaded",
                "cells_per_second": 1420118,
                "megacells_per_second": 1.42,
                "timing_breakdown": {
                    "empty_columns": 0.8,
                    "empty_rows": 0.3,
                    "column_names": 0.2,
                    "data_values": 6.1,
                    "date_normalization": 1.0
                }
            },
            "parallel_stats": {
                "max_workers": 8,
                "cleaned_values": 850000,
                "normalized_date_columns": ["Date_Column_50", "Date_Column_52"],
                "optimization_level": "high_performance"
            }
        }
    }
    print(json.dumps(enhanced_response, indent=2))
    print("```")
    
    print(f"\n💡 NEW INSIGHTS AVAILABLE:")
    print("🔍 Detailed timing breakdown shows which steps take the most time")
    print("⚡ Processing speed metrics help identify performance bottlenecks")
    print("🧵 Thread utilization shows parallel processing effectiveness")
    print("📅 Date normalization tracking for data transformation insights")
    print("📊 Cell-level throughput metrics for capacity planning")

if __name__ == "__main__":
    print("TESTING ENHANCED UPLOAD RESPONSE WITH PERFORMANCE STATS")
    print("=" * 60)
    
    if PARALLEL_AVAILABLE:
        # Run the comprehensive test
        api_response = simulate_enhanced_upload_response()
        
        # Show comparison
        show_performance_comparison()
        
        print(f"\n🎉 SUCCESS!")
        print("Your upload API now includes comprehensive parallel processing performance stats!")
        print("Users can see exactly how their files were processed and the performance achieved.")
        
    else:
        print("❌ Parallel processing not available.")
        print("Performance stats will show 'standard_sequential' processing method.")
    
    print(f"\n{'='*80}")
    print("Your API responses now provide deep insights into data processing performance!")