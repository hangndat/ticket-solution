# VCX-932 E01 — Owner config UAT (Noah · runtime restore)

**Ngày:** 26/10/2026 · **Issue:** [#932](https://github.com/hangndat/ticket-solution/issues/932) · **PR:** [#963](https://github.com/hangndat/ticket-solution/pull/963)
**integrationSha (merge main + CAS/capability/unsaved):** `51fcd86f7acf95b3a7362a0bc6310707c1aee0a6`
**priorTestedSha (PR #963 tip):** `6b2a5ffa5c5fe6bec321d7d64079147ef788994b`
**portalBuildId @ integration:** `_8PxUE1nhvhw-KLm-X__p`
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

**Verdict Noah @ `6b2a5ff`:** `PASS` (first-save, 409, reload, preview, matrix VI — artifacts trước merge).
**Verdict Noah @ `51fcd86f` (re-probe hẹp):** `PARTIAL` — CAS/preview/first-save/reload **PASS** trên stack restart; **unsaved cancel/confirm** chưa chứng minh qua Orca (harness, không claim bug — xem `integration-51fcd86-probe.json`, tests unit đã PASS theo coordinator).
**Matrix @ integration:** reuse `matrix-config-*-vi.png` @ `6b2a5ff` (layout không đổi; lý do trong checkpoint).

## Provenance

| Thành phần | Giá trị |
| --- | --- |
| Worktree | `/Users/admin/SideProject/ticket-solution/vcx-932-uat-next` |
| Portal | **`http://uat932.localhost:3016`** — `next start` @ `127.0.0.1:3016`, BUILD_ID `_8PxUE1nhvhw-KLm-X__p` @ `51fcd86f` |
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

## Integration revalidation (`51fcd86f`)

- Stack restart: API `:3542`, portal `:3016` / `uat932.localhost`; PID cập nhật trong `.local-dev/.uat-artifacts/vcx932-noah/*.pid` (stale `60116`/`62143` bỏ qua).
- Artifact: `integration-51fcd86-probe.json`, `integration-51fcd86-1024-vi.png`, `CHECKPOINT-51fcd86.md`.
- CI coordinator: 204 tests / lint / typecheck / build PASS — Noah không chạy lại full suite.

## Giới hạn

- Không commit/push/merge; không sửa `apps/portal` / API / contracts.
- Không spawn Orca Run / `worker_done`.
- James vẫn cần revalidate E01 trên **integrationSha** + packet trước acceptance.
- **Device / mail thật:** chưa đạt — không chờ trong phiên này.

## Gợi ý sau #932 (không thực hiện song song)

Cùng API `:3542` + DB isolated có thể **reuse** cho #926 nếu dùng **hostname riêng** (vd. `uat926.localhost`) + client OIDC riêng và **không** dùng chung persona/session với #932 trong một lượt. Hoàn tất review #932 trước khi coordinator mở UAT #926 trên stack này.

## Coordinator bổ sung E01 trên integration SHA (26/10)

Minh kiểm lại bằng Orca trên `51fcd86f7acf95b3a7362a0bc6310707c1aee0a6`, Build ID `_8PxUE1nhvhw-KLm-X__p`, Owner fixture, origin `http://uat932.localhost:3016`. Artifact canonical bổ sung: `leader-unsaved-probe.json`, `leader-unsaved-cancel-1024-vi.png/.snapshot.json`, `leader-saved-1024-vi.png/.snapshot.json`. Hai PNG đo thật 1024×900.

- Cancel: native input/change đổi field organizationName, click link brand thật, prompt xác nhận được gọi; chọn hủy giữ route config và giá trị đã nhập.
- Confirm: cùng prompt, chọn rời đi, route chuyển tới onboarding tenant.
- Save UI: click nút Lưu draft thật, ghi nhận fetch đi BFF thật trả201, expectedVersion4 → version5, payload brand đúng; DOM preview bản đã lưu v5.
- Sau save2xx, điều hướng không còn prompt.

Phương pháp: Orca eval gọi setter HTMLInputElement nguyên bản + dispatch bubbling input/change, click DOM anchor/button thật. window.confirm được instrument để ghi prompt và chọn cancel/confirm xác định; không sửa React state, dirty registry, auth hay response API. Khác probe trước: field ProForm có UUID prefix nên phải dùng suffix `_organizationName`; thiếu active tab và thao tác fill/click không phát event cũng làm probe trước sai. Không kết luận bug sản phẩm từ harness trước. Mọi tab do coordinator mở đã đóng.

Correction provenance ảnh cũ: các ảnh probe/preview/integration mang nhãn1024 nhưng PNG1462×1834 không được dùng làm bằng chứng viewport1024; viewport thực tế các ảnh đó chưa được chứng minh. Matrix riêng `matrix-config-390x844-vi.png`, `matrix-config-1024x900-vi.png`, `matrix-config-1440x900-vi.png` đúng kích thước; hai ảnh leader bổ sung1024×900 làm bằng chứng affectedjourney mới. Không đổi ảnh cũ để hợp nhãn.

`B-932-UNSAVED-ORCA` và phần pending E01-51f-UNSAVED đã có evidence đóng, chờ James xác nhận độc lập. Tái dùng CAS409/reload/preview và matrix cũ theo diff, không mở vòng UAT toàn bộ. Hai gate thiết bị/inbox đã được user mở lại và đối chiếu ở Epic914; giới hạn cuối phiên Noah ở trên là lịch sử, không còn điều kiện chờ user.
