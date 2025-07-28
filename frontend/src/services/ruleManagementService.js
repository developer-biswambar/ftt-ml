// src/services/ruleManagementService.js - Reconciliation Rule Management Service
import {apiService} from './defaultApi.js';

class RuleManagementService {
    constructor() {
        this.STORAGE_KEY = 'reconciliation_rules';
        this.RECENT_RULES_KEY = 'recent_reconciliation_rules';
        this.MAX_RECENT_RULES = 10;
    }

    // ===========================================
    // RULE STRUCTURE AND VALIDATION
    // ===========================================

    createRuleFromConfig(config, selectedTemplate, metadata = {}) {
        const timestamp = new Date().toISOString();

        return {
            id: this.generateRuleId(),
            name: metadata.name || `Rule ${new Date().toLocaleDateString()}`,
            description: metadata.description || '',
            category: metadata.category || 'general',
            tags: metadata.tags || [],
            template_id: selectedTemplate?.id || null,
            template_name: selectedTemplate?.name || null,
            created_at: timestamp,
            updated_at: timestamp,
            version: '1.0',

            // Core rule configuration
            rule_config: {
                Files: config.Files || [],
                ReconciliationRules: config.ReconciliationRules || [],
                selected_columns_file_a: config.selected_columns_file_a || [],
                selected_columns_file_b: config.selected_columns_file_b || [],
                user_requirements: config.user_requirements || ''
            },

            // Usage tracking
            usage_count: 0,
            last_used_at: null
        };
    }

    generateRuleId() {
        return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    validateRuleMetadata(metadata) {
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
    }

    // ===========================================
    // RULE SANITIZATION FOR REUSABILITY
    // ===========================================

    sanitizeRuleConfig(config) {
        // Remove file-specific references to make rules reusable
        const sanitized = {...config};

        // Process Files configuration - remove file-specific names but keep structure
        if (sanitized.Files) {
            sanitized.Files = sanitized.Files.map((file, index) => ({
                Name: `File${String.fromCharCode(65 + index)}`, // FileA, FileB, etc.
                Extract: file.Extract || [],
                Filter: file.Filter || []
                // Remove SheetName as it's file-specific
            }));
        }

        // Keep reconciliation rules as-is (they reference logical column names)
        // Keep other configurations but remove file-specific column selections
        // Store them as examples but not for direct application
        if (sanitized.selected_columns_file_a) {
            sanitized.example_columns_file_a = sanitized.selected_columns_file_a;
            delete sanitized.selected_columns_file_a;
        }

        if (sanitized.selected_columns_file_b) {
            sanitized.example_columns_file_b = sanitized.selected_columns_file_b;
            delete sanitized.selected_columns_file_b;
        }

        return sanitized;
    }

    adaptRuleToFiles(savedRule, fileColumns) {
        // Adapt a saved rule to work with new files
        const adaptedConfig = {...savedRule.rule_config};
        const warnings = [];
        const errors = [];

        // Restore column selections from examples if they exist in new files
        const fileKeys = Object.keys(fileColumns);

        if (savedRule.rule_config.example_columns_file_a && fileKeys[0]) {
            const availableColumns = fileColumns[fileKeys[0]] || [];
            const validColumns = savedRule.rule_config.example_columns_file_a.filter(col =>
                availableColumns.includes(col)
            );
            adaptedConfig.selected_columns_file_a = validColumns;

            const missingColumns = savedRule.rule_config.example_columns_file_a.filter(col =>
                !availableColumns.includes(col)
            );
            if (missingColumns.length > 0) {
                warnings.push(`File A: Columns not found - ${missingColumns.join(', ')}`);
            }
        }

        if (savedRule.rule_config.example_columns_file_b && fileKeys[1]) {
            const availableColumns = fileColumns[fileKeys[1]] || [];
            const validColumns = savedRule.rule_config.example_columns_file_b.filter(col =>
                availableColumns.includes(col)
            );
            adaptedConfig.selected_columns_file_b = validColumns;

            const missingColumns = savedRule.rule_config.example_columns_file_b.filter(col =>
                !availableColumns.includes(col)
            );
            if (missingColumns.length > 0) {
                warnings.push(`File B: Columns not found - ${missingColumns.join(', ')}`);
            }
        }

        // Check if extraction rules reference columns that exist
        if (adaptedConfig.Files) {
            adaptedConfig.Files.forEach((fileConfig, index) => {
                const availableColumns = Object.values(fileColumns)[index] || [];

                if (fileConfig.Extract) {
                    fileConfig.Extract.forEach(extractRule => {
                        if (extractRule.SourceColumn && !availableColumns.includes(extractRule.SourceColumn)) {
                            warnings.push(`Extraction rule in File ${String.fromCharCode(65 + index)}: Column "${extractRule.SourceColumn}" not found`);
                        }
                    });
                }

                if (fileConfig.Filter) {
                    fileConfig.Filter.forEach(filterRule => {
                        if (filterRule.ColumnName && !availableColumns.includes(filterRule.ColumnName)) {
                            warnings.push(`Filter rule in File ${String.fromCharCode(65 + index)}: Column "${filterRule.ColumnName}" not found`);
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
    }

    // ===========================================
    // LOCAL STORAGE OPERATIONS (FALLBACK)
    // ===========================================

    saveRuleLocally(rule) {
        try {
            const existingRules = this.getLocalRules();
            const updatedRules = [...existingRules, rule];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedRules));
            this.addToRecentRules(rule);
            return true;
        } catch (error) {
            console.error('Error saving rule locally:', error);
            return false;
        }
    }

    getLocalRules() {
        try {
            const rules = localStorage.getItem(this.STORAGE_KEY);
            return rules ? JSON.parse(rules) : [];
        } catch (error) {
            console.error('Error getting local rules:', error);
            return [];
        }
    }

    updateRuleLocally(ruleId, updates) {
        try {
            const existingRules = this.getLocalRules();
            const ruleIndex = existingRules.findIndex(r => r.id === ruleId);

            if (ruleIndex === -1) {
                return false;
            }

            existingRules[ruleIndex] = {
                ...existingRules[ruleIndex],
                ...updates,
                updated_at: new Date().toISOString()
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingRules));
            return true;
        } catch (error) {
            console.error('Error updating rule locally:', error);
            return false;
        }
    }

    deleteRuleLocally(ruleId) {
        try {
            const existingRules = this.getLocalRules();
            const filteredRules = existingRules.filter(r => r.id !== ruleId);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredRules));
            return true;
        } catch (error) {
            console.error('Error deleting rule locally:', error);
            return false;
        }
    }

    addToRecentRules(rule) {
        try {
            const recentRules = this.getRecentRules();
            const updatedRecent = [rule, ...recentRules.filter(r => r.id !== rule.id)]
                .slice(0, this.MAX_RECENT_RULES);
            localStorage.setItem(this.RECENT_RULES_KEY, JSON.stringify(updatedRecent));
        } catch (error) {
            console.error('Error updating recent rules:', error);
        }
    }

    getRecentRules() {
        try {
            const rules = localStorage.getItem(this.RECENT_RULES_KEY);
            return rules ? JSON.parse(rules) : [];
        } catch (error) {
            console.error('Error getting recent rules:', error);
            return [];
        }
    }

    // ===========================================
    // MAIN API OPERATIONS
    // ===========================================

    async saveRule(config, selectedTemplate, metadata) {
        try {
            // Create rule structure
            const rule = this.createRuleFromConfig(config, selectedTemplate, metadata);

            // Validate metadata
            const validation = this.validateRuleMetadata(metadata);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Sanitize config for reusability
            const sanitizedConfig = this.sanitizeRuleConfig(config);
            rule.rule_config = sanitizedConfig;

            // Try to save to backend first
            try {
                const savedRule = await apiService.saveReconciliationRule(sanitizedConfig, metadata);
                this.addToRecentRules(savedRule);
                return {success: true, rule: savedRule};
            } catch (backendError) {
                console.warn('Backend save failed, falling back to local storage:', backendError);

                // Fallback to local storage
                const localSuccess = this.saveRuleLocally(rule);
                if (localSuccess) {
                    return {success: true, rule, isLocal: true};
                } else {
                    throw new Error('Failed to save rule locally');
                }
            }
        } catch (error) {
            console.error('Error saving rule:', error);
            return {success: false, error: error.message};
        }
    }

    async loadRules(templateId = null) {
        try {
            // Try to load from backend first
            try {
                const rules = templateId
                    ? await apiService.getRulesByTemplate(templateId)
                    : await apiService.listReconciliationRules({limit: 50});

                return {success: true, rules, source: 'backend'};
            } catch (backendError) {
                console.warn('Backend load failed, falling back to local storage:', backendError);

                // Fallback to local storage
                const localRules = this.getLocalRules();
                const filteredRules = templateId
                    ? localRules.filter(r => r.template_id === templateId)
                    : localRules;

                return {success: true, rules: filteredRules, source: 'local'};
            }
        } catch (error) {
            console.error('Error loading rules:', error);
            return {success: false, error: error.message, rules: []};
        }
    }

    async updateRule(ruleId, updates) {
        try {
            // Try backend first
            try {
                const updatedRule = await apiService.updateReconciliationRule(ruleId, updates);
                return {success: true, rule: updatedRule};
            } catch (backendError) {
                console.warn('Backend update failed, trying local storage:', backendError);

                // Fallback to local storage
                const localSuccess = this.updateRuleLocally(ruleId, updates);
                if (localSuccess) {
                    const localRules = this.getLocalRules();
                    const updatedRule = localRules.find(r => r.id === ruleId);
                    return {success: true, rule: updatedRule, isLocal: true};
                } else {
                    throw new Error('Failed to update rule locally');
                }
            }
        } catch (error) {
            console.error('Error updating rule:', error);
            return {success: false, error: error.message};
        }
    }

    async deleteRule(ruleId) {
        try {
            // Try backend first
            try {
                await apiService.deleteReconciliationRule(ruleId);
                return {success: true};
            } catch (backendError) {
                console.warn('Backend delete failed, trying local storage:', backendError);

                // Fallback to local storage
                const localSuccess = this.deleteRuleLocally(ruleId);
                if (localSuccess) {
                    return {success: true, isLocal: true};
                } else {
                    throw new Error('Failed to delete rule locally');
                }
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            return {success: false, error: error.message};
        }
    }

    async markRuleAsUsed(ruleId) {
        try {
            // Try backend first
            try {
                await apiService.markRuleAsUsed(ruleId);
                return {success: true};
            } catch (backendError) {
                console.warn('Backend mark-as-used failed, trying local storage:', backendError);

                // Update locally
                const localRules = this.getLocalRules();
                const ruleIndex = localRules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    localRules[ruleIndex].usage_count = (localRules[ruleIndex].usage_count || 0) + 1;
                    localRules[ruleIndex].last_used_at = new Date().toISOString();
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localRules));
                }

                return {success: true, isLocal: true};
            }
        } catch (error) {
            console.error('Error marking rule as used:', error);
            return {success: false, error: error.message};
        }
    }

    // ===========================================
    // SEARCH AND FILTER OPERATIONS
    // ===========================================

    searchRules(rules, searchTerm, category = 'all', tags = []) {
        return rules.filter(rule => {
            const matchesSearch = !searchTerm ||
                rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                rule.description.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCategory = category === 'all' || rule.category === category;

            const matchesTags = tags.length === 0 ||
                tags.some(tag => rule.tags && rule.tags.includes(tag));

            return matchesSearch && matchesCategory && matchesTags;
        });
    }

    sortRules(rules, sortBy = 'updated_at', sortOrder = 'desc') {
        return [...rules].sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            // Handle special sorting cases
            if (sortBy === 'usage_count') {
                aValue = aValue || 0;
                bValue = bValue || 0;
            }

            if (sortBy === 'name') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    getDefaultCategories() {
        return [
            'reconciliation',
            'financial',
            'trading',
            'validation',
            'general',
            'custom'
        ];
    }

    getCommonTags() {
        return [
            'extraction',
            'filtering',
            'tolerance',
            'fuzzy-match',
            'exact-match',
            'date-matching',
            'amount-matching',
            'id-matching'
        ];
    }

    exportRules(rules) {
        try {
            const exportData = {
                version: '1.0',
                exported_at: new Date().toISOString(),
                rules: rules
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)],
                {type: 'application/json'});

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reconciliation_rules_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return {success: true};
        } catch (error) {
            console.error('Error exporting rules:', error);
            return {success: false, error: error.message};
        }
    }

    async importRules(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.rules || !Array.isArray(importData.rules)) {
                throw new Error('Invalid rule file format');
            }

            const importResults = {
                successful: 0,
                failed: 0,
                errors: []
            };

            for (const rule of importData.rules) {
                try {
                    // Regenerate ID to avoid conflicts
                    rule.id = this.generateRuleId();
                    rule.imported_at = new Date().toISOString();

                    const result = await this.saveRule(
                        rule.rule_config,
                        {id: rule.template_id, name: rule.template_name},
                        {
                            name: `${rule.name} (Imported)`,
                            description: rule.description,
                            category: rule.category,
                            tags: rule.tags
                        }
                    );

                    if (result.success) {
                        importResults.successful++;
                    } else {
                        importResults.failed++;
                        importResults.errors.push(`${rule.name}: ${result.error}`);
                    }
                } catch (error) {
                    importResults.failed++;
                    importResults.errors.push(`${rule.name}: ${error.message}`);
                }
            }

            return {success: true, results: importResults};
        } catch (error) {
            console.error('Error importing rules:', error);
            return {success: false, error: error.message};
        }
    }

    getRuleStatistics(rules) {
        const stats = {
            total: rules.length,
            by_category: {},
            by_template: {},
            total_usage: 0,
            most_used: null,
            recently_created: rules.filter(r => {
                const createdDate = new Date(r.created_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return createdDate > weekAgo;
            }).length
        };

        rules.forEach(rule => {
            // Category stats
            stats.by_category[rule.category] = (stats.by_category[rule.category] || 0) + 1;

            // Template stats
            if (rule.template_name) {
                stats.by_template[rule.template_name] = (stats.by_template[rule.template_name] || 0) + 1;
            }

            // Usage stats
            const usage = rule.usage_count || 0;
            stats.total_usage += usage;

            if (!stats.most_used || usage > (stats.most_used.usage_count || 0)) {
                stats.most_used = rule;
            }
        });

        return stats;
    }
}

// Create and export singleton instance
export const ruleManagementService = new RuleManagementService();
export default ruleManagementService;