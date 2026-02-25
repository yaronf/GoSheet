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
	// Uppercase everything EXCEPT string literals (inside quotes)
	// This preserves case in strings while making cell refs and functions case-insensitive
	var result strings.Builder
	inString := false

	for i := 0; i < len(formula); i++ {
		ch := formula[i]

		if ch == '"' {
			inString = !inString
			result.WriteByte(ch)
		} else if inString {
			// Inside string literal - preserve case
			result.WriteByte(ch)
		} else {
			// Outside string literal - uppercase
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

// serializePrimary converts a Primary AST back to a string
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

	// If either operand is an error, propagate it
	if _, isErr := left.(ErrorValue); isErr {
		return left, nil
	}
	if _, isErr := right.(ErrorValue); isErr {
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

	right, err := evaluateAddition(add.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	// If either operand is an error, propagate it
	if _, isErr := left.(ErrorValue); isErr {
		return left, nil
	}
	if _, isErr := right.(ErrorValue); isErr {
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

	right, err := evaluateMultiplication(mult.Right, sheet)
	if err != nil {
		return ErrorValue{err}, err
	}

	// If either operand is an error, propagate it
	if _, isErr := left.(ErrorValue); isErr {
		return left, nil
	}
	if _, isErr := right.(ErrorValue); isErr {
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
		return ErrorValue{fmt.Errorf("reference to empty cell")}, nil
	}

	// Check if cell has no value (truly empty)
	if cell.Value == "" {
		return ErrorValue{fmt.Errorf("reference to empty cell")}, nil
	}

	// Use the computed value (for formulas, this is the result; for values, it's the same as Value)
	computed := cell.Computed
	if computed == "" {
		// If Computed is not set, use Value (shouldn't happen with proper cell initialization)
		computed = cell.Value
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
	// Get start and end coordinates
	startRow, startCol := rng.GetStartCoords()
	endRow, endCol := rng.GetEndCoords()

	var values []Value

	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			cell := sheet.GetCell(row, col)
			if cell == nil {
				// Empty cell in range - return error
				values = append(values, ErrorValue{fmt.Errorf("reference to empty cell")})
			} else if cell.Value == "" {
				// Cell exists but has no value - return error
				values = append(values, ErrorValue{fmt.Errorf("reference to empty cell")})
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

// Helper function to convert Value to string
func valueToStr(v Value) string {
	switch val := v.(type) {
	case StringValue:
		return val.Value
	case NumberValue:
		return valueToString(val)
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
