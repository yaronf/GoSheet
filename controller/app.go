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
	c.Sheet.SetCell(row, col, value)
	
	// If it's a formula, evaluate it
	cell := c.Sheet.GetCell(row, col)
	if cell != nil && cell.IsFormula {
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
	
	// TODO: Recalculate dependent cells
	
	return nil
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
	// TODO: Implement file saving
	c.Sheet.FilePath = path
	c.Sheet.Modified = false
	return nil
}

// LoadFile loads a spreadsheet from a file
func (c *AppController) LoadFile(path string) error {
	// TODO: Implement file loading
	return nil
}
