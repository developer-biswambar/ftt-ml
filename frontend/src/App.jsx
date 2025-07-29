// src/App.jsx - Updated with AI File Generation Processing Support
import React from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {messageService} from './services/messageService';
import {
    useDocumentTitle,
    useFileManagement,
    useFileSelection,
    useMessageManagement,
    usePanelResize,
    useProcessManagement,
    useTemplateManagement
} from './hooks/useAppState';
import LeftSidebar from './components/core/LeftSideBar.jsx';
import ChatInterface from './components/core/ChatInterface.jsx';
import RightSidebar from './components/core/RightSideBar.jsx';
import ViewerPage from './pages/ViewerPage';
import FileLibraryPage from './pages/FileLibraryPage';
import RecentResultsPage from './pages/RecentResultsPage';

const MainApp = () => {
    // All state management is now handled by custom hooks
    const {files, uploadProgress, loadFiles, uploadFile} = useFileManagement();
    const {templates} = useTemplateManagement();
    const {
        recentResults,
        isProcessing,
        activeProcess,
        startProcess,
        getDetailedResults,
        downloadResults,
        loadProcessedFiles,
        addProcessingResult,
        updateProcessingResult
    } = useProcessManagement();
    const {
        messages,
        isTyping,
        typingMessage,
        addMessage,
        sendMessage,
        initializeChat
    } = useMessageManagement();
    const {
        selectedFiles,
        setSelectedFiles,
        selectedTemplate,
        requiredFiles,
        currentInput,
        setCurrentInput,
        handleTemplateSelect,
        areAllFilesSelected
    } = useFileSelection();
    const {
        leftPanelWidth,
        rightPanelWidth,
        isResizing,
        setIsResizing
    } = usePanelResize();

    // Set document title based on current state
    useDocumentTitle(isProcessing, activeProcess, uploadProgress, selectedFiles);

    // Initialize chat on mount - prevent double execution
    const didInitialize = React.useRef(false);
    React.useEffect(() => {
        if (didInitialize.current) return;
        didInitialize.current = true;
        initializeChat();
    }, [initializeChat]);

    // File upload handler
    const handleFileUpload = async (file) => {
        if (!file) return;

        addMessage('system', messageService.getUploadProgressMessage(file.name), true);

        const result = await uploadFile(file);

        if (result.success) {
            addMessage('system', messageService.getUploadSuccessMessage(result.file), true);
        } else {
            addMessage('error', messageService.getErrorMessage(result.error, 'Upload failed'), false);
        }
    };

    // Template selection handler
    const onTemplateSelect = (template) => {
        handleTemplateSelect(template);

        if (template) {
            addMessage('user', `📋 Selected process: ${template.name}`, false);
            const templateMessage = messageService.getTemplateSelectedMessage(template);
            addMessage('system', templateMessage, true);
        }
    };

    // Merge file generation processing with regular processed files for the sidebar
    const allProcessedFiles = React.useMemo(() => {
        return recentResults;
    }, [recentResults]);

    // Process handlers
    const handleReconciliation = async (reconciliationConfig) => {
        if (!selectedTemplate || !areAllFilesSelected()) {
            addMessage('error', '❌ Please select a process and all required files first.', false);
            return;
        }

        // Build process config
        const processConfig = {
            process_type: selectedTemplate.category,
            process_name: selectedTemplate.name,
            user_requirements: reconciliationConfig?.user_requirements || currentInput,
            files: Object.entries(selectedFiles).map(([key, file]) => ({
                file_id: file.file_id,
                role: key,
                label: selectedTemplate.fileLabels[parseInt(key.split('_')[1])]
            }))
        };

        if (reconciliationConfig && selectedTemplate.category.includes('reconciliation')) {
            processConfig.reconciliation_config = reconciliationConfig;
        }

        // Start process
        addMessage('user', `Starting ${selectedTemplate.name.toLowerCase()}...`, false);
        addMessage('system', messageService.getProcessStartMessage(selectedTemplate, true), true);

        const result = await startProcess('reconciliation', processConfig);

        if (result.success) {
            addMessage('system', '✅ Process started! Monitoring progress...', true);
            setCurrentInput('');

            // Simulate completion after 3 seconds
            setTimeout(() => {
                addMessage('success', `🎉 ${selectedTemplate?.name || 'Process'} completed successfully!`, true);

                const resultText = messageService.formatReconciliationResults(result);
                addMessage('result', resultText, true);
            }, 3000);
        } else {
            addMessage('error', messageService.getErrorMessage(result.error, 'Failed to start'), false);
        }
    };

    const handleStartTransformation = async (fileTransformationConfig) => {

        if (!selectedTemplate || !areAllFilesSelected()) {
            addMessage('error', '❌ Please select a process and all required files first.', false);
            return;
        }

        // Start process
        addMessage('user', `Starting ${selectedTemplate.name.toLowerCase()}...`, false);
        addMessage('system', messageService.getProcessStartMessage(selectedTemplate, true), true);

        const result = await startProcess('file-transformation', fileTransformationConfig);

        if (result.success) {
            addMessage('system', '✅ Process started! Monitoring progress...', true);
            setCurrentInput('');

            // Simulate completion after 3 seconds
            setTimeout(() => {
                addMessage('success', `🎉 ${selectedTemplate?.name || 'Process'} completed successfully!`, true);

                const resultText = messageService.formatFileTransformationResult(result);
                addMessage('result', resultText, true);
            }, 3000);
        } else {
            addMessage('error', messageService.getErrorMessage(result.error, 'Failed to start'), false);
        }

    };
    const handleDeltaGeneration = async (deltaConfig) => {
        if (!selectedTemplate || !areAllFilesSelected()) {
            addMessage('error', '❌ Please select a process and all required files first.', false);
            return;
        }

        // Build delta config
        const processConfig = {
            files: Object.entries(selectedFiles).map(([key, file]) => ({
                file_id: file.file_id,
                role: key,
                label: selectedTemplate.fileLabels[parseInt(key.split('_')[1])]
            })),
            ...deltaConfig
        };

        addMessage('user', `Starting ${selectedTemplate.name.toLowerCase()}...`, false);
        addMessage('system', `📊 Starting Delta Generation...\n\n⏳ Analyzing changes between older and newer files...`, true);

        const result = await startProcess('delta-generation', processConfig);

        if (result.success) {
            // Simulate completion after 3 seconds
            setTimeout(() => {
                const summaryText = messageService.formatDeltaResults(result.summary, result.processId);
                addMessage('result', summaryText, true);

                setTimeout(() => {
                    addMessage('system', '💡 Use "Display Detailed Results" button above or download options in the right panel to view the delta details.', true);
                }, 1000);
            }, 3000);
        } else {
            addMessage('error', messageService.getErrorMessage(result.error, 'Delta generation failed'), false);
        }
    };

    // Display detailed results handler
    const displayDetailedResults = async (resultId) => {
        try {
            // Determine process type
            const deltaRecord = recentResults.find(f => f.delta_id === resultId);
            const reconRecord = recentResults.find(f => f.reconciliation_id === resultId);
            const generationRecord = recentResults.find(f => f.generation_id === resultId);

            let processType = 'unknown';
            if (deltaRecord) processType = 'delta-generation';
            else if (reconRecord) processType = 'reconciliation';
            else if (generationRecord) processType = 'file-generation';

            addMessage('system', '🔍 Fetching detailed results...', true);

            if (processType === 'file-generation') {
                // Handle file generation results
                const {apiService} = await import('./services/defaultApi.js');
                const result = await apiService.getFileTransformationResults(resultId);

                if (result.data) {
                    // Display file generation results
                    const previewData = result.data.slice(0, 10);
                    let detailsMessage = `📄 **Generated File Details**\n\n`;
                    detailsMessage += `📊 **Total Records:** ${result.data.length.toLocaleString()}\n`;
                    detailsMessage += `📋 **Columns:** ${Object.keys(result.data[0] || {}).join(', ')}\n\n`;
                    detailsMessage += `🔍 **Preview (First 10 rows):**\n`;

                    // Create a simple preview table
                    if (previewData.length > 0) {
                        const headers = Object.keys(previewData[0]);
                        const tableData = previewData.map(row =>
                            headers.map(header => row[header] || '').join(' | ')
                        ).join('\n');
                        detailsMessage += `\n${headers.join(' | ')}\n${'-'.repeat(headers.join(' | ').length)}\n${tableData}`;
                    }

                    addMessage('result', detailsMessage, true);
                } else {
                    addMessage('error', 'Could not retrieve file generation details', false);
                }
            } else {
                // Handle delta/reconciliation results
                const result = await getDetailedResults(resultId, processType);

                if (result.success) {
                    setTimeout(() => {
                        if (result.type === 'delta') {
                            // Handle delta results (existing logic)
                            const categories = messageService.getDeltaTableCategories();

                            Object.entries(result.data).forEach(([category, data]) => {
                                if (data.length > 0) {
                                    const categoryInfo = categories[category];
                                    const tableData = messageService.createTableData(
                                        `${categoryInfo.name} (${data.length} total)`,
                                        data,
                                        categoryInfo.color,
                                        data.length
                                    );

                                    const tableMessage = {
                                        id: Date.now() + Math.random() + category,
                                        type: 'table',
                                        content: tableData.title,
                                        tableData,
                                        timestamp: new Date()
                                    };
                                    setMessages(prev => [...prev, tableMessage]);
                                }
                            });

                            const summaryText = messageService.formatDetailedResultsSummary('delta', result.data);
                            addMessage('result', summaryText, true);

                        } else {
                            // Handle reconciliation results (existing logic)
                            const categories = messageService.getReconciliationTableCategories();

                            Object.entries(result.data).forEach(([category, data]) => {
                                if (data.length > 0) {
                                    const categoryInfo = categories[category];
                                    const tableData = messageService.createTableData(
                                        `${categoryInfo.name} (${data.length} records)`,
                                        data,
                                        categoryInfo.color,
                                        data.length
                                    );

                                    const tableMessage = {
                                        id: Date.now() + Math.random(),
                                        type: 'table',
                                        content: tableData.title,
                                        tableData,
                                        timestamp: new Date()
                                    };
                                    setMessages(prev => [...prev, tableMessage]);
                                }
                            });

                            const summaryText = messageService.formatDetailedResultsSummary('reconciliation', result.data);
                            addMessage('result', summaryText, true);
                        }
                    }, 1500);
                } else {
                    addMessage('error', messageService.getErrorMessage(result.error, 'Failed to fetch detailed results'), false);
                }
            }

        } catch (error) {
            console.error('Error displaying detailed results:', error);
            addMessage('error', messageService.getErrorMessage(error.message, 'Failed to fetch detailed results'), false);
        }
    };

    // Download results handler
    const handleDownloadResults = async (resultId, resultType) => {
        try {
            if (recentResults.length === 0) return
            // Determine process type
            const deltaRecord = recentResults.find(f => f.delta_id === resultId);
            const generationRecord = recentResults.find(f => f.generation_id === resultId);

            let processType = 'reconciliation';
            if (deltaRecord) processType = 'delta-generation';
            else if (generationRecord) processType = 'file-generation';

            addMessage('system', `📥 Preparing ${resultType.replace('_', ' ')} download...`, true);

            if (processType === 'file-generation') {
                // Handle file generation downloads
                const {deltaApiService} = await import('./services/deltaApiService');
                const result = await deltaApiService.downloadFileGenerationResults(
                    resultId,
                    resultType === 'all_excel' ? 'excel' : 'csv'
                );

                if (result.success) {
                    addMessage('system', `✅ File downloaded: ${result.filename}`, true);
                } else {
                    addMessage('error', 'Download failed', false);
                }
            } else {
                // Handle delta/reconciliation downloads
                const result = await downloadResults(resultId, resultType, processType);

                if (result.success) {
                    addMessage('system', `✅ ${result.message}`, true);
                } else {
                    addMessage('error', messageService.getErrorMessage(result.error, 'Download failed'), false);
                }
            }

        } catch (error) {
            console.error('Download failed:', error);
            addMessage('error', messageService.getErrorMessage(error.message, 'Download failed'), false);
        }
    };

    // Function to open File Library in new tab
    const openFileLibrary = () => {
        const fileLibraryUrl = '/file-library';
        const newWindow = window.open(
            fileLibraryUrl,
            'file_library',
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1600,height=1000,menubar=yes,location=yes,directories=no,status=yes'
        );

        if (newWindow) {
            newWindow.focus();
        } else {
            window.open(fileLibraryUrl, '_blank');
        }
    };

    // Function to open Recent Results in new tab
    const openRecentResults = () => {
        const recentResultsUrl = '/recent-results';
        const newWindow = window.open(
            recentResultsUrl,
            'recent_results',
            'toolbar=yes,scrollbars=yes,resizable=yes,width=1600,height=1000,menubar=yes,location=yes,directories=no,status=yes'
        );

        if (newWindow) {
            newWindow.focus();
        } else {
            window.open(recentResultsUrl, '_blank');
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <LeftSidebar
                files={files}
                templates={templates}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                selectedTemplate={selectedTemplate}
                requiredFiles={requiredFiles}
                currentInput={currentInput || ''}
                uploadProgress={uploadProgress}
                onFileUpload={handleFileUpload}
                onTemplateSelect={onTemplateSelect}
                onRefreshFiles={loadFiles}
                onOpenFileLibrary={openFileLibrary}
                width={leftPanelWidth}
            />

            <div
                className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 relative group"
                onMouseDown={() => setIsResizing('left')}
            >
                <div className="absolute inset-0 w-2 -translate-x-0.5"></div>
                <div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </div>

            <ChatInterface
                messages={messages}
                currentInput={currentInput || ''}
                setCurrentInput={setCurrentInput}
                isProcessing={isProcessing}
                isAnalyzingColumns={false}
                selectedFiles={selectedFiles}
                selectedTemplate={selectedTemplate}
                requiredFiles={requiredFiles}
                onStartReconciliationInApp={handleReconciliation}
                onStartDeltaGenerationInApp={handleDeltaGeneration}
                onFileTransformationInApp={handleStartTransformation}
                isTyping={isTyping}
                typingMessage={typingMessage}
                files={files}
                onSendMessage={sendMessage}
                onDisplayDetailedResults={displayDetailedResults}
            />

            <div
                className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 relative group"
                onMouseDown={() => setIsResizing('right')}
            >
                <div className="absolute inset-0 w-2 -translate-x-0.5"></div>
                <div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </div>

            <RightSidebar
                processedFiles={allProcessedFiles}
                autoRefreshInterval={null}
                onRefreshProcessedFiles={loadProcessedFiles}
                onDownloadResults={handleDownloadResults}
                onDisplayDetailedResults={displayDetailedResults}
                onOpenRecentResults={openRecentResults}
                width={rightPanelWidth}
            />
        </div>
    );
};

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainApp/>}/>
                <Route path="/viewer/:fileId" element={<ViewerPage/>}/>
                <Route path="/file-library" element={<FileLibraryPage/>}/>
                <Route path="/recent-results" element={<RecentResultsPage/>}/>
            </Routes>
        </Router>
    );
};

export default App;