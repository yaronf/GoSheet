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

import { appState } from './app-state.js';
import {
  showConfirmDialog,
  showAlert,
  forceCleanupEditing,
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
  applyAlignmentToSelection,
  handleKeydownFileOps,
  handleKeydownCellNavigation,
  saveCurrentEditOnCellSwitch,
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
            <!-- Alignment buttons (with gap from file buttons) -->
            <span class="toolbar-separator" aria-hidden="true"></span>
            <button id="align-left-btn" class="toolbar-btn" title="Align left" aria-label="Align Left" aria-pressed="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/>
                </svg>
            </button>
            <button id="align-center-btn" class="toolbar-btn" title="Align center" aria-label="Align Center" aria-pressed="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/>
                </svg>
            </button>
            <button id="align-right-btn" class="toolbar-btn" title="Align right" aria-label="Align Right" aria-pressed="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/>
                </svg>
            </button>
        </div>
        <input type="file" id="file-input" accept=".gosheet" style="display: none;" aria-hidden="true" />
        <div role="complementary" class="formula-bar-container" aria-label="Formula bar">
            <span class="cell-ref" id="cell-ref" title="Current cell reference" aria-label="Selected cell">A1</span>
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

// Event delegation for cell clicks
const table = document.getElementById('spreadsheet');
if (table) {
  table.addEventListener('click', (e) => {
    if (e.target.classList.contains('cell-editor')) return;
    const cell = e.target.closest('.cell');
    const rowHeader = e.target.closest('.row-header');
    const colHeader = e.target.closest('.column-header');
    if (rowHeader && rowHeader.dataset.row !== undefined) {
      const row = parseInt(rowHeader.dataset.row, 10);
      if (Number.isFinite(row)) {
        appState.selectionMode = 'row';
        applySelectionRange(row, 0, row, appState.COLS - 1);
        if (window.electronAPI?.updateMenuState)
          window.electronAPI.updateMenuState({
            selectionMode: 'row',
            selectedRow: row,
          });
        return;
      }
    }
    if (colHeader && colHeader.dataset.col !== undefined) {
      const col = parseInt(colHeader.dataset.col, 10);
      if (Number.isFinite(col)) {
        appState.selectionMode = 'column';
        applySelectionRange(0, col, appState.ROWS - 1, col);
        if (window.electronAPI?.updateMenuState)
          window.electronAPI.updateMenuState({
            selectionMode: 'column',
            selectedCol: col,
          });
        return;
      }
    }
    if (cell) {
      appState.selectionMode = 'cell';
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;
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
}

// Global keyboard handler
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

// Story 13.8: Alignment toolbar button handlers
document
  .getElementById('align-left-btn')
  .addEventListener('click', () => applyAlignmentToSelection('left'));
document
  .getElementById('align-center-btn')
  .addEventListener('click', () => applyAlignmentToSelection('center'));
document
  .getElementById('align-right-btn')
  .addEventListener('click', () => applyAlignmentToSelection('right'));

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
