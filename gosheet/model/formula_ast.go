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
	Range    *Range      `parser:"| @@"`       // Must come before CellRef
	CellRef  *CellRef    `parser:"| @@"`
	FuncCall *FuncCall   `parser:"| @@"`
	SubExpr  *Expression `parser:"| LParen @@ RParen"`
}

// CellRef as parsed from formula
type CellRef struct {
	Ref string `parser:"@CellRef"`
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
	fmt.Sscanf(rowStr, "%d", &rowNum)
	row = rowNum - 1 // Convert to 0-indexed
	
	return row, col
}

type Range struct {
	Start string `parser:"@CellRef"`
	End   string `parser:"Colon @CellRef"`
}

// GetStartCoords returns the start coordinates
func (r *Range) GetStartCoords() (row, col int) {
	ref := &CellRef{Ref: r.Start}
	return ref.ToCoords()
}

// GetEndCoords returns the end coordinates
func (r *Range) GetEndCoords() (row, col int) {
	ref := &CellRef{Ref: r.End}
	return ref.ToCoords()
}

type FuncCall struct {
	Name string        `parser:"@Ident"`
	Args []*Expression `parser:"LParen [ @@ { Comma @@ } ] RParen"`
}
