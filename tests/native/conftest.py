"""Pytest configuration and fixtures for native macOS tests (pyax).

Requires: pip install pyax[highlight] pytest
Requires: macOS with accessibility enabled (System Preferences → Security & Privacy → Accessibility)
Requires: GoSheet app built at ./build/GoSheet (run wails3 build from project root)
"""
import subprocess
import time
from pathlib import Path

import pytest


try:
    import pyax
except ImportError:
    pyax = None


def _project_root():
    """Return project root (directory containing build/)."""
    return Path(__file__).resolve().parent.parent.parent


def _gosheet_binary():
    """Return path to GoSheet executable (binary or .app bundle)."""
    root = _project_root()
    binary = root / "build" / "GoSheet"
    app_binary = root / "build" / "GoSheet.app" / "Contents" / "MacOS" / "GoSheet"
    if binary.exists():
        return str(binary)
    if app_binary.exists():
        return str(app_binary)
    return None


def _check_accessibility():
    """Verify accessibility API is enabled."""
    try:
        pyax.get_application_by_name("Finder")
        return True
    except Exception as e:
        if "AXErrorAPIDisabled" in str(e) or "APIDisabled" in str(e):
            return False
        raise


@pytest.fixture(scope="session", autouse=True)
def require_accessibility():
    """Ensure accessibility is enabled before any native tests run."""
    if pyax is None:
        pytest.skip("pyax not installed. Run: pip install pyax[highlight] pytest")
    if not _check_accessibility():
        pytest.skip(
            "Accessibility API disabled. Enable in System Preferences → "
            "Security & Privacy → Privacy → Accessibility"
        )


@pytest.fixture(scope="session")
def gosheet_app():
    """Launch GoSheet app once per test session and yield app reference.

    Uses subprocess.Popen to start the app, then pyax.get_application_by_name
    to get the accessibility reference. Cleans up by terminating the process.
    """
    if pyax is None:
        pytest.skip("pyax not installed. Run: pip install pyax[highlight] pytest")
    project_root = _project_root()
    binary_path = _gosheet_binary()
    if not binary_path:
        pytest.skip(
            "GoSheet binary not found. Build with: wails3 build or go build -o build/GoSheet ."
        )

    proc = subprocess.Popen(
        [binary_path],
        cwd=str(project_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for app to launch, WebView to load, and UI to be discoverable
    time.sleep(5)

    try:
        app = pyax.get_application_by_name("GoSheet")
        yield app
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture
def gosheet_page(gosheet_app):
    """Yield GoSheetApp page object. Depends on gosheet_app to ensure app is launched."""
    import sys

    native_dir = Path(__file__).resolve().parent
    if str(native_dir) not in sys.path:
        sys.path.insert(0, str(native_dir))
    from page_objects import GoSheetApp

    return GoSheetApp(gosheet_app)


@pytest.fixture
def clean_app(gosheet_app):
    """Reset app to clean state (new unsaved spreadsheet) before each test.
    
    Uses Cmd+N keyboard shortcut since WebView buttons aren't accessible via pyax.
    """
    import sys

    native_dir = Path(__file__).resolve().parent
    if str(native_dir) not in sys.path:
        sys.path.insert(0, str(native_dir))
    from page_objects import GoSheetApp

    app = GoSheetApp(gosheet_app)
    # Use Cmd+N to create new spreadsheet
    app.send_key_shortcut("n")
    time.sleep(0.5)
    yield app
