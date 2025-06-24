// src/components/DataViewer.jsx - Excel-like data viewer
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Save, Download, Plus, Minus, ArrowUp, ArrowDown, Filter,
    Undo, Redo, Search, AlertCircle, CheckCircle, X, Edit3
} from 'lucide-react';
import { apiService } from '../services/api';

const DataViewer = ({ fileId, onClose }) => {
    // State management
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
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

    // Load data on component mount
    useEffect(() => {
        loadFileData();
    }, [fileId, currentPage, pageSize]);

    const loadFileData = async () => {
        try {
            setLoading(true);
            const response = await apiService.getFileData(fileId, currentPage, pageSize);
            if (response.success) {
                setData(response.data.rows);
                setColumns(response.data.columns);
                setTotalRows(response.data.total_rows);

                // Initialize history with current state
                if (history.length === 0) {
                    setHistory([{ data: response.data.rows, columns: response.data.columns }]);
                    setHistoryIndex(0);
                }
            }
        } catch (err) {
            setError('Failed to load file data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Save changes to server
    const saveChanges = async () => {
        try {
            setSaving(true);
            await apiService.updateFileData(fileId, { rows: data, columns });
            setHasChanges(false);

            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            successDiv.textContent = 'Changes saved successfully!';
            document.body.appendChild(successDiv);
            setTimeout(() => document.body.removeChild(successDiv), 3000);
        } catch (err) {
            setError('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    // Download modified file
    const downloadFile = async (format = 'csv') => {
        try {
            const response = await apiService.downloadModifiedFile(fileId, format);
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `modified_file.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download file');
        }
    };

    // Add to history for undo/redo
    const addToHistory = useCallback((newData, newColumns) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ data: newData, columns: newColumns });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setHasChanges(true);
    }, [history, historyIndex]);

    // Undo/Redo functionality
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
        setEditingCell({ row: rowIndex, col: columnIndex });
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
            const newData = data.map(row => ({ ...row, [newColumnName.trim()]: '' }));
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
            const newRow = { ...row };
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

            // Try to parse as numbers
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // String comparison
            aVal = aVal.toString().toLowerCase();
            bVal = bVal.toString().toLowerCase();

            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        setData(sortedData);
        setSortConfig({ column, direction });
        addToHistory(sortedData, columns);
    };

    // Filtering
    const filteredData = useMemo(() => {
        let filtered = [...data];

        // Apply search term
        if (searchTerm) {
            filtered = filtered.filter(row =>
                Object.values(row).some(val =>
                    val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        // Apply column filters
        Object.entries(filterConfig).forEach(([column, filterValue]) => {
            if (filterValue) {
                filtered = filtered.filter(row =>
                    row[column]?.toString().toLowerCase().includes(filterValue.toLowerCase())
                );
            }
        });

        return filtered;
    }, [data, searchTerm, filterConfig]);

    // Pagination
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredData.slice(0, pageSize); // For virtual scrolling

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
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-semibold text-gray-800">📊 Data Viewer</h1>
                        {hasChanges && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Edit3 size={12} className="mr-1" />
                                Unsaved Changes
                            </span>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                            title="Undo"
                        >
                            <Undo size={18} />
                        </button>
                        <button
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                            title="Redo"
                        >
                            <Redo size={18} />
                        </button>

                        <div className="border-l border-gray-300 h-6 mx-2"></div>

                        <button
                            onClick={saveChanges}
                            disabled={!hasChanges || saving}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            <Save size={16} className="mr-1" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>

                        <div className="relative">
                            <select
                                onChange={(e) => downloadFile(e.target.value)}
                                className="appearance-none bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 cursor-pointer pr-8"
                                defaultValue=""
                            >
                                <option value="" disabled>Download</option>
                                <option value="csv">Download as CSV</option>
                                <option value="xlsx">Download as Excel</option>
                            </select>
                            <Download size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white pointer-events-none" />
                        </div>

                        <button
                            onClick={() => window.close()}
                            className="p-2 text-gray-600 hover:text-red-600"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex items-center space-x-4 mt-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search data..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={addRow}
                        className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        title="Add Row"
                    >
                        <Plus size={16} className="mr-1" />
                        Row
                    </button>

                    <button
                        onClick={() => setShowAddColumn(true)}
                        className="flex items-center px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        title="Add Column"
                    >
                        <Plus size={16} className="mr-1" />
                        Column
                    </button>
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
                    <table className="w-full bg-white">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="w-12 px-2 py-2 text-xs font-medium text-gray-500 text-center border border-gray-200">
                                    #
                                </th>
                                {columns.map((column, columnIndex) => (
                                    <th
                                        key={column}
                                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 relative group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className="cursor-pointer flex items-center hover:text-blue-600"
                                                onClick={() => handleSort(column)}
                                            >
                                                {column}
                                                {sortConfig.column === column && (
                                                    sortConfig.direction === 'asc' ?
                                                    <ArrowUp size={12} className="ml-1" /> :
                                                    <ArrowDown size={12} className="ml-1" />
                                                )}
                                            </span>
                                            <button
                                                onClick={() => deleteColumn(columnIndex)}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2"
                                                title="Delete Column"
                                            >
                                                <Minus size={12} />
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
                                            className="w-full mt-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedData.map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-gray-50 group">
                                    <td className="px-2 py-2 text-xs text-gray-500 text-center border border-gray-200 bg-gray-50">
                                        <div className="flex items-center justify-center space-x-1">
                                            <span>{startIndex + rowIndex + 1}</span>
                                            <button
                                                onClick={() => deleteRow(rowIndex)}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                                title="Delete Row"
                                            >
                                                <Minus size={10} />
                                            </button>
                                        </div>
                                    </td>
                                    {columns.map((column, columnIndex) => (
                                        <td
                                            key={`${rowIndex}-${columnIndex}`}
                                            className="px-3 py-2 border border-gray-200 cursor-pointer hover:bg-blue-50"
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
                                                    className="w-full p-1 border border-blue-500 rounded focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-sm text-gray-900">
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
                                onChange={(e) => setPageSize(Number(e.target.value))}
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
        </div>
    );
};

export default DataViewer;