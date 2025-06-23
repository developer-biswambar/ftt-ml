# storage.py - Shared Storage Module

"""
Shared storage module for uploaded files, extractions, and comparisons.
This module provides centralized storage that can be imported by other modules.
"""

# Global storage dictionaries
uploaded_files = {}
extractions = {}
comparisons = {}  # New storage for file comparisons