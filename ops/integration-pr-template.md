# Integration PR: conflict-resolution baseline

## Summary
- Base: `<base-commit-sha>`
- Integration branch: `<integration-branch>`
- Merge window: `<start-date>` → `<end-date>`

## Merged branches (ordered)
| Branch | Score | Merge status | Notes |
| --- | --- | --- | --- |
| `<branch>` | `<score>` | clean/conflict | `<notes>` |

## Conflict resolutions
- `<file>`: `<decision and rationale>`

## Canonicalization policy
- Follow `docs/migration/canonicalization-policy.md` for deterministic file handling and conflict decisions.
- Document any policy exception in **Conflict resolutions** with rationale.

## Regenerated artifacts
- `pnpm-lock.yaml`: regenerated after merging `<branch list>`

## Checks
- `pnpm -w install`
- `pnpm -w -s build`
- `pnpm -w -s lint`
- `pnpm -w -s typecheck`
- `pnpm -w -s test`
- Optional: `pnpm --filter=@goldshore/web build`
- Optional: `pnpm e2e`

## Review requests
- @Jules-Bot [review-request]

## Notes
- `<additional context, links, or logs>`
