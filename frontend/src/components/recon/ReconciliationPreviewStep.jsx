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
    TrendingUp
} from 'lucide-react';

const ReconciliationPreviewStep = ({
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
    onShowRuleModal,
    findClosestMatches = false,
    onToggleClosestMatches
}) => {
    // Remove viewMode state since we're combining into single view

    const renderConfigSummary = () => {
        const sourceFileCount = config.files ? config.files.length : 2;
        const ruleCount = config.ReconciliationRules ? config.ReconciliationRules.length : 0;
        const extractionRulesCount = config.Files ? 
            config.Files.reduce((total, file) => total + (file.Extract ? file.Extract.length : 0), 0) : 0;
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
                        <p className="text-2xl font-semibold text-blue-900">{sourceFileCount}</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Target size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Match Rules</span>
                        </div>
                        <p className="text-2xl font-semibold text-green-900">{ruleCount}</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Layers size={20} className="text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Extract Rules</span>
                        </div>
                        <p className="text-2xl font-semibold text-purple-900">{extractionRulesCount}</p>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={20} className="text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">Filter Rules</span>
                        </div>
                        <p className="text-2xl font-semibold text-orange-900">{filterRulesCount}</p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">Reconciliation Configuration</h4>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Configuration:</span>
                            <span className="font-medium">Custom Reconciliation</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600">Files to Process:</span>
                            <span className="font-medium">{sourceFileCount} files</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600">Match Rules:</span>
                            <span className="font-medium">{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
                        </div>

                        {config.user_requirements && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-gray-600">Requirements:</span>
                                <p className="mt-1 text-gray-800">{config.user_requirements}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.Files && config.Files.map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <h5 className="font-medium text-gray-800 mb-2">
                                File {String.fromCharCode(65 + index)} Configuration
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
            </div>
        );
    };

    const renderResults = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-blue-500 animate-spin mb-4" />
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Processing Reconciliation</h3>
                    <p className="text-gray-600 text-center max-w-md">
                        Analyzing files and applying reconciliation rules. This may take a few moments...
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
                        Click "Generate Results" to run the reconciliation process with your current configuration.
                    </p>
                    <button
                        onClick={onRefresh}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        <Play size={16} />
                        <span>Generate Results</span>
                    </button>
                </div>
            );
        }

        if (generatedResults.errors && generatedResults.errors.length > 0) {
            return (
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-red-600 mb-4">
                        <AlertCircle size={20} />
                        <h3 className="text-lg font-medium">Reconciliation Failed</h3>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                            {generatedResults.errors.map((error, index) => (
                                <li key={index}>• {error}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={onRetry}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <ArrowLeft size={16} />
                            <span>Modify Configuration</span>
                        </button>
                        <button
                            onClick={onRefresh}
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            <RefreshCw size={16} />
                            <span>Retry</span>
                        </button>
                    </div>
                </div>
            );
        }

        // Success case - handle actual API response structure (data is directly on root, no summary wrapper)
        const matchedCount = generatedResults.matched_count || 0;
        const unmatchedACount = generatedResults.unmatched_file_a_count || 0;
        const unmatchedBCount = generatedResults.unmatched_file_b_count || 0;
        const totalFileA = generatedResults.total_records_file_a || 0;
        const totalFileB = generatedResults.total_records_file_b || 0;
        const processingTime = generatedResults.processing_time || 0;
        const matchPercentage = generatedResults.match_percentage || 0;

        // Check if this is a "no matches" scenario
        const hasNoMatches = matchedCount === 0 && (totalFileA > 0 || totalFileB > 0);

        if (hasNoMatches) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center space-x-2 text-blue-600 mb-4">
                        <AlertCircle size={20} />
                        <h3 className="text-lg font-medium">Reconciliation Complete - No Matches Found</h3>
                    </div>

                    {/* No Matches Info Panel */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start space-x-3">
                            <AlertCircle size={24} className="text-blue-600 mt-1 flex-shrink-0" />
                            <div className="flex-grow">
                                <h4 className="font-medium text-blue-800 mb-2">No matching records were found</h4>
                                <p className="text-blue-700 text-sm mb-4">
                                    The reconciliation process completed successfully, but no records from File A matched any records from File B using your current matching rules.
                                </p>
                                <div className="bg-blue-100 rounded p-3 text-sm">
                                    <p className="font-medium text-blue-800 mb-2">This could happen when:</p>
                                    <ul className="text-blue-700 space-y-1 list-disc list-inside">
                                        <li>The files contain completely different datasets</li>
                                        <li>Matching rules are too strict (try adjusting tolerance values)</li>
                                        <li>Column names or data formats don't align between files</li>
                                        <li>Date formats or case sensitivity cause mismatches</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Processing Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <FileText size={20} className="text-gray-600" />
                                <span className="text-sm font-medium text-gray-800">File A Records</span>
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">{totalFileA}</p>
                            <p className="text-xs text-gray-600">all unmatched</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <FileText size={20} className="text-gray-600" />
                                <span className="text-sm font-medium text-gray-800">File B Records</span>
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">{totalFileB}</p>
                            <p className="text-xs text-gray-600">all unmatched</p>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <AlertCircle size={20} className="text-red-600" />
                                <span className="text-sm font-medium text-red-800">Matches Found</span>
                            </div>
                            <p className="text-2xl font-semibold text-red-900">0</p>
                            <p className="text-xs text-red-600">0% match rate</p>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <Clock size={20} className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">Processing</span>
                            </div>
                            <p className="text-2xl font-semibold text-blue-900">{processingTime.toFixed(2)}s</p>
                            <p className="text-xs text-blue-600">processing time</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={onRetry}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <ArrowLeft size={16} />
                            <span>Adjust Matching Rules</span>
                        </button>

                        <button
                            onClick={onRefresh}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            <RefreshCw size={16} />
                            <span>Retry Reconciliation</span>
                        </button>

                        {/* Still show view buttons for unmatched data */}
                        {(unmatchedACount > 0 || unmatchedBCount > 0) && (
                            <button
                                onClick={() => onViewResults(generatedResults.reconciliation_id+'_all')}
                                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                            >
                                <Eye size={16} />
                                <span>View Unmatched Records</span>
                                <ExternalLink size={14} />
                            </button>
                        )}
                    </div>

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
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-green-600 mb-4">
                    <CheckCircle size={20} />
                    <h3 className="text-lg font-medium">Reconciliation Complete</h3>
                </div>

                {/* Results Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Matched</span>
                        </div>
                        <p className="text-2xl font-semibold text-green-900">{matchedCount}</p>
                        <p className="text-xs text-green-600">{matchPercentage.toFixed(1)}% match rate</p>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle size={20} className="text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">Unmatched A</span>
                        </div>
                        <p className="text-2xl font-semibold text-yellow-900">{unmatchedACount}</p>
                        <p className="text-xs text-yellow-600">of {totalFileA} total</p>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle size={20} className="text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">Unmatched B</span>
                        </div>
                        <p className="text-2xl font-semibold text-orange-900">{unmatchedBCount}</p>
                        <p className="text-xs text-orange-600">of {totalFileB} total</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Clock size={20} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Processing</span>
                        </div>
                        <p className="text-2xl font-semibold text-blue-900">{processingTime.toFixed(2)}s</p>
                        <p className="text-xs text-blue-600">processing time</p>
                    </div>
                </div>

                {/* Processing Information */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">Processing Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Clock size={16} className="text-gray-500" />
                                <span className="text-gray-600">Processing Time:</span>
                                <span className="font-medium">{processingTime.toFixed(3)}s</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Target size={16} className="text-gray-500" />
                                <span className="text-gray-600">Match Percentage:</span>
                                <span className="font-medium">{matchPercentage.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <TrendingUp size={16} className="text-gray-500" />
                                <span className="text-gray-600">Total Records:</span>
                                <span className="font-medium">File A: {totalFileA}, File B: {totalFileB}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {generatedResults.reconciliation_id && (
                                <div className="flex items-center space-x-2">
                                    <FileText size={16} className="text-gray-500" />
                                    <span className="text-gray-600">ID:</span>
                                    <span className="font-medium text-xs bg-gray-200 px-2 py-1 rounded">{generatedResults.reconciliation_id}</span>
                                </div>
                            )}
                            {generatedResults.processing_info && (
                                <div className="text-xs text-gray-600 mt-2">
                                    <div>✓ Hash-based matching: {generatedResults.processing_info.hash_based_matching ? 'Enabled' : 'Disabled'}</div>
                                    <div>✓ Optimization: {generatedResults.processing_info.optimization_used ? 'Enabled' : 'Disabled'}</div>
                                    <div>✓ Vectorized extraction: {generatedResults.processing_info.vectorized_extraction ? 'Enabled' : 'Disabled'}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Closest Match Options */}
                {onToggleClosestMatches && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="font-medium text-purple-800">Closest Match Analysis</h4>
                                <p className="text-sm text-purple-700">
                                    {findClosestMatches ? 'Adding closest match suggestions to unmatched records' : 'Enable to find potential matches for unmatched records'}
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={findClosestMatches}
                                    onChange={(e) => onToggleClosestMatches(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                        <div className="text-sm text-purple-700">
                            {findClosestMatches ? (
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <CheckCircle size={16} className="text-purple-600" />
                                        <span>✓ Will analyze similarity between unmatched records</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <CheckCircle size={16} className="text-purple-600" />
                                        <span>✓ Adds 3 new columns: closest_match_record, closest_match_score, closest_match_details</span>
                                    </div>
                                    <div className="text-xs text-purple-600 mt-2">
                                        Example: transaction_id: 'TXN002' → 'REF002'
                                    </div>
                                </div>
                            ) : (
                                <span>Toggle on to add closest match analysis to the next reconciliation run</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    {/* View Matched Results - Success Green */}
                    <button
                        onClick={matchedCount > 0 ? () => onViewResults(generatedResults.reconciliation_id+'_matched') : undefined}
                        disabled={matchedCount === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm ${
                            matchedCount > 0 
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md transform hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={matchedCount === 0 ? 'No matched records available to view' : 'View matched records'}
                    >
                        <Eye size={16} />
                        <span>View Matched Results</span>
                        <ExternalLink size={14} />
                    </button>
                    
                    {/* View Unmatched A Results - Warning Amber */}
                    <button
                        onClick={unmatchedACount > 0? () => onViewResults(generatedResults.reconciliation_id+'_unmatched_a') : undefined}
                        disabled={unmatchedACount === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm ${
                            (unmatchedACount > 0)
                                ? 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-md transform hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={unmatchedACount === 0  ? 'No records available for Unmatched A' : 'View Unmatched A results'}
                    >
                        <Eye size={16} />
                        <span>View Unmatched A Results</span>
                        <ExternalLink size={14} />
                    </button>
                    
                    {/* View Unmatched B Results - Warning Orange */}
                    <button
                        onClick={unmatchedBCount > 0? () => onViewResults(generatedResults.reconciliation_id+'_unmatched_b') : undefined}
                        disabled={unmatchedBCount === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm ${
                            (unmatchedBCount > 0)
                                ? 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-md transform hover:-translate-y-0.5'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={unmatchedBCount === 0  ? 'No records available for Unmatched B' : 'View Unmatched B results'}
                    >
                        <Eye size={16} />
                        <span>View Unmatched B Results</span>
                        <ExternalLink size={14} />
                    </button>

                    {/* Regenerate - Primary Blue */}
                    <button
                        onClick={onRefresh}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    >
                        <RefreshCw size={16} />
                        <span>Regenerate</span>
                    </button>

                    {/* Modify Config - Secondary Purple */}
                    <button
                        onClick={onRetry}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    >
                        <ArrowLeft size={16} />
                        <span>Modify Config</span>
                    </button>
                </div>

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
                <h3 className="text-lg font-semibold text-gray-800">Generate & View Results</h3>
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
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Reconciliation Results</h4>
                    {renderResults()}
                </div>

                {/* Rule Management Section */}
                {generatedResults && generatedResults.success && (
                    <div className="border border-gray-200 rounded-lg p-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <Save size={18} className="text-blue-600" />
                            <span>Rule Management</span>
                        </h4>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-blue-800">
                                        {loadedRuleId && hasUnsavedChanges 
                                            ? 'Update Reconciliation Rule' 
                                            : 'Save Reconciliation Rule'
                                        }
                                    </p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        {loadedRuleId && hasUnsavedChanges
                                            ? 'You have made changes to the loaded rule. Save your updates to preserve them.'
                                            : 'Save this reconciliation configuration as a reusable rule for future use.'
                                        }
                                    </p>
                                    {loadedRuleId && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            Currently using saved rule • {hasUnsavedChanges ? 'Modified' : 'Unchanged'}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => onShowRuleModal && onShowRuleModal()}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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

export default ReconciliationPreviewStep;