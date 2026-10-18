#!/usr/bin/env bash
# Point this clone at .githooks/ (no husky).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
chmod +x .githooks/pre-push scripts/pre-push-check.sh
echo "core.hooksPath=$(git config --get core.hooksPath)"
echo "pre-push hook ready (.githooks/pre-push → scripts/pre-push-check.sh)"
