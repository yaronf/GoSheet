// app-file-ops.js — File status, undo/redo, export CSV, and Electron menu event listeners.

import {
  GetFileStatus,
  SaveFile,
  ExportCSV,
  Undo,
  Redo,
  SetMerge,
  Unmerge,
  ApplyRangeStyle,
  ClearRangeFormat,
  CleanupFormat,
  InsertRow,
  InsertColumn,
  DeleteRow,
  DeleteColumn,
  GetCellRawValue,
  GetAllCells,
  SetCellValue,
  SetRangeValues,
  ClearRange,
  GetStyles,
  ShiftFormula,
} from './api-client.js';
import { appState, OPEN_END } from './app-state.js';
import { showAlert, announceToScreenReader, colToLetter } from './app-utils.js';
import {
  selectionOverlapsMerge,
  getMergeInfo,
  applySelectionRange,
  expandGridIfNeeded,
} from './app-grid.js';
import { applyAlignmentToSelection, STYLE_ID } from './app-cell-editor.js';
import {
  showFormulaHelpModal,
  showUserGuideModal,
  showManageStylesModal,
  formatToCssPreview,
} from './app-modals.js';

// Update file status display
export function displayFileStatus(hasUnsavedChanges) {
  const statusEl = document.getElementById('file-status');
  if (hasUnsavedChanges) {
    statusEl.textContent = '● Unsaved changes';
    statusEl.style.color = 'var(--color-warning)';
    announceToScreenReader('Unsaved changes');
  } else {
    statusEl.textContent = '✓ Saved';
    statusEl.style.color = 'var(--color-success)';
    announceToScreenReader('File saved');
  }

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = !hasUnsavedChanges;

  window.currentHasUnsavedChanges = hasUnsavedChanges;

  if (window.electronAPI?.updateMenuState) {
    window.electronAPI.updateMenuState({
      hasUnsavedChanges,
      hasFilePath: false,
    });
  }
}

// Story 16.4: Update undo/redo toolbar button disabled state for read-only transitions
export function updateUndoRedoToolbarForReadOnly(readOnly) {
  const ms = window._lastUndoRedoState;
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = readOnly || (ms ? !ms.canUndo : true);
  if (redoBtn) redoBtn.disabled = readOnly || (ms ? !ms.canRedo : true);
}

// Story 16.4: Set read-only mode and update all UI accordingly
export function setReadOnly(value) {
  appState.isReadOnly = value;
  const indicator = document.getElementById('readonly-indicator');
  if (indicator) indicator.style.display = value ? 'inline' : 'none';
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = value || !window.currentHasUnsavedChanges;
  // Story 19.4: disable/enable dynamic style buttons (alignment buttons removed)
  document
    .querySelectorAll('.toolbar-style-btn')
    .forEach((btn) => (btn.disabled = value));
  updateUndoRedoToolbarForReadOnly(value);
  if (window.electronAPI?.updateMenuState) {
    window.electronAPI.updateMenuState({ isReadOnly: value });
  }
}

// Fetch and update file status from server
export async function updateFileStatus() {
  try {
    const status = await GetFileStatus();
    displayFileStatus(status.hasUnsavedChanges);
    document.title = `GoSheet - ${status.filename || 'Untitled'}`;
    if (window.electronAPI?.updateMenuState) {
      window.electronAPI.updateMenuState({
        hasUnsavedChanges: status.hasUnsavedChanges,
        hasFilePath: status.path !== '',
      });
    }
  } catch (error) {
    console.error('Error updating file status:', error);
  }
}

// Story 15.2: Update undo/redo state in menu and toolbar
export function applyUndoRedoState(state) {
  window._lastUndoRedoState = state;
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = appState.isReadOnly || !state.canUndo;
  if (redoBtn) redoBtn.disabled = appState.isReadOnly || !state.canRedo;
  if (window.electronAPI?.updateMenuState) {
    window.electronAPI.updateMenuState({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undoDescription: state.undoDescription,
      redoDescription: state.redoDescription,
    });
  }
  if (state.hasUnsavedChanges !== undefined) {
    displayFileStatus(state.hasUnsavedChanges);
  }
}

// Story 15.2: Perform undo
export async function performUndo() {
  try {
    const result = await Undo();
    await window.refreshAllCells?.();
    displayFileStatus(result.hasUnsavedChanges);
    applyUndoRedoState(result);
  } catch (error) {
    console.error('[App] Error during Undo:', error);
  }
}

// Story 15.2: Perform redo
export async function performRedo() {
  try {
    const result = await Redo();
    await window.refreshAllCells?.();
    displayFileStatus(result.hasUnsavedChanges);
    applyUndoRedoState(result);
  } catch (error) {
    console.error('[App] Error during Redo:', error);
  }
}

// Story 19.4: Build (or rebuild) dynamic style buttons in the toolbar.
function buildToolbarStyleButtons(styles) {
  const container = document.getElementById('toolbar-style-buttons');
  if (!container) return;
  container.innerHTML = '';
  for (const s of styles) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `style-btn-${s.id}`;
    btn.className = 'toolbar-btn toolbar-style-btn';
    btn.setAttribute('data-style-id', s.id);
    btn.title = `Apply ${s.name} style`;
    btn.setAttribute('aria-label', `Apply ${s.name} style`);
    btn.textContent = s.name;
    // Apply format preview (fill, font, etc.) so custom styles like Wrapped show correctly
    const css = formatToCssPreview(s.format);
    if (css && Object.keys(css).length > 0) {
      for (const [k, v] of Object.entries(css)) {
        if (k === 'minWidth')
          continue; /* skip — for wrap only, would stretch button */
        const prop = k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());
        btn.style.setProperty(prop, v);
      }
    }
    if (appState.isReadOnly) btn.disabled = true;
    btn.addEventListener('click', () => {
      window.__applyStyleToSelection?.(s.id);
    });
    container.appendChild(btn);
  }
}
window.buildToolbarStyleButtons = buildToolbarStyleButtons;

// Sync Format menu with styles from API — assigned at module load so always available
window.syncFormatMenuFromApi = async function syncFormatMenuFromApi() {
  if (
    document.querySelector('#app')?.getAttribute('data-view') !== 'spreadsheet'
  )
    return;
  try {
    const styles = await GetStyles();
    window.electronAPI?.syncFormatMenu?.(styles);
    buildToolbarStyleButtons(styles);
  } catch (err) {
    console.error('[App] Failed to sync Format menu:', err);
  }
};

// Story 7.12: Export CSV
export async function handleExportCSV(testPath = '') {
  if (window.__DEBUG__)
    console.log('[handleExportCSV] Starting export, testPath:', testPath);
  try {
    const result = await ExportCSV(testPath);
    if (!result) {
      if (window.__DEBUG__)
        console.log('[handleExportCSV] User cancelled file dialog');
      return;
    }
    await showAlert(`Exported to ${result.path}`);
    if (window.__DEBUG__)
      console.log('[handleExportCSV] Export complete:', result.message);
  } catch (error) {
    console.error('[handleExportCSV] Error caught:', error);
    await showAlert('Error exporting CSV: ' + error.message);
  }
}

function setupFileMenuListeners() {
  window.electronAPI.onMenuNew(async () => {
    if (window.__DEBUG__) console.log('[App] Menu New triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      window.showSpreadsheet?.();
    document.getElementById('new-btn').click();
  });

  window.electronAPI.onMenuOpen(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Open triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      window.showSpreadsheet?.();
    document.getElementById('load-btn').click();
  });

  window.electronAPI.onMenuOpenReadOnly?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Open Read-Only triggered');
    await window.openFileReadOnly?.();
  });

  const handleMenuSave = async () => {
    if (window.__DEBUG__) console.log('[App] Menu Save triggered');
    if (appState.isReadOnly) {
      await showAlert(
        'File is read-only. Use Save As to create a writable copy.'
      );
      return;
    }
    document.getElementById('save-btn').click();
  };
  window.electronAPI.onMenuSave(handleMenuSave);
  window.__testMenuSave = handleMenuSave;

  window.electronAPI.onMenuSaveAs(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Save As triggered');
    try {
      const path = await SaveFile('');
      if (path && window.electronAPI?.addRecentFile) {
        await window.electronAPI.addRecentFile(path);
      }
      setReadOnly(false);
      updateFileStatus();
      if (window.__DEBUG__) console.log('File saved via Save As');
    } catch (error) {
      await showAlert('Error saving file: ' + error.message);
    }
  });

  window.electronAPI.onMenuImportCSV(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Import CSV triggered');
    await window.handleImportCSV?.();
  });

  window.electronAPI.onMenuExportCSV(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Export CSV triggered');
    await handleExportCSV();
  });

  window.electronAPI.onMenuOpenRecent(async (event, filePath) => {
    if (window.__DEBUG__)
      console.log('[App] Menu Open Recent triggered:', filePath);
    await window.loadFileByPath?.(filePath);
  });

  window.electronAPI.onMenuOpenCSV?.(async (filePath) => {
    if (window.__DEBUG__)
      console.log('[App] Open CSV by path triggered:', filePath);
    await window.handleImportCSVByPath?.(filePath);
  });

  const handleOpenFileError = async (filePath) => {
    if (window.__DEBUG__)
      console.log('[App] Open file error — file not found:', filePath);
    if (window.electronAPI?.removeRecentFile) {
      await window.electronAPI.removeRecentFile(filePath);
    }
    window.showWelcome?.();
    await showAlert(
      'File not found: ' +
        filePath +
        '\n\nThe file may have been moved or deleted.'
    );
  };
  window.electronAPI.onOpenFileError?.(handleOpenFileError);
  window.__testOpenFileError = handleOpenFileError;

  window.electronAPI.onMenuFormulaReference?.(() => {
    if (window.__DEBUG__) console.log('[App] Menu Formula Reference triggered');
    showFormulaHelpModal();
  });

  window.electronAPI.onMenuUserGuide?.(() => {
    if (window.__DEBUG__) console.log('[App] Menu User Guide triggered');
    showUserGuideModal();
  });
}

// Copy the current selection to the clipboard as TSV (or single value for single-cell).
// In-memory style clipboard: stores style/alignment data from the last copy.
// { startRow, startCol, rows, cols, cells: [{rowOffset, colOffset, styleId, alignment}] }
let styleClipboard = null;

/** Clear in-memory style clipboard (e.g. on new file to avoid stale paste offsets). */
export function clearStyleClipboard() {
  styleClipboard = null;
}

const COPY_CELL_LIMIT = 10_000;

/** Get effective bounds for iteration. Returns { minR, maxR, minC, maxC } or null if single cell. */
function getCopyBounds(startRow, startCol, endRow, endCol) {
  const isFullCol = endRow === OPEN_END;
  const isFullRow = endCol === OPEN_END;
  if (isFullRow && isFullCol) {
    return {
      minR: 0,
      maxR: appState.ROWS - 1,
      minC: 0,
      maxC: appState.COLS - 1,
    };
  }
  if (isFullRow) {
    return {
      minR: startRow,
      maxR: endRow,
      minC: 0,
      maxC: appState.COLS - 1,
    };
  }
  if (isFullCol) {
    return {
      minR: 0,
      maxR: appState.ROWS - 1,
      minC: startCol,
      maxC: endCol,
    };
  }
  return { minR: startRow, maxR: endRow, minC: startCol, maxC: endCol };
}

/** Count non-empty cells in allCells that fall within bounds. */
function countCellsInRange(allCells, minR, maxR, minC, maxC) {
  let count = 0;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const ref = `${colToLetter(c)}${r + 1}`;
      if (allCells[ref] != null) count++;
    }
  }
  return count;
}

/** Build TSV from allCells for the given bounds (row-major). */
function buildTsvFromCells(allCells, minR, maxR, minC, maxC) {
  const rows = [];
  for (let r = minR; r <= maxR; r++) {
    const cells = [];
    for (let c = minC; c <= maxC; c++) {
      const ref = `${colToLetter(c)}${r + 1}`;
      const data = allCells[ref];
      cells.push(data?.raw ?? '');
    }
    rows.push(cells.join('\t'));
  }
  return rows.join('\n');
}

/** Collect style clipboard entries for the range. */
function collectStyleClipboardCells(
  allCells,
  minR,
  maxR,
  minC,
  maxC,
  startRow,
  startCol
) {
  const styleCells = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const ref = `${colToLetter(c)}${r + 1}`;
      const data = allCells[ref];
      if (data?.styleId) {
        styleCells.push({
          rowOffset: r - startRow,
          colOffset: c - startCol,
          styleId: data.styleId,
        });
      }
    }
  }
  return styleCells;
}

export async function copySelectionToClipboard() {
  if (!appState.selectionRange) return;
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;

  const isSingleCell =
    startRow === endRow &&
    startCol === endCol &&
    Number.isFinite(endRow) &&
    Number.isFinite(endCol);

  if (isSingleCell) {
    try {
      const value = await GetCellRawValue(startRow, startCol);
      await navigator.clipboard.writeText(value);
      const allCells = await GetAllCells();
      const ref = `${colToLetter(startCol)}${startRow + 1}`;
      const data = allCells[ref];
      styleClipboard = {
        startRow,
        startCol,
        rows: 1,
        cols: 1,
        cells: data?.styleId
          ? [{ rowOffset: 0, colOffset: 0, styleId: data.styleId }]
          : [],
      };
    } catch (error) {
      console.error('[App] Error during Copy:', error);
      await showAlert('Error during Copy operation: ' + error.message);
      return false;
    }
    return true;
  }

  const bounds = getCopyBounds(startRow, startCol, endRow, endCol);
  if (!bounds) return;

  try {
    const allCells = await GetAllCells();
    const count = countCellsInRange(
      allCells,
      bounds.minR,
      bounds.maxR,
      bounds.minC,
      bounds.maxC
    );
    if (count > COPY_CELL_LIMIT) {
      await showAlert(
        `Selection too large to copy (max ${COPY_CELL_LIMIT.toLocaleString()} cells).`
      );
      return false;
    }

    const tsv = buildTsvFromCells(
      allCells,
      bounds.minR,
      bounds.maxR,
      bounds.minC,
      bounds.maxC
    );
    await navigator.clipboard.writeText(tsv);

    const styleCells = collectStyleClipboardCells(
      allCells,
      bounds.minR,
      bounds.maxR,
      bounds.minC,
      bounds.maxC,
      bounds.minR,
      bounds.minC
    );
    styleClipboard = {
      startRow: bounds.minR,
      startCol: bounds.minC,
      rows: bounds.maxR - bounds.minR + 1,
      cols: bounds.maxC - bounds.minC + 1,
      cells: styleCells,
    };
  } catch (error) {
    console.error('[App] Error during Copy:', error);
    await showAlert('Error during Copy operation: ' + error.message);
    return false;
  }
  return true;
}

// Build the cellsToSet array for a multi-cell TSV paste, shifting formula refs as needed.
async function buildCellsToSet(parsedRows, targetRow, targetCol) {
  const rowOffset = styleClipboard ? targetRow - styleClipboard.startRow : 0;
  const colOffset = styleClipboard ? targetCol - styleClipboard.startCol : 0;
  const shouldShift =
    styleClipboard !== null && (rowOffset !== 0 || colOffset !== 0);
  const cellsToSet = [];
  for (let ri = 0; ri < parsedRows.length; ri++) {
    const cells = parsedRows[ri].split('\t');
    for (let ci = 0; ci < cells.length; ci++) {
      let value = cells[ci];
      if (shouldShift && value.startsWith('=')) {
        // Shift relative formula references to match the paste destination.
        value = await ShiftFormula(value, rowOffset, colOffset);
      }
      cellsToSet.push({ row: targetRow + ri, col: targetCol + ci, value });
    }
  }
  return cellsToSet;
}

// Paste clipboard text (TSV or single value) starting at the selected cell.
export async function pasteFromClipboard() {
  if (appState.isReadOnly) return;
  if (!appState.selectedCell) return;
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (error) {
    console.error('[App] Error reading clipboard:', error);
    await showAlert('Error during Paste operation: ' + error.message);
    return;
  }
  if (!text) return;

  const { row: targetRow, col: targetCol } = appState.selectedCell;
  // Strip trailing newline that some apps (e.g. Excel) append
  const parsedRows = text.replace(/\n$/, '').split('\n');

  if (parsedRows.length === 1 && !parsedRows[0].includes('\t')) {
    // Single-cell paste — shift formula if pasting to a different location
    try {
      let value = parsedRows[0];
      if (
        value.startsWith('=') &&
        styleClipboard !== null &&
        (targetRow !== styleClipboard.startRow ||
          targetCol !== styleClipboard.startCol)
      ) {
        value = await ShiftFormula(
          value,
          targetRow - styleClipboard.startRow,
          targetCol - styleClipboard.startCol
        );
      }
      const result = await SetCellValue(targetRow, targetCol, value);
      applyUndoRedoState(result);
      await applyStyleClipboard(targetRow, targetCol);
      await window.refreshAllCells?.();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Paste:', error);
      await showAlert('Error during Paste operation: ' + error.message);
    }
    return;
  }

  // Multi-cell TSV paste — atomic: all cells in one undo entry via /api/range/set
  const maxPasteRow = targetRow + parsedRows.length - 1;
  const maxPasteCol =
    targetCol + Math.max(...parsedRows.map((r) => r.split('\t').length)) - 1;
  // TODO(M2): expandGridIfNeeded triggers an async DOM rebuild internally but returns
  // synchronously. SetRangeValues writes to the model (not the DOM) so this
  // is safe, but the DOM may not reflect the new rows until refreshAllCells() completes.
  expandGridIfNeeded(maxPasteRow, maxPasteCol);

  try {
    const cellsToSet = await buildCellsToSet(parsedRows, targetRow, targetCol);
    const result = await SetRangeValues(cellsToSet);
    applyUndoRedoState(result);
    await applyStyleClipboard(targetRow, targetCol);
    await window.refreshAllCells?.();
    updateFileStatus();
  } catch (error) {
    console.error('[App] Error during Paste:', error);
    await showAlert('Error during Paste operation: ' + error.message);
  }
}

// Apply in-memory style clipboard to the paste destination.
// Sends style/alignment API calls in parallel for efficiency.
async function applyStyleClipboard(targetRow, targetCol) {
  if (!styleClipboard || styleClipboard.cells.length === 0) return;
  const styleCalls = styleClipboard.cells.map(
    ({ rowOffset, colOffset, styleId }) => {
      const r = targetRow + rowOffset;
      const c = targetCol + colOffset;
      const calls = [];
      if (styleId) calls.push(ApplyRangeStyle(r, c, r, c, styleId));
      return calls;
    }
  );
  await Promise.all(styleCalls.flat());
}

function setupEditMenuListeners() {
  window.electronAPI.onMenuUndo?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Undo triggered');
    if (appState.isReadOnly) return;
    await performUndo();
  });

  window.electronAPI.onMenuRedo?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Redo triggered');
    if (appState.isReadOnly) return;
    await performRedo();
  });

  window.electronAPI.onMenuCut(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Cut triggered');
    if (appState.isReadOnly) return;
    if (!appState.selectedCell || !appState.selectionRange) return;
    try {
      const { startRow, startCol, endRow, endCol } = appState.selectionRange;
      const copied = await copySelectionToClipboard();
      if (!copied) return;
      const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
      const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
      const result = await ClearRange(
        startRow,
        startCol,
        resolvedEndRow,
        resolvedEndCol
      );
      if (result?.hasUnsavedChanges !== undefined) applyUndoRedoState(result);
      await window.refreshAllCells?.();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Cut:', error);
      await showAlert('Error during Cut operation: ' + error.message);
    }
  });

  window.electronAPI.onMenuCopy(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Copy triggered');
    await copySelectionToClipboard();
  });

  window.electronAPI.onMenuPaste(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Paste triggered');
    await pasteFromClipboard();
  });

  // Story 17.4: "Go to Range…" focuses the address box for keyboard navigation
  window.electronAPI.onMenuSelectAll(() => {
    if (window.__DEBUG__) console.log('[App] Menu Go to Range triggered');
    const cellRefInput = document.getElementById('cell-ref');
    if (cellRefInput) {
      cellRefInput.focus();
      cellRefInput.select();
    }
  });
}

function setupFormatMenuListeners() {
  // Story 11.5: Merge / Unmerge
  window.electronAPI.onMenuMergeCells?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Merge Cells triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    const { startRow, startCol, endRow, endCol } = appState.selectionRange;
    if (!Number.isFinite(endRow) || !Number.isFinite(endCol)) {
      await showAlert('Cannot merge an entire row or column selection.');
      return;
    }
    const cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
    if (cellCount < 2) {
      await showAlert('Select 2 or more cells to merge.');
      return;
    }
    if (selectionOverlapsMerge(startRow, startCol, endRow, endCol)) {
      await showAlert('Selection overlaps an existing merged cell.');
      return;
    }
    try {
      const rowSpan = endRow - startRow + 1;
      const colSpan = endCol - startCol + 1;
      const result = await SetMerge(startRow, startCol, rowSpan, colSpan);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
    } catch (error) {
      const msg = error.message?.includes('only one cell')
        ? 'Cannot merge: more than one cell contains data. Clear the extra content first, then merge.'
        : 'Error merging cells: ' + error.message;
      await showAlert(msg);
    }
  });

  window.electronAPI.onMenuUnmergeCells?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Unmerge triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    const { startRow, startCol, endRow, endCol } = appState.selectionRange;
    if (startRow !== endRow || startCol !== endCol) {
      await showAlert('Select a single merged cell to unmerge.');
      return;
    }
    const { merge, isAnchor } = getMergeInfo(
      startRow,
      startCol,
      appState.currentMerges
    );
    if (!merge || !isAnchor) {
      await showAlert('Selected cell is not merged.');
      return;
    }
    try {
      const result = await Unmerge(startRow, startCol);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
    } catch (error) {
      await showAlert('Error unmerging cells: ' + error.message);
    }
  });

  // Story 12.2 / 13.3: Apply style to selection
  const applyStyleToSelection = async (styleId) => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    const { startRow, startCol, endRow, endCol } = appState.selectionRange;
    const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
    const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
    try {
      const result = await ApplyRangeStyle(
        startRow,
        startCol,
        resolvedEndRow,
        resolvedEndCol,
        styleId
      );
      applyUndoRedoState(result);
      await window.refreshAllCells?.();
      window.dispatchEvent(
        new CustomEvent('style-applied', { detail: { styleId } })
      );
    } catch (error) {
      console.error('[App] Error applying style:', error);
      window.__lastStyleError = String(error.message);
      await showAlert('Error applying style: ' + error.message);
    }
  };
  window.__lastStyleError = null;
  window.__applyStyleToSelection = applyStyleToSelection; // Story 19.4: exposed for toolbar buttons
  window.electronAPI.onMenuApplyStyle?.(applyStyleToSelection);
  window.electronAPI.onMenuStyleTitle?.(() =>
    applyStyleToSelection(STYLE_ID.TITLE)
  );
  window.electronAPI.onMenuStyleHeader?.(() =>
    applyStyleToSelection(STYLE_ID.HEADER)
  );
  window.electronAPI.onMenuStyleTotal?.(() =>
    applyStyleToSelection(STYLE_ID.TOTAL)
  );

  // Story 21.1: Clear Formatting — removes styleId and alignment from selected cells
  const clearFormattingFromSelection = async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    const { startRow, startCol, endRow, endCol } = appState.selectionRange;
    const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
    const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
    try {
      const result = await ClearRangeFormat(
        startRow,
        startCol,
        resolvedEndRow,
        resolvedEndCol
      );
      applyUndoRedoState(result);
      await window.refreshAllCells?.();
    } catch (error) {
      console.error('[App] Error clearing formatting:', error);
      await showAlert('Error clearing formatting: ' + error.message);
    }
  };
  window.clearFormattingFromSelection = clearFormattingFromSelection;
  window.electronAPI.onMenuClearFormatting?.(clearFormattingFromSelection);

  // Story 12.3: Format Cleanup
  window.electronAPI.onMenuFormatCleanup?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Format Cleanup triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    try {
      const result = await CleanupFormat();
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
    } catch (error) {
      await showAlert('Error during Remove Unused Styles: ' + error.message);
    }
  });

  // Story 13.3: Manage Styles
  window.electronAPI.onMenuManageStyles?.(() => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    showManageStylesModal();
  });

  // View menu: Alignment shortcuts
  window.electronAPI.onMenuAlignLeft?.(() => applyAlignmentToSelection('left'));
  window.electronAPI.onMenuAlignCenter?.(() =>
    applyAlignmentToSelection('center')
  );
  window.electronAPI.onMenuAlignRight?.(() =>
    applyAlignmentToSelection('right')
  );
}

function setupStructuralMenuListeners() {
  // Story 13.1 / 15.3: Insert/Delete row/column
  window.electronAPI.onMenuInsertRow?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    if (appState.selectionMode !== 'row') return;
    const row = appState.selectionRange.startRow;
    try {
      const result = await InsertRow(row);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
      applySelectionRange(row, 0, row, appState.COLS - 1);
    } catch (error) {
      await showAlert('Error inserting row: ' + error.message);
    }
  });

  window.electronAPI.onMenuInsertColumn?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    if (appState.selectionMode !== 'column') return;
    const col = appState.selectionRange.startCol;
    try {
      const result = await InsertColumn(col);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
      applySelectionRange(0, col, appState.ROWS - 1, col);
    } catch (error) {
      await showAlert('Error inserting column: ' + error.message);
    }
  });

  window.electronAPI.onMenuDeleteRow?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    if (appState.selectionMode !== 'row') return;
    const row = appState.selectionRange.startRow;
    try {
      const result = await DeleteRow(row);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
    } catch (error) {
      await showAlert('Error deleting row: ' + error.message);
    }
  });

  window.electronAPI.onMenuDeleteColumn?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (appState.isReadOnly) return;
    if (appState.selectionMode !== 'column') return;
    const col = appState.selectionRange.startCol;
    try {
      const result = await DeleteColumn(col);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      applyUndoRedoState(result);
      await window.buildSpreadsheet?.();
      await window.refreshAllCells?.();
    } catch (error) {
      await showAlert('Error deleting column: ' + error.message);
    }
  });

  // View menu: RTL Mode
  window.electronAPI.onMenuToggleRTL?.((event, checked) => {
    window.setRTL?.(checked);
  });
}

// Story 7.1: Setup Electron menu event listeners
export function setupElectronMenuListeners() {
  if (!window.electronAPI) return;
  if (window.__DEBUG__)
    console.log('[App] Setting up Electron menu event listeners');
  setupFileMenuListeners();
  setupEditMenuListeners();
  setupFormatMenuListeners();
  setupStructuralMenuListeners();
  if (window.__DEBUG__)
    console.log('[App] Electron menu event listeners registered (File + Edit)');
}
