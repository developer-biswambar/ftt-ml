import React, {useState, useEffect} from 'react';
import {
    FileText,
    Target,
    Settings,
    Eye,
    Check,
    ChevronLeft,
    ChevronRight,
    X,
    Save,
    Upload,
    Wand2,
    AlertCircle,
    Download,
    Copy,
    Layers
} from 'lucide-react';
import RowGenerationStep from './RowGenerationStep';
import ColumnMappingStep from './ColumnMappingStep';
import PreviewStep from './PreviewStep';
import AIRequirementsStep from './AIRequirementsStep';
import TransformationRuleSaveLoad from './TransformationRuleSaveLoad';
import {deltaApiService} from '../../services/deltaApiService';
import {transformationApiService} from '../../services/transformationApiService';

const TransformationFlow = ({
                                files,
                                selectedFiles,
                                onTransformationFlowStart,
                                onCancel,
                                onSendMessage
                            }) => {

    const filesArray = Object.values(files);
    // State management
    const [currentStep, setCurrentStep] = useState('rule_management');
    const [config, setConfig] = useState({
        name: '',
        description: '',
        source_files: [],
        row_generation_rules: [],
        merge_datasets: false, // Changed from true to false
        validation_rules: []
    });

    const [generatedResults, setGeneratedResults] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [savedRequirements, setSavedRequirements] = useState('');

    // Rule management state
    const [loadedRuleId, setLoadedRuleId] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showRuleModal, setShowRuleModal] = useState(false);

    // Updated step definitions with rule management as first step
    const steps = [
        {id: 'rule_management', title: 'Load/Save Rules', icon: Save},
        {id: 'ai_requirements', title: 'AI Setup', icon: Wand2},
        {id: 'file_selection', title: 'Select Files', icon: FileText},
        {id: 'row_generation', title: 'Configure Rules', icon: Copy},
        {id: 'preview', title: 'Generate & View', icon: Eye}
    ];

    // Initialize with selected files
    useEffect(() => {
        if (selectedFiles) {
            const sourceFiles = Object.entries(selectedFiles)
                .filter(([key, file]) => file)
                .map(([key, file], index) => ({
                    file_id: file.file_id,
                    alias: file.file_id, // Use actual file_id as alias to avoid confusion
                    purpose: index === 0 ? 'Primary data source' : 'Additional data source'
                }));

            setConfig(prev => ({
                ...prev,
                source_files: sourceFiles
            }));
        }
    }, [selectedFiles]);

    // Navigation
    const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

    const nextStep = async () => {
        // Validate current step before proceeding
        const validation = validateCurrentStep();
        if (!validation.isValid) {
            setValidationErrors(validation.errors);
            onSendMessage('system', `❌ ${validation.errors.join(', ')}`);
            return;
        }

        setValidationErrors([]);
        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1].id);

            // Generate results when reaching preview step
            if (steps[currentIndex + 1].id === 'preview') {
                await generateResults();
            }
        }
    };

    const prevStep = () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
            setValidationErrors([]);
        }
    };

    // Handler for AI-generated configuration
    const handleAIConfigurationGenerated = (generatedConfig, requirements = '') => {
        // Save the requirements for later use
        setSavedRequirements(requirements);
        
        if (Object.keys(generatedConfig).length === 0) {
            // User chose to skip AI and configure manually
            setCurrentStep('file_selection');
            onSendMessage('system', '✅ Proceeding with manual configuration. Please set up your files and rules.');
        } else {
            // AI generated configuration
            setConfig(prev => ({
                ...prev,
                ...generatedConfig
            }));
            
            // Skip file selection and go directly to rule configuration
            setCurrentStep('row_generation');
            onSendMessage('system', '✅ AI configuration applied successfully! You can now review and modify the rules.');
        }
    };

    // Rule management handlers
    const handleRuleLoaded = (ruleData, adaptedConfig, warnings) => {
        if (ruleData && adaptedConfig) {
            setConfig(prev => ({
                ...prev,
                ...adaptedConfig,
                name: adaptedConfig.name || ruleData.name,
                description: adaptedConfig.description || ruleData.description
            }));
            setLoadedRuleId(ruleData.id);
            setHasUnsavedChanges(false);
            
            let message = `✅ Transformation rule "${ruleData.name}" loaded successfully!`;
            if (warnings && warnings.length > 0) {
                message += ` ⚠️ Warnings: ${warnings.join(', ')}`;
            }
            onSendMessage('system', message);
            
            // Move to file selection step after loading rule
            setCurrentStep('file_selection');
        }
    };

    const handleRuleSaved = (savedRule) => {
        setLoadedRuleId(savedRule.id);
        setHasUnsavedChanges(false);
        onSendMessage('system', `✅ Transformation rule "${savedRule.name}" saved successfully!`);
    };

    // Track changes for unsaved status
    useEffect(() => {
        if (loadedRuleId) {
            setHasUnsavedChanges(true);
        }
    }, [config]);

    // Get current configuration for saving
    const getCurrentRuleConfig = () => {
        return {
            name: config.name,
            description: config.description,
            source_files: config.source_files,
            row_generation_rules: config.row_generation_rules,
            merge_datasets: config.merge_datasets,
            validation_rules: config.validation_rules
        };
    };

    // Validation
    const validateCurrentStep = () => {
        const errors = [];

        switch (currentStep) {
            case 'rule_management':
                // No validation needed for rule management step
                break;

            case 'ai_requirements':
                // No validation needed for AI requirements step
                break;

            case 'file_selection':
                if (config.source_files.length === 0) {
                    errors.push('Please select at least one source file');
                }
                break;

            case 'row_generation':
                if (config.row_generation_rules.length === 0) {
                    errors.push('Please define at least one transformation rule');
                }

                // Validate each rule has required configuration
                config.row_generation_rules.forEach((rule, index) => {
                    if (!rule.name || rule.name.trim() === '') {
                        errors.push(`Rule ${index + 1}: Please provide a rule name`);
                    }
                    if (!rule.output_columns || rule.output_columns.length === 0) {
                        errors.push(`Rule ${index + 1}: Please define at least one output column`);
                    }
                });
                break;
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    // Generate results for all rules
    const generateResults = async () => {
        setIsProcessing(true);
        
        
        try {
            const response = await transformationApiService.processTransformation({
                process_name: config.name || 'Data Transformation',
                description: config.description,
                source_files: config.source_files,
                transformation_config: config,
                preview_only: false
            });

            if (response.success) {
                setGeneratedResults(response);
                onSendMessage('system', '✅ Transformation completed successfully');

                // Show warnings if any
                if (response.warnings && response.warnings.length > 0) {
                    onSendMessage('system', `⚠️ Warnings: ${response.warnings.join(', ')}`);
                }
            } else {
                setGeneratedResults(response);
                onSendMessage('system', `❌ Transformation failed: ${response.errors?.join(', ') || 'Unknown error'}`);
            }
        } catch (error) {
            onSendMessage('system', `❌ Error processing transformation: ${error.message}`);
            setGeneratedResults({
                success: false,
                errors: [error.message],
                warnings: []
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Get source columns for current files
    const getSourceColumns = () => {
        const columns = {};
        config.source_files.forEach(sourceFile => {
            const file = filesArray.find(f => f.file_id === sourceFile.file_id);
            if (file) {
                columns[sourceFile.alias] = file.columns || [];
            }
        });
        return columns;
    };

    // Get file columns for rule loading
    const getFileColumns = () => {
        const fileColumns = {};
        if (selectedFiles) {
            Object.entries(selectedFiles).forEach(([key, file]) => {
                if (file && file.columns) {
                    fileColumns[file.file_id] = file.columns;
                }
            });
        }
        return fileColumns;
    };

    // Helper function to open file viewer
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

    // Step content renderer
    const renderStepContent = () => {
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
                                    Describe your requirements and let AI generate the transformation configuration.
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
                                    Load a previously saved transformation rule template and adapt it to your current files.
                                </p>
                                <button
                                    onClick={() => setShowRuleModal(true)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 min-h-[40px]"
                                >
                                    <Upload size={16}/>
                                    <span>Browse Saved Rules</span>
                                </button>
                            </div>
                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg h-full flex flex-col">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Settings size={20} className="text-green-600"/>
                                    <h4 className="text-md font-medium text-green-800">Start Fresh Manually</h4>
                                </div>
                                <p className="text-sm text-green-700 mb-4 flex-grow">
                                    Create a new transformation configuration manually from scratch.
                                </p>
                                <button
                                    onClick={() => setCurrentStep('file_selection')}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 min-h-[40px]"
                                >
                                    <Settings size={16}/>
                                    <span>Manual Setup</span>
                                </button>
                            </div>
                        </div>

                        {loadedRuleId && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                <div className="flex items-center space-x-2">
                                    <Check className="w-5 h-5 text-green-600" />
                                    <span className="text-green-800 font-medium">Rule loaded successfully!</span>
                                    {hasUnsavedChanges && (
                                        <span className="text-orange-600 text-sm">(Unsaved changes)</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'ai_requirements':
                return (
                    <AIRequirementsStep
                        sourceFiles={config.source_files}
                        onConfigurationGenerated={handleAIConfigurationGenerated}
                        onSendMessage={onSendMessage}
                        filesArray={filesArray}
                        initialRequirements={savedRequirements}
                    />
                );

            case 'file_selection':
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Selected Source Files</h3>
                        <p className="text-sm text-gray-600">
                            Configure the files that will be used as data sources for transformation.
                        </p>

                        <div className="space-y-3">
                            {config.source_files.map((sourceFile, index) => {
                                const file = filesArray.find(f => f.file_id === sourceFile.file_id);
                                return (
                                    <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                <FileText size={20} className="text-blue-600"/>
                                                <span className="font-medium">{file?.filename}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                                Alias: {sourceFile.alias}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <p>{file?.total_rows} rows • {file?.columns?.length} columns</p>
                                            <input
                                                type="text"
                                                value={sourceFile.purpose}
                                                onChange={(e) => {
                                                    const updated = [...config.source_files];
                                                    updated[index].purpose = e.target.value;
                                                    setConfig(prev => ({...prev, source_files: updated}));
                                                }}
                                                placeholder="Describe file purpose..."
                                                className="mt-2 w-full p-2 border border-gray-300 rounded text-sm"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transformation Name
                            </label>
                            <input
                                type="text"
                                value={config.name}
                                onChange={(e) => setConfig(prev => ({...prev, name: e.target.value}))}
                                placeholder="e.g., Tax Declaration Q4 2024"
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description (Optional)
                            </label>
                            <textarea
                                value={config.description}
                                onChange={(e) => setConfig(prev => ({...prev, description: e.target.value}))}
                                placeholder="Describe the purpose of this transformation..."
                                className="w-full p-2 border border-gray-300 rounded"
                                rows={3}
                            />
                        </div>


                    </div>
                );

            case 'row_generation':
                return (
                    <RowGenerationStep
                        rules={config.row_generation_rules}
                        onUpdate={(rules) => setConfig(prev => ({...prev, row_generation_rules: rules}))}
                        sourceColumns={getSourceColumns()}
                        onSendMessage={onSendMessage}
                    />
                );

            case 'preview':
                return (
                    <PreviewStep
                        config={config}
                        generatedResults={generatedResults}
                        isLoading={isProcessing}
                        onRefresh={generateResults}
                        onViewResults={openFileViewer}
                        onSaveResults={openFileViewer}
                        onRetry={() => setCurrentStep('row_generation')}
                        onUpdateConfig={setConfig}
                        onClose={onCancel}
                        loadedRuleId={loadedRuleId}
                        hasUnsavedChanges={hasUnsavedChanges}
                        onShowRuleModal={() => setShowRuleModal(true)}
                    />
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    return (
        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg max-w-6xl mx-auto">
            {/* Step Progress */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    {steps.map((step, index) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = getCurrentStepIndex() > index;
                        const StepIcon = step.icon;

                        return (
                            <div key={step.id} className="flex items-center">
                                <div
                                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                                        isActive ? 'bg-blue-500 border-blue-500 text-white' :
                                            isCompleted ? 'bg-green-500 border-green-500 text-white' :
                                                'bg-gray-100 border-gray-300 text-gray-500'
                                    }`}
                                >
                                    {isCompleted ? <Check size={20}/> : <StepIcon size={20}/>}
                                </div>
                                <span className={`ml-2 text-sm font-medium ${
                                    isActive ? 'text-blue-600' :
                                        isCompleted ? 'text-green-600' :
                                            'text-gray-500'
                                }`}>
                                    {step.title}
                                </span>
                                {index < steps.length - 1 && (
                                    <ChevronRight size={20} className="mx-2 text-gray-400"/>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-700">
                        <AlertCircle size={16}/>
                        <span className="text-sm font-medium">Please fix the following issues:</span>
                    </div>
                    <ul className="mt-1 ml-6 text-sm text-red-600 list-disc">
                        {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

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

                    {getCurrentStepIndex() < steps.length - 1 && (
                        <button
                            onClick={nextStep}
                            className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <span>Next</span>
                            <ChevronRight size={16}/>
                        </button>
                    )}
                </div>
            </div>

            {/* Rule Management Modal */}
            {showRuleModal && (
                <TransformationRuleSaveLoad
                    selectedTemplate={null}
                    currentConfig={getCurrentRuleConfig()}
                    fileColumns={getFileColumns()}
                    loadedRuleId={loadedRuleId}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onRuleLoaded={handleRuleLoaded}
                    onRuleSaved={handleRuleSaved}
                    onClose={() => setShowRuleModal(false)}
                />
            )}
        </div>
    );
};

export default TransformationFlow;