#!/usr/bin/env python3
"""Debug script using PyObjC directly"""

import time
from ApplicationServices import (
    AXUIElementCreateApplication,
    AXUIElementCopyAttributeValue,
    kAXWindowsAttribute,
    kAXChildrenAttribute,
    kAXRoleAttribute,
    kAXTitleAttribute,
    kAXButtonRole,
)
from Cocoa import NSRunningApplication

print("Waiting for GoSheet app...")
time.sleep(2)

# Find GoSheet process
apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("com.gosheet.app")
if not apps:
    print("❌ GoSheet not running")
    exit(1)

pid = apps[0].processIdentifier()
print(f"✓ Found GoSheet (PID: {pid})")

# Create accessibility element
app_ref = AXUIElementCreateApplication(pid)

# Get windows
err, windows = AXUIElementCopyAttributeValue(app_ref, kAXWindowsAttribute, None)
if err != 0:
    print(f"❌ Error getting windows: {err}")
    exit(1)

print(f"\nFound {len(windows)} windows")

for i, win in enumerate(windows):
    # Get window title
    err, title = AXUIElementCopyAttributeValue(win, kAXTitleAttribute, None)
    title = title if err == 0 else "(no title)"
    print(f"\nWindow {i}: {title}")
    
    # Get all children
    err, children = AXUIElementCopyAttributeValue(win, kAXChildrenAttribute, None)
    if err != 0:
        print(f"  Error getting children: {err}")
        continue
    
    print(f"  Children: {len(children)}")
    
    # Find all buttons recursively
    def find_buttons(element, depth=0, max_depth=5):
        if depth > max_depth:
            return []
        
        buttons = []
        
        # Check if this element is a button
        err, role = AXUIElementCopyAttributeValue(element, kAXRoleAttribute, None)
        if err == 0 and role == kAXButtonRole:
            err, title = AXUIElementCopyAttributeValue(element, kAXTitleAttribute, None)
            title = title if err == 0 else "(no title)"
            buttons.append((depth, title))
        
        # Recurse into children
        err, children = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute, None)
        if err == 0 and children:
            for child in children:
                buttons.extend(find_buttons(child, depth + 1, max_depth))
        
        return buttons
    
    buttons = find_buttons(win)
    print(f"\n  Buttons found: {len(buttons)}")
    for depth, btn_title in buttons:
        print(f"    {'  ' * depth}Button: '{btn_title}'")
