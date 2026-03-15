package model

import (
	"fmt"

	"gosheet/logutil"
)

// Built-in style IDs. 0 = no style.
const (
	StyleIDNone   = 0
	StyleIDTitle  = 1
	StyleIDHeader = 2
	StyleIDTotal  = 3
)

// Font holds font formatting.
type Font struct {
	Name   string `json:"name"`
	Size   int    `json:"size"`
	Bold   bool   `json:"bold"`
	Italic bool   `json:"italic"`
	Color  string `json:"color"`
}

// Fill holds fill/background formatting.
type Fill struct {
	Pattern string `json:"pattern"`
	FgColor string `json:"fgColor"`
	BgColor string `json:"bgColor"`
}

// BorderSide describes one side of a border.
type BorderSide struct {
	Style string `json:"style"`
	Color string `json:"color"`
}

// Border holds border formatting for all four sides.
type Border struct {
	Left   BorderSide `json:"left"`
	Right  BorderSide `json:"right"`
	Top    BorderSide `json:"top"`
	Bottom BorderSide `json:"bottom"`
}

// Alignment holds horizontal alignment and text wrap.
type Alignment struct {
	Horizontal string `json:"horizontal"`
	Wrap       bool   `json:"wrap"`
}

// CellFormat groups font, fill, border, and alignment.
type CellFormat struct {
	Font      Font      `json:"font"`
	Fill      Fill      `json:"fill"`
	Border    Border    `json:"border"`
	Alignment Alignment `json:"alignment"`
}

// StyleInfo is a style with id and name for API responses. Story 13.3.
type StyleInfo struct {
	ID     int        `json:"id"`
	Name   string     `json:"name"`
	Format CellFormat `json:"format"`
}

// StyleRegistry holds format definitions indexed by style ID.
// Built-in styles: 1=Title, 2=Header, 3=Total.
type StyleRegistry struct {
	Formats []CellFormat   // Exported for serialization (MessagePack)
	Names   map[string]int // name -> index; exported for serialization (MessagePack)
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
		Alignment: Alignment{Horizontal: "center"},
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
		Alignment: Alignment{Horizontal: "center"},
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
		Alignment: Alignment{Horizontal: "left"},
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

// GetStyleNameByID returns the style name for the given id, or empty string if not found.
func (r *StyleRegistry) GetStyleNameByID(styleID int) string {
	if r == nil || r.Names == nil || styleID < 1 || styleID > len(r.Formats) {
		return ""
	}
	for name, id := range r.Names {
		if id == styleID {
			return name
		}
	}
	return ""
}

// UpdateStyle updates the format at the given style ID. Id must be 1..len(Formats).
// If name is non-empty, also updates the style name in Names. When name equals
// the current name for this id, it is allowed (no duplicate check).
func (r *StyleRegistry) UpdateStyle(id int, format *CellFormat, name string) error {
	if r == nil || format == nil {
		return fmt.Errorf("nil registry or format")
	}
	if id < 1 || id > len(r.Formats) {
		return fmt.Errorf("invalid style id %d", id)
	}
	r.Formats[id-1] = *format
	logutil.Debugf("[UpdateStyle] id=%d name=%q (len=%d) Names=%v", id, name, len(name), r.Names)
	if name != "" && r.Names != nil {
		// If name already points to this id, no update needed (format-only edit)
		if r.Names[name] == id {
			logutil.Debugf("[UpdateStyle] name %q already points to id %d, skipping Names update", name, id)
			return nil
		}
		if existingID, exists := r.Names[name]; exists && existingID != id {
			logutil.Debugf("[UpdateStyle] ERROR: name %q exists for id %d, we are id %d", name, existingID, id)
			return fmt.Errorf("style name %q already exists", name)
		}
		for n, tid := range r.Names {
			if tid == id {
				delete(r.Names, n)
				break
			}
		}
		r.Names[name] = id
	}
	return nil
}

// AddStyle appends a new style and returns its id. Name must be unique.
func (r *StyleRegistry) AddStyle(name string, format *CellFormat) (int, error) {
	if r == nil || format == nil {
		return 0, fmt.Errorf("nil registry or format")
	}
	if name == "" {
		return 0, fmt.Errorf("style name cannot be empty")
	}
	if r.Names == nil {
		r.Names = make(map[string]int)
	}
	if _, exists := r.Names[name]; exists {
		return 0, fmt.Errorf("style name %q already exists", name)
	}
	r.Formats = append(r.Formats, *format)
	id := len(r.Formats)
	r.Names[name] = id
	return id, nil
}

// RemoveStyle removes the style at id from Formats and updates Names.
// Caller must ensure cells are updated (StyleId cleared or decremented) before calling.
func (r *StyleRegistry) RemoveStyle(id int) error {
	if r == nil {
		return fmt.Errorf("nil registry")
	}
	if id < 1 || id > len(r.Formats) {
		return fmt.Errorf("invalid style id %d", id)
	}
	// Remove from Formats
	r.Formats = append(r.Formats[:id-1], r.Formats[id:]...)
	// Remove name for deleted id and decrement ids > id
	for name, tid := range r.Names {
		if tid == id {
			delete(r.Names, name)
		} else if tid > id {
			r.Names[name] = tid - 1
		}
	}
	return nil
}
