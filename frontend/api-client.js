// GoSheet API Client - Mode-aware (web vs Electron)
// Web mode: fetch to HTTP API (for Playwright testing)
// Electron mode: HTTP API for spreadsheet operations + Electron IPC for file dialogs

// Story 3.5: Detect Electron mode by checking for window.electronAPI
const isElectronMode = typeof window !== 'undefined' && window.electronAPI !== undefined;

if (isElectronMode) {
    console.log('[api-client] Electron mode - using HTTP API + Electron IPC for dialogs');
} else {
    console.log('[api-client] Web mode - using HTTP fetch');
}

const API_BASE = '';

// Convert column index to letter (0 -> A, 25 -> Z, 26 -> AA)
function colToLetter(col) {
    let result = '';
    col++;
    while (col > 0) {
        col--;
        result = String.fromCharCode(65 + (col % 26)) + result;
        col = Math.floor(col / 26);
    }
    return result;
}

// Web mode: fetch to unified API
async function fetchUnified(method, path, body = null) {
    const opts = { method, headers: {} };
    if (body !== null) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, opts);
    const json = await res.json();
    if (!json.success) {
        throw new Error(json.error || 'API error');
    }
    return json;
}

// API Functions

const GetCellValue = async (row, col) => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations (same as web mode)
    const json = await fetchUnified('GET', `/api/cell/value?row=${row}&col=${col}`);
    return json.data?.computed ?? '';
};

const GetCellRawValue = async (row, col) => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations
    const json = await fetchUnified('GET', `/api/cell/raw?row=${row}&col=${col}`);
    return json.data?.value ?? '';
};

const SetCellValue = async (row, col, value) => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations
    const json = await fetchUnified('POST', '/api/cell/set', { row, col, value });
    return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const GetCellRef = async (row, col) => {
    // Story 3.5: Compute cell reference locally (no API call needed)
    return colToLetter(col) + (row + 1);
};

const GetAllCells = async () => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations
    const json = await fetchUnified('GET', '/api/cells/all');
    const cells = {};
    (json.data || []).forEach(c => {
        const ref = colToLetter(c.col) + (c.row + 1);
        cells[ref] = c.computed ?? c.value ?? '';
    });
    return cells;
};

const GetFileStatus = async () => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations
    const json = await fetchUnified('GET', '/api/file/status');
    return json.data || { path: '', saved: true, modified: false, filename: 'Untitled' };
};

const NewFile = async () => {
    // Story 3.5: Electron uses HTTP API for spreadsheet operations
    await fetchUnified('POST', '/api/file/new');
};

const SaveFile = async (path) => {
    // Story 3.5: Use Electron IPC for file dialog, HTTP API for save operation
    if (isElectronMode && !path) {
        // Show Electron save dialog
        const status = await GetFileStatus();
        const defaultName = status.filename || 'Untitled.sheet';
        path = await window.electronAPI.saveFileDialog(defaultName);
        
        if (!path) {
            // User cancelled dialog
            console.log('[api-client] Save cancelled by user');
            return null;
        }
    }
    
    // Save via HTTP API
    await fetchUnified('POST', '/api/file/save', { path });
    
    // Story 7.5: Return path for recent files tracking
    return path;
};

const LoadFile = async (path) => {
    // Story 3.5: Use Electron IPC for file dialog, HTTP API for load operation
    if (isElectronMode && !path) {
        // Show Electron open dialog
        path = await window.electronAPI.openFileDialog();
        
        if (!path) {
            // User cancelled dialog
            console.log('[api-client] Load cancelled by user');
            return null;
        }
    }
    
    // Load via HTTP API
    await fetchUnified('POST', '/api/file/load', { path });
    
    // Story 7.5: Return path for recent files tracking
    return path;
};

const SaveAs = async () => {
    // Story 3.5: SaveAs is just SaveFile with empty path (forces dialog)
    await SaveFile('');
};

const PreviewCSV = async (path) => {
    // Story 6.1: Use Electron IPC for file dialog, HTTP API for CSV preview
    if (isElectronMode && !path) {
        // Show Electron import CSV dialog
        path = await window.electronAPI.importCSVDialog();
        
        if (!path) {
            // User cancelled dialog
            console.log('[api-client] Import CSV cancelled by user');
            return null;
        }
    }
    
    // Get CSV preview via HTTP API
    const json = await fetchUnified('POST', '/api/csv/preview', { path });
    return {
        path,
        rows: json.rows,
        cols: json.cols,
        preview: json.preview
    };
};

const ImportCSV = async (path) => {
    // Story 6.2: Import CSV data into spreadsheet
    const json = await fetchUnified('POST', '/api/csv/import', { path });
    return {
        rows: json.rows,
        cols: json.cols,
        message: json.message
    };
};

const ExportCSV = async (path) => {
    console.log('[ExportCSV] Starting, path:', path);
    // Story 6.3: Export spreadsheet to CSV
    if (isElectronMode && !path) {
        console.log('[ExportCSV] Electron mode, showing save dialog...');
        // Show Electron save dialog
        const status = await GetFileStatus();
        console.log('[ExportCSV] File status:', status);
        const defaultName = status.filename ? status.filename.replace(/\.sheet$/, '.csv') : 'Untitled.csv';
        console.log('[ExportCSV] Default name:', defaultName);
        path = await window.electronAPI.exportCSVDialog(defaultName);
        console.log('[ExportCSV] Dialog returned path:', path);
        
        if (!path) {
            // User cancelled dialog
            console.log('[ExportCSV] Export CSV cancelled by user');
            return null;
        }
    }
    
    console.log('[ExportCSV] Calling backend API with path:', path);
    // Export via HTTP API
    const json = await fetchUnified('POST', '/api/csv/export', { path });
    console.log('[ExportCSV] Backend returned:', json);
    return {
        path,
        rows: json.rows,
        cols: json.cols,
        message: json.message
    };
};

// Export for app.js (now a module)
export { GetCellValue, GetCellRawValue, SetCellValue, GetCellRef, GetAllCells, GetFileStatus, NewFile, SaveFile, SaveAs, LoadFile, PreviewCSV, ImportCSV, ExportCSV };
