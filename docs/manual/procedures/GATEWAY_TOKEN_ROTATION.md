# Gateway Dispatch Token Rotation

When rotating the `GS_DISPATCH_TOKEN` secret used by `marzton/goldshore-gateway` to dispatch build events to this repo:

## Process

1. **Generate new token** in GitHub → Settings → Developer settings → Personal access tokens (or GitHub App installation token)
   - Scope: Limited to `marzton/goldshore-ai` repo
   - Permission: `Contents: write` (for repository_dispatch)

2. **Update the secret** in this repo:
   ```bash
   gh secret set GS_DISPATCH_TOKEN --body "$(cat <token_file>)"
   ```

3. **Verify the new token works:**
   ```bash
   gh workflow run verify-gateway-dispatch \
     -f token_owner="<your-name-or-app>" \
     -f expires_on="$(date -d '+90 days' +%Y-%m-%d)"
   ```
   Check the Actions tab for a new run: `dispatch-token-rotation-verify`

4. **Wait for verification** to complete successfully (watch the Actions tab)

5. **Revoke the old token** once verified

---

**Note:** The verification workflow (`verify-gateway-dispatch.yml`) has been archived from `.github/workflows/` to reduce noise. If you need the workflow back, restore from git history or contact the DevOps team.
