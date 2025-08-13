// src/services/api.js - Enhanced with delete access control and all existing features
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const defaultApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiService = {
    // ===========================================
    // FILE OPERATIONS
    // ===========================================
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await defaultApi.post('files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getFiles: async () => {
        const response = await defaultApi.get('/files');
        return response.data;
    },

    getFileInfo: async (fileId) => {
        const response = await defaultApi.get(`/files/${fileId}`);
        return response.data;
    },

    deleteFile: async (fileId) => {
        try {
            const response = await defaultApi.delete(`/files/${fileId}`);
            return response.data;
        } catch (error) {
            // Handle specific access control errors
            if (error.response?.status === 403) {
                const errorMessage = error.response?.data?.detail || error.response?.data?.message || '';

                // Check if it's a permission/access related error
                if (errorMessage.toLowerCase().includes('permission') ||
                    errorMessage.toLowerCase().includes('access') ||
                    errorMessage.toLowerCase().includes('unauthorized') ||
                    errorMessage.toLowerCase().includes('forbidden')) {

                    throw new Error('You do not have access to delete files. Please raise an RSAM request for DELETE_FILE resource to get the necessary permissions.');
                }
            }

            // Handle other specific status codes
            if (error.response?.status === 401) {
                throw new Error('Authentication required. Please log in and try again.');
            }

            if (error.response?.status === 404) {
                throw new Error('File not found. It may have already been deleted.');
            }

            if (error.response?.status === 409) {
                throw new Error('File cannot be deleted because it is currently in use. Please try again later.');
            }

            if (error.response?.status === 500) {
                throw new Error('Server error occurred while deleting the file. Please try again later.');
            }

            // Re-throw the original error if it's not handled above
            throw error;
        }
    },

    // ===========================================
    // EXCEL ANALYSIS FOR UPLOAD
    // ===========================================
    analyzeExcelSheets: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await defaultApi.post('/files/analyze-sheets', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    validateFileName: async (filename) => {
        const response = await defaultApi.post('/files/validate-name', {
            filename: filename
        });
        return response.data;
    },

    // Enhanced upload with sheet and custom name
    uploadFileWithOptions: async (file, sheetName = '', customName = '') => {
        const formData = new FormData();
        formData.append('file', file);
        if (sheetName) {
            formData.append('sheet_name', sheetName);
        }
        if (customName) {
            formData.append('custom_name', customName);
        }

        const response = await defaultApi.post('files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // ===========================================
    // VIEWER OPERATIONS
    // ===========================================
    getFileData: async (fileId, page = 1, pageSize = 1000, searchTerm = '', filterColumn = '', filterValues = []) => {
        let url = `/files/${fileId}/data?page=${page}&page_size=${pageSize}`;
        
        if (filterColumn && filterValues.length > 0) {
            // Column-specific filtering (from dropdown)
            url += `&filter_column=${encodeURIComponent(filterColumn)}`;
            url += `&filter_values=${encodeURIComponent(filterValues.join(','))}`;
        } else if (searchTerm.trim()) {
            // Wildcard search (from search box)
            url += `&search=${encodeURIComponent(searchTerm.trim())}`;
        }
        
        const response = await defaultApi.get(url);
        return response.data;
    },

    updateFileData: async (fileId, data) => {
        const response = await defaultApi.put(`/files/${fileId}/data`, {data});
        return response.data;
    },

    getColumnUniqueValues: async (fileId, columnName, limit = 1000, filters = {}) => {
        const params = new URLSearchParams({ limit: limit.toString() });
        
        // Add filter parameters for cascading dropdowns
        Object.entries(filters).forEach(([filterColumn, filterValues]) => {
            if (filterValues && filterValues.length > 0) {
                // Send multiple filter values as comma-separated
                params.append(`filter_${filterColumn}`, filterValues.join(','));
            }
        });
        
        const response = await defaultApi.get(`/files/${fileId}/columns/${encodeURIComponent(columnName)}/unique-values?${params}`);
        return response.data;
    },

    downloadModifiedFile: async (fileId, format = 'csv') => {
        const response = await defaultApi.get(`/files/${fileId}/download?format=${format}`, {
            responseType: 'blob'
        });
        return response;
    },

    // ===========================================
    // ENHANCED FILE GENERATOR OPERATIONS
    // ===========================================
    validatePrompt: async (file, userPrompt, sheetName = null) => {
        const formData = new FormData();
        formData.append('source_file', file);
        formData.append('user_prompt', userPrompt);
        if (sheetName) formData.append('sheet_name', sheetName);

        const response = await defaultApi.post('/file-generator/validate-prompt', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    generateFileFromRules: async (file, userPrompt, sheetName = null) => {
        const formData = new FormData();
        formData.append('source_file', file);
        formData.append('user_prompt', userPrompt);
        if (sheetName) formData.append('sheet_name', sheetName);

        const response = await defaultApi.post('/file-generator/generate', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getFileTransformationResults: async (generationId) => {
        const response = await defaultApi.get(`/transformation/results/${generationId}`);
        return response.data;
    },

    downloadGeneratedFile: async (generationId, format = 'csv') => {
        const response = await defaultApi.get(`/file-generator/download/${generationId}?format=${format}`, {
            responseType: 'blob'
        });
        return response;
    },

    previewGeneratedFile: async (generationId, limit = 10) => {
        const response = await defaultApi.get(`/file-generator/preview/${generationId}?limit=${limit}`);
        return response.data;
    },

    listGenerations: async () => {
        const response = await defaultApi.get('/file-generator/list-generations');
        return response.data;
    },

    deleteGeneration: async (generationId) => {
        const response = await defaultApi.delete(`/file-generator/results/${generationId}`);
        return response.data;
    },

    // ===========================================
    // ROW MULTIPLICATION HELPER METHODS
    // ===========================================
    validateRowMultiplicationPrompt: (prompt) => {
        const multiplicationKeywords = [
            'generate',
            'create',
            'duplicate',
            'multiply',
            'rows for each',
            'rows per',
            'for every row'
        ];

        const conditionalKeywords = [
            'first row',
            'second row',
            'third row',
            'in first',
            'in second',
            'in third',
            'different values',
            'alternate'
        ];

        const hasMultiplication = multiplicationKeywords.some(keyword =>
            prompt.toLowerCase().includes(keyword)
        );

        const hasConditionals = conditionalKeywords.some(keyword =>
            prompt.toLowerCase().includes(keyword)
        );

        // Extract number pattern (e.g., "2 rows", "3 rows for each")
        const numberMatch = prompt.match(/(\d+)\s*rows?\s*(for\s+each|per)/i);
        const estimatedCount = numberMatch ? parseInt(numberMatch[1]) : 1;

        return {
            hasMultiplication,
            hasConditionals,
            estimatedCount,
            isComplex: hasMultiplication && hasConditionals,
            suggestions: apiService.getPromptSuggestions(prompt)
        };
    },

    getPromptSuggestions: (prompt) => {
        const suggestions = [];

        if (!prompt.toLowerCase().includes('generate') && !prompt.toLowerCase().includes('create')) {
            suggestions.push("Start with 'generate X rows for each source row' to enable row multiplication");
        }

        if (prompt.toLowerCase().includes('different') && !prompt.toLowerCase().includes('first row')) {
            suggestions.push("Be specific about conditions: 'amount 100 in first row, amount 0 in second row'");
        }

        if (prompt.toLowerCase().includes('copy') && !prompt.toLowerCase().includes('from')) {
            suggestions.push("Specify source columns: 'copy trade_id from Trade_ID column'");
        }

        return suggestions;
    },

    processComplexGeneration: async (file, config) => {
        try {
            // Validate configuration
            if (!config.userPrompt) {
                throw new Error('User prompt is required');
            }

            // First validate the prompt
            const validation = await apiService.validatePrompt(file, config.userPrompt, config.sheetName);

            if (!validation.success) {
                throw new Error(`Prompt validation failed: ${validation.error}`);
            }

            // Check if row multiplication is detected
            const promptAnalysis = apiService.validateRowMultiplicationPrompt(config.userPrompt);

            if (promptAnalysis.isComplex && promptAnalysis.estimatedCount > 10) {
                const confirmLargeGeneration = config.confirmLargeGeneration || false;
                if (!confirmLargeGeneration) {
                    return {
                        success: false,
                        requiresConfirmation: true,
                        message: `This will generate ${promptAnalysis.estimatedCount} rows per source row. This could create a very large file. Continue?`,
                        estimatedMultiplier: promptAnalysis.estimatedCount
                    };
                }
            }

            // Proceed with generation
            const result = await apiService.generateFileFromRules(file, config.userPrompt, config.sheetName);

            return {
                success: true,
                result,
                promptAnalysis
            };

        } catch (error) {
            console.error('Error in complex generation:', error);
            throw error;
        }
    },

    // ===========================================
    // ROW MULTIPLICATION TEMPLATES
    // ===========================================
    getRowMultiplicationTemplates: () => {
        return [
            {
                id: 'status_variants',
                title: "Duplicate with Status Variants",
                description: "Create 2 rows per source: one 'active', one 'inactive'",
                prompt: "generate 2 rows for each source row, copy all columns, add status column with 'active' in first row and 'inactive' in second row",
                category: 'status',
                estimatedMultiplier: 2
            },
            {
                id: 'amount_split',
                title: "Amount Split (Full & Zero)",
                description: "Create 2 rows: full amount in first, zero in second",
                prompt: "generate 2 rows for each source row, amount {amount_column} in first row and amount 0 in second row, copy {id_column} from {id_column}",
                category: 'financial',
                estimatedMultiplier: 2,
                requiresColumnMapping: true
            },
            {
                id: 'type_variants',
                title: "Type Variants (A, B, C)",
                description: "Create 3 rows with different types",
                prompt: "generate 3 rows for each source row, type 'A' in first row, type 'B' in second row, type 'C' in third row",
                category: 'classification',
                estimatedMultiplier: 3
            },
            {
                id: 'buy_sell_pair',
                title: "Buy/Sell Transaction Pairs",
                description: "Create buy and sell transactions",
                prompt: "generate 2 rows for each source row, side 'BUY' in first row and side 'SELL' in second row, copy all other fields",
                category: 'trading',
                estimatedMultiplier: 2
            },
            {
                id: 'multi_currency',
                title: "Multi-Currency Split",
                description: "Split transactions across currencies",
                prompt: "generate 3 rows for each source row, currency 'USD' in first, 'EUR' in second, 'GBP' in third, copy all other fields",
                category: 'financial',
                estimatedMultiplier: 3
            },
            {
                id: 'period_breakdown',
                title: "Time Period Breakdown",
                description: "Split into monthly periods",
                prompt: "generate 12 rows for each source row, period 'Jan' in first, 'Feb' in second, continue for all months, divide amount by 12",
                category: 'temporal',
                estimatedMultiplier: 12
            },
            {
                id: 'risk_levels',
                title: "Risk Level Variants",
                description: "Create low, medium, high risk variants",
                prompt: "generate 3 rows for each source row, risk_level 'LOW' in first, 'MEDIUM' in second, 'HIGH' in third",
                category: 'risk',
                estimatedMultiplier: 3
            },
            {
                id: 'approval_workflow',
                title: "Approval Workflow Steps",
                description: "Create workflow stages",
                prompt: "generate 4 rows for each source row, stage 'SUBMITTED' in first, 'REVIEWED' in second, 'APPROVED' in third, 'COMPLETED' in fourth",
                category: 'workflow',
                estimatedMultiplier: 4
            }
        ];
    },

    processTemplatePrompt: (template, availableColumns = []) => {
        let processedPrompt = template.prompt;

        if (template.requiresColumnMapping && availableColumns.length > 0) {
            // Smart column mapping
            const amountColumns = availableColumns.filter(col =>
                col.toLowerCase().includes('amount') ||
                col.toLowerCase().includes('value') ||
                col.toLowerCase().includes('price') ||
                col.toLowerCase().includes('sum')
            );

            const idColumns = availableColumns.filter(col =>
                col.toLowerCase().includes('id') ||
                col.toLowerCase().includes('trade') ||
                col.toLowerCase().includes('ref') ||
                col.toLowerCase().includes('key')
            );

            const dateColumns = availableColumns.filter(col =>
                col.toLowerCase().includes('date') ||
                col.toLowerCase().includes('time') ||
                col.toLowerCase().includes('timestamp')
            );

            // Replace placeholders
            if (amountColumns.length > 0) {
                processedPrompt = processedPrompt.replace(/\{amount_column\}/g, amountColumns[0]);
            }

            if (idColumns.length > 0) {
                processedPrompt = processedPrompt.replace(/\{id_column\}/g, idColumns[0]);
            }

            if (dateColumns.length > 0) {
                processedPrompt = processedPrompt.replace(/\{date_column\}/g, dateColumns[0]);
            }

            // Remove any remaining placeholders
            processedPrompt = processedPrompt.replace(/\{[^}]+\}/g, '[COLUMN_NAME]');
        }

        return processedPrompt;
    },

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    estimateOutputSize: (inputRows, multiplicationFactor) => {
        return {
            outputRows: inputRows * multiplicationFactor,
            sizeMultiplier: multiplicationFactor,
            warning: multiplicationFactor > 10 ? 'Large multiplication factor detected' : null
        };
    },

    validateFileForGeneration: (file) => {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const supportedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        const errors = [];
        const warnings = [];

        if (file.size > maxSize) {
            errors.push(`File size (${apiService.formatFileSize(file.size)}) exceeds maximum allowed (${apiService.formatFileSize(maxSize)})`);
        }

        if (!supportedTypes.includes(file.type)) {
            errors.push(`File type '${file.type}' is not supported. Please use CSV or Excel files.`);
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            warnings.push('Large file detected. Processing may take longer.');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    },

    // ===========================================
    // AI REGEX GENERATION OPERATIONS
    // ===========================================
    generateRegex: async (description, sampleText = '', columnName = '', context = null) => {
        const response = await defaultApi.post('/api/regex/generate', {
            description,
            sample_text: sampleText,
            column_name: columnName,
            context
        });
        return response.data;
    },

    testRegex: async (regex, testText) => {
        const response = await defaultApi.post('/api/regex/test', {
            regex,
            test_text: testText
        });
        return response.data;
    },

    getCommonPatterns: async () => {
        const response = await defaultApi.get('/api/regex/patterns');
        return response.data;
    },

    getPatternSuggestions: async (description) => {
        const response = await defaultApi.get(`/api/regex/suggestions?description=${encodeURIComponent(description)}`);
        return response.data;
    },

    // ===========================================
    // RECONCILIATION OPERATIONS
    // ===========================================
    getReconciliationTemplates: async () => {
        const response = await defaultApi.get('/templates');
        return response.data;
    },

    startReconciliation: async (reconciliationRequest) => {
        const response = await defaultApi.post('/reconciliation/process/', reconciliationRequest);
        return response.data;
    },

    getReconciliationStatus: async (reconciliationId) => {
        const response = await defaultApi.get(`/api/v1/reconcile/${reconciliationId}/status`);
        return response.data;
    },

    getReconciliations: async (skip = 0, limit = 20) => {
        const response = await defaultApi.get(`/api/v1/reconcile/?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    getReconciliationResult: async (reconciliation_id) => {
        const response = await defaultApi.get(`/reconciliation/results/${reconciliation_id}`);
        return response.data;
    },

    downloadReconciliationResults: async (reconciliationId, format, result_type) => {
        const response = await defaultApi.get(`reconciliation/download/${reconciliationId}?format=${format}&result_type=${result_type}`);
        return response.data;
    },

    analyzeColumns: async (fileAId, fileBId) => {
        const url = `/api/v1/reconcile/analyze-columns?file_a_id=${fileAId}&file_b_id=${fileBId}`;
        const response = await defaultApi.post(url);
        return response.data;
    },

    // ===========================================
    // SHEET SELECTION HELPER FUNCTIONS
    // ===========================================
    isExcelFile: (file) => {
        const filename = typeof file === 'string' ? file : file.filename || file.name || '';
        return filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls');
    },

    hasMultipleSheets: (file) => {
        return file.is_excel && file.sheet_names && file.sheet_names.length > 1;
    },

    getCurrentSheetInfo: (file) => {
        if (!file.is_excel || !file.available_sheets) return null;

        return file.available_sheets.find(sheet =>
            sheet.sheet_name === file.selected_sheet
        );
    },

    getSheetSummary: (file) => {
        if (!file.is_excel) return 'CSV File';

        const currentSheet = apiService.getCurrentSheetInfo(file);
        const totalSheets = file.sheet_names?.length || 1;

        if (totalSheets === 1) {
            return `Excel (1 sheet)`;
        }

        return `Excel (${totalSheets} sheets, active: ${file.selected_sheet})`;
    },

    validateSheetSelection: (file, requiredSheets = []) => {
        const errors = [];
        const warnings = [];

        if (!file.is_excel && requiredSheets.length > 0) {
            errors.push('Excel file required for sheet-specific operations');
        }

        if (file.is_excel && !file.selected_sheet) {
            errors.push('No sheet selected');
        }

        if (file.is_excel && file.available_sheets?.length === 0) {
            errors.push('No readable sheets found in Excel file');
        }

        requiredSheets.forEach(sheetName => {
            if (file.is_excel && !file.sheet_names?.includes(sheetName)) {
                errors.push(`Required sheet '${sheetName}' not found`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    },

    // ===========================================
    // ENHANCED FILE OPERATIONS WITH SHEET SUPPORT
    // ===========================================
    getFilePreview: async (fileId, sheetName = null, limit = 10) => {
        let url = `/files/${fileId}/preview?num_rows=${limit}`;
        if (sheetName) {
            url += `&sheet=${encodeURIComponent(sheetName)}`;
        }
        const response = await defaultApi.get(url);
        return response.data;
    },

    getFileDataWithSheet: async (fileId, sheetName = null, page = 1, pageSize = 1000, searchTerm = '') => {
        let url = `/files/${fileId}/data?page=${page}&page_size=${pageSize}`;
        if (sheetName) {
            url += `&sheet=${encodeURIComponent(sheetName)}`;
        }
        if (searchTerm.trim()) {
            url += `&search=${encodeURIComponent(searchTerm.trim())}`;
        }
        const response = await defaultApi.get(url);
        return response.data;
    },

    downloadFileWithSheet: async (fileId, format = 'csv', sheetName = null) => {
        let url = `/files/${fileId}/download?format=${format}`;
        if (sheetName) {
            url += `&sheet=${encodeURIComponent(sheetName)}`;
        }
        const response = await defaultApi.get(url, {
            responseType: 'blob'
        });
        return response;
    },

    // ===========================================
    // RECONCILIATION WITH SHEET SUPPORT
    // ===========================================
    processReconciliationFromStorage: async (fileAId, fileBId, rules) => {
        const formData = new FormData();
        formData.append('file_a_id', fileAId);
        formData.append('file_b_id', fileBId);
        formData.append('rules', JSON.stringify(rules));

        const response = await defaultApi.post('/reconciliation/process-from-storage', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // ===========================================
    // BULK OPERATIONS
    // ===========================================
    bulkDeleteFiles: async (fileIds) => {
        try {
            const response = await defaultApi.post('/files/bulk-delete', {
                file_ids: fileIds
            });
            return response.data;
        } catch (error) {
            // Handle bulk delete access control errors
            if (error.response?.status === 403) {
                const errorMessage = error.response?.data?.detail || error.response?.data?.message || '';

                if (errorMessage.toLowerCase().includes('permission') ||
                    errorMessage.toLowerCase().includes('access') ||
                    errorMessage.toLowerCase().includes('unauthorized') ||
                    errorMessage.toLowerCase().includes('forbidden')) {

                    throw new Error('You do not have access to delete files. Please raise an RSAM request for DELETE_FILE resource to get the necessary permissions.');
                }
            }
            throw error;
        }
    },

    bulkDownloadFiles: async (fileIds, format = 'csv') => {
        const response = await defaultApi.post('/files/bulk-download', {
            file_ids: fileIds,
            format: format
        }, {
            responseType: 'blob'
        });
        return response;
    },

    // ===========================================
    // FILE METADATA OPERATIONS
    // ===========================================
    updateFileMetadata: async (fileId, metadata) => {
        const response = await defaultApi.put(`/files/${fileId}/metadata`, metadata);
        return response.data;
    },

    getFileStatistics: async (fileId) => {
        const response = await defaultApi.get(`/files/${fileId}/statistics`);
        return response.data;
    },

    getFileColumns: async (fileId, sheetName = null) => {
        let url = `/files/${fileId}/columns`;
        if (sheetName) {
            url += `?sheet=${encodeURIComponent(sheetName)}`;
        }
        const response = await defaultApi.get(url);
        return response.data;
    },

    // ===========================================
    // SEARCH AND FILTER OPERATIONS
    // ===========================================
    searchFiles: async (query, filters = {}) => {
        const params = new URLSearchParams({
            q: query,
            ...filters
        });
        const response = await defaultApi.get(`/files/search?${params}`);
        return response.data;
    },

    filterFilesByType: async (fileType = 'all') => {
        const response = await defaultApi.get(`/files/filter?type=${fileType}`);
        return response.data;
    },

    // ===========================================
    // IMPORT/EXPORT OPERATIONS
    // ===========================================
    exportFileList: async (format = 'json') => {
        const response = await defaultApi.get(`/files/export?format=${format}`, {
            responseType: format === 'json' ? 'json' : 'blob'
        });
        return response;
    },

    importConfiguration: async (configFile) => {
        const formData = new FormData();
        formData.append('config_file', configFile);

        const response = await defaultApi.post('/files/import-config', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // ===========================================
    // RECENT RESULTS OPERATIONS
    // ===========================================
    getRecentResults: async (limit = 5) => {
        try {
            const response = await defaultApi.get('/recent-results/list', {
                params: {limit: limit}
            });
            return response.data;
        } catch (error) {
            console.error('Error getting recent results:', error);
            throw error;
        }
    },

    getDeltaResultSummary: async (deltaId) => {
        try {
            const response = await defaultApi.get(`/recent-results/delta/${deltaId}/summary`);
            return response.data;
        } catch (error) {
            console.error('Error getting delta result summary:', error);
            throw error;
        }
    },

    getReconciliationResultSummary: async (reconId) => {
        try {
            const response = await defaultApi.get(`/recent-results/reconciliation/${reconId}/summary`);
            return response.data;
        } catch (error) {
            console.error('Error getting reconciliation result summary:', error);
            throw error;
        }
    },

    clearOldResults: async (keepCount = 10) => {
        try {
            const response = await defaultApi.delete('/recent-results/clear-old', {
                params: {keep_count: keepCount}
            });
            return response.data;
        } catch (error) {
            console.error('Error clearing old results:', error);
            throw error;
        }
    },

    getRecentResultsHealth: async () => {
        try {
            const response = await defaultApi.get('/recent-results/health');
            return response.data;
        } catch (error) {
            console.error('Error getting recent results health:', error);
            throw error;
        }
    },

    // ===========================================
    // SAVE RESULTS TO SERVER OPERATIONS
    // ===========================================
    saveResultsToServer: async (resultId, resultType, processType, fileFormat = 'csv', customFilename = null, description = null) => {
        try {
            const response = await defaultApi.post('/save-results/save', {
                result_id: resultId,
                result_type: resultType,
                process_type: processType,
                file_format: fileFormat,
                custom_filename: customFilename,
                description: description
            });
            return response.data;
        } catch (error) {
            console.error('Error saving results to server:', error);
            throw error;
        }
    },

    listSavedResults: async () => {
        try {
            const response = await defaultApi.get('/save-results/list');
            return response.data;
        } catch (error) {
            console.error('Error listing saved results:', error);
            throw error;
        }
    },

    getSavedFileInfo: async (savedFileId) => {
        try {
            const response = await defaultApi.get(`/save-results/info/${savedFileId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting saved file info:', error);
            throw error;
        }
    },

    deleteSavedFile: async (savedFileId) => {
        try {
            const response = await defaultApi.delete(`/save-results/delete/${savedFileId}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting saved file:', error);
            throw error;
        }
    },

    downloadSavedFile: async (savedFileId, format = 'csv') => {
        try {
            const response = await defaultApi.get(`/save-results/download/${savedFileId}`, {
                params: {format: format},
                responseType: 'blob'
            });

            // Handle file download
            const blob = response.data;
            const contentDisposition = response.headers['content-disposition'];
            const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
                `saved_file_${savedFileId}.${format}`;

            // Trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return {success: true, filename};
        } catch (error) {
            console.error('Error downloading saved file:', error);
            throw error;
        }
    },

    getSaveResultsHealth: async () => {
        try {
            const response = await defaultApi.get('/save-results/health');
            return response.data;
        } catch (error) {
            console.error('Error getting save results health:', error);
            throw error;
        }
    },

    // ===========================================
    // ACCESS CONTROL HELPER FUNCTIONS
    // ===========================================
    checkDeleteAccess: async () => {
        try {
            // Make a test call to check delete permissions
            // This could be a specific endpoint that checks permissions without actually deleting
            const response = await defaultApi.get('/files/check-delete-access');
            return response.data;
        } catch (error) {
            if (error.response?.status === 403) {
                return {
                    hasAccess: false,
                    message: 'You do not have access to delete files. Please raise an RSAM request for DELETE_FILE resource.'
                };
            }
            return {
                hasAccess: true,
                message: 'Delete access check failed, but deletion may still be possible.'
            };
        }
    },

    getRequiredPermissions: (action) => {
        const permissionMap = {
            'delete': 'DELETE_FILE',
            'upload': 'UPLOAD_FILE',
            'download': 'DOWNLOAD_FILE',
            'view': 'VIEW_FILE',
            'edit': 'EDIT_FILE',
            'bulk_delete': 'DELETE_FILE',
            'bulk_download': 'DOWNLOAD_FILE'
        };

        return permissionMap[action] || 'UNKNOWN_PERMISSION';
    },

    formatAccessErrorMessage: (action, permission = null) => {
        const requiredPermission = permission || apiService.getRequiredPermissions(action);
        return `You do not have access to ${action} files. Please raise an RSAM request for ${requiredPermission} resource to get the necessary permissions.`;
    },
    // ===========================================
    // RULE MANAGEMENT OPERATIONS
    // ===========================================
    saveReconciliationRule: async (ruleData, metadata) => {
        const response = await defaultApi.post('/rules/save', {
            metadata: metadata,
            rule_config: ruleData
        });
        return response.data;
    },

    listReconciliationRules: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.template_id) params.append('template_id', filters.template_id);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());

        const response = await defaultApi.get(`/rules/list?${params}`);
        return response.data;
    },

    getRulesByTemplate: async (templateId) => {
        const response = await defaultApi.get(`/rules/template/${templateId}`);
        return response.data;
    },

    getReconciliationRule: async (ruleId) => {
        const response = await defaultApi.get(`/rules/${ruleId}`);
        return response.data;
    },

    updateReconciliationRule: async (ruleId, updates) => {
        const response = await defaultApi.put(`/rules/${ruleId}`, updates);
        return response.data;
    },

    deleteReconciliationRule: async (ruleId) => {
        const response = await defaultApi.delete(`/rules/${ruleId}`);
        return response.data;
    },

    markRuleAsUsed: async (ruleId) => {
        const response = await defaultApi.post(`/rules/${ruleId}/use`);
        return response.data;
    },

    searchReconciliationRules: async (searchFilters) => {
        const response = await defaultApi.post('/rules/search', searchFilters);
        return response.data;
    },

    getRuleCategories: async () => {
        const response = await defaultApi.get('/rules/categories/list');
        return response.data;
    },

    getRuleManagementHealth: async () => {
        const response = await defaultApi.get('/rules/health');
        return response.data;
    },

    // Helper functions for rule management
    validateRuleMetadata: (metadata) => {
        const errors = [];

        if (!metadata.name || metadata.name.trim().length < 3) {
            errors.push('Rule name must be at least 3 characters long');
        }

        if (metadata.name && metadata.name.length > 100) {
            errors.push('Rule name must be less than 100 characters');
        }

        if (metadata.description && metadata.description.length > 500) {
            errors.push('Description must be less than 500 characters');
        }

        if (metadata.tags && metadata.tags.length > 10) {
            errors.push('Maximum 10 tags allowed');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    createRuleFromConfig: (config, selectedTemplate, metadata = {}) => {
        // Create a clean rule configuration without file-specific data
        const ruleConfig = {
            Files: config.Files || [],
            ReconciliationRules: config.ReconciliationRules || [],
            selected_columns_file_a: config.selected_columns_file_a || [],
            selected_columns_file_b: config.selected_columns_file_b || [],
            user_requirements: config.user_requirements || ''
        };

        const ruleMetadata = {
            name: metadata.name || `${selectedTemplate?.name || 'Custom'} Rule - ${new Date().toLocaleDateString()}`,
            description: metadata.description || `Rule for ${selectedTemplate?.name || 'custom reconciliation'}`,
            category: metadata.category || 'reconciliation',
            tags: metadata.tags || [selectedTemplate?.category || 'general'],
            template_id: selectedTemplate?.id,
            template_name: selectedTemplate?.name
        };

        return {
            ruleConfig,
            ruleMetadata
        };
    },

    adaptRuleToFiles: (savedRule, fileColumns) => {
        // Adapt a saved rule to work with new files
        const adaptedConfig = {...savedRule.rule_config};

        // The rule structure is already file-agnostic, but we might need to
        // validate that required columns exist in the new files
        const warnings = [];
        const errors = [];

        // Check if extraction rules reference columns that exist
        if (adaptedConfig.Files) {
            adaptedConfig.Files.forEach((fileConfig, index) => {
                const availableColumns = Object.values(fileColumns)[index] || [];

                if (fileConfig.Extract) {
                    fileConfig.Extract.forEach(extractRule => {
                        if (extractRule.SourceColumn && !availableColumns.includes(extractRule.SourceColumn)) {
                            warnings.push(`Column "${extractRule.SourceColumn}" not found in file ${index + 1}. You may need to update this extraction rule.`);
                        }
                    });
                }

                if (fileConfig.Filter) {
                    fileConfig.Filter.forEach(filterRule => {
                        if (filterRule.ColumnName && !availableColumns.includes(filterRule.ColumnName)) {
                            warnings.push(`Column "${filterRule.ColumnName}" not found in file ${index + 1}. You may need to update this filter rule.`);
                        }
                    });
                }
            });
        }

        return {
            adaptedConfig,
            warnings,
            errors
        };
    },
    // Extended API service methods for Delta Rule Management
// Add these methods to your existing apiService object in api.js

// ===========================================
// DELTA RULE MANAGEMENT OPERATIONS
// ===========================================
    saveDeltaRule: async (ruleData, metadata) => {
        const response = await defaultApi.post('/delta-rules/save', {
            metadata: metadata,
            rule_config: ruleData
        });
        return response.data;
    },

    listDeltaRules: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.template_id) params.append('template_id', filters.template_id);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());

        const response = await defaultApi.get(`/delta-rules/list?${params}`);
        return response.data;
    },

    getDeltaRulesByTemplate: async (templateId) => {
        const response = await defaultApi.get(`/delta-rules/template/${templateId}`);
        return response.data;
    },

    getDeltaRule: async (ruleId) => {
        const response = await defaultApi.get(`/delta-rules/${ruleId}`);
        return response.data;
    },

    updateDeltaRule: async (ruleId, updates) => {
        const response = await defaultApi.put(`/delta-rules/${ruleId}`, updates);
        return response.data;
    },

    deleteDeltaRule: async (ruleId) => {
        const response = await defaultApi.delete(`/delta-rules/${ruleId}`);
        return response.data;
    },

    markDeltaRuleAsUsed: async (ruleId) => {
        const response = await defaultApi.post(`/delta-rules/${ruleId}/use`);
        return response.data;
    },

    searchDeltaRules: async (searchFilters) => {
        const response = await defaultApi.post('/delta-rules/search', searchFilters);
        return response.data;
    },

    getDeltaRuleCategories: async () => {
        const response = await defaultApi.get('/delta-rules/categories/list');
        return response.data;
    },

    getDeltaRuleManagementHealth: async () => {
        const response = await defaultApi.get('/delta-rules/health');
        return response.data;
    },

// Helper functions for delta rule management
    validateDeltaRuleMetadata: (metadata) => {
        const errors = [];

        if (!metadata.name || metadata.name.trim().length < 3) {
            errors.push('Rule name must be at least 3 characters long');
        }

        if (metadata.name && metadata.name.length > 100) {
            errors.push('Rule name must be less than 100 characters');
        }

        if (metadata.description && metadata.description.length > 500) {
            errors.push('Description must be less than 500 characters');
        }

        if (metadata.tags && metadata.tags.length > 10) {
            errors.push('Maximum 10 tags allowed');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    createDeltaRuleFromConfig: (config, selectedTemplate, metadata = {}) => {
        // Create a clean rule configuration without file-specific data
        const ruleConfig = {
            Files: config.Files || [],
            KeyRules: config.KeyRules || [],
            ComparisonRules: config.ComparisonRules || [],
            selected_columns_file_a: config.selected_columns_file_a || [],
            selected_columns_file_b: config.selected_columns_file_b || [],
            user_requirements: config.user_requirements || 'Generate delta between older and newer files using configured key and comparison rules'
        };

        const ruleMetadata = {
            name: metadata.name || `${selectedTemplate?.name || 'Delta'} Rule - ${new Date().toLocaleDateString()}`,
            description: metadata.description || `Delta generation rule for ${selectedTemplate?.name || 'file comparison'}`,
            category: metadata.category || 'delta',
            tags: metadata.tags || [selectedTemplate?.category || 'general', 'delta'],
            template_id: selectedTemplate?.id,
            template_name: selectedTemplate?.name,
            rule_type: 'delta_generation'
        };

        return {
            ruleConfig,
            ruleMetadata
        };
    },

    adaptDeltaRuleToFiles: (savedRule, fileColumns) => {
        // Adapt a saved delta rule to work with new files
        const adaptedConfig = {...savedRule.rule_config};
        const warnings = [];
        const errors = [];

        // Get available columns for both files
        const fileKeys = Object.keys(fileColumns);
        const columnsA = fileColumns[fileKeys[0]] || [];
        const columnsB = fileColumns[fileKeys[1]] || [];

        // Check key rules for missing columns
        if (adaptedConfig.KeyRules) {
            adaptedConfig.KeyRules.forEach((rule, index) => {
                if (rule.LeftFileColumn && !columnsA.includes(rule.LeftFileColumn)) {
                    warnings.push(`Key rule ${index + 1}: Column "${rule.LeftFileColumn}" not found in older file`);
                }
                if (rule.RightFileColumn && !columnsB.includes(rule.RightFileColumn)) {
                    warnings.push(`Key rule ${index + 1}: Column "${rule.RightFileColumn}" not found in newer file`);
                }
            });
        }

        // Check comparison rules for missing columns
        if (adaptedConfig.ComparisonRules) {
            adaptedConfig.ComparisonRules.forEach((rule, index) => {
                if (rule.LeftFileColumn && !columnsA.includes(rule.LeftFileColumn)) {
                    warnings.push(`Comparison rule ${index + 1}: Column "${rule.LeftFileColumn}" not found in older file`);
                }
                if (rule.RightFileColumn && !columnsB.includes(rule.RightFileColumn)) {
                    warnings.push(`Comparison rule ${index + 1}: Column "${rule.RightFileColumn}" not found in newer file`);
                }
            });
        }

        // Adapt column selections - keep only columns that exist in new files
        if (adaptedConfig.selected_columns_file_a) {
            const validColumnsA = adaptedConfig.selected_columns_file_a.filter(col => columnsA.includes(col));
            const missingColumnsA = adaptedConfig.selected_columns_file_a.filter(col => !columnsA.includes(col));

            adaptedConfig.selected_columns_file_a = validColumnsA;

            if (missingColumnsA.length > 0) {
                warnings.push(`Older file: Result columns not found - ${missingColumnsA.join(', ')}`);
            }
        }

        if (adaptedConfig.selected_columns_file_b) {
            const validColumnsB = adaptedConfig.selected_columns_file_b.filter(col => columnsB.includes(col));
            const missingColumnsB = adaptedConfig.selected_columns_file_b.filter(col => !columnsB.includes(col));

            adaptedConfig.selected_columns_file_b = validColumnsB;

            if (missingColumnsB.length > 0) {
                warnings.push(`Newer file: Result columns not found - ${missingColumnsB.join(', ')}`);
            }
        }

        // Ensure we have at least some column selections if none are valid
        if (!adaptedConfig.selected_columns_file_a || adaptedConfig.selected_columns_file_a.length === 0) {
            adaptedConfig.selected_columns_file_a = columnsA.slice(0, Math.min(5, columnsA.length));
            warnings.push('Auto-selected first 5 columns for older file as no valid selections found');
        }

        if (!adaptedConfig.selected_columns_file_b || adaptedConfig.selected_columns_file_b.length === 0) {
            adaptedConfig.selected_columns_file_b = columnsB.slice(0, Math.min(5, columnsB.length));
            warnings.push('Auto-selected first 5 columns for newer file as no valid selections found');
        }

        return {
            adaptedConfig,
            warnings,
            errors
        };
    },
};


// Enhanced error handling interceptor with access control
defaultApi.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);

        // Handle access control errors first
        if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.detail || error.response?.data?.message || '';

            if (errorMessage.toLowerCase().includes('delete')) {
                throw new Error('You do not have access to delete files. Please raise an RSAM request for DELETE_FILE resource to get the necessary permissions.');
            }

            if (errorMessage.toLowerCase().includes('upload')) {
                throw new Error('You do not have access to upload files. Please raise an RSAM request for UPLOAD_FILE resource to get the necessary permissions.');
            }

            if (errorMessage.toLowerCase().includes('download')) {
                throw new Error('You do not have access to download files. Please raise an RSAM request for DOWNLOAD_FILE resource to get the necessary permissions.');
            }

            // Generic access denied message
            if (errorMessage.toLowerCase().includes('permission') ||
                errorMessage.toLowerCase().includes('access') ||
                errorMessage.toLowerCase().includes('unauthorized') ||
                errorMessage.toLowerCase().includes('forbidden')) {

                throw new Error('You do not have the required permissions for this action. Please raise an RSAM request for the appropriate resource access.');
            }
        }

        // Handle other specific error cases
        if (error.response?.status === 500 && error.response?.data?.detail?.includes('OpenAI')) {
            throw new Error('AI service is currently unavailable. Please try again later.');
        }

        if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }

        if (error.response?.status === 413) {
            throw new Error('File too large. Please upload a smaller file.');
        }

        if (error.response?.status === 415) {
            throw new Error('Unsupported file type. Please upload CSV or Excel files only.');
        }

        if (error.response?.status === 401) {
            throw new Error('Authentication required. Please log in and try again.');
        }

        if (error.response?.status === 404) {
            throw new Error('Requested resource not found.');
        }

        if (error.response?.status === 409) {
            throw new Error('Conflict detected. The resource may be in use or locked.');
        }

        if (error.response?.data?.detail) {
            throw new Error(error.response.data.detail);
        }

        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }

        throw error;
    }
);

export default apiService;