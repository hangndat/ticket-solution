# D13 — ASC / credential preflight (READ-ONLY)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | **2026-10-18** |
| Tip SHA |  |
| Scope | Read-only status — **không** in key/token/issuer/private key material |
| Bundle | `com.hangndat.ticket` |
| Team | `BLUA62D52G` |
| Competing archive/upload procs | **None** observed (`pgrep` xcodebuild/altool/Transporter/fastlane) |

## 1. Tooling local

| Hạng mục | Status |
| -------- | ------ |
| Xcode | PRESENT — 26.5 (17F42) |
| `xcrun` / `altool` (ContentDelivery) | PRESENT |
| fastlane CLI | PRESENT — 2.241.0 (không có `apps/mobile/fastlane` lane trong repo) |
| ASC API Key file (`AuthKey_*.p8`) | PRESENT (paths under `~/.appstoreconnect/private_keys` + mirrored copies — **not logged**) |
| Env `APP_STORE_CONNECT_API_KEY_PATH` | PRESENT |
| Env `APP_STORE_CONNECT_API_KEY_ID` | PRESENT |
| Env `APP_STORE_CONNECT_API_ISSUER_ID` | PRESENT |
| Apple Development cert (Hang Nguyen Dat) | PRESENT |
| Apple Distribution cert (`BLUA62D52G`) | PRESENT |
| Company SCHMELER cert also on machine | PRESENT (ignore for this app) |
| Provisioning `com.hangndat.ticket` (Team + **Store**) | PRESENT |
| Bundle ID registry ASC | PRESENT — seed `BLUA62D52G`, id `DL7UU9VU26` |

## 2. App Store Connect app snapshot (API)

| Field | Value |
| ----- | ----- |
| App id | `6823694490` |
| ASC display name | **Ticket Solution** (≠ `app.config` name **Vemoki**) |
| Bundle | `com.hangndat.ticket` |
| SKU | `hangndat-ticket` |
| Primary locale | `en-US` |
| App Store version | `1.0` · state **PREPARE_FOR_SUBMISSION** · id `7c5ac05b-f543-4f71-8af3-a7b40073de7a` |
| Version ↔ build | **null** (chưa chọn build cho version) |
| Builds (filter app) | **9** builds; processing **VALID**; build strings **2…10** (latest **10**, uploaded 2026-10-17) |
| Localization en-US description / keywords / whatsNew | **missing** |
| supportUrl / marketingUrl / privacyPolicyUrl (version loc) | **missing** |
| Screenshot sets | **0** |
| AppInfo name | Ticket Solution · subtitle **missing** · privacyPolicyUrl **missing** |
| Age rating declaration | PRESENT (resource exists) |
| App Store Review Detail | **null** |
| `/agreements` | API **404** (path not available to this key / API version) — **Unknown** Paid/Free Apps Agreement status via this call |
| Territory / availability | API paths tried → **404** — **không** suy All territories; **VN đề xuất, user chưa chốt** (coordinator đã hỏi — không hỏi lại) |

## 3. Runtime companions (fact)

| Check | Result |
| ----- | ------ |
| `GET https://vemoki.com/privacy` | **HTTP 200** |
| `POST https://api.vemoki.com/v1/me/account-deletion-requests` (no auth) | **HTTP 400** (route exists; not 404) |
| `GET …/account-deletion-requests/current` (no auth) | **HTTP 422** (route exists; not 404) |

## 4. Blockers cho S3 / S4 / S6 (handoff coordinator)

1. ASC listing metadata + Privacy URL + screenshots còn trống (G2/G3 D10 vẫn mở).  
2. ASC app name vẫn “Ticket Solution” — cần rename / sync Vemoki trước submit.  
3. Version chưa gắn build VALID; Review Detail null.  
4. Territory chưa chốt user → **cấm** chọn All.  
5. Agreement status **Unknown** qua API này — cần xác nhận trên ASC UI bởi account holder trước S6.  
6. **Không** upload/submit trong Task này (chờ DoD exact SHA + headless UAT + physical-device gates).
