package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewSpreadsheet(t *testing.T) {
	sheet := NewSpreadsheet()
	assert.NotNil(t, sheet)
	assert.NotNil(t, sheet.Cells)
	assert.NotNil(t, sheet.Styles)
	assert.False(t, sheet.Modified)
	assert.Equal(t, "", sheet.FilePath)
	assert.Equal(t, 0, sheet.GetCellCount())
}

func TestSetAndGetCell(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set a cell
	sheet.SetCell(0, 0, "Hello")
	assert.True(t, sheet.Modified)

	// Get the cell
	cell := sheet.GetCell(0, 0)
	assert.NotNil(t, cell)
	assert.Equal(t, "Hello", cell.Value)
	assert.Equal(t, "Hello", cell.Computed)
	assert.False(t, cell.IsFormula)
}

func TestSetAndGetCellByRef(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set a cell by reference
	err := sheet.SetCellByRef("A1", "World")
	assert.NoError(t, err)

	// Get the cell by reference
	cell, err := sheet.GetCellByRef("A1")
	assert.NoError(t, err)
	assert.NotNil(t, cell)
	assert.Equal(t, "World", cell.Value)
}

func TestSetCellFormula(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set a formula
	sheet.SetCell(0, 0, "=A2+A3")

	cell := sheet.GetCell(0, 0)
	assert.NotNil(t, cell)
	assert.Equal(t, "=A2+A3", cell.RawValue())
	assert.True(t, cell.IsFormula)
}

func TestDeleteCell(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set and then delete a cell
	sheet.SetCell(0, 0, "Test")
	assert.NotNil(t, sheet.GetCell(0, 0))

	sheet.DeleteCell(0, 0)
	assert.Nil(t, sheet.GetCell(0, 0))
	assert.Equal(t, 0, sheet.GetCellCount())
}

func TestClear(t *testing.T) {
	sheet := NewSpreadsheet()

	// Add some cells
	sheet.SetCell(0, 0, "A")
	sheet.SetCell(1, 1, "B")
	sheet.SetCell(2, 2, "C")
	assert.Equal(t, 3, sheet.GetCellCount())

	// Clear all
	sheet.Clear()
	assert.Equal(t, 0, sheet.GetCellCount())
	assert.Nil(t, sheet.GetCell(0, 0))
}

func TestGetBounds(t *testing.T) {
	sheet := NewSpreadsheet()

	// Empty spreadsheet
	maxRow, maxCol := sheet.GetBounds()
	assert.Equal(t, -1, maxRow)
	assert.Equal(t, -1, maxCol)

	// Add some cells
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(5, 10, "F11")
	sheet.SetCell(2, 3, "C4")

	maxRow, maxCol = sheet.GetBounds()
	assert.Equal(t, 5, maxRow)
	assert.Equal(t, 10, maxCol)
}

func TestGetCellCount(t *testing.T) {
	sheet := NewSpreadsheet()

	assert.Equal(t, 0, sheet.GetCellCount())

	sheet.SetCell(0, 0, "A")
	assert.Equal(t, 1, sheet.GetCellCount())

	sheet.SetCell(1, 1, "B")
	sheet.SetCell(2, 2, "C")
	assert.Equal(t, 3, sheet.GetCellCount())

	sheet.DeleteCell(1, 1)
	assert.Equal(t, 2, sheet.GetCellCount())
}

func TestSparseStorage(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set cells far apart - should not allocate intermediate cells
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(1000, 1000, "Big")

	assert.Equal(t, 2, sheet.GetCellCount())
	assert.NotNil(t, sheet.GetCell(0, 0))
	assert.NotNil(t, sheet.GetCell(1000, 1000))
	assert.Nil(t, sheet.GetCell(500, 500)) // Middle should be empty
}

func TestModifiedFlag(t *testing.T) {
	sheet := NewSpreadsheet()
	assert.False(t, sheet.Modified)

	sheet.SetCell(0, 0, "Test")
	assert.True(t, sheet.Modified)

	sheet.Modified = false
	sheet.DeleteCell(0, 0)
	assert.True(t, sheet.Modified)

	sheet.Modified = false
	sheet.Clear()
	assert.True(t, sheet.Modified)
}

func TestRecalculateAll(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "=1+1")
	sheet.SetCell(1, 0, "=A1*2")

	err := sheet.RecalculateAll()
	assert.NoError(t, err)

	// RecalculateAll is a no-op at the model layer; use AppController for actual recalc
	cell := sheet.GetCell(0, 0)
	assert.NotNil(t, cell)
	assert.True(t, cell.IsFormula)
}

func TestSpreadsheetString(t *testing.T) {
	sheet := NewSpreadsheet()

	// Empty spreadsheet
	s := sheet.String()
	assert.Contains(t, s, "Empty spreadsheet")

	// With data
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(1, 1, "B2")
	s = sheet.String()
	assert.Contains(t, s, "2 cells")
	assert.Contains(t, s, "A1")
}

func TestGetCellByRef_InvalidRef(t *testing.T) {
	sheet := NewSpreadsheet()
	_, err := sheet.GetCellByRef("")
	assert.Error(t, err)

	_, err = sheet.GetCellByRef("A0")
	assert.Error(t, err)

	_, err = sheet.GetCellByRef("invalid")
	assert.Error(t, err)
}

func TestSetCellByRef_InvalidRef(t *testing.T) {
	sheet := NewSpreadsheet()
	err := sheet.SetCellByRef("A0", "x")
	assert.Error(t, err)

	err = sheet.SetCellByRef("", "x")
	assert.Error(t, err)
}

func TestApplyStyleToCell(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "Title")

	err := sheet.ApplyStyleToCell(0, 0, 1)
	assert.NoError(t, err)
	assert.Equal(t, 1, sheet.GetCell(0, 0).StyleId)
	assert.True(t, sheet.Modified)

	// No-op for styleId 0
	err = sheet.ApplyStyleToCell(0, 0, 0)
	assert.NoError(t, err)
	assert.Equal(t, 1, sheet.GetCell(0, 0).StyleId)

	// Invalid styleId
	err = sheet.ApplyStyleToCell(0, 0, 99)
	assert.Error(t, err)
}

func TestApplyStyleToCell_CreatesCell(t *testing.T) {
	sheet := NewSpreadsheet()
	err := sheet.ApplyStyleToCell(5, 5, 2)
	assert.NoError(t, err)
	cell := sheet.GetCell(5, 5)
	assert.NotNil(t, cell)
	assert.Equal(t, 2, cell.StyleId)
	assert.Equal(t, "", cell.Value)
}

func TestApplyStyleToRange(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "A")
	sheet.SetCell(0, 1, "B")
	sheet.SetCell(1, 0, "C")

	err := sheet.ApplyStyleToRange(0, 0, 1, 1, 2)
	assert.NoError(t, err)
	assert.Equal(t, 2, sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, 2, sheet.GetCell(0, 1).StyleId)
	assert.Equal(t, 2, sheet.GetCell(1, 0).StyleId)
	assert.Equal(t, 2, sheet.GetCell(1, 1).StyleId)

	err = sheet.ApplyStyleToRange(2, 2, 2, 2, 99)
	assert.Error(t, err)
}

func TestApplyStyleToRange_InvalidRange(t *testing.T) {
	sheet := NewSpreadsheet()
	err := sheet.ApplyStyleToRange(2, 2, 0, 0, 1)
	assert.Error(t, err)
}

func TestApplyStyleToCell_NegativeCoords(t *testing.T) {
	sheet := NewSpreadsheet()
	err := sheet.ApplyStyleToCell(-1, 0, 1)
	assert.Error(t, err)
	err = sheet.ApplyStyleToCell(0, -1, 1)
	assert.Error(t, err)
}

func TestApplyStyleToRange_NegativeCoords(t *testing.T) {
	sheet := NewSpreadsheet()
	err := sheet.ApplyStyleToRange(-1, 0, 0, 0, 1)
	assert.Error(t, err)
	err = sheet.ApplyStyleToRange(0, 0, 99, 200, 1) // 100*201 = 20100 > 10000
	assert.Error(t, err)
}

func TestCleanupFormat(t *testing.T) {
	sheet := NewSpreadsheet()
	// Cell with value and style - should remain
	sheet.SetCell(0, 0, "Keep")
	_ = sheet.ApplyStyleToCell(0, 0, 1)
	// Empty cell with style - cleanup clears style and deletes
	_ = sheet.ApplyStyleToCell(1, 0, 2)
	// Empty cell without style - cleanup deletes
	sheet.SetCell(2, 0, "")
	// Cell with value, no style - should remain
	sheet.SetCell(3, 0, "AlsoKeep")

	sheet.Modified = false
	sheet.CleanupFormat()

	// (0,0) kept with value and style
	assert.NotNil(t, sheet.GetCell(0, 0))
	assert.Equal(t, "Keep", sheet.GetCell(0, 0).Value)
	assert.Equal(t, 1, sheet.GetCell(0, 0).StyleId)
	// (1,0) and (2,0) deleted
	assert.Nil(t, sheet.GetCell(1, 0))
	assert.Nil(t, sheet.GetCell(2, 0))
	// (3,0) kept
	assert.NotNil(t, sheet.GetCell(3, 0))
	assert.Equal(t, "AlsoKeep", sheet.GetCell(3, 0).Value)
	assert.Equal(t, 2, sheet.GetCellCount())
	assert.True(t, sheet.Modified)
}

func TestCleanupFormat_SkipsMergeAnchors(t *testing.T) {
	sheet := NewSpreadsheet()
	_ = sheet.ApplyStyleToCell(0, 0, 1)                                              // empty merge anchor
	sheet.Merges = []MergeRegion{{StartRow: 0, StartCol: 0, RowSpan: 1, ColSpan: 2}} // A1:B1 merged
	sheet.Modified = false

	sheet.CleanupFormat()

	// Merge anchor (0,0) should not be deleted (would orphan merge)
	assert.NotNil(t, sheet.GetCell(0, 0))
	assert.Len(t, sheet.Merges, 1)
}

func TestCleanupFormat_MergeAnchorStylePreserved(t *testing.T) {
	// Regression: CleanupFormat was clearing the style of empty merge anchors before
	// checking isMergeAnchor, so the anchor cell survived but lost its style.
	sheet := NewSpreadsheet()
	_ = sheet.ApplyStyleToCell(0, 0, 2) // styled empty merge anchor
	sheet.Merges = []MergeRegion{{StartRow: 0, StartCol: 0, RowSpan: 1, ColSpan: 3}}

	sheet.CleanupFormat()

	cell := sheet.GetCell(0, 0)
	assert.NotNil(t, cell, "merge anchor must not be deleted")
	assert.Equal(t, 2, cell.StyleId, "merge anchor style must be preserved")
}

func TestInsertRow(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(1, 0, "A2")
	sheet.SetCell(2, 0, "A3")

	err := sheet.InsertRow(1)
	assert.NoError(t, err)
	assert.Equal(t, "A1", sheet.GetCell(0, 0).Value)
	assert.Nil(t, sheet.GetCell(1, 0))
	assert.Equal(t, "A2", sheet.GetCell(2, 0).Value)
	assert.Equal(t, "A3", sheet.GetCell(3, 0).Value)
	assert.True(t, sheet.Modified)
}

func TestInsertRow_FormulaRefs(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(1, 0, "=A1")
	sheet.SetCell(2, 0, "=A1+A2")

	err := sheet.InsertRow(1)
	assert.NoError(t, err)
	// A1 stays at (0,0), A2 becomes (2,0), A3 becomes (3,0)
	// Formula in old row 1 (=A1) is now at row 2, refs A1 unchanged (row 0 < 1), A2 -> A3 (row 1 >= 1)
	cell2 := sheet.GetCell(2, 0)
	assert.NotNil(t, cell2)
	assert.Equal(t, "=A1", cell2.RawValue())
	cell3 := sheet.GetCell(3, 0)
	assert.NotNil(t, cell3)
	assert.Equal(t, "=A1+A3", cell3.RawValue())
}

func TestInsertColumn(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(0, 1, "B1")
	sheet.SetCell(0, 2, "C1")

	err := sheet.InsertColumn(1)
	assert.NoError(t, err)
	assert.Equal(t, "A1", sheet.GetCell(0, 0).Value)
	assert.Nil(t, sheet.GetCell(0, 1))
	assert.Equal(t, "B1", sheet.GetCell(0, 2).Value)
	assert.Equal(t, "C1", sheet.GetCell(0, 3).Value)
}

func TestDeleteRow(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(1, 0, "A2")
	sheet.SetCell(2, 0, "A3")

	_, err := sheet.DeleteRow(1)
	assert.NoError(t, err)
	assert.Equal(t, "A1", sheet.GetCell(0, 0).Value)
	assert.Equal(t, "A3", sheet.GetCell(1, 0).Value)
	assert.Nil(t, sheet.GetCell(2, 0))
	assert.True(t, sheet.Modified)
}

func TestDeleteRow_FormulaRefs(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(1, 0, "2")
	sheet.SetCell(2, 0, "=A3") // references row that will shift after delete of row 0
	sheet.Cells[2][0].IsFormula = true

	_, err := sheet.DeleteRow(1) // delete row index 1 (A2)
	assert.NoError(t, err)
	// formula was =A3 (row 2), row 2 > 1 so ref becomes A2
	cell := sheet.GetCell(1, 0)
	assert.NotNil(t, cell)
	assert.Equal(t, "=A2", cell.RawValue())
}

func TestDeleteRow_InvalidIndex(t *testing.T) {
	sheet := NewSpreadsheet()
	_, err := sheet.DeleteRow(-1)
	assert.Error(t, err)
}

func TestDeleteColumn(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(0, 1, "B1")
	sheet.SetCell(0, 2, "C1")

	_, err := sheet.DeleteColumn(1)
	assert.NoError(t, err)
	assert.Equal(t, "A1", sheet.GetCell(0, 0).Value)
	assert.Equal(t, "C1", sheet.GetCell(0, 1).Value)
	assert.Nil(t, sheet.GetCell(0, 2))
	assert.True(t, sheet.Modified)
}

func TestDeleteColumn_FormulaRefs(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(0, 1, "2")
	sheet.SetCell(0, 2, "=C1") // col 2 > 1, will shift to B1 after col 1 deleted
	sheet.Cells[0][2].IsFormula = true

	_, err := sheet.DeleteColumn(1)
	assert.NoError(t, err)
	cell := sheet.GetCell(0, 1)
	assert.NotNil(t, cell)
	assert.Equal(t, "=B1", cell.RawValue())
}

func TestDeleteRow_MergeRegions(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "anchor")
	// Merge spanning rows 2–3 (StartRow=2, RowSpan=2)
	sheet.Merges = append(sheet.Merges, MergeRegion{StartRow: 2, StartCol: 0, RowSpan: 2, ColSpan: 1})
	// Merge at row 1 (anchor = deleted row)
	sheet.Merges = append(sheet.Merges, MergeRegion{StartRow: 1, StartCol: 0, RowSpan: 1, ColSpan: 1})

	_, err := sheet.DeleteRow(1)
	assert.NoError(t, err)
	// First merge (was rows 2-3) should shift to rows 1-2
	assert.Equal(t, 1, sheet.Merges[0].StartRow)
	assert.Equal(t, 2, sheet.Merges[0].RowSpan)
	// Second merge (anchor at deleted row 1) should be removed
	assert.Equal(t, 1, len(sheet.Merges))
}

func TestDeleteColumn_MergeRegions(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "anchor")
	// Merge spanning cols 2–3 (StartCol=2, ColSpan=2)
	sheet.Merges = append(sheet.Merges, MergeRegion{StartRow: 0, StartCol: 2, RowSpan: 1, ColSpan: 2})
	// Merge at col 1 (anchor = deleted col)
	sheet.Merges = append(sheet.Merges, MergeRegion{StartRow: 0, StartCol: 1, RowSpan: 1, ColSpan: 1})

	_, err := sheet.DeleteColumn(1)
	assert.NoError(t, err)
	// First merge (was cols 2-3) should shift to cols 1-2
	assert.Equal(t, 1, sheet.Merges[0].StartCol)
	assert.Equal(t, 2, sheet.Merges[0].ColSpan)
	// Second merge (anchor at deleted col 1) should be removed
	assert.Equal(t, 1, len(sheet.Merges))
}
