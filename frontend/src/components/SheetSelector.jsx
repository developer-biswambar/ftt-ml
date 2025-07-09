// src/components/SheetSelector.jsx - Clean, production-ready sheet selection component
import React, { useState, useEffect } from 'react';
import { Sheet, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

const SheetSelector = ({
    fileId,
    onSheetSelected,
    currentSheet,
    disabled = false,
    showHeader = true,
    maxHeight = 'max-h-32',
    size = 'sm' // 'xs', 'sm', 'md', 'lg'
}) => {
    const [sheets, setSheets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        if (fileId) {
            fetchSheets();
        }
    }, [fileId]);

    const fetchSheets = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiService.getFileSheets(fileId);

            if (result.success) {
                setSheets(result.data.available_sheets || []);
            } else {
                throw new Error(result.message || 'Failed to load sheets');
            }
        } catch (err) {
            // Check if it's not an Excel file (which is not an error)
            if (err.message?.includes('not an Excel file')) {
                setSheets([]);
                return;
            }

            setError(err.message || 'Failed to fetch sheet information');
            console.error('Error fetching sheets:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSheetChange = async (sheetName) => {
        if (switching || disabled || sheetName === currentSheet) return;

        setSwitching(true);
        setError(null);

        try {
            const result = await apiService.selectSheet(fileId, sheetName);

            if (result.success) {
                // Notify parent component about the sheet change
                if (onSheetSelected) {
                    onSheetSelected(sheetName, result.data);
                }
            } else {
                throw new Error(result.message || 'Failed to switch sheet');
            }
        } catch (err) {
            setError(err.message || 'Failed to switch sheet');
            console.error('Error switching sheet:', err);
        } finally {
            setSwitching(false);
        }
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'xs':
                return {
                    text: 'text-xs',
                    button: 'p-1.5',
                    icon: 12
                };
            case 'sm':
                return {
                    text: 'text-sm',
                    button: 'p-2',
                    icon: 14
                };
            case 'md':
                return {
                    text: 'text-base',
                    button: 'p-3',
                    icon: 16
                };
            case 'lg':
                return {
                    text: 'text-lg',
                    button: 'p-4',
                    icon: 18
                };
            default:
                return {
                    text: 'text-sm',
                    button: 'p-2',
                    icon: 14
                };
        }
    };

    const sizeClasses = getSizeClasses();

    if (loading) {
        return (
            <div className={`flex items-center space-x-2 ${sizeClasses.button} bg-blue-50 rounded-lg`}>
                <Loader2 size={sizeClasses.icon} className="animate-spin text-blue-600" />
                <span className={`${sizeClasses.text} text-blue-700`}>Loading sheets...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-between ${sizeClasses.button} bg-red-50 rounded-lg`}>
                <div className="flex items-center space-x-2">
                    <AlertCircle size={sizeClasses.icon} className="text-red-600" />
                    <span className={`${sizeClasses.text} text-red-700`}>{error}</span>
                </div>
                <button
                    onClick={fetchSheets}
                    className={`${sizeClasses.text} text-red-600 hover:text-red-800 transition-colors duration-200`}
                    title="Retry loading sheets"
                >
                    <RefreshCw size={sizeClasses.icon - 2} />
                </button>
            </div>
        );
    }

    if (sheets.length === 0) {
        return null; // No sheets available or not an Excel file
    }

    if (sheets.length === 1) {
        return (
            <div className={`flex items-center space-x-2 ${sizeClasses.button} bg-green-50 rounded-lg`}>
                <Sheet size={sizeClasses.icon} className="text-green-600" />
                <div>
                    <span className={`${sizeClasses.text} text-green-700 font-medium`}>
                        {sheets[0].sheet_name}
                    </span>
                    <div className="text-xs text-green-600">
                        {sheets[0].row_count?.toLocaleString()} rows • {sheets[0].column_count} cols
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {showHeader && (
                <div className="flex items-center space-x-2">
                    <Sheet size={sizeClasses.icon} className="text-slate-600" />
                    <span className={`${sizeClasses.text} font-medium text-slate-700`}>Available Sheets:</span>
                    {switching && (
                        <Loader2 size={sizeClasses.icon - 2} className="animate-spin text-blue-600" />
                    )}
                </div>
            )}

            {error && (
                <div className={`${sizeClasses.text} text-red-600 bg-red-50 px-2 py-1 rounded`}>
                    {error}
                </div>
            )}

            <div className={`grid gap-1 ${maxHeight} overflow-y-auto`}>
                {sheets.map((sheet) => (
                    <button
                        key={sheet.sheet_name}
                        onClick={() => handleSheetChange(sheet.sheet_name)}
                        disabled={switching || disabled || sheet.sheet_name === currentSheet}
                        className={`
                            w-full text-left ${sizeClasses.button} rounded-lg border transition-all duration-200 ${sizeClasses.text}
                            ${sheet.sheet_name === currentSheet
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                            }
                            ${(switching || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <span className="font-medium truncate">{sheet.sheet_name}</span>
                                    {sheet.sheet_name === currentSheet && (
                                        <CheckCircle size={sizeClasses.icon - 2} className="text-blue-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {sheet.row_count?.toLocaleString()} rows • {sheet.column_count} columns
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// Utility component for inline sheet display
export const SheetBadge = ({ file, size = 'sm' }) => {
    if (!file?.is_excel) {
        return (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                CSV
            </span>
        );
    }

    const sheetCount = file.sheet_names?.length || 1;
    const badgeSize = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

    return (
        <span className={`bg-green-100 text-green-700 rounded-full font-medium ${badgeSize}`}>
            Excel {sheetCount > 1 && `(${sheetCount})`}
        </span>
    );
};

// Hook for sheet operations
export const useSheetOperations = (fileId) => {
    const [sheets, setSheets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSheets = async () => {
        if (!fileId) return;

        setLoading(true);
        setError(null);

        try {
            const result = await apiService.getFileSheets(fileId);
            if (result.success) {
                setSheets(result.data.available_sheets || []);
            }
        } catch (err) {
            if (!err.message?.includes('not an Excel file')) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const selectSheet = async (sheetName) => {
        try {
            const result = await apiService.selectSheet(fileId, sheetName);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    return {
        sheets,
        loading,
        error,
        fetchSheets,
        selectSheet,
        hasMultipleSheets: sheets.length > 1,
        isExcelFile: sheets.length > 0
    };
};

export default SheetSelector;