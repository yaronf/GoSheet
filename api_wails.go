// Package main - WailsAPI implements api.SpreadsheetAPI for native mode.
// Wraps controller.AppController and exposes methods via Wails IPC binding.
package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"gosheet/api"
	"gosheet/controller"
	"gosheet/model"
)

// WailsAPI wraps controller.AppController and implements api.SpreadsheetAPI.
// Exposed to frontend via Wails service binding - methods callable via window.wails.Call.
type WailsAPI struct {
	ctrl *controller.AppController
}

// NewWailsAPI creates a WailsAPI that wraps the given controller.
func NewWailsAPI(ctrl *controller.AppController) *WailsAPI {
	return &WailsAPI{ctrl: ctrl}
}

// Compile-time check that WailsAPI implements api.SpreadsheetAPI
var _ api.SpreadsheetAPI = (*WailsAPI)(nil)

// SetCellValue sets a cell's value or formula.
func (w *WailsAPI) SetCellValue(row, col int, value string) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	err := w.ctrl.SetCellValue(row, col, value)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.INVALID_FORMULA)
	}
	cell := w.ctrl.Sheet.GetCell(row, col)
	if cell != nil && strings.Contains(cell.Computed, "Circular reference") {
		return api.NewErrorResponse(cell.Computed, api.CIRCULAR_REF)
	}
	return api.NewSuccessResponse(map[string]interface{}{
		"hasUnsavedChanges": w.ctrl.HasUnsavedChanges(),
	})
}

// GetCellValue retrieves a cell's value and computed result.
func (w *WailsAPI) GetCellValue(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	value := w.ctrl.GetCellRawValue(row, col)
	computed := w.ctrl.GetCellValue(row, col)
	return api.NewSuccessResponse(map[string]interface{}{
		"value":    value,
		"computed": computed,
	})
}

// GetCellFormula retrieves a cell's formula (if any).
func (w *WailsAPI) GetCellFormula(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	cell := w.ctrl.Sheet.GetCell(row, col)
	if cell == nil {
		return api.NewSuccessResponse(map[string]interface{}{"formula": ""})
	}
	formula := ""
	if cell.IsFormula {
		formula = cell.Value
	}
	return api.NewSuccessResponse(map[string]interface{}{"formula": formula})
}

// DeleteCell removes a cell's contents.
func (w *WailsAPI) DeleteCell(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	cellRef := model.CoordsToRef(row, col)
	w.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
	w.ctrl.Sheet.DeleteCell(row, col)
	return api.NewSuccessResponse(nil)
}

// GetCellRef returns the cell reference (e.g., "A1") for the given row and column.
func (w *WailsAPI) GetCellRef(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	ref := w.ctrl.GetCellRef(row, col)
	return api.NewSuccessResponse(ref)
}

// NewSpreadsheet creates a new empty spreadsheet.
func (w *WailsAPI) NewSpreadsheet() api.Response {
	w.ctrl.NewFile()
	return api.NewSuccessResponse(nil)
}

// LoadFile loads a .sheet file from disk.
func (w *WailsAPI) LoadFile(path string) api.Response {
	err := w.ctrl.LoadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return api.NewErrorResponse(err.Error(), api.FILE_NOT_FOUND)
		}
		if errors.Is(err, os.ErrPermission) {
			return api.NewErrorResponse(err.Error(), api.FILE_READ_ERROR)
		}
		return api.NewErrorResponse(err.Error(), api.PARSE_ERROR)
	}
	return api.NewSuccessResponse(map[string]interface{}{
		"cellCount": w.ctrl.Sheet.GetCellCount(),
	})
}

// SaveFile saves the spreadsheet to disk.
func (w *WailsAPI) SaveFile(path string) api.Response {
	err := w.ctrl.SaveFile(path)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
	}
	return api.NewSuccessResponse(nil)
}

// GetFileStatus retrieves the current file status.
func (w *WailsAPI) GetFileStatus() api.Response {
	path := w.ctrl.GetFilePath()
	modified := w.ctrl.HasUnsavedChanges()
	filename := ""
	if path != "" {
		filename = filepath.Base(path)
	}
	return api.NewSuccessResponse(map[string]interface{}{
		"path":     path,
		"saved":    !modified,
		"modified": modified,
		"filename": filename,
	})
}

// GetAllCells retrieves all non-empty cells for rendering.
func (w *WailsAPI) GetAllCells() api.Response {
	var cells []map[string]interface{}
	for row, rowMap := range w.ctrl.Sheet.Cells {
		for col, cell := range rowMap {
			if cell != nil {
				cells = append(cells, map[string]interface{}{
					"row":      row,
					"col":      col,
					"value":    cell.Value,
					"computed": cell.Computed,
				})
			}
		}
	}
	return api.NewSuccessResponse(cells)
}

// ImportCSV imports data from a CSV file. Stub for Epic 5.
func (w *WailsAPI) ImportCSV(path string) api.Response {
	return api.NewErrorResponse("CSV import not yet implemented (Epic 5)", api.PARSE_ERROR)
}

// ExportCSV exports the spreadsheet to CSV format. Stub for Epic 5.
func (w *WailsAPI) ExportCSV(path string) api.Response {
	return api.NewErrorResponse("CSV export not yet implemented (Epic 5)", api.FILE_WRITE_ERROR)
}
