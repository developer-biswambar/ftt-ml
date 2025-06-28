// src/components/ChatInterface.jsx - Enhanced with reconciliation flow
import React, { useEffect, useRef, useState } from 'react';
import { Send, FileText, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import ReconciliationFlow from './ReconciliationFlow';

const TypingIndicator = ({ message }) => {
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
                <span className="text-xs text-gray-500">AI is typing...</span>
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

const MessageComponent = ({ message }) => {
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
            case 'question':
                return 'bg-yellow-50 text-yellow-900 mr-auto max-w-2xl border border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 mr-auto max-w-2xl';
        }
    };

    return (
        <div
            className={`p-4 rounded-lg mb-4 ${getMessageStyle()} transform transition-all duration-300 ease-out animate-fadeIn`}>
            <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>
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
    areAllFilesSelected,
    onStartReconciliation,
    isTyping,
    typingMessage,
    files,
    onSendMessage
}) => {
    const messagesEndRef = useRef(null);
    const [currentFlow, setCurrentFlow] = useState(null);
    const [flowData, setFlowData] = useState({});

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, typingMessage]);

    // Check if we should start a process flow
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.type === 'user' && currentInput.includes('reconcil')) {
            if (selectedTemplate && areAllFilesSelected()) {
                // Send follow-up message to start the flow
                setTimeout(() => {
                    onSendMessage('system', `🔧 Let me help you configure this ${selectedTemplate.name.toLowerCase()} step by step.\n\nStarting configuration wizard...`);

                    setTimeout(() => {
                        if (selectedTemplate.category.includes('reconciliation')) {
                            setCurrentFlow('reconciliation');
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
                }, 500);
            }
        }
    }, [messages, selectedFiles, currentInput, selectedTemplate, areAllFilesSelected]);

    const handleFlowComplete = (processConfig) => {
        setCurrentFlow(null);
        setFlowData({});

        onSendMessage('user', `${selectedTemplate?.name || 'Process'} configuration completed. Starting process...`);

        if (onStartReconciliation) {
            onStartReconciliation(processConfig);
        }
    };

    const handleFlowCancel = () => {
        setCurrentFlow(null);
        setFlowData({});
        onSendMessage('system', 'Process configuration cancelled. Please select a different template or try again.');
    };

    const handleRegularSubmit = () => {
        if (!currentInput.trim()) return;

        onSendMessage('user', currentInput);

        // Check if user is trying to start a process
        if (currentInput.toLowerCase().includes('start') ||
            currentInput.toLowerCase().includes('begin') ||
            currentInput.toLowerCase().includes('process')) {

            if (selectedTemplate && areAllFilesSelected()) {
                if (selectedTemplate.category.includes('reconciliation')) {
                    setCurrentFlow('reconciliation');
                    setFlowData({
                        selectedFiles,
                        selectedTemplate,
                        step: 'file_selection'
                    });
                } else {
                    // For single file processes, start directly
                    handleFlowComplete({
                        process_type: selectedTemplate.category,
                        user_requirements: currentInput,
                        files: Object.entries(selectedFiles).map(([key, file]) => ({
                            file_id: file.file_id,
                            role: key
                        }))
                    });
                }
            } else if (!selectedTemplate) {
                onSendMessage('system', '⚠️ Please select a process template first from the left panel.');
            } else if (!areAllFilesSelected()) {
                const missing = selectedTemplate.filesRequired - Object.keys(selectedFiles).length;
                onSendMessage('system', `⚠️ Please select ${missing} more file${missing !== 1 ? 's' : ''} to proceed with ${selectedTemplate.name}.`);
            }
        }

        setCurrentInput('');
    };

    const getReadyStatus = () => {
        if (!selectedTemplate) {
            return { ready: false, message: "No process selected" };
        }
        if (!areAllFilesSelected()) {
            const selected = Object.keys(selectedFiles).length;
            const required = selectedTemplate.filesRequired;
            return {
                ready: false,
                message: `${selected}/${required} files selected`
            };
        }
        return { ready: true, message: "Ready to start" };
    };

    const status = getReadyStatus();

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">💼 Data Processing Platform</h1>
                        <p className="text-sm text-gray-600">AI-powered reconciliation, validation, and analysis</p>
                    </div>

                    {/* Process Status Indicator */}
                    <div className="flex items-center space-x-3">
                        {selectedTemplate && (
                            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm text-blue-800 font-medium">{selectedTemplate.name}</span>
                            </div>
                        )}

                        {currentFlow && (
                            <div className="flex items-center space-x-2 bg-purple-50 px-3 py-1 rounded-lg">
                                <Settings size={16} className="text-purple-600 animate-spin" />
                                <span className="text-sm text-purple-800 font-medium">Configuring Process</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                {messages.map((message) => (
                    <MessageComponent key={message.id} message={message} />
                ))}

                {/* Typing Indicator */}
                {isTyping && <TypingIndicator message={typingMessage} />}

                {/* Processing Indicators */}
                {isProcessing && !isTyping && (
                    <div className="flex items-center space-x-3 text-blue-600 bg-blue-50 p-4 rounded-lg mr-auto max-w-md transform transition-all duration-300 ease-out animate-fadeIn">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping"></div>
                        </div>
                        <span className="text-sm">Processing {selectedTemplate?.name || 'request'}...</span>
                    </div>
                )}

                {isAnalyzingColumns && !isTyping && (
                    <div className="flex items-center space-x-3 text-purple-600 bg-purple-50 p-4 rounded-lg mr-auto max-w-md transform transition-all duration-300 ease-out animate-fadeIn">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-purple-200 animate-ping"></div>
                        </div>
                        <span className="text-sm">Analyzing data structure...</span>
                    </div>
                )}

                {/* Process Flow Component */}
                {currentFlow === 'reconciliation' && (
                    <div className="mb-4">
                        <ReconciliationFlow
                            files={files}
                            selectedFiles={selectedFiles}
                            selectedTemplate={selectedTemplate}
                            flowData={flowData}
                            onComplete={handleFlowComplete}
                            onCancel={handleFlowCancel}
                            onSendMessage={onSendMessage}
                        />
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
                {/* Show current template requirements */}
                {currentInput && !currentFlow && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg transform transition-all duration-300 ease-out animate-fadeIn">
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
                            <Settings size={16} className="text-yellow-600" />
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
                                    <CheckCircle size={16} className="text-green-600" />
                                ) : (
                                    <AlertCircle size={16} className="text-yellow-600" />
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
                                        📋 Requirements loaded from template. Use the "Clear requirements" button above to modify.
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={currentInput}
                                    onChange={(e) => setCurrentInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleRegularSubmit()}
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
                            onClick={handleRegularSubmit}
                            disabled={isProcessing || !status.ready || (!currentInput.trim() && !selectedTemplate)}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                        >
                            <Send size={18} />
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
                                {selectedTemplate.category.includes('ai') ? '🤖 AI-powered' : '⚙️ Manual config'}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInterface;