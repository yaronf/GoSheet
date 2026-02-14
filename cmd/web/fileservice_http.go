// Package main - HttpFileService implements api.FileService for web mode.
// In web mode, file selection happens via browser (upload/download endpoints).
// ReadFile and WriteFile support temp file I/O used by those handlers.
package main

import (
	"errors"
	"os"

	"gosheet/api"
)

// ErrWebModeNoDialog indicates that file dialogs are not supported in web mode.
// Use /api/file/upload for loading and /api/file/download for saving.
var ErrWebModeNoDialog = errors.New("file dialogs not supported in web mode; use /api/file/upload and /api/file/download")

// HttpFileService implements api.FileService for web mode.
type HttpFileService struct{}

// NewHttpFileService creates a FileService for web mode.
func NewHttpFileService() *HttpFileService {
	return &HttpFileService{}
}

// Compile-time check that HttpFileService implements api.FileService
var _ api.FileService = (*HttpFileService)(nil)

// OpenFileDialog displays a file selection dialog.
// In web mode, file selection happens via browser; use /api/file/upload instead.
func (h *HttpFileService) OpenFileDialog(filters []string) (path string, err error) {
	return "", ErrWebModeNoDialog
}

// SaveFileDialog displays a save dialog.
// In web mode, save triggers browser download; use /api/file/download instead.
func (h *HttpFileService) SaveFileDialog(defaultName string) (path string, err error) {
	return "", ErrWebModeNoDialog
}

// ReadFile reads the entire file contents from the given path.
// Used for reading uploaded files from temp storage (e.g., /tmp/gosheet_upload.gosheet).
func (h *HttpFileService) ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// WriteFile writes data to the given file path.
// Used for writing to temp storage for download (e.g., /tmp/gosheet_download.gosheet).
func (h *HttpFileService) WriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}
