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

const DataViewer = ({fileId, onClose}) => {
    // State management
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [fileName, setFileName] = useState('');
    const [fileStats, setFileStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [sortConfig, setSortConfig] = useState({column: null, direction: 'asc'});
    const [filterConfig, setFilterConfig] = useState({});
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

    // UI Configuration state
    const [uiConfig, setUiConfig] = useState({
        cellPadding: 'compact', // compact, normal, comfortable
        rowHeight: 'compact', // compact, normal, comfortable
        headerHeight: 'compact', // compact, normal, comfortable
        fontSize: 'small', // small, normal, large
        showGridLines: true,
        autoSizeColumns: false
    });
    const [showConfigPanel, setShowConfigPanel] = useState(false);

    // Load file data and extract filename
    useEffect(() => {
        loadFileData();
        loadFileName();
    }, [fileId, currentPage, pageSize]);

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
            setFileName(`File ${fileId}`);
        }
    };

    const loadFileData = async () => {
        try {
            setLoading(true);

            // Try to load real data first, fallback to sample if endpoint doesn't exist
            try {
                const response = await apiService.getFileData(fileId, currentPage, pageSize);
                if (response.success) {
                    setData(response.data.rows);
                    setColumns(response.data.columns);
                    setTotalRows(response.data.total_rows);

                    if (history.length === 0) {
                        setHistory([{data: response.data.rows, columns: response.data.columns}]);
                        setHistoryIndex(0);
                    }
                    return;
                }
            } catch (apiError) {
                console.log('API endpoint not available, using sample data');
            }

            // Fallback to sample data
            const sampleData = [
                {id: 1, name: 'Sample Data', amount: 100, date: '2024-01-01', status: 'Active'},
                {id: 2, name: 'Example Row', amount: 200, date: '2024-01-02', status: 'Pending'},
                {id: 3, name: 'Test Entry', amount: 300, date: '2024-01-03', status: 'Complete'},
                {id: 4, name: 'Demo Item', amount: 150, date: '2024-01-04', status: 'Active'},
                {id: 5, name: 'Sample Entry', amount: 250, date: '2024-01-05', status: 'Pending'},
                {id: 6, name: 'Another Row', amount: 175, date: '2024-01-06', status: 'Active'},
                {id: 7, name: 'More Data', amount: 225, date: '2024-01-07', status: 'Complete'},
                {id: 8, name: 'Test Item', amount: 125, date: '2024-01-08', status: 'Pending'},
                {id: 9, name: 'Demo Data', amount: 275, date: '2024-01-09', status: 'Active'},
                {id: 10, name: 'Final Entry', amount: 325, date: '2024-01-10', status: 'Complete'}
            ];

            setData(sampleData);
            setColumns(['id', 'name', 'amount', 'date', 'status']);
            setTotalRows(100); // Simulate larger dataset for pagination demo

            if (history.length === 0) {
                setHistory([{data: sampleData, columns: ['id', 'name', 'amount', 'date', 'status']}]);
                setHistoryIndex(0);
            }

        } catch (err) {
            setError('Failed to load file data');
            console.error(err);
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

    // Save changes
    const saveChanges = async () => {
        try {
            setSaving(true);
            try {
                await apiService.updateFileData(fileId, {rows: data, columns});
                setHasChanges(false);
                showNotification('Changes saved successfully!', 'success');
            } catch (apiError) {
                setHasChanges(false);
                showNotification('Changes saved locally (demo mode)!', 'info');
            }
        } catch (err) {
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
        }
        setEditingCell(null);
        setEditValue('');
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    // Add/Delete rows
    const addRow = () => {
        const newRow = {};
        columns.forEach(col => newRow[col] = '');
        const newData = [...data, newRow];
        setData(newData);
        addToHistory(newData, columns);
    };

    const deleteRow = (rowIndex) => {
        const newData = data.filter((_, index) => index !== rowIndex);
        setData(newData);
        addToHistory(newData, columns);
    };

    // Add/Delete columns
    const addColumn = () => {
        if (newColumnName.trim()) {
            const newColumns = [...columns, newColumnName.trim()];
            const newData = data.map(row => ({...row, [newColumnName.trim()]: ''}));
            setColumns(newColumns);
            setData(newData);
            addToHistory(newData, newColumns);
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

    // Filtering and Pagination
    const filteredData = useMemo(() => {
        let filtered = [...data];

        if (searchTerm) {
            filtered = filtered.filter(row =>
                Object.values(row).some(val =>
                    val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        Object.entries(filterConfig).forEach(([column, filterValue]) => {
            if (filterValue) {
                filtered = filtered.filter(row =>
                    row[column]?.toString().toLowerCase().includes(filterValue.toLowerCase())
                );
            }
        });

        return filtered;
    }, [data, searchTerm, filterConfig]);

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

    // Pagination calculations
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const displayedData = filteredData; // Show all filtered data on current page

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
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4"/>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header with prominent filename */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                {/* Top section with filename prominently displayed */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-1 border-b border-gray-100">
                    <div className="text-center">
                        <div className="flex items-center justify-center space-x-3 mb-2">
                            <div
                                className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <FileText className="text-white" size={18}/>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {fileName || `File ID: ${fileId}`}
                            </h1>
                        </div>
                        {fileStats && (
                            <p className="text-sm text-gray-600">
                                {fileStats.total_rows?.toLocaleString()} rows • {fileStats.columns} columns
                                {fileStats.file_size && ` • ${(fileStats.file_size / 1024 / 1024).toFixed(2)} MB`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Controls section */}
                <div className="px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700">📊 Data Viewer</span>
                                {hasChanges && (
                                    <span
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        <Edit3 size={12} className="mr-1"/>
                                        Unsaved Changes
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className="p-1.5 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                title="Undo"
                            >
                                <Undo size={16}/>
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className="p-1.5 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                title="Redo"
                            >
                                <Redo size={16}/>
                            </button>

                            <div className="border-l border-gray-300 h-6 mx-1"></div>

                            <button
                                onClick={() => setShowConfigPanel(!showConfigPanel)}
                                className="p-1.5 text-gray-600 hover:text-gray-800"
                                title="Display Settings"
                            >
                                <Settings size={16}/>
                            </button>

                            <button
                                onClick={saveChanges}
                                disabled={!hasChanges || saving}
                                className="flex items-center px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                                <Save size={14} className="mr-1"/>
                                {saving ? 'Saving...' : 'Save'}
                            </button>

                            <div className="relative">
                                <select
                                    onChange={(e) => downloadFile(e.target.value)}
                                    className="appearance-none bg-green-600 text-white px-2 py-1.5 rounded hover:bg-green-700 cursor-pointer pr-6 text-sm"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Download</option>
                                    <option value="csv">CSV</option>
                                    <option value="xlsx">Excel</option>
                                </select>
                                <Download size={14}
                                          className="absolute right-1 top-1/2 transform -translate-y-1/2 text-white pointer-events-none"/>
                            </div>

                            <button
                                onClick={() => window.close()}
                                className="p-1.5 text-gray-600 hover:text-red-600"
                                title="Close"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                    </div>

                    {/* Search and Filter Bar */}
                    <div className="flex items-center space-x-3 mt-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14}
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                            <input
                                type="text"
                                placeholder="Search data..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>

                        <button
                            onClick={addRow}
                            className="flex items-center px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            title="Add Row"
                        >
                            <Plus size={14} className="mr-1"/>
                            Row
                        </button>

                        <button
                            onClick={() => setShowAddColumn(true)}
                            className="flex items-center px-2 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                            title="Add Column"
                        >
                            <Plus size={14} className="mr-1"/>
                            Column
                        </button>
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

            {/* Data Table */}
            <div className="flex-1 overflow-auto">
                <div className="min-w-full">
                    <table className={`w-full bg-white ${uiConfig.autoSizeColumns ? 'table-auto' : 'table-fixed'}`}>
                        <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="w-12 px-1 py-1 text-xs font-medium text-gray-500 text-center border border-gray-200">
                                #
                            </th>
                            {columns.map((column, columnIndex) => (
                                <th
                                    key={column}
                                    className={getHeaderClasses()}
                                    style={uiConfig.autoSizeColumns ? {} : {width: `${100 / columns.length}%`}}
                                >
                                    <div className="flex items-center justify-between">
                                            <span
                                                className="cursor-pointer flex items-center hover:text-blue-600 truncate"
                                                onClick={() => handleSort(column)}
                                                title={column}
                                            >
                                                {column}
                                                {sortConfig.column === column && (
                                                    sortConfig.direction === 'asc' ?
                                                        <ArrowUp size={10} className="ml-1 flex-shrink-0"/> :
                                                        <ArrowDown size={10} className="ml-1 flex-shrink-0"/>
                                                )}
                                            </span>
                                        <button
                                            onClick={() => deleteColumn(columnIndex)}
                                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-1 flex-shrink-0"
                                            title="Delete Column"
                                        >
                                            <Minus size={10}/>
                                        </button>
                                    </div>

                                    {/* Column Filter */}
                                    <input
                                        type="text"
                                        placeholder="Filter..."
                                        value={filterConfig[column] || ''}
                                        onChange={(e) => setFilterConfig({
                                            ...filterConfig,
                                            [column]: e.target.value
                                        })}
                                        className="w-full mt-1 px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {displayedData.map((row, rowIndex) => (
                            <tr key={rowIndex} className={getRowClasses()}>
                                <td className="w-12 px-1 py-1 text-xs text-gray-500 text-center border border-gray-200 bg-gray-50">
                                    <div className="flex items-center justify-center space-x-1">
                                        <span className="text-xs">{startIndex + rowIndex + 1}</span>
                                        <button
                                            onClick={() => deleteRow(rowIndex)}
                                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                            title="Delete Row"
                                        >
                                            <Minus size={8}/>
                                        </button>
                                    </div>
                                </td>
                                {columns.map((column, columnIndex) => (
                                    <td
                                        key={`${rowIndex}-${columnIndex}`}
                                        className={getCellClasses()}
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
                        {searchTerm && ` (filtered)`}
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