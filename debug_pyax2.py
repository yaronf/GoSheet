#!/usr/bin/env python3
"""Debug script using pyax with correct API"""

import pyax
import time

def _attr(e, key, default=None):
    """Safely get accessibility attribute from element."""
    try:
        v = e[key]
        return v if v is not None else default
    except (KeyError, TypeError, Exception):
        return default

print("Waiting for GoSheet app...")
time.sleep(2)

try:
    app = pyax.get_application_by_name("GoSheet")
    print(f"✓ Found app: {app}")
    print()
    
    # Try to find buttons using the correct pattern from page_objects
    print("Searching for 'Load' button...")
    
    for attempt in range(5):
        print(f"\nAttempt {attempt + 1}:")
        try:
            button = app.search_for(
                lambda e: _attr(e, "AXRole") == "AXButton" and _attr(e, "AXTitle") == "Load"
            )
            if button:
                print(f"  ✓ Found Load button: {button}")
                print(f"    Title: {_attr(button, 'AXTitle')}")
                print(f"    Role: {_attr(button, 'AXRole')}")
                break
            else:
                print("  Load button not found")
        except Exception as e:
            print(f"  Error: {e}")
        
        time.sleep(1)
    
    # Try to find ANY button
    print("\n\nSearching for ANY button...")
    for attempt in range(3):
        print(f"\nAttempt {attempt + 1}:")
        try:
            button = app.search_for(
                lambda e: _attr(e, "AXRole") == "AXButton"
            )
            if button:
                print(f"  ✓ Found a button: {button}")
                print(f"    Title: {_attr(button, 'AXTitle')}")
                print(f"    Description: {_attr(button, 'AXDescription')}")
                break
            else:
                print("  No buttons found")
        except Exception as e:
            print(f"  Error: {e}")
            import traceback
            traceback.print_exc()
        
        time.sleep(1)
    
    # Check if app has windows
    print("\n\nChecking for windows...")
    try:
        windows = _attr(app, "AXWindows", [])
        print(f"  Windows: {windows}")
        if windows:
            print(f"  Window count: {len(windows)}")
    except Exception as e:
        print(f"  Error: {e}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
