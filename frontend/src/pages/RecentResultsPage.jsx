// src/pages/RecentResultsPage.jsx - Detailed Recent Results View
import React, {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle,
    Clock,
    Database,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    GitCompare,
    Loader,
    PieChart,
    RefreshCw,
    Search,
    Server,
    Settings,
    Shuffle,
    TrendingUp,
    Zap
} from 'lucide-react';
import {apiService} from '../services/defaultApi.js';
import {deltaApiService} from '../services/deltaApiService';
import RulesTab from "../components/rules/RulesTab.jsx";

const RecentResultsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // State management
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, delta, reconciliation
    const [sortBy, setSortBy] = useState('created_at'); // created_at, process_type, status
    const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
    const [selectedResult, setSelectedResult] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [stats, setStats] = useState({});

    // Check if a specific result should be highlighted (from URL params)
    const highlightResultId = searchParams.get('highlight');

    // Load results on component mount
    useEffect(() => {
        loadRecentResults();
    }, []);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(loadRecentResults, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadRecentResults = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load recent results (increase limit for detailed view)
            const response = await apiService.getRecentResults(50);

            if (response.success) {
                setResults(response.results);
                calculateStats(response.results);
            } else {
                throw new Error(response.message || 'Failed to load results');
            }
        } catch (err) {
            console.error('Error loading recent results:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (resultsData) => {
        const totalResults = resultsData.length;
        const deltaResults = resultsData.filter(r => r.process_type === 'delta').length;
        const reconciliationResults = resultsData.filter(r => r.process_type === 'reconciliation').length;
        const fileGenerationResults = resultsData.filter(r => r.process_type === 'file_generation').length;
        const completedResults = resultsData.filter(r => r.status === 'completed').length;
        const processingResults = resultsData.filter(r => r.status === 'processing').length;
        const failedResults = resultsData.filter(r => r.status === 'failed').length;

        // Calculate success rate
        const successRate = totalResults > 0 ? ((completedResults / totalResults) * 100).toFixed(1) : 0;

        // Calculate recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentResults = resultsData.filter(r => new Date(r.created_at) > oneDayAgo).length;

        setStats({
            total: totalResults,
            delta: deltaResults,
            reconciliation: reconciliationResults,
            fileGeneration: fileGenerationResults,
            completed: completedResults,
            processing: processingResults,
            failed: failedResults,
            successRate: successRate,
            recent24h: recentResults
        });
    };

    // Helper function to get process type info
    const getProcessTypeInfo = (result) => {
        if (result.process_type === 'delta') {
            return {
                icon: GitCompare,
                color: 'purple',
                label: 'Delta Generation',
                id: result.id,
                type: 'delta'
            };
        } else if (result.process_type === 'reconciliation') {
            return {
                icon: Shuffle,
                color: 'blue',
                label: 'Reconciliation',
                id: result.id,
                type: 'reconciliation'
            };
        } else if (result.process_type === 'file_generation') {
            return {
                icon: Zap,
                color: 'green',
                label: 'AI File Generation',
                id: result.id,
                type: 'file_generation'
            };
        } else {
            return {
                icon: Settings,
                color: 'gray',
                label: result.process_type || 'Processing',
                id: result.id,
                type: 'other'
            };
        }
    };

    // Filter and sort results
    const filteredResults = results
        .filter(result => {
            // Apply search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    result.id.toLowerCase().includes(searchLower) ||
                    (result.file_a && result.file_a.toLowerCase().includes(searchLower)) ||
                    (result.file_b && result.file_b.toLowerCase().includes(searchLower)) ||
                    result.process_type.toLowerCase().includes(searchLower)
                );
            }
            return true;
        })
        .filter(result => {
            // Apply type filter
            if (filterType === 'all') return true;
            return result.process_type === filterType;
        })
        .sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'created_at':
                    aValue = new Date(a.created_at);
                    bValue = new Date(b.created_at);
                    break;
                case 'process_type':
                    aValue = a.process_type;
                    bValue = b.process_type;
                    break;
                case 'status':
                    aValue = a.status;
                    bValue = b.status;
                    break;
                default:
                    aValue = a.created_at;
                    bValue = b.created_at;
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

    // Open result details in modal
    const openResultDetails = async (result) => {
        setSelectedResult(result);
        setShowDetailModal(true);
    };

    // Download result
    const handleDownload = async (resultId, downloadType, processType) => {
        try {
            if (processType === 'delta') {
                await deltaApiService.downloadDeltaResults(resultId, 'csv', downloadType);
            } else {
                // Handle reconciliation downloads via apiService
                console.log('Reconciliation download:', resultId, downloadType);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert(`Download failed: ${error.message}`);
        }
    };

    // Save to server
    const handleSaveToServer = async (resultId, downloadType, processType) => {
        try {
            if (processType === 'delta') {
                await deltaApiService.saveDeltaResultsToServer(resultId, downloadType, 'csv');
            } else {
                await deltaApiService.saveReconciliationResultsToServer(resultId, downloadType, 'csv');
            }
            alert('Results saved to server successfully!');
        } catch (error) {
            console.error('Save error:', error);
            alert(`Save failed: ${error.message}`);
        }
    };

    // Get status badge
    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1"/>
                        Completed
                    </span>
                );
            case 'processing':
                return (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3 mr-1 animate-pulse"/>
                        Processing
                    </span>
                );
            case 'failed':
                return (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertCircle className="w-3 h-3 mr-1"/>
                        Failed
                    </span>
                );
            default:
                return (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Clock className="w-3 h-3 mr-1"/>
                        {status || 'Unknown'}
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate('/')}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2"/>
                                Back to Main
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Recent Results</h1>
                                <p className="text-sm text-gray-500">Detailed view of all recent processes</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={loadRecentResults}
                                disabled={loading}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}/>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Statistics Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <Database className="h-6 w-6 text-gray-400"/>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Total Results</dt>
                                        <dd className="text-lg font-medium text-gray-900">{stats.total || 0}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <TrendingUp className="h-6 w-6 text-green-400"/>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                                        <dd className="text-lg font-medium text-gray-900">{stats.successRate || 0}%</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <Activity className="h-6 w-6 text-blue-400"/>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Last 24h</dt>
                                        <dd className="text-lg font-medium text-gray-900">{stats.recent24h || 0}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <PieChart className="h-6 w-6 text-purple-400"/>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Processing</dt>
                                        <dd className="text-lg font-medium text-gray-900">{stats.processing || 0}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                    placeholder="Search results..."
                                />
                            </div>

                            {/* Type Filter */}
                            <div>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                >
                                    <option value="all">All Types</option>
                                    <option value="delta">Delta Generation</option>
                                    <option value="reconciliation">Reconciliation</option>
                                    <option value="file_generation">AI File Generation</option>
                                </select>
                            </div>

                            {/* Sort By */}
                            <div>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                >
                                    <option value="created_at">Sort by Date</option>
                                    <option value="process_type">Sort by Type</option>
                                    <option value="status">Sort by Status</option>
                                </select>
                            </div>

                            {/* Sort Order */}
                            <div>
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                >
                                    <option value="desc">Newest First</option>
                                    <option value="asc">Oldest First</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results List */}
                {loading ? (
                    <div className="bg-white shadow rounded-lg p-8">
                        <div className="text-center">
                            <Loader className="mx-auto h-12 w-12 text-gray-400 animate-spin"/>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Loading results...</h3>
                            <p className="mt-1 text-sm text-gray-500">Please wait while we fetch your recent
                                processes</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-white shadow rounded-lg p-8">
                        <div className="text-center">
                            <AlertCircle className="mx-auto h-12 w-12 text-red-400"/>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Results</h3>
                            <p className="mt-1 text-sm text-gray-500">{error}</p>
                            <button
                                onClick={loadRecentResults}
                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <RefreshCw className="w-4 h-4 mr-2"/>
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="bg-white shadow rounded-lg p-8">
                        <div className="text-center">
                            <FileText className="mx-auto h-12 w-12 text-gray-400"/>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm || filterType !== 'all'
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'No recent processes found. Start a process to see results here.'
                                }
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                        <ul className="divide-y divide-gray-200">
                            {filteredResults.map((result) => {
                                const processInfo = getProcessTypeInfo(result);
                                const ProcessIcon = processInfo.icon;
                                const isHighlighted = highlightResultId === result.id;

                                return (
                                    <li
                                        key={result.id}
                                        className={`${isHighlighted ? 'bg-blue-50 border-l-4 border-blue-400' : ''}`}
                                    >
                                        <div className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div
                                                        className={`flex-shrink-0 w-10 h-10 bg-${processInfo.color}-100 rounded-full flex items-center justify-center`}>
                                                        <ProcessIcon
                                                            className={`w-5 h-5 text-${processInfo.color}-600`}/>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-3">
                                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                                {processInfo.label}
                                                            </p>
                                                            {getStatusBadge(result.status)}
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-500">
                                                            ID: {result.id}
                                                        </p>
                                                        <div className="mt-2 flex items-center text-sm text-gray-500">
                                                            <Calendar
                                                                className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400"/>
                                                            {new Date(result.created_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => openResultDetails(result)}
                                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                    >
                                                        <Eye className="w-4 h-4 mr-2"/>
                                                        Details
                                                    </button>
                                                </div>
                                            </div>

                                            {/* File Information */}
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {result.file_a && (
                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <div className="text-xs font-medium text-gray-500 mb-1">
                                                            {processInfo.type === 'delta' ? 'Older File' : 'File A'}
                                                        </div>
                                                        <div className="text-sm text-gray-900 truncate"
                                                             title={result.file_a}>
                                                            📄 {result.file_a}
                                                        </div>
                                                    </div>
                                                )}
                                                {result.file_b && (
                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <div className="text-xs font-medium text-gray-500 mb-1">
                                                            {processInfo.type === 'delta' ? 'Newer File' : 'File B'}
                                                        </div>
                                                        <div className="text-sm text-gray-900 truncate"
                                                             title={result.file_b}>
                                                            📄 {result.file_b}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Summary Statistics */}
                                            {result.summary && result.status === 'completed' && (
                                                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                                                    <h4 className="text-sm font-medium text-gray-900 mb-3">Summary
                                                        Statistics</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {processInfo.type === 'delta' ? (
                                                            <>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-green-600">
                                                                        {(result.summary.unchanged_records || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Unchanged
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-orange-600">
                                                                        {(result.summary.amended_records || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Amended</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-lg font-semibold text-red-600">
                                                                        {(result.summary.deleted_records || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Deleted</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-purple-600">
                                                                        {(result.summary.newly_added_records || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Added</div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-green-600">
                                                                        {(result.summary.match_percentage || 0).toFixed(1)}%
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Match Rate
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-blue-600">
                                                                        {(result.summary.matched_records || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">Matched</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-orange-600">
                                                                        {(result.summary.unmatched_file_a || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">A Only</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div
                                                                        className="text-lg font-semibold text-purple-600">
                                                                        {(result.summary.unmatched_file_b || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">B Only</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Quick Actions */}
                                            {result.status === 'completed' && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => handleDownload(result.id, 'all', processInfo.type)}
                                                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                    >
                                                        <Download className="w-3 h-3 mr-1"/>
                                                        Download All
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveToServer(result.id, 'all', processInfo.type)}
                                                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                    >
                                                        <Server className="w-3 h-3 mr-1"/>
                                                        Save to Server
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(result.id, 'all_excel', processInfo.type)}
                                                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                    >
                                                        <FileSpreadsheet className="w-3 h-3 mr-1"/>
                                                        Excel Export
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* Result Details Modal */}
                {showDetailModal && selectedResult && (
                    <ResultDetailModal
                        result={selectedResult}
                        onClose={() => setShowDetailModal(false)}
                        onDownload={handleDownload}
                        onSaveToServer={handleSaveToServer}
                    />
                )}
            </div>
        </div>
    );
};

// Result Detail Modal Component
const ResultDetailModal = ({result, onClose, onDownload, onSaveToServer}) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [detailedData, setDetailedData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const processInfo = result.process_type === 'delta'
        ? {icon: GitCompare, color: 'purple', label: 'Delta Generation', type: 'delta'}
        : {icon: Shuffle, color: 'blue', label: 'Reconciliation', type: 'reconciliation'};

    useEffect(() => {
        if (activeTab === 'data' && !detailedData) {
            loadDetailedData();
        }
    }, [activeTab]);

    const loadDetailedData = async () => {
        setLoadingDetails(true);
        try {
            if (processInfo.type === 'delta') {
                const data = await deltaApiService.getDeltaResults(result.id, 'all', 1, 100);
                setDetailedData(data);
            } else {
                // Load reconciliation detailed data
                console.log('Loading reconciliation detailed data...');
            }
        } catch (error) {
            console.error('Error loading detailed data:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const ProcessIcon = processInfo.icon;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div
                            className={`w-10 h-10 bg-${processInfo.color}-100 rounded-full flex items-center justify-center`}>
                            <ProcessIcon className={`w-5 h-5 text-${processInfo.color}-600`}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">{processInfo.label} Details</h3>
                            <p className="text-sm text-gray-500">ID: {result.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="mt-4">
                    <nav className="flex space-x-8" aria-label="Tabs">
                        {['overview', 'summary', 'data', 'actions', 'rules'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`${
                                    activeTab === tab
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm capitalize`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Basic Information */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">Process Information</h4>
                                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Process Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{processInfo.label}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{result.status}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Created At</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{new Date(result.created_at).toLocaleString()}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Processing Time</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {result.processing_time_seconds ? `${result.processing_time_seconds}s` : 'N/A'}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Files */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">Files</h4>
                                <div className="space-y-3">
                                    {result.file_a && (
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">
                                                {processInfo.type === 'delta' ? 'Older File' : 'File A'}
                                            </dt>
                                            <dd className="mt-1 text-sm text-gray-900 bg-white rounded px-3 py-2 border">
                                                📄 {result.file_a}
                                            </dd>
                                        </div>
                                    )}
                                    {result.file_b && (
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">
                                                {processInfo.type === 'delta' ? 'Newer File' : 'File B'}
                                            </dt>
                                            <dd className="mt-1 text-sm text-gray-900 bg-white rounded px-3 py-2 border">
                                                📄 {result.file_b}
                                            </dd>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'summary' && result.summary && (
                        <div className="space-y-6">
                            {processInfo.type === 'delta' ? (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">Delta Generation Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-green-600">
                                                {(result.summary.unchanged_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-green-600 font-medium">Unchanged Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Records that remained the same
                                            </div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {(result.summary.amended_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-orange-600 font-medium">Amended Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Records that were modified</div>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-red-600">
                                                {(result.summary.deleted_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-red-600 font-medium">Deleted Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Records removed from newer
                                                file
                                            </div>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-purple-600">
                                                {(result.summary.newly_added_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-purple-600 font-medium">Newly Added</div>
                                            <div className="text-xs text-gray-500 mt-1">Records added to newer file
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : processInfo.type === 'file_generation' ? (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">AI File Generation
                                        Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {(result.summary.total_input_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-blue-600 font-medium">Input Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Original source records</div>
                                        </div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-green-600">
                                                {(result.summary.total_output_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-green-600 font-medium">Output Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Generated records</div>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-purple-600">
                                                {(result.summary.columns_generated?.length || 0)}
                                            </div>
                                            <div className="text-sm text-purple-600 font-medium">Columns Generated</div>
                                            <div className="text-xs text-gray-500 mt-1">Output file columns</div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {(result.summary.row_multiplication_factor || result.row_multiplication_factor || 1)}x
                                            </div>
                                            <div className="text-sm text-orange-600 font-medium">Multiplication Factor
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">Rows per source record</div>
                                        </div>
                                    </div>
                                    {result.summary.rules_description && (
                                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                            <div className="text-sm font-medium text-gray-900 mb-2">Generation Rules
                                                Applied:
                                            </div>
                                            <div
                                                className="text-sm text-gray-700">{result.summary.rules_description}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">Reconciliation Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-green-600">
                                                {(result.summary.match_percentage || 0).toFixed(1)}%
                                            </div>
                                            <div className="text-sm text-green-600 font-medium">Match Rate</div>
                                            <div className="text-xs text-gray-500 mt-1">Overall matching percentage
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {(result.summary.matched_records || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-blue-600 font-medium">Matched Records</div>
                                            <div className="text-xs text-gray-500 mt-1">Successfully matched records
                                            </div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {(result.summary.unmatched_file_a || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-orange-600 font-medium">File A Only</div>
                                            <div className="text-xs text-gray-500 mt-1">Records only in File A</div>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-purple-600">
                                                {(result.summary.unmatched_file_b || 0).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-purple-600 font-medium">File B Only</div>
                                            <div className="text-xs text-gray-500 mt-1">Records only in File B</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            {loadingDetails ? (
                                <div className="text-center py-8">
                                    <Loader className="mx-auto h-8 w-8 text-gray-400 animate-spin"/>
                                    <p className="mt-2 text-sm text-gray-500">Loading detailed data...</p>
                                </div>
                            ) : detailedData ? (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">Data Preview</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                            <tr>
                                                {detailedData.columns?.map((column, index) => (
                                                    <th key={index}
                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {column}
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                            {detailedData.data?.slice(0, 10).map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {row.map((cell, cellIndex) => (
                                                        <td key={cellIndex}
                                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Showing first 10 rows of {detailedData.total_rows || 0} total rows
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-500">Click "Load Data" to view detailed results</p>
                                    <button
                                        onClick={loadDetailedData}
                                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        Load Data
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="space-y-6">
                            <h4 className="text-lg font-medium text-gray-900">Available Actions</h4>

                            {/* Download Options */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-md font-medium text-gray-900 mb-3">Download Options</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {processInfo.type === 'delta' ? (
                                        <>
                                            <button
                                                onClick={() => onDownload(result.id, 'unchanged', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                Unchanged Records
                                            </button>
                                            <button
                                                onClick={() => onDownload(result.id, 'amended', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                Amended Records
                                            </button>
                                            <button
                                                onClick={() => onDownload(result.id, 'deleted', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                Deleted Records
                                            </button>
                                            <button
                                                onClick={() => onDownload(result.id, 'newly_added', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                Newly Added Records
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => onDownload(result.id, 'matched', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                Matched Records
                                            </button>
                                            <button
                                                onClick={() => onDownload(result.id, 'unmatched_a', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                File A Only
                                            </button>
                                            <button
                                                onClick={() => onDownload(result.id, 'unmatched_b', processInfo.type)}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <Download className="w-4 h-4 mr-2"/>
                                                File B Only
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => onDownload(result.id, 'all_excel', processInfo.type)}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 mr-2"/>
                                        Excel Export (All)
                                    </button>
                                </div>
                            </div>

                            {/* Save to Server Options */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-md font-medium text-gray-900 mb-3">Save to Server</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => onSaveToServer(result.id, 'all', processInfo.type)}
                                        className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
                                    >
                                        <Server className="w-4 h-4 mr-2"/>
                                        Save All Results
                                    </button>
                                    <button
                                        onClick={() => onSaveToServer(result.id, 'summary_report', processInfo.type)}
                                        className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
                                    >
                                        <FileText className="w-4 h-4 mr-2"/>
                                        Save Summary Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'rules' && (
                        <RulesTab
                            result={result}
                            onClose={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentResultsPage;