# API Schema & Versioning Rules

## Versioning Contract

All externally consumed API responses from worker handlers should include:

- `apiVersion`: runtime version (`API_VERSION` binding, defaults to `v1`).
- `schemaVersion`: payload schema revision in `YYYY-MM-N` form.

Breaking response changes require:

1. Incrementing `schemaVersion`.
2. Keeping prior path behavior behind a compatibility route or deprecation redirect for at least one release cycle.
3. Updating contract tests before merge.

## Deprecation Rules

When replacing an endpoint path:

- Keep the legacy route in place with `308` redirect where possible.
- Return deprecation metadata headers:
  - `Deprecation: true`
  - `Sunset: <RFC-1123 date>`
  - `Link: </new-path>; rel="successor-version"`

## Critical Endpoint Contract Tests

Critical endpoints are enforced by tests in `apps/gs-api/src/routes/contracts.test.ts`:

- `GET /health`
- `GET /system/version`
- Legacy redirect `GET /user/:id -> /users/:id`

These tests validate response shape and deprecation behavior.
