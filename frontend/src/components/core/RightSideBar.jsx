import {
    AlertCircle,
    BarChart3,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock, Delete,
    Download,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    FileText,
    GitCompare,
    History,
    Loader,
    RefreshCw,
    Save,
    Server,
    Settings,
    Shuffle,
    X,
    Zap
} from 'lucide-react';
import {useEffect, useState} from "react";

const RightSidebar = ({
                          processedFiles = [],
                          autoRefreshInterval,
                          onRefreshProcessedFiles,
                          onDownloadResults,
                          onDisplayDetailedResults,
                          onOpenRecentResults,
                          width = 320,
                          onProcessedFilesUpdate
                      }) => {

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showDeleteRecentResultModal, setShowDeleteRecentResultModal] = useState(false);
    const [saveModalData, setSaveModalData] = useState(null);
    const [customFilename, setCustomFilename] = useState('');
    const [description, setDescription] = useState('');
    const [saveInProgress, setSaveInProgress] = useState(false);
    const [loadingRecentResults, setLoadingRecentResults] = useState(false);
    const [localProcessedFiles, setLocalProcessedFiles] = useState(processedFiles);

    // State for tracking expanded results
    const [expandedResults, setExpandedResults] = useState(new Set());

    // Load recent results on component mount and merge with processedFiles
    useEffect(() => {
        const mergeResults = async () => {
            if (processedFiles.length === 0 && !loadingRecentResults) {
                // No current processed files, load from server
                await loadRecentResults();
            } else {
                // Merge current processed files with recent results from server
                try {
                    const {deltaApiService} = await import('../../services/deltaApiService.js');
                    const recentResults = await deltaApiService.loadRecentResultsForSidebar(10);

                    // Create a merged list, avoiding duplicates
                    const mergedResults = [...processedFiles];

                    // Add recent results that aren't already in processedFiles
                    recentResults.forEach(recentResult => {
                        const existsInProcessed = processedFiles.some(pf =>
                            (pf.delta_id && pf.delta_id === recentResult.delta_id) ||
                            (pf.reconciliation_id && pf.reconciliation_id === recentResult.reconciliation_id) ||
                            (pf.generation_id && pf.generation_id === recentResult.generation_id) ||
                            (pf.process_id && pf.process_id === recentResult.process_id) ||
                            (pf.id && pf.id === recentResult.id)
                        );

                        if (!existsInProcessed) {
                            mergedResults.push(recentResult);
                        }
                    });

                    // Sort by creation date (newest first)
                    mergedResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    setLocalProcessedFiles(mergedResults);

                    if (onProcessedFilesUpdate) {
                        onProcessedFilesUpdate(mergedResults);
                    }
                } catch (error) {
                    console.error('Error merging results:', error);
                    // Fallback to just using processedFiles
                    setLocalProcessedFiles(processedFiles);
                }
            }
        };

        mergeResults();
    }, [processedFiles]);

    // Function to toggle expanded state for a result
    const toggleExpanded = (resultId) => {
        setExpandedResults(prev => {
            const newSet = new Set(prev);
            if (newSet.has(resultId)) {
                newSet.delete(resultId);
            } else {
                newSet.add(resultId);
            }
            return newSet;
        });
    };

    // Load recent results from server and merge with existing if needed
    const loadRecentResults = async () => {
        setLoadingRecentResults(true);
        try {
            // Import deltaApiService dynamically
            const {deltaApiService} = await import('../../services/deltaApiService.js');

            const recentResults = await deltaApiService.loadRecentResultsForSidebar(10);

            if (recentResults && recentResults.length > 0) {
                // If we have current processedFiles, merge them
                if (processedFiles.length > 0) {
                    const mergedResults = [...processedFiles];

                    // Add recent results that aren't already in processedFiles
                    recentResults.forEach(recentResult => {
                        const existsInProcessed = processedFiles.some(pf =>
                            (pf.delta_id && pf.delta_id === recentResult.delta_id) ||
                            (pf.reconciliation_id && pf.reconciliation_id === recentResult.reconciliation_id) ||
                            (pf.process_id && pf.process_id === recentResult.process_id) ||
                            (pf.id && pf.id === recentResult.id)
                        );

                        if (!existsInProcessed) {
                            mergedResults.push(recentResult);
                        }
                    });

                    // Sort by creation date (newest first)
                    mergedResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    setLocalProcessedFiles(mergedResults);

                    if (onProcessedFilesUpdate) {
                        onProcessedFilesUpdate(mergedResults);
                    }
                } else {
                    // No current processed files, just use recent results
                    setLocalProcessedFiles(recentResults);

                    if (onProcessedFilesUpdate) {
                        onProcessedFilesUpdate(recentResults);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading recent results:', error);
        } finally {
            setLoadingRecentResults(false);
        }
    };

    // Refresh function that combines local refresh with recent results loading and merges them
    const handleRefresh = async () => {
        try {
            // First refresh processed files if the function exists
            if (onRefreshProcessedFiles) {
                await onRefreshProcessedFiles();
            }

            // Then load recent results from server
            const {deltaApiService} = await import('../../services/deltaApiService.js');
            const recentResults = await deltaApiService.loadRecentResultsForSidebar(10);

            // Merge with current processedFiles
            const mergedResults = [...(processedFiles || [])];

            // Add recent results that aren't already in processedFiles
            recentResults.forEach(recentResult => {
                const existsInProcessed = mergedResults.some(pf =>
                    (pf.delta_id && pf.delta_id === recentResult.delta_id) ||
                    (pf.reconciliation_id && pf.reconciliation_id === recentResult.reconciliation_id) ||
                    (pf.process_id && pf.process_id === recentResult.process_id) ||
                    (pf.id && pf.id === recentResult.id)
                );

                if (!existsInProcessed) {
                    mergedResults.push(recentResult);
                }
            });

            // Sort by creation date (newest first)
            mergedResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setLocalProcessedFiles(mergedResults);

            if (onProcessedFilesUpdate) {
                onProcessedFilesUpdate(mergedResults);
            }
        } catch (error) {
            console.error('Error during refresh:', error);
        }
    };

    // Helper function to get process type icon and color
    const getProcessTypeInfo = (processedFile) => {
        // Check if it's a delta generation
        if (processedFile.delta_id) {
            return {
                icon: GitCompare,
                color: 'purple',
                label: 'Delta Generation',
                id: processedFile.delta_id,
                type: 'delta'
            };
        }
        // Check if it's a reconciliation
        else if (processedFile.reconciliation_id) {
            return {
                icon: Shuffle,
                color: 'blue',
                label: 'Reconciliation',
                id: processedFile.reconciliation_id,
                type: 'reconciliation'
            };
        }
        // Check if it's a file generation
        else if (processedFile.generation_id) {
            return {
                icon: Zap,
                color: 'green',
                label: 'AI File Generation',
                id: processedFile.generation_id,
                type: 'file_generation'
            };
        }
        // Default for other process types
        else {
            return {
                icon: Settings,
                color: 'gray',
                label: processedFile.process_type || 'Processing',
                id: processedFile.process_id || processedFile.id,
                type: 'other'
            };
        }
    };

    // Helper function to get summary statistics based on process type
    const getSummaryStats = (processedFile) => {
        const processInfo = getProcessTypeInfo(processedFile);

        if (processInfo.type === 'delta') {
            const summary = processedFile.summary || {};
            return {
                stat1: {label: 'Unchanged', value: summary.unchanged_records || 0, color: 'green'},
                stat2: {label: 'Amended', value: summary.amended_records || 0, color: 'orange'},
                stat3: {label: 'Deleted', value: summary.deleted_records || 0, color: 'red'},
                stat4: {label: 'Added', value: summary.newly_added_records || 0, color: 'purple'}
            };
        } else if (processInfo.type === 'reconciliation') {
            const summary = processedFile.summary || {};
            return {
                stat1: {label: 'Match Rate', value: `${(summary.match_percentage || 0).toFixed(1)}%`, color: 'green'},
                stat2: {label: 'Confidence', value: `${(summary.match_percentage || 0).toFixed(1)}%`, color: 'blue'},
                stat3: {label: 'Matched', value: summary.matched_records || 0, color: 'green'},
                stat4: {
                    label: 'Unmatched',
                    value: (summary.unmatched_file_a || 0) + (summary.unmatched_file_b || 0),
                    color: 'orange'
                }
            };
        } else if (processInfo.type === 'file_generation') {
            const summary = processedFile.summary || {};
            return {
                stat1: {label: 'Input Rows', value: summary.input_records || 0, color: 'blue'},
                stat2: {label: 'Output Rows', value: summary.output_records || 0, color: 'green'},
                stat3: {label: 'Columns', value: summary.columns_generated, color: 'purple'},
                stat4: {label: 'Errors', value: summary.processing_info.errors || 0, color: 'red'},
            };
        } else {
            // Generic stats for other process types
            const summary = processedFile.summary || {};
            return {
                stat1: {label: 'Success Rate', value: `${(summary.success_rate || 0).toFixed(1)}%`, color: 'green'},
                stat2: {label: 'Processed', value: summary.total_processed || 0, color: 'blue'},
                stat3: {label: 'Errors', value: summary.total_errors || 0, color: 'red'},
                stat4: {label: 'Warnings', value: summary.total_warnings || 0, color: 'orange'}
            };
        }
    };

    // Helper function to get download options based on process type
    const getDownloadOptions = (processedFile) => {
        const processInfo = getProcessTypeInfo(processedFile);

        if (processInfo.type === 'delta') {
            return {
                primary: [
                    {key: 'unchanged', label: 'Unchanged', color: 'green', icon: Download},
                    {key: 'amended', label: 'Amended', color: 'orange', icon: Download},
                    {key: 'deleted', label: 'Deleted', color: 'red', icon: Download}
                ],
                secondary: [
                    {key: 'newly_added', label: 'Added', color: 'purple', icon: Download},
                    {key: 'all_changes', label: 'All Changes', color: 'indigo', icon: Download},
                    {key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet}
                ],
                extra: [
                    {key: 'summary_report', label: 'Report', color: 'gray', icon: FileText}
                ]
            };
        } else if (processInfo.type === 'reconciliation') {
            return {
                primary: [
                    {key: 'matched', label: 'Matched', color: 'green', icon: Download},
                    {key: 'unmatched_a', label: 'A Only', color: 'orange', icon: Download},
                    {key: 'unmatched_b', label: 'B Only', color: 'purple', icon: Download}
                ],
                secondary: [
                    {key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet},
                    {key: 'summary_report', label: 'Report', color: 'gray', icon: FileText}
                ],
                extra: []
            };
        } else if (processInfo.type === 'file_generation') {
            return {
                primary: [
                    {key: 'all', label: 'Generated File', color: 'green', icon: Download}
                ],
                secondary: [
                    {key: 'all_excel', label: 'Excel Format', color: 'indigo', icon: FileSpreadsheet},
                    {key: 'summary_report', label: 'Report', color: 'gray', icon: FileText}
                ],
                extra: []
            };
        } else {
            // Generic download options for other process types
            return {
                primary: [
                    {key: 'results', label: 'Results', color: 'blue', icon: Download},
                    {key: 'errors', label: 'Errors', color: 'red', icon: Download}
                ],
                secondary: [
                    {key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet},
                    {key: 'summary_report', label: 'Report', color: 'gray', icon: FileText}
                ],
                extra: []
            };
        }
    };

    // Handle save to server
    const handleSaveToServer = (processId, downloadType, processedFile) => {
        const processInfo = getProcessTypeInfo(processedFile);
        setSaveModalData({
            processId,
            downloadType,
            processedFile,
            processInfo
        });
        setCustomFilename('');
        setDescription('');
        setShowSaveModal(true);
    };

    // Confirm save to server
    const confirmSaveToServer = async () => {
        if (!saveModalData) return;

        setSaveInProgress(true);
        try {
            // Import the deltaApiService for saving
            const {deltaApiService} = await import('../../services/deltaApiService.js');
            const {transformationApiService} = await import('../../services/transformationApiService.js');

            let result;
            const {processId, downloadType, processInfo} = saveModalData;

            if (processInfo.type === 'delta') {
                let resultType = downloadType;
                let format = 'csv';

                // Handle special cases
                if (downloadType === 'all_excel') {
                    format = 'excel';
                    resultType = 'all';
                } else if (downloadType === 'summary_report') {
                    // Handle summary differently
                    alert('Summary reports are downloaded directly, not saved to server.');
                    return;
                }

                result = await deltaApiService.saveDeltaResultsToServer(
                    processId,
                    resultType,
                    format,
                    customFilename.trim() || null,
                    description.trim() || null
                );
            } else if (processInfo.type === 'reconciliation') {
                result = await deltaApiService.saveReconciliationResultsToServer(
                    processId,
                    downloadType,
                    'csv',
                    customFilename.trim() || null,
                    description.trim() || null
                );
            } else if (processInfo.type === 'file_generation') {

                result = await transformationApiService.saveTransformationResultsToServer(
                    processId,
                    downloadType,
                    'csv',
                    customFilename.trim() || null,
                    description.trim() || null
                )

            }

            if (result.success) {
                alert(`Results saved successfully! ${result.message}`);
                setShowSaveModal(false);
                setSaveModalData(null);
            } else {
                throw new Error(result.message || 'Save failed');
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            alert(`Failed to save results: ${error.message}`);
        } finally {
            setSaveInProgress(false);
        }
    };

    const closeSaveModal = () => {
        if (saveInProgress) return;
        setShowSaveModal(false);
        setSaveModalData(null);
        setCustomFilename('');
        setDescription('');
    };

    return (
        <>
            <div
                className="bg-white border-l border-gray-200 flex flex-col"
                style={{width: `${width}px`}}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">📈 Results</h2>
                        <div className="flex items-center space-x-2">
                            {autoRefreshInterval && (
                                <div className="flex items-center space-x-1 text-xs text-blue-600">
                                    <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span>Auto-refresh</span>
                                </div>
                            )}
                            {loadingRecentResults && (
                                <div className="flex items-center space-x-1 text-xs text-gray-600">
                                    <Loader size={12} className="animate-spin"/>
                                    <span>Loading...</span>
                                </div>
                            )}
                            <button
                                onClick={handleRefresh}
                                disabled={loadingRecentResults}
                                className="text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                                title="Refresh results"
                            >
                                <RefreshCw size={14} className={loadingRecentResults ? 'animate-spin' : ''}/>
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {autoRefreshInterval ? 'Auto-updating every 3 seconds' : localProcessedFiles.length > 0 ? `Showing ${localProcessedFiles.length} recent results` : 'Recent processes & downloads'}
                    </p>

                    {/* View All Results Button */}
                    {localProcessedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <button
                                onClick={onOpenRecentResults}
                                className="w-full inline-flex items-center justify-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                                title="Open detailed results view in new tab"
                            >
                                <History className="w-4 h-4 mr-2"/>
                                <span>View All Results</span>
                                <ExternalLink className="w-3 h-3 ml-2"/>
                            </button>

                            {/* Expand/Collapse All Toggle Button */}
                            <button
                                onClick={() => {
                                    const allIds = localProcessedFiles.map(file => getProcessTypeInfo(file).id);
                                    const allExpanded = allIds.every(id => expandedResults.has(id));

                                    if (allExpanded) {
                                        // All are expanded, so collapse all
                                        setExpandedResults(new Set());
                                    } else {
                                        // Not all are expanded, so expand all
                                        setExpandedResults(new Set(allIds));
                                    }
                                }}
                                className="w-full inline-flex items-center justify-center px-2 py-1.5 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                                title={(() => {
                                    const allIds = localProcessedFiles.map(file => getProcessTypeInfo(file).id);
                                    const allExpanded = allIds.every(id => expandedResults.has(id));
                                    return allExpanded ? "Collapse all results" : "Expand all results";
                                })()}
                            >
                                {(() => {
                                    const allIds = localProcessedFiles.map(file => getProcessTypeInfo(file).id);
                                    const allExpanded = allIds.every(id => expandedResults.has(id));

                                    if (allExpanded) {
                                        return (
                                            <>
                                                <ChevronRight className="w-3 h-3 mr-1"/>
                                                <span>Collapse All</span>
                                            </>
                                        );
                                    } else {
                                        return (
                                            <>
                                                <ChevronDown className="w-3 h-3 mr-1"/>
                                                <span>Expand All</span>
                                            </>
                                        );
                                    }
                                })()}
                            </button>
                        </div>
                    )}
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loadingRecentResults ? (
                        <div className="text-center text-gray-500 mt-8">
                            <Loader size={48} className="mx-auto opacity-30 mb-3 animate-spin"/>
                            <p className="text-sm">Loading recent results...</p>
                            <p className="text-xs mt-1">Please wait while we fetch your recent processes</p>
                        </div>
                    ) : localProcessedFiles.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                            <FileText size={48} className="mx-auto opacity-30 mb-3"/>
                            <p className="text-sm">No recent processes</p>
                            <p className="text-xs mt-1">Start a process to see results here</p>
                            <button
                                onClick={handleRefresh}
                                className="mt-3 px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                            >
                                Check for Recent Results
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {localProcessedFiles.map((processedFile) => {

                                if (processedFile.status === 'processing') {
                                    console.error(processedFile);
                                    return null;
                                }
                                const processInfo = getProcessTypeInfo(processedFile);
                                const ProcessIcon = processInfo.icon;
                                const summaryStats = getSummaryStats(processedFile);
                                const downloadOptions = getDownloadOptions(processedFile);
                                const isExpanded = expandedResults.has(processInfo.id);

                                return (
                                    <div
                                        key={processInfo.id}
                                        className="border border-gray-200 rounded-lg hover:border-gray-300 transition-all duration-200 hover:shadow-md"
                                    >
                                        {/* Collapsible Header */}
                                        <div
                                            className="p-3 cursor-pointer"
                                            onClick={() => toggleExpanded(processInfo.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 flex-1">
                                                    {/* Expand/Collapse Icon */}
                                                    {isExpanded ? (
                                                        <ChevronDown size={16} className="text-gray-400"/>
                                                    ) : (
                                                        <ChevronRight size={16} className="text-gray-400"/>
                                                    )}

                                                    <ProcessIcon size={16} className={`text-${processInfo.color}-500`}/>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2">
                                                            <span
                                                                className="text-sm font-medium text-gray-800 truncate">
                                                                {processInfo.label}
                                                            </span>

                                                            {/* Status Icon */}
                                                            {processedFile.status === 'completed' && (
                                                                <CheckCircle size={14}
                                                                             className="text-green-500 flex-shrink-0"/>
                                                            )}
                                                            {processedFile.status === 'processing' && (
                                                                <Clock size={14}
                                                                       className="text-blue-500 animate-pulse flex-shrink-0"/>
                                                            )}
                                                            {processedFile.status === 'failed' && (
                                                                <AlertCircle size={14}
                                                                             className="text-red-500 flex-shrink-0"/>
                                                            )}
                                                        </div>

                                                        {/* ID and Time */}
                                                        {processInfo?.id && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                <div className="truncate">
                                                                    ID: {processInfo.id.slice(-8)} • {new Date(processedFile.created_at).toLocaleString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                                </div>
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>

                                                {/* Quick Stats Preview */}
                                                {(processedFile.status === 'completed' || !processedFile.status) && (
                                                    <div className="text-xs text-gray-600 ml-2 flex-shrink-0">
                                                        <div className="text-right">
                                                            <div className={`text-${summaryStats.stat1.color}-600`}>
                                                                {summaryStats.stat1.value}
                                                            </div>
                                                            <div className="text-gray-400">
                                                                {summaryStats.stat1.label}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                                                {/* Full File Names */}
                                                <div className="text-xs text-gray-600 mb-3">
                                                    <div
                                                        className="truncate"
                                                        title={
                                                            processInfo.type === 'file_generation'
                                                                ? processedFile?.summary?.configuration?.source_files?.[0]?.file_id
                                                                : processedFile.file_a
                                                        }
                                                    >
                                                        📄 {processInfo.type === 'delta'
                                                        ? 'Older'
                                                        : processInfo.type === 'file_generation'
                                                            ? 'SourceFile'
                                                            : 'SourceFile'}: {
                                                        processInfo.type === 'file_generation'
                                                            ? processedFile?.summary?.configuration?.source_files?.[0]?.file_id
                                                            : processedFile.file_a
                                                    }
                                                    </div>

                                                    {processedFile.file_b && (
                                                        <div className="truncate" title={processedFile.file_b}>
                                                            📄 {processInfo.type === 'delta' ? 'Newer' : ''}: {processedFile.file_b}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Process ID */}
                                                <div className="text-xs text-gray-400 mb-3">
                                                    ID: {processInfo.id}
                                                </div>

                                                {/* Results Summary (if completed) */}
                                                {(processedFile.status === 'completed' || !processedFile.status) && (
                                                    <>
                                                        <div
                                                            className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className={`text-${summaryStats.stat1.color}-600`}>
                                                                    ✅ {summaryStats.stat1.label}: {summaryStats.stat1.value}
                                                                </div>
                                                                <div className={`text-${summaryStats.stat2.color}-600`}>
                                                                    🎯 {summaryStats.stat2.label}: {summaryStats.stat2.value}
                                                                </div>
                                                                <div className={`text-${summaryStats.stat3.color}-600`}>
                                                                    📊 {summaryStats.stat3.label}: {summaryStats.stat3.value}
                                                                </div>
                                                                <div className={`text-${summaryStats.stat4.color}-600`}>
                                                                    ⚠️ {summaryStats.stat4.label}: {summaryStats.stat4.value}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons Section */}
                                                        <div className="space-y-2">
                                                            {/* Display Options */}
                                                            <div className="grid grid-cols-2 gap-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDisplayDetailedResults && onDisplayDetailedResults(processInfo.id);
                                                                    }}
                                                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                                    title="Display detailed results in chat"
                                                                >
                                                                    <Eye size={10}/>
                                                                    <span>View Details</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        console.log('Show summary chart for', processInfo.id);

                                                                    }}
                                                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                                    title="Show summary statistics"
                                                                >
                                                                    <BarChart3 size={10}/>
                                                                    <span>Summary</span>
                                                                </button>
                                                            </div>

                                                            {/* Download & Save Options */}
                                                            <div className="space-y-1">
                                                                <div
                                                                    className="text-xs text-gray-500 font-medium">Download
                                                                    &
                                                                    Save Options:
                                                                </div>

                                                                {/* Primary Downloads/Saves */}
                                                                <div className="space-y-1">
                                                                    {downloadOptions.primary.map((option) => {
                                                                        const OptionIcon = option.icon;
                                                                        return (
                                                                            <div key={option.key}
                                                                                 className="grid grid-cols-2 gap-1">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onDownloadResults(processInfo.id, option.key);
                                                                                    }}
                                                                                    className={`px-2 py-1 text-xs bg-${option.color}-100 text-${option.color}-700 rounded hover:bg-${option.color}-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                                    title={`Download ${option.label}`}
                                                                                >
                                                                                    <OptionIcon size={10}/>
                                                                                    <span>{option.label}</span>
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSaveToServer(processInfo.id, option.key, processedFile);
                                                                                    }}
                                                                                    className={`px-2 py-1 text-xs bg-${option.color}-50 text-${option.color}-600 border border-${option.color}-200 rounded hover:bg-${option.color}-100 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                                    title={`Save ${option.label} to Server`}
                                                                                >
                                                                                    <Server size={10}/>
                                                                                    <span>Save</span>
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Secondary Downloads/Saves */}
                                                                {downloadOptions.secondary.length > 0 && (
                                                                    <div className="space-y-1 mt-1">
                                                                        {downloadOptions.secondary.map((option) => {
                                                                            const OptionIcon = option.icon;
                                                                            return (
                                                                                <div key={option.key}
                                                                                     className="grid grid-cols-2 gap-1">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDownloadResults(processInfo.id, option.key);
                                                                                        }}
                                                                                        className={`px-2 py-1 text-xs bg-${option.color}-100 text-${option.color}-700 rounded hover:bg-${option.color}-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                                        title={`Download ${option.label}`}
                                                                                    >
                                                                                        <OptionIcon size={10}/>
                                                                                        <span>{option.label}</span>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleSaveToServer(processInfo.id, option.key, processedFile);
                                                                                        }}
                                                                                        className={`px-2 py-1 text-xs bg-${option.color}-50 text-${option.color}-600 border border-${option.color}-200 rounded hover:bg-${option.color}-100 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                                        title={`Save ${option.label} to Server`}
                                                                                    >
                                                                                        <Server size={10}/>
                                                                                        <span>Save</span>
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* Extra Downloads */}
                                                                {downloadOptions.extra.length > 0 && (
                                                                    <div className="grid grid-cols-1 gap-1 mt-1">
                                                                        {downloadOptions.extra.map((option) => {
                                                                            const OptionIcon = option.icon;
                                                                            return (
                                                                                <button
                                                                                    key={option.key}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onDownloadResults(processInfo.id, option.key);
                                                                                    }}
                                                                                    className={`px-2 py-1 text-xs bg-${option.color}-100 text-${option.color}-700 rounded hover:bg-${option.color}-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                                    title={`Download ${option.label}`}
                                                                                >
                                                                                    <OptionIcon size={10}/>
                                                                                    <span>{option.label}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Processing Status (if processing) */}
                                                {processedFile.status === 'processing' && (
                                                    <div
                                                        className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center space-x-2">
                                                        <div
                                                            className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                                        <span>Processing {processInfo.label.toLowerCase()}...</span>
                                                    </div>
                                                )}

                                                {/* Error Status (if failed) */}
                                                {processedFile.status === 'failed' && (
                                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                                        <div className="flex items-center space-x-1">
                                                            <AlertCircle size={12}/>
                                                            <span>Process failed</span>
                                                        </div>
                                                        {processedFile.error && (
                                                            <div className="mt-1 text-red-500">
                                                                {processedFile.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Timestamp */}
                                                <div
                                                    className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                                    {new Date(processedFile.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Quick Actions for Multiple Results */}
                    {localProcessedFiles.length > 1 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500 font-medium mb-2">Bulk Actions:</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => console.log('Download all results')}
                                    className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-all duration-200 flex items-center justify-center space-x-1"
                                    title="Download all completed processes"
                                >
                                    <Download size={12}/>
                                    <span>All Results</span>
                                </button>
                                <button
                                    onClick={handleRefresh}
                                    className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-all duration-200 flex items-center justify-center space-x-1"
                                    title="Refresh recent results"
                                >
                                    <RefreshCw size={12}/>
                                    <span>Refresh</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    className="px-3 py-2 text-xs bg-gray-100 text-blue-700 rounded hover:bg-red-600 transition-all duration-200 flex items-center justify-center space-x-1"
                                    title="Delete all results"
                                >
                                    <Delete size={12}/>
                                    {/*TODO add clear all feature*/}
                                    <span>Clear All Result</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recent Results Info */}
                    {localProcessedFiles.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500 text-center">
                                Showing {localProcessedFiles.length} most recent results
                                {processedFiles.length === 0 && (
                                    <div className="mt-1 text-blue-600">
                                        Loaded from server storage
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save to Server Modal */}
            {showSaveModal && saveModalData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <Server className="text-green-600" size={20}/>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800">Save to Server</h3>
                            </div>
                            <button
                                onClick={closeSaveModal}
                                disabled={saveInProgress}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Process Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                    <saveModalData.processInfo.icon size={16}
                                                                    className={`text-${saveModalData.processInfo.color}-600`}/>
                                    <span className="text-sm font-medium text-gray-800">
                                        {saveModalData.processInfo.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                    Process ID: {saveModalData.processInfo.id}
                                </p>
                                <p className="text-xs text-gray-600">
                                    Data
                                    Type: {saveModalData.downloadType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                            </div>

                            {/* Custom Filename */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Custom Filename (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={customFilename}
                                    onChange={(e) => setCustomFilename(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter custom filename (without extension)"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    If left blank, a filename will be auto-generated
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter a description for this saved file"
                                />
                            </div>

                            {/* Save Info */}
                            <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                <div className="flex items-center space-x-2">
                                    <Save className="text-green-600" size={16}/>
                                    <p className="text-sm text-green-800">
                                        <strong>Note:</strong> The file will be saved to server storage and will appear
                                        in your File Library for future use.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={closeSaveModal}
                                disabled={saveInProgress}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSaveToServer}
                                disabled={saveInProgress}
                                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {saveInProgress ? (
                                    <>
                                        <div
                                            className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16}/>
                                        <span>Save File to Server</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RightSidebar;