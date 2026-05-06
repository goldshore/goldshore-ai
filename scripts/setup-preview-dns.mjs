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
  console.error("Missing required env vars: set either CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID or CF_API_TOKEN/CF_ACCOUNT_ID. (CLOUDFLARE_ZONE_ID/CF_ZONE_ID is optional; it will be auto-resolved if omitted.)");
  process.exit(1);
}

function sanitizeErrorForLog(err) {
  // Avoid logging provider-supplied messages directly, as they may contain
  // sensitive data. Instead, log a constrained summary for debugging.
  //
  // This function must be safe even if `err` is fully tainted (e.g. derived
  // from environment variables or remote responses). Therefore, we:
  //   - Only log a small, whitelisted set of primitive fields.
  //   - Reject free-form or long strings.
  //   - Never log nested objects/arrays such as `err.errors`.
  if (!err || typeof err !== "object") {
    return "Unknown error";
  }

  const parts = [];

  // Helper to allow only short, simple identifiers (e.g. "ENOENT", "ERR123").
  const safeString = (value) => {
    if (typeof value !== "string") return null;
    // Limit length to reduce risk of leaking large payloads.
    if (value.length === 0 || value.length > 64) return null;
    // Allow only word chars, dash, and dot.
    if (!/^[A-Za-z0-9_.-]+$/.test(value)) return null;
    return value;
  };

  // HTTP status code or similar numeric status.
  if (typeof err.status === "number" && Number.isFinite(err.status)) {
    parts.push(`status=${err.status}`);
  }

  // Generic error code / name, but only if they are short, simple identifiers.
  const code = safeString(err.code);
  if (code) {
    parts.push(`code=${code}`);
  }

  const name = safeString(err.name);
  if (name) {
    parts.push(`name=${name}`);
  }

  // Do NOT log nested structures like `err.errors` as they may contain
  // request echoes, environment data, or other sensitive information.

  return parts.length > 0 ? parts.join(", ") : "Unspecified error (details redacted)";
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
  const path = `/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(ACCOUNT)}`;
  const zones = await cf(path);
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error(`No Cloudflare zone found for ${domain} under account ${ACCOUNT}`);
  }
  if (zones.length > 1) {
    throw new Error(
      `Multiple Cloudflare zones found for ${domain} under account ${ACCOUNT}. ` +
      `Refusing to choose arbitrarily. Please set CLOUDFLARE_ZONE_ID or CF_ZONE_ID explicitly.`
    );
  }
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
    const message = err && typeof err.message === "string" ? err.message : String(err);
    if (message.includes("already exists") || message.includes("taken")) {
      console.log("   ✓ Custom domain already configured");
    } else {
      if (process.env.DEBUG === "1") {
        console.warn(
          "   ⚠ Could not add custom domain (project may not exist yet). Debug details:",
          sanitizeErrorForLog(err)
        );
      } else {
        console.warn("   ⚠ Could not add custom domain (project may not exist yet). Enable DEBUG=1 for more details.");
      }
      console.warn("   → Re-run after the first preview deploy completes.");
    }
  }

  console.log("\nDone. DNS propagation typically takes 1–5 minutes.");
  console.log("Preview URL: https://preview.goldshore.ai");
}

main().catch(err => {
  console.error("Error: setup-preview-dns script failed. See logs or rerun with debugging enabled.");
  // Avoid logging err.message directly to prevent leaking potentially sensitive data.
  process.exit(1);
});
