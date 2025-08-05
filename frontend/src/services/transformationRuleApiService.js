// src/services/transformationRuleApiService.js - Transformation rule management API service
import { apiService } from './defaultApi.js';

export const transformationRuleApiService = {
    // Save a transformation rule
    saveTransformationRule: async (ruleConfig, ruleMetadata) => {
        try {
            const response = await fetch('http://localhost:8000/rules/transformation/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    metadata: ruleMetadata,
                    rule_config: ruleConfig
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to save transformation rule');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving transformation rule:', error);
            throw error;
        }
    },

    // Update an existing transformation rule
    updateTransformationRule: async (ruleId, ruleConfig, ruleMetadata) => {
        try {
            const response = await fetch(`http://localhost:8000/rules/transformation/${ruleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    metadata: ruleMetadata,
                    rule_config: ruleConfig
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update transformation rule');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating transformation rule:', error);
            throw error;
        }
    },

    // List transformation rules
    listTransformationRules: async (options = {}) => {
        try {
            const params = new URLSearchParams();
            if (options.category) params.append('category', options.category);
            if (options.template_id) params.append('template_id', options.template_id);
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.offset) params.append('offset', options.offset.toString());

            const response = await fetch(`http://localhost:8000/rules/transformation/list?${params.toString()}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to list transformation rules');
            }

            return await response.json();
        } catch (error) {
            console.error('Error listing transformation rules:', error);
            throw error;
        }
    },

    // Get transformation rules by template
    getTransformationRulesByTemplate: async (templateId) => {
        try {
            const response = await fetch(`http://localhost:8000/rules/transformation/template/${templateId}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get transformation rules by template');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting transformation rules by template:', error);
            throw error;
        }
    },

    // Get a specific transformation rule
    getTransformationRule: async (ruleId) => {
        try {
            const response = await fetch(`http://localhost:8000/rules/transformation/${ruleId}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get transformation rule');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting transformation rule:', error);
            throw error;
        }
    },

    // Delete a transformation rule
    deleteTransformationRule: async (ruleId) => {
        try {
            const response = await fetch(`http://localhost:8000/rules/transformation/${ruleId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete transformation rule');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting transformation rule:', error);
            throw error;
        }
    },

    // Mark transformation rule as used
    markTransformationRuleAsUsed: async (ruleId) => {
        try {
            const response = await fetch(`http://localhost:8000/rules/transformation/${ruleId}/use`, {
                method: 'POST',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to mark transformation rule as used');
            }

            return await response.json();
        } catch (error) {
            console.error('Error marking transformation rule as used:', error);
            throw error;
        }
    },

    // Search transformation rules
    searchTransformationRules: async (filters) => {
        try {
            const response = await fetch('http://localhost:8000/rules/transformation/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filters),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to search transformation rules');
            }

            return await response.json();
        } catch (error) {
            console.error('Error searching transformation rules:', error);
            throw error;
        }
    },

    // Validate transformation rule metadata
    validateTransformationRuleMetadata: (metadata) => {
        const errors = [];

        if (!metadata.name || metadata.name.trim() === '') {
            errors.push('Rule name is required');
        }

        if (metadata.name && metadata.name.length > 100) {
            errors.push('Rule name must be less than 100 characters');
        }

        if (metadata.description && metadata.description.length > 500) {
            errors.push('Rule description must be less than 500 characters');
        }

        if (metadata.category && !['transformation', 'financial', 'trading', 'data_processing', 'validation', 'custom'].includes(metadata.category)) {
            errors.push('Invalid category selected');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    // Create transformation rule from current config
    createTransformationRuleFromConfig: (currentConfig, selectedTemplate, metadata) => {
        // Create rule configuration
        const ruleConfig = {
            name: metadata.name,
            description: metadata.description,
            source_files: currentConfig.source_files || [],
            row_generation_rules: currentConfig.row_generation_rules || [],
            merge_datasets: currentConfig.merge_datasets || false,
            validation_rules: currentConfig.validation_rules || []
        };

        // Create rule metadata
        const ruleMetadata = {
            name: metadata.name,
            description: metadata.description || '',
            category: metadata.category || 'transformation',
            tags: metadata.tags || [],
            template_id: selectedTemplate?.id || null,
            template_name: selectedTemplate?.name || null
        };

        return { ruleConfig, ruleMetadata };
    },

    // Adapt transformation rule to current files
    adaptTransformationRuleToFiles: (rule, fileColumns) => {
        const adaptedConfig = { ...rule.rule_config };
        const warnings = [];
        const errors = [];

        try {
            // Update source files with current file information
            if (adaptedConfig.source_files && fileColumns) {
                const fileIds = Object.keys(fileColumns);
                
                if (fileIds.length === 0) {
                    errors.push('No files available to apply rule to');
                } else {
                    // Use the first available file for single-file transformation
                    adaptedConfig.source_files = [{
                        file_id: fileIds[0],
                        alias: fileIds[0],
                        purpose: 'Primary data source'
                    }];
                }
            }

            // Validate column references in row generation rules
            if (adaptedConfig.row_generation_rules && fileColumns) {
                const availableColumns = Object.values(fileColumns).flat();
                
                adaptedConfig.row_generation_rules.forEach((rule, ruleIndex) => {
                    if (rule.output_columns) {
                        rule.output_columns.forEach((col, colIndex) => {
                            // Check direct mapping columns
                            if (col.mapping_type === 'direct' && col.source_column) {
                                if (!availableColumns.includes(col.source_column)) {
                                    warnings.push(`Rule ${ruleIndex + 1}, Column ${colIndex + 1}: Source column '${col.source_column}' not found in current files`);
                                }
                            }
                            
                            // Check dynamic condition columns
                            if (col.mapping_type === 'dynamic' && col.dynamic_conditions) {
                                col.dynamic_conditions.forEach((condition, condIndex) => {
                                    if (condition.condition_column && !availableColumns.includes(condition.condition_column)) {
                                        warnings.push(`Rule ${ruleIndex + 1}, Column ${colIndex + 1}, Condition ${condIndex + 1}: Condition column '${condition.condition_column}' not found in current files`);
                                    }
                                });
                            }
                        });
                    }
                });
            }

            // Use example name and description if available
            if (rule.rule_config.example_name) {
                adaptedConfig.name = rule.rule_config.example_name;
            }
            if (rule.rule_config.example_description) {
                adaptedConfig.description = rule.rule_config.example_description;
            }

        } catch (error) {
            errors.push(`Error adapting rule: ${error.message}`);
        }

        return {
            adaptedConfig,
            warnings,
            errors
        };
    }
};