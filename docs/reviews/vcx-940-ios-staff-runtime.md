# VCX-940 — Runtime probe (iOS Staff sim, fixture stack)

| Trường | Giá trị |
| --- | --- |
| Issue / PR | [#940](https://github.com/hangndat/ticket-solution/issues/940) · [PR #960](https://github.com/hangndat/ticket-solution/pull/960) |
| **sourceSHA** (verify-first) | `357ec5c08b43b514391c59d5c0715e3ae406a00e` — giữ nguyên packet gốc |
| **actualSHA** (runtime dispatch) | `a70c9a3e1824f0b24b2f863adaeca3ecd8c34e76` (`git rev-parse HEAD`, worktree `vcx-940-staff`, **clean**) |
| Persona | **Zico** · role `ios` · không sửa product code |
| Simulator | **D11-Gate-UAT** `121ECECA-D9F9-45D6-BC69-789958E07055` (task-owned) |
| Orca | `orca emulator attach D11-Gate-UAT` · AX + `xcrun simctl io … screenshot` |
| executionHostId | `local` (Orca ports scan `scannedAt` 2026-10-26, rows rỗng cho worktree — stack UI869 chạy từ worktree khác, PID ownership bên dưới) |

## Local prerequisites & build (repo gate)

| Bước | Kết quả | Artifact |
| --- | --- | --- |
| Xcode | 26.5 (17F42) | — |
| CocoaPods | `/opt/homebrew/bin/pod` | `apps/mobile/.uat-artifacts/vcx-940/pod-install.log` (gitignored) |
| `expo prebuild --platform ios --no-install` | PASS | `…/prebuild.log` |
| `pod install` | PASS | `…/pod-install.log` |
| `xcodebuild` Release · iphonesimulator · team `BLUA62D52G` | **BUILD SUCCEEDED** | `…/xcodebuild-sim-release.log` · tail commit-safe: [`vcx-940-ios-build-tail.txt`](./vcx-940-ios-build-tail.txt) |
| Bundle env (bake Release) | `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3498` · `EXPO_PUBLIC_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket` · `EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile` · `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` | Không ghi token |

**Không** dùng cổng lịch sử D11 `4111` / `18091` — đã xác minh stack UI869: API **3498**, web **3417**, OIDC compose **8180** (map vào container), API process JWKS **8080** (xem blocker).

## Stack & ports (đọc thực tế)

| Service | Loopback | PID / ghi chú |
| --- | --- | --- |
| API `/v1/health` | `127.0.0.1:3498` | node **89392** · `UI869_RUNTIME_DATABASE_URL` → `ticket_ui869_dev` @ `55433` |
| Web | `127.0.0.1:3417` | **98957** |
| Keycloak ui869dev (compose) | `127.0.0.1:8180` | OrbStack **2022** · persona `scanner.fixture@…` password grant **OK** |
| Keycloak API JWKS (env API) | `127.0.0.1:8080` | Cùng host OrbStack · `staff@example.com` / `attendee@example.com` OK · **không** có `scanner.fixture@…` |

`./scripts/dev-local-stack.sh status` (worktree `vcx-940-staff`): containers `ui869dev` healthy; API/web PIDs “not running” theo state file local (stack thực tế do worktree `vd08-local-oidc`).

## Fixture #925 (data) vs scanner OIDC (runtime)

| Hạng mục | Trạng thái |
| --- | --- |
| Persona catalog / API matrix #925 | **Done** (merged); không ghi `pending925` |
| `scanner.fixture@example.com` token @ **8180** | Issued OK (local fixture password; không log token) |
| Cùng token → `GET :3498/v1/me/events` | **401** — API verify JWT issuer **8080** |
| `scanner.fixture@…` @ **8080** | `invalid_grant` — user chưa trên realm listener 8080 |
| **Blocker B-OIDC-UI869** | Owner **coordinator / stack** (`vd08-local-oidc` hoặc `dev-local-stack up`): align `OIDC_ISSUER`/`OIDC_JWKS_URL` API với Keycloak UI869 (**8180**) hoặc replicate persona lên realm 8080 **trước** sim OIDC scanner |

## Sim session (sanitized)

**Không** mock auth response. Session qua deep link UAT (Release bake `EXPO_PUBLIC_ALLOW_UAT_SESSION=1`):

1. Password grant **chỉ** để lấy bearer local (`ticket-web` + dev secret — không commit).
2. Persona dùng trong sim lần này: **`staff@example.com`** (legacy UI869 Owner path) — **không** thay `scanner.fixture` vì blocker trên.
3. `vemoki://uat/session?access_token=…` → staff workspace.

**AX (Orca) sau session** — tab Quét vé / MFest:

- Heading: `MFest · Demo`
- Sticky: `Sẵn sàng` · `Chưa mở phiên cổng`
- Tabs: `Quét vé` · `Nhập tay` · `Lịch sử`
- Manual: field `Nhập mã trên vé` · `Kiểm tra vé`

**API context (staff@, sanitized):** `GET /v1/me/events` @ `:3498` → event đầu `MFest · Demo` với permissions gồm `gate.confirm`, `gate.undo`, `ticket.revoke` (UUID rút gọn trong log nội bộ).

**Screenshots (gitignored):**

- `apps/mobile/.uat-artifacts/vcx-940/staff-scan-mfest-chrome.png`
- `apps/mobile/.uat-artifacts/vcx-940/staff-manual-tab.png`

## Revoke giữa ca

**Không chạy** — task cấm reset shared realm / đổi MFA để “PASS”. Revoke runtime vẫn **blocker acceptance** cùng F-940-01 (scanner OIDC) cho AC ma trận đầy đủ.

## Giới hạn (không claim PASS acceptance)

- Simulator **không** chứng minh camera QR / offline đa thiết bị (**B-03**).
- Không quét mã thật / không mutate membership revoke.
- Partial sim ≠ ma trận #925 scanner persona + revoke E2E.

**Verdict runtime (worker):** Build local **đạt**; sim Staff chrome **partial** (legacy staff@); **acceptance #940 chưa đạt** (scanner #925 OIDC + revoke + device).
