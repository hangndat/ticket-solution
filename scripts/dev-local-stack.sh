#!/usr/bin/env bash
# dev-local-stack.sh — isolated "always-on" local dev stack for Issue #869 fullflow.
# Fixture only. Own docker-compose project (`ui869dev`), own persistent volumes,
# own Keycloak realm copy (ignored, never edits infra/keycloak/realm-ticket.json),
# own Postgres DB/runtime user. Never touches the shared `ticket-solution` compose
# project or `ticket_d9_demo` state.
#
# Host split (explicit per task authorization — local loopback only):
#   marketing surface: http://marketing.localhost:3417 (MARKETING_HOSTS/MARKETING_ORIGIN)
#   product surface:   http://localhost:3417 (PRODUCT_ORIGIN / WEB_PUBLIC_ORIGIN)
#   API:               http://127.0.0.1:3498
#   OIDC issuer:       http://127.0.0.1:8080 (isolated ui869dev Keycloak, realm "ticket")
#
# Commands:
#   ./scripts/dev-local-stack.sh up                   # bring up infra + API + web (idempotent)
#   ./scripts/dev-local-stack.sh status                # PIDs, ports, container state, health
#   ./scripts/dev-local-stack.sh logs [api|web]        # tail logs (default: both)
#   ./scripts/dev-local-stack.sh down                  # stop owned API/web procs + ui869dev containers (keeps volumes)
#   ./scripts/dev-local-stack.sh seed --reset           # explicit-only: drop/recreate+seed DB
#   ./scripts/dev-local-stack.sh supervisor             # foreground loop: ensure infra/API/web, restart on crash (launchd target)
#   ./scripts/dev-local-stack.sh install-autostart      # write + bootstrap launchd agent (user-authorized)
#   ./scripts/dev-local-stack.sh uninstall-autostart    # unload + remove launchd agent
#
# Safety:
#   - Isolated compose project `ui869dev` (COMPOSE_PROJECT_NAME) + isolated ports
#     (Postgres 55433, Redis 56380, Keycloak 8080, MinIO 9002/9003, Mailpit 1026/8026)
#     so it never collides with the shared `ticket-solution` project's volumes/data.
#   - Before claiming :3417/:3498 free, `up` checks for a foreign LISTENer and
#     refuses to bind (never kills a PID it did not start itself).
#   - `down` only ever signals PIDs recorded in its own state dir, and only stops
#     (never `-v` removes) the `ui869dev` compose project — volumes persist.
#   - `seed` only runs on explicit `--reset`; `up` only auto-seeds once, on first
#     run when no state file exists yet (first-run bootstrap), never again after.
#   - Never prints secrets/tokens to stdout; state dir is chmod 700, env file 600.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${UI869_DEV_STATE_DIR:-${ROOT}/.local-dev/ui869}"
LOG_DIR="${STATE_DIR}/logs"
PID_DIR="${STATE_DIR}/pid"
ENV_FILE="${STATE_DIR}/env.sh"
REALM_FILE="${STATE_DIR}/realm-ticket.local.json"
COMPOSE_OVERRIDE="${STATE_DIR}/docker-compose.override.yml"
LABEL="com.vemoki.dev.ui869"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
COMPOSE_PROJECT="ui869dev"

WEB_PORT="${UI869_WEB_PORT:-3417}"
API_PORT="${UI869_API_PORT:-3498}"
OIDC_PORT="${UI869_OIDC_PORT:-8080}"
POSTGRES_PORT="${UI869_POSTGRES_PORT:-55433}"
REDIS_PORT="${UI869_REDIS_PORT:-56380}"
MINIO_API_PORT="${UI869_MINIO_API_PORT:-9002}"
MINIO_CONSOLE_PORT="${UI869_MINIO_CONSOLE_PORT:-9003}"
MAILPIT_SMTP_PORT="${UI869_MAILPIT_SMTP_PORT:-1026}"
MAILPIT_UI_PORT="${UI869_MAILPIT_UI_PORT:-8026}"

MARKETING_HOST="marketing.localhost"
PRODUCT_HOST="localhost"

# Isolated DB identity — reuses scripts/lib/d9-demo-bootstrap-db.mjs + d9-demo-seed.sh
# via their existing D9_DEMO_DB / D9_DEMO_RT_USER overrides (never the defaults).
export D9_DEMO_DB="${UI869_DEMO_DB:-ticket_ui869_dev}"
export D9_DEMO_RT_USER="${UI869_DEMO_RT_USER:-ui869_dev_rt}"

die() { echo "dev-local-stack: $*" >&2; exit 1; }
log() { echo "dev-local-stack: $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

mkdirs() {
  mkdir -p "${LOG_DIR}" "${PID_DIR}"
  chmod 700 "${STATE_DIR}" 2>/dev/null || true
}

compose() {
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT}" \
  POSTGRES_PORT="${POSTGRES_PORT}" REDIS_PORT="${REDIS_PORT}" \
  KEYCLOAK_PORT="${OIDC_PORT}" KEYCLOAK_BIND=127.0.0.1 \
  MINIO_API_PORT="${MINIO_API_PORT}" MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT}" \
  MAILPIT_SMTP_PORT="${MAILPIT_SMTP_PORT}" MAILPIT_UI_PORT="${MAILPIT_UI_PORT}" \
  docker compose -p "${COMPOSE_PROJECT}" -f "${ROOT}/compose.yaml" -f "${COMPOSE_OVERRIDE}" "$@"
}

port_owner_pid() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n1
}

is_our_pid() {
  python3 "${ROOT}/scripts/dev-local-process.py" alive "$1"
}

wait_http() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq 1 "${tries}"); do
    curl -sf "${url}" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

# Generate the ignored local realm copy with :3417 redirect/logout/webOrigin
# entries for ticket-web ONLY (never edits infra/keycloak/realm-ticket.json),
# plus a compose override mounting it in place of the shared file. Explicit
# user authorization for this task covers local-only OIDC redirect config.
write_realm_and_override() {
  mkdirs
  node -e '
    const fs = require("fs");
    const root = process.argv[1];
    const out = process.argv[2];
    const realm = JSON.parse(fs.readFileSync(root + "/infra/keycloak/realm-ticket.json", "utf8"));
    const add = (arr, vals) => {
      for (const v of vals) if (!arr.includes(v)) arr.push(v);
    };
    // Local fixture only: drop CONFIGURE_TOTP required action so password-grant
    // login works against a fresh isolated Keycloak volume (shared stack volume
    // predates this requirement so it is unaffected; never touches the
    // committed realm-ticket.json).
    for (const u of realm.users || []) {
      if (!["staff@example.com", "attendee@example.com"].includes(u.username)) continue;
      if (Array.isArray(u.requiredActions)) {
        u.requiredActions = u.requiredActions.filter((a) => a !== "CONFIGURE_TOTP");
      }
    }
    for (const c of realm.clients || []) {
      if (c.clientId === "ticket-web") {
        add(c.redirectUris ||= [], [
          "http://localhost:3417/api/auth/callback",
          "http://127.0.0.1:3417/api/auth/callback",
        ]);
        add(c.webOrigins ||= [], [
          "http://localhost:3417",
          "http://127.0.0.1:3417",
        ]);
        c.attributes = c.attributes || {};
        const existingLogout = (c.attributes["post.logout.redirect.uris"] || "").split("##").filter(Boolean);
        add(existingLogout, ["http://localhost:3417/*", "http://127.0.0.1:3417/*"]);
        c.attributes["post.logout.redirect.uris"] = existingLogout.join("##");
      }
    }
    fs.writeFileSync(out, JSON.stringify(realm, null, 2));
  ' "${ROOT}" "${REALM_FILE}"
  chmod 600 "${REALM_FILE}"

  cat >"${COMPOSE_OVERRIDE}" <<EOF
services:
  keycloak:
    volumes:
      - ${REALM_FILE}:/opt/keycloak/data/import/realm-ticket.json:ro
EOF
  log "wrote isolated realm copy (ticket-web :3417 redirect/webOrigin/logout) -> ${REALM_FILE}"
}

cmd_up() {
  mkdirs
  [[ -f "${STATE_DIR}/paused" ]] && return 0
  export DEV_LOCAL_PAUSE_FILE="${STATE_DIR}/paused"
  need_cmd docker
  need_cmd node
  need_cmd pnpm
  need_cmd psql
  need_cmd curl

  write_realm_and_override

  log "ensuring isolated compose project '${COMPOSE_PROJECT}' (own volumes, loopback-only ports: pg ${POSTGRES_PORT}, redis ${REDIS_PORT}, keycloak ${OIDC_PORT}, minio ${MINIO_API_PORT}/${MINIO_CONSOLE_PORT}, mailpit ${MAILPIT_SMTP_PORT}/${MAILPIT_UI_PORT})"
  compose up -d postgres redis keycloak minio mailpit

  wait_http "http://127.0.0.1:${OIDC_PORT}/realms/ticket/.well-known/openid-configuration" 90 \
    || die "Keycloak (ui869dev, isolated) not ready on :${OIDC_PORT} — check: docker compose -p ${COMPOSE_PROJECT} logs keycloak"
  pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" >/dev/null 2>&1 \
    || die "Postgres (ui869dev, isolated) not ready on :${POSTGRES_PORT}"

  if [[ ! -f "${ENV_FILE}" ]]; then
    log "no bootstrap state — running first-time bootstrap+seed (DB ${D9_DEMO_DB}, RT user ${D9_DEMO_RT_USER}); this never reruns automatically after"
    cmd_seed --bootstrap-only
  fi

  # shellcheck source=/dev/null
  source "${ENV_FILE}"

  # --- API ---
  local api_pid_file="${PID_DIR}/api.pid"
  local existing_api
  existing_api="$(port_owner_pid "${API_PORT}" || true)"
  if [[ -n "${existing_api}" ]] && ! is_our_pid "${api_pid_file}"; then
    die "port :${API_PORT} already owned by foreign PID ${existing_api} — not touching it; coordinate with root before replacing"
  fi
  if is_our_pid "${api_pid_file}"; then
    log "API already running (PID $(cat "${api_pid_file}")) on :${API_PORT}"
  else
    log "building API (pnpm --filter @ticket/api... build)"
    (cd "${ROOT}" && pnpm --filter @ticket/api... build)
    log "starting API on :${API_PORT}"
    (
      cd "${ROOT}/apps/api"
      export DATABASE_URL="${UI869_RUNTIME_DATABASE_URL}"
      export HOST=127.0.0.1 PORT="${API_PORT}" NODE_ENV=development
      export OIDC_PROVIDER=keycloak OIDC_ISSUER="${UI869_OIDC_ISSUER}"
      export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${UI869_OIDC_ISSUER}/protocol/openid-connect/certs"
      export CODE_HMAC_PEPPER="${UI869_CODE_HMAC_PEPPER}" CODE_HMAC_VERSION="${UI869_CODE_HMAC_VERSION}"
      export TICKET_CREDENTIAL_KEY="${UI869_TICKET_CREDENTIAL_KEY}"
      export EMAIL_ALLOW_NOOP=1
      export SINGLE_CODE_RESOLVE_GLOBAL=1
      export MINIO_ENDPOINT="http://127.0.0.1:${MINIO_API_PORT}" MINIO_ACCESS_KEY=minioadmin MINIO_SECRET_KEY=minioadmin MINIO_BUCKET_ASSETS=vemoki-assets
      python3 "${ROOT}/scripts/dev-local-process.py" start "${api_pid_file}" "${LOG_DIR}/api.log" "${ROOT}/apps/api" node dist/main.js
    )
    wait_http "http://127.0.0.1:${API_PORT}/v1/health" 60 \
      || die "API /health not ready on :${API_PORT} after 60s — see ${LOG_DIR}/api.log (readiness failed, not a soft warning)"
  fi

  if [[ ! -f "${STATE_DIR}/fixtures-v1" ]]; then
    cmd_fixtures
  fi
  ensure_web
}

cmd_fixtures() {
  [[ -f "${ENV_FILE}" ]] || die "bootstrap state missing; run up first"
  source "${ENV_FILE}"
  (
    cd "${ROOT}"
    export DATABASE_URL="${UI869_ADMIN_DATABASE_URL}" OIDC_ISSUER="${UI869_OIDC_ISSUER}"
    export CODE_HMAC_PEPPER="${UI869_CODE_HMAC_PEPPER}" CODE_HMAC_VERSION="${UI869_CODE_HMAC_VERSION}"
    export UI869_API_URL="http://127.0.0.1:${API_PORT}"
    node scripts/dev-local-fixtures.cjs
  )
  touch "${STATE_DIR}/fixtures-v1"
  chmod 600 "${STATE_DIR}/fixtures-v1"
}

# Separate from cmd_up so a foreign-PID block on :3417 (expected while waiting
# for root's preview/proxy swap) degrades to a loud, non-fatal BLOCKED status
# instead of aborting infra+API that are already healthy.
ensure_web() {
  local web_pid_file="${PID_DIR}/web.pid"
  local existing_web
  existing_web="$(port_owner_pid "${WEB_PORT}" || true)"
  if [[ -n "${existing_web}" ]] && ! is_our_pid "${web_pid_file}"; then
    log "BLOCKED: :${WEB_PORT} held by foreign PID ${existing_web} (not touching it) — waiting for root to swap/release this port; infra+API stay up in the meantime"
    return 0
  fi
  if is_our_pid "${web_pid_file}"; then
    log "web already running (PID $(cat "${web_pid_file}")) on :${WEB_PORT}"
  else
    log "starting web (next dev, bound 127.0.0.1:${WEB_PORT}) — marketing host ${MARKETING_HOST}, product host ${PRODUCT_HOST}"
    (
      cd "${ROOT}/apps/web"
      export API_BASE_URL="http://127.0.0.1:${API_PORT}"
      export OIDC_ISSUER="${UI869_OIDC_ISSUER}"
      export OIDC_CLIENT_ID=ticket-web OIDC_CLIENT_SECRET=dev-web-secret-change-me
      export OIDC_REDIRECT_URI="http://${PRODUCT_HOST}:${WEB_PORT}/api/auth/callback"
      export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${UI869_OIDC_ISSUER}/protocol/openid-connect/certs"
      export MARKETING_HOSTS="${MARKETING_HOST}" MARKETING_ORIGIN="http://${MARKETING_HOST}:${WEB_PORT}"
      export PRODUCT_ORIGIN="http://${PRODUCT_HOST}:${WEB_PORT}"
      export WEB_PUBLIC_ORIGIN="http://${PRODUCT_HOST}:${WEB_PORT}"
      export NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1
      export PORT="${WEB_PORT}"
      python3 "${ROOT}/scripts/dev-local-process.py" start "${web_pid_file}" "${LOG_DIR}/web.log" "${ROOT}/apps/web" pnpm exec next dev --port "${WEB_PORT}" --hostname 127.0.0.1
    )
    wait_http "http://${PRODUCT_HOST}:${WEB_PORT}" 60 \
      || die "web not ready on :${WEB_PORT} after 60s — see ${LOG_DIR}/web.log (readiness failed, not a soft warning)"
  fi

  cat <<EOF

dev-local-stack: UP
  marketing: http://${MARKETING_HOST}:${WEB_PORT}
  product:   http://${PRODUCT_HOST}:${WEB_PORT}
  API:       http://127.0.0.1:${API_PORT}
  OIDC:      ${UI869_OIDC_ISSUER} (isolated ui869dev Keycloak)
  DB:        ${D9_DEMO_DB} (runtime user: ${D9_DEMO_RT_USER}, isolated ui869dev Postgres :${POSTGRES_PORT})
  logs:      ${LOG_DIR}
  NOTE: accounts/codes printed by 'seed' output — local fixture only, not secret.
EOF
}

cmd_seed() {
  mkdirs
  local reset=0 bootstrap_only=0
  for a in "$@"; do
    case "$a" in
      --reset) reset=1 ;;
      --bootstrap-only) bootstrap_only=1 ;;
      *) die "seed: unknown flag $a" ;;
    esac
  done
  if [[ "${bootstrap_only}" != "1" && "${reset}" != "1" ]]; then
    die "seed requires --reset (explicit) to avoid accidental data loss"
  fi
  if [[ "${bootstrap_only}" == "1" && -f "${ENV_FILE}" ]]; then
    die "bootstrap-only but state already exists at ${ENV_FILE} — use 'seed --reset' to reseed explicitly"
  fi

  need_cmd node
  wait_http "http://127.0.0.1:${OIDC_PORT}/realms/ticket/.well-known/openid-configuration" 60 \
    || die "Keycloak (ui869dev) not ready on :${OIDC_PORT}"

  : "${UI869_CODE_HMAC_PEPPER:=local-dev-code-pepper-ui869}"
  : "${UI869_CODE_HMAC_VERSION:=1}"
  : "${UI869_TICKET_CREDENTIAL_KEY:=local-dev-credential-key-ui869}"

  log "fetching fixture Keycloak subjects (reuse scripts/lib/fe-uat-keycloak-tokens.mjs, issuer :${OIDC_PORT})"
  local tokens_json
  tokens_json="$(cd "${ROOT}" && OIDC_ISSUER="http://127.0.0.1:${OIDC_PORT}/realms/ticket" node "${ROOT}/scripts/lib/fe-uat-keycloak-tokens.mjs")"
  local issuer staff_sub attendee_sub
  issuer="$(node -e "console.log(JSON.parse(process.argv[1]).issuer)" "${tokens_json}")"
  staff_sub="$(node -e "console.log(JSON.parse(process.argv[1]).staff.sub)" "${tokens_json}")"
  attendee_sub="$(node -e "console.log(JSON.parse(process.argv[1]).attendee.sub)" "${tokens_json}")"

  log "bootstrapping isolated DB ${D9_DEMO_DB} (:${POSTGRES_PORT}) via scripts/lib/d9-demo-bootstrap-db.mjs (D9_DEMO_DB/D9_DEMO_RT_USER overrides)"
  local boot_json admin_url runtime_url
  boot_json="$(cd "${ROOT}" && POSTGRES_PORT="${POSTGRES_PORT}" node -e "
    import('./scripts/lib/d9-demo-bootstrap-db.mjs').then(m => m.bootstrapD9DemoDatabase()).then(r => console.log(JSON.stringify(r)));
  ")"
  admin_url="$(node -e "console.log(JSON.parse(process.argv[1]).adminUrl)" "${boot_json}")"
  runtime_url="$(node -e "console.log(JSON.parse(process.argv[1]).runtimeUrl)" "${boot_json}")"

  log "seeding fixture data (reuse scripts/d9-demo-seed.sh — future+past events, media)"
  (
    cd "${ROOT}"
    export DATABASE_URL="${admin_url}"
    export OIDC_ISSUER="${issuer}"
    export CODE_HMAC_PEPPER="${UI869_CODE_HMAC_PEPPER}" CODE_HMAC_VERSION="${UI869_CODE_HMAC_VERSION}"
    export D9_DEMO_STAFF_SUBJECT="${staff_sub}"
    export D9_DEMO_ATTENDEE_SUBJECT="${attendee_sub}"
    ./scripts/d9-demo-seed.sh
  )

  log "seeding MinIO media (reuse scripts/d9-seed-media.sh, isolated :${MINIO_API_PORT})"
  (cd "${ROOT}" && DATABASE_URL="${admin_url}" MINIO_ENDPOINT="http://127.0.0.1:${MINIO_API_PORT}" ./scripts/d9-seed-media.sh) \
    || log "WARNING: media seed failed — see output above; web still usable without media"

  mkdir -p "${STATE_DIR}"
  cat >"${ENV_FILE}" <<EOF
# Generated by dev-local-stack.sh — local fixture only. Do not commit.
export UI869_OIDC_ISSUER='${issuer}'
export UI869_RUNTIME_DATABASE_URL='${runtime_url}'
export UI869_ADMIN_DATABASE_URL='${admin_url}'
export UI869_CODE_HMAC_PEPPER='${UI869_CODE_HMAC_PEPPER}'
export UI869_CODE_HMAC_VERSION='${UI869_CODE_HMAC_VERSION}'
export UI869_TICKET_CREDENTIAL_KEY='${UI869_TICKET_CREDENTIAL_KEY}'
EOF
  chmod 600 "${ENV_FILE}"
  rm -f "${STATE_DIR}/fixtures-v1"
  log "seed OK — state: ${ENV_FILE} (chmod 600, gitignored). Persistent: 'up' never reseeds; use 'seed --reset' explicitly."
}

cmd_status() {
  mkdirs
  echo "== containers (isolated project: ${COMPOSE_PROJECT}) =="
  compose ps 2>/dev/null || true
  echo
  echo "== processes (owned by this script) =="
  for svc in api web; do
    local pf="${PID_DIR}/${svc}.pid"
    if is_our_pid "${pf}"; then
      echo "${svc}: PID $(cat "${pf}") — RUNNING"
    else
      echo "${svc}: not running (or PID stale)"
    fi
  done
  echo
  echo "== ports =="
  for p in "${WEB_PORT}" "${API_PORT}" "${OIDC_PORT}" "${POSTGRES_PORT}"; do
    local owner
    owner="$(port_owner_pid "$p" || true)"
    echo ":${p} -> ${owner:-free}"
  done
  echo
  echo "== health =="
  curl -sf "http://127.0.0.1:${API_PORT}/v1/health" >/dev/null 2>&1 && echo "API /v1/health: OK" || echo "API /v1/health: not reachable"
  curl -sf "http://127.0.0.1:${OIDC_PORT}/realms/ticket/.well-known/openid-configuration" >/dev/null 2>&1 \
    && echo "Keycloak realm (ui869dev): OK" || echo "Keycloak realm (ui869dev): not reachable"
  curl -sf "http://${PRODUCT_HOST}:${WEB_PORT}" >/dev/null 2>&1 && echo "web :${WEB_PORT}: OK" || echo "web :${WEB_PORT}: not reachable"
}

cmd_logs() {
  mkdirs
  local which="${1:-all}"
  case "${which}" in
    api) tail -n 200 -f "${LOG_DIR}/api.log" ;;
    web) tail -n 200 -f "${LOG_DIR}/web.log" ;;
    all|"") tail -n 100 -f "${LOG_DIR}/api.log" "${LOG_DIR}/web.log" ;;
    *) die "logs: unknown target ${which} (api|web)" ;;
  esac
}

stop_pid() {
  log "stopping owned $2"
  python3 "${ROOT}/scripts/dev-local-process.py" stop "$1"
}

cmd_down() {
  mkdirs
  touch "${STATE_DIR}/paused"
  local failed=0
  stop_pid "${PID_DIR}/web.pid" "web" || failed=1
  stop_pid "${PID_DIR}/api.pid" "api" || failed=1
  log "stopping isolated compose project '${COMPOSE_PROJECT}' containers (volumes preserved, not destroyed)"
  if ! compose stop; then
    log "ERROR: docker compose -p '${COMPOSE_PROJECT}' stop failed; stack remains paused"
    failed=1
  fi
  return "${failed}"
}

# Foreground supervisor: ensures infra/API/web are up and restarts API/web if
# they crash. This is the launchd Program (keeps a foreground process alive,
# required for RunAtLoad + KeepAlive to actually supervise, instead of
# launchd repeatedly relaunching the short-lived `up` command).
cmd_supervisor() {
  mkdirs
  log "supervisor starting (PID $$)"
  trap 'log "supervisor exiting"; exit 0' TERM INT
  if [[ ! -f "${STATE_DIR}/paused" ]]; then cmd_up; fi
  while true; do
    sleep 15
    [[ -f "${STATE_DIR}/paused" ]] && continue
    if ! is_our_pid "${PID_DIR}/api.pid"; then
      log "API not running — restarting"
      cmd_up || log "supervisor: cmd_up failed, will retry next tick"
    elif ! is_our_pid "${PID_DIR}/web.pid"; then
      log "web not running — restarting"
      cmd_up || log "supervisor: cmd_up failed, will retry next tick"
    fi
  done
}

cmd_install_autostart() {
  mkdirs
  rm -f "${STATE_DIR}/paused"
  local homebrew_bin node_bin
  homebrew_bin="$(command -v brew >/dev/null 2>&1 && dirname "$(command -v brew)" || echo /opt/homebrew/bin)"
  node_bin="$(dirname "$(command -v node)")"
  xml_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
  local path_value="${node_bin}:${homebrew_bin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
  local path_escaped script_escaped root_escaped
  path_escaped="$(printf '%s' "${path_value}" | xml_escape)"
  script_escaped="$(printf '%s' "${ROOT}/scripts/dev-local-stack.sh" | xml_escape)"
  root_escaped="$(printf '%s' "${ROOT}" | xml_escape)"

  mkdir -p "$(dirname "${PLIST}")"
  cat >"${PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${script_escaped}</string>
    <string>supervisor</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${path_escaped}</string>
  </dict>
  <key>StandardOutPath</key><string>${LOG_DIR}/launchd.out.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/launchd.err.log</string>
  <key>WorkingDirectory</key><string>${root_escaped}</string>
</dict>
</plist>
EOF
  log "wrote ${PLIST}"
  log "bootstrapping launchd agent (user-authorized auto-start)"
  launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "${PLIST}"
  launchctl enable "gui/$(id -u)/${LABEL}"
  launchctl kickstart -k "gui/$(id -u)/${LABEL}"
  log "launchd agent active: ${LABEL}"
}

cmd_uninstall_autostart() {
  if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    log "unloaded ${LABEL} from launchd"
  fi
  rm -f "${PLIST}"
  log "removed ${PLIST}"
}

usage() {
  cat <<'USAGE'
dev-local-stack — isolated always-on local dev stack for Issue #869 fullflow

Commands:
  up                     Bring up isolated infra (compose -p ui869dev) + API (:3498) + web (:3417), idempotent
  status                 Containers, owned PIDs, ports, health
  logs [api|web]         Tail logs (default: both)
  down                   Stop owned API/web PIDs + isolated compose containers (volumes preserved)
  seed --reset           Explicit-only: bootstrap/reseed isolated DB ticket_ui869_dev
  fixtures               Additive scenarios + routing + tickets, preserving existing data
  supervisor             Foreground ensure/restart loop (launchd Program target)
  install-autostart      Write + bootstrap launchd agent (user-authorized)
  uninstall-autostart    Unload + remove launchd agent

Isolated from shared `ticket-solution` compose project and ticket_d9_demo DB.
Never prints secrets/tokens to stdout. State: .local-dev/ui869/ (gitignored, 700/600).
USAGE
}

main() {
  local cmd="${1:-}"; shift || true
  case "${cmd}" in
    up) rm -f "${STATE_DIR}/paused"; cmd_up "$@" ;;
    status) cmd_status "$@" ;;
    logs) cmd_logs "$@" ;;
    down) cmd_down "$@" ;;
    seed) cmd_seed "$@" ;;
    fixtures) cmd_fixtures ;;
    supervisor) cmd_supervisor "$@" ;;
    install-autostart) cmd_install_autostart "$@" ;;
    uninstall-autostart) cmd_uninstall_autostart "$@" ;;
    -h|--help|help|"") usage ;;
    *) die "unknown command '${cmd}' (try --help)" ;;
  esac
}

main "$@"
