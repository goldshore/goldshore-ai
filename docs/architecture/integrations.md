# Integrations Governance Controls

This document defines the governance controls required before enabling new external integrations
(such as ThinkorSwim). These controls are enforced in the gateway layer for all integration
requests (paths beginning with `/integrations` or `/market-streams`).

## Data Handling Classification

Each integration request must declare the sensitivity of the data being exchanged. The gateway
requires the `X-Data-Classification` header and rejects requests that do not comply.

**Allowed values**

- `public`: Non-sensitive information intended for general consumption.
- `internal`: Operational information restricted to GoldShore staff and systems.
- `confidential`: Customer, trading, or partner data that must be protected.
- `restricted`: Highly sensitive secrets or regulated data that requires strict controls.

**Required header**

- `X-Data-Classification`: One of the allowed values above.

## Secrets Access Policy

Integration requests must declare the level of secrets access required for the operation. The
`X-Secrets-Access-Policy` header is mandatory and must match one of the allowed values.

**Allowed values**

- `none`: No secrets are accessed.
- `read-only`: Secrets are read but not modified.
- `read-write`: Secrets are read and updated/rotated.
- `broker-credentials`: Broker or exchange credentials are accessed.
- `market-data`: Credentials or tokens used solely for market data access.

**Required header**

- `X-Secrets-Access-Policy`: One of the allowed values above.

## Audit Log Trail

Every integration request must include a unique audit identifier so that calls can be traced end-to-end.
The gateway requires the `X-Audit-Trace-Id` header and records a structured audit log
entry to the gateway audit store.

**Audit log fields captured**

- Trace ID
- Data classification
- Secrets access policy
- Request method and path
- Timestamp
- Cloudflare ray ID (when available)
- Actor email (when available)

**Required header**

- `X-Audit-Trace-Id`: A client-generated unique identifier (UUID preferred).

## Gateway Enforcement

The gateway rejects integration requests if any control is missing or invalid. Ensure that client
applications provide the required headers before requesting access to integration endpoints.
# Integrations Hub

This hub documents external integrations used by GoldShore services and the admin cockpit. The canonical configuration list for the admin UI lives in `apps/gs-admin/src/lib/integrations.ts`.

## Integration Catalog

### Cloudflare API (Zones, Workers, Access, DNS)

| Field | Details |
| --- | --- |
| Base URL | `https://api.cloudflare.com/client/v4` |
| Auth method | API token (bearer) |
| Scopes | `Zone:Read`, `Zone:Edit`, `Workers:Read`, `Workers:Edit`, `Access:Read`, `Access:Edit`, `DNS:Read`, `DNS:Edit` |
| Rate limits | Global API limit (typically 1,200 requests / 5 min / user; endpoint-specific caps apply). |
| Data classification | Confidential (infrastructure metadata, DNS records, access policies). |

### Google APIs

| Field | Details |
| --- | --- |
| Base URL | `https://www.googleapis.com` |
| Auth method | OAuth 2.0 (user or service account) or API key for public endpoints |
| Scopes | `https://www.googleapis.com/auth/cloud-platform`, `https://www.googleapis.com/auth/userinfo.email` |
| Rate limits | Project- and API-specific quotas (varies by API; enforced in Google Cloud Console). |
| Data classification | Confidential (workspace, project, and identity metadata). |

### Google Gemini API

| Field | Details |
| --- | --- |
| Base URL | `https://generativelanguage.googleapis.com` |
| Auth method | API key (Google AI Studio) or OAuth 2.0 (Vertex AI) |
| Scopes | `https://www.googleapis.com/auth/cloud-platform` (Vertex AI) |
| Rate limits | Model- and project-specific quotas (see Google AI Studio or Vertex AI quotas). |
| Data classification | Confidential (prompt and completion content). |

### ThinkorSwim API

| Field | Details |
| --- | --- |
| Base URL | `https://api.tdameritrade.com/v1` |
| Auth method | OAuth 2.0 (authorization code + refresh token) |
| Scopes | `Account:Read`, `Account:Trade`, `MarketData:Read` |
| Rate limits | Typically ~120 requests/minute per user; subject to broker throttling. |
| Data classification | Restricted (brokerage credentials, account and trading data). |

### OpenAI / ChatGPT API

| Field | Details |
| --- | --- |
| Base URL | `https://api.openai.com/v1` |
| Auth method | API key (bearer) |
| Scopes | Project API key (model access scoped by project) |
| Rate limits | Per-model and per-project rate limits (configured in OpenAI dashboard). |
| Data classification | Confidential (prompt, completion, and usage telemetry). |

### Jules API

| Field | Details |
| --- | --- |
| Base URL | `https://api.goldshore.ai/jules` |
| Auth method | OAuth 2.0 (internal service-to-service tokens) |
| Scopes | `jules:read`, `jules:write`, `automation:run` |
| Rate limits | Internal gateway limits (align with automation workload SLOs). |
| Data classification | Confidential (automation runs, internal workflows, and task metadata). |
