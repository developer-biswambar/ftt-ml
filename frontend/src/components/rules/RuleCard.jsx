// src/components/RuleCard.jsx - Modular Rule Card Component
import React, {useState} from 'react';
import {
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    Columns,
    Database,
    Edit3,
    FileType,
    GitCompare as CompareIcon,
    Hash,
    Key,
    Layers,
    Save,
    Settings2,
    Tag,
    User,
    X
} from 'lucide-react';

const RuleCard = ({rule, onUpdateRule, isEditable = true}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState(rule);
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        basic: true,
        config: false,
        columns: false,
        timestamps: false
    });

    const handleEdit = () => {
        setIsEditing(true);
        setEditedData({...rule});
    };

    const handleSave = async () => {
        if (onUpdateRule) {
            const success = await onUpdateRule(rule.id, editedData);
            if (success) {
                setIsEditing(false);
            }
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedData(rule);
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const updateEditedData = (field, value) => {
        setEditedData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateNestedData = (path, value) => {
        setEditedData(prev => {
            const newData = {...prev};
            const keys = path.split('.');
            let current = newData;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Settings2 className="w-4 h-4 text-blue-600"/>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center space-x-2">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editedData.name}
                                        onChange={(e) => updateEditedData('name', e.target.value)}
                                        className="text-lg font-medium border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Rule name"
                                    />
                                ) : (
                                    <h5 className="text-lg font-medium text-gray-900">{rule.name}</h5>
                                )}
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                >
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-gray-500"/>
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-500"/>
                                    )}
                                </button>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedData.description}
                                    onChange={(e) => updateEditedData('description', e.target.value)}
                                    className="mt-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 w-full resize-none"
                                    rows="2"
                                    placeholder="Rule description"
                                />
                            ) : (
                                <p className="text-sm text-gray-500">{rule.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {isEditable && (
                            <>
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={handleSave}
                                            className="inline-flex items-center px-3 py-1 border border-green-300 shadow-sm text-sm font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
                                        >
                                            <Save className="w-4 h-4 mr-1"/>
                                            Save
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            <X className="w-4 h-4 mr-1"/>
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleEdit}
                                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        <Edit3 className="w-4 h-4 mr-1"/>
                                        Edit
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Basic Information - Always visible */}
            <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                            <Tag className="w-4 h-4 text-gray-600"/>
                            <span className="text-sm font-medium text-gray-900">Category</span>
                        </div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedData.category}
                                onChange={(e) => updateEditedData('category', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        ) : (
                            <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {rule.category}
                            </span>
                        )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                            <FileType className="w-4 h-4 text-gray-600"/>
                            <span className="text-sm font-medium text-gray-900">Rule Type</span>
                        </div>
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {rule.rule_type}
                        </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                            <Hash className="w-4 h-4 text-gray-600"/>
                            <span className="text-sm font-medium text-gray-900">Usage Count</span>
                        </div>
                        <span className="text-sm text-gray-900">{rule.usage_count}</span>
                    </div>
                </div>

                {/* Tags */}
                {rule.tags && rule.tags.length > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <Tag className="w-4 h-4 text-gray-600"/>
                            <span className="text-sm font-medium text-gray-900">Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {rule.tags.map((tag, tagIndex) => (
                                <span key={tagIndex}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Expandable Sections */}
            {isExpanded && (
                <div className="border-t border-gray-200">
                    {/* Template Information */}
                    {rule.template_id && (
                        <div className="px-6 py-4 border-b border-gray-100">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Layers className="w-4 h-4 text-blue-600"/>
                                    <span className="text-sm font-medium text-blue-900">Template Information</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-blue-700 font-medium">Template ID:</span>
                                        <span className="ml-2 text-blue-900">{rule.template_id}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700 font-medium">Template Name:</span>
                                        <span className="ml-2 text-blue-900">{rule.template_name}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rule Configuration */}
                    {rule.rule_config && (
                        <div className="px-6 py-4 border-b border-gray-100">
                            <button
                                onClick={() => toggleSection('config')}
                                className="flex items-center justify-between w-full text-left mb-3 hover:bg-gray-50 p-2 rounded"
                            >
                                <div className="flex items-center space-x-2">
                                    <Settings2 className="w-4 h-4 text-gray-600"/>
                                    <span className="text-sm font-medium text-gray-900">Rule Configuration</span>
                                </div>
                                {expandedSections.config ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500"/>
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500"/>
                                )}
                            </button>

                            {expandedSections.config && (
                                <div className="space-y-4 ml-6">
                                    {/* Files */}
                                    {rule.rule_config.Files && rule.rule_config.Files.length > 0 && (
                                        <RuleConfigSection
                                            title="Files"
                                            icon={Database}
                                            items={rule.rule_config.Files}
                                            bgColor="gray"
                                            prefix="📄"
                                        />
                                    )}

                                    {/* Key Rules */}
                                    {rule.rule_config.KeyRules && rule.rule_config.KeyRules.length > 0 && (
                                        <RuleConfigSection
                                            title="Key Rules"
                                            icon={Key}
                                            items={rule.rule_config.KeyRules}
                                            bgColor="yellow"
                                            prefix="🔑"
                                        />
                                    )}

                                    {/* Comparison Rules */}
                                    {rule.rule_config.ComparisonRules && rule.rule_config.ComparisonRules.length > 0 && (
                                        <RuleConfigSection
                                            title="Comparison Rules"
                                            icon={CompareIcon}
                                            items={rule.rule_config.ComparisonRules}
                                            bgColor="green"
                                            prefix="⚖️"
                                        />
                                    )}

                                    {/* User Requirements */}
                                    {rule.rule_config.user_requirements && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <User className="w-4 h-4 text-gray-600"/>
                                                <span
                                                    className="text-sm font-medium text-gray-900">User Requirements</span>
                                            </div>
                                            {isEditing ? (
                                                <textarea
                                                    value={editedData.rule_config?.user_requirements || ''}
                                                    onChange={(e) => updateNestedData('rule_config.user_requirements', e.target.value)}
                                                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                                    rows="3"
                                                />
                                            ) : (
                                                <p className="text-sm text-gray-700">{rule.rule_config.user_requirements}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected Columns */}
                    {((rule.rule_config?.selected_columns_file_a && rule.rule_config.selected_columns_file_a.length > 0) ||
                        (rule.rule_config?.selected_columns_file_b && rule.rule_config.selected_columns_file_b.length > 0)) && (
                        <div className="px-6 py-4 border-b border-gray-100">
                            <button
                                onClick={() => toggleSection('columns')}
                                className="flex items-center justify-between w-full text-left mb-3 hover:bg-gray-50 p-2 rounded"
                            >
                                <div className="flex items-center space-x-2">
                                    <Columns className="w-4 h-4 text-gray-600"/>
                                    <span className="text-sm font-medium text-gray-900">Selected Columns</span>
                                </div>
                                {expandedSections.columns ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500"/>
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500"/>
                                )}
                            </button>

                            {expandedSections.columns && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                                    {rule.rule_config.selected_columns_file_a && rule.rule_config.selected_columns_file_a.length > 0 && (
                                        <div className="bg-purple-50 rounded-lg p-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <Columns className="w-4 h-4 text-purple-600"/>
                                                <span
                                                    className="text-sm font-medium text-purple-900">File A Columns</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {rule.rule_config.selected_columns_file_a.map((column, colIndex) => (
                                                    <span key={colIndex}
                                                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                        {column}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {rule.rule_config.selected_columns_file_b && rule.rule_config.selected_columns_file_b.length > 0 && (
                                        <div className="bg-indigo-50 rounded-lg p-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <Columns className="w-4 h-4 text-indigo-600"/>
                                                <span
                                                    className="text-sm font-medium text-indigo-900">File B Columns</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {rule.rule_config.selected_columns_file_b.map((column, colIndex) => (
                                                    <span key={colIndex}
                                                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                                        {column}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="px-6 py-4">
                        <button
                            onClick={() => toggleSection('timestamps')}
                            className="flex items-center justify-between w-full text-left mb-3 hover:bg-gray-50 p-2 rounded"
                        >
                            <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-600"/>
                                <span className="text-sm font-medium text-gray-900">Timestamps</span>
                            </div>
                            {expandedSections.timestamps ? (
                                <ChevronUp className="w-4 h-4 text-gray-500"/>
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500"/>
                            )}
                        </button>

                        {expandedSections.timestamps && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6 text-sm text-gray-500">
                                <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4"/>
                                    <span>Created: {new Date(rule.created_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Clock className="w-4 h-4"/>
                                    <span>Updated: {new Date(rule.updated_at).toLocaleString()}</span>
                                </div>
                                {rule.last_used_at && (
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-4 h-4"/>
                                        <span>Last Used: {new Date(rule.last_used_at).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper component for rule configuration sections
const RuleConfigSection = ({title, icon: Icon, items, bgColor, prefix}) => {
    const bgColorMap = {
        gray: 'bg-gray-50 border-gray-200 text-gray-800',
        yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        green: 'bg-green-50 border-green-200 text-green-800',
        purple: 'bg-purple-50 border-purple-200 text-purple-800',
        blue: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const iconColorMap = {
        gray: 'text-gray-600',
        yellow: 'text-yellow-600',
        green: 'text-green-600',
        purple: 'text-purple-600',
        blue: 'text-blue-600'
    };

    return (
        <div className={`${bgColorMap[bgColor]} rounded-lg p-4`}>
            <div className="flex items-center space-x-2 mb-2">
                <Icon className={`w-4 h-4 ${iconColorMap[bgColor]}`}/>
                <span
                    className={`text-sm font-medium ${iconColorMap[bgColor].replace('text-', 'text-').replace('-600', '-900')}`}>
                    {title}
                </span>
            </div>
            <div className="space-y-2">
                {items.map((item, index) => (
                    <div key={index}
                         className={`text-sm bg-white rounded px-3 py-2 border ${bgColorMap[bgColor].split(' ')[1]}`}>
                        {prefix} {typeof item === 'object' ? JSON.stringify(item, null, 2) : item}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RuleCard;