// Web-based demo for browser testing - serves the Wails frontend
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"gosheet/controller"
)

var ctrl *controller.AppController

func main() {
	// Create controller
	ctrl = controller.NewAppController()
	
	// Add sample data
	fmt.Println("Loading sample data...")
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "30")
	ctrl.SetCellValue(3, 0, "=SUM(A1:A3)")
	ctrl.SetCellValue(0, 1, "=A1*2")
	fmt.Println("Sample data loaded")
	
	// Serve static files from frontend/dist
	fs := http.FileServer(http.Dir("frontend/dist"))
	http.Handle("/", fs)
	
	// API endpoints that match Wails bindings
	http.HandleFunc("/api/GetCellValue", handleGetCellValue)
	http.HandleFunc("/api/GetCellRawValue", handleGetCellRawValue)
	http.HandleFunc("/api/SetCellValue", handleSetCellValue)
	http.HandleFunc("/api/GetCellRef", handleGetCellRef)
	http.HandleFunc("/api/GetAllCells", handleGetAllCells)
	
	port := "8081"
	fmt.Printf("GoSheet Web Demo running at http://localhost:%s\n", port)
	fmt.Println("Open this URL in your browser to test the spreadsheet!")
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleGetCellValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	
	value := ctrl.GetCellValue(row, col)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(value)
}

func handleGetCellRawValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	
	value := ctrl.GetCellRawValue(row, col)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(value)
}

func handleSetCellValue(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Row   int    `json:"row"`
		Col   int    `json:"col"`
		Value string `json:"value"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	result := ctrl.SetCellValue(req.Row, req.Col, req.Value)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleGetCellRef(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	
	ref := ctrl.GetCellRef(row, col)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ref)
}

func handleGetAllCells(w http.ResponseWriter, r *http.Request) {
	// Build a map of all non-empty cells
	cells := make(map[string]string)
	
	// Iterate through reasonable range
	for row := 0; row < 100; row++ {
		for col := 0; col < 26; col++ {
			value := ctrl.GetCellValue(row, col)
			if value != "" {
				ref := ctrl.GetCellRef(row, col)
				cells[ref] = value
			}
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cells)
}
