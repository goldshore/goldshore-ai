# Google Workspace RBAC Integration

## Overview

GoldShore integrates with Google Workspace to provide identity and role-based access control. Admin users are managed through Google Workspace with roles automatically synced to the GoldShore database.

## Architecture

```
Google Workspace
      ↓ (Directory API + Groups)
  ↓ (SAML/OAuth)
GoldShore Admin DB
      ↓ (User + Role lookup)
Admin Session
      ↓ (Permission assignment)
Dashboard Access
```

## Setup

### Prerequisites

- Google Cloud Project with admin consent
- Google Workspace domain admin access
- Service account with Directory API access
- OAuth 2.0 credentials for user login

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: `goldshore-ai-admin`
3. Enable APIs:
   - Google Directory API
   - Admin SDK
   - Google Meet API (optional)
   - Google Calendar API (optional)

### 2. Configure Service Account

```bash
# In Google Cloud Console:
# 1. Create service account named "goldshore-admin"
# 2. Grant roles:
#    - Directory API Reader
#    - Security Admin (for audit logs)
# 3. Create JSON key
# 4. Download and store securely
```

Store the service account key in Cloudflare secrets:

```bash
wrangler secret put GOOGLE_ADMIN_SERVICE_ACCOUNT --env prod --name gs-api < ~/Downloads/key.json
```

### 3. Configure OAuth for Admin Login

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create OAuth 2.0 credentials (Web application)
2. Set Authorized redirect URIs:
   - `https://admin.goldshore.ai/auth/google/callback`
   - `https://admin.goldshore.org/auth/google/callback`
   - `https://admin-preview.goldshore.ai/auth/google/callback`

3. Set authorized JavaScript origins:
   - `https://admin.goldshore.ai`
   - `https://admin.goldshore.org`
   - `https://admin-preview.goldshore.ai`

4. Store credentials in wrangler.toml or secrets:

```toml
[env.prod.vars]
GOOGLE_OAUTH_CLIENT_ID = "xxx.apps.googleusercontent.com"
GOOGLE_OAUTH_REDIRECT_URI = "https://admin.goldshore.ai/auth/google/callback"

# Also for international domain
GOOGLE_BUSINESS_OAUTH_REDIRECT_URI = "https://admin.goldshore.org/auth/google/callback"
```

Store the client secret:

```bash
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env prod --name gs-api
```

### 4. Configure Google Workspace Groups for Roles

In Google Workspace Admin Console:

1. Create security groups for each admin role:
   - `goldshore-admins@goldshore.com` → admin role
   - `goldshore-operators@goldshore.com` → operator role
   - `goldshore-auditors@goldshore.com` → auditor role
   - `goldshore-developers@goldshore.com` → developer role
   - `goldshore-analysts@goldshore.com` → analyst role

2. Add users to appropriate groups

3. Grant group ownership to system accounts if auto-sync needed

### 5. Enable Security Assertions (SAML)

For Cloudflare Access integration:

1. In Google Cloud Console, configure SAML:
   - Entity ID: `https://admin.goldshore.ai`
   - ACS URL: `https://goldshore.cloudflareaccess.com/saml/acs`
   - Start URL: `https://admin.goldshore.ai/login`

2. Download SAML certificate

3. Upload to Cloudflare Access:
   - Go to Cloudflare Dashboard → Access → Applications
   - Edit admin-production application
   - Add SAML login method with downloaded certificate

## Implementation

### Database Schema

Add these tables to PLATFORM_DB:

```sql
-- Admin users synced from Google Workspace
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  roles TEXT NOT NULL, -- JSON array of role strings
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_google_id ON admin_users(google_id);

-- Role assignments
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL, -- JSON array of permission strings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
);

-- Audit logs for admin actions
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  changes TEXT, -- JSON of what changed
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

### API Endpoints

#### User Sync Endpoint

```ts
// POST /api/admin/sync-google-users
// Syncs admin users from Google Workspace

async function syncGoogleUsers(env: Env) {
  const serviceAccount = JSON.parse(env.GOOGLE_ADMIN_SERVICE_ACCOUNT);
  
  // Authenticate with Google Directory API
  const adminSDK = google.admin({ version: 'directory_v1', auth: serviceAccount });
  
  // List users
  const users = await adminSDK.users.list({
    customer: 'my_customer',
    fields: 'users(id,primaryEmail,displayName)',
    maxResults: 500,
  });
  
  // For each user, get their groups
  for (const user of users.data.users || []) {
    const groups = await adminSDK.groups.list({
      userKey: user.primaryEmail,
      fields: 'groups(email)',
    });
    
    const roles = mapGroupsToRoles(groups.data.groups || []);
    
    // Upsert to PLATFORM_DB
    await db.prepare(`
      INSERT INTO admin_users (id, google_id, email, display_name, roles, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(google_id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        roles = excluded.roles,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      crypto.randomUUID(),
      user.id,
      user.primaryEmail,
      user.displayName,
      JSON.stringify(roles)
    ).run();
  }
}

function mapGroupsToRoles(groups: Array<{ email: string }>): string[] {
  const roleMap: Record<string, string> = {
    'goldshore-admins@goldshore.com': 'admin',
    'goldshore-operators@goldshore.com': 'operator',
    'goldshore-auditors@goldshore.com': 'auditor',
    'goldshore-developers@goldshore.com': 'developer',
    'goldshore-analysts@goldshore.com': 'analyst',
  };
  
  return groups
    .map(g => roleMap[g.email])
    .filter(Boolean);
}
```

#### OAuth Callback Endpoint

```ts
// GET /auth/google/callback?code=...
// Handles Google OAuth callback

async function handleGoogleCallback(code: string, env: Env, db: D1Database) {
  // Exchange code for token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Get user info
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  const googleUser = await userResponse.json();
  
  // Look up admin user
  const adminUser = await db.prepare(`
    SELECT * FROM admin_users WHERE email = ?
  `).bind(googleUser.email).first();
  
  if (!adminUser) {
    return new Response('Access denied', { status: 403 });
  }
  
  // Create session JWT
  const jwt = await createAdminSessionJWT(adminUser, env);
  
  // Set secure cookie with JWT
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: '/app/dashboard',
      'Set-Cookie': `admin_session=${jwt}; Path=/; Secure; HttpOnly; SameSite=Strict`,
    },
  });
  
  // Log login
  await logAuditAction(adminUser.id, 'LOGIN', 'session', null, db);
  
  return response;
}
```

## Role-Based Access Control

### Role Definitions

```ts
export const ROLE_DEFINITIONS = {
  admin: {
    description: 'Full platform access',
    permissions: [
      'system:read',
      'system:write',
      'audit:read',
      'forms:read',
      'forms:write',
      'cloudflare_inventory:read',
      'secret_metadata:read',
      'users:read',
      'api_configuration:read',
    ],
  },
  operator: {
    description: 'Operational monitoring and configuration',
    permissions: [
      'system:read',
      'audit:read',
      'forms:read',
      'cloudflare_inventory:read',
      'api_configuration:read',
    ],
  },
  auditor: {
    description: 'Read-only access to logs and reports',
    permissions: [
      'audit:read',
    ],
  },
  developer: {
    description: 'API configuration and deployment',
    permissions: [
      'system:read',
      'api_configuration:read',
      'cloudflare_inventory:read',
    ],
  },
  analyst: {
    description: 'Data and reporting access',
    permissions: [
      'audit:read',
      'api_configuration:read',
    ],
  },
};
```

## Cron Job: Sync Admin Users Daily

Add to wrangler.toml:

```toml
[env.prod.triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM UTC
```

Handler:

```ts
export async function handleScheduledCron(
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  ctx.waitUntil(syncGoogleUsers(env));
}
```

## Monitoring & Debugging

### Check Google Workspace Configuration

```bash
# List Google users
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://www.googleapis.com/admin/directory/v1/users?customer=my_customer

# List groups
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://www.googleapis.com/admin/directory/v1/groups?customer=my_customer
```

### View Admin User Sync Log

```sql
SELECT * FROM audit_logs
WHERE action = 'GOOGLE_SYNC'
ORDER BY timestamp DESC
LIMIT 50;
```

### Check User Roles

```sql
SELECT 
  email,
  display_name,
  roles,
  last_login
FROM admin_users
ORDER BY email;
```

## Troubleshooting

### Users Can't Login to Admin
1. Check user is in correct Google Workspace group
2. Verify group email matches roleMap in mapGroupsToRoles()
3. Trigger manual sync: `POST /api/admin/sync-google-users`
4. Check AUDIT_DB for error logs

### Roles Not Updating
1. Verify Google Directory API enabled in Cloud Console
2. Verify service account has Directory API Reader role
3. Check cron job is running daily
4. Manually trigger sync endpoint

### OAuth Redirect Fails
1. Verify redirect_uri in Google Cloud Console matches actual URL
2. Check client_id and client_secret match
3. Verify CORS headers allow google.com

## Security Considerations

1. **Service Account Key** - Store only in Cloudflare secrets, never commit to repo
2. **OAuth Secret** - Rotate client secrets every 90 days
3. **Token Expiration** - Admin sessions expire after 24 hours
4. **Audit Logging** - All admin actions logged to AUDIT_DB
5. **Rate Limiting** - Admin endpoints rate-limited per user
6. **HTTPS Only** - Admin dashboard only over HTTPS
7. **SameSite Cookies** - Admin session cookies use SameSite=Strict

## References

- [Google Directory API Documentation](https://developers.google.com/admin-sdk/directory)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Workspace SAML Documentation](https://support.google.com/a/answer/9979802)
