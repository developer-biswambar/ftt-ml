import React, { useState, useEffect } from 'react';
import {
    Plus,
    Minus,
    Copy,
    Settings,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    List,
    GitBranch,
    Layers,
    Code,
    FileText,
    ToggleLeft,
    Lightbulb,
    Sparkles
} from 'lucide-react';
import { aiAssistanceService } from '../../services/aiAssistanceService';

const RowGenerationStep = ({
    rules,
    onUpdate,
    sourceColumns,
    outputSchema,
    onSendMessage
}) => {
    const [expandedRules, setExpandedRules] = useState({});
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const expansionTypes = [
        { value: 'duplicate', label: 'Simple Duplication', icon: Copy },
        { value: 'fixed_expansion', label: 'Fixed Values', icon: List },
        { value: 'conditional_expansion', label: 'Conditional', icon: GitBranch },
        { value: 'expand_from_list', label: 'From List', icon: List },
        { value: 'expand_from_file', label: 'From File', icon: FileText },
        { value: 'dynamic_expansion', label: 'Dynamic', icon: Code }
    ];

    // // AI Suggestions Effect - Only run when explicitly requested
    // useEffect(() => {
    //     // Remove automatic AI analysis - only run local heuristics by default
    //     if (Object.keys(sourceColumns).length > 0 && outputSchema.columns.length > 0) {
    //         generateLocalSuggestionsOnly();
    //     }
    // }, [sourceColumns, outputSchema.columns]);

    const generateLocalSuggestionsOnly = () => {
        const localSuggestions = generateLocalSuggestions();
        setAiSuggestions(localSuggestions);
        if (localSuggestions.length > 0) {
            onSendMessage('system', `🔍 Found ${localSuggestions.length} pattern-based suggestions. Click "Get AI Suggestions" for advanced analysis.`);
        }
    };

    const analyzeDataAndSuggestRules = async () => {
        setIsAnalyzing(true);

        try {
            // Get current local suggestions
            const localSuggestions = generateLocalSuggestions();

            // Get AI-powered suggestions
            const aiResponse = await aiAssistanceService.suggestRowGenerationRules({
                sourceColumns,
                outputSchema: {
                    columns: outputSchema.columns,
                    format: outputSchema.format
                },
                existingRules: rules,
                context: {
                    transformationType: 'row_generation',
                    industry: 'general'
                }
            });

            let suggestions = localSuggestions;

            if (aiResponse.success && aiResponse.content) {
                try {
                    // Parse AI response more carefully
                    let aiSuggestions = [];
                    const content = aiResponse.content;

                    // Check if content is a text description instead of JSON
                    if (content.includes('suggestions for row generation') || content.includes('Conditional Expansion') || !content.trim().startsWith('{')) {
                        // Handle text response by converting to our format
                        onSendMessage('system', `💬 AI provided text suggestions: ${content.substring(0, 200)}...`);

                        // Create a simple suggestion based on text content
                        if (content.toLowerCase().includes('conditional') && content.toLowerCase().includes('settlement')) {
                            aiSuggestions = [{
                                rule_type: 'conditional_expansion',
                                title: 'Settlement Status Expansion',
                                description: 'Create different rows based on settlement status',
                                confidence: 0.7,
                                reasoning: 'AI suggested conditional expansion based on settlement status',
                                auto_config: {
                                    name: 'Settlement Status Rule',
                                    type: 'expand',
                                    strategy: {
                                        type: 'conditional_expansion',
                                        config: {
                                            condition: 'Settlement_Status == "Pending"',
                                            true_expansions: [{ set_values: { 'status_type': 'pending' } }],
                                            false_expansions: [{ set_values: { 'status_type': 'completed' } }]
                                        }
                                    }
                                }
                            }];
                        }

                        if (content.toLowerCase().includes('line item') && content.toLowerCase().includes('financial')) {
                            aiSuggestions.push({
                                rule_type: 'fixed_expansion',
                                title: 'Financial Line Items',
                                description: 'Expand rows for financial line item breakdown',
                                confidence: 0.8,
                                reasoning: 'AI suggested line item expansion for financial data',
                                auto_config: {
                                    name: 'Financial Line Items',
                                    type: 'expand',
                                    strategy: {
                                        type: 'fixed_expansion',
                                        config: {
                                            expansions: [
                                                { set_values: { 'line_type': 'base_amount' } },
                                                { set_values: { 'line_type': 'tax_amount' } }
                                            ]
                                        }
                                    }
                                }
                            });
                        }
                    } else {
                        // Try to parse as JSON
                        const parsed = JSON.parse(content);

                        // Handle different response formats
                        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
                            aiSuggestions = parsed.suggestions;
                        } else if (Array.isArray(parsed)) {
                            aiSuggestions = parsed;
                        } else if (parsed.row_generation && Array.isArray(parsed.row_generation)) {
                            aiSuggestions = parsed.row_generation;
                        }
                    }

                    // Convert AI suggestions to our format
                    const formattedAISuggestions = aiSuggestions.map((s, index) => ({
                        id: `ai_${Date.now()}_${index}`,
                        type: s.rule_type || s.type || 'duplicate',
                        title: s.title || 'AI Suggestion',
                        description: s.description || 'AI-generated suggestion',
                        confidence: s.confidence || 0.8,
                        reasoning: s.reasoning || 'Generated by AI analysis',
                        source: 'ai',
                        autoConfig: s.auto_config || s.autoConfig || {
                            name: s.title || 'AI Rule',
                            type: 'expand',
                            strategy: {
                                type: s.rule_type || 'duplicate',
                                config: s.config || { count: 2 }
                            }
                        }
                    }));

                    // Merge suggestions with local ones
                    suggestions = [
                        ...formattedAISuggestions,
                        ...localSuggestions.map(s => ({ ...s, source: 'heuristic' }))
                    ];

                    onSendMessage('system', `🤖 AI Analysis Complete: Found ${formattedAISuggestions.length} AI suggestions + ${localSuggestions.length} pattern-based`);
                } catch (parseError) {
                    console.warn('Failed to parse AI suggestions:', parseError);
                    onSendMessage('system', `⚠️ AI response received but couldn't parse suggestions. Using pattern-based suggestions.`);
                    suggestions = localSuggestions.map(s => ({ ...s, source: 'heuristic' }));
                }
            } else {
                onSendMessage('system', `⚠️ AI analysis failed. Using pattern-based suggestions only.`);
                suggestions = localSuggestions.map(s => ({ ...s, source: 'heuristic' }));
            }

            setAiSuggestions(suggestions);
            setIsAnalyzing(false);

        } catch (error) {
            console.error('AI analysis error:', error);
            // Fallback to local suggestions only
            const localSuggestions = generateLocalSuggestions();
            setAiSuggestions(localSuggestions.map(s => ({ ...s, source: 'heuristic' })));
            setIsAnalyzing(false);
            onSendMessage('system', `❌ AI analysis failed: ${error.message}. Using pattern-based suggestions.`);
        }
    };

    const generateLocalSuggestions = () => {
        // Keep existing local heuristic logic as fallback
        const suggestions = [];
        const allSourceColumns = Object.values(sourceColumns).flat();
        const outputColumns = outputSchema.columns;

        // Pattern 1: Detect potential expansion scenarios
        const categoryColumns = allSourceColumns.filter(col =>
            col.toLowerCase().includes('type') ||
            col.toLowerCase().includes('category') ||
            col.toLowerCase().includes('status')
        );

        if (categoryColumns.length > 0) {
            suggestions.push({
                id: 'category_expansion',
                type: 'conditional_expansion',
                title: 'Conditional Row Expansion',
                description: `Create different rows based on ${categoryColumns[0]} values`,
                confidence: 0.8,
                reasoning: `Found category column "${categoryColumns[0]}" - consider expanding rows conditionally`,
                source: 'heuristic',
                autoConfig: {
                    name: `Expand by ${categoryColumns[0]}`,
                    type: 'expand',
                    strategy: {
                        type: 'conditional_expansion',
                        config: {
                            condition: `${categoryColumns[0]} == "SpecificValue"`,
                            true_expansions: [{ set_values: { 'expansion_type': 'primary' } }],
                            false_expansions: [{ set_values: { 'expansion_type': 'secondary' } }]
                        }
                    }
                }
            });
        }

        // Pattern 2: Detect amount/quantity columns for duplication
        const quantityColumns = allSourceColumns.filter(col =>
            col.toLowerCase().includes('quantity') ||
            col.toLowerCase().includes('count') ||
            col.toLowerCase().includes('amount')
        );

        if (quantityColumns.length > 0) {
            suggestions.push({
                id: 'quantity_duplication',
                type: 'duplicate',
                title: 'Quantity-Based Duplication',
                description: `Duplicate rows based on ${quantityColumns[0]} values`,
                confidence: 0.7,
                reasoning: `Found quantity column "${quantityColumns[0]}" - each row could be duplicated based on quantity`,
                source: 'heuristic',
                autoConfig: {
                    name: `Duplicate by ${quantityColumns[0]}`,
                    type: 'expand',
                    strategy: {
                        type: 'duplicate',
                        config: { count: 2 }
                    }
                }
            });
        }

        // Pattern 3: Detect multi-value scenarios
        const addressColumns = allSourceColumns.filter(col =>
            col.toLowerCase().includes('address') ||
            col.toLowerCase().includes('location')
        );

        if (addressColumns.length > 1) {
            suggestions.push({
                id: 'address_expansion',
                type: 'fixed_expansion',
                title: 'Address Normalization',
                description: 'Expand rows to normalize address components',
                confidence: 0.6,
                reasoning: 'Multiple address fields detected - consider expanding for address normalization',
                source: 'heuristic',
                autoConfig: {
                    name: 'Address Expansion',
                    type: 'expand',
                    strategy: {
                        type: 'fixed_expansion',
                        config: {
                            expansions: [
                                { set_values: { 'address_type': 'billing' } },
                                { set_values: { 'address_type': 'shipping' } }
                            ]
                        }
                    }
                }
            });
        }

        // Pattern 4: Detect tax/financial scenarios
        const taxColumns = allSourceColumns.filter(col =>
            col.toLowerCase().includes('tax') ||
            col.toLowerCase().includes('vat') ||
            col.toLowerCase().includes('rate')
        );

        if (taxColumns.length > 0 && outputColumns.some(col => col.name.toLowerCase().includes('line'))) {
            suggestions.push({
                id: 'tax_line_expansion',
                type: 'fixed_expansion',
                title: 'Tax Line Item Expansion',
                description: 'Create separate line items for tax calculations',
                confidence: 0.9,
                reasoning: 'Tax columns and line item structure detected - expand for detailed tax reporting',
                source: 'heuristic',
                autoConfig: {
                    name: 'Tax Line Items',
                    type: 'expand',
                    strategy: {
                        type: 'fixed_expansion',
                        config: {
                            expansions: [
                                { set_values: { 'line_type': 'base_amount', 'tax_applicable': 'false' } },
                                { set_values: { 'line_type': 'tax_amount', 'tax_applicable': 'true' } }
                            ]
                        }
                    }
                }
            });
        }

        // Pattern 5: Detect country/region columns for localization
        const locationColumns = allSourceColumns.filter(col =>
            col.toLowerCase().includes('country') ||
            col.toLowerCase().includes('region') ||
            col.toLowerCase().includes('locale')
        );

        if (locationColumns.length > 0) {
            suggestions.push({
                id: 'localization_expansion',
                type: 'expand_from_list',
                title: 'Localization Expansion',
                description: 'Expand for multiple countries/regions',
                confidence: 0.6,
                reasoning: `Found location column "${locationColumns[0]}" - consider expanding for localization`,
                source: 'heuristic',
                autoConfig: {
                    name: 'Country Expansion',
                    type: 'expand',
                    strategy: {
                        type: 'expand_from_list',
                        config: {
                            target_column: 'country_code',
                            values: ['US', 'CA', 'UK', 'DE', 'FR']
                        }
                    }
                }
            });
        }

        return suggestions;
    };

    const applySuggestion = (suggestion) => {
        const newRule = {
            id: `rule_${Date.now()}`,
            ...suggestion.autoConfig,
            enabled: true,
            priority: rules.length
        };

        onUpdate([...rules, newRule]);
        setExpandedRules({ ...expandedRules, [newRule.id]: true });

        // Remove applied suggestion
        setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

        onSendMessage('system', `✅ Applied AI suggestion: ${suggestion.title}`);
    };

    const dismissSuggestion = (suggestionId) => {
        setAiSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    };

    const addRule = () => {
        const newRule = {
            id: `rule_${Date.now()}`,
            name: 'New Rule',
            type: 'expand',
            enabled: true,
            priority: rules.length,
            strategy: {
                type: 'duplicate',
                config: { count: 2 }
            }
        };

        onUpdate([...rules, newRule]);
        setExpandedRules({ ...expandedRules, [newRule.id]: true });
    };

    const updateRule = (index, updates) => {
        const updatedRules = [...rules];
        updatedRules[index] = { ...updatedRules[index], ...updates };
        onUpdate(updatedRules);
    };

    const updateStrategy = (index, strategyUpdates) => {
        const updatedRules = [...rules];
        updatedRules[index] = {
            ...updatedRules[index],
            strategy: {
                ...updatedRules[index].strategy,
                ...strategyUpdates
            }
        };
        onUpdate(updatedRules);
    };

    const removeRule = (index) => {
        const updatedRules = rules.filter((_, i) => i !== index);
        // Update priorities
        updatedRules.forEach((rule, i) => {
            rule.priority = i;
        });
        onUpdate(updatedRules);
    };

    const moveRule = (index, direction) => {
        const updatedRules = [...rules];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex >= 0 && newIndex < updatedRules.length) {
            // Swap rules
            [updatedRules[index], updatedRules[newIndex]] = [updatedRules[newIndex], updatedRules[index]];
            // Update priorities
            updatedRules[index].priority = index;
            updatedRules[newIndex].priority = newIndex;
            onUpdate(updatedRules);
        }
    };

    const toggleExpanded = (ruleId) => {
        setExpandedRules(prev => ({
            ...prev,
            [ruleId]: !prev[ruleId]
        }));
    };

    const renderStrategyConfig = (rule, index) => {
        const { type, config } = rule.strategy;

        switch (type) {
            case 'duplicate':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Number of Copies
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={config.count || 2}
                                onChange={(e) => updateStrategy(index, {
                                    config: { ...config, count: parseInt(e.target.value) || 1 }
                                })}
                                className="w-32 px-3 py-2 border border-gray-300 rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Each source row will be duplicated this many times
                            </p>
                        </div>
                    </div>
                );

            case 'fixed_expansion':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Expansion Values
                            </label>
                            <div className="space-y-2">
                                {(config.expansions || []).map((expansion, expIndex) => (
                                    <div key={expIndex} className="flex items-center space-x-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            {Object.entries(expansion.set_values || {}).map(([key, value]) => (
                                                <div key={key} className="flex items-center space-x-1">
                                                    <input
                                                        type="text"
                                                        value={key}
                                                        onChange={(e) => {
                                                            const newExpansions = [...(config.expansions || [])];
                                                            const newValues = { ...newExpansions[expIndex].set_values };
                                                            delete newValues[key];
                                                            newValues[e.target.value] = value;
                                                            newExpansions[expIndex] = { set_values: newValues };
                                                            updateStrategy(index, { config: { ...config, expansions: newExpansions } });
                                                        }}
                                                        placeholder="Column"
                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                    <span>=</span>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => {
                                                            const newExpansions = [...(config.expansions || [])];
                                                            newExpansions[expIndex].set_values[key] = e.target.value;
                                                            updateStrategy(index, { config: { ...config, expansions: newExpansions } });
                                                        }}
                                                        placeholder="Value"
                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newExpansions = [...(config.expansions || [])];
                                                const currentValues = newExpansions[expIndex].set_values || {};
                                                newExpansions[expIndex].set_values = { ...currentValues, '': '' };
                                                updateStrategy(index, { config: { ...config, expansions: newExpansions } });
                                            }}
                                            className="p-1 text-blue-500 hover:text-blue-700"
                                            title="Add value"
                                        >
                                            <Plus size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newExpansions = config.expansions.filter((_, i) => i !== expIndex);
                                                updateStrategy(index, { config: { ...config, expansions: newExpansions } });
                                            }}
                                            className="p-1 text-red-500 hover:text-red-700"
                                            title="Remove expansion"
                                        >
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    const newExpansions = [...(config.expansions || []), { set_values: { '': '' } }];
                                    updateStrategy(index, { config: { ...config, expansions: newExpansions } });
                                }}
                                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                                Add Expansion Row
                            </button>
                        </div>
                    </div>
                );

            case 'conditional_expansion':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Condition
                            </label>
                            <input
                                type="text"
                                value={config.condition || ''}
                                onChange={(e) => updateStrategy(index, {
                                    config: { ...config, condition: e.target.value }
                                })}
                                placeholder="e.g., Amount > 1000"
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                When True - Create These Rows:
                            </label>
                            <div className="space-y-2 pl-4">
                                {(config.true_expansions || []).map((expansion, expIndex) => (
                                    <div key={expIndex} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={Object.entries(expansion.set_values || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                                            onChange={(e) => {
                                                const newExpansions = [...(config.true_expansions || [])];
                                                const values = {};
                                                e.target.value.split(',').forEach(pair => {
                                                    const [key, value] = pair.trim().split('=');
                                                    if (key) values[key] = value || '';
                                                });
                                                newExpansions[expIndex] = { set_values: values };
                                                updateStrategy(index, { config: { ...config, true_expansions: newExpansions } });
                                            }}
                                            placeholder="key=value, key2=value2"
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                        <button
                                            onClick={() => {
                                                const newExpansions = config.true_expansions.filter((_, i) => i !== expIndex);
                                                updateStrategy(index, { config: { ...config, true_expansions: newExpansions } });
                                            }}
                                            className="p-1 text-red-500 hover:text-red-700"
                                        >
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const newExpansions = [...(config.true_expansions || []), { set_values: {} }];
                                        updateStrategy(index, { config: { ...config, true_expansions: newExpansions } });
                                    }}
                                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                                >
                                    Add True Row
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                When False - Create These Rows:
                            </label>
                            <div className="space-y-2 pl-4">
                                {(config.false_expansions || []).map((expansion, expIndex) => (
                                    <div key={expIndex} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={Object.entries(expansion.set_values || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                                            onChange={(e) => {
                                                const newExpansions = [...(config.false_expansions || [])];
                                                const values = {};
                                                e.target.value.split(',').forEach(pair => {
                                                    const [key, value] = pair.trim().split('=');
                                                    if (key) values[key] = value || '';
                                                });
                                                newExpansions[expIndex] = { set_values: values };
                                                updateStrategy(index, { config: { ...config, false_expansions: newExpansions } });
                                            }}
                                            placeholder="key=value, key2=value2"
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                        <button
                                            onClick={() => {
                                                const newExpansions = config.false_expansions.filter((_, i) => i !== expIndex);
                                                updateStrategy(index, { config: { ...config, false_expansions: newExpansions } });
                                            }}
                                            className="p-1 text-red-500 hover:text-red-700"
                                        >
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const newExpansions = [...(config.false_expansions || []), { set_values: {} }];
                                        updateStrategy(index, { config: { ...config, false_expansions: newExpansions } });
                                    }}
                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >
                                    Add False Row
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'expand_from_list':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Target Column Name
                            </label>
                            <input
                                type="text"
                                value={config.target_column || ''}
                                onChange={(e) => updateStrategy(index, {
                                    config: { ...config, target_column: e.target.value }
                                })}
                                placeholder="e.g., Country"
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Values (one per line)
                            </label>
                            <textarea
                                value={(config.values || []).join('\n')}
                                onChange={(e) => updateStrategy(index, {
                                    config: { ...config, values: e.target.value.split('\n').filter(v => v.trim()) }
                                })}
                                placeholder="Italy&#10;France&#10;Germany"
                                className="w-full h-32 px-3 py-2 border border-gray-300 rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Each source row will be expanded once for each value
                            </p>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="text-sm text-gray-500">
                        Configuration for {type} coming soon...
                    </div>
                );
        }
    };

    const getTypeIcon = (type) => {
        const typeConfig = expansionTypes.find(t => t.value === type);
        return typeConfig ? typeConfig.icon : Copy;
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Row Generation Rules</h3>
                <p className="text-sm text-gray-600">
                    Define how source rows should be expanded or multiplied to create output rows.
                    Rules are applied in priority order.
                </p>
            </div>

            {/* AI Suggestions Section */}
            {(aiSuggestions.length > 0 || isAnalyzing) && showSuggestions && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <Sparkles size={20} className="text-purple-600" />
                            <span className="font-medium text-purple-800">AI-Powered Suggestions</span>
                            {isAnalyzing && (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={analyzeDataAndSuggestRules}
                                disabled={isAnalyzing}
                                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Get AI Suggestions'}
                            </button>
                            <button
                                onClick={() => setShowSuggestions(false)}
                                className="text-purple-600 hover:text-purple-800 text-sm"
                            >
                                Hide
                            </button>
                        </div>
                    </div>

                    {isAnalyzing ? (
                        <p className="text-sm text-purple-700">🤖 Analyzing your data patterns for intelligent rule suggestions...</p>
                    ) : aiSuggestions.length > 0 ? (
                        <div className="space-y-3">
                            {aiSuggestions.map(suggestion => (
                                <div key={suggestion.id} className="bg-white border border-purple-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Lightbulb size={16} className="text-purple-600" />
                                                <span className="font-medium text-gray-800">{suggestion.title}</span>
                                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                                    {Math.round(suggestion.confidence * 100)}% confidence
                                                </span>
                                                {suggestion.source === 'ai' && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                        AI-Powered
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">{suggestion.description}</p>
                                            <p className="text-xs text-gray-500 italic">{suggestion.reasoning}</p>
                                        </div>
                                        <div className="flex space-x-2 ml-3">
                                            <button
                                                onClick={() => applySuggestion(suggestion)}
                                                className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => dismissSuggestion(suggestion.id)}
                                                className="px-2 py-1 text-gray-400 hover:text-gray-600 text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-purple-700 mb-2">No suggestions available yet.</p>
                            <button
                                onClick={analyzeDataAndSuggestRules}
                                disabled={isAnalyzing}
                                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                            >
                                Get AI Suggestions
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Show Suggestions Button (when hidden) */}
            {!showSuggestions && (aiSuggestions.length > 0 || !isAnalyzing) && (
                <button
                    onClick={() => setShowSuggestions(true)}
                    className="flex items-center space-x-2 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                >
                    <Sparkles size={16} />
                    <span>Show AI Suggestions ({aiSuggestions.length})</span>
                </button>
            )}

            {/* Add Rule Button */}
            <div className="flex justify-between items-center">
                <button
                    onClick={addRule}
                    className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <Plus size={16} />
                    <span>Add Generation Rule</span>
                </button>

                {rules.length > 0 && (
                    <div className="text-sm text-gray-600">
                        {rules.filter(r => r.enabled).length} of {rules.length} rules active
                    </div>
                )}
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Layers size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-4">No row generation rules defined</p>
                    <p className="text-sm text-gray-500 mb-4">
                        Without rules, each source row will create exactly one output row
                    </p>
                    <button
                        onClick={addRule}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Create Your First Rule
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map((rule, index) => {
                        const TypeIcon = getTypeIcon(rule.strategy.type);
                        const isExpanded = expandedRules[rule.id];

                        return (
                            <div key={rule.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <button
                                            onClick={() => toggleExpanded(rule.id)}
                                            className="p-1 hover:bg-gray-200 rounded"
                                        >
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>

                                        <TypeIcon size={20} className="text-gray-600" />

                                        <input
                                            type="text"
                                            value={rule.name}
                                            onChange={(e) => updateRule(index, { name: e.target.value })}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                                        />

                                        <select
                                            value={rule.strategy.type}
                                            onChange={(e) => updateRule(index, {
                                                strategy: {
                                                    type: e.target.value,
                                                    config: {}
                                                }
                                            })}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            {expansionTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>

                                        <label className="flex items-center space-x-1 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={rule.enabled}
                                                onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                                                className="rounded border-gray-300"
                                            />
                                            <span>Enabled</span>
                                        </label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500">Priority: {rule.priority + 1}</span>

                                        <button
                                            onClick={() => moveRule(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>

                                        <button
                                            onClick={() => moveRule(index, 'down')}
                                            disabled={index === rules.length - 1}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>

                                        <button
                                            onClick={() => removeRule(index)}
                                            className="p-1 text-red-400 hover:text-red-600"
                                            title="Remove rule"
                                        >
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t border-gray-200">
                                        {rule.condition && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Apply Rule When
                                                </label>
                                                <input
                                                    type="text"
                                                    value={rule.condition}
                                                    onChange={(e) => updateRule(index, { condition: e.target.value })}
                                                    placeholder="e.g., Type == 'Complex'"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                                />
                                            </div>
                                        )}

                                        {renderStrategyConfig(rule, index)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How Row Generation Works:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Rules are applied to each source row in priority order</li>
                            <li>The first matching rule (based on condition) is applied</li>
                            <li>If no rules match, the source row is passed through unchanged</li>
                            <li>Disable rules temporarily without deleting them</li>
                            <li>Generated rows inherit all source columns plus any new values</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RowGenerationStep;