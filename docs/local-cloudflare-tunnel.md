# Local Cloudflare Tunnel

This clone is wired for a LaCie-hosted local stack exposed through Cloudflare
Tunnel without taking over production `goldshore.ai` or `goldshore.org`
hostnames.

## Local Services

- `@goldshore/gs-web`: `http://127.0.0.1:4321`
- `@goldshore/gs-api`: `http://127.0.0.1:8787`
- Tunnel config: `C:\Users\marst\.cloudflared\goldshore-lacie-local.yml`
- Tunnel ID: `ff3af5ef-fa24-4111-9e3b-96e4e4c78925`

## VS Code

Run task `dev:goldshore-lacie` from `.vscode/tasks.json` to start:

- `dev:gs-web`
- `dev:gs-api`
- `tunnel:goldshore-lacie`

The workspace file also exposes equivalent tasks with spaced labels:

- `dev: gs-web`
- `dev: gs-api`
- `tunnel: goldshore-lacie`
- `dev: goldshore-lacie`

## Tunnel Hostnames

Web-origin hostnames route to `gs-web` and override the origin `Host` header to
the production hostname expected by the app:

- `https://lacie.goldshore.ai` -> `Host: goldshore.ai`
- `https://www-lacie.goldshore.ai` -> `Host: www.goldshore.ai`
- `https://admin-lacie.goldshore.ai` -> `Host: admin.goldshore.ai`
- `https://risk-lacie.goldshore.ai` -> `Host: risk.goldshore.ai`
- `https://preview-lacie.goldshore.ai` -> `Host: preview.goldshore.ai`

API-origin hostnames route to `gs-api` and override the origin `Host` header to
the production hostname expected by host-based routing:

- `https://api-lacie.goldshore.ai` -> `Host: api.goldshore.ai`
- `https://agent-lacie.goldshore.ai` -> `Host: agent.goldshore.ai`
- `https://mail-lacie.goldshore.ai` -> `Host: mail.goldshore.ai`
- `https://ops-lacie.goldshore.ai` -> `Host: ops.goldshore.ai`
- `https://trading-lacie.goldshore.ai` -> `Host: trading.goldshore.ai`
- `https://dashboard-lacie.goldshore.ai` -> `Host: dashboard.goldshore.ai`
- `https://dash-lacie.goldshore.ai` -> `Host: dash.goldshore.ai`
- `https://gw-lacie.goldshore.ai` -> `Host: gw.goldshore.ai`

Do not point live production records such as `goldshore.ai`,
`api.goldshore.ai`, or `admin.goldshore.org` at this tunnel.

## `.org` Tunnel Hostnames

The local `cloudflared` ingress also exposes `.goldshore.org` test hostnames:

- `https://lacie.goldshore.org` -> `Host: goldshore.org`
- `https://www-lacie.goldshore.org` -> `Host: www.goldshore.org`
- `https://admin-lacie.goldshore.org` -> `Host: admin.goldshore.org`
- `https://risk-lacie.goldshore.org` -> `Host: risk.goldshore.org`
- `https://api-lacie.goldshore.org` -> `Host: api.goldshore.org`

These DNS records are active in the `goldshore.org` zone. The accidental
`*.goldshore.org.goldshore.ai` records that were created in the `goldshore.ai`
zone during setup have been removed.
