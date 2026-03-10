// Shared mutable application state — imported by all app-*.js modules.
// Properties are read and written directly on this object so that all modules
// see the same values without needing a bundler.

export const appState = {
  // Grid dimensions (expand automatically via infinite scroll)
  ROWS: 100,
  COLS: 26,

  // Cell selection and editing
  selectedCell: null,
  isEditing: false,
  isReadOnly: false, // Story 16.4

  // Story 11.5: Selection range (startRow, startCol, endRow, endCol)
  // Single cell when startRow===endRow && startCol===endCol
  selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },

  // Story 13.1: Selection mode ('cell' | 'row' | 'column')
  selectionMode: 'cell',

  // Story 11.3: Cached merge regions (updated by buildSpreadsheet)
  currentMerges: [],

  // Story 13.10: RTL mode flag — set from persisted settings on startup
  isRTL: false,
};

// Grid expansion constants (read-only)
export const EXPAND_THRESHOLD = 10;
export const EXPAND_ROWS = 50;
export const EXPAND_COLS = 10;

// Story 17.5: Sentinel for open-ended row/column ranges.
// selectionRange.endCol === OPEN_END means "all columns"; endRow === OPEN_END means "all rows".
export const OPEN_END = Infinity;
