// src/components/FileUploadModal.jsx - Reusable File Upload Modal with Sheet Selection
import React, {useEffect, useState} from 'react';
import {AlertCircle, AlertTriangle, Upload, X} from 'lucide-react';
import {apiService} from '../services/defaultApi.js';

const FileUploadModal = ({
                             isOpen,
                             file,
                             onUpload,
                             onCancel,
                             existingFiles = []
                         }) => {
    const [availableSheets, setAvailableSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [customFileName, setCustomFileName] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [uploadModalError, setUploadModalError] = useState('');
    const [fileNameValidation, setFileNameValidation] = useState({isValid: true, message: ''});

    // Reset modal state when file changes or modal opens
    useEffect(() => {
        if (isOpen && file) {
            setUploadModalError('');
            setFileNameValidation({isValid: true, message: ''});
            setSelectedSheet('');
            setAvailableSheets([]);
            setCustomFileName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension

            const isExcel = apiService.isExcelFile(file);
            if (isExcel) {
                analyzeExcelFile();
            }
        }
    }, [isOpen, file]);

    const analyzeExcelFile = async () => {
        setIsAnalyzing(true);
        try {
            const analysis = await apiService.analyzeExcelSheets(file);

            if (analysis.success && analysis.sheets) {
                setAvailableSheets(analysis.sheets);
                // Auto-select first sheet if available
                if (analysis.sheets.length > 0) {
                    setSelectedSheet(analysis.sheets[0].sheet_name);
                }
            } else {
                setUploadModalError(analysis.message || 'Failed to analyze Excel sheets');
            }
        } catch (error) {
            console.error('Error analyzing Excel sheets:', error);
            setUploadModalError('Failed to analyze Excel file. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // File name validation
    const validateFileName = async (fileName) => {
        if (!fileName.trim()) {
            return {isValid: false, message: 'File name cannot be empty'};
        }

        // // Basic character validation
        // const invalidChars = /[<>:"/\\|?*]/;
        // if (invalidChars.test(fileName)) {
        //     return { isValid: false, message: 'File name conta
        // }

        // Check for duplicate names in existing files
        const isDuplicate = existingFiles.some(file =>
            (file.custom_name && file.custom_name.toLowerCase() === fileName.toLowerCase()) ||
            (!file.custom_name && file.filename.replace(/\.[^/.]+$/, "").toLowerCase() === fileName.toLowerCase())
        );

        if (isDuplicate) {
            return {isValid: false, message: 'A file with this name already exists'};
        }

        try {
            // Validate with API
            const validation = await apiService.validateFileName(fileName);
            if (!validation.isValid) {
                return {isValid: false, message: validation.message || 'Invalid file name'};
            }
            return {isValid: true, message: ''};
        } catch (error) {
            console.error('File name validation error:', error);
            return {isValid: true, message: ''}; // Don't block on API errors
        }
    };

    // Handle file name changes without validation
    const handleFileNameChange = (newName) => {
        setCustomFileName(newName);

        // Only do basic client-side validation while typing
        if (!newName.trim()) {
            setFileNameValidation({isValid: false, message: 'File name cannot be empty'});
        } else {
            // Basic character validation
            const invalidChars = /[<>:"/\\|?*]/;
            if (invalidChars.test(newName)) {
                setFileNameValidation({isValid: false, message: 'File name contains invalid characters'});
            } else {
                // Check for duplicate names in existing files (client-side only)
                const isDuplicate = existingFiles.some(file =>
                    (file.custom_name && file.custom_name.toLowerCase() === newName.toLowerCase()) ||
                    (!file.custom_name && file.filename.replace(/\.[^/.]+$/, "").toLowerCase() === newName.toLowerCase())
                );

                if (isDuplicate) {
                    setFileNameValidation({isValid: false, message: 'A file with this name already exists'});
                } else {
                    setFileNameValidation({isValid: true, message: ''});
                }
            }
        }
    };

    // Handle upload confirmation
    const handleUploadConfirm = async () => {
        if (!file) return;

        // Clear any previous errors
        setUploadModalError('');

        // Final validation - only validate with API when uploading
        if (!customFileName.trim()) {
            setFileNameValidation({isValid: false, message: 'File name cannot be empty'});
            return;
        }

        // Do full validation including API call only when uploading
        const nameValidation = await validateFileName(customFileName);
        if (!nameValidation.isValid) {
            setFileNameValidation(nameValidation);
            return;
        }

        // For Excel files, ensure sheet is selected
        const isExcel = apiService.isExcelFile(file);
        if (isExcel && !selectedSheet) {
            setUploadModalError('Please select a sheet to upload');
            return;
        }

        // Call the upload handler with the configured options
        onUpload({
            file,
            sheetName: isExcel ? selectedSheet : '',
            customName: customFileName
        });
    };

    const getFileTypeIcon = (filename) => {
        if (filename.toLowerCase().endsWith('.csv')) {
            return '📄';
        } else if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
            return '📊';
        }
        return '📄';
    };

    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Upload className="text-blue-600" size={20}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Configure File Upload</h3>
                            <p className="text-sm text-gray-600">
                                {apiService.isExcelFile(file) ? 'Select sheet and customize name' : 'Customize file name'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={20}/>
                    </button>
                </div>

                {/* File Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getFileTypeIcon(file.name)}</span>
                        <span className="text-sm font-medium text-gray-800">
                            {file.name}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {apiService.formatFileSize(file.size)}
                        </span>
                    </div>
                    <div className="text-xs text-gray-600">
                        {apiService.isExcelFile(file) ? 'Excel File' : 'CSV File'}
                    </div>
                </div>

                {/* Error Display */}
                {uploadModalError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                        <div className="flex items-center space-x-2">
                            <AlertCircle className="text-red-600" size={16}/>
                            <p className="text-sm text-red-800">{uploadModalError}</p>
                        </div>
                    </div>
                )}

                {/* Sheet Selection (Excel only) */}
                {apiService.isExcelFile(file) && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Sheet to Upload
                        </label>
                        {isAnalyzing ? (
                            <div
                                className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <div
                                    className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                <span className="text-sm text-blue-800">Analyzing Excel sheets...</span>
                            </div>
                        ) : availableSheets.length > 0 ? (
                            <div className="space-y-3">
                                <select
                                    value={selectedSheet}
                                    onChange={(e) => setSelectedSheet(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                                >
                                    <option value="">Select a sheet...</option>
                                    {availableSheets.map((sheet, index) => (
                                        <option key={index} value={sheet.sheet_name}>
                                            {sheet.sheet_name} - {sheet.row_count?.toLocaleString() || 0} rows, {sheet.column_count || 0} cols
                                            {sheet.has_headers !== undefined && (sheet.has_headers ? ' (Headers)' : ' (No Headers)')}
                                        </option>
                                    ))}
                                </select>

                                {/* Selected Sheet Details */}
                                {selectedSheet && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        {(() => {
                                            const sheet = availableSheets.find(s => s.sheet_name === selectedSheet);
                                            return sheet ? (
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-blue-800">
                                                            Selected: {sheet.sheet_name}
                                                        </span>
                                                        <div className="flex items-center space-x-2">
                                                            <span
                                                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                {sheet.row_count?.toLocaleString() || 0} rows
                                                            </span>
                                                            <span
                                                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                                                {sheet.column_count || 0} cols
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {sheet.has_headers !== undefined && (
                                                        <div className="text-xs text-blue-700">
                                                            {sheet.has_headers ? '✓ Headers detected in this sheet' : '⚠ No headers detected in this sheet'}
                                                        </div>
                                                    )}
                                                    {sheet.preview_data && sheet.preview_data.length > 0 && (
                                                        <div className="mt-2">
                                                            <div className="text-xs text-blue-700 mb-1">Sample data:
                                                            </div>
                                                            <div
                                                                className="text-xs text-blue-600 bg-white p-2 rounded border max-h-16 overflow-hidden">
                                                                {sheet.preview_data.slice(0, 2).map((row, idx) => (
                                                                    <div key={idx} className="truncate">
                                                                        {Array.isArray(row) ? row.slice(0, 3).join(' | ') : String(row).slice(0, 50)}
                                                                        {Array.isArray(row) && row.length > 3 && '...'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                            </div>
                        ) : !isAnalyzing && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                <div className="flex items-center space-x-2">
                                    <AlertTriangle className="text-yellow-600" size={16}/>
                                    <p className="text-sm text-yellow-800">No readable sheets found in this Excel
                                        file.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Custom File Name */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Name
                    </label>
                    <input
                        type="text"
                        value={customFileName}
                        onChange={(e) => handleFileNameChange(e.target.value)}
                        className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                            fileNameValidation.isValid ? 'border-gray-300' : 'border-red-500'
                        }`}
                        placeholder="Enter file name (without extension)"
                    />
                    {!fileNameValidation.isValid && (
                        <p className="text-sm text-red-600 mt-1">{fileNameValidation.message}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUploadConfirm}
                        disabled={
                            !customFileName.trim() ||
                            (apiService.isExcelFile(file) && !selectedSheet) ||
                            isAnalyzing
                        }
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        title={
                            !customFileName.trim() ? 'Enter a file name' :
                                (apiService.isExcelFile(file) && !selectedSheet) ? 'Select a sheet' :
                                    isAnalyzing ? 'Analyzing sheets...' :
                                        'Ready to upload'
                        }
                    >
                        <Upload size={16}/>
                        <span>Upload File</span>
                    </button>
                </div>

                {/* Debug Info (remove in production) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <div>File Name: "{customFileName}" (length: {customFileName.length})</div>
                        <div>Client-side
                            Valid: {fileNameValidation.isValid ? 'Yes' : 'No'} - {fileNameValidation.message}</div>
                        <div>Is Excel: {apiService.isExcelFile(file) ? 'Yes' : 'No'}</div>
                        <div>Selected Sheet: "{selectedSheet}"</div>
                        <div>Is Analyzing: {isAnalyzing ? 'Yes' : 'No'}</div>
                        <div>Button Disabled: {
                            !customFileName.trim() ||
                            (apiService.isExcelFile(file) && !selectedSheet) ||
                            isAnalyzing ? 'Yes' : 'No'
                        }</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploadModal;