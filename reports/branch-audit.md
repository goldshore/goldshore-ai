# Branch Audit Report (Static Inventory Refresh)

- Generated at (UTC): 2026-03-04T00:21:28Z
- Report generated at commit SHA: `6212179cb3c59d4670926e5bacfb5b896e0e180c`

## Scope rerun

Static inventory was re-run for:

- `apps/gs-agent/` → `reports/migration/inventory.gs-agent.tsv`
- `apps/gs-gateway/` → `reports/migration/inventory.gs-gateway.tsv`
- `unmerged.txt` (line-level review + file existence validation)

## Updated conclusion (replacing prior "agent missing/unmerged" claim)

The current repository state does **not** support an "agent missing" conclusion:

- `apps/gs-agent/` is present and inventories **6 files** with current timestamps.
- `unmerged.txt` contains **0** `apps/gs-agent/*` entries.
- `unmerged.txt` contains **5** `apps/gs-gateway/*` entries, and those paths currently exist.

Interpretation: the active drift signal in `unmerged.txt` is gateway-focused, not evidence of a missing `gs-agent` tree.

## Evidence table

| Drift claim | Evidence source | Concrete path | Timestamp (UTC) | Finding |
| --- | --- | --- | --- | --- |
| "gs-agent is missing" | `reports/migration/inventory.gs-agent.tsv` | `apps/gs-agent/src/index.ts` | `2026-03-04T00:12:37.356Z` | File is present in rerun inventory. |
| "gs-agent is unmerged" | `unmerged.txt` + static parse | `unmerged.txt` (`apps/gs-agent/*` lines) | `2026-03-04T00:12:37.500237Z` (`unmerged.txt` mtime) | `0` matching lines; no `gs-agent` paths listed as unmerged. |
| "gs-gateway drift exists" | `unmerged.txt` + filesystem stat | `apps/gs-gateway/src/middleware/integration.ts` | `2026-03-04T00:12:37.360237Z` | Path appears in `unmerged.txt` and exists in working tree. |
| "unmerged set includes gateway docs/code" | `unmerged.txt` + filesystem stat | `apps/gs-gateway/README.md` | `2026-03-04T00:12:37.360237Z` | Path appears in `unmerged.txt` and exists in working tree. |
| "gateway inventory is current" | `reports/migration/inventory.gs-gateway.tsv` | `apps/gs-gateway/src/index.ts` | `2026-03-04T00:12:37.360Z` | File is present in rerun inventory (14 files total). |
