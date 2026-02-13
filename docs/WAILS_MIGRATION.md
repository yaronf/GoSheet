# Wails Migration Plan

## Why Migrate to Wails?

### Current Issues with Fyne
1. **In-cell editing is difficult** - Table cells are labels, not editable widgets
2. **Dialog-based editing** - Not the standard spreadsheet UX
3. **Limited table features** - Basic table widget without advanced features

### Benefits of Wails
1. **Professional UI** - Use proven JavaScript spreadsheet libraries (ag-Grid, Handsontable, etc.)
2. **True in-cell editing** - Native HTML input behavior
3. **Better UX** - Modern web technologies for UI
4. **Reuse existing code** - Web demo can be adapted
5. **Keep Go backend** - All core logic (model, formulas, controller) stays in Go

## Architecture

### Before (Fyne)
```
┌─────────────────────────────────┐
│   Fyne UI (Go)                  │
│   - Grid widget                 │
│   - Dialogs                     │
├─────────────────────────────────┤
│   Controller (Go)               │
├─────────────────────────────────┤
│   Model (Go)                    │
│   - Spreadsheet                 │
│   - Formulas                    │
└─────────────────────────────────┘
```

### After (Wails)
```
┌─────────────────────────────────┐
│   Frontend (HTML/CSS/JS)        │
│   - Spreadsheet component       │
│   - Modern UI                   │
├─────────────────────────────────┤
│   Wails Bridge                  │
├─────────────────────────────────┤
│   Backend (Go)                  │
│   - Controller                  │
│   - Model                       │
│   - Formulas                    │
└─────────────────────────────────┘
```

## Migration Steps

### Phase 1: Setup ✅ NEXT
1. Install Wails CLI
2. Create new Wails project structure
3. Set up build configuration

### Phase 2: Backend Integration
1. Copy existing Go code (model, controller, formulas)
2. Create Wails API bindings
3. Expose spreadsheet operations to frontend

### Phase 3: Frontend Development
1. Choose spreadsheet library (ag-Grid, Handsontable, or custom)
2. Implement spreadsheet UI
3. Connect to Go backend via Wails bindings
4. Add formula bar, cell editing, etc.

### Phase 4: Testing
1. Adapt Playwright tests for new UI
2. Test all formulas and operations
3. Performance testing

### Phase 5: Packaging
1. Build macOS app bundle
2. Add icon and metadata
3. Create installer/DMG

## Code Reuse

### Keep (Go Backend)
- ✅ `model/` - All spreadsheet logic
- ✅ `controller/` - Application controller
- ✅ `tests/` - Unit tests for Go code

### Adapt (Web Frontend)
- ✅ `cmd/webdemo/main.go` - Use as reference for API design
- ⚠️ HTML/CSS from web demo - Enhance with proper spreadsheet component

### Replace (UI Layer)
- ❌ `ui/` - Fyne-specific code
- ❌ `main.go` - Replace with Wails entry point

## Spreadsheet Library Options

### 1. ag-Grid (Recommended)
- **Pros**: Professional, feature-rich, excellent performance
- **Cons**: Commercial license for some features
- **Best for**: Production-quality spreadsheet

### 2. Handsontable
- **Pros**: Excel-like interface, good documentation
- **Cons**: Commercial license required
- **Best for**: Excel replacement feel

### 3. Custom with React/Vue
- **Pros**: Full control, no licensing
- **Cons**: More work to implement
- **Best for**: Learning/customization

### 4. Luckysheet
- **Pros**: Open source, Excel-like
- **Cons**: Less maintained
- **Best for**: Free alternative

## Timeline Estimate

- **Phase 1 (Setup)**: 1-2 hours
- **Phase 2 (Backend)**: 2-3 hours
- **Phase 3 (Frontend)**: 4-6 hours
- **Phase 4 (Testing)**: 2-3 hours
- **Phase 5 (Packaging)**: 1-2 hours

**Total**: ~10-16 hours of work

## Success Criteria

- ✅ In-cell editing works naturally
- ✅ All existing formulas work (SUM, AVG, MIN, MAX, COUNT)
- ✅ Row/column headers visible
- ✅ Professional look and feel
- ✅ Native macOS app packaging
- ✅ All Playwright tests pass

## Rollback Plan

If Wails migration fails:
1. Keep existing Fyne app in `build/` folder
2. All Go backend code is preserved
3. Can continue with Fyne or try another framework

## Next Steps

1. Install Wails: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
2. Initialize Wails project: `wails init`
3. Begin backend integration

---

**Status**: Ready to begin
**Decision Date**: 2026-02-13
**Approved By**: User
