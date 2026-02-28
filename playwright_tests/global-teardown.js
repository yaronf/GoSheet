// Global teardown: stop Go server after Chromium tests

module.exports = async () => {
  const pid = process.env.GOSHEET_SERVER_PID;
  if (pid) {
    try {
      process.kill(parseInt(pid, 10), 'SIGTERM');
    } catch {
      // ignore
    }
  }
};
