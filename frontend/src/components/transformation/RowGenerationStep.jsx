import React, { useState } from 'react';
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
    ToggleLeft
} from 'lucide-react';

const RowGenerationStep = ({
    rules,
    onUpdate,
    sourceColumns,
    outputSchema,
    onSendMessage
}) => {
    const [expandedRules, setExpandedRules] = useState({});

    const expansionTypes = [
        { value: 'duplicate', label: 'Simple Duplication', icon: Copy },
        { value: 'fixed_expansion', label: 'Fixed Values', icon: List },
        { value: 'conditional_expansion', label: 'Conditional', icon: GitBranch },
        { value: 'expand_from_list', label: 'From List', icon: List },
        { value: 'expand_from_file', label: 'From File', icon: FileText },
        { value: 'dynamic_expansion', label: 'Dynamic', icon: Code }
    ];

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