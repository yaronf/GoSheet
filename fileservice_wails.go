// Package main - WailsFileService implements api.FileService for native mode.
// Stub implementation - full implementation in Epic 4 (native file dialogs, direct I/O).
package main

import "gosheet/api"

// WailsFileService implements api.FileService with placeholder implementations.
// TODO: Epic 4 - Implement OpenFileDialog with Wails native dialog
// TODO: Epic 4 - Implement SaveFileDialog with Wails native dialog
// TODO: Epic 4 - Implement ReadFile with os.ReadFile
// TODO: Epic 4 - Implement WriteFile with os.WriteFile
type WailsFileService struct{}

// NewWailsFileService creates a WailsFileService stub.
func NewWailsFileService() *WailsFileService {
	return &WailsFileService{}
}

// Compile-time check that WailsFileService implements api.FileService
var _ api.FileService = (*WailsFileService)(nil)

// OpenFileDialog displays a file selection dialog. Stub - returns empty (Epic 4).
func (*WailsFileService) OpenFileDialog(filters []string) (path string, err error) {
	return "", nil
}

// SaveFileDialog displays a save dialog. Stub - returns empty (Epic 4).
func (*WailsFileService) SaveFileDialog(defaultName string) (path string, err error) {
	return "", nil
}

// ReadFile reads file contents. Stub - returns empty (Epic 4).
func (*WailsFileService) ReadFile(path string) ([]byte, error) {
	return []byte{}, nil
}

// WriteFile writes data to file. Stub - no-op (Epic 4).
func (*WailsFileService) WriteFile(path string, data []byte) error {
	return nil
}
