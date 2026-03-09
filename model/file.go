package model

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"os"
	"path/filepath"

	"gosheet/logutil"
)

// FileHeader contains metadata about the saved spreadsheet file
type FileHeader struct {
	Version   string // File format version (e.g., "1.1")
	CellCount int    // Number of cells in the file
}

// atomicWriteFile writes content via writeContent to a temp file in the same
// directory as targetPath, then renames it atomically to targetPath.
// On POSIX systems (including macOS), os.Rename within the same filesystem is
// atomic, so a crash mid-write never leaves targetPath in a partial state.
func atomicWriteFile(targetPath string, writeContent func(f *os.File) error) error {
	dir := filepath.Dir(targetPath)
	tmp, err := os.CreateTemp(dir, ".gosheet-tmp-*")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpName := tmp.Name()

	// closeAndRemove closes the temp file (if still open) and removes it.
	// Used on all failure paths to avoid leaking file handles or temp files.
	closeAndRemove := func() {
		_ = tmp.Close()
		if removeErr := os.Remove(tmpName); removeErr != nil && !os.IsNotExist(removeErr) {
			logutil.Debugf("atomicWriteFile: failed to remove temp file %s: %v", tmpName, removeErr)
		}
	}

	if err := writeContent(tmp); err != nil {
		closeAndRemove()
		return err
	}
	if err := tmp.Sync(); err != nil {
		closeAndRemove()
		return fmt.Errorf("failed to sync temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		// Close failed; attempt removal (handle may or may not be valid).
		if removeErr := os.Remove(tmpName); removeErr != nil && !os.IsNotExist(removeErr) {
			logutil.Debugf("atomicWriteFile: failed to remove temp file %s after close error: %v", tmpName, removeErr)
		}
		return fmt.Errorf("failed to close temp file: %w", err)
	}
	if err := os.Rename(tmpName, targetPath); err != nil {
		if removeErr := os.Remove(tmpName); removeErr != nil && !os.IsNotExist(removeErr) {
			logutil.Debugf("atomicWriteFile: failed to remove temp file %s after rename error: %v", tmpName, removeErr)
		}
		return fmt.Errorf("failed to rename temp file to target: %w", err)
	}

	return nil
}

// encodeSpreadsheet writes header, cells, merges, and styles to enc in the
// canonical v1.2 order. Shared by SaveToFile and SaveToBytes.
func encodeSpreadsheet(enc *gob.Encoder, s *Spreadsheet, styles *StyleRegistry) error {
	header := FileHeader{
		Version:   "1.2",
		CellCount: s.GetCellCount(),
	}
	if err := enc.Encode(header); err != nil {
		return fmt.Errorf("failed to encode header: %w", err)
	}
	if err := enc.Encode(s.Cells); err != nil {
		return fmt.Errorf("failed to encode cells: %w", err)
	}
	if err := enc.Encode(s.Merges); err != nil {
		return fmt.Errorf("failed to encode merges: %w", err)
	}
	if err := enc.Encode(styles); err != nil {
		return fmt.Errorf("failed to encode styles: %w", err)
	}
	return nil
}

// SaveToFile saves the spreadsheet to a binary file using gob encoding.
// The write is performed atomically: content is written to a temp file in the
// same directory, then renamed to the target path, so a crash mid-write never
// corrupts an existing file.
func (s *Spreadsheet) SaveToFile(filePath string) error {
	styles := s.Styles
	if styles == nil {
		styles = NewStyleRegistry()
	}

	err := atomicWriteFile(filePath, func(f *os.File) error {
		return encodeSpreadsheet(gob.NewEncoder(f), s, styles)
	})
	if err != nil {
		return err
	}

	// Update spreadsheet metadata only after successful write.
	s.FilePath = filePath
	s.Modified = false
	return nil
}

// decodeSpreadsheet reads a spreadsheet from a gob decoder and returns a new Spreadsheet.
func decodeSpreadsheet(decoder *gob.Decoder, filePath string) (*Spreadsheet, error) {
	var header FileHeader
	if err := decoder.Decode(&header); err != nil {
		return nil, fmt.Errorf("failed to decode header: %w", err)
	}
	if header.Version != "1.1" && header.Version != "1.2" {
		return nil, fmt.Errorf("unsupported file version: %s", header.Version)
	}

	var cells map[int]map[int]*Cell
	if err := decoder.Decode(&cells); err != nil {
		return nil, fmt.Errorf("failed to decode cells: %w", err)
	}

	var merges []MergeRegion
	if err := decoder.Decode(&merges); err != nil {
		return nil, fmt.Errorf("failed to decode merges: %w", err)
	}

	var styles *StyleRegistry
	if header.Version == "1.2" {
		if err := decoder.Decode(&styles); err != nil {
			return nil, fmt.Errorf("failed to decode styles: %w", err)
		}
	}
	if styles == nil {
		styles = NewStyleRegistry()
	}

	return &Spreadsheet{
		Cells:        cells,
		Merges:       merges,
		Styles:       styles,
		Modified:     false,
		FilePath:     filePath,
		Dependencies: NewDependencyGraph(),
	}, nil
}

// LoadFromFile loads a spreadsheet from a binary file using gob decoding
func LoadFromFile(filePath string) (*Spreadsheet, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer func() { _ = file.Close() }()
	return decodeSpreadsheet(gob.NewDecoder(file), filePath)
}

// SaveAs saves the spreadsheet to a new file path
func (s *Spreadsheet) SaveAs(filePath string) error {
	return s.SaveToFile(filePath)
}

// HasUnsavedChanges returns true if the spreadsheet has been modified since last save
func (s *Spreadsheet) HasUnsavedChanges() bool {
	return s.Modified
}

// LoadFromBytes loads a spreadsheet from gob-encoded bytes.
// Used when reading via FileService.ReadFile (e.g., native Open dialog flow).
func LoadFromBytes(data []byte, filePath string) (*Spreadsheet, error) {
	return decodeSpreadsheet(gob.NewDecoder(bytes.NewReader(data)), filePath)
}

// SaveToBytes serializes the spreadsheet to gob-encoded bytes.
// Used when writing via FileService.WriteFile (e.g., native Save dialog flow).
func (s *Spreadsheet) SaveToBytes() ([]byte, error) {
	styles := s.Styles
	if styles == nil {
		styles = NewStyleRegistry()
	}
	var buf bytes.Buffer
	if err := encodeSpreadsheet(gob.NewEncoder(&buf), s, styles); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
