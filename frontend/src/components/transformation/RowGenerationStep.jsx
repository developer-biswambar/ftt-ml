import React, {useState} from 'react';
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Copy,
    GitBranch,
    Layers,
    Minus,
    Plus,
    Settings,
    Target,
    Type,
    X
} from 'lucide-react';

const RowGenerationStep = ({
                               rules,
                               onUpdate,
                               sourceColumns,
                               onSendMessage
                           }) => {
    const [expandedRules, setExpandedRules] = useState({});
    const [showConditionBuilder, setShowConditionBuilder] = useState({});

    const mappingTypes = [
        {value: 'direct', label: 'Direct Mapping', icon: Target},
        {value: 'static', label: 'Static Value', icon: Type},
        {value: 'dynamic', label: 'Dynamic/Conditional', icon: GitBranch}
    ];

    const operators = [
        {value: '==', label: 'equals'},
        {value: '!=', label: 'not equals'},
        {value: '>', label: 'greater than'},
        {value: '<', label: 'less than'},
        {value: '>=', label: 'greater than or equal'},
        {value: '<=', label: 'less than or equal'},
        {value: 'contains', label: 'contains'},
        {value: 'startsWith', label: 'starts with'},
        {value: 'endsWith', label: 'ends with'}
    ];

    const addRule = () => {
        const newRule = {
            id: `rule_${Date.now()}`,
            name: 'New Transformation Rule',
            enabled: true,
            output_columns: [],
            priority: rules.length
        };

        onUpdate([...rules, newRule]);
        setExpandedRules({...expandedRules, [newRule.id]: true});
    };

    const updateRule = (index, updates) => {
        const updatedRules = [...rules];
        updatedRules[index] = {...updatedRules[index], ...updates};
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

    const addOutputColumn = (ruleIndex) => {
        const allColumns = getAllSourceColumns();
        const firstColumn = allColumns.length > 0 ? allColumns[0] : null;

        const newColumn = {
            id: `col_${Date.now()}`,
            name: firstColumn ? firstColumn.column : '', // Just use the column name, not the full reference
            mapping_type: 'direct',
            source_column: firstColumn ? firstColumn.value : '', // Use the full reference for source
            static_value: '',
            dynamic_conditions: []
        };

        const updatedRules = [...rules];
        updatedRules[ruleIndex].output_columns = [
            ...(updatedRules[ruleIndex].output_columns || []),
            newColumn
        ];
        onUpdate(updatedRules);
    };

    const updateOutputColumn = (ruleIndex, columnIndex, updates) => {
        // Clone the existing rules array to avoid mutating state directly
        const updatedRules = [...rules];

        // Get the current column to be updated
        const currentColumn = updatedRules[ruleIndex].output_columns[columnIndex];


        if (updates.source_column) {
            // Since we're using direct column names now, no need to split
            updates['name'] = updates.source_column;
        }
        // Create the updated column object by merging current and new values
        const updatedColumn = {
            ...currentColumn,
            ...updates
        };

        // Assign the updated column back to the appropriate location
        updatedRules[ruleIndex].output_columns[columnIndex] = updatedColumn;

        // Trigger the update handler with the new rules
        onUpdate(updatedRules);
    };


    const removeOutputColumn = (ruleIndex, columnIndex) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].output_columns = updatedRules[ruleIndex].output_columns.filter((_, i) => i !== columnIndex);
        onUpdate(updatedRules);
    };

    const addDynamicCondition = (ruleIndex, columnIndex) => {
        const newCondition = {
            id: `cond_${Date.now()}`,
            condition_column: '',
            operator: '==',
            condition_value: '',
            output_value: ''
        };

        const updatedRules = [...rules];
        const column = updatedRules[ruleIndex].output_columns[columnIndex];
        column.dynamic_conditions = [...(column.dynamic_conditions || []), newCondition];
        onUpdate(updatedRules);
    };

    const updateDynamicCondition = (ruleIndex, columnIndex, conditionIndex, updates) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].output_columns[columnIndex].dynamic_conditions[conditionIndex] = {
            ...updatedRules[ruleIndex].output_columns[columnIndex].dynamic_conditions[conditionIndex],
            ...updates
        };
        onUpdate(updatedRules);
    };

    const removeDynamicCondition = (ruleIndex, columnIndex, conditionIndex) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].output_columns[columnIndex].dynamic_conditions =
            updatedRules[ruleIndex].output_columns[columnIndex].dynamic_conditions.filter((_, i) => i !== conditionIndex);
        onUpdate(updatedRules);
    };

    const buildConditionString = (rule) => {
        // This function is no longer needed since conditions are at column level
        return '';
    };

    const updateConditionFromBuilder = (index) => {
        // This function is no longer needed since conditions are at column level
    };

    const getAllSourceColumns = () => {
        const columns = [];
        Object.entries(sourceColumns).forEach(([alias, cols]) => {
            cols.forEach(col => {
                columns.push({
                    value: col,  // Use direct column name
                    label: col,  // Use direct column name
                    alias,
                    column: col
                });
            });
        });
        return columns;
    };

    const getAllAvailableColumns = (ruleIndex, columnIndex) => {
        const columns = [];
        
        // Add source columns first (marked as existing)
        Object.entries(sourceColumns).forEach(([alias, cols]) => {
            cols.forEach(col => {
                columns.push({
                    value: col,
                    label: col,
                    alias,
                    column: col,
                    isSource: true,
                    category: 'source'
                });
            });
        });
        
        // Add previously created output columns from all rules up to current position
        rules.forEach((rule, rIdx) => {
            if (rule.output_columns && rule.output_columns.length > 0) {
                rule.output_columns.forEach((outputCol, cIdx) => {
                    // Only include columns that are defined before current position
                    if (rIdx < ruleIndex || (rIdx === ruleIndex && cIdx < columnIndex)) {
                        if (outputCol.name && outputCol.name.trim()) {
                            columns.push({
                                value: outputCol.name,
                                label: outputCol.name,
                                column: outputCol.name,
                                isSource: false,
                                category: 'created',
                                ruleIndex: rIdx,
                                columnIndex: cIdx
                            });
                        }
                    }
                });
            }
        });
        
        return columns;
    };

    const renderOutputColumnConfig = (rule, ruleIndex, column, columnIndex) => {
        const allColumns = getAllSourceColumns();

        return (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={column.name}
                            onChange={(e) => updateOutputColumn(ruleIndex, columnIndex, {name: e.target.value})}
                            placeholder="Column name"
                            className="px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                        />
                        <select
                            value={column.mapping_type}
                            onChange={(e) => updateOutputColumn(ruleIndex, columnIndex, {
                                mapping_type: e.target.value,
                                source_column: '',
                                static_value: '',
                                dynamic_conditions: []
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
                    <button
                        onClick={() => removeOutputColumn(ruleIndex, columnIndex)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove column"
                    >
                        <X size={16}/>
                    </button>
                </div>

                {/* Mapping Configuration */}
                {column.mapping_type === 'direct' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Source Column
                        </label>
                        <select
                            value={column.source_column || ''}
                            onChange={(e) => updateOutputColumn(ruleIndex, columnIndex, {source_column: e.target.value})}
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
                )}

                {column.mapping_type === 'static' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Static Value
                        </label>
                        <input
                            type="text"
                            value={column.static_value || ''}
                            onChange={(e) => updateOutputColumn(ruleIndex, columnIndex, {static_value: e.target.value})}
                            placeholder="Enter static value or expression like {first_name} {last_name}..."
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 Use {`{column_name}`} for expressions: {`{quantity} * {unit_price}`} or {`{first_name} {last_name}`}
                        </p>
                    </div>
                )}

                {column.mapping_type === 'dynamic' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Dynamic Conditions
                            </label>
                            <button
                                onClick={() => addDynamicCondition(ruleIndex, columnIndex)}
                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >
                                Add Condition
                            </button>
                        </div>

                        {(column.dynamic_conditions || []).map((condition, condIndex) => (
                            <div key={condition.id} className="border border-gray-300 rounded p-3 bg-white">
                                <div className="grid grid-cols-5 gap-2 items-center">
                                    <div>
                                        <label className="block text-xs text-gray-600">If Column</label>
                                        <select
                                            value={condition.condition_column || ''}
                                            onChange={(e) => updateDynamicCondition(ruleIndex, columnIndex, condIndex, {condition_column: e.target.value})}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">Select...</option>
                                            {getAllAvailableColumns(ruleIndex, columnIndex).map(col => (
                                                <option 
                                                    key={`${col.category}-${col.value}`} 
                                                    value={col.value}
                                                    className={col.isSource ? "" : "font-medium"}
                                                    style={{
                                                        color: col.isSource ? '#374151' : '#059669',
                                                        fontWeight: col.isSource ? 'normal' : '600'
                                                    }}
                                                >
                                                    {col.isSource ? `📊 ${col.label}` : `🧮 ${col.label}`}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            📊 Source columns | 🧮 Created columns
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-600">Operator</label>
                                        <select
                                            value={condition.operator}
                                            onChange={(e) => updateDynamicCondition(ruleIndex, columnIndex, condIndex, {operator: e.target.value})}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            {operators.map(op => (
                                                <option key={op.value} value={op.value}>
                                                    {op.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-600">Value</label>
                                        <input
                                            type="text"
                                            value={condition.condition_value || ''}
                                            onChange={(e) => updateDynamicCondition(ruleIndex, columnIndex, condIndex, {condition_value: e.target.value})}
                                            placeholder="Condition value"
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-600">Then Set</label>
                                        <input
                                            type="text"
                                            value={condition.output_value || ''}
                                            onChange={(e) => updateDynamicCondition(ruleIndex, columnIndex, condIndex, {output_value: e.target.value})}
                                            placeholder="Output value or expression like {quantity} * {unit_price}"
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            Use {`{column_name}`} for calculations
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => removeDynamicCondition(ruleIndex, columnIndex, condIndex)}
                                            className="p-1 text-red-400 hover:text-red-600"
                                            title="Remove condition"
                                        >
                                            <X size={14}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(!column.dynamic_conditions || column.dynamic_conditions.length === 0) && (
                            <div
                                className="text-center py-4 text-gray-500 border border-dashed border-gray-300 rounded">
                                <p className="text-sm">No conditions defined</p>
                                <button
                                    onClick={() => addDynamicCondition(ruleIndex, columnIndex)}
                                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                                >
                                    Add First Condition
                                </button>
                            </div>
                        )}

                        {/* Default Value */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Value (when no conditions match)
                            </label>
                            <input
                                type="text"
                                value={column.default_value || ''}
                                onChange={(e) => updateOutputColumn(ruleIndex, columnIndex, {default_value: e.target.value})}
                                placeholder="Default value or expression like {quantity} * {unit_price}"
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                💡 Supports expressions with {`{column_name}`} syntax
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderConditionBuilder = (rule, ruleIndex) => {
        const allColumns = getAllSourceColumns();
        const showBuilder = showConditionBuilder[rule.id];

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        Rule Condition (when this rule applies)
                    </label>
                    <button
                        onClick={() => setShowConditionBuilder(prev => ({
                            ...prev,
                            [rule.id]: !prev[rule.id]
                        }))}
                        className="flex items-center space-x-1 px-2 py-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                        <Settings size={14}/>
                        <span>{showBuilder ? 'Hide Builder' : 'Show Builder'}</span>
                    </button>
                </div>

                {showBuilder && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="grid grid-cols-4 gap-2 items-center mb-2">
                            <div>
                                <label className="block text-xs text-gray-600">Column</label>
                                <select
                                    value={rule.condition_builder?.column || ''}
                                    onChange={(e) => updateRule(ruleIndex, {
                                        condition_builder: {
                                            ...rule.condition_builder,
                                            column: e.target.value
                                        }
                                    })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                    <option value="">Select column...</option>
                                    {getAllAvailableColumns(ruleIndex, 999).map(col => (
                                        <option 
                                            key={`${col.category}-${col.value}`} 
                                            value={col.value}
                                            style={{
                                                color: col.isSource ? '#374151' : '#059669',
                                                fontWeight: col.isSource ? 'normal' : '600'
                                            }}
                                        >
                                            {col.isSource ? `📊 ${col.label}` : `🧮 ${col.label}`}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    📊 Source columns | 🧮 Created columns
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-600">Operator</label>
                                <select
                                    value={rule.condition_builder?.operator || '=='}
                                    onChange={(e) => updateRule(ruleIndex, {
                                        condition_builder: {
                                            ...rule.condition_builder,
                                            operator: e.target.value
                                        }
                                    })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                    {operators.map(op => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-600">Value</label>
                                <input
                                    type="text"
                                    value={rule.condition_builder?.value || ''}
                                    onChange={(e) => updateRule(ruleIndex, {
                                        condition_builder: {
                                            ...rule.condition_builder,
                                            value: e.target.value
                                        }
                                    })}
                                    placeholder="Condition value"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                            </div>

                            <div>
                                <button
                                    onClick={() => updateConditionFromBuilder(ruleIndex)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <textarea
                        value={rule.condition || ''}
                        onChange={(e) => updateRule(ruleIndex, {condition: e.target.value})}
                        placeholder="e.g., Amount < 0"
                        className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                        rows={2}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Use column references like 'ColumnName' or use the builder above
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Transformation Rules</h3>
                <p className="text-sm text-gray-600">
                    Create rules to transform and generate output records. Each rule can define its own output columns
                    and conditions.
                </p>
            </div>

            {/* Add Rule Button */}
            <div className="flex justify-between items-center">
                <button
                    onClick={addRule}
                    className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <Plus size={16}/>
                    <span>Add Transformation Rule</span>
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
                    <Layers size={48} className="mx-auto mb-4 text-gray-400"/>
                    <p className="text-gray-600 mb-4">No transformation rules defined</p>
                    <p className="text-sm text-gray-500 mb-4">
                        Create rules to define how your data should be transformed and what output columns to generate
                    </p>
                    <button
                        onClick={addRule}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Create Your First Rule
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {rules.map((rule, index) => {
                        const isExpanded = expandedRules[rule.id];

                        return (
                            <div key={rule.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <button
                                            onClick={() => toggleExpanded(rule.id)}
                                            className="p-1 hover:bg-gray-200 rounded"
                                        >
                                            {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                        </button>

                                        <Copy size={20} className="text-gray-600"/>

                                        <input
                                            type="text"
                                            value={rule.name}
                                            onChange={(e) => updateRule(index, {name: e.target.value})}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm font-medium bg-white"
                                            placeholder="Rule name"
                                        />

                                        <label className="flex items-center space-x-1 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={rule.enabled}
                                                onChange={(e) => updateRule(index, {enabled: e.target.checked})}
                                                className="rounded border-gray-300"
                                            />
                                            <span>Enabled</span>
                                        </label>

                                        {rule.output_columns && rule.output_columns.length > 0 && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                {rule.output_columns.length} columns
                                            </span>
                                        )}
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
                                            <Minus size={16}/>
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t border-gray-200 space-y-6">
                                        {/* Output Columns */}
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Output Columns
                                                </label>
                                                <button
                                                    onClick={() => addOutputColumn(index)}
                                                    className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                                >
                                                    <Plus size={14}/>
                                                    <span>Add Column</span>
                                                </button>
                                            </div>

                                            {rule.output_columns && rule.output_columns.length > 0 ? (
                                                <div className="space-y-3">
                                                    {rule.output_columns.map((column, columnIndex) => (
                                                        <div key={column.id}>
                                                            {renderOutputColumnConfig(rule, index, column, columnIndex)}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                                    <Target size={32} className="mx-auto mb-2 text-gray-400"/>
                                                    <p className="text-gray-600 mb-2">No output columns defined</p>
                                                    <button
                                                        onClick={() => addOutputColumn(index)}
                                                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                                    >
                                                        Add First Column
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rule Preview */}
                                        {rule.output_columns && rule.output_columns.length > 0 && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-xs font-medium text-blue-800 mb-2">Rule Summary:</p>
                                                <p className="text-xs text-blue-600">
                                                    <strong>Generate:</strong> {rule.output_columns.map(col => col.name || 'Unnamed').join(', ')}
                                                </p>
                                            </div>
                                        )}
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
                    <AlertCircle size={16} className="text-blue-600 mt-0.5"/>
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How Transformation Rules Work:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Rules are applied to all source rows to generate output records</li>
                            <li>Each rule can define multiple output columns with different mapping types</li>
                            <li>Direct mapping copies values from source columns</li>
                            <li>Static values set fixed values for all records</li>
                            <li>Dynamic conditions set column values based on other column values</li>
                            <li>Dynamic conditions can reference both source columns (📊) and previously created columns (🧮)</li>
                            <li>Each rule processes all input data and generates its own output dataset</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RowGenerationStep;