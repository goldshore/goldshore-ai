# GS API secret-name inventory

The canonical inventory is [`apps/gs-api/secret-contract.json`](../apps/gs-api/secret-contract.json). It records only each exact Worker secret name, its owner, its purpose, and the behavior when it is unavailable or invalid. It intentionally contains no values, example values, allowlist contents, acquisition links, environment assignments, or rotation policy.

An authorized operator must enter and rotate values directly in the Cloudflare dashboard (or an approved Cloudflare Secrets Store) for the `gs-api` Worker. Do not paste values into repository files, Wrangler configuration, shell examples, GitHub Actions, or artifacts. Private allowlist contents, including `MAIL_ALLOWED_RECIPIENTS` and `MAIL_BLOCKED_SENDERS`, follow the same dashboard-only procedure.

## Exact GitHub credential names

GitHub integrations do not share an invented generic credential name:

| Integration | Exact name(s) read | Failure behavior |
| --- | --- | --- |
| Admin repository health | `GITHUB_API_TOKEN` | Repository-health GitHub operations are unavailable. |
| Admin deployment assistant | `GITHUB_TOKEN`, then `GITHUB_API_TOKEN`, then `GH_TOKEN` | GitHub-backed assistant operations are unavailable when all three are absent. |
| Admin merge cockpit Worker route | `GITHUB_API_TOKEN`, then `GITHUB_TOKEN`, then `GH_TOKEN` | Worker-side merge-cockpit GitHub operations are unavailable when all three are absent. |
| GitHub OAuth | `GITHUB_CLIENT_SECRET` | OAuth callbacks return a configuration error. |
| GitHub repository webhooks | `GS_GITHUB_WEBHOOK_SECRET` | Webhooks are rejected. |

`GH_PAT` is not a `gs-api` runtime credential and is therefore not part of this inventory.

## Turnstile

Turnstile validation reads `TURNSTILE_SECRET_KEY`. If it is unavailable or invalid, protected form and mail submissions fail closed.
