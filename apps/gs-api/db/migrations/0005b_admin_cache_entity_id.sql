-- Migration: 0005b_admin_cache_entity_id
-- 0005_admin_cache.sql indexes admin_cache.entity_id, but a legacy migration
-- (apps/gs-api/src/db/migrations/005-admin-cache-secrets.sql) already created
-- admin_cache in production without that column. CREATE TABLE IF NOT EXISTS
-- in 0005_admin_cache.sql silently no-ops against the existing table, so the
-- index creation then fails with "no such column: entity_id".
--
-- One-time patch: add the missing column so 0005_admin_cache.sql can proceed.
ALTER TABLE admin_cache ADD COLUMN entity_id TEXT;
