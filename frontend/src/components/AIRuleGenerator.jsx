// src/components/AIRuleGenerator.jsx - Simulates OpenAI rule generation
import React, {useState} from 'react';
import {AlertCircle, CheckCircle, Loader, Wand2} from 'lucide-react';

const AIRuleGenerator = ({selectedFiles, onRulesGenerated, onCancel}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [userRequirements, setUserRequirements] = useState('');
    const [generatedRules, setGeneratedRules] = useState(null);
    const [error, setError] = useState(null);

    const generateRules = async () => {
        if (!userRequirements.trim()) {
            setError('Please describe your reconciliation requirements');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Simulate API call to OpenAI
            setTimeout(() => {
                // Mock generated rules based on common patterns
                const mockRules = {
                    "Files": [
                        {
                            "Name": "FileA",
                            "SheetName": "",
                            "Extract": [
                                {
                                    "ResultColumnName": "ExtractedAmount",
                                    "SourceColumn": "Description",
                                    "MatchType": "regex",
                                    "Patterns": [
                                        "\\$?([\\d,]+(?:\\.\\d{2})?)"
                                    ]
                                }
                            ],
                            "Filter": [
                                {
                                    "ColumnName": "Status",
                                    "MatchType": "equals",
                                    "Value": "Settled"
                                }
                            ]
                        },
                        {
                            "Name": "FileB",
                            "SheetName": "",
                            "Extract": [
                                {
                                    "ResultColumnName": "ExtractedAmount",
                                    "SourceColumn": "Details",
                                    "MatchType": "regex",
                                    "Patterns": [
                                        "(?:Amount:?\\s*)?(?:[\\$€£¥₹]\\s*)([\\d,]+(?:\\.\\d{2})?)"
                                    ]
                                }
                            ],
                            "Filter": [
                                {
                                    "ColumnName": "State",
                                    "MatchType": "equals",
                                    "Value": "Complete"
                                }
                            ]
                        }
                    ],
                    "ReconciliationRules": [
                        {
                            "LeftFileColumn": "Reference",
                            "RightFileColumn": "TransactionID",
                            "MatchType": "equals"
                        },
                        {
                            "LeftFileColumn": "ExtractedAmount",
                            "RightFileColumn": "ExtractedAmount",
                            "MatchType": "tolerance",
                            "ToleranceValue": 10
                        }
                    ]
                };

                setGeneratedRules(mockRules);
                setIsGenerating(false);
            }, 3000);

        } catch (err) {
            setError('Failed to generate rules. Please try again.');
            setIsGenerating(false);
        }
    };

    const acceptRules = () => {
        onRulesGenerated(generatedRules);
    };

    const modifyRules = () => {
        // Allow user to modify the generated rules
        setGeneratedRules(null);
    };

    return (
        <div className="bg-white border border-purple-300 rounded-lg p-6 shadow-lg max-w-4xl mx-auto">
            <div className="flex items-center space-x-3 mb-6">
                <div
                    className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <Wand2 className="text-white" size={20}/>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-gray-800">AI Rule Generation</h3>
                    <p className="text-sm text-gray-600">Describe your reconciliation needs and let AI generate the
                        rules</p>
                </div>
            </div>

            {!generatedRules ? (
                <div className="space-y-6">
                    {/* Files Context */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                            <h4 className="font-medium text-gray-800 mb-2">File A: {selectedFiles.fileA?.filename}</h4>
                            <div className="text-sm text-gray-600">
                                <p>Columns: {selectedFiles.fileA?.columns?.join(', ') || 'Loading...'}</p>
                                <p>Rows: {selectedFiles.fileA?.total_rows?.toLocaleString()}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-800 mb-2">File B: {selectedFiles.fileB?.filename}</h4>
                            <div className="text-sm text-gray-600">
                                <p>Columns: {selectedFiles.fileB?.columns?.join(', ') || 'Loading...'}</p>
                                <p>Rows: {selectedFiles.fileB?.total_rows?.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Requirements Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Describe your reconciliation requirements:
                        </label>
                        <textarea
                            value={userRequirements}
                            onChange={(e) => setUserRequirements(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-32"
                            placeholder="Example: I need to reconcile transactions by extracting amounts from description fields and matching by reference numbers. Apply $10 tolerance for amounts and filter for settled transactions only."
                        />
                    </div>

                    {/* Examples */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2">💡 Example Requirements:</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                            <li>• "Extract ISIN codes from descriptions and match with $50 tolerance on amounts"</li>
                            <li>• "Match by transaction ID and apply date tolerance of ±2 days"</li>
                            <li>• "Extract amounts from text fields and match settled transactions only"</li>
                            <li>• "Reconcile by reference numbers with percentage-based tolerance"</li>
                        </ul>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16}/>
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Generate Button */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={generateRules}
                            disabled={isGenerating || !userRequirements.trim()}
                            className="flex items-center space-x-2 px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader size={16} className="animate-spin"/>
                                    <span>Generating Rules...</span>
                                </>
                            ) : (
                                <>
                                    <Wand2 size={16}/>
                                    <span>Generate Rules</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Generated Rules Display */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <CheckCircle size={16} className="text-green-600"/>
                            <h4 className="font-medium text-green-800">Rules Generated Successfully!</h4>
                        </div>

                        {/* Rules Preview */}
                        <div className="space-y-4">
                            <div>
                                <h5 className="font-medium text-gray-800 mb-2">Extraction Rules:</h5>
                                <div className="text-sm text-gray-600 space-y-1">
                                    {generatedRules.Files.map((file, index) => (
                                        <div key={index}>
                                            <span className="font-medium">{file.Name}:</span>
                                            {file.Extract.map((rule, ruleIndex) => (
                                                <div key={ruleIndex} className="ml-4">
                                                    • Extract "{rule.ResultColumnName}" from "{rule.SourceColumn}"
                                                    using {rule.MatchType}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h5 className="font-medium text-gray-800 mb-2">Filter Rules:</h5>
                                <div className="text-sm text-gray-600 space-y-1">
                                    {generatedRules.Files.map((file, index) => (
                                        <div key={index}>
                                            <span className="font-medium">{file.Name}:</span>
                                            {file.Filter.map((rule, ruleIndex) => (
                                                <div key={ruleIndex} className="ml-4">
                                                    • {rule.ColumnName} {rule.MatchType} "{rule.Value}"
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h5 className="font-medium text-gray-800 mb-2">Matching Rules:</h5>
                                <div className="text-sm text-gray-600 space-y-1">
                                    {generatedRules.ReconciliationRules.map((rule, index) => (
                                        <div key={index} className="ml-4">
                                            • Match "{rule.LeftFileColumn}" with "{rule.RightFileColumn}"
                                            using {rule.MatchType}
                                            {rule.ToleranceValue && ` (tolerance: ${rule.ToleranceValue})`}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={modifyRules}
                            className="px-4 py-2 text-purple-600 border border-purple-300 rounded hover:bg-purple-50"
                        >
                            Modify Rules
                        </button>
                        <div className="space-x-2">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={acceptRules}
                                className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                <CheckCircle size={16}/>
                                <span>Use These Rules</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIRuleGenerator;