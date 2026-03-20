// GoSheet Frontend — main entry point.
// API functions imported from api-client.js (mode-aware: web fetch or Electron IPC)

import {
  SetCellValue,
  SetCellAlignment,
  SetRangeAlignment,
  GetFileStatus,
  GetSettings,
  SetSetting,
  NewFile,
  SaveFile,
  LoadFile,
} from './api-client.js';
import { initAgentUI } from './app-agent.js';

import { appState, OPEN_END } from './app-state.js';
import {
  showConfirmDialog,
  showAlert,
  forceCleanupEditing,
  parseRangeAddress,
} from './app-utils.js';
import {
  buildSpreadsheet,
  loadCells,
  refreshAllCells,
  selectCell,
  getCellElement,
  applySelectionRange,
  updateMergeMenuState,
  checkScrollPosition,
  updateFormulaBar,
  resolveToAnchor,
} from './app-grid.js';
import {
  startEditing,
  applyCellValue,
  handleKeydownFileOps,
  handleKeydownCellNavigation,
  saveCurrentEditOnCellSwitch,
  insertCellRefAtCursor,
  insertRangeRefAtCursor,
  resetLastInsertedRefSpan,
} from './app-cell-editor.js';
import {
  displayFileStatus,
  setReadOnly,
  updateFileStatus,
  applyUndoRedoState,
  performUndo,
  performRedo,
  handleExportCSV,
  setupElectronMenuListeners,
  clearStyleClipboard,
} from './app-file-ops.js';
import {
  showWelcome,
  showSpreadsheet,
  setupWelcomeScreen,
  loadFileByPath,
  openFileReadOnly,
  handleImportCSV,
  handleImportCSVByPath,
  handleTableContextMenu,
  setupContextMenuHandlers,
} from './app-ui.js';
import { showManageStylesModal } from './app-modals.js';

// Show agent toolbar button when bootstrap token is present (hidden in index.html by default)
if (window.__GOSHEET_TOKEN__) {
  const agentSep = document.querySelector('.agent-toolbar-sep');
  const agentBtn = document.getElementById('agent-btn');
  if (agentSep) agentSep.style.display = '';
  if (agentBtn) agentBtn.style.display = '';
}

// --- Expose functions on window for cross-module calls and Playwright test hooks ---
window.getCellElement = getCellElement;
window.resolveToAnchor = resolveToAnchor;
window.startEditing = startEditing;
window.handleImportCSV = handleImportCSV;
window.handleImportCSVByPath = handleImportCSVByPath;
window.selectCell = selectCell;
window.refreshAllCells = refreshAllCells;
window.loadCells = loadCells;
window.buildSpreadsheet = buildSpreadsheet;
window.displayFileStatus = displayFileStatus;
window.updateFileStatus = updateFileStatus;
window.applyUndoRedoState = applyUndoRedoState;
window.performUndo = performUndo;
window.performRedo = performRedo;
window.showWelcome = showWelcome;
window.showSpreadsheet = showSpreadsheet;
window.showManageStylesModal = showManageStylesModal;
window.handleExportCSV = handleExportCSV;
window.showAlert = showAlert;
window.applyCellValue = applyCellValue;
window.SetCellAlignment = SetCellAlignment;
window.SetRangeAlignment = SetRangeAlignment;
window.saveCurrentEditOnCellSwitch = saveCurrentEditOnCellSwitch;
window.forceCleanupEditing = forceCleanupEditing;
window.setReadOnly = setReadOnly;
window.openFileReadOnly = openFileReadOnly;
window.loadFileByPath = loadFileByPath;
window.ensureSpreadsheetView = ensureSpreadsheetView;
window.__testSetReadOnly = (v) => setReadOnly(v); // Story 16.4: test hook
window.currentHasUnsavedChanges = false;

// Story 7.11: Track unsaved changes for quit warning dialog
// Exposed to window so Electron main process can check it via executeJavaScript()

function ensureSpreadsheetView() {
  if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
    showSpreadsheet();
}

// RTL toggle logic
async function setRTL(newValue) {
  appState.isRTL = newValue;
  if (appState.isRTL) {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.removeAttribute('dir');
  }
  await SetSetting('rtl', appState.isRTL);
  window.electronAPI?.updateMenuState?.({ isRTL: appState.isRTL });
}
window.setRTL = setRTL;

// Story 8.2: Determine initial view and wire welcome buttons
setupWelcomeScreen().then(() => {
  if (
    document.querySelector('#app')?.getAttribute('data-view') !== 'spreadsheet'
  )
    return;
  setTimeout(async () => {
    if (
      document.querySelector('#app')?.getAttribute('data-view') !==
      'spreadsheet'
    )
      return;
    if (window.__DEBUG__)
      console.log('[app.js] Building spreadsheet and loading cells...');
    try {
      await buildSpreadsheet();
      await loadCells();
      if (window.__DEBUG__) console.log('[app.js] Cells loaded successfully');
      selectCell(0, 0);
      window.syncFormatMenuFromApi?.();
    } catch (err) {
      console.error('[app.js] Failed to load cells:', err);
    }
  }, 50);
});

// Add scroll listener for infinite scrolling
const spreadsheetContainer = document.querySelector('.spreadsheet-container');
let scrollTimeout;
spreadsheetContainer.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    checkScrollPosition().catch((err) =>
      console.error('[App] Scroll expand error:', err)
    );
  }, 100);
});

// Custom tooltip for error/long cells (bypasses native title quirks)
const cellTooltip = document.getElementById('cell-tooltip');
let tooltipHideTimeout = 0;
spreadsheetContainer.addEventListener('mouseover', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell?.dataset.tooltip) return;
  clearTimeout(tooltipHideTimeout);
  tooltipHideTimeout = 0;
  cellTooltip.textContent = cell.dataset.tooltip;
  cellTooltip.setAttribute('aria-hidden', 'false');
  const rect = cell.getBoundingClientRect();
  cellTooltip.style.left = `${rect.left}px`;
  cellTooltip.style.top = `${rect.bottom + 4}px`;
  cellTooltip.classList.add('visible');
});
spreadsheetContainer.addEventListener('mouseout', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell?.dataset.tooltip) return;
  const related = e.relatedTarget;
  if (related && (cell.contains(related) || cellTooltip.contains(related)))
    return;
  tooltipHideTimeout = setTimeout(() => {
    cellTooltip.classList.remove('visible');
    cellTooltip.setAttribute('aria-hidden', 'true');
    cellTooltip.textContent = '';
    tooltipHideTimeout = 0;
  }, 50);
});

// Story 18.1: Set to true in mousedown when a formula-bar ref insertion fires,
// so the subsequent click event does not navigate to the clicked cell.
let suppressNextCellClick = false;

// Story 23.5: When formula bar blurs (e.g. before mousedown on cell), we may miss
// document.activeElement === fbar. This flag lets us still treat it as formula-bar ref insertion.
let formulaBarHadFocusBeforeBlur = false;
window._clearFormulaBarHadFocusBeforeBlur = () => {
  formulaBarHadFocusBeforeBlur = false;
};

/** Handle click on a row header (select/extend full row). */
function handleRowHeaderClick(row, shiftKey) {
  appState.selectionMode = 'row';
  if (shiftKey && appState.selectionRange) {
    const existingStart = appState.selectionRange.startRow;
    const existingEnd =
      appState.selectionRange.endRow === OPEN_END
        ? appState.selectionRange.startRow
        : appState.selectionRange.endRow;
    applySelectionRange(
      Math.min(existingStart, row),
      0,
      Math.max(existingEnd, row),
      OPEN_END
    );
  } else {
    applySelectionRange(row, 0, row, OPEN_END);
  }
  if (window.electronAPI?.updateMenuState)
    window.electronAPI.updateMenuState({
      selectionMode: 'row',
      selectedRow: row,
    });
}

/** Handle click on a column header (select/extend full column). */
function handleColHeaderClick(col, shiftKey) {
  appState.selectionMode = 'column';
  if (shiftKey && appState.selectionRange) {
    const existingStart = appState.selectionRange.startCol;
    const existingEnd =
      appState.selectionRange.endCol === OPEN_END
        ? appState.selectionRange.startCol
        : appState.selectionRange.endCol;
    applySelectionRange(
      0,
      Math.min(existingStart, col),
      OPEN_END,
      Math.max(existingEnd, col)
    );
  } else {
    applySelectionRange(0, col, OPEN_END, col);
  }
  if (window.electronAPI?.updateMenuState)
    window.electronAPI.updateMenuState({
      selectionMode: 'column',
      selectedCol: col,
    });
}

// Event delegation for cell clicks
const table = document.getElementById('spreadsheet');
if (table) {
  table.addEventListener('click', (e) => {
    if (suppressNextCellClick) {
      suppressNextCellClick = false;
      return;
    }
    if (e.target.classList.contains('cell-editor')) return;
    const cell = e.target.closest('.cell');
    const rowHeader = e.target.closest('.row-header');
    const colHeader = e.target.closest('.column-header');
    if (rowHeader && rowHeader.dataset.row !== undefined) {
      const row = parseInt(rowHeader.dataset.row, 10);
      if (Number.isFinite(row)) {
        handleRowHeaderClick(row, e.shiftKey);
        return;
      }
    }
    if (colHeader && colHeader.dataset.col !== undefined) {
      const col = parseInt(colHeader.dataset.col, 10);
      if (Number.isFinite(col)) {
        handleColHeaderClick(col, e.shiftKey);
        return;
      }
    }
    if (cell) {
      appState.selectionMode = 'cell';
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;

      // Story 18.1: If editing a formula, insert the clicked cell's reference
      // instead of committing the edit and navigating.
      if (appState.isEditing) {
        const activeInput = document.querySelector('.cell-editor');
        if (activeInput && activeInput.value.startsWith('=')) {
          e.preventDefault();
          e.stopPropagation();
          insertCellRefAtCursor(row, col, activeInput);
          return;
        }
        // Plain-text edit: let the blur/commit path run (don't intercept).
        // Fall through to selectCell which will trigger blur → finishEditing.
      }

      selectCell(row, col, e.shiftKey);
      updateMergeMenuState();
    }
  });
  table.addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('cell-editor')) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    startEditing(row, col);
  });

  table.addEventListener('contextmenu', handleTableContextMenu);
  setupContextMenuHandlers();

  // Story 17.1: Drag-to-select
  let dragState = null; // { startRow, startCol } | null

  // Story 18.2: Parallel drag state for formula-edit drag-to-insert.
  // Active only when isEditing && formula starts with '='.
  let formulaDragState = null; // { startRow, startCol, inputEl } | null
  // Last highlighted range — used to skip redundant DOM work on mousemove (M3 fix).
  let lastRefHighlightRange = null; // { sRow, sCol, eRow, eCol } | null

  /** Remove .ref-highlight from all cells and reset cached range. */
  function clearRefHighlights() {
    document
      .querySelectorAll('.cell.ref-highlight')
      .forEach((el) => el.classList.remove('ref-highlight'));
    lastRefHighlightRange = null;
  }

  /**
   * Cancel an active formula drag (H1 fix): clean up highlights and state
   * when the editor is closed by a non-mouseup path (Escape, window blur, etc.).
   */
  function cancelFormulaDrag() {
    if (!formulaDragState) return;
    clearRefHighlights();
    formulaDragState = null;
    suppressNextCellClick = false;
  }
  // Expose so app-cell-editor.js cancelEditing can call it
  window._cancelFormulaDrag = cancelFormulaDrag;

  // H1: Also cancel on window blur / tab-switch so highlights don't persist.
  window.addEventListener('blur', cancelFormulaDrag);

  table.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left button only
    if (e.shiftKey) return; // shift-click handled by the click handler
    if (e.target.classList.contains('cell-editor')) return;
    const cell = e.target.closest('.cell');
    if (!cell) return; // row/col headers handled separately
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;

    // Story 18.1 (AC5) / 23.5: If the formula bar is focused and contains a formula,
    // start formula drag (same as inline) so both click and drag-to-range work.
    // formulaBarHadFocusBeforeBlur: when user clicks a cell, the formula bar may blur
    // before our mousedown runs, so we also check that flag.
    const fbar = document.getElementById('formula-bar');
    const formulaBarActive =
      fbar &&
      fbar.value.startsWith('=') &&
      (document.activeElement === fbar || formulaBarHadFocusBeforeBlur);
    if (typeof window.__LOG_FORMULA_BAR__ !== 'undefined') {
      console.log('[formula-bar] mousedown cell', row, col, {
        fbarValue: fbar?.value,
        activeElId: document.activeElement?.id,
        formulaBarHadFocusBeforeBlur,
        formulaBarActive,
      });
    }
    if (formulaBarActive) {
      formulaBarHadFocusBeforeBlur = false;
      e.preventDefault();
      suppressNextCellClick = true;
      formulaDragState = {
        startRow: row,
        startCol: col,
        inputEl: fbar,
      };
      clearRefHighlights();
      cell.classList.add('ref-highlight');
      lastRefHighlightRange = { sRow: row, sCol: col, eRow: row, eCol: col };
      insertRangeRefAtCursor(row, col, row, col, fbar);
      return;
    }

    // Story 18.2: If editing a formula (starts with '='), start a formula drag
    // instead of a normal selection drag. preventDefault keeps focus on the editor.
    // M1 fix: suppressNextCellClick not needed here — the click handler already
    // returns early when appState.isEditing && formula mode, so no click navigation
    // can fire. suppressNextCellClick is only set for the formula-bar path above.
    if (appState.isEditing) {
      const activeInput = document.querySelector('.cell-editor');
      if (activeInput && activeInput.value.startsWith('=')) {
        e.preventDefault();
        formulaDragState = {
          startRow: row,
          startCol: col,
          inputEl: activeInput,
        };
        // Apply highlight to the anchor cell immediately
        clearRefHighlights();
        cell.classList.add('ref-highlight');
        lastRefHighlightRange = { sRow: row, sCol: col, eRow: row, eCol: col };
        // Insert single-cell ref at cursor (will be replaced as drag expands)
        insertRangeRefAtCursor(row, col, row, col, activeInput);
        return;
      }
      // Plain-text edit: leave default drag behavior suppressed (don't start dragState)
      return;
    }

    dragState = { startRow: row, startCol: col };
    // Select the anchor cell immediately so drag has a valid starting point
    appState.selectionMode = 'cell';
    selectCell(row, col, false);
  });

  document.addEventListener('mousemove', (e) => {
    // Story 18.2: Formula drag live-update
    if (formulaDragState) {
      // H1: editor may have been closed mid-drag (e.g. async path); bail out cleanly.
      if (!formulaDragState.inputEl.isConnected) {
        cancelFormulaDrag();
        return;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const cell = el.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;

      const sRow = Math.min(formulaDragState.startRow, row);
      const eRow = Math.max(formulaDragState.startRow, row);
      const sCol = Math.min(formulaDragState.startCol, col);
      const eCol = Math.max(formulaDragState.startCol, col);

      // M3 fix: skip all DOM work if the highlighted range hasn't changed.
      const last = lastRefHighlightRange;
      if (
        last &&
        last.sRow === sRow &&
        last.eRow === eRow &&
        last.sCol === sCol &&
        last.eCol === eCol
      ) {
        return;
      }

      // Highlight all cells in the drag range
      clearRefHighlights();
      for (let r = sRow; r <= eRow; r++) {
        for (let c = sCol; c <= eCol; c++) {
          const cellEl = document.getElementById(`cell-${r}-${c}`);
          if (cellEl) cellEl.classList.add('ref-highlight');
        }
      }
      lastRefHighlightRange = { sRow, sCol, eRow, eCol };

      // Live-update the formula editor with the current tentative range ref
      insertRangeRefAtCursor(sRow, sCol, eRow, eCol, formulaDragState.inputEl);
      return;
    }

    if (!dragState) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const cell = el.closest('.cell');
    if (!cell) return;
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    const startRow = Math.min(dragState.startRow, row);
    const endRow = Math.max(dragState.startRow, row);
    const startCol = Math.min(dragState.startCol, col);
    const endCol = Math.max(dragState.startCol, col);
    appState.selectionMode = 'cell';
    applySelectionRange(startRow, startCol, endRow, endCol);
  });

  document.addEventListener('mouseup', () => {
    // Story 18.2: Finalize formula drag
    if (formulaDragState) {
      const inputEl = formulaDragState.inputEl;
      clearRefHighlights();
      formulaDragState = null;
      // Do NOT clear suppressNextCellClick here — click fires after mouseup, and
      // the click handler must see it to avoid calling selectCell (which clears the formula bar).
      // Only focus if the input is still in the DOM (guard against H1 scenario)
      if (inputEl.isConnected) inputEl.focus();
      return;
    }

    const wasDragging = dragState !== null;
    dragState = null;
    // Clear stale flag only when a drag was in progress (click won't fire).
    // For normal clicks the flag is cleared in the click handler after use.
    if (wasDragging) suppressNextCellClick = false;
  });
}

// Global keyboard handler
// Note: Cmd+C, Cmd+X, Cmd+V are handled exclusively via Electron menu accelerators
// (menu.js → IPC → onMenuCopy/Cut/Paste) to avoid double-triggering.
document.addEventListener('keydown', (e) => {
  if (appState.isEditing) return;
  if (e.target.tagName === 'INPUT') return;
  if (handleKeydownFileOps(e)) return;
  if (
    appState.selectedCell &&
    handleKeydownCellNavigation(
      e,
      appState.selectedCell.row,
      appState.selectedCell.col
    )
  )
    return;
});

// Formula bar event handlers
const formulaBar = document.getElementById('formula-bar');
if (formulaBar) {
  formulaBar.addEventListener('focus', () => {
    formulaBarHadFocusBeforeBlur = true;
    if (typeof window.__LOG_FORMULA_BAR__ !== 'undefined') {
      console.log('[formula-bar] focus, set formulaBarHadFocusBeforeBlur=true');
    }
  });
  formulaBar.addEventListener('blur', () => {
    if (formulaBar.value.startsWith('=')) formulaBarHadFocusBeforeBlur = true;
    if (typeof window.__LOG_FORMULA_BAR__ !== 'undefined') {
      console.log('[formula-bar] blur', {
        value: formulaBar.value,
        setFlag: formulaBar.value.startsWith('='),
      });
    }
  });
  formulaBar.addEventListener('keydown', async (e) => {
    // Story 18.1: any key typed in formula bar resets the replace-span
    resetLastInsertedRefSpan();
    if (e.key === 'Enter' && appState.selectedCell) {
      e.preventDefault();
      const { row, col } = appState.selectedCell;
      const value = formulaBar.value;
      const result = await SetCellValue(row, col, value);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      applyUndoRedoState(result);
      await refreshAllCells();
      selectCell(row + 1, col);
    } else if (e.key === 'Escape') {
      if (appState.selectedCell) {
        const { row, col } = appState.selectedCell;
        updateFormulaBar(row, col);
      }
      formulaBar.blur();
    }
  });
}

// Story 17.4: Address box — type a cell or range address and press Enter to navigate
const cellRefInput = document.getElementById('cell-ref');
if (cellRefInput) {
  cellRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (
        document.querySelector('#app')?.getAttribute('data-view') !==
        'spreadsheet'
      )
        return;
      const range = parseRangeAddress(cellRefInput.value);
      if (!range) {
        cellRefInput.classList.add('cell-ref-invalid');
        return;
      }
      cellRefInput.classList.remove('cell-ref-invalid');
      appState.selectionMode = range.mode ?? 'cell'; // Story 19.5: honour row/column mode
      applySelectionRange(
        range.startRow,
        range.startCol,
        range.endRow,
        range.endCol
      );
      const anchorCell = getCellElement(range.startRow, range.startCol);
      anchorCell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      anchorCell?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Restore the address box via updateFormulaBar to handle OPEN_END correctly
      const { startRow, startCol } = appState.selectionRange;
      cellRefInput.classList.remove('cell-ref-invalid');
      updateFormulaBar(startRow, startCol);
      getCellElement(startRow, startCol)?.focus();
    }
  });
  cellRefInput.addEventListener('input', () => {
    cellRefInput.classList.remove('cell-ref-invalid');
  });
  cellRefInput.addEventListener('focus', () => {
    cellRefInput.select();
  });
}

// File operations handlers
document.getElementById('new-btn').addEventListener('click', async () => {
  const status = await GetFileStatus();
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Create a new spreadsheet anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) return;
  }
  try {
    setReadOnly(false);
    clearStyleClipboard();
    await NewFile();
    appState.ROWS = 100;
    appState.COLS = 26;
    await buildSpreadsheet();
    await loadCells();
    selectCell(0, 0);
    updateFileStatus();
    window.syncFormatMenuFromApi?.();
  } catch (error) {
    await showAlert('Error creating new file: ' + error.message);
  }
});

document.getElementById('save-btn').addEventListener('click', async () => {
  if (appState.isReadOnly) return;
  try {
    const status = await GetFileStatus();
    const path = await SaveFile(status.path || '');
    if (path && window.electronAPI?.addRecentFile) {
      await window.electronAPI.addRecentFile(path);
    }
    updateFileStatus();
    if (window.__DEBUG__) console.log('File saved');
  } catch (error) {
    await showAlert('Error saving file: ' + error.message);
  }
});

document.getElementById('load-btn').addEventListener('click', async () => {
  const status = await GetFileStatus();
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Load a different file anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) return;
  }
  try {
    setReadOnly(false);
    const path = await LoadFile('');
    if (!path) return; // user cancelled dialog
    if (window.electronAPI?.addRecentFile) {
      await window.electronAPI.addRecentFile(path);
    }
    appState.ROWS = 100;
    appState.COLS = 26;
    await buildSpreadsheet();
    await loadCells();
    selectCell(0, 0);
    updateFileStatus();
    window.syncFormatMenuFromApi?.();
    showSpreadsheet();
    if (window.__DEBUG__) console.log('File loaded successfully');
  } catch (error) {
    await showAlert('Error loading file: ' + error.message);
  }
});

// Story 15.2: Undo/Redo toolbar button handlers
document.getElementById('undo-btn').addEventListener('click', async () => {
  await performUndo();
});
document.getElementById('redo-btn').addEventListener('click', async () => {
  await performRedo();
});

// Story 19.4: Alignment toolbar buttons removed; alignment still available via View menu and context menu.

// Story 7.1: Setup Electron menu event listeners
setupElectronMenuListeners();

// Update file status on load
updateFileStatus();

// Load persisted RTL setting and apply
(async () => {
  const settings = await GetSettings();
  if (settings.rtl) {
    appState.isRTL = true;
    document.documentElement.setAttribute('dir', 'rtl');
    window.electronAPI?.updateMenuState?.({ isRTL: true });
  }
})();

// Story 7.10: Dark mode support
if (window.electronAPI?.onThemeChanged) {
  window.electronAPI.onThemeChanged((theme) => {
    if (window.__DEBUG__) console.log('[App] Theme changed to:', theme);
    document.documentElement.setAttribute('data-theme', theme);
  });
}

if (window.matchMedia) {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      document.documentElement.setAttribute(
        'data-theme',
        e.matches ? 'dark' : 'light'
      );
    });
}

if (window.__DEBUG__) console.log('GoSheet initialized');

// ── Story 20.6 / 20.8: Agent Session UI + SSE ───────────────────────────────
initAgentUI();
