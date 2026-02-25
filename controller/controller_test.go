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
	assert.Contains(t, val, "Circular reference")
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
	s.SetCell(0, 0, "=B1")  // A1
	s.SetCell(0, 1, "=A1")  // B1 - cycle
	s.SetCell(2, 0, "=A1")  // C1 depends on A1
	data, err := s.SaveToBytes()
	assert.NoError(t, err)

	ctrl := NewAppController()
	err = ctrl.LoadFromBytes(data, "/cycle.sheet")
	assert.NoError(t, err)

	// Changing C1 triggers recalculateDependents; GetCalculationOrder fails (cycle), falls back to recalculateAllFormulas
	_ = ctrl.SetCellValue(2, 0, "=A1+1")
	// Should not panic; formulas recalculated
	val := ctrl.GetCellValue(2, 0)
	assert.Contains(t, val, "#ERROR") // A1 has cycle error, so C1 propagates it
}
