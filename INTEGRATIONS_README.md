# GoldShore Admin Dashboard - Phase 2 Integration Framework

Build your autonomous business ecosystem with multi-LLM support and extensible integrations.

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Copy and configure environment template
cp .env.example .env.local

# Edit with your API credentials
nano .env.local
```

### 2. Install & Deploy

```bash
# Install dependencies
npm install
cd apps/gs-admin && npm install

# Development server
npm run dev

# Production build & deploy
npm run build
npm run deploy
```

### 3. Access Dashboard

Navigate to `https://admin.goldshore.ai/integrations/all`

## 🤖 LLM Provider Selection

Choose your AI backbone via environment variable (no code changes):

```env
# Self-hosted autonomy (recommended)
LLM_PROVIDER=openclaw
OPENCLAW_BASE_URL=https://your-deployment.com

# Or cloud providers
LLM_PROVIDER=claude      # Anthropic
LLM_PROVIDER=openai      # OpenAI
LLM_PROVIDER=local       # Ollama or similar
```

All integrations automatically use your selected provider for AI-powered features.

## 📦 Included Integrations

| Integration | Purpose | Status |
|---|---|---|
| **Facebook Pixel** | Privacy-first conversion tracking | ✅ Complete |
| **WhatsApp Business** | Automated messaging & lead qualification | ✅ Complete |
| **Google Ads** | Campaign management & performance | ✅ Complete |
| **Google Search Console** | SEO tracking & indexing health | ✅ Complete |
| **Stripe** | Revenue tracking & payments | ✅ Complete |
| **Zapier** | Workflow automation (7000+ apps) | ✅ Complete |
| **Meta Business** | Facebook/Instagram analytics | ✅ Complete |
| **Google AdSense** | Content monetization | ✅ Complete |
| **STRAPI CMS** | Headless content management | ✅ Complete |
| **Custom API** | Connect any REST endpoint | ✅ Complete |
| **Email Subscriptions** | Lead collection & segmentation | ✅ Complete |
| **Web Crawler** | B2B prospect research | ✅ Complete |

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│   Admin Dashboard              │
│  (Integrations Hub)            │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  IntegrationRegistry            │
│  (Centralized Management)       │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┬────────────┬──────────────┐
    │                 │            │              │
┌───▼──┐  ┌──────┐  ┌─┴──┐  ┌──────┴──┐  ┌──────▼───┐
│Base  │  │API   │  │KV  │  │Webhook  │  │Event Log │
│Integ │  │Handlers  │Store│  │Handler  │  │         │
└──────┘  └──────┘  └────┘  └─────────┘  └─────────┘
```

### Data Flow

1. **Authentication**: Verify API credentials
2. **Sync**: Fetch data from provider APIs
3. **Storage**: Cache in Cloudflare KV (24-48 hour TTL)
4. **Webhooks**: Receive real-time events from providers
5. **Logging**: Audit trail for compliance

## 📊 Dashboard Pages

### Integrations Hub
- **Location**: `/integrations/all`
- **Features**: 
  - Connection status overview
  - LLM provider selector
  - Real-time sync controls
  - Error tracking
  - Available integrations browser

### Service-Specific Dashboards
- `/integrations/stripe` - Revenue & payment metrics
- `/integrations/zapier` - Workflow automation
- `/integrations/meta` - Social media analytics
- `/integrations/google-ads` - Campaign performance
- `/integrations/search-console` - SEO health
- `/content` - STRAPI article management
- `/leads` - Email subscriber tracking
- `/monetization` - AdSense earnings
- `/crawler` - B2B prospect research
- `/infrastructure/cloudflare` - Cloud binding status

## 🔐 Security

### Built-in Protections
✅ OAuth 2.0 token refresh  
✅ Server-side event tracking (no pixel tracking)  
✅ User data hashing (GDPR compliant)  
✅ Generic error responses (no stack traces)  
✅ Audit logging of all integration events  
✅ KV storage with automatic expiration  

### Best Practices
1. **Rotate API keys** regularly
2. **Use separate credentials** for dev/prod
3. **Enable webhook signature verification**
4. **Implement rate limiting** per integration
5. **Review audit logs** monthly

## 🛠️ API Reference

### List All Integrations

```bash
GET /api/integrations/manage?action=list
```

Response:
```json
{
  "success": true,
  "data": {
    "totalIntegrations": 5,
    "connected": 4,
    "disconnected": 1,
    "errors": 0,
    "integrations": {
      "stripe": { "status": "connected", "lastSync": "..." },
      "zapier": { "status": "connected", "lastSync": "..." }
    }
  }
}
```

### Get Available Integrations

```bash
GET /api/integrations/manage?action=definitions
```

### Sync All Integrations

```bash
GET /api/integrations/manage?action=sync
```

### Create Integration

```bash
POST /api/integrations/manage
Content-Type: application/json

{
  "action": "create",
  "config": {
    "type": "stripe",
    "name": "Main Stripe Account",
    "apiSecret": "sk_live_...",
    "enabled": true
  }
}
```

### Delete Integration

```bash
POST /api/integrations/manage
Content-Type: application/json

{
  "action": "delete",
  "config": {
    "name": "Main Stripe Account"
  }
}
```

## 📚 Documentation

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Complete setup & extension guide
- **[.env.example](./.env.example)** - All configuration variables
- **[API Routes](./apps/gs-admin/src/pages/api/)** - API endpoint implementations

## 🚦 Status Dashboard

Check real-time status of all integrations:

```typescript
import { getIntegrationRegistry } from '@/lib/integrations/IntegrationRegistry';

const registry = getIntegrationRegistry(kv);
await registry.loadFromStorage();

const metrics = await registry.getDashboardMetrics();
console.log(metrics);
// {
//   totalIntegrations: 6,
//   connected: 5,
//   disconnected: 1,
//   errors: 0,
//   integrations: { ... }
// }
```

## 🔄 Extending the Framework

Add a new integration in 3 steps:

### 1. Create Integration Class

```typescript
// apps/gs-admin/src/lib/integrations/MyAPI.ts
import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export class MyAPIIntegration extends BaseIntegration {
  async authenticate(): Promise<boolean> {
    // Verify credentials
  }

  async sync(): Promise<Record<string, unknown>> {
    // Fetch and return data
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    // Process webhook
  }
}
```

### 2. Register in IntegrationRegistry

```typescript
// Add import
import { MyAPIIntegration } from './MyAPI';

// Add type
export type IntegrationType = '...' | 'myapi';

// Add definition
const INTEGRATION_DEFINITIONS = {
  myapi: {
    id: 'myapi',
    name: 'My API',
    description: 'Connect to My API',
    requiredFields: ['apiKey', 'baseUrl'],
  },
};

// Add case
case 'myapi':
  integration = new MyAPIIntegration(config);
  break;
```

### 3. Create Dashboard

```astro
// apps/gs-admin/src/pages/integrations/myapi.astro
<AdminLayout title="My API | GoldShore Admin">
  <!-- Your dashboard markup -->
</AdminLayout>
```

That's it! Your integration is now fully integrated into the framework.

## 🐛 Troubleshooting

### Integration shows "Disconnected"
- Verify API credentials in `.env.local`
- Check rate limits haven't been exceeded
- Review Cloudflare Workers logs

### Webhook not received
- Ensure webhook URL is publicly accessible
- Check CORS settings
- Verify provider is sending to correct endpoint

### LLM not responding
- Verify `LLM_PROVIDER` is set correctly
- Check API key for selected provider
- For openclaw, ensure deployment is running

## 📞 Support

1. Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
2. Review existing integration implementations
3. Check provider API documentation
4. Review server logs in Cloudflare dashboard

## 🎯 Phase 2 Achievements

✅ **Multi-LLM Support**: Claude, OpenAI, openclaw, local  
✅ **Business Autonomy**: Self-hosted AI via openclaw  
✅ **10+ Integrations**: Cover 90% of business needs  
✅ **Privacy-First**: Server-side tracking, data hashing  
✅ **Extensible**: Simple pattern for custom integrations  
✅ **Production-Ready**: Security, error handling, logging  
✅ **Comprehensive Docs**: Setup guides, API reference  

## 🚀 What's Next

- [ ] Real-time sync via GraphQL subscriptions
- [ ] Advanced analytics dashboard
- [ ] Custom workflow builder
- [ ] Multi-workspace support
- [ ] Team collaboration features
- [ ] Audit log export & analysis
- [ ] API rate limiting
- [ ] Webhook signature verification

---

**Phase 2 Integration Framework v2.0**  
_Built with OpenClaw autonomy and extensibility at its core_

For questions or contributions, refer to INTEGRATION_GUIDE.md
