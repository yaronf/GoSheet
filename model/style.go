package model

// Built-in style IDs. 0 = no style.
const (
	StyleIDNone   = 0
	StyleIDTitle  = 1
	StyleIDHeader = 2
	StyleIDTotal  = 3
)

// Font holds font formatting.
type Font struct {
	Name   string // e.g. "Helvetica", "Arial"
	Size   int    // Point size (e.g. 12, 18)
	Bold   bool
	Italic bool
	Color  string // Hex color e.g. "#000000"
}

// Fill holds fill/background formatting.
type Fill struct {
	Pattern string // "none", "solid"
	FgColor string // Foreground color hex
	BgColor string // Background color hex
}

// BorderSide describes one side of a border.
type BorderSide struct {
	Style string // "none", "thin", "medium", "thick"
	Color string // Hex color
}

// Border holds border formatting for all four sides.
type Border struct {
	Left   BorderSide
	Right  BorderSide
	Top    BorderSide
	Bottom BorderSide
}

// Alignment holds horizontal and vertical alignment.
type Alignment struct {
	Horizontal string // "left", "center", "right"
	Vertical   string // "top", "center", "bottom"
}

// CellFormat groups font, fill, border, and alignment.
type CellFormat struct {
	Font      Font
	Fill      Fill
	Border    Border
	Alignment Alignment
}

// StyleRegistry holds format definitions indexed by style ID.
// Built-in styles: 1=Title, 2=Header, 3=Total.
type StyleRegistry struct {
	Formats []CellFormat   // Exported for gob encoding
	Names   map[string]int // name -> index; exported for gob encoding
}

// NewStyleRegistry creates a registry with built-in Title, Header, Total styles.
func NewStyleRegistry() *StyleRegistry {
	r := &StyleRegistry{
		Formats: make([]CellFormat, 0, 4),
		Names:   make(map[string]int),
	}
	// Index 0 reserved for "no style" - no format stored
	// Index 1: Title - 18pt bold, centered, dark text color
	r.Formats = append(r.Formats, CellFormat{
		Font: Font{Name: "Helvetica", Size: 18, Bold: true, Color: "#1a1a2e"},
		Fill: Fill{Pattern: "none"},
		Border: Border{
			Left:   BorderSide{Style: "none"},
			Right:  BorderSide{Style: "none"},
			Top:    BorderSide{Style: "none"},
			Bottom: BorderSide{Style: "none"},
		},
		Alignment: Alignment{Horizontal: "center", Vertical: "center"},
	})
	r.Names["Title"] = 1

	// Index 2: Header - bold, light gray fill, bottom border, centered, black text
	r.Formats = append(r.Formats, CellFormat{
		Font: Font{Name: "Helvetica", Size: 12, Bold: true, Color: "#000000"},
		Fill: Fill{Pattern: "solid", FgColor: "#E0E0E0", BgColor: "#E0E0E0"},
		Border: Border{
			Left:   BorderSide{Style: "none"},
			Right:  BorderSide{Style: "none"},
			Top:    BorderSide{Style: "none"},
			Bottom: BorderSide{Style: "thin", Color: "#000000"},
		},
		Alignment: Alignment{Horizontal: "center", Vertical: "center"},
	})
	r.Names["Header"] = 2

	// Index 3: Total - bold, top border, left aligned, dark gray text
	r.Formats = append(r.Formats, CellFormat{
		Font: Font{Name: "Helvetica", Size: 12, Bold: true, Color: "#333333"},
		Fill: Fill{Pattern: "none"},
		Border: Border{
			Left:   BorderSide{Style: "none"},
			Right:  BorderSide{Style: "none"},
			Top:    BorderSide{Style: "thin", Color: "#000000"},
			Bottom: BorderSide{Style: "none"},
		},
		Alignment: Alignment{Horizontal: "left", Vertical: "center"},
	})
	r.Names["Total"] = 3

	return r
}

// GetFormat returns a copy of the CellFormat for the given style ID, or nil if invalid.
// Returns a copy so callers cannot mutate the registry.
func (r *StyleRegistry) GetFormat(styleID int) *CellFormat {
	if r == nil || styleID < 1 || styleID > len(r.Formats) {
		return nil
	}
	cp := new(CellFormat)
	*cp = r.Formats[styleID-1]
	return cp
}

// HasStyle returns true if the style ID exists in the registry.
func (r *StyleRegistry) HasStyle(styleID int) bool {
	return r.GetFormat(styleID) != nil
}

// GetStyleIDByName returns the style ID for a built-in name, or 0 if not found.
func (r *StyleRegistry) GetStyleIDByName(name string) int {
	if r == nil || r.Names == nil {
		return 0
	}
	if id, ok := r.Names[name]; ok {
		return id
	}
	return 0
}
