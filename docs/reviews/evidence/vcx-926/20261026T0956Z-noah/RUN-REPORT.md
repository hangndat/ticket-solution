# VCX-926 runtime UAT — Noah worker · `20261026T0956Z-noah`

| Mục | Giá trị |
| --- | --- |
| Issue | [#926](https://github.com/hangndat/ticket-solution/issues/926) |
| PR | [#952](https://github.com/hangndat/ticket-solution/pull/952) (đã merge) |
| reviewedSHA | `null` (chờ James trên packet này) |
| previousMeasuredSHA (James run cũ) | `d00a265cca1206b68601c75d445b633f7d590b57` |
| testedSHA (worktree) | `33713db2cfffed29cad98ce9b2077490be5987b6` |
| CI | Chưa chạy lại trên testedSHA trong task này |
| Verdict runtime | **GAP / NO-GO** — không claim W1 acceptance |

## Stack (ownership) — port map #926

| Dịch vụ | Port | URL | Owner / ghi chú |
| --- | --- | --- | --- |
| Portal | **3013** (reserved) | `http://127.0.0.1:3013` | vcx-926-uat — Orca `cwd` |
| API | **3499** actual / **3598** reserved | `http://127.0.0.1:3499` | vcx-926-uat API; :3598 chưa bind tại probe, :3498 foreign bỏ qua |
| OIDC | 8080 | shared ui869dev | không exclusive #926 |
| Postgres | 55433 | shared ui869dev | không exclusive #926 |
| **Không dùng** | 3498 | — | PID 89392 `.Trash/vd08` |
| **Isolation #939** | 3014 / 3698 | — | Linh939 — không overlap |

Chứng minh: `ports-orca.json` (scan `orca ports --worktree path:vcx-926-uat`).

## F03 (Med) — chẩn đoán harness

**Root cause:** Runner gọi `fetch("/api/bff/me/tenants")` khi tab vẫn ở origin Keycloak (`8080`) → status **404 giả**, không phải deny sản phẩm.  
**Fix (gitignored):** `run-vcx-926-uat.mjs` — chỉ poll tenants sau `location.href` bắt đầu bằng portal base; OTP retry.  
**Xác nhận:** Tab Orca riêng + login đủ TOTP → Manager/CS `bff/me/tenants` **200**.

## F04 (Med) — MFA fixture

`ticket-admin-web` yêu cầu TOTP đã enroll; `enroll-staff-totp.mjs` idempotent, secrets trong `totp-secrets.json` (gitignored). Không bypass MFA.

## F05 (High) — coverage đại diện @1024

| Persona | Route | Kỳ vọng AC | Thực tế | Session evidence |
| --- | --- | --- | --- | --- |
| CS | support | allowed | content, không spinner | auth 200 |
| CS | setup | denied | «Không có quyền» | auth 200 |
| Manager | cross-studio events | denied cross-tenant | «Không có quyền» | auth 200 |
| Manager | overview | allowed | content | auth 200 |
| report-only | gate | denied / report scope | «Không có quyền báo cáo cổng» | auth (manual) |
| Scanner | overview | scanner chrome | content, **adminChrome=false** (cần review UI AC) | auth (manual) |

**Chưa chạy:** viewport 390/1440, Supervisor, ma trận full batch sau fix runner.

## F01 — guests/audit (regression nghi ngờ)

Tại **testedSHA** `33713db2`, Owner đăng nhập hợp lệ (TOTP) nhưng `/guests` và `/audit` → **«Không có quyền»** (khác run James @ `d00a265` PASS). **Báo coordinator — có thể bug sản phẩm hoặc drift fixture**, không sửa auth policy trong task.

## Artifacts

- `manifest.json`, `manual-probe-results.json`, `probe-results.json`
- Screenshots `1024-*.png` (đã redact, không cookie/TOTP)

## Orca

`orca tab create --worktree path:.../vcx-926-uat` + `orca exec --page <id> goto|fill|screenshot`.
