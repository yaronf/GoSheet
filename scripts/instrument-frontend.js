#!/usr/bin/env node
// Instruments frontend/*.js with Istanbul counters, writing to frontend-instrumented/.
// Usage: node scripts/instrument-frontend.js
// Output dir is cleaned and recreated on each run.

'use strict';

const fs = require('fs');
const path = require('path');
const { createInstrumenter } = require('istanbul-lib-instrument');

const SRC_DIR = path.join(__dirname, '..', 'frontend');
const OUT_DIR = path.join(__dirname, '..', 'frontend-instrumented');

// Clean output dir
if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true });
}
fs.mkdirSync(OUT_DIR);

// Copy all files; instrument .js files
const files = fs.readdirSync(SRC_DIR);
const instrumenter = createInstrumenter({
  esModules: true,
  compact: false,
  produceSourceMap: false,
  // Use globalThis so coverage counters are accessible on window in ES module context.
  // Without this, new Function("return this")() returns undefined in strict mode.
  coverageGlobalScope: 'globalThis',
  coverageGlobalScopeFunc: false,
});

let instrumented = 0;
let copied = 0;

for (const file of files) {
  const src = path.join(SRC_DIR, file);
  const dst = path.join(OUT_DIR, file);

  if (!fs.statSync(src).isFile()) continue;

  if (file.endsWith('.js')) {
    const source = fs.readFileSync(src, 'utf8');
    // Use the original path as the filename so nyc can map back to source
    const result = instrumenter.instrumentSync(source, src);
    fs.writeFileSync(dst, result, 'utf8');
    instrumented++;
  } else {
    // Copy non-JS files (CSS, HTML, etc.) unchanged
    fs.copyFileSync(src, dst);
    copied++;
  }
}

console.log(
  `Instrumented ${instrumented} JS files, copied ${copied} other files → ${OUT_DIR}`
);
