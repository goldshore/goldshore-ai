# Phase 3: Gateway Consolidation (goldshore-gateway → gs-api)

**Timeline**: 2-3 days  
**Date Started**: 2026-08-22  
**Owner**: Claude / Codex  
**Status**: ⏳ Pending Phase 2 admin migration completion

---

## Objective

Consolidate `goldshore-gateway` front-door Worker logic into `apps/gs-api`. Gateway currently runs as `gs-platform` Worker and handles CORS, Cloudflare Access validation, request routing, and health checks. Post-consolidation, gs-api will handle all these responsibilities directly.

---

## Current State Analysis

### goldshore-gateway (gs-platform Worker)
**Location**: `/home/user/marzton/goldshore-gateway/goldshore-gateway/`  
**Current Role**: Platform front-door router
**Functions**:
1. **CORS Validation** (`corsHeaders` middleware)
   - Allows cross-origin requests from specified origins
   - Returns CORS headers on preflight (OPTIONS)

2. **Cloudflare Access JWT Validation** (`validateAccess` middleware)
   - Validates JWT on `/api/*` routes
   - Returns 401 if JWT invalid or missing

3. **Request Routing** (`/api/*` → API_SERVICE binding → gs-api)
   - Routes all API requests to internal gs-api service
   - Preserves correlation IDs (x-correlation-id header)

4. **Path Security** (SSRF prevention)
   - Recursively decodes URLs to prevent double-encoding attacks
   - Validates paths to prevent traversal (`..*` checks)

5. **Health Check** (`/health` endpoint)
   - Returns `{ status: "online", environment, version, timestamp }`
   - Used for monitoring and version verification

6. **Correlation ID Tracking** (`x-correlation-id` header)
   - Passes through incoming correlation IDs
   - Generates UUIDs for new requests
   - Used for distributed tracing

7. **Error Classification** (detailed logging)
   - Classifies failures: binding-unreachable, binding-misconfigured, upstream-error
   - Logs error details with requestId, pathname, failureType

### gs-api (Canonical Backend)
**Location**: `apps/gs-api/`  
**Current Role**: Main API Worker
**Missing**: CORS handling, CF Access validation, health check, correlation ID pipeline

---

## Implementation Steps

### Step 1: Copy Middleware to gs-api

#### 1.1 Add CORS Middleware
**File**: `apps/gs-api/src/middleware/cors.ts`
**Source**: `/home/user/marzton/goldshore-gateway/goldshore-gateway/src/middleware/cors.ts`

```typescript
// Copy entire cors.ts file to gs-api
import { type CorsHeaderOptions, cors } from 'hono/cors';

export function corsHeaders(origin: string, env: Env): Record<string, string> {
  // Implementation from goldshore-gateway
  // Returns CORS headers based on origin and environment config
}
```

#### 1.2 Add Access Validation Middleware
**File**: `apps/gs-api/src/middleware/access.ts`
**Source**: `/home/user/marzton/goldshore-gateway/goldshore-gateway/src/middleware/access.ts`

```typescript
// Copy entire access.ts file to gs-api
export async function validateAccess(request: Request, env: Env): Promise<{ ok: boolean; error?: string }> {
  // Implementation from goldshore-gateway
  // Validates Cloudflare Access JWT
}
```

**Verification**:
- [ ] Both middleware files copied and TypeScript compiles
- [ ] No missing imports or dependencies
- [ ] Export signatures match gateway implementation

---

### Step 2: Add Middleware to gs-api Request Pipeline

**File**: `apps/gs-api/src/index.ts`

**Current Pipeline** (assumed):
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Route handling
  }
}
```

**New Pipeline** (add middleware):
```typescript
import { corsHeaders } from './middleware/cors';
import { validateAccess } from './middleware/access';

const CORRELATION_HEADER = 'x-correlation-id';

function getCorrelationId(request: Request): string {
  const incoming = request.headers.get(CORRELATION_HEADER)?.trim();
  return incoming ? incoming.slice(0, 128) : crypto.randomUUID();
}

function withCorrelationHeaders(headers: HeadersInit, correlationId: string): Headers {
  const enrichedHeaders = new Headers(headers);
  enrichedHeaders.set(CORRELATION_HEADER, correlationId);
  return enrichedHeaders;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin, env),
      });
    }

    // 2. Health & Metadata Endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'online',
          environment: env.ENVIRONMENT,
          version: env.VERSION?.id || 'unknown',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin, env),
          },
        },
      );
    }

    // 3. API Routing with Access Control
    if (url.pathname.startsWith('/api/')) {
      const requestId = getCorrelationId(request);

      // Validate Cloudflare Access JWT
      const access = await validateAccess(request, env);
      if (!access.ok) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: 401,
          headers: withCorrelationHeaders(
            {
              'Content-Type': 'application/json',
              ...corsHeaders(origin, env),
            },
            requestId,
          ),
        });
      }

      // Continue with normal route handling
      // (existing gs-api router logic)
    }

    // 4. Default router/handlers
    // (existing gs-api routes)
  }
}
```

**Verification**:
- [ ] TypeScript compiles without errors
- [ ] No circular dependencies
- [ ] CORS headers applied to all responses
- [ ] Correlation IDs propagated through all handlers

---

### Step 3: Update Handler Responses

**All gs-api handlers** must return responses with CORS headers appended.

**Pattern**:
```typescript
// Before (assumes no CORS)
return new Response(JSON.stringify(data), { status: 200 });

// After (includes CORS)
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(origin, env),
  },
});
```

**Files to Update**:
- All route handlers in `apps/gs-api/src/routes/*.ts`
- All API handlers that return JSON responses

**Automation**: Consider a response wrapper:
```typescript
function apiResponse(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
```

---

### Step 4: Update Cloudflare Configuration

**File**: `apps/gs-api/wrangler.toml`

**Add environment binding** (if not already present):
```toml
[env.prod]
routes = [
  { pattern = "api.goldshore.ai/*", zone_name = "goldshore.ai" }
]
```

**Remove gateway binding** (if present):
```toml
# Delete or comment out:
# [[services]]
# binding = "GATEWAY"
# service = "gs-platform"
```

**Verify binding**: Ensure `env.ENVIRONMENT` is set correctly in both `prod` and `preview`.

---

### Step 5: Update Cloudflare Worker Routes

**Dashboard Action**: Update Cloudflare Worker routes to point directly to gs-api

**Current Setup**:
- `gs-platform` Worker: Routes all traffic to gs-api (via API_SERVICE binding)
- gs-api: Receives routed requests

**New Setup**:
- gs-api Worker: Handles all traffic directly (no intermediate gateway)
- Remove gs-platform Worker from Cloudflare dashboard (or redirect to gs-api)

**Steps**:
1. In Cloudflare Dashboard → Workers → Routes
2. Find: `api.goldshore.ai/*` → gs-platform
3. Change to: `api.goldshore.ai/*` → gs-api
4. Save and deploy

---

### Step 6: Path Security Validation

**Copy path validation logic** from gateway to gs-api:

**File**: `apps/gs-api/src/middleware/path-security.ts`
**Source**: Gateway path validation in `router.ts`

```typescript
function recursivelyDecodePath(path: string): string | null {
  let decodedPath = path;
  for (let depth = 0; depth < 5; depth++) {
    try {
      const nextPath = decodeURIComponent(decodedPath);
      if (nextPath === decodedPath) return decodedPath;
      decodedPath = nextPath;
    } catch {
      return null;
    }
  }
  return null;
}

export function validatePath(path: string): boolean {
  if (path.includes('..') || path.includes('%2e%2e')) return false;
  const decodedPath = recursivelyDecodePath(path);
  return decodedPath !== null && !decodedPath.includes('..');
}
```

**Use in handlers**:
```typescript
// Before processing request
if (!validatePath(url.pathname)) {
  return new Response('Invalid path', { status: 400 });
}
```

---

### Step 7: Testing

#### Unit Tests
```bash
# Test CORS middleware
pnpm --filter gs-api test -- middleware/cors

# Test Access middleware
pnpm --filter gs-api test -- middleware/access

# Test path security
pnpm --filter gs-api test -- middleware/path-security
```

#### Integration Tests
```bash
# Test full request pipeline
pnpm --filter gs-api test -- integration/request-pipeline
```

#### E2E Tests
```bash
# Start local dev server
pnpm --filter gs-api dev &

# Test CORS
curl -X OPTIONS http://localhost:8787/api/test \
  -H "Origin: https://goldshore.ai" \
  -v

# Test health check
curl http://localhost:8787/health

# Test API endpoint (with CF Access mock)
curl http://localhost:8787/api/admin/users \
  -H "Cf-Access-Jwt-Assertion: <token>" \
  -v
```

---

### Step 8: Migration & Cutover

#### Stage 1: Parallel Deployment (No Impact)
- Deploy gs-api with new middleware (CORS, access validation)
- Gateway continues routing traffic
- Both handle CORS/auth independently
- Monitor for errors

#### Stage 2: Gradual Traffic Shift (Canary)
- Route 10% of traffic to gs-api directly
- Monitor error rates, latency
- Route 50% if healthy
- Route 100% if no issues

#### Stage 3: Complete Cutover
- All traffic routes to gs-api
- Remove gs-platform Worker from Cloudflare
- Archive goldshore-gateway repo

---

## Blockers & Mitigations

### Blocker 1: CF Access JWT Format Changes
**Issue**: Gateway validates specific JWT format; gs-api middleware may expect different format  
**Mitigation**: Test with actual CF Access tokens from staging; align validation logic

### Blocker 2: CORS Header Conflicts
**Issue**: Browsers may reject if CORS headers duplicated or conflicting  
**Mitigation**: Ensure single CORS header per response; test in browser DevTools

### Blocker 3: Correlation ID Propagation
**Issue**: Distributed traces may break if correlation IDs not propagated correctly  
**Mitigation**: Ensure all internal calls include x-correlation-id header

---

## Success Criteria

- ✅ CORS middleware integrated and tested
- ✅ Access validation middleware integrated and tested
- ✅ Health check endpoint working at /health
- ✅ Correlation IDs propagated through all handlers
- ✅ Path security validation prevents SSRF
- ✅ All gs-api routes return proper CORS headers
- ✅ E2E tests pass (CORS preflight, auth, routing)
- ✅ Zero errors during parallel deployment
- ✅ Traffic shift completes without issues
- ✅ goldshore-gateway archived

---

## Post-Implementation

1. Archive goldshore-gateway on GitHub
2. Update CLAUDE.md to remove gateway consolidation task
3. Monitor gs-api error logs for auth failures
4. Brief team on new request flow (direct to gs-api, no intermediate gateway)

---

_Generated by Claude Code · Session: session_011bt45s8TaWC3tgMGeY3QA3_
