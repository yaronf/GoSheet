#!/usr/bin/env python3
"""Manual test: Click Load in browser, then check if file dialog is accessible via pyax"""

import pyax
import time

print("Instructions:")
print("1. Make sure GoSheet is running")
print("2. Click the 'Load' button in the GoSheet window")
print("3. This script will check if the file dialog is accessible")
print()
input("Press Enter when ready...")

print("\nWaiting 2 seconds for you to click Load...")
time.sleep(2)

print("Searching for file dialog (AXSheet)...")

def _attr(e, key, default=None):
    try:
        v = e[key]
        return v if v is not None else default
    except:
        return default

try:
    app = pyax.get_application_by_name("GoSheet")
    print(f"✓ Found app: {app}")
    
    # Search for file dialog
    for attempt in range(10):
        print(f"\nAttempt {attempt + 1}...")
        try:
            dialog = app.search_for(lambda e: _attr(e, "AXRole") == "AXSheet")
            if dialog:
                print(f"  ✓✓✓ FOUND FILE DIALOG: {dialog}")
                print(f"    Role: {_attr(dialog, 'AXRole')}")
                print(f"    Title: {_attr(dialog, 'AXTitle')}")
                print(f"    Description: {_attr(dialog, 'AXDescription')}")
                print("\n✅ SUCCESS: File dialogs ARE accessible via pyax!")
                break
            else:
                print("  No file dialog found yet...")
        except Exception as e:
            print(f"  Error: {e}")
        
        time.sleep(1)
    else:
        print("\n❌ File dialog not found after 10 attempts")
        print("   Either you didn't click Load, or file dialogs aren't accessible")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
