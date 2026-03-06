package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestShiftFormulaRefsForInsertRow(t *testing.T) {
	// Existing shift: row >= insertRow gets row++
	assert.Equal(t, "=A2", shiftFormulaRefsForInsertRow("=A1", 0))
	assert.Equal(t, "=A1", shiftFormulaRefsForInsertRow("=A1", 1)) // row 0 < 1, unchanged
	assert.Equal(t, "=A3+B4", shiftFormulaRefsForInsertRow("=A2+B3", 1))
}

func TestShiftFormulaRefsForInsertColumn(t *testing.T) {
	assert.Equal(t, "=B1", shiftFormulaRefsForInsertColumn("=A1", 0))
	assert.Equal(t, "=A1", shiftFormulaRefsForInsertColumn("=A1", 1)) // col 0 < 1, unchanged
	assert.Equal(t, "=C1+D2", shiftFormulaRefsForInsertColumn("=B1+C2", 1))
}

// --- Unshift (delete) helpers ---

func TestUnshiftFormulaRefsForDeleteRow(t *testing.T) {
	// Refs with row > deletedRow get row--
	// row 1 (A2) deleted → A3 becomes A2
	assert.Equal(t, "=A2", unshiftFormulaRefsForDeleteRow("=A3", 1))
	// ref at deleted row: becomes #REF! (cell no longer exists)
	assert.Equal(t, "=#REF!", unshiftFormulaRefsForDeleteRow("=A2", 1))
	// ref before deleted row: A1 unchanged
	assert.Equal(t, "=A1", unshiftFormulaRefsForDeleteRow("=A1", 1))
	// multiple refs: one shifts, one becomes #REF!
	assert.Equal(t, "=A1+#REF!", unshiftFormulaRefsForDeleteRow("=A1+A2", 1))
	// ref above deleted row: shifts down
	assert.Equal(t, "=A1+A2", unshiftFormulaRefsForDeleteRow("=A1+A3", 1))
	// ref far above: unchanged
	assert.Equal(t, "=A4", unshiftFormulaRefsForDeleteRow("=A5", 1))
}

func TestUnshiftFormulaRefsForDeleteColumn(t *testing.T) {
	// Refs with col > deletedCol get col--
	// col 1 (B) deleted → C1 becomes B1
	assert.Equal(t, "=B1", unshiftFormulaRefsForDeleteColumn("=C1", 1))
	// ref at deleted col: becomes #REF!
	assert.Equal(t, "=#REF!", unshiftFormulaRefsForDeleteColumn("=B1", 1))
	// ref before deleted col: A1 unchanged
	assert.Equal(t, "=A1", unshiftFormulaRefsForDeleteColumn("=A1", 1))
	// multiple refs: one shifts, one becomes #REF!
	assert.Equal(t, "=A1+#REF!", unshiftFormulaRefsForDeleteColumn("=A1+B1", 1))
	// ref shifts
	assert.Equal(t, "=A1+B1", unshiftFormulaRefsForDeleteColumn("=A1+C1", 1))
}
