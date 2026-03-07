package model

import "fmt"

// AST node definitions for formula parsing using participle

// Formula is the root of the AST
type Formula struct {
	Expr *Expression `parser:"EQ @@"`
}

// Expression handles operator precedence
type Expression struct {
	Comparison *Comparison `parser:"@@"`
}

type Comparison struct {
	Left  *Addition   `parser:"@@"`
	Op    *string     `parser:"[ @( EQ | NEQ | LT | LTE | GT | GTE )"`
	Right *Comparison `parser:"  @@ ]"`
}

type Addition struct {
	Left  *Multiplication `parser:"@@"`
	Op    *string         `parser:"[ @( Plus | Minus )"`
	Right *Addition       `parser:"  @@ ]"`
}

type Multiplication struct {
	Left  *Unary          `parser:"@@"`
	Op    *string         `parser:"[ @( Star | Slash | Percent )"`
	Right *Multiplication `parser:"  @@ ]"`
}

type Unary struct {
	Op      *string  `parser:"  ( @( Plus | Minus )"`
	Unary   *Unary   `parser:"    @@ )"`
	Primary *Primary `parser:"| @@"`
}

type Primary struct {
	Number   *float64    `parser:"  @Float | @Int"`
	String   *string     `parser:"| @String"`
	Range    *Range      `parser:"| @@"` // Must come before CellRef
	CellRef  *CellRef    `parser:"| @@"`
	FuncCall *FuncCall   `parser:"| @@"`
	SubExpr  *Expression `parser:"| LParen @@ RParen"`
}

// CellRef as parsed from formula
type CellRef struct {
	Ref string `parser:"@CellRef"`
	// Runtime fields (not parsed; populated by resolveAllCoords after parsing)
	Row     int
	Col     int
	Invalid bool // true if this ref points to a deleted cell
}

// ToCoords converts CellRef to numeric coordinates
func (c *CellRef) ToCoords() (row, col int) {
	// Parse "A1" style reference
	i := 0
	for i < len(c.Ref) && (c.Ref[i] >= 'A' && c.Ref[i] <= 'Z') {
		i++
	}

	colStr := c.Ref[:i]
	rowStr := c.Ref[i:]

	col = ColLetterToIndex(colStr)
	var rowNum int
	_, _ = fmt.Sscanf(rowStr, "%d", &rowNum)
	row = rowNum - 1 // Convert to 0-indexed

	return row, col
}

// ResolveCoords populates Row, Col from the Ref string. Called once after parsing.
func (c *CellRef) ResolveCoords() {
	c.Row, c.Col = c.ToCoords()
}

type Range struct {
	Start string `parser:"@CellRef"`
	End   string `parser:"Colon @CellRef"`
	// Runtime fields (not parsed; populated by resolveAllCoords after parsing)
	StartRow, StartCol int
	EndRow, EndCol     int
	Invalid            bool // true if this range spans a deleted row/col
}

// GetStartCoords returns the start coordinates
func (r *Range) GetStartCoords() (row, col int) {
	return r.StartRow, r.StartCol
}

// GetEndCoords returns the end coordinates
func (r *Range) GetEndCoords() (row, col int) {
	return r.EndRow, r.EndCol
}

// ResolveCoords populates the four coord fields from Start/End strings.
func (r *Range) ResolveCoords() {
	startRef := &CellRef{Ref: r.Start}
	endRef := &CellRef{Ref: r.End}
	r.StartRow, r.StartCol = startRef.ToCoords()
	r.EndRow, r.EndCol = endRef.ToCoords()
}

// WalkPrimaries calls fn on every Primary node in the AST, in depth-first order.
// This is the single traversal kernel used by resolveAllCoords, applyInvalidRefs,
// collectInvalidRefs, and the shift walkers — eliminating duplicated walker code.
func WalkPrimaries(ast *Formula, fn func(*Primary)) {
	if ast == nil || ast.Expr == nil {
		return
	}
	walkComparison(ast.Expr.Comparison, fn)
}

func walkComparison(comp *Comparison, fn func(*Primary)) {
	if comp == nil {
		return
	}
	walkAddition(comp.Left, fn)
	walkComparison(comp.Right, fn)
}

func walkAddition(add *Addition, fn func(*Primary)) {
	if add == nil {
		return
	}
	walkMultiplication(add.Left, fn)
	walkAddition(add.Right, fn)
}

func walkMultiplication(mult *Multiplication, fn func(*Primary)) {
	if mult == nil {
		return
	}
	walkUnary(mult.Left, fn)
	walkMultiplication(mult.Right, fn)
}

func walkUnary(unary *Unary, fn func(*Primary)) {
	if unary == nil {
		return
	}
	if unary.Primary != nil {
		fn(unary.Primary)
		// Recurse into function args and sub-expressions within this primary
		if unary.Primary.FuncCall != nil {
			for _, arg := range unary.Primary.FuncCall.Args {
				if arg != nil {
					walkComparison(arg.Comparison, fn)
				}
			}
		}
		if unary.Primary.SubExpr != nil {
			walkComparison(unary.Primary.SubExpr.Comparison, fn)
		}
	}
	walkUnary(unary.Unary, fn)
}

// ResolveAllCoords walks the full AST and calls ResolveCoords on every CellRef and Range node.
// Exported for use by the controller load path.
func ResolveAllCoords(ast *Formula) {
	resolveAllCoords(ast)
}

// resolveAllCoords populates Row/Col on every CellRef and StartRow..EndCol on every Range.
func resolveAllCoords(ast *Formula) {
	WalkPrimaries(ast, func(prim *Primary) {
		if prim.CellRef != nil {
			prim.CellRef.ResolveCoords()
		}
		if prim.Range != nil {
			prim.Range.ResolveCoords()
		}
	})
}

// ApplyInvalidRefs is the exported wrapper for use by the controller load path.
func ApplyInvalidRefs(ast *Formula, invalidRefs []string) {
	applyInvalidRefs(ast, invalidRefs)
}

// applyInvalidRefs walks the AST and sets Invalid=true on CellRef nodes whose Ref is in
// the invalidRefs set, and on Range nodes whose "Start:End" is in the set.
// Matching is exclusively against AST node types — string literals are never mismatched.
func applyInvalidRefs(ast *Formula, invalidRefs []string) {
	if ast == nil || len(invalidRefs) == 0 {
		return
	}
	refSet := make(map[string]bool, len(invalidRefs))
	for _, r := range invalidRefs {
		refSet[r] = true
	}
	WalkPrimaries(ast, func(prim *Primary) {
		if prim.CellRef != nil && refSet[prim.CellRef.Ref] {
			prim.CellRef.Invalid = true
		}
		if prim.Range != nil {
			key := prim.Range.Start + ":" + prim.Range.End
			if refSet[key] {
				prim.Range.Invalid = true
			}
		}
	})
}

type FuncCall struct {
	Name string        `parser:"@Ident"`
	Args []*Expression `parser:"LParen [ @@ { Comma @@ } ] RParen"`
}
