#!/usr/bin/env bash
# Offline one-time platform operator bootstrap (M12).
#
# Exact:
#   chmod 600 /path/to/token   # access token: aud ticket-platform-api, acr=2
#   ./scripts/platform-operator-bootstrap.sh --token-file /path/to/token
#   ./scripts/platform-operator-bootstrap.sh --token-stdin < /path/to/token
#   ./scripts/platform-operator-bootstrap.sh --verify-only --token-file ...
#
# NEVER pass token/password on argv. NEVER echo token. No public HTTP bootstrap.
# Invokes BE module when present; otherwise verify-only proves JWT assurance.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

TOKEN_FILE=""
TOKEN_STDIN=0
VERIFY_ONLY=0
SUBJECT_FILE=""

usage() {
  echo "usage: $0 (--token-file PATH | --token-stdin) [--verify-only] [--subject-file PATH]" >&2
  echo "  Token via file (mode ≤600) or stdin. Optional subject-file confirms issuer|subject." >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token-file) TOKEN_FILE="${2:-}"; shift 2 ;;
    --token-stdin) TOKEN_STDIN=1; shift ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    --subject-file) SUBJECT_FILE="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *)
      echo "unknown arg (do not pass tokens on CLI): $1" >&2
      usage
      ;;
  esac
done

if [[ -z "${TOKEN_FILE}" && "${TOKEN_STDIN}" -ne 1 ]]; then
  usage
fi

if [[ -n "${TOKEN_FILE}" ]]; then
  if [[ ! -f "${TOKEN_FILE}" ]]; then
    echo "token file missing" >&2
    exit 1
  fi
  # Reject world-readable
  MODE="$(stat -f '%Lp' "${TOKEN_FILE}" 2>/dev/null || stat -c '%a' "${TOKEN_FILE}")"
  if [[ "${MODE}" != "600" && "${MODE}" != "400" ]]; then
    echo "token file mode must be 600 or 400 (got ${MODE})" >&2
    exit 1
  fi
fi

export PLATFORM_BOOTSTRAP_TOKEN_FILE="${TOKEN_FILE}"
export PLATFORM_BOOTSTRAP_TOKEN_STDIN="${TOKEN_STDIN}"
export PLATFORM_BOOTSTRAP_SUBJECT_FILE="${SUBJECT_FILE}"
export PLATFORM_BOOTSTRAP_VERIFY_ONLY="${VERIFY_ONLY}"
export PLATFORM_SECURITY_CONFIG="${PLATFORM_SECURITY_CONFIG:-${ROOT}/infra/platform/security-config.json}"

node "${ROOT}/scripts/lib/platform-operator-bootstrap.mjs"
