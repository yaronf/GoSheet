package model

import (
	"fmt"
	"strings"
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

// TestCellSetValue_InvalidFormula exercises the branch where NormalizeFormula fails.
// Invalid formulas must be treated as formulas-with-error, NOT plain text.
func TestCellSetValue_InvalidFormula(t *testing.T) {
	tests := []struct {
		input       string
		desc        string
		wantContain string // if set, computed must contain this (e.g. specific error)
	}{
		{"=1+", "malformed expression", ""},
		{"=hello", "function call without parens", ""},
		{"=", "bare equals sign", ""},
		{"=abc", "function call without parens 2", ""},
		{"=avg(", "incomplete AVG — specific error", "AVG"},
		{"=AVG", "AVG without parens — specific error", "parentheses"},
		{"=sum", "SUM without parens (lowercase) — specific error", "SUM"},
		{"= sum", "SUM with space — specific error", "SUM"},
		{"=ident", "unknown identifier — specific error", "parentheses"},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cell := NewCell(tt.input)
			assert.True(t, cell.IsFormula, "should be marked as formula, not plain text")
			assert.Equal(t, tt.input, cell.RawValue(), "raw value should be preserved")
			assert.True(t, strings.HasPrefix(cell.Computed, "#ERROR "), "computed should show error: %s", cell.Computed)
			assert.True(t, cell.IsError(), "IsError should be true for invalid formula")
			if tt.wantContain != "" {
				assert.Contains(t, cell.Computed, tt.wantContain, "computed should contain specific error")
			}
			assert.Equal(t, ErrParse, cell.ErrorKind, "parse error should set ErrParse")
		})
	}
}

// TestErrorKind_SetError verifies SetError sets ErrEval.
func TestErrorKind_SetError(t *testing.T) {
	cell := NewCell("x")
	cell.SetError("division by zero")
	assert.Equal(t, ErrEval, cell.ErrorKind)
	assert.Equal(t, "#ERROR division by zero", cell.Computed)
	assert.True(t, cell.IsError())
}

// TestErrorKind_SetRefError verifies SetRefError sets ErrRef.
func TestErrorKind_SetRefError(t *testing.T) {
	cell := NewCell("=A1")
	cell.SetRefError()
	assert.Equal(t, ErrRef, cell.ErrorKind)
	assert.Equal(t, "#REF!", cell.Computed)
	assert.True(t, cell.IsError())
}

// TestErrorKind_SetCircularError verifies SetCircularError sets ErrCircular.
func TestErrorKind_SetCircularError(t *testing.T) {
	cell := NewCell("=B1")
	cell.SetCircularError("circular reference: A1 → B1 → A1")
	assert.Equal(t, ErrCircular, cell.ErrorKind)
	assert.Contains(t, cell.Computed, "circular")
	assert.True(t, cell.IsError())
}

// TestErrorKind_SetFromValue verifies SetFromValue sets correct ErrorKind for RefErrorValue and ErrorValue.
func TestErrorKind_SetFromValue(t *testing.T) {
	cell := NewCell("=A1")
	cell.SetFromValue(RefErrorValue{})
	assert.Equal(t, ErrRef, cell.ErrorKind)
	assert.Equal(t, "#REF!", cell.Computed)

	cell.SetFromValue(ErrorValue{Error: fmt.Errorf("division by zero")})
	assert.Equal(t, ErrEval, cell.ErrorKind)
	assert.Contains(t, cell.Computed, "#ERROR")

	cell.SetFromValue(NumberValue{42})
	assert.Equal(t, ErrNone, cell.ErrorKind)
	assert.Equal(t, "42", cell.Computed)
	assert.False(t, cell.IsError())
}
