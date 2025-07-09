// src/components/SheetSelector.jsx - Standalone sheet selection component
import React, { useState, useEffect } from 'react';
import { Sheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const SheetSelector = ({ fileId, onSheetSelected, currentSheet, disabled = false }) => {
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
            const response = await fetch(`/api/files/${fileId}/sheets`);

            if (!response.ok) {
                throw new Error('Failed to fetch sheet information');
            }

            const result = await response.json();

            if (result.success) {
                setSheets(result.data.available_sheets || []);
            } else {
                throw new Error('Failed to load sheets');
            }
        } catch (err) {
            setError(err.message);
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
            const response = await fetch(`/api/files/${fileId}/select-sheet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sheet_name: sheetName })
            });

            if (!response.ok) {
                throw new Error('Failed to switch sheet');
            }

            const result = await response.json();

            if (result.success) {
                // Notify parent component about the sheet change
                if (onSheetSelected) {
                    onSheetSelected(sheetName, result.data);
                }
            } else {
                throw new Error(result.message || 'Failed to switch sheet');
            }
        } catch (err) {
            setError(err.message);
            console.error('Error switching sheet:', err);
        } finally {
            setSwitching(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">Loading sheets...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center space-x-2 p-2 bg-red-50 rounded-lg">
                <AlertCircle size={16} className="text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
                <button
                    onClick={fetchSheets}
                    className="text-xs text-red-600 hover:text-red-800 underline ml-2"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (sheets.length === 0) {
        return null; // No sheets available or not an Excel file
    }

    if (sheets.length === 1) {
        return (
            <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
                <Sheet size={16} className="text-green-600" />
                <span className="text-sm text-green-700">
                    Sheet: {sheets[0].sheet_name} ({sheets[0].row_count?.toLocaleString()} rows)
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                <Sheet size={16} className="text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Available Sheets:</span>
                {switching && (
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                )}
            </div>

            <div className="grid gap-1 max-h-32 overflow-y-auto">
                {sheets.map((sheet) => (
                    <button
                        key={sheet.sheet_name}
                        onClick={() => handleSheetChange(sheet.sheet_name)}
                        disabled={switching || disabled || sheet.sheet_name === currentSheet}
                        className={`
                            w-full text-left p-2 rounded-lg border transition-all duration-200 text-sm
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
                                        <CheckCircle size={12} className="text-blue-600 flex-shrink-0" />
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

export default SheetSelector;