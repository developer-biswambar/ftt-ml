import React, {useEffect, useState} from 'react';
import {AlertCircle, Calendar, ChevronDown, Filter, Minus, Plus, Search} from 'lucide-react';
import {deltaApiService} from '../../services/deltaApiService.js';

const FilterDataStep = ({
                            filesArray,
                            fileFilters,
                            addFilter,
                            updateFilter,
                            removeFilter,
                            fileColumns
                        }) => {
    const [uniqueValueCache, setUniqueValueCache] = useState({});
    const [loadingValues, setLoadingValues] = useState({});
    const [expandedFilters, setExpandedFilters] = useState({});


    // Fetch unique values for a column
    const fetchUniqueValues = async (fileId, columnName, filterKey) => {
        const cacheKey = `${fileId}_${columnName}`;

        if (uniqueValueCache[cacheKey]) {
            return uniqueValueCache[cacheKey];
        }

        setLoadingValues(prev => ({...prev, [filterKey]: true}));

        try {
            const response = await deltaApiService.getColumnUniqueValues(fileId, columnName, 1000);

            setUniqueValueCache(prev => ({
                ...prev,
                [cacheKey]: response
            }));

            return response;
        } catch (error) {
            console.error('Error fetching unique values:', error);
            return {unique_values: [], is_date_column: false, total_unique: 0};
        } finally {
            setLoadingValues(prev => ({...prev, [filterKey]: false}));
        }
    };

    // Toggle value selection in filter
    const toggleValueInFilter = (fileKey, filterIndex, value) => {
        const currentFilter = fileFilters[fileKey][filterIndex];
        const currentValues = currentFilter.values || [];

        let newValues;
        if (currentValues.includes(value)) {
            newValues = currentValues.filter(v => v !== value);
        } else {
            newValues = [...currentValues, value];
        }

        updateFilter(fileKey, filterIndex, 'values', newValues);
    };

    // Select all values in filter
    const selectAllValues = (fileKey, filterIndex, allValues) => {
        updateFilter(fileKey, filterIndex, 'values', [...allValues]);
    };

    // Clear all values in filter
    const clearAllValues = (fileKey, filterIndex) => {
        updateFilter(fileKey, filterIndex, 'values', []);
    };

    // Toggle filter expansion
    const toggleFilterExpansion = (filterKey) => {
        setExpandedFilters(prev => ({
            ...prev,
            [filterKey]: !prev[filterKey]
        }));
    };

    const renderFileFilterSection = (fileIndex) => {
        const file = filesArray[fileIndex];
        if (!file) return null;

        const fileKey = `file_${fileIndex}`;
        const filters = fileFilters[fileKey] || [];
        const availableColumns = fileColumns[file.file_id] || [];
        const colors = ['blue', 'green'];
        const labels = ['Older File (FileA)', 'Newer File (FileB)'];
        const letters = ['A', 'B'];

        return (
            <div key={fileIndex}
                 className={`p-4 border border-${colors[fileIndex]}-200 bg-${colors[fileIndex]}-50 rounded-lg`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <div
                            className={`w-6 h-6 bg-${colors[fileIndex]}-500 rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                            {letters[fileIndex]}
                        </div>
                        <h4 className={`text-md font-medium text-${colors[fileIndex]}-800`}>
                            {labels[fileIndex]}: {file.filename}
                        </h4>
                    </div>
                    <button
                        onClick={() => addFilter(fileKey)}
                        className={`flex items-center space-x-1 px-3 py-1 bg-${colors[fileIndex]}-500 text-white rounded hover:bg-${colors[fileIndex]}-600 text-sm`}
                    >
                        <Plus size={14}/>
                        <span>Add Filter</span>
                    </button>
                </div>

                <div className="space-y-3">
                    {filters.map((filter, filterIndex) => {
                        const filterKey = `${fileKey}_${filterIndex}`;
                        const isExpanded = expandedFilters[filterKey];
                        const isLoading = loadingValues[filterKey];

                        return (
                            <div key={filterIndex}
                                 className={`p-3 bg-white border border-${colors[fileIndex]}-200 rounded-lg`}>
                                {/* Filter Header */}
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Column to Filter
                                        </label>
                                        <select
                                            value={filter.column || ''}
                                            onChange={(e) => {
                                                updateFilter(fileKey, filterIndex, 'column', e.target.value);
                                                // Clear values when column changes
                                                updateFilter(fileKey, filterIndex, 'values', []);
                                                // Clear cache for new column
                                                const cacheKey = `${file.file_id}_${e.target.value}`;
                                                setUniqueValueCache(prev => {
                                                    const newCache = {...prev};
                                                    delete newCache[cacheKey];
                                                    return newCache;
                                                });
                                            }}
                                            className={`w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-${colors[fileIndex]}-500`}
                                        >
                                            <option value="">Select Column</option>
                                            {availableColumns.map(col => (
                                                <option key={col} value={col}>{col}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {filter.column && (
                                            <button
                                                onClick={() => toggleFilterExpansion(filterKey)}
                                                className={`flex items-center space-x-1 px-3 py-2 bg-${colors[fileIndex]}-100 text-${colors[fileIndex]}-700 rounded text-sm hover:bg-${colors[fileIndex]}-200`}
                                            >
                                                <Filter size={14}/>
                                                <span>
                                                    {filter.values?.length || 0} selected
                                                </span>
                                                <ChevronDown
                                                    size={14}
                                                    className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => removeFilter(fileKey, filterIndex)}
                                            className="p-2 text-red-400 hover:text-red-600"
                                            title="Remove filter"
                                        >
                                            <Minus size={14}/>
                                        </button>
                                    </div>
                                </div>

                                {/* Filter Values Selection */}
                                {filter.column && isExpanded && (
                                    <FilterValueSelector
                                        fileId={file.file_id}
                                        columnName={filter.column}
                                        selectedValues={filter.values || []}
                                        onValueToggle={(value) => toggleValueInFilter(fileKey, filterIndex, value)}
                                        onSelectAll={(allValues) => selectAllValues(fileKey, filterIndex, allValues)}
                                        onClearAll={() => clearAllValues(fileKey, filterIndex)}
                                        fetchUniqueValues={() => fetchUniqueValues(file.file_id, filter.column, filterKey)}
                                        isLoading={isLoading}
                                        colorScheme={colors[fileIndex]}
                                    />
                                )}

                                {/* Filter Summary */}
                                {filter.column && filter.values && filter.values.length > 0 && (
                                    <div className={`mt-2 p-2 bg-${colors[fileIndex]}-50 rounded text-xs`}>
                                        <span
                                            className={`text-${colors[fileIndex]}-700 font-medium`}>Active Filter:</span>
                                        <span className={`ml-1 text-${colors[fileIndex]}-600`}>
                                            {filter.column} equals {filter.values.length} value{filter.values.length !== 1 ? 's' : ''}
                                        </span>
                                        {filter.values.length <= 3 && (
                                            <span className={`ml-1 text-${colors[fileIndex]}-500`}>
                                                ({filter.values.join(', ')})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filters.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            <Filter size={32} className="mx-auto mb-2 opacity-50"/>
                            <p className="text-sm">No filters applied to this file.</p>
                            <p className="text-xs">Add filters to reduce the data before delta generation.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Filter Data (Optional)</h3>
                <p className="text-sm text-gray-600">
                    Apply filters to both files before delta generation. This can help reduce processing time and focus
                    on specific data subsets.
                    Filters support exact matching with automatic date format handling.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderFileFilterSection(0)}
                {renderFileFilterSection(1)}
            </div>

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p><strong>Filter Information:</strong></p>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                    <li>Filters use exact matching ("equals" only)</li>
                    <li>Date columns are automatically detected and formatted consistently</li>
                    <li>Multiple values per column act as OR conditions</li>
                    <li>Multiple columns act as AND conditions</li>
                    <li>Filters are applied during delta processing, not stored in rules</li>
                </ul>
            </div>
        </div>
    );
};

// Filter Value Selector Component
const FilterValueSelector = ({
                                 fileId,
                                 columnName,
                                 selectedValues,
                                 onValueToggle,
                                 onSelectAll,
                                 onClearAll,
                                 fetchUniqueValues,
                                 isLoading,
                                 colorScheme
                             }) => {
    const [uniqueValuesData, setUniqueValuesData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (columnName) {
            loadUniqueValues();
        }
    }, [columnName]);

    const loadUniqueValues = async () => {
        try {
            const data = await fetchUniqueValues();
            setUniqueValuesData(data);
        } catch (error) {
            console.error('Error loading unique values:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-2">Loading values...</p>
            </div>
        );
    }

    if (!uniqueValuesData) {
        return (
            <div className="text-center py-4">
                <AlertCircle size={24} className="mx-auto mb-2 text-gray-400"/>
                <p className="text-xs text-gray-500">Failed to load values</p>
                <button
                    onClick={loadUniqueValues}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                >
                    Retry
                </button>
            </div>
        );
    }

    const {unique_values, is_date_column, total_unique, has_more} = uniqueValuesData;

    // Filter values based on search term
    const filteredValues = unique_values.filter(value =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Limit display for performance
    const displayValues = showAll ? filteredValues : filteredValues.slice(0, 100);

    return (
        <div className={`border border-${colorScheme}-200 rounded p-3 bg-white`}>
            {/* Header with controls */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    {is_date_column && (
                        <Calendar size={14} className={`text-${colorScheme}-600`}/>
                    )}
                    <span className="text-xs font-medium text-gray-700">
                        {total_unique.toLocaleString()} unique values
                        {has_more && ` (showing first 1000)`}
                    </span>
                </div>

                <div className="flex space-x-2">
                    <button
                        onClick={() => onSelectAll(filteredValues)}
                        className={`text-xs px-2 py-1 bg-${colorScheme}-500 text-white rounded hover:bg-${colorScheme}-600`}
                    >
                        Select All
                    </button>
                    <button
                        onClick={onClearAll}
                        className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
                <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                <input
                    type="text"
                    placeholder="Search values..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            {/* Values list */}
            <div className="max-h-48 overflow-y-auto space-y-1">
                {displayValues.map((value, index) => (
                    <label key={index}
                           className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                            type="checkbox"
                            checked={selectedValues.includes(value)}
                            onChange={() => onValueToggle(value)}
                            className={`rounded border-gray-300 text-${colorScheme}-600 focus:ring-${colorScheme}-500`}
                        />
                        <span className={`flex-1 ${is_date_column ? 'font-mono' : ''}`}>
                            {value}
                        </span>
                    </label>
                ))}
            </div>

            {/* Show more button */}
            {!showAll && filteredValues.length > 100 && (
                <div className="text-center mt-2">
                    <button
                        onClick={() => setShowAll(true)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                    >
                        Show all {filteredValues.length} values...
                    </button>
                </div>
            )}

            {/* Selection summary */}
            {selectedValues.length > 0 && (
                <div className={`mt-2 p-2 bg-${colorScheme}-50 rounded text-xs`}>
                    <span className={`text-${colorScheme}-700 font-medium`}>
                        {selectedValues.length} value{selectedValues.length !== 1 ? 's' : ''} selected
                    </span>
                    {selectedValues.length <= 5 && (
                        <span className={`ml-1 text-${colorScheme}-600`}>
                            ({selectedValues.join(', ')})
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterDataStep;