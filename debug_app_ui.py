#!/usr/bin/env python3
"""Debug script to inspect GoSheet UI structure"""

import pyax
import time

print("Waiting for GoSheet app...")
time.sleep(2)

try:
    app = pyax.get_application_by_name("GoSheet")
    print(f"✓ Found app: {app}")
    print()
    
    print("Windows:")
    windows = app["AXWindows"]
    print(f"  Count: {len(windows)}")
    for i, win in enumerate(windows):
        title = win.get("AXTitle", "(no title)")
        role = win.get("AXRole", "(no role)")
        print(f"  Window {i}: {title} (role: {role})")
        print()
        
        print(f"  Children of window {i}:")
        children = win.get("AXChildren", [])
        for j, child in enumerate(children[:30]):  # First 30 children
            role = child.get("AXRole", "?")
            title = child.get("AXTitle", "")
            desc = child.get("AXDescription", "")
            role_desc = child.get("AXRoleDescription", "")
            print(f"    {j}: role={role}, title='{title}', desc='{desc}', role_desc='{role_desc}'")
            
            # If it's a group or has children, show one level deeper
            subchildren = child.get("AXChildren", [])
            if len(subchildren) > 0 and role in ['AXGroup', 'AXScrollArea', 'AXSplitGroup']:
                for k, subchild in enumerate(subchildren[:15]):
                    subrole = subchild.get("AXRole", "?")
                    subtitle = subchild.get("AXTitle", "")
                    subdesc = subchild.get("AXDescription", "")
                    print(f"      {k}: role={subrole}, title='{subtitle}', desc='{subdesc}'")
        print()
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
