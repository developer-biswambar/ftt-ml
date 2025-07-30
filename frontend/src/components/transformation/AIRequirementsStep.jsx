import React, { useState } from 'react';
import { 
    Wand2, 
    FileText, 
    Loader2, 
    AlertCircle, 
    CheckCircle, 
    RefreshCw,
    Lightbulb,
    Target,
    Settings
} from 'lucide-react';

const AIRequirementsStep = ({ 
    sourceFiles, 
    onConfigurationGenerated, 
    onSendMessage,
    filesArray,
    initialRequirements = ''
}) => {
    const [requirements, setRequirements] = useState(initialRequirements);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedConfig, setGeneratedConfig] = useState(null);
    const [error, setError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);

    // Sample requirements based on file analysis
    const generateSuggestions = () => {
        const suggestions = [
            {
                title: "Customer Data Transformation",
                description: "Transform customer_id to uppercase and add status column based on conditions",
                example: "I need to transform customer data where:\n- Convert customer_id to uppercase\n- Add a 'status' column that shows 'ACTIVE' for records with Amount > 1000, otherwise 'INACTIVE'\n- Keep original Amount and Date columns\n- Add a static 'Source' column with value 'SYSTEM'"
            },
            {
                title: "Financial Report Generation",
                description: "Create financial summary with calculated fields and categorization",
                example: "Generate a financial report with:\n- customer_id from source\n- total_amount calculated field\n- category based on Amount ranges (HIGH: >5000, MEDIUM: 1000-5000, LOW: <1000)\n- formatted_date in YYYY-MM-DD format\n- static region field with 'US-EAST'"
            },
            {
                title: "Data Enrichment",
                description: "Enrich existing data with additional calculated and static fields",
                example: "Enrich the data by:\n- Keeping all original columns\n- Adding 'risk_level' column: HIGH if Amount > 10000, MEDIUM if 1000-10000, LOW if <1000\n- Adding 'processed_date' with today's date\n- Adding 'batch_id' with static value 'BATCH_001'"
            }
        ];
        setSuggestions(suggestions);
    };

    React.useEffect(() => {
        generateSuggestions();
    }, []);

    // Update requirements when initialRequirements changes
    React.useEffect(() => {
        setRequirements(initialRequirements);
    }, [initialRequirements]);

    const handleGenerateConfiguration = async () => {
        if (!requirements.trim()) {
            setError('Please enter your transformation requirements');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Get source file information for context
            const sourceFileInfo = sourceFiles.map(sf => {
                const file = filesArray.find(f => f.file_id === sf.file_id);
                return {
                    file_id: sf.file_id,  // Include the actual file ID
                    alias: sf.alias,
                    filename: file?.filename || 'Unknown',
                    columns: file?.columns || [],
                    totalRows: file?.total_rows || 0
                };
            });

            // Import the API service
            const { transformationApiService } = await import('../../services/transformationApiService');
            
            // Call the backend API to generate configuration
            const result = await transformationApiService.generateAIConfiguration(
                requirements.trim(),
                sourceFileInfo
            );
            
            if (result.success) {
                setGeneratedConfig(result.data);
                onSendMessage('system', '✅ AI configuration generated successfully! Review and modify as needed.');
            } else {
                throw new Error(result.message || 'Configuration generation failed');
            }

        } catch (err) {
            setError(err.message);
            onSendMessage('system', `❌ Failed to generate configuration: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseConfiguration = () => {
        if (generatedConfig) {
            onConfigurationGenerated(generatedConfig, requirements);
        }
    };

    const handleUseSuggestion = (suggestion) => {
        setRequirements(suggestion.example);
    };

    const renderSourceFileInfo = () => (
        <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Available Source Files:</h4>
            <div className="space-y-2">
                {sourceFiles.map((sf, index) => {
                    const file = filesArray.find(f => f.file_id === sf.file_id);
                    return (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <FileText size={16} className="text-blue-600" />
                            <div className="flex-1">
                                <div className="font-medium text-sm">{file?.filename}</div>
                                <div className="text-xs text-gray-600">
                                    {file?.total_rows} rows • Columns: {file?.columns?.join(', ')}
                                </div>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {sf.alias}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderSuggestions = () => (
        <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
                <Lightbulb size={16} className="text-yellow-600" />
                <h4 className="text-sm font-medium text-gray-700">Transformation Examples:</h4>
            </div>
            <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h5 className="font-medium text-sm text-gray-800">{suggestion.title}</h5>
                                <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>
                            </div>
                            <button
                                onClick={() => handleUseSuggestion(suggestion)}
                                className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                            >
                                Use Example
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderGeneratedConfig = () => {
        if (!generatedConfig) return null;

        return (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle size={16} className="text-green-600" />
                    <h4 className="font-medium text-green-800">Generated Configuration Preview</h4>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <span className="text-sm font-medium text-gray-700">Name: </span>
                        <span className="text-sm text-gray-600">{generatedConfig.name}</span>
                    </div>
                    
                    <div>
                        <span className="text-sm font-medium text-gray-700">Description: </span>
                        <span className="text-sm text-gray-600">{generatedConfig.description}</span>
                    </div>

                    <div>
                        <span className="text-sm font-medium text-gray-700">Rules Generated: </span>
                        <span className="text-sm text-gray-600">{generatedConfig.row_generation_rules?.length || 0}</span>
                    </div>

                    {generatedConfig.row_generation_rules?.map((rule, index) => (
                        <div key={index} className="ml-4 p-2 bg-white rounded border">
                            <div className="text-sm font-medium text-gray-700">{rule.name}</div>
                            <div className="text-xs text-gray-600">
                                Output Columns: {rule.output_columns?.map(col => col.name).join(', ')}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center space-x-2">
                    <button
                        onClick={handleUseConfiguration}
                        className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                        <Target size={14} />
                        <span>Use This Configuration</span>
                    </button>
                    <button
                        onClick={() => setGeneratedConfig(null)}
                        className="flex items-center space-x-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                    >
                        <RefreshCw size={14} />
                        <span>Generate New</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                    <Wand2 size={24} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">AI-Powered Configuration</h3>
                </div>
                <p className="text-sm text-gray-600">
                    Describe your transformation requirements and let AI generate the configuration for you.
                </p>
            </div>

            {renderSourceFileInfo()}
            {renderSuggestions()}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe Your Transformation Requirements
                </label>
                <textarea
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="Example: I need to transform customer data where customer_id is converted to uppercase, add a status column that shows 'ACTIVE' for Amount > 1000 otherwise 'INACTIVE', keep the original Amount and Date columns, and add a static 'Source' column with value 'SYSTEM'."
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                    rows={6}
                />
                <div className="mt-2 text-xs text-gray-500">
                    Be specific about column mappings, conditions, static values, and output requirements.
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-700">
                        <AlertCircle size={16} />
                        <span className="text-sm font-medium">Error</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
            )}

            <div className="flex items-center justify-center space-x-4">
                <button
                    onClick={handleGenerateConfiguration}
                    disabled={isGenerating || !requirements.trim()}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Generating Configuration...</span>
                        </>
                    ) : (
                        <>
                            <Wand2 size={16} />
                            <span>Generate Configuration</span>
                        </>
                    )}
                </button>
                
                <button
                    onClick={() => onConfigurationGenerated({}, requirements)}
                    disabled={isGenerating}
                    className="flex items-center space-x-2 px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                    <Settings size={16} />
                    <span>Skip AI & Configure Manually</span>
                </button>
            </div>

            {renderGeneratedConfig()}
        </div>
    );
};

export default AIRequirementsStep;