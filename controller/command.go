package controller

import (
	"fmt"

	"gosheet/model"
)

// Command represents a reversible operation. All mutating operations must
// implement this interface to participate in undo/redo history.
type Command interface {
	Do() error
	Undo() error
	Description() string
}

// HistoryCap is the maximum number of operations kept in the undo stack.
// This value balances memory usage against practical undo depth; most users
// never need more than 100 steps, and Excel/Sheets both default to 100.
const HistoryCap = 100

// History manages the undo/redo stacks for a spreadsheet session.
// It is not safe for concurrent use; callers must hold the controller lock.
type History struct {
	undoStack       []Command
	redoStack       []Command
	savedUndoDepth  int  // undo stack depth at last save
	savedDepthValid bool // false if the save point was pushed off by the cap
}

// NewHistory creates an empty History.
func NewHistory() *History {
	return &History{savedDepthValid: true}
}

// Push executes cmd.Do() and, if successful, appends it to the undo stack.
// The redo stack is cleared and the oldest entry is dropped when the cap is reached.
func (h *History) Push(cmd Command) error {
	if err := cmd.Do(); err != nil {
		return err
	}
	h.undoStack = append(h.undoStack, cmd)
	h.redoStack = nil
	if len(h.undoStack) > HistoryCap {
		h.undoStack = h.undoStack[1:]
		// The saved depth was pushed off the bottom of the stack; it's unreachable.
		if h.savedDepthValid && h.savedUndoDepth < len(h.undoStack) {
			h.savedDepthValid = false
		}
	}
	return nil
}

// MarkSaved records the current undo stack depth as the last-saved state.
// Call this immediately after a successful file save.
func (h *History) MarkSaved() {
	h.savedUndoDepth = len(h.undoStack)
	h.savedDepthValid = true
}

// AtSavePoint reports whether the current undo stack depth matches the last
// saved state, meaning no net changes exist relative to the saved file.
func (h *History) AtSavePoint() bool {
	return h.savedDepthValid && len(h.undoStack) == h.savedUndoDepth
}

// Undo reverses the most recent command. Returns an error if the undo stack is empty.
func (h *History) Undo() error {
	if len(h.undoStack) == 0 {
		return fmt.Errorf("nothing to undo")
	}
	cmd := h.undoStack[len(h.undoStack)-1]
	h.undoStack = h.undoStack[:len(h.undoStack)-1]
	if err := cmd.Undo(); err != nil {
		return err
	}
	h.redoStack = append(h.redoStack, cmd)
	return nil
}

// Redo reapplies the most recently undone command. Returns an error if the redo stack is empty.
func (h *History) Redo() error {
	if len(h.redoStack) == 0 {
		return fmt.Errorf("nothing to redo")
	}
	cmd := h.redoStack[len(h.redoStack)-1]
	h.redoStack = h.redoStack[:len(h.redoStack)-1]
	if err := cmd.Do(); err != nil {
		return err
	}
	h.undoStack = append(h.undoStack, cmd)
	return nil
}

// Clear empties both stacks and resets the save point. Called on NewFile and LoadFile.
func (h *History) Clear() {
	h.undoStack = nil
	h.redoStack = nil
	h.savedUndoDepth = 0
	h.savedDepthValid = true
}

// CanUndo reports whether there is an operation available to undo.
func (h *History) CanUndo() bool {
	return len(h.undoStack) > 0
}

// CanRedo reports whether there is an operation available to redo.
func (h *History) CanRedo() bool {
	return len(h.redoStack) > 0
}

// UndoDescription returns the description of the next undo command, or "" if none.
func (h *History) UndoDescription() string {
	if len(h.undoStack) == 0 {
		return ""
	}
	return h.undoStack[len(h.undoStack)-1].Description()
}

// RedoDescription returns the description of the next redo command, or "" if none.
func (h *History) RedoDescription() string {
	if len(h.redoStack) == 0 {
		return ""
	}
	return h.redoStack[len(h.redoStack)-1].Description()
}

// SetCellCommand is a reversible set-cell operation.
// It captures a deep copy of the previous cell state so Undo can restore it exactly,
// including computed values, formula flags, and error state.
type SetCellCommand struct {
	ctrl     *AppController
	row, col int
	newValue string
	prevCell *model.Cell // nil if the cell did not exist before Do()
}

func (cmd *SetCellCommand) Do() error {
	return cmd.ctrl.setCellValueInternal(cmd.row, cmd.col, cmd.newValue)
}

func (cmd *SetCellCommand) Undo() error {
	if cmd.prevCell == nil {
		// Cell did not exist before — delete it
		cellRef := model.CoordsToRef(cmd.row, cmd.col)
		cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
		cmd.ctrl.Sheet.DeleteCell(cmd.row, cmd.col)
		cmd.ctrl.Sheet.Modified = true
		cmd.ctrl.recalculateDependents([]string{cellRef})
		return nil
	}
	// Restore the exact previous cell state
	if cmd.ctrl.Sheet.Cells[cmd.row] == nil {
		cmd.ctrl.Sheet.Cells[cmd.row] = make(map[int]*model.Cell)
	}
	restored := *cmd.prevCell
	cellRef := model.CoordsToRef(cmd.row, cmd.col)
	cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
	if restored.IsFormula {
		// Rebuild dependency edges for the restored formula
		refs := model.ExtractCellReferences("=" + restored.Value)
		for _, ref := range refs {
			cmd.ctrl.Sheet.Dependencies.AddDependency(cellRef, ref)
		}
		// Re-evaluate to get a fresh Computed value (snapshot may be stale if
		// referenced cells changed between Do() and Undo())
		result, isErr, err := model.EvaluateFormula("="+restored.Value, cmd.ctrl.Sheet)
		if err != nil {
			restored.SetError(err.Error())
		} else if isErr {
			restored.SetError(result)
		} else {
			restored.SetComputed(result)
		}
	}
	cmd.ctrl.Sheet.Cells[cmd.row][cmd.col] = &restored
	cmd.ctrl.Sheet.Modified = true
	cmd.ctrl.recalculateDependents([]string{cellRef})
	return nil
}

func (cmd *SetCellCommand) Description() string {
	return "Set Cell " + model.CoordsToRef(cmd.row, cmd.col)
}

// ClearRangeCommand is a reversible clear-range operation.
// It snapshots all clearable cells in the range before clearing them so Undo
// can restore them exactly (values, formulas, styles, alignment, error state).
type ClearRangeCommand struct {
	ctrl               *AppController
	startRow, startCol int
	endRow, endCol     int
	prevCells          map[int]map[int]*model.Cell // deep copies keyed by [row][col]
}

func (cmd *ClearRangeCommand) Do() error {
	var changed []string
	for row := cmd.startRow; row <= cmd.endRow; row++ {
		for col := cmd.startCol; col <= cmd.endCol; col++ {
			if !cmd.ctrl.Sheet.ShouldClearCell(row, col) {
				continue
			}
			cell := cmd.ctrl.Sheet.GetCell(row, col)
			if cell == nil {
				continue
			}
			cellRef := model.CoordsToRef(row, col)
			cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
			cmd.ctrl.Sheet.SetCell(row, col, "")
			changed = append(changed, cellRef)
		}
	}
	if len(changed) > 0 {
		cmd.ctrl.Sheet.Modified = true
		cmd.ctrl.recalculateDependents(changed)
	}
	return nil
}

func (cmd *ClearRangeCommand) Undo() error {
	var restored []string
	for row, colMap := range cmd.prevCells {
		if cmd.ctrl.Sheet.Cells[row] == nil {
			cmd.ctrl.Sheet.Cells[row] = make(map[int]*model.Cell)
		}
		for col, prev := range colMap {
			cp := *prev
			cellRef := model.CoordsToRef(row, col)
			cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
			if cp.IsFormula {
				refs := model.ExtractCellReferences("=" + cp.Value)
				for _, ref := range refs {
					cmd.ctrl.Sheet.Dependencies.AddDependency(cellRef, ref)
				}
				// Re-evaluate to get fresh Computed (snapshot may be stale)
				result, isErr, err := model.EvaluateFormula("="+cp.Value, cmd.ctrl.Sheet)
				if err != nil {
					cp.SetError(err.Error())
				} else if isErr {
					cp.SetError(result)
				} else {
					cp.SetComputed(result)
				}
			}
			cmd.ctrl.Sheet.Cells[row][col] = &cp
			restored = append(restored, cellRef)
		}
	}
	if len(restored) > 0 {
		cmd.ctrl.Sheet.Modified = true
		cmd.ctrl.recalculateDependents(restored)
	}
	return nil
}

func (cmd *ClearRangeCommand) Description() string {
	start := model.CoordsToRef(cmd.startRow, cmd.startCol)
	end := model.CoordsToRef(cmd.endRow, cmd.endCol)
	if start == end {
		return "Clear " + start
	}
	return "Clear Range " + start + ":" + end
}
