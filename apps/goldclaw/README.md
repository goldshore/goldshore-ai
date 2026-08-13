# Goldclaw: Autonomous Integration Intelligence Agent

Goldclaw is an autonomous agent for GoldShore that monitors, analyzes, and manages third-party integrations. It provides intelligent recommendations and handles approval-gated operations through WhatsApp and the admin UI.

## Features

### Autonomous Mode (Read-Only)
- **Integration Health Checks** — Monitor error rates, uptime, API quota usage
- **Cost Analysis** — Estimate monthly costs per integration using Google APIs
- **Cost Anomaly Detection** — Identify cost spikes, trends, and outliers with savings estimates
- **Token Expiry Monitoring** — Track OAuth tokens expiring within 30 days
- **Audit Trail Analysis** — Identify patterns and anomalies in operation logs
- **Incident Response** — Diagnose API failures and suggest remediation

### Approval-Gated Mode (Write Operations)
- **Enhanced Risk Assessment** — LLM-based risk analysis with fallback to local rules engine
- **Token Rotation** — Queue OAuth token rotations with LLM reasoning and cost context
- **Key Rotation** — Request admin approval for credential rotation
- **Integration Control** — Enable/disable integrations via WhatsApp approval
- **Cost Optimization** — Recommend provider alternatives and usage optimizations

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
│       ├── approval.ts          # Approval-gated operations with LLM
│       └── cost-optimization.ts # Cost anomaly detection & analysis
├── Dockerfile
├── docker-compose.yml
└── package.json

gs-api/
└── src/lib/llm-providers/
    └── openclaw.ts              # LLM provider integrations (OpenClaw, Claude, local rules)
```

## Phase 5b: Enhanced Nanny Mode with LLM Analysis

**LLM Integration**: Goldclaw integrates with OpenClaw (primary) → Claude (fallback) → Local rules engine for intelligent risk analysis.

**Risk Assessment Flow**:
1. Command parsed and historical context loaded (error count, uptime, rotation history)
2. LLM analyzes context: "Low error rate + 99.9% uptime → low ✅"
3. Cost impact calculated: "High-value integration ($2000/mo) → extra caution"
4. Recommendation generated: "Safe to proceed immediately" or "Monitor for 24h post-rotation"
5. WhatsApp message queued with full reasoning and cost savings estimates
6. Admin reacts ✅ or ❌; outcome logged with LLM confidence score

**Cost Optimization** (Phase 5b):
- Detects cost spikes (>50% day-over-day) and trends (>20% week-over-week)
- Flags outliers and provides estimated savings (e.g., "$150/mo if optimized")
- Suggests provider alternatives and consolidation opportunities

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

## Phase Implementation Status

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| 5a | Goldclaw foundation | ✅ Complete | Autonomous + approval-gated tools, WhatsApp integration |
| 5b | LLM risk analysis | 🚀 In Progress | OpenClaw/Claude providers, cost optimization, enhanced approvals |
| 5c | Reporting & MCP | 📋 Planned | Dashboard reports, Claude desktop MCP server |
| 6 | AI screen guidance | 📋 Future | Browser capture for guided setup, service offering |

## Future Enhancements (Phase 5c+)

- **Phase 5c**: Advanced cost optimization dashboard, optional MCP server for Claude desktop
- **Phase 6**: AI screen view/guidance for integration setup ("Integration Setup as a Service")
- **Post-Phase 6**: Service offering at $250-500/setup, estimated $500K/year revenue
