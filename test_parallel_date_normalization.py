#!/usr/bin/env python3
"""
Test parallel date normalization performance
Demonstrates speed improvements for datasets with many date columns
"""
import sys
import pandas as pd
import numpy as np
import time
import logging
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

try:
    from app.utils.parallel_date_utils import normalize_datetime_columns_fast, ParallelDateNormalizer
    PARALLEL_DATE_AVAILABLE = True
except ImportError:
    PARALLEL_DATE_AVAILABLE = False
    print("❌ Parallel date normalization not available")

def create_date_heavy_dataset(rows: int = 100000, date_cols: int = 20) -> pd.DataFrame:
    """
    Create a dataset with many date columns in various formats
    Simulates financial data with multiple date fields
    """
    print(f"🔨 Creating date-heavy dataset: {rows:,} rows × {date_cols} date columns...")
    
    data = {}
    base_date = datetime(2020, 1, 1)
    
    for i in range(date_cols):
        col_name = f"Date_Column_{i}"
        values = []
        
        for j in range(rows):
            # Generate dates with various formats and some empty values
            if j % 1000 == 0:  # 0.1% empty
                values.append(np.nan)
            else:
                # Generate a date offset
                days_offset = j % 1000
                current_date = base_date + timedelta(days=days_offset)
                
                # Use different formats for different columns to test parsing
                if i % 4 == 0:
                    # YYYY-MM-DD format
                    values.append(current_date.strftime('%Y-%m-%d'))
                elif i % 4 == 1:
                    # DD/MM/YYYY format
                    values.append(current_date.strftime('%d/%m/%Y'))
                elif i % 4 == 2:
                    # MM-DD-YYYY format
                    values.append(current_date.strftime('%m-%d-%Y'))
                else:
                    # Datetime objects
                    values.append(current_date)
        
        data[col_name] = values
    
    # Add some non-date columns
    data['ID'] = [f'ID_{i}' for i in range(rows)]
    data['Amount'] = [100.0 + i for i in range(rows)]
    data['Status'] = ['Active'] * rows
    
    df = pd.DataFrame(data)
    print(f"✅ Dataset created: {df.shape[0]:,} rows × {df.shape[1]} columns ({date_cols} date columns)")
    return df

def benchmark_standard_date_normalization(df: pd.DataFrame) -> tuple:
    """Benchmark standard (sequential) date normalization"""
    from app.routes.file_routes import normalize_datetime_columns
    
    df_copy = df.copy()
    start_time = time.time()
    
    print("⏱️  Running STANDARD date normalization...")
    df_copy = normalize_datetime_columns(df_copy)
    
    total_time = time.time() - start_time
    return df_copy, total_time

def benchmark_parallel_date_normalization(df: pd.DataFrame) -> tuple:
    """Benchmark parallel date normalization"""
    if not PARALLEL_DATE_AVAILABLE:
        return None, 0
        
    df_copy = df.copy()
    start_time = time.time()
    
    print("🚀 Running PARALLEL date normalization...")
    df_copy, converted_columns = normalize_datetime_columns_fast(df_copy)
    
    total_time = time.time() - start_time
    return df_copy, total_time, converted_columns

def run_date_normalization_benchmark():
    """Run comprehensive date normalization performance comparison"""
    print("=" * 80)
    print("PARALLEL DATE NORMALIZATION BENCHMARK")
    print("=" * 80)
    
    # Test scenarios with different numbers of date columns
    test_scenarios = [
        {"rows": 50000, "date_cols": 10, "name": "Medium Dataset"},
        {"rows": 100000, "date_cols": 20, "name": "Large Dataset"}, 
        {"rows": 200000, "date_cols": 30, "name": "Very Large Dataset"}
    ]
    
    results = []
    
    for scenario in test_scenarios:
        print(f"\n{'='*60}")
        print(f"TESTING: {scenario['name']} ({scenario['rows']:,} rows × {scenario['date_cols']} date columns)")
        print(f"{'='*60}")
        
        # Create test dataset
        df = create_date_heavy_dataset(scenario['rows'], scenario['date_cols'])
        total_cells = scenario['rows'] * scenario['date_cols']  # Only date columns
        
        # Test standard normalization
        print(f"\n📝 Testing standard sequential date normalization...")
        standard_df, standard_time = benchmark_standard_date_normalization(df)
        
        if PARALLEL_DATE_AVAILABLE:
            # Test parallel normalization
            print(f"\n🚀 Testing parallel date normalization...")
            parallel_df, parallel_time, converted_cols = benchmark_parallel_date_normalization(df)
            
            # Calculate performance metrics
            speedup = standard_time / parallel_time if parallel_time > 0 else 0
            parallel_efficiency = total_cells / parallel_time / 1000000 if parallel_time > 0 else 0  # Million cells/sec
            standard_efficiency = total_cells / standard_time / 1000000 if standard_time > 0 else 0
            
            results.append({
                'scenario': scenario['name'],
                'rows': scenario['rows'],
                'date_cols': scenario['date_cols'],
                'total_date_cells': total_cells,
                'standard_time': standard_time,
                'parallel_time': parallel_time,
                'speedup': speedup,
                'standard_mcells_per_sec': standard_efficiency,
                'parallel_mcells_per_sec': parallel_efficiency,
                'converted_columns': len(converted_cols) if converted_cols else 0
            })
            
            print(f"\n📈 PERFORMANCE COMPARISON:")
            print(f"   Standard normalization: {standard_time:.2f} seconds ({standard_efficiency:.2f} M cells/sec)")
            print(f"   Parallel normalization: {parallel_time:.2f} seconds ({parallel_efficiency:.2f} M cells/sec)")
            print(f"   🚀 Speedup: {speedup:.2f}x faster")
            print(f"   📅 Converted columns: {len(converted_cols) if converted_cols else 0}")
            
            # Verify results consistency
            date_cols_to_check = [col for col in df.columns if 'Date_Column' in col][:5]  # Check first 5
            consistent_results = True
            
            for col in date_cols_to_check:
                if col in standard_df.columns and col in parallel_df.columns:
                    # Sample check - compare first 10 values
                    standard_sample = standard_df[col].head(10).fillna('').tolist()
                    parallel_sample = parallel_df[col].head(10).fillna('').tolist()
                    
                    if standard_sample != parallel_sample:
                        consistent_results = False
                        print(f"   ⚠️  Inconsistent results in column '{col}'")
                        break
            
            if consistent_results:
                print(f"   ✅ Both approaches produce consistent results")
            
        else:
            print(f"\n📝 Standard normalization completed in {standard_time:.2f} seconds")
            results.append({
                'scenario': scenario['name'], 
                'rows': scenario['rows'],
                'date_cols': scenario['date_cols'],
                'standard_time': standard_time,
                'parallel_time': 'N/A',
                'speedup': 'N/A'
            })
    
    # Summary report
    print(f"\n{'='*80}")
    print("DATE NORMALIZATION PERFORMANCE SUMMARY")
    print(f"{'='*80}")
    
    if PARALLEL_DATE_AVAILABLE and results:
        print(f"{'Scenario':<20} {'Rows':<8} {'DateCols':<9} {'Standard':<10} {'Parallel':<10} {'Speedup':<10} {'Par M/s':<10}")
        print("-" * 80)
        
        total_speedup = 0
        count = 0
        
        for result in results:
            if isinstance(result.get('speedup', 0), (int, float)):
                speedup_str = f"{result['speedup']:.1f}x"
                total_speedup += result['speedup']
                count += 1
            else:
                speedup_str = str(result.get('speedup', 'N/A'))
                
            parallel_eff = result.get('parallel_mcells_per_sec', 0)
            parallel_eff_str = f"{parallel_eff:.1f}" if isinstance(parallel_eff, (int, float)) else 'N/A'
            
            print(f"{result['scenario']:<20} {result['rows']:>7,} {result['date_cols']:>8} {result['standard_time']:>9.1f}s {result.get('parallel_time', 'N/A'):>9}s {speedup_str:>9} {parallel_eff_str:>9}")
        
        if count > 0:
            avg_speedup = total_speedup / count
            print(f"\n🎯 Average speedup: {avg_speedup:.1f}x faster with parallel date normalization")
            
            if avg_speedup > 3:
                print("🚀 Excellent performance improvement! Parallel date processing is highly effective.")
            elif avg_speedup > 2:
                print("⚡ Good performance improvement with parallel processing.")
            else:
                print("📝 Modest improvement. Date parsing benefits from parallelization.")
    
    print(f"\n💡 KEY BENEFITS OF PARALLEL DATE NORMALIZATION:")
    print("   • Thread-safe date parsing with local caches")
    print("   • Parallel column detection across all columns")
    print("   • Vectorized date operations where possible")
    print("   • Optimized for datasets with many date columns")
    print("   • Maintains consistent YYYY-MM-DD output format")
    
    return results

if __name__ == "__main__":
    if PARALLEL_DATE_AVAILABLE:
        print("✅ Parallel date normalization is available!")
        results = run_date_normalization_benchmark()
        
        print(f"\n🎉 Your system now includes:")
        print("• Thread-safe parallel date column detection")
        print("• Multi-threaded date value normalization") 
        print("• Vectorized date processing optimizations")
        print("• Consistent YYYY-MM-DD format output")
        print("• Automatic integration with parallel data cleaning")
        
    else:
        print("❌ Parallel date normalization not available.")
        print("Please ensure the parallel_date_utils module is properly installed.")
    
    print(f"\n{'='*80}")
    print("Date normalization is now part of your parallel cleaning pipeline!")