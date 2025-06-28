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

            {/* Step 1: Process Templates */}
            <div className="p-4 border-b border-slate-200 bg-white/30">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 text-sm font-bold">1</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Select Process</h3>
                </div>

                {selectedTemplate ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">Process Selected</span>
                        </div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{getProcessIcon(selectedTemplate.category)}</span>
                            <p className="text-xs text-green-700 font-medium">{selectedTemplate.name}</p>
                        </div>
                        <p className="text-xs text-green-600 mb-2">
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
                    <div className="max-h-48 overflow-y-auto space-y-2">
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

            {/* Step 2: File Upload */}
            <div className="p-4 border-b border-slate-200 bg-white/50">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-sm font-bold">2</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Upload Files</h3>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadProgress}
                    className="w-full group relative overflow-hidden"
                >
                    <div className={`
                        w-full p-3 border-2 border-dashed rounded-lg transition-all duration-300 ease-out
                        ${uploadProgress
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md hover:scale-[1.02]'
                        }
                    `}>
                        <div className="flex items-center space-x-3">
                            {uploadProgress ? (
                                <>
                                    <div className="relative">
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                                    </div>
                                    <span className="text-sm font-medium text-blue-700">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Upload className="text-white" size={16} />
                                    </div>
                                    <div className="text-left">
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors block">
                                            Upload CSV/Excel
                                        </span>
                                        <p className="text-xs text-slate-500">Click to browse files</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {!uploadProgress && (
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                />
            </div>

            {/* Available Files Library */}
            <div className="p-4 border-b border-slate-200 bg-white/30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 text-xs font-bold">📂</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">File Library</h3>
                    </div>
                    <button
                        onClick={onRefreshFiles}
                        className="p-1 rounded-lg bg-white/70 hover:bg-white hover:shadow-md transition-all duration-200 group"
                        title="Refresh file list"
                    >
                        <RefreshCw size={12} className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300" />
                    </button>
                </div>

                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {files.length === 0 ? (
                        <div className="text-center py-4">
                            <FileText size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs text-slate-500">No files uploaded yet</p>
                            <p className="text-xs text-slate-400 mt-1">Upload files above to get started</p>
                        </div>
                    ) : (
                        files.map((file) => (
                            <div
                                key={file.file_id}
                                className="group p-2 bg-white/70 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all duration-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-800 truncate" title={file.filename}>
                                            {file.filename}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {file.total_rows?.toLocaleString()} rows • {file.columns?.length} cols
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openFileViewer(file.file_id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all duration-200"
                                        title="View/Edit File"
                                    >
                                        <Eye size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Step 3: File Selection for Process */}
            {selectedTemplate && (
                <div className="p-4 border-b border-slate-200 bg-white/30">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm font-bold">3</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">Select Files for Process</h3>
                        <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                            status.complete 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                        }`}>
                            {status.selected}/{status.required}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {requiredFiles.map((requirement, index) => {
                            const colors = [
                                { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'hover:text-emerald-800 hover:bg-emerald-50', check: 'text-emerald-500' },
                                { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'hover:text-purple-800 hover:bg-purple-50', check: 'text-purple-500' },
                                { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:text-blue-800 hover:bg-blue-50', check: 'text-blue-500' },
                                { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'hover:text-orange-800 hover:bg-orange-50', check: 'text-orange-500' },
                                { bg: 'bg-teal-100', text: 'text-teal-600', hover: 'hover:text-teal-800 hover:bg-teal-50', check: 'text-teal-500' }
                            ];
                            const color = colors[index % colors.length];

                            return (
                                <div key={requirement.key} className="group">
                                    <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 mb-1">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${color.bg}`}>
                                            <span className={`text-xs font-bold ${color.text}`}>
                                                {String.fromCharCode(65 + index)}
                                            </span>
                                        </div>
                                        <span>{requirement.label}:</span>
                                    </label>
                                    <div className="flex space-x-1">
                                        <div className="relative flex-1">
                                            <select
                                                value={selectedFiles[requirement.key]?.file_id || ''}
                                                onChange={(e) => {
                                                    const file = files.find(f => f.file_id === e.target.value);
                                                    handleFileSelection(requirement.key, file);
                                                }}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                                            >
                                                <option value="">Choose {requirement.label}</option>
                                                {files.map(file => (
                                                    <option key={file.file_id} value={file.file_id}>
                                                        {file.filename} ({file.total_rows?.toLocaleString()} rows)
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedFiles[requirement.key] && (
                                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                                    <CheckCircle size={12} className={color.check} />
                                                </div>
                                            )}
                                        </div>
                                        {selectedFiles[requirement.key] && (
                                            <button
                                                onClick={() => openFileViewer(selectedFiles[requirement.key].file_id)}
                                                className={`p-2 rounded transition-all duration-200 ${color.text} ${color.hover}`}
                                                title={`View ${requirement.label}`}
                                            >
                                                <Eye size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selection Status */}
                    {status.complete && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-200">
                            <div className="flex items-center justify-center space-x-2">
                                <CheckCircle size={16} className="text-emerald-500" />
                                <span className="text-sm font-medium text-emerald-800">All files selected</span>
                            </div>
                            <p className="text-xs text-center text-slate-600 mt-1">Ready to configure process</p>
                        </div>
                    )}
                </div>
            )}

            {/* Process Status & Next Steps */}
            <div className="flex-1 p-4">
                <div className="text-center">
                    {!selectedTemplate ? (
                        <div className="text-slate-500">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-3xl">🚀</span>
                            </div>
                            <p className="text-sm font-medium mb-1">Choose a Process</p>
                            <p className="text-xs leading-relaxed">
                                Select from data reconciliation, validation, cleaning, or AI analysis processes above
                            </p>
                        </div>
                    ) : !status.complete ? (
                        <div className="text-yellow-600">
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-3xl">📁</span>
                            </div>
                            <p className="text-sm font-medium mb-1">Select Required Files</p>
                            <p className="text-xs leading-relaxed">
                                {status.selected} of {status.required} files selected for<br />
                                <span className="font-medium">{selectedTemplate.name}</span>
                            </p>
                        </div>
                    ) : (
                        <div className="text-green-600">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-3xl">✅</span>
                            </div>
                            <p className="text-sm font-medium mb-1">Ready to Start</p>
                            <p className="text-xs leading-relaxed">
                                All files selected for<br />
                                <span className="font-medium">{selectedTemplate.name}</span><br />
                                <span className="text-slate-600">Configure process in chat →</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                {selectedTemplate && status.complete && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="text-xs text-slate-600 space-y-2">
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                <span>Type "start" in chat to begin</span>
                            </div>
                            {selectedTemplate.category?.includes('ai') && (
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                    <span>AI will auto-configure rules</span>
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span>Results will appear in right panel</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeftSidebar;