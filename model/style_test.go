package model

import (
	"testing"
)

func TestNewStyleRegistry(t *testing.T) {
	r := NewStyleRegistry()
	if r == nil {
		t.Fatal("NewStyleRegistry returned nil")
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
