#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT

package_target() {
  local target="$1"
  local manifest_file="$2"
  local archive_name="$3"
  local build_dir="$TEMP_ROOT/$target"
  local archive_temp="$TEMP_ROOT/$archive_name"
  mkdir -p "$build_dir"

  for item in "$ROOT"/extension/*; do
    [[ "${item##*/}" == "manifest.firefox.json" ]] && continue
    cp -R "$item" "$build_dir/"
  done
  cp "$ROOT/extension/$manifest_file" "$build_dir/manifest.json"
  (cd "$build_dir" && zip -qr "$archive_temp" .)
  mv "$archive_temp" "$ROOT/$archive_name"
  printf 'Created %s (%s)\n' "$archive_name" "$target"
}

package_target chromium manifest.json form-helper-extension.zip
package_target firefox manifest.firefox.json form-helper-firefox.zip
