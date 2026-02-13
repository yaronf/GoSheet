// GoSheet Frontend - Pure JavaScript (no build system needed)

// API Configuration
const API_BASE = '';  // Same origin

// API Functions
const GetCellValue = async (row, col) => {
    const response = await fetch(`${API_BASE}/api/cell/value?row=${row}&col=${col}`);
    return await response.json();
};

const GetCellRawValue = async (row, col) => {
    const response = await fetch(`${API_BASE}/api/cell/raw?row=${row}&col=${col}`);
    return await response.json();
};

const SetCellValue = async (row, col, value) => {
    const response = await fetch(`${API_BASE}/api/cell/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col, value })
    });
    return await response.json();
};

const GetCellRef = async (row, col) => {
    const response = await fetch(`${API_BASE}/api/cell/ref?row=${row}&col=${col}`);
    return await response.json();
};

const GetAllCells = async () => {
    const response = await fetch(`${API_BASE}/api/cells/all`);
    return await response.json();
};

// Spreadsheet configuration
const ROWS = 30;
const COLS = 15;

let selectedCell = null;
let isEditing = false;

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
    <div class="spreadsheet-container">
        <table class="spreadsheet" id="spreadsheet">
            <!-- Will be populated by JavaScript -->
        </table>
    </div>
`;

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
    // If we're currently editing, force cleanup first
    if (isEditing) {
        console.log('Selecting new cell while editing - forcing cleanup');
        forceCleanupEditing();
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
    }
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
    selectCell(row, col);
    
    // Get raw value (formula, not computed)
    GetCellRawValue(row, col).then(rawValue => {
        // Double-check we're still supposed to be editing
        if (!isEditing) {
            console.warn('Editing was cancelled while fetching value');
            return;
        }
        
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
    
    SetCellValue(row, col, value).then(() => {
        console.log(`SetCellValue completed for row=${row}, col=${col}`);
        // Refresh ALL cells to pick up dependent formula changes
        return refreshAllCells();
    }).then(() => {
        console.log(`All cells refreshed after edit at row=${row}, col=${col}`);
        isSaving = false;
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
    if (isEditing) return;
    if (e.target.tagName === 'INPUT') return;
    
    if (selectedCell) {
        const { row, col } = selectedCell;
        
        // Arrow key navigation
        if (e.key === 'ArrowUp' && row > 0) {
            e.preventDefault();
            selectCell(row - 1, col);
        } else if (e.key === 'ArrowDown' && row < ROWS - 1) {
            e.preventDefault();
            selectCell(row + 1, col);
        } else if (e.key === 'ArrowLeft' && col > 0) {
            e.preventDefault();
            selectCell(row, col - 1);
        } else if (e.key === 'ArrowRight' && col < COLS - 1) {
            e.preventDefault();
            selectCell(row, col + 1);
        } else if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault();
            startEditing(row, col);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            SetCellValue(row, col, '').then(() => {
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.textContent = '';
                    cell.classList.remove('formula-cell');
                }
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

// Initialize
buildSpreadsheet();
loadCells();

console.log('GoSheet initialized');
