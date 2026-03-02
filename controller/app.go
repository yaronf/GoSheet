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
				errorMsg := "#ERROR: Circular reference: " + cycleStr
				logutil.Debugf("Circular reference detected: %s", cycleStr)

				// Set cell to show error without modifying Modified flag or dependencies
				c.Sheet.SetCell(row, col, value)
				cell := c.Sheet.GetCell(row, col)
				if cell != nil {
					cell.SetComputed(errorMsg)
				}
				return nil // Don't add dependencies or recalculate
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
		result, err := model.EvaluateFormula(cell.Value, c.Sheet)
		if err != nil {
			log.Printf("Formula error: %v", err)
			cell.SetComputed("#ERROR: " + err.Error())
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
// Uses dependency graph for efficient recalculation in topological order
func (c *AppController) recalculateDependents(changedCells []string) {
	// Get calculation order (topologically sorted)
	order, err := c.Sheet.Dependencies.GetCalculationOrder(changedCells)
	if err != nil {
		log.Printf("Error getting calculation order: %v", err)
		// Fall back to recalculating all formulas
		c.recalculateAllFormulas()
		return
	}

	if len(order) == 0 {
		// No dependents to recalculate
		return
	}

	logutil.Debugf("Recalculating %d dependent cells in order: %v", len(order), order)

	// Recalculate in topological order
	for _, cellRef := range order {
		row, col, err := model.RefToCoords(cellRef)
		if err != nil {
			log.Printf("Error converting ref %s to coords: %v", cellRef, err)
			continue
		}
		cell := c.Sheet.GetCell(row, col)

		if cell != nil && cell.IsFormula {
			result, err := model.EvaluateFormula(cell.Value, c.Sheet)
			if err != nil {
				cell.SetComputed("#ERROR: " + err.Error())
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

	// Iterate through all cells
	for _, rowMap := range c.Sheet.Cells {
		for _, cell := range rowMap {
			if cell != nil && cell.IsFormula {
				result, err := model.EvaluateFormula(cell.Value, c.Sheet)
				if err != nil {
					cell.SetComputed("#ERROR: " + err.Error())
				} else {
					cell.SetComputed(result)
				}
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
	return cell.Value
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
				refs := model.ExtractCellReferences(cell.Value)

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
