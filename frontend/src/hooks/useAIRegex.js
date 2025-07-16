// src/hooks/useAIRegex.js - Updated to use backend API
import {useCallback, useState} from 'react';
import apiService from '../services/defaultApi.js';

export const useAIRegex = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [lastGenerated, setLastGenerated] = useState(null);

    const generateRegex = useCallback(async (description, sampleText = '', columnName = '') => {
        if (!description.trim()) {
            setError('Please provide a description');
            return null;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const result = await apiService.generateRegex(
                description.trim(),
                sampleText.trim(),
                columnName.trim(),
                {source: 'useAIRegex_hook'}
            );

            if (result.success) {
                const generatedData = {
                    regex: result.regex,
                    explanation: result.explanation,
                    testCases: result.test_cases || [],
                    timestamp: new Date().toISOString(),
                    originalDescription: description,
                    isFallback: result.is_fallback || false
                };

                setLastGenerated(generatedData);
                return generatedData;
            } else {
                throw new Error(result.error || 'Failed to generate regex');
            }

        } catch (err) {
            const errorMessage = err.message || 'Failed to generate regex';
            setError(errorMessage);
            console.error('AI Regex Generation Error:', err);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const testRegex = useCallback(async (regex, testText) => {
        if (!regex || !testText) return [];

        try {
            const result = await apiService.testRegex(regex, testText);

            if (result.success && result.is_valid) {
                return result.matches.map(match => ({
                    match: match.match,
                    index: match.index,
                    groups: match.groups || [],
                    length: match.length
                }));
            } else {
                console.warn('Regex test failed:', result.error);
                return [];
            }
        } catch (err) {
            console.error('Regex test error:', err);
            return [];
        }
    }, []);

    const validateRegex = useCallback((regex) => {
        try {
            new RegExp(regex);
            return {isValid: true, error: null};
        } catch (err) {
            return {isValid: false, error: err.message};
        }
    }, []);

    const getPatternSuggestions = useCallback(async (description) => {
        try {
            const result = await apiService.getPatternSuggestions(description);
            return result.success ? result.suggestion : null;
        } catch (err) {
            console.warn('Failed to get pattern suggestions:', err);
            return null;
        }
    }, []);

    const getCommonPatterns = useCallback(async () => {
        try {
            const result = await apiService.getCommonPatterns();
            return result.success ? result.patterns : {};
        } catch (err) {
            console.warn('Failed to get common patterns:', err);
            return {};
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setIsGenerating(false);
        setError(null);
        setLastGenerated(null);
    }, []);

    return {
        generateRegex,
        testRegex,
        validateRegex,
        getPatternSuggestions,
        getCommonPatterns,
        isGenerating,
        error,
        lastGenerated,
        clearError,
        reset
    };
};

// Helper function to get common regex patterns (cached for performance)
let cachedPatterns = null;

export const getCommonPatterns = async () => {
    if (cachedPatterns) {
        return cachedPatterns;
    }

    try {
        const result = await apiService.getCommonPatterns();
        if (result.success) {
            cachedPatterns = result.patterns;
            return cachedPatterns;
        }
    } catch (err) {
        console.warn('Failed to load common patterns:', err);
    }

    // Fallback patterns if API fails
    return {
        email: {
            pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
            description: 'Standard email address format',
            examples: ['user@example.com', 'test.email+tag@domain.co.uk']
        },
        phone: {
            pattern: '\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}',
            description: 'US phone number in various formats',
            examples: ['(123) 456-7890', '123-456-7890', '123.456.7890']
        },
        currency: {
            pattern: '\\$([\\d,]+(?:\\.\\d{2})?)',
            description: 'Dollar amounts with optional commas and cents',
            examples: ['$1,234.56', '$99.99', '$1000']
        },
        date: {
            pattern: '\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}',
            description: 'Dates in MM/DD/YYYY or MM-DD-YYYY format',
            examples: ['12/31/2023', '01-15-2024', '3/5/2023']
        }
    };
};

// Helper to suggest patterns based on description
export const suggestPatternType = (description) => {
    const desc = description.toLowerCase();

    if (desc.includes('email')) return 'email';
    if (desc.includes('phone') || desc.includes('telephone')) return 'phone';
    if (desc.includes('dollar') || desc.includes('amount') || desc.includes('currency')) return 'currency';
    if (desc.includes('date') || desc.includes('time')) return 'date';
    if (desc.includes('isin') || desc.includes('security id')) return 'isin';
    if (desc.includes('percent') || desc.includes('%')) return 'percentage';
    if (desc.includes('transaction') || desc.includes('txn')) return 'transaction_id';

    return null;
};