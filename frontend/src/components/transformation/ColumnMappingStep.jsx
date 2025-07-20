import React, { useState, useEffect } from 'react';
import {
    Link,
    Wand2,
    Code,
    Hash,
    Type,
    Calendar,
    ToggleLeft,
    Settings,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Search,
    Database,
    FileText,
    Zap
} from 'lucide-react';

const ColumnMappingStep = ({
    mappings,
    onUpdate,
    sourceColumns,
    outputSchema,
    rowGenerationRules,
    onSendMessage
}) => {
    const [expandedMappings, setExpandedMappings] = useState({});
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Initialize mappings for all output columns
    useEffect(() => {
        const existingMappingIds = mappings.map(m => m.target_column);
        const newMappings = [...mappings];

        outputSchema.columns.forEach(col => {
            if (!existingMappingIds.includes(col.id)) {
                newMappings.push({
                    id: `map_${Date.now()}_${col.id}`,
                    target_column: col.id,
                    mapping_type: 'static',
                    enabled: true,
                    transformation: {
                        type: 'static',
                        config: { value: '' }
                    }
                });
            }
        });

        if (newMappings.length !== mappings.length) {
            onUpdate(newMappings);
        }
    }, [outputSchema.columns]);

    const mappingTypes = [
        { value: 'direct', label: 'Direct Mapping', icon: Link },
        { value: 'static', label: 'Static Value', icon: Type },
        { value: 'expression', label: 'Expression', icon: Code },
        { value: 'conditional', label: 'Conditional', icon: ToggleLeft },
        { value: 'sequence', label: 'Sequential', icon: Hash },
        { value: 'lookup', label: 'Lookup', icon: Search },
        { value: 'custom_function', label: 'Custom Function', icon: Function }
    ];

    const updateMapping = (index, updates) => {
        const updatedMappings = [...mappings];
        updatedMappings[index] = { ...updatedMappings[index], ...updates };
        onUpdate(updatedMappings);
    };

    const toggleExpanded = (mappingId) => {
        setExpandedMappings(prev => ({
            ...prev,
            [mappingId]: !prev[mappingId]
        }));
    };

    const getAllSourceColumns = () => {
        const columns = [];
        Object.entries(sourceColumns).forEach(([alias, cols]) => {
            cols.forEach(col => {
                columns.push({
                    value: `${alias}.${col}`,
                    label: `${alias}.${col}`,
                    alias,
                    column: col
                });
            });
        });

        // Add columns from row generation rules
        rowGenerationRules.forEach(rule => {
            if (rule.strategy.type === 'fixed_expansion') {
                const expansions = rule.strategy.config.expansions || [];
                expansions.forEach(exp => {
                    Object.keys(exp.set_values || {}).forEach(key => {
                        if (!columns.find(c => c.column === key)) {
                            columns.push({
                                value: key,
                                label: `${key} (generated)`,
                                alias: '_generated',
                                column: key
                            });
                        }
                    });
                });
            }
        });

        return columns;
    };

    const suggestMappings = async () => {
        onSendMessage('system', '🤖 Analyzing columns for auto-mapping suggestions...');

        // Simple heuristic matching
        const suggestions = [];
        const sourceColumnsList = getAllSourceColumns();

        outputSchema.columns.forEach((targetCol, index) => {
            const targetName = targetCol.name.toLowerCase();
            let bestMatch = null;
            let bestScore = 0;

            sourceColumnsList.forEach(sourceCol => {
                const sourceName = sourceCol.column.toLowerCase();

                // Exact match
                if (sourceName === targetName) {
                    bestMatch = sourceCol.value;
                    bestScore = 1.0;
                }
                // Contains match
                else if (sourceName.includes(targetName) || targetName.includes(sourceName)) {
                    if (bestScore < 0.7) {
                        bestMatch = sourceCol.value;
                        bestScore = 0.7;
                    }
                }
                // Similar words
                else if (areSimilar(sourceName, targetName)) {
                    if (bestScore < 0.5) {
                        bestMatch = sourceCol.value;
                        bestScore = 0.5;
                    }
                }
            });

            if (bestMatch && bestScore > 0.5) {
                updateMapping(index, {
                    mapping_type: 'direct',
                    source: bestMatch,
                    transformation: null
                });
                suggestions.push(`${targetCol.name} → ${bestMatch} (confidence: ${Math.round(bestScore * 100)}%)`);
            }
        });

        if (suggestions.length > 0) {
            onSendMessage('system', `✅ Auto-mapped ${suggestions.length} columns:\n${suggestions.join('\n')}`);
        } else {
            onSendMessage('system', '⚠️ No confident matches found. Please map columns manually.');
        }
    };

    const areSimilar = (str1, str2) => {
        // Simple similarity check - could be enhanced
        const commonPrefixes = ['is_', 'has_', 'total_', 'num_', 'count_'];
        const commonSuffixes = ['_id', '_date', '_time', '_amount', '_count'];

        for (const prefix of commonPrefixes) {
            if (str1.startsWith(prefix) && str2.startsWith(prefix)) return true;
        }

        for (const suffix of commonSuffixes) {
            if (str1.endsWith(suffix) && str2.endsWith(suffix)) return true;
        }

        return false;
    };

    const renderMappingConfig = (mapping, index) => {
        const allColumns = getAllSourceColumns();

        switch (mapping.mapping_type) {
            case 'direct':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Source Column
                            </label>
                            <select
                                value={mapping.source || ''}
                                onChange={(e) => updateMapping(index, { source: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            >
                                <option value="">Select source column...</option>
                                {allColumns.map(col => (
                                    <option key={col.value} value={col.value}>
                                        {col.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

            case 'static':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Static Value
                            </label>
                            <input
                                type="text"
                                value={mapping.transformation?.config?.value || ''}
                                onChange={(e) => updateMapping(index, {
                                    transformation: {
                                        type: 'static',
                                        config: { value: e.target.value }
                                    }
                                })}
                                placeholder="Enter static value..."
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                        </div>
                    </div>
                );

            case 'expression':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Expression Formula
                            </label>
                            <input
                                type="text"
                                value={mapping.transformation?.config?.formula || ''}
                                onChange={(e) => updateMapping(index, {
                                    transformation: {
                                        type: 'expression',
                                        config: {
                                            ...mapping.transformation?.config,
                                            formula: e.target.value
                                        }
                                    }
                                })}
                                placeholder="e.g., ABS({Amount}) * 1.2"
                                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Use {'{column_name}'} to reference values. Supports: +, -, *, /, ABS, ROUND, MIN, MAX
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Variable Mappings
                            </label>
                            <div className="space-y-2">
                                {Object.entries(mapping.transformation?.config?.variables || {}).map(([varName, varSource]) => (
                                    <div key={varName} className="flex items-center space-x-2">
                                        <span className="w-24 text-sm font-mono">{`{${varName}}`}</span>
                                        <select
                                            value={varSource}
                                            onChange={(e) => {
                                                const variables = { ...mapping.transformation?.config?.variables };
                                                variables[varName] = e.target.value;
                                                updateMapping(index, {
                                                    transformation: {
                                                        ...mapping.transformation,
                                                        config: {
                                                            ...mapping.transformation?.config,
                                                            variables
                                                        }
                                                    }
                                                });
                                            }}
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">Select source...</option>
                                            {allColumns.map(col => (
                                                <option key={col.value} value={col.value}>
                                                    {col.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    // Extract variables from formula
                                    const formula = mapping.transformation?.config?.formula || '';
                                    const matches = formula.match(/\{(\w+)\}/g) || [];
                                    const variables = {};
                                    matches.forEach(match => {
                                        const varName = match.slice(1, -1);
                                        variables[varName] = mapping.transformation?.config?.variables?.[varName] || '';
                                    });
                                    updateMapping(index, {
                                        transformation: {
                                            ...mapping.transformation,
                                            config: {
                                                ...mapping.transformation?.config,
                                                variables
                                            }
                                        }
                                    });
                                }}
                                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                                Extract Variables from Formula
                            </button>
                        </div>
                    </div>
                );

            case 'conditional':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Condition
                            </label>
                            <input
                                type="text"
                                value={mapping.transformation?.config?.condition || ''}
                                onChange={(e) => updateMapping(index, {
                                    transformation: {
                                        type: 'conditional',
                                        config: {
                                            ...mapping.transformation?.config,
                                            condition: e.target.value
                                        }
                                    }
                                })}
                                placeholder="e.g., Amount > 0"
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    If True
                                </label>
                                <input
                                    type="text"
                                    value={mapping.transformation?.config?.true_value || ''}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'conditional',
                                            config: {
                                                ...mapping.transformation?.config,
                                                true_value: e.target.value
                                            }
                                        }
                                    })}
                                    placeholder="Value when true"
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    If False
                                </label>
                                <input
                                    type="text"
                                    value={mapping.transformation?.config?.false_value || ''}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'conditional',
                                            config: {
                                                ...mapping.transformation?.config,
                                                false_value: e.target.value
                                            }
                                        }
                                    })}
                                    placeholder="Value when false"
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'sequence':
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Value
                                </label>
                                <input
                                    type="number"
                                    value={mapping.transformation?.config?.start || 1}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'sequence',
                                            config: {
                                                ...mapping.transformation?.config,
                                                start: parseInt(e.target.value) || 1
                                            }
                                        }
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Increment
                                </label>
                                <input
                                    type="number"
                                    value={mapping.transformation?.config?.increment || 1}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'sequence',
                                            config: {
                                                ...mapping.transformation?.config,
                                                increment: parseInt(e.target.value) || 1
                                            }
                                        }
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Padding
                                </label>
                                <input
                                    type="number"
                                    value={mapping.transformation?.config?.padding || 0}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'sequence',
                                            config: {
                                                ...mapping.transformation?.config,
                                                padding: parseInt(e.target.value) || 0
                                            }
                                        }
                                    })}
                                    min="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Prefix
                                </label>
                                <input
                                    type="text"
                                    value={mapping.transformation?.config?.prefix || ''}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'sequence',
                                            config: {
                                                ...mapping.transformation?.config,
                                                prefix: e.target.value
                                            }
                                        }
                                    })}
                                    placeholder="e.g., REC-"
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Suffix
                                </label>
                                <input
                                    type="text"
                                    value={mapping.transformation?.config?.suffix || ''}
                                    onChange={(e) => updateMapping(index, {
                                        transformation: {
                                            type: 'sequence',
                                            config: {
                                                ...mapping.transformation?.config,
                                                suffix: e.target.value
                                            }
                                        }
                                    })}
                                    placeholder="e.g., -2024"
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'custom_function':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Custom JavaScript Function
                            </label>
                            <textarea
                                value={mapping.transformation?.config?.code || ''}
                                onChange={(e) => updateMapping(index, {
                                    transformation: {
                                        type: 'custom_function',
                                        config: {
                                            ...mapping.transformation?.config,
                                            code: e.target.value
                                        }
                                    }
                                })}
                                placeholder={`function transform(row, context) {
    // row: current row data
    // context: all source data
    return row.amount * 1.2;
}`}
                                className="w-full h-32 px-3 py-2 border border-gray-300 rounded font-mono text-xs"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Define a transform function that returns the mapped value
                            </p>
                        </div>
                    </div>
                );

            default:
                return <div className="text-sm text-gray-500">Select a mapping type to configure</div>;
        }
    };

    const getTypeIcon = (type) => {
        const typeConfig = mappingTypes.find(t => t.value === type);
        return typeConfig ? typeConfig.icon : Link;
    };

    const getColumnTypeIcon = (columnId) => {
        const column = outputSchema.columns.find(c => c.id === columnId);
        if (!column) return Type;

        switch (column.type) {
            case 'number':
            case 'decimal':
                return Hash;
            case 'date':
            case 'datetime':
                return Calendar;
            case 'boolean':
                return ToggleLeft;
            default:
                return Type;
        }
    };

    // Filter mappings based on search
    const filteredMappings = mappings.filter(mapping => {
        const column = outputSchema.columns.find(c => c.id === mapping.target_column);
        if (!column) return false;
        return column.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Column Mappings</h3>
                <p className="text-sm text-gray-600">
                    Define how to populate each output column from your source data.
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={suggestMappings}
                        className="flex items-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                        <Wand2 size={16} />
                        <span>Auto-Map Columns</span>
                    </button>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search columns..."
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded"
                        />
                    </div>
                </div>

                <div className="text-sm text-gray-600">
                    {mappings.filter(m => m.mapping_type !== 'static' || m.transformation?.config?.value).length} of {mappings.length} columns mapped
                </div>
            </div>

            {/* Mappings List */}
            <div className="space-y-3">
                {filteredMappings.map((mapping, index) => {
                    const column = outputSchema.columns.find(c => c.id === mapping.target_column);
                    if (!column) return null;

                    const TypeIcon = getTypeIcon(mapping.mapping_type);
                    const ColumnIcon = getColumnTypeIcon(mapping.target_column);
                    const isExpanded = expandedMappings[mapping.id];
                    const isMapped = mapping.mapping_type !== 'static' || mapping.transformation?.config?.value;

                    return (
                        <div key={mapping.id} className={`border rounded-lg overflow-hidden ${
                            !isMapped && column.required ? 'border-red-300' : 'border-gray-200'
                        }`}>
                            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => toggleExpanded(mapping.id)}
                                        className="p-1 hover:bg-gray-200 rounded"
                                    >
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>

                                    <ColumnIcon size={20} className="text-gray-600" />

                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-medium">{column.name}</span>
                                            {column.required && (
                                                <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                    Required
                                                </span>
                                            )}
                                        </div>
                                        {column.description && (
                                            <p className="text-xs text-gray-500">{column.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <div className="flex items-center space-x-2">
                                        <TypeIcon size={16} className="text-gray-500" />
                                        <select
                                            value={mapping.mapping_type}
                                            onChange={(e) => updateMapping(index, {
                                                mapping_type: e.target.value,
                                                source: null,
                                                transformation: e.target.value === 'static' ? {
                                                    type: 'static',
                                                    config: { value: '' }
                                                } : {
                                                    type: e.target.value,
                                                    config: {}
                                                }
                                            })}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            {mappingTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <label className="flex items-center space-x-1 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={mapping.enabled}
                                            onChange={(e) => updateMapping(index, { enabled: e.target.checked })}
                                            className="rounded border-gray-300"
                                        />
                                        <span>Enabled</span>
                                    </label>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-4 border-t border-gray-200">
                                    {renderMappingConfig(mapping, index)}

                                    {/* Preview */}
                                    {isMapped && (
                                        <div className="mt-4 p-3 bg-blue-50 rounded">
                                            <p className="text-xs font-medium text-blue-800 mb-1">Mapping Preview:</p>
                                            <p className="text-xs text-blue-600">
                                                {mapping.mapping_type === 'direct' && mapping.source
                                                    ? `${column.name} ← ${mapping.source}`
                                                    : mapping.mapping_type === 'static'
                                                    ? `${column.name} = "${mapping.transformation?.config?.value}"`
                                                    : mapping.mapping_type === 'expression'
                                                    ? `${column.name} = ${mapping.transformation?.config?.formula}`
                                                    : mapping.mapping_type === 'sequence'
                                                    ? `${column.name} = ${mapping.transformation?.config?.prefix}[${mapping.transformation?.config?.start}...]${mapping.transformation?.config?.suffix}`
                                                    : `${column.name} (${mapping.mapping_type})`
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Mapping Types:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Direct:</strong> Copy value from a source column</li>
                            <li><strong>Static:</strong> Set a fixed value for all rows</li>
                            <li><strong>Expression:</strong> Calculate using a formula</li>
                            <li><strong>Conditional:</strong> Set value based on conditions</li>
                            <li><strong>Sequential:</strong> Generate incrementing numbers</li>
                            <li><strong>Custom:</strong> Use JavaScript for complex logic</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColumnMappingStep;