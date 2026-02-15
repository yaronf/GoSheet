// GoSheet API Client - Mode-aware (web vs native)
// Web mode: fetch to unified HTTP API
// Native mode: Wails generated bindings (ES6 modules)

// Try to import Wails bindings (only available in native mode)
let WailsAPI = null;
let isNativeMode = false;

try {
    // Dynamic import for Wails bindings
    const module = await import('./gosheet/wailsapi.js');
    WailsAPI = module;
    isNativeMode = true;
    console.log('[api-client] Native mode - using Wails bindings');
} catch (e) {
    // Import failed - we're in web mode
    isNativeMode = false;
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
    if (isNativeMode) {
        const r = await WailsAPI.GetCellValue(row, col);
        return r.data?.computed ?? '';
    }
    const json = await fetchUnified('GET', `/api/get-cell?row=${row}&col=${col}`);
    return json.data?.computed ?? '';
};

const GetCellRawValue = async (row, col) => {
    if (isNativeMode) {
        const r = await WailsAPI.GetCellValue(row, col);
        return r.data?.value ?? '';
    }
    const json = await fetchUnified('GET', `/api/get-cell?row=${row}&col=${col}`);
    return json.data?.value ?? '';
};

const SetCellValue = async (row, col, value) => {
    if (isNativeMode) {
        const r = await WailsAPI.SetCellValue(row, col, value);
        return { hasUnsavedChanges: r.data?.hasUnsavedChanges ?? true };
    }
    const json = await fetchUnified('POST', '/api/set-cell', { row, col, value });
    return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const GetCellRef = async (row, col) => {
    if (isNativeMode) {
        const r = await WailsAPI.GetCellRef(row, col);
        return r.data?.ref ?? colToLetter(col) + (row + 1);
    }
    // Web mode doesn't have GetCellRef endpoint, compute locally
    return colToLetter(col) + (row + 1);
};

const GetAllCells = async () => {
    if (isNativeMode) {
        const r = await WailsAPI.GetAllCells();
        const cells = {};
        (r.data || []).forEach(c => {
            const ref = colToLetter(c.col) + (c.row + 1);
            cells[ref] = c.computed ?? c.value ?? '';
        });
        return cells;
    }
    const json = await fetchUnified('GET', '/api/cells');
    const cells = {};
    (json.data || []).forEach(c => {
        const ref = colToLetter(c.col) + (c.row + 1);
        cells[ref] = c.computed ?? c.value ?? '';
    });
    return cells;
};

const GetFileStatus = async () => {
    if (isNativeMode) {
        const r = await WailsAPI.GetFileStatus();
        return r.data || { path: '', saved: true, modified: false, filename: 'Untitled' };
    }
    const json = await fetchUnified('GET', '/api/status');
    return json.data || { path: '', saved: true, modified: false, filename: 'Untitled' };
};

const NewFile = async () => {
    if (isNativeMode) {
        await WailsAPI.NewSpreadsheet();
        return;
    }
    await fetchUnified('POST', '/api/new');
};

const SaveFile = async (path) => {
    if (isNativeMode) {
        await WailsAPI.SaveFile(path);
        return;
    }
    await fetchUnified('POST', '/api/save', { path });
};

const LoadFile = async (path) => {
    if (isNativeMode) {
        // In native mode, use OpenFile() which shows the dialog
        await WailsAPI.OpenFile();
        return;
    }
    // In web mode, path is required (for Playwright tests)
    await fetchUnified('POST', '/api/load', { path });
};

const SaveAs = async () => {
    if (isNativeMode) {
        await WailsAPI.SaveAs();
        return;
    }
    // Web mode doesn't have SaveAs (uses Save with different path)
    throw new Error('SaveAs not available in web mode');
};

// Export for app.js (now a module)
export { GetCellValue, GetCellRawValue, SetCellValue, GetCellRef, GetAllCells, GetFileStatus, NewFile, SaveFile, SaveAs, LoadFile };
