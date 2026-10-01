#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

for item in "$ROOT"/extension/*; do
  [[ "${item##*/}" == "manifest.firefox.json" ]] && continue
  cp -R "$item" "$TEMP_DIR/"
done
cp "$ROOT/extension/manifest.firefox.json" "$TEMP_DIR/manifest.json"
cd "$ROOT"
npx --no-install web-ext lint --source-dir "$TEMP_DIR"
