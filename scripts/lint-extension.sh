#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

validate_manifest() {
  local manifest_file="$1"
  local target="$2"
  node - "$manifest_file" "$target" <<'NODE'
const fs = require("node:fs");
const [manifestFile, target] = process.argv.slice(2);
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
} catch (error) {
  console.error(`Manifest tidak valid: ${error.message}`);
  process.exit(1);
}
if (manifest.manifest_version !== 3) throw new Error("Manifest harus versi 3.");
if (target === "chromium") {
  if (manifest.browser_specific_settings) throw new Error("Manifest Chromium tidak boleh memuat browser_specific_settings.");
  if (!manifest.background?.service_worker || manifest.background.scripts) throw new Error("Manifest Chromium harus memakai background.service_worker.");
} else {
  if (!manifest.browser_specific_settings?.gecko?.id) throw new Error("Manifest Firefox harus memiliki browser_specific_settings.gecko.id.");
  if (!Array.isArray(manifest.background?.scripts) || manifest.background.service_worker) throw new Error("Manifest Firefox harus memakai background.scripts.");
}
NODE
}

validate_manifest "$ROOT/extension/manifest.json" chromium
validate_manifest "$ROOT/extension/manifest.firefox.json" firefox

for item in "$ROOT"/extension/*; do
  [[ "${item##*/}" == "manifest.firefox.json" ]] && continue
  cp -R "$item" "$TEMP_DIR/"
done
cp "$ROOT/extension/manifest.firefox.json" "$TEMP_DIR/manifest.json"
cd "$ROOT"
npx --no-install web-ext lint --source-dir "$TEMP_DIR"
