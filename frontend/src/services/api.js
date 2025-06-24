// src/services/api.js
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
        const response = await api.post('/api/v1/reconcile/analyze-columns', {
            params: {
                file_a_id: fileAId,
                file_b_id: fileBId
            }
        });
        return response.data;
    }
};

export default apiService;