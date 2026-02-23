// GoSheet Frontend - ES6 Module
// API functions imported from api-client.js (mode-aware: web fetch or Wails IPC)

import { GetCellValue, GetCellRawValue, SetCellValue, GetCellRef, GetAllCells, GetFileStatus, NewFile, SaveFile, LoadFile, PreviewCSV, ImportCSV, ExportCSV } from './api-client.js';

// Spreadsheet configuration
// Backend supports up to 2^31 rows/columns (Go int on 64-bit systems)
// Frontend uses infinite scrolling - expands as you navigate
let ROWS = 100;  // Current rendered rows (expands automatically)
let COLS = 26;   // Current rendered columns (expands automatically)

const EXPAND_THRESHOLD = 10; // Expand when within 10 rows/cols of edge
const EXPAND_ROWS = 50;      // Add 50 rows when expanding
const EXPAND_COLS = 10;      // Add 10 columns when expanding

let selectedCell = null;
let isEditing = false;

// Story 7.11: Track unsaved changes for quit warning dialog
// Exposed to window so Electron main process can check it via executeJavaScript()
window.currentHasUnsavedChanges = false;

// Custom modal dialog (replaces native confirm/alert for Cursor browser compatibility)
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const messageEl = document.getElementById('modal-message');
        const okBtn = document.getElementById('modal-ok');
        const cancelBtn = document.getElementById('modal-cancel');
        
        // Set message
        messageEl.textContent = message;
        
        // Show modal
        overlay.classList.add('active');
        
        // Handle OK
        const handleOk = () => {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeyDown);
            resolve(true);
        };
        
        // Handle Cancel
        const handleCancel = () => {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeyDown);
            resolve(false);
        };
        
        // Handle ESC key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
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
            resolve();
        };
        
        // Handle ESC key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleOk();
            }
        };
        
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
    console.log('Force cleanup editing state');
    isEditing = false;
    
    // Remove any leftover input elements
    document.querySelectorAll('.cell-editor').forEach(input => {
        console.log('Removing leftover input element');
        input.remove();
    });
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
    <div class="toolbar">
        <button id="new-btn" class="toolbar-btn" title="Create a new spreadsheet (⌘N)" aria-label="New Spreadsheet">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
        </button>
        <button id="save-btn" class="toolbar-btn" title="Save current spreadsheet (⌘S)" aria-label="Save Spreadsheet">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
        </button>
        <button id="load-btn" class="toolbar-btn" title="Load an existing spreadsheet (⌘O)" aria-label="Load Spreadsheet">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
            </svg>
        </button>
        <input type="file" id="file-input" accept=".gosheet" style="display: none;" />
        <span id="file-status" class="file-status"></span>
    </div>
    <div class="formula-bar-container">
        <span class="cell-ref" id="cell-ref" title="Current cell reference">A1</span>
        <input type="text" class="formula-bar" id="formula-bar" placeholder="Enter value or formula..." title="Enter cell value or formula (start with = for formulas)" />
    </div>
    <div class="spreadsheet-container" id="container">
        <table class="spreadsheet" id="spreadsheet">
            <!-- Will be populated by JavaScript -->
        </table>
    </div>
    <div class="modal-overlay" id="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-message" id="modal-message"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
                <button class="modal-btn modal-btn-primary" id="modal-ok">OK</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="csv-preview-modal">
        <div class="modal-dialog modal-dialog-large">
            <div class="modal-header">
                <h2>Import CSV Preview</h2>
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
    <div class="modal-overlay" id="formula-help-modal">
        <div class="modal-dialog modal-dialog-large modal-dialog-scrollable">
            <div class="modal-header">
                <h2>Formula Reference</h2>
            </div>
            <div class="modal-body formula-help-content" id="formula-help-content"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-primary" id="formula-help-close">Close</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="user-guide-modal">
        <div class="modal-dialog modal-dialog-large modal-dialog-scrollable">
            <div class="modal-header">
                <h2>User Guide</h2>
            </div>
            <div class="modal-body user-guide-content" id="user-guide-content"></div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-primary" id="user-guide-close">Close</button>
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
        const paths = window.electronAPI?.getRecentFiles ? await window.electronAPI.getRecentFiles() : [];
        if (!paths || paths.length === 0) {
            listEl.innerHTML = '<li class="welcome-recent-empty">No recent files</li>';
            return;
        }
        listEl.innerHTML = paths.map(filePath => {
            const parts = filePath.split('/');
            const filename = parts.pop() || filePath;
            const parentDir = parts.length ? parts.slice(-1)[0] : '';
            const display = parentDir ? `${filename} — ${parentDir}` : filename;
            return `<li class="welcome-recent-item" data-path="${filePath.replace(/"/g, '&quot;')}">${display}</li>`;
        }).join('');
        listEl.querySelectorAll('.welcome-recent-item').forEach(li => {
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
        const confirmed = await showConfirmDialog('You have unsaved changes! Open a different file anyway? All unsaved changes will be lost.');
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
        buildSpreadsheet();
        await loadCells();
        selectCell(0, 0);
        updateFileStatus();
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

    document.getElementById('welcome-btn-new')?.addEventListener('click', async () => {
        showSpreadsheet();
        document.getElementById('new-btn').click();
    });
    document.getElementById('welcome-btn-open')?.addEventListener('click', async () => {
        showSpreadsheet();
        document.getElementById('load-btn').click();
    });
    document.getElementById('welcome-btn-import')?.addEventListener('click', async () => {
        showSpreadsheet();
        await handleImportCSV();
    });
}

// Story 8.2: Determine initial view (welcome vs spreadsheet) and wire welcome buttons
setupWelcomeScreen();

// Add scroll listener for infinite scrolling
const container = document.querySelector('.spreadsheet-container');
let scrollTimeout;

container.addEventListener('scroll', () => {
    // Debounce scroll events
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        checkScrollPosition();
    }, 100);
});

// Check if we need to expand the grid based on scroll position
function checkScrollPosition() {
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
        console.log(`Scroll: Expanding columns from ${COLS} to ${newCols}`);
        COLS = newCols;
        needsRebuild = true;
    }
    
    // Check if scrolled near bottom edge (within 20% of total height)
    if (scrollTop + containerHeight > tableHeight * 0.8) {
        const newRows = ROWS + EXPAND_ROWS;
        console.log(`Scroll: Expanding rows from ${ROWS} to ${newRows}`);
        ROWS = newRows;
        needsRebuild = true;
    }
    
    if (needsRebuild) {
        const oldScrollLeft = scrollLeft;
        const oldScrollTop = scrollTop;
        
        buildSpreadsheet();
        refreshAllCells();
        
        // Restore scroll position
        setTimeout(() => {
            container.scrollLeft = oldScrollLeft;
            container.scrollTop = oldScrollTop;
        }, 0);
    }
}

// Build the spreadsheet table
function buildSpreadsheet() {
    const table = document.getElementById('spreadsheet');
    table.innerHTML = '';
    
    // Header row
    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.className = 'corner-header';
    headerRow.appendChild(cornerCell);
    
    for (let col = 0; col < COLS; col++) {
        const th = document.createElement('th');
        th.className = 'column-header';
        th.textContent = colToLetter(col);
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);
    
    // Data rows
    for (let row = 0; row < ROWS; row++) {
        const tr = document.createElement('tr');
        
        // Row header
        const th = document.createElement('th');
        th.className = 'row-header';
        th.textContent = row + 1;
        tr.appendChild(th);
        
        // Data cells
        for (let col = 0; col < COLS; col++) {
            const td = document.createElement('td');
            td.className = 'cell';
            td.id = `cell-${row}-${col}`;
            td.dataset.row = row;
            td.dataset.col = col;
            
            // Click to select/edit
            td.addEventListener('click', (e) => {
                // Don't select if clicking on the input editor
                if (e.target.classList.contains('cell-editor')) {
                    return;
                }
                selectCell(row, col);
            });
            td.addEventListener('dblclick', () => startEditing(row, col));
            
            tr.appendChild(td);
        }
        
        table.appendChild(tr);
    }
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

// Select a cell
function selectCell(row, col) {
    // If we're currently editing, SAVE the current edit first
    if (isEditing) {
        console.log('Selecting new cell while editing - saving current edit first');
        
        // Find the input element and save its value
        const input = document.querySelector('.cell-editor');
        if (input) {
            const editingCell = input.parentElement;
            const editRow = parseInt(editingCell.dataset.row);
            const editCol = parseInt(editingCell.dataset.col);
            const value = input.value;
            
            console.log(`Saving edit: row=${editRow}, col=${editCol}, value="${value}"`);
            
            // Remove input and reset state
            input.remove();
            isEditing = false;
            
            // Save the value (don't wait for it)
            SetCellValue(editRow, editCol, value).then((result) => {
                // Update file status from the response
                if (result.hasUnsavedChanges !== undefined) {
                    displayFileStatus(result.hasUnsavedChanges);
                }
                return refreshAllCells();
            }).catch(err => {
                console.error('Error saving on cell switch:', err);
            });
        } else {
            // No input found, just reset state
            forceCleanupEditing();
        }
    }
    
    // Check if we need to expand the grid
    let needsRebuild = false;
    
    // Expand rows if near bottom edge
    if (row >= ROWS - EXPAND_THRESHOLD) {
        const newRows = Math.max(row + EXPAND_ROWS, ROWS + EXPAND_ROWS);
        console.log(`Expanding rows from ${ROWS} to ${newRows}`);
        ROWS = newRows;
        needsRebuild = true;
    }
    
    // Expand columns if near right edge
    if (col >= COLS - EXPAND_THRESHOLD) {
        const newCols = Math.max(col + EXPAND_COLS, COLS + EXPAND_COLS);
        console.log(`Expanding columns from ${COLS} to ${newCols}`);
        COLS = newCols;
        needsRebuild = true;
    }
    
    // Rebuild grid if expanded
    if (needsRebuild) {
        buildSpreadsheet();
        refreshAllCells();
    }
    
    // Remove previous selection
    document.querySelectorAll('.cell.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Highlight selected cell
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (cell) {
        cell.classList.add('selected');
        selectedCell = { row, col };
        
        // Update formula bar
        updateFormulaBar(row, col);
    }
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
    
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;
    
    // Clean up any leftover input elements
    const existingInput = cell.querySelector('.cell-editor');
    if (existingInput) {
        existingInput.remove();
    }
    
    isEditing = true;
    
    // Make sure this cell is selected (but don't call selectCell which would trigger cleanup)
    document.querySelectorAll('.cell.selected').forEach(el => {
        el.classList.remove('selected');
    });
    cell.classList.add('selected');
    selectedCell = { row, col };
    
    // Get raw value (formula, not computed)
    GetCellRawValue(row, col).then(rawValue => {
        // Double-check we're still supposed to be editing
        if (!isEditing) {
            console.warn('Editing was cancelled while fetching value');
            return;
        }
        
        console.log(`Editing cell (${row},${col}): rawValue="${rawValue}", isFormula=${cell.classList.contains('formula-cell')}`);
        
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
        input.select();
        
        // Set up event handlers
        setupEditorHandlers(input, row, col, cell, originalContent);
    }).catch(err => {
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
            // Move to next cell
            const nextCol = e.shiftKey ? col - 1 : col + 1;
            if (nextCol >= 0 && nextCol < COLS) {
                setTimeout(() => startEditing(row, nextCol), 100);
            }
        }
    });
    
    // Handle blur - save when clicking outside
    input.addEventListener('blur', (e) => {
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
    
    console.log(`Finishing edit: row=${row}, col=${col}, value="${value}"`);
    
    // Remove the input element first
    const input = cell.querySelector('.cell-editor');
    if (input) {
        input.remove();
    }
    
    // CRITICAL: Reset isEditing AFTER removing input but BEFORE async operations
    isEditing = false;
    isSaving = true;
    console.log(`isEditing set to false, isSaving set to true`);
    
    SetCellValue(row, col, value).then((result) => {
        console.log(`SetCellValue completed for row=${row}, col=${col}`);
        // Update file status from the response
        if (result.hasUnsavedChanges !== undefined) {
            displayFileStatus(result.hasUnsavedChanges);
        }
        // Refresh ALL cells to pick up dependent formula changes
        return refreshAllCells();
    }).then(() => {
        console.log(`All cells refreshed after edit at row=${row}, col=${col}`);
        isSaving = false;
        
        // Update formula bar to show the new value
        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
            updateFormulaBar(row, col);
        }
    }).catch(err => {
        console.error('Error setting cell value:', err);
        cell.textContent = '#ERROR';
        cell.classList.add('error-cell');
        // Make sure we're not stuck in editing state even on error
        isEditing = false;
        isSaving = false;
    });
}

// Refresh all cells from the backend
async function refreshAllCells() {
    try {
        const cells = await GetAllCells();
        
        // Clear all cells first
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.textContent = '';
                    cell.classList.remove('formula-cell', 'error-cell');
                }
            }
        }
        
        // Update cells with new values
        for (const [ref, value] of Object.entries(cells)) {
            const match = ref.match(/([A-Z]+)(\d+)/);
            if (match) {
                const col = letterToCol(match[1]);
                const row = parseInt(match[2]) - 1;
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.textContent = value;
                    
                    // Check if it's an error cell
                    if (value && value.startsWith('#ERROR')) {
                        cell.classList.add('error-cell');
                    } else {
                        cell.classList.remove('error-cell');
                    }
                    
                    // Check if it's a formula cell
                    const rawValue = await GetCellRawValue(row, col);
                    if (rawValue && rawValue.startsWith('=')) {
                        cell.classList.add('formula-cell');
                    } else {
                        cell.classList.remove('formula-cell');
                    }
                    
                    // Add number-cell class for right alignment
                    if (value && !isNaN(value) && value.trim() !== '') {
                        cell.classList.add('number-cell');
                    } else {
                        cell.classList.remove('number-cell');
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error refreshing cells:', err);
    }
}

// Cancel editing
function cancelEditing(cell, originalContent) {
    console.log('Cancelling edit');
    
    // Remove the input element
    const input = cell.querySelector('.cell-editor');
    if (input) {
        input.remove();
    }
    
    // Reset state immediately
    isEditing = false;
    console.log('isEditing set to false (cancelled)');
    
    cell.textContent = originalContent;
}

// Load all cells from backend
async function loadCells() {
    try {
        const cells = await GetAllCells();
        
        for (const [ref, value] of Object.entries(cells)) {
            const match = ref.match(/([A-Z]+)(\d+)/);
            if (match) {
                const col = letterToCol(match[1]);
                const row = parseInt(match[2]) - 1;
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.textContent = value;
                    
                    // Check if it's an error cell
                    if (value && value.startsWith('#ERROR')) {
                        cell.classList.add('error-cell');
                    } else {
                        cell.classList.remove('error-cell');
                    }
                    
                    // Check if it's a formula cell
                    const rawValue = await GetCellRawValue(row, col);
                    if (rawValue && rawValue.startsWith('=')) {
                        cell.classList.add('formula-cell');
                    } else {
                        cell.classList.remove('formula-cell');
                    }
                    
                    // Add number-cell class for right alignment
                    if (value && !isNaN(value) && value.trim() !== '') {
                        cell.classList.add('number-cell');
                    } else {
                        cell.classList.remove('number-cell');
                    }
                }
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

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't handle if we're editing or if focus is on an input
    if (isEditing) {
        console.log('Global handler: isEditing=true, ignoring');
        return;
    }
    if (e.target.tagName === 'INPUT') {
        console.log('Global handler: target is INPUT, ignoring');
        return;
    }

    // Cmd/Ctrl + O, S, N - File operations (macOS: Cmd, Windows/Linux: Ctrl)
    if (e.metaKey || e.ctrlKey) {
        if (e.key === 'o') {
            e.preventDefault();
            if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome') showSpreadsheet();
            document.getElementById('load-btn').click();
            return;
        }
        if (e.key === 's') {
            e.preventDefault();
            if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome') showSpreadsheet();
            document.getElementById('save-btn').click();
            return;
        }
        if (e.key === 'n') {
            e.preventDefault();
            if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome') showSpreadsheet();
            document.getElementById('new-btn').click();
            return;
        }
    }
    
    if (selectedCell) {
        const { row, col } = selectedCell;
        
        // Arrow key navigation - grid expands automatically via selectCell()
        if (e.key === 'ArrowUp' && row > 0) {
            e.preventDefault();
            selectCell(row - 1, col);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectCell(row + 1, col);  // No upper limit - grid expands
        } else if (e.key === 'ArrowLeft' && col > 0) {
            e.preventDefault();
            selectCell(row, col - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            selectCell(row, col + 1);  // No upper limit - grid expands
        } else if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault();
            startEditing(row, col);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            SetCellValue(row, col, '').then((result) => {
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.textContent = '';
                    cell.classList.remove('formula-cell');
                }
                // Update file status from the response
                if (result.hasUnsavedChanges !== undefined) {
                    displayFileStatus(result.hasUnsavedChanges);
                }
                return refreshAllCells();
            });
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Start typing to replace cell content - inject the first character
            e.preventDefault();
            startEditingWithChar(row, col, e.key);
        }
    }
});

// Start editing with an initial character
function startEditingWithChar(row, col, initialChar) {
    if (isEditing) {
        console.warn('Already editing, ignoring startEditingWithChar call');
        return;
    }
    
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;
    
    // Clean up any leftover input elements
    const existingInput = cell.querySelector('.cell-editor');
    if (existingInput) {
        existingInput.remove();
    }
    
    isEditing = true;
    console.log(`Starting edit with char "${initialChar}" at row=${row}, col=${col}`);
    
    // Select the cell WITHOUT triggering cleanup (since we're about to edit)
    document.querySelectorAll('.cell.selected').forEach(el => {
        el.classList.remove('selected');
    });
    cell.classList.add('selected');
    selectedCell = { row, col };
    
    // Replace cell content with input, starting with the typed character
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = initialChar;  // Start with the character they typed
    
    const originalContent = cell.textContent;
    cell.textContent = '';
    cell.appendChild(input);
    
    // Focus immediately (synchronously) after appending to DOM
    input.focus();
    // Move cursor to end
    input.setSelectionRange(1, 1);
    console.log(`Input focused, value="${input.value}"`);
    
    // Set up event handlers
    setupEditorHandlers(input, row, col, cell, originalContent);
}

// Initialize - wait for DOM and modules to be ready
console.log('[app.js] Starting initialization...');
buildSpreadsheet();

// Load cells after a short delay to ensure Wails runtime is ready
setTimeout(async () => {
    console.log('[app.js] Loading cells...');
    try {
        await loadCells();
        console.log('[app.js] Cells loaded successfully');
        // Select A1 by default
        selectCell(0, 0);
    } catch (err) {
        console.error('[app.js] Failed to load cells:', err);
    }
}, 100);

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
    console.log('New button clicked, status:', status);
    
    // Only confirm if there are unsaved changes
    if (status.hasUnsavedChanges) {
        const confirmed = await showConfirmDialog('You have unsaved changes! Create a new spreadsheet anyway? All unsaved changes will be lost.');
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
        buildSpreadsheet();
        await loadCells();
        selectCell(0, 0);
        updateFileStatus();
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
        console.log('File saved');
    } catch (error) {
        await showAlert('Error saving file: ' + error.message);
    }
});

document.getElementById('load-btn').addEventListener('click', async () => {
    // Check if there are unsaved changes
    const status = await GetFileStatus();
    console.log('Load button clicked, status:', status);
    
    // Only confirm if there are unsaved changes
    if (status.hasUnsavedChanges) {
        const confirmed = await showConfirmDialog('You have unsaved changes! Load a different file anyway? All unsaved changes will be lost.');
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
        buildSpreadsheet();
        await loadCells();
        selectCell(0, 0);
        updateFileStatus();
        
        console.log('File loaded successfully');
    } catch (error) {
        await showAlert('Error loading file: ' + error.message);
    }
});

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

// Expose for testing
window.handleImportCSV = handleImportCSV;

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
    preview.preview.forEach((row, rowIdx) => {
        tableHTML += '<tr>';
        for (let col = 0; col < preview.cols; col++) {
            const value = row[col] || '';
            tableHTML += `<td>${value}</td>`;
        }
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';
    
    tableEl.innerHTML = tableHTML;
    
    // Show modal
    modal.classList.add('active');
    
    // Handle Import button
    const handleImport = async () => {
        modal.classList.remove('active');
        importBtn.removeEventListener('click', handleImport);
        cancelBtn.removeEventListener('click', handleCancel);
        
        try {
            // Check for unsaved changes
            const status = await GetFileStatus();
            if (status.hasUnsavedChanges) {
                const confirmed = await showConfirmDialog('You have unsaved changes! Import CSV anyway? All unsaved changes will be lost.');
                if (!confirmed) {
                    return; // User cancelled
                }
            }
            
            // Import CSV data
            const result = await ImportCSV(preview.path);
            
            // Reload grid
            ROWS = Math.max(100, result.rows);
            COLS = Math.max(26, result.cols);
            buildSpreadsheet();
            await loadCells();
            selectCell(0, 0);
            updateFileStatus();
            
            console.log(`CSV imported: ${result.message}`);
        } catch (error) {
            await showAlert('Error importing CSV: ' + error.message);
        }
    };
    
    // Handle Cancel button
    const handleCancel = () => {
        modal.classList.remove('active');
        importBtn.removeEventListener('click', handleImport);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
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
    closeBtn.focus();

    const handleClose = () => {
        modal.classList.remove('active');
        closeBtn.removeEventListener('click', handleClose);
        document.removeEventListener('keydown', handleKeyDown);
        modal.removeEventListener('click', handleOverlayClick);
    };

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

async function showUserGuideModal() {
    const modal = document.getElementById('user-guide-modal');
    const contentEl = document.getElementById('user-guide-content');
    const closeBtn = document.getElementById('user-guide-close');
    if (!modal || !contentEl || !closeBtn) return;

    contentEl.innerHTML = '<p>Loading...</p>';
    modal.classList.add('active');
    closeBtn.focus();

    let handleAnchorClick = null;
    const handleClose = () => {
        modal.classList.remove('active');
        closeBtn.removeEventListener('click', handleClose);
        document.removeEventListener('keydown', handleKeyDown);
        modal.removeEventListener('click', handleOverlayClick);
        if (handleAnchorClick) contentEl.removeEventListener('click', handleAnchorClick);
    };

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
        const html = window.electronAPI?.getUserGuideContent ? await window.electronAPI.getUserGuideContent() : null;
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
    console.log('[handleExportCSV] Starting export, testPath:', testPath);
    try {
        console.log('[handleExportCSV] Calling ExportCSV...');
        const result = await ExportCSV(testPath);
        console.log('[handleExportCSV] ExportCSV returned:', result);
        
        if (!result) {
            console.log('[handleExportCSV] User cancelled file dialog');
            return;
        }
        
        console.log('[handleExportCSV] Showing success alert...');
        await showAlert(`Exported to ${result.path}`);
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
    } else {
        statusEl.textContent = '✓ Saved';
        statusEl.style.color = 'var(--color-success)'; // Green
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
            hasFilePath: false // Will be updated by updateFileStatus() with full info
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
        
        // Story 7.1: Update menu state in Electron
        if (window.electronAPI && window.electronAPI.updateMenuState) {
            window.electronAPI.updateMenuState({
                hasUnsavedChanges: status.hasUnsavedChanges,
                hasFilePath: status.path !== ''
            });
        }
    } catch (error) {
        console.error('Error updating file status:', error);
    }
}

// Story 7.1: Setup menu event listeners for Electron
if (window.electronAPI) {
    console.log('[App] Setting up Electron menu event listeners');
    
    // New file from menu (Story 8.2: show spreadsheet first when on welcome screen)
    window.electronAPI.onMenuNew(async () => {
        console.log('[App] Menu New triggered');
        if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome') showSpreadsheet();
        document.getElementById('new-btn').click();
    });
    
    // Open file from menu
    window.electronAPI.onMenuOpen(async () => {
        console.log('[App] Menu Open triggered');
        if (document.querySelector('#app')?.getAttribute('data-view') === 'welcome') showSpreadsheet();
        document.getElementById('load-btn').click();
    });
    
    // Save file from menu
    window.electronAPI.onMenuSave(async () => {
        console.log('[App] Menu Save triggered');
        document.getElementById('save-btn').click();
    });
    
    // Save As from menu - always show dialog even if file has path
    window.electronAPI.onMenuSaveAs(async () => {
        console.log('[App] Menu Save As triggered');
        try {
            // Call SaveFile with empty string to force dialog
            const path = await SaveFile('');
            
            // Story 7.5: Add to recent files after successful save
            if (path && window.electronAPI && window.electronAPI.addRecentFile) {
                await window.electronAPI.addRecentFile(path);
            }
            
            updateFileStatus();
            console.log('File saved via Save As');
        } catch (error) {
            await showAlert('Error saving file: ' + error.message);
        }
    });
    
    // Import CSV from menu
    // Story 7.12: CSV buttons removed from toolbar, call functions directly
    window.electronAPI.onMenuImportCSV(async () => {
        console.log('[App] Menu Import CSV triggered');
        await handleImportCSV();
    });
    
    // Export CSV from menu
    window.electronAPI.onMenuExportCSV(async () => {
        console.log('[App] Menu Export CSV triggered');
        await handleExportCSV();
    });
    
    // Story 7.5: Open recent file from menu (Story 8.2: uses loadFileByPath)
    window.electronAPI.onMenuOpenRecent(async (event, filePath) => {
        console.log('[App] Menu Open Recent triggered:', filePath);
        await loadFileByPath(filePath);
    });
    
    // Story 9.6: Formula Reference from Help menu
    if (window.electronAPI.onMenuFormulaReference) {
        window.electronAPI.onMenuFormulaReference(() => {
            console.log('[App] Menu Formula Reference triggered');
            showFormulaHelpModal();
        });
    }
    
    // User Guide from Help menu (in-app markdown viewer)
    if (window.electronAPI.onMenuUserGuide) {
        window.electronAPI.onMenuUserGuide(() => {
            console.log('[App] Menu User Guide triggered');
            showUserGuideModal();
        });
    }
    
    // Story 7.2: Edit menu handlers
    
    // Cut: Copy cell value to clipboard and clear cell
    window.electronAPI.onMenuCut(async () => {
        console.log('[App] Menu Cut triggered');
        if (!selectedCell) {
            console.log('[App] No cell selected for Cut');
            return;
        }
        
        try {
            const { row, col } = selectedCell;
            // Get raw value (formula, not computed)
            const value = await GetCellRawValue(row, col);
            
            // Copy to clipboard
            await navigator.clipboard.writeText(value);
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
        console.log('[App] Menu Copy triggered');
        if (!selectedCell) {
            console.log('[App] No cell selected for Copy');
            return;
        }
        
        try {
            const { row, col } = selectedCell;
            // Get raw value (formula, not computed)
            const value = await GetCellRawValue(row, col);
            
            // Copy to clipboard
            await navigator.clipboard.writeText(value);
            console.log('[App] Copy: Copied to clipboard:', value);
        } catch (error) {
            console.error('[App] Error during Copy:', error);
            await showAlert('Error during Copy operation: ' + error.message);
        }
    });
    
    // Paste: Paste clipboard content into selected cell
    window.electronAPI.onMenuPaste(async () => {
        console.log('[App] Menu Paste triggered');
        if (!selectedCell) {
            console.log('[App] No cell selected for Paste');
            return;
        }
        
        try {
            const { row, col } = selectedCell;
            
            // Read from clipboard
            const text = await navigator.clipboard.readText();
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
    
    // Select All: If formula bar/input has focus, select its text; else select all cells
    window.electronAPI.onMenuSelectAll(async () => {
        console.log('[App] Menu Select All triggered');
        
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
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
                let minRow = Infinity, maxRow = -Infinity;
                let minCol = Infinity, maxCol = -Infinity;
                
                for (const cellRef in result.cells) {
                    const match = cellRef.match(/^([A-Z]+)(\d+)$/);
                    if (match) {
                        const col = columnToIndex(match[1]);
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
                    console.log(`[App] Select All: Selected range from (${minRow},${minCol}) to (${maxRow},${maxCol})`);
                    await showAlert(`Selected range: ${indexToColumn(minCol)}${minRow + 1} to ${indexToColumn(maxCol)}${maxRow + 1}\n(Note: Full range selection coming in future update)`);
                }
            } else {
                console.log('[App] Select All: No non-empty cells found');
                await showAlert('No cells to select');
            }
        } catch (error) {
            console.error('[App] Error during Select All:', error);
            await showAlert('Error during Select All operation: ' + error.message);
        }
    });
    
    console.log('[App] Electron menu event listeners registered (File + Edit)');
}

// Story 7.10: Dark mode support
// Listen for theme changes from Electron main process
if (window.electronAPI && window.electronAPI.onThemeChanged) {
    window.electronAPI.onThemeChanged((theme) => {
        console.log('[App] Theme changed to:', theme);
        document.documentElement.setAttribute('data-theme', theme);
    });
    console.log('[App] Theme change listener registered');
}

// Fallback: Detect system preference directly (for web mode or if Electron API not available)
if (window.matchMedia) {
    // Initial detection
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        console.log('[App] Initial theme: dark (from media query)');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        console.log('[App] Initial theme: light (from media query)');
    }
    
    // Listen for changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const theme = e.matches ? 'dark' : 'light';
        console.log('[App] System theme changed to:', theme);
        document.documentElement.setAttribute('data-theme', theme);
    });
}

// Update file status on load
updateFileStatus();

console.log('GoSheet initialized');
