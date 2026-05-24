#!/usr/bin/env bash
set -euo pipefail

echo "Checking for forbidden deep imports..."

if grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo '@goldshore/theme/styles' apps packages; then
  echo "❌ Deep theme import detected."
  exit 1
fi

if grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo -E '@goldshore/theme/.+\.css' apps packages; then
  echo "❌ Direct CSS deep import detected."
  exit 1
fi

echo "✅ Theme contract clean."
