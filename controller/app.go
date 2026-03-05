package controller

import (
	"fmt"
	"log"

	"gosheet/logutil"
	"gosheet/model"
)

// AppController manages the application state and coordinates between UI and model
type AppController struct {
	Sheet *model.Spreadsheet
}

// NewAppController creates a new application controller
func NewAppController() *AppController {
	return &AppController{
		Sheet: model.NewSpreadsheet(),
	}
}

// SetCellValue sets a cell value and triggers recalculation if needed
func (c *AppController) SetCellValue(row, col int, value string) error {
	logutil.Debugf("SetCellValue: row=%d, col=%d, value=%q", row, col, value)

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
				for i, c := range cyclePath {
					if i > 0 {
						cycleStr += " → "
					}
					cycleStr += c
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
						result, isErr, evalErr := model.EvaluateFormula("="+depCell.Value, c.Sheet)
						if evalErr != nil {
							depCell.SetError(evalErr.Error())
						} else if isErr {
							depCell.SetError(result)
						} else {
							depCell.SetComputed(result)
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
		result, isErr, err := model.EvaluateFormula("="+cell.Value, c.Sheet)
		if err != nil {
			log.Printf("Formula error: %v", err)
			cell.SetError(err.Error())
		} else if isErr {
			cell.SetError(result)
		} else {
			logutil.Debugf("Formula result: %s", result)
			cell.SetComputed(result)
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
			result, isErr, err := model.EvaluateFormula("="+cell.Value, c.Sheet)
			if err != nil {
				cell.SetError(err.Error())
			} else if isErr {
				cell.SetError(result)
			} else {
				cell.SetComputed(result)
			}
		}
	}
}

// recalculateAllFormulas recalculates all formula cells in the spreadsheet
// Used when loading files or when dependency graph is unavailable
func (c *AppController) recalculateAllFormulas() {
	logutil.Debugln("Recalculating all formulas...")

	// Collect all formula cell refs
	var allRefs []string
	for row, rowMap := range c.Sheet.Cells {
		for col, cell := range rowMap {
			if cell != nil && cell.IsFormula {
				allRefs = append(allRefs, model.CoordsToRef(row, col))
			}
		}
	}

	// Try to get a dependency-ordered list; fall back to unordered on cycle
	order, err := c.Sheet.Dependencies.GetCalculationOrder(allRefs)
	if err != nil {
		order = allRefs // cycle present — best effort unordered
	}

	for _, cellRef := range order {
		row, col, err := model.RefToCoords(cellRef)
		if err != nil {
			continue
		}
		cell := c.Sheet.GetCell(row, col)
		if cell != nil && cell.IsFormula {
			result, isErr, evalErr := model.EvaluateFormula("="+cell.Value, c.Sheet)
			if evalErr != nil {
				cell.SetError(evalErr.Error())
			} else if isErr {
				cell.SetError(result)
			} else {
				cell.SetComputed(result)
			}
		}
	}
}

// GetCellValue returns the computed value of a cell.
// Story 11.6: If (row,col) is covered by a merge, returns anchor's value.
func (c *AppController) GetCellValue(row, col int) string {
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
	ar, ac := c.Sheet.ResolveToAnchor(row, col)
	cell := c.Sheet.GetCell(ar, ac)
	if cell == nil {
		return ""
	}
	return cell.RawValue()
}

// GetCellRef returns the cell reference (e.g., "A1", "B5") for the given row and column
func (c *AppController) GetCellRef(row, col int) string {
	return model.CoordsToRef(row, col)
}

// NewFile creates a new empty spreadsheet
func (c *AppController) NewFile() {
	c.Sheet = model.NewSpreadsheet()
}

// SaveFile saves the spreadsheet to a file
func (c *AppController) SaveFile(path string) error {
	logutil.Debugf("Saving spreadsheet to: %s", path)
	return c.Sheet.SaveToFile(path)
}

// LoadFile loads a spreadsheet from a file
func (c *AppController) LoadFile(path string) error {
	logutil.Debugf("Loading spreadsheet from: %s", path)
	sheet, err := model.LoadFromFile(path)
	if err != nil {
		return err
	}
	return c.loadSheet(sheet)
}

// LoadFromBytes loads a spreadsheet from gob-encoded bytes (e.g., from FileService.ReadFile).
func (c *AppController) LoadFromBytes(data []byte, path string) error {
	logutil.Debugf("Loading spreadsheet from bytes, path: %s", path)
	sheet, err := model.LoadFromBytes(data, path)
	if err != nil {
		return err
	}
	return c.loadSheet(sheet)
}

// loadSheet sets the sheet and rebuilds dependency graph and recalculates formulas.
func (c *AppController) loadSheet(sheet *model.Spreadsheet) error {
	c.Sheet = sheet
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
					c.Sheet.Dependencies.AddDependency(cellRef, ref)
				}
			}
		}
	}
}

// HasUnsavedChanges returns true if the spreadsheet has unsaved changes
func (c *AppController) HasUnsavedChanges() bool {
	return c.Sheet.HasUnsavedChanges()
}

// GetMerges returns all merge regions.
func (c *AppController) GetMerges() []model.MergeRegion {
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
	if startRow < 0 || startCol < 0 || rowSpan < 1 || colSpan < 1 {
		return fmt.Errorf("invalid merge: startRow and startCol must be >= 0, rowSpan and colSpan must be >= 1")
	}
	newMerge := model.MergeRegion{StartRow: startRow, StartCol: startCol, RowSpan: rowSpan, ColSpan: colSpan}
	for _, m := range c.Sheet.Merges {
		if rectanglesOverlap(newMerge, m) {
			return fmt.Errorf("merge overlaps existing region at (%d,%d)", m.StartRow, m.StartCol)
		}
	}
	// Refuse merge if more than one cell in the region has content
	nonEmpty := 0
	for r := startRow; r < startRow+rowSpan; r++ {
		for col := startCol; col < startCol+colSpan; col++ {
			cell := c.Sheet.GetCell(r, col)
			if cell != nil && cell.Value != "" {
				nonEmpty++
			}
		}
	}
	if nonEmpty > 1 {
		return fmt.Errorf("only one cell in the selection may have content to merge")
	}
	c.Sheet.Merges = append(c.Sheet.Merges, newMerge)
	c.Sheet.Modified = true
	return nil
}

// Unmerge removes the merge region containing the anchor (startRow, startCol).
func (c *AppController) Unmerge(startRow, startCol int) error {
	for i, m := range c.Sheet.Merges {
		if m.StartRow == startRow && m.StartCol == startCol {
			c.Sheet.Merges = append(c.Sheet.Merges[:i], c.Sheet.Merges[i+1:]...)
			c.Sheet.Modified = true
			return nil
		}
	}
	return fmt.Errorf("no merge region with anchor at (%d,%d)", startRow, startCol)
}

// GetFilePath returns the current file path
func (c *AppController) GetFilePath() string {
	return c.Sheet.FilePath
}

// ApplyStyleToCell applies a style to a single cell.
func (c *AppController) ApplyStyleToCell(row, col int, styleId int) error {
	return c.Sheet.ApplyStyleToCell(row, col, styleId)
}

// ApplyStyleToRange applies a style to a range of cells.
func (c *AppController) ApplyStyleToRange(startRow, startCol, endRow, endCol int, styleId int) error {
	return c.Sheet.ApplyStyleToRange(startRow, startCol, endRow, endCol, styleId)
}

// SetCellAlignment sets horizontal alignment for a single cell.
func (c *AppController) SetCellAlignment(row, col int, alignment string) error {
	return c.Sheet.SetCellAlignment(row, col, alignment)
}

// SetRangeAlignment sets horizontal alignment for a range of cells.
func (c *AppController) SetRangeAlignment(startRow, startCol, endRow, endCol int, alignment string) error {
	return c.Sheet.SetRangeAlignment(startRow, startCol, endRow, endCol, alignment)
}

// CleanupFormat removes style from empty cells and deletes cells with no value and no style.
// Story 12.3: Reduces used range and file size.
func (c *AppController) CleanupFormat() {
	c.Sheet.CleanupFormat()
}

// ClearRange clears cell values in the range. Only clears anchors for merged regions.
// Story 13.2: Batch clear for context menu performance.
func (c *AppController) ClearRange(startRow, startCol, endRow, endCol int) {
	var changed []string
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			if !c.Sheet.ShouldClearCell(row, col) {
				continue
			}
			cell := c.Sheet.GetCell(row, col)
			if cell == nil {
				continue
			}
			cellRef := model.CoordsToRef(row, col)
			c.Sheet.Dependencies.RemoveDependencies(cellRef)
			c.Sheet.SetCell(row, col, "")
			changed = append(changed, cellRef)
		}
	}
	if len(changed) > 0 {
		c.recalculateDependents(changed)
	}
}

// InsertRow inserts an empty row at the given index. Story 13.1.
func (c *AppController) InsertRow(row int) error {
	if err := c.Sheet.InsertRow(row); err != nil {
		return err
	}
	c.rebuildDependencyGraph()
	c.recalculateAllFormulas()
	return nil
}

// InsertColumn inserts an empty column at the given index. Story 13.1.
func (c *AppController) InsertColumn(col int) error {
	if err := c.Sheet.InsertColumn(col); err != nil {
		return err
	}
	c.rebuildDependencyGraph()
	c.recalculateAllFormulas()
	return nil
}

// GetStyles returns all styles from the registry. Story 13.3.
func (c *AppController) GetStyles() []model.StyleInfo {
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
	if err := c.Sheet.Styles.UpdateStyle(id, format, name); err != nil {
		return err
	}
	c.Sheet.Modified = true
	return nil
}

// AddStyle adds a new named style. Story 13.3.
func (c *AppController) AddStyle(name string, format *model.CellFormat) (int, error) {
	id, err := c.Sheet.Styles.AddStyle(name, format)
	if err != nil {
		return 0, err
	}
	c.Sheet.Modified = true
	return id, nil
}

// DeleteStyle removes a style and clears it from all cells. Story 13.3.
func (c *AppController) DeleteStyle(id int) error {
	return c.Sheet.DeleteStyle(id)
}
