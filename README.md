# MCP Behavioural Diff

Differential **runtime** analysis for Model Context Protocol (MCP) servers.

Given two versions of an MCP server, it executes both under **identical tool-call scenarios**,
captures their outbound HTTP / filesystem / process activity and tool results, learns which
fields are nondeterministic from repeated runs, and reports **behavioural changes** with each
outbound value traced to its **observed source** (a tool argument or an environment variable).

**Scope of claims (read this first).** Three separate things, kept separate:
1. **Behavioural-change detection** — did on-the-wire / result behaviour change between versions? *(this tool does this)*
2. **Suspicious-change identification** — does a change have a risk-relevant shape (new destination, unexplained value, a secret appearing in a field)? *(partially)*
3. **Maliciousness classification** — is it actually an attack? ***(this tool does NOT do this.)*** A flagged change can be a legitimate release change; a human adjudicates.

It is **not** a malware detector and makes no such claim.

## Why runtime diff (vs source/AI code review)
Postmark `@activecampaign/postmark-mcp` 1.0.0 → 2.1.1 is a near-total rewrite
(**1,539 lines of source diff**, 4 → 24 tools, Postmark SDK → `fetch`). Its `sendEmail`
outbound request is behaviourally **identical** — 0 field changes. Source review drowns in
1,539 lines; behavioural diff surfaces only what actually changed on the wire.

## Install & run (isolated environment only — see docs/SAFETY.md)
```bash
RUNS=10 ./run.sh          # installs SDK + pinned servers, runs probe + evaluations
```
Single comparison:
```bash
npm install && node engine/mock.cjs > engine/.mockport &   # start mock
RUNS=10 node engine/cli.mjs <serverA/index.js> <serverB/index.js> scenarios/postmark.json
```

## What a report contains
- `primary_alerts` — stable-in-both-versions fields whose value changed (the signal).
- `evidence_intermittent` — fields that varied in *some* runs (2..<80%); **retained for review, never dropped** (an attacker may exfiltrate intermittently).
- `suppressed_noise` — high-confidence nondeterministic fields (≥80% of runs differ: nonces, per-call timestamps).
- `observed_source` on each value: `tool_argument` | `environment_variable` | `unexplained` | `null`.

`observed_source` is an **observed in→out relationship** via unique canary markers, **not** full
taint lineage. It cannot prove data flow through arbitrary transforms, subprocesses or native code.

## Verified results (in `reports/`, reproducible via `run.sh`)
- **Benign** postmark v1→v2, N=10: **1 primary alert** — a real `getDeliveryStats` output-format change (correctly detected behavioural change, not a false positive).
- **Synthetic edits** (my own one-line edits to a benign package, `.example` hosts — **not malware**): new destination, secret-into-existing-field, secret-in-new-header, new webhook, conditional leak, subprocess request, result injection. See `atk/` method and `reports/example-synthetic-*`.
  - secret-into-existing-field: 1 primary alert, `observed_source=environment_variable` (the subtle case).
  - new destination: detected (exfil host + token in query).
  - subprocess request: **partial** — command captured, child's body not (see docs/INSTRUMENTATION.md).
  - conditional leak: detected **only when the triggering input is in the scenario** (dynamic-analysis coverage limit).
- **Filesystem** server, N=10: `get_file_info` timestamp varied 4/10 → classified **intermittent**, retained as evidence, kept out of primary alerts.

## Network-active coverage (3 independent implementations)
Postmark (SDK `https.request` **and** `fetch`), Brave Search (`fetch` GET), `@tokenizin/mcp-npx-fetch` (`fetch` GET). See `servers.manifest.json` for pinned versions + sha512.

## Layout
```
engine/   shim.cjs (capture+redirect)  runner.mjs (MCP driver)  mock.cjs  diff.mjs  cli.mjs  probe.mjs  canaries.json
scenarios/  tool-call scenarios (canary-tagged)
docs/     INSTRUMENTATION.md  SAFETY.md
servers.manifest.json   run.sh   reports/
```

## Status / limitations
Node.js + stdio servers only. Positional request alignment (a new request shifts indices).
`strace`/eBPF syscall backstop **not yet implemented** (planned). N=10 volatility learning is a
small sample. See docs for the full list.
