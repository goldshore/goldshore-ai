# Admin Platform Roadmap — Goldshore AI

**Status**: Phase 1 In Progress  
**Branch**: `claude/mcp-gs-api-worker-migration-0g51br`  
**Timeline**: 4 weeks (Aug 14 — Sep 11, 2026)  
**Owner**: Claude Code Agent

---

## Executive Summary

Building a comprehensive enterprise admin platform with 30+ features for operations, automation, and infrastructure management. Four-phase rollout prioritizing email, worker management, contact forms, and CRUD operations, leading to advanced workflows and infrastructure integration.

**Phased Approach**:
- **Phase 1** (Week 1): Core CRUD, email, worker management, entries
- **Phase 2** (Week 2): WYSIWYG editors, secret management, API key rotation
- **Phase 3** (Week 3): Automation workflows (leads, scraping, data collection)
- **Phase 4** (Week 4+): Enterprise features (PR mgmt, AI, ads, site builder, infrastructure)

---

## Phase 1: Core Admin Infrastructure (Week 1)

### Status: BACKEND ✅ COMPLETE | FRONTEND 🔄 IN PROGRESS

### Completed Goals
- ✅ Fix CF Access login panel (JWT auth, edge Access Application created in dashboard)
- ✅ Set Cloudflare API credentials guidance (manual dashboard + env var setup)
- ✅ Build complete API routes for admin operations
- ✅ Email queue management (status, logs, templates, resend)
- ✅ Contact forms & leads management with CRUD operations
- ✅ User management (team members, roles, permissions)
- ✅ Settings management (global configuration, batch updates)
- ✅ D1 schema with 6 tables + audit logging
- ✅ Authentication middleware (CF Access JWT verification)
- ✅ Comprehensive API documentation

### Remaining Goals
- 🔄 Build admin pages with full CRUD + pagination (Astro + React)
- 🔄 Worker bindings/routes/secrets management UI (Phase 2)

### Components to Build

#### Backend (`apps/gs-api/src/routes/admin/`)

```
admin/
├── index.ts              # Route aggregator
├── email.ts              # POST /api/admin/email/queue, logs, templates
├── workers.ts            # GET/POST /api/admin/workers/{bindings,routes,secrets}
├── entries.ts            # CRUD /api/admin/entries/{contacts,leads}
├── users.ts              # CRUD /api/admin/users/{signups,permissions}
├── settings.ts           # CRUD /api/admin/settings
├── middleware/
│   ├── auth.ts           # CF Access JWT + role verification
│   ├── pagination.ts     # Offset/limit parsing
│   └── validation.ts     # Input schema validation
└── db/
    ├── email.ts          # D1 queries for email operations
    ├── workers.ts        # Cloudflare API calls for workers
    ├── entries.ts        # D1 queries for contact forms, leads
    └── users.ts          # D1 queries for sign-ups, permissions
```

#### Frontend (`apps/gs-web/src/pages/admin/`)

```
admin/
├── dashboard.astro       # Overview, stats, quick actions
├── email/
│   ├── index.astro       # Email queue + logs list
│   ├── [id].astro        # Email detail view
│   └── templates.astro   # Email templates (WYSIWYG later)
├── workers/
│   ├── index.astro       # Bindings list
│   ├── bindings.astro    # Create/edit bindings
│   ├── routes.astro      # Route configurator
│   └── secrets.astro     # Secret creator
├── entries/
│   ├── index.astro       # All entries (contact forms + leads)
│   ├── contacts.astro    # Contact form submissions
│   ├── leads.astro       # Lead submissions
│   └── [id].astro        # Entry detail view
├── users/
│   ├── index.astro       # Sign-ups list
│   ├── [id].astro        # User detail/edit
│   └── permissions.astro # Permission manager
├── settings/
│   └── index.astro       # Global settings
└── components/
    ├── Table.tsx         # Reusable data table with pagination
    ├── Form.tsx          # Form builder
    ├── Modal.tsx         # Modal for create/edit
    ├── Pagination.tsx    # Pagination controls
    └── FilterBar.tsx     # Filter/search bar
```

### Database Schema Updates

**New D1 Tables**:
```sql
-- Email management
CREATE TABLE IF NOT EXISTS admin_emails (
  id TEXT PRIMARY KEY,
  queue_id TEXT,
  recipient TEXT,
  subject TEXT,
  template TEXT,
  status TEXT,
  created_at DATETIME,
  sent_at DATETIME
);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS admin_contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  message TEXT,
  status TEXT,
  created_at DATETIME,
  responded_at DATETIME
);

-- Lead submissions
CREATE TABLE IF NOT EXISTS admin_leads (
  id TEXT PRIMARY KEY,
  source TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  metadata TEXT,
  status TEXT,
  created_at DATETIME
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  action TEXT,
  resource TEXT,
  resource_id TEXT,
  changes TEXT,
  created_at DATETIME
);

-- Admin users (sign-ups)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT,
  permissions TEXT,
  status TEXT,
  created_at DATETIME,
  invited_at DATETIME,
  accepted_at DATETIME
);

-- Settings
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME
);
```

### API Routes

#### Email Management
```
POST /api/admin/email/queue
  - Get email queue status
  - Returns: { queued: N, sent: N, failed: N, logs: [...] }

GET /api/admin/email/logs
  - List email logs (paginated)
  - Params: offset, limit, status, date_from, date_to
  - Returns: { items: [...], total, page, per_page }

POST /api/admin/email/resend?id=<email_id>
  - Resend failed email

GET /api/admin/email/templates
  - List email templates

POST /api/admin/email/templates
  - Create new email template
```

#### Worker Management
```
GET /api/admin/workers/bindings
  - List all worker bindings from Cloudflare
  - Returns: { workers: [...], bindings: {...} }

POST /api/admin/workers/bindings
  - Update/create binding (delegates to Cloudflare API)

GET /api/admin/workers/routes
  - List all worker routes

POST /api/admin/workers/routes
  - Create/update route

GET /api/admin/workers/secrets
  - List secret names (NOT values)

POST /api/admin/workers/secrets
  - Create/update secret (POST to Cloudflare)

DELETE /api/admin/workers/secrets?name=<secret_name>
  - Delete secret
```

#### Entries (Contact Forms + Leads)
```
GET /api/admin/entries
  - List all entries (contacts + leads)
  - Params: type, offset, limit, status
  - Returns: { items: [...], total, page, per_page }

GET /api/admin/entries/contacts
  - List contact form submissions

GET /api/admin/entries/contacts?id=<id>
  - Get single contact submission

POST /api/admin/entries/contacts/<id>/respond
  - Mark as responded

GET /api/admin/entries/leads
  - List lead submissions

POST /api/admin/entries/leads/<id>
  - Update lead status/notes

DELETE /api/admin/entries/leads/<id>
  - Delete lead
```

#### User Management
```
GET /api/admin/users
  - List user sign-ups
  - Returns: { items: [...], total, page }

POST /api/admin/users/<id>
  - Update user role/permissions

POST /api/admin/users/<id>/invite
  - Resend invitation email

DELETE /api/admin/users/<id>
  - Remove user (revoke access)
```

#### Settings
```
GET /api/admin/settings
  - Get all global settings

POST /api/admin/settings
  - Update settings (key-value pairs)
```

### Frontend Features

**Dashboard**:
- Overview stats: emails queued, entries pending, users invited
- Quick actions: send email, export leads, view worker status
- Recent activity feed

**Email Manager**:
- Queue list with status indicators (queued, sent, failed)
- Click to view log/error
- Resend button for failed emails
- Export logs CSV

**Worker Manager**:
- Bindings panel: create/edit/delete
- Routes panel: configure URL → worker routing
- Secrets panel: create/update secrets (with masking)

**Entries**:
- Unified table: contacts + leads
- Filters: type, status, date range
- Pagination: 25/50/100 per page
- Detail modal: view full entry, respond/update
- Export CSV

**User Manager**:
- Sign-ups list with invitation status
- Role/permission selector
- Resend invitation button
- Remove user button

**Settings**:
- Global configuration form (key-value editor)
- Save/reload functionality

### Authentication & Authorization

**Middleware** (`apps/gs-api/src/routes/admin/middleware/auth.ts`):
```typescript
// Verify CF Access JWT
// Extract user email from JWT claims
// Check against ADMIN_OWNER_EMAILS secret
// Return 401 if not authorized
// Add user context to request
```

**Roles** (Phase 1 MVP):
- `admin` — full access to all admin features
- `moderator` — can view/respond to entries, no worker/secret access
- `viewer` — read-only access

### Deliverables

- [ ] 6 API route files (email, workers, entries, users, settings, middleware)
- [ ] 8 Astro pages (dashboard, email, workers, entries, users, settings)
- [ ] 4 React components (Table, Form, Modal, Pagination)
- [ ] D1 schema migrations (6 new tables)
- [ ] Middleware for auth/pagination/validation
- [ ] Updated CLAUDE.md + API docs

### Success Criteria

- ✅ Login panel works (CF Access Application created)
- ✅ All routes respond correctly
- ✅ CRUD operations work (create, read, update, delete)
- ✅ Pagination works (25/50/100 per page)
- ✅ Permission checks enforced
- ✅ Audit log captures all admin actions
- ✅ No errors in Worker logs
- ✅ Components are reusable across pages

---

## Phase 2: Advanced CRUD + Editors (Week 2)

### Goals
- WYSIWYG editor for email templates & contact forms
- Secret creator with auto-generation
- API key rotator (create, revoke, track usage)
- Permission updater (granular role-based access)
- Binding manager (visual editor for KV/D1/R2/Queues)

### Components
```
admin/
├── secret-creator/
│   ├── index.astro
│   ├── generator.tsx     # Auto-generate secrets, API keys
│   └── rotator.tsx       # Track key age, rotate on schedule
├── wysiwyg/
│   ├── email-editor.tsx  # Rich text + template variables
│   ├── form-editor.tsx   # Drag-drop form builder
│   └── content-editor.tsx
└── permissions/
    ├── index.astro
    ├── role-editor.tsx   # Define custom roles
    └── access-matrix.tsx # Visualize who can do what
```

---

## Phase 3: Workflows + Automation (Week 3)

### Goals
- Leads generator: automated lead creation workflow
- List scraper: background job to scrape/import leads
- Data collector: aggregate data from multiple sources
- Email sender: scheduled email campaigns
- CF Tunnel manager: create/manage Cloudflare Tunnel configurations

### Workflows
```
admin/
├── workflows/
│   ├── index.astro
│   ├── leads-generator.tsx
│   ├── list-scraper.tsx
│   ├── data-collector.tsx
│   ├── email-sender.tsx
│   └── cf-tunnel-manager.tsx
```

---

## Phase 4: Enterprise Features (Week 4+)

### Goals
- PR manager: create/manage/approve PRs from admin UI
- AI search + assist: search docs, configs, logs with AI
- Ad integrator: manage Google Ads campaigns
- Site builder: visual page builder
- Plugin installer: install/manage Cloudflare plugins/extensions
- SQL + HostGator VPS sync: backup/restore data
- Mailbox manager: manage email addresses, forwarding rules
- Email list manager: create/manage subscriber lists, segmentation

### Components
```
admin/
├── pr-manager/
├── ai-search/
├── ads/
├── site-builder/
├── plugins/
├── infrastructure/
│   ├── sql-sync.tsx
│   ├── vps-manager.tsx
│   ├── mailbox-manager.tsx
│   └── email-lists.tsx
└── tree-view/ # Project structure visualizer
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Astro + React | Server-rendered pages + interactive components |
| Backend | Hono | TypeScript request router |
| Storage | D1 | Structured data (emails, forms, users, settings) |
| Cache | KV | Session cache, temporary data |
| Assets | R2 | Uploaded files (email attachments, form uploads) |
| Auth | CF Access | JWT-based authentication |
| APIs | Cloudflare API | Worker/route/secret management |
| Queues | Cloudflare Queues | Background jobs (email, scraping) |

---

## File Structure

```
apps/gs-api/src/routes/admin/
├── index.ts
├── email.ts
├── workers.ts
├── entries.ts
├── users.ts
├── settings.ts
├── middleware/
│   ├── auth.ts
│   ├── pagination.ts
│   └── validation.ts
└── db/
    ├── email.ts
    ├── workers.ts
    ├── entries.ts
    └── users.ts

apps/gs-web/src/pages/admin/
├── dashboard.astro
├── email/
│   ├── index.astro
│   ├── [id].astro
│   └── templates.astro
├── workers/
│   ├── index.astro
│   ├── bindings.astro
│   ├── routes.astro
│   └── secrets.astro
├── entries/
│   ├── index.astro
│   ├── contacts.astro
│   ├── leads.astro
│   └── [id].astro
├── users/
│   ├── index.astro
│   ├── [id].astro
│   └── permissions.astro
├── settings/
│   └── index.astro
└── components/
    ├── Table.tsx
    ├── Form.tsx
    ├── Modal.tsx
    ├── Pagination.tsx
    └── FilterBar.tsx
```

---

## Success Metrics

### Phase 1
- [ ] All 6 core API routes working
- [ ] All 8 admin pages rendering
- [ ] CRUD operations fully functional
- [ ] Pagination works on all lists
- [ ] Audit logging captures all actions
- [ ] <2s page load time (Lighthouse 80+)
- [ ] Zero console errors

### Phase 2
- [ ] WYSIWYG editor saves/loads templates
- [ ] Secret creator/rotator functional
- [ ] Permission system enforced
- [ ] Binding manager updates Cloudflare

### Phase 3
- [ ] All workflows trigger correctly
- [ ] Background jobs process successfully
- [ ] Data collection pipeline works end-to-end
- [ ] Email sender respects rate limits

### Phase 4
- [ ] PR manager creates valid GitHub PRs
- [ ] AI search returns relevant results
- [ ] Ad integrator syncs with Google Ads
- [ ] Site builder generates valid HTML
- [ ] Plugin installer adds functionality
- [ ] Infrastructure sync keeps data current

---

## Open Questions / Blockers

1. **HostGator VPS Integration**: Do we have SSH access? Git remote configured?
2. **Email Provider**: Is this Cloudflare Email Routing or external (SendGrid, Mailgun)?
3. **SQL Sync**: Which database engine? PostgreSQL, MySQL?
4. **Mailbox Provider**: Gmail, Mailgun, or custom?
5. **Google Ads API**: Credentials and OAuth flow setup?

---

## Next Steps

1. ✅ Commit CLAUDE.md + roadmap
2. Create `/api/admin/` route structure
3. Build D1 schema migrations
4. Implement auth middleware
5. Build core CRUD endpoints (email, workers, entries, users)
6. Build frontend pages with components
7. Test end-to-end
8. Deploy to preview environment
9. Test in production
10. Document API in `/docs/ADMIN_API.md`

---

**Last Updated**: 2026-08-14  
**Next Milestone**: Phase 1 complete by 2026-08-21
