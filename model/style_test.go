package model

import (
	"testing"
)

func TestNewStyleRegistry(t *testing.T) {
	r := NewStyleRegistry()
	if r == nil {
		t.Fatal("NewStyleRegistry returned nil")
		return
	}
	if len(r.Formats) != 3 {
		t.Errorf("Expected 3 built-in formats, got %d", len(r.Formats))
	}
}

func TestStyleRegistry_HasStyle(t *testing.T) {
	r := NewStyleRegistry()
	if r.HasStyle(0) {
		t.Error("StyleId 0 should not be valid")
	}
	if !r.HasStyle(1) || !r.HasStyle(2) || !r.HasStyle(3) {
		t.Error("Built-in styles 1, 2, 3 should be valid")
	}
	if r.HasStyle(4) {
		t.Error("StyleId 4 should not exist")
	}
}

func TestStyleRegistry_GetFormat(t *testing.T) {
	r := NewStyleRegistry()
	f := r.GetFormat(1)
	if f == nil {
		t.Fatal("GetFormat(1) returned nil")
		return
	}
	if !f.Font.Bold || f.Font.Size != 18 {
		t.Errorf("Title style: expected bold 18pt, got bold=%v size=%d", f.Font.Bold, f.Font.Size)
	}
	if r.GetFormat(0) != nil || r.GetFormat(99) != nil {
		t.Error("GetFormat for invalid id should return nil")
	}
}

func TestStyleRegistry_GetStyleIDByName(t *testing.T) {
	r := NewStyleRegistry()
	if r.GetStyleIDByName("Title") != 1 {
		t.Error("Title should be style 1")
	}
	if r.GetStyleIDByName("Header") != 2 {
		t.Error("Header should be style 2")
	}
	if r.GetStyleIDByName("Total") != 3 {
		t.Error("Total should be style 3")
	}
	if r.GetStyleIDByName("Unknown") != 0 {
		t.Error("Unknown style should return 0")
	}
}

func TestStyleRegistry_UpdateStyle(t *testing.T) {
	r := NewStyleRegistry()
	f := r.GetFormat(1)
	if f == nil {
		t.Fatal("GetFormat(1) returned nil")
		return
	}
	f.Font.Size = 24
	if err := r.UpdateStyle(1, f, ""); err != nil {
		t.Fatal(err)
	}
	if r.GetFormat(1).Font.Size != 24 {
		t.Error("UpdateStyle should have updated format")
	}
	if err := r.UpdateStyle(0, f, ""); err == nil {
		t.Error("UpdateStyle(0) should error")
	}
}

func TestStyleRegistry_AddStyle(t *testing.T) {
	r := NewStyleRegistry()
	id, err := r.AddStyle("Custom", &CellFormat{Font: Font{Size: 14}})
	if err != nil {
		t.Fatal(err)
	}
	if id != 4 {
		t.Errorf("Expected id 4, got %d", id)
	}
	if r.GetStyleIDByName("Custom") != 4 {
		t.Error("Custom should be style 4")
	}
	if _, err := r.AddStyle("Custom", &CellFormat{}); err == nil {
		t.Error("AddStyle duplicate name should error")
	}
}

func TestStyleRegistry_RemoveStyle(t *testing.T) {
	r := NewStyleRegistry()
	_, _ = r.AddStyle("Custom", &CellFormat{Font: Font{Size: 14}})
	if err := r.RemoveStyle(4); err != nil {
		t.Fatal(err)
	}
	if len(r.Formats) != 3 {
		t.Errorf("After RemoveStyle(4), expected 3 formats, got %d", len(r.Formats))
	}
	if r.GetStyleIDByName("Custom") != 0 {
		t.Error("Custom should be removed")
	}
}
