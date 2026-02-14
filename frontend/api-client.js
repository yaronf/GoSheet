// GoSheet API Client - Mode-aware (web vs native)
// Web mode: fetch to unified HTTP API
// Native mode: Wails IPC (Epic 3 - stub for now)

const API_BASE = '';

const isNativeMode = typeof window !== 'undefined' && typeof window.wails !== 'undefined';

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

// Web mode: fetch to unified API, adapt Response format
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

// API Functions - same signatures as legacy, adapted for unified API

const GetCellValue = async (row, col) => {
    if (isNativeMode) {
        return window.wails.Call.GetCellValue(row, col).then(r => r.data?.computed ?? '');
    }
    const json = await fetchUnified('GET', `/api/get-cell?row=${row}&col=${col}`);
    return json.data?.computed ?? '';
};

const GetCellRawValue = async (row, col) => {
    if (isNativeMode) {
        return window.wails.Call.GetCellValue(row, col).then(r => r.data?.value ?? '');
    }
    const json = await fetchUnified('GET', `/api/get-cell?row=${row}&col=${col}`);
    return json.data?.value ?? '';
};

const SetCellValue = async (row, col, value) => {
    if (isNativeMode) {
        const r = await window.wails.Call.SetCellValue(row, col, value);
        return { hasUnsavedChanges: r.data?.hasUnsavedChanges ?? true };
    }
    const json = await fetchUnified('POST', '/api/set-cell', { row, col, value });
    return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const GetCellRef = async (row, col) => {
    if (isNativeMode) {
        return window.wails.Call.GetCellRef(row, col).then(r => r.data ?? colToLetter(col) + (row + 1));
    }
    return colToLetter(col) + (row + 1);
};

const GetAllCells = async () => {
    if (isNativeMode) {
        const r = await window.wails.Call.GetAllCells();
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
        const r = await window.wails.Call.GetFileStatus();
        return { path: r.data?.path ?? '', hasUnsavedChanges: r.data?.modified ?? false };
    }
    const json = await fetchUnified('GET', '/api/status');
    return {
        path: json.data?.path ?? '',
        hasUnsavedChanges: json.data?.modified ?? false
    };
};

const NewFile = async () => {
    if (isNativeMode) {
        await window.wails.Call.NewSpreadsheet();
        return { success: true };
    }
    await fetchUnified('POST', '/api/new');
    return { success: true };
};

// File operations - use legacy routes (no unified equivalents for upload/download)
const DownloadFile = async (filename) => {
    const response = await fetch(`${API_BASE}/api/file/download`);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }
    return await response.blob();
};

const UploadFile = async (fileData) => {
    const response = await fetch(`${API_BASE}/api/file/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: fileData
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }
    return await response.json();
};
