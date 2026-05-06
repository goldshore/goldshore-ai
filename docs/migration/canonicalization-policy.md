# Canonicalization Migration Policy

This policy defines the deterministic, file-type-based canonicalization behavior for migration and integration work.

## Global decision table

| File type / pattern | Strategy | Deterministic rule |
| --- | --- | --- |
| `*.md` | structured merge strategy | Merge frontmatter keys by precedence (`target` keeps existing keys unless explicitly replaced; `source` adds missing keys). For body content, keep target body when both sides edited the same section and emit a conflict note for manual follow-up. |
| `*.html` | skip-if-target-exists | Keep target file if it already exists; only copy from source when target is missing. |
| `*.astro` | manual-review-required | Never auto-merge component/page templates. Stage both variants and require implementer review to resolve framework/runtime differences. |
| `*.toml` | structured merge strategy | Perform key-level merge unless an explicit file override rule exists (see `wrangler.toml` below). |
| `*.lock` and lockfiles | skip-if-target-exists | Do not line-merge lockfiles. Preserve canonical lockfile rule below. |
| `*.svg` | copy-if-missing | Copy source SVG only when target file does not exist. Existing target SVGs are retained. |
| Generated files (`dist/**`, `build/**`, `.astro/**`, coverage outputs, bundled assets) | manual-review-required | Do not canonicalize generated outputs by default. Regenerate from source after merge; commit only if repository policy requires checked-in artifacts. |

## Explicit file rules

### `wrangler.toml` (field-level merge behavior)

Use structured merge with field-level precedence:

1. Preserve target values for deployment identity and environment-bound fields (`name`, `account_id`, `main`, `compatibility_date`, `workers_dev`, and route bindings).
2. Merge additive arrays/maps from source when missing in target (`kv_namespaces`, `r2_buckets`, `d1_databases`, `services`, `vars`).
3. If the same field is modified on both sides with different values, keep target value and log conflict context in the PR under **Conflict resolutions** for manual review.

### `pnpm-lock.yaml` (canonical source of truth)

- `pnpm-lock.yaml` is the canonical lockfile source of truth.
- No lockfile merge is allowed.
- Always regenerate with workspace install after dependency-affecting merges and commit the regenerated file.

### Markdown docs (`*.md`)

Structured merge procedure:

1. Parse and merge frontmatter keys first.
   - Scalar key conflict: keep target value, record conflict note.
   - List/map conflict: union by key/item when safe; otherwise keep target and record note.
2. Merge body content by section heading.
   - Non-overlapping section edits: include both.
   - Overlapping/conflicting edits: keep target section and append a `TODO(migration): manual reconcile source section` marker.
3. If frontmatter or body parse fails, fall back to `manual-review-required`.

## Operational requirements

- Implementers must follow this policy for every migration PR.
- Any exception must be documented in the PR **Conflict resolutions** section with rationale.
- PR templates and migration automation should link to this file to keep one deterministic path.
