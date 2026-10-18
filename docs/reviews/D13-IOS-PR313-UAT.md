# D13 PR #313 — Headless iOS UI UAT (S5-T1 Privacy)

| Trường | Giá trị |
| ------ | ------- |
| Task | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · S5-T1 [#328](https://github.com/hangndat/ticket-solution/issues/328) · PR [#313](https://github.com/hangndat/ticket-solution/pull/313) |
| Role | `ios` · `docs/agents/roles/ios.md` |
| Architecture impact | **Không** — build + UAT implementation hiện hữu |
| Agent / Dispatch | Cursor · `task_70e39bc08761` / `ctx_6b3c6039d7bd` / `term_d8a3b49a-8704-4034-b9a3-db93615c317d` |
| Source / reviewed SHA (exact) | `6585f596c87f14cfc30601f4c85355cd26494534` |
| Behavior SHA (Privacy/deletion) | `639cde6a8179b3383195fb9d12db85a140307bfc` |
| DoD/security prior | `ctx_8f88e0c0fb9e` · artifact `docs/reviews/D13-PR313-DOD-SECURITY.md` @ `b223d3bc3ff59f69a735bf56dae589ed10f93b30` — **PASS with known gap** (UI UAT) |
| Ngày UAT | 2026-10-18 |
| **Verdict UI UAT** | **PASS** (signed-out Privacy AC) · signed-in deletion UI **N/A** (không fixture OIDC task-specific; không mock auth) |

> Test-only evidence: **không** đổi tip SHA của PR #313. Artifact này sống trên branch docs `hangndat/docs-d13-pr313-dod-security` (cùng DoD).

## 1. Local build (không EAS / cloud)

| Hạng mục | Evidence |
| -------- | -------- |
| Source HEAD | `git rev-parse HEAD` trên feature = `6585f596c87f14cfc30601f4c85355cd26494534` trước prebuild |
| Tooling | Xcode **26.5 (17F42)** · iOS Simulator SDK **26.5** · Team **`BLUA62D52G`** |
| Prebuild | `cd apps/mobile && pnpm exec expo prebuild --platform ios --no-install` → `ios/` (gitignored) |
| Pods | `pod install` trong `apps/mobile/ios` |
| Build | `xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=C6CA47F1-4C0C-40CC-8444-324759B7A178' -derivedDataPath /tmp/d13-pr313-derived-release CODE_SIGNING_ALLOWED=NO build` → **BUILD SUCCEEDED** |
| Binary | `CFBundleShortVersionString=1.0.0` · `CFBundleVersion=10` · `com.hangndat.ticket` · embedded `main.jsbundle` |
| Note | Debug không Metro → redbox “No script URL”; Release embed JS dùng cho UAT |

## 2. Task-specific simulator (không đụng sim worker khác)

| Field | Value |
| ----- | ----- |
| Name | `D13-S5T1-PR313-UAT` |
| UDID | `C6CA47F1-4C0C-40CC-8444-324759B7A178` |
| Runtime | iOS 26.5 · iPhone 17 |
| Boot | `scripts/sim-uat.sh boot <UDID>` (không `open -a Simulator`) |
| Không dùng | Booted sẵn `F191CF59-…` (iPhone 17 Pro) · `F218D06A-…` (D11-236) |

Driver: **AXe + simctl** qua `scripts/sim-uat.sh` — không mouse / AppleScript / ORCA computer click.

## 3. AC — Account signed-out → Privacy

Release build không có `.env` OIDC → fail-closed signed-out (`Phiên: unknown`) — đúng “không giả lập user”.

```bash
./scripts/sim-uat.sh launch com.hangndat.ticket C6CA47F1-4C0C-40CC-8444-324759B7A178
./scripts/sim-uat.sh tap --udid C6CA47F1-4C0C-40CC-8444-324759B7A178 --label 'Vé của tôi'
# AccountScreen nhúng khi !isOidcConfigured()
./scripts/sim-uat.sh tap --udid C6CA47F1-4C0C-40CC-8444-324759B7A178 --label 'Chính sách quyền riêng tư'
```

| Check | Kết quả |
| ----- | ------- |
| Nút **Chính sách quyền riêng tư** visible | **PASS** — a11y + screenshot `04-account-signed-out.png` |
| Label URL `https://vemoki.com/privacy` | **PASS** — `04-labels.txt` / describe |
| Tap → Safari | **PASS** — describe `AXLabel: Safari`, `AXValue: vemoki.com` |
| Page content O06 privacy | **PASS** — screenshot `07-privacy-loaded.png`: title **Quyền riêng tư**, `Cập nhật: 2026-10-18 (O06)`, đoạn anonymize account deletion |
| `curl -sI https://vemoki.com/privacy` | **HTTP/2 200** · rewrite `/marketing/privacy` |

Source wire: `PRIVACY_POLICY_URL = 'https://vemoki.com/privacy'` → `Linking.openURL` trong `PrivacyPolicyLink`.

## 4. AC — Signed-in deletion copy (O06 ≤30 ngày)

| Check | Kết quả |
| ----- | ------- |
| Session verified thật | **Không chạy** — không credentials/OIDC task-specific an toàn; không dùng Keycloak/DB của worker khác; **không** mock auth production |
| Unit copy O06 | **14/14 pass** — `node --experimental-strip-types --test src/account-deletion/*.test.ts` trên SHA `6585f59…` (log gitignored: `apps/mobile/.uat-artifacts/pr313-s5t1-uat/unit-account-deletion.txt`) |
| Source explainer | `accountDeletionExplainer()` chứa “anonymize trong ≤30 ngày… ACK ≠ erasure” |
| Authenticated POST prod | Ngoài scope — S5-T2 / reviewer demo (read-only prod đã cover ở DoD) |

## 5. Artifacts (gitignored)

Path: `apps/mobile/.uat-artifacts/pr313-s5t1-uat/`

| File | Nội dung |
| ---- | -------- |
| `meta.txt` | SHA, UDID, version 1.0.0 (10), Xcode, team |
| `03-release-launch.png` | Events home sau Release launch |
| `04-account-signed-out.png` | Signed-out Account + Privacy button + URL |
| `04-describe.json` / `04-labels.txt` | A11y tree signed-out |
| `07-privacy-loaded.png` | Safari privacy page O06 |
| `07-describe.json` | Safari a11y (Address `vemoki.com`) |
| `unit-account-deletion.txt` | 14/14 |

## 6. Cleanup

- `scripts/sim-uat.sh terminate com.hangndat.ticket <UDID>`
- Shutdown task sim `D13-S5T1-PR313-UAT` (không shutdown sim worker khác)
- Không archive / upload / TestFlight / ASC submit

## 7. Limitations

- Simulator-only (không physical camera/push).
- Safari address bar hiển thị domain rút gọn `vemoki.com`; path xác nhận qua in-app URL label + page title/O06 body + `PRIVACY_POLICY_URL` constant.
- Signed-in deletion panel UI UAT chờ fixture OIDC task-owned (S5-T2).
