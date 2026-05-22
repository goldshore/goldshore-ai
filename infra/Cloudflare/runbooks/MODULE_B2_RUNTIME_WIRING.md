# Module B2 — Cloudflare Runtime Wiring & Verification

This module documents how the infra agent should wire and verify runtime resources across Cloudflare to match the authoritative system map from Systems.pdf.

## 1. Authoritative System Map
Treat the following as the expected Cloudflare inventory and URLs:

| System          | Type    | Status   | Purpose             | Expected URL                          |
| --------------- | ------- | -------- | ------------------- | ------------------------------------- |
| Web             | Pages   | UNKNOWN  | Public site         | https://goldshore.ai                  |
| Admin           | Pages   | UNKNOWN  | Control panel       | https://admin.goldshore.ai            |
| API Worker      | Worker  | ONLINE   | Core API            | https://api.goldshore.ai              |
| Gateway Worker  | Worker  | UNKNOWN  | Routing /api/*      | https://gw.goldshore.ai               |
| Control Worker  | Worker  | UNKNOWN  | Infra automation    | https://ops.goldshore.ai              |
| Mail Worker     | Worker  | UNKNOWN  | Email routing       | https://gs-mail.goldshore.workers.dev |
| Banproof Worker | Worker  | UNKNOWN  | PoA gateway         | https://banproof.me                    |

Always compare Cloudflare to this table and repair any divergence.

## 2. Runtime Objective
- Pages
  - Deploy `gs-web` to `https://goldshore.ai`.
  - Deploy `gs-admin` to `https://admin.goldshore.ai`.
- Workers
  - `gs-api` → `https://api.goldshore.ai`.
  - `gs-gateway` → `https://gw.goldshore.ai`.
  - `gs-control` → `https://ops.goldshore.ai`.
  - `gs-mail` → `https://mail.goldshore.ai` (replace workers.dev long term).
  - `banproof-me` → `https://banproof.me`.
- Routing
  - `/api/*` → Gateway → API.
  - `/control/*` → Control worker.
  - `/mail/*` or MX `goldshore.ai` → Mail worker.
- Health checks: every worker returns `{ "status": "ok", "service": "<name>" }` at `/health` and `/system/info`.

## 3. Cloudflare State Check (first action)
Use the Cloudflare API to enumerate and verify current state.

- Pages projects: `GET /client/v4/accounts/{account_id}/pages/projects` and confirm `gs-web` and `gs-admin` exist.
- Workers: `GET /client/v4/accounts/{account_id}/workers/services` and confirm `gs-api`, `gs-gateway`, `gs-control`, `gs-mail`, `banproof-me` exist.
- Routes: `GET /client/v4/accounts/{account_id}/workers/filters` and confirm:
  - `api.goldshore.ai/*` → `gs-api`
  - `gw.goldshore.ai/*` → `gs-gateway`
  - `ops.goldshore.ai/*` → `gs-control`
  - `mail.goldshore.ai/*` → `gs-mail`
- If any route is missing, create it.

## 4. Monorepo Expected Structure
Ensure the repository contains the following layout (create scaffolds if missing):

```
apps/
  web/
    package.json   → "@goldshore/web"
    dist/
  admin/
    package.json   → "@goldshore/admin"
  api/
    package.json   → "gs-api"
    wrangler.toml
  gateway/
    package.json   → "gs-gateway"
    wrangler.toml
  control/
    package.json   → "gs-control"
    wrangler.toml
  mail/
    package.json   → "gs-mail"
    wrangler.toml

packages/
  ui/
  theme/
  utils/
```

## 5. Wrangler Standardization
Enforce these `wrangler.toml` definitions per worker:

**gs-api/wrangler.toml**
```toml
name = "gs-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"
routes = [
  { pattern = "api.goldshore.ai/*" }
]

[ai]
binding = "AI"
```

**gs-gateway/wrangler.toml**
```toml
name = "gs-gateway"
main = "src/index.ts"
compatibility_date = "2024-11-01"
routes = [
  { pattern = "gw.goldshore.ai/*" }
]

[[services]]
binding = "API"
service = "gs-api"
environment = "production"
```

**gs-control/wrangler.toml**
```toml
name = "gs-control"
main = "src/index.ts"
compatibility_date = "2024-11-01"
routes = [
  { pattern = "ops.goldshore.ai/*" }
]
```

**gs-mail/wrangler.toml**
```toml
name = "gs-mail"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
routes = [
  { pattern = "mail.goldshore.ai/*" }
]

[[email]]
bindings = [
  { name = "MAIL", type = "inbound" }
]
```

## 6. Health Routes
Each worker must expose `/health`, `/system/info`, and `/version`, returning JSON such as:

```ts
app.get("/health", (c) => c.json({ status: "ok", service: "gs-api" }));
```

Add missing routes before deploying.

## 7. Autowiring Email
- Create goldshore.ai email routes: `no-reply@`, `mail@`, `support@`, `ops@`, and catch-all `*@goldshore.ai` → `gs-mail`.
- Ensure the mail worker exports an email handler:

```ts
export default {
  async email(message, env, ctx) {
    await env.MAIL.forward(message, "ops@goldshore.ai");
  }
}
```

- Fix Access JWT validation using the provided audience IDs.

## 8. Status Dashboard (status.goldshore.ai)
- Create Pages project `gs-status` with domain `status.goldshore.ai`.
- UI should poll:
  - `GET api.goldshore.ai/health`
  - `GET gw.goldshore.ai/health`
  - `GET ops.goldshore.ai/health`
  - `GET mail.goldshore.ai/health`
  - `HEAD goldshore.ai`
- Display ONLINE/DOWN using color-coded badges.

## 9. Repair Flow for UNKNOWN Services
For any UNKNOWN service:
1. Check Pages/Worker existence.
2. If missing, create the service.
3. If exists but has no routes, add routes.
4. If exists but lacks domain, add custom domain.
5. Deploy latest monorepo code.
6. Validate `/health` returns `ok`.
7. Update the status dashboard.

## 10. Prohibited Actions
- Do not rename `apps/gs-web` or `apps/gs-admin`.
- Do not create new repositories.
- Do not change DNS records without instruction.
- Do not regenerate lockfiles unless dependencies change.
- Do not create duplicate workers.
- Do not modify Cloudflare Pages directly; use the API.

---

If ready to proceed to automated deployment instructions, request **Module B3**.
