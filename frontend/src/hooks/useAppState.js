// src/hooks/useAppState.js
import {useCallback, useEffect, useState} from 'react';
import {fileManagementService} from '../services/fileManagementService';
import {processManagementService} from '../services/processManagementService';
import {messageService} from '../services/messageService';

export const useFileManagement = () => {
    const [files, setFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(false);

    const loadFiles = useCallback(async () => {
        const result = await fileManagementService.getFiles();
        if (result.success) {
            setFiles(result.files);
        }
        return result;
    }, []);

    const uploadFile = useCallback(async (file) => {
        setUploadProgress(true);

        const result = await fileManagementService.uploadFile(file);

        if (result.success) {
            // Immediately refresh file list after successful upload
            await loadFiles();
        }

        setUploadProgress(false);
        return result;
    }, [loadFiles]);

    const deleteFile = useCallback(async (fileId) => {
        const result = await fileManagementService.deleteFile(fileId);
        if (result.success) {
            await loadFiles(); // Refresh file list
        }
        return result;
    }, [loadFiles]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    return {
        files,
        uploadProgress,
        loadFiles,
        uploadFile,
        deleteFile
    };
};

export const useTemplateManagement = () => {
    const [templates, setTemplates] = useState([]);

    const loadTemplates = useCallback(async () => {
        const result = await fileManagementService.getTemplates();
        if (result.success) {
            setTemplates(result.templates);
        }
        return result;
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    return {
        templates,
        loadTemplates
    };
};

export const useProcessManagement = () => {
    const [recentResults, setRecentResults] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeProcess, setActiveProcess] = useState(null);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

    const loadAllProcessedResult = useCallback(async () => {
        const result = await processManagementService.getAllProcessedResult();
        if (result.success) {
            setRecentResults(result.processedFiles);
        }
        return result;
    }, []);

    useEffect(() => {
        loadAllProcessedResult(); // runs once when the component mounts (on page load)
    }, [loadAllProcessedResult]);

    const startProcess = useCallback(async (type, config) => {
        setIsProcessing(true);

        let result;
        if (type === 'reconciliation') {
            result = await processManagementService.startReconciliation(config);
        } else if (type === 'delta-generation') {
            result = await processManagementService.startDeltaGeneration(config);
        } else if (type === 'file-transformation') {
            result = await processManagementService.startFileTransformation(config)
        }

        if (result.success) {
            setActiveProcess({
                id: result.processId,
                type,
                status: 'processing'
            });

            // Add to processed files list
            setRecentResults(prev => [result.process, ...prev]);

            // Monitor the process
            monitorProcess(result.processId, type);
        } else {
            setIsProcessing(false);
        }

        return result;
    }, []);

    const monitorProcess = useCallback(async (processId, type) => {
        const result = await processManagementService.monitorProcess(processId, type);

        if (result.success && result.status === 'completed') {
            setIsProcessing(false);
            setActiveProcess(null);

            // Update the processed file status
            setRecentResults(prev =>
                prev.map(file => {
                    let idField = 'reconciliation'
                    if (type === 'delta-generation') {
                        idField = 'delta_id'
                    } else if (type === 'file-transformation') {
                        idField = 'generation_id'
                    }
                    return file[idField] === processId
                        ? {...file, status: 'completed'}
                        : file;
                })
            );
        }

        return result;
    }, []);

    const getDetailedResults = useCallback(async (resultId, type) => {
        return await processManagementService.getDetailedResults(resultId, type);
    }, []);

    const downloadResults = useCallback(async (resultId, resultType, processType) => {
        return await processManagementService.downloadResults(resultId, resultType, processType);
    }, []);

    const addProcessingResult = (processingEntry) => {
        setRecentResults(prev => [processingEntry, ...prev]);
    };

// Function to update a processing result (e.g., from processing to completed)
    const updateProcessingResult = (tempId, updatedEntry) => {
        setRecentResults(prev =>
            prev.map(file => {
                // Check different ID fields based on process type
                if (file.generation_id === tempId ||
                    file.delta_id === tempId ||
                    file.reconciliation_id === tempId ||
                    file.process_id === tempId ||
                    file.id === tempId) {
                    return updatedEntry;
                }
                return file;
            })
        );
    };

// Function to remove a processing result (if needed)
    const removeProcessingResult = (tempId) => {
        setRecentResults(prev =>
            prev.filter(file =>
                file.generation_id !== tempId &&
                file.delta_id !== tempId &&
                file.reconciliation_id !== tempId &&
                file.process_id !== tempId &&
                file.id !== tempId
            )
        );
    };

    // Cleanup auto-refresh interval on unmount
    useEffect(() => {
        return () => {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
        };
    }, [autoRefreshInterval]);

    return {
        recentResults,
        isProcessing,
        activeProcess,
        loadAllProcessedResult,
        startProcess,
        monitorProcess,
        getDetailedResults,
        downloadResults,
        addProcessingResult,
        updateProcessingResult,
        removeProcessingResult
    };
};

export const useMessageManagement = () => {
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    const addMessage = useCallback((type, content, useTyping = true, tableData = null) => {
        if (useTyping && (type === 'system' || type === 'success' || type === 'result')) {
            setIsTyping(true);
            setTypingMessage('');

            messageService.simulateTyping(
                content,
                (progress) => setTypingMessage(progress),
                () => {
                    setIsTyping(false);
                    setTypingMessage('');
                    const newMessage = messageService.createMessage(type, content, tableData);
                    setMessages(prev => [...prev, newMessage]);
                }
            );
        } else {
            const newMessage = messageService.createMessage(type, content, tableData);
            setMessages(prev => [...prev, newMessage]);
        }
    }, []);

    const sendMessage = useCallback((type, content) => {
        addMessage(type, content, false);
    }, [addMessage]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setIsInitialized(false);
    }, []);

    const initializeChat = useCallback(() => {
        // Prevent double initialization
        if (isInitialized) return;

        setIsInitialized(true);
        const welcomeMessage = messageService.getWelcomeMessage();
        addMessage('system', welcomeMessage, true);
    }, [addMessage, isInitialized]);

    return {
        messages,
        isTyping,
        typingMessage,
        isInitialized,
        addMessage,
        sendMessage,
        clearMessages,
        initializeChat
    };
};

export const useFileSelection = () => {
    const [selectedFiles, setSelectedFiles] = useState({});
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [requiredFiles, setRequiredFiles] = useState([]);
    const [currentInput, setCurrentInput] = useState('');

    const handleTemplateSelect = useCallback((template) => {
        setSelectedTemplate(template);
        setCurrentInput(template?.user_requirements || '');
        setSelectedFiles({}); // Reset selected files when template changes

        if (template) {
            const fileRequirements = fileManagementService.setupFileRequirements(template);
            setRequiredFiles(fileRequirements);
        } else {
            setRequiredFiles([]);
            setCurrentInput('');
        }
    }, []);

    const validateSelection = useCallback(() => {
        return fileManagementService.validateFileSelection(selectedFiles, requiredFiles);
    }, [selectedFiles, requiredFiles]);

    const areAllFilesSelected = useCallback(() => {
        if (!selectedTemplate || !requiredFiles || requiredFiles.length === 0) {
            return false;
        }
        return requiredFiles.every(rf => selectedFiles[rf.key]);
    }, [selectedTemplate, requiredFiles, selectedFiles]);

    return {
        selectedFiles,
        setSelectedFiles,
        selectedTemplate,
        requiredFiles,
        currentInput,
        setCurrentInput,
        handleTemplateSelect,
        validateSelection,
        areAllFilesSelected
    };
};

export const usePanelResize = () => {
    const [leftPanelWidth, setLeftPanelWidth] = useState(320);
    const [rightPanelWidth, setRightPanelWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;

            if (isResizing === 'left') {
                const newWidth = Math.max(250, Math.min(600, e.clientX));
                setLeftPanelWidth(newWidth);
            } else if (isResizing === 'right') {
                const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
                setRightPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return {
        leftPanelWidth,
        rightPanelWidth,
        isResizing,
        setIsResizing
    };
};

export const useDocumentTitle = (
    isProcessing,
    activeProcess,
    uploadProgress,
    selectedFiles
) => {
    useEffect(() => {
        let title = 'Financial Reconciliation Chat';

        if (isProcessing && activeProcess) {
            title = '🔄 Processing...';
        } else if (uploadProgress) {
            title = '📤 Uploading File...';
        } else if (selectedFiles.fileA && selectedFiles.fileB) {
            title = '✅ Ready to Process';
        }

        document.title = title;

        return () => {
            document.title = 'Financial Reconciliation Chat';
        };
    }, [isProcessing, activeProcess, uploadProgress, selectedFiles]);
};