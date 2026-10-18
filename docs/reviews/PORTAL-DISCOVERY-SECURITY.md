# Portal discovery — Security threat model (`portal.vemoki.com`)

| Trường | Giá trị |
| --- | --- |
| Role | `reviewer-security` · [`docs/agents/roles/reviewer-security.md`](../agents/roles/reviewer-security.md) |
| Run / Task / Dispatch | `run_df32d5572a2d` · `task_44cb95476884` · `ctx_d452d6a7e07e` (fix-pass; artifact gốc `task_22d2801bd986`) |
| Ngày (UTC) | 2026-10-18 · research gốc ~13:09Z · **hiệu chỉnh** ~13:12Z |
| Baseline SHA (đối chiếu source; không audit mới) | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Architecture impact | **Có** — subdomain / session / UI migration (Gate/platform boundary **chưa** chốt quyền chuyển) |
| Phạm vi sửa | **Chỉ** file này (docs-only; không code / commit / deploy / DNS) |
| Độc lập | Session ≠ BA/PD/web/architect authors; **không** claim PASS runtime / DoD implementation |

> **Verdict:** **DISCOVERY ONLY — không phải security acceptance / implementation approval.**  
> Product **đã confirmed** yêu cầu `portal.vemoki.com` + UI Ant Design (antd); ADR options, coding, DNS/deploy vẫn **chưa** được ủy quyền. Không PASS/FAIL implement. Không kết luận exploit đã xác nhận nếu thiếu proof runtime.

**Hiệu chỉnh coordinator (fix-pass):** không audit source mới — chỉ chỉnh wording threat model / acceptance / citation theo mailbox.

---

## 1. Scope / non-goals

### Trong scope

- Threat model **host separation** cho product confirmed: marketing `vemoki.com`, attendee `app.vemoki.com`, staff admin `portal.vemoki.com` (+ antd khi implementation được approve).
- Đối chiếu **read-only** (baseline đã đọc): cookies/OIDC/BFF/CSRF/RBAC/platform support-grant, logout semantics, origin allowlist, export/upload/XSS, token/nav cache.
- Phân loại: **bắt buộc theo policy/source hiện hành** vs **defense-in-depth / proposal cần contract**.
- Security test acceptance + gợi ý reauth/MFA / destructive cho roadmap.

### Ngoài scope (không tự mở)

- Android / payment / refund / transfer / seat / Wallet / **enterprise SSO** / billing / custom-domain.
- Code antd, cài package, spawn worker, sửa GitHub/Project, deploy/DNS.
- Đụng WT user/Run khác: `apps/mobile/*`, `infra/deploy/*`, `infra/keycloak/realm-ticket.json`.
- Sửa file BA/PD/architect khác (chỉ đọc nhanh thẩm định).

### Limitation evidence

| Mục | Chi tiết |
| --- | --- |
| Working tree dirty | Diff ngoài baseline: mobile README/`app.config.ts`; deploy env/compose/README; realm Keycloak thêm `app.vemoki.com` (chưa `portal.` trong diff đã đọc trước đó). |
| CRG | Graph có sẵn session trước; semantic embeddings thiếu → lean-ctx/`rg` + source. Fix-pass **không** rebuild/audit lại. |
| Runtime | **Không** chạy Keycloak/OIDC live, UAT CSRF, hay chứng minh cookie browser. |
| BA/PD (cập nhật) | Đã có reports: [`PORTAL-PRODUCT-RESEARCH.md`](../plans/PORTAL-PRODUCT-RESEARCH.md), [`PORTAL-ANTD-UX.md`](../design/PORTAL-ANTD-UX.md), [`PORTAL-EPIC-TASKS.md`](../plans/PORTAL-EPIC-TASKS.md), [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md), [`PORTAL-RESEARCH-RUN.md`](../plans/PORTAL-RESEARCH-RUN.md). Đọc nhanh thẩm định — **không** edit. Khớp sơ bộ: portal+antd confirmed; Gate G1 giữ `app.`; Platform P1 ngoài portal (PD). |

---

## 2. Ba lớp session (bắt buộc phân biệt)

| Lớp | Nghĩa | Phạm vi Vemoki | Ngoài scope |
| --- | --- | --- | --- |
| **A. Keycloak IdP SSO** | Browser SSO session tại `auth.vemoki.com` sau login OIDC | Đã dùng (self-host Keycloak) | — |
| **B. BFF app sessions** | Cookie host-only per host (`oidc_*`, `platform_oidc_*`, CSRF) trên Next BFF | Độc lập theo host vì **omit Domain** | Không = “một cookie dùng chung subdomain” |
| **C. Enterprise SSO** | IdP khách hàng (SAML/OIDC federation org) | **Chưa tự mở** | Task cấm mở |

Logout phải thiết kế **semantics tường minh** (per-surface BFF vs end IdP SSO) — xem §3.3 / §6. Host-only cookie **không** cho phép một response từ host A xóa cookie host B trực tiếp.

---

## 3. Baseline hiện tại (source @ `400ad87` — không re-audit)

### 3.1 Host model

| Host | Vai trò | Trạng thái |
| --- | --- | --- |
| `vemoki.com` (+ www) | Marketing | O13 ADR đã chốt hướng |
| `app.vemoki.com` | Product attendee + admin/platform/gate hiện tại | O13 + `PRODUCT_PATH_PREFIXES` (`hosts.ts`) |
| `portal.vemoki.com` | Staff admin + antd | **Product confirmed**; ADR/implement **chưa** approve |
| `auth.` / `api.` | IdP / Nest | Giữ |

Admin hiện cùng origin product (`/admin`); soft-redirect anonymous (`proxy.ts`; `staff-route-guard.ts`).

### 3.2 Controls đang có (tóm tắt evidence cũ)

| Control | Evidence | Class |
| --- | --- | --- |
| Host-only session (omit `domain`) | `apps/web/src/oidc/cookies.ts` L14–21; `scripts/lib/tenant-host.mjs` L97–120; ENV-MANIFEST §5 | **Bắt buộc** giữ |
| Origin fail-closed trên mutating BFF | `apps/web/src/bff/origin.ts` L19–27 | **Bắt buộc** giữ / mở rộng đúng origin portal |
| `WEB_PUBLIC_ORIGIN` allowlist | `csrf.ts` / `public-origin.ts` | **Bắt buộc** cập nhật khi portal ship |
| Double-submit (`vemoki_csrf` + header) | `csrf.ts` L82–95 — **một phần** route | **DiD hiện có**; không đồng nhất toàn admin |
| Platform cookies / MFA ACR + `auth_time` | `platform/oidc.ts`; `packages/backend/src/platform-oidc.ts` | Platform invariant |
| Support grant `cs.read` + audit | `support-grant.ts` | Giữ |
| Nav fail-closed / no sticky | `nav-capabilities-store.ts` | Giữ khi antd |
| BFF `no-store` | `bff/upstream.ts` | Giữ |
| XSS text-only / URL sanitize | `config-renderer.tsx`; media sanitize | Giữ + CSP khi antd |

### 3.3 Logout baseline (quan sát — chưa kết luận bug single-host)

| Surface | Hành vi | Evidence |
| --- | --- | --- |
| Tenant `/api/auth/logout` | Clear `oidc_*` **trên host hiện tại** + redirect Keycloak end-session + `post_logout_redirect_uri` | `app/api/auth/logout/route.ts` |
| Platform `/api/auth/platform/logout` | Clear `platform_oidc_*` local; **không** gọi end-session IdP trong route này | `app/api/auth/platform/logout/route.ts` |
| Host-only | Response chỉ clear cookie của host đang phục vụ | Hệ quả thiết kế, không phải “bug xóa cross-host” |

**Realm drift (config risk, không exploit):** `ticket-admin-web` → `/api/admin/auth/callback` nhưng không có `apps/web/app/api/admin/**` trên baseline; platform code path `/api/auth/platform/callback` vs realm path cũ.

---

## 4. Threat model — `portal.vemoki.com` (+ antd)

### 4.1 Assets

1. Tenant staff BFF session + membership JWT (qua Bearer upstream).
2. Platform operator session (MFA) + support-grant.
3. PII export / invites / uploads.
4. Destructive: publish/rollback, cancel/archive, revoke, tenant status/limits.
5. Keycloak IdP SSO session (lớp A).

### 4.2 Trust boundaries (đề xuất — khớp BA/PD đọc nhanh; architect chốt)

```text
vemoki.com          marketing (không product BFF session)
app.vemoki.com      attendee + Gate (khuyến nghị G1) + optional surfaces
portal.vemoki.com   Tenant Admin + antd (product confirmed)
auth.vemoki.com     Keycloak IdP SSO
api.vemoki.com      Nest Bearer + RLS
```

**Không mặc định chuyển quyền:** Gate / Platform — PD sketch G1 Gate giữ `app.`, P1 Platform ngoài portal; security không tự authorize.

### 4.3 Abuse cases

| ID | Abuse | Mitigation |
| --- | --- | --- |
| T1 | `Domain=.vemoki.com` share cookie | **Bắt buộc:** omit Domain; `assertHostOnlyCookie` |
| T2 | CSRF sibling subdomain (SameSite same-site trên eTLD+1) | **Bắt buộc:** Origin fail-closed + allowlist đúng portal origin. Double-submit toàn bộ = **DiD mạnh / proposal** (§5 F3) — không tự = exploit |
| T3 | Redirect URI wildcard / lệch path | **Bắt buộc:** exact portal callback URIs; cấm `*` prod ([Keycloak securing-apps](https://www.keycloak.org/securing-apps/oidc-layers); [RHBK clients](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.4/html/server_administration_guide/assembly-managing-clients_server_administration_guide)) |
| T4 | Logout semantics mơ hồ (BFF vs IdP) | **Bắt buộc:** thiết kế + test **ma trận** (§6) — per-surface clear vs RP-initiated IdP logout; **không** yêu cầu mọi logout xóa mọi host cookie |
| T5 | XSS antd / CDN | **Bắt buộc** khi ship UI: CSP; không HTML thô user content; prefer bundled npm |
| T6 | Allowlist Origin quá rộng lâu dài | **Bắt buộc:** tối thiểu theo surface; dual-run rồi gỡ |
| T7 | Gộp attendee↔admin session | Nếu tách host: session/client tách hoặc cookie name tách; API deny-by-default vẫn **bắt buộc** |
| T8 | Support-grant / export | Giữ `cs.read`+TTL+audit; step-up export = **DiD** |
| T9 | Tenant switch UI-only | API RLS/membership **bắt buộc** |
| T10 | Sticky nav sau revoke | Giữ fail-closed store |

---

## 5. Findings (giữ từ audit gốc; chỉnh class)

### F1 — Host-only khớp policy (positive) → **bắt buộc** giữ

### F2 — SameSite=Lax không đủ thay Origin/CSRF khi thêm subdomain → **bắt buộc** Origin fail-closed (đã có)

OWASP CSRF: SameSite scoped registrable domain — sibling subdomain vẫn same-site. Không suy “chỉ SameSite”.

### F3 — CSRF admin Origin-only vs double-submit không đồng nhất → **DiD / contract proposal**

- Một phần route: `assertMutatingBrowserAsync`; nhiều admin route: chỉ `assertSameOrigin`.
- **Mandatory theo policy hiện hành:** Origin fail-closed (+ JSON content-type nơi đã enforce) trên mutating cookie BFF.
- **Double-submit toàn bộ portal BFF:** đề xuất hardening mạnh — cần **contract/security thống nhất** với web/architect; **không** kết luận exploit; **không** tuyên bố “bắt buộc từ policy repo” nếu chưa dẫn ADR/rule.
- Không confirmed CSRF exploit (thiếu POC).

### F4 — Logout đa host → **thiết kế bắt buộc**, không “clear-all-hosts bắt buộc”

- Host-only ⇒ một response **không** xóa cross-host cookie.
- Cần product/security chọn semantics: (1) **per-surface** — chỉ clear BFF cookies host hiện tại; IdP SSO có thể còn; (2) **toàn phiên IdP** — RP-initiated logout Keycloak (+ front/back-channel theo client); surface khác mất quyền khi token/SSO hết hoặc khi chúng tự phát hiện logout.
- Platform logout hiện chỉ clear cookie local — ghi nhận khác tenant logout; có thể **cố ý** per-surface — cần ma trận test, không tự gọi là bug.

### F5 — Realm/path drift → config **bắt buộc** trước enable portal

### F6 — Soft UI ≠ API authz → invariant

### F7 — Support grant + export → grant **bắt buộc**; step-up export **DiD**

### F8 — antd chưa trong source → rủi ro design khi implementation (CSP/SRI)

---

## 6. Logout matrix (acceptance thiết kế — bắt buộc có; nội dung chọn)

Phải **viết rõ + test** từng hàng trước cutover. Không mặc định “logout = xóa mọi cookie mọi host”.

| Hành động UI | Clear BFF cookie host nào? | Gọi Keycloak RP-initiated logout? | Kỳ vọng surface khác | Ghi chú |
| --- | --- | --- | --- | --- |
| Logout trên **portal** (per-surface) | Chỉ `portal.vemoki.com` cookies | Không | `app.` có thể vẫn có BFF session nếu còn | Hợp lệ nếu UX ghi “chỉ thoát portal” |
| Logout trên **portal** (end IdP SSO) | Portal cookies | Có (`post_logout_redirect_uri` ∈ Valid Post Logout Redirect URIs) | `app.` BFF có thể còn cookie cho đến khi hết hạn / refresh fail / front-channel logout | Host-only: không tự xóa `app.` cookie; test hành vi thực |
| Logout trên **app** (tenant) | `app.` `oidc_*` | Hiện code: có end-session | Portal độc lập nếu đã login riêng | |
| Logout **platform** | `platform_oidc_*` trên host đặt cookie | Hiện: không | Tenant `oidc_*` có thể còn | Per-surface vs IdP — chốt |
| Marketing | Không có product session | N/A | N/A | |

Tham chiếu: [RHBK 26.4 SSO protocols — RP-Initiated Logout](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.4/html/server_administration_guide/sso_protocols); [RHBK 26.6 Migration — Valid Post Logout Redirect URIs](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.6/html/migration_guide/migrating-applications); [Keycloak securing-apps redirect URIs](https://www.keycloak.org/securing-apps/oidc-layers).

---

## 7. Security acceptance (khi có implementation approval — chưa chạy)

### 7.1 Bắt buộc

1. Cookie portal: omit `Domain`; Secure + HttpOnly; regression `assertHostOnlyCookie`.
2. Origin fail-closed + `WEB_PUBLIC_ORIGIN` gồm portal (gỡ origin thừa sau dual-run).
3. Keycloak: exact redirect + webOrigins + Valid Post Logout Redirect URIs cho portal; không `*` prod.
4. **Logout matrix §6** documented + tested (per-surface và/hoặc IdP — theo quyết định đã chốt).
5. API authz/RLS/membership không đổi; antd chỉ chrome.
6. Support-grant chỉ `cs.read` + audit.
7. Không secrets / không EAS Cloud.

### 7.2 Defense-in-depth / proposal (cần contract)

1. Thống nhất double-submit trên mọi mutating portal BFF (không tuyên bố mandatory policy hiện hành).
2. Step-up/`auth_time` trước export download, revoke, cancel, rollback/publish, tenant status.
3. `__Host-` cookie prefix; CSP chặt cho antd; SameSite=`Strict` cho CSRF cookie nếu UX cho phép.

### 7.3 Security tests (checklist)

| Test | Kỳ vọng |
| --- | --- |
| Set-Cookie portal | Không `Domain=` parent |
| Mutating BFF Origin marketing → portal | 403 (Origin fail-closed) |
| Login redirect URI host giả | Keycloak reject |
| Logout per-surface | Chỉ cookie host đó mất; IdP SSO còn nếu không end-session |
| Logout end-IdP | SSO kết thúc; hành vi surface khác khớp matrix (không giả định cross-host Set-Cookie delete) |
| Membership revoke | Nav + API fail-closed |
| Support grant hết hạn | 403 + audit |
| Export | CSV; cần session; no public cache |
| Platform thiếu ACR | `MFA_REQUIRED` |
| Double-submit (nếu contract chốt) | Thiếu header → 403 |

---

## 8. Sensitive workflows — reauth / MFA

| Workflow | Hiện tại | Roadmap |
| --- | --- | --- |
| Platform API | ACR + `auth_time` | **Bắt buộc** giữ |
| Tenant admin mutations | OIDC + membership | Step-up destructive = **khuyến nghị** |
| Support grant | Operator + `cs.read` | Giữ |
| PII export download | Session | Step-up = **DiD** |
| Gate | Origin-only BFF trên app | Không hạ; không mặc định chuyển portal |

Destructive đề xuất gắn reauth/ACR: publish/rollback, cancel/archive, revoke membership, tenant suspend, support-grant create, export download.

---

## 9. Research chính thức (URL trực tiếp + ngày truy cập UTC 2026-10-18)

| Nguồn | URL |
| --- | --- |
| OWASP Session Management — Domain/SameSite | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| OWASP CSRF Prevention — SameSite limitations | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet |
| OWASP WSTG Cookie Attributes | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management/02-Cookies_Attributes |
| MDN Secure cookies | https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies |
| MDN Set-Cookie | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie |
| Next.js `cookies()` | https://nextjs.org/docs/app/api-reference/functions/cookies |
| Keycloak — Redirect URIs (securing apps) | https://www.keycloak.org/securing-apps/oidc-layers |
| RHBK 26.4 — Managing OIDC clients (Valid Redirect URIs / Web Origins) | https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.4/html/server_administration_guide/assembly-managing-clients_server_administration_guide |
| RHBK 26.4 — SSO protocols (RP-Initiated Logout) | https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.4/html/server_administration_guide/sso_protocols |
| RHBK 26.6 — Migration guide (Valid Post Logout Redirect URIs) | https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.6/html/migration_guide/migrating-applications |

Repo: O07/O13 DECISION-LOG, ENV-MANIFEST §5, `o13-marketing-app-subdomain.md`, role `reviewer-security`.

---

## 10. Kết luận ngắn cho coordinator

1. **Confirmed product:** `portal.vemoki.com` + antd; **chưa** implementation approval. Baseline host-only + Origin fail-closed + MFA platform + support-grant hẹp vẫn là nền đúng.
2. **Fix-pass:** logout = ma trận per-surface vs IdP (host-only không xóa cross-host); CSRF mandatory = Origin fail-closed hiện có; double-submit toàn bộ = DiD/proposal cần contract — không exploit/policy bắt buộc tự suy.
3. **Còn lại:** architect chốt ADR Gate/Platform/cookie packaging; security acceptance §7 khi có SHA implement — artifact **không** PASS runtime.

---

## 11. Independence

- Author: `reviewer-security` / dispatch `ctx_d452d6a7e07e` (fix-pass trên artifact discovery).
- Không sửa code; không edit BA/PD; không merge; không Project Hoàn thành.
- Revalidation: commit hành vi portal sau này → security review exact SHA mới.
