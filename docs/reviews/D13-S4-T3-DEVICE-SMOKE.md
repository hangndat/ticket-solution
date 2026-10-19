# D13 — S4-T3 Physical-device smoke (Internal TF 1.0.0/13)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không** — device UAT evidence.

**Verdict: FAIL (không PASS)** — TF `1.0.0 (13)` đã cài trên DatHN iPhone; `devicectl` launch + screenshot OK. Binary **không** bake prod (`EXPO_PUBLIC_API_BASE_URL` / OIDC / `aps-environment=production`): UI demo catalog + «Chưa cấu hình API» — **không** đạt AC attendee QR + staff `GateCamera` trên **prod endpoints**. Không Submit for Review / không publish.

## Target binary (session này)

| Trường | Giá trị |
| ------ | ------- |
| Device | DatHN iPhone · UDID `00008130-000618E402D1001C` · CoreDevice `CB22153A-C24F-547E-87FC-34EC62527838` |
| Installed (USB `devicectl device info apps`) | `com.hangndat.ticket` · marketing **`1.0.0`** · build **`13`** |
| Prior ASC upload (S4-T2) | build **`10`** · Delivery `45c730c3-7caa-4b28-92fb-315cf07bce5d` — build **13** là bản TF mới hơn trên device, chưa re-verify ASC trong session |
| Bundle / Team | `com.hangndat.ticket` · `BLUA62D52G` |
| Lock state | `passcodeRequired=false` · `unlockedSinceBoot=true` |

## Smoke checklist (TF 1.0.0/13 · prod)

| # | Scenario | Yêu cầu AC | Status |
| - | -------- | ---------- | ------ |
| 1 | Launch TF; version = `1.0.0 (13)` | Device thật + binary TF | **PASS** — `devicectl` + `info apps` |
| 2 | Attendee: mở vé / QR display (**prod** API) | Device thật + prod endpoints | **FAIL** — không có API base baked; không vào ví prod / không chụp QR |
| 3 | Staff/Gate: `GateCamera` permission + preview (**prod**) | Camera hardware | **FAIL** — không staff tab (chưa verified prod); deep link `staff` không đổi route; không preview camera |
| 4 | Optional push smoke TF | Device thật | **SKIP** — ngoài tối thiểu; blocker trước là prod config |

### Runtime quan sát (prod bake)

- Màn **Sự kiện** hiện footer **Demo · dữ liệu mẫu** → `showDemoEventCatalog()` chỉ bật khi `getApsEnvironment() !== 'production'` (`apps/mobile/src/identity/config.ts`).
- Banner **Chưa cấu hình API** → `getApiBaseUrl()` null (không Metro inline, không `extra.ticketPublic` prod).
- Kỳ vọng Release/TF: `APS_ENVIRONMENT=production` trước archive (`apps/mobile/app.config.ts` → `https://api.vemoki.com`, OIDC, `aps-environment: production`).

## Lệnh (session 2026-10-19)

```sh
# Launch
xcrun devicectl device process launch \
  --device CB22153A-C24F-547E-87FC-34EC62527838 \
  com.hangndat.ticket

# Version on device
xcrun devicectl device info apps \
  --device CB22153A-C24F-547E-87FC-34EC62527838 \
  --bundle-id com.hangndat.ticket

# Screenshots (DDI + pymobiledevice3 DVT; idevicescreenshot failed screenshotr on iOS 26)
python3 -m pymobiledevice3 developer dvt screenshot \
  apps/mobile/.uat-artifacts/s4-t3/01-launch.png \
  --udid 00008130-000618E402D1001C

# UI automation (accessibility perform_press; native tab bar không đổi tab ổn định)
python3 -m pymobiledevice3 developer accessibility list-items \
  --udid 00008130-000618E402D1001C
```

Deep link thử (`--payload-url`): `vemoki://staff`, `ticketsolution://staff`, `vemoki://my-tickets`, `vemoki://events/demo-mfest` — không đạt staff/QR prod (vẫn Events + demo).

## Artifacts (gitignored PNG)

Path gốc: `apps/mobile/.uat-artifacts/s4-t3/` (local host; không commit).

| File | Mô tả |
| ---- | ----- |
| `01-launch.png` | Cold launch — demo catalog + «Chưa cấu hình API» |
| `05-my-tickets-tab.png` | Sau accessibility tap tab (vẫn Events) |
| `07-fixture-event.png` | Sau `vemoki://events/demo-mfest` — không đổi màn hình prod |

## Blocker / next

1. **Release ops:** upload TF mới archive với `APS_ENVIRONMENT=production` (hoặc `APP_VARIANT=production`) — xác nhận trên device: **không** footer demo, API `https://api.vemoki.com`, đăng nhập OIDC prod.
2. **Operator:** đăng nhập `hangndat@gmail.com` trên device; staff eligibility prod nếu test gate.
3. Re-dispatch S4-T3: checklist #2–#3 + screenshot QR + camera preview.

## Giới hạn / không làm

- Không EAS Cloud Build; không commit IPA/signing/API key.
- Không claim PASS physical TF smoke prod khi binary thiếu bake.
- Không Submit for Review (#332) / release.
- WDA install trên DatHN **không** làm (device chưa registered provisioning — coordinate tap blocked).

## Tip SHA

Evidence docs: commit tip trên branch `hangndat/d13-s4-t3-smoke2` sau cập nhật artifact này (`git rev-parse HEAD`).
