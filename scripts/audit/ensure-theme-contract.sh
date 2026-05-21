#!/usr/bin/env bash
set -euo pipefail

echo "Checking for forbidden deep imports..."

if grep -RIn '@goldshore/theme/styles' apps packages; then
  echo "❌ Deep theme import detected."
  exit 1
fi

if grep -RIn -E '@goldshore/theme/.+\.css' apps packages; then
  echo "❌ Direct CSS deep import detected."
  exit 1
fi

echo "✅ Theme contract clean."
