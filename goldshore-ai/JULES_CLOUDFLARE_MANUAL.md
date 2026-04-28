
🟦 JULES — CLOUD FLARE INTEGRATION MANUAL

Install, Create, Setup, Manage & Maintain GoldShore Infrastructure

This document defines how Jules MUST interact with the Cloudflare API and Cloudflare Dashboard for all GoldShore services, including:
	•	gs-web (public website)
	•	gs-admin (admin dashboard)
	•	gs-api (API worker)
	•	gs-gateway (Gateway worker)
	•	gs-control (internal ops/automation worker)
	•	gs-mail (incoming mail worker)
	•	future services (status, trade, settings, etc.)

Jules MUST follow these rules exactly to maintain consistency, safety, and idempotency.

⸻

📍 SECTION 1 — ROOT PRINCIPLES

✔ DO:
	•	Act ONLY on the application explicitly asked about.
	•	Use Cloudflare API v4 for CRUD operations.
	•	Verify a resource exists before modifying it.
	•	Use the correct project names.
	•	Keep all wrangler configs idempotent.
	•	Keep all build commands consistent with the monorepo.
	•	Activate Worker versions ONLY after successful testing.

❌ DO NOT:
	•	Create a new Worker or Pages project unless explicitly instructed.
	•	Modify any sibling application.
	•	Guess the directory path — always ask or use the defined map.
	•	Overwrite DNS unintentionally.
	•	Remove or purge anything unless explicitly instructed.

⸻

📍 SECTION 2 — DIRECTORY MAP (MANDATORY)

Jules must ALWAYS map Cloudflare apps to the correct directories:

Cloudflare App	Directory	Type
gs-web	apps/gs-web	Astro → Pages
gs-admin	apps/gs-admin	Astro → Pages
gs-api	apps/gs-api	CF Worker
gs-gateway	apps/gs-gateway	CF Worker
gs-control	apps/gs-control	CF Worker
gs-mail	apps/mail-worker (if created later)	Email Worker

This is the authoritative mapping.

⸻

📍 SECTION 3 — DNS RULES (MANDATORY)

Jules must use this OFFICIAL domain map:

Purpose	Domain
Public website	goldshore.ai
Admin dashboard	admin.goldshore.ai
API	api.goldshore.ai
Gateway	gw.goldshore.ai
Control worker	ops.goldshore.ai
Mail handler	mail.goldshore.ai
Catch-all email	*@goldshore.ai
Status page	status.goldshore.ai
Settings app	settings.goldshore.ai
Future subapps	*.goldshore.ai

Rules:
	•	DNS must NEVER be modified unless explicitly instructed.
	•	DNS changes must use Cloudflare’s DNS API.

⸻

📍 SECTION 4 — ZERO-TRUST ACCESS RULES

Jules MUST enable Access ONLY on:

App	Access Required	Reason
gs-web	❌ NO	Public-facing
gs-admin	✅ YES	Admin dashboard
gs-api	⚠ OPTIONAL	Only private endpoints
gs-gateway	⚠ OPTIONAL	Depends on design
gs-control	✅ YES	Internal ops system
gs-mail	❌ NO	Cloudflare mail routing cannot authenticate

Access must include:
	•	Identity provider (Google / email OTP)
	•	Policy: allow only GoldShore internal emails
	•	JWKs URL must be inserted when required

⸻

📍 SECTION 5 — PAGES PROJECT CREATION RULES

For gs-web and gs-admin, always create:

gs-web

name: gs-web
root: apps/gs-web
build_command: pnpm --filter @goldshore/web build
build_output: apps/gs-web/dist
adapter: @astrojs/cloudflare
domains:
  - goldshore.ai
  - www.goldshore.ai

gs-admin

name: gs-admin
root: apps/gs-admin
build_command: pnpm --filter @goldshore/admin build
build_output: apps/gs-admin/dist
adapter: @astrojs/cloudflare
domains:
  - admin.goldshore.ai

RULES:
	•	Always use “Direct Upload” unless GitHub is connected.
	•	Pages previews always deploy from PR branches.

⸻

📍 SECTION 6 — WORKER CREATION RULES

Workers must be created using API, not Dashboard, unless instructed.

Format for creation:

PUT /accounts/:account_id/workers/scripts/:script_name

Worker → Directory Map:

Worker	Folder	entrypoint
gs-api	apps/gs-api	src/index.ts
gs-gateway	apps/gs-gateway	src/index.ts
gs-control	apps/gs-control	src/index.ts
gs-mail	no folder required	via CF editor


⸻

📍 SECTION 7 — WORKER BINDINGS (MANDATORY)

All workers must have:

Standard bindings:

KV: GS_KV
D1: GS_DB
R2: GS_ASSETS
AI Gateway: AI

gs-gateway must bind to:

[[services]]
binding = "API"
service = "gs-api"

gs-control must bind:

API → gs-api
GATEWAY → gs-gateway


⸻

📍 SECTION 8 — WRANGLER CONFIG RULES

Jules MUST generate & maintain:

apps/gs-api/wrangler.toml

name = "gs-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "KV"
id = "gs_api_kv_001"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gs-assets"

[[d1_databases]]
binding = "DB"
database_name = "goldshore"
database_id = "gs_db_001"

[ai]
binding = "AI"

apps/gs-gateway/wrangler.toml

name = "gs-gateway"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[services]]
binding = "API"
service = "gs-api"
environment = "production"

[ai]
binding = "AI"

apps/gs-control/wrangler.toml

name = "gs-control"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "CONTROL_LOGS"
id = "gs_control_logs_001"

[[r2_buckets]]
binding = "STATE"
bucket_name = "gs-control-state"

[[services]]
binding = "API"
service = "gs-api"

[[services]]
binding = "GATEWAY"
service = "gs-gateway"

gs-mail has NO wrangler file.

⸻

📍 SECTION 9 — ROUTING RULES

Workers must have:

Worker	Route
gs-api	api.goldshore.ai/*
gs-gateway	gw.goldshore.ai/*
gs-control	ops.goldshore.ai/*
gs-mail	none (email worker)

Pages routing is handled automatically.

⸻

📍 SECTION 10 — JULES COMMAND SYNTAX

Jules understands commands beginning with:

jules: cloudflare create <app>
jules: cloudflare update <app>
jules: cloudflare deploy <app>
jules: cloudflare configure <app>
jules: cloudflare bindings <app>

Examples:

Create gs-api:

jules: cloudflare create worker gs-api

Deploy admin:

jules: cloudflare deploy pages gs-admin

Create DNS:

jules: cloudflare dns add api.goldshore.ai CNAME <target>

Create Access policies:

jules: cloudflare access protect admin.goldshore.ai


⸻

📍 SECTION 11 — ERROR HANDLING RULES

If Jules encounters:
	•	invalid domain
	•	missing binding
	•	missing account ID
	•	namespace not found

It MUST:
	1.	Report the error
	2.	Provide the fix
	3.	Wait for confirmation
	4.	Retry

Never guess. Never continue blindly.

⸻

📍 SECTION 12 — MAINTENANCE RULES

Jules MUST:
	•	Reconcile wrangler.toml with Cloudflare state
	•	Ensure DNS matches routing rules
	•	Ensure Access policies match protection matrix
	•	Ensure Pages project uses correct build outputs
	•	Check Worker version activation after deploy
	•	Rotate secrets every 90 days (only when told)

⸻

📍 SECTION 13 — AUTH RULES

Jules MUST use:
	•	CF_API_TOKEN
	•	CF_ACCOUNT_ID
	•	CF_ZONE_ID

and must NOT request them again unless they are missing or invalid.

⸻

📍 SECTION 14 — EMAIL WORKER RULES

gs-mail must NOT use Cloudflare Access.

gs-mail must follow:

export default {
  async email(message, env, ctx) {
    await message.forward("ops@goldshore.ai")
  }
}

Catch-all must point at gs-mail.

⸻

📍 SECTION 15 — FUTURE SERVICES

Every future subdomain follows:

subdomain.goldshore.ai → corresponding directory or worker

Examples:
	•	trade.goldshore.ai → new Pages site or Worker
	•	status.goldshore.ai → Status worker or SAAS
	•	docs.goldshore.ai → Astro site
	•	api.trade.goldshore.ai → Worker

⸻

🎯 FINAL CHECKLIST FOR JULES

Jules MUST verify before ANY change:

□ Directory exists
□ wrangler.toml valid
□ Worker name matches naming convention
□ Build command correct
□ Output directory correct
□ No unrelated services touched
□ Access rules match table
□ DNS consistent
□ Bindings applied exactly as defined
□ Deploy worker version safely
□ Validate deployment response
□ Return summary

⸻

🚀 Done

If you’d like, I can also generate:

✅ Jules Cloudflare API Test Suite
✅ Infrastructure Dashboard UI
✅ gs-control automation routines
✅ GoldShore CI/CD Safety Matrix

Just say: “Generate the next module.”
