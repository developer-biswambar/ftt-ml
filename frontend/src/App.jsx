import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
import LeftSidebar from './components/LeftSidebar';
import ChatInterface from './components/ChatInterface';
import RightSidebar from './components/RightSidebar';

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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

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

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = 'Financial Reconciliation Chat';
    };
  }, [isProcessing, activeReconciliation, isAnalyzingColumns, uploadProgress, selectedFiles]);

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

  // Auto-analyze columns when both files are selected
  useEffect(() => {
    if (selectedFiles.fileA && selectedFiles.fileB) {
      analyzeColumnCompatibility();
    }
  }, [selectedFiles.fileA, selectedFiles.fileB]);

  // Cleanup auto-refresh interval on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

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

        // Check if any reconciliations are still processing
        const hasProcessing = (data.data.reconciliations || []).some(
          rec => rec.status === 'processing' || rec.status === 'pending'
        );

        // Set up auto-refresh if there are processing reconciliations
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

  const addMessage = (type, content) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadProgress(true);
    addMessage('system', `📤 Uploading "${file.name}"...`);

    try {
      const data = await apiService.uploadFile(file);
      if (data.success) {
        // Immediately add to files list
        const newFile = data.data;
        setFiles(prev => [...prev, newFile]);

        // Also refresh the file list to ensure consistency
        await loadFiles();

        addMessage('system', `✅ File "${file.name}" uploaded successfully!\n📊 Rows: ${newFile.total_rows} | Columns: ${newFile.columns.length}`);
      } else {
        addMessage('error', `❌ Upload failed: ${data.message}`);
      }
    } catch (error) {
      addMessage('error', `❌ Upload error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploadProgress(false);
    }
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
            setIsProcessing(false);
            setActiveReconciliation(null);
            addMessage('success', '🎉 Reconciliation completed successfully!');
            displayResults(reconciliation.result);
            await loadProcessedFiles();
          } else if (reconciliation.status === 'failed') {
            setIsProcessing(false);
            setActiveReconciliation(null);
            addMessage('error', `❌ Reconciliation failed: ${reconciliation.error || 'Unknown error'}`);
          } else {
            // Still processing, check again
            setTimeout(checkStatus, 3000);
          }
        } else {
          setIsProcessing(false);
          setActiveReconciliation(null);
          addMessage('error', 'Failed to check reconciliation status');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setIsProcessing(false);
        setActiveReconciliation(null);
        addMessage('error', 'Error monitoring reconciliation progress');
      }
    };

    checkStatus();
  };

  const displayResults = (result) => {
    // Log the actual result structure for debugging
    console.log('Reconciliation result structure:', result);

    // Handle different possible result structures from your backend
    const summary = result.summary || result.extraction_summary || result;
    const processingTime = result.processing_time || summary.processing_time || 0;

    // Try multiple possible field names from your backend
    const matchedCount = summary.matched_count || summary.total_matches || summary.successful_extractions || 0;
    const unmatchedFileA = summary.unmatched_file_a_count || summary.unmatched_a || summary.failed_extractions || 0;
    const unmatchedFileB = summary.unmatched_file_b_count || summary.unmatched_b || 0;
    const totalFileA = summary.total_file_a || summary.total_rows_file_a || summary.total_rows || 0;
    const totalFileB = summary.total_file_b || summary.total_rows_file_b || 0;
    const matchRate = summary.match_rate || summary.success_rate || 0;
    const confidence = summary.match_confidence_avg || summary.overall_confidence || summary.confidence || 0;

    // Extract matching strategy details
    const matchingStrategy = result.matching_strategy || result.strategy || {};
    const method = matchingStrategy.method || result.method || 'AI-guided analysis';
    const keyFields = matchingStrategy.key_fields || result.key_fields || result.columns_processed || ['Auto-detected'];
    const tolerances = matchingStrategy.tolerances_applied || result.tolerances || 'Standard matching rules';

    // Extract key findings
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
Use the download buttons in the "Processed Reconciliations" panel to get detailed CSV reports with full match details.

🔍 **Debug Info:**
Raw result keys: ${Object.keys(result).join(', ')}
Summary keys: ${Object.keys(summary).join(', ')}`;

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

  return (
    <div className="flex h-screen bg-gray-50">
      <LeftSidebar
        files={files}
        templates={templates}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        currentInput={currentInput}
        uploadProgress={uploadProgress}
        onFileUpload={handleFileUpload}
        onTemplateSelect={handleTemplateSelect}
        onRefreshFiles={loadFiles}
      />

      <ChatInterface
        messages={messages}
        currentInput={currentInput}
        setCurrentInput={setCurrentInput}
        isProcessing={isProcessing}
        isAnalyzingColumns={isAnalyzingColumns}
        selectedFiles={selectedFiles}
        onStartReconciliation={startReconciliation}
      />

      <RightSidebar
        processedFiles={processedFiles}
        autoRefreshInterval={autoRefreshInterval}
        onRefreshProcessedFiles={loadProcessedFiles}
        onDownloadResults={downloadResults}
      />
    </div>
  );
};

export default App;