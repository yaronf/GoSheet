package model

import (
	"regexp"
	"sort"
)

// shiftFormulaRefsForInsertRow rewrites cell references in a formula when a row is inserted.
// Refs with row >= insertRow have their row incremented by 1.
func shiftFormulaRefsForInsertRow(formula string, insertRow int) string {
	if insertRow < 0 {
		return formula
	}
	return shiftFormulaRefs(formula, insertRow, -1)
}

// shiftFormulaRefsForInsertColumn rewrites cell references in a formula when a column is inserted.
// Refs with col >= insertCol have their col incremented by 1.
func shiftFormulaRefsForInsertColumn(formula string, insertCol int) string {
	if insertCol < 0 {
		return formula
	}
	return shiftFormulaRefs(formula, -1, insertCol)
}

// shiftFormulaRefs updates cell refs: refs with row >= insertRow get row++, refs with col >= insertCol get col++.
// Use insertRow < 0 or insertCol < 0 to skip that dimension.
func shiftFormulaRefs(formula string, insertRow, insertCol int) string {
	re := regexp.MustCompile(`\b([A-Z]+\d+)\b`)
	matches := re.FindAllStringSubmatchIndex(formula, -1)
	if len(matches) == 0 {
		return formula
	}
	// Process from end to start so indices remain valid
	sort.Slice(matches, func(i, j int) bool { return matches[i][0] > matches[j][0] })
	for _, m := range matches {
		ref := formula[m[2]:m[3]]
		r, c, err := RefToCoords(ref)
		if err != nil {
			continue
		}
		if insertRow >= 0 && r >= insertRow {
			r++
		}
		if insertCol >= 0 && c >= insertCol {
			c++
		}
		newRef := CoordsToRef(r, c)
		formula = formula[:m[2]] + newRef + formula[m[3]:]
	}
	return formula
}
