import React from 'react';
import { FileText, CheckCircle, Clock, AlertCircle, Download, RefreshCw } from 'lucide-react';

const RightSidebar = ({
  processedFiles,
  autoRefreshInterval,
  onRefreshProcessedFiles,
  onDownloadResults
}) => {
  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
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
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {autoRefreshInterval ? 'Auto-updating every 3 seconds' : 'Completed reconciliations'}
        </p>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4">
        {processedFiles.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <FileText size={48} className="mx-auto opacity-30 mb-3" />
            <p className="text-sm">No reconciliations yet</p>
            <p className="text-xs mt-1">Start a reconciliation to see results here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {processedFiles.map((reconciliation) => (
              <div
                key={reconciliation.reconciliation_id}
                className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                {/* Status Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {reconciliation.status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
                    {reconciliation.status === 'processing' && (
                      <div className="flex items-center space-x-1">
                        <Clock size={16} className="text-blue-500 animate-pulse" />
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                      </div>
                    )}
                    {reconciliation.status === 'failed' && <AlertCircle size={16} className="text-red-500" />}
                    <span className="text-sm font-medium text-gray-800 capitalize">
                      {reconciliation.status}
                    </span>
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
                      <div>✅ Match Rate: {(reconciliation.match_rate || 0).toFixed(1)}%</div>
                      <div>🎯 Confidence: {(reconciliation.match_confidence || 0).toFixed(1)}%</div>
                    </div>

                    {/* Download Buttons */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'matched')}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        title="Download Matched Records"
                      >
                        <Download size={10} className="inline mr-1" />
                        Match
                      </button>
                      <button
                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'unmatched_a')}
                        className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                        title="Download Unmatched from File A"
                      >
                        <Download size={10} className="inline mr-1" />
                        A Only
                      </button>
                      <button
                        onClick={() => onDownloadResults(reconciliation.reconciliation_id, 'unmatched_b')}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        title="Download Unmatched from File B"
                      >
                        <Download size={10} className="inline mr-1" />
                        B Only
                      </button>
                    </div>
                  </>
                )}

                {/* Timestamp */}
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(reconciliation.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RightSidebar;