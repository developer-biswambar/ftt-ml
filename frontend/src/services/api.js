// src/services/api.js - Enhanced with viewer endpoints
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

        const response = await api.post('/upload', formData, {
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

    // NEW: Viewer operations
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

    // Reconciliation operations
    getReconciliationTemplates: async () => {
        const response = await api.get('/api/v1/reconcile/templates');
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
        const response = await api.post(url)
        return response.data;
    }
};

export default apiService;