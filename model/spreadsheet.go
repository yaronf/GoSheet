package model

import (
	"fmt"
)

// Spreadsheet represents the entire spreadsheet data structure
type Spreadsheet struct {
	Cells        map[int]map[int]*Cell // Row → Column → Cell (0-indexed)
	Modified     bool                   // True if spreadsheet has unsaved changes
	FilePath     string                 // Path to the file (empty if new/unsaved)
	Dependencies *DependencyGraph       // Tracks cell dependencies for efficient recalculation
}

// NewSpreadsheet creates a new empty spreadsheet
func NewSpreadsheet() *Spreadsheet {
	return &Spreadsheet{
		Cells:        make(map[int]map[int]*Cell),
		Modified:     false,
		FilePath:     "",
		Dependencies: NewDependencyGraph(),
	}
}

// GetCell returns the cell at the given coordinates, or nil if it doesn't exist
func (s *Spreadsheet) GetCell(row, col int) *Cell {
	if rowMap, ok := s.Cells[row]; ok {
		return rowMap[col]
	}
	return nil
}

// GetCellByRef returns the cell at the given reference (e.g., "A1"), or nil if it doesn't exist
func (s *Spreadsheet) GetCellByRef(ref string) (*Cell, error) {
	row, col, err := RefToCoords(ref)
	if err != nil {
		return nil, err
	}
	return s.GetCell(row, col), nil
}

// SetCell sets the cell at the given coordinates to the given value
func (s *Spreadsheet) SetCell(row, col int, value string) {
	// Ensure row map exists
	if s.Cells[row] == nil {
		s.Cells[row] = make(map[int]*Cell)
	}
	
	// Get or create cell
	cell := s.Cells[row][col]
	if cell == nil {
		cell = NewCell(value)
		s.Cells[row][col] = cell
	} else {
		cell.SetValue(value)
	}
	
	s.Modified = true
	
	// If it's a formula, we'll need to evaluate it
	// (This will be handled by the formula engine)
}

// SetCellByRef sets the cell at the given reference (e.g., "A1") to the given value
func (s *Spreadsheet) SetCellByRef(ref string, value string) error {
	row, col, err := RefToCoords(ref)
	if err != nil {
		return err
	}
	s.SetCell(row, col, value)
	return nil
}

// DeleteCell removes the cell at the given coordinates
func (s *Spreadsheet) DeleteCell(row, col int) {
	if rowMap, ok := s.Cells[row]; ok {
		delete(rowMap, col)
		// Clean up empty row map
		if len(rowMap) == 0 {
			delete(s.Cells, row)
		}
		s.Modified = true
	}
}

// Clear removes all cells from the spreadsheet
func (s *Spreadsheet) Clear() {
	s.Cells = make(map[int]map[int]*Cell)
	s.Modified = true
}

// GetBounds returns the maximum row and column indices that contain data
// Returns (-1, -1) if the spreadsheet is empty
func (s *Spreadsheet) GetBounds() (maxRow, maxCol int) {
	maxRow = -1
	maxCol = -1
	
	for row, rowMap := range s.Cells {
		if row > maxRow {
			maxRow = row
		}
		for col := range rowMap {
			if col > maxCol {
				maxCol = col
			}
		}
	}
	
	return maxRow, maxCol
}

// GetCellCount returns the total number of populated cells
func (s *Spreadsheet) GetCellCount() int {
	count := 0
	for _, rowMap := range s.Cells {
		count += len(rowMap)
	}
	return count
}

// RecalculateAll recalculates all formulas in the spreadsheet
// This is a placeholder - will be implemented with the formula engine
func (s *Spreadsheet) RecalculateAll() error {
	// TODO: Implement with formula engine
	// For now, just iterate through cells and mark formulas for recalculation
	for _, rowMap := range s.Cells {
		for _, cell := range rowMap {
			if cell.IsFormula {
				// Formula evaluation will be implemented in formula.go
				cell.SetComputed("#PENDING")
			}
		}
	}
	return nil
}

// String returns a string representation of the spreadsheet (for debugging)
func (s *Spreadsheet) String() string {
	maxRow, maxCol := s.GetBounds()
	if maxRow == -1 {
		return "Empty spreadsheet"
	}
	
	result := fmt.Sprintf("Spreadsheet (%d cells, bounds: %s to %s)\n",
		s.GetCellCount(),
		CoordsToRef(0, 0),
		CoordsToRef(maxRow, maxCol))
	
	// Show first few cells as sample
	count := 0
	for row := 0; row <= maxRow && count < 10; row++ {
		if rowMap, ok := s.Cells[row]; ok {
			for col := 0; col <= maxCol && count < 10; col++ {
				if cell, ok := rowMap[col]; ok {
					result += fmt.Sprintf("  %s: %s\n", CoordsToRef(row, col), cell.Value)
					count++
				}
			}
		}
	}
	
	if s.GetCellCount() > 10 {
		result += fmt.Sprintf("  ... and %d more cells\n", s.GetCellCount()-10)
	}
	
	return result
}
