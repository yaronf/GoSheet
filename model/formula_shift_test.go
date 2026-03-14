package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newFormulaCell creates a Cell with a formula and a fully-resolved ParsedFormula AST.
func newFormulaCell(t *testing.T, formula string) *Cell {
	t.Helper()
	cell := NewCell(formula)
	require.True(t, cell.IsFormula, "expected formula cell for: %s", formula)
	require.NotNil(t, cell.ParsedFormula, "expected parsed AST for: %s", formula)
	return cell
}

// cellValue returns "=" + cell.Value for display in assertions.
func cellValue(cell *Cell) string {
	return "=" + cell.Value
}

// firstCellRef returns the first CellRef node found in the formula AST, or nil if none.
func firstCellRef(cell *Cell) *CellRef {
	var found *CellRef
	WalkPrimaries(cell.ParsedFormula, func(prim *Primary) {
		if found == nil && prim.CellRef != nil {
			found = prim.CellRef
		}
	})
	return found
}

// firstRange returns the first Range node found in the formula AST, or nil if none.
func firstRange(cell *Cell) *Range {
	var found *Range
	WalkPrimaries(cell.ParsedFormula, func(prim *Primary) {
		if found == nil && prim.Range != nil {
			found = prim.Range
		}
	})
	return found
}

// --- Insert (shift up/right) ---

func TestShiftFormulaRefsForInsertRow(t *testing.T) {
	t.Run("ref at row 0 shifts when inserting at row 0", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertRow(cell, 0)
		assert.Equal(t, "=A2", cellValue(cell))
		assert.Equal(t, 1, firstCellRef(cell).Row)
	})
	t.Run("ref at row 0 unchanged when inserting at row 1", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertRow(cell, 1)
		assert.Equal(t, "=A1", cellValue(cell))
	})
	t.Run("multiple refs shift correctly", func(t *testing.T) {
		cell := newFormulaCell(t, "=A2+B3")
		shiftFormulaRefsForInsertRow(cell, 1)
		assert.Equal(t, "=A3+B4", cellValue(cell))
	})
	t.Run("negative index: formula unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertRow(cell, -1)
		assert.Equal(t, "=A1", cellValue(cell))
	})
}

func TestShiftFormulaRefsForInsertColumn(t *testing.T) {
	t.Run("ref at col 0 shifts when inserting at col 0", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertColumn(cell, 0)
		assert.Equal(t, "=B1", cellValue(cell))
	})
	t.Run("ref at col 0 unchanged when inserting at col 1", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertColumn(cell, 1)
		assert.Equal(t, "=A1", cellValue(cell))
	})
	t.Run("multiple refs shift correctly", func(t *testing.T) {
		cell := newFormulaCell(t, "=B1+C2")
		shiftFormulaRefsForInsertColumn(cell, 1)
		assert.Equal(t, "=C1+D2", cellValue(cell))
	})
	t.Run("negative index: formula unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		shiftFormulaRefsForInsertColumn(cell, -1)
		assert.Equal(t, "=A1", cellValue(cell))
	})
}

// --- Delete row (unshift) ---

func TestUnshiftFormulaRefsForDeleteRow(t *testing.T) {
	t.Run("ref below deleted row shifts up", func(t *testing.T) {
		cell := newFormulaCell(t, "=A3")
		unshiftFormulaRefsForDeleteRow(cell, 1) // delete row 1 (A2); A3 → A2
		assert.Equal(t, "=A2", cellValue(cell))
		assert.False(t, firstCellRef(cell).Invalid)
	})
	t.Run("ref at deleted row becomes invalid; value string stays parseable", func(t *testing.T) {
		cell := newFormulaCell(t, "=A2")
		unshiftFormulaRefsForDeleteRow(cell, 1) // delete row 1 (A2)
		ref := firstCellRef(cell)
		require.NotNil(t, ref)
		assert.True(t, ref.Invalid)
		// Ref string is preserved (so Value stays parseable)
		assert.Equal(t, "A2", ref.Ref)
		// InvalidRefs records it
		assert.Contains(t, cell.InvalidRefs, "A2")
		// Value is still a valid formula (not "#REF!" as literal text)
		_, parseErr := ParseFormula("=" + cell.Value)
		assert.NoError(t, parseErr, "Value must remain parseable after invalidation")
	})
	t.Run("ref before deleted row: unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		unshiftFormulaRefsForDeleteRow(cell, 1)
		assert.Equal(t, "=A1", cellValue(cell))
		assert.Empty(t, cell.InvalidRefs)
	})
	t.Run("multiple refs: one shifts, one invalid", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1+A2")
		unshiftFormulaRefsForDeleteRow(cell, 1)
		// A1 stays; A2 becomes invalid
		assert.Equal(t, "=A1+A2", cellValue(cell)) // Value still parseable
		assert.Contains(t, cell.InvalidRefs, "A2")
		assert.Len(t, cell.InvalidRefs, 1)
	})
	t.Run("refs above deleted row shift", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1+A3")
		unshiftFormulaRefsForDeleteRow(cell, 1)
		assert.Equal(t, "=A1+A2", cellValue(cell))
		assert.Empty(t, cell.InvalidRefs)
	})
	t.Run("negative index: formula unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=A2")
		unshiftFormulaRefsForDeleteRow(cell, -1)
		assert.Equal(t, "=A2", cellValue(cell))
	})
}

// --- Delete column (unshift) ---

func TestUnshiftFormulaRefsForDeleteColumn(t *testing.T) {
	t.Run("ref right of deleted col shifts left", func(t *testing.T) {
		cell := newFormulaCell(t, "=C1")
		unshiftFormulaRefsForDeleteColumn(cell, 1) // delete col B
		assert.Equal(t, "=B1", cellValue(cell))
	})
	t.Run("ref at deleted col becomes invalid; value stays parseable", func(t *testing.T) {
		cell := newFormulaCell(t, "=B1")
		unshiftFormulaRefsForDeleteColumn(cell, 1)
		ref := firstCellRef(cell)
		require.NotNil(t, ref)
		assert.True(t, ref.Invalid)
		assert.Contains(t, cell.InvalidRefs, "B1")
		_, parseErr := ParseFormula("=" + cell.Value)
		assert.NoError(t, parseErr)
	})
	t.Run("ref before deleted col: unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1")
		unshiftFormulaRefsForDeleteColumn(cell, 1)
		assert.Equal(t, "=A1", cellValue(cell))
		assert.Empty(t, cell.InvalidRefs)
	})
	t.Run("multiple refs: one shifts, one invalid", func(t *testing.T) {
		cell := newFormulaCell(t, "=A1+B1")
		unshiftFormulaRefsForDeleteColumn(cell, 1)
		assert.Contains(t, cell.InvalidRefs, "B1")
		assert.Len(t, cell.InvalidRefs, 1)
	})
	t.Run("negative index: formula unchanged", func(t *testing.T) {
		cell := newFormulaCell(t, "=B1")
		unshiftFormulaRefsForDeleteColumn(cell, -1)
		assert.Equal(t, "=B1", cellValue(cell))
	})
}

// --- Range handling ---

func TestRangeShiftInsertRow(t *testing.T) {
	t.Run("range entirely below insert point shifts both endpoints", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A2:A4)")
		shiftFormulaRefsForInsertRow(cell, 1)
		assert.Equal(t, "=SUM(A3:A5)", cellValue(cell))
	})
	t.Run("range straddles insert point: end shifts, start stays", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A1:A3)")
		shiftFormulaRefsForInsertRow(cell, 2)
		assert.Equal(t, "=SUM(A1:A4)", cellValue(cell))
	})
}

func TestRangeShiftDeleteRow(t *testing.T) {
	t.Run("delete row at range start → range invalid", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A1:A3)")
		unshiftFormulaRefsForDeleteRow(cell, 0) // delete row 0 = A1
		rng := firstRange(cell)
		require.NotNil(t, rng)
		assert.True(t, rng.Invalid)
		assert.Contains(t, cell.InvalidRefs, "A1:A3")
		_, parseErr := ParseFormula("=" + cell.Value)
		assert.NoError(t, parseErr)
	})
	t.Run("delete row at range end → range invalid", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A1:A3)")
		unshiftFormulaRefsForDeleteRow(cell, 2) // delete row 2 = A3
		rng := firstRange(cell)
		require.NotNil(t, rng)
		assert.True(t, rng.Invalid)
		assert.Contains(t, cell.InvalidRefs, "A1:A3")
	})
	t.Run("delete interior row → range shrinks", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A1:A3)")
		unshiftFormulaRefsForDeleteRow(cell, 1) // delete row 1 (interior)
		assert.Equal(t, "=SUM(A1:A2)", cellValue(cell))
		assert.Empty(t, cell.InvalidRefs)
	})
	t.Run("delete row outside range → range shifts endpoints", func(t *testing.T) {
		cell := newFormulaCell(t, "=SUM(A3:A5)")
		unshiftFormulaRefsForDeleteRow(cell, 1) // delete row 1, range is rows 2-4 → becomes 1-3
		assert.Equal(t, "=SUM(A2:A4)", cellValue(cell))
		assert.Empty(t, cell.InvalidRefs)
	})
}

// --- Evaluation after shift ---

func TestEvaluationAfterDeleteRow(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "10") // A1=10
	sheet.GetCell(0, 0).SetComputed("10")
	sheet.SetCell(1, 0, "20") // A2=20
	sheet.GetCell(1, 0).SetComputed("20")

	// C1 has formula =A2 (references row 1)
	cell := newFormulaCell(t, "=A2")

	// Delete row 1 (A2) → ref becomes invalid
	unshiftFormulaRefsForDeleteRow(cell, 1)
	assert.True(t, firstCellRef(cell).Invalid)

	// Evaluating with stored AST returns #REF!
	val, err := EvaluateFormula("="+cell.Value, cell.ParsedFormula, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

func TestEvaluationAfterInsertRow(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(1, 0, "42") // A2=42
	sheet.GetCell(1, 0).SetComputed("42")

	cell := newFormulaCell(t, "=A1")
	// Insert row at 0 → A1 becomes A2
	shiftFormulaRefsForInsertRow(cell, 0)
	assert.Equal(t, "=A2", cellValue(cell))

	// Evaluating the shifted formula uses the new A2=42
	val, err := EvaluateFormula("="+cell.Value, cell.ParsedFormula, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "42", valueToString(val))
}

// --- Persistence round-trip ---

func TestInvalidRefsRoundTrip(t *testing.T) {
	// Simulate: formula with invalid ref saved and loaded
	cell := newFormulaCell(t, "=A2")
	unshiftFormulaRefsForDeleteRow(cell, 1) // A2 becomes invalid
	assert.Contains(t, cell.InvalidRefs, "A2")

	// Save/Load via MessagePack round-trip
	s := NewSpreadsheet()
	s.Cells[0] = map[int]*Cell{0: cell}
	data, err := s.SaveToBytes()
	require.NoError(t, err)
	loaded, err := LoadFromBytes(data, "/test.sheet")
	require.NoError(t, err)
	restored := loaded.GetCell(0, 0)
	require.NotNil(t, restored)

	// ParsedFormula is nil after decode (intentional)
	assert.Nil(t, restored.ParsedFormula)
	// InvalidRefs is preserved
	assert.Equal(t, cell.InvalidRefs, restored.InvalidRefs)
	// Value is preserved (still parseable)
	assert.Equal(t, cell.Value, restored.Value)
	_, parseErr := ParseFormula("=" + restored.Value)
	assert.NoError(t, parseErr)

	// Rebuild AST from Value and apply InvalidRefs → ref is invalid again
	ast, parseErr := ParseFormula("=" + restored.Value)
	require.NoError(t, parseErr)
	resolveAllCoords(ast)
	applyInvalidRefs(ast, restored.InvalidRefs)
	restored.ParsedFormula = ast

	ref := firstCellRef(restored)
	require.NotNil(t, ref)
	assert.True(t, ref.Invalid)
}
