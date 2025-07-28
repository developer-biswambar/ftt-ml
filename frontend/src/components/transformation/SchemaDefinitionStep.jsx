import React, {useState} from 'react';
import {
    AlertCircle,
    Calendar,
    Copy,
    Download,
    FileText,
    Hash,
    List,
    Plus,
    ToggleLeft,
    Type,
    Upload,
    Wand2,
    X
} from 'lucide-react';

const SchemaDefinitionStep = ({
                                  outputDefinition,
                                  onUpdate,
                                  onSuggestMappings,
                                  sourceColumns,
                                  onSendMessage
                              }) => {
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [showAIAssistant, setShowAIAssistant] = useState(false);

    const columnTypes = [
        {value: 'string', label: 'Text', icon: Type},
        {value: 'number', label: 'Number', icon: Hash},
        {value: 'decimal', label: 'Decimal', icon: Hash},
        {value: 'date', label: 'Date', icon: Calendar},
        {value: 'datetime', label: 'DateTime', icon: Calendar},
        {value: 'boolean', label: 'Boolean', icon: ToggleLeft},
        {value: 'array', label: 'Array', icon: List}
    ];

    const addColumn = () => {
        const newColumn = {
            id: `col_${Date.now()}`,
            name: '',
            type: 'string',
            required: true,
            description: ''
        };

        onUpdate({
            ...outputDefinition,
            columns: [...outputDefinition.columns, newColumn]
        });
    };

    const updateColumn = (index, field, value) => {
        const updatedColumns = [...outputDefinition.columns];
        updatedColumns[index] = {
            ...updatedColumns[index],
            [field]: value
        };

        onUpdate({
            ...outputDefinition,
            columns: updatedColumns
        });
    };

    const removeColumn = (index) => {
        const updatedColumns = outputDefinition.columns.filter((_, i) => i !== index);
        onUpdate({
            ...outputDefinition,
            columns: updatedColumns
        });
    };

    const duplicateColumn = (index) => {
        const columnToDuplicate = outputDefinition.columns[index];
        const newColumn = {
            ...columnToDuplicate,
            id: `col_${Date.now()}`,
            name: `${columnToDuplicate.name}_copy`
        };

        const updatedColumns = [...outputDefinition.columns];
        updatedColumns.splice(index + 1, 0, newColumn);

        onUpdate({
            ...outputDefinition,
            columns: updatedColumns
        });
    };

    const moveColumn = (index, direction) => {
        const updatedColumns = [...outputDefinition.columns];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex >= 0 && newIndex < updatedColumns.length) {
            [updatedColumns[index], updatedColumns[newIndex]] = [updatedColumns[newIndex], updatedColumns[index]];
            onUpdate({
                ...outputDefinition,
                columns: updatedColumns
            });
        }
    };

    const importFromCSV = () => {
        try {
            const lines = importText.trim().split('\n');
            if (lines.length === 0) return;

            const headers = lines[0].split(',').map(h => h.trim());
            const newColumns = headers.map((header, index) => ({
                id: `col_${Date.now()}_${index}`,
                name: header,
                type: 'string',
                required: true,
                description: ''
            }));

            onUpdate({
                ...outputDefinition,
                columns: newColumns
            });

            setShowImportModal(false);
            setImportText('');
            onSendMessage('system', '✅ Schema imported successfully from CSV headers');
        } catch (error) {
            onSendMessage('system', `❌ Error importing schema: ${error.message}`);
        }
    };

    const exportSchema = () => {
        const schemaData = {
            columns: outputDefinition.columns,
            format: outputDefinition.format,
            metadata: {
                exported_at: new Date().toISOString(),
                column_count: outputDefinition.columns.length
            }
        };

        const blob = new Blob([JSON.stringify(schemaData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transformation_schema.json';
        a.click();
        URL.revokeObjectURL(url);

        onSendMessage('system', '✅ Schema exported successfully');
    };

    const suggestColumnsFromSource = () => {
        // Get all unique column names from source files with their source references
        const allColumns = new Map(); // Map to track column name -> source reference
        Object.entries(sourceColumns).forEach(([alias, columns]) => {
            columns.forEach(col => {
                if (!allColumns.has(col)) {
                    allColumns.set(col, `${alias}.${col}`);
                }
            });
        });

        // Create suggested columns
        const suggestedColumns = Array.from(allColumns.keys()).map((col, index) => ({
            id: `col_${Date.now()}_${index}`,
            name: col,
            type: guessColumnType(col),
            required: false,
            description: `Imported from source column: ${col}`
        }));

        // Create direct mappings for suggested columns
        const suggestedMappings = suggestedColumns.map(column => ({
            id: `map_${Date.now()}_${column.id}`,
            target_column: column.id,
            mapping_type: 'direct',
            enabled: true,
            source: allColumns.get(column.name), // Use the source reference
            transformation: null
        }));

        // Update schema
        onUpdate({
            ...outputDefinition,
            columns: suggestedColumns
        });

        // Notify parent component about the suggested mappings
        if (onSuggestMappings) {
            onSuggestMappings(suggestedMappings);
        }

        onSendMessage('system', `✅ Suggested ${suggestedColumns.length} columns with direct mappings based on source files`);
    };

    const guessColumnType = (columnName) => {
        const name = columnName.toLowerCase();
        if (name.includes('date') || name.includes('time')) return 'date';
        if (name.includes('amount') || name.includes('price') || name.includes('total')) return 'decimal';
        if (name.includes('count') || name.includes('quantity') || name.includes('id')) return 'number';
        if (name.includes('flag') || name.includes('is_') || name.includes('has_')) return 'boolean';
        return 'string';
    };

    const getTypeIcon = (type) => {
        const typeConfig = columnTypes.find(t => t.value === type);
        return typeConfig ? typeConfig.icon : Type;
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Define Output Schema</h3>
                <p className="text-sm text-gray-600">
                    Define the structure of your output file by specifying columns, their types, and requirements.
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                    <button
                        onClick={addColumn}
                        className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        <Plus size={16}/>
                        <span>Add Column</span>
                    </button>

                    <button
                        onClick={suggestColumnsFromSource}
                        className="flex items-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                        <Wand2 size={16}/>
                        <span>Suggest from Source</span>
                    </button>

                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        <Upload size={16}/>
                        <span>Import</span>
                    </button>

                    <button
                        onClick={exportSchema}
                        disabled={outputDefinition.columns.length === 0}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Download size={16}/>
                        <span>Export</span>
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm">
                        <span>Output Format:</span>
                        <select
                            value={outputDefinition.format}
                            onChange={(e) => onUpdate({...outputDefinition, format: e.target.value})}
                            className="px-2 py-1 border border-gray-300 rounded"
                        >
                            <option value="csv">CSV</option>
                            <option value="excel">Excel</option>
                            <option value="json">JSON</option>
                            <option value="xml">XML</option>
                        </select>
                    </label>

                    <label className="flex items-center space-x-2 text-sm">
                        <input
                            type="checkbox"
                            checked={outputDefinition.include_headers}
                            onChange={(e) => onUpdate({...outputDefinition, include_headers: e.target.checked})}
                            className="rounded border-gray-300"
                        />
                        <span>Include Headers</span>
                    </label>
                </div>
            </div>

            {/* Column List */}
            <div className="space-y-3">
                {outputDefinition.columns.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <FileText size={48} className="mx-auto mb-4 text-gray-400"/>
                        <p className="text-gray-600 mb-4">No columns defined yet</p>
                        <button
                            onClick={addColumn}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Add Your First Column
                        </button>
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600">
                                <div className="col-span-3">Column Name</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-1">Required</div>
                                <div className="col-span-4">Description</div>
                                <div className="col-span-2">Actions</div>
                            </div>
                        </div>

                        {outputDefinition.columns.map((column, index) => {
                            const TypeIcon = getTypeIcon(column.type);

                            return (
                                <div key={column.id} className="px-4 py-3 border-b border-gray-200 hover:bg-gray-50">
                                    <div className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-3">
                                            <input
                                                type="text"
                                                value={column.name}
                                                onChange={(e) => updateColumn(index, 'name', e.target.value)}
                                                placeholder="Column name"
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <div className="flex items-center space-x-1">
                                                <TypeIcon size={16} className="text-gray-500"/>
                                                <select
                                                    value={column.type}
                                                    onChange={(e) => updateColumn(index, 'type', e.target.value)}
                                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                                >
                                                    {columnTypes.map(type => (
                                                        <option key={type.value} value={type.value}>
                                                            {type.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="col-span-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={column.required}
                                                onChange={(e) => updateColumn(index, 'required', e.target.checked)}
                                                className="rounded border-gray-300"
                                            />
                                        </div>

                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                value={column.description || ''}
                                                onChange={(e) => updateColumn(index, 'description', e.target.value)}
                                                placeholder="Optional description"
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            />
                                        </div>

                                        <div className="col-span-2 flex items-center space-x-1">
                                            <button
                                                onClick={() => moveColumn(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                                title="Move up"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                onClick={() => moveColumn(index, 'down')}
                                                disabled={index === outputDefinition.columns.length - 1}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                                title="Move down"
                                            >
                                                ↓
                                            </button>
                                            <button
                                                onClick={() => duplicateColumn(index)}
                                                className="p-1 text-blue-400 hover:text-blue-600"
                                                title="Duplicate"
                                            >
                                                <Copy size={14}/>
                                            </button>
                                            <button
                                                onClick={() => removeColumn(index)}
                                                className="p-1 text-red-400 hover:text-red-600"
                                                title="Remove"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Additional options for specific types */}
                                    {column.type === 'decimal' && (
                                        <div className="mt-2 ml-2">
                                            <input
                                                type="text"
                                                value={column.format || ''}
                                                onChange={(e) => updateColumn(index, 'format', e.target.value)}
                                                placeholder="Format (e.g., 0.00)"
                                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                                            />
                                        </div>
                                    )}

                                    {column.type === 'date' && (
                                        <div className="mt-2 ml-2">
                                            <input
                                                type="text"
                                                value={column.format || ''}
                                                onChange={(e) => updateColumn(index, 'format', e.target.value)}
                                                placeholder="Date format (e.g., YYYY-MM-DD)"
                                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                                            />
                                        </div>
                                    )}

                                    {column.type === 'string' && (
                                        <div className="mt-2 ml-2 flex items-center space-x-2">
                                            <input
                                                type="text"
                                                value={column.allowed_values ? column.allowed_values.join(', ') : ''}
                                                onChange={(e) => {
                                                    const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                                    updateColumn(index, 'allowed_values', values.length > 0 ? values : undefined);
                                                }}
                                                placeholder="Allowed values (comma-separated)"
                                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                                            />
                                            <input
                                                type="text"
                                                value={column.default_value || ''}
                                                onChange={(e) => updateColumn(index, 'default_value', e.target.value || undefined)}
                                                placeholder="Default value"
                                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Summary */}
            {outputDefinition.columns.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                        <AlertCircle size={16} className="text-blue-600 mt-0.5"/>
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Schema Summary:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>{outputDefinition.columns.length} columns defined</li>
                                <li>{outputDefinition.columns.filter(c => c.required).length} required columns</li>
                                <li>Output format: {outputDefinition.format.toUpperCase()}</li>
                                {outputDefinition.columns.filter(c => c.allowed_values?.length > 0).length > 0 && (
                                    <li>{outputDefinition.columns.filter(c => c.allowed_values?.length > 0).length} columns
                                        with validation rules</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                        <h3 className="text-lg font-semibold mb-4">Import Schema</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Paste CSV headers or JSON schema to import column definitions.
                        </p>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Column1,Column2,Column3..."
                            className="w-full h-32 p-3 border border-gray-300 rounded mb-4"
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportText('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={importFromCSV}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchemaDefinitionStep;