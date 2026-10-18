#!/usr/bin/env bash
# Pre-push local checks — fail-fast, ownership-scoped, CI parity (no Docker DB).
# See README § Pre-push local checks.
#
# Escape hatch (not recommended): SKIP_PREPUSH=1 or TICKET_SKIP_PREPUSH=1
# Dry-run (print commands only): PREPUSH_DRY_RUN=1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ZERO_SHA="0000000000000000000000000000000000000000"
DRY_RUN="${PREPUSH_DRY_RUN:-0}"

log() { printf 'pre-push: %s\n' "$*" >&2; }

if [[ "${SKIP_PREPUSH:-}" == "1" || "${TICKET_SKIP_PREPUSH:-}" == "1" ]]; then
  log "skipped (SKIP_PREPUSH/TICKET_SKIP_PREPUSH=1)"
  exit 0
fi

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN: $*"
    return 0
  fi
  log "+ $*"
  eval "$@"
}

resolve_upstream() {
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    git rev-parse origin/main
    return
  fi
  if git rev-parse --verify --quiet main >/dev/null; then
    git rev-parse main
    return
  fi
  log "error: neither origin/main nor main found; fetch main or set upstream"
  exit 1
}

# Emit tip SHAs (one per line). Hook stdin: local_ref local_sha remote_ref remote_sha.
# Manual / pnpm: use HEAD.
emit_tips() {
  if [[ -t 0 ]]; then
    git rev-parse HEAD
    return
  fi

  local local_ref local_sha remote_ref remote_sha
  local saw=0
  local any=0
  while read -r local_ref local_sha remote_ref remote_sha; do
    saw=1
    [[ -z "${local_sha:-}" ]] && continue
    if [[ "$local_sha" == "$ZERO_SHA" ]]; then
      continue
    fi
    printf '%s\n' "$local_sha"
    any=1
  done

  if [[ "$saw" -eq 0 || "$any" -eq 0 ]]; then
    git rev-parse HEAD
  fi
}

# Path filters mirror .github/workflows/ci.yml (web/mobile/backend only — no db/hardening).
path_is_web() {
  case "$1" in
    apps/web/*|packages/contracts/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|turbo.json|.npmrc|.github/workflows/ci.yml|.github/actions/*)
      return 0
      ;;
    *) return 1 ;;
  esac
}

path_is_mobile() {
  case "$1" in
    apps/mobile/*|packages/contracts/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|turbo.json|.npmrc|.github/workflows/ci.yml|.github/actions/*)
      return 0
      ;;
    *) return 1 ;;
  esac
}

path_is_backend() {
  case "$1" in
    apps/api/*|apps/worker/*|packages/backend/*|packages/contracts/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|turbo.json|.npmrc|.github/workflows/ci.yml|.github/actions/*)
      return 0
      ;;
    *) return 1 ;;
  esac
}

changed_files_for_tip() {
  local tip="$1"
  local upstream base
  upstream="$(resolve_upstream)"
  base="$(git merge-base "$upstream" "$tip")"
  git diff --name-only "$base...$tip"
}

run_web() {
  log "scope=web"
  run_cmd 'pnpm --filter @ticket/web run typegen'
  run_cmd 'pnpm exec turbo run lint typecheck test build --filter=@ticket/web...'
  run_cmd 'pnpm --filter @ticket/web test:routes'
}

run_mobile() {
  log "scope=mobile"
  run_cmd 'pnpm exec turbo run lint typecheck test build --filter=@ticket/mobile...'
}

run_backend() {
  log "scope=backend"
  run_cmd 'pnpm exec turbo run lint typecheck test build --filter=@ticket/api... --filter=@ticket/worker...'
  run_cmd 'pnpm --filter @ticket/api openapi'
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN: git diff --exit-code -- apps/api/openapi.json"
  else
    log "+ git diff --exit-code -- apps/api/openapi.json"
    git diff --exit-code -- apps/api/openapi.json
  fi
}

main() {
  local tip f
  local need_web=0 need_mobile=0 need_backend=0
  local file_count=0
  local tmp

  tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" EXIT

  # Smoke / tests: PREPUSH_SMOKE_FILES=$'docs/a.md\napps/web/x.ts' overrides git diff.
  if [[ -n "${PREPUSH_SMOKE_FILES:-}" ]]; then
    printf '%s\n' "$PREPUSH_SMOKE_FILES" >>"$tmp"
  else
    while IFS= read -r tip; do
      [[ -z "$tip" ]] && continue
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        printf '%s\n' "$f" >>"$tmp"
      done < <(changed_files_for_tip "$tip")
    done < <(emit_tips)
  fi

  if [[ ! -s "$tmp" ]]; then
    log "no files changed vs merge-base with main — skip"
    exit 0
  fi

  sort -u "$tmp" -o "$tmp"

  log "changed files:"
  while IFS= read -r f; do
    printf '  %s\n' "$f" >&2
    file_count=$((file_count + 1))
    path_is_web "$f" && need_web=1
    path_is_mobile "$f" && need_mobile=1
    path_is_backend "$f" && need_backend=1
  done <"$tmp"

  log "file_count=$file_count"

  if [[ "$need_web" -eq 0 && "$need_mobile" -eq 0 && "$need_backend" -eq 0 ]]; then
    log "docs/tooling-only (no web/mobile/backend scopes) — skip"
    exit 0
  fi

  log "scopes: web=$need_web mobile=$need_mobile backend=$need_backend (no database-isolation)"

  if [[ "$need_web" -eq 1 ]]; then
    run_web
  fi
  if [[ "$need_mobile" -eq 1 ]]; then
    run_mobile
  fi
  if [[ "$need_backend" -eq 1 ]]; then
    run_backend
  fi

  log "ok"
}

main "$@"
