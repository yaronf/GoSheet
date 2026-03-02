package model

import (
	"fmt"
	"sort"
)

// MergeRegion represents a merged cell range. Anchor is (StartRow, StartCol).
// Covered cells are StartRow..StartRow+RowSpan-1, StartCol..StartCol+ColSpan-1.
// RowSpan/ColSpan of 1 means single cell (no merge).
type MergeRegion struct {
	StartRow, StartCol int
	RowSpan, ColSpan   int
}

// Spreadsheet represents the entire spreadsheet data structure
type Spreadsheet struct {
	Cells        map[int]map[int]*Cell // Row → Column → Cell (0-indexed)
	Merges       []MergeRegion         // Merge regions (anchor = top-left; covered cells hidden)
	Styles       *StyleRegistry        // Style registry (Title, Header, Total)
	Modified     bool                  // True if spreadsheet has unsaved changes
	FilePath     string                // Path to the file (empty if new/unsaved)
	Dependencies *DependencyGraph      // Tracks cell dependencies for efficient recalculation
}

// NewSpreadsheet creates a new empty spreadsheet
func NewSpreadsheet() *Spreadsheet {
	return &Spreadsheet{
		Cells:        make(map[int]map[int]*Cell),
		Merges:       []MergeRegion{},
		Styles:       NewStyleRegistry(),
		Modified:     false,
		FilePath:     "",
		Dependencies: NewDependencyGraph(),
	}
}

// ResolveToAnchor returns (anchorRow, anchorCol) if (row,col) is covered by a merge; else (row,col).
// Story 11.6: Used by GetCellValue/GetCellRawValue so covered cells return anchor's value.
func (s *Spreadsheet) ResolveToAnchor(row, col int) (int, int) {
	for _, m := range s.Merges {
		if m.RowSpan < 1 || m.ColSpan < 1 {
			continue
		}
		if row >= m.StartRow && row < m.StartRow+m.RowSpan &&
			col >= m.StartCol && col < m.StartCol+m.ColSpan {
			return m.StartRow, m.StartCol
		}
	}
	return row, col
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

// ShouldClearCell returns true if (row,col) should be cleared in a range clear.
// Returns true for anchors and unmerged cells; false for covered cells.
func (s *Spreadsheet) ShouldClearCell(row, col int) bool {
	for i := range s.Merges {
		m := &s.Merges[i]
		if m.RowSpan < 1 || m.ColSpan < 1 {
			continue
		}
		if row >= m.StartRow && row < m.StartRow+m.RowSpan &&
			col >= m.StartCol && col < m.StartCol+m.ColSpan {
			return m.StartRow == row && m.StartCol == col
		}
	}
	return true
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

// ApplyStyleToCell applies the given style to the cell at (row, col).
// No-op if styleId is 0. Returns error if styleId is invalid.
func (s *Spreadsheet) ApplyStyleToCell(row, col int, styleId int) error {
	if styleId == 0 {
		return nil
	}
	if row < 0 || col < 0 {
		return fmt.Errorf("invalid cell: row and col must be >= 0")
	}
	if s.Styles == nil || !s.Styles.HasStyle(styleId) {
		return fmt.Errorf("invalid style id: %d", styleId)
	}
	if s.Cells[row] == nil {
		s.Cells[row] = make(map[int]*Cell)
	}
	cell := s.Cells[row][col]
	if cell == nil {
		cell = NewCell("")
		s.Cells[row][col] = cell
	}
	cell.StyleId = styleId
	s.Modified = true
	return nil
}

// isMergeAnchor returns true if (row, col) is the anchor of any merge region.
func (s *Spreadsheet) isMergeAnchor(row, col int) bool {
	for _, m := range s.Merges {
		if m.RowSpan >= 1 && m.ColSpan >= 1 && m.StartRow == row && m.StartCol == col {
			return true
		}
	}
	return false
}

// CleanupFormat removes style from empty cells and deletes cells that have no value and no style.
// Story 12.3: Reduces used range and file size by removing orphaned formatting.
// Merge anchors are not deleted to avoid orphaned merge regions.
func (s *Spreadsheet) CleanupFormat() {
	var toDelete [][2]int
	for row, rowMap := range s.Cells {
		for col, cell := range rowMap {
			if cell == nil {
				continue
			}
			if cell.Value == "" {
				if cell.StyleId != 0 {
					cell.StyleId = 0
					s.Modified = true
				}
				toDelete = append(toDelete, [2]int{row, col})
			}
		}
	}
	for _, rc := range toDelete {
		row, col := rc[0], rc[1]
		if s.isMergeAnchor(row, col) {
			continue
		}
		cell := s.GetCell(row, col)
		if cell != nil && cell.Value == "" && cell.StyleId == 0 {
			s.DeleteCell(row, col)
		}
	}
}

// InsertRow inserts an empty row at the given index. Cells at row >= insertRow shift down.
// Merge regions and formula references are updated. Story 13.1.
func (s *Spreadsheet) InsertRow(insertRow int) error {
	if insertRow < 0 {
		return fmt.Errorf("insertRow must be >= 0")
	}
	maxRow, _ := s.GetBounds()
	if maxRow < 0 {
		s.Modified = true
		return nil
	}
	// Shift cells: process rows from high to low
	rows := make([]int, 0, len(s.Cells))
	for r := range s.Cells {
		rows = append(rows, r)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(rows)))
	for _, r := range rows {
		if r >= insertRow {
			s.Cells[r+1] = s.Cells[r]
			delete(s.Cells, r)
		}
	}
	// Update merge regions
	for i := range s.Merges {
		m := &s.Merges[i]
		if m.RowSpan < 1 || m.ColSpan < 1 {
			continue
		}
		endRow := m.StartRow + m.RowSpan - 1
		if m.StartRow >= insertRow {
			m.StartRow++
		} else if endRow >= insertRow {
			m.RowSpan++
		}
	}
	// Update formula refs in all cells
	for _, rowMap := range s.Cells {
		for _, cell := range rowMap {
			if cell != nil && cell.IsFormula && cell.Value != "" {
				cell.Value = shiftFormulaRefsForInsertRow(cell.Value, insertRow)
			}
		}
	}
	s.Modified = true
	return nil
}

// InsertColumn inserts an empty column at the given index. Cells at col >= insertCol shift right.
// Merge regions and formula references are updated. Story 13.1.
func (s *Spreadsheet) InsertColumn(insertCol int) error {
	if insertCol < 0 {
		return fmt.Errorf("insertCol must be >= 0")
	}
	_, maxCol := s.GetBounds()
	if maxCol < 0 {
		s.Modified = true
		return nil
	}
	// Shift cells: process cols from high to low within each row
	for _, rowMap := range s.Cells {
		cols := make([]int, 0, len(rowMap))
		for c := range rowMap {
			cols = append(cols, c)
		}
		sort.Sort(sort.Reverse(sort.IntSlice(cols)))
		for _, c := range cols {
			if c >= insertCol {
				rowMap[c+1] = rowMap[c]
				delete(rowMap, c)
			}
		}
		delete(rowMap, insertCol) // Clear the inserted column position
	}
	// Update merge regions
	for i := range s.Merges {
		m := &s.Merges[i]
		if m.RowSpan < 1 || m.ColSpan < 1 {
			continue
		}
		endCol := m.StartCol + m.ColSpan - 1
		if m.StartCol >= insertCol {
			m.StartCol++
		} else if endCol >= insertCol {
			m.ColSpan++
		}
	}
	// Update formula refs in all cells
	for _, rowMap := range s.Cells {
		for _, cell := range rowMap {
			if cell != nil && cell.IsFormula && cell.Value != "" {
				cell.Value = shiftFormulaRefsForInsertColumn(cell.Value, insertCol)
			}
		}
	}
	s.Modified = true
	return nil
}

// ApplyStyleToRange applies the given style to all cells in the range [startRow,endRow] x [startCol,endCol].
// No-op if styleId is 0. Returns error if styleId is invalid.
func (s *Spreadsheet) ApplyStyleToRange(startRow, startCol, endRow, endCol int, styleId int) error {
	if styleId == 0 {
		return nil
	}
	if s.Styles == nil || !s.Styles.HasStyle(styleId) {
		return fmt.Errorf("invalid style id: %d", styleId)
	}
	if startRow < 0 || startCol < 0 || endRow < 0 || endCol < 0 {
		return fmt.Errorf("invalid range: row and col must be >= 0")
	}
	if startRow > endRow || startCol > endCol {
		return fmt.Errorf("invalid range: start must be <= end")
	}
	// Limit range size to avoid DoS (max 10,000 cells per call)
	const maxRangeCells = 10000
	if (endRow-startRow+1)*(endCol-startCol+1) > maxRangeCells {
		return fmt.Errorf("invalid range: too large (max %d cells)", maxRangeCells)
	}
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			if err := s.ApplyStyleToCell(row, col, styleId); err != nil {
				return err
			}
		}
	}
	return nil
}
