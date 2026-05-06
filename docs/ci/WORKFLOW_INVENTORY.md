# Workflow Inventory

Last audited: 2026-03-23

## Scope notes

- Active workflow directory: `.github/workflows/`.
- There is currently **no** `.github/AI/` directory in this repository; agent/governance content is stored under `AI/` at the repo root.
- `naming-lint.yml` is the active naming gate in this repo and serves as the practical equivalent of the planned `naming-guard.yml`.
- Deploy workflows with an on-disk `.disabled` suffix are intentionally disabled until they are renamed back to `.yml`.

## Blocking policy legend

- **Blocking**: Runs on `pull_request` and is intended to be configured as a required status check.
- **Non-blocking**: Manual, scheduled, push-only, issue-only, repository-dispatch, or advisory workflows not expected to block PR merges.

| Workflow file | Primary purpose | Trigger profile | Blocking status |
|---|---|---|---|
| `.github/workflows/archive-path-guard.yml` | Prevent archived/legacy paths from re-entering active changes. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/canonical-structure-check.yml` | Verify canonical repo/app structure. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/ci.yml` | Run the main CI validation suite. | `pull_request`, `push` | **Blocking** |
| `.github/workflows/cleanup-cache.yml` | Remove cached artifacts on demand. | `workflow_dispatch` | Non-blocking |
| `.github/workflows/cleanup-workflow-runs.yml` | Prune old workflow runs on a schedule. | `schedule`, `workflow_dispatch` | Non-blocking |
| `.github/workflows/close-stale-prs.yml` | Close stale pull requests automatically. | `schedule`, `workflow_dispatch` | Non-blocking |
| `.github/workflows/deploy-gs-admin.yml` | Production deploy for the admin app. | `push` to `main` (path-filtered) | Non-blocking |
| `.github/workflows/deploy-gs-agent.yml` | Production-labeled deploy workflow for the agent worker. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/deploy-gs-api.yml` | Production deploy for the API worker. | `push` to `main` (path-filtered) | Non-blocking |
| `.github/workflows/deploy-gs-control.yml.disabled` | Disabled production deploy workflow for the control worker. | Disabled on disk (`.disabled`) | Non-blocking |
| `.github/workflows/deploy-gs-gateway.yml.disabled` | Disabled production deploy workflow for the gateway worker. | Disabled on disk (`.disabled`) | Non-blocking |
| `.github/workflows/deploy-gs-mail.yml` | Production deploy for the mail worker. | `push` to `main` (path-filtered) | Non-blocking |
| `.github/workflows/deploy-gs-web.yml` | Production deploy for the web app. | `push` to `main` (path-filtered) | Non-blocking |
| `.github/workflows/jules-nightly.yml` | Automation sweep orchestrator that calls reusable workflows. | `schedule`, `workflow_dispatch` | Non-blocking |
| `.github/workflows/lockfile-guard.yml` | Prevent lockfile drift in PRs and allow manual verification. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/maintenance-gs-sync.yml` | Run GS sync maintenance tasks. | `workflow_dispatch` | Non-blocking |
| `.github/workflows/maintenance.yml` | Manual Cloudflare infra reconciliation workflow. | `workflow_dispatch` | Non-blocking |
| `.github/workflows/naming-guard.yml` | Manual guard that checks workflow naming conventions. | `workflow_dispatch` | Non-blocking |
| `.github/workflows/naming-lint.yml` | Enforce naming conventions (`pnpm check:naming`). | `pull_request`, `push` to `main` | **Blocking** |
| `.github/workflows/route-collision-check.yml` | Validate route ownership/collision map. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/preview-gs-web.yml` | Preview deploy for web app. | `pull_request` (path-filtered) | Non-blocking |
| `.github/workflows/preview-gs-admin.yml` | Preview deploy for admin app. | `pull_request` (path-filtered) | Non-blocking |
| `.github/workflows/preview-gs-api.yml` | Preview deploy for API worker. | `pull_request` (path-filtered) | Non-blocking |
| `.github/workflows/preview-gs-agent.yml` | Preview deploy for agent worker. | `pull_request` (path-filtered) | Non-blocking |
| `.github/workflows/preview-gs-gateway.yml` | Preview deploy for gateway worker. | `pull_request` (path-filtered) | Non-blocking |
| `.github/workflows/deploy-gs-web.yml` | Current production deploy for web app with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-admin.yml` | Current production deploy for admin app with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-api.yml` | Current production deploy for API worker with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-agent.yml` | Current production deploy for agent worker with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-control.yml` | Current production deploy for control worker with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-gateway.yml` | Current production deploy for gateway worker with validation gates. | `push` to `main` | Non-blocking |
| `.github/workflows/deploy-gs-mail.yml` | Current production deploy for mail worker with validation gates. | `push` to `main` | Non-blocking |

> `gs-agent` now has a strict split: `.github/workflows/preview-gs-agent.yml` is PR-only and deploys with `--env preview`, while `.github/workflows/deploy-gs-agent.yml` is main-only and deploys with `--env production`.
| `.github/workflows/jules-nightly.yml` | Nightly orchestrator for automation jobs. | `schedule`, `workflow_dispatch` | Non-blocking |
| `.github/workflows/palette-manual.yml` | Dispatch-triggered run for the Palette agent. | `repository_dispatch` | Non-blocking |
| `.github/workflows/pii-scan.yml` | Manual PII scan/reporting workflow. | `workflow_dispatch` | Non-blocking |
| `.github/workflows/preview-gs-admin.yml` | Preview deploy for the admin app. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/preview-gs-agent.yml` | Preview deploy for the agent worker. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/preview-gs-api.yml` | Preview deploy for the API worker. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/preview-gs-gateway.yml` | Preview deploy for the gateway worker. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/preview-gs-web.yml` | Preview deploy for the web app. | `pull_request` (path-filtered, label/ready-for-review gated) | Non-blocking |
| `.github/workflows/repo-health.yml` | Audit repository hygiene and consistency checks. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/route-collision-check.yml` | Validate route ownership/collision map. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/signed-commit-guard.yml` | Require signed commits or flag unsigned commits. | `pull_request`, `workflow_dispatch` | **Blocking** |
| `.github/workflows/sonarcloud.yml` | SonarCloud analysis. | `push`, `pull_request`, `workflow_dispatch`, `schedule` | Non-blocking |
| `.github/workflows/stabilization-task.yml` | Run scheduled stabilization checks. | `schedule`, `workflow_dispatch` | Non-blocking |
| `.github/workflows/summary.yml` | Summarize new issues using AI. | `issues` events | Non-blocking |
| `.github/workflows/tfsec.yml` | Infrastructure security scan (tfsec). | `push`, `pull_request`, `schedule` | Non-blocking |

## Stabilization/disable procedure (real filenames)

When a workflow must be temporarily disabled, rename the actual existing file in place with the `.disabled` suffix so the repository inventory continues to reflect the exact on-disk filename:

```bash
mv .github/workflows/<real-workflow>.yml .github/workflows/<real-workflow>.yml.disabled
```

Re-enable by moving the same file back into `.github/workflows/`.

## Nightly automation sweep repair

- `.github/workflows/jules-nightly.yml` no longer references deleted local reusable workflows.
- The nightly sweep now dispatches the surviving workflow files already present in `.github/workflows/`: `stabilization-task.yml`, `cleanup-workflow-runs.yml`, `palette-manual.yml` (via `repository_dispatch`), and `close-stale-prs.yml`.
- The retired `jules-daily.yml`, `jules-nightly-clean.yml`, `palette-daily.yml`, `sentinel-nightly.yml`, and `conflict-sweeper-nightly.yml` files are no longer part of the active workflow inventory.
