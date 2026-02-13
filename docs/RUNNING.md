# Running GoSheet

## How to Run

The GoSheet application has been built and is ready to run.

### From Terminal

```bash
cd /Users/ysheffer/misc/spreadsheet
./gosheet
```

### What You Should See

When you run `./gosheet`, a window should appear with:

1. **Title**: "GoSheet - Spreadsheet"
2. **Menu Bar**: File, Edit, Help menus
3. **Formula Bar**: Shows current cell (A1) and an input field
4. **Spreadsheet Grid**: 
   - Column headers: A, B, C, D, E, F, G, H, I, J
   - Row headers: 1, 2, 3, ... 20
   - Sample data pre-loaded:
     - A1: 10
     - A2: 20
     - A3: 30
     - A4: 60 (calculated from =SUM(A1:A3))
     - B1: 20 (calculated from =A1*2)

### Interacting with the App

- **Click a cell** to select it (shows a dialog to edit)
- **Enter values or formulas** in the edit dialog
- **Formulas** start with `=` (e.g., `=A1+A2`, `=SUM(A1:A10)`)
- **Menu options**:
  - File → New, Open, Save, Save As, Quit
  - Edit → Clear Cell, Clear All
  - Help → About

### Troubleshooting

If the window doesn't appear:

1. **Check if it's running**:
   ```bash
   ps aux | grep gosheet
   ```

2. **Check for errors**:
   ```bash
   ./gosheet 2>&1 | tee gosheet.log
   ```

3. **Rebuild if needed**:
   ```bash
   go build -o gosheet
   ```

4. **macOS Permissions**: 
   - First time running, macOS may ask for permissions
   - Check System Settings → Privacy & Security

### Testing the Formula Engine

Try entering these formulas:
- `=2+2` → should show 4
- `=A1*2` → should show 20 (if A1=10)
- `=SUM(A1:A3)` → should show 60 (if A1=10, A2=20, A3=30)
- `=AVG(A1:A3)` → should show 20
- `=MAX(A1:A3)` → should show 30

### Current Limitations

- Cell editing uses a dialog (inline editing not yet implemented)
- File save/load not yet implemented
- Keyboard navigation limited
- No undo/redo

### Next Steps

If you can see and interact with the application:
1. Try entering some values
2. Try some formulas
3. Test the menu options
4. Report any issues you encounter

The application is functional and demonstrates the core spreadsheet engine working with the UI!
