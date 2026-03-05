package controller

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"gosheet/model"
)

func TestNewAppController(t *testing.T) {
	ctrl := NewAppController()
	assert.NotNil(t, ctrl)
	assert.NotNil(t, ctrl.Sheet)
	assert.Equal(t, 0, ctrl.Sheet.GetCellCount())
}

func TestControllerSetCellValue_Plain(t *testing.T) {
	ctrl := NewAppController()

	err := ctrl.SetCellValue(0, 0, "Hello")
	assert.NoError(t, err)

	assert.Equal(t, "Hello", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "Hello", ctrl.GetCellRawValue(0, 0))
}

func TestControllerSetCellValue_Formula(t *testing.T) {
	ctrl := NewAppController()

	// Set values first
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")

	// Set formula
	err := ctrl.SetCellValue(0, 1, "=A1+A2")
	assert.NoError(t, err)

	assert.Equal(t, "30", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "=A1+A2", ctrl.GetCellRawValue(0, 1))
}

func TestControllerRecalculateDependents(t *testing.T) {
	ctrl := NewAppController()

	// A1=5, B1=A1*2
	ctrl.SetCellValue(0, 0, "5")
	ctrl.SetCellValue(0, 1, "=A1*2")
	assert.Equal(t, "10", ctrl.GetCellValue(0, 1))

	// Change A1; B1 should recalculate
	ctrl.SetCellValue(0, 0, "20")
	assert.Equal(t, "40", ctrl.GetCellValue(0, 1))
}

func TestControllerSetCellValue_CircularRef(t *testing.T) {
	ctrl := NewAppController()

	// B1 = A1 (B1 references A1); B1 is (row 0, col 1)
	ctrl.SetCellValue(0, 1, "=A1")
	// A1 = B1 (creates cycle A1 -> B1 -> A1)
	err := ctrl.SetCellValue(0, 0, "=B1")
	assert.NoError(t, err)

	// A1 should show circular ref error (last cell set in cycle)
	val := ctrl.GetCellValue(0, 0)
	assert.Contains(t, val, "#ERROR")
	assert.Contains(t, val, "circular reference")
}

func TestControllerGetCellValue_Empty(t *testing.T) {
	ctrl := NewAppController()

	assert.Equal(t, "", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellRawValue(0, 0))
}

func TestControllerGetCellRef(t *testing.T) {
	ctrl := NewAppController()

	assert.Equal(t, "A1", ctrl.GetCellRef(0, 0))
	assert.Equal(t, "B2", ctrl.GetCellRef(1, 1))
	assert.Equal(t, "Z10", ctrl.GetCellRef(9, 25))
	assert.Equal(t, "AA1", ctrl.GetCellRef(0, 26))
}

func TestControllerNewFile(t *testing.T) {
	ctrl := NewAppController()
	ctrl.SetCellValue(0, 0, "data")

	ctrl.NewFile()

	assert.Equal(t, 0, ctrl.Sheet.GetCellCount())
	assert.Nil(t, ctrl.Sheet.GetCell(0, 0))
}

func TestControllerHasUnsavedChanges(t *testing.T) {
	ctrl := NewAppController()

	assert.False(t, ctrl.HasUnsavedChanges())

	ctrl.SetCellValue(0, 0, "x")
	assert.True(t, ctrl.HasUnsavedChanges())
}

func TestControllerSaveFile(t *testing.T) {
	ctrl := NewAppController()
	ctrl.SetCellValue(0, 0, "Hello")
	ctrl.SetCellValue(0, 1, "42")

	tmpfile := filepath.Join(t.TempDir(), "save.gosheet")
	err := ctrl.SaveFile(tmpfile)
	assert.NoError(t, err)

	info, err := os.Stat(tmpfile)
	assert.NoError(t, err)
	assert.Greater(t, info.Size(), int64(0))
}

func TestControllerLoadFile(t *testing.T) {
	// Create and save a file via model
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "Loaded")
	s.SetCell(0, 1, "Data")
	tmpfile := filepath.Join(t.TempDir(), "load.gosheet")
	err := s.SaveToFile(tmpfile)
	assert.NoError(t, err)

	ctrl := NewAppController()
	err = ctrl.LoadFile(tmpfile)
	assert.NoError(t, err)

	assert.Equal(t, "Loaded", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "Data", ctrl.GetCellValue(0, 1))
	assert.Equal(t, tmpfile, ctrl.GetFilePath())
}

func TestControllerLoadFile_NotFound(t *testing.T) {
	ctrl := NewAppController()
	err := ctrl.LoadFile("/nonexistent/path.gosheet")
	assert.Error(t, err)
}

func TestControllerLoadFromBytes(t *testing.T) {
	// Create spreadsheet with formulas at model level (bypasses cycle detection)
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "10")
	s.SetCell(0, 1, "20")
	s.SetCell(0, 2, "=A1+B1")
	data, err := s.SaveToBytes()
	assert.NoError(t, err)

	ctrl := NewAppController()
	err = ctrl.LoadFromBytes(data, "/test/loaded.sheet")
	assert.NoError(t, err)

	assert.Equal(t, "10", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "20", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "30", ctrl.GetCellValue(0, 2))
	assert.Equal(t, "/test/loaded.sheet", ctrl.GetFilePath())
}

func TestControllerLoadFromBytes_InvalidData(t *testing.T) {
	ctrl := NewAppController()
	err := ctrl.LoadFromBytes([]byte("not valid gob"), "/x.sheet")
	assert.Error(t, err)
}

func TestControllerLoadFromBytes_FormulasRecalculated(t *testing.T) {
	// Load spreadsheet with formulas; loadSheet rebuilds deps and recalculates
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "5")
	s.SetCell(0, 1, "7")
	s.SetCell(0, 2, "=A1+B1")
	data, err := s.SaveToBytes()
	assert.NoError(t, err)

	ctrl := NewAppController()
	err = ctrl.LoadFromBytes(data, "/x.sheet")
	assert.NoError(t, err)

	// Formulas should be recalculated after load
	assert.Equal(t, "12", ctrl.GetCellValue(0, 2))
}

func TestControllerGetFilePath(t *testing.T) {
	ctrl := NewAppController()
	assert.Empty(t, ctrl.GetFilePath())

	// Load sets path
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "x")
	data, _ := s.SaveToBytes()
	_ = ctrl.LoadFromBytes(data, "/my/file.gosheet")
	assert.Equal(t, "/my/file.gosheet", ctrl.GetFilePath())
}

func TestControllerRecalculateAllFormulas_OnLoadWithCycle(t *testing.T) {
	// Create spreadsheet with cycle at model level (bypasses controller cycle detection)
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "=B1") // A1
	s.SetCell(0, 1, "=A1") // B1 - cycle
	s.SetCell(2, 0, "=A1") // C1 depends on A1
	data, err := s.SaveToBytes()
	assert.NoError(t, err)

	ctrl := NewAppController()
	err = ctrl.LoadFromBytes(data, "/cycle.sheet")
	assert.NoError(t, err)

	// Changing C1 and setting it via SetCellValue — should not panic.
	// Cycles loaded from file bypass controller cycle detection, so A1/B1
	// silently evaluate to empty. C1 = =A1+1 = 0+1 = 1.
	_ = ctrl.SetCellValue(2, 0, "=A1+1")
	val := ctrl.GetCellValue(2, 0)
	assert.NotEmpty(t, val) // Should produce some value without panicking
}

func TestControllerGetMerges(t *testing.T) {
	ctrl := NewAppController()
	assert.Empty(t, ctrl.GetMerges())

	_ = ctrl.SetMerge(0, 0, 1, 3)
	merges := ctrl.GetMerges()
	assert.Len(t, merges, 1)
	assert.Equal(t, 0, merges[0].StartRow)
	assert.Equal(t, 0, merges[0].StartCol)
	assert.Equal(t, 1, merges[0].RowSpan)
	assert.Equal(t, 3, merges[0].ColSpan)
}

func TestControllerSetMerge(t *testing.T) {
	ctrl := NewAppController()

	err := ctrl.SetMerge(0, 0, 1, 3)
	assert.NoError(t, err)
	assert.True(t, ctrl.HasUnsavedChanges())
	assert.Len(t, ctrl.GetMerges(), 1)

	// Overlapping merge should fail
	err = ctrl.SetMerge(0, 1, 1, 2)
	assert.Error(t, err)
	assert.Len(t, ctrl.GetMerges(), 1)

	// Non-overlapping merge should succeed
	err = ctrl.SetMerge(2, 0, 2, 2)
	assert.NoError(t, err)
	assert.Len(t, ctrl.GetMerges(), 2)

	// Invalid bounds
	err = ctrl.SetMerge(-1, 0, 1, 1)
	assert.Error(t, err)
	err = ctrl.SetMerge(0, 0, 0, 1)
	assert.Error(t, err)
}

func TestControllerUnmerge(t *testing.T) {
	ctrl := NewAppController()
	_ = ctrl.SetMerge(0, 0, 1, 3)

	err := ctrl.Unmerge(0, 0)
	assert.NoError(t, err)
	assert.Empty(t, ctrl.GetMerges())
	assert.True(t, ctrl.HasUnsavedChanges())

	// Unmerge non-anchor should fail
	_ = ctrl.SetMerge(0, 0, 2, 2)
	err = ctrl.Unmerge(1, 1)
	assert.Error(t, err)
	assert.Len(t, ctrl.GetMerges(), 1)
}

// TestControllerGetCellValue_CoveredCell returns anchor value for covered cells (Story 11.6)
func TestControllerGetCellValue_CoveredCell(t *testing.T) {
	ctrl := NewAppController()
	_ = ctrl.SetCellValue(0, 0, "anchor")
	_ = ctrl.SetMerge(0, 0, 1, 3) // A1:C1 merged

	assert.Equal(t, "anchor", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "anchor", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "anchor", ctrl.GetCellValue(0, 2))

	_ = ctrl.SetCellValue(0, 0, "=1+1")
	assert.Equal(t, "2", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "2", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "=1+1", ctrl.GetCellRawValue(0, 0))
	assert.Equal(t, "=1+1", ctrl.GetCellRawValue(0, 1))
}

func TestSetMerge_RefusesWhenMultipleCellsHaveContent(t *testing.T) {
	ctrl := NewAppController()

	// Put content in two cells that would be merged
	ctrl.SetCellValue(0, 0, "hello")
	ctrl.SetCellValue(0, 1, "world")

	// Try to merge a 1x2 region — both cells have content
	err := ctrl.SetMerge(0, 0, 1, 2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "only one cell")
}

func TestSetMerge_AllowsWhenOneCellHasContent(t *testing.T) {
	ctrl := NewAppController()

	// Only anchor cell has content
	ctrl.SetCellValue(0, 0, "hello")

	err := ctrl.SetMerge(0, 0, 1, 2)
	assert.NoError(t, err)
}

func TestSetMerge_AllowsWhenNoCellsHaveContent(t *testing.T) {
	ctrl := NewAppController()

	err := ctrl.SetMerge(0, 0, 2, 2)
	assert.NoError(t, err)
}

// Story 13.8: SetCellAlignment / SetRangeAlignment unit tests

func TestSetCellAlignment_ValidValues(t *testing.T) {
	ctrl := NewAppController()
	ctrl.SetCellValue(0, 0, "hello")

	for _, alignment := range []string{"left", "center", "right", ""} {
		err := ctrl.SetCellAlignment(0, 0, alignment)
		assert.NoError(t, err, "alignment %q should be valid", alignment)
		cell := ctrl.Sheet.GetCell(0, 0)
		assert.Equal(t, alignment, cell.Alignment)
	}
}

func TestSetCellAlignment_InvalidValue(t *testing.T) {
	ctrl := NewAppController()
	err := ctrl.SetCellAlignment(0, 0, "justify")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid alignment")
}

func TestSetCellAlignment_NegativeCoords(t *testing.T) {
	ctrl := NewAppController()
	assert.Error(t, ctrl.SetCellAlignment(-1, 0, "left"))
	assert.Error(t, ctrl.SetCellAlignment(0, -1, "left"))
}

func TestSetCellAlignment_CreatesCell(t *testing.T) {
	ctrl := NewAppController()
	// Cell doesn't exist yet — SetCellAlignment should create it
	err := ctrl.SetCellAlignment(5, 5, "right")
	assert.NoError(t, err)
	cell := ctrl.Sheet.GetCell(5, 5)
	assert.NotNil(t, cell)
	assert.Equal(t, "right", cell.Alignment)
}

func TestSetRangeAlignment_ValidRange(t *testing.T) {
	ctrl := NewAppController()
	ctrl.SetCellValue(0, 0, "A")
	ctrl.SetCellValue(0, 1, "B")
	ctrl.SetCellValue(0, 2, "C")

	err := ctrl.SetRangeAlignment(0, 0, 0, 2, "center")
	assert.NoError(t, err)
	for col := 0; col <= 2; col++ {
		cell := ctrl.Sheet.GetCell(0, col)
		assert.NotNil(t, cell)
		assert.Equal(t, "center", cell.Alignment)
	}
}

func TestSetRangeAlignment_InvalidAlignment(t *testing.T) {
	ctrl := NewAppController()
	assert.Error(t, ctrl.SetRangeAlignment(0, 0, 1, 1, "bad"))
}

func TestSetRangeAlignment_InvertedRange(t *testing.T) {
	ctrl := NewAppController()
	assert.Error(t, ctrl.SetRangeAlignment(5, 5, 0, 0, "left"))
}

func TestSetRangeAlignment_TooLarge(t *testing.T) {
	ctrl := NewAppController()
	// 101×100 = 10100 cells > 10000 max
	assert.Error(t, ctrl.SetRangeAlignment(0, 0, 100, 99, "left"))
}
