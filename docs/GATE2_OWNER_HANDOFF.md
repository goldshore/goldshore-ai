# Gate 2 owner handoff

Use this checklist for the mutations that cannot be safely automated because
they create credentials or affect production authorization. Record only status,
resource IDs, timestamps, and validation results in the PR or operations log.
Never record secret values.

## 1. Create the dedicated GearSwipe OIDC client

Owner: Google Cloud / Workspace administrator.

1. In Google Cloud Console, select project `gearswipe-cbb4c`.
2. Open **Google Auth Platform**. Configure Branding and Audience for a public
   GearSwipe sign-in application, and add `gearswipe.com` as an authorized
   domain if it is not already present in this project.
3. In Data Access, retain only `openid`, `email`, and `profile` for this
   client's login purpose. Do not copy scopes from the shared Gold Shore Labs
   project.
4. Create a **Web application** OAuth client named `GearSwipe Production OIDC`.
5. Add exactly these values:

   - Authorized JavaScript origin: `https://gearswipe.com`
   - Authorized redirect URI: `https://gearswipe.com/api/auth/callback/google`

6. Store the generated client secret directly in the approved secret manager or
   in the Cloudflare Worker secret-entry form. Do not paste it into chat, a PR,
   source files, KV, or an operations document.
7. Record the new client ID and creation timestamp only. Keep the prior client
   available until the cutover validation is complete.

## 2. Perform the Worker-secret cutover

Owner: Gold Shore Labs Cloudflare administrator.

1. Open **Workers & Pages** → `gearswipe` → production **Settings** →
   **Variables and Secrets**.
2. Set `AUTH_GOOGLE_ID` to the new client ID and `AUTH_GOOGLE_SECRET` through
   the secret field. Confirm both bindings exist without reading either value.
3. Confirm the prior credential pair has a recoverable owner-side record for
   rollback. Do not retain it in source or KV.
4. Validate with a non-Workspace Google account:

   - Start sign-in from `https://gearswipe.com/login`.
   - Complete consent and verify the callback returns to GearSwipe.
   - Confirm the account receives the expected non-admin role unless it is
     explicitly in `GEARSWIPE_ADMIN_EMAILS`.
   - Confirm no `org_internal` failure occurs.

5. If validation fails, restore the prior Worker secret bindings and stop. Do
   not alter DNS, routes, Access, or OAuth scopes as a workaround.

## 3. Retire the old client only after validation

Owner: Google Cloud administrator.

After successful non-Workspace validation, review the shared Gold Shore Labs
project's remaining OAuth clients and features. Delete or narrow scopes only
when each remaining client has an owner and an approved feature-to-scope map.
The old GearSwipe client should be disabled only after its replacement has a
documented rollback window and no production traffic depends on it.

## 4. Migrate service-account keys individually

Owner: named workload owner and Google Cloud administrator.

For each of these targets, identify the workload, current key consumer,
minimum required roles, replacement workload identity, rollback procedure, and
live validation before revocation:

- `github-storage-access` in `mercurial-time-320220` (three user-managed keys)
- default Compute Engine service account in `mercurial-time-320220` (one key)
- `claude` service account in `goldshore-ai` (one key)

Do not create a replacement key, rotate a key, or revoke a key as a bulk
operation.

## 5. Access and DNS boundary

No Cloudflare Access or DNS change is required for this cutover. GearSwipe's
apex and `www` Custom Domains already map to the production Worker, and
`admin@gearswipe.com` remains a mailbox alias rather than an authorization
principal.
