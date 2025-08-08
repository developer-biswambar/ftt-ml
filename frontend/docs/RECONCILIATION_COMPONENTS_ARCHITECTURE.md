# Reconciliation Components Architecture & Developer Guide

## Table of Contents
1. [Overview](#overview)
2. [Component Architecture](#component-architecture)
3. [Main Flow Component: ReconciliationFlow](#main-flow-component-reconciliationflow)
4. [Step Components Deep Dive](#step-components-deep-dive)
5. [Data Flow & State Management](#data-flow--state-management)
6. [API Integration Layer](#api-integration-layer)
7. [AI-Powered Features](#ai-powered-features)
8. [Rule Management System](#rule-management-system)
9. [Configuration Management](#configuration-management)
10. [Error Handling & User Experience](#error-handling--user-experience)
11. [Performance Optimizations](#performance-optimizations)
12. [Development Guidelines](#development-guidelines)
13. [Testing Strategy](#testing-strategy)
14. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

The reconciliation components form a sophisticated 8-step workflow system for financial data reconciliation within the React/FastAPI platform. This system enables users to match records between two financial datasets using configurable rules, AI-powered assistance, and advanced data processing capabilities.

### Key Features
- **8-Step Wizard Interface**: Guided workflow from rule selection to results generation
- **AI-Powered Configuration**: Natural language requirement processing with intelligent rule generation
- **Advanced Data Extraction**: Pattern-based data extraction with AI regex generation
- **Flexible Filtering System**: Multi-condition row-level filtering with Excel-like value selection
- **Sophisticated Matching**: Multiple matching types including tolerance, date, and percentage matching
- **Rule Management**: Save, load, and version reconciliation rule templates
- **Results Integration**: Automatic result storage with viewer integration
- **Real-time Processing**: Live processing feedback with detailed results analytics

### Architecture Philosophy
The reconciliation system follows a modular, extensible architecture with clear separation of concerns:
- **Flow Orchestration**: Central ReconciliationFlow component manages state and navigation
- **Step Isolation**: Each step is an independent component with specific responsibilities
- **Service Integration**: Dedicated API services handle external communication
- **State Management**: Centralized state with predictable data flow patterns
- **AI Integration**: Seamless AI assistance throughout the workflow

---

## Component Architecture

### File Structure Overview
```
frontend/src/components/
├── recon/                              # Reconciliation-specific components
│   ├── ReconciliationFlow.jsx          # Main orchestrator component
│   ├── IntegratedFilterDataStep.jsx    # Data filtering configuration
│   └── ReconciliationPreviewStep.jsx   # Results preview and processing
├── reconciliation/                     # AI and specialized components
│   └── AIRequirementsStep.jsx          # AI configuration generation
├── core/                              # Shared AI components
│   └── AIRegexGenerator.jsx            # AI regex pattern generation
├── rules/                             # Rule management components
│   └── RuleSaveLoad.jsx               # Rule persistence and loading
└── services/                          # API service layer
    ├── aiAssistanceService.js         # AI-powered assistance
    ├── processManagementService.js    # Process orchestration
    ├── deltaApiService.js             # Data operations
    └── ruleManagementService.js       # Rule CRUD operations
```

### Component Hierarchy Visualization
```
ReconciliationFlow (Main Orchestrator)
├── Step 1: Rule Management
│   └── RuleSaveLoad (Modal)
├── Step 2: AI Requirements  
│   └── AIRequirementsStep
├── Step 3: Data Extraction
│   └── AIRegexGenerator (Modal)
├── Step 4: Data Filtering
│   └── IntegratedFilterDataStep
│       ├── FilterValueSelector
│       └── ExtractedColumnFilter
├── Step 5: Reconciliation Rules (Built-in)
├── Step 6: Result Columns (Built-in)
├── Step 7: Review & Configuration (Built-in)
└── Step 8: Generate & View
    └── ReconciliationPreviewStep
```

---

## Main Flow Component: ReconciliationFlow

### Component Purpose
The `ReconciliationFlow.jsx` component serves as the central orchestrator for the entire reconciliation process. It manages the 8-step workflow, maintains all configuration state, and coordinates interactions between steps, AI services, and result generation.

### Core Responsibilities
1. **Workflow Management**: Navigate between 8 distinct steps with validation
2. **State Orchestration**: Manage complex configuration state across multiple domains
3. **API Coordination**: Interface with multiple services for processing and AI assistance
4. **Rule Management**: Handle loading, saving, and versioning of rule templates
5. **Error Handling**: Provide comprehensive error feedback and recovery options
6. **Result Processing**: Generate, store, and provide access to reconciliation results

### State Management Architecture

#### Primary State Categories

##### Configuration State
```javascript
const [config, setConfig] = useState({
    Files: [],                    // Per-file configuration (Extract, Filter rules)
    ReconciliationRules: []       // Moved to separate state for better management
});

const [reconciliationRules, setReconciliationRules] = useState([
    {
        LeftFileColumn: '',       // Column from File A
        RightFileColumn: '',      // Column from File B  
        MatchType: 'equals',      // Matching algorithm
        ToleranceValue: 0         // Numeric tolerance if applicable
    }
]);
```

##### File and Column State
```javascript
const [fileColumns, setFileColumns] = useState({});           // File ID → Column mapping
const [selectedColumnsFileA, setSelectedColumnsFileA] = useState([]);
const [selectedColumnsFileB, setSelectedColumnsFileB] = useState([]);
```

##### AI and Rule Management State
```javascript
const [showAIRegexGenerator, setShowAIRegexGenerator] = useState(false);
const [showRuleSaveLoad, setShowRuleSaveLoad] = useState(false);
const [ruleModalTab, setRuleModalTab] = useState('load');     // 'load' | 'save'
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [loadedRuleId, setLoadedRuleId] = useState(null);
const [currentAIContext, setCurrentAIContext] = useState({
    fileIndex: 0,
    ruleIndex: 0,
    sampleText: '',
    columnName: ''
});
```

##### Processing State
```javascript
const [generatedResults, setGeneratedResults] = useState(null);
const [isProcessing, setIsProcessing] = useState(false);
const [aiRequirements, setAiRequirements] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
const [generatedConfig, setGeneratedConfig] = useState(null);
```

### Step Configuration System

#### Step Definition Structure
```javascript
const steps = [
    {id: 'rule_management', title: 'Load/Save Rules', icon: Save},
    {id: 'ai_requirements', title: 'AI Configuration', icon: Wand2},
    {id: 'extraction_rules', title: 'Data Parsing', icon: Target},
    {id: 'filter_rules', title: 'Data Filtering', icon: Filter},
    {id: 'reconciliation_rules', title: 'Matching Rules', icon: Settings},
    {id: 'result_columns', title: 'Result Columns', icon: Columns},
    {id: 'review', title: 'Review & Confirm', icon: Check},
    {id: 'generate_view', title: 'Generate & View', icon: Upload}
];
```

### Core Helper Functions

#### File Management
```javascript
// Get files in consistent order for processing
const getSelectedFilesArray = () => {
    return Object.keys(selectedFiles)
        .sort()
        .map(key => selectedFiles[key])
        .filter(file => file !== null && file !== undefined);
};

// Access specific file by index
const getFileByIndex = (index) => {
    const key = `file_${index}`;
    return selectedFiles[key];
};

// Generate column availability including extracted columns
const getAllAvailableColumns = (fileIndex) => {
    const file = getFileByIndex(fileIndex);
    const originalColumns = fileColumns[file?.file_id] || [];
    const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(Boolean) || [];
    return [...originalColumns, ...extractedColumns];
};
```

#### Column Classification System
```javascript
// Identify columns required by extraction rules and reconciliation rules
const getMandatoryColumns = (fileIndex) => {
    const mandatoryColumns = new Set();

    // Add extracted columns (with minimum length validation)
    const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(name => name && name.trim().length >= 3) || [];
    extractedColumns.forEach(col => mandatoryColumns.add(col.trim()));

    // Add reconciliation rule columns
    reconciliationRules.forEach(rule => {
        if (fileIndex === 0 && rule.LeftFileColumn && rule.LeftFileColumn.trim().length >= 3) {
            mandatoryColumns.add(rule.LeftFileColumn.trim());
        } else if (fileIndex === 1 && rule.RightFileColumn && rule.RightFileColumn.trim().length >= 3) {
            mandatoryColumns.add(rule.RightFileColumn.trim());
        }
    });

    return Array.from(mandatoryColumns);
};

// Identify optional columns for user selection
const getOptionalColumns = (fileIndex) => {
    const allColumns = getAllAvailableColumns(fileIndex);
    const mandatoryColumns = getMandatoryColumns(fileIndex);
    return allColumns.filter(col => !mandatoryColumns.includes(col));
};
```

### Navigation System

#### Step Navigation Logic
```javascript
const nextStep = async () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
        const nextStepId = steps[currentIndex + 1].id;
        setCurrentStep(nextStepId);
        
        // Trigger processing when reaching generate_view step
        if (nextStepId === 'generate_view') {
            await generateReconciliationResults();
        }
    }
};

const prevStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
        setCurrentStep(steps[currentIndex - 1].id);
    }
};
```

#### Step Validation
```javascript
// Prevent advancement from review step without reconciliation rules
<button
    onClick={nextStep}
    disabled={currentStep === 'review' && reconciliationRules.length === 0}
    className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
>
    <span>{currentStep === 'review' ? 'Generate Results' : 'Next'}</span>
    <ChevronRight size={16}/>
</button>
```

---

## Step Components Deep Dive

### Step 1: Rule Management (Built-in Interface)

#### Purpose and Features
The rule management step provides users with three configuration paths:
1. **AI Configuration**: Natural language requirement processing
2. **Load Existing Rule**: Template-based configuration
3. **Manual Configuration**: Build from scratch

#### Implementation
```javascript
case 'rule_management':
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Choose Configuration Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* AI Configuration Option */}
                <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg h-full flex flex-col">
                    <div className="flex items-center space-x-2 mb-3">
                        <Wand2 size={20} className="text-purple-600"/>
                        <h4 className="text-md font-medium text-purple-800">AI Configuration</h4>
                    </div>
                    <p className="text-sm text-purple-700 mb-4 flex-grow">
                        Describe your requirements and let AI generate the configuration.
                    </p>
                    <button onClick={() => setCurrentStep('ai_requirements')}>
                        Use AI Assistant
                    </button>
                </div>
                {/* Additional options... */}
            </div>
        </div>
    );
```

### Step 2: AI Requirements (AIRequirementsStep Component)

#### Component Location
`/frontend/src/components/reconciliation/AIRequirementsStep.jsx`

#### Key Features
- **Natural Language Processing**: Convert business requirements to technical configuration
- **Predefined Scenarios**: 8 business scenario templates for common use cases
- **Configuration Generation**: AI-powered rule creation with validation
- **Preview and Application**: Review generated configuration before applying

#### Business Scenarios Supported
1. Bank statement reconciliation
2. Invoice matching  
3. Payroll processing
4. Transaction reconciliation
5. Inventory management
6. Account reconciliation
7. Payment processing
8. Custom requirements

#### AI Configuration Flow
```javascript
const handleGenerateAIConfig = async (requirements, sourceFiles) => {
    setIsGenerating(true);
    try {
        // Normalize file data for backend processing
        const normalizedSourceFiles = sourceFiles.map(file => ({
            file_id: file.file_id,
            filename: file.filename,
            columns: file.columns || [],
            totalRows: file.totalRows || file.total_rows || 0,
            label: file.label || ''
        }));

        const response = await aiAssistanceService.generateReconciliationConfig({
            requirements,
            sourceFiles: normalizedSourceFiles
        });
        
        if (response.success) {
            setGeneratedConfig(response.data);
            onSendMessage('system', '✨ AI configuration generated successfully!');
        }
    } catch (error) {
        console.error('AI configuration generation failed:', error);
        onSendMessage('system', `❌ Failed to generate AI configuration: ${error.message}`);
    } finally {
        setIsGenerating(false);
    }
};
```

### Step 3: Data Extraction (Built-in with AI Support)

#### Extraction Rule Structure
```javascript
const extractionRule = {
    ResultColumnName: '',      // Name of the new column to create
    SourceColumn: '',          // Source column to extract from
    MatchType: 'regex',        // Type of extraction: regex, exact, contains, etc.
    Patterns: ['']             // Array of patterns (usually single pattern)
};
```

#### AI Regex Generation Integration
```javascript
const openAIRegexGenerator = (fileIndex, ruleIndex) => {
    const rule = config.Files[fileIndex]?.Extract?.[ruleIndex];
    const sampleText = rule?.SourceColumn ? getSampleTextForColumn(fileIndex, rule.SourceColumn) : '';

    setCurrentAIContext({
        fileIndex,
        ruleIndex,
        sampleText,
        columnName: rule?.SourceColumn || ''
    });
    setShowAIRegexGenerator(true);
};

const handleAIRegexGenerated = (generatedRegex) => {
    const {fileIndex, ruleIndex} = currentAIContext;
    updateExtractionRule(fileIndex, ruleIndex, 'Patterns', generatedRegex);
    updateExtractionRule(fileIndex, ruleIndex, 'MatchType', 'regex');
    onSendMessage('system', '✨ AI generated regex pattern applied to extraction rule');
};
```

#### Sample Data Integration
```javascript
const getSampleTextForColumn = (fileIndex, columnName) => {
    const file = getFileByIndex(fileIndex);
    if (!file || !file.sample_data || !columnName) return '';

    const sampleValues = file.sample_data
        .map(row => row[columnName])
        .filter(val => val && val.toString().trim())
        .slice(0, 3);

    return sampleValues.join(', ');
};
```

### Step 4: Data Filtering (IntegratedFilterDataStep Component)

#### Component Location
`/frontend/src/components/recon/IntegratedFilterDataStep.jsx`

#### Architecture Overview
The filtering system provides Excel-like filtering capabilities with two distinct modes:
1. **Original Columns**: Value selection from actual data with search and pagination
2. **Extracted Columns**: Manual value entry for columns that will be created during processing

#### Key Features
- **Dual Filtering Modes**: Handle existing vs. extracted columns differently
- **Excel-like Value Selection**: Dropdown interfaces with search and multi-select
- **Date Column Detection**: Automatic formatting and handling of date values
- **Real-time Search**: Filter available values by search term
- **Batch Operations**: Select all, clear all, and individual value toggling
- **Performance Optimization**: Caching and pagination for large datasets

#### Filter Data Structure
```javascript
const [fileFilters, setFileFilters] = useState({
    file_0: [                           // File A filters
        {
            column: 'status',           // Column name to filter
            values: ['Active', 'Pending'] // Selected values (OR condition)
        }
    ],
    file_1: [                           // File B filters
        {
            column: 'type',
            values: ['Invoice', 'Credit']
        }
    ]
});
```

#### Original Column Filtering (FilterValueSelector)
```javascript
const FilterValueSelector = ({
    fileId,
    columnName,
    selectedValues,
    onValueToggle,
    onSelectAll,
    onClearAll,
    fetchUniqueValues,
    isLoading,
    colorScheme
}) => {
    const [uniqueValuesData, setUniqueValuesData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Load unique values from API
    const loadUniqueValues = async () => {
        try {
            const data = await fetchUniqueValues();
            setUniqueValuesData(data);
        } catch (error) {
            console.error('Error loading unique values:', error);
        }
    };
    
    // Filter and paginate values for performance
    const filteredValues = unique_values.filter(value =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const displayValues = showAll ? filteredValues : filteredValues.slice(0, 100);
    
    return (
        <div className={`border border-${colorScheme}-200 rounded p-3 bg-white`}>
            {/* Search interface */}
            <div className="relative mb-3">
                <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                <input
                    type="text"
                    placeholder="Search values..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            {/* Values list with checkboxes */}
            <div className="max-h-48 overflow-y-auto space-y-1">
                {displayValues.map((value, index) => (
                    <label key={`${value}-${index}`} className="flex items-center space-x-2 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedValues.includes(value)}
                            onChange={() => onValueToggle(value)}
                        />
                        <span>{value}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};
```

#### Extracted Column Filtering (ExtractedColumnFilter)
```javascript
const ExtractedColumnFilter = ({
    fileIndex,
    columnName,
    selectedValues,
    onValuesChange,
    colorScheme
}) => {
    const [inputValue, setInputValue] = useState('');

    const addValue = () => {
        const trimmedValue = inputValue.trim();
        if (trimmedValue && !selectedValues.includes(trimmedValue)) {
            onValuesChange([...selectedValues, trimmedValue]);
            setInputValue('');
        }
    };

    return (
        <div className={`border border-${colorScheme}-200 rounded p-3 bg-white`}>
            {/* Input for manual value entry */}
            <div className="flex space-x-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addValue()}
                    placeholder="Enter value to filter on..."
                />
                <button
                    onClick={addValue}
                    disabled={!inputValue.trim() || selectedValues.includes(inputValue.trim())}
                >
                    Add
                </button>
            </div>
            
            {/* Selected values management */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedValues.map((value, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>{value}</span>
                        <button onClick={() => removeValue(value)}>
                            <X size={12}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

### Step 5: Reconciliation Rules (Built-in Interface)

#### Rule Configuration Structure
```javascript
const reconciliationRule = {
    LeftFileColumn: '',        // Column from File A
    RightFileColumn: '',       // Column from File B
    MatchType: 'equals',       // Matching algorithm
    ToleranceValue: 0          // Numeric tolerance for tolerance/percentage matches
};
```

#### Supported Match Types
1. **equals**: Exact string matching
2. **tolerance**: Numeric matching with absolute tolerance
3. **date_equals**: Date matching with format normalization
4. **contains**: Substring matching
5. **percentage**: Percentage-based numeric matching

#### Rule Management Interface
```javascript
// Add new reconciliation rule
const addReconciliationRule = () => {
    const newRule = {
        LeftFileColumn: '',
        RightFileColumn: '',
        MatchType: 'equals',
        ToleranceValue: 0
    };
    setReconciliationRules([...reconciliationRules, newRule]);
};

// Update specific rule field
const updateReconciliationRule = (ruleIndex, field, value) => {
    const updatedRules = [...reconciliationRules];
    updatedRules[ruleIndex][field] = value;
    setReconciliationRules(updatedRules);
};

// Remove rule with index management
const removeReconciliationRule = (ruleIndex) => {
    const updatedRules = reconciliationRules.filter((_, index) => index !== ruleIndex);
    setReconciliationRules(updatedRules);
};
```

### Step 6: Result Columns (Built-in Interface)

#### Column Classification System
The result columns step automatically categorizes columns into mandatory and optional:

```javascript
// Mandatory columns (cannot be deselected)
- Columns used in extraction rules (ResultColumnName)
- Columns used in reconciliation rules (LeftFileColumn, RightFileColumn)

// Optional columns (user-selectable)  
- All other original file columns
- Any extracted columns not used in reconciliation
```

#### User Interface Features
```javascript
// File-specific column selection with visual distinction
<div className="grid grid-cols-2 gap-6">
    {/* File A Column Selection */}
    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
                <h4>File A: {getFileByIndex(0)?.filename}</h4>
            </div>
            <div className="flex space-x-2">
                <button onClick={() => selectAllColumns(0)}>Select All</button>
                <button onClick={() => deselectAllColumns(0)}>Clear Optional</button>
            </div>
        </div>
        
        {/* Mandatory columns (disabled checkboxes) */}
        {getMandatoryColumns(0).map(column => (
            <label key={column} className="flex items-center space-x-2 text-sm opacity-75">
                <input type="checkbox" checked={true} disabled={true} />
                <span>{column}</span>
                <span className="text-xs text-green-500">(required)</span>
            </label>
        ))}
        
        {/* Optional columns (interactive checkboxes) */}
        {getOptionalColumns(0).map(column => (
            <label key={column} className="flex items-center space-x-2 text-sm">
                <input
                    type="checkbox"
                    checked={selectedColumnsFileA.includes(column)}
                    onChange={() => toggleColumnSelection(0, column)}
                />
                <span>{column}</span>
            </label>
        ))}
    </div>
    
    {/* File B Column Selection - Similar structure */}
</div>
```

### Step 7: Review & Configuration (Built-in Interface)

#### Configuration Validation System
```javascript
const renderConfigurationStatus = () => {
    return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Configuration Status</h4>
            <div className="space-y-1 text-sm">
                {/* Files validation */}
                <div className="flex items-center space-x-2">
                    <Check size={16} className="text-green-500"/>
                    <span>Files selected</span>
                </div>
                
                {/* Rules validation */}
                <div className="flex items-center space-x-2">
                    {reconciliationRules.length > 0 ? (
                        <Check size={16} className="text-green-500"/>
                    ) : (
                        <AlertCircle size={16} className="text-yellow-500"/>
                    )}
                    <span>Reconciliation rules {reconciliationRules.length > 0 ? 'configured' : 'needed'}</span>
                </div>
                
                {/* Column selection validation */}
                <div className="flex items-center space-x-2">
                    <Check size={16} className="text-green-500"/>
                    <span>Result column selection configured</span>
                </div>
            </div>
        </div>
    );
};
```

#### Rule Saving Interface
```javascript
<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-blue-800">Save This Configuration</h4>
        <button
            onClick={() => openRuleModalForSaving()}
            disabled={reconciliationRules.length === 0}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
            <Save size={14}/>
            <span>{loadedRuleId && hasUnsavedChanges ? 'Update Rule' : 'Save as New Rule'}</span>
        </button>
    </div>
    <p className="text-sm text-blue-700">
        Save this configuration as a reusable rule template.
        {loadedRuleId && hasUnsavedChanges && ' You have unsaved changes to the loaded rule.'}
    </p>
</div>
```

### Step 8: Generate & View (ReconciliationPreviewStep Component)

#### Component Location
`/frontend/src/components/recon/ReconciliationPreviewStep.jsx`

#### Core Responsibilities
1. **Configuration Summary**: Display final configuration overview
2. **Processing Orchestration**: Trigger reconciliation processing
3. **Results Visualization**: Display processing results with analytics
4. **Action Management**: Provide result viewing, saving, and retry options
5. **Error Handling**: Handle processing failures with detailed feedback

#### Processing Results Structure
```javascript
const generatedResults = {
    reconciliation_id: '',           // Unique process identifier
    matched_count: 0,                // Number of matched records
    unmatched_file_a_count: 0,       // Records in File A without matches
    unmatched_file_b_count: 0,       // Records in File B without matches
    total_records_file_a: 0,         // Total records processed from File A
    total_records_file_b: 0,         // Total records processed from File B
    processing_time: 0,              // Processing duration in seconds
    match_percentage: 0,             // Overall match success rate
    errors: [],                      // Processing errors if any
    warnings: [],                    // Processing warnings
    processing_info: {               // Technical processing details
        hash_based_matching: true,   // Performance optimization flags
        optimization_used: true,
        vectorized_extraction: true
    }
};
```

#### Results Visualization Patterns

##### Success Case
```javascript
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {/* Matched Records */}
    <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
            <CheckCircle size={20} className="text-green-600" />
            <span className="text-sm font-medium text-green-800">Matched</span>
        </div>
        <p className="text-2xl font-semibold text-green-900">{matchedCount}</p>
        <p className="text-xs text-green-600">{matchPercentage.toFixed(1)}% match rate</p>
    </div>
    
    {/* Unmatched File A */}
    <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
            <AlertCircle size={20} className="text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Unmatched A</span>
        </div>
        <p className="text-2xl font-semibold text-yellow-900">{unmatchedACount}</p>
        <p className="text-xs text-yellow-600">of {totalFileA} total</p>
    </div>
    
    {/* Additional metrics... */}
</div>
```

##### No Matches Case
```javascript
{hasNoMatches && (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
            <AlertCircle size={24} className="text-blue-600 mt-1 flex-shrink-0" />
            <div>
                <h4 className="font-medium text-blue-800 mb-2">No matching records were found</h4>
                <p className="text-blue-700 text-sm mb-4">
                    The reconciliation process completed successfully, but no records matched using your current rules.
                </p>
                <div className="bg-blue-100 rounded p-3 text-sm">
                    <p className="font-medium text-blue-800 mb-2">This could happen when:</p>
                    <ul className="text-blue-700 space-y-1 list-disc list-inside">
                        <li>The files contain completely different datasets</li>
                        <li>Matching rules are too strict (try adjusting tolerance values)</li>
                        <li>Column names or data formats don't align between files</li>
                        <li>Date formats or case sensitivity cause mismatches</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
)}
```

#### Action Button Management
```javascript
<div className="flex flex-wrap gap-3">
    {/* Conditional "View Matched Results" button */}
    <button
        onClick={matchedCount > 0 ? () => onViewResults(generatedResults.reconciliation_id) : undefined}
        disabled={matchedCount === 0}
        className={`flex items-center space-x-2 px-4 py-2 rounded ${
            matchedCount > 0 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title={matchedCount === 0 ? 'No matched records available to view' : 'View matched records'}
    >
        <Eye size={16} />
        <span>View Matched Results</span>
        <ExternalLink size={14} />
    </button>
    
    {/* "View All Results" button */}
    <button
        onClick={() => onViewResults(generatedResults.reconciliation_id+'_all')}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
        <Eye size={16} />
        <span>View All Results</span>
        <ExternalLink size={14} />
    </button>
    
    {/* Retry and modification options */}
    <button onClick={onRefresh}>Regenerate</button>
    <button onClick={onRetry}>Modify Config</button>
</div>
```

---

## Data Flow & State Management

### State Update Patterns

#### Configuration Updates with History Tracking
```javascript
// Track changes for unsaved rule detection
useEffect(() => {
    if (loadedRuleId) {
        setHasUnsavedChanges(true);
    }
}, [config, reconciliationRules, selectedColumnsFileA, selectedColumnsFileB]);
```

#### Column Selection Synchronization
```javascript
// Automatically update selected columns based on rules
useEffect(() => {
    const updateSelectedColumns = (fileIndex) => {
        const mandatoryColumns = getMandatoryColumns(fileIndex);
        const currentSelected = fileIndex === 0 ? selectedColumnsFileA : selectedColumnsFileB;
        const validMandatoryColumns = mandatoryColumns.filter(col => col && col.trim().length >= 3);
        
        // Clean current selection and add mandatory columns
        const cleanedCurrentSelection = currentSelected.filter(col => {
            const originalColumns = fileColumns[getFileByIndex(fileIndex)?.file_id] || [];
            const isOriginalColumn = originalColumns.includes(col);
            const isValidMandatory = validMandatoryColumns.includes(col);
            const isPartialName = validMandatoryColumns.some(validCol =>
                validCol !== col && validCol.startsWith(col) && col.length < validCol.length
            );
            return isValidMandatory || isOriginalColumn || !isPartialName;
        });
        
        const updatedSelection = [...new Set([...cleanedCurrentSelection, ...validMandatoryColumns])];

        if (fileIndex === 0) {
            setSelectedColumnsFileA(updatedSelection);
        } else {
            setSelectedColumnsFileB(updatedSelection);
        }
    };

    // Debounce updates to prevent excessive re-renders
    const timeoutId = setTimeout(() => {
        updateSelectedColumns(0);
        updateSelectedColumns(1);
    }, 500);

    return () => clearTimeout(timeoutId);
}, [config, reconciliationRules]);
```

### Processing Orchestration

#### Main Reconciliation Processing
```javascript
const generateReconciliationResults = async () => {
    setIsProcessing(true);
    try {
        const filesArray = getSelectedFilesArray();
        const finalConfig = {
            process_type: 'reconciliation',
            process_name: 'Custom Reconciliation Process',
            user_requirements: 'Reconcile files using the configured rules',
            files: filesArray.map((file, index) => ({
                file_id: file.file_id,
                role: `file_${index}`,
                label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
            })),
            reconciliation_config: {
                Files: config.Files,
                ReconciliationRules: reconciliationRules,
                selected_columns_file_a: selectedColumnsFileA,
                selected_columns_file_b: selectedColumnsFileB,
                user_requirements: 'Reconcile files using the configured rules',
                files: filesArray.map((file, index) => ({
                    file_id: file.file_id,
                    role: `file_${index}`,
                    label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
                }))
            }
        };

        onSendMessage('system', '🎉 Starting reconciliation process...');
        
        const response = await processManagementService.startReconciliation(finalConfig);
        
        if (response.success) {
            const resultData = response.data || response;
            const summary = resultData.summary || {};
            
            setGeneratedResults({
                reconciliation_id: resultData.reconciliation_id || response.processId,
                matched_count: summary.matched_records || 0,
                unmatched_file_a_count: summary.unmatched_file_a || 0,
                unmatched_file_b_count: summary.unmatched_file_b || 0,
                total_records_file_a: summary.total_records_file_a || 0,
                total_records_file_b: summary.total_records_file_b || 0,
                processing_time: summary.processing_time_seconds || 0,
                match_percentage: summary.match_percentage || 0,
                errors: resultData.errors || [],
                warnings: resultData.warnings || [],
                processing_info: resultData.processing_info || {}
            });
            onSendMessage('system', '✅ Reconciliation completed successfully!');
        }
    } catch (error) {
        console.error('Reconciliation error:', error);
        setGeneratedResults({
            errors: [error.message || 'An unexpected error occurred']
        });
        onSendMessage('system', `❌ Reconciliation error: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
};
```

---

## API Integration Layer

### Service Architecture Overview
The reconciliation system integrates with multiple specialized services, each handling specific aspects of the data processing workflow.

### aiAssistanceService Integration

#### Service Location
`/frontend/src/services/aiAssistanceService.js`

#### Key Methods Used
```javascript
// Generate reconciliation configuration from natural language requirements
await aiAssistanceService.generateReconciliationConfig({
    requirements: userRequirements,
    sourceFiles: normalizedFileData
});

// Generate regex patterns for extraction rules (via AIRegexGenerator)
await aiAssistanceService.generateRegexPattern({
    description: userDescription,
    sampleText: columnSampleData,
    columnName: targetColumn
});
```

### processManagementService Integration

#### Service Location  
`/frontend/src/services/processManagementService.js`

#### Primary Method
```javascript
await processManagementService.startReconciliation(reconciliationConfig);
```

#### Configuration Structure
```javascript
const reconciliationConfig = {
    process_type: 'reconciliation',
    process_name: 'Custom Reconciliation Process',
    user_requirements: string,
    files: [
        {
            file_id: string,
            role: 'file_0' | 'file_1',
            label: string
        }
    ],
    reconciliation_config: {
        Files: [
            {
                Name: 'FileA' | 'FileB',
                Extract: [
                    {
                        ResultColumnName: string,
                        SourceColumn: string,
                        MatchType: 'regex' | 'exact' | 'contains' | 'starts_with' | 'ends_with',
                        Patterns: [string]
                    }
                ],
                Filter: [
                    {
                        ColumnName: string,
                        MatchType: 'equals',
                        Value: string
                    }
                ]
            }
        ],
        ReconciliationRules: [
            {
                LeftFileColumn: string,
                RightFileColumn: string,
                MatchType: 'equals' | 'tolerance' | 'date_equals' | 'contains' | 'percentage',
                ToleranceValue: number
            }
        ],
        selected_columns_file_a: string[],
        selected_columns_file_b: string[],
        user_requirements: string,
        files: fileMetadata[]
    }
};
```

### deltaApiService Integration

#### Service Location
`/frontend/src/services/deltaApiService.js`

#### Methods Used
```javascript
// Get unique values for filter dropdown population
await deltaApiService.getColumnUniqueValues(fileId, columnName, limit);

// Response structure:
{
    unique_values: string[],
    is_date_column: boolean,
    total_unique: number,
    has_more: boolean
}
```

### ruleManagementService Integration

#### Service Location
`/frontend/src/services/ruleManagementService.js`

#### Methods Used
```javascript
// Load saved rule templates
await ruleManagementService.loadRule(ruleId);

// Save current configuration as rule template
await ruleManagementService.saveRule({
    name: string,
    description: string,
    category: 'reconciliation',
    config: currentConfiguration,
    tags: string[]
});
```

---

## AI-Powered Features

### AI Configuration Generation

#### Natural Language Processing
The AI configuration system converts business requirements into technical reconciliation rules:

```javascript
// Example input:
const requirements = `
Reconcile bank statements by matching transaction IDs exactly.
Match amounts with tolerance of $0.01.
Include transaction date, description, and amount in results.
Filter to only include transactions after 2024-01-01.
`;

// Generated output:
const aiConfig = {
    Files: [
        {
            Name: 'FileA',
            Extract: [],
            Filter: [
                {
                    ColumnName: 'date',
                    MatchType: 'greater_than',
                    Value: '2024-01-01'
                }
            ]
        }
    ],
    ReconciliationRules: [
        {
            LeftFileColumn: 'transaction_id',
            RightFileColumn: 'transaction_id', 
            MatchType: 'equals',
            ToleranceValue: 0
        },
        {
            LeftFileColumn: 'amount',
            RightFileColumn: 'amount',
            MatchType: 'tolerance', 
            ToleranceValue: 0.01
        }
    ],
    selected_columns_file_a: ['transaction_date', 'description', 'amount', 'transaction_id'],
    selected_columns_file_b: ['transaction_date', 'description', 'amount', 'transaction_id']
};
```

#### Business Scenario Templates
The system provides 8 predefined business scenarios to accelerate configuration:

1. **Bank Statement Reconciliation**
   ```javascript
   `Reconcile bank statements from two different sources by matching transaction amounts with tolerance of $0.01 and transaction dates. Include all transaction details in the results.`
   ```

2. **Invoice Matching**
   ```javascript
   `Match invoices between systems using invoice numbers exactly and amounts with small tolerance. Include vendor information and payment status in results.`
   ```

3. **Payroll Processing**
   ```javascript
   `Reconcile payroll data by matching employee IDs exactly and validating salary amounts. Include department and position information.`
   ```

### AI Regex Pattern Generation

#### Integration with AIRegexGenerator
```javascript
const handleAIRegexGenerated = (generatedRegex) => {
    const {fileIndex, ruleIndex} = currentAIContext;
    updateExtractionRule(fileIndex, ruleIndex, 'Patterns', generatedRegex);
    updateExtractionRule(fileIndex, ruleIndex, 'MatchType', 'regex');
    onSendMessage('system', '✨ AI generated regex pattern applied to extraction rule');
};
```

#### Sample-Based Generation
The AI regex generator uses sample data from the selected column to create contextually appropriate patterns:

```javascript
const getSampleTextForColumn = (fileIndex, columnName) => {
    const file = getFileByIndex(fileIndex);
    if (!file || !file.sample_data || !columnName) return '';

    // Extract first 3 non-empty values as samples
    const sampleValues = file.sample_data
        .map(row => row[columnName])
        .filter(val => val && val.toString().trim())
        .slice(0, 3);

    return sampleValues.join(', ');
};
```

---

## Rule Management System

### RuleSaveLoad Component

#### Component Location
`/frontend/src/components/rules/RuleSaveLoad.jsx`

#### Dual Interface Design
The rule management system provides two distinct interfaces in a single modal:

1. **Load Tab**: Browse and load existing rule templates
2. **Save Tab**: Save current configuration as new template or update existing

#### Rule Adaptation System
When loading a rule template, the system automatically adapts it to the current files:

```javascript
const handleRuleLoaded = (rule, adaptedConfig, warnings) => {
    setConfig(adaptedConfig);
    setReconciliationRules(adaptedConfig.ReconciliationRules || []);
    setLoadedRuleId(rule.id);
    setHasUnsavedChanges(false);

    if (warnings && warnings.length > 0) {
        onSendMessage('system', `⚠️ Rule loaded with warnings:\n${warnings.join('\n')}\n\nPlease review and update the configuration as needed.`);
    } else {
        onSendMessage('system', `✅ Rule "${rule.name}" loaded successfully!`);
    }

    // Auto-navigate to extraction rules step
    setTimeout(() => {
        setCurrentStep('extraction_rules');
    }, 1000);
};
```

#### Rule Configuration Structure
```javascript
const getCurrentRuleConfig = () => {
    return {
        Files: config.Files,
        ReconciliationRules: reconciliationRules,
        selected_columns_file_a: selectedColumnsFileA,
        selected_columns_file_b: selectedColumnsFileB,
        user_requirements: 'Reconcile files using the configured rules'
    };
};
```

### Change Tracking System

#### Unsaved Changes Detection
```javascript
useEffect(() => {
    if (loadedRuleId) {
        setHasUnsavedChanges(true);
    }
}, [config, reconciliationRules, selectedColumnsFileA, selectedColumnsFileB]);
```

#### Save State Management
```javascript
const handleRuleSaved = (savedRule) => {
    setLoadedRuleId(savedRule.id);
    setHasUnsavedChanges(false);
    onSendMessage('system', `✅ Rule "${savedRule.name}" saved successfully!`);
};
```

---

## Configuration Management

### Configuration Validation System

#### Rule Requirements Validation
```javascript
// Prevent advancement without reconciliation rules
<button
    onClick={nextStep}
    disabled={currentStep === 'review' && reconciliationRules.length === 0}
    className="disabled:bg-gray-400 disabled:cursor-not-allowed"
>
    {currentStep === 'review' ? 'Generate Results' : 'Next'}
</button>
```

#### Column Validation
```javascript
const isValidConfiguration = () => {
    // Check if reconciliation rules reference valid columns
    const fileAColumns = getAllAvailableColumns(0);
    const fileBColumns = getAllAvailableColumns(1);
    
    return reconciliationRules.every(rule => 
        fileAColumns.includes(rule.LeftFileColumn) &&
        fileBColumns.includes(rule.RightFileColumn)
    );
};
```

### Configuration Serialization

#### Export Configuration for Processing
```javascript
const getFinalConfiguration = () => {
    const filesArray = getSelectedFilesArray();
    return {
        process_type: 'reconciliation',
        process_name: 'Custom Reconciliation Process',
        user_requirements: 'Reconcile files using the configured rules',
        files: filesArray.map((file, index) => ({
            file_id: file.file_id,
            role: `file_${index}`,
            label: selectedTemplate?.fileLabels[index] || `File ${index + 1}`
        })),
        reconciliation_config: {
            Files: config.Files,
            ReconciliationRules: reconciliationRules,
            selected_columns_file_a: selectedColumnsFileA,
            selected_columns_file_b: selectedColumnsFileB,
            user_requirements: 'Reconcile files using the configured rules'
        }
    };
};
```

---

## Error Handling & User Experience

### Comprehensive Error Management

#### Processing Error Handling
```javascript
try {
    const response = await processManagementService.startReconciliation(finalConfig);
    if (response.success) {
        // Handle success case
    } else {
        setGeneratedResults({
            errors: [response.error || 'Reconciliation failed']
        });
        onSendMessage('system', `❌ Reconciliation failed: ${response.error}`);
    }
} catch (error) {
    console.error('Reconciliation error:', error);
    setGeneratedResults({
        errors: [error.message || 'An unexpected error occurred']
    });
    onSendMessage('system', `❌ Reconciliation error: ${error.message}`);
}
```

#### Validation Error Prevention
```javascript
// Prevent invalid rule operations
const updateReconciliationRule = (ruleIndex, field, value) => {
    if (ruleIndex < 0 || ruleIndex >= reconciliationRules.length) {
        console.error('Invalid rule index:', ruleIndex);
        return;
    }
    
    const updatedRules = [...reconciliationRules];
    updatedRules[ruleIndex][field] = value;
    setReconciliationRules(updatedRules);
};
```

### User Feedback System

#### Progress Messaging
```javascript
// Contextual system messages throughout the workflow
onSendMessage('system', '🎉 Starting reconciliation process...');
onSendMessage('system', '✅ Reconciliation completed successfully!');
onSendMessage('system', '✨ AI configuration generated successfully!');
onSendMessage('system', '⚠️ Rule loaded with warnings...');
```

#### Loading States Management
```javascript
// Multiple loading states for different operations
const [isProcessing, setIsProcessing] = useState(false);      // Main reconciliation processing
const [isGenerating, setIsGenerating] = useState(false);     // AI configuration generation
const [loadingValues, setLoadingValues] = useState({});      // Filter value loading
```

### No Results Handling

#### Special Case: Zero Matches
```javascript
const hasNoMatches = matchedCount === 0 && (totalFileA > 0 || totalFileB > 0);

if (hasNoMatches) {
    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="font-medium text-blue-800 mb-2">No matching records were found</h4>
            <p className="text-blue-700 text-sm mb-4">
                The reconciliation process completed successfully, but no records matched.
            </p>
            <div className="bg-blue-100 rounded p-3 text-sm">
                <p className="font-medium text-blue-800 mb-2">This could happen when:</p>
                <ul className="text-blue-700 space-y-1 list-disc list-inside">
                    <li>The files contain completely different datasets</li>
                    <li>Matching rules are too strict (try adjusting tolerance values)</li>
                    <li>Column names or data formats don't align between files</li>
                    <li>Date formats or case sensitivity cause mismatches</li>
                </ul>
            </div>
        </div>
    );
}
```

---

## Performance Optimizations

### Debounced State Updates

#### Column Selection Synchronization
```javascript
useEffect(() => {
    const timeoutId = setTimeout(() => {
        updateSelectedColumns(0);
        updateSelectedColumns(1);
    }, 500); // Debounce updates to prevent excessive re-renders

    return () => clearTimeout(timeoutId);
}, [config, reconciliationRules]);
```

### Efficient Data Structures

#### Set-Based Column Management
```javascript
const getMandatoryColumns = (fileIndex) => {
    const mandatoryColumns = new Set(); // Use Set for O(1) lookups
    
    // Add extracted columns
    const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(name => name && name.trim().length >= 3) || [];
    extractedColumns.forEach(col => mandatoryColumns.add(col.trim()));
    
    return Array.from(mandatoryColumns);
};
```

### API Optimization

#### Caching Strategies
```javascript
// Cache unique values to prevent redundant API calls
const [uniqueValueCache, setUniqueValueCache] = useState({});

const fetchUniqueValues = async (fileId, columnName) => {
    const cacheKey = `${fileId}_${columnName}`;
    
    if (uniqueValueCache[cacheKey]) {
        return uniqueValueCache[cacheKey];
    }
    
    const response = await deltaApiService.getColumnUniqueValues(fileId, columnName, 1000);
    
    setUniqueValueCache(prev => ({
        ...prev,
        [cacheKey]: response
    }));
    
    return response;
};
```

### Memory Management

#### Component Cleanup
```javascript
useEffect(() => {
    return () => {
        // Clear caches on component unmount
        setUniqueValueCache({});
        setLoadingValues({});
    };
}, []);
```

---

## Development Guidelines

### State Management Best Practices

#### Immutable Updates
```javascript
// Always use spread operators for state updates
const updateExtractionRule = (fileIndex, ruleIndex, field, value) => {
    const updatedConfig = {...config};
    if (field === 'Patterns') {
        updatedConfig.Files[fileIndex].Extract[ruleIndex].Patterns = [value];
    } else {
        updatedConfig.Files[fileIndex].Extract[ruleIndex][field] = value;
    }
    setConfig(updatedConfig);
};
```

#### Predictable State Structure
```javascript
// Maintain consistent state initialization
useEffect(() => {
    const filesArray = getSelectedFilesArray();
    if (filesArray.length >= 2) {
        setConfig({
            Files: filesArray.map((file, index) => ({
                Name: `File${String.fromCharCode(65 + index)}`,
                Extract: [],
                Filter: []
            })),
            ReconciliationRules: []
        });
    }
}, [selectedFiles]);
```

### Component Architecture Patterns

#### Single Responsibility Principle
Each step component should have a single, well-defined responsibility:
- **ReconciliationFlow**: Orchestration and state management
- **IntegratedFilterDataStep**: Data filtering configuration only
- **ReconciliationPreviewStep**: Results display and actions only

#### Props Interface Design
```javascript
// Use descriptive, strongly-typed prop interfaces
const IntegratedFilterDataStep = ({
    config,                    // Current configuration state
    setConfig,                 // Configuration update function
    getFileByIndex,            // File access helper
    fileColumns,               // Column metadata
    onSendMessage              // User feedback function
}) => {
    // Component implementation
};
```

### Error Handling Patterns

#### Graceful Degradation
```javascript
// Always provide fallbacks for missing data
const getAllAvailableColumns = (fileIndex) => {
    const file = getFileByIndex(fileIndex);
    const originalColumns = fileColumns[file?.file_id] || []; // Fallback to empty array
    const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(Boolean) || [];
    return [...originalColumns, ...extractedColumns];
};
```

#### User-Friendly Error Messages
```javascript
// Provide actionable error messages
if (hasNoMatches) {
    return (
        <div>
            <h4>No matching records were found</h4>
            <p>This could happen when:</p>
            <ul>
                <li>Matching rules are too strict (try adjusting tolerance values)</li>
                <li>Column names or data formats don't align between files</li>
            </ul>
        </div>
    );
}
```

### Code Organization Standards

#### File Naming Conventions
- **Components**: PascalCase with descriptive names (`ReconciliationFlow.jsx`)
- **Services**: camelCase with Service suffix (`aiAssistanceService.js`)
- **Utilities**: camelCase with descriptive names (`columnHelpers.js`)

#### Function Naming Patterns
- **Event Handlers**: `handle*` prefix (`handleRuleLoaded`)
- **Getters**: `get*` prefix (`getSelectedFilesArray`)
- **Actions**: Verb-based names (`addReconciliationRule`, `removeFilterRule`)
- **Validators**: `is*` prefix (`isValidConfiguration`)

---

## Testing Strategy

### Component Testing Approach

#### Unit Testing Focus Areas
1. **State Management Logic**: Test state updates and side effects
2. **Helper Functions**: Test data transformation and validation functions
3. **Event Handlers**: Test user interaction responses
4. **Configuration Generation**: Test rule creation and validation

#### Integration Testing Priorities
1. **Step Navigation**: Test workflow progression and validation
2. **API Communication**: Test service integration and error handling
3. **Rule Loading/Saving**: Test persistence operations
4. **AI Configuration**: Test AI service integration

#### Sample Test Structure
```javascript
describe('ReconciliationFlow', () => {
    describe('State Management', () => {
        test('should initialize configuration from selected files', () => {
            // Test initial state setup
        });
        
        test('should update mandatory columns when rules change', () => {
            // Test column synchronization
        });
    });
    
    describe('Rule Management', () => {
        test('should add reconciliation rule correctly', () => {
            // Test rule addition logic
        });
        
        test('should validate rule configuration before processing', () => {
            // Test validation logic
        });
    });
    
    describe('API Integration', () => {
        test('should handle reconciliation processing success', async () => {
            // Test successful processing flow
        });
        
        test('should handle processing errors gracefully', async () => {
            // Test error handling
        });
    });
});
```

### Test Data Requirements

#### Mock Configuration Data
```javascript
const mockConfig = {
    Files: [
        {
            Name: 'FileA',
            Extract: [
                {
                    ResultColumnName: 'extracted_amount',
                    SourceColumn: 'transaction_desc',
                    MatchType: 'regex',
                    Patterns: ['\\$([\\d,]+(?:\\.\\d{2})?)']
                }
            ],
            Filter: [
                {
                    ColumnName: 'status',
                    MatchType: 'equals',
                    Value: 'Active'
                }
            ]
        }
    ],
    ReconciliationRules: [
        {
            LeftFileColumn: 'transaction_id',
            RightFileColumn: 'ref_id',
            MatchType: 'equals',
            ToleranceValue: 0
        }
    ]
};
```

### Performance Testing

#### Load Testing Scenarios
1. **Large File Processing**: Test with 50k+ records
2. **Complex Rule Sets**: Test with 10+ extraction and reconciliation rules
3. **Multiple Concurrent Users**: Test system under load
4. **Memory Usage**: Monitor for memory leaks during extended use

#### Performance Benchmarks
- **Step Navigation**: < 100ms response time
- **Rule Updates**: < 200ms state synchronization
- **AI Configuration**: < 10s generation time
- **Results Processing**: < 30s for 10k records

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Column Selection Not Updating
**Symptoms**: Mandatory columns not appearing in result column selection
**Causes**:
- State update timing issues
- Invalid column names in rules
- Missing debounce in useEffect

**Solutions**:
```javascript
// Check column validation logic
const getMandatoryColumns = (fileIndex) => {
    const mandatoryColumns = new Set();
    const extractedColumns = config.Files[fileIndex]?.Extract?.map(rule => rule.ResultColumnName).filter(name => name && name.trim().length >= 3) || [];
    // Ensure minimum length validation
};

// Verify debounced updates are working
useEffect(() => {
    const timeoutId = setTimeout(() => {
        updateSelectedColumns(0);
        updateSelectedColumns(1);
    }, 500);
    return () => clearTimeout(timeoutId);
}, [config, reconciliationRules]);
```

#### 2. AI Configuration Generation Fails
**Symptoms**: AI configuration step shows error or no configuration generated
**Causes**:
- Invalid file structure
- Missing column metadata
- API service unavailable

**Solutions**:
```javascript
// Validate file structure before API call
const normalizedSourceFiles = sourceFiles.map(file => ({
    file_id: file.file_id,
    filename: file.filename,
    columns: file.columns || [],
    totalRows: file.totalRows || file.total_rows || 0,
    label: file.label || ''
}));

// Add comprehensive error handling
try {
    const response = await aiAssistanceService.generateReconciliationConfig({
        requirements,
        sourceFiles: normalizedSourceFiles
    });
} catch (error) {
    console.error('AI configuration generation failed:', error);
    onSendMessage('system', `❌ Failed to generate AI configuration: ${error.message}`);
}
```

#### 3. Processing Results Not Displaying
**Symptoms**: Results step shows loading indefinitely or no results
**Causes**:
- Invalid configuration structure
- Backend processing failure
- Network connectivity issues

**Solutions**:
```javascript
// Validate configuration before processing
const isValidConfiguration = () => {
    return reconciliationRules.length > 0 && 
           config.Files.length >= 2 &&
           selectedColumnsFileA.length > 0 &&
           selectedColumnsFileB.length > 0;
};

// Add timeout handling
const processWithTimeout = async (config) => {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout')), 60000);
    });
    
    const processingPromise = processManagementService.startReconciliation(config);
    
    return Promise.race([processingPromise, timeoutPromise]);
};
```

#### 4. Filter Values Not Loading
**Symptoms**: Filter dropdown shows loading spinner indefinitely
**Causes**:
- API endpoint not responding
- Invalid file ID or column name
- Cache corruption

**Solutions**:
```javascript
// Add retry mechanism
const fetchUniqueValues = async (fileId, columnName, filterKey, retryCount = 0) => {
    try {
        const response = await deltaApiService.getColumnUniqueValues(fileId, columnName, 1000);
        return response;
    } catch (error) {
        if (retryCount < 3) {
            console.warn(`Retrying fetchUniqueValues (attempt ${retryCount + 1}):`, error);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchUniqueValues(fileId, columnName, filterKey, retryCount + 1);
        }
        throw error;
    }
};

// Clear corrupted cache
const clearFilterCache = () => {
    setUniqueValueCache({});
    setLoadingValues({});
};
```

#### 5. Rule Loading/Saving Issues
**Symptoms**: Rules don't load correctly or save operations fail
**Causes**:
- Rule adaptation failures
- Invalid rule structure
- Permission issues

**Solutions**:
```javascript
// Validate rule structure before loading
const validateRule = (rule) => {
    const requiredFields = ['Files', 'ReconciliationRules'];
    return requiredFields.every(field => rule.hasOwnProperty(field));
};

// Add detailed error logging
const handleRuleLoaded = (rule, adaptedConfig, warnings) => {
    try {
        if (!validateRule(adaptedConfig)) {
            throw new Error('Invalid rule structure');
        }
        
        setConfig(adaptedConfig);
        setReconciliationRules(adaptedConfig.ReconciliationRules || []);
        // ... rest of loading logic
    } catch (error) {
        console.error('Rule loading failed:', error);
        onSendMessage('system', `❌ Failed to load rule: ${error.message}`);
    }
};
```

### Debugging Tools and Techniques

#### React DevTools Usage
1. **Component State Inspection**: Monitor state changes in real-time
2. **Props Validation**: Verify prop values between components
3. **Performance Profiling**: Identify rendering bottlenecks

#### Browser DevTools
1. **Network Monitoring**: Check API calls and responses
2. **Console Logging**: Use structured logging for debugging
3. **Storage Inspection**: Verify local storage and session data

#### Custom Debug Helpers
```javascript
// Add debug mode for development
const [debugMode, setDebugMode] = useState(process.env.NODE_ENV === 'development');

// Debug information display
{debugMode && (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded text-xs max-w-sm">
        <h4 className="font-bold mb-2">Debug Info</h4>
        <div>Current Step: {currentStep}</div>
        <div>Rules Count: {reconciliationRules.length}</div>
        <div>Files: {getSelectedFilesArray().length}</div>
        <div>Has Changes: {hasUnsavedChanges.toString()}</div>
        <div>Loaded Rule: {loadedRuleId || 'None'}</div>
    </div>
)}
```

---

## Conclusion

The reconciliation components represent a sophisticated, multi-layered system that demonstrates advanced React architecture patterns, AI integration, and complex state management. This architecture enables:

1. **Scalable Workflows**: 8-step wizard that can be extended with additional steps
2. **AI-Powered Assistance**: Seamless integration of AI throughout the workflow
3. **Flexible Configuration**: Support for complex matching rules and data transformations
4. **User Experience Excellence**: Comprehensive error handling and feedback systems
5. **Performance Optimization**: Efficient state management and API interactions
6. **Maintainable Code**: Clear separation of concerns and modular architecture

When developing or maintaining this system, developers should:

1. **Follow Established Patterns**: Use the documented state management and component patterns
2. **Maintain API Contracts**: Ensure service integrations remain consistent
3. **Test Thoroughly**: Use the provided testing strategies for reliable functionality
4. **Handle Errors Gracefully**: Implement comprehensive error handling and user feedback
5. **Optimize Performance**: Consider the impact of state updates and API calls
6. **Document Changes**: Update this documentation when making architectural changes

The reconciliation system serves as a reference implementation for complex React applications that require sophisticated workflow management, AI integration, and robust error handling. Understanding this architecture will enable developers to build similar systems and extend the existing functionality confidently.

For additional support or questions about this architecture, refer to the broader project documentation, test the system with the provided sample data, or consult with the development team for specific implementation details.