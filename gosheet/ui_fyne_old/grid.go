package ui

import (
	"fmt"
	"image/color"
	"log"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"gosheet/model"
)

// GridWidget displays the spreadsheet grid
type GridWidget struct {
	widget.BaseWidget
	
	controller GridController
	window     fyne.Window // Reference to parent window for dialogs
	
	// Grid dimensions
	visibleRows int
	visibleCols int
	
	// Current selection
	selectedRow int
	selectedCol int
	
	// Cell size
	cellWidth  float32
	cellHeight float32
	
	// Header sizes
	rowHeaderWidth float32
	colHeaderHeight float32
	
	// Content container
	content *fyne.Container
}

// GridController interface for the grid to interact with the app
type GridController interface {
	GetCellValue(row, col int) string
	GetCellRawValue(row, col int) string
	GetCellRef(row, col int) string
	SetCellValue(row, col int, value string) error
}

// NewGridWidget creates a new grid widget
func NewGridWidget(controller GridController, window fyne.Window) *GridWidget {
	g := &GridWidget{
		controller:      controller,
		window:          window,
		visibleRows:     20,
		visibleCols:     10,
		selectedRow:     0,
		selectedCol:     0,
		cellWidth:       100,
		cellHeight:      30,
		rowHeaderWidth:  50,
		colHeaderHeight: 30,
	}
	g.ExtendBaseWidget(g)
	return g
}

// CreateRenderer creates the renderer for the grid
func (g *GridWidget) CreateRenderer() fyne.WidgetRenderer {
	// Create the grid content
	g.content = g.buildGrid()
	
	return widget.NewSimpleRenderer(g.content)
}

// buildGrid constructs the grid UI
func (g *GridWidget) buildGrid() *fyne.Container {
	cells := []fyne.CanvasObject{}
	
	// Top-left corner (empty cell)
	corner := canvas.NewRectangle(theme.BackgroundColor())
	corner.Resize(fyne.NewSize(g.rowHeaderWidth, g.colHeaderHeight))
	corner.Move(fyne.NewPos(0, 0))
	cells = append(cells, corner)
	
	// Column headers (A, B, C, ...)
	for col := 0; col < g.visibleCols; col++ {
		header := g.createColumnHeader(col)
		header.Resize(fyne.NewSize(g.cellWidth, g.colHeaderHeight))
		header.Move(fyne.NewPos(g.rowHeaderWidth+float32(col)*g.cellWidth, 0))
		cells = append(cells, header)
	}
	
	// Row headers and cells
	for row := 0; row < g.visibleRows; row++ {
		// Row header (1, 2, 3, ...)
		rowHeader := g.createRowHeader(row)
		rowHeader.Resize(fyne.NewSize(g.rowHeaderWidth, g.cellHeight))
		rowHeader.Move(fyne.NewPos(0, g.colHeaderHeight+float32(row)*g.cellHeight))
		cells = append(cells, rowHeader)
		
		// Data cells
		for col := 0; col < g.visibleCols; col++ {
			cell := g.createCell(row, col)
			cell.Resize(fyne.NewSize(g.cellWidth, g.cellHeight))
			cell.Move(fyne.NewPos(
				g.rowHeaderWidth+float32(col)*g.cellWidth,
				g.colHeaderHeight+float32(row)*g.cellHeight,
			))
			cells = append(cells, cell)
		}
	}
	
	return container.NewWithoutLayout(cells...)
}

// createColumnHeader creates a column header label
func (g *GridWidget) createColumnHeader(col int) fyne.CanvasObject {
	label := widget.NewLabel(model.ColIndexToLetter(col))
	
	bg := canvas.NewRectangle(color.RGBA{220, 220, 220, 255})
	
	return container.NewStack(bg, label)
}

// createRowHeader creates a row header label
func (g *GridWidget) createRowHeader(row int) fyne.CanvasObject {
	label := widget.NewLabel(fmt.Sprintf("%d", row+1))
	
	bg := canvas.NewRectangle(color.RGBA{220, 220, 220, 255})
	
	return container.NewStack(bg, label)
}

// createCell creates a cell widget
func (g *GridWidget) createCell(row, col int) fyne.CanvasObject {
	value := g.controller.GetCellValue(row, col)
	
	log.Printf("Creating cell at row=%d, col=%d, value=%q", row, col, value)
	
	// Cell background
	bg := canvas.NewRectangle(color.White)
	
	// Cell border
	border := canvas.NewRectangle(color.RGBA{200, 200, 200, 255})
	
	// Cell label
	label := widget.NewLabel(value)
	
	// Highlight if selected
	if row == g.selectedRow && col == g.selectedCol {
		bg.FillColor = color.RGBA{200, 220, 255, 255}
		log.Printf("Cell (%d,%d) is selected", row, col)
	}
	
	// Create a button that covers the cell
	cellRow := row // Capture for closure
	cellCol := col
	btn := widget.NewButton("", func() {
		log.Printf("Cell clicked: row=%d, col=%d", cellRow, cellCol)
		g.selectCell(cellRow, cellCol)
	})
	btn.Importance = widget.LowImportance
	
	// Stack: border, background, label, button (button on top to receive clicks)
	return container.NewStack(border, bg, container.NewPadded(label), btn)
}

// selectCell selects a cell and shows edit dialog
func (g *GridWidget) selectCell(row, col int) {
	log.Printf("selectCell called: row=%d, col=%d", row, col)
	g.selectedRow = row
	g.selectedCol = col
	
	// Show edit dialog immediately
	g.showCellEditor(row, col)
	
	// Refresh to show selection
	g.Refresh()
}

// showCellEditor shows a dialog to edit the cell
func (g *GridWidget) showCellEditor(row, col int) {
	if g.window == nil {
		log.Printf("ERROR: No window reference, cannot show dialog")
		return
	}
	
	rawValue := g.controller.GetCellRawValue(row, col)
	cellRef := model.CoordsToRef(row, col)
	
	log.Printf("showCellEditor: cell=%s, current value=%q", cellRef, rawValue)
	
	entry := widget.NewEntry()
	entry.SetText(rawValue)
	entry.SetPlaceHolder("Enter value or formula (e.g., =A1+A2)")
	
	// Import dialog package
	dialog := &customDialog{
		title:   "Edit Cell " + cellRef,
		content: entry,
		onSubmit: func() {
			value := entry.Text
			log.Printf("Dialog submitted: cell=%s, value=%q", cellRef, value)
			err := g.controller.SetCellValue(row, col, value)
			if err != nil {
				log.Printf("Error setting cell value: %v", err)
			}
		},
	}
	
	dialog.show(g.window, func() {
		g.Refresh()
	})
}

// customDialog is a simple dialog for cell editing
type customDialog struct {
	title    string
	content  *widget.Entry
	onSubmit func()
	popup    *widget.PopUp
}

func (d *customDialog) show(w fyne.Window, onClose func()) {
	log.Printf("Showing dialog: %s", d.title)
	
	// Create buttons with proper close handling
	okBtn := widget.NewButton("OK", func() {
		log.Printf("OK button clicked")
		d.onSubmit()
		if d.popup != nil {
			d.popup.Hide()
		}
		onClose()
	})
	
	cancelBtn := widget.NewButton("Cancel", func() {
		log.Printf("Cancel button clicked")
		if d.popup != nil {
			d.popup.Hide()
		}
		onClose()
	})
	
	// Handle Enter key
	d.content.OnSubmitted = func(string) {
		log.Printf("Enter key pressed in dialog")
		d.onSubmit()
		if d.popup != nil {
			d.popup.Hide()
		}
		onClose()
	}
	
	// Create dialog content
	content := container.NewVBox(
		widget.NewLabel(d.title),
		d.content,
		container.NewHBox(
			okBtn,
			cancelBtn,
		),
	)
	
	// Show as modal popup
	d.popup = widget.NewModalPopUp(content, w.Canvas())
	d.popup.Show()
	
	log.Printf("Dialog shown, focusing entry")
	
	// Focus the entry
	w.Canvas().Focus(d.content)
}

// Refresh updates the grid display
func (g *GridWidget) Refresh() {
	log.Println("GridWidget.Refresh() called - rebuilding grid")
	g.content = g.buildGrid()
	g.BaseWidget.Refresh()
	log.Println("GridWidget.Refresh() complete")
}

// MinSize returns the minimum size of the grid
func (g *GridWidget) MinSize() fyne.Size {
	width := g.rowHeaderWidth + float32(g.visibleCols)*g.cellWidth
	height := g.colHeaderHeight + float32(g.visibleRows)*g.cellHeight
	return fyne.NewSize(width, height)
}
