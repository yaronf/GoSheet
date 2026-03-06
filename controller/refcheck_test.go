package controller

import (
	"fmt"
	"testing"
)

func TestRefBehavior(t *testing.T) {
	ctrl := NewAppController()
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "=A1+A2") // formula referencing A2 (row 1)
	ctrl.History.Clear()

	ctrl.DeleteRow(1) // delete row 1 → formula becomes =A1+#REF!
	fmt.Printf("formula cell value: %q\n", ctrl.GetCellValue(1, 0))
	fmt.Printf("formula cell raw: %q\n", ctrl.Sheet.GetCell(1, 0).RawValue())
	fmt.Printf("isError: %v\n", ctrl.Sheet.GetCell(1, 0).IsError)
}
