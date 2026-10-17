#!/usr/bin/env bash
# Headless iOS Simulator UAT helpers.
# Injects HID / accessibility events via AXe + simctl — never moves the macOS mouse.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_OUT_DIR="${SIM_UAT_OUT_DIR:-$ROOT/apps/mobile/.uat-artifacts}"

die() { echo "sim-uat: $*" >&2; exit 1; }

need_axe() {
  command -v axe >/dev/null 2>&1 || die "axe not found. Install: brew install cameroncooke/axe/axe"
}

resolve_udid() {
  local query="${1:-${SIM_UDID:-${SIM_DEVICE:-}}}"
  local udid
  udid="$(
    QUERY="$query" python3 - <<'PY'
import os, re, subprocess, sys
query = os.environ.get("QUERY", "").strip()
out = subprocess.check_output(["xcrun", "simctl", "list", "devices", "available"], text=True)
pat = re.compile(r"\(([0-9A-Fa-f-]{36})\)")
if not query:
    booted = []
    for line in out.splitlines():
        if "(Booted)" not in line:
            continue
        m = pat.search(line)
        if m:
            booted.append(m.group(1))
    if len(booted) == 1:
        print(booted[0])
        sys.exit(0)
    print(f"sim-uat: pass UDID/name, or set SIM_UDID / SIM_DEVICE (booted count={len(booted)})", file=sys.stderr)
    sys.exit(2)
if re.fullmatch(r"[0-9A-Fa-f-]{36}", query):
    print(query)
    sys.exit(0)
cands = []
for line in out.splitlines():
    if query not in line:
        continue
    m = pat.search(line)
    if not m:
        continue
    cands.append(("(Booted)" in line, m.group(1)))
if not cands:
    print(f"sim-uat: no simulator matching {query!r}", file=sys.stderr)
    sys.exit(2)
booted = [u for b, u in cands if b]
print((booted or [u for _, u in cands])[0])
PY
  )" || die "could not resolve device '${query:-}'"
  printf '%s\n' "$udid"
}

cmd_boot() {
  local query="${1:-}"
  [[ -n "$query" ]] || die "usage: sim-uat boot <udid|name>"
  local udid
  udid="$(resolve_udid "$query")"
  local state
  state="$(xcrun simctl list devices | awk -v u="$udid" 'index($0,u){print; exit}')"
  if [[ "$state" != *"(Booted)"* ]]; then
    xcrun simctl boot "$udid" >/dev/null
    xcrun simctl bootstatus "$udid" -b >/dev/null
  fi
  # Intentionally do NOT `open -a Simulator` — keeps UAT off the user's desktop focus.
  echo "$udid"
}

cmd_screenshot() {
  need_axe
  local udid
  udid="$(resolve_udid "${1:-}")"
  shift || true
  local out="${1:-}"
  mkdir -p "$DEFAULT_OUT_DIR"
  if [[ -z "$out" ]]; then
    out="$DEFAULT_OUT_DIR/sim-$(date +%Y%m%d-%H%M%S).png"
  fi
  axe screenshot --udid "$udid" --output "$out"
  echo "$out"
}

cmd_describe() {
  need_axe
  local udid
  udid="$(resolve_udid "${1:-}")"
  axe describe-ui --udid "$udid"
}

cmd_tap() {
  need_axe
  local udid=""
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --udid) udid="$2"; shift 2 ;;
      --device) udid="$(resolve_udid "$2")"; shift 2 ;;
      *) args+=("$1"); shift ;;
    esac
  done
  udid="$(resolve_udid "${udid:-}")"
  [[ ${#args[@]} -gt 0 ]] || die "usage: sim-uat tap [--label L|--id I|-x N -y N] [--udid UDID]"
  axe tap --udid "$udid" "${args[@]}"
}

cmd_type() {
  need_axe
  local udid=""
  local text=""
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --udid) udid="$2"; shift 2 ;;
      --device) udid="$(resolve_udid "$2")"; shift 2 ;;
      --) shift; text="$*"; break ;;
      -*)
        # pass-through axe flags
        args+=("$1")
        if [[ $# -gt 1 && "$2" != -* && "$1" =~ ^-- ]]; then
          args+=("$2"); shift 2
        else
          shift
        fi
        ;;
      *)
        if [[ -z "$text" ]]; then text="$1"; shift; else args+=("$1"); shift; fi
        ;;
    esac
  done
  [[ -n "$text" ]] || die "usage: sim-uat type [--udid UDID] 'text'"
  udid="$(resolve_udid "${udid:-}")"
  if [[ ${#args[@]} -gt 0 ]]; then
    axe type --udid "$udid" "${args[@]}" "$text"
  else
    axe type --udid "$udid" "$text"
  fi
}

cmd_launch() {
  local bundle="${1:-}"
  local query="${2:-}"
  [[ -n "$bundle" ]] || die "usage: sim-uat launch <bundleId> [udid|name]"
  local udid
  udid="$(resolve_udid "$query")"
  xcrun simctl launch "$udid" "$bundle"
}

cmd_terminate() {
  local bundle="${1:-}"
  local query="${2:-}"
  [[ -n "$bundle" ]] || die "usage: sim-uat terminate <bundleId> [udid|name]"
  local udid
  udid="$(resolve_udid "$query")"
  xcrun simctl terminate "$udid" "$bundle" || true
}

cmd_openurl() {
  local url="${1:-}"
  local query="${2:-}"
  [[ -n "$url" ]] || die "usage: sim-uat openurl <url> [udid|name]"
  local udid
  udid="$(resolve_udid "$query")"
  xcrun simctl openurl "$udid" "$url"
}

usage() {
  cat <<'USAGE'
sim-uat — headless iOS Simulator UAT (AXe HID + simctl)

Never uses cliclick / AppleScript / ORCA computer mouse clicks.

Commands:
  boot <udid|name>                 Boot device without opening Simulator.app
  screenshot [udid|name] [path]    PNG via AXe (default: apps/mobile/.uat-artifacts/)
  describe [udid|name]             Accessibility tree (axe describe-ui)
  tap [--label L|--id I|-x N -y N] [--udid U|--device name]
  type [--udid U] 'text'
  launch <bundleId> [udid|name]
  terminate <bundleId> [udid|name]
  openurl <url> [udid|name]
  resolve [udid|name]              Print resolved UDID

Env:
  SIM_UDID / SIM_DEVICE            Default device when omitted
  SIM_UAT_OUT_DIR                  Screenshot directory

Install AXe once: brew install cameroncooke/axe/axe
USAGE
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    boot) cmd_boot "$@" ;;
    screenshot|shot) cmd_screenshot "$@" ;;
    describe|ui) cmd_describe "$@" ;;
    tap) cmd_tap "$@" ;;
    type) cmd_type "$@" ;;
    launch) cmd_launch "$@" ;;
    terminate) cmd_terminate "$@" ;;
    openurl) cmd_openurl "$@" ;;
    resolve) resolve_udid "${1:-}" ;;
    -h|--help|help|"") usage ;;
    *) die "unknown command '$cmd' (try --help)" ;;
  esac
}

main "$@"
