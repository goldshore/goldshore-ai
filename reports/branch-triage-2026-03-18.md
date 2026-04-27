# Branch Triage Recommendations — 2026-03-18 (UTC)

## Scope

This report triages the open pull requests that target `main` and are currently ahead of `main`.
The goal is to reduce the open-branch-ahead-of-main count safely by separating:

- duplicate / superseded branches
- stale branches
- cherry-pick-only candidates
- high-risk / conflict-heavy branches

These are disposition recommendations, not merge approvals.

## Summary

- `main` is not aligned.
- There are 28 open PR branches targeting `main` and ahead of it.
- No open PR targeting `main` is recommended for direct merge as-is.
- The fastest cleanup path is to close duplicate branch families first, then salvage a small number of scoped changes via cherry-pick or branch recreation.

## Recommended buckets

### Duplicate / superseded

#### Favicon family
Keep only one representative for review and close the rest.

- Keep for final review only: **#3869**
- Close as duplicate / superseded:
  - #3344
  - #3795
  - #3847
  - #3883
  - #3884
  - #3885

Rationale:
- same narrow favicon/layout scope
- nearly identical titles and file sets
- extreme divergence from `main`

#### Resolve-conflicts family
Close all of these and regenerate from current `main` if conflict resolution is still needed.

- #3347
- #3385
- #3583

Rationale:
- same apparent purpose
- same ahead/behind profile
- same large file footprint
- conflict-resolution branches should not be preserved indefinitely

#### Legacy infra family duplicates
Keep one representative and close the repeated variants.

- Keep for review only: **#3882**
- Close as duplicate / superseded:
  - #3841
  - #3870
  - #3881

Rationale:
- repeated branch family with the same title and overlapping infra scope
- `#3882` is the most useful representative for final comparison

#### Web/layout duplicate pair

- Close: **#3333**
- Review only if salvage is desired: **#3849**

Rationale:
- same file scope and branch family
- `#3849` appears to be the later variant

### Cherry-pick only

These branches may still contain useful work, but should not be merged directly.

- #3322 — Risk Radar restyle
- #3328 — canonical logo rollout
- #3375 — worker naming / CI / docs contract
- #3476 — validate-rebuild / workflow cleanup
- #3535 — recreate or cherry-pick specific app changes only
- #3582 — recreate or cherry-pick specific theme changes only
- #3804 — canonical CSS export cleanup only
- #3806 — legacy Cloudflare naming normalization only
- #3849 — only if the web/layout changes are still desired
- #3869 — only if favicon/layout changes are still desired
- #3882 — only if the infra changes are still desired

### Close as stale

These are too stale or too structurally risky to merge directly.

- #3332
- #3335
- #3347
- #3385
- #3583
- #3860
- #3338

### High-risk / conflict-heavy

These should be treated as recreate-or-close branches, not merge candidates.

- #3338
- #3860
- #3535
- #3582
- #3476
- #3332
- #3335

## PR-by-PR disposition list

| PR | Recommendation | Notes |
| --- | --- | --- |
| #3322 | Cherry-pick only | Small UI scope; salvage if still wanted. |
| #3328 | Cherry-pick only | Branding/logo changes may be reusable. |
| #3332 | Close as stale | Large infra drift; likely superseded. |
| #3333 | Close as duplicate / superseded | Older variant of the same web/layout branch family. |
| #3335 | Close as stale | Old structure and heavy drift from `main`. |
| #3338 | Close as stale | Broad, high-risk branch with many nontrivial changes. |
| #3344 | Close as duplicate / superseded | Favicon family duplicate. |
| #3347 | Close as stale / duplicate | Conflict-resolution branch family. |
| #3375 | Cherry-pick only | Useful policy/CI changes may be worth extracting. |
| #3385 | Close as stale / duplicate | Conflict-resolution branch family. |
| #3476 | Cherry-pick only | Recreate on a fresh branch if still needed. |
| #3535 | Cherry-pick only | Extract specific feature work only. |
| #3582 | Cherry-pick only | Extract specific theme work only. |
| #3583 | Close as stale / duplicate | Conflict-resolution branch family. |
| #3795 | Close as duplicate / superseded | Favicon family duplicate. |
| #3804 | Cherry-pick only | Keep the CSS export cleanup only. |
| #3806 | Cherry-pick only | Compare against `#3882`; keep only missing infra normalization. |
| #3841 | Close as duplicate / superseded | Legacy infra family duplicate. |
| #3847 | Close as duplicate / superseded | Favicon family duplicate. |
| #3849 | Cherry-pick only | Later web/layout variant; do not merge wholesale. |
| #3860 | Close as stale | Too broad and too far behind `main`. |
| #3869 | Cherry-pick only | Representative favicon branch only. |
| #3870 | Close as duplicate / superseded | Legacy infra family duplicate. |
| #3881 | Close as duplicate / superseded | Legacy infra family duplicate. |
| #3882 | Cherry-pick only | Representative legacy infra branch only. |
| #3883 | Close as duplicate / superseded | Favicon family duplicate. |
| #3884 | Close as duplicate / superseded | Favicon family duplicate. |
| #3885 | Close as duplicate / superseded | Favicon family duplicate. |

## Suggested review order

1. Close obvious duplicate families first.
   - favicon family duplicates
   - resolve-conflicts family
   - repeated legacy-infra variants
2. Review one representative branch per family.
   - #3869
   - #3882
   - #3849 if still wanted
3. Salvage small/scoped work via cherry-pick.
   - #3322
   - #3328
   - #3375
   - #3476
   - #3804
   - #3806
4. Explicitly close the remaining high-risk stale branches.
   - #3332
   - #3335
   - #3535
   - #3582
   - #3860
   - #3338

## Notes

- Any infra or workflow salvage should be validated against the repository requirement that API services and workers use the `gs-control` build token.
- Any governance-related salvage should preserve the repository requirement that commit and PR descriptions include a one-line merge strategy note at the top.
