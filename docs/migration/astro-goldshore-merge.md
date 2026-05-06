# Astro → Goldshore-AI Hardened Migration Engine

This migration system performs:

• Hash-based deterministic merges
• Structured JSON deep merge
• GitHub workflow deduplication
• Asset fingerprinting + canonicalization
• Conflict emission
• PR description auto-generation

End goal:
astro-goldshore → legacy archive
goldshore-ai → single source of truth

---

## Usage

### PLAN MODE
python3 scripts/merge/merge_engine.py \
  --target . \
  --legacy ../astro-goldshore \
  --archive legacy/astro-goldshore \
  --mode plan

### APPLY MODE
python3 scripts/merge/merge_engine.py \
  --target . \
  --legacy ../astro-goldshore \
  --archive legacy/astro-goldshore \
  --mode apply

Outputs:
reports/merge/

---

## Precedence Rules

When multiple migration rules could apply to the same file or path, implementation must resolve them in the following order:

1. **Safety (no destructive deletion)**
2. **Canonical destination structure**
3. **Normalization edits (workflows/infra)**
4. **Non-overwrite fallback**

This order is mandatory. Lower-priority rules must not violate higher-priority guarantees.

### Normalization edits to existing files

If normalization requires editing files that already exist in the destination repository, the implementation must:

* **Patch minimally** — change only the smallest required keys/paths/values.
* **Preserve existing semantics** — keep the destination's current behavior unless a normalization rule explicitly requires a behavior-preserving transformation.
* **Log every edit** in `docs/migration/migration-report.md` under the section heading **"normalized existing files"**.

### Normalization examples

* **`.github/workflows/*.yml` key-level merge**
  * Merge specific keys (for example `on`, `permissions`, `jobs.<name>.steps`) instead of replacing whole workflow files.
  * Keep repository-specific jobs/conditions already present in destination workflows.

* **`infra/Cloudflare/**` path normalization**
  * Normalize imported legacy Cloudflare files into the canonical `infra/Cloudflare/**` layout.
  * Update only path references required by the move (e.g., include/import/module paths) without broad refactors.

* **`pnpm-workspace.yaml` exclusion update for `legacy/**`**
  * Add or merge an exclusion entry for `legacy/**` into existing workspace package globs.
  * Do not remove existing include/exclude rules unless required to avoid conflicting duplicates.
