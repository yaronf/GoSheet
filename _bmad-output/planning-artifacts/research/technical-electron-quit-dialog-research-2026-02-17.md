# Technical Research: Electron Quit Warning Dialog

**Date:** 2026-02-17  
**Story:** 7.11 - Implement Quit Warning Dialog  
**Researcher:** AI Development Agent  
**Status:** Complete

---

## Executive Summary

Implementing a quit warning dialog in Electron is more complex than it appears. The previous attempt failed because:

1. **Async/await timing issues** with `event.preventDefault()`
2. **App became unusable after canceling** the dialog
3. **Recursive close problems** when trying to close after confirmation
4. **State management confusion** with the `isQuitting` flag

This research identifies the **correct pattern** and explains why the previous approach failed.

---

## The Problem

When a user tries to quit an Electron app with unsaved changes, we want to:
1. Show a native dialog asking for confirmation
2. If they click "Cancel", keep the app running and fully usable
3. If they click "Quit Without Saving", close the app
4. If there are no unsaved changes, quit immediately without showing a dialog

The challenge is that `dialog.showMessageBox()` is **async** (returns a Promise), but the `close` event handler needs to **synchronously** decide whether to prevent the close.

---

## What Went Wrong in Previous Attempt

### Issue 1: Unconditional preventDefault()

```javascript
mainWindow.on('close', async (event) => {
  if (isQuitting) return;
  
  event.preventDefault(); // ❌ ALWAYS prevents close
  
  const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript('...');
  // ... show dialog ...
});
```

**Problem:** Calling `preventDefault()` unconditionally means the window is always prevented from closing, even when we later decide to allow it. This can leave the app in a broken state.

### Issue 2: Recursive Close with mainWindow.close()

```javascript
if (choice.response === 1) {
  isQuitting = true;
  mainWindow.close(); // ❌ Triggers the close event again
}
```

**Problem:** Calling `mainWindow.close()` triggers the `close` event again, leading to potential infinite loops or unexpected behavior even with the `isQuitting` flag.

### Issue 3: App Unusable After Cancel

**Problem:** After clicking "Cancel" in the dialog, the app window remained open but was unresponsive. This is likely because:
- The `preventDefault()` was called unconditionally
- The event loop was blocked or in an unexpected state
- The window's internal state thought it was still closing

---

## The Correct Pattern

Based on research and Electron best practices, here's the **working pattern**:

```javascript
let isQuitting = false;

mainWindow.on('close', (event) => {
  // If we've already decided to quit, allow the close
  if (isQuitting) {
    return;
  }
  
  // ALWAYS prevent the close initially
  event.preventDefault();
  
  // Check for unsaved changes (async)
  mainWindow.webContents.executeJavaScript('window.currentHasUnsavedChanges')
    .then(hasUnsavedChanges => {
      if (hasUnsavedChanges) {
        // Show dialog (async)
        return dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Cancel', 'Quit Without Saving'],
          defaultId: 0,
          title: 'Unsaved Changes',
          message: 'You have unsaved changes.',
          detail: 'Do you want to quit without saving?'
        });
      } else {
        // No unsaved changes, quit immediately
        isQuitting = true;
        app.quit();
        return null;
      }
    })
    .then(choice => {
      if (choice && choice.response === 1) {
        // User chose "Quit Without Saving"
        isQuitting = true;
        app.quit();
      }
      // If choice.response === 0 or choice is null, do nothing
      // Window stays open and remains usable
    })
    .catch(error => {
      console.error('[Electron] Error in quit dialog:', error);
      // On error, allow quit to avoid trapping user
      isQuitting = true;
      app.quit();
    });
});
```

### Key Differences from Previous Attempt

1. **No async/await:** Use promise chains (`.then()`) instead of `async/await` to avoid timing issues
2. **Use app.quit():** Never call `mainWindow.close()` recursively - use `app.quit()` instead
3. **Always preventDefault():** Call it immediately, then decide later whether to actually quit
4. **Proper promise chaining:** Handle both the executeJavaScript and showMessageBox promises in sequence
5. **Error handling:** Catch errors and allow quit to avoid trapping the user

---

## Why This Pattern Works

### 1. Synchronous preventDefault()

The `event.preventDefault()` is called **immediately and synchronously** at the start of the handler. This is required because the event handler must decide synchronously whether to allow the close.

### 2. Promise Chain for Async Operations

By using `.then()` chains instead of `async/await`, we ensure:
- The event handler returns immediately after calling `preventDefault()`
- The async operations (checking status, showing dialog) happen in the background
- The window remains responsive while waiting for user input

### 3. app.quit() Instead of mainWindow.close()

Using `app.quit()` instead of `mainWindow.close()`:
- Avoids recursive triggering of the `close` event
- Properly terminates the entire application
- Works correctly with the `isQuitting` flag

### 4. Flag-Based State Management

The `isQuitting` flag:
- Must be at **module level** (not inside the handler)
- Prevents the dialog from showing twice
- Allows the close event to proceed when we've decided to quit

---

## Implementation Checklist

### Frontend Changes (frontend/app.js)

- [ ] Expose `window.currentHasUnsavedChanges` variable
- [ ] Update `displayFileStatus()` to set this variable
- [ ] Ensure it's synchronized with the actual file status

```javascript
// At module level
window.currentHasUnsavedChanges = false;

// In displayFileStatus()
async function displayFileStatus() {
  const status = await GetFileStatus();
  const statusEl = document.getElementById('file-status');
  
  if (status.current_file) {
    if (status.has_unsaved_changes) {
      statusEl.textContent = `${status.current_file} - Unsaved changes`;
      statusEl.className = 'status-unsaved';
      window.currentHasUnsavedChanges = true; // ✅ Set flag
    } else {
      statusEl.textContent = status.current_file;
      statusEl.className = 'status-saved';
      window.currentHasUnsavedChanges = false; // ✅ Clear flag
    }
  } else {
    statusEl.textContent = 'Untitled - Unsaved changes';
    statusEl.className = 'status-unsaved';
    window.currentHasUnsavedChanges = true; // ✅ Set flag
  }
}
```

### Main Process Changes (electron/main.js)

- [ ] Add module-level `isQuitting` flag
- [ ] Implement `close` event handler with correct pattern
- [ ] Use promise chains (not async/await)
- [ ] Use `app.quit()` (not `mainWindow.close()`)
- [ ] Add error handling

```javascript
// At module level (outside createWindow)
let isQuitting = false;

// Inside createWindow(), after mainWindow is created
mainWindow.on('close', (event) => {
  if (isQuitting) {
    return;
  }
  
  event.preventDefault();
  
  mainWindow.webContents.executeJavaScript('window.currentHasUnsavedChanges')
    .then(hasUnsavedChanges => {
      if (hasUnsavedChanges) {
        return dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Cancel', 'Quit Without Saving'],
          defaultId: 0,
          title: 'Unsaved Changes',
          message: 'You have unsaved changes.',
          detail: 'Do you want to quit without saving?'
        });
      } else {
        isQuitting = true;
        app.quit();
        return null;
      }
    })
    .then(choice => {
      if (choice && choice.response === 1) {
        isQuitting = true;
        app.quit();
      }
    })
    .catch(error => {
      console.error('[Electron] Error in quit dialog:', error);
      isQuitting = true;
      app.quit();
    });
});
```

---

## Testing Strategy

### Manual Test Cases

1. **Quit with Unsaved Changes - Cancel**
   - Open app, edit a cell
   - Press Cmd+Q
   - Verify dialog appears
   - Click "Cancel"
   - **Verify app is still fully usable** (edit another cell, use menus)
   - Press Cmd+Q again
   - Verify dialog appears again

2. **Quit with Unsaved Changes - Confirm**
   - Open app, edit a cell
   - Press Cmd+Q
   - Click "Quit Without Saving"
   - Verify app quits immediately

3. **Quit without Unsaved Changes**
   - Open app (don't edit)
   - Press Cmd+Q
   - Verify app quits immediately (no dialog)

4. **Save Then Quit**
   - Open app, edit a cell
   - Save (Cmd+S)
   - Press Cmd+Q
   - Verify app quits immediately (no dialog)

5. **Window Close Button**
   - Repeat tests 1-4 using the red close button instead of Cmd+Q

6. **Multiple Quit Attempts**
   - Open app, edit a cell
   - Press Cmd+Q rapidly 3 times
   - Verify only one dialog appears
   - Click "Cancel"
   - Verify app is still usable

### Edge Cases

- [ ] Test with DevTools open
- [ ] Test with DevTools closed
- [ ] Test with multiple windows (if applicable)
- [ ] Test during file save operation
- [ ] Test during file load operation
- [ ] Test with network errors (if backend is unavailable)

---

## Known Limitations

1. **beforeunload Not Used:** The web standard `beforeunload` event doesn't work reliably in Electron, especially with DevTools closed. We use the main process `close` event instead.

2. **Synchronous Requirement:** The event handler must call `preventDefault()` synchronously, which means we can't `await` the status check before deciding. We always prevent, then decide later.

3. **Flag Reset:** The `isQuitting` flag is never reset. This is intentional - once we decide to quit, we should quit. If we need to support "restart" functionality later, we'd need to reset it in the `activate` event.

4. **Single Window:** This pattern assumes a single main window. If we add multiple windows later, we'd need to track each window's state separately.

---

## Alternative Approaches Considered

### 1. beforeunload Event (Rejected)

```javascript
// ❌ Doesn't work reliably in Electron
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = true;
  }
});
```

**Why rejected:** Known Electron bug where this doesn't work with DevTools closed or with single windows.

### 2. IPC Message for Status (Rejected)

```javascript
// ❌ Too complex
ipcRenderer.send('check-unsaved-changes');
ipcMain.on('check-unsaved-changes', (event) => {
  event.reply('unsaved-changes-status', hasUnsavedChanges);
});
```

**Why rejected:** Adds unnecessary complexity. Direct `executeJavaScript()` is simpler and more reliable.

### 3. Polling Status (Rejected)

```javascript
// ❌ Inefficient and error-prone
setInterval(() => {
  const status = await GetFileStatus();
  cachedHasUnsavedChanges = status.has_unsaved_changes;
}, 1000);
```

**Why rejected:** Wasteful polling when we already track status in real-time via `displayFileStatus()`.

---

## References

- [Electron BrowserWindow close event docs](https://www.electronjs.org/docs/latest/api/browser-window#event-close)
- [Electron dialog.showMessageBox docs](https://www.electronjs.org/docs/latest/api/dialog#dialogshowmessageboxbrowserwindow-options)
- [Stack Overflow: Electron app close dialog with message box confirmation](https://stackoverflow.com/questions/69233432/electron-app-close-dialog-with-message-box-confirmation)
- [Stack Overflow: Electron.js prevent windows close conditionally](https://stackoverflow.com/questions/51061143/electron-js-prevent-windows-close-conditionally)
- [GitHub Issue: beforeunload doesn't work with DevTools closed](https://github.com/electron/electron/issues/10360)

---

## Conclusion

The quit warning dialog is implementable in Electron, but requires careful attention to:
1. **Async handling:** Use promise chains, not async/await
2. **Event prevention:** Always call `preventDefault()` immediately
3. **State management:** Use module-level flag, never reset it
4. **Quit method:** Use `app.quit()`, never `mainWindow.close()`
5. **Testing:** Verify app remains usable after canceling

The pattern documented here should work reliably based on Electron best practices and community experience. The key insight is that we must **always prevent the close initially**, then decide asynchronously whether to actually quit.

---

## Next Steps

1. Review this research document
2. Implement the pattern exactly as documented
3. Test thoroughly, especially the "Cancel" scenario
4. Add Playwright tests once manual testing confirms it works
5. Document the implementation in the story's Dev Agent Record

---

**End of Research Document**
