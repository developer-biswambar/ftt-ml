// src/components/RulesTab.jsx - Rules Tab Component
import React, {useEffect, useState} from 'react';
import {AlertCircle, Download, Grid, List, Loader, RefreshCw, Search, Settings2, SortAsc, SortDesc} from 'lucide-react';
import RuleCard from './RuleCard';
import {apiService} from '../../services/defaultApi.js';


const RulesTab = ({result, onClose}) => {
    const [rulesData, setRulesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState('all'); // all, category, rule_type
    const [sortBy, setSortBy] = useState('name'); // name, created_at, usage_count
    const [sortOrder, setSortOrder] = useState('asc');
    const [viewMode, setViewMode] = useState('cards'); // cards, list

    // Load rules data
    const loadRulesData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getDeltaRule(result.id);
            if (response.success) {
                setRulesData(response.rules);
            } else {
                setError(response.message || 'Failed to load rules');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load rules on mount
    useEffect(() => {
        loadRulesData();
    }, [result.id]);

    // Handle rule update
    const handleUpdateRule = async (ruleId, updatedData) => {
        try {
            const response = await apiService.updateDeltaRule(ruleId, updatedData);
            if (response.success) {
                setRulesData(prevRules =>
                    prevRules.map(rule =>
                        rule.id === ruleId ? {...updatedData} : rule
                    )
                );
                return true;
            } else {
                console.error('Failed to update rule:', response.message);
                return false;
            }
        } catch (error) {
            console.error('Error updating rule:', error);
            return false;
        }
    };

    // Export all rules as JSON
    const handleExportRules = () => {
        if (!rulesData || rulesData.length === 0) return;

        const exportData = {
            result_id: result.id,
            exported_at: new Date().toISOString(),
            total_rules: rulesData.length,
            rules: rulesData
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rules_${result.id}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Export individual rule
    const handleExportSingleRule = (rule) => {
        const exportData = {
            exported_at: new Date().toISOString(),
            rule: rule
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rule_${rule.id}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Filter and sort rules
    const filteredAndSortedRules = rulesData
        .filter(rule => {
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    rule.name.toLowerCase().includes(searchLower) ||
                    rule.description.toLowerCase().includes(searchLower) ||
                    rule.category.toLowerCase().includes(searchLower) ||
                    rule.rule_type.toLowerCase().includes(searchLower) ||
                    (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(searchLower)))
                );
            }
            return true;
        })
        .filter(rule => {
            // Category/type filter
            if (filterBy === 'all') return true;
            return rule.category === filterBy || rule.rule_type === filterBy;
        })
        .sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'created_at':
                    aValue = new Date(a.created_at);
                    bValue = new Date(b.created_at);
                    break;
                case 'usage_count':
                    aValue = a.usage_count || 0;
                    bValue = b.usage_count || 0;
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

    // Get unique categories and rule types for filter dropdown
    const uniqueCategories = [...new Set(rulesData.map(rule => rule.category))];
    const uniqueRuleTypes = [...new Set(rulesData.map(rule => rule.rule_type))];
    const filterOptions = [
        {value: 'all', label: 'All Rules'},
        ...uniqueCategories.map(cat => ({value: cat, label: `Category: ${cat}`})),
        ...uniqueRuleTypes.map(type => ({value: type, label: `Type: ${type}`}))
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-lg font-medium text-gray-900">Process Rules Configuration</h4>
                    <p className="text-sm text-gray-500">
                        {rulesData.length} rule{rulesData.length !== 1 ? 's' : ''} configured for this process
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={loadRulesData}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}/>
                        Refresh
                    </button>
                    <button
                        onClick={handleExportRules}
                        disabled={!rulesData || rulesData.length === 0}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2"/>
                        Export All Rules (JSON)
                    </button>
                </div>
            </div>

            {/* Filters and Controls */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400"/>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Search rules..."
                        />
                    </div>

                    {/* Filter */}
                    <div>
                        <select
                            value={filterBy}
                            onChange={(e) => setFilterBy(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            {filterOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sort By */}
                    <div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            <option value="name">Sort by Name</option>
                            <option value="created_at">Sort by Date</option>
                            <option value="usage_count">Sort by Usage</option>
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div>
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center justify-center w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {sortOrder === 'asc' ? (
                                <SortAsc className="w-4 h-4 mr-2"/>
                            ) : (
                                <SortDesc className="w-4 h-4 mr-2"/>
                            )}
                            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        </button>
                    </div>

                    {/* View Mode */}
                    <div className="flex border border-gray-300 rounded-md">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-l-md ${
                                viewMode === 'cards'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Grid className="w-4 h-4 mr-2"/>
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-r-md border-l ${
                                viewMode === 'list'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <List className="w-4 h-4 mr-2"/>
                            List
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12">
                    <Loader className="mx-auto h-8 w-8 text-gray-400 animate-spin"/>
                    <p className="mt-2 text-sm text-gray-500">Loading rules configuration...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-400"/>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Rules</h3>
                    <p className="mt-1 text-sm text-gray-500">{error}</p>
                    <button
                        onClick={loadRulesData}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <RefreshCw className="w-4 h-4 mr-2"/>
                        Try Again
                    </button>
                </div>
            ) : filteredAndSortedRules.length === 0 ? (
                <div className="text-center py-12">
                    <Settings2 className="mx-auto h-12 w-12 text-gray-400"/>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                        {rulesData.length === 0 ? 'No rules found' : 'No matching rules'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        {rulesData.length === 0
                            ? 'No rules configuration found for this process.'
                            : 'Try adjusting your search or filter criteria.'
                        }
                    </p>
                    {rulesData.length === 0 && (
                        <button
                            onClick={loadRulesData}
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <RefreshCw className="w-4 h-4 mr-2"/>
                            Reload Rules
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Results Count */}
                    <div className="text-sm text-gray-500">
                        Showing {filteredAndSortedRules.length} of {rulesData.length} rules
                    </div>

                    {/* Rules Display */}
                    {viewMode === 'cards' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredAndSortedRules.map((rule) => (
                                <div key={rule.id} className="relative">
                                    <RuleCard
                                        rule={rule}
                                        onUpdateRule={handleUpdateRule}
                                        isEditable={true}
                                    />
                                    {/* Individual Export Button */}
                                    <div className="absolute top-4 right-4">
                                        <button
                                            onClick={() => handleExportSingleRule(rule)}
                                            className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Export this rule"
                                        >
                                            <Download className="w-3 h-3"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                {filteredAndSortedRules.map((rule) => (
                                    <li key={rule.id} className="px-6 py-4 hover:bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-3">
                                                    <div
                                                        className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <Settings2 className="w-4 h-4 text-blue-600"/>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2">
                                                            <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                                                            <span
                                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                {rule.category}
                                                            </span>
                                                            <span
                                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                                {rule.rule_type}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-500">{rule.description}</p>
                                                        <div
                                                            className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                                                            <span>Usage: {rule.usage_count}</span>
                                                            <span>Created: {new Date(rule.created_at).toLocaleDateString()}</span>
                                                            {rule.last_used_at && (
                                                                <span>Last used: {new Date(rule.last_used_at).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                        {rule.tags && rule.tags.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {rule.tags.map((tag, tagIndex) => (
                                                                    <span key={tagIndex}
                                                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleExportSingleRule(rule)}
                                                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                                >
                                                    <Download className="w-3 h-3 mr-1"/>
                                                    Export
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RulesTab;