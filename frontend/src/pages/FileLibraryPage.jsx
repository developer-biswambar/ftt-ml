// src/pages/FileLibraryPage.jsx - Updated with FileUploadModal and Multiple File Support
import React, {useEffect, useRef, useState} from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    CheckCircle,
    Columns,
    Download,
    Eye,
    FileText,
    Grid,
    HardDrive,
    Home,
    List,
    RefreshCw,
    Rows,
    Search,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import {apiService} from '../services/defaultApi.js';
import FileUploadModal from '../fileManagement/FileUploadModal.jsx';

const FileLibraryPage = () => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('upload_time');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
    const [selectedFile, setSelectedFile] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [deleteInProgress, setDeleteInProgress] = useState(false);
    const [showUploadSuccess, setShowUploadSuccess] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState(new Set());

    // File Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [currentUploadFile, setCurrentUploadFile] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [uploadQueue, setUploadQueue] = useState([]);
    const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    const fileInputRef = useRef(null);

    // Set document title
    useEffect(() => {
        document.title = 'File Library';
        return () => {
            document.title = 'React App'; // Reset to default when component unmounts
        };
    }, []);

    // Load files on component mount
    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getFiles();

            if (response.success) {
                setFiles(response.data.files || []);
            } else {
                setError(response.message || 'Failed to load files');
            }
        } catch (err) {
            setError(err.message || 'An error occurred while loading files');
        } finally {
            setLoading(false);
        }
    };

    const handleFileInputChange = async (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length === 0) return;

        // Clear the input
        event.target.value = '';

        // Check file count limit
        if (selectedFiles.length > 5) {
            setError('You can upload a maximum of 5 files at once.');
            return;
        }

        // Validate file types
        const invalidFiles = selectedFiles.filter(file =>
            !apiService.isExcelFile(file) && !file.name.toLowerCase().endsWith('.csv')
        );

        if (invalidFiles.length > 0) {
            setError(`Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}. Only CSV and Excel files are supported.`);
            return;
        }

        // If single file, show modal immediately
        if (selectedFiles.length === 1) {
            setCurrentUploadFile(selectedFiles[0]);
            setShowUploadModal(true);
        } else {
            // Multiple files - set up queue
            setUploadQueue(selectedFiles);
            setCurrentUploadIndex(0);
            setCurrentUploadFile(selectedFiles[0]);
            setShowUploadModal(true);
        }
    };

    const handleUploadConfirm = async (uploadConfig) => {
        setShowUploadModal(false);
        setUploadProgress(true);

        try {
            const response = await apiService.uploadFileWithOptions(
                uploadConfig.file,
                uploadConfig.sheetName,
                uploadConfig.customName
            );

            if (response.success) {
                setShowUploadSuccess(response.data);
                setTimeout(() => setShowUploadSuccess(null), 4000);

                // If there are more files in queue, process next
                if (uploadQueue.length > 1 && currentUploadIndex < uploadQueue.length - 1) {
                    const nextIndex = currentUploadIndex + 1;
                    setCurrentUploadIndex(nextIndex);
                    setCurrentUploadFile(uploadQueue[nextIndex]);

                    // Small delay before showing next modal
                    setTimeout(() => {
                        setShowUploadModal(true);
                    }, 500);
                } else {
                    // All files processed, clear queue
                    setUploadQueue([]);
                    setCurrentUploadIndex(0);
                    setCurrentUploadFile(null);
                }

                // Refresh file list
                await loadFiles();
            } else {
                setError(response.message || 'Upload failed');
                // Stop processing queue on error
                setUploadQueue([]);
                setCurrentUploadIndex(0);
                setCurrentUploadFile(null);
            }
        } catch (err) {
            setError(err.message || 'Upload failed');
            // Stop processing queue on error
            setUploadQueue([]);
            setCurrentUploadIndex(0);
            setCurrentUploadFile(null);
        } finally {
            setUploadProgress(false);
        }
    };

    const handleUploadCancel = () => {
        setShowUploadModal(false);

        // If there are more files in queue, ask user what to do
        if (uploadQueue.length > 1 && currentUploadIndex < uploadQueue.length - 1) {
            const remainingFiles = uploadQueue.length - currentUploadIndex - 1;
            const continueWithNext = window.confirm(
                `You have ${remainingFiles} more file(s) to upload. Do you want to continue with the next file?`
            );

            if (continueWithNext) {
                const nextIndex = currentUploadIndex + 1;
                setCurrentUploadIndex(nextIndex);
                setCurrentUploadFile(uploadQueue[nextIndex]);
                setShowUploadModal(true);
            } else {
                // Cancel entire queue
                setUploadQueue([]);
                setCurrentUploadIndex(0);
                setCurrentUploadFile(null);
            }
        } else {
            // Single file or last file, just clear
            setUploadQueue([]);
            setCurrentUploadIndex(0);
            setCurrentUploadFile(null);
        }
    };

    const openFileViewer = (fileId) => {
        const viewerUrl = `/viewer/${fileId}`;
        const newWindow = window.open(
            viewerUrl,
            `viewer_${fileId}`,
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1400,height=900,menubar=yes,location=yes,directories=no,status=yes'
        );

        if (newWindow) {
            newWindow.focus();
        } else {
            window.open(viewerUrl, '_blank');
        }
    };

    const handleDeleteFile = (file, event) => {
        event.preventDefault();
        event.stopPropagation();
        setFileToDelete(file);
        setShowDeleteModal(true);
    };

    const confirmDeleteFile = async () => {
        if (!fileToDelete) return;

        setDeleteInProgress(true);
        try {
            const result = await apiService.deleteFile(fileToDelete.file_id);

            if (result.success) {
                await loadFiles();
                setShowDeleteModal(false);
                setFileToDelete(null);
                // Remove from selected files if it was selected
                setSelectedFiles(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(fileToDelete.file_id);
                    return newSet;
                });
            } else {
                throw new Error(result.message || 'Delete failed');
            }
        } catch (error) {
            setError(`Failed to delete file: ${error.message}`);
        } finally {
            setDeleteInProgress(false);
        }
    };

    const closeDeleteModal = () => {
        if (deleteInProgress) return;
        setShowDeleteModal(false);
        setFileToDelete(null);
    };

    const handleDownloadFile = async (file) => {
        try {
            const response = await apiService.downloadFileWithSheet(file.file_id, 'csv', file.sheet_name);

            // Create blob and download
            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${file.custom_name || file.filename}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setError(`Failed to download file: ${error.message}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedFiles.size === 0) return;

        const confirmed = window.confirm(`Are you sure you want to delete ${selectedFiles.size} selected files? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            const fileIds = Array.from(selectedFiles);
            await apiService.bulkDeleteFiles(fileIds);
            await loadFiles();
            setSelectedFiles(new Set());
        } catch (error) {
            setError(`Failed to delete files: ${error.message}`);
        }
    };

    const toggleFileSelection = (fileId) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const selectAllFiles = () => {
        const allFileIds = filteredAndSortedFiles.map(f => f.file_id);
        setSelectedFiles(new Set(allFileIds));
    };

    const clearSelection = () => {
        setSelectedFiles(new Set());
    };

    const getFileTypeIcon = (filename) => {
        if (filename.toLowerCase().endsWith('.csv')) {
            return '📄';
        } else if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
            return '📊';
        }
        return '📄';
    };

    const formatFileSize = (sizeInMB) => {
        if (sizeInMB < 1) {
            return `${Math.round(sizeInMB * 1024)} KB`;
        }
        return `${sizeInMB.toFixed(2)} MB`;
    };

    const formatUploadTime = (uploadTime) => {
        return new Date(uploadTime).toLocaleString();
    };

    // Filter and sort files
    const filteredAndSortedFiles = files
        .filter(file => {
            const matchesSearch = searchTerm === '' ||
                (file.custom_name || file.filename).toLowerCase().includes(searchTerm.toLowerCase());

            const matchesFilter = filterType === 'all' ||
                (filterType === 'csv' && file.file_type === 'csv') ||
                (filterType === 'excel' && file.file_type === 'excel');

            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = (a.custom_name || a.filename).toLowerCase();
                    bValue = (b.custom_name || b.filename).toLowerCase();
                    break;
                case 'size':
                    aValue = a.file_size_mb || 0;
                    bValue = b.file_size_mb || 0;
                    break;
                case 'rows':
                    aValue = a.total_rows || 0;
                    bValue = b.total_rows || 0;
                    break;
                case 'upload_time':
                default:
                    aValue = new Date(a.upload_time);
                    bValue = new Date(b.upload_time);
                    break;
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

    const renderFileCard = (file) => {
        const displayName = file.custom_name || file.filename;
        const isExcel = file.file_type === 'excel';
        const isSelected = selectedFiles.has(file.file_id);

        return (
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <span className="text-2xl">{getFileTypeIcon(file.filename)}</span>
                            {isSelected && (
                                <CheckCircle className="absolute -top-1 -right-1 text-blue-600 bg-white rounded-full"
                                             size={16}/>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate" title={displayName}>
                                {displayName}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    isExcel
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {isExcel ? 'Excel' : 'CSV'}
                                </span>
                                {file.sheet_name && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                                        {file.sheet_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="flex space-x-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openFileViewer(file.file_id);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                                title="View File"
                            >
                                <Eye size={16}/>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(file);
                                }}
                                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-200"
                                title="Download File"
                            >
                                <Download size={16}/>
                            </button>
                            <button
                                onClick={(e) => handleDeleteFile(file, e)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-200"
                                title="Delete File"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <Rows size={14}/>
                            <span>{file.total_rows?.toLocaleString()} rows</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Columns size={14}/>
                            <span>{file.total_columns} cols</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <HardDrive size={14}/>
                            <span>{formatFileSize(file.file_size_mb)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Calendar size={14}/>
                            <span className="text-xs">{formatUploadTime(file.upload_time)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">
                        💡 Double-click to open in viewer
                    </p>
                </div>
            </div>
        );
    };

    const renderFileRow = (file) => {
        const displayName = file.custom_name || file.filename;
        const isExcel = file.file_type === 'excel';
        const isSelected = selectedFiles.has(file.file_id);

        return (
            <tr
                key={file.file_id}
                className={`hover:bg-blue-50 cursor-pointer transition-all duration-200 border-b border-gray-100 ${
                    isSelected ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => toggleFileSelection(file.file_id)}
                onDoubleClick={() => openFileViewer(file.file_id)}
            >
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-4">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFileSelection(file.file_id)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <span className="text-2xl">{getFileTypeIcon(file.filename)}</span>
                                {isSelected && (
                                    <div
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                        <CheckCircle className="text-white" size={10}/>
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 truncate text-sm" title={displayName}>
                                    {displayName}
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                            isExcel
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                                        }`}>
                                        {isExcel ? '📊 Excel' : '📄 CSV'}
                                    </span>
                                    {file.sheet_name && (
                                        <span
                                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                            📋 {file.sheet_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                        <Rows className="text-gray-400" size={16}/>
                        <span className="text-sm font-medium text-gray-900">
                            {file.total_rows?.toLocaleString()}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                        <Columns className="text-gray-400" size={16}/>
                        <span className="text-sm font-medium text-gray-900">
                            {file.total_columns}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                        <HardDrive className="text-gray-400" size={16}/>
                        <span className="text-sm font-medium text-gray-900">
                            {formatFileSize(file.file_size_mb)}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                        <Calendar className="text-gray-400" size={14}/>
                        <div className="text-sm text-gray-600">
                            <div className="font-medium">
                                {new Date(file.upload_time).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500">
                                {new Date(file.upload_time).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openFileViewer(file.file_id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 group"
                            title="View File"
                        >
                            <Eye size={16} className="group-hover:scale-110 transition-transform duration-200"/>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(file);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-all duration-200 group"
                            title="Download File"
                        >
                            <Download size={16} className="group-hover:scale-110 transition-transform duration-200"/>
                        </button>
                        <button
                            onClick={(e) => handleDeleteFile(file, e)}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 group"
                            title="Delete File"
                        >
                            <Trash2 size={16} className="group-hover:scale-110 transition-transform duration-200"/>
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading files...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-lg border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => window.close()}
                                className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
                                title="Close Window"
                            >
                                <ArrowLeft size={20}
                                           className="group-hover:transform group-hover:-translate-x-1 transition-transform duration-200"/>
                            </button>
                            <div className="flex items-center space-x-4">
                                <div
                                    className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                                    <FileText className="text-white" size={24}/>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                        File Library
                                    </h1>
                                    <div className="flex items-center space-x-4 mt-1">
                                        <p className="text-sm text-gray-600">
                                            📁 {files.length} files total
                                        </p>
                                        {files.length > 0 && (
                                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                                                <span>📊 {files.reduce((sum, f) => sum + (f.total_rows || 0), 0).toLocaleString()} total rows</span>
                                                <span>💾 {files.reduce((sum, f) => sum + (f.file_size_mb || 0), 0).toFixed(2)} MB</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => window.open('/', '_blank')}
                                className="flex items-center space-x-2 px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-300 group"
                                title="Open Main App"
                            >
                                <Home size={18} className="group-hover:scale-110 transition-transform duration-200"/>
                                <span className="font-medium">Main App</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Success Notification */}
            {showUploadSuccess && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                    <div
                        className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 mb-4 shadow-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="text-emerald-600" size={20}/>
                            </div>
                            <div>
                                <h4 className="font-semibold text-emerald-800">🎉 File uploaded successfully!</h4>
                                <p className="text-sm text-emerald-700">
                                    <span
                                        className="font-medium">{showUploadSuccess.custom_name || showUploadSuccess.filename}</span>
                                    {' '}- {showUploadSuccess.total_rows?.toLocaleString()} rows processed
                                    {uploadQueue.length > 1 && (
                                        <span
                                            className="ml-2 text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full">
                                            {currentUploadIndex + 1} of {uploadQueue.length}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                    <div
                        className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl p-4 mb-4 shadow-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="text-red-600" size={20}/>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-red-800">❌ Error</h4>
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-lg transition-all duration-200"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6 backdrop-blur-sm">
                    <div
                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                        {/* Upload and Actions */}
                        <div className="flex items-center space-x-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInputChange}
                                accept=".csv,.xlsx,.xls"
                                multiple
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadProgress}
                                className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl group"
                            >
                                {uploadProgress ? (
                                    <>
                                        <div
                                            className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        <span className="font-medium">Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18}
                                                className="group-hover:scale-110 transition-transform duration-200"/>
                                        <span className="font-medium">Upload Files</span>
                                        <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                                            Max 5
                                        </span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={loadFiles}
                                className="flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-300 group"
                            >
                                <RefreshCw size={16}
                                           className="group-hover:rotate-180 transition-transform duration-500"/>
                                <span className="font-medium">Refresh</span>
                            </button>

                            {selectedFiles.size > 0 && (
                                <div
                                    className="flex items-center space-x-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">{selectedFiles.size}</span>
                                        </div>
                                        <span className="text-sm font-medium text-blue-800">selected</span>
                                    </div>

                                    {selectedFiles.size === 1 && (
                                        <button
                                            onClick={() => {
                                                const fileId = Array.from(selectedFiles)[0];
                                                const file = files.find(f => f.file_id === fileId);
                                                if (file) handleDownloadFile(file);
                                            }}
                                            className="flex items-center space-x-2 px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-all duration-200 group"
                                        >
                                            <Download size={14}
                                                      className="group-hover:scale-110 transition-transform duration-200"/>
                                            <span className="font-medium">Download</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 group"
                                    >
                                        <Trash2 size={14}
                                                className="group-hover:scale-110 transition-transform duration-200"/>
                                        <span className="font-medium">Delete</span>
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Search and Filters */}
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                                        size={16}/>
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                />
                            </div>

                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-200"
                            >
                                <option value="all">All Files</option>
                                <option value="csv">CSV Files</option>
                                <option value="excel">Excel Files</option>
                            </select>

                            <select
                                value={`${sortBy}-${sortOrder}`}
                                onChange={(e) => {
                                    const [field, order] = e.target.value.split('-');
                                    setSortBy(field);
                                    setSortOrder(order);
                                }}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-200"
                            >
                                <option value="upload_time-desc">Newest First</option>
                                <option value="upload_time-asc">Oldest First</option>
                                <option value="name-asc">Name A-Z</option>
                                <option value="name-desc">Name Z-A</option>
                                <option value="size-desc">Largest First</option>
                                <option value="size-asc">Smallest First</option>
                                <option value="rows-desc">Most Rows</option>
                                <option value="rows-asc">Fewest Rows</option>
                            </select>

                            <div className="flex items-center space-x-2 bg-gray-100 rounded-xl p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all duration-200 ${
                                        viewMode === 'grid'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title="Grid View"
                                >
                                    <Grid size={16}/>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all duration-200 ${
                                        viewMode === 'list'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title="List View"
                                >
                                    <List size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Upload Queue Status */}
                    {uploadQueue.length > 1 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <Upload className="text-blue-600" size={16}/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            Upload Queue: {currentUploadIndex + 1} of {uploadQueue.length}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {uploadQueue.length - currentUploadIndex - 1} files remaining
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-32 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{width: `${((currentUploadIndex + 1) / uploadQueue.length) * 100}%`}}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-600 font-medium">
                                        {Math.round(((currentUploadIndex + 1) / uploadQueue.length) * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bulk Actions */}
                    {filteredAndSortedFiles.length > 0 && (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={selectAllFiles}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
                                >
                                    Select All ({filteredAndSortedFiles.length})
                                </button>
                                {selectedFiles.size > 0 && (
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors duration-200"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </div>
                            <div className="text-sm text-gray-600">
                                Showing {filteredAndSortedFiles.length} of {files.length} files
                            </div>
                        </div>
                    )}
                </div>

                {/* File Display */}
                {filteredAndSortedFiles.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-gray-400 mb-4"/>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {files.length === 0 ? 'No files uploaded' : 'No files match your search'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {files.length === 0
                                ? 'Upload CSV or Excel files to get started'
                                : 'Try adjusting your search terms or filters'
                            }
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            💡 Tip: You can upload up to 5 files at once • Double-click any file to open it in the viewer
                        </p>
                        {files.length === 0 && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                            >
                                <Upload size={18}/>
                                <span className="font-medium">Upload Your First Files</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAndSortedFiles.map(file => (
                            <div
                                key={file.file_id}
                                className={`group bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-lg cursor-pointer ${
                                    selectedFiles.has(file.file_id)
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                }`}
                                onClick={() => toggleFileSelection(file.file_id)}
                                onDoubleClick={() => openFileViewer(file.file_id)}
                            >
                                {renderFileCard(file)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    File
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rows
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Columns
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Size
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Upload Time
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedFiles.map(renderFileRow)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* File Upload Modal */}
            <FileUploadModal
                isOpen={showUploadModal}
                file={currentUploadFile}
                onUpload={handleUploadConfirm}
                onCancel={handleUploadCancel}
                existingFiles={files}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && fileToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="text-red-600" size={20}/>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800">Confirm Delete</h3>
                            </div>
                            <button
                                onClick={closeDeleteModal}
                                disabled={deleteInProgress}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800 mb-2">
                                    Are you sure you want to delete this file? This action cannot be undone.
                                </p>

                                <div className="bg-white border border-red-200 rounded p-2">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-lg">{getFileTypeIcon(fileToDelete.filename)}</span>
                                        <span className="text-sm font-medium text-gray-800">
                                            {fileToDelete.custom_name || fileToDelete.filename}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {fileToDelete.total_rows?.toLocaleString()} rows
                                        • {fileToDelete.total_columns} columns
                                        {fileToDelete.sheet_name && (
                                            <span className="ml-1 text-blue-600">• {fileToDelete.sheet_name}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={closeDeleteModal}
                                disabled={deleteInProgress}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteFile}
                                disabled={deleteInProgress}
                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200"
                            >
                                {deleteInProgress ? (
                                    <>
                                        <div
                                            className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16}/>
                                        <span>Delete File</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileLibraryPage;