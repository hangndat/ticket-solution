# PP1 — Pilot ready gap audit (đóng D5 parent #6, đề xuất O24)

Ngày: 2026-10-25 · Nhân viên: Gonic (backend) · Nguồn: `gh issue/comment`, Project #3 (GraphQL), `docs/ops/RUNBOOK.md`, `docs/ops/RELEASE-CHECKLIST.md`, `docs/plans/PROD-LAUNCH-UAT.md`, `docs/reviews/D5-*`, `docs/reviews/DEPLOY-PROD-UI859-2026-10-24.md`, và **đọc read-only trực tiếp trên VPS `conanphong`** (health/config presence, không in giá trị secret, không ghi dữ liệu).

## 0. Trạng thái GitHub thật (không suy từ snapshot cũ)

- Issue [#6](https://github.com/hangndat/ticket-solution/issues/6) **CLOSED** 2026-10-17T09:50:50Z. Project #3 field **Trạng thái = "Hoàn thành"** (xác nhận qua GraphQL `projectItems`).
- `docs/ROADMAP.md` (nội dung cập nhật lần cuối 2026-10-17, dòng 25/42/55/197-203) vẫn ghi D5 **"Đang làm"** và liệt "Gate camera + push DELIVERED còn mở" — đây là **docs lệch board**, không phải board lệch thực tế. Theo §0 của chính ROADMAP: *"khi checkbox lệch board, board thắng; sửa roadmap trong PR docs riêng."* → đã sync trong PR đi kèm báo cáo này (xem §4).
- **Không có mâu thuẫn về mức "acceptance complete"**: #6 đủ điều kiện board "Hoàn thành" (DoD §2: review, merge, CI, evidence per-Issue). Nhưng theo ROADMAP §1.1, **"Hoàn thành" trên board ≠ pilot ready** — pilot ready là mức thứ 3, có tiêu chí riêng (security/capacity/restore có số liệu, UAT thiết bị thật, runbook, chỉ số chưa đạt nêu rõ). Mức đó **chưa đạt** — xem bảng gap §1.

## 1. Bảng gap — tiêu chí Pilot ready

| Tiêu chí | Hiện trạng + evidence | Còn thiếu | Owner | Rủi ro |
| --- | --- | --- | --- | --- |
| **Camera admit (staff, thiết bị thật)** | **PASS** đã có evidence thật: build TestFlight `1.0.0 (26)`, DatHN iPhone 15 Pro, 2026-10-21 — staff `review-staff@vemoki.com` quét QR thật, server ghi check-in thật (vé `8c556fad…` → `USED`, undo + spare `02c06057…`). Screenshot sha256 `a84d6531…a208`. [`D13-TF-BETA-SUBMITTED-2026-10-21.md`](D13-TF-BETA-SUBMITTED-2026-10-21.md) | G04 (quét lại cùng QR → từ chối trùng), G05 (từ chối quyền camera → không crash/không cho vào), G06 (mất mạng lúc quét → "Chưa rõ") vẫn **DEFERRED**, chưa có evidence trên máy thật — xem [`docs/plans/PROD-LAUNCH-UAT.md`](../plans/PROD-LAUNCH-UAT.md) suite G | User (thiết bị vật lý) | Thấp — admit path đã chứng minh; 3 case còn lại là edge-case, không chặn pilot nếu ghi rõ là gap đã biết |
| **Push DELIVERED (APNs)** | **PASS** hai lần, không fake: sandbox 2026-10-17 (Dexter iPhone 16 Pro, NC banner on-device) [`D5-APNS-DEVICE-UAT-STATUS.md`](D5-APNS-DEVICE-UAT-STATUS.md); production 2026-10-21 (DatHN iPhone, TestFlight build 26, 2 push qua endpoint production hiện trên máy, chủ dự án xác nhận) — suite H01 trong `PROD-LAUNCH-UAT.md`. VPS live check hôm nay: `AuthKey.p8` mode 400 tồn tại tại `/opt/vemoki/secrets/apns/`; env `APNS_ENABLED`/`APNS_PRODUCTION`/`APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_BUNDLE_ID`/`APNS_KEY_PATH` đều có mặt (chỉ kiểm tên key, không in giá trị) | **Chưa chạy end-to-end qua outbox thật** (cấp vé → `TicketIssued` → worker → APNs → device). Các PASS trên đều là push gửi trực tiếp/test, không qua luồng issue vé thật — ghi rõ trong `H01` | Agent (worker) có thể làm phần trigger từ ticket thật khi user issue vé demo; cần user cầm máy xác nhận banner | Thấp-trung — hạ tầng đã chứng minh chạy; thiếu bằng chứng khớp đúng luồng production thật |
| **MinIO export (prod)** | Env trên VPS đầy đủ (`MINIO_ACCESS_KEY/SECRET_KEY/ENDPOINT/ROOT_*` + 3 bucket name) qua PR [#101](https://github.com/hangndat/ticket-solution/pull/101); container `vemoki-minio-1` healthy (uptime 7 ngày). Lần thử duy nhất ghi nhận là D4-Tenant2 (trước PR #101): HTTP 503 `MINIO_MISCONFIGURED` ([`D4-TENANT2-PROD-UAT.md`](D4-TENANT2-PROD-UAT.md) dòng 53) | **Chưa từng export thành công trên prod sau khi vá.** Query read-only hôm nay trên VPS: bảng `exports` **0 dòng** — chưa có request export nào kể từ khi bảng này tồn tại. Cần: user/staff bấm "Xuất CSV" thật trên admin UI (tenant/event demo) → xác nhận `status=READY` + download | User (admin UI, tạo 1 export job thật) hoặc agent nếu được ủy quyền gọi API admin với tài khoản demo sẵn có | Thấp — container khỏe, config đủ; chỉ chưa có lần chạy thật để đóng gap |
| **Drill backup/restore + RPO/RTO (VPS)** | Chỉ có drill **local/fixture**: `./scripts/d5-backup-drill.sh`, `./scripts/d5-business-restore-drill.sh` — Postgres **vứt bỏ**, không phải VPS. Evidence: [`D5-ISSUE-25-EVIDENCE.md`](D5-ISSUE-25-EVIDENCE.md) (`rto_wall_s≈1`, "Không claim continuous RPO≤15 phút"). `docs/ops/RUNBOOK.md` §4 tự ghi: *"Không phải backup production; RPO continuous chưa đo; RTO in artifact là wall-clock local."* VPS live check hôm nay: `crontab -l` **không có job backup**; `/opt/vemoki/deploy-backups/*` chỉ là snapshot config/source trước mỗi lần deploy (không phải backup DB định kỳ, không phải restore drill) | **Toàn bộ còn thiếu**: chưa có backup DB định kỳ trên VPS, chưa có restore drill chạm bản sao VPS (không chạm DB prod sống), chưa có số RPO/RTO thật. Đây là mục rủi ro cao nhất trong bảng | User ủy quyền + agent (backend/ops) thực thi trên VPS, không chạm DB prod sống (dùng `pg_dump` + restore lên instance/staging riêng) | **Cao** — mất dữ liệu không có backup định kỳ nào đang chạy trên VPS hiện tại |
| **SLO / monitoring (prod)** | `docs/ops/RUNBOOK.md` §2: Prometheus/exporters ghi là **"overlay (local)"**; App RED/USE metrics ghi **"Gap — chờ BE `/metrics`"**. VPS live check hôm nay: `docker ps` **không có** container Prometheus/Grafana/exporter nào đang chạy — API health (`/v1/health`) là tín hiệu duy nhất, không chứng minh DB/OIDC | Chưa có monitoring stack nào trên prod. Cần deploy `infra/observability/compose.observability.yaml` (hoặc tương đương) lên VPS, nối BE `/metrics`, định nghĩa alert tối thiểu theo RUNBOOK §2 | User ủy quyền + agent (backend/ops) | Trung — không phát hiện sớm sự cố Gate/queue/outbox trong giờ sự kiện |
| **Runbook / release checklist** | `docs/ops/RUNBOOK.md` tồn tại, §6.1 on-call đã điền (Hang Nguyen Dat, 2026-10-18). `docs/ops/RELEASE-CHECKLIST.md`: mục merge/CI đã có quy trình; O06 retention đã chốt (2026-10-18) | `RELEASE-CHECKLIST.md` phần **"Trước pilot kỹ thuật"** còn **5/8 mục chưa tick**: R-INT matrix + `rint-outbox-recovery.sh`, platform security-config freeze smoke, Keycloak assurance smoke, platform DB roles check (`ticket_platform_*` NOBYPASSRLS), operator bootstrap doc. Phần **"Sau deploy VPS"** cả 3 mục chưa tick (health, admission fail-closed, backup+restore trên staging) | Backend/ops (agent có thể chạy phần script trong repo; phần "trên VPS" cần user ủy quyền) | Trung — checklist là gate tự đặt, bỏ sót nghĩa là chưa đủ điều kiện tự tuyên bố pilot ready theo tiêu chí của chính dự án |

## 2. Kết luận mức hoàn thành

- **Code complete**: Đạt cho các slice D5 (#24/#25/#26/#56, PR #100/#101/#171) — đã merge `main`, CI xanh tại thời điểm merge.
- **Acceptance complete** (board "Hoàn thành"): Đạt cho parent #6 theo DoD §2 — review độc lập, merge, CI, evidence per-Issue đủ tại thời điểm đóng (2026-10-17).
- **Pilot ready**: **CHƯA ĐẠT.** Hai gap P0 thật: (1) backup/restore + RPO/RTO trên VPS hoàn toàn chưa chạy (chỉ có drill local vứt bỏ); (2) không có monitoring/SLO nào đang chạy trên prod. Ba gap P1: MinIO export prod chưa có lần chạy thành công nào (0 dòng trong `exports`), push DELIVERED chưa qua luồng outbox thật, 3 case camera edge (G04–G06) chưa có bằng chứng thiết bị thật. **Không tự tuyên bố pilot ready** — giữ khuyến nghị `NO-GO` cho tới khi hai gap P0 có evidence, nhất quán với verdict `NO-GO`/`Chưa` trong `PROD-LAUNCH-UAT-2026-10-19.md` và `PILOT-GATES-2026-10-18.md`.

## 3. Việc đã làm trong phạm vi không đổi production

- Kiểm kê toàn bộ nguồn trạng thái: `gh issue view 6` + comments (9 bản ghi, mốc thời gian), GraphQL Project #3 field "Trạng thái", 11 file `docs/reviews/D5-*`, `docs/plans/PROD-LAUNCH-UAT.md`, `docs/ops/RUNBOOK.md`, `docs/ops/RELEASE-CHECKLIST.md`.
- Đọc **read-only** trên VPS `conanphong` (không in giá trị secret, không ghi dữ liệu, không restart service):
  - `docker ps` — container MinIO/Postgres healthy; **không có** container monitoring nào.
  - Tên biến `.env` (không giá trị) — MinIO/APNs config đầy đủ.
  - `ls -la /opt/vemoki/secrets/apns/` — `AuthKey.p8` mode 400 tồn tại.
  - `crontab -l` — không có job backup định kỳ.
  - `psql` read-only — bảng `exports` 0 dòng (chưa từng export trên prod); không query bảng chứa PII.
- PR docs sync `docs/ROADMAP.md` (sửa dòng lệch board, trỏ về báo cáo này) — xem §4.

## 4. PR / thay đổi code

| PR | Nội dung | SHA | CI |
| --- | --- | --- | --- |
| [#910](https://github.com/hangndat/ticket-solution/pull/910) | Sync `docs/ROADMAP.md` §1/§6 dòng D5 theo board "Hoàn thành" + trỏ gap report; không đổi tiêu chí pilot ready | `f3848d0a` | *(chờ CI)* |

## 5. Checklist thiết bị vật lý — user tự chạy

### 5.1 Camera — 3 case còn thiếu (G04–G06)

Thiết bị: build local signed hoặc TestFlight đã cài (không Simulator, không curl).

1. **G04 — quét lại cùng QR đã check-in**
   - Bước: mở app Staff đã đăng nhập, quét một vé **đã** ở trạng thái "Đã vào cổng" (vừa quét ở bước trước).
   - Kỳ vọng: app báo **từ chối trùng** (không cho vào lần hai); server **không** tạo check-in mới.
   - Evidence cần thu: ảnh màn hình staff lúc từ chối + (nếu có quyền) query `tickets.status`/`checkins` xác nhận không có record mới.
2. **G05 — từ chối quyền camera**
   - Bước: trên thiết bị, vào Settings → Vemoki → Camera → tắt quyền. Mở lại app, vào tab Staff/Scan.
   - Kỳ vọng: app hiển thị thông báo xin quyền / hướng dẫn, **không crash**, **không cho vào** (không có cách bypass check-in khi camera tắt).
   - Evidence: ảnh màn hình thông báo + xác nhận app không crash (vẫn mở lại được).
3. **G06 — mất mạng lúc quét**
   - Bước: bật Airplane Mode (hoặc tắt Wi-Fi/data) ngay trước khi quét một vé hợp lệ.
   - Kỳ vọng: app hiển thị **"Chưa rõ"/"Không cho khách qua"** khi mất mạng — không tự nhận PASS, không tự cho vào (fail-closed). Nếu build hiện tại chưa bật hàng đợi offline (D7 chưa triển khai), không kỳ vọng tự đồng bộ lại.
   - Evidence: ảnh màn hình trạng thái "Chưa rõ" + video ngắn (nếu có) cho thấy không bấm được "cho vào" khi offline.

### 5.2 Push DELIVERED qua luồng thật (outbox)

1. User mở Admin/Portal, issue một vé demo thật cho một tài khoản attendee demo đã cài app và cho phép notification.
2. Trong vòng ~1 phút, kiểm tra thiết bị: có banner/Notification Center hiện **"Vé đã sẵn sàng"** không (không chỉ `ACCEPTED` trong log).
3. Báo lại coordinator/agent thời điểm chính xác + ảnh màn hình banner — agent sẽ đối chiếu `notifications.state` trong DB (read-only) để xác nhận khớp `DELIVERED`.

### 5.3 MinIO export CSV trên prod

1. User mở Admin UI (tenant/event demo đã biết, ví dụ Aurora Night), vào màn hình Export → chọn CSV → bấm Xuất.
2. Kỳ vọng: job chuyển `READY`, có link download tải được (không lộ dữ liệu khách thật nếu dùng data demo).
3. Báo lại thời điểm bấm — agent sẽ đọc read-only bảng `exports` để xác nhận `status=READY`, không in `object_key`/nội dung file.

## 6. Hành động production cần user ủy quyền

| # | Hành động | Lệnh/bước | Rủi ro | Rollback |
| --- | --- | --- | --- | --- |
| 1 | Backup DB định kỳ trên VPS (cron `pg_dump` → lưu off-box, không chạm DB sống khi restore) | Thêm cron trên `conanphong`: `pg_dump` vào `/opt/vemoki/backups/` (hoặc rclone ra ngoài VPS); **không** `docker compose down`/restart service hiện có | Thấp nếu chỉ thêm cron đọc (dump), không khóa bảng lâu với `-Fc` | Xoá cron entry; không ảnh hưởng runtime |
| 2 | Restore drill thật trên **bản sao** (staging/instance riêng, không phải DB prod sống) | Dựng Postgres tạm từ dump mới nhất → `pg_restore` → đối soát ticket/check-in/quota/`credentials.kid` → đo RPO/RTO thật | Thấp — instance tạm, không đụng prod | Hủy instance tạm |
| 3 | Deploy monitoring stack lên VPS (Prometheus/exporter, nối BE `/metrics`) | `docker compose -f infra/observability/compose.observability.yaml --env-file /opt/vemoki/.env up -d` (ghép vào compose hiện hành, không trùng port với service khác); restart `api`/`worker` nếu cần bật endpoint `/metrics` mới | Trung — thêm container tốn RAM/CPU VPS; restart api/worker gây downtime ngắn | `docker compose ... down` dừng container monitoring; không đổi schema/data |
| 4 | Trigger export CSV thật trên prod (xem §5.3) — tạo 1 object trong bucket `vemoki-exports` + 1 row `exports` | Thao tác qua Admin UI, không qua script agent trực tiếp trừ khi user ủy quyền gọi API | Thấp — dữ liệu demo, không phải khách thật | Xoá object/bucket nếu cần dọn (không bắt buộc) |
| 5 | Issue vé thật qua outbox để xác nhận push DELIVERED end-to-end (xem §5.2) | Qua Admin UI issue vé demo | Thấp — dùng tài khoản/tenant demo đã biết | Không cần rollback (vé demo) |
| 6 | 3 case camera vật lý G04–G06 (xem §5.1) | Thao tác tay trên thiết bị đã cài app | Không — chỉ đọc/quan sát trên thiết bị của user | Không cần |

## 7. Blocker / cần user quyết định

- Không có blocker chặn việc viết báo cáo này. Các hành động ở §6 đều cần **user tự thao tác** (thiết bị vật lý) hoặc **user ủy quyền rõ** (đổi production) trước khi agent tiếp tục — theo đúng giới hạn "Cấm" trong Task Spec.
- Khuyến nghị: không đóng/reopen Issue #6 (đã closed đúng theo DoD "acceptance complete"); thay vào đó mở Issue mới (hoặc sub-issue PP1) riêng cho "Pilot ready gates" nếu user muốn track §1 trên Project #3, để tránh lẫn hai mức hoàn thành trên cùng một Issue.
