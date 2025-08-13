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
    Save,
    Settings,
    Target,
    Upload,
    Wand2,
    X
} from 'lucide-react';
import AIRegexGenerator from '../core/AIRegexGenerator.jsx';
import RuleSaveLoad from '../rules/RuleSaveLoad.jsx';
import IntegratedFilterDataStep from "./IntegratedFilterDataStep.jsx";
import AIRequirementsStep from '../reconciliation/AIRequirementsStep.jsx';
import ReconciliationPreviewStep from './ReconciliationPreviewStep.jsx';
import { aiAssistanceService } from '../../services/aiAssistanceService.js';
import { processManagementService } from '../../services/processManagementService.js';

const ReconciliationFlow = ({
                                files,
                                selectedFiles,
                                selectedTemplate,
                                flowData,
                                onComplete,
                                onCancel,
                                onSendMessage
                            }) => {
    // State management
    const [currentStep, setCurrentStep] = useState('rule_management');
    const [config, setConfig] = useState({
        Files: [],
        ReconciliationRules: []
    });
    const [reconciliationRules, setReconciliationRules] = useState([]);
    const [fileColumns, setFileColumns] = useState({});
    const [selectedColumnsFileA, setSelectedColumnsFileA] = useState([]);
    const [selectedColumnsFileB, setSelectedColumnsFileB] = useState([]);

    // AI and Rule Management State
    const [showAIRegexGenerator, setShowAIRegexGenerator] = useState(false);
    const [showRuleSaveLoad, setShowRuleSaveLoad] = useState(false);
    const [ruleModalTab, setRuleModalTab] = useState('load'); // Track which tab to show
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [loadedRuleId, setLoadedRuleId] = useState(null);
    const [currentAIContext, setCurrentAIContext] = useState({
        fileIndex: 0,
        ruleIndex: 0,
        sampleText: '',
        columnName: ''
    });

    // AI Requirements State
    const [aiRequirements, setAiRequirements] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedConfig, setGeneratedConfig] = useState(null);

    // Preview Step State
    const [generatedResults, setGeneratedResults] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Closest match functionality state
    const [findClosestMatches, setFindClosestMatches] = useState(false);
    const [closestMatchConfig, setClosestMatchConfig] = useState({
        enabled: false,
        specific_columns: null,
        min_score_threshold: 30.0,
        perfect_match_threshold: 99.5,
        max_comparisons: null,
        use_sampling: null
    });

    // Handler to sync both closest match states
    const handleClosestMatchToggle = (enabled) => {
        setFindClosestMatches(enabled);
        setClosestMatchConfig(prev => ({ ...prev, enabled }));
    };

    // Handler to update closest match config
    const handleClosestMatchConfigChange = (updates) => {
        setClosestMatchConfig(prev => ({ ...prev, ...updates }));
    };

    // State to track filter validation
    const [hasIncompleteFilters, setHasIncompleteFilters] = useState(false);

    // Handler for filter validation
    const handleFilterValidation = (hasIncomplete) => {
        setHasIncompleteFilters(hasIncomplete);
    };

    // Step definitions
    const steps = [
        {id: 'rule_management', title: 'Load/Save Rules', icon: Save},
        {id: 'ai_requirements', title: 'AI Configuration', icon: Wand2},
        {id: 'extraction_rules', title: 'Data Parsing', icon: Target},  
        {id: 'filter_rules', title: 'Data Filtering', icon: Filter},
        {id: 'reconciliation_rules', title: 'Matching Rules', icon: Settings},
        {id: 'result_columns', title: 'Result Columns', icon: Columns},
        {id: 'generate_view', title: 'Generate & View', icon: Upload}
    ];

    // Helper functions
    const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

    const getSelectedFilesArray = () => {
        return Object.keys(selectedFiles)
            .sort()
            .map(key => selectedFiles[key])
            .filter(file => file !== null && file !== undefined);
    };

    const getFileByIndex = (index) => {
        const key = `file_${index}`;
        return selectedFiles[key];
    };

    const getAllAvailableColumns = (fileIndex) => {
        const file = getFileByIndex(fileIndex);
        const originalColumns = fileColumns[file?.file_id] || [];
        const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(Boolean) || [];
        return [...originalColumns, ...extractedColumns];
    };

    const getMandatoryColumns = (fileIndex) => {
        const mandatoryColumns = new Set();

        // Add extracted columns
        const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(name => name && name.trim().length >= 3) || [];
        extractedColumns.forEach(col => mandatoryColumns.add(col.trim()));

        // Add reconciliation rule columns
        reconciliationRules.forEach(rule => {
            if (fileIndex === 0 && rule.LeftFileColumn && rule.LeftFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.LeftFileColumn.trim());
            } else if (fileIndex === 1 && rule.RightFileColumn && rule.RightFileColumn.trim().length >= 3) {
                mandatoryColumns.add(rule.RightFileColumn.trim());
            }
        });

        return Array.from(mandatoryColumns);
    };

    const getOptionalColumns = (fileIndex) => {
        const allColumns = getAllAvailableColumns(fileIndex);
        const mandatoryColumns = getMandatoryColumns(fileIndex);
        return allColumns.filter(col => !mandatoryColumns.includes(col));
    };

    const getSampleTextForColumn = (fileIndex, columnName) => {
        const file = getFileByIndex(fileIndex);
        if (!file || !file.sample_data || !columnName) return '';

        const sampleValues = file.sample_data
            .map(row => row[columnName])
            .filter(val => val && val.toString().trim())
            .slice(0, 3);

        return sampleValues.join(', ');
    };

    // Helper functions to open rule modal with correct tab
    const openRuleModalForLoading = () => {
        setRuleModalTab('load');
        setShowRuleSaveLoad(true);
    };

    const openRuleModalForSaving = () => {
        setRuleModalTab('save');
        setShowRuleSaveLoad(true);
    };

    // Effects
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
    }, [config, reconciliationRules]);

    useEffect(() => {
        if (loadedRuleId) {
            setHasUnsavedChanges(true);
        }
    }, [config, reconciliationRules, selectedColumnsFileA, selectedColumnsFileB]);

    // Rule management handlers
    const handleRuleLoaded = (rule, adaptedConfig, warnings) => {
        setConfig(adaptedConfig);
        setReconciliationRules(adaptedConfig.ReconciliationRules || []);
        setLoadedRuleId(rule.id);
        setHasUnsavedChanges(false);

        if (warnings && warnings.length > 0) {
            onSendMessage('system', `⚠️ Rule loaded with warnings:\n${warnings.join('\n')}\n\nPlease review and update the configuration as needed.`);
        } else {
            onSendMessage('system', `✅ Rule "${rule.name}" loaded successfully!`);
        }

        setTimeout(() => {
            setCurrentStep('extraction_rules');
        }, 1000);
    };

    const handleRuleSaved = (savedRule) => {
        setLoadedRuleId(savedRule.id);
        setHasUnsavedChanges(false);
        onSendMessage('system', `✅ Rule "${savedRule.name}" saved successfully!`);
    };

    const getCurrentRuleConfig = () => {
        return {
            Files: config.Files,
            ReconciliationRules: reconciliationRules,
            selected_columns_file_a: selectedColumnsFileA,
            selected_columns_file_b: selectedColumnsFileB,
            user_requirements: 'Reconcile files using the configured rules'
        };
    };

    // Navigation handlers
    const nextStep = async () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            const nextStepId = steps[currentIndex + 1].id;
            setCurrentStep(nextStepId);
            
            // Don't auto-generate results - let user click Generate Results button in preview step
        }
    };

    const prevStep = () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
        }
    };

    // Generate reconciliation results
    const generateReconciliationResults = async () => {
        setIsProcessing(true);
        try {
            const filesArray = getSelectedFilesArray();
            const finalConfig = {
                process_type: 'reconciliation',
                process_name: 'Custom Reconciliation Process',
                user_requirements: 'Reconcile files using the configured rules',
                files: filesArray.map((file, index) => ({
                    file_id: file.file_id,
                    role: `file_${index}`,
                    label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
                })),
                reconciliation_config: {
                    Files: config.Files,
                    ReconciliationRules: reconciliationRules,
                    selected_columns_file_a: selectedColumnsFileA,
                    selected_columns_file_b: selectedColumnsFileB,
                    user_requirements: 'Reconcile files using the configured rules',
                    files: filesArray.map((file, index) => ({
                        file_id: file.file_id,
                        role: `file_${index}`,
                        label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
                    }))
                },
                closest_match_config: closestMatchConfig.enabled ? closestMatchConfig : null
            };

            onSendMessage('system', '🎉 Starting reconciliation process...');
            
            const response = await processManagementService.startReconciliation(finalConfig);
            
            if (response.success) {
                // Check if response has direct data or is wrapped in process format
                const resultData = response.data || response;
                const summary = resultData.summary || {};
                
                setGeneratedResults({
                    reconciliation_id: resultData.reconciliation_id || response.processId,
                    matched_count: summary.matched_records || 0,
                    unmatched_file_a_count: summary.unmatched_file_a || 0,
                    unmatched_file_b_count: summary.unmatched_file_b || 0,
                    total_records_file_a: summary.total_records_file_a || 0,
                    total_records_file_b: summary.total_records_file_b || 0,
                    processing_time: summary.processing_time_seconds || 0,
                    match_percentage: summary.match_percentage || 0,
                    errors: resultData.errors || [],
                    warnings: resultData.warnings || [],
                    processing_info: resultData.processing_info || {}
                });
                onSendMessage('system', '✅ Reconciliation completed successfully!');
            } else {
                setGeneratedResults({
                    errors: [response.error || 'Reconciliation failed']
                });
                onSendMessage('system', `❌ Reconciliation failed: ${response.error}`);
            }
        } catch (error) {
            console.error('Reconciliation error:', error);
            setGeneratedResults({
                errors: [error.message || 'An unexpected error occurred']
            });
            onSendMessage('system', `❌ Reconciliation error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const completeFlow = () => {
        // This function is now primarily for backwards compatibility
        // The actual processing happens in generateReconciliationResults
        if (generatedResults && !generatedResults.errors) {
            onSendMessage('system', '🎉 Reconciliation configuration completed!');
            // Could optionally call onComplete here if needed for external handling
        }
    };

    // Column selection handlers
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

    // Extraction rule handlers
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

    // AI handlers
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
        onSendMessage('system', '✨ AI generated regex pattern applied to extraction rule');
    };

    // AI Configuration handlers
    const handleGenerateAIConfig = async (requirements, sourceFiles) => {
        setIsGenerating(true);
        try {
            // Normalize source files to match backend expectations
            const normalizedSourceFiles = sourceFiles.map(file => ({
                file_id: file.file_id,
                filename: file.filename,
                columns: file.columns || [],
                totalRows: file.totalRows || file.total_rows || 0,
                label: file.label || ''
            }));

            const response = await aiAssistanceService.generateReconciliationConfig({
                requirements,
                sourceFiles: normalizedSourceFiles
            });
            
            if (response.success) {
                setGeneratedConfig(response.data);
                onSendMessage('system', '✨ AI configuration generated successfully! Review and apply it to continue.');
            } else {
                throw new Error(response.message || 'Failed to generate configuration');
            }
        } catch (error) {
            console.error('AI configuration generation failed:', error);
            onSendMessage('system', `❌ Failed to generate AI configuration: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseAIConfiguration = (aiConfig) => {
        // Apply the AI generated configuration
        setConfig({
            Files: aiConfig.Files || [],
            ReconciliationRules: []
        });
        setReconciliationRules(aiConfig.ReconciliationRules || []);
        
        // Update selected columns
        if (aiConfig.selected_columns_file_a) {
            setSelectedColumnsFileA(aiConfig.selected_columns_file_a);
        }
        if (aiConfig.selected_columns_file_b) {
            setSelectedColumnsFileB(aiConfig.selected_columns_file_b);
        }
        
        setHasUnsavedChanges(true);
        setGeneratedConfig(null);
        onSendMessage('system', '✅ AI configuration applied! You can now review and modify it in the following steps.');
        
        // Navigate to extraction rules step
        setCurrentStep('extraction_rules');
    };

    // Filter rule handlers
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

    // Reconciliation rule handlers
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

    // Result handlers
    const openFileViewer = (reconciliationId) => {
        if (reconciliationId) {
            const viewerUrl = `/viewer/${reconciliationId}`;
            const newWindow = window.open(
                viewerUrl,
                `reconciliation_viewer_${reconciliationId}`,
                'toolbar=yes,scrollbars=yes,resizable=yes,width=1400,height=900,menubar=yes,location=yes,directories=no,status=yes'
            );

            if (newWindow) {
                newWindow.focus();
            } else {
                window.open(viewerUrl, '_blank');
            }
        }
    };

    const handleSaveResults = (reconciliationId) => {
        // This would typically show a save dialog or perform save operation
        if (reconciliationId) {
            onSendMessage('system', `💾 Reconciliation results saved! ID: ${reconciliationId}`);
            // You could add additional save logic here
        }
    };

    // Step content renderer
    const renderStepContent = () => {
        const filesArray = getSelectedFilesArray();

        switch (currentStep) {
            case 'rule_management':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Choose Configuration Method</h3>
                        <p className="text-sm text-gray-600">
                            You can use AI to generate configuration from requirements, load a previously saved rule, 
                            or start fresh with manual configuration.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg h-full flex flex-col">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Wand2 size={20} className="text-purple-600"/>
                                    <h4 className="text-md font-medium text-purple-800">AI Configuration</h4>
                                </div>
                                <p className="text-sm text-purple-700 mb-4 flex-grow">
                                    Describe your requirements and let AI generate the configuration.
                                </p>
                                <button
                                    onClick={() => setCurrentStep('ai_requirements')}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 min-h-[40px]"
                                >
                                    <Wand2 size={16}/>
                                    <span>Use AI Assistant</span>
                                </button>
                            </div>

                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg h-full flex flex-col">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Upload size={20} className="text-blue-600"/>
                                    <h4 className="text-md font-medium text-blue-800">Load Existing Rule</h4>
                                </div>
                                <p className="text-sm text-blue-700 mb-4 flex-grow">
                                    Load a previously saved rule template and adapt it to your current files.
                                </p>
                                <button
                                    onClick={() => openRuleModalForLoading()}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 min-h-[40px]"
                                >
                                    <Upload size={16}/>
                                    <span>Browse Saved Rules</span>
                                </button>
                            </div>

                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg h-full flex flex-col">
                                <div className="flex items-center space-x-2 mb-3">
                                    <FileText size={20} className="text-green-600"/>
                                    <h4 className="text-md font-medium text-green-800">Start Fresh Manually</h4>
                                </div>
                                <p className="text-sm text-green-700 mb-4 flex-grow">
                                    Create a new reconciliation configuration manually from scratch.
                                </p>
                                <button
                                    onClick={() => setCurrentStep('extraction_rules')}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 min-h-[40px]"
                                >
                                    <FileText size={16}/>
                                    <span>Start Fresh</span>
                                </button>
                            </div>
                        </div>

                        {loadedRuleId && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Check size={16} className="text-yellow-600"/>
                                        <span className="text-sm text-yellow-800">
                                            Rule loaded. {hasUnsavedChanges ? 'You have unsaved changes.' : 'No changes made.'}
                                        </span>
                                    </div>
                                    {hasUnsavedChanges && (
                                        <button
                                            onClick={() => openRuleModalForSaving()}
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

            case 'ai_requirements':
                return (
                    <AIRequirementsStep
                        sourceFiles={getSelectedFilesArray()}
                        onGenerateConfig={handleGenerateAIConfig}
                        onConfigGenerated={setGeneratedConfig}
                        isGenerating={isGenerating}
                        generatedConfig={generatedConfig}
                        onUseConfiguration={handleUseAIConfiguration}
                        requirements={aiRequirements}
                        onRequirementsChange={setAiRequirements}
                    />
                );


            case 'extraction_rules':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Data Parsing Rules</h3>
                            <p className="text-sm text-gray-600">Define how to extract and transform data from each
                                file.</p>
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
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Result
                                                            Column Name</label>
                                                        <input
                                                            type="text"
                                                            value={rule.ResultColumnName || ''}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'ResultColumnName', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="e.g., ExtractedAmount"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Source
                                                            Column</label>
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
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Match
                                                            Type</label>
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
                                                        <label
                                                            className="block text-xs font-medium text-gray-700 mb-1">Pattern/Value</label>
                                                        <input
                                                            type="text"
                                                            value={rule.Patterns?.[0] || ''}
                                                            onChange={(e) => updateExtractionRule(fileIndex, ruleIndex, 'Patterns', e.target.value)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="e.g., \\$?([\\d,]+(?:\\.\\d{2})?)"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">AI
                                                            Helper</label>
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
                                                        <span
                                                            className="font-medium text-blue-800">Sample data from {rule.SourceColumn}: </span>
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
                                                <p className="text-xs">Click "Add Rule" to create extraction
                                                    patterns.</p>
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
                    <IntegratedFilterDataStep
                        config={config}
                        setConfig={setConfig}
                        getFileByIndex={getFileByIndex}
                        fileColumns={fileColumns}
                        onSendMessage={onSendMessage}
                        onValidationChange={handleFilterValidation}
                    />
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
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">File
                                                        A Column</label>
                                                    <select
                                                        value={rule.LeftFileColumn || ''}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'LeftFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {config.Files[0]?.Extract?.map(ext => (
                                                            <option key={ext.ResultColumnName}
                                                                    value={ext.ResultColumnName}>
                                                                {ext.ResultColumnName} (extracted)
                                                            </option>
                                                        ))}
                                                        {columnsA.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">File
                                                        B Column</label>
                                                    <select
                                                        value={rule.RightFileColumn || ''}
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'RightFileColumn', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Column</option>
                                                        {config.Files[1]?.Extract?.map(ext => (
                                                            <option key={ext.ResultColumnName}
                                                                    value={ext.ResultColumnName}>
                                                                {ext.ResultColumnName} (extracted)
                                                            </option>
                                                        ))}
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
                                                        onChange={(e) => updateReconciliationRule(ruleIndex, 'MatchType', e.target.value)}
                                                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="equals">Exact Match</option>
                                                        <option value="tolerance">Tolerance Match</option>
                                                        <option value="date_equals">Date Match</option>
                                                        <option value="contains">Contains</option>
                                                        <option value="percentage">Percentage Match</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label
                                                        className="block text-xs font-medium text-gray-700 mb-1">Tolerance</label>
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
                            <p className="text-sm text-gray-600">Choose which columns from each file should be included
                                in the reconciliation results.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {/* File A Column Selection */}
                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A
                                        </div>
                                        <h4 className="text-md font-medium text-green-800">File
                                            A: {getFileByIndex(0)?.filename}</h4>
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
                                        >
                                            Clear Optional
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {getMandatoryColumns(0).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-green-700 mb-2">Required Columns:
                                            </div>
                                            {getMandatoryColumns(0).map(column => (
                                                <label key={column}
                                                       className="flex items-center space-x-2 text-sm opacity-75">
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        disabled={true}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-green-700">{column}</span>
                                                    <span className="text-xs text-green-500">(required)</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                    {getOptionalColumns(0).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-green-700 mb-2 mt-4">Optional
                                                Columns:
                                            </div>
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
                                </div>
                            </div>

                            {/* File B Column Selection */}
                            <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">B
                                        </div>
                                        <h4 className="text-md font-medium text-purple-800">File
                                            B: {getFileByIndex(1)?.filename}</h4>
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
                                        >
                                            Clear Optional
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {getMandatoryColumns(1).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-purple-700 mb-2">Required
                                                Columns:
                                            </div>
                                            {getMandatoryColumns(1).map(column => (
                                                <label key={column}
                                                       className="flex items-center space-x-2 text-sm opacity-75">
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        disabled={true}
                                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-purple-700">{column}</span>
                                                    <span className="text-xs text-purple-500">(required)</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                    {getOptionalColumns(1).length > 0 && (
                                        <>
                                            <div className="text-xs font-medium text-purple-700 mb-2 mt-4">Optional
                                                Columns:
                                            </div>
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
                                </div>
                            </div>
                        </div>
                    </div>
                );


            case 'generate_view':
                return (
                    <ReconciliationPreviewStep
                        config={{
                            ...config,
                            ReconciliationRules: reconciliationRules,
                            selected_columns_file_a: selectedColumnsFileA,
                            selected_columns_file_b: selectedColumnsFileB,
                            user_requirements: 'Reconcile files using the configured rules',
                            files: getSelectedFilesArray().map((file, index) => ({
                                file_id: file.file_id,
                                role: `file_${index}`,
                                label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
                            }))
                        }}
                        generatedResults={generatedResults}
                        isLoading={isProcessing}
                        onRefresh={generateReconciliationResults}
                        onViewResults={openFileViewer}
                        onSaveResults={handleSaveResults}
                        onRetry={() => setCurrentStep('result_columns')}
                        onUpdateConfig={() => setCurrentStep('result_columns')}
                        onClose={onCancel}
                        loadedRuleId={loadedRuleId}
                        hasUnsavedChanges={hasUnsavedChanges}
                        onShowRuleModal={() => openRuleModalForSaving()}
                        findClosestMatches={findClosestMatches}
                        onToggleClosestMatches={handleClosestMatchToggle}
                        closestMatchConfig={closestMatchConfig}
                        onClosestMatchConfigChange={handleClosestMatchConfigChange}
                    />
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    return (
        <>
            <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg max-w-6xl mx-auto">
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
                                disabled={
                                    (currentStep === 'result_columns' && reconciliationRules.length === 0) ||
                                    (currentStep === 'reconciliation_rules' && (
                                        reconciliationRules.length === 0 ||
                                        reconciliationRules.some(rule => 
                                            !rule.LeftFileColumn || rule.LeftFileColumn.trim() === '' ||
                                            !rule.RightFileColumn || rule.RightFileColumn.trim() === ''
                                        )
                                    )) ||
                                    (currentStep === 'filter_rules' && hasIncompleteFilters) ||
                                    (currentStep === 'extraction_rules' && (
                                        config.Files && config.Files.some(file =>
                                            file.Extract && file.Extract.length > 0 &&
                                            file.Extract.some(extractRule =>
                                                !extractRule.ResultColumnName || extractRule.ResultColumnName.trim() === '' ||
                                                !extractRule.SourceColumn || extractRule.SourceColumn.trim() === '' ||
                                                (extractRule.MatchType === 'regex' && (!extractRule.Patterns || extractRule.Patterns.length === 0 || !extractRule.Patterns[0] || extractRule.Patterns[0].trim() === ''))
                                            )
                                        )
                                    ))
                                }
                                className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <span>Next</span>
                                <ChevronRight size={16}/>
                            </button>
                        ) : (
                            <button
                                onClick={onCancel}
                                className="flex items-center space-x-1 px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                <X size={16}/>
                                <span>Close</span>
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

            {/* RuleSaveLoad Modal */}
            {showRuleSaveLoad && (
                <RuleSaveLoad
                    selectedTemplate={selectedTemplate}
                    currentConfig={getCurrentRuleConfig()}
                    fileColumns={fileColumns}
                    loadedRuleId={loadedRuleId}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onRuleLoaded={handleRuleLoaded}
                    onRuleSaved={handleRuleSaved}
                    onClose={() => setShowRuleSaveLoad(false)}
                    defaultTab={ruleModalTab}
                />
            )}
        </>
    );
};

export default ReconciliationFlow;