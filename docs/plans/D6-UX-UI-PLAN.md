# D6 — Hoàn thiện UX/UI toàn sản phẩm (kế hoạch)

**Trạng thái:** **Coding S1–S6 đã merge `main` (2026-10-17)** — web PR [#92](https://github.com/hangndat/ticket-solution/pull/92) `eb0d0784f300571dc7a557c0db3ecd865c4e9cfe` · iOS PR [#93](https://github.com/hangndat/ticket-solution/pull/93) `b93124b58eb1740d263fc5191ddd9a9aad4506f6`. Issues #82–#85, #87–#88 **Hoàn thành**/closed. Còn **S7 (#89)** ROADMAP sync + nghiệm thu parent **#81** (đợt chưa đóng). Plan đã duyệt user 2026-10-17; Milestone #8.  
**Ngày soạn:** 2026-10-17  
**Ngày duyệt:** 2026-10-17  
**Cập nhật tiến độ:** 2026-10-17 (sau merge #92/#93)

**Đối chiếu code:** `main` tip `b93124b58eb1740d263fc5191ddd9a9aad4506f6` (sau D6 iOS). DoD coding: PASS with known gaps (web @ `ec8eac6…`, iOS @ `a3eabf2…`).  
**Không phải:** pilot ready, store submission, production deploy, hay gộp hardening D5.

---

## 1. Mục tiêu

Polish UX/UI **đồng bộ thương hiệu Vemoki** trên mọi bề mặt đã có chức năng từ D0–D5 (web guest/redeem/gate/event, web admin/platform, iOS ví/redeem/scan/supervisor/account), sao cho:

- Brand-first: bỏ nav vẫn nhận ra Vemoki (wordmark `vemoki↗` + mark + palette/type).
- Một composition / viewport trên surface marketing/guest; admin ưu tiên workflow rõ, không “AI dashboard” thừa.
- Empty / error / loading / unknown nhất quán với copy tiếng Việt (user-facing) và không lộ jargon đợt (F-WEB, W0, Identity POC) trên đường guest/staff thật.
- a11y tối thiểu + responsive web + cảm giác native iOS; headless UAT có artifact ảnh.

**Không mở:** Android, payment/refund, seat map, Apple/Google Wallet, offline Gate multi-device, white-label app (vẫn **Sau MVP / #7**).

---

## 2. Phạm vi IN / OUT

### IN

| Hạng mục | Ghi chú |
| --- | --- |
| Visual system | Tokens màu/type/spacing/radius từ `brand/vemoki/tokens.json` → web CSS vars + iOS theme; đồng bộ mark/wordmark |
| Navigation / IA | Nav guest vs staff vs admin; bỏ / thu gọn link POC; iOS tab labels VI hoặc song ngữ có chủ đích |
| States | Empty, loading, error, timeout/unknown, success — pattern dùng lại |
| a11y tối thiểu | Skip link (đã có), focus-visible, contrast, `aria-live`/announcements (iOS đã có skeleton `src/a11y/`) |
| Responsive web | Guest + admin usable trên mobile viewport |
| iOS native feel | SF symbols / NativeTabs giữ; thay `systemBlue` bằng accent Vemoki; giảm “demo Notice” chiếm UI chính |
| Admin usability | Group panels, hierarchy, dense-but-scannable; không rewrite nghiệp vụ |
| Consistency | Shared components / class patterns; event brand (M04) vs platform brand (Vemoki) tách rõ |
| Docs / board | ROADMAP §4–§6, Milestone + Issues draft (sau duyệt) |

### OUT

| Hạng mục | Lý do |
| --- | --- |
| Feature nghiệp vụ mới | Thuộc D4 còn mở hoặc Sau MVP |
| BE schema lớn / endpoint mới “cho đẹp” | Chỉ contract nhỏ nếu UI cần field đã có mà thiếu projection — escalate coordinator |
| Store submission / TestFlight lại | D5 #26; D6 chỉ Simulator/headless visual trừ gap UX phát hiện trên device đã có |
| Production deploy / VPS | Ops riêng |
| Gộp security/load/restore D5 | Hardening ≠ polish |
| Đụng PRs đang Chờ duyệt #23 / #56 | Chỉ note phụ thuộc; không rebase/rewrite UI trên các PR đó trong D6 trừ khi đã merge |

---

## 3. Audit nhanh hiện trạng

Nguồn: `apps/web/app/**`, `apps/mobile/src/**`, `brand/vemoki/tokens.json`, `docs/ROADMAP.md`, PRD M04. Không refactor trong audit này.

### 3.1 Brand tokens đã có (tái sử dụng)

`brand/vemoki/tokens.json`:

| Token | Giá trị | Ý nghĩa |
| --- | --- | --- |
| ink | `#22241f` | Chữ / UI tối |
| paper | `#f7f6f1` | Nền nền tảng |
| signal | `#9b3a18` | Accent “punch” / mũi tên wordmark |
| focus | `#235fd0` | Focus ring a11y |
| wordmark | `vemoki` + signal `↗` | Hero brand |
| mark | `mark.svg` | Hai nét V + chấm admission |

**Rủi ro design bias:** paper + rust gần “cream + terracotta” generic. D6 **không đổi tên thương hiệu**; hướng xử lý: (1) giữ palette đã chốt O09, (2) thoát bias bằng **type expressive (không Arial/Inter)**, composition một khối, motion có chủ đích, **không** serif broadsheet + pill cluster, (3) event themes (festival/studio) giữ riêng M04, không làm nền mọi màn admin.

### 3.2 Web — routes chính

| Route | Chức năng | Mức UI (audit) |
| --- | --- | --- |
| `/` | Directory demo events | **Lệch brand / còn prototype:** wordmark Vemoki OK; eyebrow `W0 FOUNDATION`; copy EN; footer “no live ticketing”; event **cards** chiếm hero; font Arial |
| `/t/[tenantSlug]/events/[eventSlug]` | Public event shell (demo + published path) | **Đã chức năng + theme demo**; cần brand-test + bỏ demo chrome khi published thật |
| `/redeem` | Đổi mã BFF thật | **Đã chức năng**; wordmark `ticket↗` (không Vemoki); eyebrow `F-WEB`; intro kỹ thuật; shell dùng chung |
| `/gate` | Gate dự phòng API thật | **Đã chức năng**; cùng lệch wordmark/`ticket↗` + eyebrow đợt |
| `/claim` | Guest claim | **Đã chức năng (shell)**; cần đồng bộ visual + states |
| `/invite` | Accept membership invite | **Đã chức năng (shell)** |
| `/account` | Account / deletion | **Đã chức năng**; polish copy/states |
| `/auth` | Identity POC | **Prototype có chủ đích** — D6: ẩn khỏi nav guest hoặc đổi label “Đăng nhập”; không xóa route |
| `/admin` | Admin event (D4) | **Đã chức năng, UX dày**; `ticket↗`; nav dài; panels form-heavy — cần IA/usability, không rewrite API |
| `/platform` | Platform console | **Đã chức năng**; tách visual admin-tenant vs platform-ops |
| `error.tsx` / `not-found.tsx` | Error boundaries | **Tối thiểu** — cần brand + copy VI |

**Web CSS:** `globals.css` đã map `--ink`/`--paper`; `--signal` chưa là CSS var chính thức; body `Arial, Helvetica`; focus `#235fd0` khớp token. Mark component: `apps/web/src/brand-mark.tsx`.

### 3.3 iOS — screens / tabs

| Surface | Path | Mức UI |
| --- | --- | --- |
| Tabs | `(tabs)` Events / My Tickets / Staff | **Native OK**; labels EN; accent `Color.ios.systemBlue` |
| Events | `screens/events.tsx` | **Demo + published on-demand**; Notice dài kiểu docs — lệch product feel |
| Event detail | `screens/event-detail.tsx` | **Đã chức năng / fixture path** |
| My Tickets | `screens/my-tickets.tsx` | **Đã chức năng** (offline display, sync); visual system iOS mặc định |
| Ticket detail + QR | `screens/ticket-detail.tsx` + `components/qr-code` | **Đã chức năng** — polish brand ticket canvas |
| Redeem / Claim | `redeem.tsx` / `claim.tsx` + forms | **Đã chức năng**; cần đồng bộ copy/states với web |
| Staff / scan | `screens/staff.tsx` + `gate/*` | **Đã chức năng**; a11y announcements có sẵn |
| Account / push | `account.tsx`, `push/push-status.tsx` | **Đã chức năng**; UX status rõ hơn |
| Theme | `src/theme/colors.ts` | **Prototype:** chỉ system colors — **chưa map Vemoki tokens** |

### 3.4 Tóm tắt gap D6

1. **Wordmark không thống nhất** (`vemoki↗` vs `ticket↗`).  
2. **Chrome đợt/POC** còn trên guest/staff paths.  
3. **iOS theme chưa brand**.  
4. **Typography web mặc định** (Arial) trái design rules.  
5. **Admin/platform** đủ API, thiếu hierarchy/visual system.  
6. **Home** vẫn W0 demo directory — cần quyết định: giữ demo có nhãn rõ **hoặc** chuyển landing product-lite (không mở feature mới).

---

## 4. Design direction

### 4.1 Tokens (nguồn sự thật)

1. `brand/vemoki/tokens.json` = canonical platform brand.  
2. Web: mở rộng `:root` — `--ink`, `--paper`, `--signal`, `--focus`, spacing scale (`--space-1…`), type roles (`--font-display`, `--font-body`).  
3. iOS: `src/theme/colors.ts` (+ optional `typography.ts`) map ink/paper/signal/focus; giữ dynamic type / system grouped backgrounds nếu phù hợp contrast.  
4. Event brand (M04 published snapshot) **override** surfaces event-public; **không** override chrome platform (wordmark Vemoki trên shell app/store).

### 4.2 Typography & motion

- Web: chọn **một** cặp font expressive (display + body) qua `next/font` hoặc self-host — tránh Inter/Roboto/Arial/system stack làm identity.  
- iOS: ưu tiên SF Pro + weight hierarchy; display chỉ khi ticket/hero.  
- Motion (tối thiểu 2–3 chỗ có chủ đích):  
  1. Home / event hero: fade+slight rise wordmark hoặc CTA (≤300ms).  
  2. Redeem/claim success → ticket affordance.  
  3. Gate/staff admitted flash (xanh/đỏ đã có logic — tinh chỉnh, không firework).  
- Không glow tím, không pill cluster, không multi-shadow card stack.

### 4.3 Composition rules (áp dụng guest)

- Viewport đầu: brand + 1 headline + 1 câu + 1 nhóm CTA + (tuỳ surface) 1 visual plane — **không** nhồi stats/schedule.  
- Cards chỉ khi là đơn vị tương tác (chọn event, chọn vé). Home directory: cân nhắc list/rows thay grid card nặng nếu brand-test fail.  
- Admin: cho phép mật độ cao; vẫn một job / section.

### 4.4 Copy

- User-facing VI trên guest/admin/staff (giữ ID/API English trong dev tools).  
- Gỡ eyebrow `W0` / `F-WEB` / `D3` khỏi production chrome; có thể giữ `data-testid` / comments.

---

## 5. Work breakdown (song song)

```text
                    ┌─────────────────────────────┐
                    │ C0 Coordinator              │
                    │ ROADMAP + Milestone +       │
                    │ tokens contract (docs)      │
                    └─────────────┬───────────────┘
                                  │ (soft: tokens chốt)
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        W1 Web guest        W2 Web admin         I1 iOS
        redeem/gate/        /platform            ví/redeem/
        claim/event/home                         scan/push UX
```

| Slice | Ownership | Việc chính |
| --- | --- | --- |
| **C0** | Coordinator | Chèn D6 vào ROADMAP; Milestone VI; labels `dot-d6`; chốt token CSS/iOS mapping doc; chỉ mở contract nếu thiếu field display đã có trên API |
| **W1** | Web | Guest/redeem/gate/claim/invite/account/event/home: wordmark, type, states, responsive, bỏ POC nav, headless screenshots |
| **W2** | Web | Admin + platform: IA panels, empty/error, density, brand chrome, a11y forms |
| **I1** | iOS | Theme tokens; tab/copy VI; wallet/ticket canvas; redeem/claim/staff visual; push/deep-link empty states; Simulator screenshots qua `sim-uat` |

**BE:** không slice feature. Nếu W1/I1 cần field đã có trong published config mà BFF chưa expose → Issue nhỏ `nhom-backend` optional, không block visual tokens.

---

## 6. Thứ tự / phụ thuộc — khuyến nghị

### Option A — Soft board, hard implement (khuyến nghị)

| Bước | Khi nào | Ai |
| --- | --- | --- |
| User duyệt plan này | Ngay | User |
| Tạo Milestone + parent/sub-issues `Chưa lên lịch` / `Sẵn sàng` (C0 docs) | Sau duyệt plan; **không chờ** D5 Hoàn thành | Coordinator |
| Implement C0 tokens + W1∥W2∥I1 | **Sau** parent D5 (#6) → **Hoàn thành** (acceptance) | Workers |
| Lý do | Tránh polish đè lên UAT device (#26) và BE còn mở (#56); board sẵn để xếp hàng | |

### Option B — Parallel sớm hơn

- Cho phép **C0 + W1 chrome-only** (wordmark/footer/font) khi D5 còn Đang làm, **nếu** không đụng file đang hot trên PR #23/#56.  
- **Không** khuyến nghị full admin/iOS visual refactor trước D5 acceptance.

### Option C — Gộp Sau MVP (#7)

- **Không khuyến nghị:** UX polish sau hardening là cổng “product feel” trước Android/payment; tách D6 giữ #7 sạch feature lớn.

**Khuyến nghị chính thức:** **Option A**. Plan + board có thể tạo sớm; coding D6 sau D5 parent Hoàn thành. Không bịa ngày.

**Phụ thuộc mềm:** D4 web admin (#22) và iOS (#23) — D6 polish **trên** chức năng đã merge `main`; phần còn Chờ duyệt thì sub-issue D6 ghi “blocked-by merge #xx” thay vì sửa song song cùng file.

---

## 7. Gate nghiệm thu D6

Parent D6 chỉ **Hoàn thành** khi:

1. **Brand test:** screenshot home + redeem + một event published (hoặc demo có nhãn) — bỏ nav trong crop review, vẫn nhận Vemoki (mark/wordmark/signal).  
2. **Wordmark thống nhất:** không còn `ticket↗` trên guest/staff/admin chrome (trừ redirect legacy nếu cần).  
3. **Headless web UAT:** `scripts/web-uat.sh` (hoặc tương đương) chụp `/`, `/redeem`, `/gate`, `/admin` (signed-in fixture nếu có) → artifacts dưới `apps/web/.uat-artifacts/` (gitignored; link/log trong Issue).  
4. **iOS Simulator visual:** `scripts/sim-uat.sh` — Events, My Tickets (empty + có vé nếu fixture), Staff idle; artifacts `apps/mobile/.uat-artifacts/`.  
5. **a11y smoke:** keyboard focus-visible trên CTA chính web; iOS VoiceOver announcements redeem/gate không regress (unit/smoke hiện có).  
6. **States:** mỗi surface chính có empty + error/unknown copy VI chấp nhận được (không stack trace).  
7. **Proof limits ghi rõ:** D6 PASS ≠ pilot ready; không yêu cầu TestFlight lại trừ khi phát hiện regression UX trên device đã có từ D5.  
8. DoD repo: review Cursor độc lập + merge `main` + CI xanh theo từng Issue.

---

## 8. Risks / proof limits

| Risk | Mitigation |
| --- | --- |
| Polish bị nhầm là pilot ready | Checklist §7 + ROADMAP §1.1 ba mức |
| Conflict D5 UAT / APNs PRs | Option A; không đụng #23/#56 đang mở |
| Cream/terracotta bias | Giữ tokens O09; khác biệt bằng type/composition/motion |
| Scope creep admin rewrite | W2 = usability/visual only |
| Event brand vs platform brand | Document M04 override boundaries |
| Headless ≠ device | Không claim store visual QA |
| BE “cần API mới” | Escalate; không biến D6 thành epic BE |

---

## 9. GitHub board (đã tạo 2026-10-17)

**Đã tạo:** Milestone #8 · Parent #81 · S1–S7 #82 #83 #84 #85 #87 #88 #89 · label `dot-d6` · Project #3 Đợt `D6 — Hoàn thiện UX/UI`.  
**Tiến độ board (2026-10-17):** #82–#85/#87–#88 closed sau merge coding; #89 + parent #81 còn mở đến khi S7 docs sync + gate §7 đợt xong.

**Milestone (VI):** `D6 — Hoàn thiện UX/UI Vemoki`  
**Label:** `dot-d6` (+ `nhom-web` / `nhom-ios` / `nhom-coordinator` / `loai-tinh-nang` khi tạo thật)  
**Project:** #3 — Status ban đầu `Chưa lên lịch` hoặc `Sẵn sàng` sau duyệt user; **không** `Hoàn thành` khi chỉ có plan.

### Parent

**Tiêu đề:** `D6 — Hoàn thiện UX/UI toàn sản phẩm (Vemoki)`  
**Nhóm:** Coordinator  
**Mô tả ngắn:** Đồng bộ brand/tokens, navigation, states, a11y tối thiểu, responsive web và cảm giác native iOS trên surfaces đã có từ D0–D5. Không mở Android/payment/seat map. Gate: brand test + headless/sim screenshots. Phụ thuộc: D5 parent Hoàn thành trước khi implement (Option A).  
**DoD ngắn:** Mọi sub-issue Hoàn thành; ROADMAP §4 có hàng D6; evidence screenshots gắn Issue; không tuyên bố pilot ready.

### Sub-issues (đề xuất 7)

| # | Tiêu đề | Nhóm | DoD ngắn |
| --- | --- | --- | --- |
| D6-S1 | `D6 — Tokens & design contract (web CSS + iOS theme + docs)` | Coordinator (+ Web/iOS consume) | `tokens.json` → CSS vars + `apps/mobile/src/theme/*`; doc ngắn trong plan/ROADMAP; không đổi O09 palette trừ user chốt |
| D6-S2 | `D6 — Web guest: home, event public, redeem, claim, invite` | Web | Wordmark Vemoki; bỏ chrome POC; type/motion; states; web-uat screenshots |
| D6-S3 | `D6 — Web gate & account (staff/guest chrome)` | Web | Gate/account đồng bộ shell; unknown/error rõ; a11y smoke |
| D6-S4 | `D6 — Web admin & platform usability` | Web | IA panels; empty/error; brand chrome; không đổi contract nghiệp vụ |
| D6-S5 | `D6 — iOS theme, tabs, Events/Redeem/Claim` | iOS | Map tokens; copy VI; giảm demo-notice noise; sim-uat |
| D6-S6 | `D6 — iOS ví, ticket QR canvas, Staff scan/supervisor UX` | iOS | Ticket visual brand; scan outcomes; announcements không regress |
| D6-S7 | `D6 — ROADMAP + Milestone sync & nghiệm thu đợt` | Coordinator | Patch ROADMAP §4/§5/§6; checklist parent; đóng Milestone khi DoD |

**Optional (chỉ nếu phát sinh):**  
`D6-S8 — BFF/API projection nhỏ cho brand display` — Backend — chỉ field đã có trong published config.

### Body template (sub-issue)

```markdown
## Mục tiêu
<1–2 câu VI>

## Phạm vi
- IN: …
- OUT: …

## Phụ thuộc
- D5 parent Hoàn thành (Option A)
- blocked-by: <PR/Issue nếu có>

## DoD
- [ ] …
- [ ] Evidence: lệnh UAT + đường dẫn artifact + SHA

## Ownership
apps/web | apps/mobile | docs only
```

---

## 10. Proposed ROADMAP diff (text — chưa apply)

Ưu tiên giữ diff trong plan để tránh conflict docs D4/D5. Coordinator apply sau duyệt.

### §1 bảng trạng thái — thêm hàng (sau D5, trước Android/…)

```markdown
| UX/UI polish (D6) | **Chưa lên lịch** (sau duyệt) | Chưa mở implement | Sau D5 acceptance; không = pilot ready |
```

(Cập nhật Board khi đã có parent Issue.)

### §4 — thêm hàng milestone

```markdown
| D6 | Hoàn thiện UX/UI | Polish brand Vemoki + IA/states/a11y trên web & iOS đã có chức năng | Brand test + headless/sim screenshots; không gộp D5 hardening | Chưa lên lịch |
```

Giữ câu Sau MVP: *không gắn vào D2–D6* (Android/payment/…).

### §5 — module (tuỳ chọn)

```markdown
| M04 | Branding và nội dung | D4 publish → **D6 polish platform+event surfaces** | M03 |
```

(M04 nghiệp vụ publish vẫn D4; D6 chỉ visual consistency.)

### §6 — section mới trước “Sau MVP”

```markdown
### D6 — Hoàn thiện UX/UI (board: Đang làm / Chờ duyệt S7)

- [x] Tokens & design contract — D6-S1 (#82) — PR #92 + #93
- [x] Web guest / redeem / claim / event — D6-S2 (#83) — PR #92
- [x] Web gate & account — D6-S3 (#84) — PR #92
- [x] Web admin & platform — D6-S4 (#85) — PR #92
- [x] iOS theme + Events/Redeem/Claim — D6-S5 (#87) — PR #93
- [x] iOS ví + Staff scan UX — D6-S6 (#88) — PR #93
- [ ] ROADMAP sync & nghiệm thu đợt — D6-S7 (#89)

**Gate:** xem docs/plans/D6-UX-UI-PLAN.md §7. Coding S1–S6 trên main; còn nghiệm thu parent #81 qua #89. Không tuyên bố pilot ready.
```

### §0 / trọng tâm — câu gợi ý (khi board đã có D6)

> D6 coding S1–S6 đã merge; trọng tâm nghiệm thu đợt qua **#89 / parent #81**. D4/D5 vẫn Đang làm. Sau MVP (#7) vẫn Chưa lên lịch.

---

## 11. Việc coordinator làm sau khi user duyệt

1. Apply ROADMAP diff (PR docs-only).  
2. Tạo Milestone + parent + sub-issues + labels `dot-d6`.  
3. Gắn Project #3; Status `Chưa lên lịch` hoặc `Sẵn sàng` cho C0.  
4. **Không** `worker-start` coding D6 cho đến D5 parent Hoàn thành (trừ khi user chọn Option B tường minh).  
5. Không tạo PR/Issue từ worker plan này (constraint task).

---

## 12. Kết luận khuyến nghị (cho user)

1. **Chèn D6** giữa D5 và Sau MVP (#7) — đúng nhu cầu polish trước feature lớn.  
2. **Board sớm, code muộn (Option A):** duyệt plan → tạo Milestone/Issues ngay; implement sau D5 acceptance.  
3. **Tái sử dụng** `brand/vemoki/tokens.json`; ưu tiên thống nhất wordmark + iOS theme + gỡ chrome POC.  
4. **Parallel:** sau C0 tokens, W1 ∥ W2 ∥ I1.  
5. Plan file: `docs/plans/D6-UX-UI-PLAN.md` — sẵn sàng duyệt; chưa commit trừ khi coordinator yêu cầu SHA.
