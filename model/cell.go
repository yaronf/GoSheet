package model

// Cell represents a single spreadsheet cell
type Cell struct {
	Value         string // Raw value or formula (e.g., "42", "=A1+A2", "'001")
	Computed      string // Calculated result (what's displayed)
	IsFormula     bool   // True if Value starts with '='
	IsQuotePrefix bool   // True if Value starts with "'" (Excel-style text force)
	StyleId       int    // 0 = no style; 1=Title, 2=Header, 3=Total
	Alignment     string // Cell-level alignment: "" (inherit), "left", "center", "right"
}

// NewCell creates a new cell with the given value
func NewCell(value string) *Cell {
	cell := &Cell{}
	cell.SetValue(value)
	return cell
}

// SetValue updates the cell's value and determines if it's a formula or quote-prefix text
func (c *Cell) SetValue(value string) {
	startsWithEquals := len(value) > 0 && value[0] == '='
	startsWithQuote := len(value) > 0 && value[0] == '\''

	if startsWithEquals {
		// Try to normalize formulas (uppercase refs, remove spaces)
		normalized, err := NormalizeFormula(value)
		if err == nil {
			// Successfully normalized - it's a valid formula
			c.IsFormula = true
			c.IsQuotePrefix = false
			c.Value = normalized
		} else {
			// Normalization failed - treat as invalid formula (shows error, not raw text)
			c.IsFormula = true
			c.IsQuotePrefix = false
			c.Value = value
			c.Computed = "#ERROR: invalid formula"
		}
	} else if startsWithQuote {
		// Quote prefix — force text mode (Excel-style)
		c.IsFormula = false
		c.IsQuotePrefix = true
		c.Value = value        // preserve "'001"
		c.Computed = value[1:] // strip leading quote → "001"
	} else {
		c.IsFormula = false
		c.IsQuotePrefix = false
		c.Value = value
		c.Computed = value
	}

	// For valid formulas, Computed is set by the formula evaluator after this call.
	// For all other cases, Computed is already set in the branches above.
}

// SetComputed updates the computed (displayed) value
func (c *Cell) SetComputed(computed string) {
	c.Computed = computed
}
