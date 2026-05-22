# Theme Token Ownership

`packages/theme` is the only canonical owner of all CSS custom properties matching `--gs-*`.

## Canonical ownership rule

- Canonical token definitions must live in `packages/theme` token sources.
- No other package or migrated stylesheet should keep source-of-truth declarations for `--gs-*` variables.

## Migration handling rules

When migrating incoming CSS:

1. Detect all `--gs-*` declarations in the incoming file.
2. For each detected token:
   - If the token already exists canonically in `packages/theme`:
     - Remove the legacy declaration from the migrated file.
     - Update references only if the incoming declaration value differs from canonical value.
   - If the token is new:
     - Append it to the canonical token file in `packages/theme`.
     - Remove the duplicate definition from the migrated file.
3. Record every collision in the migration report under **“CSS token collisions”** with:
   - file path
   - token name

## Search strings for implementers

Use these searches when auditing or migrating CSS:

- `--gs-`
- `var(--gs-`
