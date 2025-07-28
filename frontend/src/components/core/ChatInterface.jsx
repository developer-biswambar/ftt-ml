// src/components/ChatInterface.jsx - Enhanced with Delta Generation support
import React, {useEffect, useRef, useState} from 'react';
import {AlertCircle, CheckCircle, Eye, Send, Settings} from 'lucide-react';
import ReconciliationFlow from '../recon/ReconciliationFlow.jsx';
import DeltaGenerationFlow from '../delta/DeltaGenerationFlow.jsx';
import TransformationFlow from "../transformation/TransformationFlow.jsx";

const TypingIndicator = ({message}) => {
    return (
        <div className="bg-gray-100 text-gray-800 mr-auto max-w-2xl p-4 rounded-lg mb-4">
            <div className="flex items-center space-x-2 mb-2">
                <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                         style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                         style={{animationDelay: '0.2s'}}></div>
                </div>

                <span className="flex items-center space-x-1">
                  <span>Typing...</span>
                  <span className="animate-bounce">🤖</span>
                  <span className="text-green-500">🌱</span>
                </span>

            </div>
            {message && (
                <div className="text-sm whitespace-pre-line leading-relaxed">
                    {message}
                    <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse">|</span>
                </div>
            )}
        </div>
    );
};

const MessageComponent = ({message, onDisplayDetailedResults}) => {
    const getMessageStyle = () => {
        switch (message.type) {
            case 'user':
                return 'bg-blue-500 text-white ml-auto max-w-lg';
            case 'system':
                return 'bg-gray-100 text-gray-800 mr-auto max-w-2xl';
            case 'error':
                return 'bg-red-100 text-red-800 mr-auto max-w-lg border-l-4 border-red-500';
            case 'success':
                return 'bg-green-100 text-green-800 mr-auto max-w-lg border-l-4 border-green-500';
            case 'result':
                return 'bg-blue-50 text-blue-900 mr-auto max-w-3xl border border-blue-200';
            case 'table':
                return 'bg-white mr-auto max-w-5xl border border-gray-300 shadow-sm';
            case 'question':
                return 'bg-yellow-50 text-yellow-900 mr-auto max-w-2xl border border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 mr-auto max-w-2xl';
        }
    };

    const getColorClasses = (color) => {
        const colorMap = {
            green: {
                header: 'bg-green-100',
                headerText: 'text-green-800',
                border: 'border-green-200',
                evenRow: 'bg-green-25',
                cellText: 'text-green-800'
            },
            orange: {
                header: 'bg-orange-100',
                headerText: 'text-orange-800',
                border: 'border-orange-200',
                evenRow: 'bg-orange-25',
                cellText: 'text-orange-800'
            },
            purple: {
                header: 'bg-purple-100',
                headerText: 'text-purple-800',
                border: 'border-purple-200',
                evenRow: 'bg-purple-25',
                cellText: 'text-purple-800'
            },
            red: {
                header: 'bg-red-100',
                headerText: 'text-red-800',
                border: 'border-red-200',
                evenRow: 'bg-red-25',
                cellText: 'text-red-800'
            },
            blue: {
                header: 'bg-blue-100',
                headerText: 'text-blue-800',
                border: 'border-blue-200',
                evenRow: 'bg-blue-25',
                cellText: 'text-blue-800'
            }
        };
        return colorMap[color] || colorMap.green;
    };

    // Check if this is a result message that can show detailed results
    const isResultMessage = message.type === 'result' &&
        (message.content.includes('Reconciliation Results') || message.content.includes('Delta Generation Summary'));

    return (
        <div
            className={`p-4 rounded-lg mb-4 ${getMessageStyle()} transform transition-all duration-300 ease-out animate-fadeIn`}>

            {/* Regular content for non-table messages */}
            {message.type !== 'table' && (
                <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>
            )}

            {/* Table content for table messages */}
            {message.type === 'table' && message.tableData && (
                <div>
                    <div className="text-sm font-medium mb-3 text-gray-800">{message.content}</div>

                    {message.tableData.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                <tr className={getColorClasses(message.tableData.color).header}>
                                    {message.tableData.columns.map(col => (
                                        <th key={col}
                                            className={`border ${getColorClasses(message.tableData.color).border} px-2 py-1 text-left font-medium ${getColorClasses(message.tableData.color).headerText}`}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {message.tableData.data.map((row, idx) => (
                                    <tr key={idx}
                                        className={`${idx % 2 === 0 ? 'bg-white' : getColorClasses(message.tableData.color).evenRow}`}>
                                        {message.tableData.columns.map(col => (
                                            <td key={col}
                                                className={`border ${getColorClasses(message.tableData.color).border} px-2 py-1 ${getColorClasses(message.tableData.color).cellText}`}>
                                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            {/* Show count if there are more records */}
                            {message.tableData.totalCount > message.tableData.data.length && (
                                <div className="mt-2 text-xs text-gray-600 text-center">
                                    Showing {message.tableData.data.length} of {message.tableData.totalCount} records
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 text-center py-4">
                            No records found in this category
                        </div>
                    )}
                </div>
            )}

            {/* Action buttons for result messages */}
            {isResultMessage && onDisplayDetailedResults && (
                <div className="mt-4 pt-3 border-t border-blue-200">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => onDisplayDetailedResults('current')}
                            className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs transition-all duration-200 hover:scale-105"
                        >
                            <Eye size={14}/>
                            <span>Display Detailed Results</span>
                        </button>
                        <span className="text-xs text-blue-600">
                            View sample data and detailed breakdowns in chat
                        </span>
                    </div>
                </div>
            )}

            <div className="text-xs opacity-60 mt-2">
                {message.timestamp.toLocaleTimeString()}
            </div>
        </div>
    );
};

const ChatInterface = ({
                           messages,
                           currentInput,
                           setCurrentInput,
                           isProcessing,
                           isAnalyzingColumns,
                           selectedFiles,
                           selectedTemplate,
                           requiredFiles,
                           onStartReconciliationInApp,
                           onStartDeltaGenerationInApp,
                           onFileTransformationInApp,
                           isTyping,
                           typingMessage,
                           files,
                           onSendMessage,
                           onDisplayDetailedResults
                       }) => {
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [currentFlow, setCurrentFlow] = useState(null);
    const [flowData, setFlowData] = useState({});
    const [setMessages] = useState(); // Added setMessages for table message functionality

    // Helper function to check if all files are selected
    const areAllFilesSelected = () => {
        if (!selectedTemplate || !requiredFiles) return false;
        return requiredFiles.every(rf => selectedFiles[rf.key]);
    };

    // Enhanced scroll to bottom function
    const scrollToBottom = (behavior = 'smooth') => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({
                    behavior: behavior,
                    block: 'end',
                    inline: 'nearest'
                });
            }
        }, 100);
    };

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, typingMessage]);

    // Auto-scroll when flow appears or changes
    useEffect(() => {
        if (currentFlow) {
            scrollToBottom('auto');
            setTimeout(() => {
                scrollToBottom();
            }, 500);
        }
    }, [currentFlow]);

    // Auto-scroll when flow data changes (step changes)
    useEffect(() => {
        if (currentFlow && flowData) {
            setTimeout(() => {
                scrollToBottom();
            }, 200);
        }
    }, [flowData]);

    const triggerFlowBasedOnProcessType = (processConfig) => {
        setCurrentFlow(null);
        setFlowData({});

        onSendMessage('user', `${selectedTemplate?.name || 'Process'} configuration completed. Starting process...`);

        // Route to appropriate handler based on process type
        if (processConfig.process_type === 'delta-generation' && onStartDeltaGenerationInApp) {
            onStartDeltaGenerationInApp(processConfig);
        } else if (onStartReconciliationInApp && !selectedTemplate?.category.includes('ai-generation')) {
            onStartReconciliationInApp(processConfig);
        } else if (selectedTemplate?.category.includes('ai-generation')) {
            onFileTransformationInApp(processConfig);
        }
    };

    const handleFlowCancel = () => {
        setCurrentFlow(null);
        setFlowData({});
        onSendMessage('system', 'Process configuration cancelled. Please select a different template or try again.');
    };

    const configureDetailsBeforeProcessStarts = () => {
        // Send initial message based on process type
        const processName = selectedTemplate.name.toLowerCase();
        onSendMessage('system', `🔧 Let me help you configure this ${processName} step by step.\n\nStarting configuration wizard...`);

        // Start the appropriate flow after a brief delay
        setTimeout(() => {
            if (selectedTemplate.category.includes('reconciliation')) {
                setCurrentFlow('reconciliation');
                setFlowData({
                    selectedFiles,
                    selectedTemplate,
                    step: 'rule_management'
                });
            } else if (selectedTemplate.category.includes('ai-generation')) {
                setCurrentFlow('file_generation');
                setFlowData({
                    selectedFiles,
                    selectedTemplate,
                    step: 'file_selection'
                });
            } else if (selectedTemplate.category.includes('delta-generation')) {
                setCurrentFlow('delta_generation');
                setFlowData({
                    selectedFiles,
                    selectedTemplate,
                    step: 'file_selection'
                });
            } else {
                setCurrentFlow('single_process');
                setFlowData({
                    selectedFiles,
                    selectedTemplate,
                    step: 'configuration'
                });
            }
        }, 1000);
    };


    // This gets triggered when chat start Button is clicked
    const handleChatStartSubmit = () => {
        if (!currentInput.trim()) return;

        // Store the input before clearing it
        const userInput = currentInput.trim();

        onSendMessage('user', userInput);

        // Check if user is trying to start a process
        const isStartCommand = userInput.toLowerCase().includes('start') ||
            userInput.toLowerCase().includes('begin') ||
            userInput.toLowerCase().includes('process') ||
            userInput.toLowerCase().includes('reconcil') ||
            userInput.toLowerCase().includes('generate') ||
            userInput.toLowerCase().includes('delta');
        userInput.toLowerCase().includes('Describe');

        if (isStartCommand) {
            if (selectedTemplate && areAllFilesSelected()) {
                // Clear input first
                setCurrentInput('');

                // Start the appropriate flow
                if (selectedTemplate.category.includes('reconciliation') ||
                    selectedTemplate.category.includes('ai-generation') ||
                    selectedTemplate.category.includes('delta-generation')) {
                    configureDetailsBeforeProcessStarts();
                } else {
                    // For single file processes, start directly
                    triggerFlowBasedOnProcessType({
                        process_type: selectedTemplate.category,
                        user_requirements: userInput,
                        files: Object.entries(selectedFiles).map(([key, file]) => ({
                            file_id: file.file_id,
                            role: key
                        }))
                    });
                }
                return; // Exit early to avoid clearing input again
            } else if (!selectedTemplate) {
                onSendMessage('system', '⚠️ Please select a process template first from the left panel.');
            } else if (!areAllFilesSelected()) {
                const selectedCount = Object.keys(selectedFiles).length;
                const requiredCount = selectedTemplate.filesRequired;
                const missing = requiredCount - selectedCount;
                onSendMessage('system', `⚠️ Please select ${missing} more file${missing !== 1 ? 's' : ''} to proceed with ${selectedTemplate.name}.`);
            }
        }

        setCurrentInput('');
    };

    const getReadyStatus = () => {
        if (!selectedTemplate) {
            return {ready: false, message: "No process selected"};
        }
        if (!areAllFilesSelected()) {
            const selected = Object.keys(selectedFiles).length;
            const required = selectedTemplate.filesRequired;
            return {
                ready: false,
                message: `${selected}/${required} files selected`
            };
        }
        return {ready: true, message: "Ready to start"};
    };

    const status = getReadyStatus();

    // Get process type display name for UI
    const getProcessTypeDisplay = () => {
        if (!selectedTemplate) return null;

        if (selectedTemplate.category.includes('reconciliation')) return '🔄 Reconciliation';
        if (selectedTemplate.category.includes('delta-generation')) return '📊 Delta Generation';
        if (selectedTemplate.category.includes('ai-generation')) return '🤖 AI Generation';
        if (selectedTemplate.category.includes('validation')) return '🔍 Validation';
        if (selectedTemplate.category.includes('cleaning')) return '🧹 Cleaning';
        if (selectedTemplate.category.includes('extraction')) return '📋 Extraction';
        if (selectedTemplate.category.includes('consolidation')) return '📚 Consolidation';
        if (selectedTemplate.category.includes('ai-analysis')) return '🤖 AI Analysis';

        return '⚙️ Processing';
    };

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">💼 Data Processing Platform</h1>
                        <p className="text-sm text-gray-600">AI-powered reconciliation, delta generation, validation,
                            and analysis</p>
                    </div>

                    {/* Process Status Indicator */}
                    <div className="flex items-center space-x-3">
                        {selectedTemplate && (
                            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm text-blue-800 font-medium">{getProcessTypeDisplay()}</span>
                            </div>
                        )}

                        {currentFlow && (
                            <div className="flex items-center space-x-2 bg-purple-50 px-3 py-1 rounded-lg">
                                <Settings size={16} className="text-purple-600 animate-spin"/>
                                <span className="text-sm text-purple-800 font-medium">Configuring Process</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                {messages.map((message) => (
                    <MessageComponent
                        key={message.id}
                        message={message}
                        onDisplayDetailedResults={onDisplayDetailedResults}
                    />
                ))}

                {/* Typing Indicator */}
                {isTyping && <TypingIndicator message={typingMessage}/>}

                {/* Processing Indicators */}
                {isProcessing && !isTyping && (
                    <div
                        className="flex items-center space-x-3 text-blue-600 bg-blue-50 p-4 rounded-lg mr-auto max-w-md transform transition-all duration-300 ease-out animate-fadeIn">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping"></div>
                        </div>
                        <span className="text-sm">Processing {selectedTemplate?.name || 'request'}...</span>
                    </div>
                )}

                {isAnalyzingColumns && !isTyping && (
                    <div
                        className="flex items-center space-x-3 text-purple-600 bg-purple-50 p-4 rounded-lg mr-auto max-w-md transform transition-all duration-300 ease-out animate-fadeIn">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                            <div
                                className="absolute inset-0 rounded-full border-2 border-purple-200 animate-ping"></div>
                        </div>
                        <span className="text-sm">Analyzing data structure...</span>
                    </div>
                )}

                {/* Process Flow Components */}
                {currentFlow === 'reconciliation' && (
                    <div className="mb-4">
                        <ReconciliationFlow
                            files={files}
                            selectedFiles={selectedFiles}
                            selectedTemplate={selectedTemplate}
                            flowData={flowData}
                            onComplete={triggerFlowBasedOnProcessType}
                            onCancel={handleFlowCancel}
                            onSendMessage={onSendMessage}
                        />
                    </div>
                )}

                {currentFlow === 'file_generation' && (
                    <div className="mb-4">
                        <TransformationFlow
                            files={selectedFiles}
                            selectedFiles={selectedFiles}
                            onTransformationFlowStart={triggerFlowBasedOnProcessType}
                            onCancel={handleFlowCancel}
                            onSendMessage={onSendMessage}
                        />
                    </div>
                )}

                {currentFlow === 'delta_generation' && (
                    <div className="mb-4">
                        <DeltaGenerationFlow
                            files={files}
                            selectedFiles={selectedFiles}
                            selectedTemplate={selectedTemplate}
                            flowData={flowData}
                            onComplete={triggerFlowBasedOnProcessType}
                            onCancel={handleFlowCancel}
                            onSendMessage={onSendMessage}
                        />
                    </div>
                )}

                <div ref={messagesEndRef}/>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
                {/* Show current template requirements */}
                {currentInput && !currentFlow && (
                    <div
                        className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg transform transition-all duration-300 ease-out animate-fadeIn">
                        <div className="text-sm text-blue-800">
                            <strong>📋 Process Requirements:</strong>
                        </div>
                        <div className="text-sm text-blue-700 mt-1 whitespace-pre-wrap">
                            {currentInput}
                        </div>
                        <button
                            onClick={() => setCurrentInput('')}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                        >
                            Clear requirements
                        </button>
                    </div>
                )}

                {/* Flow Status */}
                {currentFlow && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Settings size={16} className="text-yellow-600"/>
                            <span className="text-sm text-yellow-800 font-medium">
                                Process configuration in progress...
                            </span>
                        </div>
                        <p className="text-xs text-yellow-700 mt-1">
                            Please complete the configuration steps above.
                        </p>
                    </div>
                )}

                {/* Process Status Banner */}
                {!currentFlow && (
                    <div className={`mb-3 p-3 rounded-lg border ${
                        status.ready
                            ? 'bg-green-50 border-green-200'
                            : 'bg-yellow-50 border-yellow-200'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                {status.ready ? (
                                    <CheckCircle size={16} className="text-green-600"/>
                                ) : (
                                    <AlertCircle size={16} className="text-yellow-600"/>
                                )}
                                <span className={`text-sm font-medium ${
                                    status.ready ? 'text-green-800' : 'text-yellow-800'
                                }`}>
                                    {status.message}
                                </span>
                            </div>

                            {selectedTemplate && (
                                <div className="text-xs text-gray-600">
                                    {selectedTemplate.filesRequired} file{selectedTemplate.filesRequired !== 1 ? 's' : ''} required
                                </div>
                            )}
                        </div>

                        {!selectedTemplate && (
                            <p className="text-xs text-yellow-700 mt-1">
                                👈 Select a process template from the left panel to get started
                            </p>
                        )}
                    </div>
                )}

                {/* Input controls - only show if not in flow */}
                {!currentFlow && (
                    <div className="flex space-x-3">
                        <div className="flex-1">
                            {currentInput ? (
                                <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="text-sm text-gray-600">
                                        📋 Requirements loaded from template. Use the "Clear requirements" button above
                                        to modify.
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={currentInput || ''}
                                    onChange={(e) => setCurrentInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleChatStartSubmit()}
                                    placeholder={
                                        selectedTemplate
                                            ? `Type "start" to begin ${selectedTemplate.name.toLowerCase()}...`
                                            : "Select a process template first..."
                                    }
                                    disabled={!selectedTemplate}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            )}
                        </div>
                        <button
                            onClick={handleChatStartSubmit}
                            disabled={isProcessing || !status.ready || (!currentInput.trim() && !selectedTemplate)}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                        >
                            <Send size={18}/>
                            <span>Start</span>
                        </button>
                    </div>
                )}

                {!currentFlow && (
                    <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
                        <span>
                            {selectedTemplate
                                ? `Ready for ${selectedTemplate.name}`
                                : "Select a process template from the left panel"
                            }
                        </span>
                        {selectedTemplate && (
                            <span className="text-blue-600">
                                {selectedTemplate.category.includes('ai') ? '🤖 AI-powered' :
                                    selectedTemplate.category.includes('delta') ? '📊 Delta analysis' :
                                        '⚙️ Manual config'}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInterface;