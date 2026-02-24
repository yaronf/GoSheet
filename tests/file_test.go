package tests

import (
	"os"
	"path/filepath"
	"testing"

	"gosheet/model"
)

func TestSaveAndLoadEmptySpreadsheet(t *testing.T) {
	// Create empty spreadsheet
	s := model.NewSpreadsheet()

	// Save to temp file
	tmpfile := filepath.Join(t.TempDir(), "empty.gosheet")
	err := s.SaveToFile(tmpfile)
	if err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Verify file exists
	if _, statErr := os.Stat(tmpfile); os.IsNotExist(statErr) {
		t.Fatal("File was not created")
	}

	// Load from file
	loaded, err := model.LoadFromFile(tmpfile)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	// Verify properties
	if loaded.GetCellCount() != 0 {
		t.Errorf("Expected 0 cells, got %d", loaded.GetCellCount())
	}
	if loaded.Modified {
		t.Error("Loaded spreadsheet should not be marked as modified")
	}
	if loaded.FilePath != tmpfile {
		t.Errorf("Expected FilePath %s, got %s", tmpfile, loaded.FilePath)
	}
}

func TestSaveAndLoadWithData(t *testing.T) {
	// Create spreadsheet with data
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "Hello")
	s.SetCell(0, 1, "World")
	s.SetCell(1, 0, "42")
	s.SetCell(1, 1, "=A1+A2")
	s.SetCell(5, 10, "Distant cell")

	// Save to temp file
	tmpfile := filepath.Join(t.TempDir(), "data.gosheet")
	err := s.SaveToFile(tmpfile)
	if err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Verify Modified flag is cleared after save
	if s.Modified {
		t.Error("Spreadsheet should not be marked as modified after save")
	}

	// Load from file
	loaded, err := model.LoadFromFile(tmpfile)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	// Verify cell count
	if loaded.GetCellCount() != 5 {
		t.Errorf("Expected 5 cells, got %d", loaded.GetCellCount())
	}

	// Verify cell values
	tests := []struct {
		row, col int
		expected string
	}{
		{0, 0, "Hello"},
		{0, 1, "World"},
		{1, 0, "42"},
		{1, 1, "=A1+A2"},
		{5, 10, "Distant cell"},
	}

	for _, tt := range tests {
		cell := loaded.GetCell(tt.row, tt.col)
		if cell == nil {
			t.Errorf("Cell at (%d, %d) is nil", tt.row, tt.col)
			continue
		}
		if cell.Value != tt.expected {
			t.Errorf("Cell at (%d, %d): expected %q, got %q", tt.row, tt.col, tt.expected, cell.Value)
		}
	}
}

func TestSaveAndLoadFormulas(t *testing.T) {
	// Create spreadsheet with formulas
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "10")
	s.SetCell(0, 1, "20")
	s.SetCell(0, 2, "=A1+B1")
	s.SetCell(1, 0, "=SUM(A1:B1)")

	// Manually set computed values (normally done by formula engine)
	s.GetCell(0, 2).SetComputed("30")
	s.GetCell(1, 0).SetComputed("30")

	// Save to temp file
	tmpfile := filepath.Join(t.TempDir(), "formulas.gosheet")
	err := s.SaveToFile(tmpfile)
	if err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Load from file
	loaded, err := model.LoadFromFile(tmpfile)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	// Verify formula cells
	cell1 := loaded.GetCell(0, 2)
	if cell1 == nil || !cell1.IsFormula {
		t.Error("Cell C1 should be a formula")
	}
	if cell1.Value != "=A1+B1" {
		t.Errorf("Cell C1: expected formula '=A1+B1', got %q", cell1.Value)
	}
	if cell1.Computed != "30" {
		t.Errorf("Cell C1: expected computed value '30', got %q", cell1.Computed)
	}

	cell2 := loaded.GetCell(1, 0)
	if cell2 == nil || !cell2.IsFormula {
		t.Error("Cell A2 should be a formula")
	}
	if cell2.Value != "=SUM(A1:B1)" {
		t.Errorf("Cell A2: expected formula '=SUM(A1:B1)', got %q", cell2.Value)
	}
}

func TestSaveAsNewFile(t *testing.T) {
	// Create spreadsheet
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "Test")

	// Save to first file
	tmpfile1 := filepath.Join(t.TempDir(), "file1.gosheet")
	err := s.SaveToFile(tmpfile1)
	if err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Modify and save as new file
	s.SetCell(0, 1, "Modified")
	tmpfile2 := filepath.Join(t.TempDir(), "file2.gosheet")
	err = s.SaveAs(tmpfile2)
	if err != nil {
		t.Fatalf("SaveAs failed: %v", err)
	}

	// Verify FilePath updated
	if s.FilePath != tmpfile2 {
		t.Errorf("Expected FilePath %s, got %s", tmpfile2, s.FilePath)
	}

	// Load from second file and verify
	loaded, err := model.LoadFromFile(tmpfile2)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	if loaded.GetCellCount() != 2 {
		t.Errorf("Expected 2 cells, got %d", loaded.GetCellCount())
	}
}

func TestLoadNonExistentFile(t *testing.T) {
	_, err := model.LoadFromFile("/nonexistent/file.gosheet")
	if err == nil {
		t.Error("Expected error when loading non-existent file")
	}
}

func TestHasUnsavedChanges(t *testing.T) {
	s := model.NewSpreadsheet()

	// New spreadsheet should not have unsaved changes
	if s.HasUnsavedChanges() {
		t.Error("New spreadsheet should not have unsaved changes")
	}

	// After setting a cell, should have unsaved changes
	s.SetCell(0, 0, "Test")
	if !s.HasUnsavedChanges() {
		t.Error("Spreadsheet should have unsaved changes after SetCell")
	}

	// After saving, should not have unsaved changes
	tmpfile := filepath.Join(t.TempDir(), "test.gosheet")
	s.SaveToFile(tmpfile)
	if s.HasUnsavedChanges() {
		t.Error("Spreadsheet should not have unsaved changes after save")
	}

	// After modifying again, should have unsaved changes
	s.SetCell(0, 1, "Modified")
	if !s.HasUnsavedChanges() {
		t.Error("Spreadsheet should have unsaved changes after modification")
	}
}

func TestSparseStorageEfficiency(t *testing.T) {
	// Create spreadsheet with sparse data
	s := model.NewSpreadsheet()
	s.SetCell(0, 0, "A1")
	s.SetCell(100, 100, "Far away")
	s.SetCell(1000, 1000, "Very far")

	// Save to temp file
	tmpfile := filepath.Join(t.TempDir(), "sparse.gosheet")
	err := s.SaveToFile(tmpfile)
	if err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// Load and verify
	loaded, err := model.LoadFromFile(tmpfile)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	// Verify all cells are present
	if loaded.GetCellCount() != 3 {
		t.Errorf("Expected 3 cells, got %d", loaded.GetCellCount())
	}

	// Verify specific cells
	if cell := loaded.GetCell(0, 0); cell == nil || cell.Value != "A1" {
		t.Error("Cell A1 not loaded correctly")
	}
	if cell := loaded.GetCell(100, 100); cell == nil || cell.Value != "Far away" {
		t.Error("Cell at (100, 100) not loaded correctly")
	}
	if cell := loaded.GetCell(1000, 1000); cell == nil || cell.Value != "Very far" {
		t.Error("Cell at (1000, 1000) not loaded correctly")
	}

	// Verify bounds
	maxRow, maxCol := loaded.GetBounds()
	if maxRow != 1000 || maxCol != 1000 {
		t.Errorf("Expected bounds (1000, 1000), got (%d, %d)", maxRow, maxCol)
	}
}
