# GoldShore Integration Framework Guide

Complete guide to configuring and extending the GoldShore Admin integration suite with support for multiple LLM providers and business APIs.

## Table of Contents

1. [Overview](#overview)
2. [LLM Provider Configuration](#llm-provider-configuration)
3. [Integrations](#integrations)
4. [Setup Instructions](#setup-instructions)
5. [Extending the Framework](#extending-the-framework)

## Overview

The GoldShore Admin Dashboard provides a unified integration framework for connecting to:
- **LLM Providers**: Claude (Anthropic), OpenAI, openclaw (self-hosted), Local LLMs
- **Payment Processing**: Stripe
- **Marketing & Analytics**: Facebook Pixel, Google Ads, Google Search Console, Meta Business API
- **Communication**: WhatsApp Business API
- **Workflow Automation**: Zapier
- **Custom APIs**: Extensible custom integration for any REST API

### Architecture

All integrations extend `BaseIntegration` which provides:
- `authenticate()`: Verify API credentials
- `sync()`: Fetch and cache data
- `handleWebhook()`: Process incoming events
- `getStatus()`: Return current connection status
- `logEvent()`: Audit log for compliance

Integrations are managed centrally by `IntegrationRegistry` which handles:
- Provider lifecycle management
- KV storage persistence
- Batch operations (sync all, authenticate all)
- Dashboard metrics aggregation

## LLM Provider Configuration

### Environment Variables

Set one of these in your Cloudflare Workers environment:

```env
# Use Claude (Anthropic)
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...

# Use OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use openclaw (self-hosted)
LLM_PROVIDER=openclaw
OPENCLAW_API_KEY=your-api-key
OPENCLAW_BASE_URL=http://localhost:8000  # or your deployment URL

# Use local LLM
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:11434  # Ollama, etc.
```

### Swapping Providers at Runtime

The LLM abstraction layer in `apps/gs-web/src/lib/llm-abstraction.ts` handles provider selection:

```typescript
import { getLLMClient } from '@/lib/llm-abstraction';

const client = getLLMClient();
const response = await client.sendMessage('Your prompt here');
```

**No code changes needed** — just update environment variables.

### Openclaw Deployment

For complete business autonomy without corporate gatekeeping:

1. **Deploy openclaw locally or on your infrastructure**
   ```bash
   # Using Docker
   docker run -p 8000:8000 openclaw:latest
   ```

2. **Configure environment variables**
   ```env
   LLM_PROVIDER=openclaw
   OPENCLAW_BASE_URL=https://your-openclaw-domain.com
   OPENCLAW_API_KEY=your-secure-key
   ```

3. **All integrations automatically use openclaw** for AI-powered features

## Integrations

### Facebook Pixel & Conversions API

**Purpose**: Privacy-respecting server-side event tracking

**Setup**:
```env
FACEBOOK_PIXEL_ID=your-pixel-id
FACEBOOK_ACCESS_TOKEN=your-access-token
FACEBOOK_BUSINESS_ID=your-business-id
```

**Tracked Events**:
- Purchase
- AddToCart
- ViewContent
- Lead
- CompleteRegistration

**Privacy Features**:
- User data hashing (SHA-256)
- Server-side tracking (avoids ad blockers)
- GDPR compliant

### WhatsApp Business API

**Purpose**: Automated messaging and lead qualification

**Setup**:
```env
WHATSAPP_BUSINESS_ACCOUNT_ID=your-account-id
WHATSAPP_PHONE_NUMBER_ID=your-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_BUSINESS_API_URL=https://graph.instagram.com/v18.0
```

**Features**:
- Send templated messages
- Receive incoming messages via webhook
- Lead scoring and qualification
- Integration with leads collection system

### Google Ads

**Purpose**: Campaign management and performance tracking

**Setup**:
```env
GOOGLE_ADS_CUSTOMER_ID=your-customer-id
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Metrics**:
- Campaign status and budgets
- Impressions, clicks, conversions
- Cost per click (CPC)
- Return on ad spend (ROAS)

### Google Search Console

**Purpose**: SEO tracking, search rankings, indexing health

**Setup**:
```env
GOOGLE_GSC_SITE_URL=https://your-domain.com
GOOGLE_GSC_REFRESH_TOKEN=your-refresh-token
```

**Metrics**:
- Search rankings by position
- Click-through rate (CTR)
- Search queries performance
- Crawl issues and errors
- Indexing coverage

### Stripe Payments

**Purpose**: Revenue tracking and payment metrics

**Setup**:
```env
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Metrics**:
- Total revenue
- Successful/failed charges
- Refund tracking
- Average order value (AOV)
- Customer count

### Zapier Automation

**Purpose**: Connect 7000+ apps with automated workflows

**Setup**:
```env
ZAPIER_API_KEY=your-api-key
ZAPIER_WEBHOOK_URL=your-webhook-url
```

**Features**:
- Monitor active Zaps
- Track task execution history
- Receive webhook events

### Custom Integration

**Purpose**: Connect any REST API

**Configuration**:
1. Navigate to Integrations Hub
2. Click "Add Integration"
3. Select "Custom Integration"
4. Provide API URL and authentication key
5. Register endpoints dynamically

**Example**:
```typescript
const custom = await registry.get('my-api');
const result = await custom.callEndpoint('GET', '/v1/data');
```

## Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/marzton/goldshore-ai
cd goldshore-ai
```

### 2. Install Dependencies

```bash
npm install
cd apps/gs-web
npm install
```

### 3. Configure Cloudflare Bindings

Edit `wrangler.toml`:

```toml
[env.production.vars]
LLM_PROVIDER = "openclaw"
OPENCLAW_BASE_URL = "https://your-openclaw.com"

[env.production.vars.d1_databases]
CONTENT_DB = "goldshore-content"

[[env.production.d1_databases]]
binding = "CONTENT_DB"
database_name = "goldshore-content"
database_id = "your-database-id"
```

### 4. Set Environment Variables

In Cloudflare Workers dashboard:

1. Go to Workers & Pages → goldshore-api → Settings → Environment Variables
2. Add variables for each integration you want to enable
3. Restart the worker

### 5. Deploy

```bash
npm run build
npm run deploy
```

## Extending the Framework

### Adding a New Integration

1. **Create integration class** (`src/lib/integrations/YourIntegration.ts`):

```typescript
import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export class YourIntegration extends BaseIntegration {
  async authenticate(): Promise<boolean> {
    // Verify API credentials
  }

  async sync(): Promise<Record<string, unknown>> {
    // Fetch and return data
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    // Process webhook event
  }
}
```

2. **Update IntegrationRegistry** (`src/lib/integrations/IntegrationRegistry.ts`):

```typescript
import { YourIntegration } from './YourIntegration';

// Add type
export type IntegrationType = '...' | 'your_integration';

// Add definition
const INTEGRATION_DEFINITIONS = {
  your_integration: {
    id: 'your_integration',
    name: 'Your Integration',
    type: 'your_integration',
    description: 'Description of your integration',
    requiredFields: ['apiKey', 'otherField'],
  },
};

// Add case in createIntegration()
case 'your_integration':
  integration = new YourIntegration(config);
  break;
```

3. **Create dashboard page** (`src/pages/integrations/yourintegration.astro`):

Use existing integrations as templates (Stripe, Zapier, etc.)

4. **Add API endpoint** if needed (`src/pages/api/integrations/yourinteg.ts`)

### Testing

```bash
# Test locally
npm run dev

# Navigate to http://localhost:3000/admin/integrations/all

# Test specific integration
curl http://localhost:3000/api/integrations/manage?action=list
```

## Troubleshooting

### Integration shows "Disconnected"

1. Check environment variables are set
2. Verify API credentials are correct
3. Check API rate limits haven't been exceeded
4. Review server logs in Cloudflare Workers dashboard

### Stack trace errors in responses

Error responses are intentionally generic for security:
- Check server logs for detailed errors
- Use Cloudflare Workers dashboard for debugging
- Errors are logged server-side with full stack traces

### Webhook not received

1. Verify webhook URL is publicly accessible
2. Check firewall/CORS settings
3. Confirm provider is sending to correct endpoint
4. Review webhook logs in provider's dashboard

## Security Considerations

✅ **Implemented**:
- OAuth 2.0 token refresh
- API key encryption in transit
- No stack trace exposure to clients
- Audit logging of all integration events
- KV storage with TTL expiration

⚠️ **To Implement**:
- Rate limiting per integration
- Webhook signature verification
- IP whitelisting for webhooks
- Encryption at rest for stored tokens

## Support

For issues or questions:
1. Check this guide for your integration
2. Review integration test files
3. Check provider API documentation
4. Open an issue with logs and details

---

**Last Updated**: 2026-07-02  
**Framework Version**: 2.0 (Multi-LLM, Extensible)
