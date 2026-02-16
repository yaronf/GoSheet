# Story 9.2: Create User Documentation

**Epic:** 9 - Documentation & Project Cleanup  
**Story:** 9.2  
**Estimated Effort:** 1-2 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As an end user,  
I want comprehensive user documentation,  
So that I can effectively use all features of the spreadsheet application.

---

## Context

**Prerequisites:**
- Epic 7 complete: All macOS integration features implemented
- Epic 8 complete: Welcome screen and lifecycle
- Story 9.1 complete: README updated

**Current State:**
- No user-facing documentation exists
- Users must read technical README or discover features by exploration
- Keyboard shortcuts are not documented
- Formula syntax is not documented for end users
- CSV limitations are not clearly explained

**Why This Story:**
End users need clear, non-technical documentation to use the application effectively. The README is developer-focused and contains technical details that overwhelm users. A separate USER_GUIDE.md provides task-oriented instructions for common operations.

---

## Acceptance Criteria

**Given** the application is feature-complete  
**When** I read the user documentation  
**Then** a USER_GUIDE.md file exists with the following sections:
- Getting Started (launching the app, welcome screen)
- Basic Operations (creating, opening, saving files)
- Spreadsheet Basics (cell selection, editing, navigation)
- Formulas (syntax, functions, cell references)
- Keyboard Shortcuts (complete list with descriptions)
- CSV Import/Export (data-only limitations)
- File Formats (.sheet vs .csv)
- Troubleshooting (common issues and solutions)

**And** all instructions are clear and include screenshots or examples  
**And** the documentation is written for non-technical users

---

## Technical Requirements

### USER_GUIDE.md Structure

```markdown
# GoSheet User Guide

## Table of Contents
1. Getting Started
2. Basic Operations
3. Working with Cells
4. Using Formulas
5. Keyboard Shortcuts
6. CSV Import/Export
7. File Formats
8. Troubleshooting

## 1. Getting Started

### Launching GoSheet
[Instructions for first launch, welcome screen]

### Welcome Screen
[Explanation of welcome screen options]

## 2. Basic Operations

### Creating a New Spreadsheet
[Step-by-step with Cmd+N shortcut]

### Opening an Existing File
[Step-by-step with Cmd+O shortcut]

### Saving Your Work
[Save vs Save As, Cmd+S shortcut]

### File Status Indicator
[Explanation of saved/unsaved states]

## 3. Working with Cells

### Selecting Cells
[Click, arrow keys, Tab, Enter]

### Editing Cell Values
[Click, double-click, start typing]

### Navigating the Grid
[Arrow keys, Tab, Enter, Escape]

### Deleting Cell Contents
[Delete or Backspace key]

## 4. Using Formulas

### Formula Basics
[= prefix, formula bar]

### Arithmetic Operations
[+, -, *, /, %]

### Cell References
[A1, B2, relative references]

### Range References
[A1:A10]

### Functions
- SUM(range)
- AVG(range)
- MIN(range)
- MAX(range)
- COUNT(range)
- CONCAT(text1, text2, ...)
- UPPER(text)
- LOWER(text)
- LEN(text)
- LEFT(text, count)
- RIGHT(text, count)
- MID(text, start, count)

### Formula Errors
[Circular references, invalid syntax]

## 5. Keyboard Shortcuts

### File Operations
- Cmd+N: New spreadsheet
- Cmd+O: Open file
- Cmd+S: Save
- Cmd+Shift+S: Save As
- Cmd+W: Close window
- Cmd+Q: Quit application

### Editing
- Cmd+X: Cut
- Cmd+C: Copy
- Cmd+V: Paste
- Cmd+A: Select All
- Delete/Backspace: Clear cell
- Escape: Cancel editing

### Navigation
- Arrow keys: Move between cells
- Tab: Move right
- Shift+Tab: Move left
- Enter: Move down
- Shift+Enter: Move up

## 6. CSV Import/Export

### Importing CSV Files
[Step-by-step, preview dialog]

### Important: Data-Only Import
[Formulas are not preserved, only values]

### Exporting to CSV
[Step-by-step, computed values only]

## 7. File Formats

### .sheet Format
[Native format, preserves formulas]

### .csv Format
[Data-only, no formulas]

### Choosing the Right Format
[When to use each]

## 8. Troubleshooting

### App Won't Launch
[Check macOS version, permissions]

### File Won't Open
[File format issues, corruption]

### Formulas Show Errors
[Common formula mistakes]

### Can't Save File
[Permissions, disk space]

### Performance Issues
[Large spreadsheets, formula complexity]
```

---

## Implementation Tasks

1. ✅ Create USER_GUIDE.md file
2. ✅ Write Getting Started section
3. ✅ Write Basic Operations section
4. ✅ Write Working with Cells section
5. ✅ Write Using Formulas section
6. ✅ Document all keyboard shortcuts
7. ✅ Write CSV Import/Export section
8. ✅ Write File Formats section
9. ✅ Write Troubleshooting section
10. ✅ Add table of contents with links
11. ✅ Review for clarity and completeness
12. ✅ Test all instructions by following them

---

## Dev Notes

### Writing Style

- **Task-oriented**: Focus on "how to do X" not "feature Y exists"
- **Simple language**: Avoid technical jargon
- **Step-by-step**: Number steps for complex tasks
- **Visual cues**: Use bold for UI elements, code blocks for formulas
- **Examples**: Provide concrete examples for formulas

### Keyboard Shortcut Format

Use this format:

```markdown
- **Cmd+N**: Create a new spreadsheet
- **Cmd+O**: Open an existing file
```

### Formula Documentation Format

Use this format:

```markdown
#### SUM(range)

Adds all numbers in a range.

**Example:**
```
=SUM(A1:A10)
```

Adds all values in cells A1 through A10.
```

### Troubleshooting Format

Use this format:

```markdown
#### Problem: App Won't Launch

**Symptoms:** Double-clicking the app does nothing or shows an error.

**Solutions:**
1. Check that you're running macOS 11 or later
2. Right-click the app and select "Open" (first launch only)
3. Check System Preferences > Security & Privacy for blocked apps
```

---

## Testing Strategy

### Manual Testing

1. **Completeness Check:**
   - Verify all features are documented
   - Verify all keyboard shortcuts are listed
   - Verify all formulas are documented
   - Check for missing sections

2. **Clarity Check:**
   - Have a non-technical user read the guide
   - Ask them to perform tasks using only the guide
   - Note any confusing or unclear sections
   - Revise based on feedback

3. **Accuracy Check:**
   - Follow each instruction step-by-step
   - Verify keyboard shortcuts work as documented
   - Verify formula examples produce expected results
   - Test troubleshooting solutions

4. **Link Check:**
   - Verify table of contents links work
   - Verify all internal references are correct

---

## References

- [README.md](../../README.md) - Technical documentation
- [Epic 7 Stories](7-1-implement-file-menu.md) - Keyboard shortcuts and menu items
- [Epic 6 Stories](6-1-implement-csv-import-dialog.md) - CSV features
- [FORMULA_GRAMMAR.md](../../specs/FORMULA_GRAMMAR.md) - Formula syntax reference

---

## Change Log

- 2026-02-16: Story created to provide user-facing documentation

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

User documentation for end users.
