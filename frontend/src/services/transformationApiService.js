// Transformation API Service
// Handles all API calls related to data transformation features

import axios from "axios";

const API_BASE_URL = 'http://localhost:8000';


const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const transformationApiService = {
    // Process transformation
    processTransformation: async (request) => {
        const response = await fetch(`${API_BASE_URL}/transformation/process/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (
            !response.ok
        ) {
            const error = await response.json();
            throw new Error(error.detail || 'Transformation failed');
        }

        return response.json();
    },

    saveTransformationResultsToServer: async (transformation_id, resultType = 'all', fileFormat = 'csv', customFilename = null, description = null) => {
        try {
            const response = await api.post('/save-results/save', {
                result_id: transformation_id,
                result_type: resultType,
                process_type: 'file-transformation',
                file_format: fileFormat,
                custom_filename: customFilename,
                description: description
            });

            return response.data;
        } catch (error) {
            console.error('Error saving delta results to server:', error);
            throw error;
        }
    },

// Get transformation results
    getTransformationResults: async (transformationId, page = 1, pageSize = 1000) => {
        const response = await fetch(
            `${API_BASE_URL}/transformation/results/${transformationId}?page=${page}&page_size=${pageSize}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch transformation results');
        }

        return response.json();
    },

    // Download transformation results
    downloadTransformationResults:
        async (transformationId, format = 'csv') => {
            const response = await fetch(
                `${API_BASE_URL}/transformation/download/${transformationId}?format=${format}`
            );

            if (!response.ok) {
                throw new Error('Failed to download transformation results');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transformation_${transformationId}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        },

    // Save transformation template
    saveTransformationTemplate:
        async (template) => {
            const response = await fetch(`${API_BASE_URL}/transformation/templates/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(template),
            });

            if (!response.ok) {
                throw new Error('Failed to save transformation template');
            }

            return response.json();
        },

    // List transformation templates
    listTransformationTemplates:
        async (category = null, search = null) => {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            if (search) params.append('search', search);

            const response = await fetch(
                `${API_BASE_URL}/transformation/templates/?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch transformation templates');
            }

            return response.json();
        },

    // Get transformation template
    getTransformationTemplate:
        async (templateId) => {
            const response = await fetch(
                `${API_BASE_URL}/transformation/templates/${templateId}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch transformation template');
            }

            return response.json();
        },

    // Get LLM assistance
    getLLMAssistance:
        async (request) => {
            const response = await fetch(`${API_BASE_URL}/transformation/assist/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error('Failed to get LLM assistance');
            }

            return response.json();
        },

    // Delete transformation results
    deleteTransformationResults:
        async (transformationId) => {
            const response = await fetch(
                `${API_BASE_URL}/transformation/results/${transformationId}`,
                {
                    method: 'DELETE',
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete')
            }
        },

    // Generate AI configuration
    generateAIConfiguration: async (requirements, sourceFiles) => {
        const response = await fetch(`${API_BASE_URL}/transformation/generate-config/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requirements,
                source_files: sourceFiles
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate AI configuration');
        }

        return response.json();
    }
}
export default transformationApiService