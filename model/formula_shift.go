package model

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
	if insert {
		// Insert: shift refs at >= threshold up/right
		if deletedRow >= 0 && ref.Row >= deletedRow {
			ref.Row++
			ref.Ref = CoordsToRef(ref.Row, ref.Col)
		}
		if deletedCol >= 0 && ref.Col >= deletedCol {
			ref.Col++
			ref.Ref = CoordsToRef(ref.Row, ref.Col)
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
				ref.Ref = CoordsToRef(ref.Row, ref.Col)
			}
		}
		if deletedCol >= 0 {
			if ref.Col == deletedCol {
				ref.Invalid = true
				return
			}
			if ref.Col > deletedCol {
				ref.Col--
				ref.Ref = CoordsToRef(ref.Row, ref.Col)
			}
		}
	}
}

func shiftRange(rng *Range, deletedRow, deletedCol int, insert bool) {
	if rng.Invalid {
		return // already invalid, leave it
	}
	if insert {
		// Insert: shift start and end coords independently
		if deletedRow >= 0 {
			if rng.StartRow >= deletedRow {
				rng.StartRow++
			}
			if rng.EndRow >= deletedRow {
				rng.EndRow++
			}
		}
		if deletedCol >= 0 {
			if rng.StartCol >= deletedCol {
				rng.StartCol++
			}
			if rng.EndCol >= deletedCol {
				rng.EndCol++
			}
		}
		rng.Start = CoordsToRef(rng.StartRow, rng.StartCol)
		rng.End = CoordsToRef(rng.EndRow, rng.EndCol)
	} else {
		// Delete: check start and end independently
		if deletedRow >= 0 {
			startDeleted := rng.StartRow == deletedRow
			endDeleted := rng.EndRow == deletedRow
			if startDeleted || endDeleted {
				rng.Invalid = true
				return
			}
			// Interior deletion within range: shrink end
			if deletedRow > rng.StartRow && deletedRow < rng.EndRow {
				rng.EndRow--
				// Collapsed check (shouldn't happen if start < end and interior, but be safe)
				if rng.EndRow < rng.StartRow {
					rng.Invalid = true
					return
				}
			} else {
				// Deletion outside range: shift endpoints that are beyond deleted row
				if rng.StartRow > deletedRow {
					rng.StartRow--
				}
				if rng.EndRow > deletedRow {
					rng.EndRow--
				}
			}
		}
		if deletedCol >= 0 {
			startDeleted := rng.StartCol == deletedCol
			endDeleted := rng.EndCol == deletedCol
			if startDeleted || endDeleted {
				rng.Invalid = true
				return
			}
			if deletedCol > rng.StartCol && deletedCol < rng.EndCol {
				rng.EndCol--
				if rng.EndCol < rng.StartCol {
					rng.Invalid = true
					return
				}
			} else {
				if rng.StartCol > deletedCol {
					rng.StartCol--
				}
				if rng.EndCol > deletedCol {
					rng.EndCol--
				}
			}
		}
		if !rng.Invalid {
			rng.Start = CoordsToRef(rng.StartRow, rng.StartCol)
			rng.End = CoordsToRef(rng.EndRow, rng.EndCol)
		}
	}
}
