package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- ShiftFormulaByOffset tests ---

func TestShiftFormulaByOffset_NonFormula(t *testing.T) {
	t.Run("plain text passthrough", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("hello", 2, 3)
		require.NoError(t, err)
		assert.Equal(t, "hello", result)
	})
	t.Run("number passthrough", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("42", 1, 1)
		require.NoError(t, err)
		assert.Equal(t, "42", result)
	})
	t.Run("empty string passthrough", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("", 1, 1)
		require.NoError(t, err)
		assert.Equal(t, "", result)
	})
}

func TestShiftFormulaByOffset_ZeroOffset(t *testing.T) {
	t.Run("zero offset: formula unchanged", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B1+C1", 0, 0)
		require.NoError(t, err)
		assert.Equal(t, "=B1+C1", result)
	})
}

func TestShiftFormulaByOffset_RowShift(t *testing.T) {
	t.Run("shift down by 1: single ref", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B1", 1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=B2", result)
	})
	t.Run("AC1: =B1+C1 shifted down 1 → =B2+C2", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B1+C1", 1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=B2+C2", result)
	})
	t.Run("shift up by 1 (negative offset)", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B3", -1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=B2", result)
	})
}

func TestShiftFormulaByOffset_ColShift(t *testing.T) {
	t.Run("AC2: =B1 shifted right 1 → =C1", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B1", 0, 1)
		require.NoError(t, err)
		assert.Equal(t, "=C1", result)
	})
	t.Run("=B1+C1 shifted right 1 → =C1+D1", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=B1+C1", 0, 1)
		require.NoError(t, err)
		assert.Equal(t, "=C1+D1", result)
	})
}

func TestShiftFormulaByOffset_BothAxes(t *testing.T) {
	t.Run("shift down 2 right 2", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=A1", 2, 2)
		require.NoError(t, err)
		assert.Equal(t, "=C3", result)
	})
	t.Run("AC3 pattern: range offset constant, each cell shifts by same amount", func(t *testing.T) {
		// Copy origin A1; paste to C1 → rowOffset=0, colOffset=2
		result, err := ShiftFormulaByOffset("=B1", 0, 2)
		require.NoError(t, err)
		assert.Equal(t, "=D1", result)
	})
}

func TestShiftFormulaByOffset_OutOfBounds(t *testing.T) {
	t.Run("AC5: shift row below zero → #REF!", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=A1", -1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=#REF!", result)
	})
	t.Run("shift col below zero → #REF!", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=A1", 0, -1)
		require.NoError(t, err)
		assert.Equal(t, "=#REF!", result)
	})
	t.Run("partial formula: one ref valid, one out of bounds → mixed", func(t *testing.T) {
		// =A1+B3 shifted up by 2 rows: A1 row=0 → row=-2 (#REF!), B3 row=2 → row=0 → B1
		result, err := ShiftFormulaByOffset("=A1+B3", -2, 0)
		require.NoError(t, err)
		assert.Equal(t, "=#REF!+B1", result)
	})
}

func TestShiftFormulaByOffset_Range(t *testing.T) {
	t.Run("range shifted down 1", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=SUM(A1:B3)", 1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=SUM(A2:B4)", result)
	})
	t.Run("range shifted right 2", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=SUM(A1:C3)", 0, 2)
		require.NoError(t, err)
		assert.Equal(t, "=SUM(C1:E3)", result)
	})
	t.Run("range start shifts out of bounds → #REF!", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=SUM(A1:B2)", -1, 0)
		require.NoError(t, err)
		assert.Equal(t, "=SUM(#REF!)", result)
	})
}

func TestShiftFormulaByOffset_FunctionWithMultipleArgs(t *testing.T) {
	t.Run("SUM with multiple refs shifted", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=SUM(A1,B2,C3)", 1, 1)
		require.NoError(t, err)
		assert.Equal(t, "=SUM(B2,C3,D4)", result)
	})
}

func TestShiftFormulaByOffset_UnparseableFormula(t *testing.T) {
	t.Run("unparseable formula returned unchanged", func(t *testing.T) {
		result, err := ShiftFormulaByOffset("=((invalid", 1, 1)
		require.NoError(t, err) // no error returned for unparseable
		assert.Equal(t, "=((invalid", result)
	})
}
