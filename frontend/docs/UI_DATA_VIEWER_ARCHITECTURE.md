# UI Data Viewer Architecture & Developer Guide

## Table of Contents
1. [Overview](#overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow & State Management](#data-flow--state-management)
4. [Rendering Pipeline](#rendering-pipeline)
5. [Feature Implementation Details](#feature-implementation-details)
6. [API Integration](#api-integration)
7. [UI Configuration System](#ui-configuration-system)
8. [Event Handling Architecture](#event-handling-architecture)
9. [Performance Optimizations](#performance-optimizations)
10. [Development Guidelines](#development-guidelines)
11. [Testing Considerations](#testing-considerations)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

The DataViewer component (`frontend/src/components/viewer/DataViewer.jsx`) is a sophisticated Excel-like data visualization and editing interface that serves as the central data viewing hub for the financial data processing platform. It renders tabular data with full spreadsheet functionality including inline editing, column/row operations, sorting, filtering, and advanced selection mechanisms.

### Key Characteristics
- **Excel-like Interface**: Column letters (A, B, C...) and numbered rows
- **Full CRUD Operations**: Create, read, update, delete rows and columns
- **Real-time Editing**: Click-to-edit cells with immediate visual feedback
- **Multi-selection**: Excel-style column and row selection with batch operations
- **Responsive Design**: Configurable UI elements for different viewing preferences
- **Performance Optimized**: Handles large datasets (50k+ records) with pagination
- **Integration Hub**: Central viewing point for all processed data across workflows

---

## Component Architecture

### File Structure
```
frontend/src/
├── components/viewer/
│   └── DataViewer.jsx          # Main viewer component
├── pages/
│   └── ViewerPage.jsx          # Page wrapper component
└── services/
    └── defaultApi.js           # API service methods
```

### Component Hierarchy
```
ViewerPage (Route: /viewer/:fileId)
└── DataViewer
    ├── Header Section (File info + Controls)
    ├── Configuration Panel (UI settings)
    ├── Modal Components (Add/Delete confirmations)
    ├── Data Table (Main rendering area)
    │   ├── Excel Column Letters Row
    │   ├── Column Headers Row (with filters)
    │   └── Data Rows (with row numbers)
    ├── Pagination Controls
    └── Footer (Status information)
```

---

## Data Flow & State Management

### Primary State Variables

#### Core Data State
```javascript
const [data, setData] = useState([]);           // Main dataset array
const [columns, setColumns] = useState([]);     // Column definitions
const [fileName, setFileName] = useState('');   // Display filename
const [fileStats, setFileStats] = useState(null); // File metadata
```

#### UI Interaction State
```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [editingCell, setEditingCell] = useState(null); // {row: number, col: number}
const [editValue, setEditValue] = useState('');
```

#### Sorting & Filtering State
```javascript
const [sortConfig, setSortConfig] = useState({column: null, direction: 'asc'});
const [filterConfig, setFilterConfig] = useState({}); // {columnName: filterValue}
const [searchTerm, setSearchTerm] = useState('');
```

#### Pagination State
```javascript
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(50);
const [totalRows, setTotalRows] = useState(0);
```

#### History Management State
```javascript
const [history, setHistory] = useState([]);        // Undo/redo history
const [historyIndex, setHistoryIndex] = useState(-1);
const [hasChanges, setHasChanges] = useState(false);
```

#### Selection State
```javascript
const [selectedColumns, setSelectedColumns] = useState(new Set());
const [selectedRows, setSelectedRows] = useState(new Set());
```

#### UI Configuration State
```javascript
const [uiConfig, setUiConfig] = useState({
    cellPadding: 'compact',      // compact, normal, comfortable
    rowHeight: 'compact',        // compact, normal, comfortable
    headerHeight: 'compact',     // compact, normal, comfortable
    fontSize: 'small',           // small, normal, large
    showGridLines: true,
    autoSizeColumns: true
});
```

### Data Flow Lifecycle

1. **Component Mount**: `useEffect` → `loadFileData()` + `loadFileName()`
2. **API Data Fetch**: `apiService.getFileData()` → `setData()` + `setColumns()`
3. **History Initialization**: First data load → `setHistory([{data, columns}])`
4. **User Interactions**: Cell edits → `addToHistory()` → State updates
5. **Filtering Pipeline**: `filteredData = useMemo()` → Real-time filtering
6. **Render Cycle**: State changes → Component re-render → DOM updates

---

## Rendering Pipeline

### Table Structure Overview
The DataViewer renders a complex HTML table with multiple header rows and sophisticated cell rendering:

```html
<table>
  <thead>
    <!-- Row 1: Excel Column Letters (A, B, C...) -->
    <tr className="bg-gray-100">
      <th></th> <!-- Empty corner cell -->
      <th>A</th><th>B</th><th>C</th>... <!-- Column letters -->
    </tr>
    
    <!-- Row 2: Column Names + Filters -->
    <tr>
      <th>#</th> <!-- Row number header -->
      <th>
        <span>Column Name</span> <!-- Sortable header -->
        <input placeholder="Filter..." /> <!-- Column filter -->
      </th>
      ...
    </tr>
  </thead>
  
  <tbody>
    <!-- Data Rows -->
    <tr>
      <td>1</td> <!-- Row number -->
      <td>Cell Data</td> <!-- Data cell or input field -->
      ...
    </tr>
  </tbody>
</table>
```

### Excel Column Name Generation

The component generates Excel-style column names (A, B, C, ..., Z, AA, AB, ...) using a sophisticated algorithm:

```javascript
const getExcelColumnName = (columnIndex) => {
    let result = '';
    let index = columnIndex;
    
    while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
    }
    
    return result;
};
```

**Algorithm Explanation:**
- Uses modulo 26 to get letter position (A=0, B=1, ..., Z=25)
- `String.fromCharCode(65 + position)` converts to actual letter
- Handles multi-letter columns (AA, AB, etc.) by division and recursion
- Prepends letters from right to left to build final column name

### Cell Rendering Logic

Each data cell has sophisticated rendering logic that handles multiple states:

```javascript
// Cell rendering decision tree
{editingCell?.row === rowIndex && editingCell?.col === columnIndex ? (
    // EDIT MODE: Render input field
    <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={saveEdit}                    // Save on focus loss
        onKeyPress={(e) => {                 // Save on Enter, Cancel on Escape
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') cancelEdit();
        }}
        className="w-full p-0.5 border border-blue-500 rounded focus:outline-none text-xs"
        autoFocus
    />
) : (
    // DISPLAY MODE: Render cell content
    <span
        className="text-gray-900 truncate block"
        title={row[column]}                  // Tooltip for full content
    >
        {row[column] || ''}                  // Display value or empty
    </span>
)}
```

### Dynamic CSS Class Generation

The component uses sophisticated CSS class generation functions for responsive styling:

#### Cell Classes (`getCellClasses()`)
```javascript
const getCellClasses = () => {
    const padding = {
        compact: 'px-2 py-1',
        normal: 'px-3 py-2',
        comfortable: 'px-4 py-3'
    };

    const fontSize = {
        small: 'text-xs',
        normal: 'text-sm',
        large: 'text-base'
    };

    return `${padding[uiConfig.cellPadding]} ${fontSize[uiConfig.fontSize]} border cursor-pointer hover:bg-blue-50 ${uiConfig.showGridLines ? 'border-gray-200' : 'border-transparent'}`;
};
```

#### Selection State Classes
```javascript
// Column selection styling
className={`${selectedColumns.has(columnIndex) 
    ? 'bg-blue-500 text-white border-blue-600'     // Selected state
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200' // Default state
}`}

// Row selection styling  
className={`${selectedRows.has(rowIndex) ? 'bg-green-100' : ''}`}

// Combined cell styling (column + row selection)
className={`${getCellClasses()} 
    ${selectedColumns.has(columnIndex) ? 'bg-blue-50 border-blue-200' : ''} 
    ${selectedRows.has(rowIndex) ? 'bg-green-100' : ''}`}
```

---

## Feature Implementation Details

### 1. Cell Editing System

#### Edit Mode Activation
```javascript
const startEditing = (rowIndex, columnIndex) => {
    setEditingCell({row: rowIndex, col: columnIndex});
    setEditValue(data[rowIndex]?.[columns[columnIndex]] || '');
};
```

#### Edit Mode Completion
```javascript
const saveEdit = () => {
    if (editingCell) {
        const newData = [...data];
        if (!newData[editingCell.row]) {
            newData[editingCell.row] = {};  // Initialize row if needed
        }
        newData[editingCell.row][columns[editingCell.col]] = editValue;
        setData(newData);
        addToHistory(newData, columns);     // Add to undo/redo history
    }
    setEditingCell(null);
    setEditValue('');
};
```

### 2. Column/Row Selection System

#### Multi-Selection Logic
```javascript
const handleColumnSelect = (columnIndex) => {
    const newSelection = new Set(selectedColumns);
    if (newSelection.has(columnIndex)) {
        newSelection.delete(columnIndex);   // Toggle off if already selected
    } else {
        newSelection.add(columnIndex);      // Add to selection
    }
    setSelectedColumns(newSelection);
};
```

#### Batch Delete Operations
```javascript
const deleteSelectedColumns = () => {
    if (selectedColumns.size === 0) return;
    
    // Sort in descending order to maintain correct indexing during deletion
    const sortedColumnIndexes = Array.from(selectedColumns).sort((a, b) => b - a);
    let newColumns = [...columns];
    let newData = [...data];
    
    // Remove columns from highest index to lowest
    sortedColumnIndexes.forEach(columnIndex => {
        const columnToDelete = newColumns[columnIndex];
        newColumns.splice(columnIndex, 1);              // Remove from columns array
        newData = newData.map(row => {                   // Remove from each data row
            const newRow = {...row};
            delete newRow[columnToDelete];
            return newRow;
        });
    });
    
    setColumns(newColumns);
    setData(newData);
    addToHistory(newData, newColumns);
    setSelectedColumns(new Set());                       // Clear selection
    setShowDeleteColumnsModal(false);
};
```

### 3. Sorting Implementation

#### Multi-Type Sorting Logic
```javascript
const handleSort = (column) => {
    let direction = 'asc';
    if (sortConfig.column === column && sortConfig.direction === 'asc') {
        direction = 'desc';     // Toggle direction if same column
    }

    const sortedData = [...data].sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';

        // Numeric sorting detection
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            // Numeric comparison
            return direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison (case-insensitive)
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();

        if (direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });

    setData(sortedData);
    setSortConfig({column, direction});
    addToHistory(sortedData, columns);
};
```

### 4. Filtering System

#### Real-time Filtering Pipeline
```javascript
const filteredData = useMemo(() => {
    let filtered = [...data];

    // Global search filter
    if (searchTerm) {
        filtered = filtered.filter(row =>
            Object.values(row).some(val =>
                val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }

    // Column-specific filters
    Object.entries(filterConfig).forEach(([column, filterValue]) => {
        if (filterValue) {
            filtered = filtered.filter(row =>
                row[column]?.toString().toLowerCase().includes(filterValue.toLowerCase())
            );
        }
    });

    return filtered;
}, [data, searchTerm, filterConfig]);
```

### 5. History Management (Undo/Redo)

#### History Addition
```javascript
const addToHistory = useCallback((newData, newColumns) => {
    // Truncate history at current index (for redo branch removal)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({data: newData, columns: newColumns});
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasChanges(true);
}, [history, historyIndex]);
```

#### Undo/Redo Operations
```javascript
const undo = () => {
    if (historyIndex > 0) {
        const prevState = history[historyIndex - 1];
        setData(prevState.data);
        setColumns(prevState.columns);
        setHistoryIndex(historyIndex - 1);
        setHasChanges(historyIndex - 1 > 0);
    }
};

const redo = () => {
    if (historyIndex < history.length - 1) {
        const nextState = history[historyIndex + 1];
        setData(nextState.data);
        setColumns(nextState.columns);
        setHistoryIndex(historyIndex + 1);
        setHasChanges(true);
    }
};
```

### 6. Add/Delete Operations

#### Row Operations
```javascript
// Add new row with empty values for all columns
const addRow = () => {
    const newRow = {};
    columns.forEach(col => newRow[col] = '');
    const newData = [...data, newRow];
    setData(newData);
    addToHistory(newData, columns);
};

// Delete specific row by index
const deleteRow = (rowIndex) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    addToHistory(newData, columns);
};
```

#### Column Operations
```javascript
// Add new column with empty values for all rows
const addColumn = () => {
    if (newColumnName.trim()) {
        const newColumns = [...columns, newColumnName.trim()];
        const newData = data.map(row => ({...row, [newColumnName.trim()]: ''}));
        setColumns(newColumns);
        setData(newData);
        addToHistory(newData, newColumns);
        setNewColumnName('');
        setShowAddColumn(false);
    }
};

// Delete specific column by index
const deleteColumn = (columnIndex) => {
    const columnToDelete = columns[columnIndex];
    const newColumns = columns.filter((_, index) => index !== columnIndex);
    const newData = data.map(row => {
        const newRow = {...row};
        delete newRow[columnToDelete];
        return newRow;
    });
    setColumns(newColumns);
    setData(newData);
    addToHistory(newData, newColumns);
};
```

---

## API Integration

### Service Methods Used

#### Data Loading
```javascript
// Load paginated file data
const response = await apiService.getFileData(fileId, currentPage, pageSize);
// Response: {success: boolean, data: {rows: Array, columns: Array, total_rows: number}}

// Load file metadata for display
const filesResponse = await apiService.getFiles();
// Find specific file by fileId for filename and stats
```

#### Data Persistence
```javascript
// Save changes to backend
await apiService.updateFileData(fileId, {rows: data, columns});

// Download modified file
const response = await apiService.downloadModifiedFile(fileId, format);
// Formats: 'csv' | 'xlsx'
```

### Error Handling Strategy

#### API Fallback Mechanism
```javascript
try {
    // Try real API first
    const response = await apiService.getFileData(fileId, currentPage, pageSize);
    if (response.success) {
        setData(response.data.rows);
        setColumns(response.data.columns);
        setTotalRows(response.data.total_rows);
        return;
    }
} catch (apiError) {
    console.log('API endpoint not available, using sample data');
    // Fallback to sample/demo data
    generateSampleData();
}
```

#### Graceful Degradation
```javascript
try {
    await apiService.updateFileData(fileId, {rows: data, columns});
    showNotification('Changes saved successfully!', 'success');
} catch (apiError) {
    // Still mark as saved locally for demo purposes
    setHasChanges(false);
    showNotification('Changes saved locally (demo mode)!', 'info');
}
```

---

## UI Configuration System

### Configuration Structure
```javascript
const [uiConfig, setUiConfig] = useState({
    cellPadding: 'compact',      // Cell internal spacing
    rowHeight: 'compact',        // Row height sizing
    headerHeight: 'compact',     // Header row height
    fontSize: 'small',           // Text size throughout table
    showGridLines: true,         // Border visibility
    autoSizeColumns: true        // Column width behavior
});
```

### Dynamic Styling Implementation

#### Responsive Padding System
```javascript
const padding = {
    compact: 'px-2 py-1',      // Tight spacing for maximum data density
    normal: 'px-3 py-2',       // Balanced spacing for readability
    comfortable: 'px-4 py-3'   // Generous spacing for accessibility
};
```

#### Font Size Management
```javascript
const fontSize = {
    small: 'text-xs',          // 12px - Maximum data visibility
    normal: 'text-sm',         // 14px - Standard reading size  
    large: 'text-base'         // 16px - Enhanced accessibility
};
```

#### Height Control System
```javascript
const height = {
    compact: 'h-8',            // 32px row height
    normal: 'h-10',            // 40px row height
    comfortable: 'h-12'        // 48px row height
};
```

### Configuration Panel Implementation
```javascript
{showConfigPanel && (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
        <div className="grid grid-cols-3 gap-4 text-sm">
            {/* Cell Size Control */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cell Size</label>
                <select
                    value={uiConfig.cellPadding}
                    onChange={(e) => setUiConfig({...uiConfig, cellPadding: e.target.value})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="comfortable">Comfortable</option>
                </select>
            </div>
            
            {/* Row Height Control */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Row Height</label>
                <select
                    value={uiConfig.rowHeight}
                    onChange={(e) => setUiConfig({...uiConfig, rowHeight: e.target.value})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="comfortable">Comfortable</option>
                </select>
            </div>
            
            {/* Font Size Control */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
                <select
                    value={uiConfig.fontSize}
                    onChange={(e) => setUiConfig({...uiConfig, fontSize: e.target.value})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                </select>
            </div>
        </div>
        
        {/* Boolean Options */}
        <div className="flex items-center space-x-4 mt-2">
            <label className="flex items-center text-xs">
                <input
                    type="checkbox"
                    checked={uiConfig.showGridLines}
                    onChange={(e) => setUiConfig({...uiConfig, showGridLines: e.target.checked})}
                    className="mr-1"
                />
                Show Grid Lines
            </label>
            <label className="flex items-center text-xs">
                <input
                    type="checkbox"
                    checked={uiConfig.autoSizeColumns}
                    onChange={(e) => setUiConfig({...uiConfig, autoSizeColumns: e.target.checked})}
                    className="mr-1"
                />
                Auto-size Columns
            </label>
        </div>
    </div>
)}
```

---

## Event Handling Architecture

### Click Event Hierarchy

The DataViewer implements a sophisticated event handling system with proper event propagation control:

#### Cell Click Events
```javascript
// Cell click initiates editing
<td onClick={() => startEditing(rowIndex, columnIndex)}>
  {/* Cell content */}
</td>

// Row number click selects entire row
<td onClick={() => handleRowSelect(rowIndex)}>
  {startIndex + rowIndex + 1}
  {/* Delete button prevents row selection when clicked */}
  <button
    onClick={(e) => {
      e.stopPropagation(); // Prevent row selection
      deleteRow(rowIndex);
    }}
  >
    <Minus size={8}/>
  </button>
</td>
```

#### Column Header Events
```javascript
// Column letter click selects entire column
<th onClick={() => handleColumnSelect(columnIndex)}>
  {getExcelColumnName(columnIndex)}
</th>

// Column name click initiates sorting
<span
  onClick={() => handleSort(column)}
  className="cursor-pointer"
>
  {column}
  {/* Sort indicator */}
</span>

// Filter input prevents header clicks
<input
  onClick={(e) => e.stopPropagation()}
  onChange={(e) => setFilterConfig({...filterConfig, [column]: e.target.value})}
/>
```

### Keyboard Event Handling

#### Edit Mode Keyboard Controls
```javascript
<input
  onKeyPress={(e) => {
    if (e.key === 'Enter') saveEdit();      // Save and exit edit mode
    if (e.key === 'Escape') cancelEdit();   // Cancel and exit edit mode
  }}
  onBlur={saveEdit}                         // Save on focus loss
  autoFocus                                 // Auto-focus when entering edit mode
/>
```

#### Global Keyboard Shortcuts
The component could be extended with global keyboard shortcuts:
```javascript
// Example implementation for future enhancement
useEffect(() => {
  const handleKeyboard = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z': e.preventDefault(); undo(); break;
        case 'y': e.preventDefault(); redo(); break;
        case 's': e.preventDefault(); saveChanges(); break;
      }
    }
  };
  
  document.addEventListener('keydown', handleKeyboard);
  return () => document.removeEventListener('keydown', handleKeyboard);
}, []);
```

### Modal Event Management

#### Modal State Control
```javascript
// Add Column Modal
{showAddColumn && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96">
      <input
        onKeyPress={(e) => e.key === 'Enter' && addColumn()}
        autoFocus
      />
      <div className="flex justify-end space-x-2">
        <button onClick={() => {
          setShowAddColumn(false);
          setNewColumnName('');
        }}>Cancel</button>
        <button
          onClick={addColumn}
          disabled={!newColumnName.trim()}
        >Add Column</button>
      </div>
    </div>
  </div>
)}
```

---

## Performance Optimizations

### React Performance Patterns

#### Memoized Filtering
```javascript
const filteredData = useMemo(() => {
    let filtered = [...data];
    // Expensive filtering operations only run when dependencies change
    if (searchTerm) {
        filtered = filtered.filter(/* filtering logic */);
    }
    Object.entries(filterConfig).forEach(/* column filtering */);
    return filtered;
}, [data, searchTerm, filterConfig]); // Dependency array
```

#### Callback Memoization
```javascript
const addToHistory = useCallback((newData, newColumns) => {
    // Function only recreated when dependencies change
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({data: newData, columns: newColumns});
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasChanges(true);
}, [history, historyIndex]); // Dependency array prevents unnecessary recreations
```

### Large Dataset Handling

#### Pagination Implementation
```javascript
// Pagination calculations
const totalPages = Math.ceil(totalRows / pageSize);
const startIndex = (currentPage - 1) * pageSize;
const endIndex = startIndex + pageSize;

// Page size options for user control
<select
  value={pageSize}
  onChange={(e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  }}
>
  <option value={25}>25 per page</option>
  <option value={50}>50 per page</option>
  <option value={100}>100 per page</option>
  <option value={250}>250 per page</option>
</select>
```

#### Memory Management
```javascript
// Efficient array operations
const deleteSelectedRows = () => {
    // Sort indices in descending order to maintain correct indexing
    const sortedRowIndexes = Array.from(selectedRows).sort((a, b) => b - a);
    let newData = [...data]; // Shallow copy for immutability
    
    sortedRowIndexes.forEach(rowIndex => {
        newData.splice(rowIndex, 1); // Remove from highest index first
    });
    // This prevents index shifting issues during deletion
};
```

### Rendering Optimizations

#### Conditional Class Generation
```javascript
// Dynamic classes generated once per render cycle
const getCellClasses = () => {
    const padding = paddingMap[uiConfig.cellPadding];
    const fontSize = fontSizeMap[uiConfig.fontSize];
    const borders = uiConfig.showGridLines ? 'border-gray-200' : 'border-transparent';
    
    return `${padding} ${fontSize} border cursor-pointer hover:bg-blue-50 ${borders}`;
};
```

#### Table Layout Optimization
```javascript
// Choose table layout method based on configuration
<table className={`w-full bg-white ${
    uiConfig.autoSizeColumns ? 'table-auto' : 'table-fixed'
}`}>

// Apply column widths efficiently
style={uiConfig.autoSizeColumns ? {} : {width: `${100 / columns.length}%`}}
```

---

## Development Guidelines

### Code Organization Principles

#### State Management Best Practices
1. **Group Related State**: Keep related state variables together
2. **Use Meaningful Names**: Clear, descriptive variable names
3. **Initialize Properly**: Always provide appropriate initial values
4. **Update Immutably**: Use spread operators and array methods correctly

#### Component Structure Standards
1. **Logical Grouping**: Group state, effects, functions, and render sections
2. **Function Organization**: Place utility functions near their usage
3. **Event Handler Naming**: Use `handle*` prefix for event handlers
4. **Custom Hook Opportunity**: Consider extracting complex logic

### Adding New Features

#### Step-by-Step Feature Addition Process

1. **State Addition**
```javascript
// Add new state variables in appropriate section
const [newFeatureState, setNewFeatureState] = useState(initialValue);
```

2. **Function Implementation**
```javascript
// Add feature logic with proper error handling
const handleNewFeature = () => {
    try {
        // Feature implementation
        setNewFeatureState(newValue);
        addToHistory(data, columns); // If modifying data
    } catch (error) {
        showNotification('Feature failed', 'error');
    }
};
```

3. **UI Integration**
```javascript
// Add UI elements in appropriate section
<button
    onClick={handleNewFeature}
    className="standard-button-classes"
    title="Helpful tooltip"
>
    Feature Action
</button>
```

4. **API Integration** (if needed)
```javascript
// Add API calls with fallback handling
try {
    await apiService.newFeatureEndpoint(params);
    showNotification('Success!', 'success');
} catch (apiError) {
    showNotification('API unavailable, using local fallback', 'info');
}
```

### Styling Guidelines

#### CSS Class Conventions
1. **Use Tailwind CSS**: Follow existing Tailwind patterns
2. **Responsive Design**: Consider mobile and tablet viewports
3. **Consistent Spacing**: Use the established spacing scale
4. **Color Consistency**: Follow the established color palette
5. **Interactive States**: Include hover, focus, disabled states

#### UI Configuration Integration
```javascript
// When adding new configurable elements
const getNewElementClasses = () => {
    const baseClasses = 'base-styling-classes';
    const configurableClasses = getConfigurableClasses();
    return `${baseClasses} ${configurableClasses}`;
};
```

### Error Handling Patterns

#### User-Facing Error Messages
```javascript
const showNotification = (message, type = 'info') => {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    // Create temporary notification element
    const div = document.createElement('div');
    div.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
    div.textContent = message;
    document.body.appendChild(div);
    
    // Auto-remove after 3 seconds
    setTimeout(() => document.body.removeChild(div), 3000);
};
```

#### API Error Handling Strategy
1. **Graceful Degradation**: Provide fallback functionality
2. **User Communication**: Clear error messages
3. **Logging**: Console logging for debugging
4. **Recovery Options**: Allow user to retry operations

---

## Testing Considerations

### Component Testing Strategy

#### Unit Tests
- **State Management**: Test state updates and side effects
- **Utility Functions**: Test Excel column name generation, class generation
- **Event Handlers**: Test click, keyboard, and form interactions
- **Data Transformations**: Test sorting, filtering, and CRUD operations

#### Integration Tests
- **API Communication**: Test data loading and saving
- **User Workflows**: Test complete user interaction sequences
- **Error Scenarios**: Test error handling and recovery

#### Performance Tests
- **Large Dataset Handling**: Test with 50k+ records
- **Memory Usage**: Monitor for memory leaks during extended use
- **Render Performance**: Measure render times for different configurations

### Test Data Requirements

#### Sample Data Structure
```javascript
const testData = {
    rows: [
        {id: 1, name: 'Test Item 1', amount: 100.50, date: '2024-01-15', status: 'Active'},
        {id: 2, name: 'Test Item 2', amount: 250.75, date: '2024-01-16', status: 'Inactive'},
        // ... more test records
    ],
    columns: ['id', 'name', 'amount', 'date', 'status'],
    total_rows: 1000
};
```

#### Edge Cases to Test
1. **Empty Data**: Zero rows, zero columns
2. **Large Data**: 50k+ rows, 100+ columns
3. **Special Characters**: Unicode, HTML entities in data
4. **Null/Undefined**: Missing values in cells
5. **Mixed Data Types**: Numbers, strings, dates in same column

### Accessibility Testing

#### Screen Reader Support
- **ARIA Labels**: Proper labeling for interactive elements
- **Focus Management**: Keyboard navigation support
- **Table Structure**: Proper table headers and structure

#### Keyboard Navigation
- **Tab Order**: Logical tab sequence through interface
- **Keyboard Shortcuts**: Standard shortcuts for common operations
- **Focus Indicators**: Clear visual focus indicators

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Data Not Loading
**Symptoms**: Spinner shows indefinitely, no data appears
**Causes**:
- API endpoint not available
- Invalid fileId parameter
- Network connectivity issues

**Solutions**:
```javascript
// Check browser console for API errors
// Verify fileId is valid
// Test API endpoints in browser network tab
// Check for CORS issues
```

#### 2. Edit Mode Not Working
**Symptoms**: Clicking cells doesn't enter edit mode
**Causes**:
- Event propagation issues
- State update problems
- CSS pointer-events conflicts

**Solutions**:
```javascript
// Check editingCell state in React DevTools
// Verify onClick handlers are attached
// Check for CSS pointer-events: none
// Ensure proper event.stopPropagation() usage
```

#### 3. Performance Issues
**Symptoms**: Slow rendering, laggy interactions
**Causes**:
- Large dataset without pagination
- Inefficient re-renders
- Memory leaks in event handlers

**Solutions**:
```javascript
// Enable pagination for large datasets
// Use React DevTools Profiler
// Check for unnecessary re-renders
// Verify useMemo and useCallback usage
```

#### 4. Selection Not Working
**Symptoms**: Column/row selection not highlighting
**Causes**:
- Set operations not updating properly
- CSS classes not applying
- State synchronization issues

**Solutions**:
```javascript
// Check selectedColumns/selectedRows in React DevTools
// Verify CSS class applications
// Ensure proper Set operations
// Check for key prop issues in mapped elements
```

#### 5. History/Undo Issues
**Symptoms**: Undo/redo not working correctly
**Causes**:
- History array corruption
- Incorrect index management
- State updates not triggering history

**Solutions**:
```javascript
// Check history array structure
// Verify addToHistory calls after modifications
// Ensure proper historyIndex management
// Check for race conditions in state updates
```

### Debugging Tools and Techniques

#### React DevTools Usage
1. **Component State**: Monitor state changes in real-time
2. **Props Inspection**: Verify prop values and changes
3. **Profiler**: Identify performance bottlenecks
4. **Hook State**: Track custom hook states

#### Browser DevTools
1. **Console Logging**: Use structured logging for debugging
2. **Network Tab**: Monitor API calls and responses
3. **Elements Tab**: Inspect DOM structure and CSS
4. **Performance Tab**: Analyze rendering performance

#### Custom Debugging Helpers
```javascript
// Add temporary debugging state
const [debugMode, setDebugMode] = useState(false);

// Conditional debug information
{debugMode && (
    <div className="fixed top-0 right-0 bg-black text-white p-4 z-50 text-xs">
        <pre>{JSON.stringify({
            dataLength: data.length,
            columnsLength: columns.length,
            editingCell,
            selectedColumns: Array.from(selectedColumns),
            selectedRows: Array.from(selectedRows),
            historyIndex,
            historyLength: history.length
        }, null, 2)}</pre>
    </div>
)}
```

### Error Recovery Procedures

#### Graceful Error Recovery
```javascript
// Component error boundary for graceful failures
const [hasError, setHasError] = useState(false);

// Error recovery button
{hasError && (
    <div className="text-center p-8">
        <p className="text-red-600 mb-4">Something went wrong</p>
        <button
            onClick={() => {
                setHasError(false);
                loadFileData(); // Retry data loading
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
        >
            Try Again
        </button>
    </div>
)}
```

#### Data Corruption Recovery
```javascript
// Validate data structure before rendering
const validateData = (data, columns) => {
    if (!Array.isArray(data) || !Array.isArray(columns)) {
        throw new Error('Invalid data structure');
    }
    
    // Additional validation logic
    return true;
};

// Use validation in data loading
try {
    validateData(response.data.rows, response.data.columns);
    setData(response.data.rows);
    setColumns(response.data.columns);
} catch (error) {
    setError('Data validation failed');
    // Fallback to empty state or sample data
}
```

---

## Conclusion

The DataViewer component is a sophisticated piece of software that balances complexity with usability. It provides Excel-like functionality in a web environment while maintaining performance and accessibility standards. Understanding this architecture will help developers:

1. **Add Features Confidently**: Following established patterns and conventions
2. **Debug Effectively**: Using the provided troubleshooting guides and tools
3. **Maintain Performance**: Applying the documented optimization strategies
4. **Ensure Quality**: Following the testing guidelines and best practices

When modifying this component, always consider the impact on existing functionality, maintain backward compatibility, and follow the established architectural patterns. The component's modular design allows for incremental improvements while preserving the core user experience.

For additional support or questions about this architecture, refer to the broader project documentation or consult with the development team.