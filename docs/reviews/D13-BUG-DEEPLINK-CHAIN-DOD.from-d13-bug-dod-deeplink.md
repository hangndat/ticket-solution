# D13 BUG — DoD chuỗi deeplink (#395 → #396 → #400 → #399/#402)

| Field | Value |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Orca worker `term_b0c370a9-27bc-4412-8691-de004f130bef` · task `task_c9b13c8942db` · dispatch `ctx_b48423c28f8c` (≠ implementer) |
| Scope | Chuỗi deeplink email ticket: origin O13 + contract path + owner GET + web route |
| Architecture impact | Có — BE↔web contract `GET /v1/me/tickets/{id}` query + owner-auth route khớp `buildOwnerTicketLink` |
| Decision IDs | O13 (product origin); TD §10 Self `GET /me/tickets/{id}` Owner |
| Date | 2026-10-18 |

## Exact SHAs under review

| PR / Issue | Tip SHA (full) | Behavior / notes |
| --- | --- | --- |
| [#395](https://github.com/hangndat/ticket-solution/pull/395) origin | `bcf9875af26adaec79a13b826c9fad3970e33646` | `web-links.ts` + apex rewrite |
| [#396](https://github.com/hangndat/ticket-solution/pull/396) contract lock | `58103b9725dbdd6e3f8255c342f3e94f9c1c62e0` | Behavior lock: `0e82801a4eb47454f66b0728256ce954c724c352` |
| [#400](https://github.com/hangndat/ticket-solution/pull/400) GET by id | `73ccfce88da7165140f2744498b9f940ecea35f8` | `getTicketForOwner` fail-closed |
| [#399](https://github.com/hangndat/ticket-solution/pull/399) web deeplink | `cd39280d9e4fb428fdc45228ca8c772caf157921` | Soft-redirect + BFF by-id; impl `730e9dfc557b04a4a400ce3261f1dc67739bd578` |
| [#402](https://github.com/hangndat/ticket-solution/pull/402) web route alt | `f987faab88f549001605c1601db0758b1f7cccfa` | Guest 200+CTA; list-then-find |

## Checks (CI + local evidence cited)

| Item | Result |
| --- | --- |
| PR #395 CI | `backend` + `database-isolation` + `ci` **SUCCESS** @ `bcf9875` |
| PR #396 CI | `backend` + `database-isolation` + `ci` **SUCCESS** @ `58103b` |
| PR #400 CI | `backend` + `web` + `mobile` + `database-isolation` + `ci` **SUCCESS** @ `73ccfce` |
| PR #399 CI | `web` + `ci` **SUCCESS** @ `cd39280` |
| PR #402 CI | `web` **FAILURE** (eslint `setState` sync in `useEffect` @ `ticket-panel.tsx:29`) · `ci` **FAILURE** @ `f987faa` |

Không chạy lại unit runtime trên mọi SHA trong session này — dựa CI xanh/đỏ GitHub + đọc source/diff exact SHA (skeptical với claim E2E authenticated).

## Per-PR verdicts

### #395 — PASS

- `resolveProductWebBaseUrl` rewrite `vemoki.com` / `www.vemoki.com` → `https://app.vemoki.com`; staging/custom giữ nguyên.
- `buildInviteAcceptLink` / `buildOwnerTicketLink` tập trung; outbox dùng helpers; unit `web-links-unit.test.cjs` khóa rewrite + encoding.
- Path vẫn `/t/{slug}/tickets/{id}` — đúng scope (không silent đổi path).
- Ownership backend-only. Không secrets.

### #396 — PASS (rebase trước merge)

- Contract lock path `/t/{tenant}/tickets/{id}` + no query token; handoff JSDoc + audit artifact khớp RCA.
- Không silent đổi URL khi web chưa ship route — đúng.
- **Overlap** với #395: cùng sửa `packages/backend/src/qr-ticket.ts` + `package.json`. Sau #395, `buildOwnerTicketLink` chuyển sang `web-links` (re-export từ `qr-ticket`). Merge #396 thẳng lên `main` sẽ conflict / có thể ghi đè re-export — **bắt buộc rebase #396 lên tip sau #395** (giữ `web-links` + chuyển/đồng bộ contract test + JSDoc lên `web-links`).

### #400 — PASS (BE slice)

- `GET /v1/me/tickets/:ticketId?tenantId=` + `getTicketForOwner` filter `tenant_id` + `owner_user_id` + `id`; miss → `TICKET_NOT_FOUND` → 404 (issue test: owner OK / non-owner / unknown UUID).
- OpenAPI + contracts additive; khớp pattern list `me/tickets?tenantId=`.
- Ownership BE (+ contracts). CI xanh.

### #399 — FAIL (authenticated contract)

Guest / soft-redirect path **ổn** (proxy 307 → `/auth?next=`; `sanitizePostLoginPath` allow owner-ticket; `test:routes` assert ≠ event 404 copy).

**Blocker — lệch contract với #400 / OpenAPI:**

| Layer | Query thực tế |
| --- | --- |
| Nest #400 / OpenAPI | **`tenantId`** (UUID, required) |
| Web `loadOwnerTicket` + BFF `#399` | **`tenantSlug`** |

Sau khi merge #400, request `?tenantSlug=` **không** thỏa `tenantId` → Nest 422 `TENANT_REQUIRED` → web map thành `invalid` / UX lỗi — authenticated owner **không** resolve được. Gap ghi «chờ BE» **không** đủ: BE đã đúng `tenantId`; web phải resolve slug→UUID (vd. `me/tenants`) rồi gọi `?tenantId=`, **hoặc** BE phải chấp nhận `tenantSlug` theo ADR/coordinator (chưa có).

`TicketSummary` cũng **không** echo `tenantSlug`; nhánh fail-closed slug-match trên response là optional no-op — không thay resolve query.

### #402 — FAIL

- CI lint đỏ: `setState` đồng bộ trong `useEffect` (`ticket-panel.tsx:29`) — không merge được.
- Trùng path với #399 (`page.tsx`, `owner-ticket/load.ts`, tests) — hai PR cạnh tranh.
- Approach list `me/tickets` + `findTicketById` sau resolve slug→`tenantId` **gần đúng** với BE hiện tại hơn #399, nhưng không dùng endpoint by-id #400; guest UX 200+CTA khác soft-redirect staff pattern của #399.

## Chain verdict

**FAIL** — chuỗi chưa nghiệm thu end-to-end owner deeplink.

- Origin + path contract (#395/#396) và BE owner read (#400) đủ điều kiện merge theo thứ tự bên dưới **sau rebase**.
- Web authenticated path **chưa** khớp OpenAPI; #402 không cứu được vì CI đỏ + conflict #399.

## Thứ tự merge đề xuất

1. **Merge #395** @ `bcf9875…` (O13 origin) — độc lập, CI xanh.
2. **Rebase #396** lên tip sau #395 → giữ `web-links` + contract lock/tests → merge tip mới (revalidate SHA sau rebase).
3. **Merge #400** @ `73ccfce…` — có thể song song sau bước 1 nếu không đụng `qr-ticket`/`web-links`; an toàn nhất sau 1–2.
4. **Web — chọn một PR, sửa contract, đừng merge cả hai:**
   - **Ưu tiên sửa #399**: soft-redirect + BFF giữ; đổi upstream query sang `tenantId` sau resolve slug (`me/tenants` / BFF resolve); wire `GET /v1/me/tickets/{id}?tenantId=`; unit + `test:routes`; **đóng/supersede #402**.
   - Hoặc đóng #399, sửa lint #402 rồi chuyển load sang by-id `#400` (không list-scan) — nhiều hơn so với fix #399.
5. **Revalidate DoD** exact SHA web sau fix + (tuỳ chọn) headless `test:routes` / UAT authenticated owner trên SHA tích hợp.

## Findings summary

### Blocker

1. #399↔#400: `tenantSlug` vs `tenantId` — authenticated deeplink gãy sau merge BE.
2. #402: CI `web`/`ci` FAIL (eslint).
3. #399 vs #402: trùng ownership web route — chỉ giữ một.

### Should-fix

- Rebase #396 lên #395 trước merge (tránh mất `web-links` re-export).
- Sau fix web: smoke authenticated owner (không chỉ anonymous 307/200).

### Nit

- #396 audit doc vẫn nói «web chưa có page» — đúng tại thời điểm audit; cập nhật sau khi web route merge.
- #399 parse optional `tenantSlug` trên body — không có trên `TicketSummary` hiện tại.

## Limitations

- Không chạy lại `pnpm` test local trên từng SHA trong session reviewer (dựa CI + đọc source).
- Không UAT headless authenticated trên prod `app.vemoki.com` trong review này.
- Không merge / không đổi Project Status (coordinator).

## Verdict (chuỗi)

**FAIL**

Không ủy quyền merge web (#399/#402) cho đến khi contract query khớp #400 và CI xanh trên **một** PR web. BE #395 → (rebase) #396 → #400 có thể merge theo thứ tự trên.
