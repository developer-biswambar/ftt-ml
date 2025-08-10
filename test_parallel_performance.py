#!/usr/bin/env python3
"""
Performance testing for parallel data cleaning vs standard cleaning
Tests with large datasets to demonstrate speed improvements
"""
import sys
import pandas as pd
import numpy as np
import time
import logging
from concurrent.futures import ThreadPoolExecutor

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

# Import both cleaning approaches
from test_comprehensive_data_cleaning import (
    remove_empty_rows_and_columns as standard_remove_empty,
    clean_column_names as standard_clean_columns,
    clean_data_values as standard_clean_values
)

try:
    from app.utils.parallel_cleaning import clean_dataframe_fast, ParallelDataCleaner
    PARALLEL_AVAILABLE = True
except ImportError:
    PARALLEL_AVAILABLE = False
    print("❌ Parallel cleaning not available")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def create_large_messy_dataset(rows: int = 1000000, cols: int = 200) -> pd.DataFrame:
    """
    Create a large dataset with typical data quality issues
    Simulates real-world Excel exports with many empty rows/columns and spaces
    """
    print(f"🔨 Creating large test dataset: {rows:,} rows × {cols} columns...")
    
    data = {}
    
    # Create columns with spaces in names
    for i in range(cols):
        if i < 50:  # First 50 columns have real data with quality issues
            col_name = f"  Column_{i}  " if i % 3 == 0 else f"Column_{i} " if i % 3 == 1 else f" Column_{i}"
            
            # Generate data with spaces and some empty values
            values = []
            for j in range(rows):
                if j % 100 == 0:  # 1% empty rows distributed
                    values.append(np.nan)
                elif j % 50 == 0:  # 2% values with spaces
                    values.append(f"  Value_{i}_{j}  ")
                elif j % 25 == 0:  # 4% values with leading spaces
                    values.append(f" Value_{i}_{j}")
                elif j % 20 == 0:  # 5% values with trailing spaces
                    values.append(f"Value_{i}_{j} ")
                else:  # 88% clean values
                    values.append(f"Value_{i}_{j}")
            
            data[col_name] = values
            
        elif i < 75:  # Next 25 columns are mostly empty
            col_name = f"  EmptyCol_{i}  "
            values = [np.nan if j % 10 != 0 else "" for j in range(rows)]  # 90% empty
            data[col_name] = values
            
        else:  # Remaining columns are completely empty
            col_name = f"Empty_{i}" if i % 2 == 0 else f"  "
            data[col_name] = [np.nan] * rows
    
    df = pd.DataFrame(data)
    
    # Add some completely empty rows at various positions
    empty_row_positions = [i for i in range(0, rows, rows // 100)][:50]  # 50 empty rows
    for pos in empty_row_positions:
        if pos < len(df):
            df.iloc[pos] = np.nan
    
    print(f"✅ Large dataset created: {df.shape[0]:,} rows × {df.shape[1]} columns")
    return df

def benchmark_standard_cleaning(df: pd.DataFrame) -> tuple:
    """Benchmark the standard cleaning approach"""
    df_copy = df.copy()
    start_time = time.time()
    
    print(f"⏱️  Running STANDARD cleaning...")
    
    # Step 1: Remove empty rows/columns
    step_start = time.time()
    df_copy, cleanup_stats = standard_remove_empty(df_copy)
    empty_removal_time = time.time() - step_start
    
    # Step 2: Clean column names
    step_start = time.time()
    df_copy = standard_clean_columns(df_copy)
    column_clean_time = time.time() - step_start
    
    # Step 3: Clean data values
    step_start = time.time()
    df_copy = standard_clean_values(df_copy)
    value_clean_time = time.time() - step_start
    
    total_time = time.time() - start_time
    
    return df_copy, total_time, {
        'empty_removal': empty_removal_time,
        'column_cleaning': column_clean_time,
        'value_cleaning': value_clean_time,
        'cleanup_stats': cleanup_stats
    }

def benchmark_parallel_cleaning(df: pd.DataFrame) -> tuple:
    """Benchmark the parallel cleaning approach"""
    if not PARALLEL_AVAILABLE:
        return None, 0, {}
    
    df_copy = df.copy()
    start_time = time.time()
    
    print(f"🚀 Running PARALLEL cleaning...")
    df_copy, cleanup_stats = clean_dataframe_fast(df_copy)
    
    total_time = time.time() - start_time
    
    return df_copy, total_time, {'cleanup_stats': cleanup_stats}

def run_performance_comparison():
    """Run comprehensive performance comparison"""
    print("=" * 80)
    print("HIGH-PERFORMANCE DATA CLEANING BENCHMARK")
    print("=" * 80)
    
    # Test with different dataset sizes
    test_scenarios = [
        {"rows": 100000, "cols": 100, "name": "Medium Dataset"},
        {"rows": 500000, "cols": 200, "name": "Large Dataset"},
        {"rows": 1000000, "cols": 300, "name": "Very Large Dataset"}
    ]
    
    results = []
    
    for scenario in test_scenarios:
        print(f"\n{'='*60}")
        print(f"TESTING: {scenario['name']} ({scenario['rows']:,} rows × {scenario['cols']} columns)")
        print(f"{'='*60}")
        
        # Create test dataset
        df = create_large_messy_dataset(scenario['rows'], scenario['cols'])
        data_size_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
        print(f"📊 Dataset size: {data_size_mb:.1f} MB")
        
        # Test standard cleaning
        print(f"\n📝 Testing standard cleaning approach...")
        standard_df, standard_time, standard_details = benchmark_standard_cleaning(df)
        
        if PARALLEL_AVAILABLE:
            # Test parallel cleaning
            print(f"\n🚀 Testing parallel cleaning approach...")
            parallel_df, parallel_time, parallel_details = benchmark_parallel_cleaning(df)
            
            # Compare results
            speedup = standard_time / parallel_time if parallel_time > 0 else 0
            efficiency = (scenario['rows'] * scenario['cols']) / parallel_time / 1000000  # Million cells per second
            
            results.append({
                'scenario': scenario['name'],
                'rows': scenario['rows'],
                'cols': scenario['cols'],
                'data_size_mb': data_size_mb,
                'standard_time': standard_time,
                'parallel_time': parallel_time,
                'speedup': speedup,
                'efficiency_mcells_per_sec': efficiency
            })
            
            print(f"\n📈 PERFORMANCE COMPARISON:")
            print(f"   Standard cleaning: {standard_time:.2f} seconds")
            print(f"   Parallel cleaning: {parallel_time:.2f} seconds")
            print(f"   🚀 Speedup: {speedup:.2f}x faster")
            print(f"   ⚡ Processing rate: {efficiency:.1f} million cells/second")
            
            # Verify both approaches produce similar results
            if standard_df.shape == parallel_df.shape:
                print(f"   ✅ Both approaches produce identical final shape: {parallel_df.shape}")
            else:
                print(f"   ⚠️  Shape mismatch: Standard {standard_df.shape} vs Parallel {parallel_df.shape}")
                
        else:
            print(f"\n📝 Standard cleaning completed in {standard_time:.2f} seconds")
            results.append({
                'scenario': scenario['name'],
                'rows': scenario['rows'],
                'cols': scenario['cols'],
                'standard_time': standard_time,
                'parallel_time': 'N/A',
                'speedup': 'N/A'
            })
    
    # Summary report
    print(f"\n{'='*80}")
    print("PERFORMANCE SUMMARY REPORT")
    print(f"{'='*80}")
    
    if PARALLEL_AVAILABLE and results:
        print(f"{'Scenario':<20} {'Rows':<10} {'Cols':<6} {'Standard':<10} {'Parallel':<10} {'Speedup':<10} {'MCells/s':<10}")
        print("-" * 80)
        
        total_speedup = 0
        count = 0
        
        for result in results:
            if isinstance(result['speedup'], (int, float)):
                speedup_str = f"{result['speedup']:.1f}x"
                total_speedup += result['speedup']
                count += 1
            else:
                speedup_str = result['speedup']
                
            efficiency_str = f"{result['efficiency_mcells_per_sec']:.1f}" if 'efficiency_mcells_per_sec' in result else 'N/A'
            
            print(f"{result['scenario']:<20} {result['rows']:>9,} {result['cols']:>5} {result['standard_time']:>9.1f}s {result['parallel_time']:>9.1f}s {speedup_str:>9} {efficiency_str:>9}")
        
        if count > 0:
            avg_speedup = total_speedup / count
            print(f"\n🎯 Average speedup: {avg_speedup:.1f}x faster with parallel processing")
            
            if avg_speedup > 2:
                print("🚀 Excellent performance improvement! Parallel processing is highly effective.")
            elif avg_speedup > 1.5:
                print("⚡ Good performance improvement with parallel processing.")
            else:
                print("📝 Modest performance improvement. Consider tuning thread count.")
    
    print(f"\n💡 RECOMMENDATIONS:")
    if PARALLEL_AVAILABLE:
        print("   • Use parallel cleaning for files with >50K rows or >50 columns")
        print("   • Parallel processing is most effective on multi-core systems")
        print("   • Memory usage may increase during parallel processing")
        print("   • Consider chunking for files >10M rows to manage memory")
    else:
        print("   • Install the parallel_cleaning module for better performance")
        print("   • Standard cleaning is still effective for smaller datasets")
    
    return results

def create_million_row_test_file():
    """Create a test CSV file with 1 million rows for real upload testing"""
    print("\n📁 Creating million-row test file for upload testing...")
    
    # Create a realistic but large dataset
    rows = 1000000
    cols = 50
    
    data = {}
    for i in range(cols):
        col_name = f"  Column_{i}  " if i % 5 == 0 else f"Column_{i}"
        
        if i < 30:  # Real data columns
            values = []
            for j in range(rows):
                if j % 1000 == 0:  # 0.1% empty
                    values.append(np.nan)
                elif j % 100 == 0:  # 1% with spaces
                    values.append(f"  Data_{i}_{j}  ")
                else:
                    values.append(f"Data_{i}_{j}")
            data[col_name] = values
        else:  # Empty columns
            data[col_name] = [np.nan] * rows
    
    df = pd.DataFrame(data)
    
    # Add empty rows
    for pos in range(0, rows, 10000):  # Every 10,000th row is empty
        if pos < len(df):
            df.iloc[pos] = np.nan
    
    # Save to CSV
    filename = 'million_row_test.csv'
    print(f"💾 Saving {rows:,} row dataset to {filename}...")
    df.to_csv(filename, index=False)
    
    file_size_mb = pd.io.common.file_size(filename) / (1024 * 1024)
    print(f"✅ Created {filename}: {file_size_mb:.1f} MB")
    print(f"   Upload this file to test parallel cleaning with real data!")
    
    return filename

if __name__ == "__main__":
    # Run performance comparison
    run_performance_comparison()
    
    # Create test file for upload
    create_million_row_test_file()
    
    print(f"\n{'='*80}")
    print("🎉 PARALLEL DATA CLEANING SETUP COMPLETE!")
    print("Your system now automatically uses:")
    print("• Multi-threaded processing for large files (>50K rows or >50 columns)")
    print("• Vectorized operations for maximum speed") 
    print("• Chunked processing to manage memory efficiently")
    print("• Performance monitoring and statistics")
    print("Upload large files to see dramatic speed improvements!")
    print(f"{'='*80}")