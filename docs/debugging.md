# GoSheet Debugging Guide

## Overview

GoSheet has three log sources, all writing to stderr in a unified format:

```
[ISO-timestamp] [LEVEL ] [SOURCE] message
```

| Source tag | Origin |
|---|---|
| `[go]` | Go HTTP server (`logutil` package) |
| `[Electron]` | Electron main process (`electron/main.js`) |
| `[Renderer]` | Frontend JavaScript (forwarded from renderer via IPC) |

Example output:

```
[2026-03-13T10:00:01Z] [WARN ] [go] failed to write port to fd 3: bad file descriptor (running standalone?)
[2026-03-13T10:00:01Z] [INFO ] [Electron] Starting Go HTTP server...
[2026-03-13T10:00:02Z] [DEBUG] [go] GoSheet server running at http://localhost:52341
[2026-03-13T10:00:03Z] [ERROR] [Renderer] TypeError: Cannot read properties of undefined
```

---

## Log Levels

| Level | When it appears | Go function | Renderer function |
|---|---|---|---|
| `[DEBUG]` | `--verbose` only | `logutil.Debugf` / `logutil.Debugln` | `console.log` |
| `[INFO ]` | `--verbose` only (Electron) | *(use Debugf instead of `log.Printf`)* | `console.log` |
| `[WARN ]` | Always | `logutil.Warnf` | `console.warn` |
| `[ERROR]` | Always | `logutil.Errorf` | `console.error` |

**Rule of thumb:** Without `--verbose`, you should see only `[WARN ]` and `[ERROR]` lines.

---

## Starting the App

### Default (WARN + ERROR only)

```sh
npm start
```

### Verbose (all levels including DEBUG)

```sh
npm start -- --verbose
```

### Log to file

```sh
npm start -- --log-file=/tmp/gosheet-debug.log
```

### Verbose + log to file (recommended for bug investigation)

```sh
npm start -- --verbose --log-file=/tmp/gosheet-debug.log
```

Tail the log in another terminal:

```sh
tail -f /tmp/gosheet-debug.log
```

The `--log-file` flag appends all output to the file in addition to stderr — useful when the terminal scrollback is insufficient.

---

## Renderer Log Forwarding

Renderer (`frontend/*.js`) logs are forwarded to the main process via Electron's `console-message` IPC event and then printed with the `[Renderer]` source tag.

**Forwarding rules (Story 16.8):**

| Renderer call | Forwarded? | Requires `--verbose`? |
|---|---|---|
| `console.error(...)` | Yes | No — always forwarded as `[ERROR]` |
| `console.warn(...)` | Yes | No — always forwarded as `[WARN ]` |
| `console.log(...)` | Yes | Yes — only forwarded when `--verbose` is set |

**Implemented in `electron/main.js`:**

```js
win.webContents.on('console-message', (_event, level, message) => {
  if (level === 3)      console.error(`[Renderer] ${message}`);
  else if (level === 2) console.warn(`[Renderer] ${message}`);
  else if (DEBUG)       console.log(`[Renderer] ${message}`);
});
```

---

## Adding Temporary Diagnostics

### In renderer code (frontend JS)

For **unconditional** output visible without `--verbose`:

```js
console.error('[Debug] myVar =', myVar);
```

For **verbose-only** output:

```js
console.log('[Debug] myVar =', myVar);
```

Remove all temporary diagnostics before committing.

### In Go code

For **unconditional** output:

```go
logutil.Warnf("debug: value = %v", val)  // shows as [WARN ]
```

For **verbose-only** output:

```go
logutil.Debugf("debug: value = %v", val)  // shows as [DEBUG], gated by --verbose
```

Avoid `log.Printf` for new diagnostics — it emits `[INFO ]` unconditionally and bypasses the level gating.

---

## Go Logging Reference

All logging goes through `logutil/logutil.go`. The `logutil.Verbose` flag is set from `--verbose` at startup in `server/main.go`.

| Function | Level tag | Gated |
|---|---|---|
| `logutil.Debugf(fmt, ...)` | `[DEBUG]` | `--verbose` |
| `logutil.Debugln(v...)` | `[DEBUG]` | `--verbose` |
| `logutil.Warnf(fmt, ...)` | `[WARN ]` | unconditional |
| `logutil.Errorf(fmt, ...)` | `[ERROR]` | unconditional |

`log.Printf` still works but routes through `GoWriter` which wraps every line with `[INFO ]` unconditionally. Prefer `logutil.Debugf` for new code.

---

## Common Scenarios

### "I see no output at all"

Normal — after Story 21.3 the app is silent at INFO level without `--verbose`. Add `--verbose` or use `console.error` for a quick check.

### "I need to see what the renderer is doing"

```sh
npm start -- --verbose 2>&1 | grep Renderer
```

### "I want to compare logs before and after a change"

```sh
npm start -- --verbose --log-file=/tmp/before.log
# reproduce the scenario, quit
npm start -- --verbose --log-file=/tmp/after.log
# reproduce, quit
diff /tmp/before.log /tmp/after.log
```

### "The Go server isn't starting"

Without `--verbose`, a missing binary will print `[ERROR]` to the terminal and show an error dialog. Check:

```sh
ls -la bin/gosheet-server
make build  # rebuild if missing
```
