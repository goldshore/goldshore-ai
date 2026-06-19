# Domain & Route Ownership Policy

**Authority:** Marzton (account owner)  
**Enforced by:** CI/CD validation (`scripts/check-route-collisions.mjs`)  
**Last updated:** 2026-04-24

---

## Zones

| Zone | Owner | Pages Project | Worker Routes | Access Policy |
|---|---|---|---|---|
| `goldshore.ai` | GoldShore Labs | gs-web | api.*, gw.*, ops.*, agent.* | Public for web; CF Access for admin |
| `goldshore.org` | GoldShore Labs | (external Pages) | goldshore-org router | Public |
| `banproof.me` | GoldShore Labs (BanProof) | — | banproof-me | Public |

---

## Canonical Routing Map

### Zone: `goldshore.ai`

#### Pages (Custom Domains)
```
goldshore.ai
├── apex → gs-web Pages project
└── TLS: auto-issued for all attached domains

www.goldshore.ai
├── CNAME proxy to goldshore.ai
└── Same as apex

preview.goldshore.ai
├── gs-web Pages preview environment
└── Same build, same code, different DNS name (for QA)

admin.goldshore.ai
├── gs-admin Pages project
└── Cloudflare Access policy: email allowlist required

admin-preview.goldshore.ai
├── gs-admin Pages preview environment
└── Same Access policy as admin.goldshore.ai
```

#### Workers (Routes)
```
api.goldshore.ai/*
├── gs-api worker
├── Direct route owner; not proxied through gs-gateway
├── Public endpoint
└── Methods: GET, POST, PUT, DELETE (documented)

api-preview.goldshore.ai/*
├── gs-api preview environment
└── Same as prod, different build/database

gw.goldshore.ai/*
├── gs-platform worker (code: apps/gs-gateway)
├── Gateway/proxy — routes to downstream services
└── Methods: GET, POST (as per gateway rules)

agent.goldshore.ai/*
├── Routed through gs-platform gateway
├── gs-agent worker receives traffic
└── Methods: POST (agent-specific protocol)

ops.goldshore.ai/*
├── gs-control worker
├── Cloudflare API access
├── Cloudflare Access policy: ops team only
└── Methods: GET, POST (admin commands)
```

### Zone: `goldshore.org`

#### Workers (Routes)
```
goldshore.org/*
├── goldshore-org router worker
├── Routes to gs-web.pages.dev backend (ASSETS_ORIGIN)
├── Implements canonical host redirect to goldshore.ai (SEO)
└── Methods: GET, HEAD, OPTIONS

www.goldshore.org/*
├── CNAME proxy to goldshore.org
└── Same router behavior
```

### Zone: `banproof.me`

#### Workers (Routes)
```
banproof.me/*
├── banproof-me worker
├── Proof of Agency gateway
├── Cloudflare Workflows integration
└── Methods: GET, POST, PUT

www.banproof.me/*
├── CNAME proxy to banproof.me
└── Same worker behavior
```

---

## Route Conflict Prevention

### Rules

1. **No overlapping patterns.**
   - ✅ Correct:
     - `api.goldshore.ai/*` (gs-api)
     - `gw.goldshore.ai/*` (gs-platform)
   - ❌ Wrong:
     - `goldshore.ai/*` (gs-web Pages)
     - `goldshore.ai/*` (some-worker) ← **CONFLICT**

2. **Subdomain isolation.** Each subdomain is owned by exactly one service.
   - `api.*` → gs-api only
   - `gw.*` → gs-platform only
   - `admin.*` → gs-admin Pages only
   - etc.

3. **Custom domains vs. routes.** 
   - **Pages** use custom domain attachment (Cloudflare manages routing)
   - **Workers** use route patterns (you must not conflict)
   - **Never attach both a Pages project AND a worker route to the same domain.**

### Validation Script

```bash
# Check for conflicts
node scripts/check-route-collisions.mjs

# Expected output:
# ✓ No route collisions detected
# ✓ No zone_name conflicts
# ✓ All routes have exactly one owner
```

This script runs in CI before deploy — if it fails, the deployment blocks.

---

## Gateway Forwarding Rules

### gs-platform / gs-gateway (Gateway Worker)

The gateway owns `gw.goldshore.ai/*` and `agent.goldshore.ai/*`. It does **not** own `api.goldshore.ai/*`; direct API traffic is served by `gs-api`. For gateway-hosted requests, it routes inbound requests to downstream services:

```
Request: POST /query?agent=true
To: gw.goldshore.ai/query?agent=true

Gateway decision:
  if (url.searchParams.has('agent')) {
    route to gs-agent service binding
  } else {
    route to gs-api service binding
  }
```

**Important:** The gateway **must not** rewrite the Host header. Downstream services (gs-api, gs-agent) receive requests with `Host: gw.goldshore.ai` — they should be aware of this and trust the X-Forwarded-Host header if present.

---

## CORS & Asset Origin Rules

### Rule: ASSETS_ORIGIN

The `gs-web` Pages project assets (CSS, JS, images) are served from:
```
https://goldshore-ai.pages.dev/  (or custom domain)
```

When accessed via:
- `https://goldshore.ai/` → CORS allows it (wildcard or explicit)
- `https://goldshore.org/` → goldshore-org router sets ASSETS_ORIGIN, CORS allows it
- `https://admin.goldshore.ai/` → gs-admin is a separate build, may have own assets

**Recursion risk:** If gs-web tries to fetch from itself (e.g., prefetch WASM), ensure CORS doesn't loop back.

### R2 CORS Policies

#### gs-assets (Public)
```json
{
  "cors": [{
    "allowedOrigins": [
      "https://goldshore.ai",
      "https://www.goldshore.ai",
      "https://goldshore.org",
      "https://www.goldshore.org",
      "https://admin.goldshore.ai",
      "https://banproof.me"
    ],
    "allowedMethods": ["GET", "HEAD"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 86400
  }]
}
```

#### user-uploads (Private)
```json
{
  "cors": [{
    "allowedOrigins": ["https://api.goldshore.ai"],
    "allowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }]
}
```

---

## Access Control (Cloudflare Access)

### Protected Routes

| Route | Zone | Audience | Policy |
|---|---|---|---|
| `admin.goldshore.ai` | goldshore.ai | gs-admin | Email: @goldshore.ai, @marzton.dev |
| `admin-preview.goldshore.ai` | goldshore.ai | gs-admin-preview | Same as admin |
| `ops.goldshore.ai` | goldshore.ai | gs-control | Email: @goldshore.ai (ops team only) |

### Public Routes

All other routes are public (no Cloudflare Access policy).

---

## Deployment Changes Checklist

When updating routes or domains:

- [ ] Update wrangler.toml with new route pattern
- [ ] Run `node scripts/check-route-collisions.mjs` locally
- [ ] Commit and push to main
- [ ] GitHub Actions runs validation before deploy
- [ ] Confirm worker deploys with new routes
- [ ] Test route with curl: `curl https://new-subdomain.zone/*`
- [ ] Update this document if adding a new subdomain

---

## Audit Query

**List all live routes on the account:**

```bash
curl -X GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/services \
  -H "Authorization: Bearer {CLOUDFLARE_BUILD_API_TOKEN}" | jq '.result[] | {name: .name, routes: .routes}'
```

**Expected output (after full deployment):**
```json
[
  {"name": "gs-api", "routes": [{"pattern": "api.goldshore.ai/*"}, {"pattern": "api-preview.goldshore.ai/*"}]},
  {"name": "gs-platform", "routes": [{"pattern": "gw.goldshore.ai/*"}, {"pattern": "agent.goldshore.ai/*"}]},
  {"name": "gs-control", "routes": [{"pattern": "ops.goldshore.ai/*"}]},
  {"name": "goldshore-org", "routes": [{"pattern": "goldshore.org/*"}, {"pattern": "www.goldshore.org/*"}]},
  {"name": "banproof-me", "routes": [{"pattern": "banproof.me/*"}, {"pattern": "www.banproof.me/*"}]}
]
```

---

## FAQ

### Q: Can I deploy a worker to the root domain?
**A:** No. Pages projects own apex/www custom domains. Workers use subdomains with route patterns. Deploy gs-web as a Pages project on `goldshore.ai`, not as a worker.

### Q: What if two workers need the same route?
**A:** You can't have both. Either:
1. Merge them into one worker
2. Give them different subdomains
3. Use a gateway pattern (like gs-platform) to route to both

### Q: Can goldshore-org router serve goldshore.ai content?
**A:** No. `goldshore-org` owns `.org` routes only. `goldshore.ai` is owned by `gs-web` Pages + subdomain workers. The router can link/redirect but shouldn't claim the domain.

### Q: What if I need to change a route after deploy?
**A:** Update wrangler.toml, run validation, commit, push to main. GitHub Actions redeploys. Old route stops working immediately (or keep both temporarily if needed).

---

## Zone Handoff

If you transfer a zone to another account or organization:

1. Update this document with new owner
2. Redeploy all workers/Pages for that zone with new account credentials
3. Update DNS at registrar to point to new Cloudflare nameservers
4. Keep this document as an audit trail
