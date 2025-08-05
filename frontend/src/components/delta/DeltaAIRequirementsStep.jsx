import React, { useState } from 'react';
import {
    AlertCircle,
    Brain,
    FileText,
    Loader2,
    Sparkles,
    CheckCircle,
    XCircle,
    Info
} from 'lucide-react';

const DeltaAIRequirementsStep = ({
    onGenerateConfig,
    onConfigGenerated,
    sourceFiles,
    isGenerating = false,
    generatedConfig = null,
    onUseConfiguration,
    requirements = '',
    onRequirementsChange
}) => {
    const [localRequirements, setLocalRequirements] = useState(requirements);
    const [showExamples, setShowExamples] = useState(false);

    const handleRequirementsChange = (value) => {
        setLocalRequirements(value);
        if (onRequirementsChange) {
            onRequirementsChange(value);
        }
    };

    const handleGenerateConfig = () => {
        if (localRequirements.trim()) {
            onGenerateConfig(localRequirements.trim(), sourceFiles);
        }
    };

    const exampleRequirements = [
        {
            title: "Transaction Delta Analysis",
            description: "Compare transaction files to identify changes between periods",
            text: "Generate delta between transaction files using transaction ID as the key. Compare amounts, dates, and status fields to identify amended records. Track new transactions added and deleted transactions removed between reporting periods."
        },
        {
            title: "Account Balance Changes",
            description: "Track account balance changes between snapshots",
            text: "Compare account balance files using account number as primary key. Identify balance changes, new accounts opened, and closed accounts. Use numeric tolerance of $0.01 for balance comparisons to handle rounding differences."
        },
        {
            title: "Customer Data Updates",
            description: "Monitor customer information changes",
            text: "Track customer data changes using customer ID as key. Compare names, addresses, phone numbers, and email addresses to identify updated records. Flag new customers and customers who were removed from the system."
        },
        {
            title: "Product Inventory Delta",
            description: "Monitor inventory changes between snapshots",
            text: "Compare product inventory files using product SKU as key. Track quantity changes, price updates, and product additions/removals. Use case-insensitive matching for product names and exact matching for SKUs."
        },
        {
            title: "Employee Record Changes",
            description: "Track employee information updates",
            text: "Generate delta between employee files using employee ID as key. Monitor salary changes, department transfers, and status updates. Identify new hires and terminated employees between reporting periods."
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <Brain className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">AI Delta Configuration</h3>
                    <p className="text-sm text-gray-600">
                        Describe your delta generation requirements and let AI create the configuration
                    </p>
                </div>
            </div>

            {/* File Information */}
            <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Selected Files for Delta Generation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sourceFiles?.map((file, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-800">{file.filename}</span>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {index === 0 ? 'Older File' : 'Newer File'}
                                </span>
                            </div>
                            <div className="text-sm text-gray-600">
                                <p>{file.totalRows || file.total_rows} rows • {file.columns?.length} columns</p>
                                <p className="text-xs mt-1">
                                    Columns: {file.columns?.slice(0, 5).join(', ')}
                                    {file.columns?.length > 5 && ` ... (+${file.columns.length - 5} more)`}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Requirements Input */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        Delta Generation Requirements
                    </label>
                    <button
                        type="button"
                        onClick={() => setShowExamples(!showExamples)}
                        className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
                    >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {showExamples ? 'Hide Examples' : 'Show Examples'}
                    </button>
                </div>

                <textarea
                    value={localRequirements}
                    onChange={(e) => handleRequirementsChange(e.target.value)}
                    placeholder="Describe your delta generation requirements. For example: 'Compare transaction files using transaction ID as key. Track amount changes, new transactions, and deleted transactions between reporting periods. Use tolerance matching for amounts within $0.01.'"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                    disabled={isGenerating}
                />

                {/* Examples */}
                {showExamples && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-3">Example Requirements</h5>
                        <div className="space-y-3">
                            {exampleRequirements.map((example, index) => (
                                <div key={index} className="bg-white p-3 rounded border border-gray-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h6 className="font-medium text-gray-800 text-sm">{example.title}</h6>
                                            <p className="text-xs text-gray-600 mb-2">{example.description}</p>
                                            <p className="text-sm text-gray-700">{example.text}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRequirementsChange(example.text)}
                                            className="ml-3 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
                                            disabled={isGenerating}
                                        >
                                            Use This
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Generate Button */}
                <div className="flex justify-center">
                    <button
                        onClick={handleGenerateConfig}
                        disabled={!localRequirements.trim() || isGenerating}
                        className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Generating Configuration...</span>
                            </>
                        ) : (
                            <>
                                <Brain className="w-5 h-5" />
                                <span>Generate Delta Configuration</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Generated Configuration */}
            {generatedConfig && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium text-green-800">Configuration Generated Successfully</h4>
                            <p className="text-sm text-green-700 mt-1">
                                AI has analyzed your requirements and generated a delta configuration with {' '}
                                {generatedConfig.data?.KeyRules?.length || 0} key rule(s) and {' '}
                                {generatedConfig.data?.ComparisonRules?.length || 0} comparison rule(s).
                            </p>
                            
                            {/* Configuration Preview */}
                            <div className="mt-3 bg-white border border-green-200 rounded p-3">
                                <h5 className="font-medium text-gray-800 text-sm mb-2">Configuration Preview:</h5>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div>
                                        <span className="font-medium">Key Fields:</span> {' '}
                                        {generatedConfig.data?.KeyRules?.map(rule => 
                                            `${rule.LeftFileColumn} ↔ ${rule.RightFileColumn}`
                                        ).join(', ') || 'None'}
                                    </div>
                                    <div>
                                        <span className="font-medium">Comparison Fields:</span> {' '}
                                        {generatedConfig.data?.ComparisonRules?.length > 0 
                                            ? generatedConfig.data.ComparisonRules.map(rule => 
                                                `${rule.LeftFileColumn} ↔ ${rule.RightFileColumn}`
                                              ).join(', ')
                                            : 'Auto-detect all non-key fields'
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-4">
                                <button
                                    onClick={() => onUseConfiguration(generatedConfig.data)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Use This Configuration</span>
                                </button>
                                <button
                                    onClick={() => onConfigGenerated(null)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                                >
                                    <XCircle className="w-4 h-4" />
                                    <span>Generate Different Config</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How Delta Generation Works:</p>
                        <ul className="space-y-1 text-blue-700">
                            <li>• <strong>UNCHANGED:</strong> Records with same keys and identical values</li>
                            <li>• <strong>AMENDED:</strong> Records with same keys but different values</li>
                            <li>• <strong>DELETED:</strong> Records present in older file but missing in newer file</li>
                            <li>• <strong>NEWLY_ADDED:</strong> Records present in newer file but missing in older file</li>
                        </ul>
                        <p className="mt-2">
                            Provide clear requirements about which fields to use as keys for matching and 
                            which fields to compare for changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeltaAIRequirementsStep;