import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const deltaApiService = {

/**
 * Process Delta Generation
 * @param {Object} deltaConfig - Delta generation configuration
 * @returns {Promise<Object>} Delta generation response
 */
async processDeltaGeneration(deltaConfig) {
    try {
        console.log('Processing delta generation with config:', deltaConfig);

        const response = await api.post('/delta/process/', {
            process_type: 'delta-generation',
            process_name: 'Delta Generation',
            user_requirements: deltaConfig.user_requirements,
            files: deltaConfig.files,
            delta_config: {
                Files: deltaConfig.delta_config.Files,
                file_filters: deltaConfig.delta_config.file_filters || [],
                KeyRules: deltaConfig.delta_config.KeyRules,
                ComparisonRules: deltaConfig.delta_config.ComparisonRules || [],
                selected_columns_file_a: deltaConfig.delta_config.selected_columns_file_a,
                selected_columns_file_b: deltaConfig.delta_config.selected_columns_file_b,
                user_requirements: deltaConfig.user_requirements,
                files: deltaConfig.files
            }
        });

        return response.data;
    } catch (error) {
        console.error('Delta generation error:', error);
        throw error;
    }
},

/**
 * Get Delta Generation Results
 * @param {string} deltaId - Delta generation ID
 * @param {string} resultType - Type of results (all, unchanged, amended, deleted, newly_added, all_changes)
 * @param {number} page - Page number for pagination
 * @param {number} pageSize - Number of records per page
 * @returns {Promise<Object>} Delta results
 */
async getDeltaResults(deltaId, resultType = 'all', page = 1, pageSize = 1000) {
    try {
        const response = await api.get(`/delta/results/${deltaId}`, {
            params: {
                result_type: resultType,
                page: page,
                page_size: pageSize
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching delta results:', error);
        throw error;
    }
},

/**
 * Download Delta Generation Results
 * @param {string} deltaId - Delta generation ID
 * @param {string} format - File format (csv, excel)
 * @param {string} resultType - Type of results to download
 * @returns {Promise<Object>} Download result
 */
async downloadDeltaResults(deltaId, format = 'csv', resultType = 'all') {
    try {
        const response = await api.get(`/delta/download/${deltaId}`, {
            params: {
                format: format,
                result_type: resultType
            },
            responseType: 'blob'
        });

        // Handle file download
        const blob = response.data;
        const contentDisposition = response.headers['content-disposition'];
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
                       `delta_${deltaId}_${resultType}.${format}`;

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return { success: true, filename };
    } catch (error) {
        console.error('Error downloading delta results:', error);
        throw error;
    }
},

/**
 * Save Delta Results to Server Storage
 * @param {string} deltaId - Delta generation ID
 * @param {string} resultType - Type of results to save
 * @param {string} fileFormat - File format (csv, excel)
 * @param {string} customFilename - Custom filename (optional)
 * @param {string} description - Description (optional)
 * @returns {Promise<Object>} Save result
 */
async saveDeltaResultsToServer(deltaId, resultType = 'all', fileFormat = 'csv', customFilename = null, description = null) {
    try {
        const response = await api.post('/save-results/save', {
            result_id: deltaId,
            result_type: resultType,
            process_type: 'delta',
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

/**
 * Save Reconciliation Results to Server Storage
 * @param {string} reconciliationId - Reconciliation ID
 * @param {string} resultType - Type of results to save
 * @param {string} fileFormat - File format (csv, excel)
 * @param {string} customFilename - Custom filename (optional)
 * @param {string} description - Description (optional)
 * @returns {Promise<Object>} Save result
 */
async saveReconciliationResultsToServer(reconciliationId, resultType = 'all', fileFormat = 'csv', customFilename = null, description = null) {
    try {
        const response = await api.post('/save-results/save', {
            result_id: reconciliationId,
            result_type: resultType,
            process_type: 'reconciliation',
            file_format: fileFormat,
            custom_filename: customFilename,
            description: description
        });

        return response.data;
    } catch (error) {
        console.error('Error saving reconciliation results to server:', error);
        throw error;
    }
},

/**
 * Save File Generation Results to Server Storage
 * @param {string} generationId - File generation ID
 * @param {string} resultType - Type of results to save (usually 'all' for file generation)
 * @param {string} fileFormat - File format (csv, excel)
 * @param {string} customFilename - Custom filename (optional)
 * @param {string} description - Description (optional)
 * @returns {Promise<Object>} Save result
 */
async saveFileGenerationResultsToServer(generationId, resultType = 'all', fileFormat = 'csv', customFilename = null, description = null) {
    try {
        const response = await api.post('/save-results/save', {
            result_id: generationId,
            result_type: resultType,
            process_type: 'file_generation',
            file_format: fileFormat,
            custom_filename: customFilename,
            description: description
        });

        return response.data;
    } catch (error) {
        console.error('Error saving file generation results to server:', error);
        throw error;
    }
},

/**
 * Download File Generation Results
 * @param {string} generationId - File generation ID
 * @param {string} format - File format (csv, excel)
 * @returns {Promise<Object>} Download result
 */
async downloadFileGenerationResults(generationId, format = 'csv') {
    try {
        const response = await api.get(`/file-generator/download/${generationId}`, {
            params: {
                format: format
            },
            responseType: 'blob'
        });

        // Handle file download
        const blob = response.data;
        const contentDisposition = response.headers['content-disposition'];
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
                       `generated_file_${generationId}.${format === 'excel' ? 'xlsx' : 'csv'}`;

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return { success: true, filename };
    } catch (error) {
        console.error('Error downloading file generation results:', error);
        throw error;
    }
},

/**
 * Get File Generation Results
 * @param {string} generationId - File generation ID
 * @returns {Promise<Object>} File generation results
 */
async getFileGenerationResults(generationId) {
    try {
        const response = await api.get(`/file-generator/results/${generationId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching file generation results:', error);
        throw error;
    }
},

/**
 * Get Delta Generation Summary
 * @param {string} deltaId - Delta generation ID
 * @returns {Promise<Object>} Delta summary statistics
 */
async getDeltaSummary(deltaId) {
    try {
        const response = await api.get(`/delta/results/${deltaId}/summary`);
        return response.data;
    } catch (error) {
        console.error('Error fetching delta summary:', error);
        throw error;
    }
},

/**
 * Delete Delta Generation Results
 * @param {string} deltaId - Delta generation ID
 * @returns {Promise<Object>} Deletion confirmation
 */
async deleteDeltaResults(deltaId) {
    try {
        const response = await api.delete(`/delta/results/${deltaId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting delta results:', error);
        throw error;
    }
},

/**
 * Delete File Generation Results
 * @param {string} generationId - File generation ID
 * @returns {Promise<Object>} Deletion confirmation
 */
async deleteFileGenerationResults(generationId) {
    try {
        const response = await api.delete(`/file-generator/results/${generationId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting file generation results:', error);
        throw error;
    }
},

/**
 * Get Delta Generation Health Check
 * @returns {Promise<Object>} Service health status
 */
async getDeltaHealthCheck() {
    try {
        const response = await api.get('/delta/health');
        return response.data;
    } catch (error) {
        console.error('Error checking delta service health:', error);
        throw error;
    }
},

// =================
// DELTA HELPER METHODS
// =================

/**
 * Get Recent Results (Delta + Reconciliation + File Generation)
 * @param {number} limit - Number of recent results to fetch
 * @returns {Promise<Object>} Recent results
 */
async getRecentResults(limit = 5) {
    try {
        const response = await api.get('/recent-results/list', {
            params: { limit: limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error getting recent results:', error);
        throw error;
    }
},

/**
 * Transform recent results to processedFiles format
 * @param {Array} recentResults - Recent results from API
 * @returns {Array} Processed files format
 */
transformRecentResultsToProcessedFiles(recentResults) {
    return recentResults.map(result => {
        if (result.process_type === 'delta') {
            return {
                delta_id: result.id,
                process_type: 'delta-generation',
                status: result.status,
                created_at: result.created_at,
                file_a: result.file_a,
                file_b: result.file_b,
                summary: result.summary
            };
        } else if (result.process_type === 'reconciliation') {
            return {
                reconciliation_id: result.id,
                process_type: 'ai-reconciliation',
                status: result.status,
                created_at: result.created_at,
                file_a: result.file_a,
                file_b: result.file_b,
                summary: result.summary
            };
        } else if (result.process_type === 'file_generation') {
            return {
                generation_id: result.id,
                process_type: 'ai-file-generation',
                status: result.status,
                created_at: result.created_at,
                source_file: result.source_file,
                output_filename: result.output_filename,
                summary: result.summary,
        } }
        return result;
    });
},

/**
 * Load Recent Results for Sidebar
 * @param {number} limit - Number of results to load
 * @returns {Promise<Array>} Processed files array
 */
async loadRecentResultsForSidebar(limit = 5) {
    try {
        const recentResponse = await this.getRecentResults(limit);

        if (recentResponse.success && recentResponse.results) {
            return this.transformRecentResultsToProcessedFiles(recentResponse.results);
        }

        return [];
    } catch (error) {
        console.error('Error loading recent results for sidebar:', error);
        return [];
    }
},

/**
 * Get All Process Results (for initialization)
 * @returns {Promise<Array>} All available process results
 */
async getAllProcessResults() {
    try {
        // Get recent results from server
        const recentResults = await this.loadRecentResultsForSidebar(15);

        // You could also add logic here to get other types of results
        // For example, saved results, file generation results, etc.

        return recentResults;
    } catch (error) {
        console.error('Error getting all process results:', error);
        return [];
    }
},

/**
 * Download Delta Summary Report
 * @param {Object} summary - Delta summary data
 * @param {Object} deltaRecord - Delta record information
 */
downloadDeltaSummaryReport(summary, deltaRecord) {
    const reportContent = `Delta Generation Summary Report
Generated: ${new Date().toLocaleString()}

Files Compared:
- Older File: ${deltaRecord.file_a}
- Newer File: ${deltaRecord.file_b}

Results Summary:
- Total Records in Older File: ${summary.summary.total_records_file_a.toLocaleString()}
- Total Records in Newer File: ${summary.summary.total_records_file_b.toLocaleString()}

Delta Analysis:
- Unchanged Records: ${summary.summary.unchanged_records.toLocaleString()}
- Amended Records: ${summary.summary.amended_records.toLocaleString()}
- Deleted Records: ${summary.summary.deleted_records.toLocaleString()}
- Newly Added Records: ${summary.summary.newly_added_records.toLocaleString()}

Processing Details:
- Processing Time: ${summary.summary.processing_time_seconds}s
- Delta ID: ${deltaRecord.delta_id}
- Timestamp: ${deltaRecord.created_at}

Data Quality Metrics:
- File A Change Rate: ${((summary.summary.amended_records + summary.summary.deleted_records) / summary.summary.total_records_file_a * 100).toFixed(2)}%
- File B Change Rate: ${((summary.summary.amended_records + summary.summary.newly_added_records) / summary.summary.total_records_file_b * 100).toFixed(2)}%
- Overall Stability: ${(summary.summary.unchanged_records / Math.max(summary.summary.total_records_file_a, summary.summary.total_records_file_b) * 100).toFixed(2)}%
`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delta_summary_${deltaRecord.delta_id}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
},

/**
 * Download File Generation Summary Report
 * @param {Object} summary - File generation summary data
 * @param {Object} generationRecord - File generation record information
 */
downloadFileGenerationSummaryReport(summary, generationRecord) {
    const reportContent = `AI File Generation Summary Report
Generated: ${new Date().toLocaleString()}

Source Information:
- Source File: ${generationRecord.source_file}
- Output File: ${generationRecord.output_filename}

Generation Summary:
- Input Records: ${summary.summary.total_input_records.toLocaleString()}
- Output Records: ${summary.summary.total_output_records.toLocaleString()}
- Row Multiplication: ${summary.summary.row_multiplication_factor}x
- Columns Generated: ${summary.summary.columns_generated.join(', ')}

Processing Details:
- Rules Applied: ${summary.summary.rules_description}
- Generation ID: ${generationRecord.generation_id}
- Timestamp: ${generationRecord.created_at}

Transformation Metrics:
- Expansion Rate: ${((summary.summary.total_output_records / summary.summary.total_input_records) * 100).toFixed(2)}%
- Data Multiplication: ${summary.summary.row_multiplication_factor > 1 ? 'Enabled' : 'Disabled'}
- Output Columns: ${summary.summary.columns_generated.length}
`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file_generation_summary_${generationRecord.generation_id}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
},

/**
 * Validate Delta Configuration
 * @param {Object} deltaConfig - Delta configuration to validate
 * @returns {Object} Validation result
 */
validateDeltaConfig(deltaConfig) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!deltaConfig.files || deltaConfig.files.length !== 2) {
        errors.push('Exactly 2 files are required for delta generation');
    }

    if (!deltaConfig.delta_config?.KeyRules || deltaConfig.delta_config.KeyRules.length === 0) {
        errors.push('At least one key rule is required for delta generation');
    }

    // Check key rules
    if (deltaConfig.delta_config?.KeyRules) {
        deltaConfig.delta_config.KeyRules.forEach((rule, index) => {
            if (!rule.LeftFileColumn || !rule.RightFileColumn) {
                errors.push(`Key rule ${index + 1}: Both left and right file columns are required`);
            }
        });
    }

    // Check comparison rules (warnings only)
    if (!deltaConfig.delta_config?.ComparisonRules || deltaConfig.delta_config.ComparisonRules.length === 0) {
        warnings.push('No comparison rules defined - records with matching keys will be considered unchanged');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
},

/**
 * Process Mixed Results (Reconciliation + Delta + File Generation)
 * @param {string} resultId - Result ID (could be reconciliation_id, delta_id, or generation_id)
 * @param {Array} processedFiles - Array of processed files
 * @returns {Promise<Object>} Processed results
 */
async getProcessedResults(resultId, processedFiles) {
    try {
        // Check if this is a delta result, reconciliation result, or file generation result
        const deltaRecord = processedFiles.find(f => f.delta_id === resultId);
        const reconRecord = processedFiles.find(f => f.reconciliation_id === resultId);
        const generationRecord = processedFiles.find(f => f.generation_id === resultId);

        if (deltaRecord) {
            // Handle delta results
            const results = await this.getDeltaResults(resultId, 'all', 1, 1000);
            return {
                type: 'delta',
                record: deltaRecord,
                results: results
            };
        } else if (reconRecord) {
            // Handle reconciliation results - would need to import from apiService
            // This is a placeholder - you'd need to implement getReconciliationResult
            throw new Error('Reconciliation results handling not implemented in deltaApiService');
        } else if (generationRecord) {
            // Handle file generation results
            const results = await this.getFileGenerationResults(resultId);
            return {
                type: 'file_generation',
                record: generationRecord,
                results: results
            };
        } else {
            throw new Error('Result ID not found in processed files');
        }
    } catch (error) {
        console.error('Error getting processed results:', error);
        throw error;
    }
},

/**
 * Download Mixed Results with Save to Server Option
 * @param {string} resultId - Result ID
 * @param {string} downloadType - Download type
 * @param {Array} processedFiles - Array of processed files
 * @param {boolean} saveToServer - Whether to save to server instead of download
 * @param {string} customFilename - Custom filename for server save
 * @param {string} description - Description for server save
 * @returns {Promise<Object>} Download/Save result
 */
async downloadMixedResults(resultId, downloadType, processedFiles, saveToServer = false, customFilename = null, description = null) {
    try {
        const deltaRecord = processedFiles.find(f => f.delta_id === resultId);
        const reconRecord = processedFiles.find(f => f.reconciliation_id === resultId);
        const generationRecord = processedFiles.find(f => f.generation_id === resultId);

        if (deltaRecord) {
            // Handle delta downloads/saves
            let format = 'csv';
            let resultType = 'all';

            switch (downloadType) {
                case 'unchanged':
                    resultType = 'unchanged';
                    break;
                case 'amended':
                    resultType = 'amended';
                    break;
                case 'deleted':
                    resultType = 'deleted';
                    break;
                case 'newly_added':
                    resultType = 'newly_added';
                    break;
                case 'all_changes':
                    resultType = 'all_changes';
                    break;
                case 'all_excel':
                    format = 'excel';
                    resultType = 'all';
                    break;
                case 'summary_report':
                    // Download summary only
                    { const summary = await this.getDeltaSummary(resultId);
                    this.downloadDeltaSummaryReport(summary, deltaRecord);
                    return { success: true, type: 'summary' }; }
                default:
                    resultType = 'all';
            }

            if (saveToServer) {
                return await this.saveDeltaResultsToServer(resultId, resultType, format, customFilename, description);
            } else {
                return await this.downloadDeltaResults(resultId, format, resultType);
            }

        } else if (reconRecord) {
            // Handle reconciliation downloads/saves
            if (saveToServer) {
                return await this.saveReconciliationResultsToServer(resultId, downloadType, 'csv', customFilename, description);
            } else {
                // Would need to import reconciliation download function
                throw new Error('Reconciliation download not implemented in deltaApiService');
            }
        } else if (generationRecord) {
            // Handle file generation downloads/saves
            let format = 'csv';

            switch (downloadType) {
                case 'all_excel':
                    format = 'excel';
                    break;
                case 'summary_report':
                    // Download summary only
                    const summary = await this.getFileGenerationResults(resultId);
                    this.downloadFileGenerationSummaryReport(summary, generationRecord);
                    return { success: true, type: 'summary' };
                default:
                    format = 'csv';
            }

            if (saveToServer) {
                return await this.saveFileGenerationResultsToServer(resultId, 'all', format, customFilename, description);
            } else {
                return await this.downloadFileGenerationResults(resultId, format);
            }
        } else {
            throw new Error('Result ID not found');
        }
    } catch (error) {
        console.error('Download/Save error:', error);
        throw error;
    }
},

/**
 * List All Saved Results
 * @returns {Promise<Object>} List of saved results
 */
async listSavedResults() {
    try {
        const response = await api.get('/save-results/list');
        return response.data;
    } catch (error) {
        console.error('Error listing saved results:', error);
        throw error;
    }
},

/**
 * Delete Saved Result File
 * @param {string} savedFileId - Saved file ID
 * @returns {Promise<Object>} Deletion result
 */
async deleteSavedResult(savedFileId) {
    try {
        const response = await api.delete(`/save-results/delete/${savedFileId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting saved result:', error);
        throw error;
    }
},

/**
 * Download Saved Result File
 * @param {string} savedFileId - Saved file ID
 * @param {string} format - Download format
 * @returns {Promise<Object>} Download result
 */
async downloadSavedResult(savedFileId, format = 'csv') {
    try {
        const response = await api.get(`/save-results/download/${savedFileId}`, {
            params: { format: format },
            responseType: 'blob'
        });

        // Handle file download
        const blob = response.data;
        const contentDisposition = response.headers['content-disposition'];
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
                       `saved_result_${savedFileId}.${format}`;

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return { success: true, filename };
    } catch (error) {
        console.error('Error downloading saved result:', error);
        throw error;
    }
},

/**
 * Get unique values for a specific column in a file
 * @param {string} fileId - File ID
 * @param {string} columnName - Column name
 * @param {number} limit - Limit for unique values (default 1000)
 * @returns {Promise<Object>} Unique values response
 */
async getColumnUniqueValues(fileId, columnName, limit = 1000) {
    try {
        console.log(`Getting unique values for column ${columnName} in file ${fileId}`);

        const response = await api.get(`/files/${fileId}/columns/${encodeURIComponent(columnName)}/unique-values`, {
            params: {
                limit: limit
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching unique values:', error);
        throw error;
    }
},

};


export default deltaApiService;