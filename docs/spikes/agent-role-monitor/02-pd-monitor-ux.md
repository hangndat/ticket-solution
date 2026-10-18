# Spike PD — Agent Role Monitor UX

**Role:** `product-design` · **Ownership:** file này only · **Architecture impact:** Có — surface UX cho telemetry; handoff thiết kế, không implement `apps/web`.

**Neo:** [README spike](./README.md) · catalog [docs/agents/README.md](../../agents/README.md) · Orca hiện chưa có token/CPU per role trên `worker-list`.

**Non-goals:** production dashboard; deploy; redesign toàn app Vemoki; surface iOS; mock auth trên path prod.

---

## 1. Persona & primary job

| Persona | Việc chính | Khi nào mở Monitor |
| ------- | ---------- | ------------------ |
| **Coordinator gốc** (depth 0) | Quyết định wave / WIP / idle-fill: role nào đắt + kém chất lượng + nặng host → ưu tiên review/fix, trì hoãn feature | Sau `check --wait`, trước wave feature mới, khi hàng đợi duyệt đầy |
| **Owner / Epic steward** (người ủy quyền Run) | Nhìn hiệu quả catalog role theo đợt (D1…), không cần mailbox CLI | Review đợt / retrospect nhẹ |

**Primary job (1 viewport, 1 câu hỏi):**

> Trong cửa sổ thời gian đang chọn, **role nào đang đắt–kém–nặng**, và tôi có đủ số liệu để tin không?

Mọi thứ khác (chi tiết Dispatch, timeline span, export) là **secondary** — dưới fold hoặc drill-in, không cạnh tranh viewport đầu.

---

## 2. User flow

### 2.1 Flow chính — scan & act (coordinator)

```text
[Vào Monitor]
    → chọn cửa sổ thời gian (mặc định: Run đang bind / 24h gần nhất)
    → đọc 1 composition: bảng xếp hạng Role × Cost × Quality × Host
    → nhận tín hiệu partial-data (badge “thiếu token”) nếu có
    → (tuỳ chọn) drill 1 role → danh sách Dispatch gần đây (read-only)
    → quay lại mailbox / Project #3 để act (không act trong Monitor MVP)
```

### 2.2 Nhánh phụ

| Nhánh | Hành vi UX |
| ----- | ---------- |
| Chưa có Run / chưa có telemetry | **Empty** — giải thích + link README spike / cách bật thu thập (copy từ BA/architect sau) |
| Đang fetch | **Loading** — skeleton 1 bảng, không spinner card grid |
| Có host/quality nhưng thiếu cost/token | **Partial** — vẫn hiện hàng; cột Cost = “—” + announce; không ẩn cả bảng |
| API / authz fail | **Error** + Retry; không giả số 0 |
| User không phải coordinator/owner | **Denied** — copy ngắn, không lộ số liệu nội bộ |
| Hủy / rời trang | Không persist filter ngoài URL query (MVP: `?window=24h`) |

### 2.3 Web vs iOS

- **MVP chỉ web** (tooling nội bộ / ops). iOS: out of scope spike này.
- Shell: trang riêng hoặc panel dưới tooling coordinator — **không** nhét vào landing Vemoki attendee.

---

## 3. Viewport chính — một composition (không dashboard)

### 3.1 Nguyên tắc bố cục (khớp frontend design rule)

| Làm | Không làm |
| --- | --------- |
| Một mặt phẳng thông tin: **Ranking theo Role** | Grid nhiều card KPI (Cost / Quality / Host / Alerts / …) |
| Brand/tool name làm hero-level label nhỏ phía trên bảng (“Agent Role Monitor”) | Headline marketing đè brand; stat strip; pill cluster |
| Một headline hỗ trợ: cửa sổ thời gian + độ tin cậy dữ liệu | “This week” callouts, schedule, promo chips |
| Hàng = Role; cột = 4 tín hiệu tối thiểu | Nested card trong card; multi-layer shadow; glow |
| Visual anchor = **chính bảng xếp hạng** (số + thanh tương đối đơn giản) | Gradient tím / cream-serif-terracotta / broadsheet dense columns |
| Motion tối thiểu: 1 fade-in bảng, 1 highlight hàng focus; tôn trọng `prefers-reduced-motion` | Auto-refresh nhảy số gây distraction |

### 3.2 Thông tin tối thiểu (MVP columns)

Mỗi hàng = một **Role ID** catalog (`product-ba`, `product-design`, `architect`, `backend`, `web`, `ios`, `reviewer-dod`, `reviewer-security`; tùy chọn nhóm `epic-planner` / `coordinator` nếu telemetry gắn được).

| Cột | Ý nghĩa UX | Hiển thị gợi ý | Khi thiếu |
| --- | ---------- | -------------- | --------- |
| **Role** | Danh tính catalog | `backend` + short label VI | N/A |
| **Cost** | Chi phí ước lượng (token/$) cửa sổ | `$x.xx` hoặc `12.4k tok` — **một** đơn vị đã chọn ở header | `—` + tooltip “Chưa thu token” |
| **Quality** | Proxy chất lượng đợt | Pass rate DoD / reopen rate / FAIL count — **một** metric chính (BA chốt taxonomy) | `—` nếu chưa có evidence gate |
| **Host** | RAM/CPU / concurrency host | `CPU p95` hoặc `RSS peak` — **một** metric | `—` nếu chưa có node exporter / agent-top hook |

**Sắp xếp mặc định:** Cost giảm dần trong cửa sổ; tie-break Host rồi Quality xấu trước (đắt + nặng + kém → trên cùng).

**Không** thêm cột mặc định: latency model, span count, Slack, PR list, WIP board mirror — đó là drill-in hoặc surface khác.

### 3.3 Wire chữ (sketch thông tin)

```text
┌─────────────────────────────────────────────────────────────┐
│ Agent Role Monitor                                          │
│ Hiệu quả role · cửa sổ: [24h ▾] · Run: run_… (optional)     │
│ Độ tin cậy: Một phần — thiếu token trên 3/8 role            │
├──────────────┬──────────┬────────────┬──────────────────────┤
│ Role         │ Cost     │ Quality    │ Host                 │
├──────────────┼──────────┼────────────┼──────────────────────┤
│ backend      │ $4.20    │ DoD 2/3    │ CPU p95 61%          │
│ web          │ —  ⓘ     │ DoD 1/1    │ CPU p95 22%          │
│ reviewer-dod │ $0.80    │ —  ⓘ      │ RSS 1.1 GB           │
│ …            │          │            │                      │
└──────────────┴──────────┴────────────┴──────────────────────┘
  ⓘ = thiếu tín hiệu; không suy diễn = 0
  Click hàng → panel phụ (dưới fold): 5 Dispatch gần nhất (id, outcome, SHA nếu có)
```

**Dưới fold (secondary, một section — một việc):** “Chi tiết role đã chọn” — list Dispatch read-only; không tabs KPI; không chart 4 loại cùng lúc.

---

## 4. Trạng thái giao diện

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| **empty** | Chưa từng có sample telemetry / chưa bật collector | Tiêu đề giữ nguyên. Body: “Chưa có số liệu role. Bật thu thập theo spike architect/BE, rồi chọn cửa sổ thời gian.” CTA text-link tới doc nội bộ (không primary marketing CTA). |
| **loading** | Fetch lần đầu hoặc đổi cửa sổ | Skeleton **một** bảng (header + 4–6 hàng xám). Không shimmer nhiều card. `aria-busy=true` trên region. |
| **ready** | Đủ 4 tín hiệu cho ≥1 role | Bảng đầy đủ; sort như §3.2. |
| **partial-data** | Có ≥1 hàng nhưng ≥1 cột Cost/Quality/Host thiếu (điển hình: **thiếu token**) | Bảng vẫn render. Banner một dòng phía trên bảng: “Thiếu token/cost — không suy ra $0.” Cột thiếu = `—` + `aria-label` “Không có dữ liệu”. Không tô đỏ cả trang. |
| **error** | Timeout / 5xx / schema lệch | “Không tải được số liệu role.” + nút **Thử lại**. Giữ filter cửa sổ. |
| **denied** | Authz không đủ | “Bạn không có quyền xem Agent Role Monitor.” Không lộ hàng/aggregate. |
| **stale** (tuỳ chọn MVP+) | Snapshot cũ hơn ngưỡng (vd. >15 phút) khi live mode | Chip text “Cập nhật lúc HH:MM” — không auto-flash số. |

**Partial-data là state hạng nhất** — không gộp vào empty/error. Coordinator phải thấy được host/quality ngay khi cost chưa có (đúng thực tế Orca hôm nay).

---

## 5. Accessibility (WCAG 2.2 AA — web MVP)

| Hạng mục | Yêu cầu handoff |
| -------- | --------------- |
| Cấu trúc | Một `<main>`; bảng dùng `<table>` + `<th scope>`; caption: “Xếp hạng hiệu quả theo role” |
| Contrast | Text/số trên nền ≥ 4.5:1; `—` và badge partial không chỉ dựa vào màu |
| Keyboard | Tab tới control cửa sổ thời gian, Retry, từng hàng focusable nếu drill; Enter mở secondary |
| SR | Banner partial/error dùng `role="status"` hoặc `alert` (error); cột thiếu announce “không có dữ liệu”, không “zero dollar” |
| Hit target | Control ≥ 44×44 CSS px |
| Motion | Chỉ fade/highlight; tắt khi `prefers-reduced-motion: reduce` |
| Live region | Nếu có refresh thủ công: announce “Đã cập nhật bảng role” một lần |

**Automated:** axe/Playwright a11y trên bảng + banner. **Thủ công:** VoiceOver đọc hàng partial; keyboard-only drill-in.

---

## 6. Tiêu chí nghiệm thu UI (cho web worker sau này)

1. **Given** telemetry ready, **When** mở Monitor cửa sổ 24h, **Then** thấy đúng một composition bảng Role × Cost × Quality × Host trong viewport đầu (không ≥3 card KPI độc lập).
2. **Given** thiếu token trên một số role, **When** tải xong, **Then** state partial: banner thiếu token + cột Cost = `—`, các cột khác vẫn có số nếu có.
3. **Given** empty store, **When** mở Monitor, **Then** empty copy (không bảng toàn 0 giả).
4. **Given** API lỗi, **When** mở / retry fail, **Then** error + Retry; không số bịa.
5. **Given** `prefers-reduced-motion`, **When** load, **Then** không animation chuyển số.
6. UAT headless: `scripts/web-uat.sh` (hoặc Playwright) screenshot viewport đầu + partial fixture — khi có implement; spike này **không** chạy UAT.

---

## 7. Hướng dẫn triển khai (handoff — chưa code)

| Mục | Gợi ý |
| --- | ----- |
| Ownership implement | `web` (`apps/web`) only khi Epic cho phép; **spike hiện tại dừng ở docs** |
| Component | Một page/panel + table primitives của design system hiện có; **không** invent card dashboard kit |
| Tokens | Bám token/spacing repo; tránh Inter/purple-default nếu brand Vemoki đã khác — surface ops có thể trung tính hơn landing, vẫn một hệ |
| Contract phụ thuộc | Cần BA taxonomy (`01`) + architect telemetry (`03`) + BE data plane (`06`) trước khi web (`07`) khóa field names |
| MVP “good enough” | Bảng + 4 cột + 5 states (empty/loading/ready/partial/error) + denied; chưa cần chart, chưa live WebSocket |
| Thứ tự | (1) states + empty/partial copy → (2) table ready → (3) drill list → (4) polish motion/a11y |

---

## 8. Anti-patterns (cấm trong handoff này)

```text
❌ Dashboard nhồi card: 8 KPI tiles + 3 charts + activity feed cùng viewport đầu
❌ Coi thiếu token = $0 (implying rẻ)
❌ Nhiều metric Quality cùng lúc (pass + reopen + latency + “score” composite không giải thích)
❌ Mirror toàn bộ Project #3 / mailbox trong Monitor
❌ Persona attendee / scan gate trên surface này
❌ Purple glow / cream-serif-terracotta / newspaper columns “AI default”
```

---

## 9. Open questions

1. **Metric Quality chính thức là gì?** (DoD pass rate vs reopen vs FAIL count) — chờ `01-ba-metrics-taxonomy.md`.
2. **Đơn vị Cost:** token thô vs USD ước lượng — ai định giá model Cursor? Privacy có được log raw prompt không?
3. **Gắn attribution Role:** Dispatch spec Role ID vs suy từ ownership path — nếu thiếu Role ID trên Dispatch cũ thì UX ghi `unattributed` thế nào?
4. **Cửa sổ mặc định:** Run đang bind vs wall-clock 24h — coordinator preferential?
5. **Ai được xem?** Chỉ coordinator session local vs authenticated operator trên web deploy nội bộ?
6. **Live vs snapshot:** MVP chỉ snapshot on load có đủ cho idle-fill, hay cần refresh tay / interval?
7. **Có nhóm coordinator/planner** vào bảng catalog không, hay chỉ 8 Role ID trong README?

---

## 10. Liên kết spike

| File | Quan hệ |
| ---- | ------- |
| `01-ba-metrics-taxonomy.md` | Chốt định nghĩa Cost/Quality/Host → khóa label cột |
| `03-architect-telemetry.md` | Nguồn sự kiện / privacy → khả thi partial-data |
| `05-dod-evidence-gates.md` | Quality proxy từ evidence exact-SHA |
| `06-backend-data-plane.md` | API shape cho bảng + states |
| `07-web-surfaces.md` | Map handoff này → route/component (sau) |
| `00-synthesis.md` | Coordinator gộp sau wave |

**Done (PD spike):** flow + states + nội dung viewport chính + a11y + open questions — đủ unblock thảo luận; **không** unblock coding web cho đến khi BA/architect trả lời Q1–Q3.
