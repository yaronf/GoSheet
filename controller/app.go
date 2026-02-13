package controller

import (
	"log"

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
	log.Printf("SetCellValue: row=%d, col=%d, value=%q", row, col, value)
	
	cellRef := model.CoordsToRef(row, col)
	
	// Remove old dependencies for this cell
	c.Sheet.Dependencies.RemoveDependencies(cellRef)
	
	// Set the cell value
	c.Sheet.SetCell(row, col, value)
	
	// If it's a formula, extract dependencies and check for circular references
	cell := c.Sheet.GetCell(row, col)
	if cell != nil && cell.IsFormula {
		// Extract cell references from the formula
		refs := model.ExtractCellReferences(cell.Value)
		
		// Check for circular references before adding dependencies
		for _, ref := range refs {
			if hasCycle, cyclePath := c.Sheet.Dependencies.DetectCircularReference(cellRef, ref); hasCycle {
				cycleStr := ""
				for i, c := range cyclePath {
					if i > 0 {
						cycleStr += " → "
					}
					cycleStr += c
				}
				cell.SetComputed("#ERROR: Circular reference: " + cycleStr)
				log.Printf("Circular reference detected: %s", cycleStr)
				return nil // Don't add dependencies or recalculate
			}
		}
		
		// Add dependencies
		for _, ref := range refs {
			c.Sheet.Dependencies.AddDependency(cellRef, ref)
		}
		
		// Evaluate the formula
		log.Printf("Evaluating formula: %s", cell.Value)
		result, err := model.EvaluateFormula(cell.Value, c.Sheet)
		if err != nil {
			log.Printf("Formula error: %v", err)
			cell.SetComputed("#ERROR: " + err.Error())
		} else {
			log.Printf("Formula result: %s", result)
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
	
	log.Printf("Recalculating %d dependent cells in order: %v", len(order), order)
	
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
	log.Println("Recalculating all formulas...")
	
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
	log.Printf("Saving spreadsheet to: %s", path)
	return c.Sheet.SaveToFile(path)
}

// LoadFile loads a spreadsheet from a file
func (c *AppController) LoadFile(path string) error {
	log.Printf("Loading spreadsheet from: %s", path)
	sheet, err := model.LoadFromFile(path)
	if err != nil {
		return err
	}
	c.Sheet = sheet
	
	// Rebuild dependency graph from formulas
	c.rebuildDependencyGraph()
	
	// Recalculate all formulas after loading
	c.recalculateAllFormulas()
	return nil
}

// rebuildDependencyGraph rebuilds the dependency graph from all formula cells
// Used after loading a file or when the graph needs to be reconstructed
func (c *AppController) rebuildDependencyGraph() {
	log.Println("Rebuilding dependency graph...")
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
