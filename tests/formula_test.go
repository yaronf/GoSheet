package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gosheet/model"
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
			_, err := model.ParseFormula(tt.formula)
			if tt.valid {
				assert.NoError(t, err, "Should parse successfully")
			} else {
				assert.Error(t, err, "Should fail to parse")
			}
		})
	}
}

func TestEvaluateSimpleArithmetic(t *testing.T) {
	sheet := model.NewSpreadsheet()

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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateComparison(t *testing.T) {
	sheet := model.NewSpreadsheet()

	tests := []struct {
		formula  string
		expected string
	}{
		{"=5>3", "1"},   // true = 1
		{"=3>5", "0"},   // false = 0
		{"=5>=5", "1"},
		{"=5<10", "1"},
		{"=10<=10", "1"},
		{"=5=5", "1"},
		{"=5!=3", "1"},
		{"=5=3", "0"},
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateCellReference(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateEmptyCell(t *testing.T) {
	sheet := model.NewSpreadsheet()

	// Empty cell should produce an error
	result, err := model.EvaluateFormula("=A1+5", sheet)
	assert.NoError(t, err)
	assert.Contains(t, result, "#ERROR")
}

func TestEvaluateSumFunction(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateAvgFunction(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateMinMaxFunction(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateCountFunction(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateComplexFormula(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEvaluateLargeRange(t *testing.T) {
	sheet := model.NewSpreadsheet()

	// Set up 100 cells with values 1-100
	for i := 0; i < 100; i++ {
		sheet.SetCell(i, 0, "1")
		sheet.GetCell(i, 0).SetComputed("1")
	}

	// SUM should be 100
	result, err := model.EvaluateFormula("=SUM(A1:A100)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", result)

	// COUNT should be 100
	result, err = model.EvaluateFormula("=COUNT(A1:A100)", sheet)
	assert.NoError(t, err)
	assert.Equal(t, "100", result)
}

func TestEvaluateErrors(t *testing.T) {
	sheet := model.NewSpreadsheet()

	tests := []struct {
		formula string
		hasErr  bool
	}{
		{"=1/0", true},     // Division by zero
		{"=10%0", true},    // Modulo by zero
		{"=UNKNOWN()", true}, // Unknown function
	}

	for _, tt := range tests {
		t.Run(tt.formula, func(t *testing.T) {
			result, err := model.EvaluateFormula(tt.formula, sheet)
			if tt.hasErr {
				// Should either return error or error value
				if err == nil {
					assert.Contains(t, result, "#ERROR")
				}
			}
		})
	}
}

func TestStringFunctions(t *testing.T) {
	sheet := model.NewSpreadsheet()
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
			result, err := model.EvaluateFormula(tt.formula, sheet)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
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
			ref := &model.CellRef{Ref: tt.ref}
			row, col := ref.ToCoords()
			assert.Equal(t, tt.expRow, row)
			assert.Equal(t, tt.expCol, col)
		})
	}
}
