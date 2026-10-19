#!/usr/bin/env bash
# One-shot PR + CI evidence for DoD — prefer REST check-runs over repeated `gh pr checks`.
#
# Why: `gh pr checks` uses GraphQL; many parallel Orca reviewers + tight polling
# exhaust the graphql/search buckets fast. This script = 2 REST calls per PR.
#
# Usage:
#   ./scripts/gh-dod-evidence.sh <pr-number>
#   ./scripts/gh-dod-evidence.sh <pr-number> --json   # machine-readable summary
#
# Auth: active `gh` account (SideProject: hangndat). Does not call /rate_limit.
set -euo pipefail

REPO="${GH_DOD_REPO:-hangndat/ticket-solution}"
PR="${1:?PR number required}"
MODE="${2:-}"

read -r sha state mergeable < <(
  gh api "repos/${REPO}/pulls/${PR}" --jq '[.head.sha, .state, .mergeable] | @tsv'
)

if [[ "$MODE" == "--json" ]]; then
  gh api "repos/${REPO}/commits/${sha}/check-runs" --paginate \
    --jq "{pr: ${PR}, sha: \"${sha}\", state: \"${state}\", mergeable: ${mergeable}, checks: [.check_runs[] | {name, status, conclusion}]}"
  exit 0
fi

echo "repo=${REPO} pr=${PR}"
echo "head.sha=${sha}"
echo "state=${state} mergeable=${mergeable}"
echo "--- check-runs (REST) ---"
gh api "repos/${REPO}/commits/${sha}/check-runs" --paginate \
  --jq '.check_runs[] | "\(.name)\t\(.status)\t\(.conclusion // "-")"'
