# O02 iOS #370 — sim-uat dual persona (ẩn tab Nhân viên)

| Trường | Giá trị |
| --- | --- |
| Issue | [#370](https://github.com/hangndat/ticket-solution/issues/370) |
| Sim | `O02-iOS-370` `23D62617-F558-4C74-987D-30886DC612CC` |
| Team | `BLUA62D52G` (local Release signed; **không** EAS Cloud) |
| Stub API | `scripts/o02-me-events-stub.mjs` → `http://127.0.0.1:4370` |
| Artifacts | `apps/mobile/.uat-artifacts/o02-ios-370/` (gitignored) |

## Kết quả

| Persona | Expect | Evidence | Result |
| --- | --- | --- | --- |
| Guest (unsigned) | Tab **Nhân viên** ẩn | `20-guest-clean.png` / `10-guest-tabs.png` — chỉ Sự kiện + Vé của tôi | PASS |
| Staff (`staff-uat-token`) | Tab **Nhân viên** hiện; vào được Gate shell | `21-staff-session.png` · `22-staff-tabs.png` · `23-staff-gate.png` | PASS |
| Attendee (`attendee-uat-token`) | Tab ẩn lại | `24-attendee-tabs.png` | PASS |
| Deep-link `vemoki://staff` khi không eligible | Deny VI fail-closed | `25-staff-deny.png` — «Không có quyền Nhân viên» + «Về Sự kiện» | PASS |

## Lệnh (tóm tắt)

```bash
node scripts/o02-me-events-stub.mjs &
# local prebuild + Release xcodebuild (BLUA62D52G), rồi:
scripts/sim-uat.sh boot 23D62617-F558-4C74-987D-30886DC612CC
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" com.hangndat.ticket
# guest screenshot → openurl uat/session staff → screenshot → attendee → vemoki://staff deny
```

UAT session deep link chỉ bật khi `__DEV__` hoặc bake `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` (local evidence) — không bật trên prod.
