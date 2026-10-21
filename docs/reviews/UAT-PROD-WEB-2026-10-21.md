# UAT production WEB — 2026-10-21

| Trường | Giá trị |
| --- | --- |
| Runner (lần 1) | Sora · uat · Orca `term_82365d62-fcfb-45f7-8a50-bda8a4fcdf01` · task `task_ed9780af6016` |
| Runner (retest nginx) | Sora · uat · Orca `term_94a572bc-adbc-4b3c-af8b-6dfa75421f1d` · task `task_03be9fbc418c` |
| Runner (retest 3 · #668) | Sora · uat · Orca `term_310eb26e-29c4-4016-b434-e6cbc14c5379` · task `task_0aff0036d08f` |
| Runner (retest 4 · final) | Sora · uat · Orca `term_b5a5ae6d-99c1-46a7-bde3-1934239ba208` · task `task_6183358f6a56` |
| Runner (retest 5 · final) | Sora · uat · Orca `term_a2b63072-751e-434a-9e29-d02a8b11cde4` · task `task_4860a2bdec4f` |
| Runner (retest 6 · final · #678) | Sora · uat · Orca `term_3e682b0f-f0b2-4d7a-a7d5-b19dac7cbe2c` · task `task_4d6a462b3e30` |
| Runner (retest 8 · final · #682) | Sora · uat · Orca `term_979a325c-f385-4112-a418-2b0138a64fc8` · task `task_e494c7591080` |

| Runner (retest 7 · final · E01/B06/#630) | Sora · uat · Orca `term_30236904-40dd-43f8-9364-0a8af943e34b` · task `task_8f6dc916df4e` |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Catalog SHA-256 | `756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f` |
| Deploy baseline (retest 3) | `cbabea4ccc6447e7dc40a832ba95c81320c1b0d9` (`main`, fix #668 rate-limit RLS + deploy api/web) |
| Deploy baseline (retest nginx) | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` |
| Viewports | Desktop ~1440; mobile 390 qua `orca exec --command "set viewport 390 844"` (retest) |
| Browser | Orca tabs `6d76d908…` (portal), `4f074dbb…` (app guest) |
| SSH J-suite | `conanphong` read-only, không in `.env` |
| Ảnh | `apps/web/.uat-artifacts/prod-2026-10-21/` + retest `…/prod-2026-10-21-retest/` + retest3 `…/prod-2026-10-21-retest3/` + retest4 `…/prod-2026-10-21-retest4/` + retest5 `…/prod-2026-10-21-retest5/` + retest6 `…/prod-2026-10-21-retest6/` + retest8 `…/prod-2026-10-21-retest8/` |
| Deploy baseline (retest 6) | `bfc03166b7e46399a5ea19b68bedaa6c8c1fca3b` (`main`, merge PR #678 deploy prod web) |
| Deploy baseline (retest 8) | `0add1f6072d4e4b9b7b6b73f7b8ffb3baa7b0bb8` (`main`, merge PR #682 deploy prod web — fix gate loading) |

## Launch verdict

**NO-GO** (retest 8 final @ `0add1f6`, 2026-10-21 ~15:45Z+08 — phạm vi web; H03 inbox và suite G/H01 máy thật **DEFERRED** riêng)

## Retest 8 (final)

Phạm vi: sau deploy prod web **#682** (`0add1f6` = merge `hangndat/fix-gate-loading-1021`). Profile Orca tách: `retest8-staff` / `retest8-attendee` (isolated). Tab staff `0fbf8fac…` (`/api/auth/login?return=/gate` → KC staff); attendee `239af934…`; portal `898ac197…`. Không deploy/SSH ghi; không burst public API.

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| A01–A04 | http | **PASS** | `curl` marketing/portal/app `200`; BFF `/api/bff/me` `401`; `/gate` `307` (no cookie) |
| B04 | desktop | **PASS** (callback) / **FAIL** (E01 paint) | Profile `retest8-staff`: KC `staff@example.com` → `/gate` URL đúng; nội dung ban đầu vẫn «Đang tải…» (`data-surface-state=loading`), không «Cổng check-in» trong ≤8s |
| E01 | desktop | **FAIL** | Sau B04, **5×** `goto https://app.vemoki.com/gate` (foreground, đến form hoặc fail-closed): **12.2–12.4s** vẫn «Đang tải…», không fail-closed — `e01-gate-timing-staff-profile.txt`, `e01-staff-profile-loading.png`. Tab default sau cùng: 5× FAIL ~12.3s (`e01-gate-timing-default-tab.txt`) |
| E07 | desktop | **PASS** | Profile `retest8-attendee`: `/gate` → `/?notice=gate_denied` (gate_denied) |
| D02 | desktop | **BLOCKED** | Không hoàn tất redeem `DEMO-MFEST-009` trong phiên («Tải biểu mẫu» / terms không ổn định sau nhiều lần thử); BFF public `terms` vẫn `200` (1 lần). Không kết luận regress so retest 6 |
| E02–E05 | desktop | **BLOCKED** | Phụ thuộc form cổng sau `goto /gate` (E01 FAIL) — không chạy mutate |
| C01 (portal) | desktop | **PASS** | Tab portal: shell Aurora Night Org Owner, «Open scan Gate on app» — không đổi so retest 6 |
| H03 | — | **DEFERRED** | Không hộp thư kiểm soát prod (ghi riêng, không kéo web verdict) |

**E01 timing (staff profile, giây → trạng thái cuối):**

```text
run1 12.35s FAIL_loading
run2 12.20s FAIL_loading
run3 12.30s FAIL_loading
run4 12.32s FAIL_loading
run5 12.35s FAIL_loading
```

**Retest 8 verdict (web):** **NO-GO** — Deploy #682 **chưa** xóa P0 **E01** (`goto /gate` kẹt loading >8s, không fail-closed). **E07** gate_denied attendee OK. Portal shell **không đổi**. H03 / G / H01 máy thật vẫn **DEFERRED**.

```text
P0 (retest 8): E01, H03 (DEFERRED), B06/#630 (không retest)
P0 regress vs retest 6: E01 vẫn FAIL; E02–E05/D02 vòng nhanh BLOCKED do cổng
DEFERRED: G01–G06, H01 (máy thật), H03 inbox

| Ảnh | `apps/web/.uat-artifacts/prod-2026-10-21/` + retest `…/prod-2026-10-21-retest/` + retest3 `…/prod-2026-10-21-retest3/` + retest4 `…/prod-2026-10-21-retest4/` + retest5 `…/prod-2026-10-21-retest5/` + retest6 `…/prod-2026-10-21-retest6/` + retest7 `…/prod-2026-10-21-retest7/` |
| Deploy baseline (retest 6–7) | `bfc03166b7e46399a5ea19b68bedaa6c8c1fca3b` (`main`, merge PR #678 deploy prod web) |

## Launch verdict

**NO-GO** (retest 7 final @ `bfc0316`, 2026-10-21 ~15:25Z+08 — phạm vi web; **P0 còn E01**; H03 inbox và suite G/H01 máy thật **DEFERRED** riêng)

## Retest 7 (final)

Phạm vi: chỉ **E01**, **B06**, **#630** trên prod `bfc0316`. Orca browser; `orca tab switch` trước mỗi đo/điều hướng. Profile tách: `orca tab profile create --scope isolated` — `uat-retest7-b06-portal` (`8c437832…`, tab `2f98fd7e…`), `uat-retest7-630-app` (`4c3995ac…`, tab `4a8ffe11…`); staff `/gate` tab `dcd484ff…` (profile default). Không deploy/SSH ghi/realm.

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| E01 | desktop | **FAIL** | 5× `goto https://app.vemoki.com/gate` (staff KC): mỗi lần **>20s** vẫn `loading.tsx` «Đang tải…» / «Vui lòng chờ — chưa có thao tác vé…» — **không** «Cổng check-in», không fail-closed. `e01-reload-times.txt`, `e01-gate-loading-retest7.png`. Cùng tab: in-tab `fetch /api/bff/me/events` → **200** (API không treo); `curl` không cookie → BFF **401**, `/gate` **307** (`e01-curl-unauth.txt`). Điều hướng client «Cổng» từ `/` không vào `/gate` trong 20s. **Giả định RC:** RSC `/gate` kẹt suspense trong lúc `GatePage` chờ `requireGateCapabilityOrHome` (`apps/web/app/gate/page.tsx` L23–26 → `apps/web/src/nav/staff-route-guard.ts` L84–101, upstream `me/events`, `AbortSignal.timeout(15_000)`); UI route loading từ `apps/web/app/loading.tsx` L4–15 — không phải automation nền (tab foreground). |
| B06 | desktop | **PASS** | Profile isolated: `attendee@example.com` trên `portal.vemoki.com` → «Portal quản trị chỉ dành cho nhân sự» / link «Mở bề mặt khách» — **không** shell Owner. `b06-attendee-portal-retest7.png` |
| #630 | browser | **PASS** | Profile isolated: login app → `/account` `attendee@example.com`. Chờ **330s** (> `accessTokenLifespan` **300s** theo `docs/reviews/ISSUE-612-ACCOUNT-ME-ROOT-CAUSE-2026-10-20.md`), `location.reload()` → vẫn `/account`, email attendee, `fetch /api/bff/me` **200**. `630-wait-start.txt`, `630-wait-end.txt`, `b630-account-before-wait-retest7.png`, `b630-account-after-wait-retest7.png` |

**Retest 7 verdict (web):** **NO-GO** — B06 và #630 đã chứng minh với profile tách; **E01 vẫn P0** (reload `/gate` >20s loading, không fail-closed).

```text
P0 (retest 7): E01, H03
P0 cleared vs retest 6: B06, #630
P1: CSP connect-src http://api:3001 (không retest)
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest 6 (final)

Phạm vi: sau deploy prod #678 (`bfc0316`). Tab Orca mới (`53e5a0d7…` redeem, `471a96c6…` staff `/gate`, `28af341f…` portal). Không deploy/SSH ghi. Drive redeem/gate: `focus` + `press Space`/`Enter` khi `orca exec click` không kích hoạt handler React.

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| A01–A04 | http | **PASS** | `curl` marketing/portal/app/auth `200`; BFF `/api/bff/me/events` `401`; `/gate` `307` |
| #630 | browser | **NOT-RUN** | Profile Orca dùng chung: logout staff → attendee KC/`/account` vẫn `staff@example.com` (không chứng minh refresh attendee) |
| B04 | desktop | **PASS** | Tab `471a96c6…` `login?return=/gate` → KC staff → `/gate` «Cổng check-in» (lần đầu ~20s qua callback); `b04-gate-retest6.png` |
| B06 | desktop | **BLOCKED** | Portal logout → attendee KC `fill` không hoàn tất callback trong phiên (vẫn form Sign In) |
| C05–C07 | desktop | **NOT-RUN** | Portal staff shell không tái lập sau logout/KC trong phiên |
| D02 | desktop | **PASS** | BFF `form:null` + `terms` OK. `focus e11` + `Space` «Tải biểu mẫu» → nhánh terms-only + «Biểu mẫu sẵn sàng»; `DEMO-MFEST-008` → «Đổi mã thành công», vé `7e0c62b7-a835-4b92-a1b5-154730762408`; `d02-guest-retest6.png`, `d02-redeem-result-retest6.png` |
| D03 | desktop | **PASS** | Mã sai `WRONG-CODE-XYZ` (cùng flow terms) → từ chối, không cấp vé (không lặp success D02) |
| D04 | desktop | **PASS** | Gửi lại `DEMO-MFEST-008` → không cấp vé thứ hai (trạng thái giữ vé đã cấp) |
| E01 | desktop | **FAIL** | `goto /gate` sau phiên staff: «Đang tải…» **>16s** (đo đến 16.4s vẫn loading); **không** chuyển fail-closed «Chưa rõ / không cho qua» — kẹt spinner route (`data-surface-state=loading`) |
| E02 | desktop | **PASS** | MFest tenant/event → phiên `66c74c38-838d-4738-a3c8-47b57c4ffe28` |
| E03 | desktop | **PASS** | Vé `7e0c62b7-…` → «Cho vào» + check-in `f0a9ca05-…` |
| E04 | desktop | **PASS** | Xác nhận lại cùng vé → «Không cho vào» `TICKET_NOT_ACTIVE` |
| E05 | desktop | **PASS** | UUID giả `000…099` → «Không cho vào» `TICKET_NOT_FOUND` (không 500) |
| I03 | desktop | **PASS** | Staff → `portal.vemoki.com/platform` «Not a Platform Operator» (từ chối platform) |
| J01 | ssh | **PASS** | (retest 5, không đổi) `j-ssh-output.txt` |
| J02 | ssh | **PASS** | (retest 5) |
| J03 | ssh | **PASS** | (retest 5) |
| J04 | ssh | **PASS** | Coordinator: VPS sha `a55f89ee…` == git hotfix baseline (drift đã chấp nhận retest 5) |
| J06 | ssh | **PASS** | (retest 5) `proxy_buffer_size 32k` |
| H03 | — | **BLOCKED** | Không hộp thư kiểm soát prod |
| Rate limit | http | **NOT-RUN** | Không burst (chính sách phiên) |

**Retest 6 verdict (web):** **NO-GO** — Redeem terms-only + gate mutate đã sống sau #678; **P0 còn E01** (SSR `/gate` loading >15s, không fail-closed), **H03**, **B06** / **#630** chưa chứng minh trong phiên Orca.

```text
P0 (retest 6): E01, H03, B06, #630 (NOT-RUN/BLOCKED)
P0 cleared vs retest 5: D02, D03, D04, E02, E03, E04, E05, B04, J04
P1: CSP connect-src http://api:3001 (không retest)
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest 5 (final)

Phạm vi: chỉ case BLOCKED/FAIL retest 4. SSH `conanphong` (alias, read-only). Tab Orca mới cho B04/D02; không deploy VPS.

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| B04 | desktop | **PASS** | Tab mới `22d3868a…`: staff KC → callback OK → `/gate` (không 502); `b04-gate-retest5.png` |
| B06 | desktop | **NOT-RUN** | Sau logout portal, chưa hoàn tất flow attendee trên KC trong phiên (profile Orca dùng chung); `b06-attendee-portal-retest5.png` (auth shell) |
| B07 | desktop | **PASS** | Sai mật khẩu staff trên KC, vẫn form login; `b07-bad-password-retest5.png` |
| B08 | desktop | **PASS** | `GET /api/auth/logout` → `/auth` «Staff sign-in» |
| B10 | desktop | **PASS** | Cookie `vemoki_portal_locale=en` (UI toggle tương đương) → `document.documentElement.lang` = `en` + nhãn EN; kết hợp staff login sẵn có trong phiên |
| C08 | desktop | **PASS** | Cookie `vemoki_portal_locale=en` → «Organization»/«All events»; `html lang=en`; `c08-portal-en-desktop.png` |
| D02 | desktop | **FAIL** | BFF `200` `form:null` `terms:true` (curl + in-tab JSON). Tab `61f0cfda…` `/redeem?tenantSlug=mfest-demo&eventSlug=mfest`: `click` «Tải biểu mẫu» (`e11`/`ref=e11`) ≥6s vẫn «Chưa có biểu mẫu» — không vào nhánh `termsVersion` (redeem-form ~818). `vemoki-web-1` log `failed-to-find-server-action` / Server Reference ID `x`. `d02-redeem-retest5.png` |
| D03–D04 | desktop | **BLOCKED** | Phụ thuộc D02 |
| E01 | desktop | **FAIL** | Sau B04 tab `22d3868a…` `/gate` kẹt «Đang tải…» ≥10s (cùng lỗi Server Action trên web) |
| E02–E04 | desktop | **BLOCKED** | Không load form cổng + không redeem ticket |
| I01 | desktop | **PASS** | `staff@example.com` Owner Aurora + MFest: `/t/d9d9f001-…` shell MFest (đúng seed). UUID không membership `a0000000-0000-4000-8000-000000000099` → «Permission denied»; `i01-mfest-tenant-retest5.png` |
| J01 | ssh | **PASS** | `PRODUCT_ORIGIN=https://app.vemoki.com` — `j-ssh-output.txt` |
| J02 | ssh | **PASS** | `OIDC_SCOPES=openid profile email` portal + web |
| J03 | ssh | **PASS** | API env names `PLATFORM_*`, `OIDC_AUDIENCE`, … (không giá trị secret) |
| J04 | ssh | **FAIL** | VPS sha `a55f89ee…` ≠ git @ `4376bc5` sha `7bf278d3…`; diff **2 dòng** trên service `web`: VPS có `OIDC_AUDIENCE` + `OIDC_JWKS_URL` tại block env (hotfix đã merge git nhưng VPS chưa redeploy khớp tip) — `j04-compose-diff.txt` |
| J06 | ssh | **PASS** | `proxy_buffer_size 32k` trong `/opt/vemoki/src/infra/deploy/nginx-portal.snippet.conf` |
| H03 | — | **BLOCKED** | Không hộp thư kiểm soát prod |
| Rate limit | http | **PASS** (mini) | 12× `GET /v1/public/events` → `200`; `rate-limit-mini.txt` |

**Retest 5 verdict (web):** **NO-GO** — B04/nginx callback đã sạch; P0 còn **D02–D04**, **E01–E04**, **J04** (compose drift), **H03**.

```text
P0: D02, D03, D04, E01, E02, E03, E04, J04, H03
P1: CSP connect-src http://api:3001 (không retest)
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest 4 (final)

Quy tắc phiên: không spam public API; kiểm 429 **cuối** (12 req → toàn `200` sau cooldown ~5 phút). Pre-check ban đầu: `/v1/public/events` → `429` (IP retest 3); sau chờ → `200`. Login Keycloak qua Orca (`fill`/`type`/`click`); slug redeem qua query `tenantSlug`/`eventSlug`. SSH J-suite: `conanphong@113.161.116.5` → **Permission denied** (không dùng `dexter` theo task).

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| A01 | http | **PASS** | marketing/portal/app `200`; auth `302` |
| A02–A04 | http | **PASS** | BFF `401`; `/gate` `307`; `a04-gate-headers.txt` |
| A05–A06 | http | **PASS** | ancafe/dath `200`; cert `notAfter=Jan 17 2027` (`a06-cert-dates.txt`) |
| B01 | desktop 1440 | **PASS** | Portal staff → Aurora shell; `b01-portal-home-desktop.png` |
| B02 | http | **PASS** | Authorize `ticket-admin-web`, PKCE S256, scope không `offline_access` |
| B03 | browser | **PASS** | Portal callback shell (session retest 4) |
| B04 | desktop | **BLOCKED** | App `ticket-web` login: tab callback `502 Bad Gateway` (`e50057d0…`); retry KC `fill`/`type` không hoàn tất callback trong 2 lần (`400c35e8…`). Tab `/gate` cũ mất phiên → redirect KC |
| B05 | http | **PASS** | `ticket-web` authorize URL có PKCE (`b05-authorize-headers.txt` HEAD `405` — dùng browser flow) |
| B06 | desktop | **NOT-RUN** | Chưa retest attendee-on-portal sau ưu tiên redeem/gate |
| B07 | desktop | **NOT-RUN** | — |
| B08 | desktop | **NOT-RUN** | — |
| B09 | — | **NOT-RUN** | — |
| B10 | desktop | **NOT-RUN** | — |
| C01 | desktop | **PASS** | Aurora Night Org shell sau B01 |
| C02 | desktop | **PASS** | Event list + overview; `c02-event-desktop.png` |
| C03 | desktop | **PASS** | Nút «Mở cổng quét trên app» present (`ref=e5`) |
| C04 | desktop | **PASS** | Members; `c04-members-desktop.png` |
| C05–C07 | desktop | **NOT-RUN** | — |
| C08 | desktop | **FAIL** | `?lang=en` vẫn nhãn VI («Sự kiện», «Chọn tổ chức») |
| C09 | — | **NOT-RUN** | P1 |
| D01 | desktop | **PASS** | Guest home MFest/Studio; `d01-app-home-desktop.png` |
| D02 | desktop | **FAIL** | BFF `GET /api/bff/public/tenants/mfest-demo/events/mfest` → `200` (`form: null`, `terms: true`) nhưng UI «Tải biểu mẫu» không chuyển trạng thái sau `click` (Orca); không redeem `DEMO-MFEST-003`; `d02-redeem-attempt-desktop.png` |
| D03–D04 | desktop | **BLOCKED** | Phụ thuộc D02 |
| D05 | http/browser | **PASS** | `/claim`, `/invite` → `200` |
| D06 | mobile 390 | **PASS** | `set viewport 390 844`; `d06-redeem-390.png` |
| D07 | — | **NOT-RUN** | P1 |
| E01–E02 | desktop | **BLOCKED** | Staff `/gate` tab `7800b3fe…` reload → KC login; không mở phiên Aurora |
| E03–E04 | desktop | **BLOCKED** | Không ticket redeem + gate session |
| E05 | desktop | **NOT-RUN** | — |
| E06 | — | **NOT-RUN** | P1 |
| E07 | desktop | **PASS** | Attendee `/gate` → `?notice=gate_denied`, «Không đủ quyền cổng»; `e07-attendee-gate.png` |
| I01 | desktop | **FAIL** | Staff Aurora mở tenant MFest UUID → shell MFest (staff@ Owner cả hai tenant theo seed — không khớp kỳ vọng cách ly «chỉ Aurora»); `i01-mfest-tenant-desktop.png` |
| I02 | http | **PASS** | `UNAUTHENTICATED`; `i02-me-events.json` |
| I03 | desktop | **NOT-RUN** | P1 |
| J01–J03 | ssh | **BLOCKED** | `conanphong@113.161.116.5` publickey denied; `j-ssh-output.txt` |
| J04 | — | **BLOCKED** | Không đọc VPS compose (SSH); git @ `03c6862` sha `7bf278d3…` (`infra/deploy/compose.yaml`) |
| J05 | — | **NOT-RUN** | P1 |
| J06 | ssh | **BLOCKED** | Cùng SSH |
| H03 | — | **BLOCKED** | Không hộp thư kiểm soát prod |
| Rate limit | http | **PASS** (mini) | Sau cooldown: 12× `GET /v1/public/events` → `200`; `rate-limit-mini.txt` (không burst 650) |
| #630 app refresh | browser | **PASS** | Attendee login lần 2 → `/account` (`b630-attendee-account.png`) |

**P1:** CSP app `connect-src` vẫn có `http://api:3001` — `p1-csp-connect.txt`.

**Retest 4 verdict (web):** **NO-GO** — B04 app staff OIDC callback/gate session, **D02–D04**, **E01–E04**, **I01** (nếu giữ AC cách ly chặt), **J01–J04/J06** (SSH), **H03**, **C08**.

```text
P0 chặn launch web: B04, D02, D03, D04, E01, E02, E03, E04, I01, H03, J04 (+ J01–J03/J06 BLOCKED thiếu SSH)
P1: CSP connect-src http://api:3001, C08 locale EN
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest 3 sau #668 (`cbabea4`)

Deploy coordinator: API rate-limit RLS không còn 5xx trên `/v1/public/*` và gate mutate (đã verify curl public trước burst). Phạm vi: smoke A01–A04, B01, B04, C01–C04, D02–D04, D06, E01–E05, E07, I01–I02, J04; kiểm tra 429 thật + không 5xx; so `infra/deploy/compose.yaml` VPS vs git.

| ID / Issue | Retest nginx | Retest 3 | Evidence |
| --- | --- | --- | --- |
| A01–A04 | PASS | **PASS** | `curl` marketing/portal/app `200`, auth `302`; BFF `401`; `/gate` `307` + CSP/`nosniff` |
| Rate limit public read | — | **PASS** | 650 req/IP → `175×200` rồi `475×429`; body `RATE_LIMITED` (không 5xx). Runner IP vẫn `429` trong cửa sổ 600/h (chưa chứng minh hết hạn → `200` trên cùng IP trong phiên) |
| B01 | PASS | **BLOCKED** | Keycloak `ticket-admin-web`: `fill`/`#username` + `#kc-login` không chuyển callback trong Orca tab `6d76d908…` (không tái chứng minh shell Aurora) |
| B04 | PASS | **BLOCKED** | Cùng blocker KC automation; tab cũ callback `502` là URL stale, không retest end-to-end |
| C01–C04 | PASS | **BLOCKED** | Phụ thuộc B01 |
| D01 | PASS | **PASS** | Guest home `app.vemoki.com/` — event MFest/Studio listed |
| D02 | FAIL | **FAIL** | `/redeem?tenantId=…&eventId=…` + slug `mfest-demo`/`mfest`: «Tải biểu mẫu» disabled; `GET /v1/public/*` từ IP runner `429` sau burst UAT (chặn load form). Mã seed `DEMO-MFEST-001` chưa redeem |
| D03–D04 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D05 | PASS | **PASS** | `/claim`, `/invite` HTTP `200` |
| D06 | PASS | **PASS** | `set viewport 390 844` + `d06-redeem-390.png` |
| E01 | PASS | **PASS** | Staff tab `7800b3fe…` `/gate` — form phiên, KẾT NỐI «Trực tuyến» sau «Thử lại»; `e01-gate-online.png` |
| E02 | PASS | **PASS** | Phiên Aurora `68d601b3-…` / tenant `26c16ee9-…` / event `5295ef1a-…` hiển thị |
| E03–E04 | FAIL/BLOCKED | **BLOCKED** | Không có ticket ID hợp lệ post-D02; phiên staff mất cookie sau thao tác gate (UNAUTHENTICATED) |
| E05 | FAIL | **PASS** | Ticket giả `000…099` → «Không cho vào» + `UNAUTHENTICATED` (từ chối sạch, không 500) khi API trực tuyến |
| E07 | PASS | **BLOCKED** | Guest `/gate` → redirect OIDC `ticket-web` (chưa login attendee → chưa thấy `gate_denied`) |
| I01 | PASS | **BLOCKED** | Phụ thuộc portal staff |
| I02 | PASS | **PASS** | `GET /v1/me/events` → `401` |
| J04 | FAIL | **PASS** (drift có chủ đích) | `diff` VPS `infra/deploy/compose.yaml` vs git @ `cbabea4`: **chỉ** thêm `OIDC_AUDIENCE` + `OIDC_JWKS_URL` trên service `web` (PR #665 hotfix chưa merge). VPS sha `a55f89ee…`, git sha `7bf278d3…` |
| J01–J03 | PASS | **PASS** | SSH `dexter@113.161.116.5`: `PRODUCT_ORIGIN`, `OIDC_SCOPES`, `PLATFORM_INVITE_TTL_SECONDS`, `OIDC_AUDIENCE` (chỉ tên/giá trị không secret) |
| H03 | BLOCKED | **BLOCKED** | Không có hộp thư kiểm soát prod |

**P1 gap:** CSP app `connect-src` gồm `http://api:3001` (origin Docker nội bộ) — `curl -I https://app.vemoki.com/`.

**Retest 3 verdict (web):** **NO-GO** — API public/gate không 5xx sau #668; rate limit 429 đúng. P0 còn **D02**, **D03–D04**, **B01/B04/C/I01/E03–E04/E07** (redeem + KC automation / phụ thuộc), **H03**.

```text
P0 chặn launch web: D02, D03, D04, B01, C01–C04, I01, E03, E04, E07, H03
P1: CSP connect-src http://api:3001
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest sau fix nginx

Coordinator: `app.vemoki.com` thêm `proxy_buffer_size 32k` (+ buffers) — reload ~05:08Z (`vemoki.conf.bak-20261021-app-buffer`). Chỉ chạy lại case BLOCKED/FAIL trong scope task; không deploy/sửa VPS.

| ID / Issue | Trước | Sau retest | Evidence |
| --- | --- | --- | --- |
| B04 | FAIL (callback 502) | **PASS** | Staff `return=/gate` → «Cổng check-in dự phòng»; `b04-gate-after-nginx-fix.png` |
| B05 | PASS | **PASS** | Authorize `ticket-web` → `app.vemoki.com/api/auth/callback`, scope `openid profile email` (không `offline_access`) |
| #630 refresh app auth | FAIL (502 callback) | **PASS** | Attendee login + reload → `/account` vẫn `attendee@example.com`, «Đăng xuất» |
| D01 | PASS | **PASS** | Guest/attendee home, không chrome admin tenant |
| D02 | BLOCKED | **FAIL** | «Tải biểu mẫu» `mfest-demo`/`mfest` không load form; `vemoki-web-1` log `failed-to-find-server-action` |
| D03 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D04 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D05 | PASS | **PASS** | `/claim`, `/invite` HTTP 200 (không token) |
| D06 | FAIL (không viewport) | **PASS** | `set viewport 390 844` + `d06-redeem-mobile-390-retest.png` |
| E01 | BLOCKED | **PASS** | Staff `/gate` form phiên + copy fail-closed |
| E02 | BLOCKED | **PASS** | Aurora tenant `26c16ee9-…` + event `5295ef1a-…` → phiên `68d601b3-…` |
| E03 | BLOCKED | **FAIL** | «Giữ chỗ và xác nhận» → «API cổng không tới được»; container log Server Action ID lỗi |
| E04 | BLOCKED | **BLOCKED** | Phụ thuộc E03 |
| E05 | BLOCKED | **FAIL** | Ticket UUID giả → cùng lỗi API cổng (không từ chối sạch 4xx) |
| E07 | BLOCKED | **PASS** | Attendee `/gate` → `?notice=gate_denied`, «Không đủ quyền cổng» |
| I01 | PASS | **PASS** | Staff portal → URL tenant MFest `d9d9f001-…` → «Cần đăng nhập», không lộ shell MFest |
| J04 | FAIL | **FAIL** | So **đúng file** `infra/deploy/compose.yaml`: VPS sha `a55f89ee4f3431c609aa8dd1146b9c985da96ffd1a06e75d5b21ccee50eeda75` ≠ git @ `bc916201` sha `7bf278d3f20b84020168280b3b5850f3aa8716d9eb2806433c3af2b0fabb4ac9` (PR #665 hotfix VPS chưa khớp tip git) |
| H03 | BLOCKED | **BLOCKED** | Không có hộp thư kiểm soát prod |

**Retest verdict:** **NO-GO** — nginx unblock B04/#630 OIDC callback; P0 còn **D02**, **E03/E05**, **J04**, **H03**.

```text
P0 FAIL/BLOCKED còn: D02, E03, E05, J04, H03 (+ D03–D04, E04 blocked)
```

## Launch verdict (lần 1 — giữ lịch sử)

**NO-GO**

P0 chặn: **B04** (app OIDC callback `502`), **D02–D04** (phụ thuộc đăng nhập app), **E02–E05** (phụ thuộc staff `/gate`), **H03** (không có hộp thư kiểm soát), **J04** (compose git ≠ VPS).

## Retest fix hôm nay (deploy `1ba6647`)

| Issue | Kết quả | Evidence |
| --- | --- | --- |
| #617 CSP + `nosniff` app + portal | **PASS** | `curl -I` `https://app.vemoki.com/` và `https://portal.vemoki.com/` — có `content-security-policy` + `x-content-type-options: nosniff` |
| #618 `INVALID_UUID` / 422 | **PASS** (API) | `POST …/tenants/not-a-uuid/events/also-bad/redemptions` → `422` `INVALID_UUID` |
| #618 HTTP 413 | **NOT-RUN** | Body lớn không token → `401` trước validate; chưa có bearer UAT an toàn |
| #630 refresh / app auth | **FAIL** | `GET /api/auth/callback` sau Keycloak → nginx **502**; `vemoki-web-1` log `failed-to-find-server-action` |
| #653 upload CSV giới hạn | **NOT-RUN** | Không mở flow upload CSV trên portal (thiếu thời trong phiên; portal shell OK) |
| #639 admin-form | **NOT-RUN** | Không retest form admin riêng; portal event/members tải bình thường |

## Suite A — Cạnh và sức khỏe

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| A01 | http | **PASS** | vemoki/portal/app `200`; auth `302` |
| A02 | http | **PASS** | portal `/api/bff/me/subject` → `401` |
| A03 | http | **PASS** | app `/api/bff/me` → `401` |
| A04 | http | **PASS** | `GET /gate` → `307` `location: /auth?next=%2Fgate` + CSP headers |
| A05 | http | **PASS** | `ancafe.anphong.vn` `200`; `dath.info` `200` (`-k`) |
| A06 | http | **PASS** | Cert `notAfter=Jan 17 2027` (bốn host vemoki) |

## Suite B — Đăng nhập

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| B01 | desktop | **PASS** | Portal staff → Aurora Night Org. `b01-portal-home-desktop.png` |
| B02 | http | **PASS** | `ticket-admin-web`, PKCE S256, scope `openid profile email`, không `offline_access` |
| B03 | desktop | **PASS** | Portal callback → shell `200`, không 502 |
| B04 | desktop | **FAIL** | App `return=/gate` → callback **502**. `b04-app-callback-502-desktop.png` |
| B05 | http | **PASS** | `ticket-web`, callback app, PKCE, không `offline_access` |
| B06 | desktop | **PASS** | `attendee@example.com` trên portal client → không vào shell (kẹt form KC / không onboarding Owner). `b06-attendee-portal-desktop.png` |
| B07 | desktop | **PASS** | Sai mật khẩu giữ form KC. `b07-bad-password-desktop.png` |
| B08 | desktop | **PASS** | `/api/auth/logout` → `/auth` «Đăng nhập nhân sự» |
| B09 | — | **NOT-RUN** | — |
| B10 | — | **NOT-RUN** | — |

## Suite C — Portal Owner

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| C01 | desktop | **PASS** | Shell Aurora Night Org |
| C02 | desktop | **PASS** | Event Aurora Night UAT overview. `c02-event-desktop.png` |
| C03 | desktop | **PASS** | Nút «Mở cổng quét trên app» (link `e5`); catalog 2026-10-19 xác nhận `https://app.vemoki.com/gate` |
| C04 | desktop | **PASS** | Members «Người dùng (1)». `c04-members-desktop.png` |
| C05–C09 | — | **NOT-RUN** | — |

## Suite D — App khách

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| D01 | desktop | **PASS** | Guest home, không chrome admin. `d01-app-home-desktop.png` |
| D02 | desktop | **BLOCKED** | Cần session attendee; app callback **502** |
| D03 | desktop | **BLOCKED** | Cùng lý do |
| D04 | desktop | **BLOCKED** | Cùng lý do |
| D05 | desktop | **PASS** | `/claim`, `/invite` không token — form hướng dẫn, không 500 |
| D06 | mobile 390 | **FAIL** | Orca không set viewport 390; ảnh `d06-redeem-mobile-390.png` ở kích thước mặc định |
| D07 | — | **NOT-RUN** | — |

## Suite E — Cổng web

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| E01 | desktop | **BLOCKED** | Phụ thuộc B04 staff `/gate` |
| E02–E05 | desktop | **BLOCKED** | Phụ thuộc phiên staff + ticket redeem |
| E06 | — | **NOT-RUN** | — |
| E07 | desktop | **BLOCKED** | Guest `/gate` → Keycloak app login, chưa chứng minh `gate_denied` (cũng bị callback 502 nếu login) |

## Suite I — Cách ly

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| I01 | desktop | **PASS** | Staff Aurora, URL tenant `d9d9f001-…` → «Cần đăng nhập» / không lộ MFest |
| I02 | http | **PASS** | `GET https://api.vemoki.com/v1/me/events` → `401` `UNAUTHENTICATED` |
| I03 | desktop | **NOT-RUN** | Phiên staff bị gián đoạn sau B06 |
| I04 | — | **BLOCKED** | Không có user Operator demo |

## Suite J — Vận hành (read-only)

| ID | Kết quả | Evidence |
| --- | --- | --- |
| J01 | **PASS** | `PRODUCT_ORIGIN=https://app.vemoki.com` (portal container) |
| J02 | **PASS** | `OIDC_SCOPES=openid profile email` (portal + web) |
| J03 | **PASS** | API env có `PLATFORM_*`, `OIDC_AUDIENCE`, `PLATFORM_MFA_ACR_VALUES` (chỉ tên biến) |
| J04 | **FAIL** | VPS `/opt/vemoki/src/compose.yaml` sha `0d44109…` ≠ git `infra/deploy/compose.yaml` sha `7bf278d…` @ `1ba6647` |
| J05 | **NOT-RUN** | — |
| J06 | **PASS** | nginx `proxy_buffer_size 32k` |

## Suite H (catalog)

| ID | Kết quả | Ghi chú |
| --- | --- | --- |
| H03 | **BLOCKED** | Không có hộp thư kiểm soát prod |

## Drift / ghi chú vận hành

- `vemoki-web-1` restart ~3 phút trước khi bắt đầu app UAT; callback vẫn **502** với lỗi Next Server Action trong log container.
- Portal auth và shell **không** bị ảnh hưởng.
- Mã redeem UAT (khi app auth sống lại): `DEMO-MFEST-001`…`010` per `docs/demo/D9-DEMO-DATASET.md` (sự kiện `mfest-demo` / `mfest`).

## P0 summary

| | pass | fail | blocked | not-run |
| --- | ---: | ---: | ---: | ---: |
| Đã chạy | 22 | 3 | 9 | 8+ |

### FAIL / BLOCKED (launch)

| ID | Verdict |
| --- | --- |
| B04 | FAIL |
| D02 | BLOCKED |
| D03 | BLOCKED |
| D04 | BLOCKED |
| D06 | FAIL |
| E01–E05, E07 | BLOCKED |
| H03 | BLOCKED |
| J04 | FAIL |

```text
Launch: NO-GO (retest 3 web 2026-10-21 @ cbabea4)
Catalog SHA: 756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f
Deploy SHA (retest 3): cbabea4ccc6447e7dc40a832ba95c81320c1b0d9
Artifact: docs/reviews/UAT-PROD-WEB-2026-10-21.md
PR: #666
```
