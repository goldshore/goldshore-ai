#!/usr/bin/env bash
set -euo pipefail

run_phase() {
  local label="$1"
  shift

  echo
  echo "==> ${label}"
  "$@"
}

run_optional_changed_package_builds() {
  local changed="${CHANGED_PACKAGES:-}"
  if [[ -z "${changed}" ]]; then
    return 0
  fi

  echo
  echo "==> Optional targeted package builds (CHANGED_PACKAGES=${changed})"

  local package
  for package in ${changed}; do
    case "${package}" in
      apps/gs-api|apps/gs-web|apps/gs-admin)
        pnpm -C "${package}" build
        ;;
      *)
        echo "Skipping unsupported package path: ${package}" >&2
        ;;
    esac
  done
}

run_phase "Phase 1: Workspace sanity" pnpm -w lint
run_phase "Phase 2: Type checks" pnpm -w typecheck
run_phase "Phase 3: Unit tests" pnpm -w test
run_phase "Phase 4: Integration checks" pnpm -w test:integration

# Phase 5 intentionally runs installs and package builds in explicit order so
# failures are attributable to a single component.
run_phase "Phase 5.1: Install dependencies" pnpm install
run_phase "Phase 5.2: Build gs-api" pnpm -C apps/gs-api build
run_phase "Phase 5.3: Build gs-web" pnpm -C apps/gs-web build
run_phase "Phase 5.4: Build gs-admin" pnpm -C apps/gs-admin build

run_optional_changed_package_builds

echo

echo "validate-rebuild complete"
