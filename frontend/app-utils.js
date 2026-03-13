// app-utils.js — Pure utility functions shared across app modules.
// No shared mutable state dependencies (except announceToScreenReader which uses appState
// indirectly via isEditing check in forceCleanupEditing).

import { appState, OPEN_END } from './app-state.js';

// Story 10.7: Focus trap for dialogs - Tab cycles within dialog, Escape closes
export function setupDialogFocusTrap(overlay, onClose) {
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
export function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');

    messageEl.textContent = message;
    overlay.classList.add('active', 'modal-confirm');

    const handleOk = () => {
      overlay.classList.remove('active', 'modal-confirm');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
      removeFocusTrap?.();
      resolve(true);
    };

    const handleCancel = () => {
      overlay.classList.remove('active', 'modal-confirm');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
      removeFocusTrap?.();
      resolve(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCancel();
    };

    const removeFocusTrap = setupDialogFocusTrap(overlay, handleCancel);

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });

    okBtn.focus();
  });
}

/**
 * Show a simple alert dialog with only OK button.
 * @param {string} message
 * @returns {Promise<void>}
 */
export function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');

    messageEl.textContent = message;
    cancelBtn.style.display = 'none';
    overlay.classList.add('active', 'modal-confirm');

    const handleOk = () => {
      overlay.classList.remove('active', 'modal-confirm');
      cancelBtn.style.display = '';
      okBtn.removeEventListener('click', handleOk);
      document.removeEventListener('keydown', handleKeyDown);
      overlay.removeEventListener('click', handleOverlayClick);
      removeFocusTrap?.();
      resolve();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleOk();
    };

    const removeFocusTrap = setupDialogFocusTrap(overlay, handleOk);

    okBtn.addEventListener('click', handleOk);
    document.addEventListener('keydown', handleKeyDown);

    const handleOverlayClick = (e) => {
      if (e.target === overlay) handleOk();
    };
    overlay.addEventListener('click', handleOverlayClick);

    okBtn.focus();
  });
}

// Force cleanup of any editing state
export function forceCleanupEditing() {
  if (window.__DEBUG__) console.log('Force cleanup editing state');
  appState.isEditing = false;
  document.querySelectorAll('.cell-editor').forEach((input) => {
    if (window.__DEBUG__) console.log('Removing leftover input element');
    input.remove();
  });
}

// Convert column index to letter (0 -> A, 25 -> Z, 26 -> AA)
export function colToLetter(col) {
  let result = '';
  col++;
  while (col > 0) {
    col--;
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26);
  }
  return result;
}

// Convert letter to column index (A -> 0, Z -> 25, AA -> 26)
export function letterToCol(letter) {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

// Story 17.4 / 19.5: Parse a cell or range address string into row/col bounds.
// Returns { startRow, startCol, endRow, endCol, mode } (0-indexed) or null if invalid.
// mode: 'cell' | 'row' | 'column' — used by address box handler to set selectionMode.
// Note: zero-padded rows (e.g. "A01") are accepted and treated as "A1" — parseInt
// ignores leading zeros with radix 10. This matches Excel/Sheets behaviour.
export function parseRangeAddress(text) {
  if (!text) return null;
  const upper = text.trim().toUpperCase();
  return (
    parseColRange(upper) ||
    parseRowRange(upper) ||
    parseSingleCell(upper) ||
    parseCellRange(upper)
  );
}

function parseColRange(upper) {
  const m = upper.match(/^([A-Z]+):([A-Z]+)$/);
  if (!m) return null;
  const c1 = letterToCol(m[1]);
  const c2 = letterToCol(m[2]);
  if (c1 < 0 || c2 < 0 || c1 > 999 || c2 > 999) return null;
  return {
    startRow: 0,
    startCol: Math.min(c1, c2),
    endRow: OPEN_END,
    endCol: Math.max(c1, c2),
    mode: 'column',
  };
}

function parseRowRange(upper) {
  const m = upper.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  const r1 = parseInt(m[1], 10) - 1;
  const r2 = parseInt(m[2], 10) - 1;
  if (r1 < 0 || r2 < 0 || r1 > 9999 || r2 > 9999) return null;
  return {
    startRow: Math.min(r1, r2),
    startCol: 0,
    endRow: Math.max(r1, r2),
    endCol: OPEN_END,
    mode: 'row',
  };
}

function parseSingleCell(upper) {
  const m = upper.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = letterToCol(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || row < 0 || col > 999 || row > 9999) return null;
  return {
    startRow: row,
    startCol: col,
    endRow: row,
    endCol: col,
    mode: 'cell',
  };
}

function parseCellRange(upper) {
  const m = upper.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  const c1 = letterToCol(m[1]);
  const r1 = parseInt(m[2], 10) - 1;
  const c2 = letterToCol(m[3]);
  const r2 = parseInt(m[4], 10) - 1;
  if (
    c1 < 0 ||
    r1 < 0 ||
    c2 < 0 ||
    r2 < 0 ||
    c1 > 999 ||
    c2 > 999 ||
    r1 > 9999 ||
    r2 > 9999
  )
    return null;
  return {
    startRow: Math.min(r1, r2),
    startCol: Math.min(c1, c2),
    endRow: Math.max(r1, r2),
    endCol: Math.max(c1, c2),
    mode: 'cell',
  };
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

export function announceToScreenReader(message) {
  srAnnouncer.textContent = message;
  setTimeout(() => {
    srAnnouncer.textContent = '';
  }, 1000);
}
