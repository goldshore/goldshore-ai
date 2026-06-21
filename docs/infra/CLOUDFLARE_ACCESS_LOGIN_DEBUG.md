# Cloudflare Access Login Failure and Subdomain Health Evidence Runbook

Use this runbook when collecting incident evidence for Cloudflare Access login failures or subdomain health checks. It is designed for sanitized issue, PR, and chat updates that help reviewers verify what happened without exposing credentials.

## Safety and redaction rules

Do **not** paste or upload any of the following into issues, PRs, chat, screenshots, logs, or shared documents:

- OAuth client secrets
- Cloudflare API tokens
- Cloudflare Access service-token secrets
- Private keys, certificates with private-key material, or unredacted key files
- Session cookies, authorization headers, one-time login links, or bearer tokens

Before sharing screenshots, redact secrets and unnecessary personal data. Keep only the fields needed for incident review, such as the identity email for the affected tester, the relevant hostname, timestamps, Ray IDs, response statuses, policy decisions, and deployment versions.

## Evidence to capture

Capture the following fields for each affected login attempt or subdomain check:

| Field | Where to find it | Notes |
| --- | --- | --- |
| Application name | Cloudflare Zero Trust > Access > Applications | Use the Access application display name. |
| Policy decision | Cloudflare Zero Trust > Logs > Access | Record allow, block, bypass, service auth, or other decision shown by the event. |
| Identity email | Cloudflare Zero Trust > Logs > Access | Redact aliases or unrelated identities; keep the affected tester email when needed. |
| IdP used | Cloudflare Zero Trust > Logs > Access, or Settings > Authentication > Login methods | Record the identity provider name, such as Google Workspace, GitHub, Azure AD, or One-time PIN. |
| AUD tag | Cloudflare Zero Trust > Access > Applications > selected application > Overview or Settings | Redact only if policy requires it; do not confuse it with client secrets. |
| Hostname | Cloudflare dashboard > Websites > selected zone > DNS > Records, or Access application domain list | Include the exact subdomain being tested. |
| Ray ID | Browser error page, response headers, Cloudflare security events, Worker logs, or Access logs | Capture the full Ray ID when visible. |
| Response status | Browser devtools Network tab, `curl -I`, Pages deployment status, or Worker logs | Record HTTP status such as 200, 302, 401, 403, 404, 500, or 522. |
| Deployment version | Cloudflare Workers & Pages > selected Pages project > Deployments, or Workers & Pages > selected Worker > Deployments | Include deployment ID, version, branch, and commit SHA when available. |

## Cloudflare dashboard paths

Use these Cloudflare dashboard locations to collect evidence. Menu names can vary slightly by account layout, but the paths below should map to the current Zero Trust, Workers, Pages, and DNS sections.

### Access login events

1. Open **Cloudflare dashboard > Zero Trust**.
2. Go to **Logs > Access**.
3. Filter by the affected hostname, application name, identity email, Ray ID, or incident time window.
4. Open the matching event and record the application name, policy decision, identity email, IdP used, AUD tag when shown, hostname, Ray ID, and timestamp.
5. Screenshot the event details only after redacting unrelated identities, tokens, cookies, and headers.

### Access applications

1. Open **Cloudflare dashboard > Zero Trust**.
2. Go to **Access > Applications**.
3. Select the affected application.
4. Verify the application name, public hostname, configured policies, IdP requirements, session duration, and AUD tag.
5. Screenshot the application overview or policy list only after redacting sensitive names or unrelated policy data.

### Identity providers

1. Open **Cloudflare dashboard > Zero Trust**.
2. Go to **Settings > Authentication > Login methods**.
3. Select the IdP used by the affected login attempt.
4. Verify provider status, allowed domains, login method name, and recent configuration changes.
5. Do **not** capture OAuth client secrets or private key material. If a screenshot includes a secret field, fully redact it before sharing.

### Pages deployments

1. Open **Cloudflare dashboard > Workers & Pages**.
2. Select the affected **Pages** project.
3. Go to **Deployments**.
4. Record the active production or preview deployment version, deployment ID, branch, commit SHA, build status, build time, and custom domain association.
5. Compare the deployment timestamp with the first observed login failure or health-check failure.

### Worker logs

1. Open **Cloudflare dashboard > Workers & Pages**.
2. Select the affected Worker.
3. Go to **Logs** or **Observability > Logs**, depending on the dashboard layout.
4. Filter by hostname, route, Ray ID, response status, request path, deployment version, and incident time window.
5. Record relevant errors and response statuses, but redact authorization headers, cookies, API tokens, service-token secrets, and private keys.

### DNS and custom domains

1. Open **Cloudflare dashboard > Websites**.
2. Select the affected zone, such as `goldshore.ai`.
3. Go to **DNS > Records** and confirm the hostname record, proxy status, target, and TTL.
4. For Pages custom domains, go to **Workers & Pages > selected Pages project > Custom domains**.
5. For Worker routes, go to **Workers & Pages > selected Worker > Settings > Triggers > Routes & Custom Domains**.
6. Record the hostname, target, route/custom-domain binding, certificate status, response status, and any validation error.

## Subdomain health-check procedure

Run these checks from a clean browser profile and a terminal. Replace placeholders before running commands.

1. Confirm DNS resolves for the affected hostname:

   ```sh
   dig +short <hostname>
   ```

2. Capture response headers and status:

   ```sh
   curl -I https://<hostname>/
   ```

3. Capture redirect behavior without following secrets or authenticated URLs:

   ```sh
   curl -sS -o /dev/null -D - https://<hostname>/
   ```

4. If the response includes a Cloudflare error page, record the Ray ID, status code, hostname, and timestamp.
5. If the response redirects to Access, attempt login with the expected IdP and capture the sanitized Access event.
6. Compare the result with the current Pages deployment, Worker deployment, Access application, DNS record, and custom-domain binding.

## Sanitized findings template

Copy this template into an issue, PR, or chat update after removing secrets and unrelated personal data.

```md
## Incident evidence summary

- Incident window (UTC): <YYYY-MM-DD HH:MM> to <YYYY-MM-DD HH:MM>
- Reporter / tester identity email: <user@example.com or redacted-user@example.com>
- Hostname: <subdomain.example.com>
- Application name: <Cloudflare Access application name>
- Policy decision: <allow | block | bypass | service auth | other>
- IdP used: <IdP display name>
- AUD tag: <aud tag or redacted if required>
- Ray ID: <ray id or not visible>
- Response status: <HTTP status>
- Deployment version: <Pages/Worker deployment ID, version, branch, commit SHA>

## What was tested

- Browser/profile used: <clean profile, incognito, or normal profile>
- Health-check commands run:
  - `dig +short <hostname>` -> <sanitized result>
  - `curl -I https://<hostname>/` -> <status and key headers only>
- Dashboard areas checked:
  - Zero Trust > Logs > Access: <event found / not found>
  - Zero Trust > Access > Applications: <configuration summary>
  - Zero Trust > Settings > Authentication > Login methods: <IdP summary, no secrets>
  - Workers & Pages > <Pages project> > Deployments: <deployment summary>
  - Workers & Pages > <Worker> > Logs: <error/status summary>
  - Websites > <zone> > DNS > Records: <record summary>
  - Workers & Pages > <Pages project> > Custom domains: <domain status>

## Screenshots

Attach screenshots only after redacting:

- OAuth client secrets
- Cloudflare API tokens
- Access service-token secrets
- Private keys
- Session cookies and authorization headers
- Unrelated user identities or unrelated domains

Screenshots attached:

1. <Access log event screenshot, sanitized>
2. <Access application policy screenshot, sanitized>
3. <Pages or Worker deployment screenshot, sanitized>
4. <DNS/custom-domain status screenshot, sanitized>

## Current assessment

- Likely failing layer: <Access policy | IdP | DNS | Pages deployment | Worker route/logs | unknown>
- Evidence supporting assessment: <brief bullets>
- Next action requested: <review, rollback, policy update, DNS fix, redeploy, or more evidence>
```

## Review checklist

Before posting the findings, confirm that:

- The exact application name, policy decision, identity email, IdP used, AUD tag, hostname, Ray ID, response status, and deployment version are captured when available.
- The incident timestamps are in UTC.
- Screenshots are cropped to the relevant event or configuration.
- OAuth client secrets, Cloudflare API tokens, service-token secrets, private keys, cookies, and authorization headers are fully redacted.
- The summary identifies whether the likely failing layer is Access, the IdP, DNS/custom domains, Pages deployment, or Worker routing/logging.
