# Gateway dispatch token rotation

This runbook reduces risk for the cross-repository dispatch path from `marzton/goldshore-gateway` to `marzton/goldshore-ai`.

## Workflow inventory

The `marzton/goldshore-gateway` repository must be checked before every rotation for workflows that reference `GS_DISPATCH_TOKEN`.

Use this command from a fresh checkout of `marzton/goldshore-gateway`:

```bash
rg -n "GS_DISPATCH_TOKEN|repository_dispatch|workflow_dispatch|dispatches" .github/workflows
```

Record each matching workflow in the rotation ticket. As of this repo update, the receiving workflow in `marzton/goldshore-ai` is `.github/workflows/deploy-dispatch.yml`, which accepts the `deploy` `repository_dispatch` event. The manual verification workflow is `.github/workflows/verify-gateway-dispatch.yml`, which sends and receives `dispatch-token-rotation-verify` events.

## Replacement token requirement

Replace the old classic PAT with one of the following, in preference order:

1. A GitHub App installation token for an app installed only on the required repositories.
2. A fine-grained PAT restricted to the minimum required repositories.

For `repository_dispatch` to `marzton/goldshore-ai`, grant only:

- Repository access: `marzton/goldshore-ai`.
- Repository permission: `Contents: Read and write` for the REST `repository_dispatch` endpoint.
- Metadata read access, which GitHub grants automatically with repository access.

If the gateway workflow uses `workflow_dispatch` instead of `repository_dispatch`, grant `Actions: Read and write` only for the target repository and document that exception in the rotation ticket.

## Ownership and expiration

Set a short expiration on the replacement credential:

- Preferred: 30 days.
- Maximum: 90 days unless an incident commander approves a one-time exception.

Document the owner in both places below:

1. The GitHub secret description or organization secret note, if available.
2. The rotation ticket, with the owner, expiration date, target repositories, and granted permissions.

## Rotation procedure

1. Inventory every `marzton/goldshore-gateway` workflow that references `GS_DISPATCH_TOKEN`.
2. Create the GitHub App installation token automation or fine-grained PAT with the permissions above.
3. Update the `GS_DISPATCH_TOKEN` secret in `marzton/goldshore-gateway` with the replacement token value.
4. Run **Verify gateway repository dispatch token** from `marzton/goldshore-ai` Actions and enter the documented owner and expiration date.
5. Confirm the manual workflow reports HTTP `204` and that a paired `dispatch-token-rotation-verify` repository-dispatch run appears in Actions.
6. Run the gateway workflow that normally sends the production `deploy` dispatch, or trigger its safest staging equivalent.
7. Revoke the old classic PAT only after both verification runs pass.
8. Add the revocation timestamp and validation run links to the rotation ticket.

## Rollback

Do not restore the classic PAT unless production deployment is blocked and the incident commander approves the temporary rollback. If rollback is approved, set an expiration of 24 hours or less, repeat the verification workflow, and open a follow-up ticket to replace it again.
