// src/components/ReconciliationFlow.jsx - Updated with AI regex generation
import React, { useState, useEffect } from 'react';
import {
    FileText, ChevronRight, ChevronLeft, Check, X, Plus, Minus,
    AlertCircle, Eye, Search, Filter, Target, Settings, Wand2
} from 'lucide-react';
import AIRegexGenerator from './AIRegexGenerator';

const ReconciliationFlow = ({
    files,
    selectedFiles,
    selectedTemplate,
    flowData,
    onComplete,
    onCancel,
    onSendMessage
}) => {
    const [currentStep, setCurrentStep] = useState('file_selection');
    const [config, setConfig] = useState({
        Files: [],
        ReconciliationRules: []
    });
    const [selectedSheets, setSelectedSheets] = useState({});
    const [extractionRules, setExtractionRules] = useState({});
    const [filterRules, setFilterRules] = useState({});
    const [reconciliationRules, setReconciliationRules] = useState([]);
    const [fileColumns, setFileColumns] = useState({});
    const [showAIRegexGenerator, setShowAIRegexGenerator] = useState(false);
    const [currentAIContext, setCurrentAIContext] = useState({
        fileIndex: 0,
        ruleIndex: 0,
        sampleText: '',
        columnName: ''
    });

    const steps = [
        { id: 'file_selection', title: 'File Selection', icon: FileText },
        { id: 'sheet_selection', title: 'Sheet Selection', icon: Search },
        { id: 'extraction_rules', title: 'Data Extraction', icon: Target },
        { id: 'filter_rules', title: 'Data Filtering', icon: Filter },
        { id: 'reconciliation_rules', title: 'Matching Rules', icon: Settings },
        { id: 'review', title: 'Review & Confirm', icon: Check }
    ];

    const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

    // Helper function to get files array from selectedFiles object
    const getSelectedFilesArray = () => {
        return Object.keys(selectedFiles)
            .sort()
            .map(key => selectedFiles[key])
            .filter(file => file !== null && file !== undefined);
    };

    // Helper function to get file by index
    const getFileByIndex = (index) => {
        const key = `file_${index}`;
        return selectedFiles[key];
    };

    // Generate sample text for AI context
    const getSampleTextForColumn = (fileIndex, columnName) => {
        const file = getFileByIndex(fileIndex);
        if (!file || !file.sample_data || !columnName) return '';

        // Get first few non-empty values from the column
        const sampleValues = file.sample_data
            .map(row => row[columnName])
            .filter(val => val && val.toString().trim())
            .slice(0, 3);

        return sampleValues.join(', ');
    };

    useEffect(() => {
        // Initialize config with selected files
        const filesArray = getSelectedFilesArray();
        if (filesArray.length >= 2) {
            setConfig({
                Files: filesArray.map((file, index) => ({
                    Name: `File${String.fromCharCode(65 + index)}`,
                    SheetName: '',
                    Extract: [],
                    Filter: []
                })),
                ReconciliationRules: []
            });

            // Set up file columns
            const newFileColumns = {};
            filesArray.forEach((file, index) => {
                newFileColumns[file.file_id] = file.columns || [
                    'Amount', 'Description', 'Date', 'Status', 'Reference', 'ID', 'Value', 'Details'
                ];
            });
            setFileColumns(newFileColumns);
        }
    }, [selectedFiles]);

    const nextStep = () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            const nextStepId = steps[currentIndex + 1].id;
            setCurrentStep(nextStepId);
            onSendMessage('system', `✅ Step ${currentIndex + 1} completed. Moving to: ${steps[currentIndex + 1].title}`);
        }
    };

    const prevStep = () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
        }
    };

    const completeFlow = () => {
        const finalConfig = {
            ...config,
            ReconciliationRules: reconciliationRules,
            user_requirements: `Reconcile files using the configured rules`,
            files: getSelectedFilesArray().map((file, index) => ({
                file_id: file.file_id,
                role: `file_${index}`,
                label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
            }))
        };

        onSendMessage('system', '🎉 Reconciliation configuration completed! Starting process...');
        onComplete(finalConfig);
    };

    const addExtractionRule = (fileIndex) => {
        const newRule = {
            ResultColumnName: '',
            SourceColumn: '',
            MatchType: 'regex',
            Patterns: ['']
        };

        const updatedConfig = { ...config };
        if (!updatedConfig.Files[fileIndex]) {
            updatedConfig.Files[fileIndex] = { Extract: [], Filter: [] };
        }
        if (!updatedConfig.Files[fileIndex].Extract) {
            updatedConfig.Files[fileIndex].Extract = [];
        }
        updatedConfig.Files[fileIndex].Extract.push(newRule);
        setConfig(updatedConfig);
    };

    const updateExtractionRule = (fileIndex, ruleIndex, field, value) => {
        const updatedConfig = { ...config };
        if (field === 'Patterns') {
            updatedConfig.Files[fileIndex].Extract[ruleIndex].Patterns = [value];
        } else {
            updatedConfig.Files[fileIndex].Extract[ruleIndex][field] = value;
        }
        setConfig(updatedConfig);
    };

    const removeExtractionRule = (fileIndex, ruleIndex) => {
        const updatedConfig = { ...config };
        updatedConfig.Files[fileIndex].Extract.splice(ruleIndex, 1);
        setConfig(updatedConfig);
    };

    // AI Regex Generation Functions
    const openAIRegexGenerator = (fileIndex, ruleIndex) => {
        const rule = config.Files[fileIndex]?.Extract?.[ruleIndex];
        const sampleText = rule?.SourceColumn ? getSampleTextForColumn(fileIndex, rule.SourceColumn) : '';

        setCurrentAIContext({
            fileIndex,
            ruleIndex,
            sampleText,
            columnName: rule?.SourceColumn || ''
        });
        setShowAIRegexGenerator(true);
    };

    const handleAIRegexGenerated = (generatedRegex) => {
        const { fileIndex, ruleIndex } = currentAIContext;
        updateExtractionRule(fileIndex, ruleIndex, 'Patterns', generatedRegex);
        updateExtractionRule(fileIndex, ruleIndex, 'MatchType', 'regex');
        setShowAIRegexGenerator(false);
        onSendMessage('system', `✨ AI generated regex pattern applied to extraction rule`);
    };

    // Filter rule functions remain the same
    const addFilterRule = (fileIndex) => {
        const newRule = {
            ColumnName: '',
            MatchType: 'equals',
            Value: ''
        };

        const updatedConfig = { ...config };
        if (!updatedConfig.Files[fileIndex]) {
            updatedConfig.Files[fileIndex] = { Extract: [], Filter: [] };
        }
        if (!updatedConfig.Files[fileIndex].Filter) {
            updatedConfig.Files[fileIndex].Filter = [];
        }
        updatedConfig.Files[fileIndex].Filter.push(newRule);
        setConfig(updatedConfig);
    };

    const updateFilterRule = (fileIndex, ruleIndex, field, value) => {
        const updatedConfig = { ...config };
        updatedConfig.Files[fileIndex].Filter[ruleIndex][field] = value;
        setConfig(updatedConfig);
    };

    const removeFilterRule = (fileIndex, ruleIndex) => {
        const updatedConfig = { ...config };
        updatedConfig.Files[fileIndex].Filter.splice(ruleIndex, 1);
        setConfig(updatedConfig);
    };

    // Reconciliation rule functions remain the same
    const addReconciliationRule = () => {
        const newRule = {
            LeftFileColumn: '',
            RightFileColumn: '',
            MatchType: 'equals',
            ToleranceValue: 0
        };
        setReconciliationRules([...reconciliationRules, newRule]);
    };

    const updateReconciliationRule = (ruleIndex, field, value) => {
        const updatedRules = [...reconciliationRules];
        updatedRules[ruleIndex][field] = value;
        setReconciliationRules(updatedRules);
    };

    const removeReconciliationRule = (ruleIndex) => {
        const updatedRules = reconciliationRules.filter((_, index) => index !== ruleIndex);
        setReconciliationRules(updatedRules);
    };

    const renderStepContent = () => {
        const filesArray = getSelectedFilesArray();

        switch (currentStep) {
            case 'file_selection':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Selected Files for Reconciliation</h3>

                        <div className="grid grid-cols-2 gap-4">
                            {filesArray.slice(0, 2).map((file, index) => {
                                const colors = ['green', 'purple'];
                                const labels = ['Primary File', 'Comparison File'];
                                const letters = ['A', 'B'];

                                return (
                                    <div key={index} className={`p-4 border border-${colors[index]}-200 bg-${colors[index]}-50 rounded-lg`}>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <div className={`w-6 h-6 bg-${colors[index]}-500 rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                                                {letters[index]}
                                            </div>
                                            <span className={`font-medium text-${colors[index]}-800`}>{labels[index]}</span>
                                        </div>
                                        <div className={`text-sm text-${colors[index]}-700`}>
                                            <p className="font-medium">{file?.filename}</p>
                                            <p className="text-xs">{file?.total_rows} rows • {file?.columns?.length} columns</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                            <p>✅ Files are ready for reconciliation configuration. Click "Next" to proceed with sheet selection.</p>
                        </div>
                    </div>
                );

            case 'sheet_selection':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Sheet Selection</h3>
                        <p className="text-sm text-gray-600">Select the specific sheet/tab from each file to use for reconciliation.</p>

                        <div className="space-y-4">
                            {config.Files.map((file, index) => {
                                const selectedFile = getFileByIndex(index);
                                return (
                                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {file.Name} Sheet: {selectedFile?.filename}
                                        </label>
                                        <select
                                            value={file.SheetName || ''}
                                            onChange={(e) => {
                                                const updatedConfig = { ...config };
                                                updatedConfig.Files[index].SheetName = e.target.value;
                                                setConfig(updatedConfig);
                                            }}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Main Sheet (Default)</option>
                                            <option value="Sheet1">Sheet1</option>
                                            <option value="Data">Data</option>
                                            <option value="Transactions">Transactions</option>
                                            <option value="Holdings">Holdings</option>
                                            <option value="Summary">Summary</option>
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'extraction_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Data Extraction Rules</h3>
                            <p className="text-sm text-gray-600">Define how to extract and transform data from each file.</p>
                        </div>

                        {config.Files.map((file, fileIndex) => {
                            const selectedFile = getFileByIndex(fileIndex);
                            const availableColumns = fileColumns[selectedFile?.file_id] || [];

                            return (
                                <div key={fileIndex} className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-md font-medium text-gray-800">
                                            {file.Name}: {selectedFile?.filename}
                                        </h4>
                                        <button
                                            onClick={() => addExtractionRule(fileIndex)}
                                            className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                        >
                                            <Plus size={14} />
                                            <span>Add Rule</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(file.Extract || []).map((rule, ruleIndex) => (
                                            <div key={ruleIndex} className="p-3 bg-gray-50 rounded border">
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Result Column Name</label>
                                                        <input
                                                            type="text"
                                                            value={rule.ResultColumnName || ''}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'ResultColumnName', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="e.g., ExtractedAmount"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Source Column</label>
                                                        <select
                                                            value={rule.SourceColumn || ''}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'SourceColumn', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="">Select Column</option>
                                                            {availableColumns.map(col => (
                                                                <option key={col} value={col}>{col}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Match Type</label>
                                                        <select
                                                            value={rule.MatchType || 'regex'}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'MatchType', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="regex">Regex Pattern</option>
                                                            <option value="exact">Exact Match</option>
                                                            <option value="contains">Contains</option>
                                                            <option value="starts_with">Starts With</option>
                                                            <option value="ends_with">Ends With</option>
                                                            <option value="ai_generated">AI Generated</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Pattern/Value</label>
                                                        <input
                                                            type="text"
                                                            value={rule.Patterns?.[0] || ''}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'Patterns', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="e.g., \\$?([\\d,]+(?:\\.\\d{2})?)"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">AI Helper</label>
                                                        <button
                                                            onClick={() => openAIRegexGenerator(fileIndex, ruleIndex)}
                                                            disabled={!rule.SourceColumn}
                                                            className="w-full flex items-center justify-center space-x-1 px-2 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-xs"
                                                            title={!rule.SourceColumn ? "Please select a source column first" : "Generate regex with AI"}
                                                        >
                                                            <Wand2 size={12} />
                                                            <span>AI</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Sample data preview for selected column */}
                                                {rule.SourceColumn && (
                                                    <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
                                                        <span className="font-medium text-blue-800">Sample data from {rule.SourceColumn}: </span>
                                                        <span className="text-blue-600">
                                                            {getSampleTextForColumn(fileIndex, rule.SourceColumn) || 'No sample data available'}
                                                        </span>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => removeExtractionRule(fileIndex, ruleIndex)}
                                                    className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    <Minus size={14} />
                                                    <span>Remove Rule</span>
                                                </button>
                                            </div>
                                        ))}

                                        {(!file.Extract || file.Extract.length === 0) && (
                                            <div className="text-center text-gray-500 py-4">
                                                <p className="text-sm">No extraction rules defined yet.</p>
                                                <p className="text-xs">Click "Add Rule" to create extraction patterns.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );

            case 'filter_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Data Filtering Rules</h3>
                            <p className="text-sm text-gray-600">Define filters to include only relevant rows from each file.</p>
                        </div>

                        {config.Files.map((file, fileIndex) => {
                            const selectedFile = getFileByIndex(fileIndex);
                            const availableColumns = fileColumns[selectedFile?.file_id] || [];

                            return (
                                <div key={fileIndex} className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-md font-medium text-gray-800">
                                            {file.Name}: {selectedFile?.filename}
                                        </h4>
                                        <button
                                            onClick={() => addFilterRule(fileIndex)}
                                            className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                        >
                                            <Plus size={14} />
                                            <span>Add Filter</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(file.Filter || []).map((rule, ruleIndex) => (
                                            <div key={ruleIndex} className="p-3 bg-gray-50 rounded border">
                                                <div className="grid grid-cols-3 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Column Name</label>
                                                        <select
                                                            value={rule.ColumnName || ''}
                                                            onChange={(e) => updateFilterRule(fileIndex, ruleIndex, 'ColumnName', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="">Select Column</option>
                                                            {availableColumns.map(col => (
                                                                <option key={col} value={col}>{col}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Match Type</label>
                                                        <select
                                                            value={rule.MatchType || 'equals'}
                                                            onChange={(e) => updateFilterRule(fileIndex, ruleIndex, 'MatchType', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="equals">Equals</option>
                                                            <option value="contains">Contains</option>
                                                            <option value="not_equals">Not Equals</option>
                                                            <option value="greater_than">Greater Than</option>
                                                            <option value="less_than">Less Than</option>
                                                            <option value="starts_with">Starts With</option>
                                                            <option value="ends_with">Ends With</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                                                        <input
                                                            type="text"
                                                            value={rule.Value || ''}
                                                            onChange={(e) => updateFilterRule(fileIndex, ruleIndex, 'Value', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="e.g., Settled"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => removeFilterRule(fileIndex, ruleIndex)}
                                                    className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    <Minus size={14} />
                                                    <span>Remove Filter</span>
                                                </button>
                                            </div>
                                        ))}

                                        {(!file.Filter || file.Filter.length === 0) && (
                                            <div className="text-center text-gray-500 py-4">
                                                <p className="text-sm">No filter rules defined yet.</p>
                                                <p className="text-xs">Click "Add Filter" to create filtering conditions.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );

            case 'reconciliation_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Reconciliation Matching Rules</h3>
                            <p className="text-sm text-gray-600">Define how to match records between the two files.</p>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-md font-medium text-gray-800">Matching Rules</h4>
                                <button
                                    onClick={addReconciliationRule}
                                    className="flex items-center space-x-1 px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                                >
                                    <Plus size={14} />
                                    <span>Add Rule</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {reconciliationRules.map((rule, ruleIndex) => {
                                    const fileA = getFileByIndex(0);
                                    const fileB = getFileByIndex(1);
                                    const columnsA = fileColumns[fileA?.file_id] || [];
                                    const columnsB = fileColumns[fileB?.file_id] || [];

                                    return (
                                        <div key={ruleIndex} className="p-3 bg-gray-50 rounded border">
                                            <div className="grid grid-cols-4 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">File A Column</label>
                                                    <select
                                                        value={rule.LeftFileColumn || ''}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'LeftFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {config.Files[0]?.Extract?.map(ext => (
                                                            <option key={ext.ResultColumnName} value={ext.ResultColumnName}>
                                                                {ext.ResultColumnName} (extracted)
                                                            </option>
                                                        ))}
                                                        {columnsA.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">File B Column</label>
                                                    <select
                                                        value={rule.RightFileColumn || ''}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'RightFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {config.Files[1]?.Extract?.map(ext => (
                                                            <option key={ext.ResultColumnName} value={ext.ResultColumnName}>
                                                                {ext.ResultColumnName} (extracted)
                                                            </option>
                                                        ))}
                                                        {columnsB.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Match Type</label>
                                                    <select
                                                        value={rule.MatchType || 'equals'}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'MatchType', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="equals">Exact Match</option>
                                                        <option value="tolerance">Tolerance Match</option>
                                                        <option value="fuzzy">Fuzzy Match</option>
                                                        <option value="contains">Contains</option>
                                                        <option value="percentage">Percentage Match</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Tolerance</label>
                                                    <input
                                                        type="number"
                                                        value={rule.ToleranceValue || ''}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'ToleranceValue', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="0"
                                                        disabled={rule.MatchType !== 'tolerance' && rule.MatchType !== 'percentage'}
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => removeReconciliationRule(ruleIndex)}
                                                className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                            >
                                                <Minus size={14} />
                                                <span>Remove Rule</span>
                                            </button>
                                        </div>
                                    );
                                })}

                                {reconciliationRules.length === 0 && (
                                    <div className="text-center text-gray-500 py-4">
                                        <p className="text-sm">No reconciliation rules defined yet.</p>
                                        <p className="text-xs">Click "Add Rule" to create matching conditions.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'review':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Review Configuration</h3>
                            <p className="text-sm text-gray-600">Review your reconciliation configuration before proceeding.</p>
                        </div>

                        {/* Files Summary */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-800 mb-2">Files Selected</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {filesArray.slice(0, 2).map((file, index) => (
                                    <div key={index}>
                                        <span className="font-medium">File {String.fromCharCode(65 + index)}:</span> {file?.filename}
                                        <br />
                                        <span className="text-xs text-blue-600">Sheet: {config.Files[index]?.SheetName || 'Default'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Extraction Rules Summary */}
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-medium text-green-800 mb-2">Extraction Rules</h4>
                            <div className="space-y-2 text-sm">
                                {config.Files.map((file, index) => (
                                    <div key={index}>
                                        <span className="font-medium">{file.Name}:</span>
                                        {file.Extract && file.Extract.length > 0 ? (
                                            <ul className="ml-4 list-disc">
                                                {file.Extract.map((rule, ruleIndex) => (
                                                    <li key={ruleIndex} className="text-xs">
                                                        Extract "{rule.ResultColumnName}" from "{rule.SourceColumn}" using {rule.MatchType}
                                                        {rule.MatchType === 'ai_generated' && <span className="text-purple-600 ml-1">✨ AI Generated</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-xs text-gray-500 ml-2">No extraction rules</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Filter Rules Summary */}
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="font-medium text-yellow-800 mb-2">Filter Rules</h4>
                            <div className="space-y-2 text-sm">
                                {config.Files.map((file, index) => (
                                    <div key={index}>
                                        <span className="font-medium">{file.Name}:</span>
                                        {file.Filter && file.Filter.length > 0 ? (
                                            <ul className="ml-4 list-disc">
                                                {file.Filter.map((rule, ruleIndex) => (
                                                    <li key={ruleIndex} className="text-xs">
                                                        {rule.ColumnName} {rule.MatchType} "{rule.Value}"
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-xs text-gray-500 ml-2">No filter rules</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reconciliation Rules Summary */}
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h4 className="font-medium text-purple-800 mb-2">Reconciliation Rules</h4>
                            <div className="space-y-2 text-sm">
                                {reconciliationRules.length > 0 ? (
                                    <ul className="space-y-1">
                                        {reconciliationRules.map((rule, index) => (
                                            <li key={index} className="text-xs">
                                                Match "{rule.LeftFileColumn}" with "{rule.RightFileColumn}" using {rule.MatchType}
                                                {(rule.MatchType === 'tolerance' || rule.MatchType === 'percentage') && rule.ToleranceValue && ` (tolerance: ${rule.ToleranceValue})`}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-xs text-gray-500">No reconciliation rules defined</span>
                                )}
                            </div>
                        </div>

                        {/* Validation */}
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-2">Configuration Status</h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center space-x-2">
                                    <Check size={16} className="text-green-500" />
                                    <span>Files selected</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {reconciliationRules.length > 0 ? (
                                        <Check size={16} className="text-green-500" />
                                    ) : (
                                        <AlertCircle size={16} className="text-yellow-500" />
                                    )}
                                    <span>Reconciliation rules {reconciliationRules.length > 0 ? 'configured' : 'needed'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    return (
        <>
            <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg max-w-4xl mx-auto">
                {/* Step Progress */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        {steps.map((step, index) => {
                            const isActive = step.id === currentStep;
                            const isCompleted = getCurrentStepIndex() > index;
                            const StepIcon = step.icon;

                            return (
                                <div key={step.id} className="flex items-center">
                                    <div className={`
                                        flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300
                                        ${isActive ? 'bg-blue-500 border-blue-500 text-white' : 
                                          isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                                          'bg-gray-100 border-gray-300 text-gray-500'}
                                    `}>
                                        {isCompleted ? <Check size={16} /> : <StepIcon size={16} />}
                                    </div>
                                    <span className={`ml-2 text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                                        {step.title}
                                    </span>
                                    {index < steps.length - 1 && (
                                        <ChevronRight size={16} className="mx-2 text-gray-400" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Step Content */}
                <div className="mb-6 min-h-[400px]">
                    {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                        onClick={onCancel}
                        className="flex items-center space-x-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        <X size={16} />
                        <span>Cancel</span>
                    </button>

                    <div className="flex space-x-2">
                        {getCurrentStepIndex() > 0 && (
                            <button
                                onClick={prevStep}
                                className="flex items-center space-x-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                <ChevronLeft size={16} />
                                <span>Previous</span>
                            </button>
                        )}

                        {getCurrentStepIndex() < steps.length - 1 ? (
                            <button
                                onClick={nextStep}
                                className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                <span>Next</span>
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={completeFlow}
                                disabled={reconciliationRules.length === 0}
                                className="flex items-center space-x-1 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <Check size={16} />
                                <span>Start Reconciliation</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Regex Generator Modal */}
            {showAIRegexGenerator && (
                <AIRegexGenerator
                    sampleText={currentAIContext.sampleText}
                    columnName={currentAIContext.columnName}
                    onRegexGenerated={handleAIRegexGenerated}
                    onClose={() => setShowAIRegexGenerator(false)}
                />
            )}
        </>
    );
};

export default ReconciliationFlow;