# Goldclaw: Autonomous Integration Intelligence Agent

Goldclaw is an autonomous agent for GoldShore that monitors, analyzes, and manages third-party integrations. It provides intelligent recommendations and handles approval-gated operations through WhatsApp and the admin UI.

## Features

### Autonomous Mode (Read-Only)
- **Integration Health Checks** — Monitor error rates, uptime, API quota usage
- **Cost Analysis** — Estimate monthly costs per integration using Google APIs
- **Token Expiry Monitoring** — Track OAuth tokens expiring within 30 days
- **Audit Trail Analysis** — Identify patterns and anomalies in operation logs
- **Incident Response** — Diagnose API failures and suggest remediation

### Approval-Gated Mode (Write Operations)
- **Token Rotation** — Queue OAuth token rotations with risk assessment
- **Key Rotation** — Request admin approval for credential rotation
- **Integration Control** — Enable/disable integrations via WhatsApp approval

## Scheduled Jobs

- **Hourly**: Integration health checks (error count, uptime, quota)
- **Twice Daily**: OAuth token expiry scans
- **Daily**: Cost reports (total and by provider)
- **Weekly**: Audit trail pattern analysis

## Architecture

```
goldclaw/
├── src/
│   ├── agent.ts                 # Main orchestrator, job scheduler
│   ├── lib/
│   │   ├── goldshore-client.ts  # gs-api HTTP client
│   │   └── google-apis.ts       # Google Analytics/Ads clients
│   └── tools/
│       ├── health.ts            # Autonomous diagnostic tools
│       └── approval.ts          # Approval-gated operations (TODO)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Environment Variables

```bash
GOLDSHORE_API_URL=https://api.goldshore.ai
GOLDSHORE_API_TOKEN=<service-account-bearer-token>
GOOGLE_SERVICE_ACCOUNT=<json-key>
GOOGLE_ADS_DEVELOPER_TOKEN=<token>
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run development mode
pnpm run dev

# Docker
pnpm run docker:build
pnpm run docker:run
```

## API Integration

Goldclaw communicates with gs-api via authenticated HTTP:

### Get Integrations
```bash
GET /integrations?action=list
Authorization: Bearer <token>
```

### Get Secrets
```bash
GET /integrations/keys?integration_id=<id>
Authorization: Bearer <token>
```

### Rotate Secret
```bash
PATCH /integrations/keys/<secretId>
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "rotate",
  "value": "<new-key>"
}
```

### Queue Approval
```bash
POST /integrations/whatsapp/commands
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "rotate-stripe",
  "metadata": { "secret_id": "...", "risk_level": "low" },
  "approval_method": "whatsapp_reaction",
  "message": "🔑 Stripe key rotation — Risk: low ✅"
}
```

### Log Admin Action
```bash
POST /admin/actions/log
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "goldclaw.health_alert",
  "status": "critical",
  "metadata": { "integration_id": "...", "error_count": 5 }
}
```

## Monitoring

Goldclaw logs all operations to stdout with timestamps and severity levels:

```
[HealthCheck] Starting integration health checks...
[HealthCheck] stripe: healthy
[CostReport] Total estimated monthly cost: $1,234.56
[TokenScan] Token expires in 5 days
[Scheduler] Running token-expiry-scan...
```

Logs are forwarded to the admin dashboard via audit trail.

## Security

- Bearer token authentication with gs-api
- No credentials stored locally (fetched from SECRETS store)
- Google service account key encrypted at rest
- All operations logged for forensic analysis

## Future Enhancements

- Phase 5b: Enhanced nanny mode with OpenClaw LLM analysis
- Phase 5c: Cost optimization recommendations
- Optional MCP server for Claude desktop integration
