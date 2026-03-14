package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Absolute cell reference tests (Story 19.2) ---

// TestParseRefWithAnchors tests the parseRefWithAnchors helper directly.
func TestParseRefWithAnchors(t *testing.T) {
	tests := []struct {
		ref    string
		row    int
		col    int
		absRow bool
		absCol bool
	}{
		{"A1", 0, 0, false, false},
		{"$A1", 0, 0, false, true},
		{"A$1", 0, 0, true, false},
		{"$A$1", 0, 0, true, true},
		{"$B$2", 1, 1, true, true},
		{"C3", 2, 2, false, false},
		{"$Z$10", 9, 25, true, true},
		{"AA1", 0, 26, false, false},
		{"$AA$1", 0, 26, true, true},
	}
	for _, tt := range tests {
		t.Run(tt.ref, func(t *testing.T) {
			row, col, absRow, absCol := parseRefWithAnchors(tt.ref)
			assert.Equal(t, tt.row, row, "row")
			assert.Equal(t, tt.col, col, "col")
			assert.Equal(t, tt.absRow, absRow, "absRow")
			assert.Equal(t, tt.absCol, absCol, "absCol")
		})
	}
}

// TestCoordsToRefWithAnchors tests the coordsToRefWithAnchors helper.
func TestCoordsToRefWithAnchors(t *testing.T) {
	tests := []struct {
		row    int
		col    int
		absRow bool
		absCol bool
		want   string
	}{
		{0, 0, false, false, "A1"},
		{0, 0, false, true, "$A1"},
		{0, 0, true, false, "A$1"},
		{0, 0, true, true, "$A$1"},
		{1, 1, true, true, "$B$2"},
		{2, 2, false, false, "C3"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := coordsToRefWithAnchors(tt.row, tt.col, tt.absRow, tt.absCol)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestNormalizeFormulaPreservesAnchors verifies $ signs pass through normalizeFormula unchanged.
func TestNormalizeFormulaPreservesAnchors(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"=$a$1+b2", "=$A$1+B2"},
		{"=$A$1", "=$A$1"},
		{"=a$1+$b2", "=A$1+$B2"},
		{"=$a1", "=$A1"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeFormula(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestParseCellRefWithAnchors tests that the parser correctly parses $-prefixed refs.
func TestParseCellRefWithAnchors(t *testing.T) {
	tests := []struct {
		formula string
		wantRef string
		absRow  bool
		absCol  bool
	}{
		{"=$A$1", "$A$1", true, true},
		{"=$A1", "$A1", false, true},
		{"=A$1", "A$1", true, false},
		{"=A1", "A1", false, false},
	}
	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			ast, err := ParseFormula(tt.formula)
			require.NoError(t, err)
			resolveAllCoords(ast)
			var ref *CellRef
			WalkPrimaries(ast, func(p *Primary) {
				if p.CellRef != nil {
					ref = p.CellRef
				}
			})
			require.NotNil(t, ref)
			assert.Equal(t, tt.wantRef, ref.Ref)
			assert.Equal(t, tt.absRow, ref.AbsRow, "AbsRow")
			assert.Equal(t, tt.absCol, ref.AbsCol, "AbsCol")
		})
	}
}

// TestSerializeWithAnchors verifies that a parsed-then-serialized formula preserves $ markers.
func TestSerializeWithAnchors(t *testing.T) {
	tests := []struct {
		formula string
	}{
		{"=$A$1"},
		{"=$A1"},
		{"=A$1"},
		{"=$A$1+C1"},
		{"=SUM($A$1:$B$3)"},
	}
	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			ast, err := ParseFormula(tt.formula)
			require.NoError(t, err)
			resolveAllCoords(ast)
			got := "=" + SerializeForDisplay(ast)
			assert.Equal(t, tt.formula, got)
		})
	}
}

// TestShiftFormulaByOffset_BothAnchors — AC1: $A$1 fixed, relative ref shifts.
func TestShiftFormulaByOffset_BothAnchors(t *testing.T) {
	// Copy B1 (=$A$1+C1) paste to B2 → rowOffset=1, colOffset=0
	// $A$1 stays fixed; C1 → C2
	result, err := ShiftFormulaByOffset("=$A$1+C1", 1, 0)
	require.NoError(t, err)
	assert.Equal(t, "=$A$1+C2", result)
}

// TestShiftFormulaByOffset_AbsCol — AC2: $A1 col fixed, row shifts.
func TestShiftFormulaByOffset_AbsCol(t *testing.T) {
	// Copy B1 (=$A1) paste to C3 → rowOffset=2, colOffset=1
	// Col A is fixed; row 1 → row 3
	result, err := ShiftFormulaByOffset("=$A1", 2, 1)
	require.NoError(t, err)
	assert.Equal(t, "=$A3", result)
}

// TestShiftFormulaByOffset_AbsRow — AC3: A$1 row fixed, col shifts.
func TestShiftFormulaByOffset_AbsRow(t *testing.T) {
	// Copy B1 (=A$1) paste to C3 → rowOffset=2, colOffset=1
	// Row 1 is fixed; col A → col B
	result, err := ShiftFormulaByOffset("=A$1", 2, 1)
	require.NoError(t, err)
	assert.Equal(t, "=B$1", result)
}

// TestShiftFormulaByOffset_AbsRange — AC6: SUM($A$1:$B$3) stays entirely fixed.
func TestShiftFormulaByOffset_AbsRange(t *testing.T) {
	result, err := ShiftFormulaByOffset("=SUM($A$1:$B$3)", 3, 2)
	require.NoError(t, err)
	assert.Equal(t, "=SUM($A$1:$B$3)", result)
}

// TestShiftFormulaByOffset_MixedRangeAnchors — partial range anchoring.
func TestShiftFormulaByOffset_MixedRangeAnchors(t *testing.T) {
	// =SUM($A1:B$3): start col anchored, end row anchored
	// Paste with rowOffset=1, colOffset=1
	// Start: col A fixed, row 1→2 → $A2
	// End: row 3 fixed, col B→C → C$3
	result, err := ShiftFormulaByOffset("=SUM($A1:B$3)", 1, 1)
	require.NoError(t, err)
	assert.Equal(t, "=SUM($A2:C$3)", result)
}

// TestShiftFormulaByOffset_AbsNoOutOfBounds — absolute ref on out-of-bounds axis stays valid.
func TestShiftFormulaByOffset_AbsNoOutOfBounds(t *testing.T) {
	// =$A$1 shifted up by 5 rows: absolute → no shift, no #REF!
	result, err := ShiftFormulaByOffset("=$A$1", -5, -5)
	require.NoError(t, err)
	assert.Equal(t, "=$A$1", result)
}

// TestShiftFormulaByOffset_AbsFixedRelativeOutOfBounds — absolute axis stays, relative goes #REF!
func TestShiftFormulaByOffset_AbsFixedRelativeOutOfBounds(t *testing.T) {
	// =$A$1+B1; colOffset=-2 → B1.col=1+(-2)=-1 → #REF!; $A$1 stays fixed
	result, err := ShiftFormulaByOffset("=$A$1+B1", 0, -2)
	require.NoError(t, err)
	assert.Equal(t, "=$A$1+#REF!", result)
}

// TestNormalizeFormulaIdempotent verifies that normalizing an already-normalized formula is a no-op.
func TestNormalizeFormulaIdempotent(t *testing.T) {
	formulas := []string{"=$A$1+C1", "=$A1", "=A$1", "=SUM($A$1:$B$3)"}
	for _, f := range formulas {
		n1, err := NormalizeFormula(f)
		require.NoError(t, err, f)
		n2, err := NormalizeFormula(n1)
		require.NoError(t, err, f)
		assert.Equal(t, n1, n2, "NormalizeFormula should be idempotent for %s", f)
	}
}

// TestNormalizeFormulaWithAnchors verifies NormalizeFormula preserves $.
func TestNormalizeFormulaWithAnchors(t *testing.T) {
	result, err := NormalizeFormula("=$A$1+C1")
	require.NoError(t, err)
	assert.Equal(t, "=$A$1+C1", result)
}

// TestMessagePackRoundTripAbsRef verifies that MessagePack encode/decode preserves $ anchor in formula string.
func TestMessagePackRoundTripAbsRef(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "=$A$1+C1")

	data, err := s.SaveToBytes()
	require.NoError(t, err)

	loaded, err := LoadFromBytes(data, "/test.sheet")
	require.NoError(t, err)

	restored := loaded.GetCell(0, 0)
	require.NotNil(t, restored)
	assert.Equal(t, "$A$1+C1", restored.Value, "Value should preserve $ after MessagePack round-trip")
	assert.Equal(t, "=$A$1+C1", restored.RawValue(), "RawValue should restore = prefix")
	assert.True(t, restored.IsFormula, "should be recognised as formula")
}
