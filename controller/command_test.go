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
	require.NoError(t, ctrl.Undo())
	assert.Equal(t, "", ctrl.GetCellValue(0, 0))

	// Redo should restore "hello"
	require.NoError(t, ctrl.Redo())
	assert.Equal(t, "hello", ctrl.GetCellValue(0, 0))
}

func TestSetCellCommandRoundTrip_OverwriteExisting(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "original"))
	require.NoError(t, ctrl.SetCellValue(0, 0, "updated"))
	assert.Equal(t, "updated", ctrl.GetCellValue(0, 0))

	// Undo most recent edit → back to "original"
	require.NoError(t, ctrl.Undo())
	assert.Equal(t, "original", ctrl.GetCellValue(0, 0))
}

func TestSetCellCommandRoundTrip_Formula(t *testing.T) {
	ctrl := NewAppController()

	require.NoError(t, ctrl.SetCellValue(0, 0, "10"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "20"))
	require.NoError(t, ctrl.SetCellValue(2, 0, "=A1+A2"))
	assert.Equal(t, "30", ctrl.GetCellValue(2, 0))

	// Undo formula cell → cell should be gone
	require.NoError(t, ctrl.Undo())
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
	require.NoError(t, ctrl.Undo())
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

func TestSetCellCommandDescription(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "x"))
	assert.Equal(t, "Set Cell A1", ctrl.History.UndoDescription())

	require.NoError(t, ctrl.SetCellValue(2, 3, "y"))
	assert.Equal(t, "Set Cell D3", ctrl.History.UndoDescription())
}
