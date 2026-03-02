// GoSheet API Client - Mode-aware (web vs Electron)
// Web mode: fetch to HTTP API (for Playwright testing)
// Electron mode: HTTP API for spreadsheet operations + Electron IPC for file dialogs
// @ts-check
/// <reference path="./api-types.d.ts" />

// Story 3.5: Detect Electron mode by checking for window.electronAPI
const isElectronMode =
  typeof window !== 'undefined' && window.electronAPI !== undefined;

if (window.__DEBUG__) {
  if (isElectronMode) {
    console.log(
      '[api-client] Electron mode - using HTTP API + Electron IPC for dialogs'
    );
  } else {
    console.log('[api-client] Web mode - using HTTP fetch');
  }
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
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid JSON response'
        : `API error (${res.status}): ${text.slice(0, 100)}`
    );
  }
  if (!res.ok) {
    throw new Error(json.error || text || `HTTP ${res.status}`);
  }
  if (!json.success) {
    throw new Error(json.error || 'API error');
  }
  return json;
}

// API Functions

const GetCellValue = async (row, col) => {
  // Story 3.5: Electron uses HTTP API for spreadsheet operations (same as web mode)
  const json = await fetchUnified(
    'GET',
    `/api/cell/value?row=${row}&col=${col}`
  );
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
  // Returns { ref: { display, raw, styleId? } } so callers avoid per-cell GetCellRawValue (CR 11-4 perf)
  const json = await fetchUnified('GET', '/api/cells/all');
  const cells = {};
  (json.data || []).forEach((c) => {
    const ref = colToLetter(c.col) + (c.row + 1);
    const display = c.computed ?? c.value ?? '';
    const raw = c.value ?? '';
    cells[ref] = { display, raw, styleId: c.styleId };
  });
  return cells;
};

// Story 13.1: Insert row/column
const InsertRow = async (row) => {
  const json = await fetchUnified('POST', '/api/row/insert', { row });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const InsertColumn = async (col) => {
  const json = await fetchUnified('POST', '/api/column/insert', { col });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

// Story 12.3: Format cleanup - remove style from empty cells
const CleanupFormat = async () => {
  const json = await fetchUnified('POST', '/api/format/cleanup');
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

// Story 13.2: Clear range (batch clear for context menu)
const ClearRange = async (startRow, startCol, endRow, endCol) => {
  const json = await fetchUnified('POST', '/api/range/clear', {
    startRow,
    startCol,
    endRow,
    endCol,
  });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

// Story 13.3: Style management API
const GetStyles = async () => {
  const json = await fetchUnified('GET', '/api/styles');
  return json.data?.styles ?? [];
};

const UpdateStyle = async (id, format) => {
  const json = await fetchUnified('PUT', `/api/styles/${id}`, { format });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const AddStyle = async (name, format) => {
  const json = await fetchUnified('POST', '/api/styles', { name, format });
  return {
    id: json.data?.id ?? 0,
    hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true,
  };
};

const DeleteStyle = async (id) => {
  const json = await fetchUnified('DELETE', `/api/styles/${id}`);
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

// Story 12.2: Apply style to cell or range
const ApplyRangeStyle = async (startRow, startCol, endRow, endCol, styleId) => {
  const json = await fetchUnified('POST', '/api/range/style', {
    startRow,
    startCol,
    endRow,
    endCol,
    styleId,
  });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const GetFileStatus = async () => {
  // Story 3.5: Electron uses HTTP API for spreadsheet operations
  const json = await fetchUnified('GET', '/api/file/status');
  return (
    json.data || {
      path: '',
      saved: true,
      modified: false,
      filename: 'Untitled',
    }
  );
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
      if (window.__DEBUG__) console.log('[api-client] Save cancelled by user');
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
      if (window.__DEBUG__) console.log('[api-client] Load cancelled by user');
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
      if (window.__DEBUG__)
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
    preview: json.preview,
  };
};

const ImportCSV = async (path) => {
  // Story 6.2: Import CSV data into spreadsheet
  const json = await fetchUnified('POST', '/api/csv/import', { path });
  return {
    rows: json.rows,
    cols: json.cols,
    message: json.message,
  };
};

const GetMerges = async () => {
  const json = await fetchUnified('GET', '/api/merges');
  return json.data?.merges ?? [];
};

const SetMerge = async (startRow, startCol, rowSpan, colSpan) => {
  const json = await fetchUnified('POST', '/api/merge', {
    startRow,
    startCol,
    rowSpan,
    colSpan,
  });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const Unmerge = async (startRow, startCol) => {
  const json = await fetchUnified('POST', '/api/unmerge', {
    startRow,
    startCol,
  });
  return { hasUnsavedChanges: json.data?.hasUnsavedChanges ?? true };
};

const ExportCSV = async (path) => {
  if (window.__DEBUG__) console.log('[ExportCSV] Starting, path:', path);
  // Story 6.3: Export spreadsheet to CSV
  if (isElectronMode && !path) {
    if (window.__DEBUG__)
      console.log('[ExportCSV] Electron mode, showing save dialog...');
    // Show Electron save dialog
    const status = await GetFileStatus();
    if (window.__DEBUG__) console.log('[ExportCSV] File status:', status);
    const defaultName = status.filename
      ? status.filename.replace(/\.sheet$/, '.csv')
      : 'Untitled.csv';
    if (window.__DEBUG__) console.log('[ExportCSV] Default name:', defaultName);
    path = await window.electronAPI.exportCSVDialog(defaultName);
    if (window.__DEBUG__)
      console.log('[ExportCSV] Dialog returned path:', path);

    if (!path) {
      // User cancelled dialog
      if (window.__DEBUG__)
        console.log('[ExportCSV] Export CSV cancelled by user');
      return null;
    }
  }

  if (window.__DEBUG__)
    console.log('[ExportCSV] Calling backend API with path:', path);
  // Export via HTTP API
  const json = await fetchUnified('POST', '/api/csv/export', { path });
  if (window.__DEBUG__) console.log('[ExportCSV] Backend returned:', json);
  return {
    path,
    rows: json.rows,
    cols: json.cols,
    message: json.message,
  };
};

// Export for app.js (now a module)
export {
  GetCellValue,
  GetCellRawValue,
  SetCellValue,
  GetCellRef,
  GetAllCells,
  GetFileStatus,
  GetMerges,
  SetMerge,
  Unmerge,
  ApplyRangeStyle,
  GetStyles,
  UpdateStyle,
  AddStyle,
  DeleteStyle,
  CleanupFormat,
  ClearRange,
  InsertRow,
  InsertColumn,
  NewFile,
  SaveFile,
  SaveAs,
  LoadFile,
  PreviewCSV,
  ImportCSV,
  ExportCSV,
};
