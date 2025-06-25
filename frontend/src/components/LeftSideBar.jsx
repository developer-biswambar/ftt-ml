import React, {useRef} from 'react';
import {CheckCircle, FileText, RefreshCw, Upload, Eye} from 'lucide-react';

const LeftSidebar = ({
                         files,
                         templates,
                         selectedFiles,
                         setSelectedFiles,
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
        // UPDATED: Use more specific window features to force tab opening in modern browsers
        const newWindow = window.open(
            viewerUrl,
            `viewer_${fileId}`,
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1400,height=900,menubar=yes,location=yes,directories=no,status=yes'
        );

        // Fallback: If window opening fails, try to focus the new tab
        if (newWindow) {
            newWindow.focus();
        }
    };

    const handleFileUpload = (event) => {
        onFileUpload(event);
    };

    return (
        <div
            className="w-80 bg-gradient-to-br from-slate-50 to-blue-50 border-r border-slate-200 flex flex-col shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                    <div
                        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <FileText className="text-white" size={16}/>
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Setup & Templates</h2>
                        <p className="text-xs text-slate-600">Upload files and configure reconciliation</p>
                    </div>
                </div>
            </div>

            {/* File Upload Section - Compact */}
            <div className="p-4 border-b border-slate-200 bg-white/50">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                        <Upload className="text-green-600" size={12}/>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">📁 Upload Files</h3>
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
                                        <div
                                            className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                                    </div>
                                    <span className="text-sm font-medium text-blue-700">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <div
                                        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Upload className="text-white" size={16}/>
                                    </div>
                                    <div className="text-left">
                                        <span
                                            className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors block">Upload CSV/Excel</span>
                                        <p className="text-xs text-slate-500">Click to browse files</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {!uploadProgress && (
                        <div
                            className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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

            {/* Available Files List */}
            <div className="p-4 border-b border-slate-200 bg-white/30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 text-xs font-bold">📂</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">Available Files</h3>
                    </div>
                    <button
                        onClick={onRefreshFiles}
                        className="p-1 rounded-lg bg-white/70 hover:bg-white hover:shadow-md transition-all duration-200 group"
                        title="Refresh file list"
                    >
                        <RefreshCw size={12}
                                   className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300"/>
                    </button>
                </div>

                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {files.length === 0 ? (
                        <div className="text-center py-4">
                            <FileText size={24} className="mx-auto text-slate-300 mb-2"/>
                            <p className="text-xs text-slate-500">No files uploaded yet</p>
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
                                        <Eye size={14}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* File Selection */}
            <div className="p-4 border-b border-slate-200 bg-white/30">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-bold">🔗</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Select Files for Reconciliation</h3>
                </div>

                <div className="space-y-2">
                    {/* File A Selector */}
                    <div className="group">
                        <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 mb-1">
                            <div className="w-3 h-3 bg-emerald-100 rounded-full flex items-center justify-center">
                                <span className="text-emerald-600 text-xs font-bold">A</span>
                            </div>
                            <span>Primary File:</span>
                        </label>
                        <div className="flex space-x-1">
                            <div className="relative flex-1">
                                <select
                                    value={selectedFiles.fileA?.file_id || ''}
                                    onChange={(e) => {
                                        const file = files.find(f => f.file_id === e.target.value);
                                        setSelectedFiles(prev => ({...prev, fileA: file}));
                                    }}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                                >
                                    <option value="">Choose Primary File</option>
                                    {files.map(file => (
                                        <option key={file.file_id} value={file.file_id}>
                                            {file.filename} ({file.total_rows})
                                        </option>
                                    ))}
                                </select>
                                {selectedFiles.fileA && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        <CheckCircle size={12} className="text-emerald-500"/>
                                    </div>
                                )}
                            </div>
                            {selectedFiles.fileA && (
                                <button
                                    onClick={() => openFileViewer(selectedFiles.fileA.file_id)}
                                    className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-all duration-200"
                                    title="View Primary File"
                                >
                                    <Eye size={12}/>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* File B Selector */}
                    <div className="group">
                        <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 mb-1">
                            <div className="w-3 h-3 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-purple-600 text-xs font-bold">B</span>
                            </div>
                            <span>Compare File:</span>
                        </label>
                        <div className="flex space-x-1">
                            <div className="relative flex-1">
                                <select
                                    value={selectedFiles.fileB?.file_id || ''}
                                    onChange={(e) => {
                                        const file = files.find(f => f.file_id === e.target.value);
                                        setSelectedFiles(prev => ({...prev, fileB: file}));
                                    }}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                                >
                                    <option value="">Choose Comparison File</option>
                                    {files.map(file => (
                                        <option key={file.file_id} value={file.file_id}>
                                            {file.filename} ({file.total_rows})
                                        </option>
                                    ))}
                                </select>
                                {selectedFiles.fileB && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        <CheckCircle size={12} className="text-purple-500"/>
                                    </div>
                                )}
                            </div>
                            {selectedFiles.fileB && (
                                <button
                                    onClick={() => openFileViewer(selectedFiles.fileB.file_id)}
                                    className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-all duration-200"
                                    title="View Comparison File"
                                >
                                    <Eye size={12}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Connection Visual */}
                {selectedFiles.fileA && selectedFiles.fileB && (
                    <div
                        className="mt-3 p-2 bg-gradient-to-r from-emerald-50 to-purple-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-center space-x-2">
                            <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">A</span>
                                </div>
                                <div className="flex space-x-1">
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"
                                         style={{animationDelay: '0.2s'}}></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"
                                         style={{animationDelay: '0.4s'}}></div>
                                </div>
                                <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">B</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-center text-slate-600 mt-1">Ready for reconciliation</p>
                    </div>
                )}
            </div>

            {/* Templates */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 text-xs">📋</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Templates</h3>
                </div>

                <div className="space-y-2">
                    {templates.map((template, index) => (
                        <div
                            key={index}
                            className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-300 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.02]"
                            onClick={() => onTemplateSelect(template)}
                        >
                            <div className="p-3">
                                <div className="flex items-start space-x-3">
                                    <div
                                        className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <span className="text-white text-xs font-bold">{index + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-slate-800 group-hover:text-blue-800 transition-colors duration-200 leading-tight">
                                            {template.name}
                                        </h4>
                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                            {template.description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Hover effect overlay */}
                            <div
                                className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>

                            {/* Active indicator */}
                            {currentInput === template.user_requirements && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LeftSidebar;