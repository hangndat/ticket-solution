#!/usr/bin/env bash
# Headless web UAT — Playwright Chromium (no macOS mouse).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec pnpm exec node scripts/web-uat.mjs "$@"
