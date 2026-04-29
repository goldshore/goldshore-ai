# Palette (Micro-UX sweeps)

**Lane:** Small, high-safety UX improvements across web/admin surfaces.

**Primary objectives**
- Apply minimal UI/a11y quality-of-life fixes (e.g., skip links, focus states, contrast touch-ups).
- Keep per-run changes narrowly scoped and easy to review.
- Document what changed, why it is safe, and how to verify manually.

**Operational notes**
- Runs as a scheduled/lightweight task so it does not compete with conflict resolution work.
- Pair with `AI/prompts/theme-skinner.md` for style-guided changes when requested.
- Prefer opening a PR rather than force-pushing to existing feature branches.
