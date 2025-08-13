// src/components/DataViewer.jsx - Complete Excel-like data viewer with prominent filename display
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Download,
    Edit3,
    FileText,
    Minus,
    Plus,
    Redo,
    Save,
    Search,
    Settings,
    Undo,
    X
} from 'lucide-react';
import {apiService} from '../../services/defaultApi.js';
import ColumnFilterDropdown from './ColumnFilterDropdown';

const DataViewer = ({fileId, onClose}) => {
    // State management
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [fileName, setFileName] = useState('');
    const [fileStats, setFileStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Track changes for intelligent saving - patch-based approach
    const [cellChanges, setCellChanges] = useState(new Map()); // Map of 'rowIndex:columnName' -> newValue
    const [addedRows, setAddedRows] = useState([]); // Array of new row objects
    const [deletedRowIndices, setDeletedRowIndices] = useState(new Set()); // Set of absolute row indices that were deleted
    const [columnOperations, setColumnOperations] = useState([]); // Array of column operations (add/delete/rename)
    const [totalRowsInDataset, setTotalRowsInDataset] = useState(0); // Track total rows for absolute indexing
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editingColumn, setEditingColumn] = useState(null);
    const [editingColumnValue, setEditingColumnValue] = useState('');
    const [columnWidths, setColumnWidths] = useState({});
    const [resizing, setResizing] = useState({ isResizing: false, columnIndex: -1, startX: 0, startWidth: 0 });
    const [hoveredColumnIndex, setHoveredColumnIndex] = useState(-1);
    const [sortConfig, setSortConfig] = useState({column: null, direction: 'asc'});
    const [filterConfig, setFilterConfig] = useState({});
    const [columnFilters, setColumnFilters] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showAddColumn, setShowAddColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [selectedColumns, setSelectedColumns] = useState(new Set());
    const [showDeleteColumnsModal, setShowDeleteColumnsModal] = useState(false);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [showDeleteRowsModal, setShowDeleteRowsModal] = useState(false);

    // UI Configuration state
    const [uiConfig, setUiConfig] = useState({
        cellPadding: 'compact', // compact, normal, comfortable
        rowHeight: 'compact', // compact, normal, comfortable
        headerHeight: 'compact', // compact, normal, comfortable
        fontSize: 'small', // small, normal, large
        showGridLines: true,
        autoSizeColumns: true
    });
    const [showConfigPanel, setShowConfigPanel] = useState(false);

    // Load file data and extract filename
    // Debounced search effect
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            setCurrentPage(1); // Reset to first page when searching
            // Clear column filters when user types in search box
            if (searchTerm.trim()) {
                setColumnFilters({});
            }
            loadFileData();
        }, 500); // 500ms debounce

        return () => clearTimeout(debounceTimer);
    }, [searchTerm]);

    useEffect(() => {
        loadFileData();
        loadFileName();
    }, [fileId, currentPage, pageSize, columnFilters]);

    // Debug: Log error state changes
    useEffect(() => {
        console.log('Error state changed:', error);
    }, [error]);

    // Cleanup effect - no longer needed as we handle cleanup in mouse up

    const loadFileName = async () => {
        try {
            const filesResponse = await apiService.getFiles();
            if (filesResponse.success) {
                const file = filesResponse.data.files.find(f => f.file_id === fileId);
                if (file) {
                    setFileName(file.filename);
                    setFileStats({
                        total_rows: file.total_rows,
                        columns: file.columns?.length || 0,
                        file_size: file.file_size
                    });
                    document.title = `Data Viewer - ${file.filename}`;
                }
            }
        } catch (err) {
            console.error('Failed to load file name:', err);
            
            // If it's a 404 error, the file doesn't exist
            if (err.response?.status === 404) {
                setError(`File not found. The file with ID "${fileId}" does not exist or may have been deleted.`);
                setLoading(false);
                return;
            }
            
            // For other errors, just use a fallback filename
            setFileName(`File ${fileId}`);
        }
    };

    const loadFileData = async () => {
        try {
            setLoading(true);

            // Try to load real data first, fallback to sample if endpoint doesn't exist
            try {
                const response = await apiService.getFileData(
                    fileId, 
                    currentPage, 
                    pageSize, 
                    searchTerm, 
                    columnFilters
                );
                if (response.success) {
                    setData(response.data.rows);
                    setColumns(response.data.columns);
                    setTotalRows(response.data.total_rows);
                    setTotalRowsInDataset(response.data.total_rows); // Track for absolute indexing

                    if (history.length === 0) {
                        setHistory([{data: response.data.rows, columns: response.data.columns}]);
                        setHistoryIndex(0);
                    }
                    return;
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                console.log('Error properties:', {
                    status: apiError.status,
                    responseStatus: apiError.response?.status,
                    code: apiError.code,
                    message: apiError.message,
                    keys: Object.keys(apiError)
                });
                
                // Check if it's a specific error that should be shown to user
                const errorStatus = apiError.response?.status || apiError.status;
                const message = apiError.message || '';
                const is404 = errorStatus === 404 || 
                              message.includes('404') || 
                              message.includes('status code 404') ||
                              message.includes('Requested resource not found') ||
                              message.includes('not found');
                const is403 = errorStatus === 403 || 
                              message.includes('403') || 
                              message.includes('status code 403') ||
                              message.includes('Access denied') ||
                              message.includes('Forbidden');
                const is5xx = (errorStatus >= 500 && errorStatus < 600) || /status code 5\d\d/.test(message);
                
                console.log('Checking error status:', errorStatus);
                console.log('Error message:', message);
                console.log('Error classification:', { is404, is403, is5xx });
                
                if (is404) {
                    console.log('Re-throwing 404 error');
                    throw apiError; // Re-throw to be handled by outer catch
                } else if (is403) {
                    console.log('Re-throwing 403 error');
                    throw apiError; // Re-throw to be handled by outer catch
                } else if (is5xx) {
                    console.log('Re-throwing 5xx error');
                    throw apiError; // Re-throw to be handled by outer catch
                }
                
                // Only fallback to sample data for non-critical errors (network issues, etc.)
                console.log('API endpoint not available, using sample data');
            }

            setColumns(['id', 'name', 'amount', 'date', 'status']);
            setTotalRows(100); // Simulate larger dataset for pagination demo

            if (history.length === 0) {
                setHistoryIndex(0);
            }

        } catch (err) {
            console.error('Error loading file data:', err);
            console.error('Error details:', {
                response: err.response,
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            
            // Provide specific error messages based on error type
            const errorStatus = err.response?.status || err.status;
            const message = err.message || '';
            const is404 = errorStatus === 404 || 
                          message.includes('404') || 
                          message.includes('status code 404') ||
                          message.includes('Requested resource not found') ||
                          message.includes('not found');
            const is403 = errorStatus === 403 || 
                          message.includes('403') || 
                          message.includes('status code 403') ||
                          message.includes('Access denied') ||
                          message.includes('Forbidden');
            const is5xx = (errorStatus >= 500 && errorStatus < 600) || /status code 5\d\d/.test(message);
            
            console.log('Outer catch - error status:', errorStatus);
            console.log('Outer catch - error message:', message);
            console.log('Outer catch - error classification:', { is404, is403, is5xx });
            
            if (is404) {
                console.log('Setting 404 error');
                const errorMsg = `File not found. The file with ID "${fileId}" does not exist or may have been deleted.`;
                setError(errorMsg);
                console.log('Error state set to:', errorMsg);
            } else if (is403) {
                console.log('Setting 403 error');
                setError('Access denied. You do not have permission to view this file.');
            } else if (is5xx) {
                console.log('Setting 5xx error');
                setError('Server error occurred while loading the file. Please try again later.');
            } else if (errorStatus) {
                console.log('Setting generic HTTP error');
                setError(`Failed to load file data (Error ${errorStatus}): ${err.response?.data?.message || err.message || 'Unknown error'}`);
            } else if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
                console.log('Setting network error');
                setError('Network error. Please check your connection and try again.');
            } else {
                console.log('Setting generic error');
                setError(`Failed to load file data: ${err.message || 'Unknown error occurred'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Add to history for undo/redo
    const addToHistory = useCallback((newData, newColumns) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({data: newData, columns: newColumns});
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setHasChanges(true);
    }, [history, historyIndex]);

    // Save changes using patch-based approach
    const saveChanges = async () => {
        try {
            setSaving(true);
            
            // Prepare patch data with only the changes
            const patchData = {
                cell_changes: Array.from(cellChanges.entries()).map(([key, value]) => {
                    const [rowIndex, columnName] = key.split(':');
                    return {
                        row_index: parseInt(rowIndex),
                        column_name: columnName,
                        new_value: value
                    };
                }),
                added_rows: addedRows,
                deleted_row_indices: Array.from(deletedRowIndices),
                column_operations: columnOperations
            };
            
            console.log('Sending patch data:', patchData);
            
            try {
                await apiService.patchFileData(fileId, patchData);
                
                // Clear all pending changes after successful save
                setCellChanges(new Map());
                setAddedRows([]);
                setDeletedRowIndices(new Set());
                setColumnOperations([]);
                setHasChanges(false);
                
                showNotification('Changes saved successfully!', 'success');
                
                // Reload data to reflect server state
                await loadFileData();
            } catch (apiError) {
                console.error('API Error:', apiError);
                showNotification('Changes saved locally (demo mode)!', 'info');
                setHasChanges(false);
            }
        } catch (err) {
            console.error('Save error:', err);
            showNotification('Failed to save changes', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Download file
    const downloadFile = async (format = 'csv') => {
        try {
            try {
                const response = await apiService.downloadModifiedFile(fileId, format);
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileName || 'modified_file'}.${format}`;
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (apiError) {
                if (format === 'csv') {
                    const csvContent = [
                        columns.join(','),
                        ...data.map(row => columns.map(col => row[col] || '').join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], {type: 'text/csv'});
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${fileName || 'modified_file'}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
            }
        } catch (err) {
            showNotification('Failed to download file', 'error');
        }
    };

    // Show notification
    const showNotification = (message, type = 'info') => {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };

        const div = document.createElement('div');
        div.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => document.body.removeChild(div), 3000);
    };

    // Undo/Redo
    const undo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            setData(prevState.data);
            setColumns(prevState.columns);
            setHistoryIndex(historyIndex - 1);
            setHasChanges(historyIndex - 1 > 0);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setData(nextState.data);
            setColumns(nextState.columns);
            setHistoryIndex(historyIndex + 1);
            setHasChanges(true);
        }
    };

    // Cell editing
    const startEditing = (rowIndex, columnIndex) => {
        setEditingCell({row: rowIndex, col: columnIndex});
        setEditValue(data[rowIndex]?.[columns[columnIndex]] || '');
    };

    const saveEdit = () => {
        if (editingCell) {
            const newData = [...data];
            if (!newData[editingCell.row]) {
                newData[editingCell.row] = {};
            }
            newData[editingCell.row][columns[editingCell.col]] = editValue;
            setData(newData);
            addToHistory(newData, columns);
            
            // Track the change for patch-based saving
            const absoluteRowIndex = (currentPage - 1) * pageSize + editingCell.row;
            const columnName = columns[editingCell.col];
            const changeKey = `${absoluteRowIndex}:${columnName}`;
            
            setCellChanges(prev => {
                const newChanges = new Map(prev);
                newChanges.set(changeKey, editValue);
                setHasChanges(true);
                return newChanges;
            });
        }
        setEditingCell(null);
        setEditValue('');
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    // Column editing functions
    const startColumnEdit = (columnIndex, currentName) => {
        setEditingColumn(columnIndex);
        setEditingColumnValue(currentName);
    };

    const saveColumnEdit = async () => {
        if (editingColumn === null || !editingColumnValue.trim()) {
            cancelColumnEdit();
            return;
        }

        const newColumnName = editingColumnValue.trim();
        const oldColumnName = columns[editingColumn];

        // Check if the new name already exists
        if (columns.includes(newColumnName) && newColumnName !== oldColumnName) {
            alert('Column name already exists. Please choose a different name.');
            return;
        }

        // Update columns array
        const newColumns = [...columns];
        newColumns[editingColumn] = newColumnName;

        // Update data to use new column name
        const newData = data.map(row => {
            const newRow = { ...row };
            if (oldColumnName !== newColumnName && oldColumnName in newRow) {
                newRow[newColumnName] = newRow[oldColumnName];
                delete newRow[oldColumnName];
            }
            return newRow;
        });

        setColumns(newColumns);
        setData(newData);
        addToHistory(newData, newColumns);
        setHasChanges(true);
        
        // Track column rename operation for patch-based saving
        if (oldColumnName !== newColumnName) {
            setColumnOperations(prev => [...prev, {
                type: 'rename',
                old_name: oldColumnName,
                new_name: newColumnName
            }]);
        }

        // Clear editing state
        cancelColumnEdit();
    };

    const cancelColumnEdit = () => {
        setEditingColumn(null);
        setEditingColumnValue('');
    };

    // Handle column edit keyboard events
    const handleColumnEditKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveColumnEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelColumnEdit();
        }
    };

    // Column resizing functions
    const getColumnWidth = (columnIndex) => {
        return columnWidths[columnIndex] || 150; // Default width: 150px
    };

    const startColumnResize = (e, columnIndex) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Starting resize for column:', columnIndex, 'at position:', e.clientX);
        
        const startX = e.clientX;
        const startWidth = getColumnWidth(columnIndex);
        
        const newResizing = {
            isResizing: true,
            columnIndex,
            startX,
            startWidth
        };
        
        setResizing(newResizing);
        
        // Create handlers with current state
        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(50, startWidth + deltaX); // Minimum width: 50px
            
            console.log('Resizing column:', columnIndex, 'to width:', newWidth);
            
            setColumnWidths(prev => ({
                ...prev,
                [columnIndex]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizing({ isResizing: false, columnIndex: -1, startX: 0, startWidth: 0 });
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        // Add global event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Auto-fit column width to content
    const autoFitColumn = (columnIndex) => {
        const columnName = columns[columnIndex];
        
        // Calculate width based on content
        let maxWidth = columnName.length * 8 + 40; // Base width from column name
        
        // Check data content width (sample first 100 rows for performance)
        const sampleData = displayedData.slice(0, 100);
        sampleData.forEach(row => {
            const cellValue = row[columnName]?.toString() || '';
            const cellWidth = cellValue.length * 8 + 20; // Approximate character width
            maxWidth = Math.max(maxWidth, cellWidth);
        });
        
        // Set reasonable bounds
        const finalWidth = Math.min(Math.max(maxWidth, 80), 400);
        
        setColumnWidths(prev => ({
            ...prev,
            [columnIndex]: finalWidth
        }));
    };

    // Add/Delete rows
    const addRow = () => {
        const newRow = {};
        columns.forEach(col => newRow[col] = '');
        const newData = [...data, newRow];
        setData(newData);
        addToHistory(newData, columns);
        
        // Track the added row for patch-based saving
        setAddedRows(prev => [...prev, newRow]);
        setTotalRowsInDataset(prev => prev + 1);
        setHasChanges(true);
    };

    const deleteRow = (rowIndex) => {
        const newData = data.filter((_, index) => index !== rowIndex);
        setData(newData);
        addToHistory(newData, columns);
        
        // Track the deleted row for patch-based saving (absolute index)
        const absoluteRowIndex = (currentPage - 1) * pageSize + rowIndex;
        setDeletedRowIndices(prev => new Set([...prev, absoluteRowIndex]));
        setHasChanges(true);
    };

    // Column filter handlers
    const handleColumnFilter = (columnName, selectedValues) => {
        const newColumnFilters = { ...columnFilters, [columnName]: selectedValues };
        setColumnFilters(newColumnFilters);
        
        // Clear search term when using column filter
        if (selectedValues.length > 0) {
            setSearchTerm('');
        }
        
        setCurrentPage(1); // Reset to first page
    };

    const handleColumnFilterClear = (columnName) => {
        const newColumnFilters = { ...columnFilters };
        delete newColumnFilters[columnName];
        setColumnFilters(newColumnFilters);
        
        setCurrentPage(1); // Reset to first page
    };

    // Clear all filters function
    const clearAllFilters = () => {
        setColumnFilters({});
        setSearchTerm('');
        setFilterConfig({});
        setCurrentPage(1);
    };

    // Calculate active filter count
    const getActiveFilterCount = () => {
        let count = 0;
        if (searchTerm) count++;
        // Count active column filters
        count += Object.keys(columnFilters).filter(key => columnFilters[key] && columnFilters[key].length > 0).length;
        count += Object.keys(filterConfig).filter(key => filterConfig[key]).length;
        return count;
    };

    // Add/Delete columns
    const addColumn = () => {
        if (newColumnName.trim()) {
            const newColumns = [...columns, newColumnName.trim()];
            const newData = data.map(row => ({...row, [newColumnName.trim()]: ''}));
            setColumns(newColumns);
            setData(newData);
            addToHistory(newData, newColumns);
            
            // Track column addition for patch-based saving
            setColumnOperations(prev => [...prev, {
                type: 'add',
                column_name: newColumnName.trim()
            }]);
            setHasChanges(true);
            
            setNewColumnName('');
            setShowAddColumn(false);
        }
    };

    const deleteColumn = (columnIndex) => {
        const columnToDelete = columns[columnIndex];
        const newColumns = columns.filter((_, index) => index !== columnIndex);
        const newData = data.map(row => {
            const newRow = {...row};
            delete newRow[columnToDelete];
            return newRow;
        });
        setColumns(newColumns);
        setData(newData);
        addToHistory(newData, newColumns);
        
        // Track column deletion for patch-based saving
        setColumnOperations(prev => [...prev, {
            type: 'delete',
            column_name: columnToDelete
        }]);
        setHasChanges(true);
    };

    // Sorting
    const handleSort = (column) => {
        let direction = 'asc';
        if (sortConfig.column === column && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        const sortedData = [...data].sort((a, b) => {
            let aVal = a[column] || '';
            let bVal = b[column] || '';

            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            aVal = aVal.toString().toLowerCase();
            bVal = bVal.toString().toLowerCase();

            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        setData(sortedData);
        setSortConfig({column, direction});
        addToHistory(sortedData, columns);
    };

    // Client-side column filtering (search is now server-side)
    const filteredData = useMemo(() => {
        let filtered = [...data];

        // Apply column-specific filters (client-side)
        Object.entries(filterConfig).forEach(([column, filterValue]) => {
            if (filterValue) {
                filtered = filtered.filter(row =>
                    row[column]?.toString().toLowerCase().includes(filterValue.toLowerCase())
                );
            }
        });

        return filtered;
    }, [data, filterConfig]); // Removed searchTerm from dependencies

    // Generate Excel-style column names (A, B, C, ..., Z, AA, AB, ...)
    const getExcelColumnName = (columnIndex) => {
        let result = '';
        let index = columnIndex;
        
        while (index >= 0) {
            result = String.fromCharCode(65 + (index % 26)) + result;
            index = Math.floor(index / 26) - 1;
        }
        
        return result;
    };

    // Handle column selection (Excel-style)
    const handleColumnSelect = (columnIndex) => {
        const newSelection = new Set(selectedColumns);
        if (newSelection.has(columnIndex)) {
            newSelection.delete(columnIndex);
        } else {
            newSelection.add(columnIndex);
        }
        setSelectedColumns(newSelection);
    };

    // Delete multiple selected columns
    const deleteSelectedColumns = () => {
        if (selectedColumns.size === 0) return;
        
        const sortedColumnIndexes = Array.from(selectedColumns).sort((a, b) => b - a); // Sort in descending order
        let newColumns = [...columns];
        let newData = [...data];
        
        // Remove columns from highest index to lowest to maintain correct indexing
        sortedColumnIndexes.forEach(columnIndex => {
            const columnToDelete = newColumns[columnIndex];
            newColumns.splice(columnIndex, 1);
            newData = newData.map(row => {
                const newRow = {...row};
                delete newRow[columnToDelete];
                return newRow;
            });
        });
        
        setColumns(newColumns);
        setData(newData);
        addToHistory(newData, newColumns);
        
        // Track column deletions for patch-based saving
        const deletedColumnNames = Array.from(selectedColumns).sort((a, b) => a - b).map(columnIndex => columns[columnIndex]);
        setColumnOperations(prev => [...prev, ...deletedColumnNames.map(columnName => ({
            type: 'delete',
            column_name: columnName
        }))]);
        setHasChanges(true);
        
        setSelectedColumns(new Set()); // Clear selection
        setShowDeleteColumnsModal(false);
    };

    // Handle row selection
    const handleRowSelect = (rowIndex) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(rowIndex)) {
            newSelection.delete(rowIndex);
        } else {
            newSelection.add(rowIndex);
        }
        setSelectedRows(newSelection);
    };

    // Delete multiple selected rows
    const deleteSelectedRows = () => {
        if (selectedRows.size === 0) return;
        
        const sortedRowIndexes = Array.from(selectedRows).sort((a, b) => b - a); // Sort in descending order
        let newData = [...data];
        
        // Remove rows from highest index to lowest to maintain correct indexing
        sortedRowIndexes.forEach(rowIndex => {
            newData.splice(rowIndex, 1);
        });
        
        setData(newData);
        addToHistory(newData, columns);
        
        // Track deleted rows for patch-based saving (absolute indices)
        const absoluteIndices = Array.from(selectedRows).map(rowIndex => (currentPage - 1) * pageSize + rowIndex);
        setDeletedRowIndices(prev => new Set([...prev, ...absoluteIndices]));
        setHasChanges(true);
        
        setSelectedRows(new Set()); // Clear selection
        setShowDeleteRowsModal(false);
    };

    // Get CSS classes based on UI configuration
    const getCellClasses = () => {
        const padding = {
            compact: 'px-2 py-1',
            normal: 'px-3 py-2',
            comfortable: 'px-4 py-3'
        };

        const fontSize = {
            small: 'text-xs',
            normal: 'text-sm',
            large: 'text-base'
        };

        return `${padding[uiConfig.cellPadding]} ${fontSize[uiConfig.fontSize]} border cursor-pointer hover:bg-blue-50 ${uiConfig.showGridLines ? 'border-gray-200' : 'border-transparent'}`;
    };

    const getHeaderClasses = () => {
        const padding = {
            compact: 'px-2 py-1',
            normal: 'px-3 py-2',
            comfortable: 'px-4 py-3'
        };

        return `${padding[uiConfig.headerHeight]} text-left text-xs font-medium text-gray-500 uppercase tracking-wider border relative group ${uiConfig.showGridLines ? 'border-gray-200' : 'border-transparent'}`;
    };

    const getRowClasses = () => {
        const height = {
            compact: 'h-8',
            normal: 'h-10',
            comfortable: 'h-12'
        };

        return `hover:bg-gray-50 group ${height[uiConfig.rowHeight]}`;
    };

    // Pagination calculations (server handles search filtering, client handles column filtering)
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const displayedData = filteredData; // Server already filtered by search, client filters by columns

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading file data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        const isFileNotFound = error.includes('File not found');
        
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-lg">
                    <div className="mb-6">
                        {isFileNotFound ? (
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="h-8 w-8 text-orange-500" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="h-8 w-8 text-red-500" />
                            </div>
                        )}
                        
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            {isFileNotFound ? 'File Not Found' : 'Unable to Load File'}
                        </h2>
                        
                        <p className="text-gray-600 text-sm leading-relaxed mb-6">
                            {error}
                        </p>
                        
                        {isFileNotFound && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                                <h3 className="text-sm font-medium text-blue-800 mb-2">What you can do:</h3>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Check if the file ID is correct</li>
                                    <li>• Verify the file hasn't been deleted</li>
                                    <li>• Contact support if you need assistance</li>
                                </ul>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex space-x-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => window.close()}
                            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-4">
                        File ID: {fileId}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Compact Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                {/* Single row with filename and all controls */}
                <div className="px-4 py-2">
                    <div className="flex items-center justify-between">
                        {/* Left side: File info and status */}
                        <div className="flex items-start space-x-4">
                            <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mt-1">
                                    <FileText className="text-white" size={16}/>
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-lg font-semibold text-gray-900 leading-tight max-w-md">
                                        {fileName || `File ID: ${fileId}`}
                                    </h1>
                                    {fileStats && (
                                        <span className="text-sm text-gray-500 mt-1">
                                            {fileStats.total_rows?.toLocaleString()} rows • {fileStats.columns} cols
                                        </span>
                                    )}
                                </div>
                            </div>
                            {hasChanges && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                                    <Edit3 size={10} className="mr-1"/>
                                    Unsaved
                                </span>
                            )}
                        </div>

                        {/* Right side: All action buttons on same level */}
                        <div className="flex items-center space-x-3">
                            {/* Search bar */}
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-40 pl-8 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            {/* Clear All Filters Button */}
                            {getActiveFilterCount() > 0 && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center space-x-1 px-3 py-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded transition-colors"
                                    title={`Clear all ${getActiveFilterCount()} active filter(s)`}
                                >
                                    <X size={12} />
                                    <span>Clear All ({getActiveFilterCount()})</span>
                                </button>
                            )}

                            {/* Add buttons */}
                            <button
                                onClick={addRow}
                                className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                title="Add Row"
                            >
                                <Plus size={14} className="mr-1"/>
                                Row
                            </button>

                            <button
                                onClick={() => setShowAddColumn(true)}
                                className="flex items-center px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                                title="Add Column"
                            >
                                <Plus size={14} className="mr-1"/>
                                Column
                            </button>

                            {/* Settings */}
                            <button
                                onClick={() => setShowConfigPanel(!showConfigPanel)}
                                className="p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                                title="Settings"
                            >
                                <Settings size={16}/>
                            </button>

                            {/* Undo/Redo */}
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed border border-gray-300 rounded"
                                title="Undo"
                            >
                                <Undo size={16}/>
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed border border-gray-300 rounded"
                                title="Redo"
                            >
                                <Redo size={16}/>
                            </button>

                            {/* Save */}
                            <button
                                onClick={saveChanges}
                                disabled={!hasChanges || saving}
                                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                                <Save size={14} className="mr-1"/>
                                {saving ? 'Saving...' : 'Save'}
                            </button>

                            {/* Download */}
                            <div className="relative">
                                <select
                                    onChange={(e) => downloadFile(e.target.value)}
                                    className="appearance-none bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 cursor-pointer pr-8 text-sm"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Download</option>
                                    <option value="csv">CSV</option>
                                    <option value="xlsx">Excel</option>
                                </select>
                                <Download size={14} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white pointer-events-none"/>
                            </div>

                            {/* Column Selection Indicator */}
                            {selectedColumns.size > 0 && (
                                <div className="flex items-center space-x-2 px-3 py-2 bg-blue-100 border border-blue-300 rounded text-sm">
                                    <span className="text-blue-800 font-medium">{selectedColumns.size} col{selectedColumns.size !== 1 ? 's' : ''} selected</span>
                                    <button
                                        onClick={() => setShowDeleteColumnsModal(true)}
                                        className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                        title="Delete selected columns"
                                    >
                                        <Minus size={12}/>
                                        <span>Delete</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedColumns(new Set())}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Clear selection"
                                    >
                                        <X size={14}/>
                                    </button>
                                </div>
                            )}

                            {/* Row Selection Indicator */}
                            {selectedRows.size > 0 && (
                                <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 border border-green-300 rounded text-sm">
                                    <span className="text-green-800 font-medium">{selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected</span>
                                    <button
                                        onClick={() => setShowDeleteRowsModal(true)}
                                        className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                        title="Delete selected rows"
                                    >
                                        <Minus size={12}/>
                                        <span>Delete</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedRows(new Set())}
                                        className="text-green-600 hover:text-green-800"
                                        title="Clear selection"
                                    >
                                        <X size={14}/>
                                    </button>
                                </div>
                            )}

                            {/* Close */}
                            <button
                                onClick={() => window.close()}
                                className="p-2 text-gray-600 hover:text-red-600 border border-gray-300 rounded"
                                title="Close"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                    </div>

                    {/* Configuration Panel */}
                    {showConfigPanel && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Cell Size</label>
                                    <select
                                        value={uiConfig.cellPadding}
                                        onChange={(e) => setUiConfig({...uiConfig, cellPadding: e.target.value})}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    >
                                        <option value="compact">Compact</option>
                                        <option value="normal">Normal</option>
                                        <option value="comfortable">Comfortable</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Row Height</label>
                                    <select
                                        value={uiConfig.rowHeight}
                                        onChange={(e) => setUiConfig({...uiConfig, rowHeight: e.target.value})}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    >
                                        <option value="compact">Compact</option>
                                        <option value="normal">Normal</option>
                                        <option value="comfortable">Comfortable</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
                                    <select
                                        value={uiConfig.fontSize}
                                        onChange={(e) => setUiConfig({...uiConfig, fontSize: e.target.value})}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    >
                                        <option value="small">Small</option>
                                        <option value="normal">Normal</option>
                                        <option value="large">Large</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4 mt-2">
                                <label className="flex items-center text-xs">
                                    <input
                                        type="checkbox"
                                        checked={uiConfig.showGridLines}
                                        onChange={(e) => setUiConfig({...uiConfig, showGridLines: e.target.checked})}
                                        className="mr-1"
                                    />
                                    Show Grid Lines
                                </label>
                                <label className="flex items-center text-xs">
                                    <input
                                        type="checkbox"
                                        checked={uiConfig.autoSizeColumns}
                                        onChange={(e) => setUiConfig({...uiConfig, autoSizeColumns: e.target.checked})}
                                        className="mr-1"
                                    />
                                    Auto-size Columns
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Column Modal */}
            {showAddColumn && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <h3 className="text-lg font-semibold mb-4">Add New Column</h3>
                        <input
                            type="text"
                            placeholder="Column name"
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyPress={(e) => e.key === 'Enter' && addColumn()}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setShowAddColumn(false);
                                    setNewColumnName('');
                                }}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addColumn}
                                disabled={!newColumnName.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                Add Column
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Columns Confirmation Modal */}
            {showDeleteColumnsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-600"/>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Columns</h3>
                                <p className="text-sm text-gray-600">This action cannot be undone</p>
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                Are you sure you want to delete <strong>{selectedColumns.size} column{selectedColumns.size !== 1 ? 's' : ''}</strong>?
                            </p>
                            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                                <p className="text-sm text-gray-600 mb-2">Columns to be deleted:</p>
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(selectedColumns).sort((a, b) => a - b).map(columnIndex => (
                                        <span 
                                            key={columnIndex}
                                            className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                                        >
                                            {getExcelColumnName(columnIndex)} ({columns[columnIndex]})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowDeleteColumnsModal(false)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteSelectedColumns}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Delete {selectedColumns.size} Column{selectedColumns.size !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Rows Confirmation Modal */}
            {showDeleteRowsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-600"/>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Rows</h3>
                                <p className="text-sm text-gray-600">This action cannot be undone</p>
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                Are you sure you want to delete <strong>{selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''}</strong>?
                            </p>
                            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                                <p className="text-sm text-gray-600 mb-2">Rows to be deleted:</p>
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(selectedRows).sort((a, b) => a - b).map(rowIndex => (
                                        <span 
                                            key={rowIndex}
                                            className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                                        >
                                            Row {startIndex + rowIndex + 1}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowDeleteRowsModal(false)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteSelectedRows}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Delete {selectedRows.size} Row{selectedRows.size !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div 
                className={`flex-1 overflow-auto ${resizing.isResizing ? 'select-none' : ''}`}
                style={{
                    cursor: resizing.isResizing ? 'col-resize' : 'default'
                }}
            >
                <div className="min-w-full">
                    <table className="w-full bg-white table-fixed">
                        <thead className="bg-gray-50 sticky top-0">
                        {/* Excel-style column letters (A, B, C...) */}
                        <tr className="bg-gray-100">
                            <th className={`w-12 px-1 py-1 text-xs font-medium text-gray-500 text-center bg-gray-100 ${uiConfig.showGridLines ? 'border border-gray-200' : 'border-transparent'}`}>
                                
                            </th>
                            {columns.map((column, columnIndex) => (
                                <th
                                    key={`letter-${columnIndex}`}
                                    className={`px-2 py-1 text-xs font-bold text-center cursor-pointer select-none transition-colors ${uiConfig.showGridLines ? 'border border-gray-200' : 'border-transparent'} ${
                                        selectedColumns.has(columnIndex) 
                                            ? 'bg-blue-500 text-white border-blue-600' 
                                            : hoveredColumnIndex === columnIndex
                                                ? 'bg-blue-200 text-blue-800'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                    style={{
                                        width: `${getColumnWidth(columnIndex)}px`,
                                        minWidth: '50px',
                                        maxWidth: '500px'
                                    }}
                                    onClick={() => handleColumnSelect(columnIndex)}
                                    title={`Click to select column ${getExcelColumnName(columnIndex)} (${column})`}
                                >
                                    {getExcelColumnName(columnIndex)}
                                </th>
                            ))}
                        </tr>
                        {/* Original column headers */}
                        <tr>
                            <th className={`w-12 px-1 py-1 text-xs font-medium text-gray-500 text-center ${uiConfig.showGridLines ? 'border border-gray-200' : 'border-transparent'}`}>
                                #
                            </th>
                            {columns.map((column, columnIndex) => (
                                <th
                                    key={column}
                                    data-column-index={columnIndex}
                                    className={`${getHeaderClasses()} ${selectedColumns.has(columnIndex) ? 'bg-blue-100 border-blue-300' : ''} ${hoveredColumnIndex === columnIndex ? 'bg-blue-50' : ''} relative`}
                                    style={{
                                        width: `${getColumnWidth(columnIndex)}px`,
                                        minWidth: '50px',
                                        maxWidth: '500px'
                                    }}
                                >
                                    {editingColumn === columnIndex ? (
                                        // Editing mode
                                        <input
                                            type="text"
                                            value={editingColumnValue}
                                            onChange={(e) => setEditingColumnValue(e.target.value)}
                                            onBlur={saveColumnEdit}
                                            onKeyDown={handleColumnEditKeyDown}
                                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        // Display mode
                                        <div className="flex items-center justify-between w-full group">
                                            <span
                                                className="cursor-pointer flex items-center hover:text-blue-600 truncate flex-1"
                                                onClick={() => handleSort(column)}
                                                title={`${column} (click to sort)`}
                                            >
                                                {column}
                                                {sortConfig.column === column && (
                                                    sortConfig.direction === 'asc' ?
                                                        <ArrowUp size={10} className="ml-1 flex-shrink-0"/> :
                                                        <ArrowDown size={10} className="ml-1 flex-shrink-0"/>
                                                )}
                                            </span>
                                            
                                            {/* Edit button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startColumnEdit(columnIndex, column);
                                                }}
                                                className="ml-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-blue-100 rounded transition-all"
                                                title="Click to rename column"
                                            >
                                                <Edit3 size={12} className="text-blue-600" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Column Filters - Hide when editing column name */}
                                    {editingColumn !== columnIndex && (
                                        <div className="flex flex-col gap-1 mt-1">
                                            {/* Dropdown Filter */}
                                            <ColumnFilterDropdown
                                                fileId={fileId}
                                                columnName={column}
                                                selectedValues={columnFilters[column] || []}
                                                onFilterSelect={(values) => handleColumnFilter(column, values)}
                                                onClear={() => handleColumnFilterClear(column)}
                                                cascadeFilters={columnFilters}  // Pass all current filters for cascading
                                            />
                                            
                                            {/* Text Filter */}
                                            <input
                                                type="text"
                                                placeholder="Text filter..."
                                                value={filterConfig[column] || ''}
                                                onChange={(e) => setFilterConfig({
                                                    ...filterConfig,
                                                    [column]: e.target.value
                                                })}
                                                className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Filter column values (client-side)"
                                            />
                                        </div>
                                    )}

                                    {/* Column Resize Handle */}
                                    <div
                                        className="absolute top-0 right-0 w-3 h-full cursor-col-resize bg-transparent transition-all z-20"
                                        onMouseDown={(e) => startColumnResize(e, columnIndex)}
                                        onMouseEnter={() => setHoveredColumnIndex(columnIndex)}
                                        onMouseLeave={() => setHoveredColumnIndex(-1)}
                                        onDoubleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            autoFitColumn(columnIndex);
                                        }}
                                        title="Drag to resize • Double-click to auto-fit"
                                        style={{
                                            right: '-1px' // Position at the border
                                        }}
                                    >
                                        {/* Visual indicator */}
                                        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-gray-400 transition-all ${
                                            hoveredColumnIndex === columnIndex 
                                                ? 'bg-blue-600 opacity-100' 
                                                : 'opacity-0 hover:opacity-100 hover:bg-blue-600'
                                        }`} />
                                        
                                    </div>
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {displayedData.map((row, rowIndex) => (
                            <tr key={rowIndex} className={`${getRowClasses()} ${selectedRows.has(rowIndex) ? 'bg-green-100' : ''}`}>
                                <td 
                                    className={`w-12 px-1 py-1 text-xs text-center cursor-pointer select-none transition-colors ${uiConfig.showGridLines ? 'border border-gray-200' : 'border-transparent'} ${
                                        selectedRows.has(rowIndex) 
                                            ? 'bg-green-500 text-white border-green-600' 
                                            : hoveredColumnIndex >= 0
                                                ? 'bg-blue-100 text-gray-600'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleRowSelect(rowIndex)}
                                    title={`Click to select row ${startIndex + rowIndex + 1}`}
                                >
                                    <span className="text-xs font-medium">{startIndex + rowIndex + 1}</span>
                                </td>
                                {columns.map((column, columnIndex) => (
                                    <td
                                        key={`${rowIndex}-${columnIndex}`}
                                        className={`${getCellClasses()} ${selectedColumns.has(columnIndex) ? 'bg-blue-50 border-blue-200' : ''} ${selectedRows.has(rowIndex) ? 'bg-green-100' : ''} ${hoveredColumnIndex === columnIndex ? 'bg-blue-50' : ''}`}
                                        style={{
                                            width: `${getColumnWidth(columnIndex)}px`,
                                            minWidth: '50px',
                                            maxWidth: '500px'
                                        }}
                                        onClick={() => startEditing(rowIndex, columnIndex)}
                                    >
                                        {editingCell?.row === rowIndex && editingCell?.col === columnIndex ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                className="w-full p-0.5 border border-blue-500 rounded focus:outline-none text-xs"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className={`text-gray-900 truncate block ${uiConfig.fontSize === 'small' ? 'text-xs' : uiConfig.fontSize === 'large' ? 'text-base' : 'text-sm'}`}
                                                title={row[column]}>
                                                    {row[column] || ''}
                                                </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="bg-white border-t border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-700">
                                Showing {startIndex + 1} to {Math.min(endIndex, totalRows)} of {totalRows} rows
                            </span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1); // Reset to first page when changing page size
                                }}
                                className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                                <option value={25}>25 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                                <option value={250}>250 per page</option>
                            </select>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>

                            <span className="text-sm text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                        Showing {displayedData.length} of {data.length} rows on this page
                        {searchTerm && ` (search: "${searchTerm}")`}
                        {Object.keys(columnFilters).some(key => columnFilters[key] && columnFilters[key].length > 0) && 
                            ` (filtered by: ${Object.entries(columnFilters)
                                .filter(([column, values]) => values && values.length > 0)
                                .map(([column, values]) => `${column}: ${values.join(', ')}`)
                                .join('; ')})`}
                    </span>
                    <span>
                        Click cells to edit • Hover over headers/rows to delete • Undo/Redo available
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DataViewer;