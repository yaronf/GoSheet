package model

import (
	"bytes"
	"encoding/gob"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSaveAndLoadEmptySpreadsheet(t *testing.T) {
	// Create empty spreadsheet
	s := NewSpreadsheet()

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
	loaded, err := LoadFromFile(tmpfile)
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
	s := NewSpreadsheet()
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
	loaded, err := LoadFromFile(tmpfile)
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
		if cell.RawValue() != tt.expected {
			t.Errorf("Cell at (%d, %d): expected %q, got %q", tt.row, tt.col, tt.expected, cell.RawValue())
		}
	}
}

func TestSaveAndLoadFormulas(t *testing.T) {
	// Create spreadsheet with formulas
	s := NewSpreadsheet()
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
	loaded, err := LoadFromFile(tmpfile)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	// Verify formula cells
	cell1 := loaded.GetCell(0, 2)
	if cell1 == nil || !cell1.IsFormula {
		t.Error("Cell C1 should be a formula")
	}
	if cell1.RawValue() != "=A1+B1" {
		t.Errorf("Cell C1: expected formula '=A1+B1', got %q", cell1.RawValue())
	}
	if cell1.Computed != "30" {
		t.Errorf("Cell C1: expected computed value '30', got %q", cell1.Computed)
	}

	cell2 := loaded.GetCell(1, 0)
	if cell2 == nil || !cell2.IsFormula {
		t.Error("Cell A2 should be a formula")
	}
	if cell2.RawValue() != "=SUM(A1:B1)" {
		t.Errorf("Cell A2: expected formula '=SUM(A1:B1)', got %q", cell2.RawValue())
	}
}

func TestSaveAsNewFile(t *testing.T) {
	// Create spreadsheet
	s := NewSpreadsheet()
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
	loaded, err := LoadFromFile(tmpfile2)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	if loaded.GetCellCount() != 2 {
		t.Errorf("Expected 2 cells, got %d", loaded.GetCellCount())
	}
}

func TestLoadNonExistentFile(t *testing.T) {
	_, err := LoadFromFile("/nonexistent/file.gosheet")
	if err == nil {
		t.Error("Expected error when loading non-existent file")
	}
}

func TestSaveToFile_UnwritablePath(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "x")
	err := s.SaveToFile("/nonexistent/parent/dir/file.gosheet")
	if err == nil {
		t.Error("Expected error when saving to path with non-existent parent")
	}
}

func TestSaveToFile_InvalidPath(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "x")
	// Saving to directory path fails (e.g. "/" on Unix)
	err := s.SaveToFile("/")
	if err == nil {
		t.Error("Expected error when saving to invalid path")
	}
}

func TestLoadFromFile_InvalidGob(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "badgob.gosheet")
	if err := os.WriteFile(tmpfile, []byte("not valid gob content"), 0644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
	_, err := LoadFromFile(tmpfile)
	if err == nil {
		t.Error("Expected error when loading invalid gob file")
	}
}

func TestLoadFromFile_InvalidCellsGob(t *testing.T) {
	// Valid header but invalid cells structure (wrong type encoded)
	tmpfile := filepath.Join(t.TempDir(), "badcells.gosheet")
	f, err := os.Create(tmpfile)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	enc := gob.NewEncoder(f)
	_ = enc.Encode(FileHeader{Version: "1.1", CellCount: 0})
	_ = enc.Encode("not a map") // Wrong type - should be map[int]map[int]*Cell
	_ = f.Close()

	_, err = LoadFromFile(tmpfile)
	if err == nil {
		t.Error("Expected error when loading file with invalid cells structure")
	}
}

func TestLoadFromFile_InvalidVersion(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "badversion.gosheet")
	f, err := os.Create(tmpfile)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	enc := gob.NewEncoder(f)
	if encErr := enc.Encode(FileHeader{Version: "2.0", CellCount: 0}); encErr != nil {
		t.Fatalf("Encode header failed: %v", encErr)
	}
	if encErr := enc.Encode(map[int]map[int]*Cell{}); encErr != nil {
		t.Fatalf("Encode cells failed: %v", encErr)
	}
	require.NoError(t, f.Close())

	_, err = LoadFromFile(tmpfile)
	if err == nil {
		t.Error("Expected error when loading file with unsupported version")
	}
	if err != nil && !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("Expected 'unsupported' in error, got: %v", err)
	}
}

func TestHasUnsavedChanges(t *testing.T) {
	s := NewSpreadsheet()

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
	_ = s.SaveToFile(tmpfile)
	if s.HasUnsavedChanges() {
		t.Error("Spreadsheet should not have unsaved changes after save")
	}

	// After modifying again, should have unsaved changes
	s.SetCell(0, 1, "Modified")
	if !s.HasUnsavedChanges() {
		t.Error("Spreadsheet should have unsaved changes after modification")
	}
}

func TestLoadFromBytesAndSaveToBytes(t *testing.T) {
	// Create spreadsheet with data
	s := NewSpreadsheet()
	s.SetCell(0, 0, "Hello")
	s.SetCell(0, 1, "42")
	s.SetCell(1, 0, "=A1+A2")

	// Save to bytes
	data, err := s.SaveToBytes()
	if err != nil {
		t.Fatalf("SaveToBytes failed: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("SaveToBytes returned empty data")
	}

	// Load from bytes
	loaded, err := LoadFromBytes(data, "/test/path.sheet")
	if err != nil {
		t.Fatalf("LoadFromBytes failed: %v", err)
	}

	// Verify loaded data
	if loaded.GetCellCount() != 3 {
		t.Errorf("Expected 3 cells, got %d", loaded.GetCellCount())
	}
	if loaded.FilePath != "/test/path.sheet" {
		t.Errorf("Expected FilePath /test/path.sheet, got %s", loaded.FilePath)
	}
	cell := loaded.GetCell(0, 0)
	if cell == nil || cell.Value != "Hello" {
		t.Error("Cell A1 not loaded correctly")
	}
}

func TestLoadFromBytesInvalidVersion(t *testing.T) {
	// Create valid gob data with wrong version by manually constructing
	s := NewSpreadsheet()
	s.SetCell(0, 0, "x")
	data, _ := s.SaveToBytes()

	// Empty bytes
	_, err := LoadFromBytes([]byte{}, "/x.sheet")
	if err == nil {
		t.Error("Expected error when loading empty bytes")
	}

	// Truncated data (invalid gob)
	_, err = LoadFromBytes(data[:10], "/x.sheet")
	if err == nil {
		t.Error("Expected error when loading truncated bytes")
	}

	// Valid gob structure but wrong version (v1.1 required)
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	_ = enc.Encode(FileHeader{Version: "2.0", CellCount: 0})
	_ = enc.Encode(map[int]map[int]*Cell{})
	_ = enc.Encode([]MergeRegion{})
	_, err = LoadFromBytes(buf.Bytes(), "/x.sheet")
	if err == nil {
		t.Error("Expected error when loading bytes with unsupported version")
	}
	if err != nil && !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("Expected 'unsupported' in error, got: %v", err)
	}
}

func TestSaveAndLoadWithMergeRegions(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "Header")
	s.SetCell(0, 1, "A")
	s.SetCell(0, 2, "B")
	s.Merges = []MergeRegion{
		{StartRow: 0, StartCol: 0, RowSpan: 1, ColSpan: 3}, // A1:C1 merged
	}

	data, err := s.SaveToBytes()
	if err != nil {
		t.Fatalf("SaveToBytes failed: %v", err)
	}

	loaded, err := LoadFromBytes(data, "/test/merge.sheet")
	if err != nil {
		t.Fatalf("LoadFromBytes failed: %v", err)
	}

	if len(loaded.Merges) != 1 {
		t.Fatalf("Expected 1 merge region, got %d", len(loaded.Merges))
	}
	m := loaded.Merges[0]
	if m.StartRow != 0 || m.StartCol != 0 || m.RowSpan != 1 || m.ColSpan != 3 {
		t.Errorf("Expected merge A1:C1, got StartRow=%d StartCol=%d RowSpan=%d ColSpan=%d",
			m.StartRow, m.StartCol, m.RowSpan, m.ColSpan)
	}
	if loaded.GetCell(0, 0).Value != "Header" {
		t.Errorf("Expected anchor value 'Header', got %q", loaded.GetCell(0, 0).Value)
	}
}

func TestSaveAndLoadWithStyles(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "Title")
	s.SetCell(0, 1, "Header")
	s.SetCell(1, 0, "Total")
	_ = s.ApplyStyleToCell(0, 0, StyleIDTitle)
	_ = s.ApplyStyleToCell(0, 1, StyleIDHeader)
	_ = s.ApplyStyleToCell(1, 0, StyleIDTotal)

	data, err := s.SaveToBytes()
	if err != nil {
		t.Fatalf("SaveToBytes failed: %v", err)
	}

	loaded, err := LoadFromBytes(data, "/test/styles.sheet")
	if err != nil {
		t.Fatalf("LoadFromBytes failed: %v", err)
	}

	if loaded.GetCell(0, 0).StyleId != StyleIDTitle {
		t.Errorf("Cell (0,0) expected StyleId %d, got %d", StyleIDTitle, loaded.GetCell(0, 0).StyleId)
	}
	if loaded.GetCell(0, 1).StyleId != StyleIDHeader {
		t.Errorf("Cell (0,1) expected StyleId %d, got %d", StyleIDHeader, loaded.GetCell(0, 1).StyleId)
	}
	if loaded.GetCell(1, 0).StyleId != StyleIDTotal {
		t.Errorf("Cell (1,0) expected StyleId %d, got %d", StyleIDTotal, loaded.GetCell(1, 0).StyleId)
	}
	if loaded.Styles == nil {
		t.Error("Loaded spreadsheet should have Styles registry")
	}
}

func TestLoadFromBytes_V1_1BackwardCompat(t *testing.T) {
	// Manually create v1.1 format (header + cells + merges, no styles)
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	require.NoError(t, enc.Encode(FileHeader{Version: "1.1", CellCount: 2}))
	cells := map[int]map[int]*Cell{
		0: {0: {Value: "A", Computed: "A", IsFormula: false, StyleId: 0}},
		1: {0: {Value: "B", Computed: "B", IsFormula: false, StyleId: 0}},
	}
	require.NoError(t, enc.Encode(cells))
	require.NoError(t, enc.Encode([]MergeRegion{}))

	loaded, err := LoadFromBytes(buf.Bytes(), "/test/v11.sheet")
	if err != nil {
		t.Fatalf("LoadFromBytes v1.1 failed: %v", err)
	}
	if loaded.GetCellCount() != 2 {
		t.Errorf("Expected 2 cells, got %d", loaded.GetCellCount())
	}
	if loaded.GetCell(0, 0).StyleId != 0 {
		t.Errorf("v1.1 cell should have StyleId 0, got %d", loaded.GetCell(0, 0).StyleId)
	}
	if loaded.Styles == nil {
		t.Error("Loaded v1.1 should have default Styles registry")
	}
}

func TestAtomicWrite_SuccessLeavesNoTempFile(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "test.gosheet")

	s := NewSpreadsheet()
	s.SetCell(0, 0, "hello")
	if err := s.SaveToFile(target); err != nil {
		t.Fatalf("SaveToFile failed: %v", err)
	}

	// No .gosheet-tmp-* files should remain
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir failed: %v", err)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".gosheet-tmp-") {
			t.Errorf("Temp file left behind after successful save: %s", e.Name())
		}
	}

	// Target file must exist and be loadable
	loaded, err := LoadFromFile(target)
	if err != nil {
		t.Fatalf("LoadFromFile after atomic write failed: %v", err)
	}
	cell := loaded.GetCell(0, 0)
	if cell == nil || cell.Value != "hello" {
		t.Errorf("Expected cell value 'hello', got %v", cell)
	}
}

func TestAtomicWrite_FailurePreservesOriginal(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "original.gosheet")

	// Write original content
	s1 := NewSpreadsheet()
	s1.SetCell(0, 0, "original")
	if err := s1.SaveToFile(target); err != nil {
		t.Fatalf("initial SaveToFile failed: %v", err)
	}

	// Attempt save to a path whose parent directory doesn't exist.
	// This fails at os.CreateTemp (pre-write), so the original is never touched.
	// Note: this exercises the pre-write failure path; a mid-write crash cannot
	// be reliably simulated in a unit test.
	badTarget := filepath.Join(dir, "nonexistent", "file.gosheet")
	s2 := NewSpreadsheet()
	s2.SetCell(0, 0, "overwrite")
	err := s2.SaveToFile(badTarget)
	if err == nil {
		t.Fatal("Expected error saving to non-existent directory, got nil")
	}

	// Original file must still be intact
	loaded, err := LoadFromFile(target)
	if err != nil {
		t.Fatalf("Original file corrupted or missing: %v", err)
	}
	cell := loaded.GetCell(0, 0)
	if cell == nil || cell.Value != "original" {
		t.Errorf("Original content lost; expected 'original', got %v", cell)
	}
}

func TestAtomicWrite_OverwriteExistingFile(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "data.gosheet")

	// Write initial content
	s1 := NewSpreadsheet()
	s1.SetCell(0, 0, "v1")
	if err := s1.SaveToFile(target); err != nil {
		t.Fatalf("initial SaveToFile failed: %v", err)
	}

	// Overwrite with new content
	s2 := NewSpreadsheet()
	s2.SetCell(0, 0, "v2")
	s2.SetCell(1, 0, "extra")
	if err := s2.SaveToFile(target); err != nil {
		t.Fatalf("overwrite SaveToFile failed: %v", err)
	}

	// Verify new content is present and old content is gone
	loaded, err := LoadFromFile(target)
	if err != nil {
		t.Fatalf("LoadFromFile after overwrite failed: %v", err)
	}
	if loaded.GetCellCount() != 2 {
		t.Errorf("Expected 2 cells after overwrite, got %d", loaded.GetCellCount())
	}
	cell := loaded.GetCell(0, 0)
	if cell == nil || cell.Value != "v2" {
		t.Errorf("Expected 'v2' after overwrite, got %v", cell)
	}

	// No temp files left behind
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir failed: %v", err)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".gosheet-tmp-") {
			t.Errorf("Temp file left behind after overwrite: %s", e.Name())
		}
	}
}

func TestSparseStorageEfficiency(t *testing.T) {
	// Create spreadsheet with sparse data
	s := NewSpreadsheet()
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
	loaded, err := LoadFromFile(tmpfile)
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

func TestSaveToBytes_RoundTrip(t *testing.T) {
	s := NewSpreadsheet()
	s.SetCell(0, 0, "hello")
	s.SetCell(1, 1, "world")

	data, err := s.SaveToBytes()
	require.NoError(t, err)
	require.NotEmpty(t, data)

	loaded, err := LoadFromBytes(data, "/fake/path.gosheet")
	require.NoError(t, err)
	if loaded.GetCell(0, 0) == nil || loaded.GetCell(0, 0).Value != "hello" {
		t.Error("cell A1 not restored")
	}
	if loaded.GetCell(1, 1) == nil || loaded.GetCell(1, 1).Value != "world" {
		t.Error("cell B2 not restored")
	}
}

func TestSaveToBytes_NilStyles(t *testing.T) {
	s := NewSpreadsheet()
	s.Styles = nil
	data, err := s.SaveToBytes()
	require.NoError(t, err)
	require.NotEmpty(t, data)
}

func TestAtomicWriteFile_WriteContentError(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "out.gosheet")
	writeErr := os.ErrInvalid
	err := atomicWriteFile(target, func(_ *os.File) error {
		return writeErr
	})
	if err == nil {
		t.Fatal("expected error from writeContent, got nil")
	}
	// Target should not have been created
	if _, statErr := os.Stat(target); !os.IsNotExist(statErr) {
		t.Error("target file should not exist after write failure")
	}
}

func TestAtomicWriteFile_BadTargetDir(t *testing.T) {
	// Non-existent directory → CreateTemp should fail
	err := atomicWriteFile("/nonexistent/dir/file.gosheet", func(_ *os.File) error {
		return nil
	})
	if err == nil {
		t.Fatal("expected error for non-existent directory")
	}
}

func TestEncodeSpreadsheet_CorruptedDecode(t *testing.T) {
	// Trying to decode garbage bytes should fail gracefully
	_, err := decodeSpreadsheet(gob.NewDecoder(bytes.NewReader([]byte("not-gob"))), "/fake.gosheet")
	if err == nil {
		t.Fatal("expected error decoding garbage gob data")
	}
}

func TestSaveToFile_InvalidPath_AtomicError(t *testing.T) {
	s := NewSpreadsheet()
	err := s.SaveToFile("/nonexistent/dir/file.gosheet")
	if err == nil {
		t.Fatal("expected error saving to non-existent directory")
	}
	if !strings.Contains(err.Error(), "temp file") && !strings.Contains(err.Error(), "no such file") {
		t.Errorf("unexpected error: %v", err)
	}
}
