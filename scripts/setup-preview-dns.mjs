#!/usr/bin/env node
/**
 * Configure GoldShore preview and product-alias DNS for Worker routes.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 * Optional env vars:
 *   PREVIEW_WEB_WORKER (default: gs-web-preview)
 *   PROD_WEB_WORKER (default: gs-web-prod)
 *   PREVIEW_API_WORKER (default: gs-api-preview)
 */

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const PREVIEW_WEB_WORKER = process.env.PREVIEW_WEB_WORKER || "gs-web-preview";
const PROD_WEB_WORKER = process.env.PROD_WEB_WORKER || "gs-web-prod";
const PREVIEW_API_WORKER = process.env.PREVIEW_API_WORKER || "gs-api-preview";
const DRY_RUN = process.env.DRY_RUN === "true";

if (!TOKEN || !ACCOUNT) {
  console.error("Missing required env vars: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
  process.exit(1);
}

function sanitizeErrorForLog(err) {
  if (!err || typeof err !== "object") return "Unknown error";

  const parts = [];
  const safeString = (value) => {
    if (typeof value !== "string") return null;
    if (value.length === 0 || value.length > 64) return null;
    if (!/^[A-Za-z0-9_.-]+$/.test(value)) return null;
    return value;
  };

  if (typeof err.status === "number" && Number.isFinite(err.status)) {
    parts.push(`status=${err.status}`);
  }

  const code = safeString(err.code);
  if (code) parts.push(`code=${code}`);

  const name = safeString(err.name);
  if (name) parts.push(`name=${name}`);

  return parts.length > 0 ? parts.join(", ") : "Unspecified error (details redacted)";
}

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const bodyText = await res.text();
  let json = null;

  try {
    json = JSON.parse(bodyText);
  } catch {
    // Handled below.
  }

  if (!res.ok || !json?.success) {
    const error = new Error("Cloudflare API request failed");
    error.status = res.status;
    throw error;
  }

  return json.result;
}

const zoneIds = new Map();

async function zoneIdFor(zoneName) {
  if (zoneIds.has(zoneName)) return zoneIds.get(zoneName);

  const zones = await cf(
    `/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(ACCOUNT)}`,
  );
  if (!Array.isArray(zones) || zones.length !== 1) {
    throw new Error(`Expected exactly one zone for ${zoneName}`);
  }

  zoneIds.set(zoneName, zones[0].id);
  return zones[0].id;
}

function fqdn(zoneName, name) {
  if (name === "@" || name === zoneName) return zoneName;
  if (name.endsWith(`.${zoneName}`)) return name;
  return `${name}.${zoneName}`;
}

async function upsertDnsRecord({ zone, type, name, content, proxied = true }) {
  const zoneId = await zoneIdFor(zone);
  const recordName = fqdn(zone, name);
  const existing = await cf(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(recordName)}&type=${encodeURIComponent(type)}`,
  );
  const body = {
    type,
    name: recordName,
    content,
    proxied,
    ttl: 1,
  };

  if (existing.length > 0) {
    if (DRY_RUN) {
      console.log(`[dry-run] update DNS ${recordName} ${type} -> ${content}`);
      return;
    }

    await cf(`/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    console.log(`updated DNS ${recordName} ${type} -> ${content}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] create DNS ${recordName} ${type} -> ${content}`);
    return;
  }

  await cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`created DNS ${recordName} ${type} -> ${content}`);
}

async function upsertWorkerRoute({ zone, pattern, script }) {
  const zoneId = await zoneIdFor(zone);
  const routes = await cf(`/zones/${zoneId}/workers/routes`);
  const existing = routes.find((route) => route.pattern === pattern);
  const body = { pattern, script };

  if (existing) {
    if (DRY_RUN) {
      console.log(`[dry-run] update route ${zone} ${pattern} -> ${script}`);
      return;
    }

    await cf(`/zones/${zoneId}/workers/routes/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    console.log(`updated route ${zone} ${pattern} -> ${script}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] create route ${zone} ${pattern} -> ${script}`);
    return;
  }

  await cf(`/zones/${zoneId}/workers/routes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`created route ${zone} ${pattern} -> ${script}`);
}

async function deleteWorkerRoute({ zone, pattern }) {
  const zoneId = await zoneIdFor(zone);
  const routes = await cf(`/zones/${zoneId}/workers/routes`);
  const existing = routes.find((route) => route.pattern === pattern);

  if (!existing) {
    console.log(`route absent ${zone} ${pattern}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] delete malformed route ${zone} ${pattern}`);
    return;
  }

  await cf(`/zones/${zoneId}/workers/routes/${existing.id}`, {
    method: "DELETE",
  });
  console.log(`deleted malformed route ${zone} ${pattern}`);
}

async function main() {
  if (DRY_RUN) {
    console.log("Running in dry-run mode; no Cloudflare resources will be changed.");
  }

  await upsertDnsRecord({
    zone: "goldshore.ai",
    type: "CNAME",
    name: "www",
    content: "gs-www-redirect-prod.goldshore.workers.dev",
  });
  await upsertDnsRecord({
    zone: "goldshore.ai",
    type: "CNAME",
    name: "preview",
    content: `${PREVIEW_WEB_WORKER}.goldshore.workers.dev`,
  });
  await upsertDnsRecord({
    zone: "goldshore.ai",
    type: "CNAME",
    name: "api-preview",
    content: `${PREVIEW_API_WORKER}.goldshore.workers.dev`,
  });
  await upsertDnsRecord({
    zone: "goldshore.ai",
    type: "CNAME",
    name: "risk",
    content: `${PROD_WEB_WORKER}.goldshore.workers.dev`,
  });
  await upsertDnsRecord({
    zone: "goldshore.org",
    type: "CNAME",
    name: "risk",
    content: `${PROD_WEB_WORKER}.goldshore.workers.dev`,
  });

  await upsertWorkerRoute({
    zone: "goldshore.ai",
    pattern: "preview.goldshore.ai/*",
    script: PREVIEW_WEB_WORKER,
  });
  await upsertWorkerRoute({
    zone: "goldshore.ai",
    pattern: "api-preview.goldshore.ai/*",
    script: PREVIEW_API_WORKER,
  });
  await upsertWorkerRoute({
    zone: "goldshore.ai",
    pattern: "risk.goldshore.ai/*",
    script: PROD_WEB_WORKER,
  });
  await upsertWorkerRoute({
    zone: "goldshore.org",
    pattern: "risk.goldshore.org/*",
    script: PROD_WEB_WORKER,
  });

  await deleteWorkerRoute({
    zone: "goldshore.org",
    pattern: "dashboard.goldshore.ai/*",
  });
  await deleteWorkerRoute({
    zone: "goldshore.org",
    pattern: "signals.goldshore.ai/*",
  });
  await deleteWorkerRoute({
    zone: "goldshore.org",
    pattern: "www.goldshore.ai/*",
  });
}

main().catch((err) => {
  console.error(`Error: setup-preview-dns failed (${sanitizeErrorForLog(err)}).`);
  process.exit(1);
});
