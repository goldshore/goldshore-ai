# Render Stability Guard

**Version:** 1.0
**Scope:** `goldshore.ai` (Production)

## Definitions

### "CSS Broken"
A state where the visual presentation deviates significantly from the design system due to missing or misordered styles.
**Criteria:**
- White screen with unstyled text.
- Missing background colors (e.g., dark theme becomes white).
- Broken layout (e.g., grid items stacked vertically).
- Missing fonts (fallback to Times New Roman/Arial).
- SVG icons missing or incorrect size.

### "Theme Regression"
A state where the correct styles are loaded, but specific design tokens or components have reverted to an older or incorrect state.
**Criteria:**
- Wrong primary color (e.g., blue instead of cyan).
- Incorrect spacing/padding.
- Missing animations (e.g., hero parallax).

## Verification Protocol
1.  **Build Phase**: `pnpm build` must produce CSS files in `dist/_astro/`.
2.  **Deploy Phase**: Use `curl -I` to verify 200 OK on CSS assets.
3.  **Runtime Phase**: Visual check of the homepage.

## Rollback Protocol
If "CSS Broken" is detected in Production:
1.  **Immediate Revert**: Revert the Git commit to the last known good state.
2.  **Redeploy**: Trigger a deployment of the reverted commit.
3.  **Investigate**: Do not attempt to "fix forward" in Production. Diagnose locally using `pnpm build` and `pnpm preview`.
