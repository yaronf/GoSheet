package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseSimpleArithmetic(t *testing.T) {
	tests := []struct {
		formula string
		valid   bool
	}{
		{"=2+2", true},
		{"=10*5", true},
		{"=(100+50)/2", true},
		{"=2+2*3", true},
		{"=-5", true},
		{"=+10", true},
		{"2+2", false}, // Missing =
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			_, err := ParseFormula(tt.formula)
			if tt.valid {
				assert.NoError(t, err, "Should parse successfully")
			} else {
				assert.Error(t, err, "Should fail to parse")
			}
		})
	}
}

func TestEvaluateSimpleArithmetic(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		expected string
	}{
		{"=2+2", "4"},
		{"=10-3", "7"},
		{"=5*6", "30"},
		{"=20/4", "5"},
		{"=10%3", "1"},
		{"=(2+3)*4", "20"},
		{"=2+3*4", "14"}, // Precedence: 3*4 first
		{"=-5", "-5"},
		{"=+10", "10"},
		{"=2+2+2", "6"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateComparison(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		expected string
	}{
		{"=5>3", "1"}, // true = 1
		{"=3>5", "0"}, // false = 0
		{"=5>=5", "1"},
		{"=5<10", "1"},
		{"=10<=10", "1"},
		{"=5=5", "1"},
		{"=5!=3", "1"},
		{"=5=3", "0"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateCellReference(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "5")  // A1 = 5
	sheet.SetCell(1, 0, "10") // A2 = 10
	sheet.GetCell(0, 0).SetComputed("5")
	sheet.GetCell(1, 0).SetComputed("10")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=A1", "5"},
		{"=A2", "10"},
		{"=A1+A2", "15"},
		{"=A1*A2", "50"},
		{"=A2-A1", "5"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateEmptyCell(t *testing.T) {
	sheet := NewSpreadsheet()

	// Empty cell coerces to 0 in numeric context
	result, _, err := EvaluateFormula("=A1+5", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "5", result)
}

func TestEvaluateSumFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1") // A1 = 1
	sheet.SetCell(1, 0, "2") // A2 = 2
	sheet.SetCell(2, 0, "3") // A3 = 3
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(1, 0).SetComputed("2")
	sheet.GetCell(2, 0).SetComputed("3")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=SUM(1,2,3)", "6"},
		{"=SUM(A1:A3)", "6"},
		{"=SUM(A1,A2,A3)", "6"},
		{"=SUM(A1:A3)+10", "16"},
		{"=SUM(1,2,3,4,5)", "15"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateAvgFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "10") // A1 = 10
	sheet.SetCell(1, 0, "20") // A2 = 20
	sheet.SetCell(2, 0, "30") // A3 = 30
	sheet.GetCell(0, 0).SetComputed("10")
	sheet.GetCell(1, 0).SetComputed("20")
	sheet.GetCell(2, 0).SetComputed("30")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=AVG(10,20,30)", "20"},
		{"=AVG(A1:A3)", "20"},
		{"=AVG(1,2,3,4,5)", "3"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateMinMaxFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "5")  // A1 = 5
	sheet.SetCell(1, 0, "10") // A2 = 10
	sheet.SetCell(2, 0, "3")  // A3 = 3
	sheet.GetCell(0, 0).SetComputed("5")
	sheet.GetCell(1, 0).SetComputed("10")
	sheet.GetCell(2, 0).SetComputed("3")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=MIN(5,10,3)", "3"},
		{"=MIN(A1:A3)", "3"},
		{"=MAX(5,10,3)", "10"},
		{"=MAX(A1:A3)", "10"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateCountFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1") // A1 = 1
	sheet.SetCell(1, 0, "2") // A2 = 2
	sheet.SetCell(2, 0, "3") // A3 = 3
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(1, 0).SetComputed("2")
	sheet.GetCell(2, 0).SetComputed("3")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=COUNT(1,2,3)", "3"},
		{"=COUNT(A1:A3)", "3"},
		{"=COUNT(1,2,3,4,5)", "5"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateComplexFormula(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "10") // A1 = 10
	sheet.SetCell(1, 0, "20") // A2 = 20
	sheet.SetCell(2, 0, "30") // A3 = 30
	sheet.GetCell(0, 0).SetComputed("10")
	sheet.GetCell(1, 0).SetComputed("20")
	sheet.GetCell(2, 0).SetComputed("30")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=SUM(A1:A3)/3", "20"},
		{"=SUM(A1:A3)+AVG(A1:A3)", "80"},
		{"=(MAX(A1:A3)-MIN(A1:A3))*2", "40"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateLargeRange(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set up 100 cells with values 1-100
	for i := 0; i < 100; i++ {
		sheet.SetCell(i, 0, "1")
		sheet.GetCell(i, 0).SetComputed("1")
	}

	// SUM should be 100
	result, _, err := EvaluateFormula("=SUM(A1:A100)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", result)

	// COUNT should be 100
	result, _, err = EvaluateFormula("=COUNT(A1:A100)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", result)
}

func TestEvaluateErrors(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula string
		hasErr  bool
	}{
		{"=1/0", true},       // Division by zero
		{"=10%0", true},      // Modulo by zero
		{"=UNKNOWN()", true}, // Unknown function
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			_, isErr, err := EvaluateFormula(tt.formula, sheet)
			if tt.hasErr {
				// Should either return error or error value
				if err == nil {
					assert.True(t, isErr)
				}
			}
		})
	}
}

func TestStringFunctions(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "Hello") // A1 = "Hello"
	sheet.SetCell(1, 0, "World") // A2 = "World"
	sheet.SetCell(2, 0, "123")   // A3 = "123"
	sheet.GetCell(0, 0).SetComputed("Hello")
	sheet.GetCell(1, 0).SetComputed("World")
	sheet.GetCell(2, 0).SetComputed("123")

	tests := []struct {
		name     string
		formula  string
		expected string
	}{
		{"=CONCAT(\"Hello\",\" \",\"World\")", "=CONCAT(\"Hello\",\" \",\"World\")", "Hello World"},
		{"=CONCAT(A1,\" \",A2)", "=CONCAT(A1,\" \",A2)", "Hello World"},
		{"=UPPER(\"hello\")", "=UPPER(\"hello\")", "HELLO"},
		{"=UPPER(A1)", "=UPPER(A1)", "HELLO"},
		{"=LOWER(\"WORLD\")", "=LOWER(\"WORLD\")", "world"},
		{"=LOWER(A2)", "=LOWER(A2)", "world"},
		{"=LEN(\"Hello\")", "=LEN(\"Hello\")", "5"},
		{"=LEN(A1)", "=LEN(A1)", "5"},
		{"=LEFT(\"Hello\",3)", "=LEFT(\"Hello\",3)", "Hel"},
		{"=LEFT(A1,2)", "=LEFT(A1,2)", "He"},
		{"=RIGHT(\"World\",3)", "=RIGHT(\"World\",3)", "rld"},
		{"=RIGHT(A2,2)", "=RIGHT(A2,2)", "ld"},
		{"=MID(\"Hello\",2,3)", "=MID(\"Hello\",2,3)", "ell"},
		{"=MID(A1,1,3)", "=MID(A1,1,3)", "Hel"},
		{"=CONCAT(A1,A3)", "=CONCAT(A1,A3)", "Hello123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRangeWithEmptyCells(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set up a range with some empty cells
	sheet.SetCell(0, 0, "10") // A1 = 10
	sheet.SetCell(1, 0, "20") // A2 = 20
	// A3 is empty - treated as 0
	sheet.SetCell(3, 0, "30") // A4 = 30

	sheet.GetCell(0, 0).SetComputed("10")
	sheet.GetCell(1, 0).SetComputed("20")
	sheet.GetCell(3, 0).SetComputed("30")

	tests := []struct {
		name     string
		formula  string
		expected string
	}{
		{"=SUM(A1:A4)", "=SUM(A1:A4)", "60"},
		{"=AVG(A1:A4)", "=AVG(A1:A4)", "20"},
		{"=MIN(A1:A4)", "=MIN(A1:A4)", "10"},
		{"=MAX(A1:A4)", "=MAX(A1:A4)", "30"},
		{"=COUNT(A1:A4)", "=COUNT(A1:A4)", "3"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestFormulaNumericEdgeCases exercises toNumber/value coercion paths
func TestFormulaNumericEdgeCases(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "10")
	sheet.SetCell(1, 0, "20")
	sheet.GetCell(0, 0).SetComputed("10")
	sheet.GetCell(1, 0).SetComputed("20")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=10.5+0.5", "11"},
		{"=10+20", "30"},
		{"=SUM(10,20)", "30"},
		{"=AVG(10,20)", "15"},
		{"=MIN(10,20)", "10"},
		{"=MAX(10,20)", "20"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestFormulaStringToNumber exercises toNumber with StringValue (cell with "5" used in =A1+1)
func TestFormulaStringToNumber(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "5") // Plain text "5"
	sheet.GetCell(0, 0).SetComputed("5")

	result, _, err := EvaluateFormula("=A1+1", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "6", result)
}

func TestFormulaStringFunctions(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "hello")
	sheet.GetCell(0, 0).SetComputed("hello")

	tests := []struct {
		formula  string
		expected string
	}{
		{"=UPPER(\"hello\")", "HELLO"},
		{"=LOWER(\"HELLO\")", "hello"},
		{"=LOWER(\"\")", ""},
		{"=LEN(\"hello\")", "5"},
		{"=LEN(\"\")", "0"},
		{"=LEFT(\"hello\",2)", "he"},
		{"=LEFT(\"hello\",0)", ""},
		{"=LEFT(\"hello\",99)", "hello"},
		{"=LEFT(\"hi\",-1)", ""},
		{"=RIGHT(\"hello\",2)", "lo"},
		{"=MID(\"hello\",2,2)", "el"},
		{"=MID(\"hi\",5,2)", ""},
		{"=MID(\"hello\",1,99)", "hello"},
		{"=CONCAT(\"a\",\"b\",\"c\")", "abc"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, _, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFormulaStringFunctions_ArgCountErrors(t *testing.T) {
	sheet := NewSpreadsheet()
	tests := []struct {
		formula string
	}{
		{"=LOWER()"},
		{"=LOWER(\"a\",\"b\")"},
		{"=LEN()"},
		{"=LEN(\"a\",\"b\")"},
		{"=LEFT(\"hello\")"},
		{"=LEFT(\"hello\",1,2)"},
	}
	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			_, isErr, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.True(t, isErr)
		})
	}
}

func TestCellRefToCoords(t *testing.T) {
	tests := []struct {
		ref    string
		expRow int
		expCol int
	}{
		{"A1", 0, 0},
		{"B2", 1, 1},
		{"Z10", 9, 25},
		{"AA1", 0, 26},
		{"AB100", 99, 27},
	}

	for _, tt := range tests {
		t.Run(tt.ref, func(t *testing.T) {
			ref := &CellRef{Ref: tt.ref}
			row, col := ref.ToCoords()
			assert.Equal(t, tt.expRow, row)
			assert.Equal(t, tt.expCol, col)
		})
	}
}

func TestFormulaParseError(t *testing.T) {
	sheet := NewSpreadsheet()
	_, _, err := EvaluateFormula("=1+", sheet)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse")
}

// TestFormulaEvalError exercises the eval error path (err propagation from toNumber in unary)
func TestFormulaEvalError(t *testing.T) {
	sheet := NewSpreadsheet()
	// =--A1 with empty A1: empty coerces to 0, double negation gives 0
	result, _, err := EvaluateFormula("=--A1", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "0", result)
}

func TestFormulaDivisionByZero(t *testing.T) {
	sheet := NewSpreadsheet()
	result, isErr, err := EvaluateFormula("=10/0", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "division by zero")
}

func TestFormulaModuloByZero(t *testing.T) {
	sheet := NewSpreadsheet()
	result, isErr, err := EvaluateFormula("=10%0", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "modulo")
}

func TestFormulaUnknownFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	result, isErr, err := EvaluateFormula("=FOOBAR(1)", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "unknown function")
}

func TestFormulaToNumberInvalidString(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "abc")
	sheet.GetCell(0, 0).SetComputed("abc")

	result, isErr, err := EvaluateFormula("=A1+1", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "cannot convert")
}

func TestFormulaCONCATWithRange(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "a")
	sheet.SetCell(0, 1, "b")
	sheet.GetCell(0, 0).SetComputed("a")
	sheet.GetCell(0, 1).SetComputed("b")

	result, _, err := EvaluateFormula("=CONCAT(A1:B1)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "ab", result)
}

func TestFormulaRangeAsValue(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(0, 1, "2")
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(0, 1).SetComputed("2")

	// Bare range A1:B1 evaluates to VectorValue; valueToString yields "[N values]"
	result, _, err := EvaluateFormula("=A1:B1", sheet)
	assert.NoError(t, err)
	assert.Contains(t, result, "values")
}

func TestFormulaAVGNoNumericValues(t *testing.T) {
	sheet := NewSpreadsheet()
	result, isErr, err := EvaluateFormula("=AVG(\"a\",\"b\")", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "at least one numeric")
}

func TestFormulaRightEdgeCases(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "hi")
	sheet.GetCell(0, 0).SetComputed("hi")
	// length < 0 -> clamped to 0
	result, _, err := EvaluateFormula("=RIGHT(\"hi\",-1)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "", result)
	// length > len(str) -> clamped to len(str)
	result, _, err = EvaluateFormula("=RIGHT(\"hi\",10)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "hi", result)
}

func TestFormulaMidEdgeCases(t *testing.T) {
	sheet := NewSpreadsheet()
	// startIdx >= len(str) -> return ""
	result, _, err := EvaluateFormula("=MID(\"hi\",5,2)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "", result)
}

func TestFormulaFunctionArgErrors(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		contains string
	}{
		{"=UPPER()", "exactly 1"},
		{"=UPPER(1,2)", "exactly 1"},
		{"=LEFT(\"hi\",2,3)", "exactly 2"},
		{"=MID(\"hi\",1)", "exactly 3"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, isErr, err := EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.True(t, isErr)
			assert.Contains(t, result, tt.contains)
		})
	}
}

func TestFormulaSerializeUnaryWithOp(t *testing.T) {
	// Nested unary (e.g. =--5) - previously panicked in NormalizeFormula, now serializes correctly
	result, err := NormalizeFormula("=--5")
	assert.NoError(t, err)
	assert.Equal(t, "=--5", result)
	// Verify evaluation works
	sheet := NewSpreadsheet()
	val, _, err := EvaluateFormula("=--5", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "5", val)
}

func TestFormulaNumberFormatting(t *testing.T) {
	sheet := NewSpreadsheet()
	// Integer formatting (no decimal)
	result, _, err := EvaluateFormula("=1", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "1", result)

	// Float formatting
	result, _, err = EvaluateFormula("=1.5", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "1.5", result)
}

func TestFormulaSUMWithEmptyInRange(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(1, 0, "2")
	// A3 is empty - treated as 0, sum should be 3
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(1, 0).SetComputed("2")

	result, _, err := EvaluateFormula("=SUM(A1:A3)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "3", result)
}

func TestFormulaInvalidPrimary(t *testing.T) {
	sheet := NewSpreadsheet()
	// =() may parse as empty subexpr; if so, hits "invalid primary expression"
	_, isErr, err := EvaluateFormula("=()", sheet)
	if err != nil {
		assert.Contains(t, err.Error(), "parse")
	} else {
		assert.True(t, isErr)
	}
}

// TestFormulaToNumberVectorValue exercises toNumber default case (VectorValue cannot convert)
func TestFormulaToNumberVectorValue(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(0, 1, "2")
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(0, 1).SetComputed("2")
	// Bare range A1:B1 in arithmetic hits toNumber default
	result, isErr, err := EvaluateFormula("=A1:B1+1", sheet)
	assert.NoError(t, err)
	assert.True(t, isErr)
	assert.Contains(t, result, "cannot convert")
}

// TestFormulaValueToStrDefault exercises valueToStr default (ErrorValue -> "")
func TestFormulaValueToStrDefault(t *testing.T) {
	sheet := NewSpreadsheet()
	// A1 empty (ErrorValue), B1 has "x"
	sheet.SetCell(0, 1, "x")
	sheet.GetCell(0, 1).SetComputed("x")
	// CONCAT(A1:B1) gets VectorValue with ErrorValue for A1, StringValue for B1
	result, _, err := EvaluateFormula("=CONCAT(A1:B1)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "x", result) // valueToStr(ErrorValue) -> "" so "" + "x"
}

// TestFormulaNormalizeError exercises NormalizeFormula with invalid formula
func TestFormulaNormalizeError(t *testing.T) {
	_, err := NormalizeFormula("=1+")
	assert.Error(t, err)
}

// testUnknownValue implements Value for testing valueToString default branch
type testUnknownValue struct{}

func (testUnknownValue) value() {}

func TestValueToStringDefault(t *testing.T) {
	// Custom Value type that doesn't match any case in valueToString -> "#UNKNOWN"
	result := valueToString(testUnknownValue{})
	assert.Equal(t, "#UNKNOWN", result)
}

// TestNormalizeFormulaEscapedQuote ensures backslash-escaped quotes inside string
// literals do not toggle the inString flag and corrupt cell-ref uppercasing.
func TestNormalizeFormulaEscapedQuote(t *testing.T) {
	// The literal value contains an escaped quote; cell ref a1 must be uppercased.
	result, err := NormalizeFormula(`=CONCAT("say \"hi\"",a1)`)
	assert.NoError(t, err)
	// Cell ref should be uppercased; string content preserved.
	assert.Contains(t, result, "A1")
	assert.Contains(t, result, `"say \"hi\""`)
}

// TestNormalizeFormulaStringPreservesCase ensures non-ref text inside strings is not uppercased.
func TestNormalizeFormulaStringPreservesCase(t *testing.T) {
	result, err := NormalizeFormula(`=CONCAT("hello",A1)`)
	assert.NoError(t, err)
	assert.Contains(t, result, `"hello"`)
	assert.Contains(t, result, "A1")
}

func TestValueToStrDefault(t *testing.T) {
	// valueToStr returns "" for non-StringValue, non-NumberValue
	result := valueToStr(testUnknownValue{})
	assert.Equal(t, "", result)
}

func TestValueInterfaceMethods(t *testing.T) {
	// Exercise value() interface markers for coverage
	var v Value = NumberValue{1}
	v.value()
	v = StringValue{"x"}
	v.value()
	v = VectorValue{Values: []Value{NumberValue{1}}}
	v.value()
	v = ErrorValue{Error: assert.AnError}
	v.value()
}
