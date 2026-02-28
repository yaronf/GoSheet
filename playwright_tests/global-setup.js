// Global setup: start Go server for Chromium (web) tests
// See technical-ui-testing-research-2026-02-28.md

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let serverProcess = null;
// Use 3001 to avoid conflict with Electron's server (3000)
const PORT = 3001;

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${PORT}/`, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server not ready after ${maxAttempts} attempts`);
}

module.exports = async () => {
  const projectRoot = path.join(__dirname, '..');
  const serverPath = path.join(projectRoot, 'server', 'gosheet-server');

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Go server not found at ${serverPath}. Run: make build`
    );
  }

  serverProcess = spawn(serverPath, ['--port', String(PORT)], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (d) =>
    process.stdout.write(`[GoServer] ${d}`)
  );
  serverProcess.stderr?.on('data', (d) =>
    process.stderr.write(`[GoServer] ${d}`)
  );

  await waitForServer();
  process.env.GOSHEET_SERVER_PID = String(serverProcess.pid);
  process.env.GOSHEET_WEB_PORT = String(PORT);
};
