# Epic: Risk Radar MVP (Interactive Orbital Exposure Map)

## Objective

Replace the placeholder Risk Radar page with a working interactive demo that communicates:
- systemic exposure
- volatility pressure
- signal drift
- dependency density

## Target audience
- Prospective clients evaluating operational rigor
- Technical visitors validating capability
- Internal demos / investor-facing story

---

## Issue RR-0 — Page scaffold + data plumbing

**Targets**
- `apps/gs-web/src/pages/risk-radar.astro`
- `apps/gs-web/public/data/risk-radar.sample.json`

**Work**
- Add page layout: controls panel, canvas, detail panel, legend.
- Load sample JSON data from `public/`.

**Acceptance criteria**
- Page renders with sample data.
- Controls and panels exist (even if non-functional initially).

---

## Issue RR-1 — Orbital map render (SVG / D3)

**Targets**
- `apps/gs-web/src/components/risk-radar/OrbitalMap.ts`
- `apps/gs-web/src/components/risk-radar/OrbitalMap.astro`

**Visualization spec**
- Rings represent tiers (1–4)
- Nodes placed around rings with polar layout
- Status indicated by color + icon/shape (not color alone)
- Legend maps status/tier meanings

**Acceptance criteria**
- 4 rings visible
- Nodes render with labels/tooltips
- Responsive scaling (mobile/desktop)

---

## Issue RR-2 — Interaction: hover tooltip + select → details panel

**Targets**
- `Controls.astro`, `DetailsPanel.astro`, map component

**Work**
- Hover shows tooltip with node summary.
- Click selects node and populates detail panel:
  - status
  - metrics (pressure/drift)
  - dependencies

**Acceptance criteria**
- Tooltip appears on hover/focus
- Selected node visually distinct
- Detail panel updates correctly

---

## Issue RR-3 — Filters + simulate event

**Work**
- Filters:
  - status (ok/warn/crit)
  - tier
  - env
- Simulate event:
  - increases pressure/drift in a dependency chain
  - animates transition (disabled with reduced motion)

**Acceptance criteria**
- Filters update the map without reload
- Simulate visibly changes metrics and node styles
- Reset returns to baseline state

---

## Issue RR-4 — Accessibility polish

**Work**
- Keyboard navigation:
  - tab to map nodes (or alternate list)
  - Enter selects node
- `prefers-reduced-motion` disables transitions
- Provide non-color indicators (icons, labels)

**Acceptance criteria**
- Usable without mouse
- Screen reader announcements are sensible for selection changes (`aria-live` on details panel)

---

## Implementation notes
- Keep PRs small and themed (one concept per PR).
- Keep runtime wiring separate from rendering.
