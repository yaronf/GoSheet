package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestCellSetValue_InvalidFormula exercises the branch where NormalizeFormula fails (treat as plain text)
func TestCellSetValue_InvalidFormula(t *testing.T) {
	cell := NewCell("=1+") // Malformed formula - NormalizeFormula fails
	assert.False(t, cell.IsFormula)
	assert.Equal(t, "=1+", cell.Value)
	assert.Equal(t, "=1+", cell.Computed)
}
