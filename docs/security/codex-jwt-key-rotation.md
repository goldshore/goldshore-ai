# Codex JWT HS256 Key Rotation

Use this runbook to rotate `CODEX_JWT_HS256_KEY` without committing or printing the key material.

## Generate and deploy the new key

Run from the repository root on a workstation or CI runner that is authenticated to both GitHub and Cloudflare:

```bash
node scripts/rotate-codex-jwt-hs256-key.mjs \
  --repo OWNER/REPO \
  --cloudflare-workers gs-agent,gs-api,gs-control,gs-gateway,gs-platform \
  --old-fingerprint PREVIOUS_KEY_SHA256
```

The script uses Node `crypto.randomBytes(64)` to generate a 512-bit random key suitable for HS256, writes the key to GitHub repository secret `CODEX_JWT_HS256_KEY`, and writes the same value to each listed Cloudflare Worker secret. The secret value is never printed; only its SHA-256 fingerprint is displayed for audit and deny-listing.

If either store is not in scope for a rotation, use `--skip-github` or `--skip-cloudflare`. Use `--dry-run` to verify the intended targets without writing remote secrets.

## Cutover requirements

1. Redeploy every affected worker or service after secret updates so the runtime reads the replacement value.
2. Invalidate existing Codex JWT sessions immediately after deploy. If central invalidation is unavailable, temporarily reduce JWT max age below the expected deployment propagation window before rotation, then restore the normal max age after verification.
3. Verify token issuance and verification with the new key from a non-production test principal before returning the service to normal traffic.
4. Monitor authentication failures during the cutover window and roll forward by re-running the script if a store was missed.

## Exposure checks

Search all repositories and logs for accidental copies of the previous key and for both the old and new SHA-256 fingerprints. Do not paste raw key material into terminals that are logged; prefer scanning from a local file descriptor or a sealed CI secret.

Recommended repository checks:

```bash
rg --hidden --no-ignore -n "CODEX_JWT_HS256_KEY|OLD_KEY_SHA256|NEW_KEY_SHA256" .
git log --all -S 'CODEX_JWT_HS256_KEY' -- .
```

Recommended platform checks:

- GitHub code search across the organization for `CODEX_JWT_HS256_KEY` and the previous key fingerprint.
- Cloudflare Workers logs for the previous key fingerprint or any pasted raw key material.
- Incident, ticket, and chat exports where the old key may have been pasted during troubleshooting.

## Secret-scanning deny list

If your scanner supports custom deny lists or high-confidence fingerprints, add the previous key SHA-256 fingerprint after the rotation. Keep deny-list entries to fingerprints or scanner-supported hashed indicators; do not store the raw old key in repository configuration.
