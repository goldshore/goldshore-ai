# Cloudflare Public Policy

**Version:** 1.1
**Status:** Active

## Goal
Ensure `goldshore.ai` and `www.goldshore.ai` are publicly accessible without aggressive WAF challenges blocking legitimate users.

## Domain Policies

### Public (No WAF Challenge)
These domains must return `200 OK` directly.
- `goldshore.ai`
- `www.goldshore.ai`

### Protected (Access / WAF)
These domains are restricted to authorized personnel or specific IP ranges.
- `admin.goldshore.ai` (Cloudflare Access)
- `preview.goldshore.ai` (Cloudflare Access / Vercel Preview)
- `ops.goldshore.ai` (Internal Tools)

## Verification
Codex must **not** modify WAF rules autonomously.
If a mismatch is detected (e.g., `goldshore.ai` returning 403), report it immediately.

## Configuration Mismatches
*Log any observed discrepancies here.*
- None currently reported.
