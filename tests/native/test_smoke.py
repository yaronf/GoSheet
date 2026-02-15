"""Smoke tests for native GoSheet app.

Verifies basic app launch and accessibility API connectivity.

NOTE: Wails WebView content (HTML/JS UI) is NOT accessible via macOS Accessibility API.
These tests only verify that the native app process is accessible.
For UI testing, use Playwright tests (test.sh).
"""

def test_app_launches(gosheet_app):
    """Test: GoSheet app launches and is accessible via pyax.
    
    This verifies:
    - App process starts successfully
    - macOS Accessibility API can find the app
    - Basic pyax connectivity works
    
    This does NOT test:
    - WebView UI elements (use Playwright for that)
    - Keyboard shortcuts (use Playwright for that)
    - File operations (use Playwright for that)
    
    NOTE: Wails WebView apps return None or [] for AXWindows - this is expected behavior.
    """
    assert gosheet_app is not None, "App should be accessible via pyax"
    
    # Verify we can query app attributes without errors
    try:
        # AXWindows returns None or [] for WebView apps - this is expected
        windows = gosheet_app["AXWindows"]
        # Success: We were able to query the attribute (even if result is None/empty)
        # This proves pyax connectivity works
    except Exception as e:
        # If we get here, there's a problem with pyax connectivity
        raise AssertionError(f"Failed to query app attributes: {e}")
