package controller

import (
	"fmt"
	"strings"

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
		// Trimming the oldest entry shifts all depths down by one.
		// If the save point was at or below the dropped entry, it's now unreachable.
		if h.savedDepthValid {
			h.savedUndoDepth--
			if h.savedUndoDepth < 0 {
				h.savedDepthValid = false
			}
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

// RangeCell represents a single cell write in a batch paste operation.
type RangeCell struct {
	Row, Col int
	Value    string
}

// SetRangeValuesCommand sets multiple cells atomically as a single undo entry.
// This is used by paste operations so that one Undo reverts the entire paste.
type SetRangeValuesCommand struct {
	ctrl      *AppController
	cells     []RangeCell
	prevCells map[int]map[int]*model.Cell // deep copies keyed by [row][col]
}

func (cmd *SetRangeValuesCommand) Do() error {
	// Snapshot current values before any writes
	cmd.prevCells = make(map[int]map[int]*model.Cell)
	for _, c := range cmd.cells {
		prev := cmd.ctrl.Sheet.GetCell(c.Row, c.Col)
		if prev != nil {
			cp := *prev
			if cmd.prevCells[c.Row] == nil {
				cmd.prevCells[c.Row] = make(map[int]*model.Cell)
			}
			cmd.prevCells[c.Row][c.Col] = &cp
		}
	}
	for _, c := range cmd.cells {
		if err := cmd.ctrl.setCellValueInternal(c.Row, c.Col, c.Value); err != nil {
			return err
		}
	}
	return nil
}

func (cmd *SetRangeValuesCommand) Undo() error {
	for _, c := range cmd.cells {
		var prev *model.Cell
		if cmd.prevCells[c.Row] != nil {
			prev = cmd.prevCells[c.Row][c.Col]
		}
		if prev == nil {
			// Cell did not exist before — delete it
			cellRef := model.CoordsToRef(c.Row, c.Col)
			cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
			cmd.ctrl.Sheet.DeleteCell(c.Row, c.Col)
			cmd.ctrl.Sheet.Modified = true
			cmd.ctrl.recalculateDependents([]string{cellRef})
		} else {
			// Restore previous state using same logic as SetCellCommand.Undo
			if cmd.ctrl.Sheet.Cells[c.Row] == nil {
				cmd.ctrl.Sheet.Cells[c.Row] = make(map[int]*model.Cell)
			}
			restored := *prev
			cellRef := model.CoordsToRef(c.Row, c.Col)
			cmd.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
			if restored.IsFormula {
				refs := model.ExtractCellReferences("=" + restored.Value)
				for _, ref := range refs {
					cmd.ctrl.Sheet.Dependencies.AddDependency(cellRef, ref)
				}
				val, err := model.EvaluateFormula("="+restored.Value, nil, cmd.ctrl.Sheet)
				if err != nil {
					restored.SetError(err.Error())
				} else {
					restored.SetFromValue(val)
				}
			}
			cmd.ctrl.Sheet.Cells[c.Row][c.Col] = &restored
			cmd.ctrl.Sheet.Modified = true
			cmd.ctrl.recalculateDependents([]string{cellRef})
		}
	}
	return nil
}

func (cmd *SetRangeValuesCommand) Description() string {
	return fmt.Sprintf("Paste %d cell(s)", len(cmd.cells))
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
		// Check for circular references BEFORE adding dependencies (same as setCellValueInternal)
		refs := model.ExtractCellReferences("=" + restored.Value)
		hasCycle := false
		var cycleStr string
		var cyclePath []string
		for _, ref := range refs {
			if cycle, path := cmd.ctrl.Sheet.Dependencies.DetectCircularReference(cellRef, ref); cycle {
				hasCycle = true
				cyclePath = path
				cycleStr = strings.Join(path, " → ")
				break
			}
		}
		// Now add the dependency edges
		for _, ref := range refs {
			cmd.ctrl.Sheet.Dependencies.AddDependency(cellRef, ref)
		}
		if hasCycle {
			cmd.ctrl.Sheet.Cells[cmd.row][cmd.col] = &restored
			cmd.ctrl.Sheet.Modified = true
			cmd.ctrl.propagateCycleError(cyclePath, cycleStr)
			return nil
		} else {
			// Re-evaluate to get a fresh Computed value (snapshot may be stale if
			// referenced cells changed between Do() and Undo())
			val, err := model.EvaluateFormula("="+restored.Value, nil, cmd.ctrl.Sheet)
			if err != nil {
				restored.SetError(err.Error())
			} else {
				restored.SetFromValue(val)
			}
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
				val, err := model.EvaluateFormula("="+cp.Value, nil, cmd.ctrl.Sheet)
				if err != nil {
					cp.SetError(err.Error())
				} else {
					cp.SetFromValue(val)
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

// InsertRowCommand is a reversible insert-row operation.
type InsertRowCommand struct {
	ctrl *AppController
	row  int
}

func (cmd *InsertRowCommand) Do() error {
	if err := cmd.ctrl.Sheet.InsertRow(cmd.row); err != nil {
		return err
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *InsertRowCommand) Undo() error {
	if _, err := cmd.ctrl.Sheet.DeleteRow(cmd.row); err != nil {
		return err
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *InsertRowCommand) Description() string {
	return fmt.Sprintf("Insert Row %d", cmd.row+1)
}

// DeleteRowCommand is a reversible delete-row operation.
// Snapshots: the deleted row's cells, all formula texts in the sheet (formula
// text is rewritten by both DeleteRow and InsertRow; restoring originals avoids
// double-shift without snapshotting non-formula cell data).
type DeleteRowCommand struct {
	ctrl            *AppController
	row             int
	snapshot        map[int]*model.Cell             // col → cell copy of deleted row, captured before Do()
	formulaSnapshot map[int]map[int]formulaSnapshot // [row][col] → formula state before delete
	merges          []model.MergeRegion             // merge regions captured before Do()
}

func (cmd *DeleteRowCommand) Do() error {
	// Snapshot merges and formula texts before delete rewrites them
	mergesCopy := make([]model.MergeRegion, len(cmd.ctrl.Sheet.Merges))
	copy(mergesCopy, cmd.ctrl.Sheet.Merges)
	cmd.merges = mergesCopy
	cmd.formulaSnapshot = snapshotFormulas(cmd.ctrl.Sheet)
	snapshot, err := cmd.ctrl.Sheet.DeleteRow(cmd.row)
	if err != nil {
		return err
	}
	cmd.snapshot = snapshot
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *DeleteRowCommand) Undo() error {
	// Re-insert the empty row (shifts cells back down, also rewrites formula refs)
	if err := cmd.ctrl.Sheet.InsertRow(cmd.row); err != nil {
		return err
	}
	// Restore deleted row's cells
	if cmd.ctrl.Sheet.Cells[cmd.row] == nil {
		cmd.ctrl.Sheet.Cells[cmd.row] = make(map[int]*model.Cell)
	}
	for col, cell := range cmd.snapshot {
		cp := *cell
		cmd.ctrl.Sheet.Cells[cmd.row][col] = &cp
	}
	// Restore original formula texts (InsertRow re-shifted them; use pre-delete originals)
	restoreFormulas(cmd.ctrl.Sheet, cmd.formulaSnapshot)
	// Restore merge regions
	if cmd.merges != nil {
		cmd.ctrl.Sheet.Merges = cmd.merges
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *DeleteRowCommand) Description() string {
	return fmt.Sprintf("Delete Row %d", cmd.row+1)
}

// InsertColumnCommand is a reversible insert-column operation.
type InsertColumnCommand struct {
	ctrl *AppController
	col  int
}

func (cmd *InsertColumnCommand) Do() error {
	if err := cmd.ctrl.Sheet.InsertColumn(cmd.col); err != nil {
		return err
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *InsertColumnCommand) Undo() error {
	if _, err := cmd.ctrl.Sheet.DeleteColumn(cmd.col); err != nil {
		return err
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *InsertColumnCommand) Description() string {
	return "Insert Column " + model.ColIndexToLetter(cmd.col)
}

// DeleteColumnCommand is a reversible delete-column operation.
// Same formula-snapshot strategy as DeleteRowCommand.
type DeleteColumnCommand struct {
	ctrl            *AppController
	col             int
	snapshot        map[int]*model.Cell             // row → cell copy of deleted col, captured before Do()
	formulaSnapshot map[int]map[int]formulaSnapshot // [row][col] → formula state before delete
	merges          []model.MergeRegion             // merge regions captured before Do()
}

func (cmd *DeleteColumnCommand) Do() error {
	// Snapshot merges and formula texts before delete rewrites them
	mergesCopy := make([]model.MergeRegion, len(cmd.ctrl.Sheet.Merges))
	copy(mergesCopy, cmd.ctrl.Sheet.Merges)
	cmd.merges = mergesCopy
	cmd.formulaSnapshot = snapshotFormulas(cmd.ctrl.Sheet)
	snapshot, err := cmd.ctrl.Sheet.DeleteColumn(cmd.col)
	if err != nil {
		return err
	}
	cmd.snapshot = snapshot
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *DeleteColumnCommand) Undo() error {
	if err := cmd.ctrl.Sheet.InsertColumn(cmd.col); err != nil {
		return err
	}
	for row, cell := range cmd.snapshot {
		if cmd.ctrl.Sheet.Cells[row] == nil {
			cmd.ctrl.Sheet.Cells[row] = make(map[int]*model.Cell)
		}
		cp := *cell
		cmd.ctrl.Sheet.Cells[row][cmd.col] = &cp
	}
	restoreFormulas(cmd.ctrl.Sheet, cmd.formulaSnapshot)
	if cmd.merges != nil {
		cmd.ctrl.Sheet.Merges = cmd.merges
	}
	cmd.ctrl.rebuildDependencyGraph()
	cmd.ctrl.recalculateAllFormulas()
	return nil
}

func (cmd *DeleteColumnCommand) Description() string {
	return "Delete Column " + model.ColIndexToLetter(cmd.col)
}

// ApplyCellStyleCommand is a reversible apply-style-to-cell operation.
type ApplyCellStyleCommand struct {
	ctrl        *AppController
	row, col    int
	newStyleId  int
	prevStyleId int // captured in Do()
}

func (cmd *ApplyCellStyleCommand) Do() error {
	cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
	if cell != nil {
		cmd.prevStyleId = cell.StyleId
	}
	return cmd.ctrl.Sheet.ApplyStyleToCell(cmd.row, cmd.col, cmd.newStyleId)
}

func (cmd *ApplyCellStyleCommand) Undo() error {
	if cmd.prevStyleId == 0 {
		cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
		if cell != nil {
			cell.StyleId = 0
			cmd.ctrl.Sheet.Modified = true
		}
		return nil
	}
	return cmd.ctrl.Sheet.ApplyStyleToCell(cmd.row, cmd.col, cmd.prevStyleId)
}

func (cmd *ApplyCellStyleCommand) Description() string {
	return "Apply Style to " + model.CoordsToRef(cmd.row, cmd.col)
}

// ApplyRangeStyleCommand is a reversible apply-style-to-range operation.
type ApplyRangeStyleCommand struct {
	ctrl               *AppController
	startRow, startCol int
	endRow, endCol     int
	newStyleId         int
	prevStyles         map[int]map[int]int // [row][col] → prevStyleId
}

func (cmd *ApplyRangeStyleCommand) Do() error {
	// Snapshot per-cell previous styles
	cmd.prevStyles = make(map[int]map[int]int)
	for r := cmd.startRow; r <= cmd.endRow; r++ {
		for c := cmd.startCol; c <= cmd.endCol; c++ {
			cell := cmd.ctrl.Sheet.GetCell(r, c)
			if cell != nil && cell.StyleId != 0 {
				if cmd.prevStyles[r] == nil {
					cmd.prevStyles[r] = make(map[int]int)
				}
				cmd.prevStyles[r][c] = cell.StyleId
			}
		}
	}
	return cmd.ctrl.Sheet.ApplyStyleToRange(cmd.startRow, cmd.startCol, cmd.endRow, cmd.endCol, cmd.newStyleId)
}

func (cmd *ApplyRangeStyleCommand) Undo() error {
	for r := cmd.startRow; r <= cmd.endRow; r++ {
		for c := cmd.startCol; c <= cmd.endCol; c++ {
			cell := cmd.ctrl.Sheet.GetCell(r, c)
			if cell == nil {
				continue
			}
			prev := 0
			if cmd.prevStyles[r] != nil {
				prev = cmd.prevStyles[r][c]
			}
			cell.StyleId = prev
		}
	}
	cmd.ctrl.Sheet.Modified = true
	return nil
}

func (cmd *ApplyRangeStyleCommand) Description() string {
	start := model.CoordsToRef(cmd.startRow, cmd.startCol)
	end := model.CoordsToRef(cmd.endRow, cmd.endCol)
	if start == end {
		return "Apply Style to " + start
	}
	return "Apply Style to " + start + ":" + end
}

// SetCellAlignmentCommand is a reversible set-alignment-on-cell operation.
type SetCellAlignmentCommand struct {
	ctrl          *AppController
	row, col      int
	newAlignment  string
	prevAlignment string // captured in Do()
}

func (cmd *SetCellAlignmentCommand) Do() error {
	cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
	if cell != nil {
		cmd.prevAlignment = cell.Alignment
	}
	return cmd.ctrl.Sheet.SetCellAlignment(cmd.row, cmd.col, cmd.newAlignment)
}

func (cmd *SetCellAlignmentCommand) Undo() error {
	cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
	if cell != nil {
		cell.Alignment = cmd.prevAlignment
		cmd.ctrl.Sheet.Modified = true
	}
	return nil
}

func (cmd *SetCellAlignmentCommand) Description() string {
	return "Set Alignment " + model.CoordsToRef(cmd.row, cmd.col)
}

// SetRangeAlignmentCommand is a reversible set-alignment-on-range operation.
type SetRangeAlignmentCommand struct {
	ctrl               *AppController
	startRow, startCol int
	endRow, endCol     int
	newAlignment       string
	prevAlignments     map[int]map[int]string // [row][col] → prevAlignment
}

func (cmd *SetRangeAlignmentCommand) Do() error {
	cmd.prevAlignments = make(map[int]map[int]string)
	for r := cmd.startRow; r <= cmd.endRow; r++ {
		for c := cmd.startCol; c <= cmd.endCol; c++ {
			cell := cmd.ctrl.Sheet.GetCell(r, c)
			if cell != nil && cell.Alignment != "" {
				if cmd.prevAlignments[r] == nil {
					cmd.prevAlignments[r] = make(map[int]string)
				}
				cmd.prevAlignments[r][c] = cell.Alignment
			}
		}
	}
	return cmd.ctrl.Sheet.SetRangeAlignment(cmd.startRow, cmd.startCol, cmd.endRow, cmd.endCol, cmd.newAlignment)
}

func (cmd *SetRangeAlignmentCommand) Undo() error {
	for r := cmd.startRow; r <= cmd.endRow; r++ {
		for c := cmd.startCol; c <= cmd.endCol; c++ {
			cell := cmd.ctrl.Sheet.GetCell(r, c)
			if cell == nil {
				continue
			}
			prev := ""
			if cmd.prevAlignments[r] != nil {
				prev = cmd.prevAlignments[r][c]
			}
			cell.Alignment = prev
		}
	}
	cmd.ctrl.Sheet.Modified = true
	return nil
}

func (cmd *SetRangeAlignmentCommand) Description() string {
	start := model.CoordsToRef(cmd.startRow, cmd.startCol)
	end := model.CoordsToRef(cmd.endRow, cmd.endCol)
	if start == end {
		return "Set Alignment " + start
	}
	return "Set Alignment " + start + ":" + end
}

// SetMergeCommand is a reversible merge operation.
// Validation (overlap check, nonEmpty check) runs inside Do() so that invalid
// merges are rejected before being pushed onto the undo stack.
type SetMergeCommand struct {
	ctrl               *AppController
	startRow, startCol int
	rowSpan, colSpan   int
}

func (cmd *SetMergeCommand) Do() error {
	if cmd.startRow < 0 || cmd.startCol < 0 || cmd.rowSpan < 1 || cmd.colSpan < 1 {
		return fmt.Errorf("invalid merge: startRow and startCol must be >= 0, rowSpan and colSpan must be >= 1")
	}
	newMerge := model.MergeRegion{StartRow: cmd.startRow, StartCol: cmd.startCol, RowSpan: cmd.rowSpan, ColSpan: cmd.colSpan}
	for _, m := range cmd.ctrl.Sheet.Merges {
		if rectanglesOverlap(newMerge, m) {
			return fmt.Errorf("merge overlaps existing region at (%d,%d)", m.StartRow, m.StartCol)
		}
	}
	nonEmpty := 0
	for r := cmd.startRow; r < cmd.startRow+cmd.rowSpan; r++ {
		for c := cmd.startCol; c < cmd.startCol+cmd.colSpan; c++ {
			cell := cmd.ctrl.Sheet.GetCell(r, c)
			if cell != nil && cell.Value != "" {
				nonEmpty++
			}
		}
	}
	if nonEmpty > 1 {
		return fmt.Errorf("only one cell in the selection may have content to merge")
	}
	cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges, newMerge)
	cmd.ctrl.Sheet.Modified = true
	return nil
}

func (cmd *SetMergeCommand) Undo() error {
	for i, m := range cmd.ctrl.Sheet.Merges {
		if m.StartRow == cmd.startRow && m.StartCol == cmd.startCol &&
			m.RowSpan == cmd.rowSpan && m.ColSpan == cmd.colSpan {
			cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges[:i], cmd.ctrl.Sheet.Merges[i+1:]...)
			cmd.ctrl.Sheet.Modified = true
			return nil
		}
	}
	return fmt.Errorf("merge region not found during undo")
}

func (cmd *SetMergeCommand) Description() string {
	start := model.CoordsToRef(cmd.startRow, cmd.startCol)
	endRow := cmd.startRow + cmd.rowSpan - 1
	endCol := cmd.startCol + cmd.colSpan - 1
	end := model.CoordsToRef(endRow, endCol)
	return "Merge " + start + ":" + end
}

// UnmergeCommand is a reversible unmerge operation.
// The removed MergeRegion is captured inside Do() for restoration in Undo().
type UnmergeCommand struct {
	ctrl               *AppController
	startRow, startCol int
	snapshot           model.MergeRegion // captured in Do()
}

func (cmd *UnmergeCommand) Do() error {
	for i, m := range cmd.ctrl.Sheet.Merges {
		if m.StartRow == cmd.startRow && m.StartCol == cmd.startCol {
			cmd.snapshot = m
			cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges[:i], cmd.ctrl.Sheet.Merges[i+1:]...)
			cmd.ctrl.Sheet.Modified = true
			return nil
		}
	}
	return fmt.Errorf("no merge region with anchor at (%d,%d)", cmd.startRow, cmd.startCol)
}

func (cmd *UnmergeCommand) Undo() error {
	cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges, cmd.snapshot)
	cmd.ctrl.Sheet.Modified = true
	return nil
}

func (cmd *UnmergeCommand) Description() string {
	return "Unmerge " + model.CoordsToRef(cmd.startRow, cmd.startCol)
}

// snapshotFormulas captures the formula text of all formula cells in the sheet.
// Only formula cells are captured since non-formula cell values don't change
// during row/column insert/delete operations.
type formulaSnapshot struct {
	value       string
	invalidRefs []string
}

func snapshotFormulas(sheet *model.Spreadsheet) map[int]map[int]formulaSnapshot {
	snap := make(map[int]map[int]formulaSnapshot)
	for r, rowMap := range sheet.Cells {
		for c, cell := range rowMap {
			if cell != nil && cell.IsFormula && cell.Value != "" {
				if snap[r] == nil {
					snap[r] = make(map[int]formulaSnapshot)
				}
				var refs []string
				if len(cell.InvalidRefs) > 0 {
					refs = append([]string(nil), cell.InvalidRefs...)
				}
				snap[r][c] = formulaSnapshot{value: cell.Value, invalidRefs: refs}
			}
		}
	}
	return snap
}

// restoreFormulas writes formula state back from a snapshot produced by snapshotFormulas.
// It clears ParsedFormula so recalculateAllFormulas rebuilds the AST, then re-applies
// InvalidRefs so cells that were #REF! before the structural op are restored correctly.
func restoreFormulas(sheet *model.Spreadsheet, snap map[int]map[int]formulaSnapshot) {
	for r, colMap := range snap {
		for c, fs := range colMap {
			if cell := sheet.GetCell(r, c); cell != nil && cell.IsFormula {
				cell.Value = fs.value
				cell.ParsedFormula = nil
				cell.InvalidRefs = fs.invalidRefs
			}
		}
	}
}
