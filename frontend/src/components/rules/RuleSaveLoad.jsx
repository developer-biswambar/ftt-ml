// src/components/RuleSaveLoad.jsx - Component for saving and loading reconciliation rules
import React, {useEffect, useState} from 'react';
import {AlertCircle, Calendar, Clock, Download, Eye, Save, Search, Star, Tag, Trash2, Upload, X} from 'lucide-react';
import {apiService} from '../../services/defaultApi.js';

const RuleSaveLoad = ({
                          selectedTemplate,
                          currentConfig,
                          fileColumns,
                          loadedRuleId,
                          hasUnsavedChanges,
                          onRuleLoaded,
                          onRuleSaved,
                          onClose,
                          onConfigUpdate, // Callback for when config is updated via import
                          defaultTab = 'load' // 'load' for beginning, 'save' for end
                      }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showRuleDetails, setShowRuleDetails] = useState(null);

    // Save form state
    const [saveForm, setSaveForm] = useState({
        name: '',
        description: '',
        category: 'reconciliation',
        tags: []
    });
    const [saveErrors, setSaveErrors] = useState([]);

    // Categories and filters
    const [categories, setCategories] = useState(['all', 'reconciliation', 'transformation', 'delta']);

    useEffect(() => {
        if (activeTab === 'load') {
            loadRules();
        }
    }, [activeTab, selectedTemplate]);

    useEffect(() => {
        // Auto-populate save form for updates
        if (loadedRuleId && hasUnsavedChanges) {
            setActiveTab('save');
            const loadedRule = rules.find(r => r.id === loadedRuleId);
            if (loadedRule) {
                setSaveForm({
                    name: loadedRule.name,
                    description: loadedRule.description || '',
                    category: loadedRule.category || 'reconciliation',
                    tags: loadedRule.tags || []
                });
            }
        }
    }, [loadedRuleId, hasUnsavedChanges, rules]);

    const loadRules = async () => {
        setLoading(true);
        try {
            const templateRules = selectedTemplate?.id
                ? await apiService.getRulesByTemplate(selectedTemplate.id)
                : await apiService.listReconciliationRules({limit: 50});

            setRules(templateRules);
        } catch (error) {
            console.error('Error loading rules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async () => {
        setSaveErrors([]);

        // Validate form
        const validation = apiService.validateRuleMetadata(saveForm);
        if (!validation.isValid) {
            setSaveErrors(validation.errors);
            return;
        }

        setLoading(true);
        try {
            const {ruleConfig, ruleMetadata} = apiService.createRuleFromConfig(
                currentConfig,
                selectedTemplate,
                saveForm
            );

            let savedRule;
            if (loadedRuleId && hasUnsavedChanges) {
                // Update existing rule
                savedRule = await apiService.updateReconciliationRule(loadedRuleId, {
                    metadata: ruleMetadata,
                    rule_config: ruleConfig
                });
            } else {
                // Create new rule
                savedRule = await apiService.saveReconciliationRule(ruleConfig, ruleMetadata);
            }

            onRuleSaved(savedRule);
            onClose();
        } catch (error) {
            console.error('Error saving rule:', error);
            setSaveErrors([error.message || 'Failed to save rule']);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadRule = async (rule) => {
        setLoading(true);
        try {
            // Mark rule as used
            await apiService.markRuleAsUsed(rule.id);

            // Adapt rule to current files
            const {adaptedConfig, warnings, errors} = apiService.adaptRuleToFiles(rule, fileColumns);

            if (errors.length > 0) {
                alert(`Cannot load rule: ${errors.join('\n')}`);
                return;
            }

            onRuleLoaded(rule, adaptedConfig, warnings);
            onClose();
        } catch (error) {
            console.error('Error loading rule:', error);
            alert('Failed to load rule: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
            return;
        }

        setLoading(true);
        try {
            await apiService.deleteReconciliationRule(ruleId);
            await loadRules(); // Refresh list
        } catch (error) {
            console.error('Error deleting rule:', error);
            alert('Failed to delete rule: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredRules = rules.filter(rule => {
        const matchesSearch = !searchTerm ||
            rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rule.description.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const addTag = (tag) => {
        if (tag && !saveForm.tags.includes(tag)) {
            setSaveForm(prev => ({
                ...prev,
                tags: [...prev.tags, tag]
            }));
        }
    };

    const removeTag = (tagToRemove) => {
        setSaveForm(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    // Import/Export functionality
    const [selectedRuleForExport, setSelectedRuleForExport] = useState(null);
    
    const handleExportRule = (ruleToExport = null) => {
        try {
            let ruleData;
            
            if (ruleToExport) {
                // Export selected saved rule
                ruleData = {
                    metadata: {
                        name: ruleToExport.name,
                        description: ruleToExport.description || 'Exported saved rule',
                        category: ruleToExport.category || 'reconciliation',
                        created_at: ruleToExport.created_at,
                        updated_at: ruleToExport.updated_at,
                        usage_count: ruleToExport.usage_count || 0,
                        tags: ruleToExport.tags || [],
                        exported: true,
                        export_version: '1.0',
                        original_rule_id: ruleToExport.id
                    },
                    rule_config: ruleToExport.rule_config
                };
            } else {
                // Export current configuration
                ruleData = {
                    metadata: {
                        name: `Current Configuration - ${new Date().toLocaleDateString()}`,
                        description: 'Exported current working configuration',
                        category: 'reconciliation',
                        created_at: new Date().toISOString(),
                        exported: true,
                        export_version: '1.0'
                    },
                    rule_config: currentConfig
                };
            }

            const dataStr = JSON.stringify(ruleData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const sanitizedName = (ruleToExport?.name || 'current-config').toLowerCase().replace(/[^a-z0-9]/g, '-');
            const link = document.createElement('a');
            link.href = url;
            link.download = `${sanitizedName}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting rule:', error);
            alert('Failed to export rule: ' + error.message);
        }
    };

    const handleImportRule = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const ruleData = JSON.parse(e.target.result);
                
                // Validate rule structure
                if (!ruleData.rule_config) {
                    alert('Invalid rule file: missing rule_config');
                    return;
                }

                // Prepare the rule for saving using existing save functionality
                const importedRuleName = ruleData.metadata?.name || 'Imported Rule';
                const importedRuleDescription = ruleData.metadata?.description || 'Rule imported from file';
                const importedRuleCategory = ruleData.metadata?.category || 'reconciliation';
                const importedRuleTags = ruleData.metadata?.tags || [];

                // Set up the save form with imported rule data
                setSaveForm({
                    name: importedRuleName + ' (Imported)',
                    description: importedRuleDescription,
                    category: importedRuleCategory,
                    tags: importedRuleTags
                });

                // Switch to save tab to show the import
                setActiveTab('save');

                // Temporarily update the current config to the imported config so it gets saved
                const originalConfig = currentConfig;
                
                try {
                    // Update config if callback is available
                    if (onConfigUpdate) {
                        onConfigUpdate(ruleData.rule_config);
                    }

                    setLoading(true);

                    // Use the existing save rule functionality
                    const {ruleConfig, ruleMetadata} = apiService.createRuleFromConfig(
                        ruleData.rule_config,
                        selectedTemplate,
                        {
                            name: importedRuleName + ' (Imported)',
                            description: importedRuleDescription,
                            category: importedRuleCategory,
                            tags: importedRuleTags
                        }
                    );

                    // Save the imported rule using existing API
                    const savedRule = await apiService.saveReconciliationRule(ruleConfig, ruleMetadata);
                    
                    // Refresh the rules list to show the imported rule
                    await loadRules();
                    
                    // Notify parent component
                    if (onRuleSaved) {
                        onRuleSaved(savedRule);
                    }

                    alert(`Successfully imported and saved rule: ${savedRule.name}`);

                } catch (saveError) {
                    console.error('Error saving imported rule:', saveError);
                    alert('Failed to save imported rule: ' + (saveError.message || 'Unknown error'));
                    
                    // Restore original config on error
                    if (onConfigUpdate) {
                        onConfigUpdate(originalConfig);
                    }
                } finally {
                    setLoading(false);
                }

            } catch (error) {
                console.error('Error importing rule:', error);
                alert('Failed to import rule: Invalid file format');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">
                            {loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Rule Management'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-gray-600"
                        >
                            <X size={20}/>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 mt-3">
                        <button
                            onClick={() => setActiveTab('load')}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${
                                activeTab === 'load'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            <Upload size={16} className="inline mr-1"/>
                            Load Rule
                        </button>
                        <button
                            onClick={() => setActiveTab('save')}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${
                                activeTab === 'save'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            <Save size={16} className="inline mr-1"/>
                            {loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Save Rule'}
                        </button>
                        <button
                            onClick={() => setActiveTab('import-export')}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${
                                activeTab === 'import-export'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            <Download size={16} className="inline mr-1"/>
                            Import/Export
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{maxHeight: 'calc(90vh - 140px)'}}>
                    {activeTab === 'load' && (
                        <div className="space-y-4">
                            {/* Search and Filters */}
                            <div className="flex space-x-4 mb-4">
                                <div className="flex-1 relative">
                                    <Search size={16}
                                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                                    <input
                                        type="text"
                                        placeholder="Search rules..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Rules List */}
                            {loading ? (
                                <div className="text-center py-8">
                                    <div
                                        className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="text-gray-500 mt-2">Loading rules...</p>
                                </div>
                            ) : filteredRules.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">
                                        {searchTerm || selectedCategory !== 'all'
                                            ? 'No rules match your filters'
                                            : 'No saved rules found'
                                        }
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('save')}
                                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        Save your first rule →
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredRules.map(rule => (
                                        <div key={rule.id}
                                             className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <h3 className="font-medium text-gray-800">{rule.name}</h3>
                                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                                            rule.category === 'reconciliation' ? 'bg-blue-100 text-blue-800' :
                                                                rule.category === 'transformation' ? 'bg-purple-100 text-purple-800' :
                                                                    rule.category === 'delta' ? 'bg-orange-100 text-orange-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {rule.category}
                                                        </span>
                                                        {rule.usage_count > 0 && (
                                                            <span
                                                                className="flex items-center space-x-1 text-xs text-gray-500">
                                                                <Star size={12}/>
                                                                <span>{rule.usage_count}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {rule.description && (
                                                        <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                                                    )}

                                                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                        <span className="flex items-center space-x-1">
                                                            <Calendar size={12}/>
                                                            <span>{new Date(rule.created_at).toLocaleDateString()}</span>
                                                        </span>
                                                        {rule.last_used_at && (
                                                            <span className="flex items-center space-x-1">
                                                                <Clock size={12}/>
                                                                <span>Used {new Date(rule.last_used_at).toLocaleDateString()}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {rule.tags && rule.tags.length > 0 && (
                                                        <div className="flex items-center space-x-1 mt-2">
                                                            <Tag size={12} className="text-gray-400"/>
                                                            {rule.tags.slice(0, 3).map(tag => (
                                                                <span key={tag}
                                                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {rule.tags.length > 3 && (
                                                                <span
                                                                    className="text-xs text-gray-500">+{rule.tags.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center space-x-2 ml-4">
                                                    <button
                                                        onClick={() => setShowRuleDetails(rule)}
                                                        className="p-2 text-gray-400 hover:text-gray-600"
                                                        title="View details"
                                                    >
                                                        <Eye size={16}/>
                                                    </button>
                                                    <button
                                                        onClick={() => handleLoadRule(rule)}
                                                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                                        disabled={loading}
                                                    >
                                                        Load
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        className="p-2 text-red-400 hover:text-red-600"
                                                        title="Delete rule"
                                                        disabled={loading}
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'save' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-800 mb-4">
                                    {loadedRuleId && hasUnsavedChanges ? 'Update Rule Configuration' : 'Save Current Configuration as Rule'}
                                </h3>

                                {saveErrors.length > 0 && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <AlertCircle size={16} className="text-red-600"/>
                                            <span className="text-sm font-medium text-red-800">Please fix the following errors:</span>
                                        </div>
                                        <ul className="text-sm text-red-700 list-disc list-inside">
                                            {saveErrors.map((error, index) => (
                                                <li key={index}>{error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rule Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={saveForm.name}
                                            onChange={(e) => setSaveForm(prev => ({...prev, name: e.target.value}))}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Trade Reconciliation with Amount Extraction"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={saveForm.category}
                                            onChange={(e) => setSaveForm(prev => ({...prev, category: e.target.value}))}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="reconciliation">Reconciliation</option>
                                            <option value="transformation">Transformation</option>
                                            <option value="delta">Delta</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={saveForm.description}
                                        onChange={(e) => setSaveForm(prev => ({...prev, description: e.target.value}))}
                                        rows={3}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Describe what this rule does and when to use it..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tags
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {saveForm.tags.map(tag => (
                                            <span key={tag}
                                                  className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                                <span>{tag}</span>
                                                <button
                                                    onClick={() => removeTag(tag)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <X size={12}/>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            placeholder="Add tag..."
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    addTag(e.target.value.trim());
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                        <div className="flex space-x-1">
                                            {['extraction', 'filtering', 'tolerance'].map(suggestedTag => (
                                                <button
                                                    key={suggestedTag}
                                                    onClick={() => addTag(suggestedTag)}
                                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                >
                                                    {suggestedTag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Rule Summary */}
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                    <h4 className="font-medium text-gray-800 mb-2">Configuration Summary</h4>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <div>• Extraction
                                            rules: {currentConfig.Files?.reduce((total, file) => total + (file.Extract?.length || 0), 0) || 0}</div>
                                        <div>• Filter
                                            rules: {currentConfig.Files?.reduce((total, file) => total + (file.Filter?.length || 0), 0) || 0}</div>
                                        <div>• Reconciliation
                                            rules: {currentConfig.ReconciliationRules?.length || 0}</div>
                                        <div>• File A
                                            columns: {currentConfig.selected_columns_file_a?.length || 0}</div>
                                        <div>• File B
                                            columns: {currentConfig.selected_columns_file_b?.length || 0}</div>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveRule}
                                        disabled={loading || !saveForm.name.trim()}
                                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                                    >
                                        {loading && <div
                                            className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                                        <Save size={16}/>
                                        <span>{loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Save Rule'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'import-export' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-800 mb-4">Import & Export Rules</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Export your current rule configuration to a file or import a previously saved rule from your local computer.
                                </p>
                            </div>

                            {/* Export Section */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                            <Download size={24} className="text-green-600"/>
                                        </div>
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="text-lg font-medium text-green-800 mb-2">Export Rule Configuration</h4>
                                        <p className="text-sm text-green-700 mb-4">
                                            Choose a rule configuration to download as a JSON file that can be shared or imported later.
                                        </p>
                                        
                                        {/* Rule Selection */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-green-700 mb-2">
                                                Select Configuration to Export
                                            </label>
                                            <select
                                                value={selectedRuleForExport?.id || 'current'}
                                                onChange={(e) => {
                                                    if (e.target.value === 'current') {
                                                        setSelectedRuleForExport(null);
                                                    } else {
                                                        const rule = rules.find(r => r.id === e.target.value);
                                                        setSelectedRuleForExport(rule);
                                                    }
                                                }}
                                                className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                            >
                                                <option value="current">Current Working Configuration</option>
                                                {rules.map(rule => (
                                                    <option key={rule.id} value={rule.id}>
                                                        {rule.name} ({rule.category})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Configuration Preview */}
                                        <div className="bg-green-100 p-3 rounded text-sm text-green-700 mb-4">
                                            <div><strong>{selectedRuleForExport ? selectedRuleForExport.name : 'Current Configuration'}:</strong></div>
                                            {selectedRuleForExport ? (
                                                <>
                                                    <div>• Description: {selectedRuleForExport.description || 'No description'}</div>
                                                    <div>• Category: {selectedRuleForExport.category}</div>
                                                    <div>• Created: {new Date(selectedRuleForExport.created_at).toLocaleDateString()}</div>
                                                    <div>• Usage Count: {selectedRuleForExport.usage_count || 0}</div>
                                                    <div>• Extraction Rules: {selectedRuleForExport.rule_config.Files?.reduce((total, file) => total + (file.Extract?.length || 0), 0) || 0}</div>
                                                    <div>• Filter Rules: {selectedRuleForExport.rule_config.Files?.reduce((total, file) => total + (file.Filter?.length || 0), 0) || 0}</div>
                                                    <div>• Reconciliation Rules: {selectedRuleForExport.rule_config.ReconciliationRules?.length || 0}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>• Extraction Rules: {currentConfig.Files?.reduce((total, file) => total + (file.Extract?.length || 0), 0) || 0}</div>
                                                    <div>• Filter Rules: {currentConfig.Files?.reduce((total, file) => total + (file.Filter?.length || 0), 0) || 0}</div>
                                                    <div>• Reconciliation Rules: {currentConfig.ReconciliationRules?.length || 0}</div>
                                                    <div>• Selected Columns: {(currentConfig.selected_columns_file_a?.length || 0) + (currentConfig.selected_columns_file_b?.length || 0)}</div>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleExportRule(selectedRuleForExport)}
                                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            <Download size={16}/>
                                            <span>Export {selectedRuleForExport ? 'Selected Rule' : 'Current Configuration'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Import Section */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <Upload size={24} className="text-blue-600"/>
                                        </div>
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="text-lg font-medium text-blue-800 mb-2">Import & Save Rule from File</h4>
                                        <p className="text-sm text-blue-700 mb-4">
                                            Upload a previously exported rule configuration file to save it as a new rule in your rule library and apply its settings.
                                        </p>
                                        <div className="bg-blue-100 p-3 rounded text-sm text-blue-700 mb-4">
                                            <div><strong>Import Process:</strong></div>
                                            <div>• JSON files exported from this application</div>
                                            <div>• Rule will be saved to your rule library automatically</div>
                                            <div>• Configuration will be applied to your current session</div>
                                            <div>• Imported rule name will have "(Imported)" suffix</div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleImportRule}
                                                className="hidden"
                                                id="import-rule-file"
                                            />
                                            <label
                                                htmlFor="import-rule-file"
                                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                                            >
                                                <Upload size={16}/>
                                                <span>Import & Save Rule</span>
                                            </label>
                                            <span className="text-sm text-gray-500">
                                                Select a .json rule file to import and save
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tips */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle size={16} className="text-yellow-600 mt-1 flex-shrink-0"/>
                                    <div>
                                        <h5 className="text-sm font-medium text-yellow-800 mb-1">Tips for Import/Export</h5>
                                        <ul className="text-sm text-yellow-700 space-y-1">
                                            <li>• Exported files contain complete rule configurations including extraction, filter, and reconciliation rules</li>
                                            <li>• Importing automatically saves the rule to your library and applies the configuration</li>
                                            <li>• Configuration files are portable and can be shared between different teams and systems</li>
                                            <li>• Imported rules are saved with "(Imported)" suffix to distinguish them from original rules</li>
                                            <li>• Always verify imported configurations before running reconciliation processes</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rule Details Modal */}
                {showRuleDetails && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
                        <div
                            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-800">Rule Details</h3>
                                    <button
                                        onClick={() => setShowRuleDetails(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={20}/>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto" style={{maxHeight: 'calc(80vh - 80px)'}}>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-medium text-gray-800 mb-2">{showRuleDetails.name}</h4>
                                        <p className="text-sm text-gray-600">{showRuleDetails.description || 'No description provided'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Category:</span>
                                            <span className="ml-2 text-gray-600">{showRuleDetails.category}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Usage Count:</span>
                                            <span className="ml-2 text-gray-600">{showRuleDetails.usage_count}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Created:</span>
                                            <span
                                                className="ml-2 text-gray-600">{new Date(showRuleDetails.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Updated:</span>
                                            <span
                                                className="ml-2 text-gray-600">{new Date(showRuleDetails.updated_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {showRuleDetails.tags && showRuleDetails.tags.length > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700 block mb-2">Tags:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {showRuleDetails.tags.map(tag => (
                                                    <span key={tag}
                                                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h5 className="font-medium text-gray-700 mb-2">Configuration Summary:</h5>
                                        <div className="bg-gray-50 p-3 rounded text-sm">
                                            <div>• Extraction
                                                Rules: {showRuleDetails.rule_config.Files?.reduce((total, file) => total + (file.Extract?.length || 0), 0) || 0}</div>
                                            <div>• Filter
                                                Rules: {showRuleDetails.rule_config.Files?.reduce((total, file) => total + (file.Filter?.length || 0), 0) || 0}</div>
                                            <div>• Reconciliation
                                                Rules: {showRuleDetails.rule_config.ReconciliationRules?.length || 0}</div>
                                        </div>
                                    </div>

                                    {showRuleDetails.rule_config.ReconciliationRules && showRuleDetails.rule_config.ReconciliationRules.length > 0 && (
                                        <div>
                                            <h5 className="font-medium text-gray-700 mb-2">Reconciliation Rules:</h5>
                                            <div className="space-y-2">
                                                {showRuleDetails.rule_config.ReconciliationRules.map((rule, index) => (
                                                    <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                                                        <div>Match: {rule.LeftFileColumn} ↔ {rule.RightFileColumn}</div>
                                                        <div>Type: {rule.MatchType} {rule.ToleranceValue ? `(tolerance: ${rule.ToleranceValue})` : ''}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50">
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => setShowRuleDetails(null)}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowRuleDetails(null);
                                            handleLoadRule(showRuleDetails);
                                        }}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                        disabled={loading}
                                    >
                                        Load This Rule
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RuleSaveLoad;