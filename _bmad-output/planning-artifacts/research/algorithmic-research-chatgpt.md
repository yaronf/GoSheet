Yes—there’s a decent amount of material, but it’s fragmented. The *full* “how Excel/Sheets do it internally” is mostly proprietary, so the best public coverage comes from (1) official vendor docs that describe observable internals, (2) patents, (3) open-source spreadsheet engines that implement the same core ideas, and (4) collaboration research (OT/CRDT).

## The core algorithms you’ll see again and again

* **Formula dependency tracking:** build a dependency tree/graph from formulas (cell/range references), so changes can trigger only the impacted subgraph (“dirty” marking) rather than full recompute. ([Microsoft Learn][1])
* **Recalculation ordering:** derive a “calculation chain” (often a topological order of a DAG) and handle cycles/errors deterministically. ([Microsoft Learn][1])
* **Incremental recomputation:** mark dependents dirty, then recompute in dependency order; cache results where safe. ([hyperformula.handsontable.com][2])
* **Parallel evaluation:** partition the dependency graph into levels/components to exploit multicore without violating dependencies. ([Google Patents][3])
* **Storage/layout for scale:** sparse representations + compression (often “tile/chunk” layouts; conceptually similar to sparse-matrix + compression work). ([arXiv][4])
* **Real-time collaboration:** OT and/or CRDT-style replicated data structures, usually with a server arbitration layer and client-local optimistic updates. ([svn.apache.org][5])

## Reading list: detailed (and mostly practical) sources

### Excel internals (most “official” you’ll get)

* **Excel Recalculation (Microsoft Learn):** explicitly describes the 3-stage model—dependency tree → calculation chain → recalculation (“dirty cells”, etc.). ([Microsoft Learn][1])
* **Improving calculation performance (Microsoft Learn / VBA docs):** explains “smart recalculation” and dependency tracking behavior from a performance angle. ([Microsoft Learn][6])
* **OpenXML calcChain:** shows how Excel persists the last calculation ordering in files (useful for understanding what’s stored vs recomputed). ([Microsoft Learn][7])
* **Multi-thread spreadsheet processing patent:** details approaches to reordering/partitioning the calc chain for parallel recalc. ([Google Patents][3])

### Open-source spreadsheet engines (best way to learn “internal algorithms”)

* **HyperFormula docs (dependency graph):** very explicit about graph construction and recalculation ordering. ([hyperformula.handsontable.com][2])
* **HyperFormula source (graph / topsort):** reading code here is often more instructive than blog posts. ([GitHub][8])
* **IronCalc (Rust engine + docs):** a modern engine project you can study end-to-end (parser/evaluator/xlsx IO). ([GitHub][9])
* **Luckysheet formula system (docs/wiki-style):** another implementation perspective (web-first spreadsheet). ([DeepWiki][10])

### Collaboration (for “Google Sheets-like” behavior)

* **Apache Wave OT whitepaper** + **Google Wave “Under the Hood” slides:** good, concrete discussions of OT mechanics/costs that carry over to collaborative office apps. ([svn.apache.org][5])
* **CRDT pointers:** a curated CRDT paper list that includes work touching collaborative spreadsheet semantics, plus a practical CRDT framework paper (Collabs). ([Conflict-free Replicated Data Types][11])

### “System design” style writeups (useful, but not authoritative)

* A Google Sheets “system design” walkthrough can help frame the components (storage service, dependency tracking, compute, collaboration), but treat these as informed reconstructions rather than confirmed internals. ([Educative][12])

If you tell me whether you care more about **(a) formula engine internals**, **(b) distributed storage/perf**, or **(c) real-time collaboration**, I can narrow this into a short “best 5 deep dives” list for that slice.

[1]: https://learn.microsoft.com/en-us/office/client-developer/excel/excel-recalculation?utm_source=chatgpt.com "Excel Recalculation | Microsoft Learn"
[2]: https://hyperformula.handsontable.com/guide/dependency-graph.html?utm_source=chatgpt.com "Dependency graph | HyperFormula (v3.2.0) - Handsontable"
[3]: https://patents.google.com/patent/US8032821B2/en?utm_source=chatgpt.com "US8032821B2 - Multi-thread spreadsheet processing with dependency ..."
[4]: https://arxiv.org/abs/2309.04355?utm_source=chatgpt.com "Value-Compressed Sparse Column (VCSC): Sparse Matrix Storage for Redundant Data"
[5]: https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html?utm_source=chatgpt.com "Google Wave Operational Transformation - The Apache Software Foundation"
[6]: https://learn.microsoft.com/en-us/office/vba/excel/concepts/excel-performance/excel-improving-calculation-performance?utm_source=chatgpt.com "Excel performance - Improving calculation performance"
[7]: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-the-calculation-chain?utm_source=chatgpt.com "Working with the calculation chain | Microsoft Learn"
[8]: https://github.com/handsontable/hyperformula/blob/master/src/DependencyGraph/Graph.ts?utm_source=chatgpt.com "hyperformula/src/DependencyGraph/Graph.ts at master - GitHub"
[9]: https://github.com/ironcalc/IronCalc?utm_source=chatgpt.com "ironcalc/IronCalc: Main engine of the IronCalc ecosystem - GitHub"
[10]: https://deepwiki.com/dream-num/Luckysheet/5.2-formula-system?utm_source=chatgpt.com "Formula System | dream-num/Luckysheet | DeepWiki"
[11]: https://crdt.tech/papers.html?utm_source=chatgpt.com "CRDT Papers - Conflict-free Replicated Data Types"
[12]: https://www.educative.io/blog/google-sheets-system-design?utm_source=chatgpt.com "Google Sheets System Design - Educative"

