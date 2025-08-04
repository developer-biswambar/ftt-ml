#!/usr/bin/env python3
"""
Test script to verify complex expressions with calculated fields
"""

import re
import logging

def evaluate_expression(expression, row_data):
    """Simplified version of the transformation expression evaluator"""
    if not expression or not isinstance(expression, str):
        return expression
    
    try:
        if '{' in expression and '}' in expression:
            variables = re.findall(r'\{([^}]+)\}', expression)
            result_expression = expression
            
            print(f"  Variables found: {variables}")
            print(f"  Available data: {list(row_data.keys())}")
            
            for var in variables:
                if var in row_data:
                    value = row_data[var]
                    if isinstance(value, (int, float)):
                        result_expression = result_expression.replace(f'{{{var}}}', str(value))
                    else:
                        result_expression = result_expression.replace(f'{{{var}}}', f'"{str(value)}"')
                else:
                    print(f'  ⚠️  Variable "{var}" not found in row data')
                    return f'ERROR: Variable {var} not found'
            
            print(f"  Substituted expression: {result_expression}")
            
            # Check for math operations
            if any(op in result_expression for op in ['+', '-', '*', '/', '(', ')', '%']):
                safe_context = {
                    '__builtins__': {},
                    'abs': abs, 'round': round, 'min': min, 'max': max,
                    'int': int, 'float': float, 'str': str
                }
                
                try:
                    result = eval(result_expression, safe_context)
                    return result
                except Exception as e:
                    return f'EVAL_ERROR: {e}'
            else:
                return result_expression.replace('"', '')
        else:
            return expression
    except Exception as e:
        return f'ERROR: {e}'

def simulate_progressive_calculation():
    """Simulate how the backend now processes columns progressively"""
    
    print('🧪 Testing Complex Expression with Progressive Column Building')
    print('=' * 70)
    
    # Simulate source data
    source_row = {
        'Retail_Price': 1299.99,
        'Cost_Price': 999.99,
        'Stock_Quantity': 15,
        'Investment': 5000
    }
    
    # Simulate column definitions in order
    column_configs = [
        {
            'name': 'roi_percentage',
            'static_value': '({Retail_Price} - {Cost_Price}) / {Investment} * 100'
        },
        {
            'name': 'investment_efficiency', 
            'static_value': '{Stock_Quantity} / {Investment} * 1000'
        },
        {
            'name': 'capital_turnover_potential',
            'static_value': '{Retail_Price} / {Investment}'
        },
        {
            'name': 'composite_score',
            'static_value': '({roi_percentage} + {investment_efficiency} + {capital_turnover_potential}) / 3'
        }
    ]
    
    # Simulate progressive calculation (like the fixed backend)
    combined_row_data = source_row.copy()
    output_row = {}
    
    print(f'Starting with source data: {source_row}')
    print()
    
    for i, column_config in enumerate(column_configs, 1):
        column_name = column_config['name']
        expression = column_config['static_value']
        
        print(f'Step {i}: Calculating {column_name}')
        print(f'  Expression: {expression}')
        
        result = evaluate_expression(expression, combined_row_data)
        
        if isinstance(result, str) and result.startswith('ERROR'):
            print(f'  ❌ {result}')
            break
        else:
            print(f'  ✅ Result: {result}')
            output_row[column_name] = result
            combined_row_data[column_name] = result  # Add to available data for next calculation
            print(f'  Updated available data: {list(combined_row_data.keys())}')
        
        print()
    
    print('Final Output:')
    for col, val in output_row.items():
        print(f'  {col}: {val}')
    
    # Test the specific complex expression you mentioned
    print()
    print('🎯 Testing Your Specific Complex Expression:')
    print('   ({roi_percentage} + {investment_efficiency} + {capital_turnover_potential}) / 3')
    
    final_result = evaluate_expression(
        '({roi_percentage} + {investment_efficiency} + {capital_turnover_potential}) / 3',
        combined_row_data
    )
    print(f'   Result: {final_result}')
    
    if isinstance(final_result, (int, float)):
        print('   ✅ SUCCESS: Complex expression with calculated fields works!')
    else:
        print('   ❌ FAILED: Complex expression failed')

if __name__ == "__main__":
    simulate_progressive_calculation()