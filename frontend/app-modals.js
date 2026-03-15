// app-modals.js — Modal dialogs: Formula Reference, User Guide, Manage Styles, CSV Preview.

import {
  GetFileStatus,
  ImportCSV,
  GetStyles,
  UpdateStyle,
  AddStyle,
  DeleteStyle,
} from './api-client.js';
import { appState } from './app-state.js';
import {
  setupDialogFocusTrap,
  showAlert,
  showConfirmDialog,
} from './app-utils.js';

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
<tr><td>^</td><td>Exponentiation (right-associative)</td><td><code>=2^10</code> → 1024</td></tr>
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
<tr><td>SQRT</td><td>SQRT(number)</td><td><code>=SQRT(A1)</code></td></tr>
<tr><td>STDEV</td><td>STDEV(range) — sample std dev</td><td><code>=STDEV(A1:A10)</code></td></tr>
<tr><td>ABS</td><td>ABS(number)</td><td><code>=ABS(A1-B1)</code></td></tr>
<tr><td>ROUND</td><td>ROUND(number, decimals)</td><td><code>=ROUND(A1,2)</code></td></tr>
<tr><td>FLOOR</td><td>FLOOR(number)</td><td><code>=FLOOR(A1)</code></td></tr>
<tr><td>CEIL</td><td>CEIL(number)</td><td><code>=CEIL(A1)</code></td></tr>
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

export function showFormulaHelpModal() {
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

export async function showUserGuideModal() {
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

/** Apply alignment and wrap CSS from format to css object. */
function applyAlignmentCss(css, alignment) {
  const h = alignment?.horizontal;
  if (h && h !== 'default') css.textAlign = h;
  if (alignment?.vertical) css.verticalAlign = alignment.vertical;
  css.whiteSpace = alignment?.wrap ? 'normal' : 'nowrap';
  if (alignment?.wrap) css.wordWrap = 'break-word';
}

// Story 13.3: Manage Styles modal — preview applies style to the name text
export function formatToCssPreview(f) {
  if (!f) return {};
  const css = {};
  const font = f.font;
  if (font?.name) css.fontFamily = `${font.name}, sans-serif`;
  if (font?.size) css.fontSize = `${font.size}pt`;
  if (font?.bold) css.fontWeight = 'bold';
  if (font?.italic) css.fontStyle = 'italic';
  if (font?.color) css.color = font.color;
  if (f.fill?.pattern === 'solid' && f.fill?.fgColor)
    css.backgroundColor = f.fill.fgColor;
  applyBorderCss(css, f.border);
  applyAlignmentCss(css, f.alignment);
  return css;
}

/** Write border CSS properties into css object from a border format descriptor. */
export function applyBorderCss(css, border) {
  if (!border) return;
  for (const [side, cap] of [
    ['left', 'Left'],
    ['right', 'Right'],
    ['top', 'Top'],
    ['bottom', 'Bottom'],
  ]) {
    const s = border[side];
    if (s?.style && s.style !== 'none') {
      const width = s.style === 'medium' ? '3px' : '2px';
      css[`border${cap}`] = `${width} solid ${s.color || '#000000'}`;
    }
  }
}

export function formatFromForm() {
  return {
    font: formatFromFormFont(),
    fill: formatFromFormFill(),
    border: formatFromFormBorder(),
    alignment: {
      horizontal: document.getElementById('manage-styles-align-h')?.value || '',
      vertical:
        document.getElementById('manage-styles-align-v')?.value || 'center',
      wrap: document.getElementById('manage-styles-wrap')?.checked ?? false,
    },
  };
}

function formatFromFormFont() {
  const sizeEl = document.getElementById('manage-styles-font-size');
  return {
    name:
      document.getElementById('manage-styles-font-name')?.value?.trim() ||
      'Helvetica',
    size: parseInt(sizeEl?.value || '12', 10) || 12,
    bold: document.getElementById('manage-styles-font-bold')?.checked || false,
    italic:
      document.getElementById('manage-styles-font-italic')?.checked || false,
    color:
      document.getElementById('manage-styles-font-color')?.value || '#000000',
  };
}

function formatFromFormFill() {
  const fillColorEl = document.getElementById('manage-styles-fill-color');
  const fillEnabled = document.getElementById(
    'manage-styles-fill-enabled'
  )?.checked;
  return {
    pattern: fillEnabled ? 'solid' : 'none',
    fgColor: fillColorEl?.value || '#E0E0E0',
    bgColor: fillColorEl?.value || '#E0E0E0',
  };
}

function formatFromFormBorder() {
  const borderColor =
    document.getElementById('manage-styles-border-color')?.value || '#000000';
  const borderSide = (id) =>
    document.getElementById(id)?.checked ? 'thin' : 'none';
  return {
    left: {
      style: borderSide('manage-styles-border-left'),
      color: borderColor,
    },
    right: {
      style: borderSide('manage-styles-border-right'),
      color: borderColor,
    },
    top: { style: borderSide('manage-styles-border-top'), color: borderColor },
    bottom: {
      style: borderSide('manage-styles-border-bottom'),
      color: borderColor,
    },
  };
}

export function populateFormFromFormat(style) {
  const f = style?.format || {};
  const el = (id) => document.getElementById(id);
  if (el('manage-styles-name'))
    el('manage-styles-name').value = style?.name || '';
  populateFormFontProps(el, f);
  populateFormFillProps(el, f);
  populateFormBorderProps(el, f);
  populateFormAlignmentProps(el, f);
}

function populateFormFontProps(el, f) {
  const fontColor = f.font?.color || '#000000';
  const size = f.font?.size || 12;
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
}

function populateFormFillProps(el, f) {
  const fillColor = f.fill?.fgColor || f.fill?.bgColor || '#E0E0E0';
  if (el('manage-styles-fill-enabled'))
    el('manage-styles-fill-enabled').checked = f.fill?.pattern === 'solid';
  if (el('manage-styles-fill-color'))
    el('manage-styles-fill-color').value = fillColor;
  if (el('manage-styles-fill-color-picker'))
    el('manage-styles-fill-color-picker').value = fillColor;
}

function populateFormBorderProps(el, f) {
  const border = f.border;
  if (!border) return;
  if (el('manage-styles-border-left'))
    el('manage-styles-border-left').checked = border.left?.style === 'thin';
  if (el('manage-styles-border-right'))
    el('manage-styles-border-right').checked = border.right?.style === 'thin';
  if (el('manage-styles-border-top'))
    el('manage-styles-border-top').checked = border.top?.style === 'thin';
  if (el('manage-styles-border-bottom'))
    el('manage-styles-border-bottom').checked = border.bottom?.style === 'thin';
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

function populateFormAlignmentProps(el, f) {
  if (el('manage-styles-align-h'))
    el('manage-styles-align-h').value = f.alignment?.horizontal || '';
  if (el('manage-styles-align-v'))
    el('manage-styles-align-v').value = f.alignment?.vertical || 'center';
  const wrapEl = el('manage-styles-wrap');
  if (wrapEl) wrapEl.checked = !!f.alignment?.wrap;
}

export async function showManageStylesModal() {
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

  // Story 13.3b: Sync color pickers with hex inputs and font size range (one-time setup)
  if (!modal.dataset.styleFormSetup) {
    setupStyleFormColorPickers();
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
            if (window.displayFileStatus) window.displayFileStatus(true);
            await renderList();
            await window.buildSpreadsheet?.();
            window.refreshAllCells?.();
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
        await UpdateStyle(editingStyle.id, format, '');
      } else if (editingId) {
        await UpdateStyle(editingId, format, '');
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
        await AddStyle(name, format);
      }
      if (window.displayFileStatus) window.displayFileStatus(true);
      hideForm();
      await renderList();
      await window.buildSpreadsheet?.();
      window.refreshAllCells?.();
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
    window.buildSpreadsheet?.().then(() => window.refreshAllCells?.());
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

function setupStyleFormColorPickers() {
  const hexRe = /^#[0-9A-Fa-f]{6}$/;
  const syncPair = (pickerId, hexId) => {
    const picker = document.getElementById(pickerId);
    const hex = document.getElementById(hexId);
    if (picker && hex) {
      picker.addEventListener('input', () => {
        hex.value = picker.value;
      });
      hex.addEventListener('input', () => {
        if (hexRe.test(hex.value)) picker.value = hex.value;
      });
    }
  };
  syncPair('manage-styles-font-color-picker', 'manage-styles-font-color');
  syncPair('manage-styles-fill-color-picker', 'manage-styles-fill-color');
  syncPair('manage-styles-border-color-picker', 'manage-styles-border-color');

  const fontSizeRange = document.getElementById('manage-styles-font-size');
  const fontSizeOutput = document.getElementById(
    'manage-styles-font-size-value'
  );
  if (fontSizeRange && fontSizeOutput) {
    fontSizeRange.addEventListener('input', () => {
      fontSizeOutput.textContent = fontSizeRange.value;
    });
  }
}

// Story 7.12 / 16.3: CSV Import Preview Modal
export function showCSVPreviewModal(preview) {
  const modal = document.getElementById('csv-preview-modal');
  const infoEl = document.getElementById('csv-preview-info');
  const tableEl = document.getElementById('csv-preview-table');
  const importBtn = document.getElementById('csv-preview-import');
  const cancelBtn = document.getElementById('csv-preview-cancel');

  const filename = preview.path.split('/').pop();
  infoEl.innerHTML = `
        <p><strong>File:</strong> ${filename}</p>
        <p><strong>Size:</strong> ${preview.rows} rows × ${preview.cols} columns</p>
        <p><strong>Preview:</strong> First ${preview.preview.length} rows</p>
    `;

  let tableHTML = '<thead><tr>';
  for (let col = 0; col < preview.cols; col++) {
    const colLetter = String.fromCharCode(65 + (col % 26));
    tableHTML += `<th>${colLetter}</th>`;
  }
  tableHTML += '</tr></thead><tbody>';
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

  const handleCancel = () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    importBtn.removeEventListener('click', handleImport);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleImport = async () => {
    modal.classList.remove('active');
    removeFocusTrap?.();
    importBtn.removeEventListener('click', handleImport);
    cancelBtn.removeEventListener('click', handleCancel);

    try {
      const status = await GetFileStatus();
      if (status.hasUnsavedChanges) {
        const confirmed = await showConfirmDialog(
          'You have unsaved changes! Import CSV anyway? All unsaved changes will be lost.'
        );
        if (!confirmed) return;
      }

      const result = await ImportCSV(preview.path);
      appState.ROWS = Math.max(100, result.rows);
      appState.COLS = Math.max(26, result.cols);
      await window.buildSpreadsheet?.();
      await window.loadCells?.();
      window.selectCell?.(0, 0);
      window.updateFileStatus?.();
      window.syncFormatMenuFromApi?.();

      if (window.__DEBUG__) console.log(`CSV imported: ${result.message}`);
    } catch (error) {
      await showAlert('Error importing CSV: ' + error.message);
    }
  };

  modal.classList.add('active');
  const removeFocusTrap = setupDialogFocusTrap(modal, handleCancel);
  cancelBtn.focus();

  importBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) handleCancel();
  });
}
