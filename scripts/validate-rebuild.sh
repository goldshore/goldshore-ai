#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <PHASE>"
  echo "  PHASE must be one of: 1|2|3|4|5"
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

PHASE="$1"

case "$PHASE" in
  1|2|3|4|5)
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "validate-rebuild: phase $PHASE"

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

case "$PHASE" in
  1) run_phase "Phase 1: Workspace sanity" pnpm -w lint ;;
  2) run_phase "Phase 2: Type checks" pnpm -w typecheck ;;
  3) run_phase "Phase 3: Unit tests" pnpm -w test ;;
  4) run_phase "Phase 4: Integration checks" pnpm -w test:integration ;;
  5)
    # Phase 5 intentionally runs installs and package builds in explicit order so
    # failures are attributable to a single component.
    run_phase "Phase 5.1: Install dependencies" pnpm install
    run_phase "Phase 5.2: Build gs-api" pnpm -C apps/gs-api build
    run_phase "Phase 5.3: Build gs-web" pnpm -C apps/gs-web build
    run_phase "Phase 5.4: Build gs-admin" pnpm -C apps/gs-admin build

    run_optional_changed_package_builds
    ;;
esac

echo

echo "validate-rebuild complete"
