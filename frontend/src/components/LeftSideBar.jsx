// src/components/LeftSidebar.jsx - Process-driven sidebar with dynamic file requirements
import React, { useRef } from 'react';
import { CheckCircle, FileText, RefreshCw, Upload, Eye } from 'lucide-react';

const LeftSidebar = ({
    files,
    templates,
    selectedFiles,
    setSelectedFiles,
    selectedTemplate,
    requiredFiles,
    currentInput,
    uploadProgress,
    onFileUpload,
    onTemplateSelect,
    onRefreshFiles,
    width = 320
}) => {
    const fileInputRef = useRef(null);

    const openFileViewer = (fileId) => {
        const viewerUrl = `/viewer/${fileId}`;
        const newWindow = window.open(
            viewerUrl,
            `viewer_${fileId}`,
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1400,height=900,menubar=yes,location=yes,directories=no,status=yes'
        );

        if (newWindow) {
            newWindow.focus();
        }
    };

    const handleFileUpload = (event) => {
        onFileUpload(event);
    };

    const handleFileSelection = (fileKey, file) => {
        setSelectedFiles(prev => ({
            ...prev,
            [fileKey]: file
        }));
    };

    const getFileSelectionStatus = () => {
        if (!selectedTemplate) {
            return { complete: false, selected: 0, required: 0 };
        }

        const selected = requiredFiles.filter(rf => selectedFiles[rf.key]).length;
        return {
            complete: selected === requiredFiles.length,
            selected,
            required: requiredFiles.length
        };
    };

    const status = getFileSelectionStatus();

    const getProcessIcon = (category) => {
        switch (category) {
            case 'reconciliation':
            case 'ai-reconciliation':
                return '🔄';
            case 'validation':
                return '🔍';
            case 'cleaning':
                return '🧹';
            case 'extraction':
                return '📊';
            case 'consolidation':
                return '📋';
            case 'ai-analysis':
                return '🤖';
            case 'ai-generation':
                return '🤖';
            default:
                return '⚙️';
        }
    };

    const getProcessColor = (category, index) => {
        const colors = [
            'from-blue-500 to-purple-600',
            'from-green-500 to-blue-600',
            'from-purple-500 to-pink-600',
            'from-orange-500 to-red-600',
            'from-teal-500 to-green-600',
            'from-indigo-500 to-purple-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-blue-600'
        ];

        if (category?.includes('ai')) {
            return 'from-purple-500 to-pink-600';
        }

        return colors[index % colors.length];
    };

    return (
        <div
            className="w-80 bg-gradient-to-br from-slate-50 to-blue-50 border-r border-slate-200 flex flex-col shadow-lg"
            style={{ width: `${width}px` }}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <FileText className="text-white" size={16} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Setup & Configuration</h2>
                        <p className="text-xs text-slate-600">Choose process and upload files</p>
                    </div>
                </div>
            </div>

            {/* Step 1: Process Templates - More Space */}
            <div className="p-4 border-b border-slate-200 bg-white/30">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 text-sm font-bold">1</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Select Process</h3>
                </div>

                {selectedTemplate ? (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                            <CheckCircle size={14} className="text-green-600" />
                            <span className="text-xs font-medium text-green-800">Process Selected</span>
                        </div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm">{getProcessIcon(selectedTemplate.category)}</span>
                            <p className="text-xs text-green-700 font-medium">{selectedTemplate.name}</p>
                        </div>
                        <p className="text-xs text-green-600 mb-1">
                            Requires {selectedTemplate.filesRequired} file{selectedTemplate.filesRequired !== 1 ? 's' : ''}
                        </p>
                        <button
                            onClick={() => onTemplateSelect(null)}
                            className="text-xs text-green-600 hover:text-green-800 underline transition-colors duration-200"
                        >
                            Change process
                        </button>
                    </div>
                ) : (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                        {templates.map((template, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-300 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.02]"
                                onClick={() => onTemplateSelect(template)}
                            >
                                <div className="p-3">
                                    <div className="flex items-start space-x-3">
                                        <div className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${getProcessColor(template.category, index)} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                            <span className="text-white text-lg">{getProcessIcon(template.category)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm text-slate-800 group-hover:text-blue-800 transition-colors duration-200 leading-tight">
                                                {template.name}
                                            </h4>
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                                {template.description}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-blue-600 font-medium">
                                                    {template.filesRequired} file{template.filesRequired !== 1 ? 's' : ''} required
                                                </span>
                                                {template.category?.includes('ai') && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                                        AI
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Step 2: File Upload - Compact */}
            <div className="p-2 border-b border-slate-200 bg-white/50">
                <div className="flex items-center space-x-2 mb-2">
                    <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-xs font-bold">2</span>
                    </div>
                    <h3 className="text-xs font-semibold text-slate-700">Upload Files</h3>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadProgress}
                    className="w-full group relative overflow-hidden"
                >
                    <div className={`
                        w-full p-2 border-2 border-dashed rounded-lg transition-all duration-300 ease-out
                        ${uploadProgress
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md hover:scale-[1.02]'
                        }
                    `}>
                        <div className="flex items-center space-x-2">
                            {uploadProgress ? (
                                <>
                                    <div className="relative">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                                    </div>
                                    <span className="text-xs font-medium text-blue-700">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Upload className="text-white" size={12} />
                                    </div>
                                    <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                                        Upload CSV/Excel
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                />
            </div>

            {/* Available Files Library - Very Compact */}
            <div className="p-2 border-b border-slate-200 bg-white/30">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 text-xs font-bold">📂</span>
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700">Files</h3>
                    </div>
                    <button
                        onClick={onRefreshFiles}
                        className="p-1 rounded-lg bg-white/70 hover:bg-white hover:shadow-md transition-all duration-200 group"
                        title="Refresh file list"
                    >
                        <RefreshCw size={8} className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300" />
                    </button>
                </div>

                <div className="space-y-1 max-h-16 overflow-y-auto">
                    {files.length === 0 ? (
                        <div className="text-center py-1">
                            <p className="text-xs text-slate-500">No files</p>
                        </div>
                    ) : (
                        files.map((file) => (
                            <div
                                key={file.file_id}
                                className="group p-1 bg-white/70 rounded border border-slate-200 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all duration-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-800 truncate" title={file.filename}>
                                            {file.filename}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {file.total_rows?.toLocaleString()} rows
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openFileViewer(file.file_id)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all duration-200"
                                        title="View/Edit File"
                                    >
                                        <Eye size={10} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Step 3: File Selection for Process - Compact */}
            {selectedTemplate && (
                <div className="p-2 border-b border-slate-200 bg-white/30">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-xs font-bold">3</span>
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700">Select</h3>
                        <div className={`text-xs px-1 py-0.5 rounded-full font-medium ${
                            status.complete 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                        }`}>
                            {status.selected}/{status.required}
                        </div>
                    </div>

                    <div className="space-y-1">
                        {requiredFiles.map((requirement, index) => {
                            const colors = [
                                { check: 'text-emerald-500' },
                                { check: 'text-purple-500' },
                                { check: 'text-blue-500' },
                                { check: 'text-orange-500' },
                                { check: 'text-teal-500' }
                            ];
                            const color = colors[index % colors.length];

                            return (
                                <div key={requirement.key} className="group">
                                    <div className="flex space-x-1">
                                        <div className="relative flex-1">
                                            <select
                                                value={selectedFiles[requirement.key]?.file_id || ''}
                                                onChange={(e) => {
                                                    const file = files.find(f => f.file_id === e.target.value);
                                                    handleFileSelection(requirement.key, file);
                                                }}
                                                className="w-full p-1 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                            >
                                                <option value="">{requirement.label}</option>
                                                {files.map(file => (
                                                    <option key={file.file_id} value={file.file_id}>
                                                        {file.filename}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedFiles[requirement.key] && (
                                                <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                                    <CheckCircle size={8} className={color.check} />
                                                </div>
                                            )}
                                        </div>
                                        {selectedFiles[requirement.key] && (
                                            <button
                                                onClick={() => openFileViewer(selectedFiles[requirement.key].file_id)}
                                                className="p-1 rounded transition-all duration-200 text-blue-600 hover:text-blue-800"
                                                title={`View ${requirement.label}`}
                                            >
                                                <Eye size={8} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selection Status */}
                    {status.complete && (
                        <div className="mt-1 p-1 bg-gradient-to-r from-emerald-50 to-blue-50 rounded border border-emerald-200">
                            <div className="flex items-center justify-center space-x-1">
                                <CheckCircle size={8} className="text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-800">Ready</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Process Status & Next Steps - Very Compact */}
            <div className="flex-1 p-2">
                <div className="text-center">
                    {!selectedTemplate ? (
                        <div className="text-slate-500">
                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">🚀</span>
                            </div>
                            <p className="text-xs font-medium">Choose Process</p>
                        </div>
                    ) : !status.complete ? (
                        <div className="text-yellow-600">
                            <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">📁</span>
                            </div>
                            <p className="text-xs font-medium">Select Files</p>
                        </div>
                    ) : (
                        <div className="text-green-600">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-sm">✅</span>
                            </div>
                            <p className="text-xs font-medium">Ready</p>
                            <p className="text-xs text-slate-600">Type "start" →</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeftSidebar;