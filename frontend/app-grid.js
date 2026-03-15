// app-grid.js — Grid rendering, merge helpers, infinite scroll, cell navigation, selection.

import {
  GetMerges,
  GetAllCells,
  GetStyles,
  GetCellRef,
  GetCellRawValue,
} from './api-client.js';
import {
  appState,
  EXPAND_THRESHOLD,
  EXPAND_ROWS,
  EXPAND_COLS,
  OPEN_END,
} from './app-state.js';
import {
  colToLetter,
  letterToCol,
  announceToScreenReader,
} from './app-utils.js';

// Mutex-like guard to prevent concurrent grid rebuilds
let buildSpreadsheetPromise = null;

export async function buildSpreadsheet() {
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

  if (container) {
    container.setAttribute('aria-rowcount', String(appState.ROWS));
    container.setAttribute('aria-colcount', String(appState.COLS));
  }

  const headerRow = document.createElement('tr');
  headerRow.setAttribute('role', 'row');
  const cornerCell = document.createElement('th');
  cornerCell.className = 'corner-header';
  cornerCell.setAttribute('scope', 'col');
  headerRow.appendChild(cornerCell);

  for (let col = 0; col < appState.COLS; col++) {
    const th = document.createElement('th');
    th.className = 'column-header';
    th.setAttribute('role', 'columnheader');
    th.setAttribute('aria-colindex', String(col + 1));
    th.dataset.col = String(col);
    th.textContent = colToLetter(col);
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  try {
    appState.currentMerges = await GetMerges();
  } catch (err) {
    console.warn('[buildSpreadsheet] Could not fetch merges:', err);
    appState.currentMerges = [];
  }
  const merges = appState.currentMerges;

  for (let row = 0; row < appState.ROWS; row++) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('aria-rowindex', String(row + 1));

    const th = document.createElement('th');
    th.className = 'row-header';
    th.setAttribute('role', 'rowheader');
    th.setAttribute('aria-rowindex', String(row + 1));
    th.dataset.row = String(row);
    th.textContent = row + 1;
    tr.appendChild(th);

    let col = 0;
    let colIndex = 1;
    while (col < appState.COLS) {
      const { merge, isAnchor } = getMergeInfo(row, col, merges);

      if (merge && isAnchor) {
        const td = document.createElement('td');
        td.className = 'cell merged-anchor';
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
        col++;
        colIndex++;
      } else {
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

  // Re-apply selection after rebuild. applySelectionRange resolves OPEN_END automatically.
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  applySelectionRange(startRow, startCol, endRow, endCol);
}

// Story 11.3: Merge-aware grid rendering helpers

/**
 * Find merge region containing (row, col), or null if not in any merge.
 */
export function getMergeAt(row, col, merges) {
  if (!merges || merges.length === 0) return null;
  for (const m of merges) {
    if (
      row >= m.startRow &&
      row < m.startRow + (m.rowSpan || 1) &&
      col >= m.startCol &&
      col < m.startCol + (m.colSpan || 1)
    ) {
      return m;
    }
  }
  return null;
}

/**
 * Returns { merge, isAnchor } where merge is the region or null, isAnchor=true if anchor cell.
 */
export function getMergeInfo(row, col, merges) {
  const merge = getMergeAt(row, col, merges);
  if (!merge) return { merge: null, isAnchor: false };
  const isAnchor = merge.startRow === row && merge.startCol === col;
  if (_isCoveredByRowspanFromAbove(row, col, merges) && !isAnchor) {
    return { merge, isAnchor: false };
  }
  return { merge, isAnchor };
}

function _isCoveredByRowspanFromAbove(row, col, merges) {
  if (!merges || merges.length === 0) return false;
  for (const m of merges) {
    if (
      m.rowSpan > 1 &&
      m.startRow < row &&
      row < m.startRow + m.rowSpan &&
      col >= m.startCol &&
      col < m.startCol + (m.colSpan || 1)
    ) {
      return true;
    }
  }
  return false;
}

// Story 11.6: Arrow navigation skipping covered cells
export function getNextCell(row, col, direction) {
  const next = stepInDirection(row, col, direction);
  if (!next) return null;
  const merge = getMergeAt(next.row, next.col, appState.currentMerges);
  if (!merge) return next;
  const isAnchor = merge.startRow === next.row && merge.startCol === next.col;
  if (isAnchor) return next;
  return jumpPastMerge(next.row, next.col, direction, merge);
}

export function stepInDirection(r, c, direction) {
  if (direction === 'up' && r > 0) return { row: r - 1, col: c };
  if (direction === 'down' && r < appState.ROWS - 1)
    return { row: r + 1, col: c };
  if (direction === 'left' && c > 0) return { row: r, col: c - 1 };
  if (direction === 'right' && c < appState.COLS - 1)
    return { row: r, col: c + 1 };
  return null;
}

export function jumpPastMerge(r, c, direction, merge) {
  if (direction === 'right')
    return stepInDirection(r, merge.startCol + merge.colSpan - 1, direction);
  if (direction === 'down')
    return stepInDirection(merge.startRow + merge.rowSpan - 1, c, direction);
  if (direction === 'left') return { row: merge.startRow, col: merge.startCol };
  if (direction === 'up') return { row: merge.startRow, col: merge.startCol };
  return null;
}

export function getNextCellTabOrder(row, col) {
  if (col < appState.COLS - 1) return getNextCell(row, col, 'right');
  if (row < appState.ROWS - 1)
    return getNextCell(row + 1, 0, 'right') || { row: row + 1, col: 0 };
  return null;
}

// Story 11.4: Resolve covered cell to its merge anchor
export function resolveToAnchor(row, col) {
  const merge = getMergeAt(row, col, appState.currentMerges);
  if (!merge) return { row, col };
  const isAnchor = merge.startRow === row && merge.startCol === col;
  if (isAnchor) return { row, col };
  return { row: merge.startRow, col: merge.startCol };
}

export function getCellElement(row, col) {
  const anchor = resolveToAnchor(row, col);
  return document.getElementById(`cell-${anchor.row}-${anchor.col}`);
}

// Load cells from API and apply to grid
export async function loadCells() {
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
          window.applyCellValue?.(
            cell,
            cellData.display,
            cellData.raw ?? '',
            cellData.styleId,
            styles,
            cellData.isError ?? false,
            cellData.alignment
          );
      }
    }
  } catch (err) {
    console.error('Error loading cells:', err);
  }
}

export async function refreshAllCells() {
  try {
    const [cells, styles] = await Promise.all([GetAllCells(), GetStyles()]);
    const STYLE_CLASSES = ['style-title', 'style-header', 'style-total'];
    const cleared = new Set();
    for (let row = 0; row < appState.ROWS; row++) {
      for (let col = 0; col < appState.COLS; col++) {
        const cell = getCellElement(row, col);
        if (cell && !cleared.has(cell)) {
          cleared.add(cell);
          cell.textContent = '';
          cell.title = '';
          cell.classList.remove('formula-cell', 'error-cell', ...STYLE_CLASSES);
          cell.style.textAlign = '';
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
          window.applyCellValue?.(
            cell,
            cellData.display,
            cellData.raw ?? '',
            cellData.styleId,
            styles,
            cellData.isError ?? false,
            cellData.alignment
          );
      }
    }
  } catch (err) {
    console.error('Error refreshing cells:', err);
  }
}

// Scroll-based infinite grid expansion
export async function checkScrollPosition() {
  const container = document.querySelector('.spreadsheet-container');
  const table = document.getElementById('spreadsheet');

  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const tableWidth = table.scrollWidth;
  const tableHeight = table.scrollHeight;

  let needsRebuild = false;

  if (scrollLeft + containerWidth > tableWidth * 0.8) {
    const newCols = appState.COLS + EXPAND_COLS;
    if (window.__DEBUG__)
      console.log(
        `Scroll: Expanding columns from ${appState.COLS} to ${newCols}`
      );
    appState.COLS = newCols;
    needsRebuild = true;
  }

  if (scrollTop + containerHeight > tableHeight * 0.8) {
    const newRows = appState.ROWS + EXPAND_ROWS;
    if (window.__DEBUG__)
      console.log(`Scroll: Expanding rows from ${appState.ROWS} to ${newRows}`);
    appState.ROWS = newRows;
    needsRebuild = true;
  }

  if (needsRebuild) {
    const oldScrollLeft = scrollLeft;
    const oldScrollTop = scrollTop;
    await buildSpreadsheet();
    await refreshAllCells();
    container.scrollLeft = oldScrollLeft;
    container.scrollTop = oldScrollTop;
    // Story 17.5: open-ended ranges self-resolve in applySelectionRange — no reapply needed.
  }
}

// Cell selection helpers

export function expandGridIfNeeded(row, col) {
  let needsRebuild = false;
  if (row >= appState.ROWS - EXPAND_THRESHOLD) {
    appState.ROWS = Math.max(row + EXPAND_ROWS, appState.ROWS + EXPAND_ROWS);
    if (window.__DEBUG__) console.log(`Expanding rows to ${appState.ROWS}`);
    needsRebuild = true;
  }
  if (col >= appState.COLS - EXPAND_THRESHOLD) {
    appState.COLS = Math.max(col + EXPAND_COLS, appState.COLS + EXPAND_COLS);
    if (window.__DEBUG__) console.log(`Expanding columns to ${appState.COLS}`);
    needsRebuild = true;
  }
  if (needsRebuild)
    // Story 17.5: open-ended ranges self-resolve in applySelectionRange after rebuild.
    buildSpreadsheet().then(() => refreshAllCells());
}

export function computeSelectionRange(row, col, extendSelection) {
  if (!extendSelection) {
    return { startRow: row, startCol: col, endRow: row, endCol: col };
  }
  const { startRow: sr, startCol: sc } = appState.selectionRange;
  const minR = Math.min(sr, row);
  const maxR = Math.max(sr, row);
  const minC = Math.min(sc, col);
  const maxC = Math.max(sc, col);
  return { startRow: minR, startCol: minC, endRow: maxR, endCol: maxC };
}

const SEL_EDGE_CLASSES = [
  'sel-edge-top',
  'sel-edge-bottom',
  'sel-edge-left',
  'sel-edge-right',
];

export function applySelectionRange(startRow, startCol, endRow, endCol) {
  appState.selectionRange = { startRow, startCol, endRow, endCol };
  appState.selectedCell = { row: startRow, col: startCol };
  // Story 17.5: resolve open-ended sentinels at render time
  const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
  const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected', ...SEL_EDGE_CLASSES);
    el.setAttribute('tabindex', '-1');
  });
  for (let r = startRow; r <= resolvedEndRow; r++) {
    for (let c = startCol; c <= resolvedEndCol; c++) {
      const cell = getCellElement(r, c);
      if (cell) {
        cell.classList.add('selected');
        if (r === startRow) cell.classList.add('sel-edge-top');
        if (r === resolvedEndRow) cell.classList.add('sel-edge-bottom');
        if (c === startCol) cell.classList.add('sel-edge-left');
        if (c === resolvedEndCol) cell.classList.add('sel-edge-right');
        if (r === startRow && c === startCol)
          cell.setAttribute('tabindex', '0');
      }
    }
  }
  updateFormulaBar(startRow, startCol);
  const cellCount =
    (resolvedEndRow - startRow + 1) * (resolvedEndCol - startCol + 1);
  announceToScreenReader(
    buildSelectionAnnouncement(
      startRow,
      startCol,
      resolvedEndRow,
      resolvedEndCol,
      cellCount
    )
  );
  updateMergeMenuState();
  applyRowColHeaderHighlight();
}

export function applyCellSelection(row, col, extendSelection = false) {
  const { startRow, startCol, endRow, endCol } = computeSelectionRange(
    row,
    col,
    extendSelection
  );

  appState.selectionRange = { startRow, startCol, endRow, endCol };
  appState.selectedCell = { row: startRow, col: startCol };

  document.querySelectorAll('.cell.selected').forEach((el) => {
    el.classList.remove('selected', ...SEL_EDGE_CLASSES);
    el.setAttribute('tabindex', '-1');
  });

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = getCellElement(r, c);
      if (cell) {
        cell.classList.add('selected');
        if (r === startRow) cell.classList.add('sel-edge-top');
        if (r === endRow) cell.classList.add('sel-edge-bottom');
        if (c === startCol) cell.classList.add('sel-edge-left');
        if (c === endCol) cell.classList.add('sel-edge-right');
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
  applyRowColHeaderHighlight();
}

// Story 17.2: Apply row/column header highlight classes for clean band appearance
function applyRowColHeaderHighlight() {
  // Clear previous row/col classes
  document.querySelectorAll('.row-selected, .col-selected').forEach((el) => {
    el.classList.remove('row-selected', 'col-selected');
  });
  document
    .querySelectorAll('.row-header-selected, .col-header-selected')
    .forEach((el) => {
      el.classList.remove('row-header-selected', 'col-header-selected');
    });

  if (appState.selectionMode === 'row') {
    const { startRow, endRow } = appState.selectionRange;
    const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
    for (let r = startRow; r <= resolvedEndRow; r++) {
      for (let c = 0; c < appState.COLS; c++) {
        const cell = getCellElement(r, c);
        if (cell) cell.classList.add('row-selected');
      }
      const rowHeader = document.querySelector(`.row-header[data-row="${r}"]`);
      if (rowHeader) rowHeader.classList.add('row-header-selected');
    }
  } else if (appState.selectionMode === 'column') {
    const { startCol, endCol } = appState.selectionRange;
    const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
    for (let c = startCol; c <= resolvedEndCol; c++) {
      for (let r = 0; r < appState.ROWS; r++) {
        const cell = getCellElement(r, c);
        if (cell) cell.classList.add('col-selected');
      }
      const colHeader = document.querySelector(
        `.column-header[data-col="${c}"]`
      );
      if (colHeader) colHeader.classList.add('col-header-selected');
    }
  }
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
export function selectionOverlapsMerge(startRow, startCol, endRow, endCol) {
  const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
  const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
  for (const m of appState.currentMerges) {
    const mEndRow = m.startRow + (m.rowSpan || 1) - 1;
    const mEndCol = m.startCol + (m.colSpan || 1) - 1;
    if (
      startRow <= mEndRow &&
      resolvedEndRow >= m.startRow &&
      startCol <= mEndCol &&
      resolvedEndCol >= m.startCol
    )
      return true;
  }
  return false;
}

// Story 11.5 / 13.1: Update Format menu Merge/Unmerge + Insert menu state
export function updateMergeMenuState() {
  if (!window.electronAPI?.updateMenuState) return;
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  const resolvedEndRow = endRow === OPEN_END ? appState.ROWS - 1 : endRow;
  const resolvedEndCol = endCol === OPEN_END ? appState.COLS - 1 : endCol;
  const cellCount =
    (resolvedEndRow - startRow + 1) * (resolvedEndCol - startCol + 1);
  const overlaps = selectionOverlapsMerge(startRow, startCol, endRow, endCol);
  const canMerge = cellCount >= 2 && !overlaps;
  const isSingleCell = cellCount === 1;
  const { merge, isAnchor } = getMergeInfo(
    startRow,
    startCol,
    appState.currentMerges
  );
  const canUnmerge = isSingleCell && merge && isAnchor;
  // Insert row: single row selection (open-ended endCol is fine)
  const canInsertRow =
    appState.selectionMode === 'row' && startRow === resolvedEndRow;
  // Insert column: single column selection (open-ended endRow is fine)
  const canInsertColumn =
    appState.selectionMode === 'column' && startCol === resolvedEndCol;
  window.electronAPI.updateMenuState({
    canMerge,
    canUnmerge,
    canInsertRow,
    canInsertColumn,
  });
}

// Select a cell (Story 11.5: extendSelection = true for Shift+click range selection)
export function selectCell(row, col, extendSelection = false) {
  ({ row, col } = resolveToAnchor(row, col));
  if (appState.isEditing) {
    if (window.__DEBUG__)
      console.log('Selecting new cell while editing - saving first');
    window.saveCurrentEditOnCellSwitch?.();
  }
  expandGridIfNeeded(row, col);
  applyCellSelection(row, col, extendSelection);
}

// Update the formula bar with the selected cell's content
export async function updateFormulaBar(row, col) {
  const cellRef = document.getElementById('cell-ref');
  const formulaBar = document.getElementById('formula-bar');
  if (!cellRef || !formulaBar) return;
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;

  // Story 17.5: Excel-style notation for open-ended row/column ranges
  if (appState.selectionMode === 'row') {
    const r2 = endRow === OPEN_END ? startRow : endRow;
    cellRef.value = `${startRow + 1}:${r2 + 1}`;
    formulaBar.value = '';
    return;
  }
  if (appState.selectionMode === 'column') {
    const c2 = endCol === OPEN_END ? startCol : endCol;
    cellRef.value = `${colToLetter(startCol)}:${colToLetter(c2)}`;
    formulaBar.value = '';
    return;
  }

  const isRange = startRow !== endRow || startCol !== endCol;
  if (isRange) {
    cellRef.value = `${colToLetter(startCol)}${startRow + 1}:${colToLetter(endCol)}${endRow + 1}`;
  } else {
    const ref = await GetCellRef(row, col);
    cellRef.value = ref;
  }
  const rawValue = await GetCellRawValue(row, col);
  formulaBar.value = rawValue || '';
}
