# Cloudflare Access service-token rotation runbook

Use this runbook when a Cloudflare Access service-token client ID or client secret is exposed. Treat the token as compromised until it has been revoked, replaced, and audited.

## Immediate containment

1. In the Cloudflare Dashboard, open **Zero Trust** > **Access** > **Service Auth** > **Service Tokens**.
2. Locate the service token by matching the exposed client ID prefix.
3. Revoke or delete the exposed service token immediately.
4. Record the token name, associated Access applications, service account or build identity, revocation time, and incident owner in the incident notes. Do not record the client secret.

## Replacement token

1. Create a new Access service token for the same approved service account or build identity. Cloudflare Worker build automation must use the `gs-control` build token identity.
2. Store the replacement values only in the approved secret store or deployment environment.
3. Update every affected deployment environment with the new `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` values.
4. Redeploy or restart affected automation so the new headers are used:
   - `CF-Access-Client-Id`
   - `CF-Access-Client-Secret`
5. Run a smoke test against the Access-protected endpoint using the replacement token.

## Access-log audit

1. In Cloudflare Zero Trust Access logs, filter for the exposed client ID and the time window from first suspected exposure through revocation.
2. Review source IPs, user agents, countries, target applications, and timestamps for unexpected use.
3. Compare log entries with expected CI, worker build, and maintenance-job schedules.
4. Escalate any unexplained request as a suspected unauthorized access event and preserve the relevant logs.

## Repository and history audit

1. Search the current tree for the exposed client ID prefix and Access service-token headers before committing any remediation.
2. Search Git history for the exposed client ID prefix.
3. If any committed secret value is found, rotate the replacement token again after removal because the first replacement may have been exposed during remediation.
4. Remove the secret from source and purge it from Git history using the repository-approved secret-removal process before publishing the branch.
5. Re-run the current-tree and Git-history searches after the purge to verify the exposed value is absent.

## Verification checklist

- Exposed service token revoked or deleted.
- Replacement service token created under the approved service account or build identity.
- Secret store or deployment environment updated with `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
- Affected automation redeployed or restarted.
- Access logs audited for unexpected use.
- Repository current tree and Git history checked for the exposed value.
- Any committed secret removed, purged from history, and rotated again.
