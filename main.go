// GoSheet Native App - Wails v3 macOS application
// Build with: wails3 build or go build -o GoSheet .
package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gosheet/controller"
)

//go:embed all:frontend
var frontendAssets embed.FS

func main() {
	// Create controller (same as web mode)
	ctrl := controller.NewAppController()

	// Add sample data
	log.Println("Loading sample data...")
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "30")
	ctrl.SetCellValue(3, 0, "=SUM(A1:A3)")
	ctrl.SetCellValue(0, 1, "=A1*2")
	ctrl.Sheet.Modified = false
	log.Println("Sample data loaded")

	// Sub fs to serve from frontend/ without the "frontend" prefix in URLs
	frontendFS, err := fs.Sub(frontendAssets, "frontend")
	if err != nil {
		log.Fatalf("Failed to create frontend fs: %v", err)
	}

	app := application.New(application.Options{
		Name:        "GoSheet",
		Description: "Native spreadsheet application",
		Services:    []application.Service{},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(frontendFS),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	fileSvc := NewWailsFileService(app)
	wailsAPI := NewWailsAPI(ctrl, fileSvc, app)
	app.RegisterService(application.NewService(fileSvc))
	app.RegisterService(application.NewService(wailsAPI))

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:         "GoSheet",
		Width:         1200,
		Height:        800,
		Frameless:     false,
		DisableResize: false,
		URL:           "/",
	})

	window.Show()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
