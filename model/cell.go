package model

// Cell represents a single spreadsheet cell
type Cell struct {
	Value     string // Raw value or formula (e.g., "42" or "=A1+A2")
	Computed  string // Calculated result (what's displayed)
	IsFormula bool   // True if Value starts with '='
}

// NewCell creates a new cell with the given value
func NewCell(value string) *Cell {
	cell := &Cell{
		Value:     value,
		Computed:  value,
		IsFormula: len(value) > 0 && value[0] == '=',
	}
	return cell
}

// SetValue updates the cell's value and determines if it's a formula
func (c *Cell) SetValue(value string) {
	c.Value = value
	c.IsFormula = len(value) > 0 && value[0] == '='
	
	// If not a formula, computed value is the same as raw value
	if !c.IsFormula {
		c.Computed = value
	}
	// If it is a formula, Computed will be set by the formula evaluator
}

// SetComputed updates the computed (displayed) value
func (c *Cell) SetComputed(computed string) {
	c.Computed = computed
}
