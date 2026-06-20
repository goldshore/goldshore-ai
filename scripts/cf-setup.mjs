#!/usr/bin/env node
/**
 * cf-setup.mjs
 *
 * Configures Cloudflare Pages projects (build settings + disable built-in
 * GitHub auto-deploy) and seeds essential KV values so wrangler deploys
 * have the correct config from first boot.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<id> node scripts/cf-setup.mjs
 *
 * Safe to re-run — all operations are idempotent PATCH/PUT calls.
 */

const TOKEN   = process.env.CLOUDFLARE_API_TOKEN  ?? process.env.CLOUDFLARE_BUILD_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT) {
  console.error('ERROR: Set CLOUDFLARE_API_TOKEN (or CLOUDFLARE_BUILD_API_TOKEN) and CLOUDFLARE_ACCOUNT_ID');
  process.exit(1);
}

const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;

async function cf(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(`CF API ${method} ${path} → ${JSON.stringify(data.errors)}`);
  return data.result;
}

// ── 1. Pages project build settings ────────────────────────────────────────
//
// CF Pages has its own GitHub integration that can trigger duplicate deploys
// alongside our GH Actions workflow. We patch each project to:
//   a) Set correct build command / output dir / root dir
//   b) Disable CF's built-in GitHub auto-deploy (deployments_enabled: false)
//      so ONLY our deploy-platform.yml workflow fires.

const PAGES_PROJECTS = [
  {
    name: 'gs-web',
    build_command: 'pnpm --filter @goldshore/gs-web build',
    destination_dir: 'apps/gs-web/dist',
    root_dir: '',
  },
  {
    name: 'gs-admin',
    build_command: 'pnpm --filter @goldshore/gs-admin build',
    destination_dir: 'apps/gs-admin/dist',
    root_dir: '',
  },
];

console.log('\n── CF Pages: build settings + disable auto-deploy ─────────────────');
for (const p of PAGES_PROJECTS) {
  try {
    await cf('PATCH', `/pages/projects/${p.name}`, {
      build_config: {
        build_command:   p.build_command,
        destination_dir: p.destination_dir,
        root_dir:        p.root_dir,
      },
      source: {
        config: {
          // Disable CF Pages' own GitHub-triggered deploys.
          // Our deploy-platform.yml uses `wrangler pages deploy` directly.
          deployments_enabled: false,
        },
      },
    });
    console.log(`  ✓ ${p.name}: build_command="${p.build_command}", output="${p.destination_dir}", auto-deploy=off`);
  } catch (err) {
    console.error(`  ✗ ${p.name}: ${err.message}`);
  }
}

// ── 2. KV seed values ──────────────────────────────────────────────────────
//
// These are non-secret runtime config values that workers read on first boot.
// Secrets (API keys, OAuth tokens) must be set via `wrangler secret put` or
// the CF Dashboard — never seeded here.
//
// Format: { namespaceId, key, value }

const KV_SEEDS = [
  // GS_CONFIG — read by gs-gateway, gs-mail, gs-control
  { namespaceId: '68f52b467dc0413991b2195ef9081cae', key: 'ROUTING_TABLE',    value: JSON.stringify({ version: 1, routes: [] }) },
  { namespaceId: '68f52b467dc0413991b2195ef9081cae', key: 'SERVICE_STATUS',   value: JSON.stringify({ updated_at: Date.now(), services: {} }) },
  { namespaceId: '68f52b467dc0413991b2195ef9081cae', key: 'AI_ORCHESTRATION', value: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096 }) },

  // Feature flags read by gs-api and gs-trading
  { namespaceId: '68f52b467dc0413991b2195ef9081cae', key: 'mcp-trading',      value: 'true' },
  { namespaceId: '68f52b467dc0413991b2195ef9081cae', key: 'mcp-agents',       value: 'true' },

  // Paper trading cash starting balance (gs-trading reads paper:cash)
  { namespaceId: '9b3314c3b7af40a284a8c9b6e2990709', key: 'paper:cash',       value: '100000' },

  // Hero variant for gs-admin dashboard
  { namespaceId: 'd02c0c7951a244a7987e23d8af16b7b2', key: 'hero_variant',     value: 'orbital' },
];

console.log('\n── KV seed values ───────────────────────────────────────────────────');
for (const { namespaceId, key, value } of KV_SEEDS) {
  try {
    await cf('PUT', `/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, value);
    console.log(`  ✓ KV[${namespaceId.slice(0, 8)}…] ${key}`);
  } catch (err) {
    console.error(`  ✗ KV[${namespaceId.slice(0, 8)}…] ${key}: ${err.message}`);
  }
}

// ── 3. Summary: what still needs manual action ─────────────────────────────
console.log(`
── Manual actions still required ────────────────────────────────────
These cannot be automated via API and must be done in CF Dashboard or
via wrangler secret put:

SECRETS (wrangler secret put --env prod):
  gs-gateway       CLOUDFLARE_ACCESS_AUDIENCE  (from Gate 5d in INFRASTRUCTURE.md)
  gs-api           CLOUDFLARE_ACCESS_AUDIENCE  (same AUD as gateway)
  gs-agent         CLOUDFLARE_ACCESS_AUDIENCE  (same AUD as gateway)
  gs-control       CLOUDFLARE_API_TOKEN        (read-only token or Workers:Edit)
  gs-control       CLOUDFLARE_ACCOUNT_ID
  gs-trading       SCHWAB_CLIENT_ID / SCHWAB_CLIENT_SECRET
  gs-trading       ROBINHOOD_CLIENT_ID / ROBINHOOD_CLIENT_SECRET
  gs-mail          RESEND_API_KEY
  gs-admin         ADMIN_API_KEY               (internal service auth)

CUSTOM DOMAINS (CF Dashboard → Pages / Workers → Custom domains):
  gs-web  (Pages) → goldshore.ai, www.goldshore.ai
  gs-admin (Pages) → admin.goldshore.ai

DNS records needed for route-based workers (CF Dashboard → DNS):
  CNAME  gw      →  (proxied)  ← for gs-gateway gw.goldshore.ai/*
  CNAME  api     →  (proxied)  ← for gs-gateway api.goldshore.ai/*
  CNAME  agent   →  (proxied)  ← for gs-gateway agent.goldshore.ai/*
  CNAME  trading →  (proxied)  ← for gs-trading trading.goldshore.ai/*
  (dashboard.goldshore.ai uses custom_domain=true — CF provisions DNS automatically)

ORPHAN WORKERS to delete (CF Dashboard → Workers → Delete):
  banproof-email-router   (unknown, not in monorepo)
  gs-signals-prod         (superseded by gs-core-worker)
  gs-web (Worker)         (conflicts with gs-web Pages project name)
  gs-web-staging          (stale staging worker)
  gs-todo                 (empty stub)
  banproof                (old name, replaced by banproof-me)
  goldshore-ai (Worker)   (empty stub — or keep if needed as catch-all)

──────────────────────────────────────────────────────────────────────
`);
