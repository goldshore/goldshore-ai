# Worker Configuration Guide

This document details the configuration for all Cloudflare Workers and Pages projects in the GoldShore monorepo.

## 1. gs-mail (`apps/mail-worker`)

The email routing and processing worker.

- **Directory:** `apps/mail-worker`
- **Package Name:** `gs-mail`
- **Wrangler:** `wrangler.toml` (locally defined)
- **Deployment:** Manual via Wrangler or CI.
- **Bindings:** None currently required.
- **Compatibility Date:** `2024-03-20`
- **Main Entry:** `src/index.ts`
- **Purpose:** Handles email routing logic, possibly integrated with Cloudflare Email Routing or third-party providers (e.g., MailChannels).
- **Status:** Repaired with inbound routing logic. Supports sender blocking, recipient allowlists, and forwarding to `MAIL_FORWARD_TO`.

## 2. gs-agent (`apps/gs-agent`)

The AI agent service.

- **Directory:** `apps/gs-agent`
- **Package Name:** `@goldshore/agent`
- **Wrangler:** `infra/cloudflare/gs-agent.wrangler.toml` (external config)
- **Deployment:** CI workflow (`deploy-agent.yml`).
- **Bindings:**
  - `AI`: Cloudflare Workers AI binding.
  - `Queues`: Consumes `goldshore-jobs` queue.
- **Compatibility Date:** `2024-03-20`
- **Main Entry:** `src/index.ts`
- **Purpose:** Handles AI inference tasks, job processing from queues, and agent interactions.

## 3. gs-gateway (`apps/gs-gateway`)

The API gateway and router.

- **Directory:** `apps/gs-gateway`
- **Package Name:** `@goldshore/gateway`
- **Wrangler:** `wrangler.toml` (locally defined)
- **Deployment:** CI workflow (`deploy-gateway.yml`).
- **Bindings:**
  - `KV Namespaces`: `gs-kv` (production), `GATEWAY_KV` (local/dev).
  - `Queues`: Produces to `gs-jobs`.
  - `Services`: `API` (points to `gs-api`).
  - `AI`: Cloudflare Workers AI binding.
  - `Vars`: `ENV` ("production"), `API_ORIGIN` ("https://api.goldshore.ai").
- **Compatibility Date:** inferred from project settings or `wrangler.toml`.
- **Main Entry:** `src/index.ts` (implied).
- **Purpose:** Primary entry point for API traffic, routing requests to `gs-api` or handling them directly (e.g., cached responses).

## 4. gs-control (`apps/gs-control`)

The operational control plane worker.

- **Directory:** `apps/gs-control`
- **Package Name:** `@goldshore/control`
- **Wrangler:** `wrangler.toml` (locally defined)
- **Deployment:** CI workflow (`deploy-control-worker.yml`).
- **Bindings:**
  - `KV Namespaces`: `CONTROL_LOGS`.
  - `R2 Buckets`: `STATE`.
  - `Services`: `API`, `GATEWAY`.
  - `Vars`: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (secrets).
- **Compatibility Date:** inferred.
- **Main Entry:** `src/index.ts`
- **Purpose:** Internal tool for managing Cloudflare resources, viewing logs, and performing administrative actions via Hono API.

## 5. gs-api (`apps/gs-api`)

The backend API service.

- **Directory:** `apps/gs-api`
- **Package Name:** `gs-api`
- **Wrangler:** `wrangler.toml` (locally defined) or `infra/cloudflare/goldshore-api.wrangler.toml`.
- **Deployment:** CI workflow (`deploy-api-worker.yml`).
- **Bindings:** likely similar to gateway (KV, D1, etc.).
- **Purpose:** Core business logic and data access layer.

## Deprecated

- `apps/goldshore-agent`: Removed. Legacy shim for `gs-agent`.
