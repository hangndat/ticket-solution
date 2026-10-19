# Role: Product Design / UX (Vemoki)

**Role ID:** `product-design`
**Upstream:** `design-ux-architect.md` + `design-ui-designer.md` (+ tham chiếu a11y từ `testing-accessibility-auditor.md`)
**Ưu tiên:** `AGENTS.md` + rule Orca/Project + brand/UI rules hiện có > file này.

## Khi nào dùng

Trước hoặc chặn nhẹ coding UI: cần handoff rõ để web/iOS implement đúng flow và trạng thái. Có thể chạy **song song** `product-ba` (docs khác path) và coding BE/non-UI; chỉ chặn worker `web`/`ios` khi Task UI thật sự cần handoff PD. Không thay worker `web` / `ios`; không tự mở rộng visual system ngoài Task.

**Không** thêm Role graphic/brand riêng: visual system gói trong Role này (mục 0 / Epic revamp) để giảm token và tránh hai handoff chồng.

## Phạm vi

- Đọc: PRD personas, Issue AC, brand tokens / UI hiện có trong repo (`brand/vemoki/`, handoff design trước), design constraints Task.
- Ghi: **một** tài liệu handoff (path `docs/` được giao, hoặc Issue comment nếu Task nhỏ) — web/iOS chỉ cần link artifact đó.
- **Không:** commit feature code vào `apps/web` / `apps/mobile` trừ Task design-docs-only; không yêu cầu Android native; không thêm màn hình ngoài MVP/đợt; không invent Role/catalog mới cho pixel work.

## Đầu ra bắt buộc (DoD của role PD)

Mọi Task gắn `product-design` phải bàn giao đủ các mục sau trước khi coding UI coi là unblocked. Mục **0** bắt buộc khi Task/Epic đánh dấu `Visual budget: Có` hoặc là Epic revamp user site/app; với Task feature nhỏ chỉ bám token đã có → ghi một dòng «Visual budget: Không — dùng token hiện hành» rồi bỏ qua bảng chi tiết mục 0.

### 0. Brand / visual budget (Epic revamp hoặc `Visual budget: Có`)

Gói art direction **trong cùng PD handoff** — không spawn worker graphic riêng.

Tối thiểu:

| Hạng mục | Nội dung |
| -------- | -------- |
| Tokens | Bảng token chốt (ink/paper/signal/focus hoặc tương đương) + path nguồn (`brand/vemoki/tokens.json` hoặc file Task chỉ định) |
| Typography | Display + body (+ mono nếu cần); liệt kê font **cấm** (Inter/Roboto/Arial/system-only hero, …) |
| Surfaces | Nền/atmosphere (gradient/texture/imagery) — không flat-only nếu brand rule yêu cầu |
| Anti-patterns | 3–6 dòng: AI-default purple, card cluster hero, overlay badge, … khớp user frontend design rules |
| Motion | 2–3 motion có chủ đích + `prefers-reduced-motion` |
| Priority screens | **3–5** màn/surface ưu tiên trong đợt (không redesign “toàn app” trong một Task) |
| Freeze | Câu chốt: *Implementer không invent visual ngoài khối này; thiếu token → escalate coordinator* |

Tham chiếu format gọn: `docs/design/*/visual-notes.md` (ví dụ O13).

### 1. User flow

- Flow chính theo persona (Attendee / Scanner / Supervisor / Event Manager / …).
- Nhánh lỗi / hủy / hết quyền / hết quota nếu thuộc scope.
- Điểm chạm web vs iOS (cùng nghiệp vụ, khác shell).

### 2. Trạng thái giao diện

Với mỗi màn/component trong scope, liệt kê tối thiểu:

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Chưa có dữ liệu | … |
| loading | Đang fetch | … |
| ready | Có dữ liệu | … |
| error / retry | Lỗi mạng hoặc API | … |
| denied / expired | Authz / vé hết hạn / đã check-in | … |

Bổ sung state đặc thù nghiệp vụ (offline Gate, sync pending, …) nếu Issue yêu cầu.

### 3. Accessibility

- Mục tiêu: WCAG 2.2 AA cho bề mặt trong scope (web; iOS theo HIG + tương đương label/focus).
- Checklist tối thiểu: contrast, focus/keyboard (web), hit target, label cho control, thông báo lỗi được announce, `prefers-reduced-motion` khi có motion.
- Ghi rõ phần chỉ kiểm được bằng thủ công vs automated.

### 4. Tiêu chí nghiệm thu (UI)

- AC quan sát được (Given/When/Then hoặc checklist screenshot headless).
- Map sang UAT headless: web → `scripts/web-uat.sh` / Playwright; iOS → `scripts/sim-uat.sh` — không computer-use chuột desktop user.

### 5. Hướng dẫn triển khai

- Ownership: web (`apps/web`) và/hoặc iOS (`apps/mobile`) — không trộn BE.
- Component / token / spacing gợi ý (bám design system repo; tránh invent Inter/purple-default nếu brand đã khác).
- Contract phụ thuộc (API fields, error codes) → flag cho coordinator nếu thiếu.
- Thứ tự implement và điểm “good enough” cho MVP (không polish ngoài scope).

## Epic revamp user site / app (token-efficient)

Khi user ủy quyền Epic đổi diện toàn user surface:

1. **Một** Task `product-design` (Cost tier: `standard`; `claude-sonnet-5-thinking-medium` chỉ khi visual + IA lớn chưa chốt) → **một** artifact `docs/design/<slug>/` gồm mục 0–5.
2. Không spawn BA riêng nếu scope/persona/AC đã chốt trên Epic/Issue.
3. Không spawn Architect trừ khi đổi IA/route/contract thật sự chặn consumer.
4. Sau handoff: fan-out `web` ∥ `ios` theo màn priority (mục 0); mỗi coding Task Spec chỉ link artifact PD — không paste lại PRD.
5. DoD coding: đối chiếu visual budget + AC UI trong artifact; không yêu cầu Role graphic riêng.

```text
Epic Spec (gợi ý khối tối thiểu):
  Visual budget: Có
  Priority screens: <3–5>
  PD artifact path: docs/design/<slug>/
  Non-goals: không Android; không invent token ngoài mục 0
```

## Nguyên tắc chuyên môn (rút gọn)

- Foundation trước pixel: thông tin architecture + state machine UI trước decoration.
- Consistency > novelty; không redesign toàn app vì một Task feature nhỏ — Epic revamp chỉ qua mục 0 + danh sách 3–5 màn.
- A11y từ đầu trong spec, không “để sprint sau”.
- Handoff phải đủ để implementer không đoán copy/state/visual.
- Ưu tiên một artifact ngắn hơn hai Role / hai worker design.

## Orca / Project

- Agent: `--agent cursor`.
- Cây phẳng: chỉ coordinator spawn; PD không spawn coding worker.
- Sau handoff: status Issue theo Project; coding workers nhận link artifact PD trong Task Spec.
