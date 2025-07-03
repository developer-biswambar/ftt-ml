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
    RefreshCw
} from 'lucide-react';

const RightSidebar = ({
                          processedFiles = [], // ✅ Add default empty array
                          autoRefreshInterval,
                          onRefreshProcessedFiles,
                          onDownloadResults,
                          onDisplayDetailedResults,
                          width = 320
                      }) => {
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
                    {autoRefreshInterval ? 'Auto-updating every 3 seconds' : 'Completed reconciliations & downloads'}
                </p>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4">
                {processedFiles.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <FileText size={48} className="mx-auto opacity-30 mb-3"/>
                        <p className="text-sm">No reconciliations yet</p>
                        <p className="text-xs mt-1">Start a reconciliation to see results here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {processedFiles.map((reconciliation) => (
                            <div
                                key={reconciliation.reconciliation_id}
                                className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-all duration-200 hover:shadow-md transform hover:scale-[1.02]"
                            >
                                {/* Status Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                        {reconciliation.status === 'completed' &&
                                            <CheckCircle size={16} className="text-green-500"/>}
                                        {reconciliation.status === 'processing' && (
                                            <div className="flex items-center space-x-1">
                                                <Clock size={16} className="text-blue-500 animate-pulse"/>
                                                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                                            </div>
                                        )}
                                        {reconciliation.status === 'failed' &&
                                            <AlertCircle size={16} className="text-red-500"/>}
                                        <span className="text-sm font-medium text-gray-800 capitalize">
                                            {reconciliation.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        ID: {reconciliation.reconciliation_id.slice(-8)}
                                    </div>
                                </div>

                                {/* File Names */}
                                <div className="text-xs text-gray-600 mb-2">
                                    <div className="truncate" title={reconciliation.file_a}>
                                        📄 A: {reconciliation.file_a}
                                    </div>
                                    <div className="truncate" title={reconciliation.file_b}>
                                        📄 B: {reconciliation.file_b}
                                    </div>
                                </div>

                                {/* Results Summary (if completed) */}
                                {reconciliation.status === 'completed' && (
                                    <>
                                        <div className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>✅ Match
                                                    Rate: {(reconciliation.summary.match_percentage || 0).toFixed(1)}%
                                                </div>
                                                <div>🎯
                                                    Confidence: {(reconciliation.summary.match_percentage || 0).toFixed(1)}%
                                                </div>
                                                <div>📊 Matched: {reconciliation.summary?.matched_records || 0}</div>
                                                <div>⚠️
                                                    Unmatched: {(reconciliation.summary?.unmatched_file_a || 0) + (reconciliation.summary?.unmatched_file_b || 0)}</div>
                                            </div>
                                        </div>

                                        {/* Action Buttons Section */}
                                        <div className="space-y-2">
                                            {/* Display Options */}
                                            <div className="grid grid-cols-2 gap-1">
                                                <button
                                                    onClick={() => onDisplayDetailedResults && onDisplayDetailedResults(reconciliation.reconciliation_id)}
                                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                    title="Display detailed results in chat"
                                                >
                                                    <Eye size={10}/>
                                                    <span>View Details</span>
                                                </button>
                                                <button
                                                    onClick={() => console.log('Show summary chart for', reconciliation.reconciliation_id)}
                                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                    title="Show summary statistics"
                                                >
                                                    <BarChart3 size={10}/>
                                                    <span>Summary</span>
                                                </button>
                                            </div>

                                            {/* Download Buttons */}
                                            <div className="space-y-1">
                                                <div className="text-xs text-gray-500 font-medium">Download Options:
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <button
                                                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'matched')}
                                                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Download Matched Records"
                                                    >
                                                        <Download size={10}/>
                                                        <span>Matched</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'unmatched_a')}
                                                        className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Download Unmatched from File A"
                                                    >
                                                        <Download size={10}/>
                                                        <span>A Only</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'unmatched_b')}
                                                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Download Unmatched from File B"
                                                    >
                                                        <Download size={10}/>
                                                        <span>B Only</span>
                                                    </button>
                                                </div>

                                                {/* Additional Download Options */}
                                                <div className="grid grid-cols-2 gap-1 mt-1">
                                                    <button
                                                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'all_excel')}
                                                        className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Download complete Excel workbook with all results"
                                                    >
                                                        <FileSpreadsheet size={10}/>
                                                        <span>Excel All</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'summary_report')}
                                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-1"
                                                        title="Download summary report with statistics"
                                                    >
                                                        <FileText size={10}/>
                                                        <span>Report</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Processing Status (if processing) */}
                                {reconciliation.status === 'processing' && (
                                    <div
                                        className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center space-x-2">
                                        <div
                                            className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                        <span>Processing reconciliation...</span>
                                    </div>
                                )}

                                {/* Error Status (if failed) */}
                                {reconciliation.status === 'failed' && (
                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                        <div className="flex items-center space-x-1">
                                            <AlertCircle size={12}/>
                                            <span>Process failed</span>
                                        </div>
                                        {reconciliation.error && (
                                            <div className="mt-1 text-red-500">
                                                {reconciliation.error}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Timestamp */}
                                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                    {new Date(reconciliation.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))}
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
                                title="Download all completed reconciliations"
                            >
                                <Download size={12}/>
                                <span>All Results</span>
                            </button>
                            <button
                                onClick={() => console.log('Clear all results')}
                                className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-all duration-200 flex items-center justify-center space-x-1"
                                title="Clear all reconciliation results"
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