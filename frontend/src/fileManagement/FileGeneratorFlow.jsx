import React, {useCallback, useEffect, useState} from 'react';
import {apiService} from '../services/defaultApi.js';
import {AlertTriangle, CheckCircle, Copy, Download, Layers, Zap} from 'lucide-react';

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
    const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);

    // Predefined prompts for common row multiplication scenarios
    const advancedPrompts = [
        {
            title: "Split Amount in Half",
            description: "Create 2 rows: half amount in each row",
            prompt: "generate 2 rows for each source row, half amount in first row, other half amount in second row, copy all other fields"
        },
        {
            title: "Amount Split (Full & Zero)",
            description: "Create 2 rows: full amount in first, zero in second",
            prompt: "generate 2 rows for each source row, amount {amount_column} in first row and amount 0 in second row, copy trade_id from {id_column}"
        },
        {
            title: "Percentage Split (70/30)",
            description: "Create 2 rows with 70% and 30% split",
            prompt: "generate 2 rows for each source row, 70% amount in first row, 30% amount in second row, copy all other fields"
        },
        {
            title: "Duplicate with Status Variants",
            description: "Create 2 rows per source: one 'active', one 'inactive'",
            prompt: "generate 2 rows for each source row, copy all columns, add status column with 'active' in first row and 'inactive' in second row"
        },
        {
            title: "Type Variants (A, B, C)",
            description: "Create 3 rows with different types",
            prompt: "generate 3 rows for each source row, type 'A' in first row, type 'B' in second row, type 'C' in third row"
        },
        {
            title: "Buy/Sell Pair",
            description: "Create buy and sell transactions",
            prompt: "generate 2 rows for each source row, side 'BUY' in first row and side 'SELL' in second row, copy all other fields"
        },
        {
            title: "Quarter Split (25% each)",
            description: "Split into 4 equal parts",
            prompt: "generate 4 rows for each source row, 25% amount in each row, copy all other fields"
        }
    ];

    // Helper function to scroll to bottom of page
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });

            // Also try to scroll the messages container
            const messagesContainer = document.querySelector('[class*="overflow-y-auto"]');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 100);
    }, []);

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

    // Scroll when step changes
    useEffect(() => {
        scrollToBottom();
    }, [currentStep, scrollToBottom]);

    // Scroll when validation or generation results appear
    useEffect(() => {
        if (validationResult || generationResult || previewData) {
            scrollToBottom();
        }
    }, [validationResult, generationResult, previewData, scrollToBottom]);

    const handlePromptSelect = (promptTemplate) => {
        // Try to substitute column names if available
        let finalPrompt = promptTemplate.prompt;

        if (selectedFile && selectedFile.columns) {
            const columns = selectedFile.columns;

            // Common substitutions
            const amountColumns = columns.filter(col =>
                col.toLowerCase().includes('amount') ||
                col.toLowerCase().includes('value') ||
                col.toLowerCase().includes('price')
            );

            const idColumns = columns.filter(col =>
                col.toLowerCase().includes('id') ||
                col.toLowerCase().includes('trade') ||
                col.toLowerCase().includes('ref')
            );

            if (amountColumns.length > 0) {
                finalPrompt = finalPrompt.replace('{amount_column}', amountColumns[0]);
            }

            if (idColumns.length > 0) {
                finalPrompt = finalPrompt.replace('{id_column}', idColumns[0]);
            }

            // Remove any remaining placeholders
            finalPrompt = finalPrompt.replace(/\{[^}]+\}/g, '[COLUMN_NAME]');
        }

        setUserPrompt(finalPrompt);
        setShowAdvancedPrompts(false);
        onSendMessage('system', `🎯 Selected template: ${promptTemplate.title}`);
    };

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
            const blob = new Blob([csvContent], {type: 'text/csv'});
            const file = new File([blob], selectedFile.filename, {type: 'text/csv'});

            const result = await apiService.validatePrompt(file, userPrompt);
            setValidationResult(result);

            if (result.success) {
                const staticCols = result.validation.static_columns;
                const mappedCols = result.validation.mapped_columns;
                const conditionalCols = result.validation.conditional_columns;
                const rowMultiplication = result.validation.row_multiplication;

                let validationMessage = '✅ **Prompt Validation Successful!**\n\n';
                validationMessage += `📊 **Available Columns:** ${result.available_columns.join(', ')}\n\n`;

                // Row multiplication info
                if (rowMultiplication && rowMultiplication.enabled) {
                    validationMessage += `🔄 **Row Multiplication:** ${rowMultiplication.count}x (${rowMultiplication.description})\n\n`;
                }

                if (staticCols.length > 0) {
                    validationMessage += `🔧 **Static Columns:**\n${staticCols.map(col => `• ${col.column}: "${col.static_value}"`).join('\n')}\n\n`;
                }

                if (mappedCols.length > 0) {
                    validationMessage += `🔗 **Mapped Columns:**\n${mappedCols.map(col => `• ${col.output} ← ${col.source}`).join('\n')}\n\n`;
                }

                if (conditionalCols.length > 0) {
                    validationMessage += `🎯 **Conditional Columns:**\n`;
                    conditionalCols.forEach(col => {
                        validationMessage += `• ${col.column}:\n`;
                        col.conditions.forEach(cond => {
                            const conditionDesc = cond.condition.condition || `Row ${cond.condition.row_index}`;
                            validationMessage += `  - ${conditionDesc}: "${cond.value}"\n`;
                        });
                    });
                    validationMessage += '\n';
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
            const blob = new Blob([csvContent], {type: 'text/csv'});
            const file = new File([blob], selectedFile.filename, {type: 'text/csv'});

            const result = await apiService.generateFileFromRules(file, userPrompt);
            setGenerationResult(result);

            if (result.success) {
                const summary = result.summary;
                let successMessage = '🎉 **File Generation Complete!**\n\n';
                successMessage += `📊 **Summary:**\n`;
                successMessage += `• Input Records: ${summary.total_input_records.toLocaleString()}\n`;
                successMessage += `• Output Records: ${summary.total_output_records.toLocaleString()}\n`;

                if (summary.row_multiplication_factor > 1) {
                    successMessage += `• Row Multiplication: ${summary.row_multiplication_factor}x\n`;
                }

                successMessage += `• Columns Generated: ${summary.columns_generated.join(', ')}\n`;
                successMessage += `• Processing Time: ${summary.processing_time_seconds}s\n\n`;
                successMessage += `🔧 **Rules Applied:** ${summary.rules_applied}\n\n`;

                if (result.warnings.length > 0) {
                    successMessage += `⚠️ **Warnings:**\n${result.warnings.map(w => `• ${w}`).join('\n')}\n\n`;
                }

                successMessage += '📥 Your file is ready for download!';
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

    const handleStepChange = (newStep) => {
        setCurrentStep(newStep);
        // Scroll after step change
        setTimeout(() => scrollToBottom(), 150);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Zap className="text-purple-600" size={20}/>
                    <h3 className="text-lg font-semibold text-gray-800">AI File Generator</h3>
                    {validationResult?.validation?.row_multiplication?.enabled && (
                        <div
                            className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                            <Layers size={12}/>
                            <span>{validationResult.validation.row_multiplication.count}x Multiplication</span>
                        </div>
                    )}
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
                <div
                    className={`flex items-center space-x-2 ${currentStep === 'file_selection' ? 'text-blue-600' : currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'file_selection' ? 'bg-blue-100' : currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'validate' || currentStep === 'generate' || currentStep === 'download' ?
                            <CheckCircle size={16}/> : '1'}
                    </div>
                    <span className="text-sm font-medium">Select File</span>
                </div>
                <div
                    className={`flex items-center space-x-2 ${currentStep === 'validate' ? 'text-blue-600' : currentStep === 'generate' || currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'validate' ? 'bg-blue-100' : currentStep === 'generate' || currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'generate' || currentStep === 'download' ? <CheckCircle size={16}/> : '2'}
                    </div>
                    <span className="text-sm font-medium">Validate Rules</span>
                </div>
                <div
                    className={`flex items-center space-x-2 ${currentStep === 'generate' ? 'text-blue-600' : currentStep === 'download' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'generate' ? 'bg-blue-100' : currentStep === 'download' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {currentStep === 'download' ? <CheckCircle size={16}/> : '3'}
                    </div>
                    <span className="text-sm font-medium">Generate File</span>
                </div>
                <div
                    className={`flex items-center space-x-2 ${currentStep === 'download' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'download' ? 'bg-blue-100' : 'bg-gray-100'}`}>
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
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Transformation Prompt:
                            </label>
                            <button
                                onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                                className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 text-sm"
                            >
                                <Layers size={14}/>
                                <span>Templates</span>
                            </button>
                        </div>

                        {showAdvancedPrompts && (
                            <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <h4 className="text-sm font-medium text-purple-900 mb-2">Row Multiplication
                                    Templates:</h4>
                                <div className="space-y-2">
                                    {advancedPrompts.map((template, idx) => (
                                        <div key={idx}
                                             className="p-2 bg-white rounded border border-purple-200 hover:bg-purple-50 cursor-pointer transition-colors"
                                             onClick={() => handlePromptSelect(template)}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div
                                                        className="text-sm font-medium text-purple-900">{template.title}</div>
                                                    <div
                                                        className="text-xs text-purple-700">{template.description}</div>
                                                </div>
                                                <Copy size={12} className="text-purple-600"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <textarea
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder="Describe what you want to generate... e.g., 'generate 2 rows for each source row, amount 100 in first row and amount 0 in second row, copy trade_id from Trade_ID'"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                        />
                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                            <div>💡 <strong>Row Multiplication:</strong> Use phrases like "generate X rows", "create 2
                                rows for each", "duplicate each row"
                            </div>
                            <div>🎯 <strong>Conditional Values:</strong> Specify different values per row: "amount 100 in
                                first row, amount 0 in second"
                            </div>
                            <div>🔗 <strong>Column Mapping:</strong> Map source to output: "copy trade_id from Trade_ID"
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => handleStepChange('validate')}
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
                        <div
                            className={`p-4 rounded-lg ${validationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                            <div className="flex items-center space-x-2 mb-2">
                                {validationResult.success ? (
                                    <CheckCircle className="text-green-600" size={16}/>
                                ) : (
                                    <AlertTriangle className="text-red-600" size={16}/>
                                )}
                                <span
                                    className={`font-medium ${validationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {validationResult.success ? 'Validation Successful' : 'Validation Failed'}
                                </span>
                            </div>
                            {validationResult.success && (
                                <div className="text-sm text-green-700 space-y-1">
                                    {validationResult.validation.row_multiplication?.enabled && (
                                        <div className="flex items-center space-x-2 bg-green-100 p-2 rounded">
                                            <Layers size={14}/>
                                            <span><strong>Row Multiplication:</strong> {validationResult.validation.row_multiplication.count}x</span>
                                        </div>
                                    )}
                                    <div>Static Columns: {validationResult.validation.static_columns.length}</div>
                                    <div>Mapped Columns: {validationResult.validation.mapped_columns.length}</div>
                                    <div>Conditional
                                        Columns: {validationResult.validation.conditional_columns.length}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={() => handleStepChange('file_selection')}
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
                            <CheckCircle className="text-green-600" size={16}/>
                            <span className="font-medium text-green-800">Validation Complete</span>
                        </div>
                        <p className="text-sm text-green-700">
                            Your prompt has been validated and rules are ready for generation.
                        </p>
                        {validationResult?.validation?.row_multiplication?.enabled && (
                            <div className="mt-2 flex items-center space-x-2 text-sm text-green-800">
                                <Layers size={14}/>
                                <span>Will generate {validationResult.validation.row_multiplication.count} rows per source row</span>
                            </div>
                        )}
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={() => handleStepChange('validate')}
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
                                    <Zap size={16}/>
                                    <span>Generate File</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {currentStep === 'download' && (
                <div className="space-y-4">
                    {/* Generation Complete Message */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="text-green-600" size={16}/>
                            <span className="font-medium text-green-800">File Generation Complete!</span>
                        </div>
                        <p className="text-sm text-green-700">
                            Your file has been successfully generated and is ready for download.
                        </p>
                        {generationResult?.summary && (
                            <div className="mt-2 text-sm text-green-800 space-y-1">
                                <div>📊 <strong>Records:</strong> {generationResult.summary.total_output_records.toLocaleString()} generated
                                    from {generationResult.summary.total_input_records.toLocaleString()} source records
                                </div>
                                {generationResult.summary.row_multiplication_factor > 1 && (
                                    <div className="flex items-center space-x-2">
                                        <Layers size={14}/>
                                        <span><strong>Multiplication:</strong> {generationResult.summary.row_multiplication_factor}x rows per source</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Download Options */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleDownload('csv')}
                            className="flex items-center justify-center space-x-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
                        >
                            <Download size={16}/>
                            <span>Download CSV</span>
                        </button>
                        <button
                            onClick={() => handleDownload('excel')}
                            className="flex items-center justify-center space-x-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                        >
                            <Download size={16}/>
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