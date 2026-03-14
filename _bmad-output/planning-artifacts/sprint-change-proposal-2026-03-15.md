# Sprint Change Proposal — 2026-03-15

## Section 1: Issue Summary

**Trigger:** Backlog item "Language-independent file format" promoted via Correct Course. User chose **cross-language scope only** (no random access) and **MessagePack** as the replacement format.

**Problem statement:** GoSheet uses Go's `encoding/gob` for `.sheet` files. Gob is Go-only — other languages cannot decode it. This blocks:
- Third-party tools reading/writing `.sheet` files (Python, JavaScript, Rust, etc.)
- Future integrations (e.g., headless automation, batch processing, external editors)
- Ecosystem interoperability

**Evidence:** Research doc `technical-file-format-cross-language-random-access-research-2026-02-23.md` concludes that MessagePack is a viable replacement for gob with broad cross-language support. Migration is moderate effort: swap encoder/decoder, preserve structure (header, cells, merges, styles). Backward compatibility with gob is not required.

## Section 2: Impact Analysis

**Epic Impact:** Epics 1–21 unaffected. This is a new Epic 22.

**Story Impact:** No existing stories need modification. New stories only.

**Artifact Conflicts:**
- `epics.md` — add Epic 22
- `sprint-status.yaml` — add Epic 22 entries
- `backlog.md` — remove "Language-independent file format" (or mark promoted)
- `architecture.md` — update file format section (gob → MessagePack, version 2.0)
- `_bmad-output/planning-artifacts/specs/TECH_SPEC.md` — update serialization section
- Implementation artifacts referencing gob (5-5, 16-1, 16-3, etc.) — note migration in docs

**Technical Impact:**
- `model/file.go` — replace gob encode/decode with MessagePack
- `model/cell.go` — replace `GobEncode`/`GobDecode` with MessagePack-compatible encoding (e.g., `cellPersist` struct with msgpack tags, or custom marshaler)
- New dependency: `github.com/vmihailenco/msgpack/v5`
- File format version: v2.0 for MessagePack
- **No backward compatibility** — old gob files will not load; clean break
- `atomicWriteFile` and `SaveToFile`/`LoadFromFile`/`SaveToBytes`/`LoadFromBytes` — same API, different encoding

## Section 3: Recommended Approach

**Option 1: Direct MessagePack Migration (Recommended)**

1. Replace gob with MessagePack: marshal `FileHeader`, cells (as `map[int]map[int]*cellPersist`), merges, styles. Use `vmihailenco/msgpack/v5`.
2. Load path: decode MessagePack only. Old gob files will not load (clean break).
3. Save path: always write MessagePack (v2.0).
4. Round-trip tests: MessagePack encode → decode → assert match.
5. Bump file format version to "2.0" for MessagePack.

**Rationale:** Simpler implementation — no dual decoder, no format detection. Backward compatibility is explicitly not required. Research confirms MessagePack is equivalent to CBOR for this use case; user explicitly chose MessagePack.

**Risk:** Low. Effort: Low–Moderate (encoding layer swap, tests, version bump).

## Section 4: Detailed Change Proposals

### Epic 22: MessagePack File Format (Cross-Language)

**Goal:** Replace gob with MessagePack so `.sheet` files can be read/written by non-Go languages.

**Stories:**

| ID | Title | Scope |
|----|-------|-------|
| 22-1 | Replace gob with MessagePack persistence | Add `github.com/vmihailenco/msgpack/v5`. Implement MessagePack encode/decode preserving structure (header, cells as cellPersist map, merges, styles). Replace gob in `SaveToFile`, `SaveToBytes`, `LoadFromFile`, `LoadFromBytes`. Remove gob dependency. |
| 22-2 | Cell encoding for MessagePack | Replace `GobEncode`/`GobDecode` on `*Cell` with MessagePack-compatible path. Use `cellPersist` struct with msgpack struct tags; convert Cell↔cellPersist in encode/decode. Ensure `ParsedFormula` remains excluded (rebuilt on load). |
| 22-3 | Round-trip tests | Add tests: save → load → assert cells, merges, styles match. Test invalid/corrupt data handling. Golden files in testdata/ for MessagePack format. |
| 22-4 | Update documentation | Update `architecture.md`, `TECH_SPEC.md`, and implementation artifacts to document MessagePack as the native format (v2.0). |

**File format version:** v2.0 = MessagePack. No backward compatibility with gob.

**Backlog item to remove/update after implementation:**
- "Language-independent file format" — mark as promoted or remove from Ideas.

## Section 5: Implementation Handoff

**Scope:** Moderate — persistence layer swap, tests, docs.

**Handoff:** Dev agent implements stories sequentially via `bmad-bmm-dev-story`.

**Success criteria:**
- All `.sheet` files are MessagePack-encoded (v2.0)
- Round-trip tests pass (save → load → assert match)
- Documentation reflects MessagePack as the native format

**Dependency:** `go get github.com/vmihailenco/msgpack/v5`

## Checklist Status

- [x] 1.1 Trigger identified
- [x] 1.2 Problem defined
- [x] 1.3 Evidence documented
- [x] 2.1–2.5 Epic impact assessed
- [x] 3.1–3.4 Artifact conflicts analyzed
- [x] 4.1–4.4 Path forward selected
- [x] 5.1–5.5 Proposal components complete
- [ ] 6.1–6.2 Proposal reviewed (awaiting user approval)
