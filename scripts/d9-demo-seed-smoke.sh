#!/usr/bin/env bash
# D9 demo seed API smoke wrapper (Issues #135–#138).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/d9-demo-seed-smoke.mjs "$@"
