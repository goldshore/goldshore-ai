# Cloudflare Access Policy Audit

Merge Strategy: Merge Commit

Generated: 2026-07-14T21:43:12.512Z
Account: f77de112d2019e5456a3198a8bb50bd2
Desired state: E:\OneDrive\Documents\goldshore-ai\infra\Cloudflare\desired-state.yaml
Auth source names: runtime:CLOUDFLARE_SYNC_AUTH_TOKEN, runtime:CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN, runtime:CLOUDFLARE_API_TOKEN

No API tokens, OAuth client secrets, or Access service-token secrets are included.

## Summary

- Overall: FAIL
- Live Access apps: 10
- Desired policies checked: 7
- Policy/domain issues: 38
- Warnings: 28
- Smoke tests: 0/0 passed

## Desired Policy Results

| Desired policy | Source | Result | Matching exact app(s) | Issues |
| --- | --- | --- | --- | ---: |
| `GoldShore-Admin-ZT` | infra/Cloudflare/desired-state.yaml | FAIL |  | 7 |
| `Goldshore Ops` | infra/Cloudflare/desired-state.yaml | FAIL |  | 5 |
| `GoldShore-Trading-ZT` | infra/Cloudflare/desired-state.yaml | FAIL |  | 7 |
| `Goldshore Gateway` | infra/Cloudflare/desired-state.yaml | FAIL |  | 6 |
| `Goldshore API` | infra/Cloudflare/desired-state.yaml | FAIL |  | 6 |
| `GoldShore-Web-Preview` | infra/Cloudflare/desired-state.yaml | FAIL |  | 5 |
| `GoldShore-MCP-ZT` | infra/Cloudflare/desired-state.yaml | FAIL | Goldshore MCP Portal (mcp_portal) | 2 |

### GoldShore-Admin-ZT

Issues:
- admin.goldshore.ai has no exact acceptable Access application.
- admin.goldshore.org has no exact acceptable Access application.
- admin-preview.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.

Warnings:
- admin.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- admin-preview.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches GoldShore-Admin-ZT.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### Goldshore Ops

Issues:
- ops.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.

Warnings:
- ops.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches Goldshore Ops.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### GoldShore-Trading-ZT

Issues:
- trading.goldshore.ai has no exact acceptable Access application.
- dashboard.goldshore.ai has no exact acceptable Access application.
- dash.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.

Warnings:
- trading.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- dashboard.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- dash.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches GoldShore-Trading-ZT.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### Goldshore Gateway

Issues:
- gw.goldshore.ai has no exact acceptable Access application.
- agent.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.

Warnings:
- gw.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- agent.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches Goldshore Gateway.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### Goldshore API

Issues:
- api.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.
- AUD mismatch or missing for Goldshore API; expected d303765cb1746f11a0fe37affad2d191deb18771a1d98beb29cb9c52b6cd731b.

Warnings:
- api.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches Goldshore API.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### GoldShore-Web-Preview

Issues:
- preview.goldshore.ai has no exact acceptable Access application.
- Missing allow include selector for email domain goldshore.ai.
- Missing allow include selector for email marstonr6@gmail.com.
- Missing allow include selector for email goldshorelabs@gmail.com.
- Missing allow include selector for email admin@goldshore.org.

Warnings:
- preview.goldshore.ai is only wildcard-covered by * (ssh); exact app coverage is still required.
- No exact app or policy name matches GoldShore-Web-Preview.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.

### GoldShore-MCP-ZT

Issues:
- Missing allow include selector for email domain goldshore.ai.
- Policy Service Login on Goldshore MCP Portal allows everyone.

Warnings:
- No exact app or policy name matches GoldShore-MCP-ZT.
- google_workspace: The matching app does not explicitly restrict allowed_idps.
- github_goldshore_deploy: The matching app does not explicitly restrict allowed_idps.
- github_goldshore_deploy: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.
- github: The matching app does not explicitly restrict allowed_idps.
- email_otp: The matching app does not explicitly restrict allowed_idps.

## Identity Providers

| Name | Type | Explicit ID |
| --- | --- | --- |
| (unnamed) | onetimepin | `12fe6296-fb0c-495f-98ce-8ed022b9e13f` |
| Gold Shore Cloudflare Access | github | `8a93fc78-a057-4e9e-bde4-c6515ef4b9c4` |
| Google | google | `b05ff0c1-08de-4b34-83a7-0eb427fed15b` |
| CloudFlare GitHub IDP | github | `b2795891-ffe8-4e7c-84b0-9221f0f1497d` |

## Host Smoke Tests

Smoke tests were skipped.

## Live Access Apps

| App | Type | Domains | Policy decisions | AUD |
| --- | --- | --- | --- | --- |
| * | ssh | `*.goldshore.ai`<br>`*.goldshore-github-io.pages.dev`<br>`*.gs-web-bon.pages.dev`<br>`*.goldshore.workers.dev` | Service Login:allow<br>gs-agent - Production:allow<br>METHODS:allow<br>gs-signals-prod - Production:allow<br>gs-mail-prod - Production:allow<br>banproof-me - Production:allow<br>rmarston-com - Production:allow<br>goldshore-ai - Production:allow<br>banproof-me - Production:allow<br>Cloudflare Workers Preview URLs:allow<br>gs-api - Production:allow<br>marstonr6@gmail.com:allow<br>gs-platform - Production:allow<br>goldshore-core - Production:allow<br>gs-agent - Production:allow | `4c5083024ace5fdc2a4d64a6970722f60e0a6fa123203584095ee579ffc35d10` |
| App Launcher | app_launcher | `goldshore.cloudflareaccess.com` | Service Login:allow<br>METHODS:allow<br>banproof-me - Production:allow<br>gs-mail-prod - Production:allow<br>rmarston-com - Production:allow<br>goldshore-ai - Production:allow<br>Cloudflare Workers Preview URLs:allow<br>banproof-me - Production:allow<br>marstonr6@gmail.com:allow<br>gs-api - Production:allow<br>gs-platform - Production:allow<br>goldshore-core - Production:allow<br>gs-agent - Production:allow | `c9b97a62732ed8d7b64f64f89975e47c3d91df21ddbe8a7c14acdd097e7e4e1a` |
| Goldshore MCP Portal | mcp_portal | `mcp.goldshore.ai`<br>`mcp.goldshore.org` | Service Login:allow<br>Cloudflare Workers Preview URLs:allow | `95aa2409100eea09257ab2d3a41451fe8407db48493840686e6077e3444610b4` |
| gs-admin - Cloudflare Pages | self_hosted | `*.gs-admin.pages.dev` | Allow Members - Cloudflare Pages:allow | `099bd7dbac57461bfa834021a54aaeea7616df540e2e07f79ba7a5c6f3e0dc66` |
| gs-agent - Cloudflare Workers | ssh | `agent.goldshore.workers.dev` | gs-agent - Production:allow | `54a690d758fad666ae49b3ef80dbbe0f6d2403cb23b87fcf78a92e82bd029655` |
| gs-api - Cloudflare Workers | self_hosted | `gs-api.goldshore.workers.dev` | gs-api - Production:non_identity | `1aeaef79b62df71d59ad0af52da92a9de9382d37f54ff9c2bb8a4f699d9fe5f6` |
| gs-mail - Cloudflare Workers | self_hosted | `gs-mail.goldshore.workers.dev` | gs-mail - Production:allow | `ac22e6f95382ab4734296d2df71ce8aa38583cf55396632e11d63f4003f94aae` |
| SSO App | dash_sso | `goldshore.cloudflareaccess.com/cdn-cgi/access/sso/saml/14fe63cce321f681a596e04ca0ac0df291d09587a51c0188063f390b2c7eb85d` | Allow email domain goldshore.ai:allow | `14fe63cce321f681a596e04ca0ac0df291d09587a51c0188063f390b2c7eb85d` |
| Temp HP Laptop SSH | ssh | `ssh-laptop.goldshore.ai` | Allow marstonr6 only:allow | `d3f80a696e1a498c3f21eedb404e17b66b894e6ab6118b4e99e92e8782735c62` |
| Warp Login App | warp | `goldshore.cloudflareaccess.com/warp` | marstonr6@gmail.com:allow<br>Allow emails: 6/26/2026:allow | `3878ea30f76495257a4881573f15e38ea5704298c8f1d523eadb4f7fff7026b8` |

## Next Actions

- Fix missing exact Access applications before relying on wildcard app coverage.
- Keep public health/version/OAuth callback routes on explicit bypass apps or path-specific Access bypass policies.
- Keep alternative IdPs in app login methods or separate OR policies, not multiple Require selectors.
- Re-run this audit after Cloudflare changes and attach the sanitized markdown report to the agent handoff.

