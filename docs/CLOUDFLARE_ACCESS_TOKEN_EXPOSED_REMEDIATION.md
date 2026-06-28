# Cloudflare Access token exposure remediation: `<exposed-client-id-prefix>...`

Use this incident checklist for the exposed Cloudflare Access service token whose client ID begins with `<exposed-client-id-prefix>`. Treat the token as compromised until every item below is complete.

## 1. Contain the exposed token

1. Open the Cloudflare Dashboard for the Goldshore account.
2. Go to **Zero Trust** > **Access** > **Service Auth** > **Service Tokens**.
3. Find the token whose client ID starts with `<exposed-client-id-prefix>`.
4. Revoke or delete the token immediately.
5. Record the token name, owner, affected Access applications, revocation timestamp, and operator in the incident notes. Do **not** record the client secret.

## 2. Create the replacement token

1. Create a new Cloudflare Access service token for the same approved service account or build identity.
2. For API services, workers, and build automation, use the `gs-control` build identity in accordance with the repository build policy.
3. Copy the replacement values directly into the approved secret store. Do not paste token values into tickets, chat, source files, commit messages, or PR descriptions.

## 3. Update affected environments

Update every affected secret store or deployment environment with these replacement values:

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Affected clients must continue sending the values as Cloudflare Access headers:

- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`

After updating secrets, redeploy or restart the affected worker build, CI job, service, or scheduled automation so the rotated token is loaded.

## 4. Validate the replacement

Run a smoke test against each Access-protected endpoint from the expected build or service environment. For the Jules sync endpoint, use:

```bash
CF_ACCESS_CLIENT_ID='<new-client-id>' \
CF_ACCESS_CLIENT_SECRET='<new-client-secret>' \
./scripts/jules-sync.sh https://gs-admin.pages.dev/
```

The script must return a 2xx status before the incident can be closed.

## 5. Audit Cloudflare Access logs

In Cloudflare Zero Trust Access logs, filter for the exposed client ID prefix `<exposed-client-id-prefix>` from the first suspected exposure through the revocation timestamp.

Review and preserve:

- Source IP addresses
- User agents
- Countries or regions
- Target applications
- Request timestamps
- Request outcomes

Compare all log entries with expected CI, worker build, maintenance job, and operator activity. Escalate any unexplained request as a suspected unauthorized access event.

## 6. Repository and Git-history verification

Before publishing remediation work, verify that the exposed client ID prefix is absent from the current tree and Git history:

```bash
rg -n "<exposed-client-id-prefix>" .
```

```bash
git log --all --format='%H' | while read commit; do
  git grep -n "<exposed-client-id-prefix>" "$commit" || true
done
```

If the exposed token or any replacement token was committed, remove the value from source, rotate the replacement token again, and purge the secret from Git history using the repository-approved secret-removal process before publishing the branch.
