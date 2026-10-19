# PORTAL — Cutover prep local (P1.2 / S6)

Ngày: 2026-10-19  
Issue: [#437](https://github.com/hangndat/ticket-solution/issues/437) · Story [#436](https://github.com/hangndat/ticket-solution/issues/436) · Epic [#406](https://github.com/hangndat/ticket-solution/issues/406)  
Task ID: `T-COORD-LOCAL-CUT` · Run: `run_34fde1e32ed1`  
Architecture impact: **Có** (OIDC URI expand + dual-run giấy; theo [ADR-20](./ADR-20-PORTAL-ADMIN.md) §3 / §8)

> **Phạm vi:** chỉ loopback / stack self-host local.  
> **Cấm trong Task này:** production DNS/TLS/nginx `portal.vemoki.com`, deploy cloud, cutover switch prod, store.  
> **Không trùng D13 ops:** không sửa/nhân bản evidence PR [#397](https://github.com/hangndat/ticket-solution/pull/397) / O13 marketing↔app dual-run (`docs/reviews/O13-AUTH-DUAL-RUN-AUDIT.md`). Portal prep = surface `apps/portal` + client `ticket-admin-web` / `ticket-platform-web` trên port **3013**.

---

## 1. Prerequisite — S5 (P1.1 Audit / Platform) đã merge

Verified trên `origin/main` (ancestor check, 2026-10-19):

| Story Task | Issue | PR merge | Tip SHA (merge commit trên main) |
| --- | --- | --- | --- |
| `T-BE-AUDIT-CODES` | [#433](https://github.com/hangndat/ticket-solution/issues/433) | [#468](https://github.com/hangndat/ticket-solution/pull/468) | `f230fc703e144a732005721575be7c1f77d41a26` |
| `T-WEB-ADV` | [#435](https://github.com/hangndat/ticket-solution/issues/435) | [#469](https://github.com/hangndat/ticket-solution/pull/469) | `ef1e5b67ef9fd7180b6843395ff714792c581c23` |
| `T-BE-P-HEALTH` | [#434](https://github.com/hangndat/ticket-solution/issues/434) | [#470](https://github.com/hangndat/ticket-solution/pull/470) | `bc5bd571ab00d534b5b6ba003d40b59bde8b4d5c` |

Không đủ S5 → **không** tuyên bố sẵn sàng dual-run local portal (audit/Platform zone chưa trên main).

---

## 2. Host / port map (local dual-run)

| Process | Origin local | Client Keycloak | Callback path (code) |
| --- | --- | --- | --- |
| `apps/web` (attendee + Gate + legacy admin) | `http://127.0.0.1:3000` (hoặc `3010` trong một số compose) | `ticket-web` (+ legacy admin URIs lịch sử) | `/api/auth/callback` |
| `apps/portal` (staff AntD + `/platform`) | `http://127.0.0.1:3013` | `ticket-admin-web` | `/api/auth/callback` |
| Platform trên portal | cùng `3013` | `ticket-platform-web` | `/api/auth/platform/callback` |
| Keycloak | `http://127.0.0.1:8080/realms/ticket` | — | — |
| API | `http://127.0.0.1:3100` | — | — |

Cookie: **host-only** (không `Domain=.vemoki.com`). Logout per-surface — xem ADR-20 §3.4.

Env mẫu portal: `apps/portal/.env.example`. Manifest tên biến: [ENV-MANIFEST.md](./ENV-MANIFEST.md) §6.

---

## 3. Keycloak URI local (expand — giữ URI cũ)

Nguồn realm: `infra/keycloak/realm-ticket.json`.

### 3.1 `ticket-admin-web` (staff portal)

**Thêm** (local only trong Task này):

- Redirect: `http://127.0.0.1:3013/api/auth/callback`, `http://localhost:3013/api/auth/callback`
- webOrigin: `http://127.0.0.1:3013`, `http://localhost:3013`
- post-logout: `http://127.0.0.1:3013/auth`, `http://localhost:3013/auth`

**Giữ** URI legacy `/api/admin/auth/callback` trên `3000`/`3010`/`app.` trong cửa sổ dual-run — **không** nhân bản path `/api/admin/auth/*` trên `apps/portal` (ADR-20 §3.1).

### 3.2 `ticket-platform-web`

**Thêm** local portal path **khớp code**:

- Redirect: `http://127.0.0.1:3013/api/auth/platform/callback`, `http://localhost:3013/api/auth/platform/callback`
- webOrigin + post-logout `/auth` tương tự §3.1

Giữ URI app (`3000`/`3010`/`app.`) đến hết dual-run Platform.

### 3.3 Áp realm local

```bash
# Sau khi chỉnh realm JSON (hoặc pull PR này):
./scripts/platform-keycloak-apply-realm.sh
# Kiểm tra URI local có trong JSON (không cần Keycloak sống):
./scripts/portal-local-dual-run-check.sh
```

**OUT Task prep local:** production DNS/TLS — xem Task #502 / [`PORTAL-PROD-CUTOVER.md`](./PORTAL-PROD-CUTOVER.md).

---

## 4. Dual-run local (giấy + lệnh)

### 4.1 Mục tiêu cửa sổ dual-run

1. Staff có thể login **portal** (`3013`) với `ticket-admin-web`.
2. Legacy admin trên `apps/web` **vẫn phục vụ** (flag redirect app→portal mặc định **OFF** — Task web [#438](https://github.com/hangndat/ticket-solution/issues/438)).
3. Gate / attendee trên `app.` / `:3000` **không** bị kéo sang portal (`GATE-STAY-APP`).
4. Không redirect POST/PUT/PATCH/BFF mù (chỉ GET/HEAD navigation khi flag ON).

### 4.2 Khởi động tối thiểu

```bash
pnpm infra:up
cp apps/portal/.env.example apps/portal/.env   # điền secret local; không commit
# API + worker theo stack team (port 3100)
pnpm --filter @ticket/web dev                  # :3000
pnpm --filter @ticket/portal dev               # :3013
./scripts/portal-local-dual-run-check.sh --live  # optional: HTTP probe loopback
```

### 4.3 Smoke checklist (local)

| # | Case | Pass khi |
| --- | --- | --- |
| L1 | Portal login | Redirect IdP → `3013/api/auth/callback`; cookie host-only |
| L2 | Platform login | `platform_oidc_*` + ACR; không lẫn staff token |
| L3 | Legacy admin | `:3000/admin` vẫn mở khi flag OFF |
| L4 | Gate | `:3000/gate` không 302 portal |
| L5 | CSRF | Origin `:3000` mutate portal BFF → 403 |
| L6 | Open redirect | `return=https://evil` / `//evil` reject |

Headless UAT milestone: Task `T-UAT-PORTAL` / `scripts/web-uat.sh` — **không** thay checklist giấy này; không Computer Use headed.

---

## 5. Rollback trên giấy (local + prod sau này)

Thứ tự **bắt buộc** khi abort (ADR-20 §8):

1. **Tắt** flag redirect `app./admin` → portal (GET navigation) **trước**.
2. Không tạo loop portal↔app.
3. Giữ callback/legacy URI trên Keycloak (dual-run expand chưa contract).
4. Clear cookie đúng host; **cấm** “fix” bằng `Domain=.vemoki.com`.
5. Portal process down → staff dùng lại legacy admin trên `apps/web` nếu còn.

Prod DNS/nginx rollback chỉ áp dụng khi có Task deploy — ngoài phạm vi file này ngoài bảng tham chiếu:

| Trigger (prod — Task riêng) | Hành động giấy |
| --- | --- |
| Login/callback portal fail | Tắt flag; nginx portal → legacy admin nếu đã switch |
| Cookie regress | Không bao giờ parent-domain cookie |

---

## 6. Ranh giới với D13 / O13

| Chủ đề | Tài liệu | Portal P1.2 |
| --- | --- | --- |
| Marketing `vemoki.com` ↔ `app.vemoki.com` | PR #397, `O13-AUTH-DUAL-RUN-AUDIT.md` | **Không** sửa |
| Staff admin → `portal` local | ADR-20 + **file này** | **Có** |
| App Store / ASC / submit | D13 plans | **Không** |

---

## 7. Evidence / DoD cho Task #437

- [x] S5 BE/web merge đủ (§1)
- [x] Realm local URI portal `3013` trên `ticket-admin-web` + `ticket-platform-web`
- [x] Runbook dual-run + rollback giấy (file này)
- [ ] PR docs + CI; reviewer độc lập exact tip SHA
- [ ] **Không** DNS/TLS/deploy prod trong PR

Script kiểm tra: [`scripts/portal-local-dual-run-check.sh`](../../scripts/portal-local-dual-run-check.sh).
