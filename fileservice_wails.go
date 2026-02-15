// Package main - WailsFileService implements api.FileService for native mode.
// Uses Wails v3 native dialogs for Open/Save; direct I/O via os.ReadFile/os.WriteFile.
package main

import (
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gosheet/api"
)

// WailsFileService implements api.FileService with Wails native dialogs.
type WailsFileService struct {
	app *application.App
}

// NewWailsFileService creates a WailsFileService with access to the app for dialogs.
func NewWailsFileService(app *application.App) *WailsFileService {
	return &WailsFileService{app: app}
}

// Compile-time check that WailsFileService implements api.FileService
var _ api.FileService = (*WailsFileService)(nil)

// OpenFileDialog displays a native macOS file selection dialog.
// Returns the selected path or ("", nil) if user cancels.
func (w *WailsFileService) OpenFileDialog(filters []string) (path string, err error) {
	path, err = w.app.Dialog.OpenFile().
		AddFilter("GoSheet", "*.sheet").
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}
	// User cancelled: Wails returns ("", nil)
	return path, nil
}

// SaveFileDialog displays a native macOS save dialog.
// Returns the selected path or ("", nil) if user cancels.
func (w *WailsFileService) SaveFileDialog(defaultName string) (path string, err error) {
	if defaultName == "" {
		defaultName = "Untitled.sheet"
	}
	path, err = w.app.Dialog.SaveFile().
		AddFilter("GoSheet", "*.sheet").
		SetFilename(defaultName).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}
	// User cancelled: Wails returns ("", nil)
	return path, nil
}

// ReadFile reads file contents from the given path using os.ReadFile.
// Returns file contents or error (caller maps to FILE_READ_ERROR).
// Respects macOS file system permissions (NFR-S2).
func (w *WailsFileService) ReadFile(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// WriteFile writes data to the given path using os.WriteFile with 0644 permissions.
// Returns nil on success or error (caller maps to FILE_WRITE_ERROR).
// Respects macOS file system permissions (NFR-S2). Never corrupts data (NFR-R1).
func (w *WailsFileService) WriteFile(path string, data []byte) error {
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}
	return nil
}
