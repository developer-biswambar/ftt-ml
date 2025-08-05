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
    Target,
    ExternalLink,
    ArrowLeft,
    Save,
    Layers,
    X,
    Clock,
    Users,
    TrendingUp,
    GitCompare,
    Plus,
    Minus
} from 'lucide-react';

const DeltaPreviewStep = ({
    config,
    generatedResults,
    isLoading,
    onRefresh,
    onViewResults,
    onSaveResults,
    onRetry,
    onUpdateConfig,
    onClose,
    loadedRuleId,
    hasUnsavedChanges,
    onShowRuleModal
}) => {
    const renderConfigSummary = () => {
        const sourceFileCount = config.files ? config.files.length : 2;
        const keyRulesCount = config.KeyRules ? config.KeyRules.length : 0;
        const comparisonRulesCount = config.ComparisonRules ? config.ComparisonRules.length : 0;
        const filterRulesCount = config.Files ? 
            config.Files.reduce((total, file) => total + (file.Filter ? file.Filter.length : 0), 0) : 0;

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <FileText size={20} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Source Files</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">{sourceFileCount}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Target size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Key Rules</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">{keyRulesCount}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <GitCompare size={20} className="text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Comparison Rules</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-600">{comparisonRulesCount || 'Auto'}</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Layers size={20} className="text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">Filter Rules</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-600">{filterRulesCount}</div>
                    </div>
                </div>

                {/* User Requirements */}
                {config.user_requirements && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Users size={16} className="text-gray-600" />
                            <span className="text-gray-600">Requirements:</span>
                            <p className="mt-1 text-gray-800">{config.user_requirements}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.Files && config.Files.map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <h5 className="font-medium text-gray-800 mb-2">
                                File {String.fromCharCode(65 + index)} Configuration ({index === 0 ? 'Older' : 'Newer'})
                            </h5>
                            <div className="space-y-1 text-sm text-gray-600">
                                <div>Extract Rules: {file.Extract ? file.Extract.length : 0}</div>
                                <div>Filter Rules: {file.Filter ? file.Filter.length : 0}</div>
                                {config.selected_columns_file_a && index === 0 && (
                                    <div>Selected Columns: {config.selected_columns_file_a.length}</div>
                                )}
                                {config.selected_columns_file_b && index === 1 && (
                                    <div>Selected Columns: {config.selected_columns_file_b.length}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Key Rules Summary */}
                {config.KeyRules && config.KeyRules.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-3">Key Matching Rules</h5>
                        <div className="space-y-2">
                            {config.KeyRules.map((rule, index) => (
                                <div key={index} className="flex items-center space-x-2 text-sm">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-gray-700">
                                        <strong>{rule.LeftFileColumn}</strong> ↔ <strong>{rule.RightFileColumn}</strong>
                                        ({rule.MatchType}{rule.ToleranceValue ? `, tolerance: ${rule.ToleranceValue}` : ''})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Comparison Rules Summary */}
                {config.ComparisonRules && config.ComparisonRules.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-3">Comparison Rules</h5>
                        <div className="space-y-2">
                            {config.ComparisonRules.map((rule, index) => (
                                <div key={index} className="flex items-center space-x-2 text-sm">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-gray-700">
                                        <strong>{rule.LeftFileColumn}</strong> ↔ <strong>{rule.RightFileColumn}</strong>
                                        ({rule.MatchType}{rule.ToleranceValue ? `, tolerance: ${rule.ToleranceValue}` : ''})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderResults = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-blue-500 animate-spin mb-4" />
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Processing Delta Generation</h3>
                    <p className="text-gray-600 text-center max-w-md">
                        Comparing files and identifying changes. This may take a few moments...
                    </p>
                </div>
            );
        }

        if (!generatedResults) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <AlertCircle size={48} className="text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Results Generated</h3>
                    <p className="text-gray-600 text-center max-w-md mb-4">
                        Click "Generate Results" to run the delta analysis with your current configuration.
                    </p>
                </div>
            );
        }

        // Show results summary
        const summary = generatedResults.summary || {};
        const totalRecords = summary.total_old_records || 0;
        const totalNewRecords = summary.total_new_records || 0;
        const unchangedRecords = summary.unchanged_records || 0;
        const amendedRecords = summary.amended_records || 0;
        const deletedRecords = summary.deleted_records || 0;
        const newlyAddedRecords = summary.newly_added_records || 0;

        return (
            <div className="space-y-6">
                {/* Success Message */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <CheckCircle size={20} className="text-green-600" />
                        <h4 className="font-medium text-green-800">Delta Analysis Complete</h4>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                        Successfully analyzed {totalRecords.toLocaleString()} records from older file and {totalNewRecords.toLocaleString()} records from newer file.
                    </p>
                </div>

                {/* Results Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-600 mb-1">{unchangedRecords.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Unchanged</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600 mb-1">{amendedRecords.toLocaleString()}</div>
                        <div className="text-sm text-yellow-600">Amended</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600 mb-1">{deletedRecords.toLocaleString()}</div>
                        <div className="text-sm text-red-600">Deleted</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600 mb-1">{newlyAddedRecords.toLocaleString()}</div>
                        <div className="text-sm text-green-600">Newly Added</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => onViewResults(generatedResults.delta_id + '_all')}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        <Eye size={16} />
                        <span>View All Results</span>
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={() => onViewResults(generatedResults.delta_id + '_amended')}
                        className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                        <Eye size={16} />
                        <span>View Amended</span>
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={() => onViewResults(generatedResults.delta_id + '_deleted')}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                        <Eye size={16} />
                        <span>View Deleted</span>
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={() => onViewResults(generatedResults.delta_id + '_newly_added')}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                        <Eye size={16} />
                        <span>View Added</span>
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={() => onViewResults(generatedResults.delta_id + '_unchanged')}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                    >
                        <Eye size={16} />
                        <span>View Unchanged</span>
                        <ExternalLink size={14} />
                    </button>

                    <button
                        onClick={onRefresh}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                        <RefreshCw size={16} />
                        <span>Regenerate</span>
                    </button>
                </div>

                {/* Processing Time */}
                {summary.processing_time && (
                    <div className="text-sm text-gray-600 flex items-center space-x-1">
                        <Clock size={14} />
                        <span>Processing time: {summary.processing_time}s</span>
                    </div>
                )}

                {/* Warnings */}
                {generatedResults.warnings && generatedResults.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                            {generatedResults.warnings.map((warning, index) => (
                                <li key={index}>• {warning}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Generate & View Delta Results</h3>
                {!isLoading && !generatedResults && (
                    <button
                        onClick={onRefresh}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        <Play size={16} />
                        <span>Generate Results</span>
                    </button>
                )}
            </div>

            <div className="space-y-6">
                {/* Configuration Summary */}
                <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Configuration Summary</h4>
                    {renderConfigSummary()}
                </div>

                {/* Results Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Delta Analysis Results</h4>
                    {renderResults()}
                </div>

                {/* Rule Management Section */}
                {generatedResults && generatedResults.success && (
                    <div className="border border-gray-200 rounded-lg p-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <Save size={18} className="text-orange-600" />
                            <span>Rule Management</span>
                        </h4>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-orange-800">
                                        {loadedRuleId && hasUnsavedChanges 
                                            ? 'Update Delta Rule' 
                                            : 'Save Delta Rule'
                                        }
                                    </p>
                                    <p className="text-sm text-orange-700 mt-1">
                                        {loadedRuleId && hasUnsavedChanges
                                            ? 'You have made changes to the loaded rule. Save your updates to preserve them.'
                                            : 'Save this delta configuration as a reusable rule for future use.'
                                        }
                                    </p>
                                    {loadedRuleId && (
                                        <p className="text-xs text-orange-600 mt-1">
                                            Currently using saved rule • {hasUnsavedChanges ? 'Modified' : 'Unchanged'}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => onShowRuleModal && onShowRuleModal()}
                                        className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
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
            </div>
        </div>
    );
};

export default DeltaPreviewStep;