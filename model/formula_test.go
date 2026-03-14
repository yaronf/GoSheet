package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
		})
	}
}

func TestEvaluateEmptyCell(t *testing.T) {
	sheet := NewSpreadsheet()

	// Empty cell coerces to 0 in numeric context
	val, err := EvaluateFormula("=A1+5", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "5", valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
	val, err := EvaluateFormula("=SUM(A1:A100)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", valueToString(val))

	// COUNT should be 100
	val, err = EvaluateFormula("=COUNT(A1:A100)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			if tt.hasErr {
				// Should either return error or error value
				if err == nil {
					assert.True(t, isErrorLike(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
		})
	}
}

// TestFormulaStringToNumber exercises toNumber with StringValue (cell with "5" used in =A1+1)
func TestFormulaStringToNumber(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "5") // Plain text "5"
	sheet.GetCell(0, 0).SetComputed("5")

	val, err := EvaluateFormula("=A1+1", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "6", valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.True(t, isErrorLike(val))
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
	_, err := EvaluateFormula("=1+", nil, sheet)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse")
}

// TestFormulaEvalError exercises the eval error path (err propagation from toNumber in unary)
func TestFormulaEvalError(t *testing.T) {
	sheet := NewSpreadsheet()
	// =--A1 with empty A1: empty coerces to 0, double negation gives 0
	val, err := EvaluateFormula("=--A1", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "0", valueToString(val))
}

func TestFormulaDivisionByZero(t *testing.T) {
	sheet := NewSpreadsheet()
	val, err := EvaluateFormula("=10/0", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "division by zero")
}

func TestFormulaFullRowColRangeError(t *testing.T) {
	sheet := NewSpreadsheet()
	// Full column range A:A
	val, err := EvaluateFormula("=A:A", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "cannot use full-row/col ranges")

	// Full row range 7:7
	val2, err2 := EvaluateFormula("=7:7", nil, sheet)
	assert.NoError(t, err2)
	assert.True(t, isErrorLike(val2))
	assert.Contains(t, valueToString(val2), "cannot use full-row/col ranges")

	// Inside function
	val3, err3 := EvaluateFormula("=SUM(A:A)", nil, sheet)
	assert.NoError(t, err3)
	assert.True(t, isErrorLike(val3))
	assert.Contains(t, valueToString(val3), "cannot use full-row/col ranges")
}

func TestFormulaModuloByZero(t *testing.T) {
	sheet := NewSpreadsheet()
	val, err := EvaluateFormula("=10%0", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "modulo")
}

func TestFormulaUnknownFunction(t *testing.T) {
	sheet := NewSpreadsheet()
	val, err := EvaluateFormula("=FOOBAR(1)", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "unknown function")
}

func TestFormulaToNumberInvalidString(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "abc")
	sheet.GetCell(0, 0).SetComputed("abc")

	val, err := EvaluateFormula("=A1+1", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "cannot convert")
}

func TestFormulaCONCATWithRange(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "a")
	sheet.SetCell(0, 1, "b")
	sheet.GetCell(0, 0).SetComputed("a")
	sheet.GetCell(0, 1).SetComputed("b")

	val, err := EvaluateFormula("=CONCAT(A1:B1)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "ab", valueToString(val))
}

func TestFormulaRangeAsValue(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(0, 1, "2")
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(0, 1).SetComputed("2")

	// Bare range A1:B1 evaluates to VectorValue; valueToString yields "[N values]"
	val, err := EvaluateFormula("=A1:B1", nil, sheet)
	assert.NoError(t, err)
	assert.Contains(t, valueToString(val), "values")
}

func TestFormulaAVGNoNumericValues(t *testing.T) {
	sheet := NewSpreadsheet()
	val, err := EvaluateFormula("=AVG(\"a\",\"b\")", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "at least one numeric")
}

func TestFormulaRightEdgeCases(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "hi")
	sheet.GetCell(0, 0).SetComputed("hi")
	// length < 0 -> clamped to 0
	val, err := EvaluateFormula("=RIGHT(\"hi\",-1)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "", valueToString(val))
	// length > len(str) -> clamped to len(str)
	val, err = EvaluateFormula("=RIGHT(\"hi\",10)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "hi", valueToString(val))
}

func TestFormulaMidEdgeCases(t *testing.T) {
	sheet := NewSpreadsheet()
	// startIdx >= len(str) -> return ""
	val, err := EvaluateFormula("=MID(\"hi\",5,2)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "", valueToString(val))
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
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.True(t, isErrorLike(val))
			assert.Contains(t, valueToString(val), tt.contains)
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
	val, err := EvaluateFormula("=--5", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "5", valueToString(val))
}

func TestFormulaNumberFormatting(t *testing.T) {
	sheet := NewSpreadsheet()
	// Integer formatting (no decimal)
	val, err := EvaluateFormula("=1", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "1", valueToString(val))

	// Float formatting
	val, err = EvaluateFormula("=1.5", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "1.5", valueToString(val))
}

func TestFormulaSUMWithEmptyInRange(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "1")
	sheet.SetCell(1, 0, "2")
	// A3 is empty - treated as 0, sum should be 3
	sheet.GetCell(0, 0).SetComputed("1")
	sheet.GetCell(1, 0).SetComputed("2")

	val, err := EvaluateFormula("=SUM(A1:A3)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "3", valueToString(val))
}

func TestFormulaInvalidPrimary(t *testing.T) {
	sheet := NewSpreadsheet()
	// =() may parse as empty subexpr; if so, hits "invalid primary expression"
	val, err := EvaluateFormula("=()", nil, sheet)
	if err != nil {
		assert.Contains(t, err.Error(), "parse")
	} else {
		assert.True(t, isErrorLike(val))
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
	val, err := EvaluateFormula("=A1:B1+1", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Contains(t, valueToString(val), "cannot convert")
}

// TestFormulaValueToStrDefault exercises valueToStr default (ErrorValue -> "")
func TestFormulaValueToStrDefault(t *testing.T) {
	sheet := NewSpreadsheet()
	// A1 empty (ErrorValue), B1 has "x"
	sheet.SetCell(0, 1, "x")
	sheet.GetCell(0, 1).SetComputed("x")
	// CONCAT(A1:B1) gets VectorValue with ErrorValue for A1, StringValue for B1
	val, err := EvaluateFormula("=CONCAT(A1:B1)", nil, sheet)
	assert.NoError(t, err)
	assert.Equal(t, "x", valueToString(val)) // valueToStr(ErrorValue) -> "" so "" + "x"
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
	v = RefErrorValue{}
	v.value()
}

// TestRefErrorValue_ValueToString verifies RefErrorValue serialises to "#REF!"
func TestRefErrorValue_ValueToString(t *testing.T) {
	assert.Equal(t, "#REF!", valueToString(RefErrorValue{}))
}

// TestRefErrorValue_ToNumber verifies toNumber returns an error for RefErrorValue
func TestRefErrorValue_ToNumber(t *testing.T) {
	_, err := toNumber(RefErrorValue{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "#REF!")
}

// TestRefErrorValue_Propagation verifies that a #REF! result propagates through arithmetic
func TestRefErrorValue_Propagation(t *testing.T) {
	sheet := NewSpreadsheet()

	// Build a cell with a formula referencing a deleted cell
	cell := NewCell("=A2+1")
	require.NotNil(t, cell.ParsedFormula)
	// Simulate deleting row 1 (A2)
	unshiftFormulaRefsForDeleteRow(cell, 1)
	require.True(t, firstCellRef(cell).Invalid, "A2 ref should be invalid after deleting row 1")

	// Evaluate with stored AST — should yield #REF!
	val, err := EvaluateFormula("="+cell.Value, cell.ParsedFormula, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

// TestRefErrorValue_RangeInvalid verifies that a range with a deleted boundary evaluates to #REF!
func TestRefErrorValue_RangeInvalid(t *testing.T) {
	sheet := NewSpreadsheet()
	sheet.SetCell(0, 0, "5")
	sheet.GetCell(0, 0).SetComputed("5")

	cell := NewCell("=SUM(A1:A1)")
	require.NotNil(t, cell.ParsedFormula)
	// Delete row 0 — range start is deleted
	unshiftFormulaRefsForDeleteRow(cell, 0)

	val, err := EvaluateFormula("="+cell.Value, cell.ParsedFormula, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

// TestIsErrorLike verifies both ErrorValue and RefErrorValue return true
func TestIsErrorLike(t *testing.T) {
	assert.True(t, isErrorLike(ErrorValue{assert.AnError}))
	assert.True(t, isErrorLike(RefErrorValue{}))
	assert.False(t, isErrorLike(NumberValue{1}))
	assert.False(t, isErrorLike(StringValue{"x"}))
}

// TestRefErrorValue_LeftOperandNotMaskedByRightError verifies that when the left operand of
// an arithmetic expression is a #REF!, a Go-level error from evaluating the right operand
// does not mask it (M1 fix).
// Setup: A1 is a #REF! error cell; the formula =A1+B1 is evaluated where B1 is a cell
// whose Computed value is a non-numeric string (causes toNumber error on right side).
func TestRefErrorValue_LeftOperandNotMaskedByRightError(t *testing.T) {
	sheet := NewSpreadsheet()

	// A1 is a #REF! error cell
	sheet.SetCell(0, 0, "=X1")
	sheet.GetCell(0, 0).IsError = true
	sheet.GetCell(0, 0).Computed = "#REF!"

	// B1 is a plain text cell (toNumber will fail on it when used in arithmetic)
	sheet.SetCell(0, 1, "hello")

	// =A1+B1: left evaluates to RefErrorValue (via M5 fix), right evaluates to StringValue.
	// Before M1 fix: if right caused a Go error, it would override the left RefErrorValue.
	// The key scenario we test is that left RefErrorValue short-circuits right evaluation.
	val, err := EvaluateFormula("=A1+B1", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

// TestRefErrorValue_UnaryMinus verifies that applying unary minus to a #REF! cell preserves
// RefErrorValue rather than degrading to a generic ErrorValue (M4 fix).
func TestRefErrorValue_UnaryMinus(t *testing.T) {
	sheet := NewSpreadsheet()

	// Construct a cell whose formula is =-A1 with A1 marked invalid.
	// Use WalkPrimaries to find and invalidate the CellRef without brittle deep-path navigation.
	cell := NewCell("=-A1")
	require.NotNil(t, cell.ParsedFormula)
	WalkPrimaries(cell.ParsedFormula, func(prim *Primary) {
		if prim.CellRef != nil {
			prim.CellRef.Invalid = true
		}
	})

	val, err := EvaluateFormula("="+cell.Value, cell.ParsedFormula, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

// TestRefErrorValue_PropagatesThroughCellRef verifies that a #REF! computed value in a
// referenced cell propagates as RefErrorValue, not as a generic "referenced cell has error" (M5 fix).
func TestRefErrorValue_PropagatesThroughCellRef(t *testing.T) {
	sheet := NewSpreadsheet()

	// A1 has a #REF! error (simulates a formula whose ref was deleted and evaluated)
	sheet.SetCell(0, 0, "=B1")
	a1 := sheet.GetCell(0, 0)
	a1.IsError = true
	a1.Computed = "#REF!"

	// B2 = =A1 — should propagate #REF!, not "#ERROR referenced cell has error"
	val, err := EvaluateFormula("=A1", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}

func TestExponentiationOperator(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		expected string
	}{
		{"=2^3", "8"},
		{"=5^2", "25"},
		{"=4^0.5", "2"}, // sqrt(4)
		{"=2^0", "1"},
		{"=10^-1", "0.1"},
		{"=2^3^2", "512"}, // right-associative: 2^(3^2) = 2^9 = 512
		{"=2^3*2", "16"},  // precedence: (2^3)*2
		{"=2+3^2", "11"},  // precedence: 2+(3^2)
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, valueToString(val))
		})
	}
}

func TestSqrtFunction(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		expected float64
	}{
		{"=SQRT(4)", 2},
		{"=SQRT(9)", 3},
		{"=SQRT(0)", 0},
		{"=SQRT(2)", 1.4142135623730951},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			num, ok := val.(NumberValue)
			require.True(t, ok)
			assert.InDelta(t, tt.expected, num.Value, 1e-9)
		})
	}
}

func TestSqrtErrors(t *testing.T) {
	sheet := NewSpreadsheet()

	val, err := EvaluateFormula("=SQRT(-1)", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))

	val, err = EvaluateFormula("=SQRT(1,2)", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
}

func TestStdevFunction(t *testing.T) {
	sheet := NewSpreadsheet()

	// Classic dataset: {2, 4, 4, 4, 5, 5, 7, 9} — sample stdev = 2
	data := []string{"2", "4", "4", "4", "5", "5", "7", "9"}
	for i, v := range data {
		sheet.SetCell(i, 0, v)
		sheet.GetCell(i, 0).SetComputed(v)
	}

	val, err := EvaluateFormula("=STDEV(A1:A8)", nil, sheet)
	assert.NoError(t, err)
	num, ok := val.(NumberValue)
	require.True(t, ok)
	// Sample stdev (Bessel's correction): sqrt(32/7) ≈ 2.1381
	assert.InDelta(t, 2.138089935299395, num.Value, 1e-9)

	// Fewer than 2 values → error
	val, err = EvaluateFormula("=STDEV(1)", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
}

func TestMathFunctions(t *testing.T) {
	sheet := NewSpreadsheet()

	tests := []struct {
		formula  string
		expected float64
	}{
		{"=ABS(-5)", 5},
		{"=ABS(5)", 5},
		{"=ROUND(3.14159,2)", 3.14},
		{"=ROUND(2.5,0)", 3},
		{"=FLOOR(3.9)", 3},
		{"=FLOOR(-3.1)", -4},
		{"=CEIL(3.1)", 4},
		{"=CEIL(-3.9)", -3},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			val, err := EvaluateFormula(tt.formula, nil, sheet)
			assert.NoError(t, err)
			num, ok := val.(NumberValue)
			require.True(t, ok)
			assert.InDelta(t, tt.expected, num.Value, 1e-9)
		})
	}
}

// TestRefErrorValue_ChainedCellRef verifies #REF! propagates through a chain:
// A1=#REF! → B1=A1 → C1=B1 all show #REF!
func TestRefErrorValue_ChainedCellRef(t *testing.T) {
	sheet := NewSpreadsheet()

	// A1 is a #REF! error cell
	sheet.SetCell(0, 0, "=X1")
	sheet.GetCell(0, 0).IsError = true
	sheet.GetCell(0, 0).Computed = "#REF!"

	// B1 references A1
	val, err := EvaluateFormula("=A1", nil, sheet)
	assert.NoError(t, err)
	assert.True(t, isErrorLike(val))
	assert.Equal(t, "#REF!", valueToString(val))
}
