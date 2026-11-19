#!/usr/bin/env bash
# Reproducible Week-1 evaluation. Run ONLY in a disposable, network-restricted environment (see docs/SAFETY.md).
set -euo pipefail
cd "$(dirname "$0")"
RUNS="${RUNS:-10}"
SB="$(pwd)/.sandbox"; mkdir -p "$SB"; export SBOX="$SB"
echo "[1/4] installing SDK + pinned servers (--ignore-scripts)…"
npm install --no-audit --no-fund >/dev/null
mkdir -p servers
inst(){ d="servers/$3"; mkdir -p "$d"; (cd "$d" && npm init -y >/dev/null 2>&1 && npm install --ignore-scripts --no-audit --no-fund "$1@$2" >/dev/null 2>&1); }
inst @activecampaign/postmark-mcp 1.0.0 pm-a;  inst @activecampaign/postmark-mcp 2.1.1 pm-b
inst @modelcontextprotocol/server-filesystem 2026.7.4 fs-a; inst @modelcontextprotocol/server-filesystem 2026.8.31 fs-b
inst @modelcontextprotocol/server-brave-search 0.6.2 brave;  inst @tokenizin/mcp-npx-fetch 1.0.0 fetchsrv
echo "[2/4] starting local mock API…"
node engine/mock.cjs > engine/.mockport 2>/dev/null & echo $! > engine/.mockpid; sleep 1
echo "[3/4] probe suite (instrumentation coverage)…"; node engine/probe.mjs
echo "[4/4] differential evaluations (N=$RUNS)…"
E(){ find "servers/$1" -path "*$2*/dist/index.js" -o -path "*$2*/index.js" 2>/dev/null | head -1; }
PMA="servers/pm-a/node_modules/@activecampaign/postmark-mcp/index.js"; PMB="servers/pm-b/node_modules/@activecampaign/postmark-mcp/index.js"
echo "== postmark v1->v2 (benign, network POST JSON) =="; RUNS=$RUNS node engine/cli.mjs "$PMA" "$PMB" scenarios/postmark.json >/dev/null 2>&1 || true
RUNS=$RUNS node engine/cli.mjs "$PMA" "$PMB" scenarios/postmark.json 2>&1 >reports/postmark.json | tail -n +2 || true
echo "== filesystem (fs events + volatility) =="; RUNS=$RUNS node engine/cli.mjs "$(E fs-a server-filesystem)" "$(E fs-b server-filesystem)" scenarios/fs.json "$SB" 2>&1 >reports/fs.json | tail -n +2 || true
kill "$(cat engine/.mockpid)" 2>/dev/null || true
echo "Done. JSON reports in reports/."
