// app-cell-editor.js — Cell editing, cell value rendering, keyboard navigation, alignment.

import {
  GetCellRawValue,
  SetCellValue,
  SetCellAlignment,
  SetRangeAlignment,
} from './api-client.js';
import { appState, OPEN_END } from './app-state.js';
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
import { colToLetter } from './app-utils.js';

// Story 18.1: Track span of last auto-inserted cell reference in the formula editor.
// { start: number, end: number } | null
// Reset when the user types a non-reference character or moves the cursor manually.
let lastInsertedRefSpan = null;

// Track if we're currently saving to prevent duplicate saves
let isSaving = false;

// Story 18.1: Set to true while insertCellRefAtCursor is inserting a ref,
// so the blur handler does not commit the edit. Only applies to .cell-editor;
// cleared by the rAF blur callback or when a new edit starts.
let suppressBlurFinish = false;

export function resetLastInsertedRefSpan() {
  lastInsertedRefSpan = null;
}

/**
 * M2 fix: shared splice-and-focus logic used by both insertCellRefAtCursor and
 * insertRangeRefAtCursor. Resolves the active input if none is provided.
 *
 * @param {string} ref - the reference string to insert (e.g. "B2" or "A1:C3")
 * @param {HTMLInputElement} inputEl
 */
function spliceRefIntoInput(ref, inputEl) {
  const input =
    inputEl ||
    document.querySelector('.cell-editor') ||
    (document.activeElement?.id === 'formula-bar'
      ? document.activeElement
      : null);
  if (!input) return;

  const cursorPos = input.selectionStart;
  const val = input.value;

  let insertStart;
  if (lastInsertedRefSpan !== null && cursorPos === lastInsertedRefSpan.end) {
    insertStart = lastInsertedRefSpan.start;
    input.value =
      val.slice(0, insertStart) + ref + val.slice(lastInsertedRefSpan.end);
  } else {
    insertStart = cursorPos;
    input.value = val.slice(0, cursorPos) + ref + val.slice(cursorPos);
  }

  const newEnd = insertStart + ref.length;
  input.setSelectionRange(newEnd, newEnd);
  lastInsertedRefSpan = { start: insertStart, end: newEnd };
  // Story 23.5: Scroll input so inserted ref is visible (narrow cell-editor)
  if (input.scrollWidth > input.clientWidth) {
    input.scrollLeft = input.scrollWidth - input.clientWidth;
  }
  // Only suppress the blur handler for .cell-editor inputs — the formula bar
  // has no blur-finish handler so setting suppressBlurFinish there would leave
  // it permanently true and silently swallow the next cell-editor commit.
  if (input.classList.contains('cell-editor')) {
    suppressBlurFinish = true;
  }
  input.focus();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Story 18.1: Insert (or replace) a cell reference at the current cursor
 * position in the active formula editor input.
 *
 * @param {number} row
 * @param {number} col
 * @param {HTMLInputElement} [inputEl] - the input to insert into; defaults to the
 *   active .cell-editor or the focused #formula-bar
 */
export function insertCellRefAtCursor(row, col, inputEl) {
  spliceRefIntoInput(colToLetter(col) + (row + 1), inputEl);
}

/**
 * Story 18.2: Insert (or replace) a range reference at the current cursor
 * position in the active formula editor input.
 *
 * Single-cell drag (startRow===endRow && startCol===endCol) produces a plain
 * cell ref (e.g. "B2"), not a range ref ("B2:B2").
 *
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @param {HTMLInputElement} inputEl
 */
export function insertRangeRefAtCursor(
  startRow,
  startCol,
  endRow,
  endCol,
  inputEl
) {
  const ref =
    startRow === endRow && startCol === endCol
      ? colToLetter(startCol) + (startRow + 1)
      : colToLetter(startCol) +
        (startRow + 1) +
        ':' +
        colToLetter(endCol) +
        (endRow + 1);
  spliceRefIntoInput(ref, inputEl);
}

export const STYLE_CLASSES = ['style-title', 'style-header', 'style-total'];
export const STYLE_ID = { TITLE: 1, HEADER: 2, TOTAL: 3 };
const TOOLTIP_LENGTH_THRESHOLD = 25;

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
  lastInsertedRefSpan = null; // Story 18.1: fresh span on every edit start

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
    // Story 18.1: any key typed resets the replace-span so next click appends
    lastInsertedRefSpan = null;
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
    // rAF fires after the pending click event (mousedown→blur→mouseup→click→rAF).
    // This lets the click handler (saveCurrentEditOnCellSwitch / insertCellRefAtCursor)
    // run first before we decide whether to finish. suppressBlurFinish is set by
    // insertCellRefAtCursor to prevent committing during formula-ref insertion.
    requestAnimationFrame(() => {
      if (!finished && appState.isEditing && !suppressBlurFinish) finish();
      suppressBlurFinish = false;
    });
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
      cell.title = '#ERROR';
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
  // H1 fix: if a formula drag was in progress when editing was cancelled (e.g. via
  // Escape), clean up highlights and reset drag state so nothing leaks.
  window._cancelFormulaDrag?.();
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
  lastInsertedRefSpan = null; // Story 18.1: fresh span on every edit start
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

// Apply a cell's value and style to its DOM element. Alignment comes from style format or cellData.alignment.
export function applyCellValue(
  cell,
  value,
  rawValue,
  styleId,
  styleFormats = null,
  isError = false,
  alignment = null
) {
  const safeValue = value ?? '';
  cell.textContent = safeValue;
  // All error types (ErrEval, ErrRef, ErrCircular, ErrParse) get same treatment:
  // error-cell class + tooltip. Use isError from API and #-prefixed display as fallback.
  const isErrorCell = isError || (safeValue && safeValue.startsWith('#'));
  const needsTooltip =
    isErrorCell || (safeValue && safeValue.length > TOOLTIP_LENGTH_THRESHOLD);
  const tooltipText = needsTooltip ? safeValue || '#ERROR' : '';
  // Use data-tooltip for custom tooltip; also set title for native fallback and accessibility
  if (tooltipText) {
    cell.dataset.tooltip = tooltipText;
    cell.title = tooltipText;
    cell.setAttribute('aria-label', tooltipText);
  } else {
    delete cell.dataset.tooltip;
    cell.title = '';
    cell.removeAttribute('aria-label');
  }
  cell.classList.toggle('error-cell', isErrorCell);
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
  applyCellStyleClasses(cell, styleId, styleFormats, isNum, alignment);
}

const VALID_ALIGNMENTS = new Set(['left', 'center', 'right']);

/** Apply format CSS to cell; handle default alignment for numbers vs text. */
function applyFormatCssToCell(cell, format, isNum) {
  const css = formatToCssPreview(format);
  for (const [k, v] of Object.entries(css)) {
    const prop = k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());
    const isBorder = prop.startsWith('border-');
    cell.style.setProperty(prop, v, isBorder ? 'important' : '');
  }
  const align = format.alignment;
  const hDefault = align?.horizontal === '' || align?.horizontal === 'default';
  if (hDefault) cell.style.setProperty('text-align', isNum ? 'right' : 'left');
}

/**
 * Apply named style classes and inline CSS from styleFormats to a cell element.
 * Story 12.2: styleId 1=Title, 2=Header, 3=Total; also applies format CSS.
 * When alignment is provided (from API), use it to override or supply text-align when style lacks it.
 */
export function applyCellStyleClasses(
  cell,
  styleId,
  styleFormats,
  isNum,
  alignment = null
) {
  STYLE_CLASSES.forEach((c) => cell.classList.remove(c));
  // Reset all inline CSS properties that formatToCssPreview can set, so that
  // switching to styleId=0 (or a different style) doesn't leave stale values.
  cell.style.fontFamily = '';
  cell.style.fontSize = '';
  cell.style.fontWeight = '';
  cell.style.fontStyle = '';
  cell.style.color = '';
  cell.style.backgroundColor = '';
  cell.style.removeProperty('border-left');
  cell.style.removeProperty('border-right');
  cell.style.removeProperty('border-top');
  cell.style.removeProperty('border-bottom');
  cell.style.textAlign = '';
  cell.style.whiteSpace = '';
  cell.style.wordWrap = '';
  cell.style.minWidth = '';
  if (styleId >= STYLE_ID.TITLE && styleId <= STYLE_ID.TOTAL) {
    cell.classList.add(STYLE_CLASSES[styleId - 1]);
  }
  if (styleId > 0 && styleFormats) {
    const style = styleFormats.find(
      (s) => s.id === styleId || Number(s.id) === Number(styleId)
    );
    const format = style?.format;
    if (format) applyFormatCssToCell(cell, format, isNum);
  }
  if (VALID_ALIGNMENTS.has(alignment)) {
    cell.style.setProperty('text-align', alignment, 'important');
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
  const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
  const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
  try {
    let result;
    if (startRow === resolvedEndRow && startCol === resolvedEndCol) {
      result = await SetCellAlignment(startRow, startCol, alignment);
    } else {
      result = await SetRangeAlignment(
        startRow,
        startCol,
        resolvedEndRow,
        resolvedEndCol,
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
  if (e.key === 'z') {
    e.preventDefault();
    if (!appState.isReadOnly) {
      if (e.shiftKey) window.performRedo?.();
      else window.performUndo?.();
    }
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
  if (e.key === '\\') {
    e.preventDefault();
    window.clearFormattingFromSelection?.();
    return true;
  }
  return false;
}

// Extend the selection range by one cell in the Shift+Arrow direction.
function handleShiftArrow(e) {
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  // Clamp OPEN_END to grid bounds before arithmetic
  let newEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
  let newEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
  if (e.key === 'ArrowDown' && newEndRow < appState.ROWS - 1) newEndRow++;
  if (e.key === 'ArrowUp' && newEndRow > startRow) newEndRow--;
  if (e.key === 'ArrowRight' && newEndCol < appState.COLS - 1) newEndCol++;
  if (e.key === 'ArrowLeft' && newEndCol > startCol) newEndCol--;
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
  // Story 17.5: skip Shift+Arrow for open-ended row/column selections
  if (
    e.shiftKey &&
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
  ) {
    e.preventDefault();
    if (
      appState.selectionMode !== 'row' &&
      appState.selectionMode !== 'column'
    ) {
      handleShiftArrow(e);
    }
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
