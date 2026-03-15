# GoSheet Architecture

This document describes the architecture of GoSheet, a lightweight spreadsheet application for macOS. It covers the runtime stack, component responsibilities, data flows, and key design decisions.

---

## 1. System Overview

GoSheet is a native macOS application built with **Electron** wrapping a **Go HTTP backend** and a **vanilla JavaScript frontend**. All spreadsheet operations flow through a REST API, enabling consistent behavior and comprehensive automated testing.

```mermaid
flowchart LR
    subgraph Electron["Electron"]
        MW[Main Process]
        BW[BrowserWindow]
        IPC[IPC]
    end

    subgraph Renderer["Renderer Process"]
        UI[UI]
        AC[API Client]
    end

    subgraph Backend["Go Backend"]
        API[API]
        Ctrl[Controller]
        Model[Model]
    end

    User([User]) --> BW
    Agent([AI Agent]) -->|REST| API
    BW --> Renderer
    UI --> AC
    AC <-->|REST to Backend, SSE for events to Frontend| API
    AC -->|Dialogs| IPC
    IPC --> MW
    MW -->|Spawn| Backend
    API --> Ctrl
    Ctrl --> Model
```

**Key characteristics:**
- **Single-process Go server** bound to an ephemeral port (e.g. `localhost:3000`)
- **Bootstrap token** authenticates all API requests; Electron injects it into the renderer
- **File dialogs** use Electron IPC; actual I/O is performed by the Go backend via `FileService`
- **SSE** (`/api/events`) pushes real-time updates to the frontend (e.g. agent patch → `cells_changed`)
- **No build step** for the frontend — pure ES6 modules loaded directly

---

## 2. Component Layers

```mermaid
flowchart LR
    subgraph Presentation
        FE[Frontend]
    end

    subgraph API["API Layer"]
        Handlers[HTTP Handlers]
        SSE[SSE Broker]
    end

    subgraph Application["Application Layer"]
        AppCtrl[AppController]
        History[Undo/Redo History]
        Agent[Agent Manager]
    end

    subgraph Domain["Domain Layer"]
        Spreadsheet[Spreadsheet]
        Formula[Formula Engine]
        Deps[Dependency Graph]
        File[File I/O]
    end

    FE --> Handlers
    Handlers --> AppCtrl
    AppCtrl --> Spreadsheet
    AppCtrl --> History
    AppCtrl --> Agent
    Spreadsheet --> Formula
    Spreadsheet --> Deps
    Spreadsheet --> File
    Agent --> AppCtrl
    AppCtrl --> SSE
```

### 2.1 Frontend (`frontend/`)

| Module | Responsibility |
|--------|----------------|
| `app.js` | Main entry, grid setup, event routing |
| `app-grid.js` | Virtualized grid rendering, cell selection |
| `app-cell-editor.js` | In-cell editing, formula bar |
| `app-file-ops.js` | New/Open/Save, IPC for dialogs |
| `app-modals.js` | CSV import, style picker, agent session |
| `api-client.js` | HTTP fetch wrapper, Bearer token injection |
| `app-state.js` | Client-side state (selection, edit mode) |

The frontend detects **Electron mode** via `window.electronAPI` and uses IPC for file dialogs; otherwise it uses the browser File API for web/testing.

### 2.2 API Layer (`api/`)

- **HTTP handlers** map REST endpoints to controller methods
- **Auth middleware** validates Bearer token on `/api/*` routes
- **SSE broker** (`/api/events`) pushes real-time updates (e.g. agent patch → `cells_changed`)
- **OpenAPI** (`api/openapi.yaml`) is the single source of truth; Go types and `api-types.d.ts` are generated. The frontend uses `@ts-check` + `api-types.d.ts`; type checking is enforced in CI via `npm run typecheck`

### 2.3 Application Layer (`controller/`)

- **AppController** holds the spreadsheet, undo/redo history, and agent manager
- **Command pattern** for undo/redo: `SetCellCommand`, `SetRangeValuesCommand`, etc.
- **History** maintains undo/redo stacks (cap 100) and tracks save-point depth
- **AgentManager** issues scoped tokens, tracks sessions, and records audit events

### 2.4 Domain Layer (`model/`)

| Package | Responsibility |
|---------|----------------|
| `spreadsheet.go` | Cells, merges, styles; `GetCell`, `SetCell`, `RecalculateAll` |
| `cell.go` | Cell struct (Value, Computed, IsFormula, StyleId) |
| `formula.go` | Parser (Participle), AST, builtins (SUM, AVG, MIN, MAX, COUNT) |
| `formula_eval.go` | Evaluation, range expansion, error handling |
| `formula_shift.go` | Reference shifting on paste/insert/delete |
| `dependencies.go` | Dependency graph for incremental recalculation |
| `file.go` | MessagePack encode/decode, atomic write |
| `style.go` | StyleRegistry, CellFormat, named styles |

---

## 3. Data Flows

### 3.1 Cell Edit Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as HTTP Handler
    participant Ctrl as AppController
    participant Hist as History
    participant Sheet as Spreadsheet
    participant Deps as DependencyGraph

    U->>FE: Type in cell
    FE->>API: POST /api/cell/set {row,col,value}
    API->>Ctrl: SetCellValue(row,col,value)
    Ctrl->>Hist: Push(SetCellCommand)
    Hist->>Sheet: SetCell + RecalculateAll
    Sheet->>Deps: Update dependencies
    Deps->>Sheet: Topological recalc
    Hist-->>Ctrl: OK
    Ctrl-->>API: Success
    API-->>FE: {success: true}
    FE->>FE: Refresh visible cells
```

### 3.2 File Save Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant IPC as Electron IPC
    participant MW as Main Process
    participant API as HTTP Handler
    participant Ctrl as AppController
    participant File as model/file.go

    U->>FE: Cmd+S
    FE->>IPC: invoke save-file-dialog
    IPC->>MW: dialog.showSaveDialog
    MW-->>IPC: path
    IPC-->>FE: path
    FE->>API: POST /api/file/save {path}
    Note over API: Controller uses FileService<br/>ReadFile/WriteFile = os.ReadFile/WriteFile
    API->>Ctrl: SaveToFile(path)
    Ctrl->>File: SaveToFile(sheet, path)
    File->>File: atomicWriteFile (temp + rename)
    File->>File: MessagePack encode
    File-->>Ctrl: OK
    Ctrl->>Ctrl: MarkSaved(), Modified=false
    Ctrl-->>API: Success
    API-->>FE: {success: true}
```

### 3.3 Agent Patch Flow (Real-Time Push)

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant API as HTTP Handler
    participant Ctrl as AppController
    participant Broker as SSE Broker
    participant FE as Frontend

    Agent->>API: PATCH /api/agent/patch {operations}
    API->>Ctrl: HandleAgentPatch
    Ctrl->>Ctrl: Apply patch, set Modified
    Ctrl->>Broker: Broadcast(cells_changed)
    Broker->>FE: SSE event
    FE->>FE: Refresh affected cells
    Ctrl-->>API: Success
    API-->>Agent: 200 OK
```

---

## 4. Formula Engine

```mermaid
flowchart LR
    subgraph Input
        S["=SUM(A1:A10)"]
    end

    subgraph Parse
        L[Lexer]
        P[Participle Parser]
        AST[AST]
    end

    subgraph Eval
        Walk[AST Walk]
        Refs[Resolve Refs]
        Builtins[SUM/AVG/MIN/MAX/COUNT]
        Num[Arithmetic]
    end

    subgraph Output
        V["42.5"]
    end

    S --> L
    L --> P
    P --> AST
    AST --> Walk
    Walk --> Refs
    Walk --> Builtins
    Walk --> Num
    Refs --> V
    Builtins --> V
    Num --> V
```

**Design notes:**
- **Participle** parses formulas into an AST; cell/range refs are first-class
- **Dependency graph** tracks which cells depend on which; `RecalculateAll` uses topological sort
- **Circular reference** detection prevents infinite loops
- **Formula shift** updates refs on paste (relative) and insert/delete rows/cols
- **Absolute refs** (`$A$1`) are preserved during shift

---

## 5. File Format

`.sheet` files use **MessagePack** (v2.0) for cross-language compatibility.

**Top-level structure** (`fileContentV2`): `version` (string "2.0"), `cell_count` (int), `cells` (map: row → col → cellPersist), `merges` (MergeRegion[]), `styles` (StyleRegistry).

**Cell object** (`cellPersist`): `value`, `is_formula`, `is_quote_prefix`, `is_error`, `style_id`. Alignment is in style format, not per-cell.

- **Sparse storage**: only non-empty cells are persisted
- **Computed** is derived on load (not stored)
- **Atomic write**: temp file + `os.Rename` for crash safety
- See `docs/FILE_FORMAT.md` for the full specification

---

## 6. Concurrency and Safety

- **AppController** uses `sync.RWMutex`; all spreadsheet mutations acquire the lock
- **SSE broker** uses non-blocking sends; slow clients are disconnected after 10 missed events
- **Agent sessions** are scoped (read-only or read-write); tokens are CSPRNG, base64url
- **Audit log** writes asynchronously via a buffered channel; `Close()` flushes on shutdown

---

## 7. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Model | `go test` | Formula parser, eval, dependencies, file I/O |
| Controller | `go test` | Commands, undo/redo, agent |
| API | `go test` | Handlers, SSE, auth |
| E2E | Playwright | Electron app, menus, dialogs, file ops |
| Chromium | Playwright | Reliable clicks (single, double, shift) |

---

## 8. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| HTTP API for all ops | Single code path; testable without Electron |
| MessagePack over gob | Cross-language; Python/JS/Rust can read `.sheet` |
| Command pattern for undo | Reversible ops; save-point tracking |
| Ephemeral port | No fixed-port conflicts; Electron reads port from fd 3 |
| Bootstrap token | Simple auth for localhost-only server |
| SSE for agent push | Real-time UI updates without polling |
