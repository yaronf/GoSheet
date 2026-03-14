package model

import (
	"fmt"
	"math"
	"strings"
)

// Built-in functions
var builtinFunctions = map[string]func([]Value) (Value, error){
	// Numeric functions
	"SUM":   sumFunction,
	"AVG":   avgFunction,
	"MIN":   minFunction,
	"MAX":   maxFunction,
	"COUNT": countFunction,

	// Math functions
	"SQRT":  sqrtFunction,
	"STDEV": stdevFunction,
	"ABS":   absFunction,
	"ROUND": roundFunction,
	"FLOOR": floorFunction,
	"CEIL":  ceilFunction,

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

// sqrtFunction implements SQRT - square root
func sqrtFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("SQRT requires exactly 1 argument")}, nil
	}
	num, err := toNumber(args[0])
	if err != nil {
		return ErrorValue{err}, nil
	}
	if num < 0 {
		return ErrorValue{fmt.Errorf("SQRT of negative number")}, nil
	}
	return NumberValue{math.Sqrt(num)}, nil
}

// collectNumbers extracts all numeric values from args (scalars and vectors), ignoring strings.
// Returns an error if any ErrorValue is encountered.
func collectNumbers(args []Value) ([]float64, error) {
	var nums []float64
	for _, arg := range args {
		switch v := arg.(type) {
		case NumberValue:
			nums = append(nums, v.Value)
		case VectorValue:
			for _, val := range v.Values {
				switch vv := val.(type) {
				case NumberValue:
					nums = append(nums, vv.Value)
				case ErrorValue:
					return nil, vv.Error
				}
			}
		case StringValue:
			// ignore
		case ErrorValue:
			return nil, v.Error
		}
	}
	return nums, nil
}

// stdevFunction implements STDEV - sample standard deviation
func stdevFunction(args []Value) (Value, error) {
	nums, err := collectNumbers(args)
	if err != nil {
		return ErrorValue{err}, nil
	}
	if len(nums) < 2 {
		return ErrorValue{fmt.Errorf("STDEV requires at least 2 numeric values")}, nil
	}
	mean := 0.0
	for _, n := range nums {
		mean += n
	}
	mean /= float64(len(nums))
	variance := 0.0
	for _, n := range nums {
		d := n - mean
		variance += d * d
	}
	variance /= float64(len(nums) - 1) // sample std dev (Bessel's correction)
	return NumberValue{math.Sqrt(variance)}, nil
}

// absFunction implements ABS - absolute value
func absFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("ABS requires exactly 1 argument")}, nil
	}
	num, err := toNumber(args[0])
	if err != nil {
		return ErrorValue{err}, nil
	}
	return NumberValue{math.Abs(num)}, nil
}

// roundFunction implements ROUND - round to n decimal places
func roundFunction(args []Value) (Value, error) {
	if len(args) != 2 {
		return ErrorValue{fmt.Errorf("ROUND requires exactly 2 arguments")}, nil
	}
	num, err := toNumber(args[0])
	if err != nil {
		return ErrorValue{err}, nil
	}
	places, err := toNumber(args[1])
	if err != nil {
		return ErrorValue{err}, nil
	}
	factor := math.Pow(10, places)
	return NumberValue{math.Round(num*factor) / factor}, nil
}

// floorFunction implements FLOOR - round down to integer
func floorFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("FLOOR requires exactly 1 argument")}, nil
	}
	num, err := toNumber(args[0])
	if err != nil {
		return ErrorValue{err}, nil
	}
	return NumberValue{math.Floor(num)}, nil
}

// ceilFunction implements CEIL - round up to integer
func ceilFunction(args []Value) (Value, error) {
	if len(args) != 1 {
		return ErrorValue{fmt.Errorf("CEIL requires exactly 1 argument")}, nil
	}
	num, err := toNumber(args[0])
	if err != nil {
		return ErrorValue{err}, nil
	}
	return NumberValue{math.Ceil(num)}, nil
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
