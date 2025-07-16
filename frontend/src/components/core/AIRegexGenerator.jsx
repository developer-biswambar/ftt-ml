// src/components/AIRegexGenerator.jsx - Updated to use backend API
import React, {useEffect, useState} from 'react';
import {AlertCircle, Check, Copy, Lightbulb, Loader2, RefreshCw, Wand2} from 'lucide-react';
import apiService from '../../services/defaultApi.js';

const AIRegexGenerator = ({onRegexGenerated, onClose, sampleText = '', columnName = ''}) => {
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedRegex, setGeneratedRegex] = useState('');
    const [explanation, setExplanation] = useState('');
    const [error, setError] = useState('');
    const [testResults, setTestResults] = useState([]);
    const [copied, setCopied] = useState(false);
    const [commonPatterns, setCommonPatterns] = useState({});
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [suggestion, setSuggestion] = useState(null);
    const [isFallback, setIsFallback] = useState(false);

    // Sample descriptions for different data types
    const sampleDescriptions = [
        "Extract dollar amounts like $1,234.56 or $99.99",
        "Extract dates in format MM/DD/YYYY or MM-DD-YYYY",
        "Extract email addresses",
        "Extract phone numbers in format (123) 456-7890",
        "Extract transaction IDs that start with 'TXN' followed by numbers",
        "Extract ISIN codes (12 character alphanumeric codes)",
        "Extract percentage values like 5.25% or 10%",
        "Extract account numbers that are 8-12 digits long"
    ];

    // Load common patterns on component mount
    useEffect(() => {
        const loadCommonPatterns = async () => {
            setIsLoadingPatterns(true);
            try {
                const response = await apiService.getCommonPatterns();
                if (response.success) {
                    setCommonPatterns(response.patterns);
                }
            } catch (error) {
                console.warn('Could not load common patterns:', error);
            } finally {
                setIsLoadingPatterns(false);
            }
        };

        loadCommonPatterns();
    }, []);

    // Get suggestion when description changes
    useEffect(() => {
        const getSuggestion = async () => {
            if (description.length > 10) {
                try {
                    const response = await apiService.getPatternSuggestions(description);
                    if (response.success && response.has_suggestion) {
                        setSuggestion(response.suggestion);
                    } else {
                        setSuggestion(null);
                    }
                } catch (error) {
                    // Ignore suggestion errors
                    setSuggestion(null);
                }
            } else {
                setSuggestion(null);
            }
        };

        const debounceTimer = setTimeout(getSuggestion, 500);
        return () => clearTimeout(debounceTimer);
    }, [description]);

    const generateRegexWithBackend = async () => {
        if (!description.trim()) {
            setError('Please provide a description of what you want to extract');
            return;
        }

        setIsGenerating(true);
        setError('');
        setGeneratedRegex('');
        setExplanation('');
        setTestResults([]);
        setIsFallback(false);

        try {
            const response = await apiService.generateRegex(
                description.trim(),
                sampleText,
                columnName,
                {source: 'reconciliation_flow'}
            );

            if (response.success) {
                setGeneratedRegex(response.regex);
                setExplanation(response.explanation);
                setIsFallback(response.is_fallback);

                // Test the regex against sample text if provided
                if (sampleText && response.regex) {
                    await testRegexAgainstSample(response.regex, sampleText);
                }
            } else {
                setError(response.error || 'Failed to generate regex');
            }

        } catch (err) {
            console.error('Error generating regex:', err);
            setError(`Failed to generate regex: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const testRegexAgainstSample = async (regex, text) => {
        try {
            const response = await apiService.testRegex(regex, text);

            if (response.success && response.is_valid) {
                setTestResults(response.matches.map(match => ({
                    match: match.match,
                    index: match.index,
                    groups: match.groups || []
                })));
            } else {
                setTestResults([]);
                if (!response.is_valid) {
                    setError('Generated regex is invalid: ' + (response.error || 'Unknown error'));
                }
            }
        } catch (err) {
            setTestResults([]);
            console.warn('Failed to test regex:', err);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(generatedRegex);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleUseRegex = () => {
        if (generatedRegex && onRegexGenerated) {
            onRegexGenerated(generatedRegex);
            // Close the modal immediately after calling the callback
            if (onClose) {
                onClose();
            }
        }
    };

    const fillSampleDescription = (sample) => {
        setDescription(sample);
    };

    const useSuggestion = () => {
        if (suggestion) {
            setGeneratedRegex(suggestion.regex);
            setExplanation(suggestion.explanation);
            // setIsFallback(true);

            if (sampleText) {
                testRegexAgainstSample(suggestion.regex, sampleText);
            }
        }
    };

    const useCommonPattern = (pattern) => {
        setGeneratedRegex(pattern.regex);
        setExplanation(pattern.explanation);
        setIsFallback(true);

        if (sampleText) {
            testRegexAgainstSample(pattern.regex, sampleText);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                            <Wand2 className="text-purple-500" size={24}/>
                            <h3 className="text-xl font-semibold text-gray-800">AI Regex Generator</h3>
                            {isFallback && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                    Fallback Pattern
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Sample Text Preview */}
                    {sampleText && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sample Text from {columnName || 'Column'}:
                            </label>
                            <div
                                className="text-sm text-gray-600 font-mono bg-white p-2 rounded border max-h-20 overflow-y-auto">
                                {sampleText}
                            </div>
                        </div>
                    )}

                    {/* Description Input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Describe what you want to extract:
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            rows={3}
                            placeholder="e.g., Extract dollar amounts including currency symbol and commas, like $1,234.56"
                        />
                    </div>

                    {/* AI Suggestion */}
                    {suggestion && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-800">💡 AI Suggestion Found:</span>
                                <button
                                    onClick={useSuggestion}
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                >
                                    Use This
                                </button>
                            </div>
                            <div className="text-xs text-blue-700">
                                Pattern: <code className="bg-white px-1 rounded">{suggestion.regex}</code>
                            </div>
                            <div className="text-xs text-blue-600 mt-1">{suggestion.explanation}</div>
                        </div>
                    )}

                    {/* Sample Descriptions */}
                    <div className="mb-6">
                        <div className="flex items-center space-x-1 mb-2">
                            <Lightbulb size={16} className="text-yellow-500"/>
                            <span className="text-sm font-medium text-gray-700">Quick Examples:</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {sampleDescriptions.slice(0, 4).map((sample, index) => (
                                <button
                                    key={index}
                                    onClick={() => fillSampleDescription(sample)}
                                    className="text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded border border-blue-200 transition-colors"
                                >
                                    {sample}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Common Patterns */}
                    {Object.keys(commonPatterns).length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center space-x-1 mb-2">
                                <RefreshCw size={16} className="text-green-500"/>
                                <span className="text-sm font-medium text-gray-700">Common Patterns:</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(commonPatterns).slice(0, 6).map(([key, pattern]) => (
                                    <button
                                        key={key}
                                        onClick={() => useCommonPattern(pattern)}
                                        className="text-left text-xs p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                    >
                                        <div
                                            className="font-medium text-gray-800 capitalize">{key.replace('_', ' ')}</div>
                                        <div className="text-gray-600">{pattern.explanation}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={generateRegexWithBackend}
                        disabled={isGenerating || !description.trim()}
                        className="w-full flex items-center justify-center space-x-2 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={20} className="animate-spin"/>
                                <span>Generating Regex with AI...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={20}/>
                                <span>Generate Regex with AI</span>
                            </>
                        )}
                    </button>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0"/>
                            <div className="text-sm text-red-700">{error}</div>
                        </div>
                    )}

                    {/* Generated Regex */}
                    {generatedRegex && (
                        <div className="mt-6 space-y-4">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-green-800">
                                        Generated Regex{isFallback ? ' (Fallback Pattern)' : ' (AI Generated)'}:
                                    </label>
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-800"
                                    >
                                        {copied ? <Check size={14}/> : <Copy size={14}/>}
                                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                                    </button>
                                </div>
                                <div className="font-mono text-sm bg-white p-3 rounded border break-all">
                                    {generatedRegex}
                                </div>
                            </div>

                            {/* Explanation */}
                            {explanation && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <label className="block text-sm font-medium text-blue-800 mb-1">Explanation:</label>
                                    <div className="text-sm text-blue-700">{explanation}</div>
                                </div>
                            )}

                            {/* Test Results */}
                            {testResults.length > 0 && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <label className="block text-sm font-medium text-yellow-800 mb-2">
                                        Test Results ({testResults.length} matches found):
                                    </label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {testResults.map((result, index) => (
                                            <div key={index} className="text-xs font-mono bg-white p-2 rounded border">
                                                <span
                                                    className="text-green-600">Match {index + 1}:</span> {result.match}
                                                {result.groups.length > 0 && (
                                                    <span className="text-blue-600 ml-2">
                                                        Groups: [{result.groups.join(', ')}]
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Use Regex Button */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleUseRegex}
                                    className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                >
                                    Use This Regex
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIRegexGenerator;