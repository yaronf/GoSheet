package model

import (
	"fmt"
	"regexp"
	"strings"
)

// DependencyGraph tracks cell dependencies for efficient recalculation
type DependencyGraph struct {
	// dependents[A1] = [B1, C1] means B1 and C1 have formulas that reference A1
	dependents map[string]map[string]bool
	// dependencies[B1] = [A1] means B1's formula references A1
	dependencies map[string]map[string]bool
}

// NewDependencyGraph creates a new dependency graph
func NewDependencyGraph() *DependencyGraph {
	return &DependencyGraph{
		dependents:   make(map[string]map[string]bool),
		dependencies: make(map[string]map[string]bool),
	}
}

// ExtractCellReferences extracts all cell references from a formula
// Returns both individual cells (A1, B2) and range references (A1:B2)
func ExtractCellReferences(formula string) []string {
	// Remove leading = if present
	formula = strings.TrimPrefix(formula, "=")
	
	// Pattern matches cell references like A1, AA100, etc.
	cellPattern := regexp.MustCompile(`\b([A-Z]+\d+)\b`)
	matches := cellPattern.FindAllString(formula, -1)
	
	// Remove duplicates
	seen := make(map[string]bool)
	var refs []string
	for _, match := range matches {
		if !seen[match] {
			seen[match] = true
			refs = append(refs, match)
		}
	}
	
	return refs
}

// ExpandRange expands a range reference like A1:B3 into individual cell references
func ExpandRange(rangeRef string) ([]string, error) {
	parts := strings.Split(rangeRef, ":")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid range: %s", rangeRef)
	}
	
	startRow, startCol, err := RefToCoords(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid start reference: %w", err)
	}
	
	endRow, endCol, err := RefToCoords(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid end reference: %w", err)
	}
	
	if startRow < 0 || startCol < 0 || endRow < 0 || endCol < 0 {
		return nil, fmt.Errorf("invalid range coordinates: %s", rangeRef)
	}
	
	// Ensure start <= end
	if startRow > endRow {
		startRow, endRow = endRow, startRow
	}
	if startCol > endCol {
		startCol, endCol = endCol, startCol
	}
	
	var cells []string
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			cells = append(cells, CoordsToRef(row, col))
		}
	}
	
	return cells, nil
}

// AddDependency records that targetCell's formula depends on sourceCell
func (dg *DependencyGraph) AddDependency(targetCell, sourceCell string) {
	// targetCell depends on sourceCell
	if dg.dependencies[targetCell] == nil {
		dg.dependencies[targetCell] = make(map[string]bool)
	}
	dg.dependencies[targetCell][sourceCell] = true
	
	// sourceCell has targetCell as a dependent
	if dg.dependents[sourceCell] == nil {
		dg.dependents[sourceCell] = make(map[string]bool)
	}
	dg.dependents[sourceCell][targetCell] = true
}

// RemoveDependencies removes all dependencies for a cell (when it's cleared or changed)
func (dg *DependencyGraph) RemoveDependencies(cell string) {
	// Remove from dependencies map and update dependents
	if deps, exists := dg.dependencies[cell]; exists {
		for dep := range deps {
			if dg.dependents[dep] != nil {
				delete(dg.dependents[dep], cell)
				if len(dg.dependents[dep]) == 0 {
					delete(dg.dependents, dep)
				}
			}
		}
		delete(dg.dependencies, cell)
	}
}

// GetDependents returns all cells that depend on the given cell
func (dg *DependencyGraph) GetDependents(cell string) []string {
	if dg.dependents[cell] == nil {
		return nil
	}
	
	var result []string
	for dep := range dg.dependents[cell] {
		result = append(result, dep)
	}
	return result
}

// GetDependencies returns all cells that the given cell depends on
func (dg *DependencyGraph) GetDependencies(cell string) []string {
	if dg.dependencies[cell] == nil {
		return nil
	}
	
	var result []string
	for dep := range dg.dependencies[cell] {
		result = append(result, dep)
	}
	return result
}

// DetectCircularReference checks if adding a dependency would create a cycle
// Returns true if circular reference detected, along with the cycle path
func (dg *DependencyGraph) DetectCircularReference(targetCell, sourceCell string) (bool, []string) {
	// Check if sourceCell transitively depends on targetCell
	// If so, adding targetCell -> sourceCell would create a cycle
	visited := make(map[string]bool)
	path := []string{targetCell}
	
	return dg.hasCycleDFS(targetCell, sourceCell, visited, path)
}

// hasCycleDFS performs depth-first search to detect cycles
func (dg *DependencyGraph) hasCycleDFS(target, current string, visited map[string]bool, path []string) (bool, []string) {
	if current == target {
		// Found a cycle back to the target
		return true, append(path, current)
	}
	
	if visited[current] {
		// Already visited this node in this path
		return false, nil
	}
	
	visited[current] = true
	path = append(path, current)
	
	// Check all cells that current depends on
	for dep := range dg.dependencies[current] {
		if hasCycle, cyclePath := dg.hasCycleDFS(target, dep, visited, path); hasCycle {
			return true, cyclePath
		}
	}
	
	return false, nil
}

// GetCalculationOrder returns cells in topological order for recalculation
// Returns error if circular reference detected
func (dg *DependencyGraph) GetCalculationOrder(changedCells []string) ([]string, error) {
	// Find all cells that need recalculation (transitive dependents)
	toRecalc := make(map[string]bool)
	var queue []string
	
	for _, cell := range changedCells {
		queue = append(queue, cell)
	}
	
	// BFS to find all affected cells
	for len(queue) > 0 {
		cell := queue[0]
		queue = queue[1:]
		
		if toRecalc[cell] {
			continue
		}
		toRecalc[cell] = true
		
		// Add all dependents to queue
		for dep := range dg.dependents[cell] {
			if !toRecalc[dep] {
				queue = append(queue, dep)
			}
		}
	}
	
	// Topological sort using DFS
	var result []string
	visited := make(map[string]bool)
	tempMark := make(map[string]bool)
	
	var visit func(string) error
	visit = func(cell string) error {
		if tempMark[cell] {
			return fmt.Errorf("circular reference detected involving cell %s", cell)
		}
		if visited[cell] {
			return nil
		}
		
		tempMark[cell] = true
		
		// Visit dependencies first
		for dep := range dg.dependencies[cell] {
			if toRecalc[dep] {
				if err := visit(dep); err != nil {
					return err
				}
			}
		}
		
		tempMark[cell] = false
		visited[cell] = true
		result = append(result, cell)
		
		return nil
	}
	
	// Visit all cells that need recalculation
	for cell := range toRecalc {
		if !visited[cell] {
			if err := visit(cell); err != nil {
				return nil, err
			}
		}
	}
	
	return result, nil
}
