#!/bin/bash

LEGACY_DIR="archive/astro-goldshore"
ROOT_DIR="."

if [ -d "$LEGACY_DIR" ]; then
  echo "Normalizing Cloudflare/ variants..."
  find "$LEGACY_DIR" -depth -name "CF" -execdir mv {} Cloudflare \; 2>/dev/null || true

  echo "Consolidating assets..."
  mkdir -p "$ROOT_DIR/public/assets"
  find "$LEGACY_DIR" \( -name "*.svg" -o -name "*.png" -o -name "*.jpg" \) -exec cp -n {} "$ROOT_DIR/public/assets/" \; 2>/dev/null || true

  echo "Hashing and comparing..."
  find "$LEGACY_DIR" -type f | while read -r legacy_file; do
    rel_path="${legacy_file#$LEGACY_DIR/}"
    current_file="$ROOT_DIR/$rel_path"

    if [ -f "$current_file" ]; then
      legacy_hash=$(sha256sum "$legacy_file" | awk '{print $1}')
      current_hash=$(sha256sum "$current_file" | awk '{print $1}')

      if [ "$legacy_hash" != "$current_hash" ]; then
        echo "Differs: $rel_path"
      fi
    else
      # missing in current, copy
      # uncomment below line if we want to copy all missing files:
      # mkdir -p "$(dirname "$current_file")" && cp "$legacy_file" "$current_file"
      true
    fi
  done

  echo "Done hash-based migration plan."
else
  echo "Legacy dir not found, skipping."
fi
