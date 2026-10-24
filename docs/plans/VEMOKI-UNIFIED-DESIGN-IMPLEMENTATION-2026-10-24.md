# Kế hoạch triển khai thiết kế Vemoki thống nhất — 24/10/2026

**Trạng thái:** đã duyệt và triển khai; VD-00…VD-07 code complete, VD-08 đang nghiệm thu. **Architecture impact: Có** (kênh Gate O23, route/deep link, token adapter và các ranh giới host/tenant). **Mẫu chuẩn:** [`vemoki-unified-v1`](../design/vemoki-unified-v1/DESIGN-ACCEPTANCE.md), pin từ nguồn cuối `Vemoki-Complete 2`; không dùng export `github-pr/` cũ. Thiết kế đã chốt ở mức concept; HTML/PNG không phải UI production hay bằng chứng nghiệm thu app.

## 1. Baseline và phạm vi

- Source đang đối chiếu: `HEAD 9e6565af` ngày 24/10/2026. Quyết định [O23](../DECISION-LOG.md): quét, nhập tay và xác nhận Gate chỉ trên iOS Staff; Portal chỉ đọc báo cáo theo `report.read`.
- [Epic #786](https://github.com/hangndat/ticket-solution/issues/786) đã đóng D-6; `apps/web/app/gate` không còn. Vẫn có link/copy cũ (`apps/web/src/portal/dual-run-banner.tsx`, marketing demo copy), nên cần kiểm tra migration thay vì xây lại scanner.
- [Epic #766](https://github.com/hangndat/ticket-solution/issues/766) còn mở cho web design system; [Epic #867](https://github.com/hangndat/ticket-solution/issues/867) còn mở cho UI audit. [PR #870](https://github.com/hangndat/ticket-solution/pull/870) đã merge, còn [Issue #869](https://github.com/hangndat/ticket-solution/issues/869) cần đối chiếu trạng thái/evidence. Không mở Task trùng các finding hay reset giới hạn sửa của #859/#869.
- Có sẵn marketing, attendee web, Portal Ant Design và iOS attendee/Staff. Công việc là **đối chiếu và điều chỉnh** theo mẫu chốt, giữ API, OIDC, tenant branding, offline Gate, idempotency và UI đã nghiệm thu. Không thay bằng HTML prototype, QR mẫu, sự kiện/số liệu minh họa hoặc ảnh AI làm bằng chứng sản phẩm thật.
- Không mở payment, seat map, Wallet, Android, API/permission mới, production deploy hay store submit từ kế hoạch này. Nếu đối chiếu phát hiện contract thiếu thật, coordinator lập Task riêng theo ownership và duyệt scope trước khi consumer phụ thuộc.

## 2. Kết quả cần đạt và thứ tự ưu tiên

| Ưu tiên | Bề mặt | Kết quả nghiệm thu |
| --- | --- | --- |
| P0 | Gate iOS và migration web | `/gate` web không còn thao tác admission; link cũ có xử lý an toàn; Staff iOS cho phép vào cổng chỉ sau kết quả có thẩm quyền, queued/unknown/conflict không thành công giả. |
| P0 | Attendee web/iOS | Sự kiện → đổi mã/link email → vé/QR → phục hồi hoạt động với quyền và dữ liệu thật; trạng thái loading/empty/error/offline/forbidden rõ; không lộ vé/brand khi đổi phiên hoặc tenant. |
| P1 | Marketing | Áp dụng hướng Neon vào UI hiện hành, giữ copy/CTA thật và ảnh sản phẩm có provenance; không phá các sửa chrome, locale, form, responsive của #867/#870. |
| P1 | Portal | Shell, readiness, danh sách và Gate report theo theme Ant Design; số liệu server-backed có `asOf`/stale; `report.read` chỉ đọc, không link tới scanner web. |
| Xuyên suốt | Hệ token và a11y | `brand/vemoki/tokens.json` là SoT; adapter theo surface, không global rebrand; tương phản, focus, keyboard, Dynamic Type/VoiceOver và reduced motion được kiểm trên app thật. |

## 3. Task Spec theo ownership

Các mã `VD-*` là mã trong plan; khi triển khai, mỗi Task được gắn Issue/Project item và nhân viên cố định từ `company/employees.json`, role file, cost tier/model theo catalog, branch/worktree và exact SHA. Coordinator kiểm tra Project #3/WIP trước dispatch.

| Task | Role / cost tier / architecture | Paths và đầu ra | Phụ thuộc thực |
| --- | --- | --- | --- |
| **VD-00 — Baseline & nguồn mẫu** | Coordinator `Minh`, `standard`, **Có** | Chuyển phần nguồn cuối của `Vemoki-Complete 2` thành artifact ổn định có SHA; loại export `github-pr/` cũ và hai bundle trước khỏi handoff triển khai; lập ma trận màn × route × state × token × ảnh/license. Chốt trạng thái #869/#867/#766 để tránh trùng scope. | Không |
| **VD-01 — Handoff Gate migration** | `architect`, `docs/agents/roles/architect.md`, Dexter, `standard`, **Có** | Contract cho request trực tiếp `/gate`, bookmark/deep link, link Portal/marketing cũ, auth/session và rollback. Dùng O23/ADR-22; nếu ADR hiện có đủ, ghi đối chiếu thay vì tạo ADR mới. Không đổi Gate API hoặc quyền. | Không; consumer cần kết quả này trước khi đổi route/link |
| **VD-02 — Dọn Web Gate dư** | `web`, `docs/agents/roles/web.md`, một nhân viên web cố định, `standard`, **Có** | Chỉ `apps/web`: bỏ CTA/link và copy scanner cũ; xử lý `/gate` trực tiếp theo VD-01; test guest/staff/bookmark, không còn camera/manual admission trên web. | VD-01; không tranh `apps/web` khi #869 còn worker live |
| **VD-03 — Mapping UI và assets** | `product-design`, `docs/agents/roles/product-design.md`, Liv, `standard`, **Không** | Handoff delta giữa mẫu chốt và UI hiện hành cho marketing, attendee, iOS, Portal; một màn đại diện mỗi surface, copy VI, states, responsive, ảnh/font có quyền dùng. Bảng **giữ/sửa/bỏ** để không phá #870. | VD-00; có thể song song VD-01 |
| **VD-04 — Marketing & attendee web** | `web`, `docs/agents/roles/web.md`, cùng owner web khi reuse, `standard`, **Không**; nâng **Có** nếu đổi shared contract | Chỉ `apps/web`. Làm marketing hero/CTA và attendee event → redeem → ticket/QR theo delta VD-03, theo token O22. Chia PR theo marketing và consumer nếu diff lớn; một owner web sửa shared chrome tại một thời điểm. | VD-03; VD-02 nếu cùng route/chrome; không lặp finding #867 đã đóng |
| **VD-05 — Attendee iOS** | `ios`, `docs/agents/roles/ios.md`, Zico, `standard`, **Không** | Chỉ `apps/mobile`: events/detail, redeem, wallet/ticket, account theo màn đại diện rồi mở rộng; tenant switch, safe area, offline cached QR và trạng thái chưa phát hành đúng backend. | VD-03; không phụ thuộc marketing/web |
| **VD-06 — Staff iOS** | `ios`, `docs/agents/roles/ios.md`, Zico, `focused`, **Có** nếu chạm Gate state contract | Chỉ `apps/mobile`: context event/gate/session, camera permission, panel kết quả, manual/history/queue; dùng classifier hiện hành, không đổi reserve/confirm/idempotency. Mọi trạng thái queued/pending/unknown/conflict không cho vào cổng. | VD-01 và VD-03; ưu tiên slot iOS đầu, không hai owner iOS live |
| **VD-07 — Portal operations** | Role `web` với Task Spec **mở rộng `apps/portal` theo O16**, một owner portal cố định, `standard`, **Không**; nâng **Có** nếu đổi BFF/auth | Chỉ `apps/portal`: AntD theme/scoped tokens, dashboard/readiness, bảng/form/compact layout và Gate report read-only. Không chạm `apps/web`; không dựng camera hoặc action admission. | VD-03; VD-01 chỉ cho link Gate cũ; contract API hiện có đủ thì chạy song song web/iOS |
| **VD-08 — Tích hợp, UAT và release handoff** | Coordinator Minh + reviewer độc lập `docs/agents/roles/reviewer-merged.md` (James `dod+ux` hoặc `dod+sec+ux` cho Gate/auth), `focused`, **Có** | Exact-SHA review từng PR, CI, ma trận route × persona × state × viewport, local iOS build/UAT, evidence và Project status. Chỉ chuẩn bị release handoff; production/store cần Task ủy quyền riêng. | PR liên quan đã code complete; review từng PR ngay khi sẵn, không chờ cả Epic |

**Skills cần nạp khi thực thi:** VD-03 `impeccable` (shape/critique); VD-02/04/07 `impeccable` theo surface + `vercel-react-best-practices`; VD-05/06 `expo-overview` → `react-native-best-practices` + `expo-native-ui`/`expo-design-system` khi tương ứng; reviewer UI dùng `impeccable`/`web-design-guidelines` hoặc quy tắc native. UAT đọc `.cursor/rules/uat-headless.mdc`. Không dùng EAS Cloud Build.

## 4. Wave và dependency

1. **Wave chuẩn bị:** VD-00 ∥ VD-01; VD-03 bắt đầu khi baseline mẫu đủ. Không tạo Issue/worker trùng #867/#869. VD-00 ghi từng màn đã đạt để chỉ giao delta còn mở.
2. **Wave song song đầu:** VD-02 (`apps/web`) ∥ VD-06 (`apps/mobile`) ∥ VD-07 (`apps/portal`) khi dependency riêng đạt và WIP cho phép. Nếu Task Spec O16 mở rộng ownership Portal chưa được ghi rõ, coordinator xử lý trước VD-07; không tự sửa slice khác để build pass.
3. **Wave theo slot:** VD-04 nhận slot `apps/web` sau VD-02; VD-05 nhận slot `apps/mobile` sau VD-06. Cắt PR theo vertical slice để reviewer kiểm exact SHA ngay khi sẵn. Không serial hóa Portal/iOS theo web nếu không có contract chung thật.
4. **Nghiệm thu:** VD-08 tổng hợp review/CI/UAT từ từng slice; một lỗi UI có ID ổn định và tối đa hai lượt sửa tự động theo review-convergence. Mốc design complete đã đạt; code complete, acceptance complete và pilot ready được chốt riêng.

## 5. AC và evidence bắt buộc

- **Gate:** direct `/gate`, bookmark/deep link và link cũ không mở scanner web; Staff iOS chỉ `APPLIED` có thẩm quyền mới hiển thị cho vào. Race hai thiết bị, retry cùng idempotency key, offline queue/restart/conflict, role revoked và history scoped có bằng chứng. Portal report theo `report.read` và `asOf`, không suy quyền từ `gate.confirm`.
- **Attendee:** tenant/event public/private, code invalid/exhausted/pending/unknown, email verify/link restore, ticket issued/used/revoked/offline cached, logout/tenant switch; QR thật có quiet zone và quét được trên thiết bị. Không dùng QR demo trong production.
- **UI:** màn đại diện so với mẫu tại 320/390/768/1024/1440; VI mặc định, EN nơi app hiện có; focus/keyboard/200% zoom/reduced motion; iOS Dynamic Type/VoiceOver/safe area. Mọi ảnh evidence ghi SHA/build, route, viewport/UDID, persona, state, nguồn dữ liệu và giới hạn. Marketing không có social proof hoặc số liệu giả.
- **Checks:** lint/typecheck/test/build của workspace chạm tới; CI trên SHA tích hợp. UAT dùng Orca browser và emulator; camera/QR/offline vật lý phải kiểm trên thiết bị thật khi là AC, không suy từ prototype hay simulator. Reviewer khác implementer; `dod+sec+ux` cho Gate/auth. Không tuyên bố PASS nếu thiếu evidence bắt buộc.

## 6. Điều kiện mở thực thi

Coordinator rà WIP Project #3 và trạng thái #867/#869/#766, pin artifact mẫu bằng SHA, xác nhận Task Spec O16 cho owner `apps/portal`, rồi tạo Issue/Task theo bảng. Quyền đã dùng chỉ gồm implementation, review, CI và merge PR; production deploy/store vẫn cần ủy quyền riêng. Kết quả và các gate còn mở được cập nhật trong `docs/reviews/VD08-VEMOKI-INTEGRATION-2026-10-25.md` và Issue #889.
