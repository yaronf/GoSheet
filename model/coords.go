package model

import (
	"fmt"
	"strings"
)

// ColLetterToIndex converts a column letter to 0-indexed integer
// "A" → 0, "B" → 1, "Z" → 25, "AA" → 26, "AB" → 27, etc.
func ColLetterToIndex(col string) int {
	col = strings.ToUpper(col)
	result := 0
	for i := 0; i < len(col); i++ {
		result = result*26 + int(col[i]-'A') + 1
	}
	return result - 1
}

// ColIndexToLetter converts a 0-indexed integer to column letter
// 0 → "A", 1 → "B", 25 → "Z", 26 → "AA", 27 → "AB", etc.
func ColIndexToLetter(index int) string {
	result := ""
	index++ // Convert to 1-indexed for calculation

	for index > 0 {
		index-- // Adjust for 0-based modulo
		result = string(rune('A'+index%26)) + result
		index /= 26
	}

	return result
}

// RefToCoords converts a cell reference like "A1" to (row, col) coordinates
// "A1" → (0, 0), "B2" → (1, 1), "AA10" → (9, 26)
func RefToCoords(ref string) (row, col int, err error) {
	if len(ref) == 0 {
		return 0, 0, fmt.Errorf("empty cell reference")
	}

	// Split into letter and number parts
	i := 0
	for i < len(ref) && (ref[i] >= 'A' && ref[i] <= 'Z' || ref[i] >= 'a' && ref[i] <= 'z') {
		i++
	}

	if i == 0 || i == len(ref) {
		return 0, 0, fmt.Errorf("invalid cell reference: %s", ref)
	}

	colStr := ref[:i]
	rowStr := ref[i:]

	// Parse row number
	var rowNum int
	_, err = fmt.Sscanf(rowStr, "%d", &rowNum)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid row number in reference: %s", ref)
	}

	if rowNum < 1 {
		return 0, 0, fmt.Errorf("row number must be >= 1: %s", ref)
	}

	col = ColLetterToIndex(colStr)
	row = rowNum - 1 // Convert to 0-indexed

	return row, col, nil
}

// CoordsToRef converts (row, col) coordinates to a cell reference
// (0, 0) → "A1", (1, 1) → "B2", (9, 26) → "AA10"
func CoordsToRef(row, col int) string {
	return fmt.Sprintf("%s%d", ColIndexToLetter(col), row+1)
}

// coordsToRefWithAnchors is like CoordsToRef but prefixes $ on anchored axes.
// absCol=true → "$A1"; absRow=true → "A$1"; both → "$A$1".
func coordsToRefWithAnchors(row, col int, absRow, absCol bool) string {
	colPart := ColIndexToLetter(col)
	if absCol {
		colPart = "$" + colPart
	}
	rowPart := fmt.Sprintf("%d", row+1)
	if absRow {
		rowPart = "$" + rowPart
	}
	return colPart + rowPart
}

// parseRefWithAnchors parses a cell reference string (with optional $ anchors) into
// row/col coordinates and anchor flags. Handles: "A1", "$A1", "A$1", "$A$1".
func parseRefWithAnchors(ref string) (row, col int, absRow, absCol bool) {
	s := ref
	if len(s) > 0 && s[0] == '$' {
		absCol = true
		s = s[1:]
	}
	// Find the boundary between column letters and row digits
	i := 0
	for i < len(s) && s[i] >= 'A' && s[i] <= 'Z' {
		i++
	}
	colStr := s[:i]
	s = s[i:]
	if len(s) > 0 && s[0] == '$' {
		absRow = true
		s = s[1:]
	}
	col = ColLetterToIndex(colStr)
	var rowNum int
	_, _ = fmt.Sscanf(s, "%d", &rowNum)
	row = rowNum - 1
	return
}
