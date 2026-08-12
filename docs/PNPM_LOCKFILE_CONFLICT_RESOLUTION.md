# pnpm lockfile conflict policy

`pnpm-lock.yaml` remains tracked. It is required for reproducible local and CI
installs, including the repository baseline `pnpm install --frozen-lockfile`.
Adding a tracked lockfile to `.gitignore` does not stop conflicts, and removing it
would make dependency resolution vary by time and machine.

## Normal branch policy

- Commit `pnpm-lock.yaml` only when a package manifest or workspace dependency
  setting changes.
- Use the repository-pinned `pnpm@9.15.4` from the workspace root.
- Do not run a bot that regenerates the lockfile on every push or pull request.
- Dependabot groups its scheduled pnpm upgrades into one branch, reducing the
  number of concurrent generated lockfile changes.

## Resolve a merge or rebase conflict

First resolve and stage any conflicts in `package.json` files or
`pnpm-workspace.yaml`. Then run:

```bash
pnpm lockfile:resolve
```

The command refuses to proceed while another file is unmerged. When the lockfile
is the only remaining conflict, it deletes the conflicted generated YAML,
regenerates it from the merged manifests, validates a frozen lockfile-only
install, and stages the result. Review `git status` and continue the merge or
rebase. No line-by-line lockfile editing is needed.

This deliberately does not use `.gitattributes` with `merge=ours` or
`merge=union`. Choosing one side can discard dependencies from the other branch,
while concatenating independently valid YAML can produce a corrupt multi-document
lockfile.

## Maintenance workflow

`.github/workflows/lockfile-maintenance.yml` is a manual recovery tool for a
lockfile that is already broken or out of sync on a base branch. It regenerates
from scratch with the pinned pnpm version and opens a single reviewable PR. It
does not run on pushes, PRs, or CI failures, so it cannot race dependency branches
or write generated commits to them.
