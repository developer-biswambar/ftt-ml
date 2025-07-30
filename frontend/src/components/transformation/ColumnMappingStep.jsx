import React, {useEffect, useState} from 'react';
import {
    AlertCircle,
    Brain,
    Calendar,
    ChevronDown,
    ChevronRight,
    Code,
    Hash,
    Lightbulb,
    Link,
    Search,
    ToggleLeft,
    Type,
    Wand2
} from 'lucide-react';
import {aiAssistanceService} from '../../services/aiAssistanceService';

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
    const [intelligentSuggestions, setIntelligentSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Only show AI suggestions when explicitly requested - no local suggestions
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
                        config: {value: ''}
                    }
                });
            }
        });

        if (newMappings.length !== mappings.length) {
            onUpdate(newMappings);
        }

        // Remove automatic local suggestions - start with empty state
        setIntelligentSuggestions([]);
        if (mappings.length > 0 && Object.keys(sourceColumns).length > 0) {
            onSendMessage('system', `🔍 Data loaded. Click "Get AI Suggestions" for intelligent mapping recommendations.`);
        }
    }, [outputSchema.columns, mappings.length, sourceColumns]);

    const analyzeAndSuggestIntelligentMappings = async () => {
        setIsAnalyzing(true);

        try {
            // Get AI-powered suggestions only
            const aiResponse = await aiAssistanceService.suggestColumnMappings({
                sourceColumns,
                outputSchema: {
                    columns: outputSchema.columns,
                    format: outputSchema.format
                },
                existingMappings: mappings,
                context: {
                    transformationType: 'column_mapping',
                    industry: 'general'
                }
            });

            let suggestions = [];

            if (aiResponse.success && aiResponse.content) {
                try {
                    // Parse AI response more carefully
                    let aiSuggestions = [];
                    const content = aiResponse.content;

                    // Check if content is a text description instead of JSON
                    if (!content.trim().startsWith('{') || content.includes('mapping strategies')) {
                        // Handle text response by extracting suggestions
                        onSendMessage('system', `💬 AI provided text suggestions: ${content.substring(0, 200)}...`);

                        // Extract suggestions from text content
                        if (content.toLowerCase().includes('expression') && content.toLowerCase().includes('total')) {
                            aiSuggestions = [{
                                target_column: 'total_amount',
                                mapping_type: 'expression',
                                title: 'Calculate Total Amount',
                                description: 'Sum base amount and tax amount',
                                confidence: 0.8,
                                reasoning: 'AI suggested expression mapping for total calculation',
                                auto_config: {
                                    mapping_type: 'expression',
                                    transformation: {
                                        type: 'expression',
                                        config: {
                                            formula: '{Net_Amount} + {Tax_Amount}',
                                            variables: {
                                                'Net_Amount': 'Net_Amount',
                                                'Tax_Amount': 'Tax_Amount'
                                            }
                                        }
                                    }
                                }
                            }];
                        }

                        if (content.toLowerCase().includes('sequential') && content.toLowerCase().includes('id')) {
                            aiSuggestions.push({
                                target_column: 'record_id',
                                mapping_type: 'sequence',
                                title: 'Generate Record IDs',
                                description: 'Auto-generate sequential record identifiers',
                                confidence: 0.9,
                                reasoning: 'AI suggested sequential generation for ID fields',
                                auto_config: {
                                    mapping_type: 'sequence',
                                    transformation: {
                                        type: 'sequence',
                                        config: {
                                            start: 1,
                                            increment: 1,
                                            padding: 3,
                                            prefix: 'REC-'
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
                        } else if (parsed.column_mappings && Array.isArray(parsed.column_mappings)) {
                            aiSuggestions = parsed.column_mappings;
                        }
                    }

                    // Convert AI suggestions to our format
                    const formattedAISuggestions = aiSuggestions.map((s, index) => ({
                        id: `ai_${Date.now()}_${index}`,
                        targetColumn: s.target_column || s.targetColumn || `unknown_${index}`,
                        type: s.mapping_type || s.type || 'direct',
                        title: s.title || 'AI Mapping Suggestion',
                        description: s.description || 'AI-generated mapping suggestion',
                        confidence: s.confidence || 0.8,
                        reasoning: s.reasoning || 'Generated by AI analysis',
                        source: 'ai',
                        autoConfig: s.auto_config || s.autoConfig || {
                            mapping_type: s.mapping_type || 'direct',
                            transformation: s.transformation || null
                        }
                    }));

                    suggestions = formattedAISuggestions;

                    if (formattedAISuggestions.length > 0) {
                        onSendMessage('system', `🧠 AI Analysis Complete: Found ${formattedAISuggestions.length} AI-powered mapping suggestions`);
                    } else {
                        onSendMessage('system', `🧠 AI Analysis Complete: No specific mapping suggestions found for your data structure.`);
                    }
                } catch (parseError) {
                    console.warn('Failed to parse AI column mapping suggestions:', parseError);
                    onSendMessage('system', `⚠️ AI response received but couldn't parse suggestions.`);
                    suggestions = [];
                }
            } else {
                onSendMessage('system', `⚠️ AI analysis failed. Please try again.`);
                suggestions = [];
            }

            setIntelligentSuggestions(suggestions);
            setIsAnalyzing(false);

        } catch (error) {
            console.error('AI mapping analysis error:', error);
            setIntelligentSuggestions([]);
            setIsAnalyzing(false);
            onSendMessage('system', `❌ AI analysis failed: ${error.message}. Please try again.`);
        }
    };

    const applyIntelligentSuggestion = (suggestion) => {
        const mappingIndex = mappings.findIndex(m => m.target_column === suggestion.targetColumn);
        if (mappingIndex !== -1) {
            updateMapping(mappingIndex, suggestion.autoConfig);
            setIntelligentSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
            onSendMessage('system', `✅ Applied AI suggestion: ${suggestion.title}`);
        }
    };

    const dismissIntelligentSuggestion = (suggestionId) => {
        setIntelligentSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    };

    const mappingTypes = [
        {value: 'direct', label: 'Direct Mapping', icon: Link},
        {value: 'static', label: 'Static Value', icon: Type},
        {value: 'expression', label: 'Expression', icon: Code},
        {value: 'conditional', label: 'Conditional', icon: ToggleLeft},
        {value: 'sequence', label: 'Sequential', icon: Hash},
        {value: 'lookup', label: 'Lookup', icon: Search},
        {value: 'custom_function', label: 'Custom Function', icon: Code}
    ];

    const updateMapping = (index, updates) => {
        const updatedMappings = [...mappings];
        updatedMappings[index] = {...updatedMappings[index], ...updates};
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
                                onChange={(e) => updateMapping(index, {source: e.target.value})}
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
                                        config: {value: e.target.value}
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
                                Enter lookup mappings as key=value pairs, one per line
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Value (when key not found)
                            </label>
                            <input
                                type="text"
                                value={mapping.transformation?.config?.default_value || ''}
                                onChange={(e) => updateMapping(index, {
                                    transformation: {
                                        type: 'lookup',
                                        config: {
                                            ...mapping.transformation?.config,
                                            default_value: e.target.value
                                        }
                                    }
                                })}
                                placeholder="Default value"
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
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

            {/* Intelligent AI Suggestions - Always show button */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <Brain size={20} className="text-blue-600"/>
                        <span className="font-medium text-blue-800">Intelligent Mapping Suggestions</span>
                        {isAnalyzing && (
                            <div
                                className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={analyzeAndSuggestIntelligentMappings}
                            disabled={isAnalyzing}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Get AI Suggestions'}
                        </button>
                        {intelligentSuggestions.length > 0 && (
                            <button
                                onClick={() => setShowSuggestions(!showSuggestions)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                                {showSuggestions ? 'Hide' : 'Show'}
                            </button>
                        )}
                    </div>
                </div>

                {isAnalyzing ? (
                    <p className="text-sm text-blue-700">🧠 Analyzing column patterns and suggesting optimal
                        mappings...</p>
                ) : intelligentSuggestions.length > 0 && showSuggestions ? (
                    <div className="space-y-2">
                        {intelligentSuggestions.map(suggestion => (
                            <div key={suggestion.id} className="bg-white border border-blue-200 rounded p-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <Lightbulb size={14} className="text-blue-600"/>
                                            <span
                                                className="text-sm font-medium text-gray-800">{suggestion.title}</span>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {Math.round(suggestion.confidence * 100)}%
                                            </span>
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                AI-Powered
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 mb-1">{suggestion.description}</p>
                                        <p className="text-xs text-gray-500 italic">{suggestion.reasoning}</p>
                                    </div>
                                    <div className="flex space-x-1 ml-3">
                                        <button
                                            onClick={() => applyIntelligentSuggestion(suggestion)}
                                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => dismissIntelligentSuggestion(suggestion.id)}
                                            className="px-2 py-1 text-gray-400 hover:text-gray-600 text-xs"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !isAnalyzing ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-blue-700 mb-2">Get AI-powered suggestions for column mappings.</p>
                        <p className="text-xs text-gray-600">Click "Get AI Suggestions" to analyze your data and
                            recommend intelligent mapping strategies.</p>
                    </div>
                ) : null}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={suggestMappings}
                        className="flex items-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                        <Wand2 size={16}/>
                        <span>Auto-Map Columns</span>
                    </button>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
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
                    {mappings.filter(m => m.mapping_type !== 'static' || m.transformation?.config?.value).length} of {mappings.length} columns
                    mapped
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
                                        {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                    </button>

                                    <ColumnIcon size={20} className="text-gray-600"/>

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
                                        <TypeIcon size={16} className="text-gray-500"/>
                                        <select
                                            value={mapping.mapping_type}
                                            onChange={(e) => updateMapping(index, {
                                                mapping_type: e.target.value,
                                                source: null,
                                                transformation: e.target.value === 'static' ? {
                                                    type: 'static',
                                                    config: {value: ''}
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
                                            onChange={(e) => updateMapping(index, {enabled: e.target.checked})}
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
                                                                : mapping.mapping_type === 'lookup'
                                                                    ? `${column.name} = lookup(${mapping.transformation?.config?.key_column})`
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
                    <AlertCircle size={16} className="text-blue-600 mt-0.5"/>
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Mapping Types:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Direct:</strong> Copy value from a source column</li>
                            <li><strong>Static:</strong> Set a fixed value for all rows</li>
                            <li><strong>Expression:</strong> Calculate using a formula</li>
                            <li><strong>Conditional:</strong> Set value based on conditions</li>
                            <li><strong>Sequential:</strong> Generate incrementing numbers</li>
                            <li><strong>Lookup:</strong> Transform values using a lookup table</li>
                            <li><strong>Custom:</strong> Use JavaScript for complex logic</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColumnMappingStep;