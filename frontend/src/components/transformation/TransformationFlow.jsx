import React, {useEffect, useState} from 'react';
import {AlertCircle, Check, ChevronLeft, ChevronRight, Copy, Eye, FileText, X} from 'lucide-react';
import RowGenerationStep from './RowGenerationStep';
import PreviewStep from './PreviewStep';
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
    const [currentStep, setCurrentStep] = useState('file_selection');
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

    // Updated step definitions (removed schema_definition and column_mapping)
    const steps = [
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
                    alias: `file_${index}`,
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

    // Validation
    const validateCurrentStep = () => {
        const errors = [];

        switch (currentStep) {
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
                        onRetry={() => setCurrentStep('row_generation')}
                        onUpdateConfig={setConfig}
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
        </div>
    );
};

export default TransformationFlow;