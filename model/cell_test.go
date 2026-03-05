package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestCellSetValue_QuotePrefix verifies quote-prefix (Excel-style text force) behaviour.
func TestCellSetValue_QuotePrefix(t *testing.T) {
	tests := []struct {
		input            string
		expectedValue    string
		expectedComputed string
		desc             string
	}{
		{"'001", "'001", "001", "numeric-looking string forced as text"},
		{"'3.14", "'3.14", "3.14", "decimal forced as text"},
		{"'hello", "'hello", "hello", "plain text with quote prefix"},
		{"'", "'", "", "lone quote — empty display"},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cell := NewCell(tt.input)
			assert.False(t, cell.IsFormula, "quote-prefix cell must not be a formula")
			assert.True(t, cell.IsQuotePrefix, "IsQuotePrefix must be true")
			assert.Equal(t, tt.expectedValue, cell.Value, "raw value should be preserved with quote")
			assert.Equal(t, tt.expectedComputed, cell.Computed, "computed should strip the leading quote")
		})
	}
}

// TestCellSetValue_NonQuotePrefix verifies that plain text cells do NOT set IsQuotePrefix.
func TestCellSetValue_NonQuotePrefix(t *testing.T) {
	cell := NewCell("hello")
	assert.False(t, cell.IsQuotePrefix, "plain text must not set IsQuotePrefix")
	cell2 := NewCell("=A1+A2")
	assert.False(t, cell2.IsQuotePrefix, "formula must not set IsQuotePrefix")
}

// TestCell_Alignment verifies the Alignment field defaults and stores values correctly.
func TestCell_Alignment(t *testing.T) {
	cell := NewCell("hello")
	assert.Equal(t, "", cell.Alignment, "new cell should have empty (inherit) alignment")

	cell.Alignment = "left"
	assert.Equal(t, "left", cell.Alignment)

	cell.Alignment = "center"
	assert.Equal(t, "center", cell.Alignment)

	cell.Alignment = "right"
	assert.Equal(t, "right", cell.Alignment)

	// SetValue should not clear alignment
	cell.SetValue("new value")
	assert.Equal(t, "right", cell.Alignment, "SetValue must not reset Alignment")
}

// TestCellSetValue_InvalidFormula exercises the branch where NormalizeFormula fails.
// Invalid formulas must be treated as formulas-with-error, NOT plain text.
func TestCellSetValue_InvalidFormula(t *testing.T) {
	tests := []struct {
		input string
		desc  string
	}{
		{"=1+", "malformed expression"},
		{"=hello", "function call without parens"},
		{"=", "bare equals sign"},
		{"=abc", "function call without parens 2"},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cell := NewCell(tt.input)
			assert.True(t, cell.IsFormula, "should be marked as formula, not plain text")
			assert.Equal(t, tt.input, cell.RawValue(), "raw value should be preserved")
			assert.Equal(t, "#ERROR invalid formula", cell.Computed, "computed should show error")
			assert.True(t, cell.IsError, "IsError should be true for invalid formula")
		})
	}
}
