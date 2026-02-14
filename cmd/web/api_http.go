// Package main - HttpAPI implements api.SpreadsheetAPI for web mode.
// Wraps controller.AppController and converts responses to api.Response format.
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

// HttpAPI wraps controller.AppController and implements api.SpreadsheetAPI.
// Used by web mode HTTP handlers to provide unified Response format.
type HttpAPI struct {
	ctrl *controller.AppController
}

// NewHttpAPI creates an HttpAPI that wraps the given controller.
func NewHttpAPI(ctrl *controller.AppController) *HttpAPI {
	return &HttpAPI{ctrl: ctrl}
}

// Compile-time check that HttpAPI implements api.SpreadsheetAPI
var _ api.SpreadsheetAPI = (*HttpAPI)(nil)

// SetCellValue sets a cell's value or formula.
func (h *HttpAPI) SetCellValue(row, col int, value string) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	err := h.ctrl.SetCellValue(row, col, value)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.INVALID_FORMULA)
	}
	// Controller sets cell to "#ERROR: Circular reference: ..." and returns nil for circular refs
	cell := h.ctrl.Sheet.GetCell(row, col)
	if cell != nil && strings.Contains(cell.Computed, "Circular reference") {
		return api.NewErrorResponse(cell.Computed, api.CIRCULAR_REF)
	}
	return api.NewSuccessResponse(map[string]interface{}{
		"hasUnsavedChanges": h.ctrl.HasUnsavedChanges(),
	})
}

// GetCellValue retrieves a cell's value and computed result.
func (h *HttpAPI) GetCellValue(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	value := h.ctrl.GetCellRawValue(row, col)
	computed := h.ctrl.GetCellValue(row, col)
	return api.NewSuccessResponse(map[string]interface{}{
		"value":    value,
		"computed": computed,
	})
}

// GetCellFormula retrieves a cell's formula (if any).
func (h *HttpAPI) GetCellFormula(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	cell := h.ctrl.Sheet.GetCell(row, col)
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
func (h *HttpAPI) DeleteCell(row, col int) api.Response {
	if row < 0 || col < 0 {
		return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
	}
	cellRef := model.CoordsToRef(row, col)
	h.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
	h.ctrl.Sheet.DeleteCell(row, col)
	return api.NewSuccessResponse(nil)
}

// NewSpreadsheet creates a new empty spreadsheet.
func (h *HttpAPI) NewSpreadsheet() api.Response {
	h.ctrl.NewFile()
	return api.NewSuccessResponse(nil)
}

// LoadFile loads a .sheet file from disk.
func (h *HttpAPI) LoadFile(path string) api.Response {
	err := h.ctrl.LoadFile(path)
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
		"cellCount": h.ctrl.Sheet.GetCellCount(),
	})
}

// SaveFile saves the spreadsheet to disk.
func (h *HttpAPI) SaveFile(path string) api.Response {
	err := h.ctrl.SaveFile(path)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
	}
	return api.NewSuccessResponse(nil)
}

// GetFileStatus retrieves the current file status.
func (h *HttpAPI) GetFileStatus() api.Response {
	path := h.ctrl.GetFilePath()
	modified := h.ctrl.HasUnsavedChanges()
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
func (h *HttpAPI) GetAllCells() api.Response {
	var cells []map[string]interface{}
	for row, rowMap := range h.ctrl.Sheet.Cells {
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
func (h *HttpAPI) ImportCSV(path string) api.Response {
	return api.NewErrorResponse("CSV import not yet implemented (Epic 5)", api.PARSE_ERROR)
}

// ExportCSV exports the spreadsheet to CSV format. Stub for Epic 5.
func (h *HttpAPI) ExportCSV(path string) api.Response {
	return api.NewErrorResponse("CSV export not yet implemented (Epic 5)", api.FILE_WRITE_ERROR)
}
