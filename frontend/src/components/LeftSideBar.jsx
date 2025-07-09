// src/components/LeftSidebar.jsx - Enhanced with SheetSelector component integration
import React, {useRef, useState} from 'react';
import {CheckCircle, Eye, FileText, RefreshCw, Upload, ChevronDown, ChevronRight} from 'lucide-react';
// import SheetSelector from './SheetSelector'; // Uncomment when you create the SheetSelector component

const LeftSidebar = ({
                         files,
                         templates,
                         selectedFiles,
                         setSelectedFiles,
                         selectedTemplate,
                         requiredFiles,
                         currentInput,
                         uploadProgress,
                         onFileUpload,
                         onTemplateSelect,
                         onRefreshFiles,
                         width = 320
                     }) => {
    const fileInputRef = useRef(null);
    const [expandedFiles, setExpandedFiles] = useState(new Set());

    const openFileViewer = (fileId) => {
        const viewerUrl = `/viewer/${fileId}`;
        const newWindow = window.open(
            viewerUrl,
            `viewer_${fileId}`,
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1400,height=900,menubar=yes,location=yes,directories=no,status=yes'
        );

        if (newWindow) {
            newWindow.focus();
        } else {
            // Fallback if popup is blocked
            window.open(viewerUrl, '_blank');
        }
    };

    const handleFileUpload = (event) => {
        onFileUpload(event);
    };

    const handleFileSelection = (fileKey, file) => {
        setSelectedFiles(prev => ({
            ...prev,
            [fileKey]: file
        }));
    };

    const toggleFileExpansion = (fileId) => {
        setExpandedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const getFileSelectionStatus = () => {
        if (!selectedTemplate) {
            return {complete: false, selected: 0, required: 0};
        }

        const selected = requiredFiles.filter(rf => selectedFiles[rf.key]).length;
        return {
            complete: selected === requiredFiles.length,
            selected,
            required: requiredFiles.length
        };
    };

    const status = getFileSelectionStatus();

    const getProcessIcon = (category) => {
        switch (category) {
            case 'reconciliation':
            case 'ai-reconciliation':
                return '🔄';
            case 'validation':
                return '🔍';
            case 'cleaning':
                return '🧹';
            case 'extraction':
                return '📊';
            case 'consolidation':
                return '📋';
            case 'ai-analysis':
                return '🤖';
            case 'ai-generation':
                return '🤖';
            default:
                return '⚙️';
        }
    };

    const getProcessColor = (category, index) => {
        const colors = [
            'from-blue-500 to-purple-600',
            'from-green-500 to-blue-600',
            'from-purple-500 to-pink-600',
            'from-orange-500 to-red-600',
            'from-teal-500 to-green-600',
            'from-indigo-500 to-purple-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-blue-600'
        ];

        if (category?.includes('ai')) {
            return 'from-purple-500 to-pink-600';
        }

        return colors[index % colors.length];
    };

    // Simple sheet selector component inline
    const SheetSelector = ({ fileId, currentSheet, sheets = [], onSheetSelected, disabled = false }) => {
        const [switching, setSwitching] = useState(false);

        const handleSheetChange = async (sheetName) => {
            if (switching || disabled || sheetName === currentSheet) return;

            setSwitching(true);

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

                if (result.success && onSheetSelected) {
                    onSheetSelected(sheetName, result.data);
                }
            } catch (error) {
                console.error('Error switching sheet:', error);
            } finally {
                setSwitching(false);
            }
        };

        if (sheets.length <= 1) return null;

        return (
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-slate-600">Available Sheets:</span>
                    {switching && (
                        <div className="animate-spin rounded-full h-3 w-3 border border-blue-200 border-t-blue-600"></div>
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

    const handleSheetSelected = (fileId, sheetName, sheetData) => {
        // Refresh the file list to get updated data
        onRefreshFiles();
    };

    const renderFileItem = (file) => {
        const isExpanded = expandedFiles.has(file.file_id);
        const isExcel = file.is_excel;
        const hasMultipleSheets = isExcel && file.sheet_names && file.sheet_names.length > 1;

        return (
            <div
                key={file.file_id}
                className="group bg-white/70 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all duration-200"
            >
                {/* Main file info */}
                <div className="p-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            {hasMultipleSheets && (
                                <button
                                    onClick={() => toggleFileExpansion(file.file_id)}
                                    className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                                >
                                    {isExpanded ?
                                        <ChevronDown size={12} className="text-slate-500" /> :
                                        <ChevronRight size={12} className="text-slate-500" />
                                    }
                                </button>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1 mb-0.5">
                                    <p className="text-xs font-medium text-slate-800 truncate"
                                       title={file.filename}>
                                        {file.filename}
                                    </p>
                                    {isExcel && (
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                            Excel
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">
                                    {file.total_rows?.toLocaleString()} rows • {file.columns?.length} cols
                                    {isExcel && file.selected_sheet && (
                                        <span className="ml-1 text-blue-600">• {file.selected_sheet}</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openFileViewer(file.file_id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all duration-200"
                            title="View/Edit File"
                        >
                            <Eye size={14}/>
                        </button>
                    </div>
                </div>

                {/* Sheet selection for Excel files using inline SheetSelector */}
                {isExpanded && isExcel && (
                    <div className="px-2 pb-2 border-t border-slate-100">
                        <div className="mt-2">
                            <SheetSelector
                                fileId={file.file_id}
                                currentSheet={file.selected_sheet}
                                sheets={file.available_sheets || []}
                                onSheetSelected={(sheetName, sheetData) => handleSheetSelected(file.file_id, sheetName, sheetData)}
                                disabled={false}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className="w-80 bg-gradient-to-br from-slate-50 to-blue-50 border-r border-slate-200 flex flex-col shadow-lg h-screen"
            style={{width: `${width}px`}}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <div
                        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <FileText className="text-white" size={16}/>
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Setup & Configuration</h2>
                        <p className="text-xs text-slate-600">Choose process and upload files</p>
                    </div>
                </div>
            </div>

            {/* Dynamic Content Area - Adjust based on whether template is selected */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Step 1: Process Templates */}
                <div
                    className={`p-4 border-b border-slate-200 bg-white/30 ${selectedTemplate ? 'flex-shrink-0' : 'flex-1 max-h-96'}`}>
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-orange-600 text-sm font-bold">1</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">Select Process</h3>
                    </div>

                    {selectedTemplate ? (
                        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-2 mb-1">
                                <CheckCircle size={14} className="text-green-600"/>
                                <span className="text-xs font-medium text-green-800">Process Selected</span>
                            </div>
                            <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm">{getProcessIcon(selectedTemplate.category)}</span>
                                <p className="text-xs text-green-700 font-medium">{selectedTemplate.name}</p>
                            </div>
                            <p className="text-xs text-green-600 mb-1">
                                Requires {selectedTemplate.filesRequired} file{selectedTemplate.filesRequired !== 1 ? 's' : ''}
                            </p>
                            <button
                                onClick={() => onTemplateSelect(null)}
                                className="text-xs text-green-600 hover:text-green-800 underline transition-colors duration-200"
                            >
                                Change process
                            </button>
                        </div>
                    ) : (
                        <div className="h-full max-h-80 overflow-y-auto space-y-2">
                            {templates.map((template, index) => (
                                <div
                                    key={index}
                                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-300 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.02]"
                                    onClick={() => onTemplateSelect(template)}
                                >
                                    <div className="p-3">
                                        <div className="flex items-start space-x-3">
                                            <div
                                                className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${getProcessColor(template.category, index)} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                                <span
                                                    className="text-white text-lg">{getProcessIcon(template.category)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-sm text-slate-800 group-hover:text-blue-800 transition-colors duration-300 mb-1">
                                                    {template.name}
                                                </h4>
                                                <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                                                    {template.description}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-blue-600 font-medium">
                                                        {template.filesRequired} file{template.filesRequired !== 1 ? 's' : ''} required
                                                    </span>
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                                        {template.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Step 2: File Upload */}
                <div className="p-4 border-b border-slate-200 bg-white/30 flex-shrink-0">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm font-bold">2</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">Upload Files</h3>
                    </div>

                    <div className="space-y-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".csv,.xlsx,.xls"
                            multiple
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadProgress === true}
                            className="w-full py-2 px-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {uploadProgress === true ? (
                                <>
                                    <div
                                        className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={16}/>
                                    <span>Upload Files</span>
                                </>
                            )}
                        </button>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600">
                                {files.length} file{files.length !== 1 ? 's' : ''} available
                            </span>
                            <button
                                onClick={onRefreshFiles}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1 transition-colors duration-200"
                            >
                                <RefreshCw size={12}/>
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 3: File Library with Sheet Selection */}
                <div className="flex-1 overflow-hidden">
                    <div className="p-4 pb-2">
                        <div className="flex items-center space-x-2 mb-3">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 text-sm font-bold">3</span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">File Library</h3>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                        {files.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <FileText size={32} className="mx-auto mb-2 opacity-50"/>
                                <p className="text-sm">No files uploaded yet</p>
                                <p className="text-xs">Upload CSV or Excel files to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {files.map(renderFileItem)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 4: File Assignment */}
                {selectedTemplate && (
                    <div className="border-t border-slate-200 bg-white/50 flex-shrink-0">
                        <div className="p-4">
                            <div className="flex items-center space-x-2 mb-3">
                                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span className="text-purple-600 text-sm font-bold">4</span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-700">Assign Files</h3>
                                <div className="ml-auto">
                                    {status.complete ? (
                                        <CheckCircle size={16} className="text-green-600"/>
                                    ) : (
                                        <span className="text-xs text-slate-500">
                                            {status.selected}/{status.required}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {requiredFiles.map((requiredFile) => (
                                    <div key={requiredFile.key} className="space-y-1">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-medium text-slate-700">
                                                {requiredFile.label}:
                                            </span>
                                            {selectedFiles[requiredFile.key] && (
                                                <CheckCircle size={12} className="text-green-600"/>
                                            )}
                                        </div>
                                        <select
                                            value={selectedFiles[requiredFile.key]?.file_id || ''}
                                            onChange={(e) => {
                                                const file = files.find(f => f.file_id === e.target.value);
                                                handleFileSelection(requiredFile.key, file);
                                            }}
                                            className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                        >
                                            <option value="">Select {requiredFile.label.toLowerCase()}...</option>
                                            {files.map((file) => (
                                                <option key={file.file_id} value={file.file_id}>
                                                    {file.filename}
                                                    {file.is_excel && file.selected_sheet ? ` (${file.selected_sheet})` : ''}
                                                    {` - ${file.total_rows?.toLocaleString()} rows`}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedFiles[requiredFile.key] && (
                                            <p className="text-xs text-green-600 ml-1">
                                                ✓ {selectedFiles[requiredFile.key].filename} selected
                                                {selectedFiles[requiredFile.key].is_excel && selectedFiles[requiredFile.key].selected_sheet &&
                                                    ` (Sheet: ${selectedFiles[requiredFile.key].selected_sheet})`
                                                }
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeftSidebar;