// Story 13.10: App settings persistence (RTL mode, future settings)
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function getSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

module.exports = { getSettings, setSetting };
