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

        const response = await fetch(`${this.baseURL}/delta/process/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                process_type: 'delta-generation',
                process_name: 'Delta Generation',
                user_requirements: deltaConfig.user_requirements,
                files: deltaConfig.files,
                delta_config: {
                    Files: deltaConfig.delta_config.Files,
                    KeyRules: deltaConfig.delta_config.KeyRules,
                    ComparisonRules: deltaConfig.delta_config.ComparisonRules || [],
                    selected_columns_file_a: deltaConfig.delta_config.selected_columns_file_a,
                    selected_columns_file_b: deltaConfig.delta_config.selected_columns_file_b,
                    user_requirements: deltaConfig.user_requirements,
                    files: deltaConfig.files
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
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
        const response = await fetch(
            `${this.baseURL}/delta/results/${deltaId}?result_type=${resultType}&page=${page}&page_size=${pageSize}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
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
        const response = await fetch(
            `${this.baseURL}/delta/download/${deltaId}?format=${format}&result_type=${resultType}`,
            {
                method: 'GET'
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle file download
        const blob = await response.blob();
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ||
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
}
,
/**
 * Get Delta Generation Summary
 * @param {string} deltaId - Delta generation ID
 * @returns {Promise<Object>} Delta summary statistics
 */
async getDeltaSummary(deltaId) {
    try {
        const response = await fetch(`${this.baseURL}/delta/results/${deltaId}/summary`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching delta summary:', error);
        throw error;
    }
}
,
/**
 * Delete Delta Generation Results
 * @param {string} deltaId - Delta generation ID
 * @returns {Promise<Object>} Deletion confirmation
 */
async deleteDeltaResults(deltaId) {
    try {
        const response = await fetch(`${this.baseURL}/delta/results/${deltaId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting delta results:', error);
        throw error;
    }
},

/**
 * Get Delta Generation Health Check
 * @returns {Promise<Object>} Service health status
 */
async getDeltaHealthCheck() {
    try {
        const response = await fetch(`${this.baseURL}/delta/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking delta service health:', error);
        throw error;
    }
}
,
// =================
// DELTA HELPER METHODS
// =================

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
 * Process Mixed Results (Reconciliation + Delta)
 * @param {string} resultId - Result ID (could be reconciliation_id or delta_id)
 * @param {Array} processedFiles - Array of processed files
 * @returns {Promise<Object>} Processed results
 */
async getProcessedResults(resultId, processedFiles) {
    try {
        // Check if this is a delta result or reconciliation result
        const deltaRecord = processedFiles.find(f => f.delta_id === resultId);
        const reconRecord = processedFiles.find(f => f.reconciliation_id === resultId);

        if (deltaRecord) {
            // Handle delta results
            const results = await this.getDeltaResults(resultId, 'all', 1, 1000);
            return {
                type: 'delta',
                record: deltaRecord,
                results: results
            };
        } else if (reconRecord) {
            // Handle reconciliation results
            const results = await this.getReconciliationResult(resultId);
            return {
                type: 'reconciliation',
                record: reconRecord,
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
 * Download Mixed Results
 * @param {string} resultId - Result ID
 * @param {string} downloadType - Download type
 * @param {Array} processedFiles - Array of processed files
 * @returns {Promise<Object>} Download result
 */
async downloadMixedResults(resultId, downloadType, processedFiles) {
    try {
        const deltaRecord = processedFiles.find(f => f.delta_id === resultId);
        const reconRecord = processedFiles.find(f => f.reconciliation_id === resultId);

        if (deltaRecord) {
            // Handle delta downloads
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

            return await this.downloadDeltaResults(resultId, format, resultType);

        } else if (reconRecord) {
            // Handle reconciliation downloads
            return await this.downloadReconciliationResults(resultId, 'csv', downloadType);
        } else {
            throw new Error('Result ID not found');
        }
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}
}

export default deltaApiService;