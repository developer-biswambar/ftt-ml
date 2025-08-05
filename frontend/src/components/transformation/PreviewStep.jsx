import React, { useState } from 'react';
import {
    Eye,
    Download,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Play,
    FileText,
    Table,
    Code,
    Info,
    ExternalLink,
    ArrowLeft,
    Save,
    Layers,
    Target,
    X
} from 'lucide-react';

const PreviewStep = ({
                         config,
                         generatedResults,
                         isLoading,
                         onRefresh,
                         onViewResults,
                         onSaveResults,
                         onRetry,
                         onUpdateConfig,
                         onClose, // Add onClose prop for closing the popup
                         loadedRuleId,
                         hasUnsavedChanges,
                         onShowRuleModal
                     }) => {
    const [viewMode, setViewMode] = useState('summary'); // summary, results

    const renderConfigSummary = () => {
        const sourceFileCount = config.source_files.length;
        const ruleCount = config.row_generation_rules.filter(r => r.enabled).length;
        const totalOutputColumns = config.row_generation_rules.reduce((total, rule) => {
            return total + (rule.output_columns ? rule.output_columns.length : 0);
        }, 0);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <FileText size={20} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Source Files</span>
                        </div>
                        <p className="text-2xl font-semibold text-blue-900">{sourceFileCount}</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Layers size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Active Rules</span>
                        </div>
                        <p className="text-2xl font-semibold text-green-900">{ruleCount}</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Target size={20} className="text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Output Columns</span>
                        </div>
                        <p className="text-2xl font-semibold text-purple-900">{totalOutputColumns}</p>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={20} className="text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">Merge Output</span>
                        </div>
                        <p className="text-lg font-semibold text-orange-900">
                            {config.merge_datasets ? 'Yes' : 'No'}
                        </p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">Transformation Configuration</h4>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Transformation Name:</span>
                            <span className="font-medium">{config.name || 'Untitled'}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600">Merge Datasets:</span>
                            <span className="font-medium">{config.merge_datasets ? 'Yes' : 'No'}</span>
                        </div>

                        {config.description && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-gray-600">Description:</span>
                                <p className="mt-1 text-gray-800">{config.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Merge Dataset Option */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={config.merge_datasets}
                                onChange={(e) => {
                                    if (typeof onUpdateConfig === 'function') {
                                        onUpdateConfig({...config, merge_datasets: e.target.checked});
                                    }
                                }}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Merge outputs from all rules into single dataset</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6 mt-1">
                            If unchecked, each rule will generate separate output files
                        </p>
                    </div>
                </div>

                {/* Rule Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">Rule Configuration</h4>
                    <div className="space-y-3">
                        {config.row_generation_rules.map((rule, index) => (
                            <div key={rule.id} className={`p-3 rounded-lg border ${
                                rule.enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-800">{rule.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {rule.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600">
                                    <strong>Output Columns:</strong> {
                                    rule.output_columns && rule.output_columns.length > 0
                                        ? rule.output_columns.map(col => col.name || 'Unnamed').join(', ')
                                        : 'None defined'
                                }
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Warnings */}
                {config.row_generation_rules.some(rule => !rule.output_columns || rule.output_columns.length === 0) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                                <p className="font-medium">Warning: Rules Without Output Columns</p>
                                <p className="mt-1">Some rules don't have output columns defined. They won't generate any data.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderGenerationResults = () => {
        if (!generatedResults) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No results generated yet</p>
                </div>
            );
        }

        if (generatedResults.success) {
            return (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={20} className="text-green-600" />
                            <span className="font-medium text-green-800">Transformation Completed Successfully</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="text-center">
                                <p className="text-2xl font-semibold text-green-900">
                                    {generatedResults.total_input_rows}
                                </p>
                                <p className="text-sm text-green-700">Input Rows</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-semibold text-green-900">
                                    {generatedResults.total_output_rows}
                                </p>
                                <p className="text-sm text-green-700">Output Rows</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-semibold text-green-900">
                                    {generatedResults.processing_time_seconds}s
                                </p>
                                <p className="text-sm text-green-700">Processing Time</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-semibold text-green-900">
                                    {config.merge_datasets ? '1' : config.row_generation_rules.filter(r => r.enabled).length}
                                </p>
                                <p className="text-sm text-green-700">Output {config.merge_datasets ? 'File' : 'Files'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Results Actions */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-800 mb-3">View & Download Results</h4>

                        <div className="space-y-3">
                            {config.merge_datasets ? (
                                // Single merged result
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-800">Merged Output</p>
                                        <p className="text-sm text-gray-600">
                                            Combined results from all {config.row_generation_rules.filter(r => r.enabled).length} rules
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => onViewResults(generatedResults.transformation_id)}
                                            className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            <Eye size={16} />
                                            <span>View</span>
                                            <ExternalLink size={12} />
                                        </button>
                                        <button
                                            onClick={() => onViewResults(generatedResults.transformation_id)}
                                            className="flex items-center space-x-1 px-3 py-1 bg-emerald-500 text-white rounded hover:bg-blue-600"
                                        >
                                            <Save size={16} />
                                            <span>Save</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Separate results per rule
                                config.row_generation_rules.filter(r => r.enabled).map((rule, index) => (
                                    <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-800">{rule.name}</p>
                                            <p className="text-sm text-gray-600">
                                                Rule {index + 1} output • {rule.output_columns?.length || 0} columns
                                            </p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => onViewResults(`${generatedResults.transformation_id}_rule_${index}`)}
                                                className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                            >
                                                <Eye size={16} />
                                                <span>View</span>
                                                <ExternalLink size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Warnings and Errors */}
                    {generatedResults.warnings && generatedResults.warnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start space-x-2">
                                <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-medium">Warnings:</p>
                                    <ul className="list-disc list-inside mt-1">
                                        {generatedResults.warnings.map((warning, index) => (
                                            <li key={index}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {generatedResults.errors && generatedResults.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start space-x-2">
                                <AlertCircle size={16} className="text-red-600 mt-0.5" />
                                <div className="text-sm text-red-800">
                                    <p className="font-medium">Errors occurred during processing:</p>
                                    <ul className="list-disc list-inside mt-1">
                                        {generatedResults.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        } else {
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                        <AlertCircle size={16} className="text-red-600 mt-0.5" />
                        <div className="text-sm text-red-800">
                            <p className="font-medium">Transformation Failed</p>
                            {generatedResults.errors && generatedResults.errors.length > 0 && (
                                <ul className="list-disc list-inside mt-1">
                                    {generatedResults.errors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };

    const downloadResults = async (resultId, format) => {
        try {
            // Use the transformation API service to download
            const response = await fetch(`/api/transformation/download/${resultId}?format=${format}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transformation_${resultId}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Generate & View Results</h3>
                <p className="text-sm text-gray-600">
                    Review your transformation configuration and generate the output files.
                </p>
            </div>

            {/* Configuration Summary */}
            <div>
                <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center space-x-2">
                    <Info size={18} className="text-blue-600" />
                    <span>Configuration Summary</span>
                </h4>
                {renderConfigSummary()}
            </div>

            {/* Generation Summary Section */}
            <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center space-x-2">
                    <FileText size={18} className="text-green-600" />
                    <span>Generation Summary</span>
                </h4>

                {/* Content Area */}
                <div className="min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                                <p className="text-gray-600">Generating transformation results...</p>
                                <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                            </div>
                        </div>
                    ) : (
                        renderGenerationResults()
                    )}
                </div>
            </div>

            {/* Rule Management Section */}
            {generatedResults && generatedResults.success && (
                <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center space-x-2">
                        <Save size={18} className="text-purple-600" />
                        <span>Rule Management</span>
                    </h4>
                    
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-purple-800">
                                    {loadedRuleId && hasUnsavedChanges 
                                        ? 'Update Transformation Rule' 
                                        : 'Save Transformation Rule'
                                    }
                                </p>
                                <p className="text-sm text-purple-700 mt-1">
                                    {loadedRuleId && hasUnsavedChanges
                                        ? 'You have made changes to the loaded rule. Save your updates to preserve them.'
                                        : 'Save this transformation configuration as a reusable rule for future use.'
                                    }
                                </p>
                                {loadedRuleId && (
                                    <p className="text-xs text-purple-600 mt-1">
                                        Currently using saved rule • {hasUnsavedChanges ? 'Modified' : 'Unchanged'}
                                    </p>
                                )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => onShowRuleModal && onShowRuleModal()}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                >
                                    <Save size={16} />
                                    <span>
                                        {loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Save Rule'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onRetry}
                        className="flex items-center space-x-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        <ArrowLeft size={16} />
                        <span>Modify Rules</span>
                    </button>

                    {generatedResults && (
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            <span>Regenerate</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center space-x-3">
                    {!generatedResults && !isLoading && (
                        <button
                            onClick={onRefresh}
                            className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <Play size={16} />
                            <span>Generate Results</span>
                        </button>
                    )}

                    {generatedResults && generatedResults.success && (
                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-green-600 flex items-center space-x-1">
                                <CheckCircle size={16} />
                                <span>Ready for use</span>
                            </span>
                            <button
                                onClick={onClose}
                                className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                <CheckCircle size={16} />
                                <span>Complete Process</span>
                            </button>
                        </div>
                    )}

                    {/* Show Complete Process button even if results failed or don't exist yet */}
                    {(!generatedResults || !generatedResults.success) && (
                        <button
                            onClick={onClose}
                            className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            <CheckCircle size={16} />
                            <span>Complete Process</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <Info size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How to Use Generated Results:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Click the "View" button to open results in a new tab with the data viewer</li>
                            <li>Use "Download" to save results as CSV, Excel, or other formats</li>
                            <li>If merge is enabled, all rules combine into one output file</li>
                            <li>If merge is disabled, each rule creates a separate output file</li>
                            <li>You can go back to modify rules and regenerate if needed</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewStep;