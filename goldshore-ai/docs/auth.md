# Authentication & Authorization

## Provider choice
We will use **Auth0** as the primary authentication provider. Auth0 supports the required social IdPs (Google, Apple, GitHub), offers a hosted login experience, and provides built-in **RBAC**/role management that we can surface to the admin app and API layers. This keeps the admin app on standard OIDC flows while centralizing role governance in one system.

Phone login will be implemented using **Twilio Verify** for SMS-based one-time codes, with Auth0 serving as the identity broker and token issuer.

## Identity providers (IdPs)
Enable the following Auth0 social connections:

- **Google** OAuth 2.0
- **Apple** Sign in with Apple
- **GitHub** OAuth 2.0

### Auth0 configuration checklist
1. Create an Auth0 tenant and a **"Goldshore Admin"** application (OIDC).
2. Configure the **callback/logout URLs** for the admin app.
3. Enable social connections for **Google, Apple, GitHub**.
4. Turn on **RBAC** and **Add Permissions in the Access Token** in the API settings.
5. Define an Auth0 **API** representing the admin backend (audience used by the admin app).

## Phone login (Twilio Verify)
We will use **Twilio Verify** to send and verify SMS one-time codes and then exchange a verified phone identity for Auth0 tokens.

Recommended flow:
1. Admin app requests a phone login initiation from our backend (ex: `POST /auth/phone/start`).
2. Backend calls **Twilio Verify** to send a code.
3. Admin app submits the code to `POST /auth/phone/verify`.
4. Backend verifies via Twilio Verify; on success, it performs a **token exchange** with Auth0 (for example using a custom Auth0 Action + custom login endpoint) to mint standard Auth0 tokens.
5. Tokens include RBAC claims so the admin app and APIs can enforce access rules uniformly.

> Notes
> - Keep Twilio Verify credentials server-side only.
> - Rate limit the phone endpoints and add audit logging.

## Admin app integration (RBAC)
The admin app should treat Auth0 as the only source of identity and authorization. **All access is role-gated** using Auth0 roles and permissions.

### Access token claims
- Access tokens must include **roles** (or permissions) via Auth0 RBAC settings.
- Add a custom claim namespace (example):
  - `https://goldshore.app/roles`: `["admin", "support", "ops"]`

### Role-based access rules
Suggested baseline roles:
- **admin**: Full access to all admin functionality.
- **support**: Read-only access + support tooling.
- **ops**: Operational controls (deployments, infra toggles).

Example role-to-permission mapping (Auth0 RBAC):
- **admin**: `admin:*`
- **support**: `tickets:read`, `users:read`
- **ops**: `deployments:write`, `feature_flags:write`

### Admin app enforcement
- Require a valid Auth0 session for all admin routes.
- Block access unless the user has **required roles**.
- On the API side, verify JWTs and enforce role checks per endpoint.

### Integration steps (admin app)
1. Add Auth0 SDK and configure it with tenant domain, client ID, and audience.
2. Guard routes with a shared `requireRole(["admin"])` helper.
3. Decode the access token and read the **roles claim**.
4. Show role-aware UI (navigation, buttons, actions) based on roles.

## Environment configuration
Store these values in secrets management:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`
- `AUTH0_CALLBACK_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

## Operational considerations
- Enforce MFA for privileged roles in Auth0.
- Rotate Auth0/Twilio secrets regularly.
- Maintain an allowlist of admin user emails for initial bootstrap.
- Log all admin logins and role changes.
