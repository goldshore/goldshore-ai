# Worker Configuration Guide

This document details the configuration for all Cloudflare Workers and Pages projects in the GoldShore monorepo.

## 1. gs-mail (`apps/gs-mail`)

The email routing and processing worker.

- **Directory:** `apps/gs-mail`
- **Package Name:** `gs-mail`
- **Wrangler:** `apps/gs-mail/wrangler.toml`
- **Deployment:** CI workflow (`.github/workflows/deploy-gs-mail.yml`) on `push` to `main`.
- **Bindings:** `GS_CONFIG` KV plus production email vars in `env.prod` / `env.production`.
- **Compatibility Date:** `2024-11-01`
- **Main Entry:** `src/index.ts`
- **Purpose:** Handles email routing logic, including sender blocking, optional recipient allowlists, and fail-closed forwarding via `MAIL_FORWARD_TO`.

## 2. gs-agent (`apps/gs-agent`)

The AI agent service.

- **Directory:** `apps/gs-agent`
- **Package Name:** `@goldshore/agent`
- **Wrangler:** `infra/Cloudflare/gs-agent.wrangler.toml`
- **Deployment:** Preview CI workflow (`.github/workflows/preview-gs-agent.yml`) on `pull_request`; production CI workflow (`.github/workflows/deploy-gs-agent.yml`) on `push` to `main`.
- **Bindings:**
  - `AI`: Cloudflare Workers AI binding.
  - `Queues`: Consumes `goldshore-jobs` queue.
- **Compatibility Date:** `2024-11-01`
- **Main Entry:** `src/index.ts`
- **Purpose:** Handles AI inference tasks, job processing from queues, and agent interactions.

## 3. gs-gateway (`apps/gs-gateway`)

The API gateway and router.

- **Directory:** `apps/gs-gateway`
- **Package Name:** `@goldshore/gateway`
- **Wrangler:** `apps/gs-gateway/wrangler.toml`
- **Deployment:** Preview CI workflow (`.github/workflows/preview-gs-gateway.yml`) on `pull_request`; production CI workflow (`.github/workflows/deploy-gs-gateway.yml`) on `push` to `main`.
- **Bindings:**
  - `KV Namespaces`: `GATEWAY_KV`.
  - `Queues`: Produces to `goldshore-jobs`.
  - `Services`: `API` (points to `gs-api`) and `AGENT` (points to `gs-agent`).
  - `AI`: Cloudflare Workers AI binding.
  - `Vars`: `ENV`, `API_ORIGIN`, `CLOUDFLARE_ACCESS_AUDIENCE`, `CLOUDFLARE_TEAM_DOMAIN`.
- **Compatibility Date:** `2024-11-01`
- **Main Entry:** `src/index.ts`
- **Purpose:** Primary entry point for API traffic, routing requests to `gs-api` or `gs-agent`, and enforcing gateway middleware.

## 4. gs-control (`apps/gs-control`)

The operational control plane worker.

- **Directory:** `apps/gs-control`
- **Package Name:** `@goldshore/control`
- **Wrangler:** `apps/gs-control/wrangler.toml`
- **Deployment:** Production CI workflow (`.github/workflows/deploy-gs-control.yml`) on `push` to `main`.
- **Bindings:**
  - `KV Namespaces`: `CONTROL_LOGS`, `GS_CONFIG`.
  - `R2 Buckets`: `STATE`.
  - `Services`: `API`, `GATEWAY`.
  - `Vars`: `ENV`, `CONTROL_SYNC_TOKEN`, `SYNC_TARGET_SUBDOMAIN`, plus Cloudflare admin secrets.
- **Compatibility Date:** `2024-11-01`
- **Main Entry:** `src/index.ts`
- **Purpose:** Internal tool for managing Cloudflare resources, viewing logs, and performing administrative actions via Hono API.

## 5. gs-api (`apps/gs-api`)

The backend API service.

- **Directory:** `apps/gs-api`
- **Package Name:** `gs-api`
- **Wrangler:** `apps/gs-api/wrangler.toml`
- **Deployment:** Preview CI workflow (`.github/workflows/preview-gs-api.yml`) on `pull_request`; production CI workflow (`.github/workflows/deploy-gs-api.yml`) on `push` to `main`.
- **Bindings:** KV, D1, R2, AI, and control-log bindings declared in `env.preview`, `env.prod`, and `env.production`.
- **Purpose:** Core business logic and data access layer.

## Deprecated

- `apps/goldshore-agent`: Removed. Legacy shim for `gs-agent`.
