// GoSheet HTTP Server - Clean REST API backend
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/ysheffer/gosheet/controller"
)

var ctrl *controller.AppController

func main() {
	// Create controller
	ctrl = controller.NewAppController()
	
	// Add sample data
	log.Println("Loading sample data...")
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "30")
	ctrl.SetCellValue(3, 0, "=SUM(A1:A3)")
	ctrl.SetCellValue(0, 1, "=A1*2")
	log.Println("Sample data loaded")
	
	// Enable CORS for development
	http.HandleFunc("/", corsMiddleware(serveStatic))
	http.HandleFunc("/api/cell/value", corsMiddleware(handleGetCellValue))
	http.HandleFunc("/api/cell/raw", corsMiddleware(handleGetCellRawValue))
	http.HandleFunc("/api/cell/set", corsMiddleware(handleSetCellValue))
	http.HandleFunc("/api/cell/ref", corsMiddleware(handleGetCellRef))
	http.HandleFunc("/api/cells/all", corsMiddleware(handleGetAllCells))
	
	port := "3000"
	log.Printf("GoSheet server running at http://localhost:%s\n", port)
	fmt.Printf("Open http://localhost:%s in your browser\n", port)
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// CORS middleware for development
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next(w, r)
	}
}

// Serve static files from frontend directory
func serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "frontend/index.html")
		return
	}
	http.ServeFile(w, r, "frontend"+r.URL.Path)
}

// API Handlers

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
	
	log.Printf("SetCellValue: row=%d, col=%d, value=%q", req.Row, req.Col, req.Value)
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
