# Gold Shore Labs — DNS & Worker Route Configuration
# Apply in Cloudflare Dashboard: dash.cloudflare.com → DNS
# Account: f77de112d2019e5456a3198a8bb50bd2

# ══════════════════════════════════════════════════════════════
# ZONE: goldshore.ai
# ══════════════════════════════════════════════════════════════

## goldshore.ai (root) — Astro Cloudflare Pages app (gs-web worker)
# Type: CNAME, Proxied
# Name: @  →  gs-web.pages.dev  (or worker route via *.goldshore.ai)
# NOTE: gs-web wrangler.jsonc has no routes — Pages handles root domain via custom domain

## www.goldshore.ai → redirect to apex
# Type: CNAME, Proxied
# Name: www  →  goldshore.ai
# Or add a Page Rule: www.goldshore.ai/* → 301 → https://goldshore.ai/$1

## gw.goldshore.ai → goldshore-gateway worker (MISSING — add this)
# Type: CNAME, Proxied: YES
# Name: gw  →  goldshore-gateway.<account>.workers.dev
# Worker route (in Cloudflare Dashboard → Workers → goldshore-gateway → Triggers):
#   Pattern: gw.goldshore.ai/*   Zone: goldshore.ai

## api.goldshore.ai → goldshore-api worker
# Type: CNAME, Proxied: YES
# Name: api  →  goldshore-api.<account>.workers.dev
# Worker route: api.goldshore.ai/*  (check routes in dashboard — currently 404)
# FIX: Ensure wrangler.jsonc has routes = [{pattern:"api.goldshore.ai/*", zone_name:"goldshore.ai"}]

## admin.goldshore.ai → goldshore-admin worker (CF Access protected — WORKING CORRECTLY)
# Type: CNAME, Proxied: YES
# Name: admin  →  goldshore-admin.<account>.workers.dev
# CF Access: Application exists, redirecting to CF Access login — CORRECT BEHAVIOR
# NOTE: "Redirecting to preview" issue = CF Access is protecting admin correctly.
#       To access, you need an authorized email in the CF Access policy.
#       Check: dash.cloudflare.com → Zero Trust → Access → Applications → admin.goldshore.ai

## agent.goldshore.ai → goldshore-agent worker (MISSING — add this)
# Type: CNAME, Proxied: YES
# Name: agent  →  goldshore-agent.<account>.workers.dev
# Worker route: agent.goldshore.ai/*

## mail.goldshore.ai → goldshore-mail (internal — no public DNS needed)
# Cloudflare Email Routing handles inbound
# No public DNS record required

# ══════════════════════════════════════════════════════════════
# ZONE: goldshore.org
# ══════════════════════════════════════════════════════════════

## goldshore.org (root) → goldshore-web (Pages or Worker)
# Type: CNAME, Proxied: YES
# Name: @  →  goldshore-web.pages.dev
# Add as custom domain in Pages project settings

## www.goldshore.org → redirect to apex
# Type: CNAME, Proxied: YES
# Name: www  →  goldshore.org

# ══════════════════════════════════════════════════════════════
# ZONE: rmarston.com
# ══════════════════════════════════════════════════════════════

## rmarston.com → rmarston-com worker
# CURRENT ISSUE: wrangler.toml has routes=[] so worker is not attached
# FIXED wrangler.toml now has routes pointing to rmarston.com/*
# After deploy, worker serves dist/ via static assets binding
# Type: CNAME, Proxied: YES (or A record if GitHub Pages fallback needed)
# Name: @  →  rmarston-com.<account>.workers.dev
# Worker route: rmarston.com/*  zone_name: rmarston.com

## www.rmarston.com → redirect to apex
# Type: CNAME, Proxied: YES
# Name: www  →  rmarston.com

# ══════════════════════════════════════════════════════════════
# ZONE: banproof.me
# ══════════════════════════════════════════════════════════════

## banproof.me → banproof-me worker (LIVE — 200 OK)
# Existing DNS records presumed correct
# Worker route: banproof.me/*

## www.banproof.me → redirect to apex
# Type: CNAME, Proxied: YES

# ══════════════════════════════════════════════════════════════
# ZONE: armsway.com
# ══════════════════════════════════════════════════════════════

## armsway.com → armsway worker (redirecting 301 — check apex CNAME)
# Type: CNAME, Proxied: YES
# Worker route: armsway.com/*  zone_name: armsway.com

## www.armsway.com → redirect to apex
# Type: CNAME, Proxied: YES

# ══════════════════════════════════════════════════════════════
# WORKER ROUTES — APPLY IN CLOUDFLARE DASHBOARD
# Workers → <script> → Triggers → Add Custom Domain OR Routes
# ══════════════════════════════════════════════════════════════

# goldshore-gateway routes:
#   gw.goldshore.ai/*  (zone: goldshore.ai)

# goldshore-api routes:
#   api.goldshore.ai/*  (zone: goldshore.ai)

# goldshore-agent routes:
#   agent.goldshore.ai/*  (zone: goldshore.ai)

# goldshore-admin routes:
#   admin.goldshore.ai/*  (zone: goldshore.ai)
#   NOTE: CF Access application must be configured to protect this route

# banproof-me routes:
#   banproof.me/*  (zone: banproof.me)
#   www.banproof.me/*

# rmarston-com routes:
#   rmarston.com/*  (zone: rmarston.com)
#   www.rmarston.com/*

# armsway routes:
#   armsway.com/*  (zone: armsway.com)
#   www.armsway.com/*

# ══════════════════════════════════════════════════════════════
# CF ACCESS — SUBDOMAIN AUTH
# dash.cloudflare.com → Zero Trust → Access → Applications
# ══════════════════════════════════════════════════════════════

# admin.goldshore.ai (EXISTING — working)
#   Policy: Allow emails matching *@goldshore.ai OR specific addresses
#   Session duration: 24h recommended
#   Bypass: /health  (add bypass rule for health check)

# gw.goldshore.ai (internal — service binding used, not CF Access)
#   Auth: CLOUDFLARE_ACCESS_AUDIENCE + CF-Access-Jwt-Assertion header
#   Set CLOUDFLARE_ACCESS_AUDIENCE secret on goldshore-gateway worker

# api.goldshore.ai (semi-public — rate limited)
#   Auth: per-route (CONTROL_SYNC_TOKEN for internal routes, public for /health)
#   No CF Access on root — handled in worker code

# agent.goldshore.ai (internal — CF Access recommended)
#   Add CF Access application for agent.goldshore.ai
#   CLOUDFLARE_ACCESS_AUDIENCE secret already configured in wrangler

# ══════════════════════════════════════════════════════════════
# IMMEDIATE ACTIONS (in order)
# ══════════════════════════════════════════════════════════════

# 1. Add DNS CNAME: gw.goldshore.ai → goldshore-gateway worker
# 2. Add DNS CNAME: agent.goldshore.ai → goldshore-agent worker
# 3. Fix api.goldshore.ai worker route (currently 404)
#    → wrangler deploy --name goldshore-api (with routes in wrangler.jsonc)
# 4. Deploy rmarston-com with fixed wrangler.toml (routes now attached)
# 5. Deploy armsway with new medical theme
# 6. Verify CF Access on admin.goldshore.ai allows your email
#    → Zero Trust → Access → Applications → admin.goldshore.ai → Edit policy
