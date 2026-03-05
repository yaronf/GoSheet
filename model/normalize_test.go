package model

import (
	"testing"
)

func TestNormalizeFormula(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Lowercase cell refs",
			input:    "=a1+b2",
			expected: "=A1+B2",
		},
		{
			name:     "Mixed case",
			input:    "=A1+b2+C3",
			expected: "=A1+B2+C3",
		},
		{
			name:     "With spaces",
			input:    "= A1 + B2 ",
			expected: "=A1+B2",
		},
		{
			name:     "Function with lowercase",
			input:    "=sum(a1:a10)",
			expected: "=SUM(A1:A10)",
		},
		{
			name:     "Complex formula",
			input:    "= ( a1 + b2 ) * c3 ",
			expected: "=(A1+B2)*C3",
		},
		{
			name:     "String literals preserved",
			input:    "=CONCAT(\"hello\", \" \", \"world\")",
			expected: "=CONCAT(\"hello\",\" \",\"world\")",
		},
		{
			name:     "Already normalized",
			input:    "=A1+B2",
			expected: "=A1+B2",
		},
		{
			name:     "Chained comparison",
			input:    "=a1>b2",
			expected: "=A1>B2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := NormalizeFormula(tt.input)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestCellNormalizesFormulas(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Lowercase formula",
			input:    "=a1+b2",
			expected: "=A1+B2",
		},
		{
			name:     "Formula with spaces",
			input:    "= A1 + B2 ",
			expected: "=A1+B2",
		},
		{
			name:     "Non-formula unchanged",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "Number unchanged",
			input:    "42",
			expected: "42",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cell := NewCell(tt.input)

			if cell.RawValue() != tt.expected {
				t.Errorf("Expected cell.RawValue() %q, got %q", tt.expected, cell.RawValue())
			}
		})
	}
}

func TestSpreadsheetNormalizesFormulas(t *testing.T) {
	sheet := NewSpreadsheet()

	// Set a formula with lowercase and spaces
	sheet.SetCell(0, 0, "= a1 + b2 ")

	cell := sheet.GetCell(0, 0)
	if cell == nil {
		t.Fatal("Expected cell to exist")
	}

	expected := "=A1+B2"
	if cell.RawValue() != expected {
		t.Errorf("Expected normalized formula %q, got %q", expected, cell.RawValue())
	}

	if !cell.IsFormula {
		t.Error("Expected cell to be marked as formula")
	}
}
