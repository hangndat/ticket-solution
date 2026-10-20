#!/usr/bin/env bash
# Release install on Dexter — provenance: CFBundleVersion + EXPO_PUBLIC_BUILD_GIT_SHA
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
UDID="${DEXTER_UDID:-00008140-000605803C01801C}"
REPO_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel)"
export EXPO_PUBLIC_BUILD_GIT_SHA="${EXPO_PUBLIC_BUILD_GIT_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
export APS_ENVIRONMENT=production
export EXPO_PUBLIC_APS_ENVIRONMENT=production
node scripts/sync-ios-build-number.mjs
npx expo run:ios --device "$UDID" --configuration Release --no-bundler
