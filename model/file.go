package model

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"os"
)

// FileHeader contains metadata about the saved spreadsheet file
type FileHeader struct {
	Version   string // File format version (e.g., "1.0")
	CellCount int    // Number of cells in the file
}

// SaveToFile saves the spreadsheet to a binary file using gob encoding
func (s *Spreadsheet) SaveToFile(filepath string) error {
	// Create the file
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// Create gob encoder
	encoder := gob.NewEncoder(file)

	// Write file header
	header := FileHeader{
		Version:   "1.0",
		CellCount: s.GetCellCount(),
	}
	if err := encoder.Encode(header); err != nil {
		return fmt.Errorf("failed to encode header: %w", err)
	}

	// Write the cells map
	if err := encoder.Encode(s.Cells); err != nil {
		return fmt.Errorf("failed to encode cells: %w", err)
	}

	// Update spreadsheet metadata
	s.FilePath = filepath
	s.Modified = false

	return nil
}

// LoadFromFile loads a spreadsheet from a binary file using gob decoding
func LoadFromFile(filepath string) (*Spreadsheet, error) {
	// Open the file
	file, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Create gob decoder
	decoder := gob.NewDecoder(file)

	// Read file header
	var header FileHeader
	if err := decoder.Decode(&header); err != nil {
		return nil, fmt.Errorf("failed to decode header: %w", err)
	}

	// Validate version
	if header.Version != "1.0" {
		return nil, fmt.Errorf("unsupported file version: %s", header.Version)
	}

	// Read the cells map
	var cells map[int]map[int]*Cell
	if err := decoder.Decode(&cells); err != nil {
		return nil, fmt.Errorf("failed to decode cells: %w", err)
	}

	// Create spreadsheet
	spreadsheet := &Spreadsheet{
		Cells:    cells,
		Modified: false,
		FilePath: filepath,
	}

	return spreadsheet, nil
}

// SaveAs saves the spreadsheet to a new file path
func (s *Spreadsheet) SaveAs(filepath string) error {
	return s.SaveToFile(filepath)
}

// HasUnsavedChanges returns true if the spreadsheet has been modified since last save
func (s *Spreadsheet) HasUnsavedChanges() bool {
	return s.Modified
}

// LoadFromBytes loads a spreadsheet from gob-encoded bytes.
// Used when reading via FileService.ReadFile (e.g., native Open dialog flow).
func LoadFromBytes(data []byte, filepath string) (*Spreadsheet, error) {
	decoder := gob.NewDecoder(bytes.NewReader(data))

	var header FileHeader
	if err := decoder.Decode(&header); err != nil {
		return nil, fmt.Errorf("failed to decode header: %w", err)
	}

	if header.Version != "1.0" {
		return nil, fmt.Errorf("unsupported file version: %s", header.Version)
	}

	var cells map[int]map[int]*Cell
	if err := decoder.Decode(&cells); err != nil {
		return nil, fmt.Errorf("failed to decode cells: %w", err)
	}

	return &Spreadsheet{
		Cells:        cells,
		Modified:     false,
		FilePath:     filepath,
		Dependencies: NewDependencyGraph(),
	}, nil
}

// SaveToBytes serializes the spreadsheet to gob-encoded bytes.
// Used when writing via FileService.WriteFile (e.g., native Save dialog flow).
func (s *Spreadsheet) SaveToBytes() ([]byte, error) {
	var buf bytes.Buffer
	encoder := gob.NewEncoder(&buf)

	header := FileHeader{
		Version:   "1.0",
		CellCount: s.GetCellCount(),
	}
	if err := encoder.Encode(header); err != nil {
		return nil, fmt.Errorf("failed to encode header: %w", err)
	}
	if err := encoder.Encode(s.Cells); err != nil {
		return nil, fmt.Errorf("failed to encode cells: %w", err)
	}

	return buf.Bytes(), nil
}
