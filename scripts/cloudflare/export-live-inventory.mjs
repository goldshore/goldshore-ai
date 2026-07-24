#!/usr/bin/env node

/**
 * Read-only Cloudflare inventory export for Gold Shore Labs.
 *
 * Required environment variables:
 *   CF_API_TOKEN   Token with read-only Access, Workers, Pages, DNS, D1, R2 and KV permissions.
 *   CF_ACCOUNT_ID  Cloudflare account ID.
 *
 * Optional:
 *   CF_ZONE_IDS    Comma-separated zone IDs (goldshore.org,goldshore.ai).
 *   OUTPUT_DIR     Defaults to reports/cloudflare/live.
 *
 * This script never prints or writes the API token and performs GET requests only.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const token = process.env.CF_API_TOKEN;
const accountId = process.env.CF_ACCOUNT_ID;
const zoneIds = (process.env.CF_ZONE_IDS || '').split(',').map((v) => v.trim()).filter(Boolean);
const outputDir = resolve(process.env.OUTPUT_DIR || 'reports/cloudflare/live');

if (!token || !accountId) {
  console.error('Missing CF_API_TOKEN or CF_ACCOUNT_ID. No requests were made.');
  process.exit(1);
}

const apiBase = 'https://api.cloudflare.com/client/v4';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function get(path) {
  const response = await fetch(`${apiBase}${path}`, { method: 'GET', headers });
  const payload = await response.json().catch(() => ({ success: false, errors: [{ message: 'Invalid JSON response' }] }));
  if (!response.ok || payload.success === false) {
    const message = payload?.errors?.map((e) => e.message).join('; ') || `${response.status} ${response.statusText}`;
    throw new Error(`GET ${path}: ${message}`);
  }
  return payload.result ?? payload;
}

const endpoints = {
  access_apps: `/accounts/${accountId}/access/apps?per_page=100`,
  access_idps: `/accounts/${accountId}/access/identity_providers`,
  access_service_tokens: `/accounts/${accountId}/access/service_tokens?per_page=100`,
  pages_projects: `/accounts/${accountId}/pages/projects`,
  workers_services: `/accounts/${accountId}/workers/services`,
  queues: `/accounts/${accountId}/queues`,
  d1_databases: `/accounts/${accountId}/d1/database`,
  kv_namespaces: `/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
  r2_buckets: `/accounts/${accountId}/r2/buckets`
};

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/secret|token|password|key_value/i.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redact(item);
    }
  }
  return output;
}

await mkdir(outputDir, { recursive: true });
const manifest = {
  generated_at: new Date().toISOString(),
  account_id_suffix: accountId.slice(-6),
  mode: 'read-only',
  resources: {},
  zones: {}
};

for (const [name, path] of Object.entries(endpoints)) {
  try {
    manifest.resources[name] = redact(await get(path));
    console.log(`exported ${name}`);
  } catch (error) {
    manifest.resources[name] = { error: String(error.message || error) };
    console.warn(`unable to export ${name}: ${error.message || error}`);
  }
}

for (const zoneId of zoneIds) {
  try {
    const zone = await get(`/zones/${zoneId}`);
    const dns = await get(`/zones/${zoneId}/dns_records?per_page=500`);
    manifest.zones[zone.name || zoneId.slice(-6)] = {
      id_suffix: zoneId.slice(-6),
      status: zone.status,
      name: zone.name,
      dns: redact(dns)
    };
    console.log(`exported DNS for ${zone.name || zoneId.slice(-6)}`);
  } catch (error) {
    manifest.zones[`zone-${zoneId.slice(-6)}`] = { error: String(error.message || error) };
  }
}

const outputPath = resolve(outputDir, 'inventory.json');
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
