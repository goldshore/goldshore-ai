#!/usr/bin/env node
/**
 * One-shot script: configure preview.goldshore.ai DNS + Cloudflare Pages custom domain.
 */

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
let ZONE = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID;

if (!TOKEN || !ACCOUNT) {
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
  return parts.length > 0 ? parts.join(", ") : "Error details redacted";
}

async function cf(path, init = {}) {
  // Extremely paranoid redaction for logging
  let logPath = path.split('?')[0];
  if (ACCOUNT) logPath = logPath.replace(ACCOUNT, '[REDACTED_ID]');
  if (ZONE) logPath = logPath.replace(ZONE, '[REDACTED_ID]');

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const json = await res.json();
  if (!json.success) {
    const safeErrors = (json.errors || []).map(e => ({
      code: typeof e.code === 'number' ? e.code : 0,
      message: typeof e.message === 'string' && e.message.length < 128 ? e.message : 'Message redacted'
    }));
    throw new Error(`CF request failed (${logPath})`);
  }
  return json.result;
}

async function resolveZoneId(domain) {
  const path = `/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(ACCOUNT)}`;
  const zones = await cf(path);
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error("Zone not found");
  }
  return zones[0].id;
}

async function main() {
  if (!ZONE) {
    ZONE = await resolveZoneId("goldshore.ai");
  }

  // 1. DNS Record
  try {
    const existing = await cf(`/zones/${ZONE}/dns_records?name=preview.goldshore.ai&type=CNAME`);
    if (existing.length === 0) {
      await cf(`/zones/${ZONE}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "CNAME",
          name: "preview",
          content: "preview-web.pages.dev",
          proxied: true,
          ttl: 1,
        }),
      });
    }
  } catch (e) {
    // Silently continue or log safe message
  }

  // 2. Pages Domain
  try {
    await cf(`/accounts/${ACCOUNT}/pages/projects/preview-web/domains`, {
      method: "POST",
      body: JSON.stringify({ name: "preview.goldshore.ai" }),
    });
  } catch (err) {
    // Ignore already exists
  }
}

main().catch(() => {
  process.exit(1);
});
