#!/usr/bin/env bash
# One-shot PR + CI evidence for DoD — prefer REST check-runs over repeated `gh pr checks`.
#
# Why: `gh pr checks` uses GraphQL; many parallel Orca reviewers + tight polling
# exhaust the graphql/search buckets fast. This script = 2 REST calls per PR.
#
# Usage:
#   ./scripts/gh-dod-evidence.sh <pr-number>
#   ./scripts/gh-dod-evidence.sh <pr-number> --json   # machine-readable summary
#   ./scripts/gh-dod-evidence.sh <pr-number> --watch <expected-full-sha>
#
# Auth: active `gh` account (SideProject: hangndat). Does not call /rate_limit.
set -euo pipefail

REPO="${GH_DOD_REPO:-hangndat/ticket-solution}"
PR="${1:?PR number required}"
MODE="${2:-}"

pull_state=$(gh api "repos/${REPO}/pulls/${PR}" --jq '[.head.sha, .state, .mergeable] | @tsv')
read -r sha state mergeable <<<"$pull_state"

if [[ "$MODE" == "--watch" ]]; then
  expected_sha="${3:?Expected full PR head SHA required for --watch}"
  if [[ ! "$expected_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Expected a full 40-character SHA" >&2
    exit 2
  fi
  if [[ "$sha" != "$expected_sha" ]]; then
    echo "PR head changed before watch: expected=$expected_sha actual=$sha" >&2
    exit 3
  fi
  watch_log=$(mktemp "${TMPDIR:-/tmp}/gh-dod-watch.XXXXXX")
  trap 'rm -f "$watch_log"' EXIT
  watch_status=0
  gh pr checks "$PR" --watch --interval 30 -R "$REPO" >"$watch_log" 2>&1 || watch_status=$?
  pull_state=$(gh api "repos/${REPO}/pulls/${PR}" --jq '[.head.sha, .state, .mergeable] | @tsv')
  read -r sha state mergeable <<<"$pull_state"
  if [[ "$sha" != "$expected_sha" ]]; then
    echo "PR head changed during watch: expected=$expected_sha actual=$sha" >&2
    exit 3
  fi
  if (( watch_status != 0 )); then
    echo "PR checks failed for $expected_sha (gh exit=$watch_status); final watcher output:" >&2
    tail -40 "$watch_log" >&2
    exit "$watch_status"
  fi
  MODE=""
fi

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
