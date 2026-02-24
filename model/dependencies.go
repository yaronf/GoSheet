// Package model provides dependency tracking for spreadsheet formulas.
//
// The DependencyGraph tracks which cells depend on which other cells,
// enabling efficient recalculation (only recalculate affected cells)
// and circular reference detection.
//
// Key operations:
//   - AddDependency: Record that a cell's formula references another cell
//   - RemoveDependencies: Clear all dependencies when a cell changes
//   - DetectCircularReference: Check if adding a dependency would create a cycle
//   - GetCalculationOrder: Get topologically sorted list of cells to recalculate
//
// Thread-safety: All operations are protected by a read-write mutex for
// concurrent access from multiple HTTP request handlers.
package model

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	"gosheet/logutil"
)

// DependencyGraph tracks cell dependencies for efficient recalculation
// Thread-safe for concurrent access from multiple HTTP request handlers
type DependencyGraph struct {
	// dependents[A1] = [B1, C1] means B1 and C1 have formulas that reference A1
	dependents map[string]map[string]bool
	// dependencies[B1] = [A1] means B1's formula references A1
	dependencies map[string]map[string]bool
	// mutex protects concurrent access to the graph
	mu sync.RWMutex
}

// NewDependencyGraph creates a new dependency graph
func NewDependencyGraph() *DependencyGraph {
	return &DependencyGraph{
		dependents:   make(map[string]map[string]bool),
		dependencies: make(map[string]map[string]bool),
	}
}

// refCollector walks the formula AST and collects unique cell references
type refCollector struct {
	seen map[string]bool
	refs []string
}

// addRef records a cell reference if not already seen.
func (c *refCollector) addRef(ref string) {
	if !c.seen[ref] {
		c.seen[ref] = true
		c.refs = append(c.refs, ref)
	}
}

// walkPrimary extracts refs from a Primary node (cell, range, func, or subexpr).
func (c *refCollector) walkPrimary(prim *Primary) {
	if prim == nil {
		return
	}
	if prim.CellRef != nil {
		c.addRef(prim.CellRef.Ref)
	}
	if prim.Range != nil {
		rangeStr := prim.Range.Start + ":" + prim.Range.End
		expanded, err := ExpandRange(rangeStr)
		if err == nil {
			for _, cell := range expanded {
				c.addRef(cell)
			}
		}
	}
	if prim.FuncCall != nil {
		for _, arg := range prim.FuncCall.Args {
			c.walk(arg)
		}
	}
	if prim.SubExpr != nil {
		c.walk(prim.SubExpr)
	}
}

// walkUnary recurses through unary operators.
func (c *refCollector) walkUnary(u *Unary) {
	if u == nil {
		return
	}
	if u.Unary != nil {
		c.walkUnary(u.Unary)
	}
	if u.Primary != nil {
		c.walkPrimary(u.Primary)
	}
}

// walkMultiplication recurses through multiplication/division terms.
func (c *refCollector) walkMultiplication(m *Multiplication) {
	if m == nil {
		return
	}
	c.walkUnary(m.Left)
	if m.Right != nil {
		c.walkMultiplication(m.Right)
	}
}

// walkAddition recurses through addition/subtraction terms.
func (c *refCollector) walkAddition(a *Addition) {
	if a == nil {
		return
	}
	c.walkMultiplication(a.Left)
	if a.Right != nil {
		c.walkAddition(a.Right)
	}
}

// walkComparison recurses through comparison operators.
func (c *refCollector) walkComparison(comp *Comparison) {
	if comp == nil {
		return
	}
	c.walkAddition(comp.Left)
	if comp.Right != nil {
		c.walkComparison(comp.Right)
	}
}

// walk starts the AST traversal from an Expression.
func (c *refCollector) walk(expr *Expression) {
	if expr == nil {
		return
	}
	c.walkComparison(expr.Comparison)
}

// ExtractCellReferences extracts all cell references from a formula
// Expands ranges (A1:B2) into individual cells and returns all unique references
// Uses AST parsing for accuracy instead of regex
func ExtractCellReferences(formula string) []string {
	ast, err := ParseFormula(formula)
	if err != nil {
		logutil.Debugf("ExtractCellReferences: Failed to parse formula %q, using regex fallback: %v", formula, err)
		return extractCellReferencesRegex(formula)
	}
	c := &refCollector{seen: make(map[string]bool)}
	c.walk(ast.Expr)
	return c.refs
}

// extractCellReferencesRegex is a fallback regex-based implementation
func extractCellReferencesRegex(formula string) []string {
	// Remove leading = if present
	formula = strings.TrimPrefix(formula, "=")

	// Pattern matches ranges like A1:B2
	rangePattern := regexp.MustCompile(`\b([A-Z]+\d+):([A-Z]+\d+)\b`)

	// Pattern matches individual cell references like A1, AA100, etc.
	cellPattern := regexp.MustCompile(`\b([A-Z]+\d+)\b`)

	seen := make(map[string]bool)
	var refs []string

	// First, find and expand all ranges
	rangeMatches := rangePattern.FindAllString(formula, -1)
	for _, rangeRef := range rangeMatches {
		expanded, err := ExpandRange(rangeRef)
		if err == nil {
			for _, cell := range expanded {
				if !seen[cell] {
					seen[cell] = true
					refs = append(refs, cell)
				}
			}
		}
	}

	// Then find individual cell references (that aren't part of ranges)
	// Remove ranges from formula first to avoid double-counting
	formulaWithoutRanges := rangePattern.ReplaceAllString(formula, "")
	cellMatches := cellPattern.FindAllString(formulaWithoutRanges, -1)
	for _, match := range cellMatches {
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
	dg.mu.Lock()
	defer dg.mu.Unlock()

	logutil.Debugf("DependencyGraph: Adding %s -> %s", targetCell, sourceCell)

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
	dg.mu.Lock()
	defer dg.mu.Unlock()

	logutil.Debugf("DependencyGraph: Removing dependencies for %s", cell)

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
	dg.mu.RLock()
	defer dg.mu.RUnlock()

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
	dg.mu.RLock()
	defer dg.mu.RUnlock()

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
	dg.mu.RLock()
	defer dg.mu.RUnlock()

	// Check if sourceCell transitively depends on targetCell
	// If so, adding targetCell -> sourceCell would create a cycle
	visited := make(map[string]bool)
	path := []string{targetCell}

	hasCycle, cyclePath := dg.hasCycleDFS(targetCell, sourceCell, visited, path)
	if hasCycle {
		logutil.Debugf("DependencyGraph: Circular reference detected: %v", cyclePath)
	}
	return hasCycle, cyclePath
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
	dg.mu.RLock()
	defer dg.mu.RUnlock()

	// Find all cells that need recalculation (transitive dependents)
	toRecalc := make(map[string]bool)
	var queue []string

	queue = append(queue, changedCells...)

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
