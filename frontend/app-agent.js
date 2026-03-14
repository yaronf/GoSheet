// GoSheet Agent Session UI — extracted from app.js for max-lines compliance.
// Manages the agent modal, SSE subscription, and session lifecycle.

import {
  AgentIssueToken,
  AgentSessionStatus,
  AgentEndSession,
} from './api-client.js';
import { showAlert } from './app-utils.js';

/**
 * Initialize agent session UI. Call once from app.js after the DOM is ready.
 * No-op if the bootstrap token is absent (test mode / no auth).
 */
export function initAgentUI() {
  if (!window.__GOSHEET_TOKEN__) return;

  const agentBtn = document.getElementById('agent-btn');
  const agentModal = document.getElementById('agent-modal');
  const agentStatusDot = document.getElementById('agent-status-dot');
  const agentModalStatusText = document.getElementById(
    'agent-modal-status-text'
  );
  const agentInactiveSection = document.getElementById(
    'agent-modal-inactive-section'
  );
  const agentActiveSection = document.getElementById(
    'agent-modal-active-section'
  );
  const agentBootstrapUrl = document.getElementById('agent-bootstrap-url');
  const agentCopyUrl = document.getElementById('agent-copy-url');
  const agentScopeSelect = document.getElementById('agent-modal-scope');
  const agentIssueBtn = document.getElementById('agent-modal-issue');
  const agentEndBtn = document.getElementById('agent-modal-end');
  const agentCloseBtn = document.getElementById('agent-modal-close');

  let agentSessionState = {
    active: false,
    agentId: null,
    scope: null,
    token: null,
  };

  function updateAgentStatusDot() {
    if (!agentStatusDot) return;
    agentStatusDot.className =
      'agent-status-dot ' +
      (agentSessionState.active ? 'agent-status-active' : 'agent-status-idle');
  }

  function renderAgentModal() {
    if (agentSessionState.active) {
      agentInactiveSection.style.display = 'none';
      agentActiveSection.style.display = '';
      const scopeLabel =
        agentSessionState.scope === 'rw' ? 'Read-Write' : 'Read-Only';
      agentModalStatusText.textContent = `Active \u2014 ${scopeLabel} (${agentSessionState.agentId})`;
      const url = `${location.origin}/api/agent/bootstrap?token=${encodeURIComponent(agentSessionState.token || '')}`;
      agentBootstrapUrl.value = url;
      agentScopeSelect.style.display = 'none';
      agentIssueBtn.style.display = 'none';
      agentEndBtn.style.display = '';
    } else {
      agentInactiveSection.style.display = '';
      agentActiveSection.style.display = 'none';
      agentScopeSelect.style.display = '';
      agentIssueBtn.style.display = '';
      agentEndBtn.style.display = 'none';
    }
  }

  async function refreshAgentStatus() {
    try {
      const data = await AgentSessionStatus();
      agentSessionState = {
        active: data.active || false,
        agentId: data.agentId || null,
        scope: data.scope || null,
        token: agentSessionState.token,
      };
      updateAgentStatusDot();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[agent] status poll failed:', e);
    }
  }

  agentBtn?.addEventListener('click', async () => {
    await refreshAgentStatus();
    renderAgentModal();
    agentModal.style.display = 'flex';
  });

  agentCloseBtn?.addEventListener('click', () => {
    agentModal.style.display = 'none';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && agentModal?.style.display !== 'none') {
      agentModal.style.display = 'none';
    }
  });

  agentCopyUrl?.addEventListener('click', () => {
    if (agentBootstrapUrl.value) {
      navigator.clipboard
        .writeText(agentBootstrapUrl.value)
        .then(() => {
          agentCopyUrl.textContent = 'Copied!';
          setTimeout(() => {
            agentCopyUrl.textContent = 'Copy';
          }, 1500);
        })
        .catch(() => {
          agentCopyUrl.textContent = 'Copy failed';
          setTimeout(() => {
            agentCopyUrl.textContent = 'Copy';
          }, 1500);
        });
    }
  });

  agentIssueBtn?.addEventListener('click', async () => {
    try {
      const scope = agentScopeSelect?.value || 'rw';
      const data = await AgentIssueToken(scope);
      agentSessionState = {
        active: true,
        agentId: data.agentId,
        scope,
        token: data.agentToken,
      };
      updateAgentStatusDot();
      renderAgentModal();
    } catch (e) {
      await showAlert('Failed to issue agent token: ' + e.message);
    }
  });

  agentEndBtn?.addEventListener('click', async () => {
    try {
      await AgentEndSession();
      agentSessionState = {
        active: false,
        agentId: null,
        scope: null,
        token: null,
      };
      updateAgentStatusDot();
      renderAgentModal();
    } catch (e) {
      await showAlert('Failed to end agent session: ' + e.message);
    }
  });

  refreshAgentStatus();

  // SSE push notifications (Story 20.8)
  const sseToken = window.__GOSHEET_TOKEN__ || '';
  const sseURL = `${window.location.origin}/api/events${sseToken ? `?token=${sseToken}` : ''}`;
  const evtSource = new EventSource(sseURL);
  evtSource.addEventListener('cells_changed', () => {
    window.refreshAllCells();
    window.updateFileStatus();
  });
  evtSource.addEventListener('session_changed', () => {
    refreshAgentStatus();
  });
}
