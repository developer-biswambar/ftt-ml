import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { CheckCircle, AlertTriangle, FileText, Download, Eye, Trash2, Settings, Zap } from 'lucide-react';

const FileGeneratorFlow = ({
    files, 
    selectedFiles, 
    selectedTemplate, 
    flowData, 
    onComplete, 
    onCancel, 
    onSendMessage 
}) => {
    const [currentStep, setCurrentStep] = useState('file_selection');
    const [userPrompt, setUserPrompt] = useState('');
    const [validationResult, setValidationResult] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationResult, setGenerationResult] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        // Set initial file selection
        if (selectedFiles.file_0) {
            setSelectedFile(selectedFiles.file_0);
        }
        
        // Set initial prompt from template
        if (selectedTemplate?.user_requirements) {
            setUserPrompt(selectedTemplate.user_requirements);
        }
    }, [selectedFiles, selectedTemplate]);

    const handleValidatePrompt = async () => {
        if (!selectedFile || !userPrompt.trim()) {
            onSendMessage('error', '❌ Please select a file and enter a prompt first.');
            return;
        }

        setIsValidating(true);
        onSendMessage('system', '🔍 Validating your prompt with AI...');

        try {
            // Try to get file data first to create a proper File object
            const fileData = await apiService.getFileData(selectedFile.file_id, 1, 5000);
            
            if (!fileData.success) {
                throw new Error('Could not fetch file data');
            }

            // Convert the data back to CSV format
            const csvContent = convertDataToCSV(fileData.data.rows, fileData.data.columns);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], selectedFile.filename, { type: 'text/csv' });

            const result = await apiService.validatePrompt(file, userPrompt);
            setValidationResult(result);

            if (result.success) {
                const staticCols = result.validation.static_columns;
                const mappedCols = result.validation.mapped_columns;
                
                let validationMessage = '✅ **Prompt Validation Successful!**\n\n';
                validationMessage += `📊 **Available Columns:** ${result.available_columns.join(', ')}\n\n`;
                
                if (staticCols.length > 0) {
                    validationMessage += `🔧 **Static Columns:**\n${staticCols.map(col => `• ${col.column}: "${col.static_value}"`).join('\n')}\n\n`;
                }
                
                if (mappedCols.length > 0) {
                    validationMessage += `🔗 **Mapped Columns:**\n${mappedCols.map(col => `• ${col.output} ← ${col.source}`).join('\n')}\n\n`;
                }
                
                validationMessage += '🎯 **Ready to generate!** Click "Generate File" to proceed.';
                onSendMessage('success', validationMessage);
                setCurrentStep('generate');
            } else {
                onSendMessage('error', `❌ Validation failed: ${result.error}`);
            }
        } catch (error) {
            onSendMessage('error', `❌ Validation error: ${error.message}`);
        } finally {
            setIsValidating(false);
        }
    };

    const handleGenerateFile = async () => {
        if (!selectedFile || !userPrompt.trim()) {
            onSendMessage('error', '❌ Please ensure file and prompt are selected.');
            return;
        }

        setIsGenerating(true);
        onSendMessage('system', '🚀 Generating your file with AI...');

        try {
            // Get file data and convert to CSV
            const fileData = await apiService.getFileData(selectedFile.file_id, 1, 5000);
            
            if (!fileData.success) {
                throw new Error('Could not fetch file data');
            }

            const csvContent = convertDataToCSV(fileData.data.rows, fileData.data.columns);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], selectedFile.filename, { type: 'text/csv' });

            const result = await apiService.generateFileFromRules(file, userPrompt);
            setGenerationResult(result);

            if (result.success) {
                // Get preview data
                const preview = await apiService.previewGeneratedFile(result.generation_id, 5);
                setPreviewData(preview);

                const summary = result.summary;
                let successMessage = '🎉 **File Generation Complete!**\n\n';
                successMessage += `📊 **Summary:**\n`;
                successMessage += `• Input Records: ${summary.total_input_records.toLocaleString()}\n`;
                successMessage += `• Output Records: ${summary.total_output_records.toLocaleString()}\n`;
                successMessage += `• Columns Generated: ${summary.columns_generated.join(', ')}\n`;
                successMessage += `• Processing Time: ${summary.processing_time_seconds}s\n\n`;
                successMessage += `🔧 **Rules Applied:** ${summary.rules_applied}\n\n`;
                
                if (result.warnings.length > 0) {
                    successMessage += `⚠️ **Warnings:**\n${result.warnings.map(w => `• ${w}`).join('\n')}\n\n`;
                }
                
                successMessage += '📥 Use the download buttons below to get your generated file!';
                onSendMessage('success', successMessage);
                setCurrentStep('download');
            } else {
                onSendMessage('error', `❌ Generation failed: ${result.errors?.join(', ') || 'Unknown error'}`);
            }
        } catch (error) {
            onSendMessage('error', `❌ Generation error: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper function to convert data array to CSV string
    const convertDataToCSV = (data, columns) => {
        const headers = columns.join(',');
        const rows = data.map(row => 
            columns.map(col => {
                const value = row[col];
                // Handle values that contain commas or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        );
        return [headers, ...rows].join('\n');
    };

    const handleDownload = async (format) => {
        if (!generationResult) return;

        try {
            onSendMessage('system', `📥 Downloading ${format.toUpperCase()} file...`);
            
            const response = await apiService.downloadGeneratedFile(generationResult.generation_id, format);
            
            // Create download link
            const blob = new Blob([response.data], {
                type: format === 'excel' 
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'text/csv'
            });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `generated_file.${format === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            onSendMessage('success', `✅ ${format.toUpperCase()} file downloaded successfully!`);
        } catch (error) {
            onSendMessage('error', `❌ Download failed: ${error.message}`);
        }
    };

    const handleComplete = () => {
        onComplete({
            type: 'file_generation',
            generation_id: generationResult?.generation_id,
            summary: generationResult?.summary,
            rules_used: generationResult?.rules_used
        });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Zap className="text-purple-600" size={20} />
                    <h3 className="text-lg font-semibold text-gray-800">AI File Generator</h3>
                </div>
                <button
                    onClick={onCancel}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-6">
                <div className={`flex items-center space-x-2 ${currentStep === 'file_selection' ? 'text-blue-600' : currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'file_selection' ? 'bg-blue-100' : currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ? <CheckCircle size={16} /> : '1'}
                    </div>
                    <span className="text-sm font-medium">Select File</span>
                </div>
                <div className={`flex items-center space-x-2 ${currentStep === 'validate' ? 'text-blue-600' : currentStep === 'generate' || currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'validate' ? 'bg-blue-100' : currentStep === 'generate' || currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'generate' || currentStep === 'download' ? <CheckCircle size={16} /> : '2'}
                    </div>
                    <span className="text-sm font-medium">Validate Rules</span>
                </div>
                <div className={`flex items-center space-x-2 ${currentStep === 'generate' ? 'text-blue-600' : currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'generate' ? 'bg-blue-100' : currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'download' ? <CheckCircle size={16} /> : '3'}
                    </div>
                    <span className="text-sm font-medium">Generate File</span>
                </div>
                <div className={`flex items-center space-x-2 ${currentStep === 'download' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'download' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        4
                    </div>
                    <span className="text-sm font-medium">Download</span>
                </div>
            </div>

            {/* Step Content */}
            {currentStep === 'file_selection' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Source File:
                        </label>
                        <select
                            value={selectedFile?.file_id || ''}
                            onChange={(e) => {
                                const file = files.find(f => f.file_id === e.target.value);
                                setSelectedFile(file);
                            }}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Choose a file...</option>
                            {files.map(file => (
                                <option key={file.file_id} value={file.file_id}>
                                    {file.filename} ({file.total_rows?.toLocaleString()} rows, {file.columns?.length} columns)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Transformation Prompt:
                        </label>
                        <textarea
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder="Describe what you want to generate... e.g., 'create reporting file with jurisdiction always italy, trade_id from Trade_ID, header always XYZ'"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 Be specific about column mappings and static values
                        </p>
                    </div>

                    <button
                        onClick={() => setCurrentStep('validate')}
                        disabled={!selectedFile || !userPrompt.trim()}
                        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        Next: Validate Prompt
                    </button>
                </div>
            )}

            {currentStep === 'validate' && (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Review Configuration</h4>
                        <div className="text-sm text-blue-800 space-y-1">
                            <div><strong>File:</strong> {selectedFile?.filename}</div>
                            <div><strong>Columns Available:</strong> {selectedFile?.columns?.length || 0}</div>
                            <div><strong>Rows:</strong> {selectedFile?.total_rows?.toLocaleString() || 0}</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your Prompt:
                        </label>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                            {userPrompt}
                        </div>
                    </div>

                    {validationResult && (
                        <div className={`p-4 rounded-lg ${validationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                            <div className="flex items-center space-x-2 mb-2">
                                {validationResult.success ? (
                                    <CheckCircle className="text-green-600" size={16} />
                                ) : (
                                    <AlertTriangle className="text-red-600" size={16} />
                                )}
                                <span className={`font-medium ${validationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {validationResult.success ? 'Validation Successful' : 'Validation Failed'}
                                </span>
                            </div>
                            {validationResult.success && (
                                <div className="text-sm text-green-700">
                                    <div>Static Columns: {validationResult.validation.static_columns.length}</div>
                                    <div>Mapped Columns: {validationResult.validation.mapped_columns.length}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={() => setCurrentStep('file_selection')}
                            className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleValidatePrompt}
                            disabled={isValidating}
                            className="flex-1 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                        >
                            {isValidating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Validating...</span>
                                </>
                            ) : (
                                <span>Validate with AI</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {currentStep === 'generate' && (
                <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="text-green-600" size={16} />
                            <span className="font-medium text-green-800">Validation Complete</span>
                        </div>
                        <p className="text-sm text-green-700">
                            Your prompt has been validated and rules are ready for generation.
                        </p>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={() => setCurrentStep('validate')}
                            className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleGenerateFile}
                            disabled={isGenerating}
                            className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={16} />
                                    <span>Generate File</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {currentStep === 'download' && (
                <div className="space-y-4">
                    {/* Preview */}
                    {previewData && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">Preview Generated File</h4>
                            <div className="text-sm text-blue-800 mb-3">
                                Showing {previewData.showing_records} of {previewData.total_records.toLocaleString()} records
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-blue-100">
                                            {previewData.columns.map(col => (
                                                <th key={col} className="border border-blue-200 px-2 py-1 text-left font-medium text-blue-900">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.preview_data.slice(0, 3).map((row, idx) => (
                                            <tr key={idx} className="bg-white">
                                                {previewData.columns.map(col => (
                                                    <td key={col} className="border border-blue-200 px-2 py-1 text-blue-800">
                                                        {row[col] || ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Download Options */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleDownload('csv')}
                            className="flex items-center justify-center space-x-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
                        >
                            <Download size={16} />
                            <span>Download CSV</span>
                        </button>
                        <button
                            onClick={() => handleDownload('excel')}
                            className="flex items-center justify-center space-x-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                        >
                            <Download size={16} />
                            <span>Download Excel</span>
                        </button>
                    </div>

                    <button
                        onClick={handleComplete}
                        className="w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200"
                    >
                        Complete Process
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileGeneratorFlow;