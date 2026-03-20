// app-ui.js — Welcome screen, context menu, and CSV import orchestration.

import {
  GetFileStatus,
  LoadFile,
  GetStyles,
  ApplyRangeStyle,
  ClearRange,
  ImportCSV,
  PreviewCSV,
} from './api-client.js';
import { appState, OPEN_END } from './app-state.js';
import { showAlert, showConfirmDialog } from './app-utils.js';
import { formatToCssPreview, showCSVPreviewModal } from './app-modals.js';
import { applyAlignmentToSelection } from './app-cell-editor.js';
import { applySelectionRange } from './app-grid.js';
import {
  copySelectionToClipboard,
  pasteFromClipboard,
} from './app-file-ops.js';

// Story 8.2: View switching helpers
export function showWelcome() {
  document.querySelector('#app').setAttribute('data-view', 'welcome');
  populateWelcomeRecentFiles();
  if (window.electronAPI?.syncRecentFilesMenu) {
    window.electronAPI.syncRecentFilesMenu();
  }
}

export function showSpreadsheet() {
  document.querySelector('#app').setAttribute('data-view', 'spreadsheet');
}

// Story 8.2: Populate recent files in welcome screen (up to 5)
async function populateWelcomeRecentFiles() {
  const listEl = document.getElementById('welcome-recent-list');
  if (!listEl) return;
  try {
    const paths = window.electronAPI?.getRecentFiles
      ? await window.electronAPI.getRecentFiles()
      : [];
    if (!paths || paths.length === 0) {
      listEl.innerHTML =
        '<li class="welcome-recent-empty">No recent files</li>';
      return;
    }
    listEl.innerHTML = paths
      .map((filePath) => {
        const parts = filePath.split('/');
        const filename = parts.pop() || filePath;
        const parentDir = parts.length ? parts.slice(-1)[0] : '';
        const display = parentDir ? `${filename} — ${parentDir}` : filename;
        return `<li class="welcome-recent-item" data-path="${filePath.replace(/"/g, '&quot;')}">${display}</li>`;
      })
      .join('');
    listEl.querySelectorAll('.welcome-recent-item').forEach((li) => {
      li.addEventListener('click', () => loadFileByPath(li.dataset.path));
    });
  } catch (err) {
    console.error('[App] Error loading recent files:', err);
    listEl.innerHTML = '<li class="welcome-recent-empty">No recent files</li>';
  }
}

// Story 23.4: Build user-friendly error message for load failures
function formatLoadError(error, filePath) {
  const errMsg = error.message?.toLowerCase() ?? '';
  const isNotFound =
    errMsg.includes('no such file') ||
    errMsg.includes('not found') ||
    errMsg.includes('enoent');
  const isPermissionDenied =
    errMsg.includes('permission denied') || error.code === 'EACCES';
  if (isNotFound) return `File not found: ${filePath}`;
  if (isPermissionDenied) return `Permission denied: ${filePath}`;
  const raw = String(error.message ?? 'Unknown error');
  return `Error loading file: ${raw.length > 200 ? raw.slice(0, 200) + '…' : raw}`;
}

// Story 8.2: Load file by path (shared by menu-open-recent and welcome recent files)
export async function loadFileByPath(filePath) {
  const status = await GetFileStatus();
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Open a different file anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) return;
  }
  try {
    window.setReadOnly?.(false);
    const loadedPath = await LoadFile(filePath);
    showSpreadsheet();
    if (loadedPath && window.electronAPI?.addRecentFile) {
      await window.electronAPI.addRecentFile(loadedPath);
    }
    appState.ROWS = 100;
    appState.COLS = 26;
    await window.buildSpreadsheet?.();
    await window.loadCells?.();
    window.selectCell?.(0, 0);
    window.updateFileStatus?.();
    window.syncFormatMenuFromApi?.();
  } catch (error) {
    console.error('[App] Error loading file:', error);
    const wasOnWelcome =
      document.querySelector('#app')?.getAttribute('data-view') === 'welcome';
    if (filePath && window.electronAPI?.removeRecentFile) {
      await window.electronAPI.removeRecentFile(filePath);
    }
    if (wasOnWelcome) {
      showWelcome();
    }
    await showAlert(formatLoadError(error, filePath));
  }
}

// Story 16.4: Open a file in read-only mode via file dialog
export async function openFileReadOnly() {
  const filePath = await window.electronAPI.openFileDialog();
  if (!filePath) return;
  await loadFileByPath(filePath);
  window.setReadOnly?.(true);
}

// Story 8.2: Setup welcome screen - show welcome on launch, wire button handlers
export async function setupWelcomeScreen() {
  // If main process encoded a file path in the URL, go straight to spreadsheet
  // view — avoids a welcome-screen flash before the file loads via IPC.
  const pendingFile = new URLSearchParams(location.search).get('file');
  if (pendingFile) {
    showSpreadsheet();
  } else {
    const status = await GetFileStatus();
    const hasFile = status.path && status.path !== '';
    if (hasFile) {
      showSpreadsheet();
    } else {
      showWelcome();
    }
  }

  document
    .getElementById('welcome-btn-new')
    ?.addEventListener('click', async () => {
      showSpreadsheet();
      document.getElementById('new-btn').click();
    });
  document
    .getElementById('welcome-btn-open')
    ?.addEventListener('click', async () => {
      document.getElementById('load-btn').click();
    });
  document
    .getElementById('welcome-btn-import')
    ?.addEventListener('click', async () => {
      await handleImportCSV();
    });
}

// Story 7.12: CSV Import
export async function handleImportCSV() {
  try {
    const preview = await PreviewCSV('');
    if (!preview) return;
    showCSVPreviewModal(preview);
  } catch (error) {
    await showAlert('Error previewing CSV: ' + error.message);
  }
}

// Story 16.3: Import CSV directly by path (CLI / Finder "Open With")
export async function handleImportCSVByPath(filePath) {
  try {
    const status = await GetFileStatus();
    if (status.hasUnsavedChanges) {
      const confirmed = await showConfirmDialog(
        'You have unsaved changes! Open CSV file anyway? All unsaved changes will be lost.'
      );
      if (!confirmed) return;
    }
    showSpreadsheet();
    window.setReadOnly?.(false);
    const result = await ImportCSV(filePath);
    appState.ROWS = Math.max(100, result.rows);
    appState.COLS = Math.max(26, result.cols);
    await window.buildSpreadsheet?.();
    await window.loadCells?.();
    window.selectCell?.(0, 0);
    window.updateFileStatus?.();
    window.syncFormatMenuFromApi?.();
    if (window.__DEBUG__) console.log('[App] CSV imported by path:', filePath);
  } catch (error) {
    console.error('[App] Error importing CSV by path:', error);
    showWelcome();
    await showAlert('Error importing CSV: ' + error.message);
  }
}

// Story 13.2 / 13.3: Context menu
async function populateContextMenuFormatItems() {
  const container = document.getElementById('context-menu-format-items');
  if (!container) return;
  try {
    const styles = await GetStyles();
    container.innerHTML = styles
      .map((s) => {
        const css = formatToCssPreview(s.format);
        const styleStr = Object.entries(css)
          .map(
            ([k, v]) =>
              `${k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase())}:${v}`
          )
          .join(';');
        const label = s.name || 'Style ' + s.id;
        return `<button type="button" class="context-menu-item" data-action="format-style-${s.id}" disabled><span style="${styleStr}">${label}</span></button>`;
      })
      .join('');
  } catch (err) {
    console.error('[App] Failed to load styles for context menu:', err);
    document.getElementById('context-menu-format-items').innerHTML = '';
  }
}

function updateContextMenuState() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  const hasSelection = !!appState.selectedCell;
  menu.querySelectorAll('.context-menu-item').forEach((btn) => {
    const action = btn.dataset.action;
    if (action === 'copy' || action === 'paste' || action === 'clear') {
      btn.disabled = !hasSelection;
    }
    if (action?.startsWith('format-style-')) {
      btn.disabled = !hasSelection;
    }
  });
}

export async function showContextMenu(x, y) {
  if (
    document.querySelector('#app')?.getAttribute('data-view') !== 'spreadsheet'
  )
    return;
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  await populateContextMenuFormatItems();
  updateContextMenuState();
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.setAttribute('aria-hidden', 'false');
  menu.focus();
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight)
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  });
}

export function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.setAttribute('aria-hidden', 'true');
}

export function setupContextMenuHandlers() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.context-menu-item');
    if (!btn || btn.disabled) return;
    if (btn.classList.contains('context-menu-submenu-trigger')) return;
    const action = btn.dataset.action;
    hideContextMenu();
    handleContextMenuAction(action);
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
      hideContextMenu();
    }
  });
}

async function handleContextMenuAction(action) {
  if (appState.isReadOnly && !['copy', 'select-all'].includes(action)) {
    await showAlert('File is read-only. Cannot modify cells.');
    return;
  }
  try {
    await dispatchContextMenuAction(action);
  } catch (err) {
    console.error('[App] Context menu action error:', err);
    await showAlert('Error: ' + err.message);
  }
}

async function dispatchContextMenuAction(action) {
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  if (action === 'copy') {
    await copySelectionToClipboard();
  } else if (action === 'paste') {
    await pasteFromClipboard();
  } else if (action?.startsWith('format-style-')) {
    const styleId = parseInt(action.replace('format-style-', ''), 10);
    if (Number.isFinite(styleId) && styleId > 0) {
      const result = await ApplyRangeStyle(
        startRow,
        startCol,
        endRow,
        endCol,
        styleId
      );
      window.applyUndoRedoState?.(result);
      await window.refreshAllCells?.();
    }
  } else if (action === 'align-left') {
    await applyAlignmentToSelection('left');
  } else if (action === 'align-center') {
    await applyAlignmentToSelection('center');
  } else if (action === 'align-right') {
    await applyAlignmentToSelection('right');
  } else if (action === 'clear-formatting') {
    window.clearFormattingFromSelection?.();
  } else if (action === 'clear') {
    const result = await ClearRange(startRow, startCol, endRow, endCol);
    if (result?.hasUnsavedChanges !== undefined)
      window.displayFileStatus?.(result.hasUnsavedChanges);
    await window.refreshAllCells?.();
    window.updateFileStatus?.();
  }
}

async function handleContextMenuOnCell(e, cell) {
  const row = parseInt(cell.dataset.row, 10);
  const col = parseInt(cell.dataset.col, 10);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;
  // Note: endRow/endCol may be OPEN_END (Infinity) for row/column selections.
  // Comparisons against Infinity are intentional: any finite row/col <= Infinity is true.
  const inSelection =
    row >= appState.selectionRange.startRow &&
    row <= appState.selectionRange.endRow &&
    col >= appState.selectionRange.startCol &&
    col <= appState.selectionRange.endCol;
  if (!inSelection) {
    appState.selectionMode = 'cell';
    window.selectCell?.(row, col);
  }
  await showContextMenu(e.clientX, e.clientY);
}

async function handleContextMenuOnRowHeader(e, rowHeader) {
  const row = parseInt(rowHeader.dataset.row, 10);
  if (!Number.isFinite(row)) return;
  appState.selectionMode = 'row';
  applySelectionRange(row, 0, row, OPEN_END);
  if (window.electronAPI?.updateMenuState)
    window.electronAPI.updateMenuState({
      selectionMode: 'row',
      selectedRow: row,
    });
  await showContextMenu(e.clientX, e.clientY);
}

async function handleContextMenuOnColHeader(e, colHeader) {
  const col = parseInt(colHeader.dataset.col, 10);
  if (!Number.isFinite(col)) return;
  appState.selectionMode = 'column';
  applySelectionRange(0, col, OPEN_END, col);
  if (window.electronAPI?.updateMenuState)
    window.electronAPI.updateMenuState({
      selectionMode: 'column',
      selectedCol: col,
    });
  await showContextMenu(e.clientX, e.clientY);
}

/**
 * Story 13.2: Handle contextmenu event on the table.
 */
export async function handleTableContextMenu(e) {
  if (e.target.classList.contains('cell-editor')) return;
  const cell = e.target.closest('.cell');
  const rowHeader = e.target.closest('.row-header');
  const colHeader = e.target.closest('.column-header');
  if (cell) {
    e.preventDefault();
    await handleContextMenuOnCell(e, cell);
  } else if (rowHeader && rowHeader.dataset.row !== undefined) {
    e.preventDefault();
    await handleContextMenuOnRowHeader(e, rowHeader);
  } else if (colHeader && colHeader.dataset.col !== undefined) {
    e.preventDefault();
    await handleContextMenuOnColHeader(e, colHeader);
  } else if (e.target.closest('.corner-header')) {
    e.preventDefault();
    await showContextMenu(e.clientX, e.clientY);
  }
}
