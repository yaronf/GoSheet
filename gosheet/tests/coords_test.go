package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gosheet/model"
)

func TestColLetterToIndex(t *testing.T) {
	tests := []struct {
		letter string
		index  int
	}{
		{"A", 0},
		{"B", 1},
		{"Z", 25},
		{"AA", 26},
		{"AB", 27},
		{"AZ", 51},
		{"BA", 52},
		{"ZZ", 701},
		{"AAA", 702},
	}

	for _, tt := range tests {
		t.Run(tt.letter, func(t *testing.T) {
			result := model.ColLetterToIndex(tt.letter)
			assert.Equal(t, tt.index, result, "ColLetterToIndex(%s) should be %d", tt.letter, tt.index)
		})
	}
}

func TestColIndexToLetter(t *testing.T) {
	tests := []struct {
		index  int
		letter string
	}{
		{0, "A"},
		{1, "B"},
		{25, "Z"},
		{26, "AA"},
		{27, "AB"},
		{51, "AZ"},
		{52, "BA"},
		{701, "ZZ"},
		{702, "AAA"},
	}

	for _, tt := range tests {
		t.Run(tt.letter, func(t *testing.T) {
			result := model.ColIndexToLetter(tt.index)
			assert.Equal(t, tt.letter, result, "ColIndexToLetter(%d) should be %s", tt.index, tt.letter)
		})
	}
}

func TestRefToCoords(t *testing.T) {
	tests := []struct {
		ref string
		row int
		col int
		err bool
	}{
		{"A1", 0, 0, false},
		{"B2", 1, 1, false},
		{"Z10", 9, 25, false},
		{"AA1", 0, 26, false},
		{"AB100", 99, 27, false},
		{"", 0, 0, true},      // Empty
		{"A", 0, 0, true},     // No row
		{"1", 0, 0, true},     // No column
		{"A0", 0, 0, true},    // Row < 1
		{"A-1", 0, 0, true},   // Negative row
	}

	for _, tt := range tests {
		t.Run(tt.ref, func(t *testing.T) {
			row, col, err := model.RefToCoords(tt.ref)
			if tt.err {
				assert.Error(t, err, "RefToCoords(%s) should return error", tt.ref)
			} else {
				assert.NoError(t, err, "RefToCoords(%s) should not return error", tt.ref)
				assert.Equal(t, tt.row, row, "RefToCoords(%s) row should be %d", tt.ref, tt.row)
				assert.Equal(t, tt.col, col, "RefToCoords(%s) col should be %d", tt.ref, tt.col)
			}
		})
	}
}

func TestCoordsToRef(t *testing.T) {
	tests := []struct {
		row int
		col int
		ref string
	}{
		{0, 0, "A1"},
		{1, 1, "B2"},
		{9, 25, "Z10"},
		{0, 26, "AA1"},
		{99, 27, "AB100"},
	}

	for _, tt := range tests {
		t.Run(tt.ref, func(t *testing.T) {
			result := model.CoordsToRef(tt.row, tt.col)
			assert.Equal(t, tt.ref, result, "CoordsToRef(%d, %d) should be %s", tt.row, tt.col, tt.ref)
		})
	}
}

func TestRoundTrip(t *testing.T) {
	// Test that converting back and forth preserves values
	tests := []string{"A1", "B2", "Z26", "AA1", "AB100", "ZZ999"}

	for _, ref := range tests {
		t.Run(ref, func(t *testing.T) {
			row, col, err := model.RefToCoords(ref)
			assert.NoError(t, err)
			
			result := model.CoordsToRef(row, col)
			assert.Equal(t, ref, result, "Round trip for %s failed", ref)
		})
	}
}
