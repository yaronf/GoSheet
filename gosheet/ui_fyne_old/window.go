package ui

import (
	"log"
	"os"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/dialog"
)

// MainWindow represents the main application window
type MainWindow struct {
	App        fyne.App
	Window     fyne.Window
	Grid       *GridTable
	Controller GridController
}

// loadIcon attempts to load the application icon
func loadIcon() fyne.Resource {
	// Try multiple possible paths
	paths := []string{
		"Icon.png",
		"./Icon.png",
		"../Icon.png",
	}
	
	// Get current working directory for debugging
	if cwd, err := os.Getwd(); err == nil {
		log.Printf("Current working directory: %s", cwd)
	}
	
	for _, path := range paths {
		if icon, err := fyne.LoadResourceFromPath(path); err == nil {
			log.Printf("Icon loaded successfully from: %s", path)
			return icon
		} else {
			log.Printf("Failed to load icon from %s: %v", path, err)
		}
	}
	
	log.Println("Warning: Could not load icon from any path")
	return nil
}

// NewMainWindow creates a new main window
func NewMainWindow(controller GridController) *MainWindow {
	a := app.New()
	
	// Set application icon
	if icon := loadIcon(); icon != nil {
		a.SetIcon(icon)
	}
	
	w := a.NewWindow("GoSheet - Spreadsheet")
	
	// Also set window icon
	if icon := loadIcon(); icon != nil {
		w.SetIcon(icon)
	}
	
	mw := &MainWindow{
		App:        a,
		Window:     w,
		Controller: controller,
	}
	
	mw.setupUI()
	
	return mw
}

// setupUI sets up the user interface
func (mw *MainWindow) setupUI() {
	// Create grid using table-based implementation with headers
	mw.Grid = NewGridTable(mw.Controller, mw.Window)
	
	// Create menu
	menu := mw.createMenu()
	mw.Window.SetMainMenu(menu)
	
	// Simple layout - just the grid
	mw.Window.SetContent(mw.Grid.GetContainer())
	mw.Window.Resize(fyne.NewSize(900, 600))
}

// createMenu creates the application menu
func (mw *MainWindow) createMenu() *fyne.MainMenu {
	// File menu
	newItem := fyne.NewMenuItem("New", func() {
		mw.onNew()
	})
	
	openItem := fyne.NewMenuItem("Open...", func() {
		mw.onOpen()
	})
	
	saveItem := fyne.NewMenuItem("Save", func() {
		mw.onSave()
	})
	
	saveAsItem := fyne.NewMenuItem("Save As...", func() {
		mw.onSaveAs()
	})
	
	quitItem := fyne.NewMenuItem("Quit", func() {
		mw.App.Quit()
	})
	
	fileMenu := fyne.NewMenu("File",
		newItem,
		openItem,
		fyne.NewMenuItemSeparator(),
		saveItem,
		saveAsItem,
		fyne.NewMenuItemSeparator(),
		quitItem,
	)
	
	// Edit menu
	clearCellItem := fyne.NewMenuItem("Clear Cell", func() {
		// TODO: Clear selected cell
	})
	
	clearAllItem := fyne.NewMenuItem("Clear All", func() {
		mw.onClearAll()
	})
	
	editMenu := fyne.NewMenu("Edit",
		clearCellItem,
		clearAllItem,
	)
	
	// Help menu
	aboutItem := fyne.NewMenuItem("About", func() {
		mw.onAbout()
	})
	
	helpMenu := fyne.NewMenu("Help",
		aboutItem,
	)
	
	return fyne.NewMainMenu(fileMenu, editMenu, helpMenu)
}

// Menu handlers

func (mw *MainWindow) onNew() {
	dialog.ShowConfirm("New Spreadsheet",
		"Create a new spreadsheet? Unsaved changes will be lost.",
		func(confirmed bool) {
			if confirmed {
				// TODO: Call controller.NewFile()
				mw.RefreshGrid()
			}
		},
		mw.Window,
	)
}

func (mw *MainWindow) onOpen() {
	dialog.ShowInformation("Open", "File open not yet implemented", mw.Window)
	// TODO: Show file open dialog
}

func (mw *MainWindow) onSave() {
	dialog.ShowInformation("Save", "File save not yet implemented", mw.Window)
	// TODO: Save file
}

func (mw *MainWindow) onSaveAs() {
	dialog.ShowInformation("Save As", "File save not yet implemented", mw.Window)
	// TODO: Show file save dialog
}

func (mw *MainWindow) onClearAll() {
	dialog.ShowConfirm("Clear All",
		"Clear all cells? This cannot be undone.",
		func(confirmed bool) {
			if confirmed {
				// TODO: Call controller.NewFile()
				mw.RefreshGrid()
			}
		},
		mw.Window,
	)
}

func (mw *MainWindow) onAbout() {
	dialog.ShowInformation("About GoSheet",
		"GoSheet v0.1\n\nA lightweight spreadsheet application built with Go and Fyne.\n\nBuilt using the BMAD methodology.",
		mw.Window,
	)
}

// RefreshGrid refreshes the grid display
func (mw *MainWindow) RefreshGrid() {
	mw.Grid.Refresh()
}

// Show displays the window
func (mw *MainWindow) Show() {
	mw.Window.ShowAndRun()
}
