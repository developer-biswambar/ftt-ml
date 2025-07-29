// src/services/processManagementService.js
import {apiService} from './defaultApi.js';
import {deltaApiService} from './deltaApiService';
import {transformationApiService} from './transformationApiService.js';

class ProcessManagementService {
    constructor() {
        this.activeProcesses = new Map();
    }

    // Reconciliation processes
    async startReconciliation(config) {
        try {
            const data = await apiService.startReconciliation(config);

            if (data.success) {
                this.activeProcesses.set(data.reconciliation_id, {
                    type: 'reconciliation',
                    status: 'processing',
                    startTime: Date.now()
                });

                return {
                    success: true,
                    processId: data.reconciliation_id,
                    summary: data.summary,
                    process: {
                        reconciliation_id: data.reconciliation_id,
                        status: 'processing',
                        file_a: config.files.find(f => f.role === 'file_0')?.label || 'File A',
                        file_b: config.files.find(f => f.role === 'file_1')?.label || 'File B',
                        match_rate: data.summary.match_percentage,
                        match_confidence: 0,
                        created_at: new Date().toISOString(),
                        summary: data.summary,
                        process_type: 'reconciliation'
                    }
                };
            }

            return {success: false, error: data.message};
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    // Delta generation processes
    async startDeltaGeneration(config) {
        try {
            const data = await deltaApiService.processDeltaGeneration(config);

            if (data.success) {
                this.activeProcesses.set(data.delta_id, {
                    type: 'delta-generation',
                    status: 'processing',
                    startTime: Date.now()
                });

                return {
                    success: true,
                    processId: data.delta_id,
                    summary: data.summary,
                    process: {
                        delta_id: data.delta_id,
                        process_type: 'delta-generation',
                        status: 'processing',
                        summary: data.summary,
                        created_at: new Date().toISOString(),
                        file_a: config.files.find(f => f.role === 'file_0')?.label || 'Older File',
                        file_b: config.files.find(f => f.role === 'file_1')?.label || 'Newer File'
                    }
                };
            }

            return {success: false, error: data.errors?.join(', ') || 'Unknown error'};
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delta generation processes
    async startFileTransformation(config) {
        try {
            const data = await transformationApiService.processTransformation(config);
            console.log(data);

            if (data.success) {
                this.activeProcesses.set(data.transformation_id, {
                    type: 'file-transformation',
                    status: 'processing',
                    startTime: Date.now()
                });

                return {
                    success: true,
                    processId: data.transformation_id,
                    summary: data.summary,
                    process: {
                        delta_id: data.transformation_id,
                        process_type: 'file-transformation',
                        status: 'processing',
                        summary: data.summary,
                        created_at: new Date().toISOString(),
                        SourceFile: "FileTransformation",
                    }

                };
            }

            return {success: false, error: data.errors?.join(', ') || 'Unknown error'};
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Process monitoring
    async monitorProcess(processId, type = 'reconciliation') {
        return new Promise((resolve) => {
            // Simulate monitoring - in real app, you'd poll a status endpoint
            setTimeout(() => {
                const process = this.activeProcesses.get(processId);
                if (process) {
                    process.status = 'completed';
                    this.activeProcesses.set(processId, process);
                }
                resolve({
                    success: true,
                    status: 'completed',
                    processId
                });
            }, 3000);
        });
    }

    // Results retrieval
    //TODO
    async getAllProcessedResult() {
        try {
            // For now, return empty array as the API endpoint doesn't exist yet
            const recentResult = await deltaApiService.loadRecentResultsForSidebar(20);

            return {'success': true, 'processedFiles': recentResult};
        } catch (error) {
            console.error('Failed to load processed files:', error);
            return {success: false, processedFiles: [], error: error.message};
        }
    }

    async getDetailedResults(resultId, type = 'reconciliation') {
        try {
            if (type === 'delta-generation') {
                const deltaResults = await deltaApiService.getDeltaResults(resultId, 'all', 1, 1000);
                return {
                    success: true,
                    type: 'delta',
                    data: {
                        unchanged: deltaResults.unchanged || [],
                        amended: deltaResults.amended || [],
                        deleted: deltaResults.deleted || [],
                        newly_added: deltaResults.newly_added || []
                    }
                };
            } else {
                const reconResult = await apiService.getReconciliationResult(resultId);
                return {
                    success: true,
                    type: 'reconciliation',
                    data: {
                        matched: reconResult.matched || [],
                        unmatched_file_a: reconResult.unmatched_file_a || [],
                        unmatched_file_b: reconResult.unmatched_file_b || []
                    }
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Download operations
    async downloadResults(resultId, resultType, processType = 'reconciliation') {
        try {
            if (processType === 'delta-generation') {
                return await this._downloadDeltaResults(resultId, resultType);
            } else {
                return await this._downloadReconciliationResults(resultId, resultType);
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _downloadDeltaResults(resultId, resultType) {
        let format = 'csv';
        let apiResultType = 'all';

        switch (resultType) {
            case 'unchanged':
            case 'amended':
            case 'deleted':
            case 'newly_added':
                apiResultType = resultType;
                break;
            case 'all_changes':
                apiResultType = 'all_changes';
                break;
            case 'all_excel':
                format = 'excel';
                apiResultType = 'all';
                break;
            case 'summary_report': {
                const summary = await deltaApiService.getDeltaSummary(resultId);
                await deltaApiService.downloadDeltaSummaryReport(summary, {delta_id: resultId});
                return {success: true, message: 'Delta summary report downloaded'};
            }
        }

        const result = await deltaApiService.downloadDeltaResults(resultId, format, apiResultType);
        return {success: true, message: `Delta download completed: ${result.filename}`};
    }

    async _downloadReconciliationResults(resultId, resultType) {
        let downloadFormat = 'csv';
        let downloadResultType = 'matched';

        switch (resultType) {
            case 'matched':
            case 'unmatched_a':
            case 'unmatched_b':
                downloadResultType = resultType;
                break;
            case 'all_excel':
                downloadFormat = 'excel';
                downloadResultType = 'all';
                break;
            case 'summary_report':
                downloadFormat = 'txt';
                downloadResultType = 'summary';
                break;
        }

        const filename = `reconciliation_${resultId}_${downloadResultType}.${downloadFormat}`;
        const data = await apiService.downloadReconciliationResults(resultId, downloadFormat, downloadResultType);

        // Handle file download
        const blob = new Blob([data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return {success: true, message: `Download started: ${filename}`};
    }
}

export const processManagementService = new ProcessManagementService();