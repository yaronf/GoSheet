// app-utils.js — Pure utility functions shared across app modules.
// No shared mutable state dependencies (except announceToScreenReader which uses appState
// indirectly via isEditing check in forceCleanupEditing).

import { appState } from './app-state.js';

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
    overlay.classList.add('active');

    const handleOk = () => {
      overlay.classList.remove('active');
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

// Story 17.4: Parse a cell or range address string into row/col bounds.
// Returns { startRow, startCol, endRow, endCol } (0-indexed) or null if invalid.
// Note: zero-padded rows (e.g. "A01") are accepted and treated as "A1" — parseInt
// ignores leading zeros with radix 10. This matches Excel/Sheets behaviour.
export function parseRangeAddress(text) {
  if (!text) return null;
  const upper = text.trim().toUpperCase();
  const singleMatch = upper.match(/^([A-Z]+)(\d+)$/);
  if (singleMatch) {
    const col = letterToCol(singleMatch[1]);
    const row = parseInt(singleMatch[2], 10) - 1;
    if (col < 0 || row < 0 || col > 999 || row > 9999) return null;
    return { startRow: row, startCol: col, endRow: row, endCol: col };
  }
  const rangeMatch = upper.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (rangeMatch) {
    const startCol = letterToCol(rangeMatch[1]);
    const startRow = parseInt(rangeMatch[2], 10) - 1;
    const endCol = letterToCol(rangeMatch[3]);
    const endRow = parseInt(rangeMatch[4], 10) - 1;
    if (
      startCol < 0 ||
      startRow < 0 ||
      endCol < 0 ||
      endRow < 0 ||
      startCol > 999 ||
      endCol > 999 ||
      startRow > 9999 ||
      endRow > 9999
    )
      return null;
    return {
      startRow: Math.min(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endRow: Math.max(startRow, endRow),
      endCol: Math.max(startCol, endCol),
    };
  }
  return null;
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
