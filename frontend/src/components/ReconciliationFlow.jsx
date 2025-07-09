import React, {useEffect, useState} from 'react';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Columns,
    FileText,
    Filter,
    Minus,
    Plus,
    Settings,
    Target,
    Wand2,
    X
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
    const [reconciliationRules, setReconciliationRules] = useState([]);
    const [fileColumns, setFileColumns] = useState({});
    const [showAIRegexGenerator, setShowAIRegexGenerator] = useState(false);
    const [currentAIContext, setCurrentAIContext] = useState({
        fileIndex: 0,
        ruleIndex: 0,
        sampleText: '',
        columnName: ''
    });

    // State for result column selection
    const [selectedColumnsFileA, setSelectedColumnsFileA] = useState([]);
    const [selectedColumnsFileB, setSelectedColumnsFileB] = useState([]);

    const steps = [
        {id: 'file_selection', title: 'File Selection', icon: FileText},
        {id: 'extraction_rules', title: 'Data Extraction', icon: Target},
        {id: 'filter_rules', title: 'Data Filtering', icon: Filter},
        {id: 'reconciliation_rules', title: 'Matching Rules', icon: Settings},
        {id: 'result_columns', title: 'Result Columns', icon: Columns},
        {id: 'review', title: 'Review & Confirm', icon: Check}
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

    // Get all available columns for a file (original + extracted)
    const getAllAvailableColumns = (fileIndex) => {
        const file = getFileByIndex(fileIndex);
        const originalColumns = fileColumns[file?.file_id] || [];
        const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(Boolean) || [];
        return [...originalColumns, ...extractedColumns];
    };

    // Get mandatory columns that must be included (extracted + reconciliation columns)
    const getMandatoryColumns = (fileIndex) => {
        const mandatoryColumns = new Set();

        // Add extracted columns - only if they have complete, non-empty names (minimum 3 characters to avoid partial typing)
        const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(name => name && name.trim().length >= 3) || [];
        extractedColumns.forEach(col => mandatoryColumns.add(col.trim()));

        // Add reconciliation rule columns - only if they have complete, non-empty names (minimum 3 characters)
        reconciliationRules.forEach(rule => {
            if (fileIndex === 0 && rule.LeftFileColumn && rule.LeftFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.LeftFileColumn.trim());
            } else if (fileIndex === 1 && rule.RightFileColumn && rule.RightFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.RightFileColumn.trim());
            }
        });

        return Array.from(mandatoryColumns);
    };

    // Get optional columns (all columns minus mandatory ones)
    const getOptionalColumns = (fileIndex) => {
        const allColumns = getAllAvailableColumns(fileIndex);
        const mandatoryColumns = getMandatoryColumns(fileIndex);
        return allColumns.filter(col => !mandatoryColumns.includes(col));
    };

    // Generate sample text for AI context
    const getSampleTextForColumn = (fileIndex, columnName) => {
        const file = getFileByIndex(fileIndex);
        if (!file || !file.sample_data || !columnName) return '';

        const sampleValues = file.sample_data
            .map(row => row[columnName])
            .filter(val => val && val.toString().trim())
            .slice(0, 3);

        return sampleValues.join(', ');
    };

    useEffect(() => {
        const filesArray = getSelectedFilesArray();
        if (filesArray.length >= 2) {
            setConfig({
                Files: filesArray.map((file, index) => ({
                    Name: `File${String.fromCharCode(65 + index)}`,
                    Extract: [],
                    Filter: []
                })),
                ReconciliationRules: []
            });

            const newFileColumns = {};
            filesArray.forEach((file, index) => {
                newFileColumns[file.file_id] = file.columns || [];
            });
            setFileColumns(newFileColumns);

            setSelectedColumnsFileA(newFileColumns[filesArray[0]?.file_id] || []);
            setSelectedColumnsFileB(newFileColumns[filesArray[1]?.file_id] || []);
        }
    }, [selectedFiles]);

    // Update selected columns when config or reconciliation rules change
    useEffect(() => {
        const updateSelectedColumns = (fileIndex) => {
            const mandatoryColumns = getMandatoryColumns(fileIndex);
            const currentSelected = fileIndex === 0 ? selectedColumnsFileA : selectedColumnsFileB;

            // Only include mandatory columns that are not empty/undefined and have at least 3 characters
            const validMandatoryColumns = mandatoryColumns.filter(col => col && col.trim().length >= 3);

            // Remove any partial names that might be incomplete versions of valid column names
            const cleanedCurrentSelection = currentSelected.filter(col => {
                // Keep the column if:
                // 1. It's a valid mandatory column, OR
                // 2. It's not a partial name of any mandatory column, OR
                // 3. It's from original file columns (not extracted)
                const originalColumns = fileColumns[getFileByIndex(fileIndex)?.file_id] || [];
                const isOriginalColumn = originalColumns.includes(col);
                const isValidMandatory = validMandatoryColumns.includes(col);

                // Check if this might be a partial name of a longer valid column
                const isPartialName = validMandatoryColumns.some(validCol =>
                    validCol !== col && validCol.startsWith(col) && col.length < validCol.length
                );

                return isValidMandatory || isOriginalColumn || !isPartialName;
            });

            // Merge cleaned selection with valid mandatory columns, removing duplicates
            const updatedSelection = [...new Set([...cleanedCurrentSelection, ...validMandatoryColumns])];

            if (fileIndex === 0) {
                setSelectedColumnsFileA(updatedSelection);
            } else {
                setSelectedColumnsFileB(updatedSelection);
            }
        };

        // Add a longer delay to allow for complete typing before updating mandatory columns
        const timeoutId = setTimeout(() => {
            updateSelectedColumns(0);
            updateSelectedColumns(1);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [config, reconciliationRules]);

    const nextStep = () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            const nextStepId = steps[currentIndex + 1].id;
            setCurrentStep(nextStepId);
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
            selected_columns_file_a: selectedColumnsFileA,
            selected_columns_file_b: selectedColumnsFileB,
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

    // Result column selection functions
    const toggleColumnSelection = (fileIndex, columnName) => {
        const mandatoryColumns = getMandatoryColumns(fileIndex);
        if (mandatoryColumns.includes(columnName)) {
            return;
        }

        if (fileIndex === 0) {
            setSelectedColumnsFileA(prev =>
                prev.includes(columnName)
                    ? prev.filter(col => col !== columnName)
                    : [...prev, columnName]
            );
        } else {
            setSelectedColumnsFileB(prev =>
                prev.includes(columnName)
                    ? prev.filter(col => col !== columnName)
                    : [...prev, columnName]
            );
        }
    };

    const selectAllColumns = (fileIndex) => {
        const allColumns = getAllAvailableColumns(fileIndex);
        if (fileIndex === 0) {
            setSelectedColumnsFileA(allColumns);
        } else {
            setSelectedColumnsFileB(allColumns);
        }
    };

    const deselectAllColumns = (fileIndex) => {
        const mandatoryColumns = getMandatoryColumns(fileIndex);
        if (fileIndex === 0) {
            setSelectedColumnsFileA(mandatoryColumns);
        } else {
            setSelectedColumnsFileB(mandatoryColumns);
        }
    };

    const addExtractionRule = (fileIndex) => {
        const newRule = {
            ResultColumnName: '',
            SourceColumn: '',
            MatchType: 'regex',
            Patterns: ['']
        };

        const updatedConfig = {...config};
        if (!updatedConfig.Files[fileIndex]) {
            updatedConfig.Files[fileIndex] = {Extract: [], Filter: []};
        }
        if (!updatedConfig.Files[fileIndex].Extract) {
            updatedConfig.Files[fileIndex].Extract = [];
        }
        updatedConfig.Files[fileIndex].Extract.push(newRule);
        setConfig(updatedConfig);
    };

    const updateExtractionRule = (fileIndex, ruleIndex, field, value) => {
        const updatedConfig = {...config};
        if (field === 'Patterns') {
            updatedConfig.Files[fileIndex].Extract[ruleIndex].Patterns = [value];
        } else {
            updatedConfig.Files[fileIndex].Extract[ruleIndex][field] = value;
        }
        setConfig(updatedConfig);
    };

    const removeExtractionRule = (fileIndex, ruleIndex) => {
        const updatedConfig = {...config};
        const removedColumnName = updatedConfig.Files[fileIndex].Extract[ruleIndex].ResultColumnName;
        updatedConfig.Files[fileIndex].Extract.splice(ruleIndex, 1);
        setConfig(updatedConfig);

        if (removedColumnName) {
            const isUsedInReconciliation = reconciliationRules.some(rule =>
                (fileIndex === 0 && rule.LeftFileColumn === removedColumnName) ||
                (fileIndex === 1 && rule.RightFileColumn === removedColumnName)
            );

            if (!isUsedInReconciliation) {
                if (fileIndex === 0) {
                    setSelectedColumnsFileA(prev => prev.filter(col => col !== removedColumnName));
                } else {
                    setSelectedColumnsFileB(prev => prev.filter(col => col !== removedColumnName));
                }
            }
        }
    };

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
        const {fileIndex, ruleIndex} = currentAIContext;
        updateExtractionRule(fileIndex, ruleIndex, 'Patterns', generatedRegex);
        updateExtractionRule(fileIndex, ruleIndex, 'MatchType', 'regex');
        onSendMessage('system', `✨ AI generated regex pattern applied to extraction rule`);
    };

    const addFilterRule = (fileIndex) => {
        const newRule = {
            ColumnName: '',
            MatchType: 'equals',
            Value: ''
        };

        const updatedConfig = {...config};
        if (!updatedConfig.Files[fileIndex]) {
            updatedConfig.Files[fileIndex] = {Extract: [], Filter: []};
        }
        if (!updatedConfig.Files[fileIndex].Filter) {
            updatedConfig.Files[fileIndex].Filter = [];
        }
        updatedConfig.Files[fileIndex].Filter.push(newRule);
        setConfig(updatedConfig);
    };

    const updateFilterRule = (fileIndex, ruleIndex, field, value) => {
        const updatedConfig = {...config};
        updatedConfig.Files[fileIndex].Filter[ruleIndex][field] = value;
        setConfig(updatedConfig);
    };

    const removeFilterRule = (fileIndex, ruleIndex) => {
        const updatedConfig = {...config};
        updatedConfig.Files[fileIndex].Filter.splice(ruleIndex, 1);
        setConfig(updatedConfig);
    };

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
                                    <div key={index}
                                         className={`p-4 border border-${colors[index]}-200 bg-${colors[index]}-50 rounded-lg`}>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <div
                                                className={`w-6 h-6 bg-${colors[index]}-500 rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                                                {letters[index]}
                                            </div>
                                            <span
                                                className={`font-medium text-${colors[index]}-800`}>{labels[index]}</span>
                                        </div>
                                        <div className={`text-sm text-${colors[index]}-700`}>
                                            <p className="font-medium">{file?.filename}</p>
                                            <p className="text-xs">{file?.total_rows} rows
                                                • {file?.columns?.length} columns</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                            <p>✅ Files are ready for reconciliation configuration. Click "Next" to proceed with data extraction rules.</p>
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
                                            <Plus size={14}/>
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
                                                            <Wand2 size={12}/>
                                                            <span>AI</span>
                                                        </button>
                                                    </div>
                                                </div>
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
                                                    <Minus size={14}/>
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
                                            <Plus size={14}/>
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
                                                    <Minus size={14}/>
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
                                    <Plus size={14}/>
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
                                                <Minus size={14}/>
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

            case 'result_columns':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Result Column Selection</h3>
                            <p className="text-sm text-gray-600">Choose which columns from each file should be included in the reconciliation results. Extracted columns and reconciliation rule columns are automatically included and cannot be deselected.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {/* File A Column Selection */}
                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
                                        <h4 className="text-md font-medium text-green-800">File A: {getFileByIndex(0)?.filename}</h4>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => selectAllColumns(0)}
                                            className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => deselectAllColumns(0)}
                                            className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                                            title="Deselects optional columns only"
                                        >
                                            Clear Optional
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {/* Mandatory Columns */}
                                    {getMandatoryColumns(0).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-green-700 mb-2">Required Columns (Auto-included):</div>
                                            {getMandatoryColumns(0).map(column => {
                                                const isExtracted = config.Files[0]?.Extract?.some(rule => rule.ResultColumnName === column);
                                                const isReconColumn = reconciliationRules.some(rule => rule.LeftFileColumn === column);
                                                return (
                                                    <label key={column} className="flex items-center space-x-2 text-sm opacity-75">
                                                        <input
                                                            type="checkbox"
                                                            checked={true}
                                                            disabled={true}
                                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-green-700">{column}</span>
                                                        <span className="text-xs text-green-500">
                                                            {isExtracted && isReconColumn ? '(extracted + reconciliation)' :
                                                                isExtracted ? '(extracted)' : '(reconciliation)'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                    {/* Optional Columns */}
                                    {getOptionalColumns(0).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-green-700 mb-2 mt-4">Optional Columns:</div>
                                            {getOptionalColumns(0).map(column => (
                                                <label key={column} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumnsFileA.includes(column)}
                                                        onChange={() => toggleColumnSelection(0, column)}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-green-700">{column}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-green-600">
                                    Selected: {selectedColumnsFileA.length} columns
                                    ({getMandatoryColumns(0).length} required + {selectedColumnsFileA.length - getMandatoryColumns(0).length} optional)
                                </div>
                            </div>

                            {/* File B Column Selection */}
                            <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">B</div>
                                        <h4 className="text-md font-medium text-purple-800">File B: {getFileByIndex(1)?.filename}</h4>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => selectAllColumns(1)}
                                            className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => deselectAllColumns(1)}
                                            className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                                            title="Deselects optional columns only"
                                        >
                                            Clear Optional
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {/* Mandatory Columns */}
                                    {getMandatoryColumns(1).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-purple-700 mb-2">Required Columns (Auto-included):</div>
                                            {getMandatoryColumns(1).map(column => {
                                                const isExtracted = config.Files[1]?.Extract?.some(rule => rule.ResultColumnName === column);
                                                const isReconColumn = reconciliationRules.some(rule => rule.RightFileColumn === column);
                                                return (
                                                    <label key={column} className="flex items-center space-x-2 text-sm opacity-75">
                                                        <input
                                                            type="checkbox"
                                                            checked={true}
                                                            disabled={true}
                                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <span className="text-purple-700">{column}</span>
                                                        <span className="text-xs text-purple-500">
                                                            {isExtracted && isReconColumn ? '(extracted + reconciliation)' :
                                                                isExtracted ? '(extracted)' : '(reconciliation)'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                    {/* Optional Columns */}
                                    {getOptionalColumns(1).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-purple-700 mb-2 mt-4">Optional Columns:</div>
                                            {getOptionalColumns(1).map(column => (
                                                <label key={column} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumnsFileB.includes(column)}
                                                        onChange={() => toggleColumnSelection(1, column)}
                                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-purple-700">{column}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-purple-600">
                                    Selected: {selectedColumnsFileB.length} columns
                                    ({getMandatoryColumns(1).length} required + {selectedColumnsFileB.length - getMandatoryColumns(1).length} optional)
                                </div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                            <p><strong>Note:</strong> Extracted columns and reconciliation rule columns are automatically included and cannot be deselected. You can select additional optional columns to include in the results. Selected columns will be prefixed with "FileA_" or "FileB_" in the reconciliation output.</p>
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

                        {/* Result Column Selection Summary */}
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Result Column Selection</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-indigo-700">File A Columns:</span>
                                    <div className="ml-2 text-xs">
                                        <div className="text-indigo-600 mb-1">
                                            <strong>Required ({getMandatoryColumns(0).length}):</strong>
                                            {getMandatoryColumns(0).length > 0 ? (
                                                <ul className="ml-2">
                                                    {getMandatoryColumns(0).slice(0, 3).map(col => (
                                                        <li key={col}>• {col}</li>))}
                                                    {getMandatoryColumns(0).length > 3 && (
                                                        <li className="text-indigo-500">... and {getMandatoryColumns(0).length - 3} more</li>
                                                    )}
                                                </ul>
                                            ) : (<span className="ml-2">None</span>)}
                                        </div>
                                        <div className="text-indigo-600">
                                            <strong>Optional ({selectedColumnsFileA.length - getMandatoryColumns(0).length}):</strong>
                                            {selectedColumnsFileA.length - getMandatoryColumns(0).length > 0 ? (
                                                <ul className="ml-2">
                                                    {getOptionalColumns(0).filter(col => selectedColumnsFileA.includes(col)).slice(0, 3).map(col => (
                                                        <li key={col}>• {col}</li>
                                                    ))}
                                                    {(selectedColumnsFileA.length - getMandatoryColumns(0).length) > 3 && (
                                                        <li className="text-indigo-500">... and {(selectedColumnsFileA.length - getMandatoryColumns(0).length) - 3} more</li>
                                                    )}
                                                </ul>
                                            ) : (<span className="ml-2">None selected</span>)}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span className="font-medium text-indigo-700">File B Columns:</span>
                                    <div className="ml-2 text-xs">
                                        <div className="text-indigo-600 mb-1">
                                            <strong>Required ({getMandatoryColumns(1).length}):</strong>
                                            {getMandatoryColumns(1).length > 0 ? (
                                                <ul className="ml-2">
                                                    {getMandatoryColumns(1).slice(0, 3).map(col => (
                                                        <li key={col}>• {col}</li>))}
                                                    {getMandatoryColumns(1).length > 3 && (
                                                        <li className="text-indigo-500">... and {getMandatoryColumns(1).length - 3} more</li>
                                                    )}
                                                </ul>
                                            ) : (<span className="ml-2">None</span>)}
                                        </div>
                                        <div className="text-indigo-600">
                                            <strong>Optional ({selectedColumnsFileB.length - getMandatoryColumns(1).length}):</strong>
                                            {selectedColumnsFileB.length - getMandatoryColumns(1).length > 0 ? (
                                                <ul className="ml-2">
                                                    {getOptionalColumns(1).filter(col => selectedColumnsFileB.includes(col)).slice(0, 3).map(col => (
                                                        <li key={col}>• {col}</li>
                                                    ))}
                                                    {(selectedColumnsFileB.length - getMandatoryColumns(1).length) > 3 && (
                                                        <li className="text-indigo-500">... and {(selectedColumnsFileB.length - getMandatoryColumns(1).length) - 3} more</li>
                                                    )}
                                                </ul>
                                            ) : (<span className="ml-2">None selected</span>)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Validation */}
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-2">Configuration Status</h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center space-x-2">
                                    <Check size={16} className="text-green-500"/>
                                    <span>Files selected</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {reconciliationRules.length > 0 ? (
                                        <Check size={16} className="text-green-500"/>
                                    ) : (
                                        <AlertCircle size={16} className="text-yellow-500"/>
                                    )}
                                    <span>Reconciliation rules {reconciliationRules.length > 0 ? 'configured' : 'needed'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Check size={16} className="text-green-500"/>
                                    <span>Result column selection configured</span>
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
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                                        isActive ? 'bg-blue-500 border-blue-500 text-white' :
                                            isCompleted ? 'bg-green-500 border-green-500 text-white' :
                                                'bg-gray-100 border-gray-300 text-gray-500'
                                    }`}>
                                        {isCompleted ? <Check size={16}/> : <StepIcon size={16}/>}
                                    </div>
                                    <span className={`ml-2 text-sm font-medium ${
                                        isActive ? 'text-blue-600' :
                                            isCompleted ? 'text-green-600' :
                                                'text-gray-500'
                                    }`}>
                                        {step.title}
                                    </span>
                                    {index < steps.length - 1 && (
                                        <ChevronRight size={16} className="mx-2 text-gray-400"/>
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
                        <X size={16}/>
                        <span>Cancel</span>
                    </button>

                    <div className="flex space-x-2">
                        {getCurrentStepIndex() > 0 && (
                            <button
                                onClick={prevStep}
                                className="flex items-center space-x-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                <ChevronLeft size={16}/>
                                <span>Previous</span>
                            </button>
                        )}

                        {getCurrentStepIndex() < steps.length - 1 ? (
                            <button
                                onClick={nextStep}
                                className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                <span>Next</span>
                                <ChevronRight size={16}/>
                            </button>
                        ) : (
                            <button
                                onClick={completeFlow}
                                disabled={reconciliationRules.length === 0}
                                className="flex items-center space-x-1 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <Check size={16}/>
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