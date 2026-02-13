# Formula Grammar: Participle Implementation

**Status**: Approved.

## Grammar Definition

Using participle's struct tag syntax to define the formula grammar:

```go
package model

// Formula is the root of the AST
type Formula struct {
    Expr *Expression `"=" @@`
}

// Expression handles operator precedence
type Expression struct {
    Comparison *Comparison `@@`
}

type Comparison struct {
    Left  *Addition   `@@`
    Op    string      `[ @( "=" | "!=" | "<" | "<=" | ">" | ">=" )`
    Right *Comparison `  @@ ]`
}

type Addition struct {
    Left  *Multiplication `@@`
    Op    string          `[ @( "+" | "-" )`
    Right *Addition       `  @@ ]`
}

type Multiplication struct {
    Left  *Unary          `@@`
    Op    string          `[ @( "*" | "/" | "%" )`
    Right *Multiplication `  @@ ]`
}

type Unary struct {
    Op      string   `  ( @( "+" | "-" )`
    Unary   *Unary   `    @@ )`
    Primary *Primary `| @@`
}

type Primary struct {
    Number   *float64  `  @Float | @Int`
    String   *string   `| @String`
    CellRef  *CellRef  `| @@`
    Range    *Range    `| @@`
    FuncCall *FuncCall `| @@`
    SubExpr  *Expression `| "(" @@ ")"`
}

// CellRef as parsed from formula (string column)
type CellRef struct {
    ColStr string `@Ident`  // "A", "B", "AA", etc. (captured from input by participle)
    Row    int    `@Int`    // 1, 2, 3, etc. (captured from input by participle)
}

// After parsing, convert to numeric coordinates for internal use
func (c *CellRef) ToCoords() (row, col int) {
    col = ColLetterToIndex(c.ColStr)  // "A" → 0, "B" → 1, "AA" → 26, etc.
    row = c.Row - 1                    // Convert 1-indexed to 0-indexed: 1 → 0, 2 → 1
    return row, col
}

// Helper function: Convert column letter to 0-indexed integer
// "A" → 0, "B" → 1, "Z" → 25, "AA" → 26, "AB" → 27, etc.
func ColLetterToIndex(col string) int {
    result := 0
    for i := 0; i < len(col); i++ {
        result = result*26 + int(col[i]-'A') + 1
    }
    return result - 1
}

type Range struct {
    Start *CellRef `@@`
    End   *CellRef `":" @@`
}

type FuncCall struct {
    Name string       `@Ident`
    Args []*Expression `"(" [ @@ { "," @@ } ] ")"`
}
```

## Lexer Definition

Using participle's stateful lexer:

```go
var formulaLexer = lexer.MustSimple([]lexer.SimpleRule{
    {"Float", `\d+\.\d+`},
    {"Int", `\d+`},
    {"String", `"(?:\\.|[^"])*"`},
    {"Ident", `[A-Za-z_][A-Za-z0-9_]*`},
    {"Punct", `[=!<>+\-*/%():,]`},
    {"Whitespace", `[ \t\n\r]+`},
})
```

## Parser Construction

```go
var formulaParser = participle.MustBuild[Formula](
    participle.Lexer(formulaLexer),
    participle.Elide("Whitespace"),
    participle.UseLookahead(2),
)
```

## Example Parses

### Simple Arithmetic
```
Input:  =2 + 2
AST:    Formula{
          Expr: Expression{
            Comparison: Comparison{
              Left: Addition{
                Left: Multiplication{
                  Unary: Unary{
                    Primary: Primary{Number: 2}
                  }
                },
                Op: "+",
                Right: Addition{
                  Left: Multiplication{
                    Unary: Unary{
                      Primary: Primary{Number: 2}
                    }
                  }
                }
              }
            }
          }
        }
```

### Cell Reference
```
Input:  =A1 + B2
Parse:  CellRef{ColStr: "A", Row: 1}, CellRef{ColStr: "B", Row: 2}
Convert: CellRef{Col: 0, Row: 0}, CellRef{Col: 1, Row: 1}  // 0-indexed
AST:    Formula{
          Expr: Expression{
            Comparison: Comparison{
              Left: Addition{
                Left: Multiplication{
                  Unary: Unary{
                    Primary: Primary{
                      CellRef: CellRef{Col: 0, Row: 0}  // A1 → (0,0)
                    }
                  }
                },
                Op: "+",
                Right: Addition{
                  Left: Multiplication{
                    Unary: Unary{
                      Primary: Primary{
                        CellRef: CellRef{Col: 1, Row: 1}  // B2 → (1,1)
                      }
                    }
                  }
                }
              }
            }
          }
        }
```

### Function with Range
```
Input:  =SUM(A1:A10)
Parse:  Range{Start: CellRef{ColStr: "A", Row: 1}, End: CellRef{ColStr: "A", Row: 10}}
Convert: Range{Start: CellRef{Col: 0, Row: 0}, End: CellRef{Col: 0, Row: 9}}  // 0-indexed
AST:    Formula{
          Expr: Expression{
            Comparison: Comparison{
              Left: Addition{
                Left: Multiplication{
                  Unary: Unary{
                    Primary: Primary{
                      FuncCall: FuncCall{
                        Name: "SUM",
                        Args: []*Expression{
                          Expression{
                            Comparison: Comparison{
                              Left: Addition{
                                Left: Multiplication{
                                  Unary: Unary{
                                    Primary: Primary{
                                      Range: Range{
                                        Start: CellRef{Col: 0, Row: 0},   // A1
                                        End: CellRef{Col: 0, Row: 9}      // A10
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
```

## Evaluation

### Value Types

```go
type Value interface {
    value()
}

type NumberValue struct {
    Value float64
}

type StringValue struct {
    Value string
}

type VectorValue struct {
    Values []Value
}

type ErrorValue struct {
    Error error
}
```

### Evaluator

```go
func Evaluate(formula *Formula, sheet *Spreadsheet) (Value, error) {
    return evaluateExpression(formula.Expr, sheet)
}

func evaluateExpression(expr *Expression, sheet *Spreadsheet) (Value, error) {
    return evaluateComparison(expr.Comparison, sheet)
}

func evaluateComparison(comp *Comparison, sheet *Spreadsheet) (Value, error) {
    left, err := evaluateAddition(comp.Left, sheet)
    if err != nil {
        return nil, err
    }
    
    if comp.Op == "" {
        return left, nil
    }
    
    right, err := evaluateComparison(comp.Right, sheet)
    if err != nil {
        return nil, err
    }
    
    return applyComparisonOp(left, comp.Op, right)
}

// ... similar for other expression types

func evaluatePrimary(prim *Primary, sheet *Spreadsheet) (Value, error) {
    if prim.Number != nil {
        return NumberValue{*prim.Number}, nil
    }
    
    if prim.String != nil {
        return StringValue{*prim.String}, nil
    }
    
    if prim.CellRef != nil {
        return evaluateCellRef(prim.CellRef, sheet)
    }
    
    if prim.Range != nil {
        return evaluateRange(prim.Range, sheet)
    }
    
    if prim.FuncCall != nil {
        return evaluateFuncCall(prim.FuncCall, sheet)
    }
    
    if prim.SubExpr != nil {
        return evaluateExpression(prim.SubExpr, sheet)
    }
    
    return nil, errors.New("invalid primary expression")
}
```

### Vector Operations (Lazy Evaluation)

```go
type Vector struct {
    sheet *Spreadsheet
    start CellRef  // Already has Col and Row as integers
    end   CellRef
}

// Iterator pattern for lazy evaluation
func (v *Vector) ForEach(fn func(Value) error) error {
    startRow, startCol := v.start.Row, v.start.Col
    endRow, endCol := v.end.Row, v.end.Col
    
    for row := startRow; row <= endRow; row++ {
        for col := startCol; col <= endCol; col++ {
            cell := v.sheet.GetCell(row, col)
            var val Value
            if cell == nil {
                val = NumberValue{0}
            } else {
                val = parseValue(cell.Computed)
            }
            if err := fn(val); err != nil {
                return err
            }
        }
    }
    return nil
}

// SUM function using lazy evaluation
func sumFunction(args []Value) (Value, error) {
    sum := 0.0
    
    for _, arg := range args {
        switch v := arg.(type) {
        case NumberValue:
            sum += v.Value
        case VectorValue:
            // Vector from range
            vec := v.Vector
            err := vec.ForEach(func(val Value) error {
                if num, ok := val.(NumberValue); ok {
                    sum += num.Value
                }
                return nil
            })
            if err != nil {
                return nil, err
            }
        default:
            return nil, errors.New("invalid argument type for SUM")
        }
    }
    
    return NumberValue{sum}, nil
}
```

## Function Registry

```go
var builtinFunctions = map[string]func([]Value) (Value, error){
    "SUM":   sumFunction,
    "AVG":   avgFunction,
    "MIN":   minFunction,
    "MAX":   maxFunction,
    "COUNT": countFunction,
}

func evaluateFuncCall(call *FuncCall, sheet *Spreadsheet) (Value, error) {
    fn, ok := builtinFunctions[strings.ToUpper(call.Name)]
    if !ok {
        return nil, fmt.Errorf("unknown function: %s", call.Name)
    }
    
    args := make([]Value, len(call.Args))
    for i, argExpr := range call.Args {
        val, err := evaluateExpression(argExpr, sheet)
        if err != nil {
            return nil, err
        }
        args[i] = val
    }
    
    return fn(args)
}
```

## Dependency Extraction

```go
func ExtractDependencies(formula *Formula) ([]CellRef, []Range, error) {
    var cellRefs []CellRef
    var ranges []Range
    
    // Walk the AST and collect all CellRef and Range nodes
    visitExpression(formula.Expr, func(prim *Primary) {
        if prim.CellRef != nil {
            cellRefs = append(cellRefs, *prim.CellRef)
        }
        if prim.Range != nil {
            ranges = append(ranges, *prim.Range)
        }
        if prim.FuncCall != nil {
            for _, arg := range prim.FuncCall.Args {
                visitExpression(arg, /* recursive */)
            }
        }
    })
    
    return cellRefs, ranges, nil
}
```

## Testing Strategy

### Parser Tests
```go
func TestParseSimpleArithmetic(t *testing.T) {
    ast, err := formulaParser.ParseString("", "=2+2")
    assert.NoError(t, err)
    assert.NotNil(t, ast)
}

func TestParseCellReference(t *testing.T) {
    ast, err := formulaParser.ParseString("", "=A1+B2")
    assert.NoError(t, err)
    // After conversion: A → 0, B → 1
    assert.Equal(t, 0, ast.Expr.Comparison.Left.Left.Unary.Primary.CellRef.Col)
    assert.Equal(t, 0, ast.Expr.Comparison.Left.Left.Unary.Primary.CellRef.Row)
}

func TestParseRange(t *testing.T) {
    ast, err := formulaParser.ParseString("", "=SUM(A1:A10)")
    assert.NoError(t, err)
    // Verify Range node exists
}
```

### Evaluator Tests
```go
func TestEvaluateSimpleArithmetic(t *testing.T) {
    ast, _ := formulaParser.ParseString("", "=2+2")
    sheet := NewSpreadsheet()
    result, err := Evaluate(ast, sheet)
    assert.NoError(t, err)
    assert.Equal(t, 4.0, result.(NumberValue).Value)
}

func TestEvaluateSumRange(t *testing.T) {
    sheet := NewSpreadsheet()
    sheet.SetCell(0, 0, "1")  // A1
    sheet.SetCell(1, 0, "2")  // A2
    sheet.SetCell(2, 0, "3")  // A3
    
    ast, _ := formulaParser.ParseString("", "=SUM(A1:A3)")
    result, err := Evaluate(ast, sheet)
    assert.NoError(t, err)
    assert.Equal(t, 6.0, result.(NumberValue).Value)
}
```

## Performance Characteristics

### Scalability
- **Parsing**: O(n) where n = formula length
- **Range evaluation**: O(k) where k = cells in range (lazy iteration)
- **Memory**: O(1) for ranges (no expansion)
- **Large ranges**: `SUM(A1:A100000)` is efficient (lazy evaluation)

### Example: Large Range
```
Formula: =SUM(A1:A100000)
Memory:  Only stores Range{A1, A100000} in AST
Eval:    Iterates cells one at a time, accumulating sum
Result:  No 100K array allocation
```

## Success Criteria

✅ Parse basic arithmetic: `=2+2`
✅ Parse cell references: `=A1+B2`
✅ Parse ranges with colon: `=SUM(A1:A10)`
✅ Ranges are native vectors (not expanded)
✅ Lazy evaluation for large ranges
✅ Support all required functions: SUM, AVG, MIN, MAX, COUNT
✅ Proper operator precedence
✅ Dependency extraction from AST
✅ Clear error messages with position info
