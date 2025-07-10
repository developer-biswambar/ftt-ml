// src/components/LeftSidebar.jsx - Integrated with Delta Generation Template
import React, {useRef, useState} from 'react';
import {CheckCircle, Eye, FileText, RefreshCw, Upload, AlertCircle, X, Sheet} from 'lucide-react';
import { apiService } from '../services/api';

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
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [availableSheets, setAvailableSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [customFileName, setCustomFileName] = useState('');
    const [loadingSheets, setLoadingSheets] = useState(false);
    const [nameError, setNameError] = useState('');

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
            window.open(viewerUrl, '_blank');
        }
    };

    const handleFileInputChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Clear the input
        event.target.value = '';

        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

        if (isExcel) {
            // Show modal for Excel files to select sheet and name
            setUploadFile(file);
            setCustomFileName(file.name.replace(/\.(xlsx|xls)$/i, ''));
            setSelectedSheet('');
            setNameError('');
            setShowUploadModal(true);
            await loadExcelSheets(file);
        } else {
            // For CSV, show modal to allow name customization
            const baseName = file.name.replace(/\.csv$/i, '');
            setUploadFile(file);
            setCustomFileName(baseName);
            setSelectedSheet(''); // No sheet for CSV
            setAvailableSheets([]);
            setNameError('');
            setShowUploadModal(true);
        }
    };

    const loadExcelSheets = async (file) => {
        setLoadingSheets(true);
        try {
            // Use API service to analyze Excel sheets
            const result = await apiService.analyzeExcelSheets(file);

            if (result.success && result.sheets && result.sheets.length > 0) {
                setAvailableSheets(result.sheets);
                setSelectedSheet(result.sheets[0].sheet_name);
            } else {
                // Fallback to common sheet names if analysis fails
                setAvailableSheets([
                    { sheet_name: 'Sheet1', row_count: 0, column_count: 0 },
                    { sheet_name: 'Data', row_count: 0, column_count: 0 },
                    { sheet_name: 'Main', row_count: 0, column_count: 0 }
                ]);
                setSelectedSheet('Sheet1');
            }
        } catch (error) {
            console.error('Error loading sheets:', error);
            // Fallback to common sheet names
            setAvailableSheets([
                { sheet_name: 'Sheet1', row_count: 0, column_count: 0 },
                { sheet_name: 'Data', row_count: 0, column_count: 0 },
                { sheet_name: 'Main', row_count: 0, column_count: 0 }
            ]);
            setSelectedSheet('Sheet1');
        } finally {
            setLoadingSheets(false);
        }
    };

    const validateFileName = async (name) => {
        if (!name.trim()) {
            return 'File name is required';
        }
        if (name.length < 3) {
            return 'File name must be at least 3 characters';
        }
        if (name.length > 100) {
            return 'File name must be less than 100 characters';
        }
        if (!/^[a-zA-Z0-9_\-\s.]+$/.test(name)) {
            return 'File name can only contain letters, numbers, spaces, dots, hyphens and underscores';
        }

        try {
            // Use API service to validate file name
            const result = await apiService.validateFileName(name.trim());
            if (!result.isValid) {
                return result.error || 'File name already exists';
            }
        } catch (error) {
            console.error('Error validating file name:', error);
            // Fallback to local validation
            const existingFile = files.find(f =>
                (f.custom_name && f.custom_name.toLowerCase() === name.trim().toLowerCase()) ||
                f.filename.toLowerCase() === name.trim().toLowerCase()
            );
            if (existingFile) {
                return 'A file with this name already exists';
            }
        }

        return '';
    };

    const handleModalUpload = async () => {
        if (!uploadFile) return;

        const finalName = customFileName.trim() || uploadFile.name.replace(/\.(csv|xlsx|xls)$/i, '');

        // Validate file name
        const nameValidationError = await validateFileName(finalName);
        if (nameValidationError) {
            setNameError(nameValidationError);
            return;
        }

        try {
            // Use the enhanced API service upload method
            const result = await apiService.uploadFileWithOptions(
                uploadFile,
                selectedSheet,
                finalName
            );

            if (result.success) {
                // Refresh the file list
                await onRefreshFiles();

                // Close modal and reset state
                setShowUploadModal(false);
                setUploadFile(null);
                setCustomFileName('');
                setSelectedSheet('');
                setAvailableSheets([]);
                setNameError('');
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setNameError('Upload failed: ' + error.message);
        }
    };

    const closeModal = () => {
        setShowUploadModal(false);
        setUploadFile(null);
        setCustomFileName('');
        setSelectedSheet('');
        setAvailableSheets([]);
        setNameError('');
    };

    const handleFileSelection = (fileKey, file) => {
        setSelectedFiles(prev => ({
            ...prev,
            [fileKey]: file
        }));
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
            case 'delta-generation':
                return '📊';
            case 'validation':
                return '🔍';
            case 'cleaning':
                return '🧹';
            case 'extraction':
                return '📋';
            case 'consolidation':
                return '📚';
            case 'ai-analysis':
                return '🤖';
            case 'ai-generation':
                return '🎲';
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
        if (category === 'delta-generation') {
            return 'from-orange-500 to-red-600';
        }

        return colors[index % colors.length];
    };

    const getFileTypeIcon = (filename) => {
        if (filename.toLowerCase().endsWith('.csv')) {
            return '📄';
        } else if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
            return '📊';
        }
        return '📄';
    };

    const renderFileItem = (file) => {
        const displayName = file.custom_name || file.filename;
        const isExcel = file.filename.toLowerCase().endsWith('.xlsx') || file.filename.toLowerCase().endsWith('.xls');

        return (
            <div
                key={file.file_id}
                className="group bg-white/70 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all duration-200"
            >
                <div className="p-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="text-lg">{getFileTypeIcon(file.filename)}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1 mb-0.5">
                                    <p className="text-xs font-medium text-slate-800 truncate"
                                       title={displayName}>
                                        {displayName}
                                    </p>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                        isExcel 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {isExcel ? 'Excel' : 'CSV'}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {file.total_rows?.toLocaleString()} rows • {file.columns?.length} cols
                                    {file.sheet_name && (
                                        <span className="ml-1 text-blue-600">• {file.sheet_name}</span>
                                    )}
                                </div>
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
            </div>
        );
    };

    return (
        <>
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

                {/* Dynamic Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {/* Step 1: Process Templates */}
                    <div className={`border-b border-slate-200 bg-white/30 flex-shrink-0 ${
                        selectedTemplate ? 'p-3' : 'p-4 max-h-64'
                    }`}>
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                                <span className="text-orange-600 text-xs font-bold">1</span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">Select Process</h3>
                        </div>

                        {selectedTemplate ? (
                            <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center space-x-2 mb-1">
                                    <CheckCircle size={12} className="text-green-600"/>
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
                            <div className="h-full max-h-52 overflow-y-auto space-y-1.5">
                                {templates.map((template, index) => (
                                    <div
                                        key={index}
                                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer hover:scale-[1.01]"
                                        onClick={() => onTemplateSelect(template)}
                                    >
                                        <div className="p-2.5">
                                            <div className="flex items-start space-x-2.5">
                                                <div
                                                    className={`flex-shrink-0 w-7 h-7 bg-gradient-to-br ${getProcessColor(template.category, index)} rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
                                                    <span
                                                        className="text-white text-sm">{getProcessIcon(template.category)}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm text-slate-800 group-hover:text-blue-800 transition-colors duration-200 leading-tight mb-1">
                                                        {template.name}
                                                    </h4>
                                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-1.5">
                                                        {template.description}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-blue-600 font-medium">
                                                            {template.filesRequired} file{template.filesRequired !== 1 ? 's' : ''}
                                                        </span>
                                                        {template.category?.includes('ai') && (
                                                            <span
                                                                className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                                                AI
                                                            </span>
                                                        )}
                                                        {template.category === 'delta-generation' && (
                                                            <span
                                                                className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                                                                NEW
                                                            </span>
                                                        )}
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
                    <div className="p-3 border-b border-slate-200 bg-white/30 flex-shrink-0">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 text-xs font-bold">2</span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">Upload Files</h3>
                        </div>

                        <div className="space-y-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInputChange}
                                accept=".csv,.xlsx,.xls"
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

                    {/* Step 3: File Library */}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <div className="p-3 pb-2 flex-shrink-0">
                            <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-green-600 text-xs font-bold">3</span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-700">File Library</h3>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
                            {files.length === 0 ? (
                                <div className="text-center py-6 text-slate-500">
                                    <FileText size={28} className="mx-auto mb-2 opacity-50"/>
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
                        <div className="border-t border-slate-200 bg-white/50 flex-shrink-0 max-h-48 overflow-hidden flex flex-col">
                            <div className="p-3 pb-2 flex-shrink-0">
                                <div className="flex items-center space-x-2">
                                    <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                                        <span className="text-purple-600 text-xs font-bold">4</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-700">Assign Files</h3>
                                    <div className="ml-auto">
                                        {status.complete ? (
                                            <CheckCircle size={14} className="text-green-600"/>
                                        ) : (
                                            <span className="text-xs text-slate-500">
                                                {status.selected}/{status.required}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
                                <div className="space-y-2">
                                    {requiredFiles.map((requiredFile) => (
                                        <div key={requiredFile.key} className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs font-medium text-slate-700">
                                                    {requiredFile.label}:
                                                </span>
                                                {selectedFiles[requiredFile.key] && (
                                                    <CheckCircle size={10} className="text-green-600"/>
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
                                                {files.map((file) => {
                                                    const displayName = file.custom_name || file.filename;
                                                    return (
                                                        <option key={file.file_id} value={file.file_id}>
                                                            {displayName} - {file.total_rows?.toLocaleString()} rows, {file.columns?.length} cols
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {selectedFiles[requiredFile.key] && (
                                                <p className="text-xs text-green-600 ml-1">
                                                    ✓ {selectedFiles[requiredFile.key].custom_name || selectedFiles[requiredFile.key].filename} selected
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Process Status */}
                <div className="h-16 p-2 flex items-center justify-center bg-white/20 flex-shrink-0">
                    {!selectedTemplate ? (
                        <div className="text-slate-500 text-center">
                            <div
                                className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">🚀</span>
                            </div>
                            <p className="text-xs font-medium">Choose a Process</p>
                        </div>
                    ) : !status.complete ? (
                        <div className="text-yellow-600 text-center">
                            <div
                                className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">📁</span>
                            </div>
                            <p className="text-xs font-medium">Select Required Files</p>
                        </div>
                    ) : (
                        <div className="text-green-600 text-center">
                            <div
                                className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">✅</span>
                            </div>
                            <p className="text-xs font-medium">Ready to Start</p>
                            <p className="text-xs text-slate-600">Type "start" in chat →</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Upload Configuration</h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* File Name Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    File Name
                                </label>
                                <input
                                    type="text"
                                    value={customFileName}
                                    onChange={(e) => {
                                        setCustomFileName(e.target.value);
                                        setNameError('');
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter custom file name"
                                />
                                {nameError && (
                                    <p className="text-red-500 text-xs mt-1">{nameError}</p>
                                )}
                            </div>

                            {/* Sheet Selection (Excel only) */}
                            {uploadFile && (uploadFile.name.toLowerCase().endsWith('.xlsx') || uploadFile.name.toLowerCase().endsWith('.xls')) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Sheet
                                    </label>
                                    {loadingSheets ? (
                                        <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-md">
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                                            <span className="text-sm text-blue-700">Loading sheets...</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedSheet}
                                            onChange={(e) => setSelectedSheet(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Select a sheet</option>
                                            {availableSheets.map((sheet, index) => (
                                                <option key={`${sheet.sheet_name}-${index}`} value={sheet.sheet_name}>
                                                    {sheet.sheet_name}
                                                    {sheet.row_count > 0 ? ` (${sheet.row_count.toLocaleString()} rows, ${sheet.column_count} cols)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {selectedSheet && availableSheets.length > 0 && (
                                        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                            <strong>Selected Sheet Info:</strong>
                                            {(() => {
                                                const sheet = availableSheets.find(s => s.sheet_name === selectedSheet);
                                                return sheet ? (
                                                    <div>
                                                        {sheet.sheet_name} - {sheet.row_count?.toLocaleString() || 0} rows, {sheet.column_count || 0} columns
                                                    </div>
                                                ) : (
                                                    <div>No details available</div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* File Info */}
                            <div className="bg-gray-50 p-3 rounded-md">
                                <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-lg">{getFileTypeIcon(uploadFile?.name || '')}</span>
                                    <span className="text-sm font-medium text-gray-800">{uploadFile?.name}</span>
                                </div>
                                <p className="text-xs text-gray-600">
                                    Size: {uploadFile && (uploadFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleModalUpload}
                                disabled={!customFileName.trim() || (uploadFile?.name.toLowerCase().endsWith('.xlsx') && !selectedSheet) || uploadProgress === true}
                                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploadProgress === true ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LeftSidebar;