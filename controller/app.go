package controller

import (
	"log"
	"sync"

	"gosheet/logutil"
	"gosheet/model"
)

// AppController manages the application state and coordinates between UI and model.
// mu protects Sheet and all operations that read or write spreadsheet state,
// since multiple HTTP handlers may execute concurrently.
type AppController struct {
	mu      sync.RWMutex
	Sheet   *model.Spreadsheet
	History *History
}

// NewAppController creates a new application controller
func NewAppController() *AppController {
	return &AppController{
		Sheet:   model.NewSpreadsheet(),
		History: NewHistory(),
	}
}

// SetCellValue sets a cell value, records the operation in undo history, and triggers recalculation.
func (c *AppController) SetCellValue(row, col int, value string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	logutil.Debugf("SetCellValue: row=%d, col=%d, value=%q", row, col, value)

	// Snapshot the previous cell state before mutation (for undo)
	prev := c.Sheet.GetCell(row, col)
	var prevCopy *model.Cell
	if prev != nil {
		cp := *prev
		prevCopy = &cp
	}

	cmd := &SetCellCommand{ctrl: c, row: row, col: col, newValue: value, prevCell: prevCopy}
	return c.History.Push(cmd)
}

// UndoRedoState holds a snapshot of undo/redo availability, read atomically under the lock.
type UndoRedoState struct {
	CanUndo         bool
	CanRedo         bool
	UndoDescription string
	RedoDescription string
}

// undoRedoStateUnlocked reads history state. Must be called with c.mu held.
func (c *AppController) undoRedoStateUnlocked() UndoRedoState {
	return UndoRedoState{
		CanUndo:         c.History.CanUndo(),
		CanRedo:         c.History.CanRedo(),
		UndoDescription: c.History.UndoDescription(),
		RedoDescription: c.History.RedoDescription(),
	}
}

// UndoRedoState returns a consistent snapshot of undo/redo availability.
// Safe for concurrent callers.
func (c *AppController) UndoRedoState() UndoRedoState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.undoRedoStateUnlocked()
}

// Undo reverses the most recent undoable operation. Safe for concurrent callers.
// Returns the post-undo state snapshot so callers don't need a second lock acquisition.
func (c *AppController) Undo() (UndoRedoState, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.History.Undo(); err != nil {
		return c.undoRedoStateUnlocked(), err
	}
	if c.History.AtSavePoint() {
		c.Sheet.Modified = false
	}
	return c.undoRedoStateUnlocked(), nil
}

// Redo reapplies the most recently undone operation. Safe for concurrent callers.
// Returns the post-redo state snapshot so callers don't need a second lock acquisition.
func (c *AppController) Redo() (UndoRedoState, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.History.Redo(); err != nil {
		return c.undoRedoStateUnlocked(), err
	}
	if c.History.AtSavePoint() {
		c.Sheet.Modified = false
	}
	return c.undoRedoStateUnlocked(), nil
}

// setCellValueInternal is the raw mutator used by SetCellCommand.Do() and Undo().
// It must only be called while c.mu is held by the caller.
func (c *AppController) setCellValueInternal(row, col int, value string) error {
	cellRef := model.CoordsToRef(row, col)

	// Check if this is a formula and extract dependencies BEFORE modifying state
	isFormula := len(value) > 0 && value[0] == '='
	var refs []string
	if isFormula {
		// Normalize the formula to extract references
		normalized, err := model.NormalizeFormula(value)
		if err == nil {
			refs = model.ExtractCellReferences(normalized)
		} else {
			refs = model.ExtractCellReferences(value)
		}

		// Check for circular references BEFORE modifying anything
		for _, ref := range refs {
			if hasCycle, cyclePath := c.Sheet.Dependencies.DetectCircularReference(cellRef, ref); hasCycle {
				cycleStr := ""
				for i, node := range cyclePath {
					if i > 0 {
						cycleStr += " → "
					}
					cycleStr += node
				}

				logutil.Debugf("Circular reference detected: %s", cycleStr)

				// Set cell to show error
				c.Sheet.Dependencies.RemoveDependencies(cellRef)
				c.Sheet.SetCell(row, col, value)
				cell := c.Sheet.GetCell(row, col)
				if cell != nil {
					cell.SetError("circular reference: " + cycleStr)
				}
				// Record dependencies even for cycle cells so that clearing them later
				// triggers recalculation of their dependents.
				for _, r := range refs {
					c.Sheet.Dependencies.AddDependency(cellRef, r)
				}
				// Propagate error to cells that already depend on this cell.
				// Can't use recalculateDependents (cycle in graph), so walk immediate dependents directly.
				// Skip the cell itself (self-reference case).
				for _, dep := range c.Sheet.Dependencies.GetDependents(cellRef) {
					if dep == cellRef {
						continue
					}
					depRow, depCol, err := model.RefToCoords(dep)
					if err != nil {
						continue
					}
					depCell := c.Sheet.GetCell(depRow, depCol)
					if depCell != nil && depCell.IsFormula {
						val, evalErr := model.EvaluateFormula("="+depCell.Value, depCell.ParsedFormula, c.Sheet)
						if evalErr != nil {
							depCell.SetError(evalErr.Error())
						} else {
							depCell.SetFromValue(val)
						}
					}
				}
				return nil
			}
		}
	}

	// Remove old dependencies for this cell
	c.Sheet.Dependencies.RemoveDependencies(cellRef)

	// Set the cell value (now safe - no circular ref)
	c.Sheet.SetCell(row, col, value)

	// Get the cell after setting it
	cell := c.Sheet.GetCell(row, col)

	// If it's a formula, add dependencies and evaluate
	if cell != nil && cell.IsFormula {
		// Add dependencies (already validated no circular refs)
		for _, ref := range refs {
			c.Sheet.Dependencies.AddDependency(cellRef, ref)
		}

		// Evaluate the formula
		logutil.Debugf("Evaluating formula: %s", cell.Value)
		val, err := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
		if err != nil {
			log.Printf("Formula error: %v", err)
			cell.SetError(err.Error())
		} else {
			cell.SetFromValue(val)
		}
	}

	// Recalculate dependent cells using dependency graph
	c.recalculateDependents([]string{cellRef})

	return nil
}

// recalculateDependents recalculates cells that depend on the changed cells
// Uses dependency graph for efficient recalculation in topological order.
// skip is an optional set of cell refs to leave untouched (already handled by caller).
func (c *AppController) recalculateDependents(changedCells []string, skip ...string) {
	skipSet := make(map[string]bool, len(skip))
	for _, s := range skip {
		skipSet[s] = true
	}

	// Get calculation order (topologically sorted)
	order, err := c.Sheet.Dependencies.GetCalculationOrder(changedCells)
	if err != nil {
		// Cycle detected in the dependency graph. Evaluate only the changed cells'
		// direct dependents by inspecting the graph manually, leaving cycle cells alone.
		log.Printf("Cycle in dependency graph during recalculation: %v", err)
		return
	}

	if len(order) == 0 {
		// No dependents to recalculate
		return
	}

	logutil.Debugf("Recalculating %d dependent cells in order: %v", len(order), order)

	// Recalculate in topological order
	for _, cellRef := range order {
		if skipSet[cellRef] {
			continue
		}
		row, col, err := model.RefToCoords(cellRef)
		if err != nil {
			log.Printf("Error converting ref %s to coords: %v", cellRef, err)
			continue
		}
		cell := c.Sheet.GetCell(row, col)

		if cell != nil && cell.IsFormula {
			val, err := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
			if err != nil {
				cell.SetError(err.Error())
			} else {
				cell.SetFromValue(val)
			}
		}
	}
}

// recalculateAllFormulas recalculates all formula cells in the spreadsheet
// Used when loading files or when dependency graph is unavailable
func (c *AppController) recalculateAllFormulas() {
	logutil.Debugln("Recalculating all formulas...")

	// Rebuild ParsedFormula ASTs for all formula cells (nil after gob decode).
	// Must happen before evaluation so evaluateCellRef/evaluateRange can use stored coords and Invalid flags.
	for _, rowMap := range c.Sheet.Cells {
		for _, cell := range rowMap {
			if cell != nil && cell.IsFormula && cell.ParsedFormula == nil && cell.Value != "" {
				ast, err := model.ParseFormula("=" + cell.Value)
				if err == nil {
					model.ResolveAllCoords(ast)
					model.ApplyInvalidRefs(ast, cell.InvalidRefs)
					cell.ParsedFormula = ast
				}
			}
		}
	}

	// Collect all formula cell refs
	var allRefs []string
	for row, rowMap := range c.Sheet.Cells {
		for col, cell := range rowMap {
			if cell != nil && cell.IsFormula {
				allRefs = append(allRefs, model.CoordsToRef(row, col))
			}
		}
	}

	// Try to get a dependency-ordered list; fall back to unordered on cycle.
	// When a cycle exists, first identify and mark cycle members before evaluating.
	order, calcErr := c.Sheet.Dependencies.GetCalculationOrder(allRefs)
	if calcErr != nil {
		// Cycle present: mark cyclic cells first so non-cycle cells evaluate correctly.
		cycleMembers := make(map[string]bool)
		for _, cellRef := range allRefs {
			row, col, err := model.RefToCoords(cellRef)
			if err != nil {
				continue
			}
			cell := c.Sheet.GetCell(row, col)
			if cell == nil || !cell.IsFormula {
				continue
			}
			refs := model.ExtractCellReferences("=" + cell.Value)
			for _, ref := range refs {
				if hasCycle, cyclePath := c.Sheet.Dependencies.DetectCircularReference(cellRef, ref); hasCycle {
					cycleStr := ""
					for i, node := range cyclePath {
						if i > 0 {
							cycleStr += " → "
						}
						cycleStr += node
					}
					cell.SetError("circular reference: " + cycleStr)
					cycleMembers[cellRef] = true
					break
				}
			}
		}
		// Evaluate non-cycle cells in unordered pass
		order = allRefs
		for _, cellRef := range order {
			if cycleMembers[cellRef] {
				continue
			}
			row, col, err := model.RefToCoords(cellRef)
			if err != nil {
				continue
			}
			cell := c.Sheet.GetCell(row, col)
			if cell != nil && cell.IsFormula {
				val, evalErr := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
				if evalErr != nil {
					cell.SetError(evalErr.Error())
				} else {
					cell.SetFromValue(val)
				}
			}
		}
		return
	}

	for _, cellRef := range order {
		row, col, err := model.RefToCoords(cellRef)
		if err != nil {
			continue
		}
		cell := c.Sheet.GetCell(row, col)
		if cell != nil && cell.IsFormula {
			val, evalErr := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
			if evalErr != nil {
				cell.SetError(evalErr.Error())
			} else {
				cell.SetFromValue(val)
			}
		}
	}
}

// GetCellValue returns the computed value of a cell.
// Story 11.6: If (row,col) is covered by a merge, returns anchor's value.
func (c *AppController) GetCellValue(row, col int) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	ar, ac := c.Sheet.ResolveToAnchor(row, col)
	cell := c.Sheet.GetCell(ar, ac)
	if cell == nil {
		return ""
	}
	return cell.Computed
}

// GetCellRawValue returns the raw value (formula) of a cell.
// Story 11.6: If (row,col) is covered by a merge, returns anchor's value.
func (c *AppController) GetCellRawValue(row, col int) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	ar, ac := c.Sheet.ResolveToAnchor(row, col)
	cell := c.Sheet.GetCell(ar, ac)
	if cell == nil {
		return ""
	}
	return cell.DisplayFormula()
}

// GetCellRef returns the cell reference (e.g., "A1", "B5") for the given row and column
func (c *AppController) GetCellRef(row, col int) string {
	return model.CoordsToRef(row, col)
}

// NewFile creates a new empty spreadsheet and clears undo/redo history.
func (c *AppController) NewFile() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Sheet = model.NewSpreadsheet()
	c.History.Clear()
}

// SaveFile saves the spreadsheet to a file
func (c *AppController) SaveFile(path string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	logutil.Debugf("Saving spreadsheet to: %s", path)
	if err := c.Sheet.SaveToFile(path); err != nil {
		return err
	}
	c.History.MarkSaved()
	return nil
}

// LoadFile loads a spreadsheet from a file
func (c *AppController) LoadFile(path string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	logutil.Debugf("Loading spreadsheet from: %s", path)
	sheet, err := model.LoadFromFile(path)
	if err != nil {
		return err
	}
	return c.loadSheet(sheet)
}

// LoadFromBytes loads a spreadsheet from gob-encoded bytes (e.g., from FileService.ReadFile).
func (c *AppController) LoadFromBytes(data []byte, path string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	logutil.Debugf("Loading spreadsheet from bytes, path: %s", path)
	sheet, err := model.LoadFromBytes(data, path)
	if err != nil {
		return err
	}
	return c.loadSheet(sheet)
}

// loadSheet sets the sheet, rebuilds dependency graph, recalculates formulas, and clears history.
func (c *AppController) loadSheet(sheet *model.Spreadsheet) error {
	c.Sheet = sheet
	c.History.Clear()
	c.rebuildDependencyGraph()
	c.recalculateAllFormulas()
	return nil
}

// rebuildDependencyGraph rebuilds the dependency graph from all formula cells
// Used after loading a file or when the graph needs to be reconstructed
func (c *AppController) rebuildDependencyGraph() {
	logutil.Debugln("Rebuilding dependency graph...")
	c.Sheet.Dependencies = model.NewDependencyGraph()

	// Scan all cells for formulas and extract their dependencies
	for row, rowMap := range c.Sheet.Cells {
		for col, cell := range rowMap {
			if cell != nil && cell.IsFormula {
				cellRef := model.CoordsToRef(row, col)
				refs := model.ExtractCellReferences("=" + cell.Value)

				for _, ref := range refs {
					if ref != cellRef { // skip spurious self-deps from invalid range coords
						c.Sheet.Dependencies.AddDependency(cellRef, ref)
					}
				}
			}
		}
	}
}

// HasUnsavedChanges returns true if the spreadsheet has unsaved changes
func (c *AppController) HasUnsavedChanges() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Sheet.HasUnsavedChanges()
}

// GetMerges returns all merge regions.
func (c *AppController) GetMerges() []model.MergeRegion {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.Sheet.Merges == nil {
		return []model.MergeRegion{}
	}
	return c.Sheet.Merges
}

// rectanglesOverlap returns true if two merge regions overlap (share any cell).
func rectanglesOverlap(a, b model.MergeRegion) bool {
	aRowEnd := a.StartRow + a.RowSpan - 1
	aColEnd := a.StartCol + a.ColSpan - 1
	bRowEnd := b.StartRow + b.RowSpan - 1
	bColEnd := b.StartCol + b.ColSpan - 1
	rowOverlap := a.StartRow <= bRowEnd && b.StartRow <= aRowEnd
	colOverlap := a.StartCol <= bColEnd && b.StartCol <= aColEnd
	return rowOverlap && colOverlap
}

// SetMerge adds a merge region. Validates no overlap and bounds.
func (c *AppController) SetMerge(startRow, startCol, rowSpan, colSpan int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&SetMergeCommand{ctrl: c, startRow: startRow, startCol: startCol, rowSpan: rowSpan, colSpan: colSpan})
}

// Unmerge removes the merge region containing the anchor (startRow, startCol).
func (c *AppController) Unmerge(startRow, startCol int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&UnmergeCommand{ctrl: c, startRow: startRow, startCol: startCol})
}

// GetFilePath returns the current file path
func (c *AppController) GetFilePath() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Sheet.FilePath
}

// ApplyStyleToCell applies a style to a single cell, recording the operation in undo history.
func (c *AppController) ApplyStyleToCell(row, col int, styleId int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&ApplyCellStyleCommand{ctrl: c, row: row, col: col, newStyleId: styleId})
}

// ApplyStyleToRange applies a style to a range of cells, recording the operation in undo history.
func (c *AppController) ApplyStyleToRange(startRow, startCol, endRow, endCol int, styleId int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&ApplyRangeStyleCommand{ctrl: c, startRow: startRow, startCol: startCol, endRow: endRow, endCol: endCol, newStyleId: styleId})
}

// SetCellAlignment sets horizontal alignment for a single cell, recording the operation in undo history.
func (c *AppController) SetCellAlignment(row, col int, alignment string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&SetCellAlignmentCommand{ctrl: c, row: row, col: col, newAlignment: alignment})
}

// SetRangeAlignment sets horizontal alignment for a range of cells, recording the operation in undo history.
func (c *AppController) SetRangeAlignment(startRow, startCol, endRow, endCol int, alignment string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&SetRangeAlignmentCommand{ctrl: c, startRow: startRow, startCol: startCol, endRow: endRow, endCol: endCol, newAlignment: alignment})
}

// CleanupFormat removes style from empty cells and deletes cells with no value and no style.
// Story 12.3: Reduces used range and file size.
func (c *AppController) CleanupFormat() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Sheet.CleanupFormat()
}

// ClearRange clears cell values in the range, recording the operation in undo history.
// Only clears anchors for merged regions (covered cells are skipped).
// Story 13.2: Batch clear for context menu performance.
// Story 15.2: Wrapped in ClearRangeCommand for undo/redo support.
func (c *AppController) ClearRange(startRow, startCol, endRow, endCol int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Snapshot all clearable cells before mutation
	prev := make(map[int]map[int]*model.Cell)
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			if !c.Sheet.ShouldClearCell(row, col) {
				continue
			}
			cell := c.Sheet.GetCell(row, col)
			if cell == nil {
				continue
			}
			if prev[row] == nil {
				prev[row] = make(map[int]*model.Cell)
			}
			cp := *cell
			prev[row][col] = &cp
		}
	}

	if len(prev) == 0 {
		return // nothing to clear
	}

	cmd := &ClearRangeCommand{
		ctrl:      c,
		startRow:  startRow,
		startCol:  startCol,
		endRow:    endRow,
		endCol:    endCol,
		prevCells: prev,
	}
	_ = c.History.Push(cmd)
}

// InsertRow inserts an empty row at the given index. Story 13.1 / 15.3.
func (c *AppController) InsertRow(row int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&InsertRowCommand{ctrl: c, row: row})
}

// InsertColumn inserts an empty column at the given index. Story 13.1 / 15.3.
func (c *AppController) InsertColumn(col int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&InsertColumnCommand{ctrl: c, col: col})
}

// DeleteRow deletes the row at the given index. Story 15.3.
func (c *AppController) DeleteRow(row int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&DeleteRowCommand{ctrl: c, row: row})
}

// DeleteColumn deletes the column at the given index. Story 15.3.
func (c *AppController) DeleteColumn(col int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.History.Push(&DeleteColumnCommand{ctrl: c, col: col})
}

// GetStyles returns all styles from the registry. Story 13.3.
func (c *AppController) GetStyles() []model.StyleInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.Sheet.Styles == nil {
		return nil
	}
	var result []model.StyleInfo
	for i := 1; i <= len(c.Sheet.Styles.Formats); i++ {
		name := c.Sheet.Styles.GetStyleNameByID(i)
		format := c.Sheet.Styles.GetFormat(i)
		if format != nil {
			result = append(result, model.StyleInfo{ID: i, Name: name, Format: *format})
		}
	}
	return result
}

// UpdateStyle updates the format (and optionally name) for an existing style. Story 13.3.
func (c *AppController) UpdateStyle(id int, format *model.CellFormat, name string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.Sheet.Styles.UpdateStyle(id, format, name); err != nil {
		return err
	}
	c.Sheet.Modified = true
	return nil
}

// AddStyle adds a new named style. Story 13.3.
func (c *AppController) AddStyle(name string, format *model.CellFormat) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	id, err := c.Sheet.Styles.AddStyle(name, format)
	if err != nil {
		return 0, err
	}
	c.Sheet.Modified = true
	return id, nil
}

// DeleteStyle removes a style and clears it from all cells. Story 13.3.
func (c *AppController) DeleteStyle(id int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Sheet.DeleteStyle(id)
}
