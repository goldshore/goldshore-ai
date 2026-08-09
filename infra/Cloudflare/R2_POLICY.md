# R2 storage security and lifecycle policy

Applies to `GS_ASSETS`, `TELEMETRY`, and `RISK_RADAR_R2` production and preview buckets. `gs-api` is the sole Worker binding owner. Buckets are private; public custom domains and anonymous list/read/write are prohibited.

## Upload enforcement

- Require authenticated, authorized API routes. Signed download/upload grants are single-purpose, object-key scoped, expire in at most 15 minutes, and are never logged. Upload grants do not permit overwrite unless explicitly approved.
- Keys are server-generated: `<environment>/<tenant-id>/<classification>/<yyyy>/<mm>/<uuid>.<normalized-ext>`. Reject `..`, backslashes, control characters, leading slashes, user-supplied tenant prefixes, ambiguous Unicode, and keys over 512 bytes. Original names belong only in sanitized metadata.
- Allowlist MIME and magic bytes; both must agree. Media currently permits PNG, JPEG, and sanitized SVG. Never trust extension or `Content-Type`; serve downloads with `nosniff` and safe `Content-Disposition`.
- Maximum object size is 5 MiB for CMS/media, 25 MiB for risk ingestion, and 1 MiB per telemetry object. Larger ingestion requires an approved design and streaming scanner.
- New objects land under a `quarantine/` prefix. A malware-scanning queue/job downloads with a read-only identity, verifies checksum/type, scans content, and copies clean content to its final key. Failed, timed-out, or unavailable scans fail closed; infected objects are isolated for 7 days with security metadata, then deleted unless held for an incident.

## CORS and access

Production origins: `https://goldshore.ai`, `https://admin.goldshore.ai`, and `https://goldshore.org`. Preview origins: `https://preview.goldshore.ai` and `https://admin-preview.goldshore.ai`. Allow only `GET`, `HEAD`, and explicitly signed `PUT`; allow headers `Content-Type`, `Content-MD5`, and request-id; expose only `ETag`; cache preflight at most 3600 seconds. Wildcard origins, credentials with wildcard origins, bucket listing, and browser-held R2 credentials are forbidden.

## Lifecycle, retention, backup, deletion

| Bucket class | Lifecycle |
|---|---|
| Assets | Abort incomplete multipart uploads after 1 day; quarantine expires after 7 days; unreferenced/soft-deleted objects expire after 30 days; published objects remain while referenced. Keep critical-original inventory and protected copy/export. |
| Telemetry | Abort incomplete uploads after 1 day; production expires after 90 days, preview after 14 days. No routine backup; incident hold overrides expiry. |
| Risk raw | Abort incomplete uploads after 1 day; production expires after 90 days, preview after 14 days. Source is re-fetchable; inventory is the backup record. |

Deletion requests first remove references, write an audit record, and soft-delete/tag the object. A lifecycle rule deletes after the applicable window. Legal or incident holds suspend lifecycle deletion. Bucket deletion requires owner and security approval, empty/inventory evidence, backup verification where applicable, disabled producers, a 30-day quarantine (7 days for disposable preview), and a final binding scan.
