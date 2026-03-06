// GoSheet Frontend - ES6 Module
// API functions imported from api-client.js (mode-aware: web fetch or Electron IPC)

import {
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
  SetCellAlignment,
  SetRangeAlignment,
  GetSettings,
  SetSetting,
  InsertRow,
  InsertColumn,
  NewFile,
  SaveFile,
  LoadFile,
  PreviewCSV,
  ImportCSV,
  ExportCSV,
  Undo,
  Redo,
} from './api-client.js';

// Spreadsheet configuration
// Backend supports up to 2^31 rows/columns (Go int on 64-bit systems)
// Frontend uses infinite scrolling - expands as you navigate
let ROWS = 100; // Current rendered rows (expands automatically)
let COLS = 26; // Current rendered columns (expands automatically)

const EXPAND_THRESHOLD = 10; // Expand when within 10 rows/cols of edge
const EXPAND_ROWS = 50; // Add 50 rows when expanding
const EXPAND_COLS = 10; // Add 10 columns when expanding

let selectedCell = null;
let isEditing = false;

// Story 11.5: Selection range for Merge/Unmerge (startRow, startCol, endRow, endCol)
// Single cell when startRow===endRow && startCol===endCol
let selectionRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

// Story 13.1: Selection mode for Insert row/column ('cell' | 'row' | 'column')
let selectionMode = 'cell';

// Story 11.3: Cached merge regions (updated by buildSpreadsheet) for getCellElement
let currentMerges = [];

// Story 13.10: RTL mode flag — set from persisted settings on startup
let isRTL = false;

// Story 7.11: Track unsaved changes for quit warning dialog
// Exposed to window so Electron main process can check it via executeJavaScript()
window.currentHasUnsavedChanges = false;

// Story 10.7: Focus trap for dialogs - Tab cycles within dialog, Escape closes
function setupDialogFocusTrap(overlay, onClose) {
  const focusable = overlay.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (first) first.focus();

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  overlay.addEventListener('keydown', handleKeyDown);
  return () => overlay.removeEventListener('keydown', handleKeyDown);
}

// Custom modal dialog (replaces native confirm/alert for Cursor browser compatibility)
function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');

    // Set message
    messageEl.textContent = message;

    // Show modal (z-index above other modals so confirm appears on top)
    overlay.classList.add('active', 'modal-confirm');

    // Handle OK
    const handleOk = () => {
      overlay.classList.remove('active', 'modal-confirm');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
      removeFocusTrap?.();
      resolve(true);
    };

    // Handle Cancel
    const handleCancel = () => {
      overlay.classList.remove('active', 'modal-confirm');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
      removeFocusTrap?.();
      resolve(false);
    };

    // Handle ESC key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    const removeFocusTrap = setupDialogFocusTrap(overlay, handleCancel);

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    // Focus OK button
    okBtn.focus();
  });
}

/**
 * Show a simple alert dialog (info/error message with only OK button)
 * @param {string} message - Message to display
 * @returns {Promise<void>} - Resolves when user clicks OK
 */
function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');

    // Set message
    messageEl.textContent = message;

    // Hide cancel button for alerts
    cancelBtn.style.display = 'none';

    // Show modal
    overlay.classList.add('active');

    // Handle OK
    const handleOk = () => {
      overlay.classList.remove('active');
      cancelBtn.style.display = ''; // Restore for future confirm dialogs
      okBtn.removeEventListener('click', handleOk);
      document.removeEventListener('keydown', handleKeyDown);
      overlay.removeEventListener('click', handleOverlayClick);
      removeFocusTrap?.();
      resolve();
    };

    // Handle ESC key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleOk();
      }
    };

    const removeFocusTrap = setupDialogFocusTrap(overlay, handleOk);

    okBtn.addEventListener('click', handleOk);
    document.addEventListener('keydown', handleKeyDown);

    // Close on overlay click
    const handleOverlayClick = (e) => {
      if (e.target === overlay) {
        handleOk();
      }
    };
    overlay.addEventListener('click', handleOverlayClick);

    // Focus OK button
    okBtn.focus();
  });
}

// Force cleanup of any editing state
function forceCleanupEditing() {
  if (window.__DEBUG__) console.log('Force cleanup editing state');
  isEditing = false;

  // Remove any leftover input elements
  document.querySelectorAll('.cell-editor').forEach((input) => {
    if (window.__DEBUG__) console.log('Removing leftover input element');
    input.remove();
  });
}

// Story 10.7: Screen reader announcements (visually hidden, aria-live)
const srAnnouncer = document.createElement('div');
srAnnouncer.setAttribute('role', 'status');
srAnnouncer.setAttribute('aria-live', 'polite');
srAnnouncer.setAttribute('aria-atomic', 'true');
srAnnouncer.className = 'sr-only';
Object.assign(srAnnouncer.style, {
  position: 'absolute',
  left: '-10000px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
});
document.body.appendChild(srAnnouncer);

function announceToScreenReader(message) {
  srAnnouncer.textContent = message;
  setTimeout(() => {
    srAnnouncer.textContent = '';
  }, 1000);
}

// Story 8.1: Welcome screen + spreadsheet view container
// data-view="welcome" | "spreadsheet" - Story 8.2 will implement switching logic
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

// Story 8.2: View switching helpers
function showWelcome() {
  document.querySelector('#app').setAttribute('data-view', 'welcome');
  populateWelcomeRecentFiles();
  if (window.electronAPI?.syncRecentFilesMenu) {
    window.electronAPI.syncRecentFilesMenu();
  }
}
function showSpreadsheet() {
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

// Story 8.2: Load file by path (shared by menu-open-recent and welcome recent files)
async function loadFileByPath(filePath) {
  const status = await GetFileStatus();
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Open a different file anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) return;
  }
  try {
    showSpreadsheet();
    const loadedPath = await LoadFile(filePath);
    if (loadedPath && window.electronAPI?.addRecentFile) {
      await window.electronAPI.addRecentFile(loadedPath);
    }
    ROWS = 100;
    COLS = 26;
    await buildSpreadsheet();
    await loadCells();
    selectCell(0, 0);
    updateFileStatus();
    window.syncFormatMenuFromApi?.();
  } catch (error) {
    console.error('[App] Error loading file:', error);
    await showAlert('Error loading file: ' + error.message);
  }
}

// Story 8.2: Setup welcome screen - show welcome on launch, wire button handlers
async function setupWelcomeScreen() {
  const status = await GetFileStatus();
  const hasFile = status.path && status.path !== '';
  if (hasFile) {
    showSpreadsheet();
  } else {
    showWelcome();
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
      showSpreadsheet();
      document.getElementById('load-btn').click();
    });
  document
    .getElementById('welcome-btn-import')
    ?.addEventListener('click', async () => {
      showSpreadsheet();
      await handleImportCSV();
    });
}

// Story 8.2: Determine initial view (welcome vs spreadsheet) and wire welcome buttons
setupWelcomeScreen().then(() => {
  // Only build spreadsheet when showing spreadsheet view (avoids race with new-file flow)
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
const container = document.querySelector('.spreadsheet-container');
let scrollTimeout;

// Event delegation for cell clicks (more reliable than per-cell handlers in Chromium/Electron)
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
        selectionMode = 'row';
        applySelectionRange(row, 0, row, COLS - 1);
        if (window.electronAPI?.updateMenuState) {
          window.electronAPI.updateMenuState({
            selectionMode: 'row',
            selectedRow: row,
          });
        }
        return;
      }
    }
    if (colHeader && colHeader.dataset.col !== undefined) {
      const col = parseInt(colHeader.dataset.col, 10);
      if (Number.isFinite(col)) {
        selectionMode = 'column';
        applySelectionRange(0, col, ROWS - 1, col);
        if (window.electronAPI?.updateMenuState) {
          window.electronAPI.updateMenuState({
            selectionMode: 'column',
            selectedCol: col,
          });
        }
        return;
      }
    }
    if (cell) {
      selectionMode = 'cell';
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

  // Story 13.2: Context menu (right-click)
  table.addEventListener('contextmenu', async (e) => {
    if (e.target.classList.contains('cell-editor')) return;
    const cell = e.target.closest('.cell');
    const rowHeader = e.target.closest('.row-header');
    const colHeader = e.target.closest('.column-header');
    if (cell) {
      e.preventDefault();
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      if (Number.isFinite(row) && Number.isFinite(col)) {
        const inSelection =
          row >= selectionRange.startRow &&
          row <= selectionRange.endRow &&
          col >= selectionRange.startCol &&
          col <= selectionRange.endCol;
        if (!inSelection) {
          selectionMode = 'cell';
          selectCell(row, col);
        }
        await showContextMenu(e.clientX, e.clientY);
      }
    } else if (rowHeader && rowHeader.dataset.row !== undefined) {
      e.preventDefault();
      const row = parseInt(rowHeader.dataset.row, 10);
      if (Number.isFinite(row)) {
        selectionMode = 'row';
        applySelectionRange(row, 0, row, COLS - 1);
        if (window.electronAPI?.updateMenuState) {
          window.electronAPI.updateMenuState({
            selectionMode: 'row',
            selectedRow: row,
          });
        }
        await showContextMenu(e.clientX, e.clientY);
      }
    } else if (colHeader && colHeader.dataset.col !== undefined) {
      e.preventDefault();
      const col = parseInt(colHeader.dataset.col, 10);
      if (Number.isFinite(col)) {
        selectionMode = 'column';
        applySelectionRange(0, col, ROWS - 1, col);
        if (window.electronAPI?.updateMenuState) {
          window.electronAPI.updateMenuState({
            selectionMode: 'column',
            selectedCol: col,
          });
        }
        await showContextMenu(e.clientX, e.clientY);
      }
    } else if (e.target.closest('.corner-header')) {
      e.preventDefault();
      await showContextMenu(e.clientX, e.clientY);
    }
  });
  setupContextMenuHandlers();
}

// Story 13.2: Context menu show/hide and actions
// Story 13.3: Custom styles in context menu - populated from GetStyles()
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
    container.innerHTML = '';
  }
}

function updateContextMenuState() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  const hasSelection = !!selectedCell;
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

async function showContextMenu(x, y) {
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
  // Keep menu in viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight)
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  });
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.setAttribute('aria-hidden', 'true');
}

function setupContextMenuHandlers() {
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
  try {
    const { startRow, startCol, endRow, endCol } = selectionRange;
    if (action === 'copy') {
      if (!selectedCell) return;
      const value = await GetCellRawValue(selectedCell.row, selectedCell.col);
      await navigator.clipboard.writeText(value);
    } else if (action === 'paste') {
      if (!selectedCell) return;
      const text = await navigator.clipboard.readText();
      await SetCellValue(selectedCell.row, selectedCell.col, text);
      await refreshAllCells();
      updateFileStatus();
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
        if (result?.hasUnsavedChanges !== undefined)
          displayFileStatus(result.hasUnsavedChanges);
        await refreshAllCells();
      }
    } else if (action === 'align-left') {
      await applyAlignmentToSelection('left');
    } else if (action === 'align-center') {
      await applyAlignmentToSelection('center');
    } else if (action === 'align-right') {
      await applyAlignmentToSelection('right');
    } else if (action === 'clear') {
      const result = await ClearRange(startRow, startCol, endRow, endCol);
      if (result?.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await refreshAllCells();
      updateFileStatus();
    }
  } catch (err) {
    console.error('[App] Context menu action error:', err);
    await showAlert('Error: ' + err.message);
  }
}

container.addEventListener('scroll', () => {
  // Debounce scroll events
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    checkScrollPosition().catch((err) =>
      console.error('[App] Scroll expand error:', err)
    );
  }, 100);
});

// Check if we need to expand the grid based on scroll position
async function checkScrollPosition() {
  const container = document.querySelector('.spreadsheet-container');
  const table = document.getElementById('spreadsheet');

  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const tableWidth = table.scrollWidth;
  const tableHeight = table.scrollHeight;

  let needsRebuild = false;

  // Check if scrolled near right edge (within 20% of total width)
  if (scrollLeft + containerWidth > tableWidth * 0.8) {
    const newCols = COLS + EXPAND_COLS;
    if (window.__DEBUG__)
      console.log(`Scroll: Expanding columns from ${COLS} to ${newCols}`);
    COLS = newCols;
    needsRebuild = true;
  }

  // Check if scrolled near bottom edge (within 20% of total height)
  if (scrollTop + containerHeight > tableHeight * 0.8) {
    const newRows = ROWS + EXPAND_ROWS;
    if (window.__DEBUG__)
      console.log(`Scroll: Expanding rows from ${ROWS} to ${newRows}`);
    ROWS = newRows;
    needsRebuild = true;
  }

  if (needsRebuild) {
    const oldScrollLeft = scrollLeft;
    const oldScrollTop = scrollTop;

    await buildSpreadsheet();
    await refreshAllCells();
    // Restore scroll position after DOM is fully rebuilt
    container.scrollLeft = oldScrollLeft;
    container.scrollTop = oldScrollTop;
  }
}

// Story 11.3: Merge-aware grid rendering helpers
// Merge region format: { startRow, startCol, rowSpan, colSpan } — anchor is (startRow, startCol)

/**
 * Find merge region containing (row, col), or null if not in any merge.
 * @param {number} row
 * @param {number} col
 * @param {Array<{startRow: number, startCol: number, rowSpan: number, colSpan: number}>} merges
 * @returns {{startRow: number, startCol: number, rowSpan: number, colSpan: number} | null}
 */
function getMergeAt(row, col, merges) {
  if (!merges || merges.length === 0) return null;
  for (const m of merges) {
    const rs = m.rowSpan ?? 0;
    const cs = m.colSpan ?? 0;
    if (rs < 1 || cs < 1) continue;
    const inRow = row >= m.startRow && row < m.startRow + rs;
    const inCol = col >= m.startCol && col < m.startCol + cs;
    if (inRow && inCol) return m;
  }
  return null;
}

/**
 * Get merge info for (row,col): { merge, isAnchor }.
 * isAnchor: true if (row,col) is the top-left of the merge.
 * @param {number} row
 * @param {number} col
 * @param {Array<{startRow: number, startCol: number, rowSpan: number, colSpan: number}>} merges
 * @returns {{ merge: {startRow: number, startCol: number, rowSpan: number, colSpan: number} | null, isAnchor: boolean }}
 */
function getMergeInfo(row, col, merges) {
  const merge = getMergeAt(row, col, merges);
  if (!merge) return { merge: null, isAnchor: false };
  const isAnchor = merge.startRow === row && merge.startCol === col;
  return { merge, isAnchor };
}

/**
 * Check if (row,col) is covered by a rowspan from a cell above (same column, higher row).
 * Reserved for Story 11.6 keyboard navigation.
 * @param {number} row
 * @param {number} col
 * @param {Array<{startRow: number, startCol: number, rowSpan: number, colSpan: number}>} merges
 * @returns {boolean}
 */
function _isCoveredByRowspanFromAbove(row, col, merges) {
  const merge = getMergeAt(row, col, merges);
  if (!merge) return false;
  return merge.startRow !== row || merge.startCol !== col;
}

/**
 * Story 11.6: Get next selectable cell in direction, skipping covered cells.
 * @param {number} row
 * @param {number} col
 * @param {'up'|'down'|'left'|'right'} direction
 * @returns {{row: number, col: number} | null} Next cell or null if at boundary
 */
function getNextCell(row, col, direction) {
  let r = row;
  let c = col;
  if (direction === 'up') r--;
  else if (direction === 'down') r++;
  else if (direction === 'left') c--;
  else if (direction === 'right') c++;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  while (true) {
    const merge = getMergeAt(r, c, currentMerges);
    if (!merge || (merge.startRow === r && merge.startCol === c))
      return { row: r, col: c };
    // Covered: jump to edge in direction. Left/up → anchor; right/down → past merge.
    if (direction === 'right') c = merge.startCol + (merge.colSpan || 1);
    else if (direction === 'left') {
      r = merge.startRow;
      c = merge.startCol;
    } else if (direction === 'down') r = merge.startRow + (merge.rowSpan || 1);
    else if (direction === 'up') {
      r = merge.startRow;
      c = merge.startCol;
    }
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  }
}

/**
 * Story 11.6: Get next cell in tab order (left-to-right, top-to-bottom), skipping covered.
 */
function getNextCellTabOrder(row, col) {
  const next = getNextCell(row, col, 'right');
  if (next) return next;
  if (row + 1 >= ROWS) return null;
  return getNextCell(row + 1, -1, 'right');
}

/**
 * Resolve (row,col) to anchor if covered by a merge. Story 11.4.
 * @param {number} row
 * @param {number} col
 * @returns {{row: number, col: number}}
 */
function resolveToAnchor(row, col) {
  // CR 11-4: Reject invalid inputs instead of coercing to (0,0) - avoids silent wrong-cell selection
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isFinite(row) ||
    !Number.isFinite(col) ||
    row < 0 ||
    col < 0
  ) {
    throw new TypeError(
      `resolveToAnchor: invalid coords (row=${row}, col=${col})`
    );
  }
  const merge = getMergeAt(row, col, currentMerges);
  if (!merge) return { row, col };
  return { row: merge.startRow, col: merge.startCol };
}

/**
 * Get DOM element for cell (row,col). When (row,col) is covered by a merge, returns the anchor's td.
 * @param {number} row
 * @param {number} col
 * @returns {HTMLTableCellElement | null}
 */
function getCellElement(row, col) {
  const { merge, isAnchor } = getMergeInfo(row, col, currentMerges);
  if (isAnchor || !merge) {
    return document.getElementById(`cell-${row}-${col}`);
  }
  // Covered: return anchor's td
  return document.getElementById(`cell-${merge.startRow}-${merge.startCol}`);
}

// Build the spreadsheet table (merge-aware)
// Fetches merge regions and renders anchor cells with colspan/rowspan; covered cells are not in DOM
// Serialize concurrent calls to prevent duplicate cell IDs (race between init and new-file flow)
let buildSpreadsheetPromise = null;
async function buildSpreadsheet() {
  while (buildSpreadsheetPromise) {
    await buildSpreadsheetPromise;
  }
  buildSpreadsheetPromise = (async () => {
    try {
      return await buildSpreadsheetImpl();
    } finally {
      buildSpreadsheetPromise = null;
    }
  })();
  return buildSpreadsheetPromise;
}
async function buildSpreadsheetImpl() {
  const table = document.getElementById('spreadsheet');
  const container = document.getElementById('container');
  table.innerHTML = '';

  // Update grid ARIA dimensions
  if (container) {
    container.setAttribute('aria-rowcount', String(ROWS));
    container.setAttribute('aria-colcount', String(COLS));
  }

  // Header row
  const headerRow = document.createElement('tr');
  headerRow.setAttribute('role', 'row');
  const cornerCell = document.createElement('th');
  cornerCell.className = 'corner-header';
  cornerCell.setAttribute('scope', 'col');
  headerRow.appendChild(cornerCell);

  for (let col = 0; col < COLS; col++) {
    const th = document.createElement('th');
    th.className = 'column-header';
    th.setAttribute('role', 'columnheader');
    th.setAttribute('aria-colindex', String(col + 1));
    th.dataset.col = String(col);
    th.textContent = colToLetter(col);
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  // Fetch merge regions from API
  try {
    currentMerges = await GetMerges();
  } catch (err) {
    console.warn('[buildSpreadsheet] Could not fetch merges:', err);
    currentMerges = [];
  }
  const merges = currentMerges;

  // Data rows — merge-aware: anchor cells use colSpan/rowSpan, covered cells not rendered
  for (let row = 0; row < ROWS; row++) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('aria-rowindex', String(row + 1));

    // Row header (Story 13.1: data-row for click-to-select)
    const th = document.createElement('th');
    th.className = 'row-header';
    th.setAttribute('role', 'rowheader');
    th.setAttribute('aria-rowindex', String(row + 1));
    th.dataset.row = String(row);
    th.textContent = row + 1;
    tr.appendChild(th);

    // Data cells — iterate by logical column; skip cols covered by rowspan from above
    let col = 0;
    let colIndex = 1; // For aria-colindex
    while (col < COLS) {
      const { merge, isAnchor } = getMergeInfo(row, col, merges);

      if (merge && isAnchor) {
        // Anchor: create td with colSpan and rowSpan
        const td = document.createElement('td');
        td.className = 'cell merged-anchor'; // Story 13.9: center text in merged cells by default
        td.id = `cell-${row}-${col}`;
        td.dataset.row = row;
        td.dataset.col = col;
        td.colSpan = merge.colSpan;
        td.rowSpan = merge.rowSpan;
        td.setAttribute('role', 'gridcell');
        td.setAttribute('aria-colspan', String(merge.colSpan));
        td.setAttribute('aria-rowspan', String(merge.rowSpan));
        td.setAttribute('aria-colindex', String(colIndex));
        td.setAttribute('aria-rowindex', String(row + 1));
        td.setAttribute('tabindex', '-1');

        tr.appendChild(td);
        col += merge.colSpan;
        colIndex += merge.colSpan;
      } else if (merge) {
        // Covered by merge (same row or rowspan from above) — no td
        col++;
        colIndex++;
      } else {
        // Unmerged cell
        const td = document.createElement('td');
        td.className = 'cell';
        td.id = `cell-${row}-${col}`;
        td.dataset.row = row;
        td.dataset.col = col;
        td.setAttribute('role', 'gridcell');
        td.setAttribute('aria-colindex', String(colIndex));
        td.setAttribute('aria-rowindex', String(row + 1));
        td.setAttribute('tabindex', '-1');

        tr.appendChild(td);
        col++;
        colIndex++;
      }
    }

    table.appendChild(tr);
  }

  // Story 11.5: Re-apply selection after grid rebuild (preserves range)
  const isRange =
    selectionRange.startRow !== selectionRange.endRow ||
    selectionRange.startCol !== selectionRange.endCol;
  applyCellSelection(selectionRange.endRow, selectionRange.endCol, isRange);
}

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

function saveCurrentEditOnCellSwitch() {
  const input = document.querySelector('.cell-editor');
  if (!input) {
    forceCleanupEditing();
    return;
  }
  const editingCell = input.parentElement;
  const editRow = parseInt(editingCell.dataset.row);
  const editCol = parseInt(editingCell.dataset.col);
  const value = input.value;
  if (window.__DEBUG__)
    console.log(
      `Saving edit: row=${editRow}, col=${editCol}, value="${value}"`
    );
  input.remove();
  isEditing = false;
  SetCellValue(editRow, editCol, value)
    .then((result) => {
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      // Story 15.2: update undo/redo toolbar and menu after every cell edit
      applyUndoRedoState(result);
      return refreshAllCells();
    })
    .catch((err) => console.error('Error saving on cell switch:', err));
}

function expandGridIfNeeded(row, col) {
  let needsRebuild = false;
  if (row >= ROWS - EXPAND_THRESHOLD) {
    ROWS = Math.max(row + EXPAND_ROWS, ROWS + EXPAND_ROWS);
    if (window.__DEBUG__) console.log(`Expanding rows to ${ROWS}`);
    needsRebuild = true;
  }
  if (col >= COLS - EXPAND_THRESHOLD) {
    COLS = Math.max(col + EXPAND_COLS, COLS + EXPAND_COLS);
    if (window.__DEBUG__) console.log(`Expanding columns to ${COLS}`);
    needsRebuild = true;
  }
  if (needsRebuild) buildSpreadsheet().then(() => refreshAllCells());
}

function computeSelectionRange(row, col, extendSelection) {
  if (!extendSelection) {
    return { startRow: row, startCol: col, endRow: row, endCol: col };
  }
  const { startRow: sr, startCol: sc } = selectionRange;
  const minR = Math.min(sr, row);
  const maxR = Math.max(sr, row);
  const minC = Math.min(sc, col);
  const maxC = Math.max(sc, col);
  return { startRow: minR, startCol: minC, endRow: maxR, endCol: maxC };
}

function applySelectionRange(startRow, startCol, endRow, endCol) {
  selectionRange = { startRow, startCol, endRow, endCol };
  selectedCell = { row: startRow, col: startCol };
  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected');
    el.setAttribute('tabindex', '-1');
  });
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = getCellElement(r, c);
      if (cell) {
        cell.classList.add('selected');
        if (r === startRow && c === startCol)
          cell.setAttribute('tabindex', '0');
      }
    }
  }
  updateFormulaBar(startRow, startCol);
  const cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
  announceToScreenReader(
    buildSelectionAnnouncement(startRow, startCol, endRow, endCol, cellCount)
  );
  updateMergeMenuState();
}

function applyCellSelection(row, col, extendSelection = false) {
  const { startRow, startCol, endRow, endCol } = computeSelectionRange(
    row,
    col,
    extendSelection
  );

  selectionRange = { startRow, startCol, endRow, endCol };
  selectedCell = { row: startRow, col: startCol };

  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected');
    el.setAttribute('tabindex', '-1');
  });

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = getCellElement(r, c);
      if (cell) {
        cell.classList.add('selected');
        if (r === startRow && c === startCol)
          cell.setAttribute('tabindex', '0');
      }
    }
  }

  updateFormulaBar(startRow, startCol);
  const cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
  const announcement = buildSelectionAnnouncement(
    startRow,
    startCol,
    endRow,
    endCol,
    cellCount
  );
  announceToScreenReader(announcement);

  updateMergeMenuState();
}

function buildSelectionAnnouncement(
  startRow,
  startCol,
  endRow,
  endCol,
  cellCount
) {
  if (cellCount > 1) {
    return `Range ${colToLetter(startCol)}${startRow + 1} to ${colToLetter(endCol)}${endRow + 1} selected, ${cellCount} cells`;
  }
  const cellRef = colToLetter(startCol) + (startRow + 1);
  const primaryCell = getCellElement(startRow, startCol);
  const displayValue = primaryCell?.textContent?.trim() || '';
  const formula = primaryCell?.dataset.formula || '';
  if (formula)
    return `Cell ${cellRef} selected, formula: ${formula}, value: ${displayValue || 'empty'}`;
  if (displayValue) return `Cell ${cellRef} selected, value: ${displayValue}`;
  return `Cell ${cellRef} selected, empty`;
}

// Story 11.5: Check if selection overlaps any existing merge (disables Merge menu)
function selectionOverlapsMerge(startRow, startCol, endRow, endCol) {
  for (const m of currentMerges) {
    const mEndRow = m.startRow + (m.rowSpan || 1) - 1;
    const mEndCol = m.startCol + (m.colSpan || 1) - 1;
    if (
      startRow <= mEndRow &&
      endRow >= m.startRow &&
      startCol <= mEndCol &&
      endCol >= m.startCol
    )
      return true;
  }
  return false;
}

// Story 11.5: Update Format menu Merge/Unmerge enable state
// Story 13.1: Also update Insert menu (row/column)
function updateMergeMenuState() {
  if (!window.electronAPI?.updateMenuState) return;
  const { startRow, startCol, endRow, endCol } = selectionRange;
  const cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
  const overlaps = selectionOverlapsMerge(startRow, startCol, endRow, endCol);
  const canMerge = cellCount >= 2 && !overlaps;
  const isSingleCell = cellCount === 1;
  const { merge, isAnchor } = getMergeInfo(startRow, startCol, currentMerges);
  const canUnmerge = isSingleCell && merge && isAnchor;
  const canInsertRow =
    selectionMode === 'row' &&
    startRow === endRow &&
    startCol === 0 &&
    endCol === COLS - 1;
  const canInsertColumn =
    selectionMode === 'column' &&
    startCol === endCol &&
    startRow === 0 &&
    endRow === ROWS - 1;
  window.electronAPI.updateMenuState({
    canMerge,
    canUnmerge,
    canInsertRow,
    canInsertColumn,
  });
}

// Select a cell (Story 11.5: extendSelection = true for Shift+click range selection)
function selectCell(row, col, extendSelection = false) {
  ({ row, col } = resolveToAnchor(row, col));
  if (isEditing) {
    if (window.__DEBUG__)
      console.log('Selecting new cell while editing - saving first');
    saveCurrentEditOnCellSwitch();
  }
  expandGridIfNeeded(row, col);
  applyCellSelection(row, col, extendSelection);
}

// Update the formula bar with the selected cell's content
async function updateFormulaBar(row, col) {
  const cellRef = document.getElementById('cell-ref');
  const formulaBar = document.getElementById('formula-bar');

  if (!cellRef || !formulaBar) return;

  // Update cell reference display
  const ref = await GetCellRef(row, col);
  cellRef.textContent = ref;

  // Get raw value (formula or value)
  const rawValue = await GetCellRawValue(row, col);
  formulaBar.value = rawValue || '';
}

// Start editing a cell
function startEditing(row, col) {
  if (isEditing) {
    console.warn('Already editing, ignoring startEditing call');
    return;
  }

  // Story 11.4: Resolve covered cells to anchor for editing
  ({ row, col } = resolveToAnchor(row, col));

  const cell = getCellElement(row, col);
  if (!cell) return;

  // Clean up any leftover input elements
  const existingInput = cell.querySelector('.cell-editor');
  if (existingInput) {
    existingInput.remove();
  }

  isEditing = true;

  // Make sure this cell is selected (but don't call selectCell which would trigger cleanup)
  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  cell.classList.add('selected');
  selectedCell = { row, col };

  // Get raw value (formula, not computed)
  GetCellRawValue(row, col)
    .then((rawValue) => {
      // Double-check we're still supposed to be editing
      if (!isEditing) {
        console.warn('Editing was cancelled while fetching value');
        return;
      }

      if (window.__DEBUG__)
        console.log(
          `Editing cell (${row},${col}): rawValue="${rawValue}", isFormula=${cell.classList.contains('formula-cell')}`
        );

      // Replace cell content with input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-editor';
      input.value = rawValue || '';
      input.placeholder = 'Type value or formula...';

      // Save original content
      const originalContent = cell.textContent;
      cell.textContent = '';
      cell.appendChild(input);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      // Set up event handlers
      setupEditorHandlers(input, row, col, cell, originalContent);
    })
    .catch((err) => {
      console.error('Error getting cell value:', err);
      isEditing = false;
    });
}

// Set up event handlers for the editor input
function setupEditorHandlers(input, row, col, cell, originalContent) {
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishEditing(row, col, input.value, cell);
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    cancelEditing(cell, originalContent);
  };

  // Handle Enter key - save
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      finish();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      finish();
      // Move to next cell (select, don't start editing)
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      if (nextCol >= 0 && nextCol < COLS) {
        setTimeout(() => selectCell(row, nextCol), 100);
      }
    }
  });

  // Handle blur - save when clicking outside
  input.addEventListener('blur', (_e) => {
    // Use a timeout to allow other events to fire first
    setTimeout(() => {
      if (!finished && isEditing) {
        finish();
      }
    }, 150);
  });
}

// Track if we're currently saving to prevent duplicate saves
let isSaving = false;

// Finish editing and save value
function finishEditing(row, col, value, cell) {
  if (!isEditing) {
    console.warn('finishEditing called but not editing');
    return;
  }

  if (isSaving) {
    console.warn('finishEditing called but already saving - ignoring');
    return;
  }

  if (window.__DEBUG__)
    console.log(`Finishing edit: row=${row}, col=${col}, value="${value}"`);

  // Remove the input element first
  const input = cell.querySelector('.cell-editor');
  if (input) {
    input.remove();
  }

  // CRITICAL: Reset isEditing AFTER removing input but BEFORE async operations
  isEditing = false;
  isSaving = true;
  if (window.__DEBUG__)
    console.log(`isEditing set to false, isSaving set to true`);

  SetCellValue(row, col, value)
    .then((result) => {
      if (window.__DEBUG__)
        console.log(`SetCellValue completed for row=${row}, col=${col}`);
      // Update file status from the response
      if (result.hasUnsavedChanges !== undefined) {
        displayFileStatus(result.hasUnsavedChanges);
      }
      applyUndoRedoState(result);
      // Refresh ALL cells to pick up dependent formula changes
      return refreshAllCells();
    })
    .then(() => {
      if (window.__DEBUG__)
        console.log(`All cells refreshed after edit at row=${row}, col=${col}`);
      isSaving = false;

      // Update formula bar to show the new value
      if (
        selectedCell &&
        selectedCell.row === row &&
        selectedCell.col === col
      ) {
        updateFormulaBar(row, col);
      }
    })
    .catch((err) => {
      console.error('Error setting cell value:', err);
      cell.textContent = '#ERROR';
      cell.classList.add('error-cell');
      // Make sure we're not stuck in editing state even on error
      isEditing = false;
      isSaving = false;
    });
}

const STYLE_CLASSES = ['style-title', 'style-header', 'style-total'];
const STYLE_ID = { TITLE: 1, HEADER: 2, TOTAL: 3 };
const TOOLTIP_LENGTH_THRESHOLD = 25;

function applyCellValue(
  cell,
  value,
  rawValue,
  styleId,
  styleFormats = null,
  alignment = '',
  isError = false
) {
  const safeValue = value ?? '';
  cell.textContent = safeValue;
  // Story 13.5: Show full content on hover for error cells and long values
  if (safeValue && (isError || safeValue.length > TOOLTIP_LENGTH_THRESHOLD)) {
    cell.title = safeValue;
  } else {
    cell.title = '';
  }
  cell.classList.toggle('error-cell', isError);
  if ((rawValue ?? '').startsWith('=')) {
    cell.classList.add('formula-cell');
    cell.dataset.formula = rawValue;
  } else {
    cell.classList.remove('formula-cell');
    delete cell.dataset.formula;
  }
  const isQuotePrefix = (rawValue ?? '').startsWith("'");
  const isNum =
    !isQuotePrefix && safeValue && !isNaN(safeValue) && safeValue.trim() !== '';
  cell.classList.toggle('number-cell', !!isNum);
  // Story 12.2: Apply style classes (1=Title, 2=Header, 3=Total)
  STYLE_CLASSES.forEach((c) => cell.classList.remove(c));
  cell.style.textAlign = '';
  cell.style.verticalAlign = '';
  if (styleId >= STYLE_ID.TITLE && styleId <= STYLE_ID.TOTAL) {
    cell.classList.add(STYLE_CLASSES[styleId - 1]);
  }
  if (styleId > 0 && styleFormats) {
    const style = styleFormats.find((s) => s.id === styleId);
    const format = style?.format;
    if (format) {
      const css = formatToCssPreview(format);
      for (const [k, v] of Object.entries(css)) {
        const prop = k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());
        const isBorder = prop.startsWith('border-');
        cell.style.setProperty(prop, v, isBorder ? 'important' : '');
      }
      const align = format.alignment;
      if (align?.horizontal === '' || align?.horizontal === 'default') {
        // Use cell-type default: numbers right, text left (overrides style class)
        cell.style.setProperty('text-align', isNum ? 'right' : 'left');
      }
      if (align?.vertical === '' || align?.vertical === 'default') {
        cell.style.removeProperty('vertical-align');
      }
    }
  }
  // Story 13.8: Cell-level alignment overrides style alignment.
  // Setting explicitly (including '') ensures stale values never persist across calls.
  if (alignment) {
    cell.style.textAlign = alignment;
  } else {
    cell.style.textAlign = '';
  }
}

async function refreshAllCells() {
  try {
    const [cells, styles] = await Promise.all([GetAllCells(), GetStyles()]);
    const cleared = new Set();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = getCellElement(row, col);
        if (cell && !cleared.has(cell)) {
          cleared.add(cell);
          cell.textContent = '';
          cell.title = '';
          cell.classList.remove('formula-cell', 'error-cell', ...STYLE_CLASSES);
          cell.style.textAlign = '';
          cell.style.verticalAlign = '';
        }
      }
    }
    for (const [ref, cellData] of Object.entries(cells)) {
      const match = ref.match(/([A-Z]+)(\d+)/);
      if (match) {
        const cell = getCellElement(
          parseInt(match[2]) - 1,
          letterToCol(match[1])
        );
        if (cell)
          applyCellValue(
            cell,
            cellData.display,
            cellData.raw ?? '',
            cellData.styleId,
            styles,
            cellData.alignment ?? '',
            cellData.isError ?? false
          );
      }
    }
  } catch (err) {
    console.error('Error refreshing cells:', err);
  }
}

// Cancel editing
function cancelEditing(cell, originalContent) {
  if (window.__DEBUG__) console.log('Cancelling edit');

  // Remove the input element
  const input = cell.querySelector('.cell-editor');
  if (input) {
    input.remove();
  }

  // Reset state immediately
  isEditing = false;
  if (window.__DEBUG__) console.log('isEditing set to false (cancelled)');

  cell.textContent = originalContent;
}

async function loadCells() {
  try {
    const [cells, styles] = await Promise.all([GetAllCells(), GetStyles()]);
    for (const [ref, cellData] of Object.entries(cells)) {
      const match = ref.match(/([A-Z]+)(\d+)/);
      if (match) {
        const cell = getCellElement(
          parseInt(match[2]) - 1,
          letterToCol(match[1])
        );
        if (cell)
          applyCellValue(
            cell,
            cellData.display,
            cellData.raw ?? '',
            cellData.styleId,
            styles,
            cellData.alignment ?? '',
            cellData.isError ?? false
          );
      }
    }
  } catch (err) {
    console.error('Error loading cells:', err);
  }
}

// Convert letter to column index (A -> 0, Z -> 25, AA -> 26)
function letterToCol(letter) {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

function ensureSpreadsheetView() {
  if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
    showSpreadsheet();
}

// Handle Cmd/Ctrl + O, S, N (file operations)
function handleKeydownFileOps(e) {
  if (!(e.metaKey || e.ctrlKey)) return false;
  // Story 15.2: Undo (Cmd+Z) and Redo (Cmd+Shift+Z) — skip if actively editing a cell
  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    performUndo();
    return true;
  }
  if (e.key === 'z' && e.shiftKey) {
    e.preventDefault();
    performRedo();
    return true;
  }
  if (e.key === 'o') {
    e.preventDefault();
    ensureSpreadsheetView();
    document.getElementById('load-btn')?.click();
    return true;
  }
  if (e.key === 's') {
    e.preventDefault();
    ensureSpreadsheetView();
    document.getElementById('save-btn')?.click();
    return true;
  }
  if (e.key === 'n') {
    e.preventDefault();
    ensureSpreadsheetView();
    document.getElementById('new-btn')?.click();
    return true;
  }
  return false;
}

// Handle arrow keys, Enter, Tab, Delete, typing when a cell is selected
// Story 11.6: Arrow/Tab/Enter use getNextCell to skip covered cells
function handleKeydownCellNavigation(e, row, col) {
  if (e.key === 'ArrowUp') {
    const next = getNextCell(row, col, 'up');
    if (next) {
      e.preventDefault();
      selectCell(next.row, next.col);
      return true;
    }
  }
  if (e.key === 'ArrowDown') {
    const next = getNextCell(row, col, 'down');
    if (next) {
      e.preventDefault();
      selectCell(next.row, next.col);
      return true;
    }
  }
  if (e.key === 'ArrowLeft') {
    // Story 13.10: In RTL mode visual left = logical right (higher col index)
    const next = getNextCell(row, col, isRTL ? 'right' : 'left');
    if (next) {
      e.preventDefault();
      selectCell(next.row, next.col);
      return true;
    }
  }
  if (e.key === 'ArrowRight') {
    // Story 13.10: In RTL mode visual right = logical left (lower col index)
    const next = getNextCell(row, col, isRTL ? 'left' : 'right');
    if (next) {
      e.preventDefault();
      selectCell(next.row, next.col);
      return true;
    }
  }
  if (e.key === 'Tab') {
    const next = getNextCellTabOrder(row, col);
    if (next) {
      e.preventDefault();
      selectCell(next.row, next.col);
      return true;
    }
  }
  if (e.key === 'Enter' || e.key === 'F2') {
    e.preventDefault();
    startEditing(row, col);
    return true;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    SetCellValue(row, col, '').then((result) => {
      const cell = getCellElement(row, col);
      if (cell) {
        cell.textContent = '';
        cell.classList.remove('formula-cell');
        delete cell.dataset.formula;
      }
      if (result.hasUnsavedChanges !== undefined) {
        displayFileStatus(result.hasUnsavedChanges);
      }
      return refreshAllCells();
    });
    return true;
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    startEditingWithChar(row, col, e.key);
    return true;
  }
  return false;
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (isEditing) return;
  if (e.target.tagName === 'INPUT') return;
  if (handleKeydownFileOps(e)) return;
  if (
    selectedCell &&
    handleKeydownCellNavigation(e, selectedCell.row, selectedCell.col)
  )
    return;
});

// Start editing with an initial character
function startEditingWithChar(row, col, initialChar) {
  if (isEditing) {
    console.warn('Already editing, ignoring startEditingWithChar call');
    return;
  }

  // Story 11.4: Resolve covered cells to anchor
  ({ row, col } = resolveToAnchor(row, col));

  const cell = getCellElement(row, col);
  if (!cell) return;

  // Clean up any leftover input elements
  const existingInput = cell.querySelector('.cell-editor');
  if (existingInput) {
    existingInput.remove();
  }

  isEditing = true;
  if (window.__DEBUG__)
    console.log(
      `Starting edit with char "${initialChar}" at row=${row}, col=${col}`
    );

  // Select the cell WITHOUT triggering cleanup (since we're about to edit)
  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  cell.classList.add('selected');
  selectedCell = { row, col };

  // Replace cell content with input, starting with the typed character
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-editor';
  input.value = initialChar; // Start with the character they typed

  const originalContent = cell.textContent;
  cell.textContent = '';
  cell.appendChild(input);

  // Focus immediately (synchronously) after appending to DOM
  input.focus();
  // Move cursor to end
  input.setSelectionRange(1, 1);
  if (window.__DEBUG__) console.log(`Input focused, value="${input.value}"`);

  // Set up event handlers
  setupEditorHandlers(input, row, col, cell, originalContent);
}

// Initialize - wait for DOM and modules to be ready
if (window.__DEBUG__) console.log('[app.js] Starting initialization...');

// Load cells after setupWelcomeScreen (see above) - only when spreadsheet view is shown

// Set up formula bar event handlers
const formulaBar = document.getElementById('formula-bar');
if (formulaBar) {
  formulaBar.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && selectedCell) {
      e.preventDefault();
      const { row, col } = selectedCell;
      const value = formulaBar.value;

      // Save the value
      const result = await SetCellValue(row, col, value);
      // Update file status from the response
      if (result.hasUnsavedChanges !== undefined) {
        displayFileStatus(result.hasUnsavedChanges);
      }
      // Story 15.2: update undo/redo toolbar and menu after formula bar commit
      applyUndoRedoState(result);
      await refreshAllCells();

      // Move to next row (like Excel)
      selectCell(row + 1, col);
    } else if (e.key === 'Escape') {
      // Cancel edit and restore original value
      if (selectedCell) {
        const { row, col } = selectedCell;
        updateFormulaBar(row, col);
      }
      formulaBar.blur();
    }
  });
}

// File operations handlers
document.getElementById('new-btn').addEventListener('click', async () => {
  // Check if there are unsaved changes
  const status = await GetFileStatus();
  if (window.__DEBUG__) console.log('New button clicked, status:', status);

  // Only confirm if there are unsaved changes
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Create a new spreadsheet anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) {
      return; // User cancelled
    }
  }

  // Proceed with creating new spreadsheet
  try {
    await NewFile();
    // Clear the grid
    ROWS = 100;
    COLS = 26;
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
  try {
    // Get current file status to check if we have a path
    const status = await GetFileStatus();

    // If file has a path, save directly; otherwise show dialog
    const path = await SaveFile(status.path || '');

    // Story 7.5: Add to recent files after successful save
    if (path && window.electronAPI && window.electronAPI.addRecentFile) {
      await window.electronAPI.addRecentFile(path);
    }

    updateFileStatus();
    if (window.__DEBUG__) console.log('File saved');
  } catch (error) {
    await showAlert('Error saving file: ' + error.message);
  }
});

document.getElementById('load-btn').addEventListener('click', async () => {
  // Check if there are unsaved changes
  const status = await GetFileStatus();
  if (window.__DEBUG__) console.log('Load button clicked, status:', status);

  // Only confirm if there are unsaved changes
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Load a different file anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) {
      return; // User cancelled
    }
  }

  try {
    // Call unified LoadFile API (shows dialog in native mode, uses file input in web mode)
    const path = await LoadFile('');

    // Story 7.5: Add to recent files after successful load
    if (path && window.electronAPI && window.electronAPI.addRecentFile) {
      await window.electronAPI.addRecentFile(path);
    }

    // Reload all cells from server
    ROWS = 100;
    COLS = 26;
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
function updateAlignmentButtonState(activeAlignment) {
  const btns = {
    left: 'align-left-btn',
    center: 'align-center-btn',
    right: 'align-right-btn',
  };
  for (const [align, id] of Object.entries(btns)) {
    const btn = document.getElementById(id);
    if (btn)
      btn.setAttribute('aria-pressed', String(align === activeAlignment));
  }
}

async function applyAlignmentToSelection(alignment) {
  if (!selectedCell) return;
  const { startRow, startCol, endRow, endCol } = selectionRange;
  try {
    let result;
    if (startRow === endRow && startCol === endCol) {
      result = await SetCellAlignment(startRow, startCol, alignment);
    } else {
      result = await SetRangeAlignment(
        startRow,
        startCol,
        endRow,
        endCol,
        alignment
      );
    }
    if (result.hasUnsavedChanges !== undefined) {
      displayFileStatus(result.hasUnsavedChanges);
    }
    updateAlignmentButtonState(alignment);
    await refreshAllCells();
  } catch (err) {
    console.error('Error applying alignment:', err);
  }
}

document
  .getElementById('align-left-btn')
  .addEventListener('click', () => applyAlignmentToSelection('left'));
document
  .getElementById('align-center-btn')
  .addEventListener('click', () => applyAlignmentToSelection('center'));
document
  .getElementById('align-right-btn')
  .addEventListener('click', () => applyAlignmentToSelection('right'));

// RTL toggle logic — newValue is the desired state (boolean)
async function setRTL(newValue) {
  isRTL = newValue;
  if (isRTL) {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.removeAttribute('dir');
  }
  await SetSetting('rtl', isRTL);
  window.electronAPI?.updateMenuState?.({ isRTL });
}

// Story 7.12: Extract CSV import logic into function (CSV buttons removed from toolbar)
async function handleImportCSV() {
  try {
    // Get CSV preview
    const preview = await PreviewCSV('');

    if (!preview) {
      // User cancelled file dialog
      return;
    }

    // Show preview modal
    showCSVPreviewModal(preview);
  } catch (error) {
    await showAlert('Error previewing CSV: ' + error.message);
  }
}

// Expose for testing (Story 11.3, 11.4) - Playwright merge tests need buildSpreadsheet to apply merge regions
window.getCellElement = getCellElement;
window.resolveToAnchor = resolveToAnchor;
window.startEditing = startEditing;
window.handleImportCSV = handleImportCSV;
window.selectCell = selectCell;
window.refreshAllCells = refreshAllCells;
window.setRTL = setRTL;
window.buildSpreadsheet = buildSpreadsheet;
window.displayFileStatus = displayFileStatus;

function showCSVPreviewModal(preview) {
  const modal = document.getElementById('csv-preview-modal');
  const infoEl = document.getElementById('csv-preview-info');
  const tableEl = document.getElementById('csv-preview-table');
  const importBtn = document.getElementById('csv-preview-import');
  const cancelBtn = document.getElementById('csv-preview-cancel');

  // Display file info
  const filename = preview.path.split('/').pop();
  infoEl.innerHTML = `
        <p><strong>File:</strong> ${filename}</p>
        <p><strong>Size:</strong> ${preview.rows} rows × ${preview.cols} columns</p>
        <p><strong>Preview:</strong> First ${preview.preview.length} rows</p>
    `;

  // Build preview table
  let tableHTML = '<thead><tr>';
  // Column headers (A, B, C, ...)
  for (let col = 0; col < preview.cols; col++) {
    const colLetter = String.fromCharCode(65 + (col % 26));
    tableHTML += `<th>${colLetter}</th>`;
  }
  tableHTML += '</tr></thead><tbody>';

  // Data rows
  preview.preview.forEach((row) => {
    tableHTML += '<tr>';
    for (let col = 0; col < preview.cols; col++) {
      const value = row[col] || '';
      tableHTML += `<td>${value}</td>`;
    }
    tableHTML += '</tr>';
  });
  tableHTML += '</tbody>';

  tableEl.innerHTML = tableHTML;

  // Handle Cancel button (defined first for focus trap)
  const handleCancel = () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    importBtn.removeEventListener('click', handleImport);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  // Handle Import button
  const handleImport = async () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    importBtn.removeEventListener('click', handleImport);
    cancelBtn.removeEventListener('click', handleCancel);

    try {
      // Check for unsaved changes
      const status = await GetFileStatus();
      if (status.hasUnsavedChanges) {
        const confirmed = await showConfirmDialog(
          'You have unsaved changes! Import CSV anyway? All unsaved changes will be lost.'
        );
        if (!confirmed) {
          return; // User cancelled
        }
      }

      // Import CSV data
      const result = await ImportCSV(preview.path);

      // Reload grid
      ROWS = Math.max(100, result.rows);
      COLS = Math.max(26, result.cols);
      await buildSpreadsheet();
      await loadCells();
      selectCell(0, 0);
      updateFileStatus();
      window.syncFormatMenuFromApi?.();

      if (window.__DEBUG__) console.log(`CSV imported: ${result.message}`);
    } catch (error) {
      await showAlert('Error importing CSV: ' + error.message);
    }
  };

  // Show modal
  modal.classList.add('active');
  const removeFocusTrap = setupDialogFocusTrap(modal, handleCancel);
  cancelBtn.focus();

  importBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      handleCancel();
    }
  });
}

// Story 9.6: In-app Formula Reference
const FORMULA_HELP_HTML = `
<p>Formulas start with <code>=</code>. The cell shows the result; the formula bar shows the formula.</p>

<h3>Arithmetic Operators</h3>
<table class="formula-help-table">
<thead><tr><th>Operator</th><th>Meaning</th><th>Example</th></tr></thead>
<tbody>
<tr><td>+</td><td>Add</td><td><code>=A1+B1</code></td></tr>
<tr><td>-</td><td>Subtract</td><td><code>=A1-B1</code></td></tr>
<tr><td>*</td><td>Multiply</td><td><code>=A1*B1</code></td></tr>
<tr><td>/</td><td>Divide</td><td><code>=A1/B1</code></td></tr>
<tr><td>%</td><td>Modulo</td><td><code>=A1%B1</code></td></tr>
</tbody>
</table>

<h3>Comparison Operators</h3>
<p>Result is 1 (true) or 0 (false).</p>
<table class="formula-help-table">
<thead><tr><th>Operator</th><th>Meaning</th><th>Example</th></tr></thead>
<tbody>
<tr><td>=</td><td>Equal</td><td><code>=A1=10</code></td></tr>
<tr><td>!=</td><td>Not equal</td><td><code>=A1!=0</code></td></tr>
<tr><td>&lt;</td><td>Less than</td><td><code>=A1&lt;100</code></td></tr>
<tr><td>&lt;=</td><td>Less than or equal</td><td><code>=A1&lt;=50</code></td></tr>
<tr><td>&gt;</td><td>Greater than</td><td><code>=A1&gt;0</code></td></tr>
<tr><td>&gt;=</td><td>Greater than or equal</td><td><code>=A1&gt;=10</code></td></tr>
</tbody>
</table>

<h3>Cell &amp; Range References</h3>
<p><strong>Cell:</strong> <code>A1</code>, <code>B5</code>, <code>AA10</code></p>
<p><strong>Range:</strong> <code>A1:A10</code>, <code>A1:C3</code> (colon between start and end)</p>

<h3>Numeric Functions</h3>
<table class="formula-help-table">
<thead><tr><th>Function</th><th>Syntax</th><th>Example</th></tr></thead>
<tbody>
<tr><td>SUM</td><td>SUM(range)</td><td><code>=SUM(A1:A10)</code></td></tr>
<tr><td>AVG</td><td>AVG(range)</td><td><code>=AVG(B1:B5)</code></td></tr>
<tr><td>MIN</td><td>MIN(range)</td><td><code>=MIN(A1:A20)</code></td></tr>
<tr><td>MAX</td><td>MAX(range)</td><td><code>=MAX(A1:A20)</code></td></tr>
<tr><td>COUNT</td><td>COUNT(range)</td><td><code>=COUNT(A1:A10)</code></td></tr>
</tbody>
</table>

<h3>String Functions</h3>
<table class="formula-help-table">
<thead><tr><th>Function</th><th>Syntax</th><th>Example</th></tr></thead>
<tbody>
<tr><td>CONCAT</td><td>CONCAT(text1, text2, ...)</td><td><code>=CONCAT(A1, " ", B1)</code></td></tr>
<tr><td>UPPER</td><td>UPPER(text)</td><td><code>=UPPER(A1)</code></td></tr>
<tr><td>LOWER</td><td>LOWER(text)</td><td><code>=LOWER("HELLO")</code></td></tr>
<tr><td>LEN</td><td>LEN(text)</td><td><code>=LEN(A1)</code></td></tr>
<tr><td>LEFT</td><td>LEFT(text, count)</td><td><code>=LEFT("Hello", 2)</code> → "He"</td></tr>
<tr><td>RIGHT</td><td>RIGHT(text, count)</td><td><code>=RIGHT("Hello", 2)</code> → "lo"</td></tr>
<tr><td>MID</td><td>MID(text, start, count)</td><td><code>=MID("Hello", 2, 3)</code> → "ell" (start is 1-based)</td></tr>
</tbody>
</table>
`;

function showFormulaHelpModal() {
  const modal = document.getElementById('formula-help-modal');
  const contentEl = document.getElementById('formula-help-content');
  const closeBtn = document.getElementById('formula-help-close');
  if (!modal || !contentEl || !closeBtn) return;

  contentEl.innerHTML = FORMULA_HELP_HTML;
  modal.classList.add('active');

  const handleClose = () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    closeBtn.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', handleKeyDown);
    modal.removeEventListener('click', handleOverlayClick);
  };

  const removeFocusTrap = setupDialogFocusTrap(modal, handleClose);
  closeBtn.focus();

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === modal) handleClose();
  };

  closeBtn.addEventListener('click', handleClose);
  document.addEventListener('keydown', handleKeyDown);
  modal.addEventListener('click', handleOverlayClick);
}

// Story 13.3: Manage Styles modal - preview applies style to the name text
function formatToCssPreview(f) {
  if (!f) return {};
  const font = f.font;
  const fill = f.fill;
  const alignment = f.alignment;
  const css = {};
  if (font?.name) css.fontFamily = font.name;
  if (font?.size) css.fontSize = `${font.size}pt`;
  if (font?.bold) css.fontWeight = 'bold';
  if (font?.italic) css.fontStyle = 'italic';
  if (font?.color) css.color = font.color;
  if (fill?.pattern === 'solid' && fill?.fgColor)
    css.backgroundColor = fill.fgColor;
  const border = f.border;
  if (border) {
    const sides = [
      ['left', 'Left'],
      ['right', 'Right'],
      ['top', 'Top'],
      ['bottom', 'Bottom'],
    ];
    for (const [side, cap] of sides) {
      const s = border[side];
      if (s?.style && s.style !== 'none')
        css[`border${cap}`] =
          `${s.style === 'thin' ? '2px' : s.style === 'medium' ? '3px' : '2px'} solid ${s.color || '#000000'}`;
    }
  }
  if (alignment?.horizontal) css.textAlign = alignment.horizontal;
  if (alignment?.vertical) css.verticalAlign = alignment.vertical;
  return css;
}

function formatFromForm() {
  const fontColorEl = document.getElementById('manage-styles-font-color');
  const fillColorEl = document.getElementById('manage-styles-fill-color');
  const sizeEl = document.getElementById('manage-styles-font-size');
  const fillEnabled = document.getElementById(
    'manage-styles-fill-enabled'
  )?.checked;
  const borderColor =
    document.getElementById('manage-styles-border-color')?.value || '#000000';
  const borderSide = (id) =>
    document.getElementById(id)?.checked ? 'thin' : 'none';
  return {
    font: {
      name:
        document.getElementById('manage-styles-font-name')?.value?.trim() ||
        'Helvetica',
      size: parseInt(sizeEl?.value || '12', 10) || 12,
      bold:
        document.getElementById('manage-styles-font-bold')?.checked || false,
      italic:
        document.getElementById('manage-styles-font-italic')?.checked || false,
      color: fontColorEl?.value || '#000000',
    },
    fill: {
      pattern: fillEnabled ? 'solid' : 'none',
      fgColor: fillColorEl?.value || '#E0E0E0',
      bgColor: fillColorEl?.value || '#E0E0E0',
    },
    border: {
      left: {
        style: borderSide('manage-styles-border-left'),
        color: borderColor,
      },
      right: {
        style: borderSide('manage-styles-border-right'),
        color: borderColor,
      },
      top: {
        style: borderSide('manage-styles-border-top'),
        color: borderColor,
      },
      bottom: {
        style: borderSide('manage-styles-border-bottom'),
        color: borderColor,
      },
    },
    alignment: {
      horizontal: document.getElementById('manage-styles-align-h')?.value || '',
      vertical:
        document.getElementById('manage-styles-align-v')?.value || 'center',
    },
  };
}

function populateFormFromFormat(style) {
  const f = style?.format || {};
  const fontColor = f.font?.color || '#000000';
  const fillColor = f.fill?.fgColor || f.fill?.bgColor || '#E0E0E0';
  const size = f.font?.size || 12;
  const el = (id) => document.getElementById(id);
  if (el('manage-styles-name'))
    el('manage-styles-name').value = style?.name || '';
  if (el('manage-styles-font-name'))
    el('manage-styles-font-name').value = f.font?.name || 'Helvetica';
  if (el('manage-styles-font-size')) {
    el('manage-styles-font-size').value = String(size);
    const out = el('manage-styles-font-size-value');
    if (out) out.textContent = String(size);
  }
  if (el('manage-styles-font-bold'))
    el('manage-styles-font-bold').checked = f.font?.bold || false;
  if (el('manage-styles-font-italic'))
    el('manage-styles-font-italic').checked = f.font?.italic || false;
  if (el('manage-styles-font-color'))
    el('manage-styles-font-color').value = fontColor;
  if (el('manage-styles-font-color-picker'))
    el('manage-styles-font-color-picker').value = fontColor;
  if (el('manage-styles-fill-enabled'))
    el('manage-styles-fill-enabled').checked = f.fill?.pattern === 'solid';
  if (el('manage-styles-fill-color'))
    el('manage-styles-fill-color').value = fillColor;
  if (el('manage-styles-fill-color-picker'))
    el('manage-styles-fill-color-picker').value = fillColor;
  const border = f.border;
  if (border) {
    if (el('manage-styles-border-left'))
      el('manage-styles-border-left').checked = border.left?.style === 'thin';
    if (el('manage-styles-border-right'))
      el('manage-styles-border-right').checked = border.right?.style === 'thin';
    if (el('manage-styles-border-top'))
      el('manage-styles-border-top').checked = border.top?.style === 'thin';
    if (el('manage-styles-border-bottom'))
      el('manage-styles-border-bottom').checked =
        border.bottom?.style === 'thin';
    const bc =
      border.left?.color ||
      border.right?.color ||
      border.top?.color ||
      border.bottom?.color ||
      '#000000';
    if (el('manage-styles-border-color'))
      el('manage-styles-border-color').value = bc;
    if (el('manage-styles-border-color-picker'))
      el('manage-styles-border-color-picker').value = bc;
  }
  if (el('manage-styles-align-h'))
    el('manage-styles-align-h').value = f.alignment?.horizontal || '';
  if (el('manage-styles-align-v'))
    el('manage-styles-align-v').value = f.alignment?.vertical || 'center';
}

async function showManageStylesModal() {
  const modal = document.getElementById('manage-styles-modal');
  const listEl = document.getElementById('manage-styles-list');
  const formEl = document.getElementById('manage-styles-form');
  const formTitle = document.getElementById('manage-styles-form-title');
  const addBtn = document.getElementById('manage-styles-add');
  const closeBtn = document.getElementById('manage-styles-close');
  const formCancel = document.getElementById('manage-styles-form-cancel');
  const formSave = document.getElementById('manage-styles-form-save');
  if (!modal || !listEl) return;

  let editingId = null;
  let editingStyle = null;
  let initialFormState = null;

  const getFormState = () => ({
    format: formatFromForm(),
    name: document.getElementById('manage-styles-name')?.value?.trim() || '',
  });

  // Story 13.3b: Sync color pickers with hex inputs and font size range with output (one-time setup)
  if (!modal.dataset.styleFormSetup) {
    const fontColorPicker = document.getElementById(
      'manage-styles-font-color-picker'
    );
    const fontColorHex = document.getElementById('manage-styles-font-color');
    const fillColorPicker = document.getElementById(
      'manage-styles-fill-color-picker'
    );
    const fillColorHex = document.getElementById('manage-styles-fill-color');
    const borderColorPicker = document.getElementById(
      'manage-styles-border-color-picker'
    );
    const borderColorHex = document.getElementById(
      'manage-styles-border-color'
    );
    const fontSizeRange = document.getElementById('manage-styles-font-size');
    const fontSizeOutput = document.getElementById(
      'manage-styles-font-size-value'
    );
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    if (fontColorPicker && fontColorHex) {
      fontColorPicker.addEventListener('input', () => {
        fontColorHex.value = fontColorPicker.value;
      });
      fontColorHex.addEventListener('input', () => {
        if (hexRe.test(fontColorHex.value))
          fontColorPicker.value = fontColorHex.value;
      });
    }
    if (fillColorPicker && fillColorHex) {
      fillColorPicker.addEventListener('input', () => {
        fillColorHex.value = fillColorPicker.value;
      });
      fillColorHex.addEventListener('input', () => {
        if (hexRe.test(fillColorHex.value))
          fillColorPicker.value = fillColorHex.value;
      });
    }
    if (borderColorPicker && borderColorHex) {
      borderColorPicker.addEventListener('input', () => {
        borderColorHex.value = borderColorPicker.value;
      });
      borderColorHex.addEventListener('input', () => {
        if (hexRe.test(borderColorHex.value))
          borderColorPicker.value = borderColorHex.value;
      });
    }
    if (fontSizeRange && fontSizeOutput) {
      fontSizeRange.addEventListener('input', () => {
        fontSizeOutput.textContent = fontSizeRange.value;
      });
    }
    modal.dataset.styleFormSetup = '1';
  }

  const renderList = async () => {
    try {
      const styles = await GetStyles();
      listEl.innerHTML = styles
        .map((s) => {
          const previewStyle = formatToCssPreview(s.format);
          const styleStr = Object.entries(previewStyle)
            .map(
              ([k, v]) =>
                `${k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase())}:${v}`
            )
            .join(';');
          return `
<div class="manage-styles-item" data-id="${s.id}">
  <div class="manage-styles-preview" style="${styleStr}">${s.name || 'Style ' + s.id}</div>
  <div class="manage-styles-actions">
    <button type="button" class="modal-btn modal-btn-secondary manage-styles-edit" data-id="${s.id}">Edit</button>
    <button type="button" class="modal-btn modal-btn-secondary manage-styles-delete" data-id="${s.id}">Delete</button>
  </div>
</div>`;
        })
        .join('');
      listEl.querySelectorAll('.manage-styles-edit').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.id, 10);
          const all = await GetStyles();
          const style = all.find((s) => s.id === id);
          if (style) {
            editingId = id;
            editingStyle = style;
            formTitle.textContent = 'Edit Style';
            document.getElementById('manage-styles-name').disabled = true;
            populateFormFromFormat(style);
            initialFormState = JSON.stringify(getFormState());
            formEl.style.display = 'block';
          }
        });
      });
      listEl.querySelectorAll('.manage-styles-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.id, 10);
          const all = await GetStyles();
          const style = all.find((s) => s.id === id);
          const name = style && style.name ? style.name : 'Style ' + id;
          const confirmed = await showConfirmDialog(
            `Delete style "${name}"? Cells using it will lose their formatting.`
          );
          if (!confirmed) return;
          try {
            await DeleteStyle(id);
            if (displayFileStatus) displayFileStatus(true);
            await renderList();
            await buildSpreadsheet();
            refreshAllCells();
            window.syncFormatMenuFromApi?.();
          } catch (err) {
            await showAlert('Error deleting style: ' + err.message);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML =
        '<p class="manage-styles-error">Error loading styles: ' +
        err.message +
        '</p>';
    }
  };

  const hideForm = () => {
    formEl.style.display = 'none';
    editingId = null;
    editingStyle = null;
    const nameEl = document.getElementById('manage-styles-name');
    if (nameEl) nameEl.disabled = false;
  };

  const handleAddClick = () => {
    editingId = null;
    editingStyle = null;
    formTitle.textContent = 'Add Style';
    const nameEl = document.getElementById('manage-styles-name');
    if (nameEl) nameEl.disabled = false;
    populateFormFromFormat({ name: '', format: {} });
    initialFormState = JSON.stringify(getFormState());
    formEl.style.display = 'block';
    requestAnimationFrame(() => nameEl?.focus());
  };

  const onAddClick = (e) => {
    e?.stopImmediatePropagation?.();
    handleAddClick();
  };
  const onFormCancel = (e) => {
    e?.stopImmediatePropagation?.();
    hideForm();
  };
  const onFormSave = async (e) => {
    e?.stopImmediatePropagation?.();
    const nameEl = document.getElementById('manage-styles-name');
    const name = nameEl?.value?.trim();
    const format = formatFromForm();
    const isEditMode = nameEl?.disabled === true;
    if (!name && !isEditMode) {
      await showAlert('Please enter a style name.');
      return;
    }
    try {
      if (isEditMode && editingStyle?.id) {
        if (window.__DEBUG__)
          console.log(
            '[ManageStyles] UpdateStyle id=',
            editingStyle.id,
            '(edit mode, name disabled)'
          );
        await UpdateStyle(editingStyle.id, format, '');
      } else if (editingId) {
        const nameToSend = '';
        if (window.__DEBUG__)
          console.log(
            '[ManageStyles] UpdateStyle id=',
            editingId,
            'name=',
            JSON.stringify(nameToSend)
          );
        await UpdateStyle(editingId, format, nameToSend);
      } else {
        const existing = await GetStyles();
        if (
          existing.some(
            (s) => (s.name || '').toLowerCase() === (name || '').toLowerCase()
          )
        ) {
          await showAlert(
            `A style named "${name}" already exists. Use Edit to modify it instead.`
          );
          return;
        }
        if (window.__DEBUG__)
          console.log('[ManageStyles] AddStyle name=', JSON.stringify(name));
        await AddStyle(name, format);
      }
      if (displayFileStatus) displayFileStatus(true);
      hideForm();
      await renderList();
      await buildSpreadsheet();
      refreshAllCells();
      window.syncFormatMenuFromApi?.();
    } catch (err) {
      await showAlert('Error saving style: ' + err.message);
    }
  };

  addBtn?.addEventListener('click', onAddClick);
  formCancel?.addEventListener('click', onFormCancel);
  formSave?.addEventListener('click', onFormSave);

  const handleClose = async () => {
    const formVisible = formEl.style.display !== 'none';
    if (formVisible && initialFormState !== null) {
      const hasChanges = JSON.stringify(getFormState()) !== initialFormState;
      if (hasChanges) {
        const confirmed = await showConfirmDialog(
          'You have unsaved changes to the style. Close anyway?'
        );
        if (!confirmed) return;
      }
    }
    modal.classList.remove('active');
    removeFocusTrap?.();
    closeBtn.removeEventListener('click', handleClose);
    modal.removeEventListener('click', handleOverlayClick);
    addBtn?.removeEventListener('click', onAddClick);
    formCancel?.removeEventListener('click', onFormCancel);
    formSave?.removeEventListener('click', onFormSave);
    buildSpreadsheet().then(() => refreshAllCells());
    window.syncFormatMenuFromApi?.();
  };

  const removeFocusTrap = setupDialogFocusTrap(modal, handleClose);
  const handleOverlayClick = (e) => {
    if (e.target === modal) handleClose();
  };

  modal.classList.add('active');
  formEl.style.display = 'none';
  await renderList();
  closeBtn.addEventListener('click', handleClose);
  modal.addEventListener('click', handleOverlayClick);
}

async function showUserGuideModal() {
  const modal = document.getElementById('user-guide-modal');
  const contentEl = document.getElementById('user-guide-content');
  const closeBtn = document.getElementById('user-guide-close');
  if (!modal || !contentEl || !closeBtn) return;

  contentEl.innerHTML = '<p>Loading...</p>';
  modal.classList.add('active');

  let handleAnchorClick = null;
  const handleClose = () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    closeBtn.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', handleKeyDown);
    modal.removeEventListener('click', handleOverlayClick);
    if (handleAnchorClick)
      contentEl.removeEventListener('click', handleAnchorClick);
  };

  const removeFocusTrap = setupDialogFocusTrap(modal, handleClose);
  closeBtn.focus();

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === modal) handleClose();
  };

  closeBtn.addEventListener('click', handleClose);
  document.addEventListener('keydown', handleKeyDown);
  modal.addEventListener('click', handleOverlayClick);

  try {
    const html = window.electronAPI?.getUserGuideContent
      ? await window.electronAPI.getUserGuideContent()
      : null;
    contentEl.innerHTML = html || '<p>User guide not available.</p>';

    // Handle internal anchor links (TOC) - scroll to section within modal
    handleAnchorClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = contentEl.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    contentEl.addEventListener('click', handleAnchorClick);
  } catch (err) {
    console.error('[App] Failed to load User Guide:', err);
    contentEl.innerHTML = '<p>Failed to load user guide.</p>';
  }
}

// Story 7.12: Extract CSV export logic into function (CSV buttons removed from toolbar)
async function handleExportCSV(testPath = '') {
  if (window.__DEBUG__)
    console.log('[handleExportCSV] Starting export, testPath:', testPath);
  try {
    if (window.__DEBUG__) console.log('[handleExportCSV] Calling ExportCSV...');
    const result = await ExportCSV(testPath);
    if (window.__DEBUG__)
      console.log('[handleExportCSV] ExportCSV returned:', result);

    if (!result) {
      if (window.__DEBUG__)
        console.log('[handleExportCSV] User cancelled file dialog');
      return;
    }

    if (window.__DEBUG__)
      console.log('[handleExportCSV] Showing success alert...');
    await showAlert(`Exported to ${result.path}`);
    if (window.__DEBUG__)
      console.log('[handleExportCSV] Export complete:', result.message);
  } catch (error) {
    console.error('[handleExportCSV] Error caught:', error);
    await showAlert('Error exporting CSV: ' + error.message);
  }
}

// Expose for testing
window.handleExportCSV = handleExportCSV;
window.showAlert = showAlert;
window.ExportCSV = ExportCSV;
window.showManageStylesModal = showManageStylesModal;

// Update file status display
/**
 * Update file status display from a boolean flag
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
function displayFileStatus(hasUnsavedChanges) {
  const statusEl = document.getElementById('file-status');
  if (hasUnsavedChanges) {
    statusEl.textContent = '● Unsaved changes';
    statusEl.style.color = 'var(--color-warning)'; // Amber
    announceToScreenReader('Unsaved changes');
  } else {
    statusEl.textContent = '✓ Saved';
    statusEl.style.color = 'var(--color-success)'; // Green
    announceToScreenReader('File saved');
  }

  // Keep toolbar Save button in sync with menu (both disabled when nothing to save)
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = !hasUnsavedChanges;

  // Story 7.11: Expose unsaved changes status to Electron main process
  // This allows the quit warning dialog to check for unsaved changes
  window.currentHasUnsavedChanges = hasUnsavedChanges;

  // Story 7.1: Update menu state immediately when status changes
  // This ensures menu responds to cell edits without waiting for updateFileStatus() poll
  if (window.electronAPI && window.electronAPI.updateMenuState) {
    window.electronAPI.updateMenuState({
      hasUnsavedChanges: hasUnsavedChanges,
      hasFilePath: false, // Will be updated by updateFileStatus() with full info
    });
  }
}

/**
 * Fetch and update file status from server
 */
async function updateFileStatus() {
  try {
    const status = await GetFileStatus();
    displayFileStatus(status.hasUnsavedChanges);

    // Update window title with filename
    document.title = `GoSheet - ${status.filename || 'Untitled'}`;

    // Story 7.1: Update menu state in Electron
    if (window.electronAPI && window.electronAPI.updateMenuState) {
      window.electronAPI.updateMenuState({
        hasUnsavedChanges: status.hasUnsavedChanges,
        hasFilePath: status.path !== '',
      });
    }
  } catch (error) {
    console.error('Error updating file status:', error);
  }
}

// Story 15.2: Update undo/redo state in menu and toolbar from a pre-fetched result.
function applyUndoRedoState(state) {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = !state.canUndo;
  if (redoBtn) redoBtn.disabled = !state.canRedo;
  if (window.electronAPI?.updateMenuState) {
    window.electronAPI.updateMenuState({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undoDescription: state.undoDescription,
      redoDescription: state.redoDescription,
    });
  }
}

// Story 15.2: Perform undo — call API, refresh grid and all state.
async function performUndo() {
  try {
    const result = await Undo();
    await refreshAllCells();
    displayFileStatus(result.hasUnsavedChanges);
    applyUndoRedoState(result);
  } catch (error) {
    console.error('[App] Error during Undo:', error);
  }
}

// Story 15.2: Perform redo — call API, refresh grid and all state.
async function performRedo() {
  try {
    const result = await Redo();
    await refreshAllCells();
    displayFileStatus(result.hasUnsavedChanges);
    applyUndoRedoState(result);
  } catch (error) {
    console.error('[App] Error during Redo:', error);
  }
}

// Story 7.1: Setup menu event listeners for Electron
if (window.electronAPI) {
  if (window.__DEBUG__)
    console.log('[App] Setting up Electron menu event listeners');

  // New file from menu (Story 8.2: show spreadsheet first when on welcome screen)
  window.electronAPI.onMenuNew(async () => {
    if (window.__DEBUG__) console.log('[App] Menu New triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      showSpreadsheet();
    document.getElementById('new-btn').click();
  });

  // Open file from menu
  window.electronAPI.onMenuOpen(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Open triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      showSpreadsheet();
    document.getElementById('load-btn').click();
  });

  // Save file from menu
  window.electronAPI.onMenuSave(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Save triggered');
    document.getElementById('save-btn').click();
  });

  // Save As from menu - always show dialog even if file has path
  window.electronAPI.onMenuSaveAs(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Save As triggered');
    try {
      // Call SaveFile with empty string to force dialog
      const path = await SaveFile('');

      // Story 7.5: Add to recent files after successful save
      if (path && window.electronAPI && window.electronAPI.addRecentFile) {
        await window.electronAPI.addRecentFile(path);
      }

      updateFileStatus();
      if (window.__DEBUG__) console.log('File saved via Save As');
    } catch (error) {
      await showAlert('Error saving file: ' + error.message);
    }
  });

  // Import CSV from menu
  // Story 7.12: CSV buttons removed from toolbar, call functions directly
  window.electronAPI.onMenuImportCSV(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Import CSV triggered');
    await handleImportCSV();
  });

  // Export CSV from menu
  window.electronAPI.onMenuExportCSV(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Export CSV triggered');
    await handleExportCSV();
  });

  // Story 7.5: Open recent file from menu (Story 8.2: uses loadFileByPath)
  window.electronAPI.onMenuOpenRecent(async (event, filePath) => {
    if (window.__DEBUG__)
      console.log('[App] Menu Open Recent triggered:', filePath);
    await loadFileByPath(filePath);
  });

  // Story 9.6: Formula Reference from Help menu
  if (window.electronAPI.onMenuFormulaReference) {
    window.electronAPI.onMenuFormulaReference(() => {
      if (window.__DEBUG__)
        console.log('[App] Menu Formula Reference triggered');
      showFormulaHelpModal();
    });
  }

  // User Guide from Help menu (in-app markdown viewer)
  if (window.electronAPI.onMenuUserGuide) {
    window.electronAPI.onMenuUserGuide(() => {
      if (window.__DEBUG__) console.log('[App] Menu User Guide triggered');
      showUserGuideModal();
    });
  }

  // Story 15.2: Undo/Redo from Edit menu
  if (window.electronAPI.onMenuUndo) {
    window.electronAPI.onMenuUndo(async () => {
      if (window.__DEBUG__) console.log('[App] Menu Undo triggered');
      await performUndo();
    });
  }
  if (window.electronAPI.onMenuRedo) {
    window.electronAPI.onMenuRedo(async () => {
      if (window.__DEBUG__) console.log('[App] Menu Redo triggered');
      await performRedo();
    });
  }

  // Story 7.2: Edit menu handlers

  // Cut: Copy cell value to clipboard and clear cell
  window.electronAPI.onMenuCut(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Cut triggered');
    if (!selectedCell) {
      if (window.__DEBUG__) console.log('[App] No cell selected for Cut');
      return;
    }

    try {
      const { row, col } = selectedCell;
      // Get raw value (formula, not computed)
      const value = await GetCellRawValue(row, col);

      // Copy to clipboard
      await navigator.clipboard.writeText(value);
      if (window.__DEBUG__)
        console.log('[App] Cut: Copied to clipboard:', value);

      // Clear the cell
      await SetCellValue(row, col, '');
      await refreshAllCells();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Cut:', error);
      await showAlert('Error during Cut operation: ' + error.message);
    }
  });

  // Copy: Copy cell value to clipboard
  window.electronAPI.onMenuCopy(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Copy triggered');
    if (!selectedCell) {
      if (window.__DEBUG__) console.log('[App] No cell selected for Copy');
      return;
    }

    try {
      const { row, col } = selectedCell;
      // Get raw value (formula, not computed)
      const value = await GetCellRawValue(row, col);

      // Copy to clipboard
      await navigator.clipboard.writeText(value);
      if (window.__DEBUG__)
        console.log('[App] Copy: Copied to clipboard:', value);
    } catch (error) {
      console.error('[App] Error during Copy:', error);
      await showAlert('Error during Copy operation: ' + error.message);
    }
  });

  // Paste: Paste clipboard content into selected cell
  window.electronAPI.onMenuPaste(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Paste triggered');
    if (!selectedCell) {
      if (window.__DEBUG__) console.log('[App] No cell selected for Paste');
      return;
    }

    try {
      const { row, col } = selectedCell;

      // Read from clipboard
      const text = await navigator.clipboard.readText();
      if (window.__DEBUG__)
        console.log('[App] Paste: Read from clipboard:', text);

      // Set cell value
      await SetCellValue(row, col, text);
      await refreshAllCells();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Paste:', error);
      await showAlert('Error during Paste operation: ' + error.message);
    }
  });

  // Story 11.5: Merge Cells - merge selected range
  window.electronAPI.onMenuMergeCells?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Merge Cells triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    const { startRow, startCol, endRow, endCol } = selectionRange;
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
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await buildSpreadsheet();
      await refreshAllCells();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Merge:', error);
      await showAlert('Error merging cells: ' + error.message);
    }
  });

  // Story 11.5: Unmerge - unmerge selected merged cell
  window.electronAPI.onMenuUnmergeCells?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Unmerge triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    const { startRow, startCol, endRow, endCol } = selectionRange;
    if (startRow !== endRow || startCol !== endCol) {
      await showAlert('Select a single merged cell to unmerge.');
      return;
    }
    const { merge, isAnchor } = getMergeInfo(startRow, startCol, currentMerges);
    if (!merge || !isAnchor) {
      await showAlert('Selected cell is not merged.');
      return;
    }
    try {
      const result = await Unmerge(startRow, startCol);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await buildSpreadsheet();
      await refreshAllCells();
      updateFileStatus();
    } catch (error) {
      console.error('[App] Error during Unmerge:', error);
      await showAlert('Error unmerging cells: ' + error.message);
    }
  });

  // Story 12.2: Apply style (Title=1, Header=2, Total=3) to selection
  // Story 13.3: Format menu and context menu include custom styles
  const applyStyleToSelection = async (styleId) => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    const { startRow, startCol, endRow, endCol } = selectionRange;
    try {
      const result = await ApplyRangeStyle(
        startRow,
        startCol,
        endRow,
        endCol,
        styleId
      );
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await refreshAllCells();
      updateFileStatus();
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
  window.electronAPI.onMenuApplyStyle?.(applyStyleToSelection);
  // Legacy: keep Title/Header/Total for backwards compatibility (Format menu now uses menu-apply-style)
  window.electronAPI.onMenuStyleTitle?.(() =>
    applyStyleToSelection(STYLE_ID.TITLE)
  );
  window.electronAPI.onMenuStyleHeader?.(() =>
    applyStyleToSelection(STYLE_ID.HEADER)
  );
  window.electronAPI.onMenuStyleTotal?.(() =>
    applyStyleToSelection(STYLE_ID.TOTAL)
  );

  // Sync Format menu with styles from API (Story 13.3 - custom styles in Format menu)
  window.syncFormatMenuFromApi = async function syncFormatMenuFromApi() {
    if (
      document.querySelector('#app')?.getAttribute('data-view') !==
      'spreadsheet'
    )
      return;
    try {
      const styles = await GetStyles();
      window.electronAPI?.syncFormatMenu?.(styles);
    } catch (err) {
      console.error('[App] Failed to sync Format menu:', err);
    }
  };

  // Story 12.3: Format Cleanup - remove style from empty cells
  window.electronAPI.onMenuFormatCleanup?.(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Format Cleanup triggered');
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    try {
      const result = await CleanupFormat();
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await buildSpreadsheet();
      await refreshAllCells();
    } catch (error) {
      console.error('[App] Error during Format Cleanup:', error);
      await showAlert('Error during Format Cleanup: ' + error.message);
    }
  });

  // Story 13.3: Manage Styles
  window.electronAPI.onMenuManageStyles?.(() => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    showManageStylesModal();
  });

  // Story 13.1: Insert row above
  window.electronAPI.onMenuInsertRow?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (selectionMode !== 'row') return;
    const row = selectionRange.startRow;
    try {
      const result = await InsertRow(row);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await buildSpreadsheet();
      await refreshAllCells();
      applySelectionRange(row, 0, row, COLS - 1);
    } catch (error) {
      console.error('[App] Error inserting row:', error);
      await showAlert('Error inserting row: ' + error.message);
    }
  });

  // Story 13.1: Insert column before
  window.electronAPI.onMenuInsertColumn?.(async () => {
    if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome')
      return;
    if (selectionMode !== 'column') return;
    const col = selectionRange.startCol;
    try {
      const result = await InsertColumn(col);
      if (result.hasUnsavedChanges !== undefined)
        displayFileStatus(result.hasUnsavedChanges);
      await buildSpreadsheet();
      await refreshAllCells();
      applySelectionRange(0, col, ROWS - 1, col);
    } catch (error) {
      console.error('[App] Error inserting column:', error);
      await showAlert('Error inserting column: ' + error.message);
    }
  });

  // Select All: If formula bar/input has focus, select its text; else select all cells
  window.electronAPI.onMenuSelectAll(async () => {
    if (window.__DEBUG__) console.log('[App] Menu Select All triggered');

    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      // Native text selection in input - don't intercept
      active.select();
      return;
    }

    try {
      // Get all cells from the server
      const response = await fetch('/api/cells/all');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.cells && Object.keys(result.cells).length > 0) {
        // Find the range of non-empty cells
        let minRow = Infinity,
          maxRow = -Infinity;
        let minCol = Infinity,
          maxCol = -Infinity;

        for (const cellRef in result.cells) {
          const match = cellRef.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            const col = letterToCol(match[1]);
            const row = parseInt(match[2]) - 1;

            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col);
            maxCol = Math.max(maxCol, col);
          }
        }

        // For now, just select the first cell of the range
        // (Full range selection would require extending the selection model)
        if (minRow !== Infinity) {
          selectCell(minRow, minCol);
          if (window.__DEBUG__)
            console.log(
              `[App] Select All: Selected range from (${minRow},${minCol}) to (${maxRow},${maxCol})`
            );
          await showAlert(
            `Selected range: ${colToLetter(minCol)}${minRow + 1} to ${colToLetter(maxCol)}${maxRow + 1}\n(Note: Full range selection coming in future update)`
          );
        }
      } else {
        if (window.__DEBUG__)
          console.log('[App] Select All: No non-empty cells found');
        await showAlert('No cells to select');
      }
    } catch (error) {
      console.error('[App] Error during Select All:', error);
      await showAlert('Error during Select All operation: ' + error.message);
    }
  });

  // View menu: RTL Mode checkbox
  window.electronAPI.onMenuToggleRTL?.((event, checked) => {
    setRTL(checked);
  });

  // View menu: Alignment shortcuts
  window.electronAPI.onMenuAlignLeft?.(() => applyAlignmentToSelection('left'));
  window.electronAPI.onMenuAlignCenter?.(() =>
    applyAlignmentToSelection('center')
  );
  window.electronAPI.onMenuAlignRight?.(() =>
    applyAlignmentToSelection('right')
  );

  if (window.__DEBUG__)
    console.log('[App] Electron menu event listeners registered (File + Edit)');
}

// Story 7.10: Dark mode support
// Listen for theme changes from Electron main process
if (window.electronAPI && window.electronAPI.onThemeChanged) {
  window.electronAPI.onThemeChanged((theme) => {
    if (window.__DEBUG__) console.log('[App] Theme changed to:', theme);
    document.documentElement.setAttribute('data-theme', theme);
  });
  if (window.__DEBUG__) console.log('[App] Theme change listener registered');
}

// Fallback: Detect system preference directly (for web mode or if Electron API not available)
if (window.matchMedia) {
  // Initial detection
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (window.__DEBUG__)
      console.log('[App] Initial theme: dark (from media query)');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (window.__DEBUG__)
      console.log('[App] Initial theme: light (from media query)');
  }

  // Listen for changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      const theme = e.matches ? 'dark' : 'light';
      if (window.__DEBUG__)
        console.log('[App] System theme changed to:', theme);
      document.documentElement.setAttribute('data-theme', theme);
    });
}

// Update file status on load
updateFileStatus();

// Load persisted RTL setting and apply
(async () => {
  const settings = await GetSettings();
  if (settings.rtl) {
    isRTL = true;
    document.documentElement.setAttribute('dir', 'rtl');
    window.electronAPI?.updateMenuState?.({ isRTL: true });
  }
})();

if (window.__DEBUG__) console.log('GoSheet initialized');
