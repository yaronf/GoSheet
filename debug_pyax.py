#!/usr/bin/env python3
"""Debug script using pyax search_for method"""

import pyax
import time

print("Waiting for GoSheet app...")
time.sleep(2)

try:
    app = pyax.get_application_by_name("GoSheet")
    print(f"✓ Found app: {app}")
    print()
    
    # Try to find any buttons
    print("Searching for buttons...")
    
    def find_buttons():
        """Find all buttons in the app"""
        buttons = []
        try:
            # Search for elements with AXButton role
            result = app.search_for(lambda e: e.get("AXRole") == "AXButton")
            if result:
                buttons.append(result)
        except Exception as e:
            print(f"  Error in search: {e}")
        return buttons
    
    # Try multiple times
    for attempt in range(3):
        print(f"\nAttempt {attempt + 1}:")
        buttons = find_buttons()
        if buttons:
            print(f"  Found {len(buttons)} button(s)")
            for i, btn in enumerate(buttons):
                try:
                    title = btn.get("AXTitle", "(no title)")
                    desc = btn.get("AXDescription", "")
                    print(f"    Button {i}: title='{title}', desc='{desc}'")
                except Exception as e:
                    print(f"    Button {i}: Error getting info - {e}")
        else:
            print("  No buttons found")
        
        if attempt < 2:
            time.sleep(1)
    
    # Try to search for any element
    print("\n\nSearching for ANY element...")
    try:
        any_elem = app.search_for(lambda e: True)
        if any_elem:
            print(f"  Found element: {any_elem}")
            print(f"    Role: {any_elem.get('AXRole', '?')}")
            print(f"    Title: {any_elem.get('AXTitle', '?')}")
        else:
            print("  No elements found at all!")
    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
