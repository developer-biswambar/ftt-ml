import React, { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

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
      default:
        return 'bg-gray-100 text-gray-800 mr-auto max-w-2xl';
    }
  };

  return (
    <div className={`p-4 rounded-lg mb-4 ${getMessageStyle()}`}>
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
  onStartReconciliation
}) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">💼 Financial Data Reconciliation</h1>
        <p className="text-sm text-gray-600">AI-powered reconciliation with natural language processing</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageComponent key={message.id} message={message} />
        ))}
        {isProcessing && (
          <div className="flex items-center space-x-3 text-blue-600 bg-blue-50 p-4 rounded-lg mr-auto max-w-md">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm">Processing reconciliation...</span>
          </div>
        )}
        {isAnalyzingColumns && (
          <div className="flex items-center space-x-3 text-purple-600 bg-purple-50 p-4 rounded-lg mr-auto max-w-md">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <span className="text-sm">Analyzing column compatibility...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* Show current template requirements */}
        {currentInput && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>📋 Selected Requirements:</strong>
            </div>
            <div className="text-sm text-blue-700 mt-1 whitespace-pre-wrap">
              {currentInput}
            </div>
            <button
              onClick={() => setCurrentInput('')}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Clear requirements
            </button>
          </div>
        )}

        <div className="flex space-x-3">
          <div className="flex-1">
            {currentInput ? (
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="text-sm text-gray-600">
                  📋 Requirements loaded from template. Use the "Clear requirements" button above to select a different template.
                </div>
              </div>
            ) : (
              <div className="p-3 border border-gray-200 rounded-lg bg-yellow-50 border-yellow-200">
                <div className="text-sm text-yellow-800">
                  👈 Please select a template from the left panel to load reconciliation requirements.
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onStartReconciliation}
            disabled={isProcessing || !selectedFiles.fileA || !selectedFiles.fileB || !currentInput.trim()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            <Send size={18} />
            <span>Start</span>
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Select a template from the left panel to load reconciliation requirements
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;