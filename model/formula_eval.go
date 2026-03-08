package model

import (
	"fmt"
	"math"
	"strings"
)

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
