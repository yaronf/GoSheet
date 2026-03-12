// GoSheet Frontend — main entry point.
// API functions imported from api-client.js (mode-aware: web fetch or Electron IPC)

import {
  SetCellValue,
  GetFileStatus,
  GetSettings,
  SetSetting,
  NewFile,
  SaveFile,
  LoadFile,
} from './api-client.js';

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

// Story 8.1: Welcome screen + spreadsheet view container
document.querySelector('#app').innerHTML = `
    <section class="welcome-screen" id="welcome-screen" aria-label="Welcome to GoSheet">
        <h1 class="welcome-title">GoSheet</h1>
        <p class="welcome-subtitle">Lightweight, fast spreadsheet for macOS</p>
        <div class="welcome-actions">
            <button type="button" class="welcome-btn welcome-btn-primary" id="welcome-btn-new" aria-label="Create new spreadsheet">Create New Spreadsheet</button>
            <button type="button" class="welcome-btn" id="welcome-btn-open" aria-label="Open existing file">Open Existing File</button>
            <button type="button" class="welcome-btn" id="welcome-btn-import" aria-label="Import from CSV">Import from CSV</button>
        </div>
        <div class="welcome-recent-files">
            <h3 class="welcome-recent-title">Recent Files</h3>
            <ul class="welcome-recent-list" id="welcome-recent-list">
                <li class="welcome-recent-empty">No recent files</li>
            </ul>
        </div>
        <p class="welcome-tip">Tip: Use Cmd+N for new spreadsheet</p>
    </section>
    <div class="spreadsheet-view" id="spreadsheet-view">
    <!-- Story 13.4: Compact single-row toolbar (icons + formula bar + file status) -->
    <header role="banner" class="toolbar toolbar-compact" aria-label="Application toolbar">
        <div class="toolbar-actions">
            <button id="new-btn" class="toolbar-btn" title="Create a new spreadsheet (⌘N)" aria-label="New Spreadsheet">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
            </button>
            <button id="save-btn" class="toolbar-btn" title="Save current spreadsheet (⌘S)" aria-label="Save Spreadsheet">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
            </button>
            <button id="load-btn" class="toolbar-btn" title="Load an existing spreadsheet (⌘O)" aria-label="Load Spreadsheet">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
            <!-- Story 15.2: Undo/Redo buttons -->
            <span class="toolbar-separator" aria-hidden="true"></span>
            <button id="undo-btn" class="toolbar-btn" title="Undo (⌘Z)" aria-label="Undo" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>
                </svg>
            </button>
            <button id="redo-btn" class="toolbar-btn" title="Redo (⌘⇧Z)" aria-label="Redo" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>
                </svg>
            </button>
            <!-- Story 19.4: Dynamic named-style buttons (replaces alignment buttons) -->
            <span class="toolbar-separator" aria-hidden="true"></span>
            <div id="toolbar-style-buttons" class="toolbar-style-group"></div>
        </div>
        <input type="file" id="file-input" accept=".gosheet" style="display: none;" aria-hidden="true" />
        <div role="complementary" class="formula-bar-container" aria-label="Formula bar">
            <input type="text" class="cell-ref" id="cell-ref" title="Type cell or range address and press Enter" aria-label="Cell or range reference" value="A1" />
            <input type="text" class="formula-bar" id="formula-bar" placeholder="Enter value or formula..." title="Enter cell value or formula (start with = for formulas)" aria-label="Formula input" />
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" class="file-status-wrapper" aria-label="File status">
            <span id="file-status" class="file-status"></span>
            <span id="readonly-indicator" style="display:none; color: var(--color-warning); font-weight: bold; margin-left: 8px;" aria-label="Read-only mode">🔒 Read-Only</span>
        </div>
    </header>
    <main role="main">
    <div role="grid" class="spreadsheet-container" id="container" aria-label="Spreadsheet" aria-rowcount="1000" aria-colcount="26">
        <table class="spreadsheet" id="spreadsheet">
            <!-- Will be populated by JavaScript -->
        </table>
    </div>
    </main>
    <div id="context-menu" class="context-menu" role="menu" aria-hidden="true" tabindex="-1">
        <button type="button" class="context-menu-item" data-action="copy">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
        </button>
        <button type="button" class="context-menu-item" data-action="paste">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Paste
        </button>
        <div class="context-menu-separator"></div>
        <div class="context-menu-submenu-wrapper">
            <button type="button" class="context-menu-item context-menu-submenu-trigger" aria-haspopup="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                Alignment ▶
            </button>
            <div class="context-menu-submenu" role="menu">
                <button type="button" class="context-menu-item" data-action="align-left">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                    Align Left
                </button>
                <button type="button" class="context-menu-item" data-action="align-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/></svg>
                    Align Center
                </button>
                <button type="button" class="context-menu-item" data-action="align-right">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
                    Align Right
                </button>
            </div>
        </div>
        <div class="context-menu-separator"></div>
        <div id="context-menu-format-items"></div>
        <div class="context-menu-separator"></div>
        <button type="button" class="context-menu-item" data-action="clear">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Clear
        </button>
    </div>
    <div class="modal-overlay" id="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-message">
        <div class="modal-dialog">
            <div class="modal-message" id="modal-message"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
                <button class="modal-btn modal-btn-primary" id="modal-ok">OK</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="csv-preview-modal" role="dialog" aria-modal="true" aria-labelledby="csv-preview-header">
        <div class="modal-dialog modal-dialog-large">
            <div class="modal-header">
                <h2 id="csv-preview-header">Import CSV Preview</h2>
            </div>
            <div class="modal-body">
                <div id="csv-preview-info"></div>
                <div id="csv-preview-table-container">
                    <table id="csv-preview-table"></table>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-secondary" id="csv-preview-cancel">Cancel</button>
                <button class="modal-btn modal-btn-primary" id="csv-preview-import">Import</button>
            </div>
        </div>
    </div>
    </div>
    <div class="modal-overlay" id="formula-help-modal" role="dialog" aria-modal="true" aria-labelledby="formula-help-header">
        <div class="modal-dialog modal-dialog-large modal-dialog-scrollable">
            <div class="modal-header">
                <h2 id="formula-help-header">Formula Reference</h2>
            </div>
            <div class="modal-body formula-help-content" id="formula-help-content"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-primary" id="formula-help-close">Close</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="user-guide-modal" role="dialog" aria-modal="true" aria-labelledby="user-guide-header">
        <div class="modal-dialog modal-dialog-large modal-dialog-scrollable">
            <div class="modal-header">
                <h2 id="user-guide-header">User Guide</h2>
            </div>
            <div class="modal-body user-guide-content" id="user-guide-content"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-primary" id="user-guide-close">Close</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="manage-styles-modal" role="dialog" aria-modal="true" aria-labelledby="manage-styles-header">
        <div class="modal-dialog modal-dialog-large">
            <div class="modal-header">
                <h2 id="manage-styles-header">Manage Styles</h2>
            </div>
            <div class="modal-body">
                <div class="manage-styles-toolbar">
                    <button type="button" class="modal-btn modal-btn-primary" id="manage-styles-add">Add Style</button>
                </div>
                <div id="manage-styles-list" class="manage-styles-list"></div>
                <div id="manage-styles-form" class="manage-styles-form" style="display:none">
                    <h3 id="manage-styles-form-title">Edit Style</h3>
                    <div class="manage-styles-form-body">
                        <div class="manage-styles-row">
                            <label for="manage-styles-name" class="manage-styles-label">Name <span class="manage-styles-required" aria-hidden="true">*</span></label>
                            <input type="text" id="manage-styles-name" class="manage-styles-input" required aria-required="true" placeholder="Style name" />
                        </div>
                        <div class="manage-styles-section">
                            <div class="manage-styles-section-title">Font</div>
                            <div class="manage-styles-row manage-styles-row-wrap">
                                <div class="manage-styles-field">
                                    <label for="manage-styles-font-name" class="manage-styles-label">Family</label>
                                    <select id="manage-styles-font-name" aria-label="Font family">
                                        <option value="Arial">Arial</option>
                                        <option value="Helvetica">Helvetica</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Courier">Courier</option>
                                        <option value="Georgia">Georgia</option>
                                    </select>
                                </div>
                                <div class="manage-styles-field">
                                    <label for="manage-styles-font-size" class="manage-styles-label">Size</label>
                                    <span class="manage-styles-size-control">
                                        <input type="range" id="manage-styles-font-size" min="8" max="72" value="12" aria-label="Font size" />
                                        <output id="manage-styles-font-size-value" for="manage-styles-font-size">12</output>
                                        <span class="manage-styles-unit">pt</span>
                                    </span>
                                </div>
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-font-bold" /> Bold</label>
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-font-italic" /> Italic</label>
                                <div class="manage-styles-field manage-styles-color">
                                    <label for="manage-styles-font-color-picker" class="manage-styles-label">Color</label>
                                    <span class="manage-styles-color-control">
                                        <input type="color" id="manage-styles-font-color-picker" value="#000000" aria-label="Font color" />
                                        <input type="text" id="manage-styles-font-color" class="manage-styles-hex" placeholder="#000000" maxlength="7" aria-label="Font color hex" />
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="manage-styles-section">
                            <div class="manage-styles-section-title">Fill</div>
                            <div class="manage-styles-row">
                                <label class="manage-styles-check">
                                    <input type="checkbox" id="manage-styles-fill-enabled" aria-label="Fill background" />
                                    Enable
                                </label>
                                <div class="manage-styles-field manage-styles-color" id="manage-styles-fill-color-wrap">
                                    <label for="manage-styles-fill-color-picker" class="manage-styles-label">Color</label>
                                    <span class="manage-styles-color-control">
                                        <input type="color" id="manage-styles-fill-color-picker" value="#E0E0E0" aria-label="Fill color" />
                                        <input type="text" id="manage-styles-fill-color" class="manage-styles-hex" placeholder="#E0E0E0" maxlength="7" aria-label="Fill color hex" />
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="manage-styles-section">
                            <div class="manage-styles-section-title">Borders</div>
                            <div class="manage-styles-row manage-styles-row-wrap manage-styles-borders-row">
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-border-left" aria-label="Left border" /> Left</label>
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-border-right" aria-label="Right border" /> Right</label>
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-border-top" aria-label="Top border" /> Top</label>
                                <label class="manage-styles-check"><input type="checkbox" id="manage-styles-border-bottom" aria-label="Bottom border" /> Bottom</label>
                                <div class="manage-styles-field manage-styles-color">
                                    <label for="manage-styles-border-color-picker" class="manage-styles-label">Color</label>
                                    <span class="manage-styles-color-control">
                                        <input type="color" id="manage-styles-border-color-picker" value="#000000" aria-label="Border color" />
                                        <input type="text" id="manage-styles-border-color" class="manage-styles-hex" placeholder="#000000" maxlength="7" aria-label="Border color hex" />
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="manage-styles-section">
                            <div class="manage-styles-section-title">Alignment</div>
                            <div class="manage-styles-row manage-styles-align-row">
                                <div class="manage-styles-field">
                                    <label for="manage-styles-align-h" class="manage-styles-label">Horizontal</label>
                                    <select id="manage-styles-align-h" aria-label="Horizontal alignment">
                                        <option value="">Default</option>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                    </select>
                                </div>
                                <div class="manage-styles-field">
                                    <label for="manage-styles-align-v" class="manage-styles-label">Vertical</label>
                                    <select id="manage-styles-align-v" aria-label="Vertical alignment">
                                        <option value="top">Top</option>
                                        <option value="center">Center</option>
                                        <option value="bottom">Bottom</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="manage-styles-form-buttons">
                        <button type="button" class="modal-btn modal-btn-secondary" id="manage-styles-form-cancel">Cancel</button>
                        <button type="button" class="modal-btn modal-btn-primary" id="manage-styles-form-save">Save</button>
                    </div>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-primary" id="manage-styles-close">Close</button>
            </div>
        </div>
    </div>
`;

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

// Story 18.1: Set to true in mousedown when a formula-bar ref insertion fires,
// so the subsequent click event does not navigate to the clicked cell.
let suppressNextCellClick = false;

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

    // Story 18.1 (AC5): If the formula bar is focused and contains a formula,
    // insert the cell reference there. preventDefault keeps focus on the formula bar;
    // suppressNextCellClick prevents the subsequent click event from navigating.
    const fbar = document.getElementById('formula-bar');
    if (fbar && document.activeElement === fbar && fbar.value.startsWith('=')) {
      e.preventDefault();
      suppressNextCellClick = true;
      insertCellRefAtCursor(row, col, fbar);
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
      suppressNextCellClick = false;
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
    if (path && window.electronAPI?.addRecentFile) {
      await window.electronAPI.addRecentFile(path);
    }
    appState.ROWS = 100;
    appState.COLS = 26;
    await buildSpreadsheet();
    await loadCells();
    selectCell(0, 0);
    updateFileStatus();
    window.syncFormatMenuFromApi?.();
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
