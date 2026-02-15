"""Page object for GoSheet native macOS application.

Encapsulates UI element discovery and interaction via pyax (macOS Accessibility API).
UI changes should only require updating this class, not individual tests.
"""
import time

try:
    import pyax
except ImportError:
    pyax = None


def _attr(e, key, default=None):
    """Safely get accessibility attribute from element."""
    try:
        v = e[key]
        return v if v is not None else default
    except (KeyError, TypeError):
        return default


class GoSheetApp:
    """Domain object for GoSheet application UI interactions.

    Provides high-level methods for finding and interacting with UI elements.
    Uses pyax for accessibility-based element discovery.
    """

    def __init__(self, app=None):
        """Initialize with pyax app reference.

        Args:
            app: pyax application element from get_application_by_name('GoSheet').
                 If None, gets app via pyax (must already be running).
        """
        self._app = app if app is not None else pyax.get_application_by_name("GoSheet")

    def find_button(self, title: str):
        """Find button by title with retry logic.

        NOTE: WebView content (HTML buttons) is NOT accessible via macOS Accessibility API.
        This method will NOT find HTML buttons in the Wails WebView.
        Only native macOS buttons (like dialog buttons) are accessible.

        Args:
            title: Button title text (e.g., "Cancel", "Open", "Save")

        Returns:
            Accessibility element for the button, or None if not found

        Raises:
            TimeoutError: If button not found within default timeout
        """
        try:
            return self.wait_for_element(
                lambda e: _attr(e, "AXRole") == "AXButton" and _attr(e, "AXTitle") == title
            )
        except TimeoutError:
            return None

    def wait_for_element(self, predicate, timeout: float = 5):
        """Wait for element matching predicate with retry logic.

        Polls every 0.1 seconds until predicate returns True for a found element,
        or timeout is reached.

        Args:
            predicate: Callable receiving element, returns True if match
            timeout: Maximum seconds to wait (default 5)

        Returns:
            First matching accessibility element

        Raises:
            TimeoutError: If no matching element found within timeout
        """
        start = time.time()
        while time.time() - start < timeout:
            try:
                element = self._app.search_for(predicate)
                if element is not None:
                    return element
            except Exception:
                pass
            time.sleep(0.1)
        raise TimeoutError(f"Element not found within {timeout}s")

    def wait_for_file_dialog(self, timeout: float = 3):
        """Wait for native file dialog (AXSheet) to appear.

        NSOpenPanel and NSSavePanel use AXRole "AXSheet" in macOS accessibility.

        Args:
            timeout: Maximum seconds to wait (default 3)

        Returns:
            File dialog accessibility element, or None if not found
        """
        start = time.time()
        while time.time() - start < timeout:
            try:
                dialog = self._app.search_for(
                    lambda e: _attr(e, "AXRole") == "AXSheet"
                )
                if dialog is not None:
                    return dialog
            except Exception:
                pass
            time.sleep(0.1)
        return None

    def click_button(self, title: str) -> None:
        """Click button by title. Convenience method combining find and action.

        NOTE: This will NOT work for HTML buttons in the WebView.
        Only works for native macOS buttons (like dialog buttons).

        Args:
            title: Button title text (e.g., "Cancel", "Open", "Save")
        """
        button = self.find_button(title)
        if button:
            button.perform_action("AXPress")

    def send_key_shortcut(self, key: str, command_down: bool = True) -> None:
        """Send Cmd+key using CGEvent (no AppleScript permissions needed).

        Uses Core Graphics Event API to send keyboard events directly to the app.
        This avoids AppleScript permission requirements.

        Args:
            key: Character to send (e.g., 'o', 's', 'n')
            command_down: If True, hold Command key (default True for Cmd+O, etc.)
        """
        from Quartz import (
            CGEventCreateKeyboardEvent,
            CGEventPost,
            CGEventSetFlags,
            kCGEventKeyDown,
            kCGEventKeyUp,
            kCGHIDEventTap,
            kCGEventFlagMaskCommand,
        )
        
        # Map common keys to key codes
        key_codes = {
            'o': 31,  # O
            's': 1,   # S
            'n': 45,  # N
            'w': 13,  # W
        }
        
        key_code = key_codes.get(key.lower())
        if key_code is None:
            raise ValueError(f"Unsupported key: {key}. Add to key_codes dict.")
        
        # Create and post key down event
        event_down = CGEventCreateKeyboardEvent(None, key_code, True)
        if command_down:
            CGEventSetFlags(event_down, kCGEventFlagMaskCommand)
        CGEventPost(kCGHIDEventTap, event_down)
        
        time.sleep(0.05)
        
        # Create and post key up event
        event_up = CGEventCreateKeyboardEvent(None, key_code, False)
        if command_down:
            CGEventSetFlags(event_up, kCGEventFlagMaskCommand)
        CGEventPost(kCGHIDEventTap, event_up)
        
        time.sleep(0.3)

    def send_key_code(self, key_code: int) -> None:
        """Send key by key code (e.g. 53 for Escape). Ensures app is focused first."""
        import subprocess

        subprocess.run(
            ["osascript", "-e", 'tell application "GoSheet" to activate'],
            check=True,
            capture_output=True,
        )
        time.sleep(0.2)
        subprocess.run(
            [
                "osascript",
                "-e",
                f"tell application \"System Events\" to key code {key_code}",
            ],
            check=True,
            capture_output=True,
        )
        time.sleep(0.3)

    def get_file_status_text(self) -> str:
        """Get file status element text (e.g. '● Unsaved changes' or '✓ Saved')."""
        try:
            status = self._app.search_for(
                lambda e: (
                    _attr(e, "AXRole") == "AXStaticText"
                    and (
                        "Unsaved" in str(_attr(e, "AXValue", ""))
                        or "Saved" in str(_attr(e, "AXValue", ""))
                    )
                )
            )
            if status is not None:
                return str(_attr(status, "AXValue", ""))
        except Exception:
            pass
        return ""
