import React, { useState } from 'react';
import {
    AlertCircle,
    Brain,
    FileText,
    Loader2,
    Sparkles,
    CheckCircle,
    XCircle,
    Info
} from 'lucide-react';

const AIRequirementsStep = ({
    onGenerateConfig,
    onConfigGenerated,
    sourceFiles,
    isGenerating = false,
    generatedConfig = null,
    onUseConfiguration,
    requirements = '',
    onRequirementsChange
}) => {
    const [localRequirements, setLocalRequirements] = useState(requirements);
    const [showExamples, setShowExamples] = useState(false);

    const handleRequirementsChange = (value) => {
        setLocalRequirements(value);
        if (onRequirementsChange) {
            onRequirementsChange(value);
        }
    };

    const handleGenerateConfig = () => {
        if (localRequirements.trim()) {
            onGenerateConfig(localRequirements.trim(), sourceFiles);
        }
    };

    const exampleRequirements = [
        {
            title: "Bank Statement Reconciliation",
            description: "Match bank statements with internal transaction records",
            text: "Reconcile bank statements with internal transaction records based on transaction ID and amount. Use exact matching for transaction IDs and tolerance matching for amounts (within $0.01). Include date validation with 1-day tolerance for settlement differences."
        },
        {
            title: "Invoice Payment Matching",
            description: "Match invoices with payment records",
            text: "Match invoice records with payment data using invoice number as primary key and amount as secondary validation. Apply fuzzy matching for customer names to handle slight variations. Filter out cancelled invoices from reconciliation."
        },
        {
            title: "Accounts Payable Reconciliation",
            description: "Reconcile accounts payable with vendor statements",
            text: "Match accounts payable records with vendor statements using vendor ID and invoice number. Use exact matching for invoice numbers and tolerance matching for amounts (within $1.00). Filter records to include only 'APPROVED' status invoices and exclude credit memos."
        },
        {
            title: "Credit Card Transaction Matching",
            description: "Match credit card transactions with receipts",
            text: "Reconcile credit card transactions with expense receipts based on amount and transaction date. Use tolerance matching for amounts (within $0.50) and date matching with 3-day tolerance. Include merchant name fuzzy matching to handle variations in merchant descriptions."
        },
        {
            title: "Payroll Register Reconciliation",
            description: "Match payroll register with bank transfers",
            text: "Match payroll register entries with bank transfer records using employee ID and pay amount. Use exact matching for employee IDs and tolerance matching for net pay amounts (within $0.01). Filter to include only 'PROCESSED' payroll entries."
        },
        {
            title: "Inventory Cost Reconciliation",
            description: "Reconcile inventory costs between systems",
            text: "Match inventory items between cost accounting and warehouse systems using SKU and quantity. Use exact matching for SKU codes and tolerance matching for unit costs (within 5% tolerance). Filter to include only 'ACTIVE' inventory items."
        },
        {
            title: "Cash Management Reconciliation",
            description: "Reconcile cash positions across accounts",
            text: "Match cash management records with bank account balances using account number and balance date. Use exact matching for account numbers and tolerance matching for balances (within $10.00). Include date matching with same-day requirement."
        },
        {
            title: "Investment Portfolio Matching",
            description: "Match investment holdings with custodian reports",
            text: "Reconcile investment portfolio holdings with custodian reports using security ID and position quantity. Use exact matching for security identifiers (CUSIP/ISIN) and tolerance matching for quantities (within 0.01 shares). Filter to include only 'SETTLED' positions."
        }
    ];

    const renderSourceFilesInfo = () => {
        if (!sourceFiles || sourceFiles.length !== 2) {
            return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="text-amber-600" size={20} />
                        <span className="text-amber-800">Please select exactly 2 files for reconciliation</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Source Files Selected:</h4>
                <div className="space-y-2">
                    {sourceFiles.map((file, index) => (
                        <div key={file.file_id} className="bg-white rounded border p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900">
                                    File {index + 1}: {file.filename}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {file.totalRows?.toLocaleString()} rows
                                </span>
                            </div>
                            <div className="text-sm text-gray-600">
                                <strong>Columns:</strong> {file.columns?.join(', ')}
                            </div>
                            {file.label && (
                                <div className="text-sm text-blue-600 mt-1">
                                    <strong>Purpose:</strong> {file.label}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderGeneratedConfig = () => {
        if (!generatedConfig) return null;

        const config = generatedConfig.data || generatedConfig;
        const reconciliationRules = config.ReconciliationRules || [];
        const fileAInfo = config.Files?.find(f => f.Name === "FileA");
        const fileBInfo = config.Files?.find(f => f.Name === "FileB");

        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="text-green-600" size={20} />
                        <h4 className="text-sm font-medium text-green-900">AI Configuration Generated</h4>
                    </div>
                    <button
                        onClick={() => onUseConfiguration(config)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                    >
                        Use This Configuration
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Reconciliation Rules Preview */}
                    <div>
                        <h5 className="text-sm font-medium text-gray-900 mb-2">Reconciliation Rules:</h5>
                        <div className="space-y-2">
                            {reconciliationRules.map((rule, index) => (
                                <div key={index} className="bg-white rounded border p-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span>
                                            <strong>Match:</strong> {rule.LeftFileColumn} ↔ {rule.RightFileColumn}
                                        </span>
                                        <span className="text-gray-600">
                                            {rule.MatchType}
                                            {rule.ToleranceValue > 0 && ` (±${rule.ToleranceValue})`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* File Processing Rules */}
                    {(fileAInfo?.Extract?.length > 0 || fileAInfo?.Filter?.length > 0 || 
                      fileBInfo?.Extract?.length > 0 || fileBInfo?.Filter?.length > 0) && (
                        <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Processing Rules:</h5>
                            <div className="grid grid-cols-2 gap-4">
                                {/* File A Rules */}
                                {(fileAInfo?.Extract?.length > 0 || fileAInfo?.Filter?.length > 0) && (
                                    <div className="bg-white rounded border p-2">
                                        <h6 className="text-xs font-medium text-gray-700 mb-1">File A Processing:</h6>
                                        {fileAInfo.Extract?.map((extract, idx) => (
                                            <div key={idx} className="text-xs text-gray-600">
                                                Extract: {extract.ResultColumnName} from {extract.SourceColumn}
                                            </div>
                                        ))}
                                        {fileAInfo.Filter?.map((filter, idx) => (
                                            <div key={idx} className="text-xs text-gray-600">
                                                Filter: {filter.ColumnName} {filter.MatchType} "{filter.Value}"
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* File B Rules */}
                                {(fileBInfo?.Extract?.length > 0 || fileBInfo?.Filter?.length > 0) && (
                                    <div className="bg-white rounded border p-2">
                                        <h6 className="text-xs font-medium text-gray-700 mb-1">File B Processing:</h6>
                                        {fileBInfo.Extract?.map((extract, idx) => (
                                            <div key={idx} className="text-xs text-gray-600">
                                                Extract: {extract.ResultColumnName} from {extract.SourceColumn}
                                            </div>
                                        ))}
                                        {fileBInfo.Filter?.map((filter, idx) => (
                                            <div key={idx} className="text-xs text-gray-600">
                                                Filter: {filter.ColumnName} {filter.MatchType} "{filter.Value}"
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selected Columns */}
                    <div className="text-xs text-gray-600">
                        <div><strong>Selected Columns A:</strong> {config.selected_columns_file_a?.join(', ')}</div>
                        <div><strong>Selected Columns B:</strong> {config.selected_columns_file_b?.join(', ')}</div>
                    </div>
                </div>
            </div>
        );
    };

    const canGenerate = localRequirements.trim() && sourceFiles && sourceFiles.length === 2;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">AI-Powered Reconciliation Configuration</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Describe your reconciliation requirements in natural language, and AI will generate the appropriate configuration.
                    Include details about matching rules, tolerance levels, data filters, and any specific business logic.
                </p>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 rounded-full p-2">
                            <Sparkles className="text-blue-600" size={16} />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">Quick Start Examples</h4>
                            <div className="text-xs text-gray-700 space-y-1">
                                <p>• "Match transactions by ID with exact matching and amounts with $0.01 tolerance"</p>
                                <p>• "Reconcile invoices using invoice number and customer ID, exclude cancelled invoices"</p>
                                <p>• "Match bank records with internal data using reference number and date within 2 days"</p>
                                <p>• "Reconcile payroll using employee ID and net pay amount with $0.01 tolerance"</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {renderSourceFilesInfo()}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reconciliation Requirements
                    </label>
                    <textarea
                        value={localRequirements}
                        onChange={(e) => handleRequirementsChange(e.target.value)}
                        placeholder="Describe your reconciliation requirements in detail. Include:

• What fields should be matched (e.g., transaction ID, account number, amount)
• Matching rules (exact, tolerance, fuzzy, date matching)
• Tolerance levels (e.g., $0.01 for amounts, 3 days for dates)
• Data filters (e.g., exclude cancelled transactions, only process approved records)
• Any special business logic or exceptions

Example: 'Match bank statements with general ledger using transaction reference number (exact match) and amount (tolerance $0.01). Include date matching within 2 business days. Filter out any transactions with status CANCELLED or PENDING.'"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={8}
                        disabled={isGenerating}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setShowExamples(!showExamples)}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                        <Info size={16} />
                        <span>{showExamples ? 'Hide' : 'Show'} Example Requirements</span>
                    </button>

                    <button
                        onClick={handleGenerateConfig}
                        disabled={!canGenerate || isGenerating}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <Sparkles size={16} />
                        )}
                        <span>{isGenerating ? 'Generating...' : 'Generate Configuration'}</span>
                    </button>
                </div>

                {showExamples && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <FileText className="text-gray-600" size={16} />
                            <h4 className="text-sm font-medium text-gray-900">Example Reconciliation Requirements:</h4>
                        </div>
                        <p className="text-xs text-gray-600 mb-4">Click any example below to use it as a template for your requirements.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {exampleRequirements.map((example, index) => (
                                <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-medium text-gray-900">{example.title}</h5>
                                        <button
                                            onClick={() => handleRequirementsChange(example.text)}
                                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200"
                                        >
                                            Use Template
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-3">{example.description}</p>
                                    <div className="text-xs text-gray-700 bg-gray-50 rounded p-2 border-l-2 border-blue-200">
                                        {example.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {renderGeneratedConfig()}

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <Brain className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Tips for Better AI Configuration:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Specify which columns should be used for matching (e.g., "match by transaction ID and amount")</li>
                            <li>Mention tolerance levels for numeric comparisons (e.g., "0.01 tolerance for amounts")</li>
                            <li>Describe any data filtering needs (e.g., "exclude cancelled transactions")</li>
                            <li>Specify date tolerance if needed (e.g., "allow 1-day difference for settlement dates")</li>
                            <li>Mention any data extraction requirements (e.g., "extract date from description field")</li>
                            <li>Be specific about match types: exact, tolerance, fuzzy, or date matching</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIRequirementsStep;