# iOS audit — production UX baseline (Issue #580)

> Snapshot source và thiết bị tại thời điểm audit 20/10/2026. PR #587 đã merge sau baseline này; không dùng cột “Current iOS behavior” để mô tả app hiện hành khi chưa kiểm lại source và build mới.

**Role:** Zico (iOS) · **Run:** `run_526c9a272efd` · **Phase:** audit only (no code / no env / no Metro changes in this task)\
**Source reviewed:** live dirty `apps/mobile` on integration tree (~105-file guest/navigation/catalog slice + prior wallet/gate work)\
**Device (read-only):** Dexter `00008140-000605803C01801C` — screenshot `apps/mobile/.uat-artifacts/mobile-production-refactor-audit-dexter.png` (no tap/login/logout)

---

## 1. Executive summary

The mobile client is **production API–oriented** (OIDC + `https://api.vemoki.com` via env/bake) but **Events home is still ADR-19 tenant-scoped**: `isAppCatalogConfigured()` requires `EXPO_PUBLIC_TENANT_SLUG` (or baked `extra.ticketPublic.tenantSlug`) before calling `GET /v1/public/tenants/{tenantSlug}/events`. That **conflicts** with the new product decision (platform-wide published catalog, no tenant slug in env). With slug removed from local `.env` (user choice), Dexter shows the **misconfigured** banner — expected until backend contract + mobile wiring change.

Guest navigation matches latest decision: **hide** “Vé của tôi” when `hasWalletAccess` is false; auth gates on Đổi mã use `requestAttendeeAuthGate` (one-shot OIDC). Account still mixes **operator-facing** strings (API/session mechanics) with attendee tasks. Push is **real APNs** (permission + token + `POST /v1/me/device-tokens`), not a fake toggle, but registration is **manual** from Account via “Bật thông báo”.

**Do not implement** in this refactor wave: client-side tenant scan for redeem, single-code auto-resolve (Architect workstream `run_873d70e1e224` / archive plans), or weakening auth/tenant guards to “make it run.”

---

## 2. Alignment: product decision vs code today

| Decision (README / user 20-Oct) | Current iOS behavior | Gap |
|-----------------------------------|----------------------|-----|
| Events = **all platform published** public events | List only via **one** `tenantSlug` from config | **Contract + client**: need e.g. `GET /v1/public/events` (or equivalent); `catalog-context.ts` + `events.tsx` + `published-event-api.ts` |
| App always **prod API** | `getApiBaseUrl()` from env / `VEMOKI_PROD_PUBLIC` bake | Aligned for runtime; tests inject `fetchImpl` |
| No demo/fixture as published fallback | `events-home.ts` fail-closed; no fixture list on home | Aligned — but **routes remain**: `events/fixture/[eventId]`, `uat/session`, demo media helpers |
| Account = task-based, no debug jargon | See §3 | **UX debt** |
| Notification permission timing / truth | See §4 | **UX + flow** review |
| Hide wallet tab for guests | `showMyTicketsTab` ∧ `hasWalletAccess` | Aligned in source; **device may lag** Metro bundle (see §8) |
| Single-code resolve all tenants | Redeem requires **manual** tenant/event slugs (+ env UUID overrides) | **Future**; blocked on backend uniqueness |

---

## 3. Account (`screens/account.tsx`)

### User-facing controls (production-intent)

| Control | Purpose | Notes |
|---------|---------|--------|
| Đăng nhập | Keycloak PKCE + `session.establish(verifyViaMe)` | `consumePendingImmediateSignIn` on focus for gated flows |
| Làm mới hồ sơ | `GET /v1/me` | Verified only |
| Đăng xuất | `logoutAndClearWalletArtifacts` + Keycloak end session | Clears offline binding/cache; staff → replace to Events |
| Đăng xuất (xoá hiển thị offline) | Same pipeline when offline-bound, not verified | Correct fail-closed copy |
| Đổi mã lấy vé | `router.push('/redeem')` | Duplicate of Events CTA |
| Chính sách quyền riêng tư | External URL | OK |
| Yêu cầu xóa tài khoản | `SessionScopedAccountDeletionPanel` | Verified only |
| Quay lại cổng | Staff workspace only | OK |

### Technical / demo-adjacent (refactor candidates)

- **Session copy** exposes implementation: “phiên đã xác minh trên máy chủ — không chỉ từ token lưu máy”, offline binding vs verified — accurate but **operator-grade**.
- **Email verified** line from `/v1/me` — OK for account but dense.
- **Unconfigured OIDC** screen: honest fail-closed — keep, but tone review for store.
- **Footer** role disclaimer (staff/org not granted by login) — good legal/product clarity.
- **No** dedicated “debug” screen on tab; **`uat/session`** stack route still registered in `_layout.tsx` (title “UAT session”) — **ship risk** if reachable in Release without guard.

### Push on Account

`SessionScopedPushStatus` → `PushStatus` / `registerApnsDeviceToken` (§4). Not auto-run on login; user must tap **Bật thông báo**.

---

## 4. Notifications & APNs

| Layer | Implementation | Production UX notes |
|-------|----------------|-------------------|
| Init | `push-notifications-init.ts` — foreground banner/list, no sound/badge | Side-effect import in root `_layout` |
| Permission + token | `apns-device-token.ts` — `expo-notifications`, iOS-only, hex token | Does not log token; 12s UI watchdog |
| Backend | `POST /v1/me/device-tokens` when verified; `DELETE` on logout | `skipped-unsigned` when guest |
| Routing | `notification-routing.ts` + cold/warm listener in `_layout` | Does not gate wallet on permission |
| UI copy | `push.ts` / `push-status.tsx` | Vietnamese; no APNs jargon in primary strings |
| Env | `EXPO_PUBLIC_PUSH_PROVIDER=apns`, `EXPO_PUBLIC_APS_ENVIRONMENT` in `.env` | `app.config.ts` sets `aps-environment` entitlements development vs production per prebuild |
| Capability | `UIBackgroundModes: remote-notification` in config | Matches ADR-12 pattern |

**Gaps (proposal, not bugs):** no coordinated “when to ask” (first launch vs post-ticket vs Account-only); no surfacing OS permission denied vs backend `failed` in one structured status component; LogBox/dev warnings unrelated but visible on Debug builds.

---

## 5. Navigation, large headers, insets

- **Tabs:** Expo Router `NativeTabs` — staff 3-tab workspace vs attendee Events / (conditional) Wallet / Account.
- **Tab stacks:** `tab-stack-options.ts` — `headerLargeTitleEnabled: true`, `headerTransparent: true`, `headerBlurEffect: systemChromeMaterial`, left-aligned titles; detail stacks compact.
- **Title sync:** `TabStackTitle` sets stack `title` + large title to match tab labels.
- **Lists:** `contentInsetAdjustmentBehavior="automatic"` on Events `FlatList` — respects safe area under large header.
- **Known RN warning:** Metro logs `[RNScreens] blurEffect and scrollEdgeEffects simultaneously` — visual overlap risk on iOS 26 / New Arch (existing, not fixed in audit phase).

**Staff default:** `StaffDefaultTabRedirect` forces staff-scan when entering staff workspace from attendee tabs.

**Wallet logout:** `WalletAccessLostRedirect` — on access lost while on `my-tickets`, replace to Events (deep links still `WalletAccessGate`).

---

## 6. `tenantSlug` / env dependency map

### Catalog (Events home) — **blocks platform goal**

| Consumer | Uses slug? | Behavior if missing |
|----------|------------|---------------------|
| `identity/catalog-context.ts` | `getTenantSlug()` | `missing_tenant_slug` → misconfigured |
| `screens/events.tsx` | `getTenantSlug()` → `fetchPublishedEventList` | Banner + no fetch |
| `published/published-event-api.ts` | Path param | `invalid` if empty |

### Wallet / session (distinct from catalog slug)

| Consumer | Uses | Notes |
|----------|------|--------|
| `getTenantId()` (UUID) | `_layout` offline bind, redeem, staff gate, wallet cache | Empty → wallet empty / staff scope from `/v1/me/events` |
| `getEventId()` | Gate dev override | Optional |
| `screens/redeem.tsx` | **Manual** `tenantSlug` / `eventSlug` fields + route params | Not global resolve; aligns with “pick event” UX |
| `event-media.tsx` | `hasDemoMediaForTenantSlug` | Bundled **demo** assets for specific slugs — not published API fallback |

### Deep links / routes

- `events/[tenantSlug]/[slug]` — public detail (per-event slugs in URL).
- `events/fixture/[eventId]` — **demo** route (stack title “Sự kiện demo”).

### Config source (`identity/config.ts` + `app.config.ts`)

- `EXPO_PUBLIC_*` inlined at Metro/prebuild; `VEMOKI_PROD_PUBLIC` **does not** set `tenantSlug` (correct for platform intent).
- Misconfigured copy explicitly mentions **“slug tổ chức công khai”** (`eventsCopy.misconfiguredBody`) — will need rewrite when platform API ships.

---

## 7. Error & state mapping (attendee-critical)

| Surface | States | User copy source | Fail-closed? |
|---------|--------|------------------|--------------|
| Events list | loading / ready / empty / error / **misconfigured** | `screen-state-copy` `eventsCopy` | Yes — no demo list |
| Events fetch | unreachable / invalid / misconfigured | `PUBLISHED_LIST_FAIL_CLOSED_MESSAGE` | Yes |
| Wallet | loading / empty online-offline / error / sign-in | `walletCopy` | Yes |
| Redeem | auth required, offline, decision outcomes | `redeemCopy` + `attendee-outcome-copy` | Yes — no send without session |
| Account `/v1/me` | error Notice | Inline Vietnamese | Yes |
| Push register | ready / unavailable / backend failed | `push-status` summaries | Yes |

**Bug vs proposal:** misconfigured Events on platform **without slug** is **expected today**, not a regression — classify as **contract gap**, not QA bug.

---

## 8. Device evidence (Dexter, read-only)

**File:** `apps/mobile/.uat-artifacts/mobile-production-refactor-audit-dexter.png`\
**Observed (~audit time):**

- Events tab: **“Chưa sẵn sàng tải sự kiện”** — matches `missing_tenant_slug` with platform `.env` (no slug).
- Tab bar shows **Sự kiện · Vé của tôi · Tài khoản** — if Metro bundle on device is **older** than hide-tab change, UI can diverge from source; correlate with reload from current `main` Metro **8083** before acceptance tests.
- LogBox **“Open debugger to view warnings”** — Debug build noise; not counted as fixed.
- No email/name visible — OK for audit artifact.

**Prior MFest session PASS** (`mfest-catalog-20261020/04-app-foreground.png`) required slug in env — **not** platform mode; keep archived for catalog session history only.

---

## 9. Existing bugs / risks (do not “fix” in audit)

| ID | Area | Severity | Notes |
|----|------|----------|-------|
| B1 | Events vs product | **Blocker** for platform UX | Needs API + mobile consumer swap |
| B2 | `uat/session`, fixture routes | Medium (ship) | Exposure in production binary |
| B3 | Redeem slug fields | Medium (UX) | Operator-facing; single-code future |
| B4 | RNScreens blur + scroll edge | Low (visual) | Logged at runtime |
| B5 | Device bundle drift | Medium (UAT) | Debug + Metro port 8083 vs embedded Release |
| B6 | Account technical session copy | Low–Med (UX) | PD rewrite scope |

---

## 10. UX proposals (post-roadmap — not implementation)

1. **Events:** consume platform catalog API; misconfigured only when API URL missing; empty state distinct from error.
2. **Account:** task sections (Vé, Thông báo, Quyền riêng tư, Phiên); move mechanics to support/diagnostics or remove.
3. **Notifications:** define permission moment; show OS denied / registered / server failed as single status; optional post-login prompt.
4. **Redeem:** await single-code contract — no client tenant scan.
5. **Remove or gate** UAT/fixture routes in Release builds.
6. **Copy:** drop “slug tổ chức” from attendee-facing errors once platform API exists.

---

## 11. Tests & evidence types

| Type | What it proves | Does not prove |
|------|----------------|----------------|
| Unit (`catalog-context`, `events-home`, wallet access, push modules) | Fail-closed logic | Device tab chrome, APNs permission sheet |
| Typecheck / 277+ tests (last run in slice) | Compile-time | Prod Events without slug |
| Dexter screenshot (this audit) | Platform misconfigured UX **today** | MFest catalog with slug |
| Coordinator MFest PASS (`04-app-foreground`) | Slug-scoped catalog works on API | Platform mode |

---

## 12. Handoff to planner / architect

- **Mobile depends on** public **cross-tenant** events list API (Architect `ARCHITECTURE.md` in same folder).
- **iOS refactor coding** waits roadmap review; preserve dirty working tree and Metro **8083** session per coordinator.
- **Single-code redemption:** separate workstream — do not overlap Redeem implementation until plan approved.

**Audit complete — no files changed outside this document.**
