package model

import (
	"fmt"
	"math"
	"strings"

	"github.com/alecthomas/participle/v2"
	"github.com/alecthomas/participle/v2/lexer"
)

// Formula lexer definition
var formulaLexer = lexer.MustSimple([]lexer.SimpleRule{
	{Name: "Float", Pattern: `\d+\.\d+`},
	{Name: "CellRef", Pattern: `[A-Z]+\d+`}, // Must come before Ident to match first
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
// (uppercase cell refs, remove extra spaces, consistent formatting)
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
	result := serializeUnaryDisplay(mult.Left)
	if mult.Op != nil && mult.Right != nil {
		result += *mult.Op + serializeMultiplicationDisplay(mult.Right)
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
	result := serializeUnary(mult.Left)
	if mult.Op != nil && mult.Right != nil {
		result += *mult.Op + serializeMultiplication(mult.Right)
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
		return prim.CellRef.Ref
	}
	if prim.Range != nil {
		return prim.Range.Start + ":" + prim.Range.End
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
	if prim.Number != nil {
		return fmt.Sprintf("%g", *prim.Number)
	}
	if prim.String != nil {
		return *prim.String
	}
	if prim.CellRef != nil {
		return prim.CellRef.Ref
	}
	if prim.Range != nil {
		return prim.Range.Start + ":" + prim.Range.End
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

// Value represents a computed value
type Value interface {
	value()
}

type NumberValue struct {
	Value float64
}

func (NumberValue) value() {}

type StringValue struct {
	Value string
}

func (StringValue) value() {}

type VectorValue struct {
	Values []Value
}

func (VectorValue) value() {}

type ErrorValue struct {
	Error error
}

func (ErrorValue) value() {}

// RefErrorValue represents a #REF! error — a formula references a deleted cell or range.
type RefErrorValue struct{}

func (RefErrorValue) value() {}

// isErrorLike returns true for both ErrorValue and RefErrorValue — used for error propagation.
func isErrorLike(v Value) bool {
	switch v.(type) {
	case ErrorValue, RefErrorValue:
		return true
	}
	return false
}

// valueToString converts a Value to its string representation
func valueToString(v Value) string {
	switch val := v.(type) {
	case NumberValue:
		// Format number nicely
		if val.Value == float64(int64(val.Value)) {
			return fmt.Sprintf("%d", int64(val.Value))
		}
		return fmt.Sprintf("%g", val.Value)
	case StringValue:
		return val.Value
	case ErrorValue:
		return fmt.Sprintf("#ERROR %v", val.Error)
	case RefErrorValue:
		return "#REF!"
	case VectorValue:
		return fmt.Sprintf("[%d values]", len(val.Values))
	default:
		return "#UNKNOWN"
	}
}

// toNumber converts a Value to a float64
func toNumber(v Value) (float64, error) {
	switch val := v.(type) {
	case NumberValue:
		return val.Value, nil
	case StringValue:
		if val.Value == "" {
			return 0, nil
		}
		var num float64
		_, err := fmt.Sscanf(val.Value, "%f", &num)
		if err != nil {
			return 0, fmt.Errorf("cannot convert string to number: %s", val.Value)
		}
		return num, nil
	case ErrorValue:
		return 0, val.Error
	case RefErrorValue:
		return 0, fmt.Errorf("#REF!")
	default:
		return 0, fmt.Errorf("cannot convert to number")
	}
}

// evaluateExpression evaluates an Expression node
func evaluateExpression(expr *Expression, sheet *Spreadsheet) (Value, error) {
	return evaluateComparison(expr.Comparison, sheet)
}

// evaluateComparison evaluates a Comparison node
func evaluateComparison(comp *Comparison, sheet *Spreadsheet) (Value, error) {
	left, err := evaluateAddition(comp.Left, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if comp.Op == nil {
		return left, nil
	}

	// Propagate left error before evaluating right (avoids right error masking left #REF!)
	if isErrorLike(left) {
		return left, nil
	}

	right, err := evaluateComparison(comp.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if isErrorLike(right) {
		return right, nil
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, nil
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, nil
	}

	var result bool
	switch *comp.Op {
	case "=":
		result = leftNum == rightNum
	case "!=":
		result = leftNum != rightNum
	case "<":
		result = leftNum < rightNum
	case "<=":
		result = leftNum <= rightNum
	case ">":
		result = leftNum > rightNum
	case ">=":
		result = leftNum >= rightNum
	default:
		return ErrorValue{fmt.Errorf("unknown comparison operator: %s", *comp.Op)}, nil
	}

	if result {
		return NumberValue{1}, nil
	}
	return NumberValue{0}, nil
}

// evaluateAddition evaluates an Addition node
func evaluateAddition(add *Addition, sheet *Spreadsheet) (Value, error) {
	left, err := evaluateMultiplication(add.Left, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if add.Op == nil {
		return left, nil
	}

	// Propagate left error before evaluating right (avoids right error masking left #REF!)
	if isErrorLike(left) {
		return left, nil
	}

	right, err := evaluateAddition(add.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if isErrorLike(right) {
		return right, nil
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, nil
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, nil
	}

	switch *add.Op {
	case "+":
		return NumberValue{leftNum + rightNum}, nil
	case "-":
		return NumberValue{leftNum - rightNum}, nil
	default:
		return ErrorValue{fmt.Errorf("unknown addition operator: %s", *add.Op)}, nil
	}
}

// evaluateMultiplication evaluates a Multiplication node
func evaluateMultiplication(mult *Multiplication, sheet *Spreadsheet) (Value, error) {
	left, err := evaluateUnary(mult.Left, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if mult.Op == nil {
		return left, nil
	}

	// Propagate left error before evaluating right (avoids right error masking left #REF!)
	if isErrorLike(left) {
		return left, nil
	}

	right, err := evaluateMultiplication(mult.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	if isErrorLike(right) {
		return right, nil
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, nil
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, nil
	}

	switch *mult.Op {
	case "*":
		return NumberValue{leftNum * rightNum}, nil
	case "/":
		if rightNum == 0 {
			return ErrorValue{fmt.Errorf("division by zero")}, nil
		}
		return NumberValue{leftNum / rightNum}, nil
	case "%":
		if rightNum == 0 {
			return ErrorValue{fmt.Errorf("modulo by zero")}, nil
		}
		return NumberValue{math.Mod(leftNum, rightNum)}, nil
	default:
		return ErrorValue{fmt.Errorf("unknown multiplication operator: %s", *mult.Op)}, nil
	}
}

// evaluateUnary evaluates a Unary node
func evaluateUnary(unary *Unary, sheet *Spreadsheet) (Value, error) {
	if unary.Primary != nil {
		return evaluatePrimary(unary.Primary, sheet)
	}

	// Evaluate nested unary
	val, err := evaluateUnary(unary.Unary, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	// Propagate error values (including #REF!) before converting to number
	if isErrorLike(val) {
		return val, nil
	}

	num, err := toNumber(val)
	if err != nil {
		return ErrorValue{err}, err
	}

	switch *unary.Op {
	case "+":
		return NumberValue{num}, nil
	case "-":
		return NumberValue{-num}, nil
	default:
		return ErrorValue{fmt.Errorf("unknown unary operator: %s", *unary.Op)}, nil
	}
}

// evaluatePrimary evaluates a Primary node
func evaluatePrimary(prim *Primary, sheet *Spreadsheet) (Value, error) {
	if prim.Number != nil {
		return NumberValue{*prim.Number}, nil
	}

	if prim.String != nil {
		// Remove quotes
		str := *prim.String
		if len(str) >= 2 && str[0] == '"' && str[len(str)-1] == '"' {
			str = str[1 : len(str)-1]
		}
		return StringValue{str}, nil
	}

	if prim.CellRef != nil {
		return evaluateCellRef(prim.CellRef, sheet)
	}

	if prim.Range != nil {
		return evaluateRange(prim.Range, sheet)
	}

	if prim.FuncCall != nil {
		return evaluateFuncCall(prim.FuncCall, sheet)
	}

	if prim.SubExpr != nil {
		return evaluateExpression(prim.SubExpr, sheet)
	}

	return ErrorValue{fmt.Errorf("invalid primary expression")}, nil
}

// evaluateCellRef evaluates a cell reference.
// Story 11.6: Covered cells resolve to anchor so formulas referencing merged ranges work.
func evaluateCellRef(ref *CellRef, sheet *Spreadsheet) (Value, error) {
	if ref.Invalid {
		return RefErrorValue{}, nil
	}
	row, col := ref.Row, ref.Col
	ar, ac := sheet.ResolveToAnchor(row, col)
	cell := sheet.GetCell(ar, ac)

	if cell == nil || cell.Value == "" {
		return StringValue{""}, nil
	}

	// Use the computed value (for formulas, this is the result; for values, it's the same as Value)
	computed := cell.Computed

	// If the referenced cell itself contains an error, propagate it.
	// #REF! propagates as RefErrorValue; other errors propagate as ErrorValue.
	if cell.IsError {
		if computed == "#REF!" {
			return RefErrorValue{}, nil
		}
		return ErrorValue{fmt.Errorf("referenced cell has error")}, nil
	}

	// Try to parse as number
	var num float64
	_, err := fmt.Sscanf(computed, "%f", &num)
	if err == nil {
		return NumberValue{num}, nil
	}

	// Return as string
	return StringValue{computed}, nil
}

// evaluateRange evaluates a range and returns a VectorValue
func evaluateRange(rng *Range, sheet *Spreadsheet) (Value, error) {
	if rng.Invalid {
		return RefErrorValue{}, nil
	}
	// Get start and end coordinates
	startRow, startCol := rng.GetStartCoords()
	endRow, endCol := rng.GetEndCoords()

	var values []Value

	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			// Story 11.6: Skip covered cells; only process anchor (avoids double-count in merged range)
			ar, ac := sheet.ResolveToAnchor(row, col)
			if ar != row || ac != col {
				continue
			}
			cell := sheet.GetCell(row, col)
			if cell == nil || cell.Value == "" {
				// Empty cell in range - treat as empty string (coerces to 0 in numeric context)
				values = append(values, StringValue{""})
			} else {
				// Use computed value
				computed := cell.Computed
				if computed == "" {
					computed = cell.Value
				}

				// Try to parse as number
				var num float64
				_, err := fmt.Sscanf(computed, "%f", &num)
				if err == nil {
					values = append(values, NumberValue{num})
				} else {
					values = append(values, StringValue{computed})
				}
			}
		}
	}

	return VectorValue{values}, nil
}

// evaluateFuncCall evaluates a function call
func evaluateFuncCall(call *FuncCall, sheet *Spreadsheet) (Value, error) {
	funcName := strings.ToUpper(call.Name)

	// Evaluate arguments
	var args []Value
	for _, argExpr := range call.Args {
		val, err := evaluateExpression(argExpr, sheet)
		if err != nil {
			return ErrorValue{err}, err
		}
		// Propagate #REF! out of function calls immediately
		if _, isRef := val.(RefErrorValue); isRef {
			return val, nil
		}
		args = append(args, val)
	}

	// Look up function
	fn, ok := builtinFunctions[funcName]
	if !ok {
		return ErrorValue{fmt.Errorf("unknown function: %s", call.Name)}, nil
	}

	return fn(args)
}

// Built-in functions
var builtinFunctions = map[string]func([]Value) (Value, error){
	// Numeric functions
	"SUM":   sumFunction,
	"AVG":   avgFunction,
	"MIN":   minFunction,
	"MAX":   maxFunction,
	"COUNT": countFunction,

	// String functions
	"CONCAT": concatFunction,
	"UPPER":  upperFunction,
	"LOWER":  lowerFunction,
	"LEN":    lenFunction,
	"LEFT":   leftFunction,
	"RIGHT":  rightFunction,
	"MID":    midFunction,
}

// sumFunction implements SUM
func sumFunction(args []Value) (Value, error) {
	sum := 0.0

	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			sum += v.Value
		case VectorValue:
			for _, val := range v.Values {
				if num, ok := val.(NumberValue); ok {
					sum += num.Value
				} else if err, ok := val.(ErrorValue); ok {
					// Propagate error from range
					return err, nil
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, nil
		}
	}

	return NumberValue{sum}, nil
}

// avgFunction implements AVG
func avgFunction(args []Value) (Value, error) {
	sum := 0.0
	count := 0

	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			sum += v.Value
			count++
		case VectorValue:
			for _, val := range v.Values {
				if num, ok := val.(NumberValue); ok {
					sum += num.Value
					count++
				} else if err, ok := val.(ErrorValue); ok {
					// Propagate error from range
					return err, nil
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, nil
		}
	}

	if count == 0 {
		return ErrorValue{fmt.Errorf("AVG requires at least one numeric value")}, nil
	}

	return NumberValue{sum / float64(count)}, nil
}

// minFunction implements MIN
func minFunction(args []Value) (Value, error) {
	min := math.Inf(1)
	found := false

	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			if v.Value < min {
				min = v.Value
			}
			found = true
		case VectorValue:
			for _, val := range v.Values {
				if num, ok := val.(NumberValue); ok {
					if num.Value < min {
						min = num.Value
					}
					found = true
				} else if err, ok := val.(ErrorValue); ok {
					// Propagate error from range
					return err, nil
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, nil
		}
	}

	if !found {
		return ErrorValue{fmt.Errorf("MIN requires at least one numeric value")}, nil
	}

	return NumberValue{min}, nil
}

// maxFunction implements MAX
func maxFunction(args []Value) (Value, error) {
	max := math.Inf(-1)
	found := false

	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			if v.Value > max {
				max = v.Value
			}
			found = true
		case VectorValue:
			for _, val := range v.Values {
				if num, ok := val.(NumberValue); ok {
					if num.Value > max {
						max = num.Value
					}
					found = true
				} else if err, ok := val.(ErrorValue); ok {
					// Propagate error from range
					return err, nil
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, nil
		}
	}

	if !found {
		return ErrorValue{fmt.Errorf("MAX requires at least one numeric value")}, nil
	}

	return NumberValue{max}, nil
}

// countFunction implements COUNT
func countFunction(args []Value) (Value, error) {
	count := 0

	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			count++
		case VectorValue:
			for _, val := range v.Values {
				if _, ok := val.(NumberValue); ok {
					count++
				} else if err, ok := val.(ErrorValue); ok {
					// Propagate error from range
					return err, nil
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, nil
		}
	}

	return NumberValue{float64(count)}, nil
}

// valueToStr converts a Value to string, returning "" for non-string/number types.
// Used in string functions where errors and vectors should produce empty strings.
func valueToStr(v Value) string {
	switch v.(type) {
	case StringValue, NumberValue:
		return valueToString(v)
	default:
		return ""
	}
}

// concatFunction implements CONCAT - concatenate strings
func concatFunction(args []Value) (Value, error) {
	var result string

	for _, arg := range args {
		switch v := arg.(type) {
		case StringValue:
			result += v.Value
		case NumberValue:
			result += valueToString(v)
		case VectorValue:
			for _, val := range v.Values {
				result += valueToStr(val)
			}
		case ErrorValue:
			return v, v.Error
		}
	}

	return StringValue{result}, nil
}

// upperFunction implements UPPER - convert to uppercase
func upperFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("UPPER requires exactly 1 argument")}, nil
	}

	str := valueToStr(args[0])
	return StringValue{strings.ToUpper(str)}, nil
}

// lowerFunction implements LOWER - convert to lowercase
func lowerFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("LOWER requires exactly 1 argument")}, nil
	}

	str := valueToStr(args[0])
	return StringValue{strings.ToLower(str)}, nil
}

// lenFunction implements LEN - string length
func lenFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("LEN requires exactly 1 argument")}, nil
	}

	str := valueToStr(args[0])
	return NumberValue{float64(len(str))}, nil
}

// leftFunction implements LEFT - first n characters
func leftFunction(args []Value) (Value, error) {
	if len(args) != 2 {
		return ErrorValue{fmt.Errorf("LEFT requires exactly 2 arguments")}, nil
	}

	str := valueToStr(args[0])
	n, err := toNumber(args[1])
	if err != nil {
		return ErrorValue{err}, nil
	}

	length := int(n)
	if length < 0 {
		length = 0
	}
	if length > len(str) {
		length = len(str)
	}

	return StringValue{str[:length]}, nil
}

// rightFunction implements RIGHT - last n characters
func rightFunction(args []Value) (Value, error) {
	if len(args) != 2 {
		return ErrorValue{fmt.Errorf("RIGHT requires exactly 2 arguments")}, nil
	}

	str := valueToStr(args[0])
	n, err := toNumber(args[1])
	if err != nil {
		return ErrorValue{err}, nil
	}

	length := int(n)
	if length < 0 {
		length = 0
	}
	if length > len(str) {
		length = len(str)
	}

	start := len(str) - length
	return StringValue{str[start:]}, nil
}

// midFunction implements MID - substring
func midFunction(args []Value) (Value, error) {
	if len(args) != 3 {
		return ErrorValue{fmt.Errorf("MID requires exactly 3 arguments")}, nil
	}

	str := valueToStr(args[0])
	start, err := toNumber(args[1])
	if err != nil {
		return ErrorValue{err}, nil
	}
	length, err := toNumber(args[2])
	if err != nil {
		return ErrorValue{err}, nil
	}

	// Convert to 0-based index (MID uses 1-based)
	startIdx := int(start) - 1
	lengthInt := int(length)

	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx >= len(str) {
		return StringValue{""}, nil
	}

	endIdx := startIdx + lengthInt
	if endIdx > len(str) {
		endIdx = len(str)
	}

	return StringValue{str[startIdx:endIdx]}, nil
}
