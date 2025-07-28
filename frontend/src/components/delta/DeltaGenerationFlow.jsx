import React, {useEffect, useState} from 'react';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Columns,
    FileText,
    Filter,
    GitCompare,
    Key,
    Minus,
    Plus,
    Save,
    Upload,
    X
} from 'lucide-react';
import DeltaRuleSaveLoad from './DeltaRuleSaveLoad.jsx';
import FilterDataStep from './FilterDataStep.jsx';

const DeltaGenerationFlow = ({
                                 files,
                                 selectedFiles,
                                 selectedTemplate,
                                 flowData,
                                 onComplete,
                                 onCancel,
                                 onSendMessage
                             }) => {
    const [currentStep, setCurrentStep] = useState('rule_management');
    const [config, setConfig] = useState({
        Files: [],
        KeyRules: [],
        ComparisonRules: []
    });
    const [keyRules, setKeyRules] = useState([]);
    const [comparisonRules, setComparisonRules] = useState([]);
    const [fileColumns, setFileColumns] = useState({});

    // Filter state
    const [fileFilters, setFileFilters] = useState({
        file_0: [], // Filters for older file
        file_1: []  // Filters for newer file
    });

    // State for result column selection
    const [selectedColumnsFileA, setSelectedColumnsFileA] = useState([]);
    const [selectedColumnsFileB, setSelectedColumnsFileB] = useState([]);

    // Rule Management State
    const [showRuleSaveLoad, setShowRuleSaveLoad] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [loadedRuleId, setLoadedRuleId] = useState(null);

    const steps = [
        {id: 'rule_management', title: 'Load/Save Rules', icon: Save},
        {id: 'file_selection', title: 'File Selection', icon: FileText},
        {id: 'filter_data', title: 'Filter Data', icon: Filter},
        {id: 'key_rules', title: 'Key Fields (Composite)', icon: Key},
        {id: 'comparison_rules', title: 'Optional Fields', icon: GitCompare},
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

    // Get all available columns for a file
    const getAllAvailableColumns = (fileIndex) => {
        const file = getFileByIndex(fileIndex);
        return fileColumns[file?.file_id] || [];
    };

    // Get mandatory columns that must be included (key + comparison columns)
    const getMandatoryColumns = (fileIndex) => {
        const mandatoryColumns = new Set();

        // Add key columns
        keyRules.forEach(rule => {
            if (fileIndex === 0 && rule.LeftFileColumn && rule.LeftFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.LeftFileColumn.trim());
            } else if (fileIndex === 1 && rule.RightFileColumn && rule.RightFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.RightFileColumn.trim());
            }
        });

        // Add comparison columns
        comparisonRules.forEach(rule => {
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

    useEffect(() => {
        const filesArray = getSelectedFilesArray();
        if (filesArray.length >= 2) {
            setConfig({
                Files: filesArray.map((file, index) => ({
                    Name: `File${String.fromCharCode(65 + index)}`,
                    Extract: [],
                    Filter: []
                })),
                KeyRules: [],
                ComparisonRules: []
            });

            const newFileColumns = {};
            filesArray.forEach((file, index) => {
                newFileColumns[file.file_id] = file.columns || [];
            });
            setFileColumns(newFileColumns);

            setSelectedColumnsFileA(newFileColumns[filesArray[0]?.file_id] || []);
            setSelectedColumnsFileB(newFileColumns[filesArray[1]?.file_id] || []);

            // Initialize empty filters for both files
            setFileFilters({
                file_0: [],
                file_1: []
            });
        }
    }, [selectedFiles]);

    // Update selected columns when rules change
    useEffect(() => {
        const updateSelectedColumns = (fileIndex) => {
            const mandatoryColumns = getMandatoryColumns(fileIndex);
            const currentSelected = fileIndex === 0 ? selectedColumnsFileA : selectedColumnsFileB;

            const validMandatoryColumns = mandatoryColumns.filter(col => col && col.trim().length >= 3);

            const cleanedCurrentSelection = currentSelected.filter(col => {
                const originalColumns = fileColumns[getFileByIndex(fileIndex)?.file_id] || [];
                const isOriginalColumn = originalColumns.includes(col);
                const isValidMandatory = validMandatoryColumns.includes(col);

                const isPartialName = validMandatoryColumns.some(validCol =>
                    validCol !== col && validCol.startsWith(col) && col.length < validCol.length
                );

                return isValidMandatory || isOriginalColumn || !isPartialName;
            });

            const updatedSelection = [...new Set([...cleanedCurrentSelection, ...validMandatoryColumns])];

            if (fileIndex === 0) {
                setSelectedColumnsFileA(updatedSelection);
            } else {
                setSelectedColumnsFileB(updatedSelection);
            }
        };

        const timeoutId = setTimeout(() => {
            updateSelectedColumns(0);
            updateSelectedColumns(1);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [keyRules, comparisonRules]);

    // Track unsaved changes
    useEffect(() => {
        if (loadedRuleId) {
            setHasUnsavedChanges(true);
        }
    }, [keyRules, comparisonRules, selectedColumnsFileA, selectedColumnsFileB]);

    // Rule management handlers
    const handleRuleLoaded = (rule, adaptedConfig, warnings) => {
        setConfig({
            Files: adaptedConfig.Files || [],
            KeyRules: adaptedConfig.KeyRules || [],
            ComparisonRules: adaptedConfig.ComparisonRules || []
        });
        setKeyRules(adaptedConfig.KeyRules || []);
        setComparisonRules(adaptedConfig.ComparisonRules || []);
        setSelectedColumnsFileA(adaptedConfig.selected_columns_file_a || []);
        setSelectedColumnsFileB(adaptedConfig.selected_columns_file_b || []);
        setLoadedRuleId(rule.id);
        setHasUnsavedChanges(false);

        if (warnings && warnings.length > 0) {
            onSendMessage('system', `⚠️ Delta rule loaded with warnings:\n${warnings.join('\n')}\n\nPlease review and update the configuration as needed.`);
        } else {
            onSendMessage('system', `✅ Delta rule "${rule.name}" loaded successfully!`);
        }

        setTimeout(() => {
            setCurrentStep('file_selection');
        }, 1000);
    };

    const handleRuleSaved = (savedRule) => {
        setLoadedRuleId(savedRule.id);
        setHasUnsavedChanges(false);
        onSendMessage('system', `✅ Delta rule "${savedRule.name}" saved successfully!`);
    };

    const getCurrentRuleConfig = () => {
        return {
            Files: config.Files,
            KeyRules: keyRules,
            ComparisonRules: comparisonRules,
            selected_columns_file_a: selectedColumnsFileA,
            selected_columns_file_b: selectedColumnsFileB,
            user_requirements: 'Generate delta between older and newer files using configured key and comparison rules'
        };
    };

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
            process_type: 'delta-generation',
            process_name: 'Delta Generation',
            user_requirements: `Generate delta between older and newer files using configured key and comparison rules`,
            files: getSelectedFilesArray().map((file, index) => ({
                file_id: file.file_id,
                role: `file_${index}`,
                label: index === 0 ? 'Older File' : 'Newer File'
            })),
            delta_config: {
                Files: config.Files,
                KeyRules: keyRules,
                ComparisonRules: comparisonRules,
                selected_columns_file_a: selectedColumnsFileA,
                selected_columns_file_b: selectedColumnsFileB,
                file_filters: fileFilters, // Include filters in config
                user_requirements: `Generate delta between older and newer files using configured key and comparison rules`,
                files: getSelectedFilesArray().map((file, index) => ({
                    file_id: file.file_id,
                    role: `file_${index}`,
                    label: index === 0 ? 'Older File' : 'Newer File'
                }))
            }
        };

        onSendMessage('system', '🎉 Delta generation configuration completed! Starting process...');
        onComplete(finalConfig);
    };

    // Key rules management
    const addKeyRule = () => {
        const newRule = {
            LeftFileColumn: '',
            RightFileColumn: '',
            MatchType: 'equals',
            ToleranceValue: null,
            IsKey: true
        };
        setKeyRules([...keyRules, newRule]);
    };

    const updateKeyRule = (ruleIndex, field, value) => {
        const updatedRules = [...keyRules];
        if (field === 'ToleranceValue') {
            updatedRules[ruleIndex][field] = value ? parseFloat(value) : null;
        } else {
            updatedRules[ruleIndex][field] = value;
        }
        setKeyRules(updatedRules);
    };

    const removeKeyRule = (ruleIndex) => {
        const updatedRules = keyRules.filter((_, index) => index !== ruleIndex);
        setKeyRules(updatedRules);
    };

    // Comparison rules management
    const addComparisonRule = () => {
        const newRule = {
            LeftFileColumn: '',
            RightFileColumn: '',
            MatchType: 'equals',
            ToleranceValue: null,
            IsKey: false
        };
        setComparisonRules([...comparisonRules, newRule]);
    };

    const updateComparisonRule = (ruleIndex, field, value) => {
        const updatedRules = [...comparisonRules];
        if (field === 'ToleranceValue') {
            updatedRules[ruleIndex][field] = value ? parseFloat(value) : null;
        } else {
            updatedRules[ruleIndex][field] = value;
        }
        setComparisonRules(updatedRules);
    };

    const removeComparisonRule = (ruleIndex) => {
        const updatedRules = comparisonRules.filter((_, index) => index !== ruleIndex);
        setComparisonRules(updatedRules);
    };

    // Filter management functions
    const addFilter = (fileKey) => {
        const newFilter = {
            column: '',
            values: []
        };
        setFileFilters(prev => ({
            ...prev,
            [fileKey]: [...prev[fileKey], newFilter]
        }));
    };

    const updateFilter = (fileKey, filterIndex, field, value) => {
        setFileFilters(prev => ({
            ...prev,
            [fileKey]: prev[fileKey].map((filter, index) =>
                index === filterIndex ? {...filter, [field]: value} : filter
            )
        }));
    };

    const removeFilter = (fileKey, filterIndex) => {
        setFileFilters(prev => ({
            ...prev,
            [fileKey]: prev[fileKey].filter((_, index) => index !== filterIndex)
        }));
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

    const renderStepContent = () => {
        const filesArray = getSelectedFilesArray();

        switch (currentStep) {
            case 'rule_management':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Load Existing Rule or Start Fresh</h3>
                        <p className="text-sm text-gray-600">
                            You can load a previously saved delta generation rule to reuse your configuration,
                            or start fresh with a new configuration.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Upload size={20} className="text-blue-600"/>
                                    <h4 className="text-md font-medium text-blue-800">Load Existing Rule</h4>
                                </div>
                                <p className="text-sm text-blue-700 mb-4">
                                    Load a previously saved delta rule template and adapt it to your current files.
                                </p>
                                <button
                                    onClick={() => setShowRuleSaveLoad(true)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    <Upload size={16}/>
                                    <span>Browse Saved Rules</span>
                                </button>
                            </div>

                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-3">
                                    <FileText size={20} className="text-green-600"/>
                                    <h4 className="text-md font-medium text-green-800">Start Fresh</h4>
                                </div>
                                <p className="text-sm text-green-700 mb-4">
                                    Create a new delta generation configuration from scratch.
                                </p>
                                <button
                                    onClick={() => nextStep()}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    <FileText size={16}/>
                                    <span>Start New Configuration</span>
                                </button>
                            </div>
                        </div>

                        {loadedRuleId && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Check size={16} className="text-yellow-600"/>
                                        <span className="text-sm text-yellow-800">
                                            Delta rule loaded. {hasUnsavedChanges ? 'You have unsaved changes.' : 'No changes made.'}
                                        </span>
                                    </div>
                                    {hasUnsavedChanges && (
                                        <button
                                            onClick={() => setShowRuleSaveLoad(true)}
                                            className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                        >
                                            Save Changes
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'file_selection':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Selected Files for Delta Generation</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {filesArray.slice(0, 2).map((file, index) => {
                                const colors = ['blue', 'green'];
                                const labels = ['Older File (FileA)', 'Newer File (FileB)'];
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
                            <p>✅ Files are ready for delta generation. The system will:</p>
                            <ul className="mt-2 ml-4 list-disc space-y-1">
                                <li><strong>Identify Unchanged:</strong> Records with same keys and same optional fields
                                </li>
                                <li><strong>Identify Amended:</strong> Records with same keys but different optional
                                    fields
                                </li>
                                <li><strong>Identify Deleted:</strong> Records in Older File but not in Newer File</li>
                                <li><strong>Identify New:</strong> Records in Newer File but not in Older File</li>
                            </ul>
                        </div>
                    </div>
                );

            case 'filter_data':
                return (

                    <FilterDataStep
                        filesArray={filesArray}
                        fileFilters={fileFilters}
                        addFilter={addFilter}
                        updateFilter={updateFilter}
                        removeFilter={removeFilter}
                        fileColumns={fileColumns}
                    />
                );

            case 'key_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Key Fields (Composite Key)</h3>
                            <p className="text-sm text-gray-600">Define the key fields that uniquely identify records
                                for matching between files. These form a composite key.</p>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-md font-medium text-gray-800">Key Matching Rules</h4>
                                <button
                                    onClick={addKeyRule}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                    <Plus size={14}/>
                                    <span>Add Key Rule</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {keyRules.map((rule, ruleIndex) => {
                                    const fileA = getFileByIndex(0);
                                    const fileB = getFileByIndex(1);
                                    const columnsA = fileColumns[fileA?.file_id] || [];
                                    const columnsB = fileColumns[fileB?.file_id] || [];

                                    return (
                                        <div key={ruleIndex} className="p-3 bg-blue-50 rounded border border-blue-200">
                                            <div className="grid grid-cols-4 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Older
                                                        File Column</label>
                                                    <select
                                                        value={rule.LeftFileColumn || ''}
                                                        onChange={(e) => updateKeyRule(ruleIndex, 'LeftFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {columnsA.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Newer
                                                        File Column</label>
                                                    <select
                                                        value={rule.RightFileColumn || ''}
                                                        onChange={(e) => updateKeyRule(ruleIndex, 'RightFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {columnsB.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Match
                                                        Type</label>
                                                    <select
                                                        value={rule.MatchType || 'equals'}
                                                        onChange={(e) => updateKeyRule(ruleIndex, 'MatchType', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="equals">Exact Match</option>
                                                        <option value="case_insensitive">Case Insensitive</option>
                                                        <option value="numeric_tolerance">Numeric Tolerance</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Tolerance
                                                        %</label>
                                                    <input
                                                        type="number"
                                                        value={rule.ToleranceValue || ''}
                                                        onChange={(e) => updateKeyRule(ruleIndex, 'ToleranceValue', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="0"
                                                        disabled={rule.MatchType !== 'numeric_tolerance'}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeKeyRule(ruleIndex)}
                                                className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                            >
                                                <Minus size={14}/>
                                                <span>Remove Key Rule</span>
                                            </button>
                                        </div>
                                    );
                                })}
                                {keyRules.length === 0 && (
                                    <div className="text-center text-gray-500 py-4">
                                        <Key size={32} className="mx-auto mb-2 opacity-50"/>
                                        <p className="text-sm">No key rules defined yet.</p>
                                        <p className="text-xs">Add key rules to define how records should be matched
                                            between files.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <p><strong>Key Rules Purpose:</strong></p>
                            <ul className="mt-1 ml-4 list-disc space-y-1">
                                <li>Define composite key for unique record identification</li>
                                <li>Records are matched between files using these key fields</li>
                                <li>All key rules must match for records to be considered the same</li>
                            </ul>
                        </div>
                    </div>
                );

            case 'comparison_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Optional Fields (Comparison Rules)</h3>
                            <p className="text-sm text-gray-600">Define fields to compare for detecting amendments.
                                Records with matching keys but different optional fields will be marked as
                                "Amended".</p>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-md font-medium text-gray-800">Comparison Rules</h4>
                                <button
                                    onClick={addComparisonRule}
                                    className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                >
                                    <Plus size={14}/>
                                    <span>Add Comparison Rule</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {comparisonRules.map((rule, ruleIndex) => {
                                    const fileA = getFileByIndex(0);
                                    const fileB = getFileByIndex(1);
                                    const columnsA = fileColumns[fileA?.file_id] || [];
                                    const columnsB = fileColumns[fileB?.file_id] || [];

                                    return (
                                        <div key={ruleIndex}
                                             className="p-3 bg-green-50 rounded border border-green-200">
                                            <div className="grid grid-cols-4 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Older
                                                        File Column</label>
                                                    <select
                                                        value={rule.LeftFileColumn || ''}
                                                        onChange={(e) => updateComparisonRule(ruleIndex, 'LeftFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {columnsA.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Newer
                                                        File Column</label>
                                                    <select
                                                        value={rule.RightFileColumn || ''}
                                                        onChange={(e) => updateComparisonRule(ruleIndex, 'RightFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {columnsB.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Match
                                                        Type</label>
                                                    <select
                                                        value={rule.MatchType || 'equals'}
                                                        onChange={(e) => updateComparisonRule(ruleIndex, 'MatchType', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                                    >
                                                        <option value="equals">Exact Match</option>
                                                        <option value="case_insensitive">Case Insensitive</option>
                                                        <option value="numeric_tolerance">Numeric Tolerance</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Tolerance
                                                        %</label>
                                                    <input
                                                        type="number"
                                                        value={rule.ToleranceValue || ''}
                                                        onChange={(e) => updateComparisonRule(ruleIndex, 'ToleranceValue', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                                        placeholder="0"
                                                        disabled={rule.MatchType !== 'numeric_tolerance'}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeComparisonRule(ruleIndex)}
                                                className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                            >
                                                <Minus size={14}/>
                                                <span>Remove Comparison Rule</span>
                                            </button>
                                        </div>
                                    );
                                })}
                                {comparisonRules.length === 0 && (
                                    <div className="text-center text-gray-500 py-4">
                                        <GitCompare size={32} className="mx-auto mb-2 opacity-50"/>
                                        <p className="text-sm">No comparison rules defined yet.</p>
                                        <p className="text-xs">Optional: Add rules to compare specific fields for
                                            amendments.</p>
                                        <p className="text-xs mt-1 text-yellow-600">If no comparison rules are defined,
                                            records with matching keys will be considered "Unchanged".</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
                            <p><strong>How it works:</strong></p>
                            <ul className="mt-1 ml-4 list-disc space-y-1">
                                <li>Records with matching keys are compared using these rules</li>
                                <li>If any comparison rule fails, the record is marked as "Amended"</li>
                                <li>If all comparison rules pass (or none defined), the record is "Unchanged"</li>
                            </ul>
                        </div>
                    </div>
                );

            case 'result_columns':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Result Column Selection</h3>
                            <p className="text-sm text-gray-600">Choose which columns from each file should be included
                                in the delta results. Key and comparison rule columns are automatically included.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {/* File A Column Selection */}
                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A
                                        </div>
                                        <h4 className="text-md font-medium text-blue-800">Older
                                            File: {getFileByIndex(0)?.filename}</h4>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => selectAllColumns(0)}
                                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
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
                                            <div className="text-xs font-medium text-blue-700 mb-2">Required Columns
                                                (Auto-included):
                                            </div>
                                            {getMandatoryColumns(0).map(column => {
                                                const isKeyColumn = keyRules.some(rule => rule.LeftFileColumn === column);
                                                const isComparisonColumn = comparisonRules.some(rule => rule.LeftFileColumn === column);
                                                return (
                                                    <label key={column}
                                                           className="flex items-center space-x-2 text-sm opacity-75">
                                                        <input
                                                            type="checkbox"
                                                            checked={true}
                                                            disabled={true}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-blue-700">{column}</span>
                                                        <span className="text-xs text-blue-500">
                                                            {isKeyColumn && isComparisonColumn ? '(key + comparison)' :
                                                                isKeyColumn ? '(key)' : '(comparison)'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                    {/* Optional Columns */}
                                    {getOptionalColumns(0).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-blue-700 mb-2 mt-4">Optional
                                                Columns:
                                            </div>
                                            {getOptionalColumns(0).map(column => (
                                                <label key={column} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumnsFileA.includes(column)}
                                                        onChange={() => toggleColumnSelection(0, column)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-blue-700">{column}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-blue-600">
                                    Selected: {selectedColumnsFileA.length} columns
                                    ({getMandatoryColumns(0).length} required
                                    + {selectedColumnsFileA.length - getMandatoryColumns(0).length} optional)
                                </div>
                            </div>

                            {/* File B Column Selection */}
                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">B
                                        </div>
                                        <h4 className="text-md font-medium text-green-800">Newer
                                            File: {getFileByIndex(1)?.filename}</h4>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => selectAllColumns(1)}
                                            className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
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
                                            <div className="text-xs font-medium text-green-700 mb-2">Required Columns
                                                (Auto-included):
                                            </div>
                                            {getMandatoryColumns(1).map(column => {
                                                const isKeyColumn = keyRules.some(rule => rule.RightFileColumn === column);
                                                const isComparisonColumn = comparisonRules.some(rule => rule.RightFileColumn === column);
                                                return (
                                                    <label key={column}
                                                           className="flex items-center space-x-2 text-sm opacity-75">
                                                        <input
                                                            type="checkbox"
                                                            checked={true}
                                                            disabled={true}
                                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-green-700">{column}</span>
                                                        <span className="text-xs text-green-500">
                                                            {isKeyColumn && isComparisonColumn ? '(key + comparison)' :
                                                                isKeyColumn ? '(key)' : '(comparison)'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                    {/* Optional Columns */}
                                    {getOptionalColumns(1).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-green-700 mb-2 mt-4">Optional
                                                Columns:
                                            </div>
                                            {getOptionalColumns(1).map(column => (
                                                <label key={column} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumnsFileB.includes(column)}
                                                        onChange={() => toggleColumnSelection(1, column)}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-green-700">{column}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-green-600">
                                    Selected: {selectedColumnsFileB.length} columns
                                    ({getMandatoryColumns(1).length} required
                                    + {selectedColumnsFileB.length - getMandatoryColumns(1).length} optional)
                                </div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                            <p><strong>Note:</strong> Key and comparison rule columns are automatically included and
                                cannot be deselected. Selected columns will be prefixed with "FileA_" or "FileB_" in the
                                delta output.</p>
                        </div>
                    </div>
                );

            case 'review':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Review Delta Configuration</h3>
                            <p className="text-sm text-gray-600">Review your delta generation configuration before
                                proceeding.</p>
                        </div>

                        {/* Files Summary */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-800 mb-2">Files Selected</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {filesArray.slice(0, 2).map((file, index) => (
                                    <div key={index}>
                                        <span
                                            className="font-medium">{index === 0 ? 'Older File (A)' : 'Newer File (B)'}:</span> {file?.filename}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Filters Summary */}
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h4 className="font-medium text-purple-800 mb-2">Data Filters</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {['file_0', 'file_1'].map((fileKey, index) => {
                                    const filters = fileFilters[fileKey] || [];
                                    const activeFilters = filters.filter(f => f.column && f.values && f.values.length > 0);

                                    return (
                                        <div key={fileKey}>
                                            <span className="font-medium text-purple-700">
                                                {index === 0 ? 'Older File' : 'Newer File'} Filters:
                                            </span>
                                            {activeFilters.length > 0 ? (
                                                <ul className="ml-2 text-xs">
                                                    {activeFilters.map((filter, filterIndex) => (
                                                        <li key={filterIndex} className="text-purple-600">
                                                            • {filter.column}: {filter.values.length} value{filter.values.length !== 1 ? 's' : ''}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="ml-2 text-xs text-purple-500">No filters applied</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Key Rules Summary */}
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Key Rules (Composite Key)</h4>
                            <div className="space-y-2 text-sm">
                                {keyRules.length > 0 ? (
                                    <ul className="space-y-1">
                                        {keyRules.map((rule, index) => (
                                            <li key={index} className="text-xs">
                                                Key {index + 1}: "{rule.LeftFileColumn}" matches "{rule.RightFileColumn}"
                                                using {rule.MatchType}
                                                {rule.MatchType === 'numeric_tolerance' && rule.ToleranceValue && ` (tolerance: ${rule.ToleranceValue}%)`}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-xs text-red-500">⚠️ No key rules defined - Required for delta generation</span>
                                )}
                            </div>
                        </div>

                        {/* Comparison Rules Summary */}
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-medium text-green-800 mb-2">Comparison Rules (Optional Fields)</h4>
                            <div className="space-y-2 text-sm">
                                {comparisonRules.length > 0 ? (
                                    <ul className="space-y-1">
                                        {comparisonRules.map((rule, index) => (
                                            <li key={index} className="text-xs">
                                                Compare "{rule.LeftFileColumn}" with "{rule.RightFileColumn}"
                                                using {rule.MatchType}
                                                {rule.MatchType === 'numeric_tolerance' && rule.ToleranceValue && ` (tolerance: ${rule.ToleranceValue}%)`}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-xs text-gray-500">No comparison rules defined - Records with matching keys will be considered "Unchanged"</span>
                                )}
                            </div>
                        </div>

                        {/* Delta Logic Summary */}
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="font-medium text-yellow-800 mb-2">Delta Generation Logic</h4>
                            <div className="text-xs space-y-1">
                                <p><strong>🔑 Key Matching:</strong> Records are matched using composite key
                                    from {keyRules.length} key rule{keyRules.length !== 1 ? 's' : ''}</p>
                                <p><strong>🔍 Filtering:</strong> {
                                    (() => {
                                        const totalFilters = (fileFilters.file_0?.filter(f => f.column && f.values?.length > 0)?.length || 0) +
                                            (fileFilters.file_1?.filter(f => f.column && f.values?.length > 0)?.length || 0);
                                        return totalFilters > 0 ? `${totalFilters} filter${totalFilters !== 1 ? 's' : ''} will be applied during processing` : 'No filters applied';
                                    })()
                                }</p>
                                <p><strong>📊
                                    Comparison:</strong> {comparisonRules.length > 0 ? `${comparisonRules.length} field${comparisonRules.length !== 1 ? 's' : ''} will be compared for amendments` : 'No field comparison - matching keys = unchanged'}
                                </p>
                                <p><strong>📈 Output Categories:</strong></p>
                                <ul className="ml-4 list-disc">
                                    <li><strong>UNCHANGED:</strong> Same keys + same optional fields</li>
                                    <li><strong>AMENDED:</strong> Same keys + different optional fields</li>
                                    <li><strong>DELETED:</strong> Present in older file only</li>
                                    <li><strong>NEWLY_ADDED:</strong> Present in newer file only</li>
                                </ul>
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
                                    <Check size={16} className="text-green-500"/>
                                    <span>Filters configured</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {keyRules.length > 0 ? (
                                        <Check size={16} className="text-green-500"/>
                                    ) : (
                                        <AlertCircle size={16} className="text-red-500"/>
                                    )}
                                    <span>Key rules {keyRules.length > 0 ? 'configured' : 'required'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Check size={16} className="text-green-500"/>
                                    <span>Result column selection configured</span>
                                </div>
                            </div>
                        </div>

                        {/* Save Rule Option */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-blue-800">Save This Configuration</h4>
                                <button
                                    onClick={() => setShowRuleSaveLoad(true)}
                                    disabled={keyRules.length === 0}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                                >
                                    <Save size={14}/>
                                    <span>{loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Save as New Rule'}</span>
                                </button>
                            </div>
                            <p className="text-sm text-blue-700">
                                Save this configuration as a reusable delta rule template for future use.
                                {loadedRuleId && hasUnsavedChanges && ' You have unsaved changes to the loaded rule.'}
                            </p>
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
                                    <div
                                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
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
                                disabled={keyRules.length === 0}
                                className="flex items-center space-x-1 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <Check size={16}/>
                                <span>Start Delta Generation</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* DeltaRuleSaveLoad Modal */}
            {showRuleSaveLoad && (
                <DeltaRuleSaveLoad
                    selectedTemplate={selectedTemplate}
                    currentConfig={getCurrentRuleConfig()}
                    fileColumns={fileColumns}
                    loadedRuleId={loadedRuleId}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onRuleLoaded={handleRuleLoaded}
                    onRuleSaved={handleRuleSaved}
                    onClose={() => setShowRuleSaveLoad(false)}
                />
            )}
        </>
    );
};
export default DeltaGenerationFlow;