package model

// Cell represents a single spreadsheet cell
type Cell struct {
	Value         string   // Raw value: bare expression for formulas (no "="), plain text otherwise
	Computed      string   // Calculated result (what's displayed)
	IsFormula     bool     // True if cell contains a formula
	IsQuotePrefix bool     // True if Value starts with "'" (Excel-style text force)
	IsError       bool     // True if the computed value is an error
	StyleId       int      // 0 = no style; 1=Title, 2=Header, 3=Total
	Alignment     string   // Cell-level alignment: "" (inherit), "left", "center", "right"
	InvalidRefs   []string // Persisted list of ref/range strings that are invalid (e.g. "B2", "A1:A1")
	ParsedFormula *Formula // Runtime only — not persisted; rebuilt from Value on load
}

// cellPersist is the shadow struct used for MessagePack encode/decode.
// ParsedFormula is intentionally excluded — participle AST has unexported fields.
// It is rebuilt from Value on load.
type cellPersist struct {
	Value         string   `msgpack:"value"`
	IsFormula     bool     `msgpack:"is_formula"`
	IsQuotePrefix bool     `msgpack:"is_quote_prefix"`
	IsError       bool     `msgpack:"is_error"`
	StyleId       int      `msgpack:"style_id"`
	Alignment     string   `msgpack:"alignment"`
	InvalidRefs   []string `msgpack:"invalid_refs"`
}

// RawValue returns the user-facing raw string: "=<expr>" for formulas, Value otherwise.
func (c *Cell) RawValue() string {
	if c.IsFormula {
		return "=" + c.Value
	}
	return c.Value
}

// DisplayFormula returns the formula string for display in the formula bar.
// Invalid refs are rendered as #REF! so the user sees the broken reference inline
// (e.g. =SUM(A1:#REF!)). Falls back to RawValue if no AST is available.
func (c *Cell) DisplayFormula() string {
	if !c.IsFormula {
		return c.Value
	}
	if c.ParsedFormula != nil && len(c.InvalidRefs) > 0 {
		return "=" + SerializeForDisplay(c.ParsedFormula)
	}
	return "=" + c.Value
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
			// Successfully normalized — store bare expression (strip leading "=")
			c.IsFormula = true
			c.IsQuotePrefix = false
			c.Value = normalized[1:] // strip "="
			// Parse and cache the AST; resolve coordinates so evaluation can use them directly
			if ast, parseErr := ParseFormula(normalized); parseErr == nil {
				resolveAllCoords(ast)
				c.ParsedFormula = ast
			} else {
				c.ParsedFormula = nil
			}
			c.InvalidRefs = nil
		} else {
			// Normalization failed - treat as invalid formula (shows error, not raw text)
			c.IsFormula = true
			c.IsQuotePrefix = false
			c.Value = value[1:] // strip "=", store bare expression
			c.Computed = "#ERROR invalid formula"
			c.IsError = true
			c.ParsedFormula = nil
		}
	} else if startsWithQuote {
		// Quote prefix — force text mode (Excel-style)
		c.IsFormula = false
		c.IsQuotePrefix = true
		c.IsError = false
		c.Value = value        // preserve "'001"
		c.Computed = value[1:] // strip leading quote → "001"
	} else {
		c.IsFormula = false
		c.IsQuotePrefix = false
		c.IsError = false
		c.Value = value
		c.Computed = value
	}

	// For valid formulas, Computed is set by the formula evaluator after this call.
	// For all other cases, Computed is already set in the branches above.
}

// SetComputed updates the computed (displayed) value
func (c *Cell) SetComputed(computed string) {
	c.Computed = computed
	c.IsError = false
}

// SetError marks the cell as having a formula error with the given message.
// msg must not start with "#" — use SetRefError for #REF! and SetFromValue for typed Values.
func (c *Cell) SetError(msg string) {
	c.Computed = "#ERROR " + msg
	c.IsError = true
}

// SetRefError marks the cell as a #REF! error.
func (c *Cell) SetRefError() {
	c.Computed = "#REF!"
	c.IsError = true
}

// SetFromValue updates the cell's computed state from a typed Value.
// Dispatches to SetRefError, SetError, or SetComputed as appropriate.
func (c *Cell) SetFromValue(v Value) {
	switch val := v.(type) {
	case RefErrorValue:
		c.SetRefError()
	case ErrorValue:
		c.SetError(val.Error.Error())
	default:
		c.SetComputed(valueToString(v))
	}
}
