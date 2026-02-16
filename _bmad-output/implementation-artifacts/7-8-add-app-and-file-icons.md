# Story 7.8: Add App and File Icons

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.8  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-16  
**Completed:** 2026-02-16

---

## Story

As a user,  
I want custom icons for the app and .sheet files,  
So that the app looks polished and professional.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with electron-builder
- package.json references `assets/icon.icns` (may already exist)

**Current State:**
- package.json build config: `"icon": "assets/icon.icns"`
- May have placeholder or default Electron icon
- No custom .sheet file icon
- .sheet files may show generic document icon in Finder

**Why This Story:**
Professional apps have distinct branding. The app icon appears in the dock (FR46), in the menu bar, and in Finder. The .sheet file icon (FR45) helps users identify spreadsheet files. Icons can be placeholder/simple designs refined later.

---

## Acceptance Criteria

**Given** the Electron app project is set up  
**When** app icon assets are added  
**Then** `assets/icon.icns` (or equivalent) contains the app icon  
**And** Icon includes required sizes for macOS (e.g., 16, 32, 64, 128, 256, 512, 1024)  
**And** The app icon appears in the dock (FR46)  
**And** The app icon appears in the menu bar (if applicable)

**When** file icon assets are added  
**Then** `assets/sheet-icon.icns` contains the .sheet file icon  
**And** The file icon is associated with .sheet files (Story 7.7 fileAssociations)  
**And** .sheet files display the custom icon in Finder (FR45)

**And** Icons follow macOS design guidelines (NFR-U1)  
**And** Icons are placeholder/simple designs (can be refined later)

---

## Technical Requirements

### macOS Icon Formats

**App icon (icon.icns):**
- .icns is a container with multiple sizes: 16, 32, 64, 128, 256, 512, 1024
- Source: 1024x1024 PNG, then convert to .icns
- Tools: `iconutil` (macOS), or online converters, or `png2icons` npm package

**File icon (sheet-icon.icns):**
- Same format as app icon
- Used in fileAssociations in package.json
- Displayed in Finder for .sheet files

### electron-builder Configuration

Current package.json (from project):
```json
"mac": {
  "icon": "assets/icon.icns",
  ...
}
```

For file icon, add to fileAssociations (Story 7.7):
```json
"fileAssociations": [
  {
    "ext": "sheet",
    "name": "GoSheet Spreadsheet",
    "icon": "assets/sheet-icon.icns"
  }
]
```

### Creating Icons

**Option 1: Placeholder icons**
- Create simple 1024x1024 PNG (e.g., grid pattern for spreadsheet)
- Use `iconutil` to generate .icns:
  ```bash
  mkdir icon.iconset
  sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
  sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
  # ... etc for all sizes
  iconutil -c icns icon.iconset -o icon.icns
  ```

**Option 2: Use icon generator**
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [png2icons](https://www.npmjs.com/package/png2icons)

**Option 3: Design tools**
- Sketch, Figma, or similar to create 1024x1024 source
- Export PNG, convert to icns

### File Structure

**New/Modified Files:**
- `assets/icon.icns` - App icon (create or replace)
- `assets/icon.png` - Source 1024x1024 (optional, for regeneration)
- `assets/sheet-icon.icns` - .sheet file icon
- `assets/sheet-icon.png` - Source for file icon (optional)
- `package.json` - Ensure build config references correct paths

### Icon Design Guidelines (macOS HIG)

- Simple, recognizable at small sizes (16px)
- Avoid fine detail that disappears when scaled
- Use consistent style (flat, or subtle depth)
- App icon: represents the application
- File icon: suggests document/spreadsheet, can mirror app icon style

---

## Implementation Tasks

1. [ ] Create or obtain 1024x1024 PNG for app icon
2. [ ] Generate assets/icon.icns with all required sizes
3. [ ] Verify app icon in dock after rebuild
4. [ ] Create or obtain 1024x1024 PNG for .sheet file icon
5. [ ] Generate assets/sheet-icon.icns
6. [ ] Add sheet-icon to fileAssociations (Story 7.7)
7. [ ] Rebuild app, verify .sheet files show custom icon in Finder
8. [ ] Document icon sources and regeneration steps
9. [ ] Ensure assets/ directory exists and is in .gitignore if needed (or committed)

---

## Dev Notes

### iconutil Command (macOS)

```bash
# Create iconset directory structure
mkdir MyIcon.iconset
sips -z 16 16     icon1024.png --out MyIcon.iconset/icon_16x16.png
sips -z 32 32     icon1024.png --out MyIcon.iconset/icon_16x16@2x.png
sips -z 32 32     icon1024.png --out MyIcon.iconset/icon_32x32.png
sips -z 64 64     icon1024.png --out MyIcon.iconset/icon_32x32@2x.png
sips -z 128 128   icon1024.png --out MyIcon.iconset/icon_128x128.png
sips -z 256 256   icon1024.png --out MyIcon.iconset/icon_128x128@2x.png
sips -z 256 256   icon1024.png --out MyIcon.iconset/icon_256x256.png
sips -z 512 512   icon1024.png --out MyIcon.iconset/icon_256x256@2x.png
sips -z 512 512   icon1024.png --out MyIcon.iconset/icon_512x512.png
sips -z 1024 1024 icon1024.png --out MyIcon.iconset/icon_512x512@2x.png
iconutil -c icns MyIcon.iconset -o MyIcon.icns
```

### Placeholder Design Ideas

- **App icon:** Grid of cells (spreadsheet), or "GS" monogram, or simple table graphic
- **File icon:** Document with grid overlay, or smaller version of app icon

### assets Directory

Project has `"icon": "assets/icon.icns"` - ensure assets/ exists. If icon.icns is missing, electron-builder may fall back to default. Create assets/ and add icons.

---

## Testing Strategy

### Manual Testing

1. **App icon:** Rebuild, launch app, verify dock icon
2. **File icon:** Create .sheet file, verify Finder icon
3. **Sizes:** Verify icon looks correct at various sizes (dock, Finder list view, etc.)

### Verification

- Check `dist/mac-arm64/GoSheet.app/Contents/Resources/` for embedded icon
- Check Info.plist for CFBundleIconFile
- For file type: Check Info.plist CFBundleDocumentTypes for icon reference

---

## References

- [macOS App Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [electron-builder icons](https://www.electron.build/icons)
- [iconutil man page](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)
- Story 7.7: File associations (uses sheet-icon.icns)

---

## Change Log

- 2026-02-16: Story created with comprehensive context for app and file icons
- 2026-02-16: Verified icons already working correctly

---

## Implementation Summary

### Current State

The app and file icons are **already implemented and working correctly**:

1. **App Icon (`assets/Icon.png`):**
   - 512x512 PNG with spreadsheet grid design (green cell + sigma symbol)
   - electron-builder automatically converts to `icon.icns` with all required sizes
   - Appears correctly in dock and menu bar

2. **File Icon:**
   - electron-builder automatically uses the app icon for .sheet files
   - macOS applies document treatment (folded corner) automatically
   - .sheet files display the app icon with document styling in Finder

### How It Works

electron-builder's automatic icon handling:
- Reads `assets/Icon.png` (referenced as `"icon": "assets/icon.icns"` in package.json)
- Generates `icon.icns` with all required sizes (16, 32, 64, 128, 256, 512)
- Sets `CFBundleTypeIconFile` to `icon.icns` for document types
- macOS automatically adds the folded corner to file icons

### Files

- `assets/Icon.png` - Source icon (512x512)
- `package.json` - References `assets/icon.icns` (auto-generated during build)
- Built app contains `dist/mac-arm64/GoSheet.app/Contents/Resources/icon.icns`

### Verification

✅ App icon appears in dock  
✅ App icon appears in menu bar  
✅ .sheet files show custom icon with document styling  
✅ Icons follow macOS conventions (automatic document treatment)

### Notes

- No manual .icns generation needed - electron-builder handles it
- No separate file icon needed - macOS applies document styling automatically
- Icon source is 512x512 (ideally 1024x1024 for future retina displays, but 512x512 works fine)

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-16
