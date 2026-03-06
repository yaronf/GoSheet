package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- History unit tests ---

// mockCmd is a simple command that increments/decrements a counter.
type mockCmd struct {
	counter     *int
	description string
}

func (m *mockCmd) Do() error           { *m.counter++; return nil }
func (m *mockCmd) Undo() error         { *m.counter--; return nil }
func (m *mockCmd) Description() string { return m.description }

func newMockCmd(counter *int, desc string) *mockCmd {
	return &mockCmd{counter: counter, description: desc}
}

func TestHistoryPush(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Push(newMockCmd(&counter, "op2")))

	assert.Equal(t, 2, counter)
	assert.True(t, h.CanUndo())
	assert.False(t, h.CanRedo())
	assert.Equal(t, "op2", h.UndoDescription())
}

func TestHistoryUndo(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Push(newMockCmd(&counter, "op2")))
	assert.Equal(t, 2, counter)

	require.NoError(t, h.Undo())
	assert.Equal(t, 1, counter)
	assert.True(t, h.CanUndo())
	assert.True(t, h.CanRedo())
	assert.Equal(t, "op2", h.RedoDescription())

	require.NoError(t, h.Undo())
	assert.Equal(t, 0, counter)
	assert.False(t, h.CanUndo())
	assert.True(t, h.CanRedo())
}

func TestHistoryUndoEmpty(t *testing.T) {
	h := NewHistory()
	err := h.Undo()
	assert.Error(t, err)
}

func TestHistoryRedo(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Undo())
	assert.Equal(t, 0, counter)

	require.NoError(t, h.Redo())
	assert.Equal(t, 1, counter)
	assert.True(t, h.CanUndo())
	assert.False(t, h.CanRedo())
}

func TestHistoryRedoEmpty(t *testing.T) {
	h := NewHistory()
	err := h.Redo()
	assert.Error(t, err)
}

func TestHistoryCapEnforcement(t *testing.T) {
	h := NewHistory()
	counter := 0

	// Push HistoryCap+1 commands; the oldest should be dropped
	for range HistoryCap + 1 {
		require.NoError(t, h.Push(newMockCmd(&counter, "op")))
	}

	assert.Equal(t, HistoryCap+1, counter)
	assert.Equal(t, HistoryCap, len(h.undoStack))

	// Undo all — counter should go back to 1 (oldest was dropped, so one Do() can't be undone)
	for range HistoryCap {
		require.NoError(t, h.Undo())
	}
	assert.Equal(t, 1, counter)
	assert.False(t, h.CanUndo())
}

func TestHistoryMarkSaved_AtSavePoint(t *testing.T) {
	h := NewHistory()
	counter := 0

	// Fresh history is at save point (depth 0 == savedUndoDepth 0)
	assert.True(t, h.AtSavePoint())

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	assert.False(t, h.AtSavePoint())

	h.MarkSaved()
	assert.True(t, h.AtSavePoint())

	require.NoError(t, h.Undo())
	assert.False(t, h.AtSavePoint())

	require.NoError(t, h.Redo())
	assert.True(t, h.AtSavePoint())
}

func TestHistoryMarkSaved_CapInvalidation(t *testing.T) {
	h := NewHistory()
	counter := 0

	// Save at depth 0
	h.MarkSaved()
	assert.True(t, h.AtSavePoint())

	// Push enough to overflow the cap — save point should be invalidated
	for range HistoryCap + 1 {
		require.NoError(t, h.Push(newMockCmd(&counter, "op")))
	}
	assert.False(t, h.AtSavePoint(), "save point should be invalidated after cap overflow")
}

func TestHistoryMarkSaved_SaveMidHistory(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Push(newMockCmd(&counter, "op2")))
	h.MarkSaved() // saved at depth 2

	require.NoError(t, h.Undo()) // depth 1
	assert.False(t, h.AtSavePoint())

	require.NoError(t, h.Redo()) // depth 2
	assert.True(t, h.AtSavePoint())

	require.NoError(t, h.Push(newMockCmd(&counter, "op3"))) // depth 3, redo cleared
	assert.False(t, h.AtSavePoint())
}

func TestHistoryRedoStackClear(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Undo())
	assert.True(t, h.CanRedo())

	// Pushing a new command after undo must clear the redo stack
	require.NoError(t, h.Push(newMockCmd(&counter, "op2")))
	assert.False(t, h.CanRedo())
	assert.Equal(t, "", h.RedoDescription())
}

func TestHistoryClear(t *testing.T) {
	h := NewHistory()
	counter := 0

	require.NoError(t, h.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, h.Undo())
	assert.True(t, h.CanRedo()) // one op undone, redo stack has it

	h.Clear()
	assert.False(t, h.CanUndo())
	assert.False(t, h.CanRedo())
}

// --- SetCellCommand + AppController integration tests ---

func TestSetCellCommandRoundTrip_PlainValue(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "hello"))
	assert.Equal(t, "hello", ctrl.GetCellValue(0, 0))

	// Undo should restore empty cell
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "", ctrl.GetCellValue(0, 0))

	// Redo should restore "hello"
	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "hello", ctrl.GetCellValue(0, 0))
}

func TestSetCellCommandRoundTrip_OverwriteExisting(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "original"))
	require.NoError(t, ctrl.SetCellValue(0, 0, "updated"))
	assert.Equal(t, "updated", ctrl.GetCellValue(0, 0))

	// Undo most recent edit → back to "original"
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "original", ctrl.GetCellValue(0, 0))
}

func TestSetCellCommandRoundTrip_Formula(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "20"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "=A1+A2"))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))

	// Undo formula cell → cell should be gone
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "", ctrl.GetCellValue(2, 0))
}

func TestSetCellCommandUndo_FormulaDependencyChanged(t *testing.T) {
	ctrl := NewAppController()

	// Set up: A1=10, A2=20, A3=A1+A2 (=30)
	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "20"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "=A1+A2"))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))

	// Change A1 to 99 — A3 should now be 119
	require.NoError(t, ctrl.SetCellValue(0, 0, "99"))
	assert.Equal(t, "119", ctrl.GetCellValue(2, 0))

	// Undo the A1 change — A3 formula should re-evaluate with A1=10, so A3=30
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "10", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))
}

func TestHistoryClearedOnNewFile(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "data"))
	assert.True(t, ctrl.History.CanUndo())

	ctrl.NewFile()
	assert.False(t, ctrl.History.CanUndo())
	assert.False(t, ctrl.History.CanRedo())
}

func TestHistoryClearedOnLoadFile(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "data"))
	assert.True(t, ctrl.History.CanUndo())

	// Save to a temp file then reload
	dir := t.TempDir()
	path := dir + "/test.sheet"
	require.NoError(t, ctrl.SaveFile(path))
	require.NoError(t, ctrl.LoadFile(path))

	assert.False(t, ctrl.History.CanUndo())
	assert.False(t, ctrl.History.CanRedo())
}

// --- ClearRangeCommand tests ---

func TestClearRangeCommand_UndoRestoresValues(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "C"))

	ctrl.ClearRange(0, 0, 1, 1)
	assert.Equal(t, "", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", ctrl.GetCellValue(1, 0))

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "A", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "B", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "C", ctrl.GetCellValue(1, 0))
}

func TestClearRangeCommand_UndoRestoresFormula(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "=A1*2"))
	assert.Equal(t, "20", ctrl.GetCellValue(1, 0))

	ctrl.ClearRange(1, 0, 1, 0)
	assert.Equal(t, "", ctrl.GetCellValue(1, 0))

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "20", ctrl.GetCellValue(1, 0))
}

func TestClearRangeCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "hello"))

	ctrl.ClearRange(0, 0, 0, 0)
	assert.Equal(t, "", ctrl.GetCellValue(0, 0))

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "hello", ctrl.GetCellValue(0, 0))

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "", ctrl.GetCellValue(0, 0))
}

func TestClearRangeCommand_EmptyRange_NoHistoryEntry(t *testing.T) {
	ctrl := NewAppController()
	// No cells set — clearing an empty range should not push to history
	ctrl.ClearRange(0, 0, 2, 2)
	assert.False(t, ctrl.History.CanUndo())
}

func TestClearRangeCommand_Description(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "x"))
	ctrl.ClearRange(0, 0, 2, 3)
	assert.Equal(t, "Clear Range A1:D3", ctrl.History.UndoDescription())
}

func TestClearRangeCommand_SingleCell_Description(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(1, 1, "x"))
	ctrl.ClearRange(1, 1, 1, 1)
	assert.Equal(t, "Clear B2", ctrl.History.UndoDescription())
}

func TestSetCellCommandDescription(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "x"))
	assert.Equal(t, "Set Cell A1", ctrl.History.UndoDescription())

	require.NoError(t, ctrl.SetCellValue(2, 3, "y"))
	assert.Equal(t, "Set Cell D3", ctrl.History.UndoDescription())
}

// --- Structural command tests (Story 15.3) ---

func TestInsertRowCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "A2"))
	// Clear history so only structural ops are tracked
	ctrl.History.Clear()

	require.NoError(t, ctrl.InsertRow(1))
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellValue(1, 0))   // empty row inserted
	assert.Equal(t, "A2", ctrl.GetCellValue(2, 0)) // shifted down
	assert.Equal(t, "Insert Row 2", ctrl.History.UndoDescription())

	// Undo: remove inserted row
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "A2", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "", ctrl.GetCellValue(2, 0))

	// Redo: re-insert
	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "A2", ctrl.GetCellValue(2, 0))
}

func TestDeleteRowCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "A2"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "A3"))
	ctrl.History.Clear()

	require.NoError(t, ctrl.DeleteRow(1))
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "A3", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "", ctrl.GetCellValue(2, 0))
	assert.Equal(t, "Delete Row 2", ctrl.History.UndoDescription())

	// Undo: restore deleted row
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "A2", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "A3", ctrl.GetCellValue(2, 0))

	// Redo: re-delete
	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "A3", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "", ctrl.GetCellValue(2, 0))
}

func TestInsertColumnCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B1"))
	ctrl.History.Clear()

	require.NoError(t, ctrl.InsertColumn(1))
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellValue(0, 1))   // empty col inserted
	assert.Equal(t, "B1", ctrl.GetCellValue(0, 2)) // shifted right
	assert.Equal(t, "Insert Column B", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "B1", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", ctrl.GetCellValue(0, 2))

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "B1", ctrl.GetCellValue(0, 2))
}

func TestDeleteColumnCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B1"))
	require.NoError(t, ctrl.SetCellValue(0, 2, "C1"))
	ctrl.History.Clear()

	require.NoError(t, ctrl.DeleteColumn(1))
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "C1", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", ctrl.GetCellValue(0, 2))
	assert.Equal(t, "Delete Column B", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "B1", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "C1", ctrl.GetCellValue(0, 2))

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "A1", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "C1", ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", ctrl.GetCellValue(0, 2))
}

func TestDeleteRowCommand_RefBecomesError(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "20"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "=A1+A2")) // A2 = deleted row
	ctrl.History.Clear()

	require.NoError(t, ctrl.DeleteRow(1))
	// Formula at new row 1 contains #REF! because A2 referenced the deleted row
	cell := ctrl.Sheet.GetCell(1, 0)
	require.NotNil(t, cell)
	assert.True(t, cell.IsError, "formula referencing deleted row should produce an error cell")
	assert.Contains(t, cell.RawValue(), "#REF!")
}

// --- Formatting command tests (Story 15.4) ---

func TestApplyCellStyleCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "hello"))
	ctrl.History.Clear()

	// Apply style 1 (Title) to A1
	require.NoError(t, ctrl.ApplyStyleToCell(0, 0, 1))
	assert.Equal(t, 1, ctrl.Sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, "Apply Style to A1", ctrl.History.UndoDescription())

	// Undo → style reverts to 0
	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, 0, ctrl.Sheet.GetCell(0, 0).StyleId)

	// Redo → style back to 1
	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, 1, ctrl.Sheet.GetCell(0, 0).StyleId)
}

func TestApplyCellStyleCommand_NoStylePrev(t *testing.T) {
	ctrl := NewAppController()
	// Cell doesn't exist yet; apply style to empty position
	require.NoError(t, ctrl.ApplyStyleToCell(0, 0, 2))
	cell := ctrl.Sheet.GetCell(0, 0)
	require.NotNil(t, cell)
	assert.Equal(t, 2, cell.StyleId)

	_, err := ctrl.Undo()
	require.NoError(t, err)
	// Cell may exist (created by ApplyStyleToCell) but StyleId must be 0
	cell = ctrl.Sheet.GetCell(0, 0)
	if cell != nil {
		assert.Equal(t, 0, cell.StyleId)
	}
}

func TestApplyRangeStyleCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B"))
	ctrl.Sheet.GetCell(0, 0).StyleId = 2 // existing style on A1
	ctrl.History.Clear()

	require.NoError(t, ctrl.ApplyStyleToRange(0, 0, 0, 1, 3))
	assert.Equal(t, 3, ctrl.Sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, 3, ctrl.Sheet.GetCell(0, 1).StyleId)
	assert.Equal(t, "Apply Style to A1:B1", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, 2, ctrl.Sheet.GetCell(0, 0).StyleId) // restored to 2
	assert.Equal(t, 0, ctrl.Sheet.GetCell(0, 1).StyleId) // B1 had no style → 0

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, 3, ctrl.Sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, 3, ctrl.Sheet.GetCell(0, 1).StyleId)
}

func TestSetCellAlignmentCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "hello"))
	ctrl.History.Clear()

	require.NoError(t, ctrl.SetCellAlignment(0, 0, "center"))
	assert.Equal(t, "center", ctrl.Sheet.GetCell(0, 0).Alignment)
	assert.Equal(t, "Set Alignment A1", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "", ctrl.Sheet.GetCell(0, 0).Alignment)

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "center", ctrl.Sheet.GetCell(0, 0).Alignment)
}

func TestSetRangeAlignmentCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B"))
	ctrl.Sheet.GetCell(0, 0).Alignment = "left"
	ctrl.History.Clear()

	require.NoError(t, ctrl.SetRangeAlignment(0, 0, 0, 1, "right"))
	assert.Equal(t, "right", ctrl.Sheet.GetCell(0, 0).Alignment)
	assert.Equal(t, "right", ctrl.Sheet.GetCell(0, 1).Alignment)
	assert.Equal(t, "Set Alignment A1:B1", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "left", ctrl.Sheet.GetCell(0, 0).Alignment) // restored to "left"
	assert.Equal(t, "", ctrl.Sheet.GetCell(0, 1).Alignment)     // B1 had no alignment → ""

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Equal(t, "right", ctrl.Sheet.GetCell(0, 0).Alignment)
	assert.Equal(t, "right", ctrl.Sheet.GetCell(0, 1).Alignment)
}

func TestSetMergeCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "anchor"))
	ctrl.History.Clear()

	require.NoError(t, ctrl.SetMerge(0, 0, 1, 2))
	assert.Len(t, ctrl.Sheet.Merges, 1)
	assert.Equal(t, "Merge A1:B1", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Empty(t, ctrl.Sheet.Merges)

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Len(t, ctrl.Sheet.Merges, 1)
	assert.Equal(t, 0, ctrl.Sheet.Merges[0].StartRow)
	assert.Equal(t, 0, ctrl.Sheet.Merges[0].StartCol)
	assert.Equal(t, 1, ctrl.Sheet.Merges[0].RowSpan)
	assert.Equal(t, 2, ctrl.Sheet.Merges[0].ColSpan)
}

func TestUnmergeCommand_UndoRedo(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "anchor"))
	require.NoError(t, ctrl.SetMerge(0, 0, 2, 2))
	ctrl.History.Clear()

	require.NoError(t, ctrl.Unmerge(0, 0))
	assert.Empty(t, ctrl.Sheet.Merges)
	assert.Equal(t, "Unmerge A1", ctrl.History.UndoDescription())

	_, err := ctrl.Undo()
	require.NoError(t, err)
	assert.Len(t, ctrl.Sheet.Merges, 1)
	assert.Equal(t, 0, ctrl.Sheet.Merges[0].StartRow)
	assert.Equal(t, 0, ctrl.Sheet.Merges[0].StartCol)
	assert.Equal(t, 2, ctrl.Sheet.Merges[0].RowSpan)
	assert.Equal(t, 2, ctrl.Sheet.Merges[0].ColSpan)

	_, err = ctrl.Redo()
	require.NoError(t, err)
	assert.Empty(t, ctrl.Sheet.Merges)
}

func TestDeleteRowCommand_FormulaRefRestored(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "20"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "=A1+A2"))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))
	ctrl.History.Clear()

	require.NoError(t, ctrl.DeleteRow(1)) // delete row 1 (A2=20), formula shifts to =A1+A1
	// After delete, formula is at row 1 referencing A1+A1 (both refs shift down)
	// A1=10, so formula result = 20 (=A1+A1 where A1=10 and old A2 is gone)

	_, err := ctrl.Undo()
	require.NoError(t, err)
	// After undo, A1=10, A2=20, A3=A1+A2=30
	assert.Equal(t, "10", ctrl.GetCellValue(0, 0))
	assert.Equal(t, "20", ctrl.GetCellValue(1, 0))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))
}
