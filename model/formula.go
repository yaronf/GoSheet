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
	{"Float", `\d+\.\d+`},
	{"CellRef", `[A-Z]+\d+`},      // Must come before Ident to match first
	{"Ident", `[A-Za-z_][A-Za-z0-9_]*`},
	{"Int", `\d+`},
	{"String", `"(?:\\.|[^"])*"`},
	{"GTE", `>=`},                  // Must come before individual chars
	{"LTE", `<=`},
	{"NEQ", `!=`},
	{"EQ", `=`},
	{"GT", `>`},
	{"LT", `<`},
	{"Colon", `:`},
	{"Plus", `\+`},
	{"Minus", `-`},
	{"Star", `\*`},
	{"Slash", `/`},
	{"Percent", `%`},
	{"LParen", `\(`},
	{"RParen", `\)`},
	{"Comma", `,`},
	{"Whitespace", `[ \t\n\r]+`},
})

// Formula parser
var formulaParser = participle.MustBuild[Formula](
	participle.Lexer(formulaLexer),
	participle.Elide("Whitespace"),
	participle.UseLookahead(2),
)

// normalizeFormula converts cell references to uppercase while preserving function names
func normalizeFormula(formula string) string {
	// Simple approach: uppercase everything
	// This works because our functions (SUM, AVG, etc.) are also uppercase
	return strings.ToUpper(formula)
}

// ParseFormula parses a formula string into an AST
func ParseFormula(formula string) (*Formula, error) {
	// Normalize to uppercase for case-insensitive parsing
	formula = normalizeFormula(formula)
	return formulaParser.ParseString("", formula)
}

// EvaluateFormula evaluates a formula and returns the result as a string
func EvaluateFormula(formula string, sheet *Spreadsheet) (string, error) {
	// Normalize formula to uppercase for cell references
	formula = normalizeFormula(formula)
	// Parse the formula
	ast, err := ParseFormula(formula)
	if err != nil {
		return "", fmt.Errorf("parse error: %w", err)
	}

	// Evaluate the AST
	result, err := evaluateExpression(ast.Expr, sheet)
	if err != nil {
		return "", fmt.Errorf("eval error: %w", err)
	}

	// Convert result to string
	return valueToString(result), nil
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
		return fmt.Sprintf("#ERROR: %v", val.Error)
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
		// Try to parse string as number
		var num float64
		_, err := fmt.Sscanf(val.Value, "%f", &num)
		if err != nil {
			return 0, fmt.Errorf("cannot convert string to number: %s", val.Value)
		}
		return num, nil
	case ErrorValue:
		return 0, val.Error
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

	right, err := evaluateComparison(comp.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, err
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, err
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

	right, err := evaluateAddition(add.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, err
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, err
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

	right, err := evaluateMultiplication(mult.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	leftNum, err := toNumber(left)
	if err != nil {
		return ErrorValue{err}, err
	}

	rightNum, err := toNumber(right)
	if err != nil {
		return ErrorValue{err}, err
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

// evaluateCellRef evaluates a cell reference
func evaluateCellRef(ref *CellRef, sheet *Spreadsheet) (Value, error) {
	row, col := ref.ToCoords()
	cell := sheet.GetCell(row, col)

	if cell == nil {
		return NumberValue{0}, nil // Empty cell = 0
	}

	// Use the computed value
	if cell.Computed == "" {
		return NumberValue{0}, nil
	}

	// Try to parse as number
	var num float64
	_, err := fmt.Sscanf(cell.Computed, "%f", &num)
	if err == nil {
		return NumberValue{num}, nil
	}

	// Return as string
	return StringValue{cell.Computed}, nil
}

// evaluateRange evaluates a range and returns a VectorValue
func evaluateRange(rng *Range, sheet *Spreadsheet) (Value, error) {
	// Get start and end coordinates
	startRow, startCol := rng.GetStartCoords()
	endRow, endCol := rng.GetEndCoords()

	var values []Value

	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			cell := sheet.GetCell(row, col)
			if cell == nil {
				values = append(values, NumberValue{0})
			} else {
				// Try to parse as number
				var num float64
				_, err := fmt.Sscanf(cell.Computed, "%f", &num)
				if err == nil {
					values = append(values, NumberValue{num})
				} else {
					values = append(values, StringValue{cell.Computed})
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
	"SUM":   sumFunction,
	"AVG":   avgFunction,
	"MIN":   minFunction,
	"MAX":   maxFunction,
	"COUNT": countFunction,
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
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, v.Error
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
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, v.Error
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
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, v.Error
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
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, v.Error
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
				}
			}
		case StringValue:
			// Ignore strings
		case ErrorValue:
			return v, v.Error
		}
	}

	return NumberValue{float64(count)}, nil
}
