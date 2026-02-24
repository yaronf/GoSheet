package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gosheet/model"
)

func TestNewSpreadsheet(t *testing.T) {
	sheet := model.NewSpreadsheet()
	assert.NotNil(t, sheet)
	assert.NotNil(t, sheet.Cells)
	assert.False(t, sheet.Modified)
	assert.Equal(t, "", sheet.FilePath)
	assert.Equal(t, 0, sheet.GetCellCount())
}

func TestSetAndGetCell(t *testing.T) {
	sheet := model.NewSpreadsheet()

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
	sheet := model.NewSpreadsheet()

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
	sheet := model.NewSpreadsheet()

	// Set a formula
	sheet.SetCell(0, 0, "=A2+A3")

	cell := sheet.GetCell(0, 0)
	assert.NotNil(t, cell)
	assert.Equal(t, "=A2+A3", cell.Value)
	assert.True(t, cell.IsFormula)
}

func TestDeleteCell(t *testing.T) {
	sheet := model.NewSpreadsheet()

	// Set and then delete a cell
	sheet.SetCell(0, 0, "Test")
	assert.NotNil(t, sheet.GetCell(0, 0))

	sheet.DeleteCell(0, 0)
	assert.Nil(t, sheet.GetCell(0, 0))
	assert.Equal(t, 0, sheet.GetCellCount())
}

func TestClear(t *testing.T) {
	sheet := model.NewSpreadsheet()

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
	sheet := model.NewSpreadsheet()

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
	sheet := model.NewSpreadsheet()

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
	sheet := model.NewSpreadsheet()

	// Set cells far apart - should not allocate intermediate cells
	sheet.SetCell(0, 0, "A1")
	sheet.SetCell(1000, 1000, "Big")

	assert.Equal(t, 2, sheet.GetCellCount())
	assert.NotNil(t, sheet.GetCell(0, 0))
	assert.NotNil(t, sheet.GetCell(1000, 1000))
	assert.Nil(t, sheet.GetCell(500, 500)) // Middle should be empty
}

func TestModifiedFlag(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
