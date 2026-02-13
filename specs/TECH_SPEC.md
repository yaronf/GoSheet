# Technical Specification: GoSheet

**Status**: Approved

## Architecture Overview

### High-Level Design
```
┌─────────────────────────────────────────┐
│         Fyne UI Layer (View)            │
│  - Main Window                          │
│  - Menu Bar                             │
│  - Grid Widget (Custom)                 │
│  - Cell Editor                          │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      Application Layer (Controller)     │
│  - Event Handlers                       │
│  - State Management                     │
│  - File I/O Coordination                │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│       Business Logic Layer (Model)      │
│  - Spreadsheet Model                    │
│  - Formula Engine                       │
│  - Cell Manager                         │
│  - File Serializer                      │
└─────────────────────────────────────────┘
```

## Component Design

### 1. Spreadsheet Model (`model/spreadsheet.go`)
**Responsibility**: Core data structure and operations

```go
type Cell struct {
    Value    string  // Raw value or formula
    Computed string  // Calculated result
    IsFormula bool
}

type Spreadsheet struct {
    Cells    map[int]map[int]*Cell  // Row → Column → Cell (0-indexed)
    Modified bool
    FilePath string
}
```

**Design Notes**:
- Using nested maps for clean numeric model: `Cells[row][col]`
- Efficient row operations (iterate `Cells[row]`)
- Sparse storage: only allocated rows/columns consume memory
- 0-indexed internally, displayed as A1, B2, etc. in UI

**Key Methods**:
- `GetCell(row, col int) *Cell`
- `SetCell(row, col int, value string)`
- `GetCellByRef(ref string) *Cell` // Helper: "A1" → GetCell(0, 0)
- `SetCellByRef(ref string, value string)` // Helper: "A1" → SetCell(0, 0, value)
- `RecalculateAll()`
- `Clear()`

**Helper Functions**:
- `RefToCoords(ref string) (row, col int, error)` // "A1" → (0, 0)
- `CoordsToRef(row, col int) string` // (0, 0) → "A1"

### 2. Formula Engine (`model/formula.go`)
**Responsibility**: Parse and evaluate formulas with native vector support

**Library**: `github.com/alecthomas/participle/v2`
- Parser generator using struct tags to define grammar
- Full control over syntax and semantics
- Native support for vectors (ranges) as first-class data structures
- No need to expand ranges (scalable for large ranges like A1:A10000)

**Supported Operations**:
- Cell references: `A1`, `B2`
- Range references: `A1:A10` (native vector type, not expanded)
- Functions: `SUM()`, `AVG()`, `MIN()`, `MAX()`, `COUNT()`
- Arithmetic: `+`, `-`, `*`, `/`, `()`

**Key Types**:
```go
// AST nodes for parsed formulas
type Formula struct {
    Expr *Expression
}

type Expression struct {
    Binary *BinaryExpr
    Unary  *UnaryExpr
    Primary *Primary
}

type Primary struct {
    Number  *float64
    CellRef *CellRef
    Range   *Range
    FuncCall *FuncCall
    SubExpr *Expression
}

type CellRef struct {
    Col string  // "A", "B", etc.
    Row int     // 1, 2, etc.
}

type Range struct {
    Start *CellRef  // A1
    End   *CellRef  // A10
}

type Vector struct {
    // Lazy evaluation: only fetch values when needed
    sheet *Spreadsheet
    start CellRef
    end   CellRef
}
```

**Key Methods**:
- `Parse(formula string) (*Formula, error)` // Parse formula to AST
- `Evaluate(formula *Formula, sheet *Spreadsheet) (Value, error)` // Evaluate AST
- `ExtractDependencies(formula *Formula) ([]CellRef, []Range, error)` // For recalculation graph

**Implementation Approach**:
1. **Parsing**: Use participle to parse formula into AST
2. **AST Evaluation**: Walk AST and evaluate nodes
3. **Vector Operations**: Ranges become Vector objects with lazy evaluation
4. **Functions**: SUM, AVG, etc. operate on Vector objects directly
5. **Dependency Tracking**: Extract cell refs and ranges from AST
6. **Circular Reference Detection**: Build dependency graph, detect cycles

**Example**:
```
Input:  =SUM(A1:A1000) + B1 * 2
Parse:  BinaryExpr(
          FuncCall("SUM", Range(A1, A1000)),
          "+",
          BinaryExpr(CellRef(B1), "*", Number(2))
        )
Eval:   SUM creates Vector{A1:A1000}, iterates lazily
        No expansion of 1000 cells into memory
```

### 3. File Handler (`io/serializer.go`)
**Responsibility**: Save/Load spreadsheet files using binary serialization

**Key Methods**:
- `Save(sheet *Spreadsheet, path string) error`
- `Load(path string) (*Spreadsheet, error)`

**Format**:
- Custom binary format using Go's `encoding/gob`
- Efficient serialization of sparse cell data
- Preserves formulas and computed values
- File extension: `.gsh` (GoSheet format)

### 4. UI Components

#### Grid Widget (`ui/grid.go`)
**Responsibility**: Display and interact with spreadsheet

**Features**:
- Custom Fyne widget extending `fyne.CanvasObject`
- Virtualized rendering (only visible cells)
- Cell selection highlighting
- Keyboard navigation
- Click-to-edit

**Key Methods**:
- `Render()`
- `OnCellClick(col, row int)`
- `OnKeyPress(key fyne.KeyName)`
- `Refresh()`

#### Main Window (`ui/window.go`)
**Responsibility**: Application window and menu

**Menu Structure**:
```
File
  ├─ New       (Cmd+N)
  ├─ Open...   (Cmd+O)
  ├─ Save      (Cmd+S)
  ├─ Save As... (Cmd+Shift+S)
  └─ Quit      (Cmd+Q)

Edit
  ├─ Clear Cell (Delete)
  └─ Clear All

Help
  └─ About
```

## Data Flow

### Cell Edit Flow
```
1. User clicks cell → Grid.OnCellClick()
2. Show entry widget with current value
3. User types and presses Enter
4. Controller.SetCellValue(ref, value)
5. Model.SetCell() updates cell
6. If formula: FormulaEngine.Evaluate()
7. Model.RecalculateAll() (for dependent cells)
8. Grid.Refresh() updates display
```

### File Save Flow
```
1. User clicks Save → Menu handler
2. Controller.SaveFile()
3. FileHandler.Save(sheet, path)
4. Serialize spreadsheet to binary format
5. Write to disk
6. Update sheet.Modified = false
7. Update window title
```

### File Load Flow
```
1. User clicks Open → File dialog
2. Controller.LoadFile(path)
3. FileHandler.Load(path)
4. Deserialize binary data to Spreadsheet model
5. RecalculateAll() for formulas
6. Grid.Refresh() updates display
```

## Technology Stack

### Core Dependencies
```go
require (
    fyne.io/fyne/v2 v2.4.0
    github.com/alecthomas/participle/v2 v2.1.0  // Formula parser
    github.com/stretchr/testify v1.8.4  // for testing
)
```

**Standard Library Packages**:
- `encoding/gob` - Binary serialization
- `os` - File I/O operations
- `fmt`, `strconv` - String/number conversions

### Project Structure
```
spreadsheet/
├── main.go                 # Application entry point
├── go.mod                  # Go module definition
├── go.sum                  # Dependency checksums
├── specs/                  # Design documents
│   ├── PRODUCT_BRIEF.md
│   └── TECH_SPEC.md
├── model/
│   ├── spreadsheet.go      # Core data model
│   ├── formula.go          # Formula parser and evaluator (participle)
│   ├── formula_ast.go      # AST node definitions for formulas
│   ├── formula_eval.go     # AST evaluation logic
│   ├── vector.go           # Vector type for ranges (lazy evaluation)
│   ├── cell.go             # Cell utilities
│   └── coords.go           # Coordinate conversion (A1 ↔ row/col)
├── io/
│   └── serializer.go       # Binary file serializer
├── ui/
│   ├── window.go           # Main window
│   ├── grid.go             # Grid widget
│   └── styles.go           # UI styling
├── controller/
│   └── app.go              # Application controller
└── tests/
    ├── model_test.go
    ├── formula_test.go
    ├── formula_eval_test.go
    ├── vector_test.go
    ├── coords_test.go
    └── serializer_test.go
```

## Error Handling

### Strategy
- Return errors explicitly (Go idiom)
- Display user-friendly error dialogs
- Log errors for debugging
- Graceful degradation (show error in cell for formula errors)

### Error Types
- `FormulaError`: Invalid formula syntax
- `CircularRefError`: Circular reference detected
- `FileError`: File I/O errors
- `InvalidRefError`: Invalid cell reference

## Performance Considerations

### Optimization Strategies
1. **Lazy Evaluation**: Only recalculate affected cells
2. **Virtualized Rendering**: Only render visible cells
3. **Dependency Graph**: Track cell dependencies for efficient recalculation
4. **Debouncing**: Debounce rapid cell edits

### Scalability Limits (MVP)
- Grid size: Unlimited (sparse storage using nested maps)
- Practical limit: ~100,000 populated cells for responsive UI
- Max formula depth: 10 levels (prevent stack overflow)
- File size: Limited by available memory
- Row/column operations: O(n) where n = cells in that row/column

## Testing Strategy

### Unit Tests
- Formula parser and evaluator
- Cell reference parsing
- Binary serialization/deserialization
- Spreadsheet model operations

### Integration Tests
- File save/load round-trip
- Formula recalculation with dependencies
- UI event handling (where feasible)

### Manual Testing
- UI responsiveness
- Keyboard navigation
- File dialog interactions
- Error message clarity

## Security Considerations

### Input Validation
- Sanitize cell values (prevent injection)
- Validate file paths
- Limit formula complexity (prevent DoS)

### File Safety
- Validate binary format before loading (magic number check)
- Handle malformed files gracefully
- Confirm before overwriting files
- Use `.gsh` extension for GoSheet files

## Future Enhancements (Post-MVP)

### Phase 2
- Undo/redo stack
- Copy/paste (single cell)
- Cell formatting (basic)

### Phase 3
- Multi-cell selection
- Column/row resize
- More formula functions

### Phase 4
- Multi-sheet support
- Export to Excel format
- Advanced formatting
