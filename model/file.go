package model

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/vmihailenco/msgpack/v5"
	"gosheet/logutil"
)

// File format version for MessagePack encoding.
const FileFormatVersion = "2.0"

// fileContentV2 is the MessagePack payload structure (v2.0).
type fileContentV2 struct {
	Version   string                       `msgpack:"version"`
	CellCount int                          `msgpack:"cell_count"`
	Cells     map[int]map[int]*cellPersist `msgpack:"cells"`
	Merges    []MergeRegion                `msgpack:"merges"`
	Styles    *StyleRegistry               `msgpack:"styles"`
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

// cellsToPersist converts Cell map to cellPersist map for encoding.
func cellsToPersist(cells map[int]map[int]*Cell) map[int]map[int]*cellPersist {
	if cells == nil {
		return nil
	}
	out := make(map[int]map[int]*cellPersist, len(cells))
	for row, rowMap := range cells {
		outRow := make(map[int]*cellPersist, len(rowMap))
		for col, c := range rowMap {
			if c != nil {
				outRow[col] = &cellPersist{
					Value:         c.Value,
					IsFormula:     c.IsFormula,
					IsQuotePrefix: c.IsQuotePrefix,
					IsError:       c.IsError,
					StyleId:       c.StyleId,
					Alignment:     c.Alignment,
					InvalidRefs:   c.InvalidRefs,
				}
			}
		}
		out[row] = outRow
	}
	return out
}

// cellsFromPersist converts cellPersist map to Cell map after decoding.
func cellsFromPersist(p map[int]map[int]*cellPersist) map[int]map[int]*Cell {
	if p == nil {
		return nil
	}
	out := make(map[int]map[int]*Cell, len(p))
	for row, rowMap := range p {
		outRow := make(map[int]*Cell, len(rowMap))
		for col, cp := range rowMap {
			if cp != nil {
				computed := ""
				if cp.IsQuotePrefix && len(cp.Value) > 0 {
					computed = cp.Value[1:] // strip leading quote
				} else if !cp.IsFormula {
					computed = cp.Value // plain cells: computed = value
				}
				// Formula cells: computed left empty; RecalculateAll sets it
				outRow[col] = &Cell{
					Value:         cp.Value,
					Computed:      computed,
					IsFormula:     cp.IsFormula,
					IsQuotePrefix: cp.IsQuotePrefix,
					IsError:       cp.IsError,
					StyleId:       cp.StyleId,
					Alignment:     cp.Alignment,
					InvalidRefs:   cp.InvalidRefs,
					ParsedFormula: nil, // rebuilt on load
				}
			}
		}
		out[row] = outRow
	}
	return out
}

// encodeSpreadsheet writes the spreadsheet to w using MessagePack (v2.0).
func encodeSpreadsheet(w io.Writer, s *Spreadsheet, styles *StyleRegistry) error {
	content := fileContentV2{
		Version:   FileFormatVersion,
		CellCount: s.GetCellCount(),
		Cells:     cellsToPersist(s.Cells),
		Merges:    s.Merges,
		Styles:    styles,
	}
	enc := msgpack.NewEncoder(w)
	enc.SetSortMapKeys(true) // deterministic output for tests
	if err := enc.Encode(&content); err != nil {
		return fmt.Errorf("failed to encode spreadsheet: %w", err)
	}
	return nil
}

// decodeSpreadsheet reads a spreadsheet from r (MessagePack v2.0).
func decodeSpreadsheet(r io.Reader, filePath string) (*Spreadsheet, error) {
	dec := msgpack.NewDecoder(r)
	var content fileContentV2
	if err := dec.Decode(&content); err != nil {
		return nil, fmt.Errorf("failed to decode spreadsheet: %w", err)
	}
	if content.Version != FileFormatVersion {
		return nil, fmt.Errorf("unsupported file version: %s", content.Version)
	}
	cells := cellsFromPersist(content.Cells)
	if content.Styles == nil {
		content.Styles = NewStyleRegistry()
	}
	return &Spreadsheet{
		Cells:        cells,
		Merges:       content.Merges,
		Styles:       content.Styles,
		Modified:     false,
		FilePath:     filePath,
		Dependencies: NewDependencyGraph(),
	}, nil
}

// SaveToFile saves the spreadsheet to a binary file using MessagePack encoding.
// The write is performed atomically: content is written to a temp file in the
// same directory, then renamed to the target path, so a crash mid-write never
// corrupts an existing file.
func (s *Spreadsheet) SaveToFile(filePath string) error {
	styles := s.Styles
	if styles == nil {
		styles = NewStyleRegistry()
	}

	err := atomicWriteFile(filePath, func(f *os.File) error {
		return encodeSpreadsheet(f, s, styles)
	})
	if err != nil {
		return err
	}

	// Update spreadsheet metadata only after successful write.
	s.FilePath = filePath
	s.Modified = false
	return nil
}

// LoadFromFile loads a spreadsheet from a binary file using MessagePack decoding.
func LoadFromFile(filePath string) (*Spreadsheet, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer func() { _ = file.Close() }()
	return decodeSpreadsheet(file, filePath)
}

// SaveAs saves the spreadsheet to a new file path
func (s *Spreadsheet) SaveAs(filePath string) error {
	return s.SaveToFile(filePath)
}

// HasUnsavedChanges returns true if the spreadsheet has been modified since last save
func (s *Spreadsheet) HasUnsavedChanges() bool {
	return s.Modified
}

// LoadFromBytes loads a spreadsheet from MessagePack-encoded bytes.
// Used when reading via FileService.ReadFile (e.g., native Open dialog flow).
func LoadFromBytes(data []byte, filePath string) (*Spreadsheet, error) {
	return decodeSpreadsheet(bytes.NewReader(data), filePath)
}

// SaveToBytes serializes the spreadsheet to MessagePack-encoded bytes.
// Used when writing via FileService.WriteFile (e.g., native Save dialog flow).
func (s *Spreadsheet) SaveToBytes() ([]byte, error) {
	styles := s.Styles
	if styles == nil {
		styles = NewStyleRegistry()
	}
	var buf bytes.Buffer
	if err := encodeSpreadsheet(&buf, s, styles); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
