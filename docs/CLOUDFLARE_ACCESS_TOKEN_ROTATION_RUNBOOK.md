# Cloudflare Access service-token rotation runbook

Use this runbook when a Cloudflare Access service-token client ID or client secret is exposed. Treat the token as compromised until it has been revoked, replaced, and audited.

## Immediate containment

1. In the Cloudflare Dashboard, open **Zero Trust** > **Access** > **Service Auth** > **Service Tokens**.
<<<<<<< ours
2. Locate the service token by matching the exposed client ID prefix. For urgent incidents, search for the full exposed prefix in the token list before opening individual token records.
3. Revoke or delete the exposed service token immediately; do not wait for the replacement token to be created before containment.
4. Record the token name, associated Access applications, service account or build identity, revocation time, and incident owner in the incident notes. Do not record the client secret.
=======
2. Locate the service token by matching the exposed client ID prefix or the token metadata associated with the exposed client secret.
3. Revoke or delete the exposed service token immediately.
4. For every affected Access application, revoke active Access sessions or application tokens that could have been issued from the exposed service token so any stolen `CF_Authorization` cookie is invalidated before its normal expiry.
5. Record the token name, associated Access applications, service account or build identity, service-token revocation time, Access-session revocation time, and incident owner in the incident notes. Do not record the client secret.
>>>>>>> theirs

## Replacement token

1. Create a new Access service token for the same approved service account or build identity. Cloudflare Worker build automation must use the `gs-control` build token identity.
2. Store the replacement values only in the approved secret store or deployment environment.
3. Update every affected deployment environment with the new service-token values, including both environment variable and HTTP header names used by the affected automation:
   - `CF_ACCESS_CLIENT_ID` / `CF-Access-Client-Id`
   - `CF_ACCESS_CLIENT_SECRET` / `CF-Access-Client-Secret`
4. Redeploy or restart affected automation so the new headers are used.
5. Run a smoke test against the Access-protected endpoint using the replacement token.

## Access-log audit

1. In Cloudflare Zero Trust Access logs, filter for the exposed client ID and the time window from first suspected exposure through revocation.
2. Review source IPs, user agents, countries, target applications, and timestamps for unexpected use.
3. Compare log entries with expected CI, worker build, and maintenance-job schedules.
4. Escalate any unexplained request as a suspected unauthorized access event and preserve the relevant logs.

## Repository and history audit

<<<<<<< ours
1. Search the current tree for the exposed client ID prefix and Access service-token headers before committing any remediation. Include hidden and ignored files so local environment files are checked.
2. Search Git history for the exposed client ID prefix across all refs.
3. If any committed secret value is found, rotate the replacement token again after removal because the first replacement may have been exposed during remediation.
4. Remove the secret from source and purge it from Git history using the repository-approved secret-removal process before publishing the branch.
5. Re-run the current-tree and Git-history searches after the purge to verify the exposed value is absent.
=======
1. Determine every credential indicator that is safe to search for before committing any remediation:
   - If the exposed client ID is known, use the full client ID or a sufficiently unique prefix.
   - If the exposed client secret is known, use the full secret only in local, non-logged commands; otherwise use a sufficiently unique safe prefix, suffix, or fingerprint that cannot be used as the secret itself.
   - Include Access service-token header and environment-variable names such as `CF-Access-Client-Id`, `CF-Access-Client-Secret`, `CF_ACCESS_CLIENT_ID`, and `CF_ACCESS_CLIENT_SECRET`.
2. Search the current tree for each known exposed credential value, safe prefix, suffix, or fingerprint, not just the client ID.
3. Search Git history for each known exposed credential value, safe prefix, suffix, or fingerprint, not just the client ID.
4. If any committed secret value is found, rotate the replacement token again after removal because the first replacement may have been exposed during remediation.
5. Remove the secret from source and purge it from Git history using the repository-approved secret-removal process before publishing the branch.
6. Re-run the current-tree and Git-history searches after the purge to verify every exposed credential indicator is absent.
>>>>>>> theirs

## Verification checklist

- Exposed service token revoked or deleted.
- Active Access sessions or application tokens revoked for each affected Access application.
- Replacement service token created under the approved service account or build identity.
- Secret store or deployment environment updated with `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
- Affected automation redeployed or restarted.
- Access logs audited for unexpected use.
<<<<<<< ours
- Repository current tree and Git history checked for the exposed value, including hidden and ignored files in the working tree and all refs in Git history.
=======
- Repository current tree and Git history checked for every known exposed credential value, safe prefix, suffix, or fingerprint.
>>>>>>> theirs
- Any committed secret removed, purged from history, and rotated again.
