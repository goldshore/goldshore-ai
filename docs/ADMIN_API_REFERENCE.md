# Admin API Reference — Phase 1

**Base URL**: `https://api.goldshore.ai/admin`  
**Authentication**: Cloudflare Access JWT (header: `CF-Authorization`)  
**Content-Type**: `application/json`

---

## Authentication

All endpoints require a valid Cloudflare Access JWT. Include it in the request:

```bash
curl -H "CF-Authorization: <JWT_TOKEN>" https://api.goldshore.ai/admin/email/status
```

**User must be in `ADMIN_OWNER_EMAILS` list to access any admin endpoint.**

---

## Email Management

### GET /email/status
Get email queue statistics.

**Response**:
```json
{
  "queued": 5,
  "sent": 1024,
  "failed": 3,
  "total": 1032
}
```

### GET /email/logs
List email logs with pagination.

**Query Parameters**:
- `offset` (int): Starting position (default: 0)
- `limit` (int): Number of results (default: 25, max: 100)
- `status` (string): Filter by status (queued, sent, failed)
- `dateFrom` (string): ISO 8601 date
- `dateTo` (string): ISO 8601 date

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "recipient": "user@example.com",
      "subject": "Welcome to Goldshore",
      "status": "sent",
      "created_at": "2026-08-14T10:00:00Z",
      "sent_at": "2026-08-14T10:00:15Z"
    }
  ],
  "total": 1024,
  "offset": 0,
  "limit": 25,
  "page": 1
}
```

### GET /email/logs/:id
Get single email log entry.

**Response**: Email object (see above)

### POST /email/logs/:id/resend
Resend a failed email.

**Response**:
```json
{
  "success": true,
  "message": "Email marked for resend",
  "email": { ... }
}
```

### GET /email/templates
List email templates.

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Welcome Email",
      "subject": "Welcome to Goldshore",
      "template": "<html>...</html>",
      "created_at": "2026-08-10T00:00:00Z"
    }
  ]
}
```

### POST /email/templates
Create new email template.

**Body**:
```json
{
  "name": "Welcome Email",
  "subject": "Welcome to Goldshore",
  "template": "<html><body>Welcome!</body></html>"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Template created"
}
```

### DELETE /email/logs/:id
Delete email log entry.

**Response**:
```json
{
  "success": true,
  "message": "Email deleted"
}
```

---

## Entries Management

### GET /entries
List all entries (contacts + leads combined).

**Query Parameters**:
- `offset` (int): Starting position (default: 0)
- `limit` (int): Number of results (default: 25, max: 100)

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "contact",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "new",
      "created_at": "2026-08-14T10:00:00Z"
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 25,
  "page": 1
}
```

### GET /entries/contacts
List contact form submissions.

**Query Parameters**:
- `offset`, `limit`, `status`, `dateFrom`, `dateTo`

### GET /entries/contacts/:id
Get single contact.

**Response**: Contact object

### POST /entries/contacts/:id/respond
Mark contact as responded.

**Body**:
```json
{
  "notes": "Sent more information via email"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Contact marked as responded"
}
```

### DELETE /entries/contacts/:id
Delete contact submission.

**Response**:
```json
{
  "success": true,
  "message": "Contact deleted"
}
```

### GET /entries/leads
List lead submissions.

**Query Parameters**:
- `offset`, `limit`, `status`, `source`, `dateFrom`, `dateTo`

**Status values**: new, contacted, qualified, converted, lost

### GET /entries/leads/:id
Get single lead.

**Response**: Lead object with metadata JSON

### POST /entries/leads/:id
Update lead status.

**Body**:
```json
{
  "status": "qualified",
  "assignedTo": "sales@goldshore.ai"
}
```

### DELETE /entries/leads/:id
Delete lead.

**Response**:
```json
{
  "success": true,
  "message": "Lead deleted"
}
```

---

## User Management

### GET /users
List admin users.

**Query Parameters**:
- `offset`, `limit`, `role` (admin, moderator, viewer), `status`

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "admin@goldshore.ai",
      "name": "Administrator",
      "role": "admin",
      "status": "active",
      "created_at": "2026-01-01T00:00:00Z",
      "invited_at": "2026-01-01T00:00:00Z",
      "accepted_at": "2026-01-01T12:00:00Z",
      "last_login": "2026-08-14T09:30:00Z"
    }
  ],
  "total": 5,
  "offset": 0,
  "limit": 25,
  "page": 1
}
```

### GET /users/:id
Get single user (permissions hidden).

### POST /users
Create new admin user (sends invitation).

**Body**:
```json
{
  "email": "newadmin@goldshore.ai",
  "name": "New Admin",
  "role": "moderator",
  "permissions": ["entries:read", "entries:update"]
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "User created and invitation sent"
}
```

### POST /users/:id
Update user role/permissions.

**Body**:
```json
{
  "name": "Updated Name",
  "role": "admin",
  "permissions": ["*"]
}
```

### DELETE /users/:id
Revoke user access.

**Response**:
```json
{
  "success": true,
  "message": "User access revoked"
}
```

### POST /users/:id/resend-invite
Resend invitation email.

**Response**:
```json
{
  "success": true,
  "message": "Invitation resent"
}
```

---

## Settings Management

### GET /settings
Get all global settings.

**Response**:
```json
{
  "settings": {
    "company_name": "Gold Shore Labs",
    "support_email": "support@goldshore.ai",
    "api_rate_limit": 1000,
    "features_enabled": ["leads", "email", "integrations"]
  }
}
```

### GET /settings/:key
Get single setting value.

**Response**:
```json
{
  "key": "company_name",
  "value": "Gold Shore Labs"
}
```

### POST /settings/:key
Set single setting.

**Body**:
```json
{
  "value": "New Company Name",
  "type": "string",
  "description": "Display name for the company"
}
```

**Type values**: string, json, number, boolean

### POST /settings
Batch update multiple settings.

**Body**:
```json
{
  "settings": {
    "company_name": "Updated Name",
    "api_rate_limit": 2000,
    "features_enabled": ["leads", "email", "integrations", "webhooks"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "3 settings updated"
}
```

### DELETE /settings/:key
Delete setting.

**Response**:
```json
{
  "success": true,
  "message": "Setting deleted"
}
```

---

## Error Responses

All errors return JSON with this format:

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

**Common HTTP Status Codes**:
- `200` OK
- `201` Created
- `400` Bad Request (invalid input)
- `401` Unauthorized (missing/invalid JWT)
- `403` Forbidden (user not in admin list)
- `404` Not Found (resource doesn't exist)
- `409` Conflict (duplicate email, etc.)
- `500` Internal Server Error

---

## Pagination

All list endpoints support pagination:

```bash
# Get 50 results starting at offset 100
GET /email/logs?offset=100&limit=50
```

Response includes:
- `items`: Array of results
- `total`: Total count of all items
- `offset`: Starting position
- `limit`: Number returned
- `page`: Calculated page number (offset / limit + 1)

---

## Rate Limiting

API calls are limited per user:
- 1000 requests per hour (configurable)
- Returns `429 Too Many Requests` if exceeded

---

## Audit Logging

All admin actions are logged to `admin_audit_log` table:
- Email resends
- Entry status updates
- User creation/deletion
- Settings changes
- etc.

Query `/admin/audit` (TODO: Phase 2) for full audit history.

---

## Phase 2 Additions (Planned)

- `/workers/bindings` — Cloudflare Worker binding management
- `/workers/routes` — Worker route configuration
- `/workers/secrets` — Secret creation/rotation
- `/audit` — Complete audit log viewer
- `/wysiwyg/email` — Email template builder
- `/permissions` — Granular permission management

---

## Testing

### cURL Example
```bash
# Get email status
curl -X GET \
  -H "CF-Authorization: $JWT_TOKEN" \
  https://api.goldshore.ai/admin/email/status

# Create contact
curl -X POST \
  -H "CF-Authorization: $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","message":"Hello"}' \
  https://api.goldshore.ai/admin/entries/contacts
```

### JavaScript Example
```javascript
const response = await fetch('https://api.goldshore.ai/admin/email/logs', {
  headers: {
    'CF-Authorization': jwtToken,
    'Content-Type': 'application/json',
  },
  method: 'GET',
});

const data = await response.json();
console.log(data.items);
```

---

**Last Updated**: 2026-08-14  
**API Version**: 1.0.0  
**Status**: Phase 1 Complete
