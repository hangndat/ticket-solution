# DoD Review — PR #397 (O13 dual-run Keycloak / compose auth audit)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca `reviewer-dod` (Cursor), terminal `term_b63b2dfa-5495-442b-b578-698728d7d1f3`, task `task_b18e24ca5705`, dispatch `ctx_d63997da4a9e` — độc lập ≠ implementer |
| Scope | PR [#397](https://github.com/hangndat/ticket-solution/pull/397) · branch `hangndat/d13-bug-ops-o13-audit` → `main` · ownership coordinator/ops (+ web env example/tests) |
| Architecture impact | Có — đối chiếu handoff O13 (`docs/architecture/o13-marketing-app-subdomain.md`) với realm/compose/docs; **không** đổi IdP provider |
| Decision IDs | O13 (marketing/app subdomain dual-run) |
| Commit SHA (exact tip) | `d16ab4272ef77128b2efe6fe9a9ef75e5de7e4fa` |
| Parent fix commit | `b71a3f3431753486ff42a095b03facb57e63d30e` (`fix(ops): O13 dual-run Keycloak/compose origin drift`) |
| Implementer audit | `docs/reviews/O13-AUTH-DUAL-RUN-AUDIT.md` (Artifact SHA field = fix commit `b71a3f…`) |

## Paths in review

- `infra/keycloak/realm-ticket.json`
- `infra/deploy/compose.yaml`
- `infra/deploy/.env.example`
- `infra/deploy/README.md`
- `docs/ops/ENV-MANIFEST.md`
- `docs/reviews/O13-AUTH-DUAL-RUN-AUDIT.md`
- `apps/web/.env.example`
- `apps/web/tests/platform-shape.test.ts`

## Acceptance vs evidence

| # | AC / claim | Evidence trên tip `d16ab427…` | Kết quả |
| - | ---------- | ----------------------------- | ------- |
| 1 | Repo realm dual-run: `app.` + apex redirect/webOrigins; `post.logout.redirect.uris` cho web/admin/platform | Parsed `realm-ticket.json` at tip: cả ba client có `https://app.vemoki.com` + apex; `post.logout` gồm `https://app.vemoki.com/auth` | PASS |
| 2 | Platform callback path code `/api/auth/platform/callback` (+ legacy giữ dual-run) | `ticket-platform-web` redirectUris gồm code path + legacy (`/api/platform/auth/callback`) apex + `app.` | PASS |
| 3 | Compose defaults product host `app.`; map `WEB_PUBLIC_ORIGIN` + `PLATFORM_OIDC_*` | Diff compose: `OIDC_REDIRECT_URI`/`PUBLIC_WEB_*` → `app.`; thêm `WEB_PUBLIC_ORIGIN`, `PRODUCT_ORIGIN`/`MARKETING_*`, `PLATFORM_OIDC_CLIENT_ID` default `ticket-platform-web` + secret/audience/acr/redirect | PASS |
| 4 | ClientId docs/tests khớp realm `ticket-platform-web` (không `ticket-platform`) | `.env.example` + `platform-shape.test.ts` dùng `ticket-platform-web`; fail-closed `isPlatformOidcConfigured` vẫn yêu cầu đủ PLATFORM_* | PASS |
| 5 | Live logout `app./auth` không còn Invalid redirect uri | Independent probe (GET): KC logout `post_logout_redirect_uri=https://app.vemoki.com/auth` → **302** `Location: https://app.vemoki.com/auth`; BFF `https://app.vemoki.com/api/auth/logout` → **307** tới KC end-session với cùng URI; apex `/auth` → **302** `app.` | PASS |
| 6 | CI xanh trên exact tip | Actions run `39132603194`, `headSha=d16ab4272ef77128b2efe6fe9a9ef75e5de7e4fa`, conclusion **success** (`changes`/`web`/`ci`/`d5-*`/`turbo-persist`; backend/mobile/database-isolation skipped — đúng path filter) | PASS |

## Checks (reviewer)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse` / `gh pr view 397` tip | `d16ab4272ef77128b2efe6fe9a9ef75e5de7e4fa` |
| `gh pr diff 397` path set | 8 files — khớp scope ops/docs/web examples (không BE/iOS feature) |
| Static realm + compose + oidc fail-closed | PASS (xem trên) |
| Live curl (no secrets) | PASS — GET logout 302; HEAD-only tới KC logout trả 405 (không dùng làm evidence) |
| CI run `39132603194` | success trên exact SHA |
| Local `tsx` platform-shape | Không chạy trong worktree reviewer (không dựa local unit); dựa CI `web` + đọc source tip |
| code-review-graph `detect_changes` | Graph workspace stale / path noise (SideProject index); **không** dùng blast-radius BE/mobile làm finding — review neo diff PR + source tip |

## Findings

### Blocker

Không có.

### Known gaps (chấp nhận — không nuốt AC logout/template sync)

Trùng residual có chủ đích trong `O13-AUTH-DUAL-RUN-AUDIT.md` §4:

1. **Contract phase chưa gỡ apex** khỏi Keycloak product clients — đúng dual-run; Phase 3 sau ổn định.
2. **Legacy platform callback** `/api/platform/auth/callback` còn allowlist — dual-run an toàn; gỡ khi hết consumer.
3. **Admin callback route** `app./api/admin/auth/callback` có trên KC; mirror route app có thể chưa ship đầy đủ — ngoài AC logout/compose drift của PR này.
4. **Platform logout** không gọi IdP end-session (chỉ clear cookie) — residual hành vi cũ; attendee logout đã OK.
5. **Live VPS compose** đã patch tay `PLATFORM_OIDC_*` — merge/redeploy PR này để git template khớp host (ghi trong audit).
6. **`PLATFORM_OIDC_CLIENT_SECRET`** compose default rỗng → fail-closed nếu thiếu host `.env` — đúng thiết kế; không phải regression.

### Nit / should-fix (không FAIL)

- PR body vẫn ghi tip cũ `b49225ad…` (pre-rebase); tip thật = `d16ab427…` — cập nhật body khi tiện.
- `PUBLIC_WEB_ORIGIN` alias + `WEB_PUBLIC_ORIGIN` canonical: code đọc `WEB_PUBLIC_ORIGIN` (`apps/web/src/bff/csrf.ts`, `oidc/public-origin.ts`) — compose đã set cả hai; OK.

## Verdict

**PASS with known gap**

Repo templates (realm/compose/ENV/docs/web examples) đã khớp cutover O13 dual-run trên exact SHA `d16ab4272ef77128b2efe6fe9a9ef75e5de7e4fa`; CI xanh; live attendee logout → `app./auth` 302 confirmed. Gaps § residual dual-run / platform-end-session / admin route là follow-up có chủ đích, không làm hỏng AC của PR này.

**Không merge** trong phiên reviewer — coordinator merge khi được ủy quyền integration.
