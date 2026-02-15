#!/usr/bin/env python3
"""Debug script to inspect GoSheet UI structure using pyax properly"""

import pyax
import time

print("Waiting for GoSheet app...")
time.sleep(2)

try:
    app = pyax.get_application_by_name("GoSheet")
    print(f"✓ Found app: {app}")
    print()
    
    # Try to get all attributes
    print("App attributes:")
    try:
        attrs = app.attributes()
        for attr in attrs[:20]:
            try:
                value = getattr(app, attr, None)
                print(f"  {attr}: {value}")
            except:
                print(f"  {attr}: (error accessing)")
    except Exception as e:
        print(f"  Error getting attributes: {e}")
    print()
    
    # Try different ways to get windows
    print("Trying to get windows...")
    try:
        # Method 1: Direct attribute
        windows = app.windows
        print(f"  app.windows: {windows}")
    except Exception as e:
        print(f"  app.windows error: {e}")
    
    try:
        # Method 2: Subscript
        windows = app["AXWindows"]
        print(f"  app['AXWindows']: {windows}")
    except Exception as e:
        print(f"  app['AXWindows'] error: {e}")
    
    try:
        # Method 3: findAll
        windows = app.findAll(role="AXWindow")
        print(f"  app.findAll(role='AXWindow'): {windows}")
        if windows:
            print(f"  Found {len(windows)} windows")
            for i, win in enumerate(windows):
                print(f"\n  Window {i}:")
                print(f"    {win}")
                
                # Try to get buttons
                buttons = win.findAll(role="AXButton")
                print(f"    Buttons: {len(buttons) if buttons else 0}")
                if buttons:
                    for j, btn in enumerate(buttons[:10]):
                        try:
                            title = btn.title if hasattr(btn, 'title') else btn.get("AXTitle", "")
                            print(f"      Button {j}: {title}")
                        except:
                            print(f"      Button {j}: (error)")
    except Exception as e:
        print(f"  app.findAll error: {e}")
        import traceback
        traceback.print_exc()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
