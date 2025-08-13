import React, { useState, useEffect } from 'react';
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
    Upload
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
    onToggleClosestMatches,
    closestMatchConfig,
    onClosestMatchConfigChange
}) => {
    // State for closest match advanced configuration
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(true);
    
    // State for slow progress animation (400 seconds total)
    const [progress, setProgress] = useState(0);
    const [currentPhase, setCurrentPhase] = useState('');
    
    // Simple processing phases for 400 seconds
    const processingPhases = [
        { text: 'Loading and validating files...', duration: 60 },      // 0-15%
        { text: 'Processing and matching records...', duration: 200 },   // 15-65%
        { text: 'Analyzing unmatched records...', duration: 100 },       // 65-90%
        { text: 'Finalizing results...', duration: 40 }                  // 90-100%
    ];
    
    useEffect(() => {
        let interval;
        let timeElapsed = 0;
        
        if (isLoading) {
            setProgress(0);
            setCurrentPhase(processingPhases[0].text);
            
            interval = setInterval(() => {
                timeElapsed += 1; // 1 second increments
                const progressPercent = Math.min((timeElapsed / 400) * 100, 99); // Cap at 99% until complete
                setProgress(progressPercent);
                
                // Update phase based on progress
                let cumulativeDuration = 0;
                for (let i = 0; i < processingPhases.length; i++) {
                    cumulativeDuration += processingPhases[i].duration;
                    if (timeElapsed <= cumulativeDuration) {
                        setCurrentPhase(processingPhases[i].text);
                        break;
                    }
                }
            }, 1000); // Update every second
        } else {
            setProgress(0);
            setCurrentPhase('');
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);
    
    // When processing completes, set to 100%
    useEffect(() => {
        if (!isLoading && generatedResults && progress > 0) {
            setProgress(100);
            setCurrentPhase('Processing completed!');
        }
    }, [isLoading, generatedResults, progress]);

    const renderConfigSummary = () => {
        const sourceFileCount = config.files ? config.files.length : 2;
        const ruleCount = config.ReconciliationRules ? config.ReconciliationRules.length : 0;
        const extractionRulesCount = config.Files ? 
            config.Files.reduce((total, file) => total + (file.Extract ? file.Extract.length : 0), 0) : 0;
        const filterRulesCount = config.Files ? 
            config.Files.reduce((total, file) => total + (file.Filter ? file.Filter.length : 0), 0) : 0;

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <FileText size={16} className="text-blue-600" />
                            <span className="text-xs font-medium text-blue-800">Source Files</span>
                        </div>
                        <p className="text-xl font-semibold text-blue-900">{sourceFileCount}</p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <Target size={16} className="text-green-600" />
                            <span className="text-xs font-medium text-green-800">Match Rules</span>
                        </div>
                        <p className="text-xl font-semibold text-green-900">{ruleCount}</p>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <Layers size={16} className="text-purple-600" />
                            <span className="text-xs font-medium text-purple-800">Extract Rules</span>
                        </div>
                        <p className="text-xl font-semibold text-purple-900">{extractionRulesCount}</p>
                    </div>

                    <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <CheckCircle size={16} className="text-orange-600" />
                            <span className="text-xs font-medium text-orange-800">Filter Rules</span>
                        </div>
                        <p className="text-xl font-semibold text-orange-900">{filterRulesCount}</p>
                    </div>
                </div>

            </div>
        );
    };

    const renderResults = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    {/* Simple processing icon */}
                    <div className="relative mb-6">
                        <div className="p-4 rounded-full bg-blue-50">
                            <RefreshCw size={32} className="text-blue-500 animate-spin" />
                        </div>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Processing Reconciliation</h3>
                    
                    {/* Current phase text */}
                    <div className="text-center mb-6">
                        <p className="text-blue-600 font-medium text-lg">
                            {currentPhase}
                        </p>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full max-w-md mb-6">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                            <span>Processing large dataset...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                    
                    {/* Time estimation */}
                    <div className="text-center text-sm text-gray-600">
                        <div className="flex items-center justify-center space-x-2">
                            <Clock size={16} />
                            <span>
                                {progress < 5 ? 'Starting process...' : 
                                 progress < 99 ? `Estimated time remaining: ~${Math.round((400 * (100 - progress)) / 100)} seconds` :
                                 'Almost complete...'}
                            </span>
                        </div>
                    </div>
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
                <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-red-600 mb-2">
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
                <div className="space-y-3">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center space-x-1 mb-1">
                                <FileText size={16} className="text-gray-600" />
                                <span className="text-xs font-medium text-gray-800">File A Records</span>
                            </div>
                            <p className="text-xl font-semibold text-gray-900">{totalFileA}</p>
                            <p className="text-xs text-gray-600">all unmatched</p>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center space-x-1 mb-1">
                                <FileText size={16} className="text-gray-600" />
                                <span className="text-xs font-medium text-gray-800">File B Records</span>
                            </div>
                            <p className="text-xl font-semibold text-gray-900">{totalFileB}</p>
                            <p className="text-xs text-gray-600">all unmatched</p>
                        </div>

                        <div className="bg-red-50 p-3 rounded-lg">
                            <div className="flex items-center space-x-1 mb-1">
                                <AlertCircle size={16} className="text-red-600" />
                                <span className="text-xs font-medium text-red-800">Matches Found</span>
                            </div>
                            <p className="text-xl font-semibold text-red-900">0</p>
                            <p className="text-xs text-red-600">0% match rate</p>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="flex items-center space-x-1 mb-1">
                                <Clock size={16} className="text-blue-600" />
                                <span className="text-xs font-medium text-blue-800">Processing</span>
                            </div>
                            <p className="text-xl font-semibold text-blue-900">{processingTime.toFixed(2)}s</p>
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
            <div className="space-y-3">
                {/* Results Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-xs font-medium text-green-800">Matched</span>
                        </div>
                        <p className="text-xl font-semibold text-green-900">{matchedCount}</p>
                        <p className="text-xs text-green-600">{matchPercentage.toFixed(1)}% match rate</p>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <AlertCircle size={16} className="text-yellow-600" />
                            <span className="text-xs font-medium text-yellow-800">Unmatched A</span>
                        </div>
                        <p className="text-xl font-semibold text-yellow-900">{unmatchedACount}</p>
                        <p className="text-xs text-yellow-600">of {totalFileA} total</p>
                    </div>

                    <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <AlertCircle size={16} className="text-orange-600" />
                            <span className="text-xs font-medium text-orange-800">Unmatched B</span>
                        </div>
                        <p className="text-xl font-semibold text-orange-900">{unmatchedBCount}</p>
                        <p className="text-xs text-orange-600">of {totalFileB} total</p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-1 mb-1">
                            <Clock size={16} className="text-blue-600" />
                            <span className="text-xs font-medium text-blue-800">Processing</span>
                        </div>
                        <p className="text-xl font-semibold text-blue-900">{processingTime.toFixed(2)}s</p>
                        <p className="text-xs text-blue-600">processing time</p>
                    </div>
                </div>

                {/* Processing Information */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Processing Details</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="text-gray-600">Time: <span className="font-medium text-gray-800">{processingTime.toFixed(2)}s</span></span>
                        <span className="text-gray-600">Match Rate: <span className="font-medium text-gray-800">{matchPercentage.toFixed(1)}%</span></span>
                        <span className="text-gray-600">Records: <span className="font-medium text-gray-800">A:{totalFileA}, B:{totalFileB}</span></span>
                        {generatedResults.reconciliation_id && (
                            <span className="text-gray-600">ID: <span className="font-medium text-xs bg-gray-200 px-1 py-0.5 rounded">{generatedResults.reconciliation_id}</span></span>
                        )}
                    </div>
                </div>


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
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Generate & View Results</h3>
            </div>

            <div className="space-y-2">
                {/* Configuration Summary */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Configuration Summary</h4>
                    {renderConfigSummary()}
                </div>

                {/* Closest Match Analysis Section */}
                {onToggleClosestMatches && (
                    <div className="border border-gray-200 rounded-lg p-3">
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
                            
                            {findClosestMatches && (
                                <div className="space-y-3 mt-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-purple-800">Advanced Configuration</span>
                                        <button
                                            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                                            className="text-xs text-purple-600 hover:text-purple-800 underline"
                                        >
                                            {showAdvancedConfig ? 'Hide Advanced' : 'Show Advanced'}
                                        </button>
                                    </div>
                                    
                                    {showAdvancedConfig && onClosestMatchConfigChange && closestMatchConfig && (
                                        <div className="bg-white border border-purple-200 rounded p-3 space-y-4">
                                            {/* Column Selection Section */}
                                            <div>
                                                <label className="block text-xs font-medium text-purple-700 mb-2">
                                                    Specific Columns for Comparison (Optional)
                                                </label>
                                                <p className="text-xs text-purple-600 mb-2">
                                                    Select specific column pairs for closest match analysis. If not specified, all reconciliation rule columns will be used.
                                                </p>
                                                
                                                {/* Get available column pairs from reconciliation rules */}
                                                {(() => {
                                                    const availableColumnPairs = config.ReconciliationRules ? 
                                                        config.ReconciliationRules.map(rule => ({
                                                            fileA: rule.LeftFileColumn,
                                                            fileB: rule.RightFileColumn
                                                        })) : [];
                                                    
                                                    const currentSpecificColumns = closestMatchConfig.specific_columns || {};
                                                    
                                                    return availableColumnPairs.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {availableColumnPairs.map((pair, index) => (
                                                                <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded text-xs">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`column-pair-${index}`}
                                                                        checked={currentSpecificColumns[pair.fileA] === pair.fileB}
                                                                        onChange={(e) => {
                                                                            const newSpecificColumns = { ...currentSpecificColumns };
                                                                            if (e.target.checked) {
                                                                                newSpecificColumns[pair.fileA] = pair.fileB;
                                                                            } else {
                                                                                delete newSpecificColumns[pair.fileA];
                                                                            }
                                                                            onClosestMatchConfigChange({ 
                                                                                specific_columns: Object.keys(newSpecificColumns).length > 0 ? newSpecificColumns : null
                                                                            });
                                                                        }}
                                                                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                                                    />
                                                                    <label htmlFor={`column-pair-${index}`} className="text-purple-700">
                                                                        <span className="font-medium">{pair.fileA}</span> ↔ <span className="font-medium">{pair.fileB}</span>
                                                                    </label>
                                                                </div>
                                                            ))}
                                                            
                                                            {Object.keys(currentSpecificColumns).length > 0 && (
                                                                <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                                                                    <span className="font-medium text-purple-800">Selected pairs: </span>
                                                                    <span className="text-purple-700">
                                                                        {Object.entries(currentSpecificColumns).map(([fileA, fileB]) => 
                                                                            `${fileA}↔${fileB}`
                                                                        ).join(', ')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 italic">No reconciliation rules configured</p>
                                                    );
                                                })()}
                                            </div>
                                            
                                        </div>
                                    )}
                                    
                                    <div className="text-sm text-purple-700">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <CheckCircle size={16} className="text-purple-600" />
                                                <span>✓ Will analyze similarity between unmatched records</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <CheckCircle size={16} className="text-purple-600" />
                                                <span>✓ Adds 3 new columns: closest_match_record, closest_match_score, closest_match_details</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <CheckCircle size={16} className="text-purple-600" />
                                                <span>✓ Use specific column pairs or all reconciliation rule columns</span>
                                            </div>
                                            <div className="text-xs text-purple-600 mt-2">
                                                Example: transaction_id: 'TXN002' → 'REF002' (score: 85.2%)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {!findClosestMatches && (
                                <div className="text-sm text-purple-700">
                                    <span>Toggle on to add closest match analysis to the next reconciliation run</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Results Section */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Reconciliation Results</h4>
                    {renderResults()}
                </div>

                {/* Rule Management Section */}
                {generatedResults && (
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center space-x-2">
                            <Save size={16} className="text-blue-600" />
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