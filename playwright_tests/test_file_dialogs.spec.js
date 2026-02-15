// Playwright Electron File Dialog Tests
// Story 5.3: Implement Dialog Stubbing Tests

const { test, expect } = require('./fixtures');
const eph = require('electron-playwright-helpers');

test.describe('File Dialog Tests', () => {
  
  test('can stub open dialog', async ({ electronApp, window }) => {
    // Wait for app to be ready
    await window.waitForTimeout(500);
    
    // Stub the open dialog to return a test file path
    await eph.stubDialog(electronApp, 'showOpenDialog', { 
      filePaths: ['/tmp/test.sheet'] 
    });
    
    // Trigger the open dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.openFileDialog();
    });
    
    // Verify the stubbed path was returned
    expect(result).toBe('/tmp/test.sheet');
  });

  test('can stub save dialog', async ({ electronApp, window }) => {
    // Wait for app to be ready
    await window.waitForTimeout(500);
    
    // Stub the save dialog to return a test file path
    await eph.stubDialog(electronApp, 'showSaveDialog', { 
      filePath: '/tmp/saved.sheet' 
    });
    
    // Trigger the save dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.saveFileDialog('test.sheet');
    });
    
    // Verify the stubbed path was returned
    expect(result).toBe('/tmp/saved.sheet');
  });

  test('can test dialog cancellation', async ({ electronApp, window }) => {
    // Wait for app to be ready
    await window.waitForTimeout(500);
    
    // Stub the dialog to return cancellation
    await eph.stubDialog(electronApp, 'showOpenDialog', { 
      canceled: true 
    });
    
    // Trigger the open dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.openFileDialog();
    });
    
    // Verify null was returned (cancellation)
    expect(result).toBeNull();
  });

});
