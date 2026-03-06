package model

import (
	"regexp"
	"sort"
)

var cellRefRe = regexp.MustCompile(`\b([A-Z]+\d+)\b`)

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

// unshiftFormulaRefsForDeleteRow rewrites cell references when a row is deleted.
// Refs with row > deletedRow get row--. Refs at exactly deletedRow become #REF!.
func unshiftFormulaRefsForDeleteRow(formula string, deletedRow int) string {
	if deletedRow < 0 {
		return formula
	}
	return unshiftFormulaRefs(formula, deletedRow, -1)
}

// unshiftFormulaRefsForDeleteColumn rewrites cell references when a column is deleted.
// Refs with col > deletedCol get col--. Refs at exactly deletedCol become #REF!.
func unshiftFormulaRefsForDeleteColumn(formula string, deletedCol int) string {
	if deletedCol < 0 {
		return formula
	}
	return unshiftFormulaRefs(formula, -1, deletedCol)
}

// unshiftFormulaRefs updates cell refs: refs with row > deletedRow get row--, refs with col > deletedCol get col--.
// Refs pointing exactly at the deleted row or column become #REF! (the cell no longer exists).
// Use deletedRow < 0 or deletedCol < 0 to skip that dimension.
func unshiftFormulaRefs(formula string, deletedRow, deletedCol int) string {
	matches := cellRefRe.FindAllStringSubmatchIndex(formula, -1)
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
		// Ref points to the deleted row or column → invalid reference
		if (deletedRow >= 0 && r == deletedRow) || (deletedCol >= 0 && c == deletedCol) {
			formula = formula[:m[2]] + "#REF!" + formula[m[3]:]
			continue
		}
		if deletedRow >= 0 && r > deletedRow {
			r--
		}
		if deletedCol >= 0 && c > deletedCol {
			c--
		}
		newRef := CoordsToRef(r, c)
		formula = formula[:m[2]] + newRef + formula[m[3]:]
	}
	return formula
}

// shiftFormulaRefs updates cell refs: refs with row >= insertRow get row++, refs with col >= insertCol get col++.
// Use insertRow < 0 or insertCol < 0 to skip that dimension.
func shiftFormulaRefs(formula string, insertRow, insertCol int) string {
	matches := cellRefRe.FindAllStringSubmatchIndex(formula, -1)
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
