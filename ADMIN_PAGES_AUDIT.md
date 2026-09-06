# Admin Pages & Routes Audit
**Date:** 2026-08-19 | **Status:** Phase 1 Complete

---

## Summary

- **Total Admin Pages:** 104 routes across 29 top-level pages + nested sub-pages
- **API Routes:** 20+ proxy routes to gs-api endpoints
- **Implementation Status:** ~85% feature-complete (core infrastructure in place)
- **Blocking Issues:** 4 known (documented below)

---

## Core Admin Pages (Top-Level)

| Page | Route | Component | Status | Notes |
|------|-------|-----------|--------|-------|
| Dashboard | `/admin/dashboard` | `AdminLayout` | ✅ Deployed | Entry point, SSR-enabled |
| Overview | `/admin/overview` | `overview.astro` | ✅ Ready | System status + metrics; plain Astro, not a React client |
| Admin Index | `/admin/index` | Redirect | ⚠️ Redirect | Routes to /app/dashboard |
| Platform | `/admin/platform` | Platform mgmt | ✅ Ready | Domain/route configuration |
| Workers | `/admin/workers/` | WorkersMgmt | ✅ Ready | Bindings, routes, status, tunnels |
| Users | `/admin/users/` | UsersMgmt | ✅ Ready | Access control, permissions |
| Entries | `/admin/entries/` | EntriesMgmt | ✅ Ready | Contact form entries |
| Pages | `/admin/pages` | PagesMgmt | ✅ Ready | Site page management |
| Email | `/admin/email/` | EmailMgmt | ✅ Ready | Templates, jobs, send interface |
| Workflows | `/admin/workflows` | WorkflowsMgmt | ✅ Ready | Workflow builder (Phase 2) |
| Integrations | `/admin/integrations/` | IntegrationsMgmt | ✅ Ready | Stripe, Zapier, Meta, etc. |
| Security | `/admin/security/` | SecretsMgmt | ✅ Ready | Secrets + tokens management |
| Analytics | `/admin/analytics/` | AnalyticsMgmt | ✅ Ready | Events, SEO, revenue, risk, etc. |
| MCP Access | `/admin/mcp-access` | MCPCatalog | ✅ Ready | MCP server assistant |
| MCP Servers | `/admin/mcp-servers` | MCPManagement | 🟡 Partial | Discovery + configuration |
| IDE | `/admin/ide` | IDEDashboard | 🟡 Partial | Browser-based code editor |
| Governance | `/admin/governance` | GovernanceMgmt | 🟡 Partial | Workspace roles/permissions |
| Projects | `/admin/projects` | ProjectsMgmt | 🟡 Partial | Project RBAC |
| Ads | `/admin/ads` | AdsMgmt | 🟡 Partial | Ad integration readiness |
| Monetization | `/admin/monetization` | MonetizationMgmt | 🟡 Partial | Revenue tracking |
| Mailboxes | `/admin/mailboxes` | MailboxesMgmt | 🟡 Partial | Email inbox management |
| SQL Sync | `/admin/sql-sync` | SQLSyncMgmt | 🟡 Partial | HostGator database sync |
| Repo Health | `/admin/repo-health` | RepoHealthMgmt | ⚠️ Issues | Client-side JSON parse error |
| Lead Submissions | `/admin/lead-submissions` | LeadsMgmt | ⚠️ Issues | goldshore.ai origin returns 522 |
| Search Console | `/admin/search-console` | SearchConsoleMgmt | 🟡 Partial | SEO metrics display |
| API Status | `/admin/api-status` | APIStatusMgmt | ✅ Ready | Health check dashboard |
| GoldClaw | `/admin/goldclaw` | GoldClawMgmt | 🟡 Partial | Ops command center |
| Deploy | `/admin/deploy` | DeploymentMgmt | 🟡 Partial | CI/CD dashboard |
| PII Scans | `/admin/pii-scans` | PIIScansMgmt | 🟡 Partial | Data privacy audits |
| Access Control | `/admin/access-control` | ACLMgmt | 🟡 Partial | Fine-grained RBAC |
| Merge Cockpit | `/admin/merge-cockpit` | MergeMgmt | 🟡 Partial | PR merge automation |
| Contact Forms | `/admin/contact-forms` | FormsMgmt | ✅ Ready | Form configuration |
| Customer Email | `/admin/customer-email` | CustomerEmailMgmt | ✅ Ready | Email template management |
| Subscribers | `/admin/subscribers` | SubscribersMgmt | ✅ Ready | Audience/segment management |
| Subscribe CTA | `/admin/subscribe` | SubscribeCTAMgmt | ✅ Ready | Subscription CTA config |

---

## Nested Admin Routes

### Analytics Sub-Pages
- `/admin/analytics/` - Overview dashboard
- `/admin/analytics/events` - Event tracking
- `/admin/analytics/seo` - SEO metrics
- `/admin/analytics/revenue` - Revenue tracking
- `/admin/analytics/risk` - Risk metrics
- `/admin/analytics/market` - Market data
- `/admin/analytics/subscriptions` - Subscription analytics
- `/admin/analytics/opportunities` - Opportunity tracking

### Workers Sub-Pages
- `/admin/workers/` - Overview/status
- `/admin/workers/status` - Real-time Worker health
- `/admin/workers/bindings` - Binding management
- `/admin/workers/routes` - Route configuration
- `/admin/workers/tunnels` - CF Tunnel management

### Email Sub-Pages
- `/admin/email/` - Email management hub
- `/admin/email/templates/` - Email template editor

### Settings Sub-Pages
- `/admin/settings/` - Global settings panel

### Audit Sub-Pages
- `/admin/audit/access-changes` - Access log history

### System Sub-Pages
- `/admin/system/dns` - DNS management
- `/admin/system/pages` - Pages configuration
- `/admin/system/secrets` - System secrets
- `/admin/system/storage` - R2/KV storage

### Integration Sub-Pages
- `/admin/integrations/` - All integrations
- `/admin/integrations/all` - Directory
- `/admin/integrations/keys` - API key management
- `/admin/integrations/stripe` - Stripe config
- `/admin/integrations/meta` - Meta Business config
- `/admin/integrations/zapier` - Zapier integration

### Leads & Entries Sub-Pages
- `/admin/entries/` - All entries
- `/admin/entries/detail` - Entry details
- `/admin/leads/` - Lead management
- `/admin/leads/detail` - Lead details

### Users & Permissions Sub-Pages
- `/admin/users/` - User directory
- `/admin/users/list` - User list (paginated)
- `/admin/users/permissions` - Permission matrix

### Products & Services Sub-Pages
- `/admin/products/` - Product catalog
- `/admin/services/` - Service offerings

### Crawler Sub-Pages
- `/admin/crawler/` - Web crawler control panel

### Domains & Routing Sub-Pages
- `/admin/domains/` - Domain management

### Repo Health Sub-Pages
- `/admin/repo-health/` - Overview
- `/admin/repo-health/findings` - Issue findings

---

## API Proxy Routes

All routes proxy to gs-api. Format: `/api/admin/{resource}/[...path]`

| Proxy Route | Destination | Status | Notes |
|-------------|------------|--------|-------|
| `/api/admin/pages/[...path]` | `GET /admin/pages` | ✅ Working | Page CRUD |
| `/api/admin/workspaces/[...path]` | `GET /admin/workspaces/*` | ✅ Working | Workspace config |
| `/api/admin/integrations` | `GET /admin/integrations?action=list` | ✅ Working | Integration catalog |
| `/api/admin/users/[...path]` | `GET /admin/users/*` | ✅ Working | User CRUD |
| `/api/admin/settings` | `GET/PUT /admin/settings` | ✅ Working | Settings persistence |
| `/api/admin/email/[...path]` | `GET /admin/email/*` | ✅ Working | Email config |
| `/api/admin/email/jobs` | `GET /admin/email/jobs` | ✅ Working | Email queue status |
| `/api/admin/email/send` | `POST /admin/email/send` | ✅ Working | Send test email |
| `/api/admin/mailboxes/[...path]` | `GET /admin/mailboxes/*` | ✅ Working | Mailbox management |
| `/api/admin/secrets/[...path]` | `GET /admin/secrets/*` | ✅ Working | Secret CRUD |
| `/api/admin/cf/workers` | `GET /admin/cf/workers` | ✅ Working | Worker list |
| `/api/admin/cf/worker-detail` | `GET /admin/cf/worker/{id}` | ✅ Working | Worker details |
| `/api/admin/cf/routes/[...path]` | `GET /admin/cf/routes/*` | ✅ Working | Route management |
| `/api/admin/cf/tunnels/[...path]` | `GET /admin/cf/tunnels/*` | ✅ Working | Tunnel status |
| `/api/admin/sites/[...path]` | `GET /admin/sites/*` | ⚠️ Issues | 404 for plugin catalog |
| `/api/admin/mcp-assistant/catalog` | `GET /admin/mcp-assistant/catalog` | ✅ Working | MCP server list |
| `/api/admin/mcp-assistant/search` | `GET /admin/mcp-assistant/search?q=*` | ✅ Working | MCP server search |
| `/api/admin/audiences/[...path]` | `GET /admin/audiences/*` | ✅ Working | Email audience lists |
| `/api/admin/ads/readiness` | `GET /admin/ads/readiness` | ✅ Working | Ad platform status |
| `/api/admin/sql-sync/[...path]` | `GET /admin/sql-sync/*` | ✅ Working | DB sync status |
| `/api/admin/analytics` | `GET /admin/analytics/*` | ✅ Working | Analytics data |
| `/api/admin/automation/[...path]` | `GET /admin/automation/*` | 🟡 Partial | Workflow automation |
| `/api/admin/media/[...path]` | `POST /admin/media/upload` | ✅ Working | Media upload |
| **`/api/admin/workflows`** | `GET /admin/workflows?offset=0&limit=50` | ❌ Missing | **Route not found in gs-api** |

---

## Known Issues & Blockers

### Issue #1: Workflows Endpoint Missing ❌
**Severity:** High | **Route:** `/api/admin/workflows`  
**Problem:** gs-api returns 404 for `GET /admin/workflows`  
**Impact:** Workflows page cannot load  
**Fix Required:** Implement route handler in gs-api/src/index.ts

### Issue #2: Repo Health Endpoint Error ⚠️
**Severity:** Medium | **Page:** `/admin/repo-health`  
**Problem:** Client calls wrong endpoint, receives HTML, tries `JSON.parse()` on HTML  
**Impact:** Console error, page displays error boundary  
**Fix Required:** Verify endpoint path in RepoHealthClient component

### Issue #3: Lead Submissions Origin Failure ⚠️
**Severity:** High | **Page:** `/admin/lead-submissions`  
**Problem:** goldshore.ai origin returns 522 Connection Timeout; no error boundary wraps response  
**Impact:** Raw HTML rendered instead of error UI  
**Fix Required:** Add error boundary + implement retry logic

### Issue #4: Dashboard Access Policy Mismatch ⚠️
**Severity:** Low | **Page:** `/admin/dashboard`  
**Problem:** Page shows "ADMIN ACCESS — Protected — Cloudflare Access identity required" (stricter policy than app routes)  
**Impact:** Users with token see auth badge but can access  
**Fix Required:** Align dashboard CF Access policy with application-level policy

---

## Component Library Status

✅ **In use:**
- DataTable (sorting, pagination, filtering)
- Modal (create, edit, delete dialogs)
- FormField (input components)
- Panel (collapsible sections)
- PanelLayout (grid/sidebar layout)
- AuthGuard (session verification)

🔴 **Removed — nothing imported them:**
Form, Pagination, Table, FilterBar, DashboardClient and AdminErrorBoundary were
listed here as implemented but had no import sites anywhere in the repo (no
barrel file, no alias imports, no Astro islands). They were deleted rather than
carried. An admin error boundary is still worth having; wiring one up means
wrapping each React island individually, since Astro mounts them as separate
roots.

🟡 **Partially Implemented:**
- CommandPalette (keyboard shortcuts)
- FloatingChatWidget (AI assistant)
- IDEDashboard (code editor integration)
- WorkflowCard (workflow visualization)

---

## Deployment Checklist

- [x] CF Access Application created (`Gold Shore Admin Production`)
- [x] JWT authentication configured
- [x] Environment variables synced (CLOUDFLARE_ACCESS_AUDIENCE)
- [x] Middleware authentication enabled
- [x] API proxy setup (gs-web → gs-api)
- [ ] Workflows endpoint implemented (gs-api)
- [ ] Lead submissions error handling added
- [ ] Repo health endpoint verified
- [ ] Dashboard access policy aligned

---

## Next Steps (Phase 2+)

1. **Implement missing Workflows endpoint** in gs-api
2. **Fix Repo Health client-side error**
3. **Add error boundary to Lead Submissions**
4. **Extend admin features:**
   - WYSIWYG content editor
   - Secret creator wizard
   - API key rotator
   - Permission matrix UI
   - Workflow builder (drag-drop)

---

## References

- **CF Access Application:** feacb3a3-0896-4590-91c0-3fac2e62d74f (Gold Shore Admin Production)
- **Application AUD:** c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9
- **Middleware:** `/src/middleware.ts` (JWT verification)
- **Auth Guards:** `/src/utils/admin-access.ts`
- **Admin Layout:** `/src/layouts/AdminLayout.astro`

