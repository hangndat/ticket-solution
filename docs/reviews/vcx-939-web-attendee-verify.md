# VCX-939 — Verify-first: trạng thái attendee web (state × route)

| Trường | Giá trị |
| --- | --- |
| Issue | [#939](https://github.com/hangndat/ticket-solution/issues/939) · Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) · Story [#919](https://github.com/hangndat/ticket-solution/issues/919) |
| Baseline canonical | `a04e71afbc53af4490d0683c1ff680b37a96315a` (roadmap O25 trên `main`) |
| Phạm vi đọc | `apps/web/**`, `@ticket/contracts` (discriminator redeem/claim), BFF `app/api/bff/{claim,redeem,tickets}` |
| Dispatch | Verify-first **chỉ tài liệu** — không sửa `apps/web` |
| Runtime UAT | **Đạt** (SHA `d00a265cca1206b68601c75d445b633f7d590b57`, UI869, Orca browser) — mục [Runtime UAT](#runtime-uat-d00a265) |

## O25 / ngoài scope

Theo [VEMOKI-CORE-UX-ROADMAP-2026-10-26.md](../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) và O25: attendee web cần **mạng** để tải vé lần đầu; **cold-offline web / PWA / cache persistence** không thuộc Epic #914. Banner `ATTENDEE_COPY.offlineQrBanner` trên QR (`owner-ticket-qr-panel.tsx`) chỉ cảnh báo UI khi `navigator.onLine === false` — **không** claim lưu vé offline → ghi **ngoài scope** cho AC cold-offline.

## Persona & luồng chính

| Persona | Mô tả ngắn |
| --- | --- |
| Guest claim | `/claim` — hash/query token lời mời → `POST /api/bff/claim` |
| Redeem (signed-in) | `/redeem` — `RedeemForm` `productChrome` → `POST /api/bff/redeem` |
| Owner vé | `/wallet`, `/t/[tenantSlug]/tickets/[ticketId]` — BFF `me` + tickets |
| Email / session | OIDC login; xác minh email qua copy `ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED` + `/account` |
| Không bắt app | Không có copy bắt cài app trong `app/(consumer)/**` (đã grep) |

Discriminator chung: `RedeemDecision` (`src/redeem/decide.ts`) + `decideClaimBody` (`src/guest/claim-api.ts`). UX copy: `messageForDecision` / `messageForOwnerStatus` (`src/redeem/messages.ts`).

---

## Ma trận state × route

**Ký hiệu:** **Có** = UI/copy/test chứng minh; **Thiếu** = không thấy path; **Nghi vấn** = logic có nhưng thiếu test E2E/runtime; **Ngoài scope** = không đánh giá PASS (O25 / persona khác).

### Hàng: kết quả phát hành / duyệt

| State | `/redeem` | `/claim` | `/wallet` | `/t/…/tickets/[id]` (QR) |
| --- | --- | --- | --- | --- |
| **issued** (vé ACTIVE) | **Có** — `applyDecision` set `ticket` + `ux.kind === 'success'` (`redeem-form.tsx:253–267`, `1260–1318`); `decideRedeemBody` `201`+`ticketId` (`decide.ts:115–128`); test `redeem-decide.test.ts` | **Có** — `submitClaim` → `issued` clears intent, link `/wallet` (`claim-form.tsx:321–325`, `401–403`); test `guest-claim.test.ts:129–145` | **Có** — `loadOwnerWallet` + `WalletTicketCard` (`wallet/page.tsx`, `src/owner-ticket/*`); test `owner-ticket.test.ts` `parseMeTicketsResponse` | **Có** — SSR `loadOwnerTicket` + `OwnerTicketQrPanel` (`tickets/[ticketId]/page.tsx:203–271`); test `owner-ticket.test.ts` path/parse |
| **pending** (PENDING_REVIEW, chưa vé) | **Có** — `pending` clears `ticket` (`redeem-form.tsx:269–273`); copy «chưa phải vé» (`messages.ts:294–305`); poll + `refreshOwnerStatus` (`645–675`) | **Có** — pending UI + «Chưa phải vé» (`claim-form.tsx:384–396`); `refreshClaimStatus` (`336–360`) | **N/A** — wallet chỉ vé đã cấp | **N/A** |
| **rejected** (staff từ chối) | **Có** — `messageForOwnerStatus` `REJECTED` → `kind: 'denied'` (`messages.ts:350–356`); refresh clears pending (`redeem-form.tsx:672–675`) | **Có** — cùng `messageForOwnerStatus` qua `refreshClaimStatus` (`claim-form.tsx:345–351`) | **N/A** | **N/A** |
| **unknown** (mạng/5xx/không parse — **không** vé) | **Có** — `decideRedeemBody` `unknown` (`decide.ts:102–104`, `174`); `setTicket(null)` (`redeem-form.tsx:275–284`); title «Chưa xác định…» (`messages.ts:308–315`); `redeemDevStatusClass` `unknown` = muted, **không** success (`redeem-surface.ts:248`); `live-region` assertive (`live-region.test.ts:5–18`); test `redeem-messages.test.ts:56–61`, `redeem-decide.test.ts:88–94` | **Có** — `claimOutcomeClass` → unknown panel (`guest-flow-surface.ts:52–66`); retry «Gửi lại cùng yêu cầu» (`claim-form.tsx:397–399`); test `guest-claim.test.ts:166–171` | **N/A** | **Ngoài scope** — trang vé yêu cầu load SSR đã auth; lỗi mạng → `unreachable` **error**, không «unknown issuance» |
| **denied** (mã/API từ chối, không pending) | **Có** — `decideErrorCode` → `denied` (`decide.ts:177–200`); product error ring (`redeem-form.tsx:738–740`, `redeem-surface.ts:303–311`) | **Có** — email mismatch / unverified → `denied` (`claim-api.ts:48–58`); test `guest-claim.test.ts:86–114` | **N/A** | **Có** (khác nghĩa) — `forbidden` vs `missing` empty states (`page.tsx:167–200`); test `owner-ticket.test.ts` load paths |
| **expired** (pending/request hết hạn) | **Có** — `FORM_ERROR_CODES.PENDING_EXPIRED` (`decide.ts:188–190`); owner `EXPIRED` (`messages.ts:357–363`) | **Có** — invitation expired → `expired` (`claim-api.ts:37–46`, test `guest-claim.test.ts:116–127`) | **N/A** | **Có** — vé `EXPIRED`/`REVOKED`/… blocked notice (`page.tsx:209–262`) |

### Hàng: xác minh email & auth

| State | `/redeem` | `/claim` | `/account` |
| --- | --- | --- | --- |
| **EMAIL_NOT_VERIFIED** | **Có** — `messageForApiError` → `kind: 'auth'`, title «Cần xác minh email», link `/account` (`messages.ts:110–115`, `redeem-form.tsx:1272–1276`) | **Có** — `decideClaimBody` → `denied` + copy «Email chưa verified — không cấp vé» (`claim-api.ts:48–58`) | **Nghi vấn** — `SessionPanel` hiển thị phiên (`session-panel.tsx:77–91`); **không** thấy flow verify email inline trong web slice (OIDC IdP) |
| **401 / cần đăng nhập** | **Có** — `RedeemAuthGate` / gate (`redeem/page.tsx:126–127`) | **Có** — `ux.kind === 'auth'` + `parkGuestClaimIntent` (`claim-form.tsx:294–306`, `362–391`) | **Có** — signed-out surface + login (`session-panel.tsx` phía dưới file) |

### Hàng: khôi phục lỗi (retry / idempotency)

| Hành vi | Evidence | Phân loại |
| --- | --- | --- |
| Unknown giữ idempotency key + «Gửi lại» / poll | `redeem-form.tsx:275–283`, `601+`, `poll-operation.ts:141–147`; claim `submitClaim` retry (`claim-form.tsx:397–399`) | **Có** (unit); runtime poll **Pending #925** |
| Stale form reload consent | `redeem-form.tsx:286–308`; test `redeem-messages.test.ts:42–47` | **Có** |
| Claim intent park/resume | `claim-intent.ts`; test `guest-claim.test.ts:22–48` | **Có** |
| Email lỗi **không** xóa vé đã phát | Redeem/claim chỉ mutate qua BFF; **không** gọi xóa wallet; deny/unverified không `setTicket` issued; wallet tách route (`/api/bff/tickets`) | **Có** (kiến trúc + code path); **Nghi vấn** E2E «đã có vé → redeem fail email» **Pending #925** |
| Logout xóa claim intent, không đụng vé server | `session-panel.tsx:22–24`, `98` | **Có** |

### Route phụ

| Route | Liên quan #939 | Ghi chú |
| --- | --- | --- |
| `/invite` | **Ngoài scope** ticket attendee | Membership invite → Admin (`invite-accept.tsx:232–235`); unknown/network → `SurfaceState` `unknown` (`79–84`, `241–248`) |
| `/` marketing | **Có** (không bắt app) | CTA redeem/wallet (`attendee-copy.ts`) |

---

## Acceptance criteria (#939)

| AC | Đánh giá verify-first | Evidence |
| --- | --- | --- |
| Ma trận state × persona có evidence | **Đạt** (bảng trên) | Path:dòng + tests cited |
| Unknown không hiển thị như thất bại hay thành công | **Có** (code+test); visual product chrome **Nghi vấn** | Copy «chưa phải vé» / không «đã cấp» (`redeem-messages.test.ts:56–61`); `unknown` ≠ `success` class (`redeem-surface.ts:248`, `316–324` không map unknown → success ring); a11y unknown = `alert` assertive như error nhưng **copy** trung tính |
| Email lỗi không làm mất vé đã phát | **Có** (logic); E2E **Pending** | Tách wallet vs redeem; deny không issued |

---

## Findings (verify-first — chưa fix code)

| ID | Mức | Chặn AC? | Mô tả | Evidence |
| --- | --- | --- | --- | --- |
| F-939-01 | info | Không | Runtime OIDC owner/guest chưa chứng minh trên fixture #925 | Issue #939 Checks; ma trận code **Có** |
| F-939-02 | low | Không | Product `/redeem`: `unknown` dùng panel trung tính (không error ring) — đúng AC copy nhưng cần visual review #881 | `redeemProductUxClass` (`redeem-surface.ts:316–324`) |
| F-939-03 | low | Không | Claim `REJECTED` refresh: `setDecision(null)` nhưng `ux` vẫn denied — OK; không test UI refresh | `claim-form.tsx:349–351` |
| F-939-04 | info | Không | Cold-offline / PWA | **Ngoài scope O25** |

---

## Chỉ mục test liên quan (đã đọc / chạy cục bộ)

| Test | Nội dung |
| --- | --- |
| `tests/redeem-decide.test.ts` | pending ≠ issued; unknown ≠ ticket; stale/expired |
| `tests/redeem-messages.test.ts` | unknown copy; EMAIL stale; UNAUTHENTICATED |
| `tests/guest-claim.test.ts` | claim decide; intent; email codes |
| `tests/live-region.test.ts` | unknown assertive vs success polite |
| `tests/claim-route.test.ts` | BFF claim malformed → 400 |
| `tests/owner-ticket-qr-panel.test.ts` | offline banner SSR absent |
| `tests/owner-ticket.test.ts` | path, parse, loadOwnerTicket branches (cần build `@ticket/web-session` trong CI) |

**Checks local (SHA `a04e71afbc53`, sau `pnpm install --frozen-lockfile` + build `contracts` + `ui`):** subset `redeem-decide`, `guest-claim`, `redeem-messages`, `live-region`, `owner-ticket-qr-panel` **PASS**; full `pnpm --filter @ticket/web test` trong worktree thiếu build chain workspace packages → **khớp CI trên tip**, không đổi lockfile trong dispatch này.

---

## Runtime UAT (`d00a265`)

**Stack:** `ui869dev` — API `http://127.0.0.1:3498`, Keycloak `http://127.0.0.1:8080`, web worktree `pnpm exec next dev --port 3000` + `apps/web/.env.local` (gitignored, `API_BASE_URL` → 3498). **Không** seed `--reset`, không restart compose.

**Preflight:** `orca ports --worktree path:…/vcx-939-runtime` → không listener trong worktree; HTTP probe API/OIDC ngoài band. **HTTP OIDC:** `pnpm uat:p4-oidc` (12/12 PASS, `OIDC_REDIRECT_URI=http://localhost:3000/api/auth/callback`, `API_BASE_URL=http://127.0.0.1:3498`).

**Orca browser:** `orca tab create` → `browserPageId` `044827fd-95e6-4a3c-872c-f6d8e40489d5`; `set viewport` 390 / 1024 / 1440; `snapshot` + `screenshot` → `apps/web/.uat-artifacts/vcx-939/*.png` (gitignored). **Phiên owner:** Keycloak form trong Orca không hoàn tất POST (fill/click không redirect); bootstrap **chỉ cho UAT** — `cookies set` `oidc_pkce_verifier` + `oidc_oauth_state`, curl login form (cùng `audience=ticket-api`), `goto` callback → `/redeem` (không phải gap sản phẩm).

### Ma trận runtime (tóm tắt)

| Luồng | Viewport | Kết quả | Artifact / ghi chú |
| --- | --- | --- | --- |
| `/redeem` guest (auth gate) | 390 | **PASS** | `redeem-auth-gate-390.png` — «Đăng nhập để đổi mã», không bắt app |
| `/redeem` signed-in form | 390 | **PASS** | `redeem-signed-in-390.png` |
| `/redeem` mã không tồn tại `DEMO-NOT-FOUND` | 390 | **PASS** (denied) | `redeem-unknown-390.png` — «Mã không hợp lệ», không success ring; *không* mô phỏng 5xx «unknown» (cần outage BFF) |
| `/redeem` mã hợp lệ `DEMO-MFEST-002` | 1024 | **GAP** (ảnh success chưa chứng minh) | `redeem-issued-1024.png` chủ yếu là form trống theo review James; wallet có vé nhưng không thay ảnh chuyển trạng thái issued |
| `/wallet` owner | 1024 | **PASS** | `wallet-1024.png` — 6 vé, «Sẵn sàng», CTA QR |
| `/t/mfest-demo/tickets/{id}` QR | 390 | **PASS** | `ticket-qr-390.png` — QR + demo gate notice, không copy cài app |
| `/claim?token=invalid…` guest | 390 | **PASS** | `claim-guest-invalid-390.png` — hướng dẫn link email, không auth wall |
| `/account` signed-in | 390 | **PASS** | `account-390.png` |
| `/` marketing | 1440 | **PASS** | `home-no-app-1440.png` — không copy «cài app» |
| Public catalog | — | **PASS** | `GET …/v1/public/tenants/mfest-demo/events/mfest` → 200 (không AR891-INT-F01 trên SHA này) |
| Cold-offline / PWA | — | **Ngoài scope O25** | Không chạy |

**Unit (cùng SHA):** `pnpm --filter @ticket/web test` — 293 PASS (gồm `redeem-decide`, `guest-claim`, `redeem-messages`, `live-region`).

**Findings runtime:** Không gap code tái hiện trong `apps/web` — F-939-01 đóng phần OIDC owner + guest claim surface; F-939-02..04 giữ như verify-first. **F-939-05 (evidence):** acceptance runtime chưa hoàn tất: còn pending/rejected poll, unknown timeout, email lỗi không làm mất vé đã phát và ảnh success issued rõ. Merge tài liệu không đóng các gap này hoặc chứng minh pilot ready; visual product chrome tiếp tục theo `#881`.

## Việc còn lại (dispatch sau)

1. Reviewer James `dod+sec+ux` trên SHA PR docs.
2. Hoàn tất evidence runtime còn thiếu ở F-939-05 với persona fixture, hoặc ghi blocker/điều kiện mở cụ thể; không gọi phần thiếu là PASS.
