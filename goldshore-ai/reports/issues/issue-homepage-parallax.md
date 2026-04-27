# Homepage hero parallax/starfield inconsistent on responsive layouts (@jules)

## Summary
The homepage hero starfield/parallax experience appears inconsistent across responsive breakpoints. The cinematic hero disables parallax layers entirely, which can make the starfield feel static and remove depth cues that are present elsewhere on the page.

## Observations
- The cinematic hero section disables parallax layers (`.cinematic-hero .parallax-layer { display: none; }`), so any parallax elements placed inside the hero are hidden by CSS.
- The starfield canvas is fixed and always rendered, but the hero itself has no parallax layer elements, leaving the opening hero without the layered parallax effect used in other sections.
- On narrow viewports, the hero switches to a single-column layout and hides the visual column entirely, further reducing the perceived depth and motion.

## Steps to Reproduce
1. Open the homepage (`/`) on desktop and observe the hero area.
2. Scroll slightly; the lower sections show parallax layers, but the main hero has no visible parallax layers.
3. Resize to a mobile viewport; the hero visual is removed, and the starfield effect remains static behind the text content.

## Expected
- The hero should retain a subtle parallax depth effect (e.g., layered glows or star layers) that remains visible across breakpoints.
- The starfield should feel responsive to scroll and viewport changes without appearing static or detached from the hero section.

## Suggested Fix
- Re-introduce hero-specific parallax layers for the cinematic hero (similar to the layers used in the lower sections), and remove the CSS rule that hides `.cinematic-hero .parallax-layer` if those layers are present.
- Ensure the hero’s parallax layers are responsive (toggle density or opacity on smaller screens instead of hiding all motion).
- Confirm the starfield animation responds to resize/scroll consistently across breakpoints.

## References
- `apps/gs-web/src/pages/index.astro` (hero markup + starfield script)
- `apps/gs-web/src/styles/home.css` (hero/parallax styling)
