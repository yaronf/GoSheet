// Package main - WailsAPI implements api.SpreadsheetAPI for native mode.
// Wraps controller.AppController and exposes methods via Wails IPC binding.
package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gosheet/api"
	"gosheet/controller"
	"gosheet/model"
)

// WailsAPI wraps controller.AppController and implements api.SpreadsheetAPI.
// Exposed to frontend via Wails service binding - methods callable via window.wails.Call.
type WailsAPI struct {
	ctrl    *controller.AppController
	fileSvc api.FileService
	app     *application.App
}

// NewWailsAPI creates a WailsAPI that wraps the given controller, file service, and app.
func NewWailsAPI(ctrl *controller.AppController, fileSvc api.FileService, app *application.App) *WailsAPI {
	return &WailsAPI{ctrl: ctrl, fileSvc: fileSvc, app: app}
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
// Clears all cells, resets file status to "Untitled - Unsaved", clears file path, sets modified=false.
// If there are unsaved changes, shows Save/Don't Save/Cancel dialog first.
func (w *WailsAPI) NewSpreadsheet() api.Response {
	if w.ctrl.HasUnsavedChanges() {
		choice := w.showUnsavedChangesDialog("Create new spreadsheet")
		switch choice {
		case "cancel":
			return api.NewSuccessResponse(map[string]interface{}{"cancelled": true})
		case "save":
			if resp := w.SaveFile(""); !resp.Success {
				return resp
			}
		case "dontsave":
			// proceed
		}
	}
	w.ctrl.NewFile()
	return api.NewSuccessResponse(nil)
}

// LoadFile loads a .sheet file from disk (path provided by caller).
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

// OpenFile shows native Open dialog, reads file via FileService, loads spreadsheet.
// Returns early with success if user cancels dialog.
// If there are unsaved changes, shows Save/Don't Save/Cancel dialog first.
func (w *WailsAPI) OpenFile() api.Response {
	if w.ctrl.HasUnsavedChanges() {
		choice := w.showUnsavedChangesDialog("Open file")
		switch choice {
		case "cancel":
			return api.NewSuccessResponse(map[string]interface{}{"cancelled": true})
		case "save":
			if resp := w.SaveFile(""); !resp.Success {
				return resp
			}
		case "dontsave":
			// proceed
		}
	}

	path, err := w.fileSvc.OpenFileDialog([]string{".sheet"})
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_READ_ERROR)
	}
	if path == "" {
		return api.NewSuccessResponse(nil) // User cancelled
	}

	data, err := w.fileSvc.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return api.NewErrorResponse(err.Error(), api.FILE_NOT_FOUND)
		}
		return api.NewErrorResponse(err.Error(), api.FILE_READ_ERROR)
	}

	err = w.ctrl.LoadFromBytes(data, path)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.PARSE_ERROR)
	}

	return api.NewSuccessResponse(map[string]interface{}{
		"cellCount": w.ctrl.Sheet.GetCellCount(),
	})
}

// SaveFile saves the spreadsheet to disk.
// When path is empty: uses current file path or shows Save dialog if none.
func (w *WailsAPI) SaveFile(path string) api.Response {
	if path == "" {
		path = w.ctrl.GetFilePath()
		if path == "" {
			var err error
			path, err = w.fileSvc.SaveFileDialog("Untitled.sheet")
			if err != nil {
				return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
			}
			if path == "" {
				return api.NewSuccessResponse(nil) // User cancelled
			}
		}
	}

	data, err := w.ctrl.Sheet.SaveToBytes()
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
	}
	if err := w.fileSvc.WriteFile(path, data); err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
	}

	w.ctrl.Sheet.FilePath = path
	w.ctrl.Sheet.Modified = false
	return api.NewSuccessResponse(nil)
}

// SaveAs shows Save dialog and saves to the chosen path.
func (w *WailsAPI) SaveAs() api.Response {
	defaultName := "Untitled.sheet"
	if p := w.ctrl.GetFilePath(); p != "" {
		defaultName = filepath.Base(p)
	}
	path, err := w.fileSvc.SaveFileDialog(defaultName)
	if err != nil {
		return api.NewErrorResponse(err.Error(), api.FILE_WRITE_ERROR)
	}
	if path == "" {
		return api.NewSuccessResponse(nil) // User cancelled
	}
	return w.SaveFile(path)
}

// GetFileStatus retrieves the current file status.
func (w *WailsAPI) GetFileStatus() api.Response {
	path := w.ctrl.GetFilePath()
	modified := w.ctrl.HasUnsavedChanges()
	filename := ""
	status := "Untitled - Unsaved"
	if path != "" {
		filename = filepath.Base(path)
		if modified {
			status = filename + " - Unsaved*"
		} else {
			status = "Saved: " + path
		}
	} else if modified {
		status = "Untitled - Unsaved*"
	}
	return api.NewSuccessResponse(map[string]interface{}{
		"path":              path,
		"saved":             !modified,
		"modified":          modified,
		"filename":          filename,
		"status":            status,
		"hasUnsavedChanges": modified,
	})
}

// HasUnsavedChanges returns true if there are unsaved changes.
func (w *WailsAPI) HasUnsavedChanges() api.Response {
	return api.NewSuccessResponse(map[string]interface{}{
		"hasUnsavedChanges": w.ctrl.HasUnsavedChanges(),
	})
}

// showUnsavedChangesDialog shows Save/Don't Save/Cancel dialog. Returns "save", "dontsave", or "cancel".
func (w *WailsAPI) showUnsavedChangesDialog(action string) string {
	result := make(chan string, 1)
	d := w.app.Dialog.Question().
		SetTitle("Unsaved Changes").
		SetMessage("You have unsaved changes. Save before " + action + "?")

	saveBtn := d.AddButton("Save")
	saveBtn.OnClick(func() { result <- "save" })
	dontSaveBtn := d.AddButton("Don't Save")
	dontSaveBtn.OnClick(func() { result <- "dontsave" })
	cancelBtn := d.AddButton("Cancel")
	cancelBtn.SetAsCancel()
	cancelBtn.OnClick(func() { result <- "cancel" })

	go d.Show()
	return <-result
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
