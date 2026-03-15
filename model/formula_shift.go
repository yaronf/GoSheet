package model

import "strings"

// formula_shift.go — rewrite formula cell refs when rows/cols are inserted or deleted.
// Story 15.5: operates on the parsed AST (Cell.ParsedFormula) rather than doing string substitution.
// After mutation the formula string is re-derived from the AST so Cell.Value always stays parseable.

// shiftFormulaRefsForInsertRow shifts all cell refs in the cell down by 1 when a row is inserted.
func shiftFormulaRefsForInsertRow(cell *Cell, insertRow int) {
	if insertRow < 0 || cell.ParsedFormula == nil {
		return
	}
	shiftASTRefs(cell, insertRow, -1, true)
}

// shiftFormulaRefsForInsertColumn shifts all cell refs in the cell right by 1 when a col is inserted.
func shiftFormulaRefsForInsertColumn(cell *Cell, insertCol int) {
	if insertCol < 0 || cell.ParsedFormula == nil {
		return
	}
	shiftASTRefs(cell, -1, insertCol, true)
}

// unshiftFormulaRefsForDeleteRow updates cell refs after a row deletion.
// Refs pointing at deletedRow become invalid; refs below shift up.
func unshiftFormulaRefsForDeleteRow(cell *Cell, deletedRow int) {
	if deletedRow < 0 || cell.ParsedFormula == nil {
		return
	}
	shiftASTRefs(cell, deletedRow, -1, false)
}

// unshiftFormulaRefsForDeleteColumn updates cell refs after a column deletion.
// Refs pointing at deletedCol become invalid; refs to the right shift left.
func unshiftFormulaRefsForDeleteColumn(cell *Cell, deletedCol int) {
	if deletedCol < 0 || cell.ParsedFormula == nil {
		return
	}
	shiftASTRefs(cell, -1, deletedCol, false)
}

// shiftASTRefs walks the AST and updates CellRef and Range coords.
// If insert=true: refs at >= threshold get +1. If insert=false (delete): refs at threshold
// become invalid; refs beyond threshold get -1.
// deletedRow/deletedCol < 0 means that dimension is not being shifted.
func shiftASTRefs(cell *Cell, deletedRow, deletedCol int, insert bool) {
	shiftASTNodes(cell.ParsedFormula, deletedRow, deletedCol, insert)
	// Re-derive cell.Value from the mutated AST (keeps Value always parseable)
	cell.Value = serializeComparison(cell.ParsedFormula.Expr.Comparison)
	// Rebuild InvalidRefs list from all nodes that are now invalid
	cell.InvalidRefs = collectInvalidRefs(cell.ParsedFormula)
}

// collectInvalidRefs returns the list of ref strings for all invalid AST nodes.
func collectInvalidRefs(ast *Formula) []string {
	var refs []string
	WalkPrimaries(ast, func(prim *Primary) {
		if prim.CellRef != nil && prim.CellRef.Invalid {
			refs = append(refs, prim.CellRef.Ref)
		}
		if prim.Range != nil && prim.Range.Invalid {
			refs = append(refs, prim.Range.Start+":"+prim.Range.End)
		}
	})
	if len(refs) == 0 {
		return nil
	}
	return refs
}

// --- AST mutation ---

func shiftASTNodes(ast *Formula, deletedRow, deletedCol int, insert bool) {
	WalkPrimaries(ast, func(prim *Primary) {
		if prim.CellRef != nil {
			shiftCellRef(prim.CellRef, deletedRow, deletedCol, insert)
		}
		if prim.Range != nil {
			shiftRange(prim.Range, deletedRow, deletedCol, insert)
		}
	})
}

func shiftCellRef(ref *CellRef, deletedRow, deletedCol int, insert bool) {
	if ref.Invalid {
		return // already invalid, leave it
	}
	// TODO(19.2): decide if absolute refs should resist insert/delete shifts (currently they shift like relative refs)
	if insert {
		// Insert: shift refs at >= threshold up/right
		if deletedRow >= 0 && ref.Row >= deletedRow {
			ref.Row++
			ref.Ref = coordsToRefWithAnchors(ref.Row, ref.Col, ref.AbsRow, ref.AbsCol)
		}
		if deletedCol >= 0 && ref.Col >= deletedCol {
			ref.Col++
			ref.Ref = coordsToRefWithAnchors(ref.Row, ref.Col, ref.AbsRow, ref.AbsCol)
		}
	} else {
		// Delete: refs at threshold become invalid; refs beyond threshold shift
		if deletedRow >= 0 {
			if ref.Row == deletedRow {
				ref.Invalid = true
				return
			}
			if ref.Row > deletedRow {
				ref.Row--
				ref.Ref = coordsToRefWithAnchors(ref.Row, ref.Col, ref.AbsRow, ref.AbsCol)
			}
		}
		if deletedCol >= 0 {
			if ref.Col == deletedCol {
				ref.Invalid = true
				return
			}
			if ref.Col > deletedCol {
				ref.Col--
				ref.Ref = coordsToRefWithAnchors(ref.Row, ref.Col, ref.AbsRow, ref.AbsCol)
			}
		}
	}
}

func shiftRange(rng *Range, deletedRow, deletedCol int, insert bool) {
	if rng.ColRange != nil || rng.RowRange != nil {
		return // full-row/col ranges not supported; no shift
	}
	if rng.Invalid {
		return // already invalid, leave it
	}
	if insert {
		shiftRangeInsert(rng, deletedRow, deletedCol)
	} else {
		shiftRangeDelete(rng, deletedRow, deletedCol)
	}
}

// shiftRangeInsert shifts range endpoints outward when a row or column is inserted.
func shiftRangeInsert(rng *Range, insertedRow, insertedCol int) {
	if insertedRow >= 0 {
		if rng.StartRow >= insertedRow {
			rng.StartRow++
		}
		if rng.EndRow >= insertedRow {
			rng.EndRow++
		}
	}
	if insertedCol >= 0 {
		if rng.StartCol >= insertedCol {
			rng.StartCol++
		}
		if rng.EndCol >= insertedCol {
			rng.EndCol++
		}
	}
	rng.Start = coordsToRefWithAnchors(rng.StartRow, rng.StartCol, rng.StartAbsRow, rng.StartAbsCol)
	rng.End = coordsToRefWithAnchors(rng.EndRow, rng.EndCol, rng.EndAbsRow, rng.EndAbsCol)
}

// shiftRangeDelete adjusts or invalidates range endpoints when a row or column is deleted.
func shiftRangeDelete(rng *Range, deletedRow, deletedCol int) {
	if deletedRow >= 0 {
		if !shiftRangeDeleteAxis(&rng.StartRow, &rng.EndRow, deletedRow) {
			rng.Invalid = true
			return
		}
	}
	if deletedCol >= 0 {
		if !shiftRangeDeleteAxis(&rng.StartCol, &rng.EndCol, deletedCol) {
			rng.Invalid = true
			return
		}
	}
	rng.Start = coordsToRefWithAnchors(rng.StartRow, rng.StartCol, rng.StartAbsRow, rng.StartAbsCol)
	rng.End = coordsToRefWithAnchors(rng.EndRow, rng.EndCol, rng.EndAbsRow, rng.EndAbsCol)
}

// shiftRangeDeleteAxis adjusts start/end on one axis for a deletion at deletedIdx.
// Returns false if the range should be invalidated (anchor deleted or collapsed).
func shiftRangeDeleteAxis(start, end *int, deletedIdx int) bool {
	if *start == deletedIdx || *end == deletedIdx {
		return false // anchor or endpoint deleted — invalidate
	}
	if deletedIdx > *start && deletedIdx < *end {
		// Interior deletion: shrink end
		*end--
		if *end < *start {
			return false // collapsed
		}
	} else {
		// Exterior deletion: shift endpoints beyond the deleted index
		if *start > deletedIdx {
			*start--
		}
		if *end > deletedIdx {
			*end--
		}
	}
	return true
}

// shiftCellRefByOffset applies row/col offset to a cell ref; marks invalid if result < 0.
func shiftCellRefByOffset(ref *CellRef, rowOffset, colOffset int) {
	if ref == nil || ref.Invalid {
		return
	}
	newRow := ref.Row
	if !ref.AbsRow {
		newRow += rowOffset
	}
	newCol := ref.Col
	if !ref.AbsCol {
		newCol += colOffset
	}
	if newRow < 0 || newCol < 0 {
		ref.Invalid = true
	} else {
		ref.Row, ref.Col = newRow, newCol
		ref.Ref = coordsToRefWithAnchors(newRow, newCol, ref.AbsRow, ref.AbsCol)
	}
}

// shiftRangeByOffset applies row/col offset to a range ref; marks invalid if any coord < 0.
func shiftRangeByOffset(rng *Range, rowOffset, colOffset int) {
	if rng == nil || rng.Invalid || rng.ColRange != nil || rng.RowRange != nil {
		return
	}
	sr := rng.StartRow
	if !rng.StartAbsRow {
		sr += rowOffset
	}
	sc := rng.StartCol
	if !rng.StartAbsCol {
		sc += colOffset
	}
	er := rng.EndRow
	if !rng.EndAbsRow {
		er += rowOffset
	}
	ec := rng.EndCol
	if !rng.EndAbsCol {
		ec += colOffset
	}
	if sr < 0 || sc < 0 || er < 0 || ec < 0 {
		rng.Invalid = true
	} else {
		rng.StartRow, rng.StartCol = sr, sc
		rng.EndRow, rng.EndCol = er, ec
		rng.Start = coordsToRefWithAnchors(sr, sc, rng.StartAbsRow, rng.StartAbsCol)
		rng.End = coordsToRefWithAnchors(er, ec, rng.EndAbsRow, rng.EndAbsCol)
	}
}

// ShiftFormulaByOffset returns formula with all relative cell/range refs shifted by
// (rowOffset, colOffset). Returns the original string unchanged if it is not a formula
// or cannot be parsed. Refs that would land outside the grid (row < 0 or col < 0)
// become #REF! in the returned string.
func ShiftFormulaByOffset(formula string, rowOffset, colOffset int) (string, error) {
	if !strings.HasPrefix(formula, "=") {
		return formula, nil
	}
	raw := formula[1:]
	ast, err := ParseFormula("=" + raw)
	if err != nil {
		return formula, nil // unparseable: return as-is, no error to caller
	}
	resolveAllCoords(ast)
	WalkPrimaries(ast, func(prim *Primary) {
		shiftCellRefByOffset(prim.CellRef, rowOffset, colOffset)
		shiftRangeByOffset(prim.Range, rowOffset, colOffset)
	})
	result := SerializeForDisplay(ast)
	if result == "" {
		return formula, nil
	}
	return "=" + result, nil
}
