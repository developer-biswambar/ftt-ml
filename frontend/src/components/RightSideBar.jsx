import React from 'react';
import {
    AlertCircle,
    BarChart3,
    CheckCircle,
    Clock,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    GitCompare,
    Shuffle,
    Settings
} from 'lucide-react';

const RightSidebar = ({
                          processedFiles = [], // ✅ Add default empty array
                          autoRefreshInterval,
                          onRefreshProcessedFiles,
                          onDownloadResults,
                          onDisplayDetailedResults,
                          width = 320
                      }) => {

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
                stat1: { label: 'Unchanged', value: summary.unchanged_records || 0, color: 'green' },
                stat2: { label: 'Amended', value: summary.amended_records || 0, color: 'orange' },
                stat3: { label: 'Deleted', value: summary.deleted_records || 0, color: 'red' },
                stat4: { label: 'Added', value: summary.newly_added_records || 0, color: 'purple' }
            };
        } else if (processInfo.type === 'reconciliation') {
            const summary = processedFile.summary || {};
            return {
                stat1: { label: 'Match Rate', value: `${(summary.match_percentage || 0).toFixed(1)}%`, color: 'green' },
                stat2: { label: 'Confidence', value: `${(summary.match_percentage || 0).toFixed(1)}%`, color: 'blue' },
                stat3: { label: 'Matched', value: summary.matched_records || 0, color: 'green' },
                stat4: { label: 'Unmatched', value: (summary.unmatched_file_a || 0) + (summary.unmatched_file_b || 0), color: 'orange' }
            };
        } else {
            // Generic stats for other process types
            const summary = processedFile.summary || {};
            return {
                stat1: { label: 'Success Rate', value: `${(summary.success_rate || 0).toFixed(1)}%`, color: 'green' },
                stat2: { label: 'Processed', value: summary.total_processed || 0, color: 'blue' },
                stat3: { label: 'Errors', value: summary.total_errors || 0, color: 'red' },
                stat4: { label: 'Warnings', value: summary.total_warnings || 0, color: 'orange' }
            };
        }
    };

    // Helper function to get download options based on process type
    const getDownloadOptions = (processedFile) => {
        const processInfo = getProcessTypeInfo(processedFile);

        if (processInfo.type === 'delta') {
            return {
                primary: [
                    { key: 'unchanged', label: 'Unchanged', color: 'green', icon: Download },
                    { key: 'amended', label: 'Amended', color: 'orange', icon: Download },
                    { key: 'deleted', label: 'Deleted', color: 'red', icon: Download }
                ],
                secondary: [
                    { key: 'newly_added', label: 'Added', color: 'purple', icon: Download },
                    { key: 'all_changes', label: 'All Changes', color: 'indigo', icon: Download },
                    { key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet }
                ],
                extra: [
                    { key: 'summary_report', label: 'Report', color: 'gray', icon: FileText }
                ]
            };
        } else if (processInfo.type === 'reconciliation') {
            return {
                primary: [
                    { key: 'matched', label: 'Matched', color: 'green', icon: Download },
                    { key: 'unmatched_a', label: 'A Only', color: 'orange', icon: Download },
                    { key: 'unmatched_b', label: 'B Only', color: 'purple', icon: Download }
                ],
                secondary: [
                    { key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet },
                    { key: 'summary_report', label: 'Report', color: 'gray', icon: FileText }
                ],
                extra: []
            };
        } else {
            // Generic download options for other process types
            return {
                primary: [
                    { key: 'results', label: 'Results', color: 'blue', icon: Download },
                    { key: 'errors', label: 'Errors', color: 'red', icon: Download }
                ],
                secondary: [
                    { key: 'all_excel', label: 'Excel All', color: 'indigo', icon: FileSpreadsheet },
                    { key: 'summary_report', label: 'Report', color: 'gray', icon: FileText }
                ],
                extra: []
            };
        }
    };

    return (
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
                        <button
                            onClick={onRefreshProcessedFiles}
                            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            title="Refresh results"
                        >
                            <RefreshCw size={14}/>
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {autoRefreshInterval ? 'Auto-updating every 3 seconds' : 'Completed processes & downloads'}
                </p>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4">
                {processedFiles.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <FileText size={48} className="mx-auto opacity-30 mb-3"/>
                        <p className="text-sm">No processes yet</p>
                        <p className="text-xs mt-1">Start a process to see results here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {processedFiles.map((processedFile) => {
                            const processInfo = getProcessTypeInfo(processedFile);
                            const ProcessIcon = processInfo.icon;
                            const summaryStats = getSummaryStats(processedFile);
                            const downloadOptions = getDownloadOptions(processedFile);

                            return (
                                <div
                                    key={processInfo.id}
                                    className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-all duration-200 hover:shadow-md transform hover:scale-[1.02]"
                                >
                                    {/* Status Header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <ProcessIcon size={16} className={`text-${processInfo.color}-500`}/>
                                            <span className="text-xs font-medium text-gray-600">{processInfo.label}</span>
                                            {processedFile.status === 'completed' &&
                                                <CheckCircle size={16} className="text-green-500"/>}
                                            {processedFile.status === 'processing' && (
                                                <div className="flex items-center space-x-1">
                                                    <Clock size={16} className="text-blue-500 animate-pulse"/>
                                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                                                </div>
                                            )}
                                            {processedFile.status === 'failed' &&
                                                <AlertCircle size={16} className="text-red-500"/>}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            ID: {processInfo.id.slice(-8)}
                                        </div>
                                    </div>

                                    {/* File Names */}
                                    <div className="text-xs text-gray-600 mb-2">
                                        <div className="truncate" title={processedFile.file_a}>
                                            📄 {processInfo.type === 'delta' ? 'Older' : 'A'}: {processedFile.file_a}
                                        </div>
                                        {processedFile.file_b && (
                                            <div className="truncate" title={processedFile.file_b}>
                                                📄 {processInfo.type === 'delta' ? 'Newer' : 'B'}: {processedFile.file_b}
                                            </div>
                                        )}
                                    </div>

                                    {/* Results Summary (if completed) */}
                                    {processedFile.status === 'completed' && (
                                        <>
                                            <div className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
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
                                                        onClick={() => onDisplayDetailedResults && onDisplayDetailedResults(processInfo.id)}
                                                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Display detailed results in chat"
                                                    >
                                                        <Eye size={10}/>
                                                        <span>View Details</span>
                                                    </button>
                                                    <button
                                                        onClick={() => console.log('Show summary chart for', processInfo.id)}
                                                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Show summary statistics"
                                                    >
                                                        <BarChart3 size={10}/>
                                                        <span>Summary</span>
                                                    </button>
                                                </div>

                                                {/* Download Buttons */}
                                                <div className="space-y-1">
                                                    <div className="text-xs text-gray-500 font-medium">Download Options:</div>

                                                    {/* Primary Downloads */}
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {downloadOptions.primary.map((option) => {
                                                            const OptionIcon = option.icon;
                                                            return (
                                                                <button
                                                                    key={option.key}
                                                                    onClick={() => onDownloadResults(processInfo.id, option.key)}
                                                                    className={`px-2 py-1 text-xs bg-${option.color}-100 text-${option.color}-700 rounded hover:bg-${option.color}-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1`}
                                                                    title={`Download ${option.label}`}
                                                                >
                                                                    <OptionIcon size={10}/>
                                                                    <span>{option.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Secondary Downloads */}
                                                    {downloadOptions.secondary.length > 0 && (
                                                        <div className="grid grid-cols-2 gap-1 mt-1">
                                                            {downloadOptions.secondary.map((option) => {
                                                                const OptionIcon = option.icon;
                                                                return (
                                                                    <button
                                                                        key={option.key}
                                                                        onClick={() => onDownloadResults(processInfo.id, option.key)}
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

                                                    {/* Extra Downloads */}
                                                    {downloadOptions.extra.length > 0 && (
                                                        <div className="grid grid-cols-1 gap-1 mt-1">
                                                            {downloadOptions.extra.map((option) => {
                                                                const OptionIcon = option.icon;
                                                                return (
                                                                    <button
                                                                        key={option.key}
                                                                        onClick={() => onDownloadResults(processInfo.id, option.key)}
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
                                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
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
                                    <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                        {new Date(processedFile.created_at).toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Quick Actions for Multiple Results */}
                {processedFiles.length > 1 && (
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
                                onClick={() => console.log('Clear all results')}
                                className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-all duration-200 flex items-center justify-center space-x-1"
                                title="Clear all process results"
                            >
                                <FileText size={12}/>
                                <span>Clear All</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RightSidebar;