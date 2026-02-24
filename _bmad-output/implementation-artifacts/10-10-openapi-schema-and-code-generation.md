# Story 10.10: OpenAPI Schema & Code Generation for API Contracts

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.10  
**Estimated Effort:** 8-16 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want API contracts defined in OpenAPI and types/code generated from them,  
So that frontend and backend stay in sync and API contract mismatches are eliminated.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright testing
- Existing HTTP API stable (server/, api/)

**Current State:**
- No single source of truth for API contracts
- Frontend and backend developed with manual synchronization
- Epic 3 and Epic 4 experienced API contract mismatches (100% failure rate on first test)
- Response formats and endpoint signatures maintained manually

**Existing endpoints (server/main.go):** `/api/cell/value`, `/api/cell/raw`, `/api/cell/set`, `/api/cell/ref`, `/api/cells/all`, `/api/file/save`, `/api/file/load`, `/api/file/new`, `/api/file/status`, `/api/file/download`, `/api/file/upload`, `/api/csv/preview`, `/api/csv/import`, `/api/csv/export`

**Why This Story:**
Epic 3 and Epic 4 both experienced API contract mismatches between frontend and backend. Defining contracts in OpenAPI and auto-generating types eliminates this class of bugs and provides compile-time verification.

**Source:** [architecture.md](../planning-artifacts/architecture.md#1-openapi-schema--code-generation-for-api-contracts) (Future Considerations)

---

## Acceptance Criteria

1. **OpenAPI schema defined**
   - [ ] OpenAPI 3.x schema documents all existing HTTP endpoints
   - [ ] Endpoints: `/api/cell/value`, `/api/cell/raw`, `/api/cell/set`, `/api/cell/ref`, `/api/cells/all`, `/api/file/*`, `/api/csv/*`
   - [ ] Request/response schemas defined for each endpoint
   - [ ] Schema lives in `api/openapi.yaml` or `docs/openapi.yaml`

2. **TypeScript types generated for frontend**
   - [ ] openapi-typescript or openapi-generator-cli integrated
   - [ ] Generated types used by api-client.js (or equivalent)
   - [ ] Build step generates types before frontend build

3. **Go server integration**
   - [ ] oapi-codegen or go-swagger generates server stubs/validators
   - [ ] Existing handlers wired to generated interfaces, or generated code validates requests
   - [ ] Build step includes code generation

4. **Documentation**
   - [ ] API docs generated from OpenAPI (e.g., Swagger UI or Redoc)
   - [ ] CONTRIBUTING.md or README updated with "Adding new API endpoints" instructions

5. **Verification**
   - [ ] All existing tests pass
   - [ ] No API contract regressions
   - [ ] `make build` and `npm run build` succeed

---

## Tasks / Subtasks

- [ ] Task 1: Define OpenAPI schema (AC: #1)
  - [ ] Audit existing endpoints in server/, api/
  - [ ] Create openapi.yaml with paths, schemas, request/response definitions
  - [ ] Validate schema (e.g., `npx @redocly/cli lint openapi.yaml`)
- [ ] Task 2: Integrate TypeScript code generation (AC: #2)
  - [ ] Add openapi-typescript or openapi-generator as devDependency
  - [ ] Add npm script to generate types
  - [ ] Update api-client.js to use generated types
- [ ] Task 3: Integrate Go code generation (AC: #3)
  - [ ] Add oapi-codegen or go-swagger
  - [ ] Generate server interface/types from schema
  - [ ] Wire existing handlers or add validation layer
- [ ] Task 4: Update build process (AC: #4, #5)
  - [ ] Makefile or package.json runs codegen before build
  - [ ] Document workflow for adding new endpoints
  - [ ] Run full test suite and fix any regressions

---

## Dev Notes

### Effort Breakdown (from architecture)
- Define OpenAPI schema for existing endpoints: ~4 hours
- Integrate code generation tooling: ~2-4 hours
- Update build process: ~2 hours
- Migrate existing code to use generated types: ~4-6 hours

### Recommended Tools
- **OpenAPI Generator:** https://openapi-generator.tech/
- **Go:** oapi-codegen, go-swagger
- **TypeScript:** openapi-typescript, openapi-generator-cli

### Related Issues
- Epic 3: 6 API contract bugs (Wails import map, endpoint mismatches, response format)
- Epic 4: 4 API contract bugs (frontend not calling new APIs, API signature mismatches)

### Architecture Compliance
- **API layer**: server/main.go handlers, api/ (response.go, csv.go, spreadsheet.go)
- **Frontend**: frontend/api-client.js — fetch calls
- **Vanilla JS**: No TypeScript build — openapi-typescript or generate .d.ts for JSDoc; or keep api-client.js untyped

### File Structure
- **New**: api/openapi.yaml or docs/openapi.yaml
- **Modify**: package.json (codegen scripts), Makefile, api-client.js, server handlers

---

## References

- [architecture.md](../planning-artifacts/architecture.md#1-openapi-schema--code-generation-for-api-contracts)
- [oapi-codegen](https://github.com/deepmap/oapi-codegen)
- [openapi-typescript](https://github.com/drwpow/openapi-typescript)

---

## Dev Agent Record

### File List
*(To be filled when implemented)*

### Change Log
*(To be filled when implemented)*

---

## Change Log

- 2026-02-24: Story created from architecture Future Considerations

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-24

OpenAPI schema and code generation for API contract enforcement.
