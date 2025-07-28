// src/services/messageService.js

class MessageService {
    constructor() {
        this.messageQueue = [];
        this.typingSpeed = 5; // milliseconds per character
    }

    // Message creation helpers
    createMessage(type, content, tableData = null) {
        return {
            id: Date.now() + Math.random(),
            type,
            content,
            timestamp: new Date(),
            tableData
        };
    }

    // Typing simulation
    simulateTyping(content, onProgress, onComplete, speed = this.typingSpeed) {
        let currentIndex = 0;

        const typingInterval = setInterval(() => {
            if (currentIndex < content.length) {
                onProgress(content.substring(0, currentIndex + 1));
                currentIndex++;
            } else {
                clearInterval(typingInterval);
                onComplete();
            }
        }, speed);

        return typingInterval; // Return interval ID for potential cleanup
    }

    // Message templates
    getWelcomeMessage() {
        return `🎯 Welcome to Financial Data Reconciliation!

📋 **Getting Started:**
1. Upload two files to compare
2. Select them in the file selector
3. Choose a template (try our AI-powered option!)
4. Configure reconciliation rules
5. Start the reconciliation process

I'll analyze your data and provide detailed matching results with downloadable reports.

💡 **New Features:**
• 🤖 AI-powered rule generation
• 👁️ Click the eye icon to view/edit files
• ⚙️ Manual configuration for full control
• 🔧 AI File Generator for creating new files
• 📊 Display results directly in chat
• 📥 Download individual result types
• 📊 NEW: Delta Generation for change tracking`;
    }

    getTemplateSelectedMessage(template) {
        const fileText = template.filesRequired === 1 ? 'file' : 'files';
        const baseMessage = `✅ Process selected: "${template.name}"

📁 **File Requirements:**
This process requires ${template.filesRequired} ${fileText}:
${template.fileLabels.map((label, index) => `${index + 1}. ${label}`).join('\n')}

👈 Please select the required ${fileText} from the left panel to proceed.`;

        if (template.category.includes('ai')) {
            return `${baseMessage}

🤖 This process will use AI to analyze your data automatically.`;
        } else if (template.category.includes('delta-generation')) {
            return `${baseMessage}

📊 This process will compare files to identify changes over time.`;
        } else {
            return `${baseMessage}

⚙️ You'll configure the process parameters step by step.`;
        }
    }

    getProcessStartMessage(template, isProcessing = false) {
        if (isProcessing) {
            return `🚀 Starting ${template.name}...

⏳ This may take 30-60 seconds depending on file size and complexity.`;
        }
        return `🚀 ${template.name} started successfully!`;
    }

    getUploadSuccessMessage(file, additionalDetails = null) {
        const baseMessage = `✅ File "${file.name || file.filename}" uploaded successfully!`;

        const details = additionalDetails || file;
        const detailsText = `
📊 **File Statistics:**
• 📈 Total Rows: ${details.total_rows?.toLocaleString() || 'N/A'}
• 📋 Columns: ${details.columns?.length || 'N/A'}
• 📁 File Type: ${details.file_type || file.name?.split('.').pop()?.toUpperCase() || 'Unknown'}
• 💾 File Size: ${details.file_size ? (details.file_size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}

💡 **What's Next:**
• The file is now available in the left panel
• Click the 👁️ eye icon to view and edit the data
• Select it for your reconciliation process!`;

        return baseMessage + detailsText;
    }

    getUploadProgressMessage(filename, progress = null) {
        const baseMessage = `📤 Uploading "${filename}"...`;

        if (progress !== null) {
            return `${baseMessage} (${progress}% complete)`;
        }

        return `${baseMessage}

⏳ **Upload in Progress:**
• Processing file content
• Analyzing data structure  
• Validating format
• Preparing for use

Please wait while we prepare your file...`;
    }

    getErrorMessage(error, context = '') {
        const prefix = context ? `${context}: ` : '';
        return `❌ ${prefix}${error}`;
    }

    // Results formatting
    formatReconciliationResults(result) {
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

        return `📊 **Reconciliation Results:**

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
    }

    formatDeltaResults(summary, deltaId) {
        return `🎯 Delta Generation Results:

📊 Total Records:
• Older File: ${summary.total_records_file_a.toLocaleString()} records
• Newer File: ${summary.total_records_file_b.toLocaleString()} records

🔍 Delta Analysis:
• 🔄 Unchanged: ${summary.unchanged_records.toLocaleString()} records
• ✏️ Amended: ${summary.amended_records.toLocaleString()} records  
• ❌ Deleted: ${summary.deleted_records.toLocaleString()} records
• ✅ Newly Added: ${summary.newly_added_records.toLocaleString()} records

⏱️ Processing Time: ${summary.processing_time_seconds}s

📁 Delta ID: ${deltaId}`;
    }

    formatDetailedResultsSummary(resultType, data) {
        if (resultType === 'delta') {
            return `📊 **Delta Results Summary:**

📋 **Data Overview:**
• Total Unchanged: ${data.unchanged.length}
• Total Amended: ${data.amended.length}
• Total Deleted: ${data.deleted.length}
• Total Newly Added: ${data.newly_added.length}

💡 **Note:** Showing first 10 records of each category. For complete data, use the download buttons in the Results panel →`;
        } else {
            return `📊 **Detailed Results Summary:**

📋 **Data Overview:**
• Total Matched: ${data.matched.length}
• Unmatched File A: ${data.unmatched_file_a.length}
• Unmatched File B: ${data.unmatched_file_b.length}

💡 **Note:** Showing first 10 records of each category. For complete data, use the download buttons in the Results panel →`;
        }
    }

    formatFileTransformationResult(result) {
        const success = result.success === true;
        const id = result.processId || 'N/A';
        const totalIn = result.process.total_input_rows ?? 0;
        const totalOut = result.process.total_output_rows ?? 0;
        const processingTime = result.process.processing_time_seconds ?? 0;

        const val = result.process.validation_summary || {};
        const passed = val.passed === true;
        const errors = Array.isArray(val.errors) ? val.errors : [];
        const warnings = Array.isArray(val.warnings) ? val.warnings : [];

        // also pick top‑level errors/warnings if any
        const topErrors = Array.isArray(val.errors) ? val.errors : [];
        const topWarnings = Array.isArray(val.warnings) ? val.warnings : [];

        return `🔄 **File Transformation Result**

• ✅ Success: ${success ? 'Yes' : '❌ No'}
• 🆔 Transformation ID: \`${id}\`
• 📥 Input Rows: ${totalIn.toLocaleString()}
• 📤 Output Rows: ${totalOut.toLocaleString()}
• ⏱️ Processing Time: ${processingTime.toFixed(3)} sec

🧪 **Validation Summary**:  
• Passed: ${passed ? 'Yes' : '❌ No'}  
• Warnings: ${[...warnings, ...topWarnings].length}  
• Errors: ${[...errors, ...topErrors].length}

${
            warnings.length + topWarnings.length > 0
                ? `⚠️ **Warnings:**\n` +
                [...warnings, ...topWarnings]
                    .slice(0, 4)
                    .map(w => `  • ${w}`)
                    .join('\n') + '\n'
                : ''
        }

${
            errors.length + topErrors.length > 0
                ? `❗ **Errors:**\n` +
                [...errors, ...topErrors]
                    .slice(0, 4)
                    .map(e => `  • ${e}`)
                    .join('\n') + '\n'
                : ''
        }

📥 **Next Steps:**  
– Down‑load transformed file using the link in the “Results” panel.  
– “Display Preview” to inspect sample rows in this chat.`;
    }


    // Table data helpers
    createTableData(title, data, color, totalCount) {
        return {
            title,
            data: data.slice(0, 10), // Limit to first 10 records
            columns: data.length > 0 ? Object.keys(data[0]) : [],
            color,
            totalCount
        };
    }

    // Delta table categories
    getDeltaTableCategories() {
        return {
            unchanged: {name: '🔄 Unchanged Records', color: 'green'},
            amended: {name: '✏️ Amended Records', color: 'orange'},
            deleted: {name: '❌ Deleted Records', color: 'red'},
            newly_added: {name: '✅ Newly Added Records', color: 'purple'}
        };
    }

    // Reconciliation table categories
    getReconciliationTableCategories() {
        return {
            matched: {name: '✅ Matched Records', color: 'green'},
            unmatched_file_a: {name: '❗ Unmatched in File A', color: 'orange'},
            unmatched_file_b: {name: '❗ Unmatched in File B', color: 'purple'}
        };
    }
}

export const messageService = new MessageService();