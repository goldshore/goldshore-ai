# Sprint 1 Release Gate Checklist

Before any production deploy, complete all checks below and record manual signoff.

## Required checks

- [ ] Route smoke checks
  - Verify primary routes load without console or runtime errors.
  - Confirm expected redirects and not-found behavior.
- [ ] Form submission happy path
  - Submit valid data end-to-end and confirm success messaging/state updates.
  - Confirm persistence/integration behavior is correct.
- [ ] Form validation error path
  - Trigger required-field and invalid-input states.
  - Confirm inline errors, error summaries (if present), and blocked submit behavior.
- [ ] Mobile responsive pass for top pages
  - Validate key pages at common mobile widths (e.g., 320px, 375px, 390px).
  - Ensure navigation, content hierarchy, and form controls remain usable.
- [ ] Accessibility sanity checks (labels/focus order)
  - Verify form controls have programmatic labels.
  - Confirm keyboard-only navigation and focus order are logical and visible.

## Manual signoff (required)

All three signoffs are required before production deployment.

| Area | Name | Date | Signoff |
| --- | --- | --- | --- |
| Content |  |  | [ ] Approved |
| Frontend |  |  | [ ] Approved |
| Product |  |  | [ ] Approved |

## Deployment gate

- [ ] All required checks completed
- [ ] Content signoff complete
- [ ] Frontend signoff complete
- [ ] Product signoff complete
- [ ] Approved for production deploy
