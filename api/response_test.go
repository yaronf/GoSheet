package api

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewSuccessResponse(t *testing.T) {
	resp := NewSuccessResponse(map[string]string{"value": "42"})
	assert.True(t, resp.Success)
	assert.Empty(t, resp.Error) // Error is string, not *string; success has empty Error
	assert.NotNil(t, resp.Data)
}

func TestNewErrorResponse(t *testing.T) {
	resp := NewErrorResponse("Something failed", CIRCULAR_REF)
	assert.False(t, resp.Success)
	assert.Equal(t, "Something failed", resp.Error)
	assert.Equal(t, CIRCULAR_REF, resp.Code)
}

func TestErrorCodeConstants(t *testing.T) {
	// Verify error codes are defined and non-empty
	assert.NotEmpty(t, CIRCULAR_REF)
	assert.NotEmpty(t, INVALID_FORMULA)
	assert.NotEmpty(t, FILE_NOT_FOUND)
	assert.NotEmpty(t, FILE_READ_ERROR)
	assert.NotEmpty(t, FILE_WRITE_ERROR)
	assert.NotEmpty(t, INVALID_CELL_REF)
	assert.NotEmpty(t, PARSE_ERROR)
}

func TestResponseJSONSerialization(t *testing.T) {
	resp := NewSuccessResponse(map[string]any{"computed": "100"})
	data, err := json.Marshal(resp)
	assert.NoError(t, err)
	assert.Contains(t, string(data), `"success":true`)
	assert.Contains(t, string(data), `"computed"`)

	errResp := NewErrorResponse("msg", INVALID_FORMULA)
	data2, err := json.Marshal(errResp)
	assert.NoError(t, err)
	assert.Contains(t, string(data2), `"success":false`)
	assert.Contains(t, string(data2), INVALID_FORMULA)
}
