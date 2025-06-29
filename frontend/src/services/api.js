// src/services/api.js - Enhanced with regex generation endpoints
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiService = {
    // File operations
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

    // Viewer operations
    getFileData: async (fileId, page = 1, pageSize = 1000) => {
        const response = await api.get(`/files/${fileId}/data?page=${page}&page_size=${pageSize}`);
        return response.data;
    },

    updateFileData: async (fileId, data) => {
        const response = await api.put(`/files/${fileId}/data`, { data });
        return response.data;
    },

    downloadModifiedFile: async (fileId, format = 'csv') => {
        const response = await api.get(`/files/${fileId}/download?format=${format}`, {
            responseType: 'blob'
        });
        return response;
    },

    // NEW: AI Regex Generation operations
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

    // Reconciliation operations
    getReconciliationTemplates: async () => {
        const response = await api.get('/templates');
        return response.data;
    },

    startReconciliation: async (reconciliationRequest) => {
        const response = await api.post('/api/v1/reconcile/', reconciliationRequest);
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

    downloadReconciliationResults: async (reconciliationId, fileType) => {
        const response = await api.get(`/api/v1/reconcile/${reconciliationId}/download/${fileType}`);
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