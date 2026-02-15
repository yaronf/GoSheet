// GoSheet Frontend - ES6 Module
// API functions imported from api-client.js (mode-aware: web fetch or Wails IPC)

import { GetCellValue, GetCellRawValue, SetCellValue, GetCellRef, GetAllCells, GetFileStatus, NewFile, SaveFile, LoadFile } from './api-client.js';

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
            resolve(true);
        };
        
        // Handle Cancel
        const handleCancel = () => {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };
        
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        
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
            resolve();
        };
        
        okBtn.addEventListener('click', handleOk);
        
        // Close on overlay click
        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleOk();
                overlay.removeEventListener('click', handleOverlayClick);
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

// Initialize the spreadsheet
document.querySelector('#app').innerHTML = `
    <div class="toolbar">
        <button id="new-btn" class="toolbar-btn">New</button>
        <button id="save-btn" class="toolbar-btn">Save</button>
        <button id="load-btn" class="toolbar-btn">Load</button>
        <input type="file" id="file-input" accept=".gosheet" style="display: none;" />
        <span id="file-status" class="file-status"></span>
    </div>
    <div class="formula-bar-container">
        <span class="cell-ref" id="cell-ref">A1</span>
        <input type="text" class="formula-bar" id="formula-bar" placeholder="Enter value or formula..." />
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
`;

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
                    
                    // Check if it's a formula cell
                    const rawValue = await GetCellRawValue(row, col);
                    if (rawValue && rawValue.startsWith('=')) {
                        cell.classList.add('formula-cell');
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
                    
                    // Check if it's a formula cell
                    const rawValue = await GetCellRawValue(row, col);
                    if (rawValue && rawValue.startsWith('=')) {
                        cell.classList.add('formula-cell');
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
        // Call unified SaveFile API (shows dialog in native mode, uses path in web mode)
        await SaveFile('');
        updateFileStatus();
        console.log('File saved');
    } catch (error) {
        await showAlert('Error saving file: ' + error.message);
    }
});

document.getElementById('load-btn').addEventListener('click', async () => {
    try {
        // Call unified LoadFile API (shows dialog in native mode, uses file input in web mode)
        await LoadFile('');
        
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

// Update file status display
/**
 * Update file status display from a boolean flag
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
function displayFileStatus(hasUnsavedChanges) {
    const statusEl = document.getElementById('file-status');
    if (hasUnsavedChanges) {
        statusEl.textContent = '● Unsaved changes';
        statusEl.style.color = '#ff6b6b';
    } else {
        statusEl.textContent = '✓ Saved';
        statusEl.style.color = '#51cf66';
    }
}

/**
 * Fetch and update file status from server
 */
async function updateFileStatus() {
    try {
        const status = await GetFileStatus();
        displayFileStatus(status.hasUnsavedChanges);
    } catch (error) {
        console.error('Error updating file status:', error);
    }
}

// Update file status on load
updateFileStatus();

console.log('GoSheet initialized');
