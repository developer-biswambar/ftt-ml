import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, CheckCircle, Clock, AlertCircle, Download, Trash2, Copy, RefreshCw } from 'lucide-react';
import { apiService } from './services/api';

const App = () => {
  const [files, setFiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({ fileA: null, fileB: null });
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReconciliation, setActiveReconciliation] = useState(null);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [isAnalyzingColumns, setIsAnalyzingColumns] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initial setup
  useEffect(() => {
    setMessages([{
      id: 1,
      type: 'system',
      content: '🎯 Welcome to Financial Data Reconciliation!\n\n📋 **Getting Started:**\n1. Upload two files to compare\n2. Select them in the file selector\n3. Choose a template or describe your requirements\n4. Click Start to begin reconciliation\n\nI\'ll analyze your data and provide detailed matching results with downloadable reports.',
      timestamp: new Date()
    }]);
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadInitialData = async () => {
    await Promise.all([
      loadTemplates(),
      loadFiles(),
      loadProcessedFiles()
    ]);
  };

  const loadTemplates = async () => {
    try {
      const data = await apiService.getReconciliationTemplates();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      addMessage('error', 'Failed to load reconciliation templates');
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
    try {
      const data = await apiService.getReconciliations();
      if (data.success) {
        setProcessedFiles(data.data.reconciliations || []);
      }
    } catch (error) {
      console.error('Failed to load processed files:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadProgress(true);
    addMessage('system', `📤 Uploading "${file.name}"...`);

    try {
      const data = await apiService.uploadFile(file);
      if (data.success) {
        setFiles(prev => [...prev, data.data]);
        addMessage('system', `✅ File "${file.name}" uploaded successfully!\n📊 Rows: ${data.data.total_rows} | Columns: ${data.data.columns.length}`);
      } else {
        addMessage('error', `❌ Upload failed: ${data.message}`);
      }
    } catch (error) {
      addMessage('error', `❌ Upload error: ${error.message}`);
    } finally {
      setUploadProgress(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const addMessage = (type, content) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleTemplateSelect = (template) => {
    setCurrentInput(template.user_requirements);
    addMessage('user', `📋 Selected template: ${template.name}`);
    addMessage('system', `✅ Template loaded: "${template.description}"\n\n📝 **Requirements loaded:**\n${template.user_requirements}\n\nYou can modify these requirements or click Start to proceed.`);
  };

  const analyzeColumnCompatibility = async () => {
    if (!selectedFiles.fileA || !selectedFiles.fileB || isAnalyzingColumns) return;

    setIsAnalyzingColumns(true);
    try {
      addMessage('system', '🔍 Analyzing column compatibility...');
      const data = await apiService.analyzeColumns(
        selectedFiles.fileA.file_id,
        selectedFiles.fileB.file_id
      );

      if (data.success) {
        const matches = data.data.potential_matches.slice(0, 5);
        const matchText = matches.length > 0
          ? `🔗 **Top Column Matches Found:**\n${matches.map(m => 
              `• ${m.file_a_column} ↔ ${m.file_b_column} (${(m.compatibility_score * 100).toFixed(0)}%)`
            ).join('\n')}`
          : '⚠️ No strong column matches detected. Manual specification may be needed.';

        addMessage('system', matchText);
      } else {
        addMessage('system', '⚠️ Column analysis completed. Please specify your requirements in the template.');
      }
    } catch (error) {
      console.error('Column analysis failed:', error);
      addMessage('system', '⚠️ Column analysis completed. Please specify your requirements manually.');
    } finally {
      setIsAnalyzingColumns(false);
    }
  };

  const startReconciliation = async () => {
    if (!selectedFiles.fileA || !selectedFiles.fileB || !currentInput.trim()) {
      addMessage('error', '❌ Please select two files and provide reconciliation requirements.');
      return;
    }

    setIsProcessing(true);
    addMessage('user', currentInput);
    addMessage('system', '🚀 Starting reconciliation process...\n\n⏳ This may take 30-60 seconds depending on file size and complexity.');

    try {
      const reconciliationRequest = {
        file_a_id: selectedFiles.fileA.file_id,
        file_b_id: selectedFiles.fileB.file_id,
        user_requirements: currentInput
      };

      const data = await apiService.startReconciliation(reconciliationRequest);

      if (data.success) {
        setActiveReconciliation(data.data.reconciliation_id);
        addMessage('system', '✅ Reconciliation started! Monitoring progress...');
        setCurrentInput('');
        monitorReconciliation(data.data.reconciliation_id);
      } else {
        addMessage('error', `❌ Failed to start: ${data.message}`);
        setIsProcessing(false);
      }
    } catch (error) {
      addMessage('error', `❌ Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const monitorReconciliation = async (reconciliationId) => {
    const checkStatus = async () => {
      try {
        const data = await apiService.getReconciliationStatus(reconciliationId);

        if (data.success) {
          const reconciliation = data.data;

          if (reconciliation.status === 'completed') {
            addMessage('success', '🎉 Reconciliation completed successfully!');
            displayResults(reconciliation.result);
            await loadProcessedFiles();
            setActiveReconciliation(null);
            setIsProcessing(false);
          } else if (reconciliation.status === 'failed') {
            addMessage('error', `❌ Reconciliation failed: ${reconciliation.error || 'Unknown error'}`);
            setActiveReconciliation(null);
            setIsProcessing(false);
          } else {
            // Still processing, check again
            setTimeout(checkStatus, 3000);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setTimeout(checkStatus, 5000);
      }
    };

    checkStatus();
  };

  const displayResults = (result) => {
    const summary = result.summary || {};
    const matchRate = (summary.match_rate || 0);
    const confidence = (summary.match_confidence_avg || 0);

    const resultText = `📊 **Reconciliation Results:**

🎯 **Match Summary:**
• ✅ Matched Records: ${summary.matched_count || 0}
• 📝 Unmatched in File A: ${summary.unmatched_file_a_count || 0}  
• 📝 Unmatched in File B: ${summary.unmatched_file_b_count || 0}
• 📈 Match Rate: ${matchRate.toFixed(1)}%
• 🎲 Confidence: ${confidence.toFixed(1)}%

${result.key_findings && result.key_findings.length > 0 ? `🔍 **Key Findings:**\n${result.key_findings.slice(0, 3).map(f => `• ${f}`).join('\n')}` : ''}

📥 **Download Options:**
Use the download buttons in the "Processed Reconciliations" panel to get detailed CSV reports.`;

    addMessage('result', resultText);
  };

  const downloadResults = async (reconciliationId, fileType) => {
    try {
      const data = await apiService.downloadReconciliationResults(reconciliationId, fileType);

      if (data.success) {
        const blob = new Blob([data.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.data.filename;
        a.click();
        window.URL.revokeObjectURL(url);

        addMessage('system', `📥 Downloaded: ${data.data.filename}`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      addMessage('error', `❌ Download failed: ${error.message}`);
    }
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

  // Auto-analyze columns when both files are selected
  useEffect(() => {
    if (selectedFiles.fileA && selectedFiles.fileB) {
      analyzeColumnCompatibility();
    }
  }, [selectedFiles.fileA, selectedFiles.fileB]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Templates & File Upload */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Setup</h2>
          <p className="text-xs text-gray-500 mt-1">Upload files and select templates</p>
        </div>

        {/* File Upload Section */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📁 Upload Files</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors flex items-center justify-center space-x-2 text-gray-600 hover:text-blue-600 disabled:opacity-50"
          >
            {uploadProgress ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Upload CSV/Excel</span>
              </>
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

        {/* File Selection */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">🔗 Select Files</h3>
            <button
              onClick={loadFiles}
              className="text-xs text-blue-600 hover:text-blue-800"
              title="Refresh file list"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="mb-3">
            <label className="text-xs text-gray-500">File A:</label>
            <select
              value={selectedFiles.fileA?.file_id || ''}
              onChange={(e) => {
                const file = files.find(f => f.file_id === e.target.value);
                setSelectedFiles(prev => ({ ...prev, fileA: file }));
              }}
              className="w-full mt-1 p-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select File A</option>
              {files.map(file => (
                <option key={file.file_id} value={file.file_id}>
                  {file.filename} ({file.total_rows} rows)
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="text-xs text-gray-500">File B:</label>
            <select
              value={selectedFiles.fileB?.file_id || ''}
              onChange={(e) => {
                const file = files.find(f => f.file_id === e.target.value);
                setSelectedFiles(prev => ({ ...prev, fileB: file }));
              }}
              className="w-full mt-1 p-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select File B</option>
              {files.map(file => (
                <option key={file.file_id} value={file.file_id}>
                  {file.filename} ({file.total_rows} rows)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📋 Templates</h3>
          <div className="space-y-2">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => handleTemplateSelect(template)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="font-medium text-sm text-gray-800 group-hover:text-blue-800">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center - Chat Interface */}
      <div className="flex-1 flex flex-col">
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
              onClick={startReconciliation}
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

      {/* Right Sidebar - Processed Files */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">📈 Results</h2>
            <button
              onClick={loadProcessedFiles}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              title="Refresh results"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Completed reconciliations</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {processedFiles.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <FileText size={48} className="mx-auto opacity-30 mb-3" />
              <p className="text-sm">No reconciliations yet</p>
              <p className="text-xs mt-1">Start a reconciliation to see results here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {processedFiles.map((reconciliation) => (
                <div key={reconciliation.reconciliation_id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {reconciliation.status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
                      {reconciliation.status === 'processing' && <Clock size={16} className="text-blue-500" />}
                      {reconciliation.status === 'failed' && <AlertCircle size={16} className="text-red-500" />}
                      <span className="text-sm font-medium text-gray-800 capitalize">{reconciliation.status}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mb-2">
                    <div className="truncate" title={reconciliation.file_a}>📄 A: {reconciliation.file_a}</div>
                    <div className="truncate" title={reconciliation.file_b}>📄 B: {reconciliation.file_b}</div>
                  </div>

                  {reconciliation.status === 'completed' && (
                    <>
                      <div className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                        <div>✅ Match Rate: {(reconciliation.match_rate || 0).toFixed(1)}%</div>
                        <div>🎯 Confidence: {(reconciliation.match_confidence || 0).toFixed(1)}%</div>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => downloadResults(reconciliation.reconciliation_id, 'matched')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          title="Download Matched Records"
                        >
                          <Download size={10} className="inline mr-1" />
                          Match
                        </button>
                        <button
                          onClick={() => downloadResults(reconciliation.reconciliation_id, 'unmatched_a')}
                          className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                          title="Download Unmatched from File A"
                        >
                          <Download size={10} className="inline mr-1" />
                          A Only
                        </button>
                        <button
                          onClick={() => downloadResults(reconciliation.reconciliation_id, 'unmatched_b')}
                          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                          title="Download Unmatched from File B"
                        >
                          <Download size={10} className="inline mr-1" />
                          B Only
                        </button>
                      </div>
                    </>
                  )}

                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(reconciliation.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;