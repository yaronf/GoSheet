package tests

import (
	"testing"

	"gosheet/model"
)

func TestExtractCellReferences(t *testing.T) {
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
			expected: []string{"A1", "A10"},
		},
		{
			name:     "Duplicate references",
			formula:  "=A1+A1*2",
			expected: []string{"A1"},
		},
		{
			name:     "Mixed case",
			formula:  "=a1+B2",
			expected: []string{"B2"}, // Regex matches uppercase letters followed by digits
		},
		{
			name:     "No references",
			formula:  "=5+3",
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			refs := model.ExtractCellReferences(tt.formula)
			
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

func TestExpandRange(t *testing.T) {
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells, err := model.ExpandRange(tt.rangeRef)

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

func TestDependencyGraphBasic(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestDependencyGraphMultiple(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestRemoveDependencies(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestCircularReferenceDetection(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestCircularReferenceDetectionLongerChain(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestNoCircularReferenceWhenNoCycle(t *testing.T) {
	dg := model.NewDependencyGraph()

	// Create: B1 depends on A1, C1 depends on A1 (no cycle)
	dg.AddDependency("B1", "A1")
	dg.AddDependency("C1", "A1")

	// Try to add: D1 depends on B1 (no cycle)
	hasCycle, _ := dg.DetectCircularReference("D1", "B1")

	if hasCycle {
		t.Errorf("Expected no circular reference, but one was detected")
	}
}

func TestCalculationOrder(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestCalculationOrderMultipleBranches(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestCalculationOrderWithCircularReference(t *testing.T) {
	dg := model.NewDependencyGraph()

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

func TestIntegrationWithSpreadsheet(t *testing.T) {
	sheet := model.NewSpreadsheet()

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
