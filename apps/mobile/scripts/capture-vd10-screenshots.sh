#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
command -v axe >/dev/null 2>&1 || { echo "axe required (brew install cameroncooke/axe/axe)" >&2; exit 1; }

UDID="${1:-1CE47E90-329A-4019-B4C6-44DB96C29138}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/docs/reviews/assets/vd10-ios"
mkdir -p "$OUT" "$ROOT/apps/mobile/.uat-artifacts/vd10"

has_open_dialog() {
  axe describe-ui --udid "$UDID" 2>/dev/null | grep -q 'Open in'
}

clear_open_dialog() {
  local i=0
  while has_open_dialog && [[ "$i" -lt 4 ]]; do
    axe tap --udid "$UDID" --label Cancel --post-delay 0.2 2>/dev/null || true
    /bin/sleep 1
    i=$((i + 1))
  done
}

confirm_open_dialog() {
  if has_open_dialog; then
    axe tap --udid "$UDID" --label Open --post-delay 0.2
    /bin/sleep 4
  fi
}

shot() {
  clear_open_dialog
  /bin/sleep 0.5
  axe screenshot --udid "$UDID" --output "$1"
}

tap_label() {
  axe tap --udid "$UDID" --label "$1" --post-delay 0.2
  /bin/sleep 3
}

xcrun simctl terminate "$UDID" com.hangndat.ticket 2>/dev/null || true
/bin/sleep 2
xcrun simctl launch "$UDID" com.hangndat.ticket
/bin/sleep 14
clear_open_dialog

shot "$OUT/ios-events-feed.png"

tap_label "Xem chi tiết: MFest · Demo"
shot "$OUT/ios-event-detail-fixture.png"

tap_label "Sự kiện"
tap_label "Đổi mã lấy vé"
shot "$OUT/ios-redeem-global.png"

xcrun simctl openurl "$UDID" "ticketsolution://events/demo-mfest"
/bin/sleep 2
confirm_open_dialog
clear_open_dialog
shot "$OUT/ios-ticket-detail-fixture.png"

xcrun simctl openurl "$UDID" "ticketsolution://staff"
/bin/sleep 2
confirm_open_dialog
clear_open_dialog
shot "$OUT/ios-staff-access-deny.png"

cp "$OUT"/*.png "$ROOT/apps/mobile/.uat-artifacts/vd10/"
md5 -q "$OUT"/*.png | sort -u
