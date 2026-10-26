# VCX-932 E01 — Owner config UAT (Noah · runtime restore)

**Ngày:** 26/10/2026 · **Issue:** [#932](https://github.com/hangndat/ticket-solution/issues/932) · **PR:** [#963](https://github.com/hangndat/ticket-solution/pull/963)  
**testedSHA (portal + API build):** `6b2a5ffa5c5fe6bec321d7d64079147ef788994b`  
**Vai trò:** Noah (root tooling / local runtime) — **không** thay James `dod+sec` / acceptance Epic.

## Kết luận runtime

| Hạng mục | Kết quả |
| --- | --- |
| OIDC / BFF | **PASS** — fixture client riêng; `GET /api/bff/me/events` **401** khi chưa đăng nhập; Owner login + TOTP thật qua Orca |
| First-save (isolated DB) | **PASS** — reset chỉ trên `ticket_vcx932_leader_20261026`; UI lưu + API `201` version 1 |
| Conditional save **409** | **PASS** — `REVISION_CONFLICT` với `expectedVersion: 0` sau bump; xem `conflict-409-sanitized.json` |
| Reload | **PASS** — tái vào `/config` sau conflict (probe screenshot) |
| Preview (đúng version đã lưu) | **PASS** — probe `preview-probe.json`: eval click nút «Xem trước» hàng v2; BFF `…/config-versions/2/preview` **200**; DOM `Xem trước bản đã lưu v2`, brand + ≥6 sections khớp API |
| Copy (checkpoint cũ) | **N/A** — Issue #932 không yêu cầu clipboard/control copy; không mở gate |
| Viewport VI 390 / 1024 / 1440 | **PASS** — ảnh `matrix-config-*-vi.png` |

**Verdict Noah (runtime evidence only):** `PASS` — E01 Owner journey local đủ AC runtime (first-save, 409, reload, preview version, matrix VI); James vẫn cần review độc lập trước acceptance.

## Provenance

| Thành phần | Giá trị |
| --- | --- |
| Worktree | `/Users/admin/SideProject/ticket-solution/vcx-932-uat-next` |
| Portal | **`http://uat932.localhost:3016`** — `next start` @ `127.0.0.1:3016`, BUILD_ID `30TZ_QqMSZGswuUUUklsx` |
| API | `http://127.0.0.1:3542` — `node dist/main.js` cùng SHA worktree |
| OIDC | `http://127.0.0.1:8180/realms/ticket` |
| DB isolated | `ticket_vcx932_leader_20261026` / `vcx932_leader_rt` (snapshot từ `ticket_ui869_dev`, không sửa DB nguồn) |
| Port 3015 | **Không dùng** — listener thuộc `vcx-928-context` (Portal #928); giữ takeover user |
| Cookie isolate | **Host fixture** `uat932.localhost` + client `ticket-admin-web-vcx932-uat932` — **không** đổi tên cookie auth; tránh jar chung `localhost` với `:3015` (`cookie-isolation-probe.json`) |

Orca ports: `docs/reviews/evidence/vcx-932/noah-next/ports-orca.json` (`owner.confidence: cwd` trên worktree #932).

## Khôi phục fixture

Script (gitignored): `.local-dev/.uat-artifacts/vcx932-noah/` — `bootstrap-db.sh`, `start-stack.sh`, `ensure-oidc-client.mjs`, `run-config-uat.mjs`.

- Clone DB + `GRANT` runtime (sửa thiếu ACL sau `pg_dump --no-acl`).
- Client Keycloak **mới** `ticket-admin-web-vcx932-uat932` — redirect/origin `http://uat932.localhost:3016/*` (không sửa `ticket-admin-web` / user realm).
- Credentials DB/OIDC client secret: file `env.sh` / `portal.env` trong thư mục trên — **không** commit.

## Orca (probe rồi matrix)

1. Probe @1024 VI: login Owner → `/config` → first-save → API 409 → reload.  
2. Matrix 390 / 1024 / 1440 VI trên cùng journey.  
3. Tab Orca đã đóng sau chạy; API + portal **giữ** cho review (`78593` / `80223` tại scan ports).

Packet: [`docs/reviews/evidence/vcx-932/noah-next/`](evidence/vcx-932/noah-next/) (`uat-results.json`, PNG, `conflict-409-sanitized.json`).

## Cookie / host (bắt buộc cho Orca)

- **Origin:** `http://uat932.localhost:3016` — không dùng `127.0.0.1:3016` cho session Owner #932 (jar `localhost` trùng #928).
- **OIDC client:** `ticket-admin-web-vcx932-uat932` · **Actor:** `owner.fixture@example.com` (Owner, TOTP fixture).
- Evidence: `cookie-isolation-probe.json`, `preview-probe.json` → `hostProfile`.

## Giới hạn

- Không commit/push/merge; không sửa `apps/portal` / API / contracts.
- Không spawn Orca Run / `worker_done`.
- James vẫn cần revalidate E01 trên packet + CI SHA trước acceptance.
- **Device / mail thật:** ngoài scope phiên này (user chốt chỉ local code/UAT); không chờ gate đó.

## Gợi ý sau #932 (không thực hiện song song)

Cùng API `:3542` + DB isolated có thể **reuse** cho #926 nếu dùng **hostname riêng** (vd. `uat926.localhost`) + client OIDC riêng và **không** dùng chung persona/session với #932 trong một lượt. Hoàn tất review #932 trước khi coordinator mở UAT #926 trên stack này.
