package ui

import (
	"fmt"
	"log"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/ysheffer/gosheet/model"
)

// GridTable is a table-based grid widget with headers and in-cell editing
type GridTable struct {
	table          *widget.Table
	controller     GridController
	window         fyne.Window
	onCellSelected func(row, col int)
	
	editingCell    *widget.TableCellID
	editingEntry   *widget.Entry
	
	visibleRows int
	visibleCols int
}

// NewGridTable creates a new table-based grid with row/column headers and in-cell editing
func NewGridTable(controller GridController, window fyne.Window) *GridTable {
	g := &GridTable{
		controller:  controller,
		window:      window,
		visibleRows: 21, // +1 for header row
		visibleCols: 11, // +1 for header column
	}
	
	g.table = widget.NewTable(
		func() (int, int) {
			return g.visibleRows, g.visibleCols
		},
		func() fyne.CanvasObject {
			// Create a container that can hold either a label or an entry
			label := widget.NewLabel("")
			label.Wrapping = fyne.TextTruncate
			return label
		},
		func(id widget.TableCellID, obj fyne.CanvasObject) {
			label := obj.(*widget.Label)
			
			// Header row (column labels: A, B, C, ...)
			if id.Row == 0 && id.Col == 0 {
				label.SetText("") // Top-left corner
				label.TextStyle = fyne.TextStyle{Bold: true}
				return
			}
			if id.Row == 0 {
				// Column header
				label.SetText(model.ColIndexToLetter(id.Col - 1))
				label.TextStyle = fyne.TextStyle{Bold: true}
				return
			}
			
			// Header column (row numbers: 1, 2, 3, ...)
			if id.Col == 0 {
				label.SetText(fmt.Sprintf("%d", id.Row))
				label.TextStyle = fyne.TextStyle{Bold: true}
				return
			}
			
			// Data cells (adjust for header offset)
			label.TextStyle = fyne.TextStyle{}
			value := g.controller.GetCellValue(id.Row-1, id.Col-1)
			label.SetText(value)
		},
	)
	
	// Set column widths
	g.table.SetColumnWidth(0, 40) // Row header column (narrower)
	for i := 1; i < g.visibleCols; i++ {
		g.table.SetColumnWidth(i, 100)
	}
	
	// Handle cell selection - start editing on click
	g.table.OnSelected = func(id widget.TableCellID) {
		// Ignore header clicks
		if id.Row == 0 || id.Col == 0 {
			return
		}
		
		// Adjust for header offset
		dataRow := id.Row - 1
		dataCol := id.Col - 1
		
		log.Printf("Cell selected: row=%d, col=%d", dataRow, dataCol)
		
		// Notify parent window of selection
		if g.onCellSelected != nil {
			g.onCellSelected(dataRow, dataCol)
		}
		
		// Start in-cell editing
		g.startEditing(id.Row, id.Col, dataRow, dataCol)
	}
	
	return g
}

// startEditing begins in-cell editing for the specified cell
func (g *GridTable) startEditing(displayRow, displayCol, dataRow, dataCol int) {
	cellRef := model.CoordsToRef(dataRow, dataCol)
	rawValue := g.controller.GetCellRawValue(dataRow, dataCol)
	
	log.Printf("Starting in-cell edit: cell=%s, value=%q", cellRef, rawValue)
	
	// Show edit dialog (simpler than true in-cell editing with Fyne's table)
	g.showCellEditor(dataRow, dataCol)
}

// escapeEntry is a custom entry that handles ESC key
type escapeEntry struct {
	widget.Entry
	onEscape func()
}

func newEscapeEntry() *escapeEntry {
	e := &escapeEntry{}
	e.ExtendBaseWidget(e)
	return e
}

func (e *escapeEntry) TypedKey(key *fyne.KeyEvent) {
	switch key.Name {
	case fyne.KeyEscape:
		log.Println("ESC key pressed in entry")
		if e.onEscape != nil {
			e.onEscape()
		}
	default:
		e.Entry.TypedKey(key)
	}
}

// showCellEditor shows an inline editor for the cell
func (g *GridTable) showCellEditor(row, col int) {
	rawValue := g.controller.GetCellRawValue(row, col)
	cellRef := model.CoordsToRef(row, col)
	
	log.Printf("showCellEditor: cell=%s, current value=%q", cellRef, rawValue)
	
	// Create custom entry with ESC handling
	entry := newEscapeEntry()
	entry.SetText(rawValue)
	entry.SetPlaceHolder("Type formula or value...")
	
	// Create a simple custom dialog
	content := widget.NewForm(
		widget.NewFormItem("", entry),
	)
	
	d := dialog.NewCustom(cellRef, "Done", content, g.window)
	
	// Set up ESC handler
	entry.onEscape = func() {
		log.Printf("ESC pressed, closing editor for cell %s", cellRef)
		d.Hide()
	}
	
	// Set up Enter key handler
	entry.OnSubmitted = func(value string) {
		log.Printf("Entry submitted via Enter: cell=%s, value=%q", cellRef, value)
		err := g.controller.SetCellValue(row, col, value)
		if err != nil {
			log.Printf("Error setting cell value: %v", err)
			dialog.ShowError(err, g.window)
			return
		}
		log.Printf("Cell value set, refreshing table")
		g.Refresh()
		d.Hide()
	}
	
	d.Show()
	d.Resize(fyne.NewSize(400, 100))
	
	// Request focus on the entry field
	g.window.Canvas().Focus(entry)
	
	log.Printf("Editor shown for cell %s with keyboard focus", cellRef)
}

// Refresh updates the table display
func (g *GridTable) Refresh() {
	log.Println("GridTable.Refresh() called")
	g.table.Refresh()
	log.Println("GridTable.Refresh() complete")
}

// GetTable returns the underlying table widget
func (g *GridTable) GetTable() *widget.Table {
	return g.table
}

// GetContainer returns a container with the table
func (g *GridTable) GetContainer() *fyne.Container {
	return container.NewMax(g.table)
}

// SetOnCellSelected sets the callback for when a cell is selected
func (g *GridTable) SetOnCellSelected(callback func(row, col int)) {
	g.onCellSelected = callback
}
