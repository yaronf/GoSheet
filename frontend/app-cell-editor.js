// app-cell-editor.js — Cell editing, cell value rendering, keyboard navigation, alignment.

import {
  GetCellRawValue,
  SetCellValue,
  SetCellAlignment,
  SetRangeAlignment,
} from './api-client.js';
import { appState } from './app-state.js';
import { formatToCssPreview } from './app-modals.js';
import {
  getCellElement,
  resolveToAnchor,
  selectCell,
  updateFormulaBar,
  getNextCell,
  getNextCellTabOrder,
  applySelectionRange,
} from './app-grid.js';

export const STYLE_CLASSES = ['style-title', 'style-header', 'style-total'];
export const STYLE_ID = { TITLE: 1, HEADER: 2, TOTAL: 3 };
const TOOLTIP_LENGTH_THRESHOLD = 25;

// Track if we're currently saving to prevent duplicate saves
let isSaving = false;

// Start editing a cell
export function startEditing(row, col) {
  if (appState.isReadOnly) return; // Story 16.4
  if (appState.isEditing) {
    console.warn('Already editing, ignoring startEditing call');
    return;
  }

  ({ row, col } = resolveToAnchor(row, col));
  const cell = getCellElement(row, col);
  if (!cell) return;

  const existingInput = cell.querySelector('.cell-editor');
  if (existingInput) existingInput.remove();

  appState.isEditing = true;

  document
    .querySelectorAll('.cell.selected')
    .forEach((el) => el.classList.remove('selected'));
  cell.classList.add('selected');
  appState.selectedCell = { row, col };

  GetCellRawValue(row, col)
    .then((rawValue) => {
      if (!appState.isEditing) {
        console.warn('Editing was cancelled while fetching value');
        return;
      }

      if (window.__DEBUG__)
        console.log(
          `Editing cell (${row},${col}): rawValue="${rawValue}", isFormula=${cell.classList.contains('formula-cell')}`
        );

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-editor';
      input.value = rawValue || '';
      input.placeholder = 'Type value or formula...';

      const originalContent = cell.textContent;
      cell.textContent = '';
      cell.appendChild(input);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      setupEditorHandlers(input, row, col, cell, originalContent);
    })
    .catch((err) => {
      console.error('Error getting cell value:', err);
      appState.isEditing = false;
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
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      if (nextCol >= 0 && nextCol < appState.COLS) {
        setTimeout(() => selectCell(row, nextCol), 100);
      }
    }
  });

  input.addEventListener('blur', (_e) => {
    setTimeout(() => {
      if (!finished && appState.isEditing) finish();
    }, 150);
  });
}

// Finish editing and save value
function finishEditing(row, col, value, cell) {
  if (!appState.isEditing) {
    console.warn('finishEditing called but not editing');
    return;
  }
  if (isSaving) {
    console.warn('finishEditing called but already saving - ignoring');
    return;
  }

  if (window.__DEBUG__)
    console.log(`Finishing edit: row=${row}, col=${col}, value="${value}"`);

  const input = cell.querySelector('.cell-editor');
  if (input) input.remove();

  appState.isEditing = false;
  isSaving = true;
  if (window.__DEBUG__)
    console.log(`isEditing set to false, isSaving set to true`);

  SetCellValue(row, col, value)
    .then((result) => {
      if (window.__DEBUG__)
        console.log(`SetCellValue completed for row=${row}, col=${col}`);
      if (result.hasUnsavedChanges !== undefined)
        window.displayFileStatus?.(result.hasUnsavedChanges);
      window.applyUndoRedoState?.(result);
      return window.refreshAllCells?.();
    })
    .then(() => {
      if (window.__DEBUG__)
        console.log(`All cells refreshed after edit at row=${row}, col=${col}`);
      isSaving = false;
      if (
        appState.selectedCell?.row === row &&
        appState.selectedCell?.col === col
      ) {
        updateFormulaBar(row, col);
      }
    })
    .catch((err) => {
      console.error('Error setting cell value:', err);
      cell.textContent = '#ERROR';
      cell.classList.add('error-cell');
      appState.isEditing = false;
      isSaving = false;
    });
}

// Cancel editing (restore original content)
export function cancelEditing(cell, originalContent) {
  if (window.__DEBUG__) console.log('Cancelling edit');
  const input = cell.querySelector('.cell-editor');
  if (input) input.remove();
  appState.isEditing = false;
  if (window.__DEBUG__) console.log('isEditing set to false (cancelled)');
  cell.textContent = originalContent;
}

// Save the current edit if a cell-editor input is present
export function saveCurrentEditOnCellSwitch() {
  const input = document.querySelector('.cell-editor');
  if (!input) {
    window.forceCleanupEditing?.();
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
  appState.isEditing = false;
  SetCellValue(editRow, editCol, value)
    .then((result) => {
      if (result.hasUnsavedChanges !== undefined)
        window.displayFileStatus?.(result.hasUnsavedChanges);
      window.applyUndoRedoState?.(result);
      return window.refreshAllCells?.();
    })
    .catch((err) => console.error('Error saving on cell switch:', err));
}

// Start editing a cell with an initial typed character
export function startEditingWithChar(row, col, initialChar) {
  if (appState.isEditing) {
    console.warn('Already editing, ignoring startEditingWithChar call');
    return;
  }

  ({ row, col } = resolveToAnchor(row, col));
  const cell = getCellElement(row, col);
  if (!cell) return;

  const existingInput = cell.querySelector('.cell-editor');
  if (existingInput) existingInput.remove();

  appState.isEditing = true;
  if (window.__DEBUG__)
    console.log(
      `Starting edit with char "${initialChar}" at row=${row}, col=${col}`
    );

  document
    .querySelectorAll('.cell.selected')
    .forEach((el) => el.classList.remove('selected'));
  cell.classList.add('selected');
  appState.selectedCell = { row, col };

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-editor';
  input.value = initialChar;

  const originalContent = cell.textContent;
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.setSelectionRange(1, 1);
  if (window.__DEBUG__) console.log(`Input focused, value="${input.value}"`);

  setupEditorHandlers(input, row, col, cell, originalContent);
}

// Apply a cell's value, style, and alignment to its DOM element
export function applyCellValue(
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
  cell.title =
    safeValue && (isError || safeValue.length > TOOLTIP_LENGTH_THRESHOLD)
      ? safeValue
      : '';
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
  applyCellStyleClasses(cell, styleId, styleFormats, isNum);
  cell.style.textAlign = alignment || '';
}

/**
 * Apply named style classes and inline CSS from styleFormats to a cell element.
 * Story 12.2: styleId 1=Title, 2=Header, 3=Total; also applies format CSS.
 */
export function applyCellStyleClasses(cell, styleId, styleFormats, isNum) {
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
        cell.style.setProperty('text-align', isNum ? 'right' : 'left');
      }
      if (align?.vertical === '' || align?.vertical === 'default') {
        cell.style.removeProperty('vertical-align');
      }
    }
  }
}

// Story 13.8: Alignment toolbar button handlers
export function updateAlignmentButtonState(activeAlignment) {
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

export async function applyAlignmentToSelection(alignment) {
  if (appState.isReadOnly) return; // Story 16.4
  if (!appState.selectedCell) return;
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
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
    window.applyUndoRedoState?.(result);
    await window.refreshAllCells?.();
    updateAlignmentButtonState(alignment);
  } catch (err) {
    console.error('[App] Error applying alignment:', err);
  }
}

// Handle Cmd/Ctrl + O, S, N, Z (file/undo/redo keyboard shortcuts)
export function handleKeydownFileOps(e) {
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (!appState.isReadOnly) window.performUndo?.();
    return true;
  }
  if (e.key === 'z' && e.shiftKey) {
    e.preventDefault();
    if (!appState.isReadOnly) window.performRedo?.();
    return true;
  }
  if (e.key === 'o') {
    e.preventDefault();
    window.ensureSpreadsheetView?.();
    document.getElementById('load-btn')?.click();
    return true;
  }
  if (e.key === 's') {
    e.preventDefault();
    window.ensureSpreadsheetView?.();
    document.getElementById('save-btn')?.click();
    return true;
  }
  if (e.key === 'n') {
    e.preventDefault();
    window.ensureSpreadsheetView?.();
    document.getElementById('new-btn')?.click();
    return true;
  }
  return false;
}

// Extend the selection range by one cell in the Shift+Arrow direction.
function handleShiftArrow(e) {
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  let newEndRow = endRow;
  let newEndCol = endCol;
  if (e.key === 'ArrowDown' && endRow < appState.ROWS - 1) newEndRow++;
  if (e.key === 'ArrowUp' && endRow > startRow) newEndRow--;
  if (e.key === 'ArrowRight' && endCol < appState.COLS - 1) newEndCol++;
  if (e.key === 'ArrowLeft' && endCol > startCol) newEndCol--;
  applySelectionRange(startRow, startCol, newEndRow, newEndCol);
}

// Clear the cell value and refresh the display.
function handleDeleteCell(row, col) {
  SetCellValue(row, col, '').then((result) => {
    const cell = getCellElement(row, col);
    if (cell) {
      cell.textContent = '';
      cell.classList.remove('formula-cell');
      delete cell.dataset.formula;
    }
    if (result.hasUnsavedChanges !== undefined)
      window.displayFileStatus?.(result.hasUnsavedChanges);
    return window.refreshAllCells?.();
  });
}

// Handle arrow keys, Enter, Tab, Delete, typing when a cell is selected
export function handleKeydownCellNavigation(e, row, col) {
  // Story 17.1: Shift+Arrow extends the selection range
  if (
    e.shiftKey &&
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
  ) {
    e.preventDefault();
    handleShiftArrow(e);
    return true;
  }
  if (handleArrowKey(e, row, col)) return true;
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
    if (appState.isReadOnly) return true; // Story 16.4
    e.preventDefault();
    handleDeleteCell(row, col);
    return true;
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (appState.isReadOnly) return true; // Story 16.4
    e.preventDefault();
    startEditingWithChar(row, col, e.key);
    return true;
  }
  return false;
}

/**
 * Handle ArrowUp/Down/Left/Right, accounting for RTL mode.
 */
export function handleArrowKey(e, row, col) {
  const arrowDirs = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: appState.isRTL ? 'right' : 'left',
    ArrowRight: appState.isRTL ? 'left' : 'right',
  };
  const dir = arrowDirs[e.key];
  if (!dir) return false;
  const next = getNextCell(row, col, dir);
  if (next) {
    e.preventDefault();
    selectCell(next.row, next.col);
    return true;
  }
  return false;
}
