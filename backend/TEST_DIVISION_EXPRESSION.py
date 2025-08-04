#!/usr/bin/env python3
"""
Test script to verify Stock_Quantity / (Stock_Quantity - Reorder_Level) expression
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.routes.transformation_routes import evaluate_expression

def test_division_expression():
    """Test the specific expression that's failing"""
    
    # Test with sample data from products_test.csv
    test_cases = [
        {"Stock_Quantity": 15, "Reorder_Level": 5},    # PROD001
        {"Stock_Quantity": 25, "Reorder_Level": 10},   # PROD002
        {"Stock_Quantity": 100, "Reorder_Level": 25},  # PROD006
    ]
    
    expression = "{Stock_Quantity} / ({Stock_Quantity} - {Reorder_Level})"
    
    print(f"Testing expression: {expression}")
    print("=" * 60)
    
    for i, row_data in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"Row data: {row_data}")
        
        try:
            result = evaluate_expression(expression, row_data)
            expected = row_data["Stock_Quantity"] / (row_data["Stock_Quantity"] - row_data["Reorder_Level"])
            
            print(f"Expression result: {result}")
            print(f"Expected result: {expected}")
            print(f"Match: {'✅' if abs(float(result) - expected) < 0.0001 else '❌'}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("If all tests show ✅, the expression should work in transformation!")

if __name__ == "__main__":
    test_division_expression()