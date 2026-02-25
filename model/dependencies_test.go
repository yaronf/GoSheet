package model

import (
	"testing"
)

func TestDependencyGraph_ExtractCellReferences(t *testing.T) {
	tests := []struct {
		name     string
		formula  string
		expected []string
	}{
		{
			name:     "Simple reference",
			formula:  "=A1",
			expected: []string{"A1"},
		},
		{
			name:     "Multiple references",
			formula:  "=A1+B2+C3",
			expected: []string{"A1", "B2", "C3"},
		},
		{
			name:     "Function with references",
			formula:  "=SUM(A1:A10)",
			expected: []string{"A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"}, // Range is expanded
		},
		{
			name:     "Duplicate references",
			formula:  "=A1+A1*2",
			expected: []string{"A1"},
		},
		{
			name:     "Mixed case",
			formula:  "=a1+B2",
			expected: []string{"A1", "B2"}, // AST parser normalizes lowercase to uppercase
		},
		{
			name:     "No references",
			formula:  "=5+3",
			expected: []string{},
		},
		{
			name:     "Unary minus",
			formula:  "=-A1+B2",
			expected: []string{"A1", "B2"},
		},
		{
			name:     "Comparison",
			formula:  "=A1>B2",
			expected: []string{"A1", "B2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			refs := ExtractCellReferences(tt.formula)

			if len(refs) != len(tt.expected) {
				t.Errorf("Expected %d references, got %d: %v", len(tt.expected), len(refs), refs)
				return
			}

			// Check that all expected refs are present
			refMap := make(map[string]bool)
			for _, ref := range refs {
				refMap[ref] = true
			}

			for _, exp := range tt.expected {
				if !refMap[exp] {
					t.Errorf("Expected reference %s not found in %v", exp, refs)
				}
			}
		})
	}
}

func TestDependencyGraph_ExpandRange(t *testing.T) {
	tests := []struct {
		name     string
		rangeRef string
		expected []string
		wantErr  bool
	}{
		{
			name:     "Simple 2x2 range",
			rangeRef: "A1:B2",
			expected: []string{"A1", "A2", "B1", "B2"},
			wantErr:  false,
		},
		{
			name:     "Single column range",
			rangeRef: "A1:A3",
			expected: []string{"A1", "A2", "A3"},
			wantErr:  false,
		},
		{
			name:     "Single row range",
			rangeRef: "A1:C1",
			expected: []string{"A1", "B1", "C1"},
			wantErr:  false,
		},
		{
			name:     "Reversed range (should normalize)",
			rangeRef: "B2:A1",
			expected: []string{"A1", "A2", "B1", "B2"},
			wantErr:  false,
		},
		{
			name:     "Invalid range format",
			rangeRef: "A1",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Invalid start reference",
			rangeRef: "A0:B1",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Invalid end reference",
			rangeRef: "A1:invalid",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Invalid range - single part",
			rangeRef: "A1:B1:C1",
			expected: nil,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells, err := ExpandRange(tt.rangeRef)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if len(cells) != len(tt.expected) {
				t.Errorf("Expected %d cells, got %d: %v", len(tt.expected), len(cells), cells)
				return
			}

			// Check all expected cells are present
			cellMap := make(map[string]bool)
			for _, cell := range cells {
				cellMap[cell] = true
			}

			for _, exp := range tt.expected {
				if !cellMap[exp] {
					t.Errorf("Expected cell %s not found in %v", exp, cells)
				}
			}
		})
	}
}

func TestDependencyGraph_Basic(t *testing.T) {
	dg := NewDependencyGraph()

	// Add dependency: B1 depends on A1
	dg.AddDependency("B1", "A1")

	// Check dependencies
	deps := dg.GetDependencies("B1")
	if len(deps) != 1 || deps[0] != "A1" {
		t.Errorf("Expected B1 to depend on A1, got %v", deps)
	}

	// Check dependents
	dependents := dg.GetDependents("A1")
	if len(dependents) != 1 || dependents[0] != "B1" {
		t.Errorf("Expected A1 to have B1 as dependent, got %v", dependents)
	}
}

func TestDependencyGraph_Multiple(t *testing.T) {
	dg := NewDependencyGraph()

	// Create chain: C1 depends on B1, B1 depends on A1
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "B1")

	// A1 should have B1 as direct dependent
	dependents := dg.GetDependents("A1")
	if len(dependents) != 1 || dependents[0] != "B1" {
		t.Errorf("Expected A1 to have B1 as dependent, got %v", dependents)
	}

	// B1 should have C1 as dependent
	dependents = dg.GetDependents("B1")
	if len(dependents) != 1 || dependents[0] != "C1" {
		t.Errorf("Expected B1 to have C1 as dependent, got %v", dependents)
	}
}

func TestDependencyGraph_RemoveDependencies(t *testing.T) {
	dg := NewDependencyGraph()

	// Add dependencies
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "A1")

	// Remove B1's dependencies
	dg.RemoveDependencies("B1")

	// B1 should have no dependencies
	deps := dg.GetDependencies("B1")
	if len(deps) != 0 {
		t.Errorf("Expected B1 to have no dependencies after removal, got %v", deps)
	}

	// A1 should still have C1 as dependent, but not B1
	dependents := dg.GetDependents("A1")
	if len(dependents) != 1 || dependents[0] != "C1" {
		t.Errorf("Expected A1 to have only C1 as dependent, got %v", dependents)
	}
}

func TestDependencyGraph_CircularReferenceDetection(t *testing.T) {
	dg := NewDependencyGraph()

	// Create: B1 depends on A1
	dg.AddDependency("B1", "A1")

	// Try to add: A1 depends on B1 (would create cycle)
	hasCycle, path := dg.DetectCircularReference("A1", "B1")

	if !hasCycle {
		t.Errorf("Expected circular reference to be detected")
	}

	if len(path) < 2 {
		t.Errorf("Expected cycle path with at least 2 nodes, got %v", path)
	}

	// Verify path contains both A1 and B1
	hasA1, hasB1 := false, false
	for _, cell := range path {
		if cell == "A1" {
			hasA1 = true
		}
		if cell == "B1" {
			hasB1 = true
		}
	}

	if !hasA1 || !hasB1 {
		t.Errorf("Expected cycle path to contain both A1 and B1, got %v", path)
	}
}

func TestDependencyGraph_CircularReferenceLongerChain(t *testing.T) {
	dg := NewDependencyGraph()

	// Create chain: C1 → B1 → A1
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "B1")

	// Try to add: A1 → C1 (would create cycle A1 → C1 → B1 → A1)
	hasCycle, path := dg.DetectCircularReference("A1", "C1")

	if !hasCycle {
		t.Errorf("Expected circular reference to be detected in longer chain")
	}

	t.Logf("Detected cycle path: %v", path)
}

func TestDependencyGraph_NoCircularReferenceWhenNoCycle(t *testing.T) {
	dg := NewDependencyGraph()

	// Create: B1 depends on A1, C1 depends on A1 (no cycle)
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "A1")

	// Try to add: D1 depends on B1 (no cycle)
	hasCycle, _ := dg.DetectCircularReference("D1", "B1")

	if hasCycle {
		t.Errorf("Expected no circular reference, but one was detected")
	}
}

func TestDependencyGraph_CalculationOrder(t *testing.T) {
	dg := NewDependencyGraph()

	// Create dependencies: C1 → B1 → A1
	// When A1 changes, we should calculate B1 then C1
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "B1")

	order, err := dg.GetCalculationOrder([]string{"A1"})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Order should include A1, B1, C1 (changed cell plus its dependents)
	if len(order) != 3 {
		t.Errorf("Expected 3 cells in order, got %d: %v", len(order), order)
	}

	// B1 should come before C1
	b1Idx, c1Idx := -1, -1
	for i, cell := range order {
		if cell == "B1" {
			b1Idx = i
		}
		if cell == "C1" {
			c1Idx = i
		}
	}

	if b1Idx == -1 || c1Idx == -1 {
		t.Errorf("Expected both B1 and C1 in order, got %v", order)
	}

	if b1Idx >= c1Idx {
		t.Errorf("Expected B1 before C1 in calculation order, got %v", order)
	}
}

func TestDependencyGraph_CalculationOrderMultipleBranches(t *testing.T) {
	dg := NewDependencyGraph()

	// Create diamond dependency:
	//     A1
	//    /  \
	//   B1  C1
	//    \  /
	//     D1
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "A1")
	dg.AddDependency("D1", "B1")
	dg.AddDependency("D1", "C1")

	order, err := dg.GetCalculationOrder([]string{"A1"})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Should have 4 cells: A1, B1, C1, D1 (changed cell plus all dependents)
	if len(order) != 4 {
		t.Errorf("Expected 4 cells in order, got %d: %v", len(order), order)
	}

	// D1 must come after both B1 and C1
	positions := make(map[string]int)
	for i, cell := range order {
		positions[cell] = i
	}

	if positions["D1"] <= positions["B1"] || positions["D1"] <= positions["C1"] {
		t.Errorf("Expected D1 after both B1 and C1, got order %v", order)
	}
}

func TestDependencyGraph_CalculationOrderWithCircularReference(t *testing.T) {
	dg := NewDependencyGraph()

	// Create circular dependency: B1 → A1 → B1
	dg.AddDependency("B1", "A1")
	dg.AddDependency("A1", "B1")

	_, err := dg.GetCalculationOrder([]string{"A1"})
	if err == nil {
		t.Errorf("Expected error for circular reference, got none")
	}

	if err != nil {
		t.Logf("Got expected error: %v", err)
	}
}

// TestExtractCellReferences_EmptyFormula tests formula that may produce minimal AST
func TestExtractCellReferences_EmptyFormula(t *testing.T) {
	refs := ExtractCellReferences("=1")
	if len(refs) != 0 {
		t.Errorf("Expected no refs for =1, got %v", refs)
	}
}

// TestExtractCellReferences_RegexFallback tests that malformed formulas still extract refs via regex fallback
func TestExtractCellReferences_RegexFallback(t *testing.T) {
	// Formula that may fail AST parse but has cell refs - triggers regex fallback
	refs := ExtractCellReferences("=A1+B2+")
	// Regex fallback should still find A1 and B2
	if len(refs) < 2 {
		t.Errorf("Expected at least 2 refs from regex fallback, got %v", refs)
	}
	refMap := make(map[string]bool)
	for _, r := range refs {
		refMap[r] = true
	}
	if !refMap["A1"] || !refMap["B2"] {
		t.Errorf("Expected A1 and B2 in refs, got %v", refs)
	}
}

// TestExtractCellReferences_RangeExpandError tests that invalid ranges in formulas skip the bad range
func TestExtractCellReferences_RangeExpandError(t *testing.T) {
	// A1:B0 has invalid end ref (row 0); ExpandRange fails, we skip that range
	// AST still parses and walkPrimary hits the err != nil branch and skips
	refs := ExtractCellReferences("=SUM(A1:B0)+C1")
	// Should get C1; A1:B0 fails to expand so we may get A1 from the range start or nothing
	// The actual behavior: range "A1:B0" - RefToCoords("B0") fails (row must be >= 1)
	// So we skip the range expansion. We get refs from C1. The range A1:B0 doesn't add refs.
	if len(refs) < 1 {
		t.Errorf("Expected at least 1 ref, got %v", refs)
	}
	refMap := make(map[string]bool)
	for _, r := range refs {
		refMap[r] = true
	}
	if !refMap["C1"] {
		t.Errorf("Expected C1 in refs, got %v", refs)
	}
}

func TestDependencyGraph_IntegrationWithSpreadsheet(t *testing.T) {
	sheet := NewSpreadsheet()

	// Verify dependency graph is initialized
	if sheet.Dependencies == nil {
		t.Fatal("Expected Dependencies to be initialized")
	}

	// Add a formula cell
	sheet.SetCell(1, 0, "=A1*2") // B1 = A1*2

	// Manually add dependency (normally done by controller)
	sheet.Dependencies.AddDependency("B1", "A1")

	// Check dependency was recorded
	deps := sheet.Dependencies.GetDependencies("B1")
	if len(deps) != 1 || deps[0] != "A1" {
		t.Errorf("Expected B1 to depend on A1, got %v", deps)
	}
}
