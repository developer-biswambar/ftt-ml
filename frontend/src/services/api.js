// src/services/api.js - Enhanced with row multiplication features
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
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

        const response = await api.post('files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getFiles: async () => {
        const response = await api.get('/files');
        return response.data;
    },

    getFileInfo: async (fileId) => {
        const response = await api.get(`/files/${fileId}`);
        return response.data;
    },

    deleteFile: async (fileId) => {
        const response = await api.delete(`/files/${fileId}`);
        return response.data;
    },

    // ===========================================
    // VIEWER OPERATIONS
    // ===========================================
    getFileData: async (fileId, page = 1, pageSize = 1000) => {
        const response = await api.get(`/files/${fileId}/data?page=${page}&page_size=${pageSize}`);
        return response.data;
    },

    updateFileData: async (fileId, data) => {
        const response = await api.put(`/files/${fileId}/data`, {data});
        return response.data;
    },

    downloadModifiedFile: async (fileId, format = 'csv') => {
        const response = await api.get(`/files/${fileId}/download?format=${format}`, {
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

        const response = await api.post('/file-generator/validate-prompt', formData, {
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

        const response = await api.post('/file-generator/generate', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getGenerationResults: async (generationId) => {
        const response = await api.get(`/file-generator/results/${generationId}`);
        return response.data;
    },

    downloadGeneratedFile: async (generationId, format = 'csv') => {
        const response = await api.get(`/file-generator/download/${generationId}?format=${format}`, {
            responseType: 'blob'
        });
        return response;
    },

    previewGeneratedFile: async (generationId, limit = 10) => {
        const response = await api.get(`/file-generator/preview/${generationId}?limit=${limit}`);
        return response.data;
    },

    listGenerations: async () => {
        const response = await api.get('/file-generator/list-generations');
        return response.data;
    },

    deleteGeneration: async (generationId) => {
        const response = await api.delete(`/file-generator/results/${generationId}`);
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
        const response = await api.post('/api/regex/generate', {
            description,
            sample_text: sampleText,
            column_name: columnName,
            context
        });
        return response.data;
    },

    testRegex: async (regex, testText) => {
        const response = await api.post('/api/regex/test', {
            regex,
            test_text: testText
        });
        return response.data;
    },

    getCommonPatterns: async () => {
        const response = await api.get('/api/regex/patterns');
        return response.data;
    },

    getPatternSuggestions: async (description) => {
        const response = await api.get(`/api/regex/suggestions?description=${encodeURIComponent(description)}`);
        return response.data;
    },

    // ===========================================
    // RECONCILIATION OPERATIONS
    // ===========================================
    getReconciliationTemplates: async () => {
        const response = await api.get('/templates');
        return response.data;
    },

    startReconciliation: async (reconciliationRequest) => {
        const response = await api.post('/reconciliation/process/', reconciliationRequest);
        return response.data;
    },

    getReconciliationStatus: async (reconciliationId) => {
        const response = await api.get(`/api/v1/reconcile/${reconciliationId}/status`);
        return response.data;
    },

    getReconciliations: async (skip = 0, limit = 20) => {
        const response = await api.get(`/api/v1/reconcile/?skip=${skip}&limit=${limit}`);
        return response.data;
    },
    getReconciliationResult: async (reconciliation_id) => {
        const response = await api.get(`/reconciliation/results/${reconciliation_id}`);
        return response.data;
    },

    downloadReconciliationResults: async (reconciliationId, format, result_type) => {
        const response = await api.get(`/download/${reconciliationId}?format=${format}&result_type=${result_type}`);
        return response.data;
    },

    analyzeColumns: async (fileAId, fileBId) => {
        const url = `/api/v1/reconcile/analyze-columns?file_a_id=${fileAId}&file_b_id=${fileBId}`;
        const response = await api.post(url);
        return response.data;
    }
};

// Error handling interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);

        // Handle specific error cases
        if (error.response?.status === 500 && error.response?.data?.detail?.includes('OpenAI')) {
            throw new Error('AI service is currently unavailable. Please try again later.');
        }

        if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }

        if (error.response?.data?.detail) {
            throw new Error(error.response.data.detail);
        }

        throw error;
    }
);

export default apiService;

// ===========================================
// USAGE EXAMPLES FOR ROW MULTIPLICATION
// ===========================================

/*
// Basic row multiplication validation
const promptAnalysis = apiService.validateRowMultiplicationPrompt(
    "generate 2 rows for each source row, status active in first, inactive in second"
);
console.log('Multiplication detected:', promptAnalysis.hasMultiplication);
console.log('Estimated count:', promptAnalysis.estimatedCount);

// Using templates
const templates = apiService.getRowMultiplicationTemplates();
const buyTemplate = templates.find(t => t.id === 'buy_sell_pair');
const processedPrompt = apiService.processTemplatePrompt(buyTemplate, ['Trade_ID', 'Amount']);

// Validate prompt with AI
const validation = await apiService.validatePrompt(file, userPrompt);
if (validation.success && validation.validation.row_multiplication?.enabled) {
    console.log(`Will create ${validation.validation.row_multiplication.count}x rows`);
}

// Complex generation with safety checks
const result = await apiService.processComplexGeneration(file, {
    userPrompt: "generate 20 rows for each source with different sequential values",
    sheetName: "Sheet1",
    confirmLargeGeneration: true
});

if (result.requiresConfirmation) {
    // Show confirmation dialog to user
    console.log(result.message);
}

// File validation
const fileValidation = apiService.validateFileForGeneration(file);
if (!fileValidation.isValid) {
    console.error('File validation errors:', fileValidation.errors);
}

// Size estimation
const sizeEstimate = apiService.estimateOutputSize(1000, 5);
console.log(`Input: 1000 rows, Output: ${sizeEstimate.outputRows} rows`);
*/