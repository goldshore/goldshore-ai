-- Migration: 0001b_integrations_registry
-- 0002_integration_secrets.sql ALTER TABLEs an "integrations" table that no
-- D1 migration ever creates. The only "integrations" table anywhere in the
-- repo is supabase/migrations/0006_api_clients_integrations.sql - a
-- Postgres/Supabase table (row-level security, uuid defaults, Postgres
-- syntax), from a parallel design that was never ported to D1. lib/secrets.ts
-- revokeSecret() already depends on this table at runtime (UPDATE
-- integrations SET secrets_status=..., last_secret_sync=... WHERE id=?),
-- so revoke has been broken since day one, independent of anything else
-- found this session.
--
-- Minimal registry only - secrets_status and last_secret_sync are left for
-- 0002_integration_secrets.sql's own ALTER TABLE statements to add, so this
-- and that migration can both run without a duplicate-column conflict.
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
