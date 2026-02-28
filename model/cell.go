package model

// Cell represents a single spreadsheet cell
type Cell struct {
	Value     string // Raw value or formula (e.g., "42" or "=A1+A2")
	Computed  string // Calculated result (what's displayed)
	IsFormula bool   // True if Value starts with '='
	StyleId   int    // 0 = no style; 1=Title, 2=Header, 3=Total
}

// NewCell creates a new cell with the given value
func NewCell(value string) *Cell {
	cell := &Cell{}
	cell.SetValue(value)
	return cell
}

// SetValue updates the cell's value and determines if it's a formula
func (c *Cell) SetValue(value string) {
	startsWithEquals := len(value) > 0 && value[0] == '='

	// Try to normalize formulas (uppercase refs, remove spaces)
	if startsWithEquals {
		normalized, err := NormalizeFormula(value)
		if err == nil {
			// Successfully normalized - it's a valid formula
			c.IsFormula = true
			c.Value = normalized
		} else {
			// Normalization failed - treat as plain text
			c.IsFormula = false
			c.Value = value
			c.Computed = value
		}
	} else {
		c.IsFormula = false
		c.Value = value
		c.Computed = value
	}

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
