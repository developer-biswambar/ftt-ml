import React, { useState, useEffect } from 'react';
import { ChevronDown, X, Filter, Check } from 'lucide-react';
import apiService from '../../services/defaultApi';

const ColumnFilterDropdown = ({ 
    fileId, 
    columnName, 
    onFilterSelect, 
    selectedValues = [],
    onClear,
    cascadeFilters = {} // New prop for cascading dropdown filters
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [uniqueValues, setUniqueValues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');

    useEffect(() => {
        if (isOpen && uniqueValues.length === 0) {
            loadUniqueValues();
        }
    }, [isOpen, fileId, columnName]);
    
    // Reload unique values when cascade filters change
    useEffect(() => {
        if (isOpen) {
            // Clear current values and reload with new filters
            setUniqueValues([]);
            loadUniqueValues();
        }
    }, [cascadeFilters]);

    const loadUniqueValues = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Prepare filters for cascading dropdowns
            // Only include filters from other columns (not the current column)
            const relevantFilters = {};
            Object.entries(cascadeFilters).forEach(([filterColumn, filterValues]) => {
                if (filterColumn !== columnName && filterValues && filterValues.length > 0) {
                    relevantFilters[filterColumn] = filterValues;
                }
            });
            
            console.log(`Loading unique values for ${columnName} with filters:`, relevantFilters);
            
            const response = await apiService.getColumnUniqueValues(fileId, columnName, 1000, relevantFilters);
            
            // Handle direct response format (not wrapped in success/data structure)
            if (response.unique_values) {
                setUniqueValues(response.unique_values || []);
            } else {
                setError('Failed to load values');
            }
        } catch (err) {
            console.error('Error loading unique values:', err);
            setError('Failed to load values');
        } finally {
            setLoading(false);
        }
    };

    const handleValueToggle = (value) => {
        let newSelectedValues;
        if (selectedValues.includes(value)) {
            // Remove value if already selected
            newSelectedValues = selectedValues.filter(v => v !== value);
        } else {
            // Add value if not selected
            newSelectedValues = [...selectedValues, value];
        }
        
        onFilterSelect(newSelectedValues);
        // Don't close dropdown for multi-select
    };

    const handleClear = () => {
        onClear();
        setIsOpen(false);
    };

    // Filter unique values based on search
    const filteredValues = uniqueValues.filter(value =>
        value?.toString().toLowerCase().includes(searchFilter.toLowerCase())
    );

    const displayText = selectedValues.length > 0
        ? selectedValues.length === 1 
            ? selectedValues[0]
            : `${selectedValues.length} selected`
        : 'All values';

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-2 px-3 py-1 text-xs border rounded-md transition-colors ${
                    selectedValues.length > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                title={selectedValues.length > 0 
                    ? `Filtered by: ${selectedValues.join(', ')}` 
                    : 'Filter column (multi-select)'}
            >
                <Filter size={12} />
                <span className="max-w-20 truncate">
                    {displayText}
                </span>
                <ChevronDown 
                    size={12} 
                    className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-hidden">
                    {/* Search box */}
                    <div className="p-2 border-b border-gray-100">
                        <input
                            type="text"
                            placeholder="Search values..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            autoFocus
                        />
                    </div>

                    {/* Clear option */}
                    <div className="border-b border-gray-100">
                        <button
                            onClick={handleClear}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                                selectedValues.length === 0 ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                            }`}
                        >
                            <span className="flex items-center space-x-2">
                                <span>All values</span>
                                {selectedValues.length === 0 && <Check size={12} />}
                            </span>
                            {selectedValues.length > 0 && (
                                <X size={12} className="text-gray-400" />
                            )}
                        </button>
                    </div>

                    {/* Values list */}
                    <div className="max-h-56 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-xs text-gray-500">Loading...</span>
                            </div>
                        ) : error ? (
                            <div className="px-3 py-2 text-xs text-red-600">
                                {error}
                            </div>
                        ) : filteredValues.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500">
                                {searchFilter ? 'No matching values' : 'No values found'}
                            </div>
                        ) : (
                            filteredValues.map((value, index) => {
                                const isSelected = selectedValues.includes(value);
                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleValueToggle(value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                                            isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                        }`}
                                        title={value}
                                    >
                                        <span className="flex items-center space-x-2 flex-1">
                                            {/* Checkbox */}
                                            <div className={`w-3 h-3 border border-gray-300 rounded-sm flex items-center justify-center ${
                                                isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white'
                                            }`}>
                                                {isSelected && (
                                                    <Check size={8} className="text-white" />
                                                )}
                                            </div>
                                            <span className="truncate">
                                                {value || '(empty)'}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer info */}
                    {!loading && !error && (
                        <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                            <div className="flex justify-between items-center">
                                <span>
                                    {searchFilter && filteredValues.length > 0 && (
                                        <>Showing {filteredValues.length} of {uniqueValues.length}</>
                                    )}
                                    {!searchFilter && uniqueValues.length > 0 && (
                                        <>Total: {uniqueValues.length} values</>
                                    )}
                                </span>
                                {selectedValues.length > 0 && (
                                    <span className="text-blue-600 font-medium">
                                        {selectedValues.length} selected
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop to close dropdown */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default ColumnFilterDropdown;