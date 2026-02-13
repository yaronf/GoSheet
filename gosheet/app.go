package main

import (
	"context"
	"log"

	"gosheet/controller"
	"gosheet/model"
)

// App struct
type App struct {
	ctx        context.Context
	controller *controller.AppController
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		controller: controller.NewAppController(),
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.Println("GoSheet Wails app started")
	
	// Load sample data
	a.controller.SetCellValue(0, 0, "10")
	a.controller.SetCellValue(1, 0, "20")
	a.controller.SetCellValue(2, 0, "30")
	a.controller.SetCellValue(3, 0, "=SUM(A1:A3)")
	a.controller.SetCellValue(0, 1, "=A1*2")
}

// GetCellValue returns the computed value of a cell
func (a *App) GetCellValue(row, col int) string {
	return a.controller.GetCellValue(row, col)
}

// GetCellRawValue returns the raw value (formula) of a cell
func (a *App) GetCellRawValue(row, col int) string {
	return a.controller.GetCellRawValue(row, col)
}

// SetCellValue sets a cell value and evaluates if it's a formula
func (a *App) SetCellValue(row, col int, value string) error {
	return a.controller.SetCellValue(row, col, value)
}

// GetCellRef returns the cell reference (e.g., "A1") for coordinates
func (a *App) GetCellRef(row, col int) string {
	return model.CoordsToRef(row, col)
}

// GetAllCells returns all non-empty cells for rendering
func (a *App) GetAllCells() map[string]string {
	cells := make(map[string]string)
	
	// Get all cells with data (scan up to 100x100)
	for row := 0; row < 100; row++ {
		for col := 0; col < 100; col++ {
			value := a.controller.GetCellValue(row, col)
			if value != "" {
				ref := model.CoordsToRef(row, col)
				cells[ref] = value
			}
		}
	}
	
	return cells
}
