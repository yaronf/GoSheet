package controller

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── AgentManager / AgentSession tests ──────────────────────────────────────

func TestOpenSession(t *testing.T) {
	m := newAgentManager(nil)
	sess, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)
	assert.NotEmpty(t, sess.Token)
	assert.Regexp(t, `^agt_`, sess.AgentID)
	assert.Equal(t, ScopeReadWrite, sess.Scope)
	assert.NotNil(t, sess.History)
}

func TestOpenSessionRO(t *testing.T) {
	m := newAgentManager(nil)
	sess, err := m.OpenSession(ScopeReadOnly, "/test/file.sheet")
	require.NoError(t, err)
	assert.Equal(t, ScopeReadOnly, sess.Scope)
}

func TestOpenSessionConflict(t *testing.T) {
	m := newAgentManager(nil)
	_, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	// Second open should return 409-style error
	_, err = m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already active")
}

func TestValidateToken(t *testing.T) {
	m := newAgentManager(nil)
	sess, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	// Correct token
	got, err := m.Validate(sess.Token)
	require.NoError(t, err)
	assert.Equal(t, sess, got)

	// Wrong token
	_, err = m.Validate("bogus-token")
	require.Error(t, err)
}

func TestValidateNoSession(t *testing.T) {
	m := newAgentManager(nil)
	_, err := m.Validate("any-token")
	require.Error(t, err)
}

func TestActiveSession(t *testing.T) {
	m := newAgentManager(nil)
	assert.Nil(t, m.ActiveSession())

	m.OpenSession(ScopeReadWrite, "/test/file.sheet") //nolint:errcheck
	assert.NotNil(t, m.ActiveSession())
}

// ── Commit ──────────────────────────────────────────────────────────────────

func TestCommit(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent

	sess, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	// Put two mockCmds into agent history
	counter := 0
	require.NoError(t, sess.History.Push(newMockCmd(&counter, "op1")))
	require.NoError(t, sess.History.Push(newMockCmd(&counter, "op2")))

	ctrl.LockForAgent()
	err = m.Commit(ctrl.History)
	ctrl.UnlockForAgent()
	require.NoError(t, err)

	// Agent history reset; user history has one AgentCommitCommand
	assert.False(t, sess.History.CanUndo())
	assert.True(t, ctrl.History.CanUndo())
	assert.Equal(t, "Agent (2 operation(s))", ctrl.History.UndoDescription())

	// Token still active
	assert.NotNil(t, m.ActiveSession())
}

func TestCommitEmptyHistory(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent
	_, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	ctrl.LockForAgent()
	err = m.Commit(ctrl.History)
	ctrl.UnlockForAgent()
	require.NoError(t, err)

	// Nothing pushed to user history (empty collapse is a no-op)
	assert.False(t, ctrl.History.CanUndo())
	// Session still active
	assert.NotNil(t, m.ActiveSession())
}

// ── End ─────────────────────────────────────────────────────────────────────

func TestEnd(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent

	sess, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	counter := 0
	require.NoError(t, sess.History.Push(newMockCmd(&counter, "op1")))

	ctrl.LockForAgent()
	err = m.End(ctrl.History)
	ctrl.UnlockForAgent()
	require.NoError(t, err)

	// Session revoked
	assert.Nil(t, m.ActiveSession())
	// User history has the collapsed entry
	assert.True(t, ctrl.History.CanUndo())
}

func TestEndNoSession(t *testing.T) {
	m := newAgentManager(nil)
	err := m.End(NewHistory())
	require.Error(t, err)
}

// ── Rollback ─────────────────────────────────────────────────────────────────

func TestRollback(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent

	// Set a cell value, then start agent session
	require.NoError(t, ctrl.SetCellValue(0, 0, "before"))

	sess, err := m.OpenSession(ScopeReadWrite, "/test/file.sheet")
	require.NoError(t, err)

	// Agent sets cell via the command pattern
	cmd := NewAgentSetCellCommand(ctrl, 0, 0, "agent-value")
	require.NoError(t, cmd.Do())
	sess.History.PushDone(cmd)

	assert.Equal(t, "agent-value", ctrl.Sheet.GetCell(0, 0).Value)

	ctrl.LockForAgent()
	err = m.Rollback()
	ctrl.UnlockForAgent()
	require.NoError(t, err)

	// Session revoked
	assert.Nil(t, m.ActiveSession())
	// Cell value restored
	assert.Equal(t, "before", ctrl.Sheet.GetCell(0, 0).Value)
	// User history unchanged
	assert.False(t, ctrl.History.CanUndo() && ctrl.History.UndoDescription() == "Agent (1 operation(s))")
}

func TestRollbackNoSession(t *testing.T) {
	m := newAgentManager(nil)
	err := m.Rollback()
	require.Error(t, err)
}

// ── collapseAgentHistory ────────────────────────────────────────────────────

func TestCollapseAgentHistory(t *testing.T) {
	agentH := NewHistory()
	userH := NewHistory()

	counter := 0
	require.NoError(t, agentH.Push(newMockCmd(&counter, "a1")))
	require.NoError(t, agentH.Push(newMockCmd(&counter, "a2")))

	require.NoError(t, collapseAgentHistory(agentH, userH))

	assert.True(t, userH.CanUndo())
	assert.Equal(t, "Agent (2 operation(s))", userH.UndoDescription())

	// Undo the collapsed command undoes both in reverse
	require.NoError(t, userH.Undo())
	assert.Equal(t, 0, counter) // both ops reversed
}

func TestCollapseAgentHistoryEmpty(t *testing.T) {
	agentH := NewHistory()
	userH := NewHistory()
	require.NoError(t, collapseAgentHistory(agentH, userH))
	assert.False(t, userH.CanUndo())
}

// ── AgentCommitCommand ──────────────────────────────────────────────────────

func TestAgentCommitCommandUndo(t *testing.T) {
	counter := 0
	cmd1 := newMockCmd(&counter, "c1")
	cmd2 := newMockCmd(&counter, "c2")
	// Simulate already-applied state
	require.NoError(t, cmd1.Do())
	require.NoError(t, cmd2.Do())
	assert.Equal(t, 2, counter)

	acc := &AgentCommitCommand{cmds: []Command{cmd1, cmd2}}
	assert.Equal(t, "Agent (2 operation(s))", acc.Description())
	assert.NoError(t, acc.Do()) // no-op

	require.NoError(t, acc.Undo())
	assert.Equal(t, 0, counter) // reversed in reverse order
}

// ── AgentPatchCommand ───────────────────────────────────────────────────────

func TestAgentPatchCommandUndoReversesInOrder(t *testing.T) {
	order := []string{}
	tc := func(name string) Command {
		return &struct {
			name string
			list *[]string
			mockCmd
		}{
			name: name,
			list: &order,
			mockCmd: mockCmd{
				counter:     new(int),
				description: name,
			},
		}
	}
	_ = tc // avoid "declared and not used" for the unused inline type

	// Use mockCmds and track undo order
	undoOrder := []string{}
	counter := 0
	c1 := &trackingCmd{name: "c1", undoOrder: &undoOrder, counter: &counter}
	c2 := &trackingCmd{name: "c2", undoOrder: &undoOrder, counter: &counter}
	c3 := &trackingCmd{name: "c3", undoOrder: &undoOrder, counter: &counter}

	require.NoError(t, c1.Do())
	require.NoError(t, c2.Do())
	require.NoError(t, c3.Do())

	patch := NewAgentPatchCommand([]Command{c1, c2, c3}, "test patch")
	assert.Contains(t, patch.Description(), "test patch")
	require.NoError(t, patch.Do()) // no-op

	require.NoError(t, patch.Undo())
	assert.Equal(t, []string{"c3", "c2", "c1"}, undoOrder)
}

// trackingCmd records its undo call name for ordering tests.
type trackingCmd struct {
	name      string
	undoOrder *[]string
	counter   *int
}

func (t *trackingCmd) Do() error {
	*t.counter++
	return nil
}
func (t *trackingCmd) Undo() error {
	*t.undoOrder = append(*t.undoOrder, t.name)
	*t.counter--
	return nil
}
func (t *trackingCmd) Description() string { return t.name }

// ── PushDone ────────────────────────────────────────────────────────────────

func TestPushDoneDoesNotCallDo(t *testing.T) {
	h := NewHistory()
	counter := 0
	cmd := newMockCmd(&counter, "pre-applied")
	// Simulate already applied — counter is 1
	require.NoError(t, cmd.Do())
	assert.Equal(t, 1, counter)

	// PushDone should NOT call Do again
	h.PushDone(cmd)
	assert.Equal(t, 1, counter) // still 1, not 2

	assert.True(t, h.CanUndo())
	assert.Equal(t, "pre-applied", h.UndoDescription())

	// Undo should work normally
	require.NoError(t, h.Undo())
	assert.Equal(t, 0, counter)
}

func TestPushDoneEnforcesCapAndClearsRedo(t *testing.T) {
	h := NewHistory()
	counter := 0

	// Fill past cap
	for i := 0; i < HistoryCap+5; i++ {
		h.PushDone(newMockCmd(&counter, "cmd"))
	}
	assert.Equal(t, HistoryCap, len(h.undoStack))
	assert.Nil(t, h.redoStack)
}

// ── Factory functions ────────────────────────────────────────────────────────

func TestNewAgentSetCellCommand(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "original"))

	cmd := NewAgentSetCellCommand(ctrl, 0, 0, "new-value")
	require.NoError(t, cmd.Do())
	assert.Equal(t, "new-value", ctrl.Sheet.GetCell(0, 0).Value)

	require.NoError(t, cmd.Undo())
	assert.Equal(t, "original", ctrl.Sheet.GetCell(0, 0).Value)
}

func TestNewAgentClearRangeCommand(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "B"))

	cmd := NewAgentClearRangeCommand(ctrl, 0, 0, 0, 1)
	require.NoError(t, cmd.Do())
	// ClearRange zeroes the cell value but may leave an empty cell struct
	c0 := ctrl.Sheet.GetCell(0, 0)
	c1 := ctrl.Sheet.GetCell(0, 1)
	assert.True(t, c0 == nil || c0.Value == "")
	assert.True(t, c1 == nil || c1.Value == "")

	require.NoError(t, cmd.Undo())
	assert.Equal(t, "A", ctrl.Sheet.GetCell(0, 0).Value)
	assert.Equal(t, "B", ctrl.Sheet.GetCell(0, 1).Value)
}

func TestNewAgentInsertDeleteRowCommand(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "row0"))
	require.NoError(t, ctrl.SetCellValue(1, 0, "row1"))

	// Insert row at 0 → shifts row0 to row1
	cmd := NewAgentInsertRowCommand(ctrl, 0)
	require.NoError(t, cmd.Do())
	assert.Nil(t, ctrl.Sheet.GetCell(0, 0))
	assert.Equal(t, "row0", ctrl.Sheet.GetCell(1, 0).Value)

	require.NoError(t, cmd.Undo())
	assert.Equal(t, "row0", ctrl.Sheet.GetCell(0, 0).Value)

	// Delete row
	cmd2 := NewAgentDeleteRowCommand(ctrl, 0)
	require.NoError(t, cmd2.Do())
	assert.Equal(t, "row1", ctrl.Sheet.GetCell(0, 0).Value)
	require.NoError(t, cmd2.Undo())
	assert.Equal(t, "row0", ctrl.Sheet.GetCell(0, 0).Value)
}

func TestNewAgentInsertDeleteColumnCommand(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "col0"))
	require.NoError(t, ctrl.SetCellValue(0, 1, "col1"))

	cmd := NewAgentInsertColumnCommand(ctrl, 0)
	require.NoError(t, cmd.Do())
	assert.Nil(t, ctrl.Sheet.GetCell(0, 0))
	assert.Equal(t, "col0", ctrl.Sheet.GetCell(0, 1).Value)
	require.NoError(t, cmd.Undo())
	assert.Equal(t, "col0", ctrl.Sheet.GetCell(0, 0).Value)

	cmd2 := NewAgentDeleteColumnCommand(ctrl, 0)
	require.NoError(t, cmd2.Do())
	assert.Equal(t, "col1", ctrl.Sheet.GetCell(0, 0).Value)
	require.NoError(t, cmd2.Undo())
	assert.Equal(t, "col0", ctrl.Sheet.GetCell(0, 0).Value)
}

func TestNewAgentAddStyleCommand(t *testing.T) {
	ctrl := NewAppController()
	cmd := NewAgentAddStyleCommand(ctrl, "Highlight", "#FF0000", "#FFFF00")
	require.NoError(t, cmd.Do())
	// Style should exist in registry now
	id := ctrl.Sheet.Styles.GetStyleIDByName("Highlight")
	assert.Greater(t, id, 0)

	require.NoError(t, cmd.Undo())
	id = ctrl.Sheet.Styles.GetStyleIDByName("Highlight")
	assert.Equal(t, 0, id)
}

func TestNewAgentClearFormatCommand(t *testing.T) {
	ctrl := NewAppController()
	require.NoError(t, ctrl.SetCellValue(0, 0, "hello"))
	// Apply a style first
	require.NoError(t, ctrl.Sheet.ApplyStyleToCell(0, 0, 1))

	cmd := NewAgentClearFormatCommand(ctrl, 0, 0, 0, 0)
	require.NoError(t, cmd.Do())
	cell := ctrl.Sheet.GetCell(0, 0)
	assert.Equal(t, 0, cell.StyleId)

	require.NoError(t, cmd.Undo())
	// Style should be restored
	cell = ctrl.Sheet.GetCell(0, 0)
	assert.Equal(t, 1, cell.StyleId)
}

// ── Full session integration ─────────────────────────────────────────────────

func TestSessionCommitThenUndo(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent

	sess, err := m.OpenSession(ScopeReadWrite, "/test.sheet")
	require.NoError(t, err)

	// Agent sets two cells
	cmd1 := NewAgentSetCellCommand(ctrl, 0, 0, "A")
	cmd2 := NewAgentSetCellCommand(ctrl, 0, 1, "B")
	require.NoError(t, cmd1.Do())
	require.NoError(t, cmd2.Do())
	sess.History.PushDone(NewAgentPatchCommand([]Command{cmd1, cmd2}, "two cells"))

	// Commit — collapses to single user undo
	ctrl.LockForAgent()
	require.NoError(t, m.Commit(ctrl.History))
	ctrl.UnlockForAgent()

	// End session
	ctrl.LockForAgent()
	require.NoError(t, m.End(ctrl.History))
	ctrl.UnlockForAgent()

	assert.Equal(t, "A", ctrl.Sheet.GetCell(0, 0).Value)
	assert.Equal(t, "B", ctrl.Sheet.GetCell(0, 1).Value)

	// Undo once → both cells cleared
	require.NoError(t, ctrl.History.Undo())
	assert.Nil(t, ctrl.Sheet.GetCell(0, 0))
	assert.Nil(t, ctrl.Sheet.GetCell(0, 1))
}

func TestSessionRollbackReverts(t *testing.T) {
	ctrl := NewAppController()
	m := ctrl.Agent

	sess, err := m.OpenSession(ScopeReadWrite, "/test.sheet")
	require.NoError(t, err)

	cmd := NewAgentSetCellCommand(ctrl, 2, 0, "willBeRolledBack")
	require.NoError(t, cmd.Do())
	sess.History.PushDone(cmd)

	assert.Equal(t, "willBeRolledBack", ctrl.Sheet.GetCell(2, 0).Value)

	ctrl.LockForAgent()
	require.NoError(t, m.Rollback())
	ctrl.UnlockForAgent()

	assert.Nil(t, ctrl.Sheet.GetCell(2, 0))
	assert.Nil(t, m.ActiveSession())
}

// ── GenerateToken ────────────────────────────────────────────────────────────

func TestGenerateToken(t *testing.T) {
	t1, err := GenerateToken()
	require.NoError(t, err)
	assert.NotEmpty(t, t1)

	t2, err := GenerateToken()
	require.NoError(t, err)
	assert.NotEqual(t, t1, t2) // tokens should be unique
}

// ── AuditLogger ──────────────────────────────────────────────────────────────

func TestAuditLoggerWritesEvents(t *testing.T) {
	dir := t.TempDir()
	al := NewAuditLogger(dir)

	al.Log(AuditEvent{
		AgentID:  "agt_test",
		Event:    "session_open",
		FilePath: "/tmp/test.sheet",
	})
	al.Log(AuditEvent{
		AgentID:     "agt_test",
		Event:       "patch",
		FilePath:    "/tmp/test.sheet",
		Description: "test patch",
		OpsCount:    3,
		Outcome:     "applied",
	})
	al.Close() // flush

	data, err := os.ReadFile(filepath.Join(dir, "agent-audit.jsonl"))
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, `"session_open"`)
	assert.Contains(t, content, `"patch"`)
	assert.Contains(t, content, `"test patch"`)
	assert.Contains(t, content, `"applied"`)
	assert.Contains(t, content, `"agt_test"`)
}

func TestAuditLoggerCreatesDir(t *testing.T) {
	dir := t.TempDir() + "/newsubdir"
	al := NewAuditLogger(dir)
	al.Log(AuditEvent{AgentID: "agt_x", Event: "session_open", FilePath: "/f"})
	al.Close()

	_, err := os.Stat(filepath.Join(dir, "agent-audit.jsonl"))
	require.NoError(t, err)
}

func TestAuditLoggerNonBlocking(t *testing.T) {
	dir := t.TempDir()
	al := NewAuditLogger(dir)

	// Send well over the buffer capacity (256) without blocking
	for i := 0; i < 400; i++ {
		al.Log(AuditEvent{AgentID: "agt_flood", Event: "patch", FilePath: "/f"})
	}
	al.Close()
	// If this test completes without hanging, non-blocking is confirmed
}

func TestAuditLoggerRollbackEvent(t *testing.T) {
	dir := t.TempDir()
	ctrl := NewAppControllerWithUserData(dir)

	_, err := ctrl.Agent.OpenSession(ScopeReadWrite, "/test.sheet")
	require.NoError(t, err)

	ctrl.LockForAgent()
	require.NoError(t, ctrl.Agent.Rollback())
	ctrl.UnlockForAgent()

	ctrl.Agent.audit.Close()

	data, err := os.ReadFile(filepath.Join(dir, "agent-audit.jsonl"))
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, `"session_open"`)
	assert.Contains(t, content, `"rollback"`)
}

func TestAuditLoggerSessionIntegration(t *testing.T) {
	dir := t.TempDir()
	ctrl := NewAppControllerWithUserData(dir)

	sess, err := ctrl.Agent.OpenSession(ScopeReadWrite, "/test.sheet")
	require.NoError(t, err)

	ctrl.Agent.LogPatch(sess.AgentID, "/test.sheet", "fill column", 5, "applied")

	ctrl.LockForAgent()
	require.NoError(t, ctrl.Agent.Commit(ctrl.History))
	ctrl.UnlockForAgent()

	ctrl.LockForAgent()
	require.NoError(t, ctrl.Agent.End(ctrl.History))
	ctrl.UnlockForAgent()

	ctrl.Agent.audit.Close()

	data, err := os.ReadFile(filepath.Join(dir, "agent-audit.jsonl"))
	require.NoError(t, err)
	content := string(data)
	assert.Contains(t, content, `"session_open"`)
	assert.Contains(t, content, `"patch"`)
	assert.Contains(t, content, `"commit"`)
	assert.Contains(t, content, `"end"`)
}
