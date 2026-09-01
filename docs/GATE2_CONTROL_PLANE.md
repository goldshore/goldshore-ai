# Gate 2 control-plane handoff

This repository records the desired production boundary in
`infra/Cloudflare/gate2-control-plane.desired-state.json`. It is a review
artifact, not deploy input. Its `apply` flag must remain `false`.

## Implemented Gate 2 preparation

- GearSwipe's apex and `www` production Custom Domains are recorded as owned
  by the `gearswipe` Worker.
- The GoldShore admin Access application, public-pages bypass boundary, and
  identity-provider model are recorded without credential material.
- The OAuth cutover is deliberately split: an owner creates the dedicated
  OIDC-only client through a secure Google session; an operator then performs
  the Worker secret cutover and records a non-Workspace sign-in validation.
- Existing user-managed service-account keys have individual migration
  records. No key is revoked until its named replacement passes a live test.

## Non-negotiable boundaries

- Google OAuth consent scopes are configured at project level. Do not delete
  shared-project scopes merely to narrow GearSwipe's client.
- `admin@gearswipe.com` is a mailbox alias, not an Access or admin-role grant.
- Keep credentials out of KV, source control, review artifacts, and chat.
- Do not use this artifact to apply Cloudflare routes, Access policies, DNS,
  Google clients, IAM roles, or secret values automatically.
