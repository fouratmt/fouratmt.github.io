#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="${SITE_DIR:-/tmp/fourat-site-check}"

cd "$ROOT_DIR"
rm -rf "$SITE_DIR"
HUGO_CACHEDIR="${HUGO_CACHEDIR:-/tmp/fourat-hugo-cache}" \
  hugo --gc --minify --panicOnWarning --printI18nWarnings --printPathWarnings --destination "$SITE_DIR"
python3 scripts/check_site.py "$SITE_DIR"
