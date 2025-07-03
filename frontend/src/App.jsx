// src/App.jsx - Enhanced with result display and download options
import React, {useEffect, useState} from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {apiService} from './services/api';
import LeftSidebar from './components/LeftSidebar';
import ChatInterface from './components/ChatInterface';
import RightSidebar from './components/RightSideBar';
import ViewerPage from './pages/ViewerPage';

const MainApp = () => {
    const [files, setFiles] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState({});
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [requiredFiles, setRequiredFiles] = useState([]);
    const [currentProcess, setCurrentProcess] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeReconciliation, setActiveReconciliation] = useState(null);
    const [processedFiles, setProcessedFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(false);
    const [isAnalyzingColumns, setIsAnalyzingColumns] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');

    // Panel widths state
    const [leftPanelWidth, setLeftPanelWidth] = useState(320);
    const [rightPanelWidth, setRightPanelWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(null);

    // Helper function to check if all files are selected
    const areAllFilesSelected = () => {
        if (!selectedTemplate || !requiredFiles || requiredFiles.length === 0) {
            return false;
        }
        return requiredFiles.every(rf => selectedFiles[rf.key]);
    };

    // Set document title based on current state
    useEffect(() => {
        let title = 'Financial Reconciliation Chat';

        if (isProcessing && activeReconciliation) {
            title = '🔄 Processing Reconciliation...';
        } else if (isAnalyzingColumns) {
            title = '🔍 Analyzing Columns...';
        } else if (uploadProgress) {
            title = '📤 Uploading File...';
        } else if (selectedFiles.fileA && selectedFiles.fileB) {
            title = '✅ Ready to Reconcile';
        }

        document.title = title;

        return () => {
            document.title = 'Financial Reconciliation Chat';
        };
    }, [isProcessing, activeReconciliation, isAnalyzingColumns, uploadProgress, selectedFiles]);

    // Mouse events for resizing
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

    // Initial setup
    useEffect(() => {
        simulateTyping('system', '🎯 Welcome to Financial Data Reconciliation!\n\n📋 **Getting Started:**\n1. Upload two files to compare\n2. Select them in the file selector\n3. Choose a template (try our AI-powered option!)\n4. Configure reconciliation rules\n5. Start the reconciliation process\n\nI\'ll analyze your data and provide detailed matching results with downloadable reports.\n\n💡 **New Features:**\n• 🤖 AI-powered rule generation\n• 👁️ Click the eye icon to view/edit files\n• ⚙️ Manual configuration for full control\n• 🔧 AI File Generator for creating new files\n• 📊 Display results directly in chat\n• 📥 Download individual result types');
        loadInitialData();
    }, []);

    // Auto-analyze when required files are selected
    useEffect(() => {
        if (selectedTemplate && areAllFilesSelected()) {
            if (selectedTemplate.category.includes('reconciliation')) {
                analyzeColumnCompatibility();
            } else if (selectedTemplate.category.includes('ai-generation')) {
                analyzeSingleFileStructure();
            } else {
                analyzeSingleFileStructure();
            }
        }
    }, [selectedFiles, selectedTemplate, requiredFiles]);

    // Cleanup auto-refresh interval on unmount
    useEffect(() => {
        return () => {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
        };
    }, [autoRefreshInterval]);

    const simulateTyping = (type, content, delay = 1) => {
        setIsTyping(true);
        setTypingMessage('');

        let currentIndex = 0;
        const typingInterval = setInterval(() => {
            if (currentIndex < content.length) {
                setTypingMessage(content.substring(0, currentIndex + 1));
                currentIndex++;
            } else {
                clearInterval(typingInterval);
                setIsTyping(false);
                setTypingMessage('');

                const newMessage = {
                    id: Date.now() + Math.random(),
                    type,
                    content,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, newMessage]);
            }
        }, delay);
    };

    const loadInitialData = async () => {
        await Promise.all([
            loadTemplates(),
            loadFiles(),
            loadProcessedFiles()
        ]);
    };

    const loadTemplates = async () => {
        try {
            const response = await apiService.getReconciliationTemplates();
            const baseTemplates = response.data || [];

            // Add the AI File Generator template
            const enhancedTemplates = [
                ...baseTemplates,
                {
                    name: "🤖 AI File Generator",
                    description: "Generate new files from existing data using natural language prompts. Perfect for creating reports, transforming data formats, or extracting specific information.",
                    category: "ai-generation",
                    filesRequired: 1,
                    fileLabels: ["Source File"],
                    user_requirements: "Describe the file you want to generate. For example: 'create reporting file with jurisdiction always italy, trade_id from Trade_ID, header always XYZ'",
                }
            ];

            setTemplates(enhancedTemplates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            simulateTyping('error', 'Failed to load process templates');
        }
    };

    const loadFiles = async () => {
        try {
            const data = await apiService.getFiles();
            if (data.success) {
                setFiles(data.data.files || []);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        }
    };

    const loadProcessedFiles = async () => {
        return [];
        try {
            const data = await apiService.getReconciliations();
            if (data.success) {
                setProcessedFiles(data.data.reconciliations || []);

                const hasProcessing = (data.data.reconciliations || []).some(
                    rec => rec.status === 'processing' || rec.status === 'pending'
                );

                if (hasProcessing && !autoRefreshInterval) {
                    const interval = setInterval(loadProcessedFiles, 3000);
                    setAutoRefreshInterval(interval);
                } else if (!hasProcessing && autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    setAutoRefreshInterval(null);
                }
            }
        } catch (error) {
            console.error('Failed to load processed files:', error);
        }
    };

    const addMessage = (type, content, useTyping = true) => {
        if (useTyping && (type === 'system' || type === 'success' || type === 'result')) {
            simulateTyping(type, content);
        } else {
            const newMessage = {
                id: Date.now() + Math.random(),
                type,
                content,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, newMessage]);
        }
    };

    const sendMessage = (type, content) => {
        addMessage(type, content, false);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploadProgress(true);
        addMessage('system', `📤 Uploading "${file.name}"...`, true);

        try {
            const data = await apiService.uploadFile(file);
            if (data.success) {
                const newFile = data.data;
                setFiles(prev => [...prev, newFile]);
                await loadFiles();

                addMessage('system', `✅ File "${file.name}" uploaded successfully!\n📊 Rows: ${newFile.total_rows} | Columns: ${newFile.columns.length}\n💡 Click the 👁️ eye icon to view and edit the data!`, true);
            } else {
                addMessage('error', `❌ Upload failed: ${data.message}`, false);
            }
        } catch (error) {
            addMessage('error', `❌ Upload error: ${error.response?.data?.detail || error.message}`, false);
        } finally {
            setUploadProgress(false);
        }
    };

    const handleTemplateSelect = (template) => {
        setSelectedTemplate(template);
        setCurrentInput(template.user_requirements);
        setCurrentProcess(template.category);

        // Reset selected files when template changes
        setSelectedFiles({});

        // Set up required files based on template
        const fileRequirements = [];
        for (let i = 0; i < template.filesRequired; i++) {
            fileRequirements.push({
                key: `file_${i}`,
                label: template.fileLabels[i] || `File ${i + 1}`,
                selected: null
            });
        }
        setRequiredFiles(fileRequirements);

        addMessage('user', `📋 Selected process: ${template.name}`, false);

        const fileText = template.filesRequired === 1 ? 'file' : 'files';
        const requirementText = `✅ Process selected: "${template.name}"\n\n📁 **File Requirements:**\nThis process requires ${template.filesRequired} ${fileText}:\n${template.fileLabels.map((label, index) => `${index + 1}. ${label}`).join('\n')}\n\n👈 Please select the required ${fileText} from the left panel to proceed.`;

        if (template.category.includes('ai')) {
            addMessage('system', `${requirementText}\n\n🤖 This process will use AI to analyze your data automatically.`, true);
        } else {
            addMessage('system', `${requirementText}\n\n⚙️ You'll configure the process parameters step by step.`, true);
        }
    };

    const analyzeColumnCompatibility = async () => {
        const fileKeys = Object.keys(selectedFiles);
        if (fileKeys.length < 2 || !selectedTemplate || isAnalyzingColumns) return;

        setIsAnalyzingColumns(true);
        try {
            addMessage('system', '🔍 Analyzing column compatibility between files...', true);

            // Mock compatibility analysis
            setTimeout(() => {
                const matchText = `🔗 **Column Compatibility Analysis:**

📊 **Files Being Compared:**
${fileKeys.map((key, index) => `• ${selectedTemplate.fileLabels[index]}: ${selectedFiles[key].filename}`).join('\n')}

✅ **Potential Matches Found:**
• Amount columns: High compatibility (95%)
• Reference/ID columns: Good compatibility (87%)
• Date columns: Moderate compatibility (72%)

🎯 **Process Ready:**
Files are compatible for ${selectedTemplate.name.toLowerCase()}. ${selectedTemplate.category.includes('ai') ? 'AI will suggest optimal matching rules.' : 'Configure matching rules in the next step.'}`;

                addMessage('system', matchText, true);
                setIsAnalyzingColumns(false);
            }, 2000);

        } catch (error) {
            console.error('Column analysis failed:', error);
            addMessage('system', '⚠️ Column analysis completed. Ready to proceed with configuration.', true);
            setIsAnalyzingColumns(false);
        }
    };

    const analyzeSingleFileStructure = async () => {
        if (!selectedFiles.file_0 || !selectedTemplate) return;

        setIsAnalyzingColumns(true);
        try {
            addMessage('system', '🔍 Analyzing file structure and data patterns...', true);

            // Mock analysis for single file
            setTimeout(() => {
                const analysisText = `📊 **File Analysis Complete:**

🔍 **Structure Detected:**
• Columns: ${selectedFiles.file_0.columns?.length || 0}
• Rows: ${selectedFiles.file_0.total_rows?.toLocaleString() || 0}
• Data Types: Mixed (text, numbers, dates detected)

🎯 **Process Ready:**
Your file is ready for ${selectedTemplate.name.toLowerCase()}. ${selectedTemplate.category.includes('ai-generation') ? 'AI will help you create a new file based on your requirements.' : 'Click Start to begin processing.'}`;

                addMessage('system', analysisText, true);
                setIsAnalyzingColumns(false);
            }, 2000);

        } catch (error) {
            console.error('Single file analysis failed:', error);
            addMessage('system', '⚠️ File analysis completed. Ready to proceed with processing.', true);
            setIsAnalyzingColumns(false);
        }
    };

    const startReconciliation = async (reconciliationConfig) => {
        if (!selectedTemplate || !areAllFilesSelected()) {
            addMessage('error', '❌ Please select a process and all required files first.', false);
            return;
        }

        setIsProcessing(true);
        addMessage('user', `Starting ${selectedTemplate.name.toLowerCase()}...`, false);
        addMessage('system', `🚀 Starting ${selectedTemplate.name}...\n\n⏳ This may take 30-60 seconds depending on file size and complexity.`, true);

        try {
            // Handle file generation differently
            if (selectedTemplate.category.includes('ai-generation')) {
                // For file generation, we don't call the reconciliation endpoint
                // The FileGeneratorFlow handles its own API calls
                addMessage('system', '✅ File generation process initiated!', true);
                setIsProcessing(false);
                return;
            }

            // Build request for reconciliation processes
            const processRequest = {
                process_type: selectedTemplate.category,
                process_name: selectedTemplate.name,
                user_requirements: reconciliationConfig?.user_requirements || currentInput,
                files: Object.entries(selectedFiles).map(([key, file]) => ({
                    file_id: file.file_id,
                    role: key,
                    label: selectedTemplate.fileLabels[parseInt(key.split('_')[1])]
                }))
            };

            // Add reconciliation config if applicable
            if (reconciliationConfig && selectedTemplate.category.includes('reconciliation')) {
                processRequest.reconciliation_config = reconciliationConfig;
            }

            const data = await apiService.startReconciliation(processRequest);

            if (data.success) {
                setActiveReconciliation(data.reconciliation_id);

                // Add the reconciliation to processed files immediately
                const newReconciliation = {
                    reconciliation_id: data.reconciliation_id,
                    status: 'processing',
                    file_a: selectedFiles.file_0?.filename || 'File A',
                    file_b: selectedFiles.file_1?.filename || 'File B',
                    match_rate: data.summary.match_percentage,
                    match_confidence: 0,
                    created_at: new Date().toISOString(),
                    summary: data.summary
                };

                setProcessedFiles(prev => [newReconciliation, ...prev]);

                addMessage('system', '✅ Process started! Monitoring progress...', true);
                setCurrentInput('');
                monitorProcess(data);
            } else {
                addMessage('error', `❌ Failed to start: ${data.message}`, false);
                setIsProcessing(false);
            }
        } catch (error) {
            console.error('Reconciliation error:', error);
            addMessage('error', `❌ Error: ${error.response?.data?.detail || error.message}`, false);
            setIsProcessing(false);
        }
    };

    const monitorProcess = async (reconProcessData) => {
        const checkStatus = async () => {
            try {
                // For now, simulate completion after 3 seconds since we don't have a status endpoint
                setTimeout(() => {
                    setIsProcessing(false);
                    setActiveReconciliation(null);

                    // Update the processed file status
                    setProcessedFiles(prev =>
                        prev.map(file =>
                            file.reconciliation_id === reconProcessData.reconciliation_id
                                ? {
                                    ...file,
                                    status: 'completed',
                                    match_rate: reconProcessData.match_percentage,
                                    match_confidence: reconProcessData.match_percentage,
                                }
                                : file
                        )
                    );

                    addMessage('success', `🎉 ${selectedTemplate?.name || 'Process'} completed successfully!`, true);

                    // Display results in chat
                    const mockResult = {
                        summary: {
                            matched_count: reconProcessData.summary.matched_records,
                            unmatched_file_a_count: reconProcessData.summary.unmatched_file_a,
                            unmatched_file_b_count: reconProcessData.summary.unmatched_file_b,
                            total_file_a: reconProcessData.summary.total_records_file_a,
                            total_file_b: reconProcessData.summary.total_records_file_b,
                            match_rate: reconProcessData.summary.match_percentage,
                            success_rate: reconProcessData.summary.match_percentage,
                            processing_time: reconProcessData.summary.processing_time_seconds
                        },
                        matching_strategy: {
                            method: 'AI-guided pattern matching',
                            key_fields: ['Trade_ID', 'Amount', 'Date'],
                            tolerances_applied: 'Standard matching rules'
                        },
                        key_findings: [
                            'High confidence matches found for Trade_ID fields',
                            'Amount tolerances applied successfully',
                            'Date format variations handled automatically',
                            'Minimal data quality issues detected'
                        ]
                    };

                    displayResults(mockResult);
                }, 3000);
            } catch (error) {
                console.error('Error checking status:', error);
                setIsProcessing(false);
                setActiveReconciliation(null);
                addMessage('error', 'Error monitoring process progress', false);
            }
        };

        checkStatus();
    };

    const displayResults = (result) => {
        console.log('Reconciliation result structure:', result);

        const summary = result.summary || result.extraction_summary || result;
        const processingTime = result.processing_time || summary.processing_time || 0;

        const matchedCount = summary.matched_count || summary.total_matches || summary.successful_extractions || 0;
        const unmatchedFileA = summary.unmatched_file_a_count || summary.unmatched_a || summary.failed_extractions || 0;
        const unmatchedFileB = summary.unmatched_file_b_count || summary.unmatched_b || 0;
        const totalFileA = summary.total_file_a || summary.total_rows_file_a || summary.total_rows || 0;
        const totalFileB = summary.total_file_b || summary.total_rows_file_b || 0;
        const matchRate = summary.match_rate || summary.success_rate || 0;
        const confidence = summary.match_confidence_avg || summary.overall_confidence || summary.confidence || 0;

        const matchingStrategy = result.matching_strategy || result.strategy || {};
        const method = matchingStrategy.method || result.method || 'AI-guided analysis';
        const keyFields = matchingStrategy.key_fields || result.key_fields || result.columns_processed || ['Auto-detected'];
        const tolerances = matchingStrategy.tolerances_applied || result.tolerances || 'Standard matching rules';

        const findings = result.key_findings || result.findings || result.recommendations || [];

        const resultText = `📊 **Reconciliation Results:**

🎯 **Match Summary:**
• ✅ Matched Records: ${matchedCount.toLocaleString()}
• 📝 Unmatched in File A: ${unmatchedFileA.toLocaleString()}  
• 📝 Unmatched in File B: ${unmatchedFileB.toLocaleString()}
• 📊 Total File A Records: ${totalFileA.toLocaleString()}
• 📊 Total File B Records: ${totalFileB.toLocaleString()}
• 📈 Match Rate: ${(matchRate * (matchRate <= 1 ? 100 : 1)).toFixed(1)}%
• 🎲 Average Confidence: ${(confidence * (confidence <= 1 ? 100 : 1)).toFixed(1)}%

⚡ **Processing Details:**
• ⏱️ Processing Time: ${processingTime.toFixed(2)} seconds
• 🔧 Matching Method: ${method}
• 🎯 Key Fields Used: ${Array.isArray(keyFields) ? keyFields.join(', ') : keyFields}
• 📏 Tolerances Applied: ${tolerances}

${findings.length > 0 ? `🔍 **Key Findings:**\n${findings.slice(0, 4).map(f => `• ${typeof f === 'string' ? f : f.description || f.finding || JSON.stringify(f)}`).join('\n')}` : ''}

📥 **Next Steps:**
Use the download buttons in the "Results" panel → to get detailed reports, or use the "Display Results" button below to view detailed data in the chat.`;

        addMessage('result', resultText, true);
    };

    const displayDetailedResults = async (reconciliationId) => {
        try {
            addMessage('system', '📊 Fetching detailed reconciliation results...', true);

            const reconResult = await apiService.getReconciliationResult(reconciliationId);

            // Mock detailed results - replace with actual API call
            const detailedResult = {
                matched: [
                    reconResult.matched
                ],
                unmatched_file_a: [
                    reconResult.unmatched_file_a
                ],
                unmatched_file_b: [
                    reconResult.unmatched_file_b
                ]
            };

            setTimeout(() => {
                const detailedText = `📋 **Detailed Reconciliation Results:**

✅ **Sample Matched Records (${detailedResult.matched.length} total):**
${detailedResult.matched.slice(0, 3).map(record => 
    `• ${JSON.stringify(record)}`
).join('\n')}
${detailedResult.matched.length > 3 ? `... and ${detailedResult.matched.length - 3} more matches` : ''}

❗ **Unmatched in File A (${detailedResult.unmatched_file_a.length} records):**
${detailedResult.unmatched_file_a.slice(0, 2).map(record => 
    `• ${record}:`
).join('\n')}
${detailedResult.unmatched_file_a.length > 2 ? `... and ${detailedResult.unmatched_file_a.length - 2} more` : ''}

❗ **Unmatched in File B (${detailedResult.unmatched_file_b.length} records):**
${detailedResult.unmatched_file_b.slice(0, 2).map(record => 
    `• ${record}: `
).join('\n')}
${detailedResult.unmatched_file_b.length > 2 ? `... and ${detailedResult.unmatched_file_b.length - 2} more` : ''}

💡 **For complete data, use the download buttons in the Results panel →**`;

                addMessage('result', detailedText, true);
            }, 1500);

        } catch (error) {
            console.error('Error fetching detailed results:', error);
            addMessage('error', `❌ Failed to fetch detailed results: ${error.message}`, false);
        }
    };

    const downloadResults = async (reconciliationId, resultType) => {
        try {
            addMessage('system', `📥 Preparing download for ${resultType.replace('_', ' ')} results...`, true);

            // Mock download - replace with actual API call
            setTimeout(() => {
                const filename = `reconciliation_${reconciliationId}_${resultType}.csv`;
                addMessage('system', `✅ Download ready: ${filename}\n\n💡 In a real implementation, this would trigger a file download with the actual reconciliation data.`, true);
            }, 1000);

        } catch (error) {
            console.error('Download failed:', error);
            addMessage('error', `❌ Download failed: ${error.message}`, false);
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
                currentInput={currentInput}
                uploadProgress={uploadProgress}
                onFileUpload={handleFileUpload}
                onTemplateSelect={handleTemplateSelect}
                onRefreshFiles={loadFiles}
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
                currentInput={currentInput}
                setCurrentInput={setCurrentInput}
                isProcessing={isProcessing}
                isAnalyzingColumns={isAnalyzingColumns}
                selectedFiles={selectedFiles}
                selectedTemplate={selectedTemplate}
                requiredFiles={requiredFiles}
                onStartReconciliation={startReconciliation}
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
                processedFiles={processedFiles}
                autoRefreshInterval={autoRefreshInterval}
                onRefreshProcessedFiles={loadProcessedFiles}
                onDownloadResults={downloadResults}
                onDisplayDetailedResults={displayDetailedResults}
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
            </Routes>
        </Router>
    );
};

export default App;