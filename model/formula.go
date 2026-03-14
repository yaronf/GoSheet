package model

import (
	"fmt"
	"strings"

	"github.com/alecthomas/participle/v2"
	"github.com/alecthomas/participle/v2/lexer"
)

// Formula lexer definition
var formulaLexer = lexer.MustSimple([]lexer.SimpleRule{
	{Name: "Float", Pattern: `\d+\.\d+`},
	{Name: "ColRange", Pattern: `\$?[A-Z]+:\$?[A-Z]+`}, // A:A, $B:$C — must come before CellRef/Ident
	{Name: "RowRange", Pattern: `\d+:\d+`},             // 1:1, 3:10 — must come before Int
	{Name: "CellRef", Pattern: `\$?[A-Z]+\$?\d+`},      // Must come before Ident; $ anchors optional
	{Name: "Ident", Pattern: `[A-Za-z_][A-Za-z0-9_]*`},
	{Name: "Int", Pattern: `\d+`},
	{Name: "String", Pattern: `"(?:\\.|[^"])*"`},
	{Name: "GTE", Pattern: `>=`}, // Must come before individual chars
	{Name: "LTE", Pattern: `<=`},
	{Name: "NEQ", Pattern: `!=`},
	{Name: "EQ", Pattern: `=`},
	{Name: "GT", Pattern: `>`},
	{Name: "LT", Pattern: `<`},
	{Name: "Colon", Pattern: `:`},
	{Name: "Plus", Pattern: `\+`},
	{Name: "Minus", Pattern: `-`},
	{Name: "Star", Pattern: `\*`},
	{Name: "Slash", Pattern: `/`},
	{Name: "Percent", Pattern: `%`},
	{Name: "Caret", Pattern: `\^`},
	{Name: "LParen", Pattern: `\(`},
	{Name: "RParen", Pattern: `\)`},
	{Name: "Comma", Pattern: `,`},
	{Name: "Whitespace", Pattern: `[ \t\n\r]+`},
})

// Formula parser
var formulaParser = participle.MustBuild[Formula](
	participle.Lexer(formulaLexer),
	participle.Elide("Whitespace"),
	participle.UseLookahead(2),
)

// normalizeFormula converts cell references to uppercase while preserving function names
func normalizeFormula(formula string) string {
	// Uppercase everything EXCEPT string literals (inside quotes).
	// Handles \" escape sequences inside string literals correctly.
	var result strings.Builder
	inString := false

	for i := 0; i < len(formula); i++ {
		ch := formula[i]

		if inString {
			result.WriteByte(ch)
			if ch == '\\' && i+1 < len(formula) {
				// Consume the escaped character so \" doesn't toggle inString
				i++
				result.WriteByte(formula[i])
			} else if ch == '"' {
				inString = false
			}
		} else if ch == '"' {
			inString = true
			result.WriteByte(ch)
		} else {
			result.WriteByte(byte(strings.ToUpper(string(ch))[0]))
		}
	}

	return result.String()
}

// ParseFormula parses a formula string into an AST
func ParseFormula(formula string) (*Formula, error) {
	// Normalize to uppercase for case-insensitive parsing
	formula = normalizeFormula(formula)
	return formulaParser.ParseString("", formula)
}

// NormalizeFormula parses and re-serializes a formula to normalize it
// (uppercase cell refs, remove extra spaces, consistent formatting, preserve $ anchors)
func NormalizeFormula(formula string) (string, error) {
	// Parse the formula
	ast, err := ParseFormula(formula)
	if err != nil {
		return formula, err // Return original if can't parse
	}

	// Serialize back to normalized form
	if ast.Expr == nil {
		return formula, fmt.Errorf("invalid parse result")
	}
	// resolveAllCoords populates Row/Col/AbsRow/AbsCol so serialization preserves $ markers
	resolveAllCoords(ast)
	return "=" + serializeComparison(ast.Expr.Comparison), nil
}

// SerializeForDisplay serializes an AST to a formula string for display purposes,
// rendering invalid CellRef and Range nodes as #REF! instead of their original coords.
func SerializeForDisplay(ast *Formula) string {
	if ast == nil || ast.Expr == nil {
		return ""
	}
	return serializeComparisonDisplay(ast.Expr.Comparison)
}

func serializeComparisonDisplay(comp *Comparison) string {
	if comp == nil {
		return ""
	}
	result := serializeAdditionDisplay(comp.Left)
	if comp.Op != nil && comp.Right != nil {
		result += *comp.Op + serializeComparisonDisplay(comp.Right)
	}
	return result
}

func serializeAdditionDisplay(add *Addition) string {
	result := serializeMultiplicationDisplay(add.Left)
	if add.Op != nil && add.Right != nil {
		result += *add.Op + serializeAdditionDisplay(add.Right)
	}
	return result
}

func serializeMultiplicationDisplay(mult *Multiplication) string {
	result := serializeExponentiationDisplay(mult.Left)
	if mult.Op != nil && mult.Right != nil {
		result += *mult.Op + serializeMultiplicationDisplay(mult.Right)
	}
	return result
}

func serializeExponentiationDisplay(exp *Exponentiation) string {
	result := serializeUnaryDisplay(exp.Left)
	if exp.Op != nil && exp.Right != nil {
		result += *exp.Op + serializeExponentiationDisplay(exp.Right)
	}
	return result
}

func serializeUnaryDisplay(unary *Unary) string {
	if unary == nil {
		return ""
	}
	result := ""
	if unary.Op != nil {
		result = *unary.Op
	}
	if unary.Unary != nil {
		return result + serializeUnaryDisplay(unary.Unary)
	}
	return result + serializePrimaryDisplay(unary.Primary)
}

// EvaluateFormula evaluates a formula and returns a typed Value.
// error is non-nil only for parse/eval machinery failures (not for ErrorValue/RefErrorValue results).
// If storedAST is non-nil, it is used directly (skipping the parse step). Pass cell.ParsedFormula for performance.
func EvaluateFormula(formula string, storedAST *Formula, sheet *Spreadsheet) (Value, error) {
	var ast *Formula
	if storedAST != nil {
		ast = storedAST
	} else {
		// Normalize formula to uppercase for cell references
		formula = normalizeFormula(formula)
		var err error
		ast, err = ParseFormula(formula)
		if err != nil {
			return nil, fmt.Errorf("parse error: %w", err)
		}
		// Populate coordinate fields so evaluateCellRef/evaluateRange can use them
		resolveAllCoords(ast)
	}

	// Evaluate the AST
	result, err := evaluateExpression(ast.Expr, sheet)
	if err != nil {
		return nil, fmt.Errorf("eval error: %w", err)
	}

	return result, nil
}

// serializeComparison converts a Comparison AST back to a string
func serializeComparison(comp *Comparison) string {
	if comp == nil {
		return ""
	}
	result := serializeAddition(comp.Left)
	if comp.Op != nil && comp.Right != nil {
		result += *comp.Op + serializeComparison(comp.Right)
	}
	return result
}

// serializeAddition converts an Addition AST back to a string
func serializeAddition(add *Addition) string {
	result := serializeMultiplication(add.Left)
	if add.Op != nil && add.Right != nil {
		result += *add.Op + serializeAddition(add.Right)
	}
	return result
}

// serializeMultiplication converts a Multiplication AST back to a string
func serializeMultiplication(mult *Multiplication) string {
	result := serializeExponentiation(mult.Left)
	if mult.Op != nil && mult.Right != nil {
		result += *mult.Op + serializeMultiplication(mult.Right)
	}
	return result
}

// serializeExponentiation converts an Exponentiation AST back to a string
func serializeExponentiation(exp *Exponentiation) string {
	result := serializeUnary(exp.Left)
	if exp.Op != nil && exp.Right != nil {
		result += *exp.Op + serializeExponentiation(exp.Right)
	}
	return result
}

// serializeUnary converts a Unary AST back to a string
func serializeUnary(unary *Unary) string {
	if unary == nil {
		return ""
	}
	result := ""
	if unary.Op != nil {
		result += *unary.Op
	}
	if unary.Unary != nil {
		return result + serializeUnary(unary.Unary)
	}
	return result + serializePrimary(unary.Primary)
}

// serializePrimary converts a Primary AST back to a string.
// Invalid refs are preserved as their original coord strings so cell.Value stays parseable.
// Valid refs are serialized from coords+anchors (not Ref) so mutations are reflected.
func serializePrimary(prim *Primary) string {
	if prim == nil {
		return ""
	}
	if prim.Number != nil {
		return fmt.Sprintf("%g", *prim.Number)
	}
	if prim.String != nil {
		return *prim.String // Already includes quotes
	}
	if prim.CellRef != nil {
		if prim.CellRef.Invalid {
			return prim.CellRef.Ref // preserve original for parseability
		}
		return coordsToRefWithAnchors(prim.CellRef.Row, prim.CellRef.Col, prim.CellRef.AbsRow, prim.CellRef.AbsCol)
	}
	if prim.Range != nil {
		if prim.Range.ColRange != nil {
			return *prim.Range.ColRange
		}
		if prim.Range.RowRange != nil {
			return *prim.Range.RowRange
		}
		if prim.Range.Invalid {
			return prim.Range.Start + ":" + prim.Range.End // preserve original
		}
		start := coordsToRefWithAnchors(prim.Range.StartRow, prim.Range.StartCol, prim.Range.StartAbsRow, prim.Range.StartAbsCol)
		end := coordsToRefWithAnchors(prim.Range.EndRow, prim.Range.EndCol, prim.Range.EndAbsRow, prim.Range.EndAbsCol)
		return start + ":" + end
	}
	if prim.FuncCall != nil {
		return serializeFuncCall(prim.FuncCall)
	}
	if prim.SubExpr != nil {
		return "(" + serializeComparison(prim.SubExpr.Comparison) + ")"
	}
	return ""
}

// serializePrimaryDisplay is like serializePrimary but renders invalid refs as #REF!
// for display purposes (formula bar). cell.Value must NOT use this — it must stay parseable.
func serializePrimaryDisplay(prim *Primary) string {
	if prim == nil {
		return ""
	}
	if prim.CellRef != nil && prim.CellRef.Invalid {
		return "#REF!"
	}
	if prim.Range != nil && prim.Range.Invalid {
		return "#REF!"
	}
	if prim.Range != nil && (prim.Range.ColRange != nil || prim.Range.RowRange != nil) {
		// Full-row/col ranges: show original (eval returns error)
		if prim.Range.ColRange != nil {
			return *prim.Range.ColRange
		}
		return *prim.Range.RowRange
	}
	if prim.Number != nil {
		return fmt.Sprintf("%g", *prim.Number)
	}
	if prim.String != nil {
		return *prim.String
	}
	if prim.CellRef != nil {
		return coordsToRefWithAnchors(prim.CellRef.Row, prim.CellRef.Col, prim.CellRef.AbsRow, prim.CellRef.AbsCol)
	}
	if prim.Range != nil {
		start := coordsToRefWithAnchors(prim.Range.StartRow, prim.Range.StartCol, prim.Range.StartAbsRow, prim.Range.StartAbsCol)
		end := coordsToRefWithAnchors(prim.Range.EndRow, prim.Range.EndCol, prim.Range.EndAbsRow, prim.Range.EndAbsCol)
		return start + ":" + end
	}
	if prim.FuncCall != nil {
		return serializeFuncCallDisplay(prim.FuncCall)
	}
	if prim.SubExpr != nil {
		return "(" + serializeComparisonDisplay(prim.SubExpr.Comparison) + ")"
	}
	return ""
}

func serializeFuncCallDisplay(fc *FuncCall) string {
	result := fc.Name + "("
	for i, arg := range fc.Args {
		if i > 0 {
			result += ","
		}
		if arg != nil {
			result += serializeComparisonDisplay(arg.Comparison)
		} else {
			result += "?"
		}
	}
	return result + ")"
}

// serializeFuncCall converts a FuncCall AST back to a string
func serializeFuncCall(fc *FuncCall) string {
	result := fc.Name + "("
	for i, arg := range fc.Args {
		if i > 0 {
			result += ","
		}
		if arg != nil {
			result += serializeComparison(arg.Comparison)
		} else {
			result += "?" // placeholder for nil arg (defensive)
		}
	}
	result += ")"
	return result
}
