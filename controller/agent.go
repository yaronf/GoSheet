package controller

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"

	"gosheet/model"
)

// AgentScope controls what an agent token may do.
type AgentScope string

const (
	ScopeReadOnly  AgentScope = "ro"
	ScopeReadWrite AgentScope = "rw"
)

// AgentSession holds all state for one active agent session.
type AgentSession struct {
	Token    string
	AgentID  string
	Scope    AgentScope
	History  *History // separate from the user History
	filePath string   // file at session-open time (for audit log)
}

// AgentManager manages a single active agent session per AppController.
// All methods are safe for concurrent use (protected by the controller's mu).
type AgentManager struct {
	mu      sync.RWMutex
	session *AgentSession
	audit   *AuditLogger
}

func newAgentManager(audit *AuditLogger) *AgentManager {
	return &AgentManager{audit: audit}
}

// OpenSession creates a new agent session. Returns 409 error if one is already active.
func (m *AgentManager) OpenSession(scope AgentScope, filePath string) (*AgentSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.session != nil {
		return nil, fmt.Errorf("agent session already active")
	}

	token, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("token generation failed: %w", err)
	}
	agentID, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("agentId generation failed: %w", err)
	}
	// Use a short prefix for readability. RawURLEncoding output is ASCII so
	// byte-slicing [:8] is safe and equivalent to rune-slicing here.
	agentID = "agt_" + agentID[:8]

	sess := &AgentSession{
		Token:    token,
		AgentID:  agentID,
		Scope:    scope,
		History:  NewHistory(),
		filePath: filePath,
	}
	m.session = sess

	if m.audit != nil {
		m.audit.Log(AuditEvent{
			AgentID:  agentID,
			Event:    "session_open",
			FilePath: filePath,
		})
	}

	return sess, nil
}

// Validate returns the active session if the token matches, or an error.
func (m *AgentManager) Validate(token string) (*AgentSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.session == nil || m.session.Token != token {
		return nil, fmt.Errorf("invalid or expired agent token")
	}
	return m.session, nil
}

// ActiveSession returns the current session without token validation, or nil.
func (m *AgentManager) ActiveSession() *AgentSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.session
}

// Commit collapses the agent history into a single AgentCommitCommand and pushes
// it onto the user history. The agent token remains active and a new history marker
// is effectively set (agent History is reset to empty).
// ctrl.mu must be held by the caller.
func (m *AgentManager) Commit(userHistory *History) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.session == nil {
		return fmt.Errorf("no active agent session")
	}

	if err := collapseAgentHistory(m.session.History, userHistory); err != nil {
		return err
	}
	// Reset agent history (new checkpoint)
	m.session.History = NewHistory()

	if m.audit != nil {
		m.audit.Log(AuditEvent{
			AgentID:  m.session.AgentID,
			Event:    "commit",
			FilePath: m.session.filePath,
		})
	}

	return nil
}

// End collapses any remaining agent history into user history and revokes the token.
// ctrl.mu must be held by the caller.
func (m *AgentManager) End(userHistory *History) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.session == nil {
		return fmt.Errorf("no active agent session")
	}

	if err := collapseAgentHistory(m.session.History, userHistory); err != nil {
		return err
	}

	if m.audit != nil {
		m.audit.Log(AuditEvent{
			AgentID:  m.session.AgentID,
			Event:    "end",
			FilePath: m.session.filePath,
		})
	}

	m.session = nil
	return nil
}

// Rollback undoes all agent history commands back to the beginning (or last commit
// checkpoint, which is represented by the current stack bottom since Commit resets it).
// ctrl.mu must be held by the caller.
func (m *AgentManager) Rollback() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.session == nil {
		return fmt.Errorf("no active agent session")
	}

	h := m.session.History
	for h.CanUndo() {
		if err := h.Undo(); err != nil {
			return fmt.Errorf("rollback failed: %w", err)
		}
	}

	if m.audit != nil {
		m.audit.Log(AuditEvent{
			AgentID:  m.session.AgentID,
			Event:    "rollback",
			FilePath: m.session.filePath,
		})
	}

	m.session = nil
	return nil
}

// LogPatch records a patch event in the audit log.
func (m *AgentManager) LogPatch(agentID, filePath, description string, opsCount int, outcome string) {
	if m.audit != nil {
		m.audit.Log(AuditEvent{
			AgentID:     agentID,
			Event:       "patch",
			FilePath:    filePath,
			Description: description,
			OpsCount:    opsCount,
			Outcome:     outcome,
		})
	}
}

// collapseAgentHistory drains sess history into userHistory as one AgentCommitCommand.
// No-op if the agent history is empty. userHistory may be nil (noop).
func collapseAgentHistory(agentHistory, userHistory *History) error {
	if !agentHistory.CanUndo() {
		return nil // nothing to collapse
	}
	if userHistory == nil {
		return nil
	}

	// Collect all commands from agent history (bottom to top order).
	// copy() copies interface values (pointer + type), so the Command objects
	// themselves are shared. This is intentional: Do() is a no-op and the undo
	// snapshots inside each command are already frozen at execution time.
	cmds := make([]Command, len(agentHistory.undoStack))
	copy(cmds, agentHistory.undoStack)

	collapsed := &AgentCommitCommand{cmds: cmds}
	// Do() is a no-op (already applied), just push onto user stack
	userHistory.undoStack = append(userHistory.undoStack, collapsed)
	if len(userHistory.undoStack) > HistoryCap {
		userHistory.undoStack = userHistory.undoStack[1:]
	}
	userHistory.redoStack = nil

	return nil
}

// AgentCommitCommand is a collapsed snapshot of all agent operations in a session segment.
// Do() is a no-op (changes are already applied). Undo() replays all constituent Undo()s
// in reverse order, giving the user a single Cmd+Z to revert everything the agent did.
type AgentCommitCommand struct {
	cmds []Command
}

func (c *AgentCommitCommand) Do() error { return nil }

func (c *AgentCommitCommand) Undo() error {
	for i := len(c.cmds) - 1; i >= 0; i-- {
		if err := c.cmds[i].Undo(); err != nil {
			return fmt.Errorf("agent undo step %d: %w", i, err)
		}
	}
	return nil
}

func (c *AgentCommitCommand) Description() string {
	return fmt.Sprintf("Agent (%d operation(s))", len(c.cmds))
}

// GenerateToken creates a cryptographically random URL-safe token.
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// generateToken is the internal alias.
func generateToken() (string, error) { return GenerateToken() }

// ── Agent command factory functions ───────────────────────────────────────────
// These wrap existing command types without calling History.Push() — the caller
// calls Do() explicitly and records the command via History.PushDone().

// AgentPatchCommand groups a set of already-executed commands so that a single
// Undo() call reverts the entire patch atomically.
type AgentPatchCommand struct {
	cmds        []Command
	description string
}

// NewAgentPatchCommand creates an AgentPatchCommand wrapping the given commands.
// Do() is a no-op (commands are already applied); Undo() reverses them in order.
func NewAgentPatchCommand(cmds []Command, description string) *AgentPatchCommand {
	return &AgentPatchCommand{cmds: cmds, description: description}
}

func (c *AgentPatchCommand) Do() error { return nil }

func (c *AgentPatchCommand) Undo() error {
	for i := len(c.cmds) - 1; i >= 0; i-- {
		if err := c.cmds[i].Undo(); err != nil {
			return fmt.Errorf("patch undo step %d: %w", i, err)
		}
	}
	return nil
}

func (c *AgentPatchCommand) Description() string {
	if c.description != "" {
		return "Agent patch: " + c.description
	}
	return fmt.Sprintf("Agent patch (%d op(s))", len(c.cmds))
}

// NewAgentSetCellCommand returns a SetCellCommand without snapshotting prevCell upfront;
// Do() captures the snapshot at execution time (same as the normal path).
func NewAgentSetCellCommand(ctrl *AppController, row, col int, value string) Command {
	prev := ctrl.Sheet.GetCell(row, col)
	var prevCopy *model.Cell
	if prev != nil {
		cp := *prev
		prevCopy = &cp
	}
	return &SetCellCommand{ctrl: ctrl, row: row, col: col, newValue: value, prevCell: prevCopy}
}

// NewAgentClearRangeCommand returns a ClearRangeCommand with a pre-captured snapshot.
func NewAgentClearRangeCommand(ctrl *AppController, startRow, startCol, endRow, endCol int) Command {
	prev := make(map[int]map[int]*model.Cell)
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			if !ctrl.Sheet.ShouldClearCell(row, col) {
				continue
			}
			cell := ctrl.Sheet.GetCell(row, col)
			if cell == nil {
				continue
			}
			if prev[row] == nil {
				prev[row] = make(map[int]*model.Cell)
			}
			cp := *cell
			prev[row][col] = &cp
		}
	}
	return &ClearRangeCommand{
		ctrl:      ctrl,
		startRow:  startRow,
		startCol:  startCol,
		endRow:    endRow,
		endCol:    endCol,
		prevCells: prev,
	}
}

// NewAgentInsertRowCommand returns an InsertRowCommand.
func NewAgentInsertRowCommand(ctrl *AppController, row int) Command {
	return &InsertRowCommand{ctrl: ctrl, row: row}
}

// NewAgentDeleteRowCommand returns a DeleteRowCommand (snapshot captured in Do()).
func NewAgentDeleteRowCommand(ctrl *AppController, row int) Command {
	return &DeleteRowCommand{ctrl: ctrl, row: row}
}

// NewAgentInsertColumnCommand returns an InsertColumnCommand.
func NewAgentInsertColumnCommand(ctrl *AppController, col int) Command {
	return &InsertColumnCommand{ctrl: ctrl, col: col}
}

// NewAgentDeleteColumnCommand returns a DeleteColumnCommand (snapshot captured in Do()).
func NewAgentDeleteColumnCommand(ctrl *AppController, col int) Command {
	return &DeleteColumnCommand{ctrl: ctrl, col: col}
}

// NewAgentSetStyleCommand returns a command that applies a styleId and/or alignment to a cell.
// If styleId == 0 and alignment == "", this is effectively a no-op but still safe to execute.
func NewAgentSetStyleCommand(ctrl *AppController, row, col, styleID int, alignment string) Command {
	return &agentSetStyleCommand{ctrl: ctrl, row: row, col: col, styleID: styleID, alignment: alignment}
}

// agentSetStyleCommand applies styleId and alignment to a cell atomically.
type agentSetStyleCommand struct {
	ctrl          *AppController
	row, col      int
	styleID       int
	alignment     string
	prevStyleID   int
	prevAlignment string
}

func (c *agentSetStyleCommand) Do() error {
	cell := c.ctrl.Sheet.GetCell(c.row, c.col)
	if cell != nil {
		c.prevStyleID = cell.StyleId
		c.prevAlignment = cell.Alignment
	}
	if c.styleID != 0 {
		if err := c.ctrl.Sheet.ApplyStyleToCell(c.row, c.col, c.styleID); err != nil {
			return err
		}
	}
	if c.alignment != "" {
		if err := c.ctrl.Sheet.SetCellAlignment(c.row, c.col, c.alignment); err != nil {
			return err
		}
	}
	return nil
}

func (c *agentSetStyleCommand) Undo() error {
	cell := c.ctrl.Sheet.GetCell(c.row, c.col)
	if cell == nil {
		return nil
	}
	cell.StyleId = c.prevStyleID
	cell.Alignment = c.prevAlignment
	c.ctrl.Sheet.Modified = true
	return nil
}

func (c *agentSetStyleCommand) Description() string {
	return "Set Style " + model.CoordsToRef(c.row, c.col)
}

// NewAgentAddStyleCommand creates a new named style. The style is added in Do()
// and the resulting ID is used to undo by deleting it.
func NewAgentAddStyleCommand(ctrl *AppController, name, fontColor, fillColor string) Command {
	return &agentAddStyleCommand{ctrl: ctrl, name: name, fontColor: fontColor, fillColor: fillColor}
}

type agentAddStyleCommand struct {
	ctrl      *AppController
	name      string
	fontColor string
	fillColor string
	createdID int // set by Do()
}

func (c *agentAddStyleCommand) Do() error {
	format := &model.CellFormat{
		Font: model.Font{Color: c.fontColor},
		Fill: model.Fill{Pattern: "solid", FgColor: c.fillColor, BgColor: c.fillColor},
	}
	id, err := c.ctrl.Sheet.Styles.AddStyle(c.name, format)
	if err != nil {
		return err
	}
	c.createdID = id
	c.ctrl.Sheet.Modified = true
	return nil
}

func (c *agentAddStyleCommand) Undo() error {
	if c.createdID == 0 {
		return nil
	}
	return c.ctrl.Sheet.DeleteStyle(c.createdID)
}

func (c *agentAddStyleCommand) Description() string {
	return "Add Style " + c.name
}

// NewAgentClearFormatCommand returns a ClearRangeFormatCommand.
func NewAgentClearFormatCommand(ctrl *AppController, startRow, startCol, endRow, endCol int) Command {
	return &ClearRangeFormatCommand{ctrl: ctrl, startRow: startRow, startCol: startCol, endRow: endRow, endCol: endCol}
}
