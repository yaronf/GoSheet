---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'File format for cross-language access, random access, and localized changes — should GoSheet retain gob? CBOR, MessagePack, SQLite, ZIP+XML alternatives'
research_goals: 'Evaluate format options for future cross-language file access, random access into the file, and localized (partial) changes'
user_name: 'Yaron'
date: '2026-02-23'
web_research_enabled: true
source_verification: true
---

# File Format for Cross-Language Access, Random Access, and Localized Changes: Comprehensive Technical Research

**Date:** 2026-02-23  
**Author:** Yaron  
**Research Type:** technical

---

## Executive Summary

GoSheet currently uses Go's native **gob** encoding for `.sheet` files. This research evaluates whether to retain gob and what alternatives exist if the project needs **cross-language file access**, **random access** into the file, or **localized (partial) changes**.

**Key findings:** Gob is Go-only and cannot be decoded by other languages. **CBOR** and **MessagePack** are strong replacements for sequential serialization with broad cross-language support. **SQLite** and **ZIP+XML** (XLSX/ODS-style) support random access and partial updates. Migration from gob to CBOR is moderate effort (persistence abstraction, encoder swap, round-trip tests).

**Recommendations:** (1) Keep gob short-term; finish Epic 11. (2) When cross-language matters, migrate to CBOR via phased rollout. (3) When random access matters, evaluate SQLite or ZIP-based format.

---

## Table of Contents

1. Technical Research Scope Confirmation
2. Technology Stack Analysis
3. Integration Patterns Analysis
4. Architectural Patterns and Design
5. Implementation Approaches and Technology Adoption
6. Format Comparison (Gob, CBOR, MessagePack, JSON, SQLite, ZIP+XML)
7. Summary and Recommendations
8. Technical Research Methodology and Source Verification
9. Appendix: Broader Format Landscape (Schema-Driven and Analytics)
10. References
11. Technical Research Conclusion

---

## 1. Technical Research Scope Confirmation

**Research Topic:** File format for cross-language access, random access, and localized changes — should GoSheet retain gob? CBOR, MessagePack, SQLite, ZIP+XML alternatives

**Research Goals:** Evaluate format options for future cross-language file access, random access into the file, and localized (partial) changes

**Technical Research Scope:**

- Architecture Analysis — design patterns, frameworks, system architecture
- Implementation Approaches — development methodologies, coding patterns
- Technology Stack — languages, frameworks, tools, platforms
- Integration Patterns — APIs, protocols, interoperability
- Performance Considerations — scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-02-23

---

## Technology Stack Analysis

### Programming Languages

Go is the primary language for GoSheet. Cross-language file access implies readers/writers in Python, JavaScript, Rust, and others. CBOR and MessagePack have mature libraries across these languages (e.g. `cbor2` in Python, `cbor` in Node.js). SQLite has bindings in virtually every language. Gob has no non-Go implementations.

_Popular Languages for Format Consumers:_ Go (writer), Python/JavaScript (potential readers, analytics, web tools)  
_Language Evolution:_ Cross-language formats favor standards (CBOR RFC 8949, MessagePack spec) over language-specific encodings  
_Source:_ [pkg.go.dev/github.com/fxamacker/cbor](https://pkg.go.dev/github.com/fxamacker/cbor), [msgpack.org](https://msgpack.org/)

### Development Frameworks and Libraries

**Go serialization libraries:**
- **encoding/gob** — stdlib, Go-only
- **github.com/fxamacker/cbor/v2** — RFC 8949 compliant, v2.6+ (2024), used by Kubernetes; 375+ tests, fuzzing
- **github.com/vmihailenco/msgpack/v5** — MessagePack for Go
- **modernc.org/sqlite** — CGo-free SQLite driver, v1.46+ (2026), 2000+ importers, pure Go

**Spreadsheet format libraries:** SheetJS (xlsx), excelize (Go), openpyxl (Python) for XLSX/ODS read/write.

_Major Frameworks:_ fxamacker/cbor for CBOR; modernc/sqlite for embedded DB  
_Ecosystem Maturity:_ CBOR and SQLite have strong cross-language support  
_Source:_ [pkg.go.dev/modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), [ugorji.net/blog/serialization-in-go](https://ugorji.net/blog/serialization-in-go)

### Database and Storage Technologies

| Technology | Role | Random Access | Cross-Language |
|------------|------|---------------|---------------|
| Gob | Sequential binary | ❌ | ❌ |
| CBOR | Sequential binary | ❌ | ✅ |
| MessagePack | Sequential binary | ❌ | ✅ |
| JSON | Sequential text | ❌ | ✅ |
| SQLite | Relational DB file | ✅ | ✅ |
| ZIP+XML (XLSX/ODS) | Archive + per-sheet files | ✅ (per file) | ✅ |

_Relational:_ SQLite as single-file DB for cell storage  
_Serialization:_ CBOR/MessagePack for compact sequential; JSON for interchange  
_Source:_ [SheetJS formats](https://docs.sheetjs.com/docs/miscellany/formats/), [XLSX vs ODS comparison](https://blog.fileformat.com/spreadsheet/xlsx-vs-ods-vs-fods-the-ultimate-open-format-showdown/)

### Development Tools and Platforms

- **Format validators:** CBOR has RFC 8949 conformance tests; MessagePack has implementation checkers
- **Migration tools:** Custom tooling needed for gob → CBOR/MessagePack (structure-preserving encode/decode swap)
- **SQLite tooling:** sqlite3 CLI, DB Browser for SQLite — inspect `.db` files without Go
- **Build systems:** No format-specific build changes; library swap only

_IDE and Editors:_ Standard Go tooling  
_Testing Frameworks:_ Benchmark comparisons (ugorji/go-codec-bench, smallnest/gosercomp)  
_Source:_ [ugorji/go-codec-bench](https://github.com/ugorji/go-codec-bench), [msgpack-vs-cbor benchmark](https://prataprc.github.io/msgpack-vs-cbor.html)

### Technology Adoption Trends

- **XLSX/ODS dominance:** ZIP+XML remains standard for office spreadsheets; SheetJS, excelize, openpyxl widely used
- **Binary formats:** CBOR adoption in IoT, COSE, WebAuthn; MessagePack in caching/RPC
- **SQLite for app data:** Common for embedded storage (browsers, mobile, Electron)
- **Gob:** Stable in Go ecosystem but no expansion beyond Go

_Migration Patterns:_ Gob → CBOR/MessagePack is low-friction (swap encoder); Gob → SQLite is architectural  
_Emerging Technologies:_ CBOR 2.7 (2024) adds decoding options; modernc/sqlite enables WASM builds  
_Source:_ [fxamacker/cbor releases](https://github.com/fxamacker/cbor/releases)

---

## Integration Patterns Analysis

### API Design Patterns

GoSheet exposes file operations via FileService (Open, Save, Save As). Format choice affects API surface: gob is opaque; CBOR/MessagePack/JSON enable format-agnostic read/write if structure is documented. REST-style export (e.g. `?format=json`) is common in spreadsheet APIs (Google Sheets, Aspose.Cells).

_RESTful APIs:_ Google Sheets API, Aspose.Cells Cloud use REST for spreadsheet CRUD; format specified via query params  
_Export Patterns:_ `POST /export?format=PDF|JSON|XLSX` — format as parameter, not storage default  
_Source:_ [Google Sheets API](https://developers.google.com/sheets/api/reference/rest), [Aspose Cells Export](https://docs.aspose.cloud/cells/export-spreadsheet-as-format)

### Communication Protocols

File I/O is the primary protocol for GoSheet (local .sheet files). HTTP is used for the in-process API between Electron frontend and Go backend. Format choice does not change protocol; it affects payload encoding. For future cloud or sync, CBOR/MessagePack would reduce payload size vs JSON.

_HTTP/HTTPS:_ Used for in-app API; format affects request/response body encoding  
_File I/O:_ Native dialogs read/write bytes; decoder choice (gob vs CBOR) is backend-internal  
_Source:_ [CSVBox import patterns](https://blog.csvbox.io/import-spreadsheet-to-rest-api/)

### Data Formats and Standards

| Format | Interchange | Standard | Cross-Language |
|--------|-------------|----------|----------------|
| Gob | ❌ Go only | Go stdlib | ❌ |
| CBOR | ✅ | RFC 8949 | ✅ |
| MessagePack | ✅ | Community spec | ✅ |
| JSON | ✅ | RFC 8259 | ✅ |
| SQLite | ✅ | De facto | ✅ |
| XLSX/ODS | ✅ | OOXML/ODF | ✅ |

_JSON and XML:_ JSON for API responses; XLSX/ODS use XML inside ZIP for interchange  
_Protobuf and MessagePack:_ Binary formats for compact interchange; CBOR used in COSE, WebAuthn, CWT  
_Source:_ [Wikipedia serialization comparison](https://en.wikipedia.org/wiki/Comparison_of_data_serialization_formats), [RFC 9052 COSE](https://rfc-editor.org/rfc/rfc9052.html)

### System Interoperability Approaches

Cross-language file access requires a documented, standard format. Gob fails; CBOR, MessagePack, JSON, SQLite, and XLSX/ODS succeed. Apache Arrow is another option for tabular data (columnar, zero-copy) but targets analytics rather than spreadsheet editing.

_Point-to-Point:_ Direct file read by Python/JS tool using CBOR/MessagePack library  
_Export Bridge:_ GoSheet writes JSON or XLSX for external consumers; native format stays gob until migration  
_Source:_ [Apache Arrow FAQ](https://arrow.apache.org/faq), [Arrow format spec](https://arrow.apache.org/docs/format/index.html)

### Format Migration and Versioning

Migrating gob → CBOR/MessagePack: preserve structure (header, cells map, merges), swap encoder/decoder. Version field in header supports format detection. Backward compat (loading old gob files) requires dual decoder during transition.

_Data Migration:_ Read gob → in-memory model → write CBOR; one-time migration script  
_Versioning:_ FileHeader.Version ("1.1" today) can become "2.0" for CBOR; loader branches on version  
_Source:_ [Comparison of data serialization formats](https://en.wikipedia.org/wiki/Comparison_of_data_serialization_formats)

### Integration Security Patterns

File format does not dictate security; storage and transport do. Encryption at rest (e.g. OS-level) or in-transit (HTTPS) applies regardless of format. CBOR has COSE (RFC 9052) for signed/encrypted payloads if needed; not required for local .sheet files.

_Data Integrity:_ Optional checksum or COSE signature for tamper detection  
_Encryption:_ Format-agnostic; encrypt bytes before write if required  
_Source:_ [RFC 9052 COSE](https://rfc-editor.org/rfc/rfc9052.html)

---

## Architectural Patterns and Design

### System Architecture Patterns

**Separate persistence from domain.** Use a Repository or Data Mapper pattern so the domain model (Spreadsheet, Cell, MergeRegion) stays independent of storage format. The persistence layer implements `Load(reader) → *Spreadsheet` and `Save(spreadsheet, writer) → error`. Swapping gob for CBOR or SQLite then only requires changing the persistence implementation, not the domain.

_Repository Pattern:_ Mediates between domain and data mapping; collection-like interface for load/save  
_Data Mapper:_ Transfers data between in-memory objects and storage; keeps domain and format decoupled  
_Source:_ [Martin Fowler Repository](https://martinfowler.com/eaaCatalog/repository.html), [Data Mapper](https://www.martinfowler.com/eaaCatalog/dataMapper.html)

### Design Principles and Best Practices

**Single responsibility:** Domain logic (formulas, merges) does not encode bytes. Persistence layer handles encoding/decoding. **Open/closed:** Add new formats (e.g. CBOR) by implementing the persistence interface without changing existing code. **Version in header:** FileHeader.Version enables format detection and branching for migration.

_SOLID:_ Persistence as separate module; format as implementation detail  
_Expand and Contract:_ For migration, deploy new schema alongside old; migrate data; switch; rollback if needed  
_Source:_ [Prisma expand and contract](https://prisma.io/dataguide/types/relational/expand-and-contract-pattern)

### Scalability and Performance Patterns

**SQLite vs file-based:** SQLite is faster for small records (<1 KiB), atomic transactions, and incremental updates. File-based (gob, CBOR) can be faster for large sequential reads/writes. For spreadsheets with many small cells, SQLite is a strong fit; for full-document load/save, binary formats are competitive.

**File size:** CBOR/MessagePack typically 30–50% smaller than JSON. Gob is compact but Go-specific. SQLite adds page overhead but compacts well for many small rows.

_Source:_ [SQLite as application file format](https://sqlite.org/draft/appfileformat.html), [Performance comparison filesystem vs embedded DB](https://archive-p.bsafes.com/docs/P/Performance-Comparison-of-Operations-in-the-File-System-and-in-Embedded-Key-Value-Databases)

### Data Architecture Patterns

**Schema evolution:** Version field in header; safe changes = add optional fields, widen types; breaking = remove fields, rename without alias. For gob → CBOR migration, preserve structure (header, cells, merges); map field names if needed.

**Backward compatibility:** New loader can read old format during transition. Dual decoder (gob + CBOR) until migration complete. Document version support in file spec.

_Source:_ [AWS backward compatibility](https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.5-ensure-backwards-compatibility-for-data-store-and-schema-changes.html), [DataExpert schema evolution](https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide)

### Security Architecture Patterns

**Integrity:** Optional hash or COSE signature for tamper detection. **Encryption:** At rest (OS or app-level) or in transit (HTTPS); format-agnostic. **Least privilege:** File I/O uses standard OS permissions; no format-specific security beyond access control.

_Source:_ [RFC 9052 COSE](https://rfc-editor.org/rfc/rfc9052.html)

### Deployment and Operations Architecture

**Single-file documents:** .sheet (gob), .sheet (CBOR), or .db (SQLite) are all single-file, portable. **Migration tooling:** One-time script: read gob → write CBOR; verify round-trip. **Rollback:** Keep gob decoder during transition; document deprecation timeline.

_Source:_ [SQLite app file format](https://sqlite.org/draft/appfileformat.html)

---

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

**Phased migration (gob → CBOR):** (1) Introduce persistence interface (Repository pattern); (2) Implement CBOR persistence alongside gob; (3) Add version "2.0" for CBOR; (4) Migration script: load gob → save CBOR; (5) Deprecate gob decoder after transition. Avoid big-bang; support both formats during transition.

**Gradual adoption:** New files use CBOR; old files load via gob until user saves (converts). Document format in file header for detection.

_Source:_ [SWAT large-scale migrations](https://www.swat.engineering/news/performing-large-scale-software-migrations-with-confidence/), [fxamacker/cbor](https://pkg.go.dev/github.com/fxamacker/cbor/v2)

### Development Workflows and Tooling

**Go tooling:** `go get github.com/fxamacker/cbor/v2`. Replace `gob.Encode`/`gob.Decode` with `cbor.Marshal`/`cbor.Unmarshal`. Struct tags (`omitempty`, `keyasint`) for compact encoding. No code generation required for basic use.

**Persistence abstraction:** Define `type Persistence interface { Load(io.Reader) (*Spreadsheet, error); Save(*Spreadsheet, io.Writer) error }`. Implement `GobPersistence` and `CborPersistence`; select by version.

_Source:_ [fxamacker/cbor CBOR_GOLANG.md](https://github.com/fxamacker/cbor/blob/v2.4.0/CBOR_GOLANG.md)

### Testing and Quality Assurance

**Round-trip testing:** Encode spreadsheet → decode → assert equality. Critical for migration validation. Properties: (1) no information lost; (2) legacy format expressible in new format.

**Migration testing:** Load fixture gob files → convert to CBOR → load CBOR → assert cells and merges match. Use reproduction: migrate then inverse-migrate, compare to original.

**Fixture strategy:** Golden files (gob, CBOR) in testdata/; table-driven tests for edge cases (empty, sparse, large merges).

_Source:_ [SWAT migration confidence](https://www.swat.engineering/news/performing-large-scale-software-migrations-with-confidence/), [Apache Arrow integration testing](https://arrow.apache.org/docs/10.0/format/Integration.html)

### Deployment and Operations Practices

**Single-file format:** No infrastructure changes. .sheet files remain portable. Optional: add `?format=json` export endpoint for API consumers.

**Migration rollout:** Ship dual decoder; default save as CBOR (v2.0); keep gob read for backward compat. Document deprecation timeline for gob.

_Source:_ [SQLite app file format](https://sqlite.org/draft/appfileformat.html)

### Risk Assessment and Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Round-trip tests; checksum verification; backup before convert |
| Breaking existing .sheet files | Dual decoder; version detection; no auto-convert on open |
| Performance regression | Benchmark load/save before/after; CBOR often comparable or faster |
| Cross-language reader bugs | Publish schema; add JSON export for validation |

_Source:_ [SWAT migration confidence](https://www.swat.engineering/news/performing-large-scale-software-migrations-with-confidence/)

---

## Technical Research Recommendations

### Implementation Roadmap

1. **Phase 1 (Short term):** Keep gob. Complete Epic 11 (merging). Introduce `Persistence` interface if not present.
2. **Phase 2 (When cross-language needed):** Implement CBOR persistence; add version "2.0"; default save to CBOR; retain gob load.
3. **Phase 3 (Optional):** Migration script for batch conversion; deprecate gob after transition period.
4. **Phase 4 (If random access needed):** Evaluate SQLite; design schema; implement as new persistence backend.

### Technology Stack Recommendations

- **For cross-language (sequential):** `github.com/fxamacker/cbor/v2` — RFC 8949, production-ready, used by Kubernetes.
- **For random access:** `modernc.org/sqlite` — CGo-free, single-file, cross-language.
- **For interchange:** JSON export endpoint; XLSX export via excelize if Excel compatibility required.

### Success Metrics and KPIs

- Round-trip tests pass for all formats
- No data loss in migration (checksum or semantic comparison)
- Cross-language reader can parse CBOR output (e.g. Python script)
- Load/save performance within 20% of baseline

---

## Format Comparison Summary

| Requirement | Gob | CBOR | MessagePack | JSON | SQLite | ZIP+XML (XLSX-style) |
|-------------|-----|------|-------------|------|--------|----------------------|
| Cross-language | ❌ Go only | ✅ | ✅ | ✅ | ✅ | ✅ |
| Random access | ❌ Sequential | ❌ Sequential | ❌ Sequential | ❌ Sequential | ✅ | ✅ (per-file) |
| Localized changes | ❌ Full rewrite | ❌ Full rewrite | ❌ Full rewrite | ❌ Full rewrite | ✅ Row/cell | ✅ Replace sheet XML |
| Compactness | Good | Good | Good | Poor | Good | Moderate |
| Standardization | Go stdlib | RFC 8949 | Community | RFC 8259 | De facto | OOXML/ODF |

---

## 1. Current State: Gob

### What Gob Is

- Go's native binary serialization (`encoding/gob`)
- No schema or code generation; uses reflection
- Optimized for Go-to-Go communication (e.g. `net/rpc`)
- **Not interoperable** — other languages cannot decode gob without reverse-engineering the format

### Gob Limitations

- **Cross-language:** Gob encodes Go-specific type information. There is no standard specification; decoders in Python, JavaScript, etc. would need custom implementation and would break when Go types change.
- **Random access:** Gob is a sequential stream. To read cell (100, 50), you must decode everything before it. No offset table or index.
- **Localized changes:** Saving requires full encode of the entire spreadsheet. No in-place update of a single cell or range.

### When Gob Is Fine

- Go-only application
- Full load/save (no partial read or write)
- No need for external tools or other languages to read `.sheet` files

---

## 2. CBOR (Concise Binary Object Representation)

### Overview

- **RFC 8949** — IETF standard
- JSON-like data model (maps, arrays, strings, numbers, etc.)
- Compact binary encoding
- Libraries in Go, Python, JavaScript, Rust, C, Java, etc.

### Cross-Language Support

✅ **Strong.** CBOR is widely implemented. Any language with a CBOR library can decode a GoSheet file if the structure is documented.

### Random Access

❌ **Not native.** CBOR is sequentially encoded. Each item's length is determined by parsing its header; there is no built-in index or offset table. To reach item N, you typically parse items 1..N-1. Streaming and incremental parsing are supported, but not true random access to arbitrary positions.

### Localized Changes

❌ **Full rewrite.** To change one cell, you would decode the whole file, modify in memory, and re-encode. Same as gob.

### Go Libraries

- `github.com/fxamacker/cbor/v2` — popular, RFC-compliant
- `github.com/ugorji/go/codec` — supports CBOR and others

### Verdict

CBOR is a good **replacement for gob** if you want cross-language and keep the current "full load / full save" model. It does not solve random access or localized changes.

---

## 3. MessagePack

### Overview

- Binary format similar to JSON
- Often used as a compact JSON replacement (WebSocket, caching, RPC)
- Broad language support

### Cross-Language Support

✅ **Strong.** MessagePack has official and community implementations in many languages.

### Random Access and Localized Changes

❌ Same as CBOR — sequential format, full read/write. No native random access or partial update.

### Verdict

MessagePack is another viable replacement for gob for cross-language sequential serialization. Slightly less standardized than CBOR (no RFC), but very widely used.

### CBOR vs MessagePack: Direct Comparison

| Aspect | CBOR | MessagePack |
|--------|------|-------------|
| **Standardization** | RFC 8949 (IETF); formal spec | Community spec; no RFC |
| **Extensibility** | Tags (extension mechanism); future-proof | Extension types; less formal |
| **Data types** | Nil, numbers, booleans, strings, binary, arrays, maps, tags | Same core types; extension types |
| **Message size** | Comparable to MessagePack (~27–50% smaller than JSON) | Comparable to CBOR |
| **Encoding (Go)** | Often 1.5–3× faster; heterogeneous arrays up to ~15× | Competitive on bytes, strings, maps |
| **Decoding (Go)** | Better on nil, integers, floats, booleans, arrays | Better on bytes, strings, maps |
| **Ecosystem** | COSE, WebAuthn, CWT, IoT; Kubernetes adoption | Caching, RPC, WebSocket; broad use |
| **Go libraries** | fxamacker/cbor (RFC-compliant), ugorji/go/codec | vmihailenco/msgpack, tinylib/msgp |

**When to choose CBOR:** Need formal standardization, extensibility (tags), or alignment with IETF/security standards (COSE, WebAuthn). Slightly better encoding performance in many Go benchmarks.

**When to choose MessagePack:** Already using it (caching, RPC); prefer simpler extension model; or ecosystem preference. Slightly better on string/map-heavy decoding in some benchmarks.

**For GoSheet:** Either is viable. CBOR has the edge for standardization and Go encoding performance; MessagePack is equally practical if the team prefers it or has existing tooling.

_Source:_ [msgpack-vs-cbor benchmark](https://prataprc.github.io/msgpack-vs-cbor.html), [JSON-like serializations comparison](https://zderadicka.eu/comparison-of-json-like-serializations-json-vs-ubjson-vs-messagepack-vs-cbor/), [Wikipedia serialization formats](https://en.wikipedia.org/wiki/Comparison_of_data_serialization_formats)

---

## 4. JSON

### Overview

- Human-readable, universally supported
- No schema; structure is self-describing

### Cross-Language Support

✅ **Universal.** Every language has JSON support.

### Random Access and Localized Changes

❌ **Sequential.** JSON is text; parsing is sequential. No binary offsets. Localized changes require full parse, modify, re-serialize. Also larger file size than binary formats.

### Verdict

Useful for debugging, export, or simple interchange. Not ideal as the primary storage format for large spreadsheets due to size and lack of random access.

---

## 5. SQLite

### Overview

- Single-file database
- SQL interface; data stored in tables
- Ubiquitous (browsers, mobile, embedded)

### Cross-Language Support

✅ **Strong.** SQLite has bindings in virtually every language.

### Random Access

✅ **Native.** `SELECT` and `UPDATE` by row/column. Indexes enable efficient lookups. No need to read the whole file.

### Localized Changes

✅ **Native.** `UPDATE cells SET value = ? WHERE row = ? AND col = ?`. Only the affected pages are written. SQLite uses a page-based format; partial updates are a core feature.

### Schema Example

```sql
CREATE TABLE cells (row INT, col INT, value TEXT, formula TEXT, computed TEXT, ...);
CREATE TABLE merges (start_row INT, start_col INT, row_span INT, col_span INT);
```

### Tradeoffs

- **Complexity:** Need to manage schema, migrations, and SQL. More moving parts than a simple gob encode/decode.
- **Tooling:** `.db` files are inspectable with standard SQLite tools (sqlite3, DB Browser).
- **Interop:** Other apps can query GoSheet files with SQL if schema is documented.

### Verdict

SQLite is the strongest option if **random access** and **localized changes** are important. It also provides cross-language access. Migration from gob would require a new persistence layer and schema design.

---

## 6. ZIP + XML (XLSX / ODS Style)

### Overview

- XLSX (Office Open XML) and ODS (OpenDocument) are ZIP archives containing XML files
- Each worksheet is typically a separate XML file
- `xl/worksheets/sheet1.xml`, `xl/sharedStrings.xml`, etc.

### Cross-Language Support

✅ **Strong.** XLSX and ODS are standards (ECMA-376, ODF). Libraries exist in all major languages.

### Random Access

✅ **At the file level.** You can read or replace individual files inside the ZIP without extracting the whole archive. For example, update only `sheet1.xml` when cells in sheet 1 change. Full random access to a single cell would require parsing the sheet XML, but you avoid rewriting the entire workbook.

### Localized Changes

✅ **Partial update possible.** Replace only the modified sheet XML (or other part) in the ZIP. The rest of the archive is unchanged.

### Tradeoffs

- **Complexity:** ZIP handling, XML parsing, and format specifics (OOXML/ODF) are non-trivial.
- **Interop:** If you emit XLSX or ODS, users can open files in Excel, LibreOffice, etc. High interoperability.
- **Effort:** Significant implementation work compared to gob.

### Verdict

ZIP+XML is the standard approach for office documents. It supports partial updates and cross-language use. Adopting it would mean either emitting XLSX/ODS directly or designing a similar structure (ZIP + custom XML/JSON per sheet).

---

## 7. Custom Format with Index

### Concept

Design a binary format with:

1. **Header** — version, metadata
2. **Index / offset table** — byte offsets to each logical block (e.g. per-row, per-sheet, or per-cell-range)
3. **Data blocks** — serialized cells/merges (using CBOR, MessagePack, or custom binary)

### Random Access

✅ **Yes.** With an offset table, you can `seek()` to the block containing a given cell and decode only that block.

### Localized Changes

✅ **Possible.** Rewrite only the modified blocks and update the index. Requires careful design (e.g. block size, append-only vs in-place).

### Cross-Language

⚠️ **Depends on block encoding.** If blocks use CBOR or MessagePack, any language with those libraries can participate. If custom binary, you need a spec and implementations.

### Verdict

Flexible but requires upfront design and more implementation work. Suitable if you need fine-grained random access and want to avoid SQLite or ZIP.

---

## 8. Summary and Recommendations

### If You Need Cross-Language Only (No Random Access Yet)

- **CBOR** or **MessagePack** are good replacements for gob.
- Migration: change `encoding/gob` to a CBOR/MessagePack encoder/decoder. Structure (header, cells, merges) can stay similar.
- Effort: Moderate (swap encoding layer, add tests, version bump).

### If You Need Random Access and Localized Changes

- **SQLite** — Best fit. Cells and merges as tables; `UPDATE` for partial changes; standard tooling.
- **ZIP + XML/JSON** — XLSX/ODS-style. Partial update by replacing sheet files. High interoperability.
- **Custom indexed format** — Maximum control, more work.

### If You Stay with Gob for Now

- Document that the format is **Go-only** and not intended for external consumption.
- If cross-language or random access becomes a requirement, plan a format migration as a dedicated epic.
- Consider an **export** path (e.g. CSV, JSON, or XLSX) for interchange, while keeping gob for native storage.

### Suggested Path

1. **Now:** Keep gob. Finish Epic 11 (merging) and stabilize.
2. **When cross-language matters:** Evaluate CBOR/MessagePack for a v2 format. One-time migration, document schema.
3. **When random access / partial save matters:** Evaluate SQLite or ZIP-based format. Larger architectural change.

---

## Technical Research Methodology and Source Verification

### Research Approach

- **Scope:** File format options for GoSheet: gob, CBOR, MessagePack, JSON, SQLite, ZIP+XML. Criteria: cross-language access, random access, localized changes.
- **Sources:** pkg.go.dev, RFCs (8949, 9052), SQLite docs, fxamacker/cbor, SheetJS, Martin Fowler, migration case studies.
- **Verification:** All claims cited with URLs; multiple sources for critical comparisons.
- **Limitations:** No performance benchmarks run; recommendations based on published benchmarks and documentation.

### Primary Sources

| Source | Use |
|--------|-----|
| [fxamacker/cbor](https://pkg.go.dev/github.com/fxamacker/cbor/v2) | CBOR library, RFC 8949 |
| [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) | CGo-free SQLite |
| [SQLite app file format](https://sqlite.org/draft/appfileformat.html) | SQLite as document format |
| [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html) | CBOR specification |
| [Martin Fowler Repository](https://martinfowler.com/eaaCatalog/repository.html) | Persistence patterns |
| [SWAT migration confidence](https://www.swat.engineering/news/performing-large-scale-software-migrations-with-confidence/) | Migration testing |

---

## Appendix: Broader Format Landscape (Schema-Driven and Analytics)

For **cross-language + complex structured data**, schema-driven binary formats and widely supported text formats offer additional options beyond the formats analyzed in the main body.

### Schema-Driven Binary (Best All-Around)

| Format | Strengths | Best For | Watch-Outs |
|--------|-----------|----------|------------|
| **Protocol Buffers** | Broad language support, compact, fast, good schema evolution | Service-to-service, persisted records, controlled schemas | Not self-describing at rest; need `.proto` schema |
| **Apache Avro** | Schema evolution built-in; schemas can travel with data | Event streams, data pipelines, long-lived stored data | Tooling outside data ecosystem less ergonomic |
| **Apache Thrift** | Mature IDL + serialization; broad support | Mixed environments already using Thrift | Protobuf often preferred for new work |

### Analytics / Columnar Workloads

| Format | Strengths | Best For | Watch-Outs |
|--------|-----------|----------|------------|
| **Apache Parquet** | Excellent compression, query performance for scans | Data lakes, OLAP, Spark/Trino/Arrow | Not ideal for record-at-a-time mutation |
| **Apache Arrow IPC / Feather** | Zero-copy interchange; cross-language in-memory standard | Data science, compute engines, fast tabular interchange | More in-memory/IPC than long-term archival |

### Human-Readable

| Format | Strengths | Best For | Watch-Outs |
|--------|-----------|----------|------------|
| **JSON (+ JSON Schema)** | Universal, easy to inspect and debug | Configs, APIs, smaller payloads | Large size, ambiguous number/date handling |
| **XML** | Mature tooling, XSD schemas | Legacy, document-centric | Verbose; often avoided for new systems |

### Self-Describing at Rest

- **CBOR / MessagePack:** Compact, schema-optional; schema evolution discipline is on you. (Covered in main body.)
- **Ion (Amazon):** Richer typed superset of JSON; good tooling in some ecosystems.

### Quick Recommendation Matrix (General)

- **You control both ends, want speed + stability:** Protobuf
- **Data pipelines / event streaming with schema evolution:** Avro
- **Analytics / data lake files:** Parquet
- **Fast cross-language dataframes / compute engines:** Arrow IPC/Feather
- **Human-inspectable interchange:** JSON (+ JSON Schema)

### Relevance to GoSheet

GoSheet's primary use case is **long-term file storage** for spreadsheet data (cells, merges, formulas), not analytics or event streaming. For that:

- **Protobuf** could be a strong option if cross-language + schema evolution are priorities; requires `.proto` definition and codegen.
- **CBOR/MessagePack** (main body) remain good fits: schema-optional, no codegen, self-describing.
- **Parquet/Arrow** are overkill for spreadsheet editing; consider only if analytics/export becomes a core need.
- **JSON** is viable for export/debugging; too heavy for primary storage of large sheets.

### Format-Independent Design Tips

1. **Define a schema and evolution policy:** Additive changes, deprecations, field numbering/IDs, defaults.
2. **Be explicit about types that don't travel well:** Timestamps/timezones, decimals/money, big integers, bytes vs strings, nullability, unions.

---

## References

- [Go encoding/gob](https://pkg.go.dev/encoding/gob) — Go standard library
- [RFC 8949: CBOR](https://www.rfc-editor.org/rfc/rfc8949.html) — Concise Binary Object Representation
- [MessagePack](https://msgpack.org/) — MessagePack specification and implementations
- [Office Open XML (XLSX) structure](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document) — Microsoft Learn
- [SQLite](https://www.sqlite.org/) — Embedded database
- [Parquet Page Index](https://parquet.apache.org/docs/file-format/pageindex/) — Random access in columnar format (analytics-oriented, less suitable for spreadsheet cell updates)

---

## Technical Research Conclusion

### Summary of Key Findings

Gob is Go-specific and blocks cross-language access. CBOR and MessagePack are standard, compact, and widely supported. SQLite and ZIP+XML enable random access and partial updates. Migration from gob to CBOR is feasible with a persistence abstraction and phased rollout.

### Strategic Impact

- **Cross-language:** Requires format migration; CBOR recommended.
- **Random access:** Requires architectural change; SQLite or ZIP+XML.
- **Short term:** Keep gob; document limitations; plan migration when requirements emerge.

### Next Steps

1. Complete Epic 11 (merging) with current gob format.
2. Introduce persistence interface if not present.
3. When cross-language is required, implement CBOR persistence and migration path.
4. When random access is required, evaluate SQLite vs ZIP+XML.

---

**Technical Research Completion Date:** 2026-02-23  
**Source Verification:** All facts cited with current sources  
**Status:** Complete
