# Safety / isolation (prerequisite, not optional)

This tool EXECUTES third-party server code. Run it only in a disposable, isolated environment.

Required before running any untrusted package:
- Disposable Linux VM/container; nothing on the host you care about.
- **No host secrets** in the environment. Only the synthetic CANARY_* values in `engine/canaries.json`.
- **No unrestricted network.** Outbound HTTP is redirected to the local mock (`engine/mock.cjs`).
  Run with egress blocked at the network layer as defense in depth; the in-process redirect is
  not a security boundary by itself.
- No sensitive host-directory mounts. The filesystem server is confined to a scratch sandbox dir.
- `npm install --ignore-scripts` for every package (install hooks never run). This is a
  precaution, not a sandbox — it does not contain runtime behaviour.

What this tool does and does not claim:
- **Does:** behavioural-change detection and evidence generation between two versions.
- **Partly:** suspicious-change identification (new destination, unexplained value, secret in field).
- **Does NOT:** classify maliciousness. A flagged change may be a legitimate release change.
