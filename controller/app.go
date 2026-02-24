package controller

import (
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

// GetCellValue returns the computed value of a cell
func (c *AppController) GetCellValue(row, col int) string {
	cell := c.Sheet.GetCell(row, col)
	if cell == nil {
		return ""
	}
	return cell.Computed
}

// GetCellRawValue returns the raw value (formula) of a cell
func (c *AppController) GetCellRawValue(row, col int) string {
	cell := c.Sheet.GetCell(row, col)
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

// GetFilePath returns the current file path
func (c *AppController) GetFilePath() string {
	return c.Sheet.FilePath
}
