# Cloudflare Route and Binding Repair Plan

## Repository
`marzton/goldshore-ai`

## Objective
Preserve static-first web recovery while isolating app runtime behavior to explicit subdomains and verified bindings.

## Required checks
- Confirm subdomain route ownership for API, admin, preview, and related app surfaces.
- Confirm KV, D1, R2, queue, secret, and service binding availability before deploy.
- Fail deployment when any critical Cloudflare dependency is missing.

## Validation
- Public static host remains reachable.
- Routed worker hosts resolve only where explicitly intended.
