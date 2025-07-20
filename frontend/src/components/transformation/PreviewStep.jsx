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
    Info
} from 'lucide-react';

const PreviewStep = ({
    config,
    previewData,
    isLoading,
    onRefresh,
    onProcess
}) => {
    const [viewMode, setViewMode] = useState('table'); // table, json, summary
    const [isProcessing, setIsProcessing] = useState(false);

    const handleProcess = async () => {
        setIsProcessing(true);
        await onProcess();
        setIsProcessing(false);
    };

    const renderPreviewTable = () => {
        if (!previewData || previewData.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Table size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No preview data available</p>
                </div>
            );
        }

        const columns = config.output_definition.columns;

        return (
            <div className="overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                            </th>
                            {columns.map(col => (
                                <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {col.name}
                                    {col.required && <span className="text-red-500 ml-1">*</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-500">
                                    {rowIndex + 1}
                                </td>
                                {columns.map(col => (
                                    <td key={col.id} className="px-4 py-2 text-sm text-gray-900">
                                        {row[col.name] !== null && row[col.name] !== undefined
                                            ? String(row[col.name])
                                            : <span className="text-gray-400 italic">null</span>
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderPreviewJSON = () => {
        if (!previewData) return null;

        return (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-xs">
                {JSON.stringify(previewData, null, 2)}
            </pre>
        );
    };

    const renderConfigSummary = () => {
        const sourceFileCount = config.source_files.length;
        const outputColumnCount = config.output_definition.columns.length;
        const requiredColumnCount = config.output_definition.columns.filter(c => c.required).length;
        const ruleCount = config.row_generation_rules.filter(r => r.enabled).length;
        const mappingCount = config.column_mappings.filter(m => m.enabled && (m.source || m.transformation?.config?.value)).length;

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
                            <Table size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Output Columns</span>
                        </div>
                        <p className="text-2xl font-semibold text-green-900">{outputColumnCount}</p>
                        <p className="text-xs text-green-600">{requiredColumnCount} required</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Code size={20} className="text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Row Rules</span>
                        </div>
                        <p className="text-2xl font-semibold text-purple-900">{ruleCount}</p>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={20} className="text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">Mapped Columns</span>
                        </div>
                        <p className="text-2xl font-semibold text-orange-900">{mappingCount}/{outputColumnCount}</p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">Configuration Details</h4>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Transformation Name:</span>
                            <span className="font-medium">{config.name || 'Untitled'}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600">Output Format:</span>
                            <span className="font-medium">{config.output_definition.format.toUpperCase()}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600">Include Headers:</span>
                            <span className="font-medium">{config.output_definition.include_headers ? 'Yes' : 'No'}</span>
                        </div>

                        {config.description && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-gray-600">Description:</span>
                                <p className="mt-1 text-gray-800">{config.description}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Warnings */}
                {config.output_definition.columns.filter(c => c.required).some(col =>
                    !config.column_mappings.find(m => m.target_column === col.id && m.enabled && (m.source || m.transformation?.config?.value))
                ) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                                <p className="font-medium">Warning: Unmapped Required Columns</p>
                                <p className="mt-1">Some required columns don't have mappings configured. They will be empty in the output.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Preview & Generate</h3>
                <p className="text-sm text-gray-600">
                    Review your transformation configuration and preview the output before generating the final file.
                </p>
            </div>

            {/* View Mode Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setViewMode('summary')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            viewMode === 'summary'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Info size={16} />
                            <span>Summary</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setViewMode('table')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            viewMode === 'table'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Table size={16} />
                            <span>Table Preview</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setViewMode('json')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            viewMode === 'json'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Code size={16} />
                            <span>JSON Preview</span>
                        </div>
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="min-h-[300px]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                            <p className="text-gray-600">Generating preview...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {viewMode === 'summary' && renderConfigSummary()}
                        {viewMode === 'table' && renderPreviewTable()}
                        {viewMode === 'json' && renderPreviewJSON()}
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        <span>Refresh Preview</span>
                    </button>

                    {previewData && previewData.length > 0 && (
                        <div className="text-sm text-gray-600">
                            Showing {previewData.length} preview rows
                        </div>
                    )}
                </div>

                <button
                    onClick={handleProcess}
                    disabled={isProcessing || isLoading}
                    className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                    {isProcessing ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            <span>Generate Full Output</span>
                        </>
                    )}
                </button>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <Info size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Preview Information:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>The preview shows the first 20 rows of your transformed data</li>
                            <li>Review the output carefully before generating the full file</li>
                            <li>You can go back to any step to make adjustments</li>
                            <li>The full generation will process all source data according to your rules</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewStep;