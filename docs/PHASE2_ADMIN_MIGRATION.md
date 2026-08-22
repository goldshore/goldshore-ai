# Phase 2: Admin Dashboard Migration (goldshore-admin → gs-web)

**Timeline**: 3-4 days  
**Date Started**: 2026-08-22  
**Owner**: Claude / Codex  
**Status**: ⏳ Pending Phase 1 archival completion

---

## Objective

Migrate remaining admin functionality from `goldshore-admin` standalone repo into `apps/gs-web/src/pages/admin/` and corresponding gs-api routes. goldshore-admin currently runs at `admin.goldshore.ai`; post-migration it should be accessible via gs-web admin subdomain.

---

## Current State Analysis

### goldshore-admin (18 pages)
- **Deployment**: Cloudflare Pages at admin.goldshore.ai
- **Pages**: dashboard, api-config, audit-logs, customers, leads, orders, reports, risk, settings, status, subscriptions, themesettings, tracker, trading, workflows
- **Components**: Customer/subscription CRUD, API documentation, data tables
- **Database**: No D1; uses KV for config

### gs-web Admin (70+ pages)
- **Deployment**: Cloudflare Pages at goldshore.ai/admin
- **Coverage**: Analytics, audit, integrations, workers, system, users, security, services, products, settings, workflows
- **Status**: Comprehensive, but missing customer/subscription management

### Gap Analysis
**What's MISSING from gs-web**:
1. Customer management pages
   - `/admin/customers` — List view
   - `/admin/customers/[id]` — Detail/edit view
   - `/admin/customers/new` — Create view
   
2. Subscription management pages
   - `/admin/subscriptions` — List view
   - `/admin/subscriptions/[id]` — Detail/edit view

3. Components to migrate
   - `create-customer.tsx` (3.8 KB)
   - `customers-table.tsx` (1.7 KB)
   - `customers-list.tsx` (1.6 KB)
   - `create-subscription.tsx` (7.5 KB)
   - `subscriptions-table.tsx` (1.7 KB)

---

## Implementation Steps

### Step 1: Extract Components from goldshore-admin
**Deliverable**: 5 component files extracted and staged

```bash
# Copy customer/subscription components
cp /home/user/goldshore-admin/packages/admin/src/components/admin/create-customer.tsx \
   /home/user/goldshore-ai/apps/gs-web/src/components/admin/

cp /home/user/goldshore-admin/packages/admin/src/components/admin/customers-table.tsx \
   /home/user/goldshore-ai/apps/gs-web/src/components/admin/

cp /home/user/goldshore-admin/packages/admin/src/components/admin/customers-list.tsx \
   /home/user/goldshore-ai/apps/gs-web/src/components/admin/

cp /home/user/goldshore-admin/packages/admin/src/components/admin/create-subscription.tsx \
   /home/user/goldshore-ai/apps/gs-web/src/components/admin/

cp /home/user/goldshore-admin/packages/admin/src/components/admin/subscriptions-table.tsx \
   /home/user/goldshore-ai/apps/gs-web/src/components/admin/
```

**Verification**:
- [ ] All 5 components exist in gs-web
- [ ] No TypeScript errors after import
- [ ] Dependencies resolved (check for goldshore-admin-specific imports)

---

### Step 2: Create gs-web Admin Pages

#### `/admin/customers` (List View)
**File**: `apps/gs-web/src/pages/admin/customers.astro`
**Purpose**: Display all customers with filters, search, pagination
**Component**: Use `<CustomersList />` or `<CustomersTable />`
**API Integration**: Call `GET /api/admin/customers` (gs-api endpoint)

#### `/admin/customers/[id]` (Detail/Edit View)
**File**: `apps/gs-web/src/pages/admin/customers/[id].astro`
**Purpose**: View/edit individual customer record
**Component**: Use `<CreateCustomer />` component in edit mode
**API Integration**: 
- `GET /api/admin/customers/:id` (fetch)
- `PATCH /api/admin/customers/:id` (update)

#### `/admin/customers/new` (Create View)
**File**: `apps/gs-web/src/pages/admin/customers/new.astro`
**Purpose**: Create new customer
**Component**: Use `<CreateCustomer />` component in create mode
**API Integration**: `POST /api/admin/customers` (gs-api endpoint)

#### `/admin/subscriptions` (List View)
**File**: `apps/gs-web/src/pages/admin/subscriptions.astro`
**Purpose**: Display all subscriptions with status, filters
**Component**: Use `<SubscriptionsTable />`
**API Integration**: `GET /api/admin/subscriptions` (gs-api endpoint)

#### `/admin/subscriptions/[id]` (Detail/Edit View)
**File**: `apps/gs-web/src/pages/admin/subscriptions/[id].astro`
**Purpose**: View/edit subscription details
**Component**: Use `<CreateSubscription />` component in edit mode
**API Integration**:
- `GET /api/admin/subscriptions/:id` (fetch)
- `PATCH /api/admin/subscriptions/:id` (update)

---

### Step 3: Implement gs-api Routes

#### POST /api/admin/customers
- **Handler**: `apps/gs-api/src/routes/admin/customers.ts`
- **Logic**: Create new customer record
- **Database**: PLATFORM_DB
- **Auth**: CF Access + admin role
- **Response**: `{ id, name, email, status, created_at }`

#### GET /api/admin/customers
- **Handler**: `apps/gs-api/src/routes/admin/customers.ts`
- **Logic**: List all customers with pagination/filtering
- **Query params**: `?limit=50&offset=0&search=query`
- **Response**: `{ customers: [...], total: number, limit: number, offset: number }`

#### GET /api/admin/customers/:id
- **Handler**: `apps/gs-api/src/routes/admin/customers.ts`
- **Logic**: Fetch single customer by ID
- **Response**: `{ id, name, email, status, created_at, subscriptions: [...] }`

#### PATCH /api/admin/customers/:id
- **Handler**: `apps/gs-api/src/routes/admin/customers.ts`
- **Logic**: Update customer record
- **Payload**: `{ name?, email?, status? }`
- **Response**: `{ id, ...updated }`

#### Similar routes for subscriptions
- `POST /api/admin/subscriptions`
- `GET /api/admin/subscriptions`
- `GET /api/admin/subscriptions/:id`
- `PATCH /api/admin/subscriptions/:id`

---

### Step 4: Database Schema

**PLATFORM_DB migrations** (if not already exist):

```sql
-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

---

### Step 5: Update Deployment Config

**Current**: admin.goldshore.ai → goldshore-admin Pages project  
**New**: admin.goldshore.ai → gs-web Pages project (same origin)

**Cloudflare Pages Configuration**:
1. Update admin.goldshore.ai to point to gs-web deployment
2. Verify CF Access auth flows (should use same JWT validator as gs-web)
3. Test custom domain routing

---

### Step 6: Testing

#### Component Tests
```bash
# Test each component in isolation
pnpm --filter gs-web test -- customers
pnpm --filter gs-web test -- subscriptions
```

#### API Tests
```bash
# Test gs-api endpoints
pnpm --filter gs-api test -- admin/customers
pnpm --filter gs-api test -- admin/subscriptions
```

#### E2E Tests
```bash
# Test full flow: create → read → update → delete
pnpm --filter gs-web dev &
# In browser: navigate to /admin/customers, test CRUD operations
```

#### CF Access Auth
```bash
# Verify Cloudflare Access policy still validates on admin.goldshore.ai
# Test: admin.goldshore.ai/admin/customers (should require auth)
# Test: goldshore.ai/admin/customers (same content, same auth)
```

---

## Blockers & Mitigations

### Blocker 1: Component Dependencies
**Issue**: Components may have goldshore-admin-specific imports (utils, types, API client)  
**Mitigation**: Extract shared utilities to `@goldshore/utils` or `@goldshore/schema` packages; update imports

### Blocker 2: Database Schema Mismatch
**Issue**: goldshore-admin may expect different customer/subscription schema than gs-api  
**Mitigation**: Audit goldshore-admin DB queries; align schema or create migration

### Blocker 3: CF Access Policy Scope
**Issue**: admin.goldshore.ai may have separate CF Access application from goldshore.ai  
**Mitigation**: Consolidate to single policy or ensure both routes validate same JWT

---

## Success Criteria

- ✅ All 5 components extracted and integrated into gs-web
- ✅ 5 new admin pages created and tested
- ✅ gs-api routes for customer/subscription management implemented
- ✅ Database schema verified and migrations applied
- ✅ Deployment config updated (admin.goldshore.ai → gs-web)
- ✅ CF Access auth tested end-to-end
- ✅ E2E tests pass (CRUD operations)
- ✅ No broken references to goldshore-admin in goldshore-ai codebase

---

## Post-Implementation

1. Archive goldshore-admin on GitHub
2. Update CLAUDE.md to remove admin consolidation task
3. Brief team on new admin routes (all under goldshore.ai/admin)
4. Monitor production for any auth/routing issues

---

_Generated by Claude Code · Session: session_011bt45s8TaWC3tgMGeY3QA3_
