# Admin Dashboard Infrastructure

## Overview

The GoldShore admin dashboard provides operators with centralized control over platform configuration, monitoring, and governance. It's hosted at `admin.goldshore.ai` and `admin.goldshore.org`, served by the `gs-web-prod` Worker with API calls proxied to `gs-api-prod`.

## Access Control

### Architecture

The admin dashboard uses three layers of authentication and authorization:

1. **Edge Authentication** - Cloudflare Access provides identity verification
2. **Application Admission** - `gs-web` verifies the Access signature, issuer,
   audience, email verification state, and explicit owner allowlist
3. **Durable Authorization** - `gs-api` resolves the same identity through D1
   before permission checks are applied

### Authentication Flow

```
User → Cloudflare Access (Google or GitHub identity)
     → gs-web audience + owner-email verification
     → gs-api D1 role lookup
     → Permission Check (feature authorization)
```

The bootstrap owners are `marstonr6@gmail.com` and `admin@goldshore.org`.
Both are assigned the `owner` role for the production and preview admin/API
applications. No other Access identity is promoted merely because it has a
valid token.

### Cloudflare dashboard requirements

Configure the Access applications in the Cloudflare dashboard only. Do not add
an API reconciliation or hidden Wrangler policy mutation:

1. Protect `admin.goldshore.ai/*` and `admin.goldshore.org/*` with the same
   production self-hosted Access application whose audience is configured on
   `gs-web`.
2. Add an Allow policy containing only `marstonr6@gmail.com` and
   `admin@goldshore.org` through the configured Google and GitHub IdPs.
3. In each `gs-web` production and preview dashboard environment, set the
   visible `ADMIN_OWNER_EMAILS` variable to
   `marstonr6@gmail.com,admin@goldshore.org`. Do not put it in Wrangler files.
   The application returns 503 when the variable is absent.
4. Add a final Deny Everyone policy. Do not use `non_identity`, Everyone, or an
   email-domain selector in the owner policy.
5. Test both accounts in a private browser session and confirm a third account
   is denied.
6. Test `/logout`; it must reach the application-domain
   `/cdn-cgi/access/logout` endpoint before a new login is accepted.

### Role Hierarchy

Admin roles and their permissions are defined in the `@goldshore/auth` package:

- **owner** - Full platform control; bootstrapped only for the two named owners
- **admin** - Day-to-day administration with high-risk actions excluded
- **editor** - Content and operational editing
- **viewer** - Read-only dashboard access

Google Workspace compatibility aliases such as `operator`, `developer`,
`auditor`, and `analyst` are normalized during sync; they are not stored roles.

## Admin Hosts

The following hostnames route to the admin dashboard:

| Hostname | Purpose | Environment |
|----------|---------|-------------|
| `admin.goldshore.ai` | Production admin UI | Production |
| `admin.goldshore.org` | Production admin UI (international) | Production |
| `admin-preview.goldshore.ai` | Preview admin UI | Preview |

## Page Structure

### Governance Section
- `/admin/overview` - Dashboard and metrics
- `/admin/users` - User and role management
- `/admin/users/permissions` - Permission configuration
- `/admin/repo-health` - Repository health monitoring
- `/admin/governance` - Governance policies and rules
- `/admin/projects` - Project management
- `/admin/mcp-access` - MCP resource access control

### Operations Section
- `/admin/platform` - Control plane dashboard
- `/admin/workflows` - API workflow definitions
- `/admin/customer-email` - Customer communication templates
- `/admin/subscribe` - Subscription CTA management
- `/admin/contact-forms` - Form submission handling
- `/admin/pages` - Custom page management

### System Management
- `/admin/system/dns` - DNS records and zones
- `/admin/system/secrets` - Encrypted secrets storage
- `/admin/system/storage` - R2 bucket management
- `/admin/system/pages` - Cloudflare Pages configuration

### Integration & Monetization
- `/admin/integrations/all` - Available integrations
- `/admin/integrations/keys` - API keys and credentials
- `/admin/goldclaw` - GoldClaw (advertiser platform) integration
- `/admin/monetization` - Revenue tracking (AdSense, etc.)
- `/admin/search-console` - Google Search Console data
- `/admin/lead-submissions` - Lead form submissions
- `/admin/subscribers` - Newsletter subscribers

### Worker Management
- `/admin/workers/status` - Worker deployment status
- `/admin/workers/bindings` - KV, D1, R2 bindings
- `/admin/workers/routes` - Cloudflare route configuration
- `/admin/deploy` - Deployment tools and logs
- `/admin/api-status` - API health status
- `/admin/crawler` - Web crawler configuration

## API Endpoints

All admin API endpoints require admin authentication and appropriate permissions:

### Admin System APIs
- `POST /api/admin/settings` - Update admin settings
- `GET /api/admin/settings` - Fetch admin settings
- `GET /api/admin/products` - List products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product

### Admin Forms APIs
- `GET /api/admin/forms` - List forms
- `POST /api/admin/forms` - Create form
- `GET /api/forms/:formId/submissions` - Get submissions

### Admin Cloudflare APIs
- `GET /api/admin/cf/workers` - List deployed workers
- `GET /api/admin/cf/worker-detail/:workerName` - Worker details
- `GET /api/admin/cf/routes` - List route configurations
- `POST /api/admin/cf/routes` - Create route
- `PUT /api/admin/cf/routes/:routeId` - Update route
- `DELETE /api/admin/cf/routes/:routeId` - Delete route

### Monetization APIs
- `GET /api/admin/monetization/adsense` - AdSense earnings
- `GET /api/admin/search-console` - Search Console metrics

## Permission Model

Permissions follow the pattern: `<resource>:<action>`

### Core Permissions
- `system:read` - Read system configuration
- `system:write` - Modify system configuration
- `audit:read` - Read audit logs
- `forms:read` - Read form submissions
- `forms:write` - Modify forms
- `cloudflare_inventory:read` - View Cloudflare resources
- `secret_metadata:read` - View secret metadata (not values)
- `users:read` - View user list
- `api_configuration:read` - View API configuration

## Configuration

### Environment Variables (wrangler.toml)

Admin configuration is set in `apps/gs-web/wrangler.toml`:

```toml
[vars]
# Admin hosts served by gs-web-prod
CLOUDFLARE_TEAM_DOMAIN = "goldshore.cloudflareaccess.com"
CLOUDFLARE_ACCESS_AUDIENCE = "9b97506a6f0d65a060dda7fa33aa66f6cee4112898fd45e5cf4da1d25db996c0"
CLOUDFLARE_ACCESS_APPLICATION = "admin-production"
```

### Admin Session Structure

Admin sessions carry:
- User identity and email
- Assigned roles (`owner`, `admin`, `editor`, or `viewer`)
- Resolved permissions from role definitions
- Session expiration timestamp

## Admin Entry Point

New admin pages should:

1. Use `AdminLayout` for consistent styling and authentication
2. Declare required permissions via layout props
3. Implement permission checks for conditional UI rendering
4. Redirect to login if session is invalid
5. Return 403 Forbidden if permissions are insufficient

Example admin page:

```astro
---
import AdminLayout from '../layouts/AdminLayout.astro';

// Check authentication in layout
const { redirect } = Astro;
if (!Astro.locals.adminSession?.isAuthenticated) {
  redirect('/login');
}
---

<AdminLayout title="My Admin Page" requiredPermission="system:read">
  <h1>Admin Page</h1>
  <p>This page requires system:read permission</p>
</AdminLayout>
```

## Security

### CORS & CSRF Protection
- Admin APIs validate Origin headers
- Admin forms include CSRF tokens
- Admin endpoints validate request signatures when needed

### Audit Logging
- All admin mutations are logged to AUDIT_DB
- Audit logs include timestamp, user, action, and resource
- Audit logs are immutable and retained for compliance

### Rate Limiting
- Admin APIs implement rate limiting per user
- Sensitive operations have lower rate limits
- DDoS protection via Cloudflare

## Monitoring & Logging

Admin dashboard activity is logged to:
- **AUDIT_DB** - Structured audit logs of admin actions
- **CONTROL_LOGS** (KV) - Session and access logs
- **Cloudflare Analytics** - Traffic and performance metrics

## Development

### Local Development

```bash
# Start gs-web dev server
pnpm --filter gs-web dev

# Visit admin dashboard
open http://localhost:3000/admin
```

### Adding a New Admin Page

1. Create page file: `apps/gs-web/src/pages/admin/mypage.astro`
2. Import AdminLayout and wrap content
3. Declare required permissions if applicable
4. Add navigation link to Sidebar if needed
5. Run tests to ensure permissions work correctly

### Testing Admin Pages

Admin pages require authentication. In development, set admin session locals:

```ts
Astro.locals.adminSession = {
  isAuthenticated: true,
  roles: ['admin'],
  permissions: [...],
};
```

## Troubleshooting

### "Admin access is misconfigured" Error
- Verify JWT_SECRET is set in wrangler.toml secrets
- Verify CLOUDFLARE_TEAM_DOMAIN is configured
- Check Cloudflare Access application is deployed

### "Missing required permission" Errors
- Check user's assigned role in database
- Verify role has required permission
- Check page's requiredPermission prop matches actual permission

### Admin Pages 404
- Verify page file exists in apps/gs-web/src/pages/admin/
- Check Astro routing for typos
- Restart dev server after adding new page

## Roadmap

- [x] Google Workspace RBAC integration (disabled until operator configuration is verified)
- [ ] Advanced analytics dashboard
- [ ] Bulk operations for product management
- [ ] Scheduled reports
- [ ] Compliance audit trails
- [ ] Admin API scopes and tokens
