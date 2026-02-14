package api

// FileService defines the unified interface for file operations.
// This interface abstracts file dialogs and I/O to support both:
//   - Native mode: Wails dialogs with direct disk access
//   - Web mode: Browser File API with temp files for testing
//
// Implementation notes:
//   - Native mode: cmd/native/fileservice_wails.go (Story 4.1-4.2)
//   - Web mode: cmd/web/fileservice_http.go (Story 2.3)
//
// Design rationale:
// This interface does NOT return Response struct (unlike SpreadsheetAPI)
// because file operations are lower-level primitives that may be called
// from multiple contexts. Error handling is done via standard Go errors,
// which callers can wrap into Response structs as needed.
type FileService interface {
	// OpenFileDialog displays a file selection dialog and returns the chosen path.
	//
	// Parameters:
	//   - filters: File type filters (e.g., [".sheet", ".csv"])
	//
	// Returns:
	//   - path: Absolute file path selected by user (empty if cancelled)
	//   - err: Error if dialog fails (nil if cancelled by user)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Wails OpenFileDialog with native macOS UI
	//     Returns real file path like "/Users/name/Documents/Budget.sheet"
	//   - Web mode: Uses browser file input element
	//     Returns temp path like "/tmp/upload-12345.sheet"
	//
	// Example:
	//   path, err := fs.OpenFileDialog([]string{".sheet"})
	//   if err != nil {
	//     return NewErrorResponse("Failed to open file dialog", FILE_READ_ERROR)
	//   }
	//   if path == "" {
	//     // User cancelled - not an error
	//     return NewSuccessResponse(nil)
	//   }
	//   // Proceed to read file at path
	OpenFileDialog(filters []string) (path string, err error)

	// SaveFileDialog displays a save dialog and returns the chosen path.
	//
	// Parameters:
	//   - defaultName: Suggested filename (e.g., "Untitled.sheet")
	//
	// Returns:
	//   - path: Absolute file path selected by user (empty if cancelled)
	//   - err: Error if dialog fails (nil if cancelled by user)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Wails SaveFileDialog with native macOS UI
	//     Returns real file path like "/Users/name/Documents/Budget.sheet"
	//     Automatically appends .sheet extension if missing
	//   - Web mode: Uses browser download mechanism
	//     Returns temp path like "/tmp/download-12345.sheet"
	//
	// Example:
	//   path, err := fs.SaveFileDialog("Untitled.sheet")
	//   if err != nil {
	//     return NewErrorResponse("Failed to open save dialog", FILE_WRITE_ERROR)
	//   }
	//   if path == "" {
	//     // User cancelled - not an error
	//     return NewSuccessResponse(nil)
	//   }
	//   // Proceed to write file to path
	SaveFileDialog(defaultName string) (path string, err error)

	// ReadFile reads the entire file contents from the given path.
	//
	// Parameters:
	//   - path: Absolute file path to read
	//
	// Returns:
	//   - data: File contents as byte slice
	//   - err: Error if file cannot be read
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Go's os.ReadFile for direct disk access
	//     Respects macOS file permissions
	//   - Web mode: Reads from temp storage (uploaded files)
	//     Limited to files uploaded via browser
	//
	// Possible errors:
	//   - File not found (os.ErrNotExist)
	//   - Permission denied (os.ErrPermission)
	//   - I/O errors (various)
	//
	// Example:
	//   data, err := fs.ReadFile(path)
	//   if err != nil {
	//     if os.IsNotExist(err) {
	//       return NewErrorResponse("File not found", FILE_NOT_FOUND)
	//     }
	//     return NewErrorResponse("Cannot read file", FILE_READ_ERROR)
	//   }
	//   // Proceed to deserialize data
	ReadFile(path string) ([]byte, error)

	// WriteFile writes data to the given file path.
	//
	// Parameters:
	//   - path: Absolute file path to write
	//   - data: File contents as byte slice
	//
	// Returns:
	//   - err: Error if file cannot be written (nil on success)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Go's os.WriteFile for direct disk access
	//     Creates file with 0644 permissions
	//     Overwrites existing file
	//   - Web mode: Writes to temp storage for download
	//     Triggers browser download mechanism
	//
	// Possible errors:
	//   - Permission denied (os.ErrPermission)
	//   - Disk full (various)
	//   - I/O errors (various)
	//
	// Example:
	//   err := fs.WriteFile(path, data)
	//   if err != nil {
	//     return NewErrorResponse("Cannot write file", FILE_WRITE_ERROR)
	//   }
	//   return NewSuccessResponse(nil)
	WriteFile(path string, data []byte) error
}
