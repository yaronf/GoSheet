# GoSheet User Guide

Welcome to GoSheet, a lightweight spreadsheet application for macOS. This guide helps you get started and use all features effectively.

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Basic Operations](#2-basic-operations)
3. [Working with Cells](#3-working-with-cells)
4. [Using Formulas](#4-using-formulas)
5. [Keyboard Shortcuts](#5-keyboard-shortcuts)
6. [CSV Import/Export](#6-csv-importexport)
7. [File Formats](#7-file-formats)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Getting Started

### Launching GoSheet

1. Open **GoSheet** from your Applications folder or by double-clicking the app icon.
2. On first launch, macOS may ask you to confirm—click **Open** if you see a security prompt.
3. The app opens with either the **Welcome Screen** (if no file is open) or your last spreadsheet.

### Welcome Screen

When you launch GoSheet with no file open, you'll see the welcome screen with these options:

- **Create New Spreadsheet** – Start with a blank spreadsheet
- **Open Existing File** – Browse to open an existing .sheet or .csv file
- **Import from CSV** – Import data from a CSV file
- **Recent Files** – Quick access to files you've opened recently (if any)

Click any option to continue, or use the **File** menu for the same actions.

---

## 2. Basic Operations

### Creating a New Spreadsheet

1. Choose **File → New** from the menu, or press **Cmd+N**
2. A new blank spreadsheet opens
3. Start typing in any cell to add data

### Opening an Existing File

1. Choose **File → Open...** from the menu, or press **Cmd+O**
2. In the dialog, navigate to your .sheet or .csv file
3. Select the file and click **Open**
4. Your spreadsheet appears in the window

**Tip:** You can also double-click a .sheet file in Finder to open it in GoSheet.

### Saving Your Work

**Save** (overwrites the current file):

1. Choose **File → Save**, or press **Cmd+S**
2. If the file already has a name, it saves immediately
3. If it's a new file, a **Save** dialog appears—choose a location and name, then click **Save**

**Save As** (creates a copy with a new name):

1. Choose **File → Save As...**, or press **Cmd+Shift+S**
2. Choose a location and enter a new file name
3. Click **Save**

### File Status Indicator

At the top of the window, you'll see the current save status:

- **"● Unsaved changes"** – You have unsaved changes
- **"✓ Saved"** – All changes are saved to disk

The file name is not shown in the status area. The app will warn you before closing or opening another file if you have unsaved changes.

---

## 3. Working with Cells

### Selecting Cells

- **Click** a cell to select it
- Use **arrow keys** to move between cells
- **Tab** moves right; **Shift+Tab** moves left
- **Enter** moves down; **Shift+Enter** moves up

The selected cell is highlighted with a border. Its value or formula appears in the **formula bar** at the top.

### Editing Cell Values

1. **Click** a cell to select it, then start typing to replace its contents
2. Or **double-click** a cell to edit in place
3. Use the **formula bar** to edit the selected cell's value or formula
4. Press **Enter** or click another cell to finish editing

### Navigating the Grid

- **Arrow keys** – Move one cell at a time
- **Tab** – Move to the cell on the right
- **Enter** – Move to the cell below (or finish editing)
- **Escape** – Cancel editing and restore the previous value

### Deleting Cell Contents

1. Select the cell(s) you want to clear
2. Press **Delete** or **Backspace**
3. The cell contents are removed

### Merging Cells (Story 11.5)

You can combine multiple cells into one for headers or labels.

**To merge cells:**

1. Select a range of 2 or more cells (click one cell, then **Shift+click** another to extend the selection)
2. Choose **Format → Merge Cells**, or press **Cmd+Shift+M**
3. The cells become one merged cell; the value from the top-left cell is kept; other cells' values are discarded

**To unmerge:**

1. Select a merged cell (click its top-left corner)
2. Choose **Format → Unmerge**
3. The merged cell splits into individual cells; the original value stays in the top-left cell; other cells are empty

**Value behavior:** When merging, only the top-left (anchor) cell's value is preserved. Formulas and data in other cells are discarded. When unmerging, the anchor value remains in the top-left cell; the other cells are empty.

---

## 4. Using Formulas

Formulas let you perform calculations and reference other cells. Every formula starts with **=**.

### Formula Basics

1. Select a cell
2. Type **=** to start a formula
3. Enter your formula in the cell or formula bar
4. Press **Enter** to apply it

The cell shows the **result**; the formula bar shows the **formula**.

### Arithmetic Operations

| Operator | Meaning | Example |
|----------|---------|---------|
| + | Add | `=A1+B1` |
| - | Subtract | `=A1-B1` |
| * | Multiply | `=A1*B1` |
| / | Divide | `=A1/B1` |
| % | Modulo (remainder) | `=A1%B1` |

**Example:** `=10+5*2` evaluates to 20 (multiplication before addition).

### Comparison Operations

You can compare values in formulas. The result is 1 (true) or 0 (false).

| Operator | Meaning | Example |
|----------|---------|---------|
| = | Equal | `=A1=10` |
| != | Not equal | `=A1!=0` |
| < | Less than | `=A1<100` |
| <= | Less than or equal | `=A1<=50` |
| > | Greater than | `=A1>0` |
| >= | Greater than or equal | `=A1>=10` |

**Example:** `=A1>50` returns 1 if A1 is greater than 50, otherwise 0.

### Cell References

Reference another cell by its column letter and row number:

- **A1** – Cell in column A, row 1
- **B5** – Cell in column B, row 5
- **AA10** – Column AA, row 10

**Example:** If A1 contains 10 and B1 contains 5, then `=A1+B1` gives 15.

### Range References

A range is a rectangular group of cells. Use a colon (**:**) between the start and end cells:

- **A1:A10** – Cells A1 through A10 (column A, rows 1–10)
- **A1:C3** – A 3×3 block from A1 to C3

**Example:** `=SUM(A1:A10)` adds all values in cells A1 through A10.

### Functions

#### SUM(range)

Adds all numbers in a range.

**Example:**
```
=SUM(A1:A10)
```
Adds all values in cells A1 through A10.

#### AVG(range)

Averages all numbers in a range.

**Example:**
```
=AVG(B1:B5)
```
Returns the average of B1, B2, B3, B4, and B5.

#### MIN(range) and MAX(range)

Return the smallest or largest number in a range.

**Example:**
```
=MIN(A1:A20)
=MAX(A1:A20)
```

#### COUNT(range)

Counts how many cells in the range contain numbers.

**Example:**
```
=COUNT(A1:A10)
```

#### CONCAT(text1, text2, ...)

Concatenates (joins) text values.

**Example:**
```
=CONCAT(A1, " ", B1)
```
Joins A1, a space, and B1.

#### UPPER(text) and LOWER(text)

Convert text to uppercase or lowercase.

**Example:**
```
=UPPER(A1)
=LOWER("HELLO")
```

#### LEN(text)

Returns the length of text (number of characters).

**Example:**
```
=LEN(A1)
```

#### LEFT(text, count), RIGHT(text, count), MID(text, start, count)

Extract parts of text:

- **LEFT** – First N characters
- **RIGHT** – Last N characters
- **MID** – N characters starting at position *start* (1-based: first character is position 1)

**Example:**
```
=LEFT("Hello", 2)   → "He"
=RIGHT("Hello", 2)  → "lo"
=MID("Hello", 2, 3) → "ell"
```

### Formula Errors

- **Circular reference** – A formula references itself (directly or through other cells). GoSheet will show an error. Fix by removing the circular reference.
- **Invalid syntax** – Check that you use the correct function names (e.g., `SUM` not `sum`), proper parentheses, and valid cell references.
- **#REF! or similar** – Usually means a cell or range reference is invalid.

---

## 5. Keyboard Shortcuts

### File Operations

| Shortcut | Action |
|----------|--------|
| **Cmd+N** | New spreadsheet |
| **Cmd+O** | Open file |
| **Cmd+S** | Save |
| **Cmd+Shift+S** | Save As |
| **Cmd+W** | Close window |
| **Cmd+Q** | Quit application |

### Editing

| Shortcut | Action |
|----------|--------|
| **Cmd+X** | Cut |
| **Cmd+C** | Copy |
| **Cmd+V** | Paste |
| **Cmd+A** | Select All |
| **Delete** or **Backspace** | Clear cell contents |
| **Escape** | Cancel editing |

### Format

| Shortcut | Action |
|----------|--------|
| **Cmd+Shift+M** | Merge cells |

### Navigation

| Shortcut | Action |
|----------|--------|
| **Arrow keys** | Move between cells |
| **Tab** | Move right |
| **Shift+Tab** | Move left |
| **Enter** | Move down (or finish editing) |
| **Shift+Enter** | Move up |

---

## 6. CSV Import/Export

### Importing CSV Files

1. Choose **File → Import CSV...** from the menu
2. In the dialog, select your .csv file
3. A **preview** shows the first few rows—check that columns and data look correct
4. Click **Import** to load the data into a new spreadsheet

**Important: Data-Only Import**

CSV files contain **data only**.

- Formulas are **not** preserved—only the values you see
- If your original file had formulas, the imported file will show only the computed results
- Imported data is placed in a new spreadsheet; save it as `.sheet` to preserve it in GoSheet format

### Exporting to CSV

1. Open the spreadsheet you want to export
2. Choose **File → Export CSV...** from the menu
3. Choose a location and file name
4. Click **Save**

**Important: Data-Only Export**

- Exported CSV contains **computed values** only
- Formulas are evaluated; the exported file shows the results, not the formulas
- Use `.sheet` format if you need to keep formulas and full spreadsheet structure

---

## 7. File Formats

### .sheet Format

- **Native GoSheet format**
- Preserves formulas, cell references, and structure
- Use for regular work and when you need to keep formulas
- GoSheet opens .sheet files; the format can also be read by other tools (developers: see `docs/FILE_FORMAT.md`)

### .csv Format

- **Plain text, comma-separated values**
- Data only—no formulas
- Can be opened in Excel, Google Sheets, and many other programs
- Use when sharing data with others or importing into other tools

### Choosing the Right Format

| Use .sheet when… | Use .csv when… |
|------------------|----------------|
| You need formulas | You only need the data |
| You're working in GoSheet | You're sharing with Excel/Sheets users |
| You want to save and reopen later | You need a universal format |

---

## 8. Troubleshooting

### Problem: App Won't Launch

**Symptoms:** Double-clicking the app does nothing or shows an error.

**Solutions:**

1. Check that you're running **macOS 11 (Big Sur) or later**
2. On first launch, **right-click** the app and select **Open** (macOS may block unsigned apps)
3. Go to **System Preferences → Security & Privacy** and allow GoSheet if it was blocked
4. Try launching from Terminal: `open /Applications/GoSheet.app`

### Problem: File Won't Open

**Symptoms:** "Unable to open file" or similar error.

**Solutions:**

1. Make sure the file is a valid **.sheet** or **.csv** file
2. Check that the file isn't corrupted—try opening it in another app if possible
3. Ensure you have **read permission** for the file and folder
4. If it's a .sheet file from an older version, it may no longer be compatible

### Problem: Formulas Show Errors

**Symptoms:** Cell shows `#REF!`, `#ERROR`, or similar.

**Solutions:**

1. **Circular reference** – A formula refers to itself. Trace your references and remove the loop.
2. **Invalid function name** – Use uppercase: `SUM`, `AVG`, not `sum`, `avg`
3. **Wrong argument type** – e.g., `SUM` expects numbers; `UPPER` expects text
4. **Invalid range** – Check that cell references like `A1:B10` are correct

### Problem: Can't Save File

**Symptoms:** Save fails or grayed out.

**Solutions:**

1. Check that you have **write permission** for the folder
2. Ensure you have enough **disk space**
3. If saving to a network drive, check that it's mounted and accessible
4. Try **Save As** to a different location (e.g., Desktop)

### Problem: Performance Issues

**Symptoms:** App feels slow with large spreadsheets.

**Solutions:**

1. **Large spreadsheets** – GoSheet works best with under ~5,000 cells; very large sheets may be slow
2. **Complex formulas** – Many formulas that depend on each other can slow recalculation
3. **Close other apps** – Free up memory if your Mac is under heavy load
4. **Restart the app** – Sometimes helps after long sessions

