# Gateway dispatch retirement

The cross-repository deployment receiver was retired on 2026-08-09. This
repository no longer accepts a `deploy` `repository_dispatch` event, and the
former `.github/workflows/deploy-dispatch.yml` workflow must not be restored.
It accepted caller-controlled repositories, refs, commands, directories, and
health-check URLs while exposing this repository's production Cloudflare token
to the checked-out code.

Gold Shore gateway, agent, mail, trading, and control-plane behavior belongs in
`apps/gs-api`; public and admin UI behavior belongs in `apps/gs-web`. Deploy
those applications only through their repository-owned workflows.

## External repository cleanup

The owner of `marzton/goldshore-gateway` must remove any workflow that sends the
retired `deploy` event and revoke its `GS_DISPATCH_TOKEN`. Use the following
command from a fresh checkout to locate remaining callers:

```bash
rg -n "GS_DISPATCH_TOKEN|repository_dispatch|workflow_dispatch|dispatches" .github/workflows
```

An external project that still owns an independent Cloudflare resource must
deploy from its own repository. Its workflow must use:

- a project-specific Cloudflare token scoped only to that project's resources;
- a protected, project-specific GitHub environment;
- repository-owned commands and directories; and
- a commit SHA rather than a mutable branch or tag for cross-repository source.

Do not give external projects `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN`, and do not
add a generic deployment dispatcher back to this repository. A production
blocker requires an architecture and security review; it is not grounds to
restore the retired workflow or a classic PAT.
