# D1 migration template

Copy this file to `NNNN_short_description.md` and place executable forward SQL in the matching `NNNN_short_description.sql`. Never edit an applied migration. Complete every field before review.

## Scope and compatibility

- **Binding/database:** `<BINDING>` / `<production-name>` and `<preview-name>`
- **Owner:** `gs-api`
- **Minimum application version:** `<sha/version>`
- **Compatibility notes:** Describe old/new readers and writers, additive expand/contract phases, locking/index cost, and the release after which old columns may be removed. Migrations must be forward-compatible with the currently deployed Worker.

## Preflight and backup

1. Record migration ledger, row counts, foreign-key check, and D1 bookmark/time-travel timestamp.
2. Export an encrypted logical backup for destructive or backfill migrations and test import into a disposable database.
3. Apply and verify preview first. Stop if preview contains a production resource ID.

## Forward migration

```sql
-- Idempotency is preferred. Never use DROP in the expand phase.
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS example_new_table (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_example_created_at ON example_new_table(created_at);
COMMIT;
```

## Data backfill

Document batching key, batch size, restart/checkpoint behavior, expected rows, runtime, and dual-write window. Example:

```sql
INSERT OR IGNORE INTO example_new_table (id, created_at)
SELECT id, COALESCE(created_at, datetime('now')) FROM example_source
WHERE id > :last_id ORDER BY id LIMIT 1000;
```

## Verification query

State expected output and attach preview results.

```sql
SELECT
  (SELECT COUNT(*) FROM example_source) AS source_count,
  (SELECT COUNT(*) FROM example_new_table) AS target_count,
  (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_errors;
```

## Rollback / restore

D1 migrations are roll-forward by default. Before traffic: revert the Worker and apply a compensating migration. After writes begin: stop writers, capture a final export/bookmark, restore the pre-migration Time Travel point into a **new** database, verify counts/integrity, update only the affected environment binding, deploy, and retain the failed database read-only for 30 days. Never point preview at production as a rollback. Record owner, approvals, timestamps, data-loss window, and verification evidence.
