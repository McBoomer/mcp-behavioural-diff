# Instrumentation coverage

The capture shim (`engine/shim.cjs`) is a Node.js preload (`--require`). It observes the
server process **in-process** and redirects outbound HTTP to a local mock. Every claim below
is exercised by the probe suite (`npm run probe`), not just asserted.

| Path | Captured | Fidelity | Notes |
|------|----------|----------|-------|
| `http.request` / `https.request` | yes | method, destination, headers, **body** | Postmark SDK v1 (https) verified |
| global `fetch` (undici) | yes | method, destination, headers, **body** | Postmark v2, Brave, npx-fetch verified |
| `net.connect` (raw socket / undici internals) | partial | **destination only** | tagged `destination_only_partial`; no body |
| `child_process.*` | partial | **command name only** | tagged `command_only_partial`; child's own network/body NOT seen in-process |
| `fs` writes (`writeFile*`, `appendFile*`) | yes | path | |
| `dns.lookup` | yes | host | |
| tool results (MCP responses) | yes | text (truncated 500 chars) | enables result-tampering detection |

## Not implemented (proposed for later weeks)
- **`strace -f` syscall backstop** — would recover child-process and raw-socket *destinations*
  (never bodies). Not integrated yet. A manual `strace` probe was run once during feasibility
  and is NOT part of this harness.
- **eBPF** — not implemented. Only considered after the syscall backstop works.

## Header normalization
Header names are compared case-insensitively (`diff.mjs`), because different HTTP clients
emit different casing (v1 SDK: `x-postmark-server-token`; v2 fetch: `X-Postmark-Server-Token`).
Without this, a client swap produces spurious alerts.

## Known alignment limitation
Outbound requests are keyed positionally (`net#0`, `net#1`, ...). Inserting or removing a
request shifts indices and cascades field diffs (see synthetic a1: one new request → many
positional diffs). Request alignment by (method, host, path) is a Week-1 refinement.
