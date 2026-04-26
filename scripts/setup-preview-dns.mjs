#!/usr/bin/env node
/**
 * One-shot script: configure preview.goldshore.ai DNS + Cloudflare Pages custom domain.
 *
 * Accepts either naming convention for env vars:
 *   CLOUDFLARE_API_TOKEN  or  CF_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID or  CF_ACCOUNT_ID
 *   CLOUDFLARE_ZONE_ID    or  CF_ZONE_ID  (optional — auto-resolved from domain if omitted)
 */

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
let ZONE = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID;

if (!TOKEN || !ACCOUNT) {
  console.error("Missing required env vars: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

async function cf(path, init = {}) {
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
    throw new Error(`CF ${path} failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

async function resolveZoneId(domain) {
  console.log(`Resolving zone ID for ${domain}...`);
  const zones = await cf(`/zones?name=${domain}`);
  if (!zones.length) throw new Error(`No Cloudflare zone found for ${domain}`);
  console.log(`  ✓ Zone ID: ${zones[0].id}`);
  return zones[0].id;
}

async function main() {
  if (!ZONE) {
    ZONE = await resolveZoneId("goldshore.ai");
  }

  // ── 1. Add CNAME: preview.goldshore.ai → preview-web.pages.dev ──────────
  console.log("1. Creating DNS CNAME record...");
  const existing = await cf(`/zones/${ZONE}/dns_records?name=preview.goldshore.ai&type=CNAME`);
  if (existing.length > 0) {
    console.log("   ✓ CNAME already exists:", existing[0].content);
  } else {
    await cf(`/zones/${ZONE}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: "preview",
        content: "preview-web.pages.dev",
        proxied: true,
        ttl: 1,
        comment: "Preview deployments for claude/* branches",
      }),
    });
    console.log("   ✓ CNAME created: preview.goldshore.ai → preview-web.pages.dev");
  }

  // ── 2. Add custom domain to preview-web Pages project ───────────────────
  console.log("2. Adding custom domain to preview-web Pages project...");
  try {
    await cf(`/accounts/${ACCOUNT}/pages/projects/preview-web/domains`, {
      method: "POST",
      body: JSON.stringify({ name: "preview.goldshore.ai" }),
    });
    console.log("   ✓ Custom domain added: preview.goldshore.ai → preview-web");
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("taken")) {
      console.log("   ✓ Custom domain already configured");
    } else {
      console.warn("   ⚠ Could not add custom domain (project may not exist yet).");
      console.warn("   → Re-run after the first preview deploy completes.");
    }
  }

  console.log("\nDone. DNS propagation typically takes 1–5 minutes.");
  console.log("Preview URL: https://preview.goldshore.ai");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
