# DoD (+ security notes) — PR #462 GET /platform/tenants (H-P1 #432)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` (+ security checklist inline) · terminal `term_33220ce4-ed6a-4ac2-bc09-159c458f7503` · task `task_3b2e10183a7f` · dispatch `ctx_fa7508923564` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_2a051cbda196` |
| Scope | PR [#462](https://github.com/hangndat/ticket-solution/pull/462) · Issue [#432](https://github.com/hangndat/ticket-solution/issues/432) · Story [#430](https://github.com/hangndat/ticket-solution/issues/430) · Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · Task `T-BE-PLATFORM-LIST` · paths `apps/api`, `packages/backend` (+ OpenAPI/tests) |
| Commit SHA | `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb` (confirmed `git rev-parse HEAD` == tip PR) |
| Architecture | **Có** — ADR-20 platform zone (`PLATFORM-PORTAL-ZONE`) · handoff [`docs/architecture/PORTAL-CONTRACT-HANDOFF.md`](../architecture/PORTAL-CONTRACT-HANDOFF.md) §5.3 H-P1 · Decision IDs: **ADR-20** · H-P1 |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |
| Verdict security | **PASS** |

## Comment nghiệm thu (VI)

Đã đối chiếu exact SHA `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb` trên PR #462 / Issue #432: `GET /v1/platform/tenants?cursor&limit` đi qua `platformActor` (OIDC audience platform + MFA ACR/`auth_time`), `requireActivePlatformOperator`, và `withPlatformRole` (`ticket_platform_runtime`); unit test khẳng định không dùng `identityVerifier` (attendee/staff). Projection khớp `PortalPlatformTenantSummary`; CI backend + database-isolation (gồm `platform.test.cjs`) xanh trên SHA. Gap đã biết: cursor sai → `INVALID_INPUT` (chưa có `INVALID_CURSOR` trong platform codes). Reviewer **không** merge.

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb` |
| Diff scope vs `main` | 7 files / +375 −0 — chỉ BE (`apps/api`, `packages/backend`) — đúng ownership |
| CI run [39142851475](https://github.com/hangndat/ticket-solution/actions/runs/39142851475) `headSha` = tip | **SUCCESS** — `changes`, `backend`, 10× `database-isolation` (shard **account-deletion** gồm `test/platform.test.cjs`), `ci`, `turbo-persist`; web/portal/mobile/d5-* SKIPPED (path filter) |
| Local unit/DB tests | **Không chạy lại** — worktree thiếu `node_modules` / `tsc` `moduleResolution=node10`; dựa CI isolation + unit trên cùng SHA |
| Graph review | CRG MCP workspace lệch SHA khác; dùng `git diff main...HEAD` + lean-ctx source (`listPlatformTenants`, `platformActor`, `createPlatformOidcVerifier`, RLS policy) |
| OpenAPI | `GET /v1/platform/tenants` + query `cursor`/`limit` optional + `PortalPlatformTenantsPageDto` + bearer security |

## Acceptance mapping (H-P1 / #432)

| AC | Verdict | Evidence |
| --- | --- | --- |
| `GET /v1/platform/tenants?cursor&limit` | **PASS** | `PlatformController.listTenants` → `PlatformService.listTenants` → `listPlatformTenants`; OpenAPI regen |
| Operator + MFA platform audience | **PASS** | `platformActor` chỉ gọi `platformVerifier.verifyBearerToken` (issuer + `platformAudience` + MFA ACR + fresh `auth_time`); không `selfActor` / `identityVerifier` |
| Không attendee audience | **PASS** | Unit `listTenants keeps platform MFA verifier (does not use identityVerifier)` — MFA_REQUIRED từ platform path, `used === 'platform'` |
| Cursor pagination + limit bounds | **PASS** | `parseTenantListLimit` neo `CURSOR_PAGE_LIMIT`; cursor = last `tenantId` uuid, `ORDER BY id ASC`, `limit+1` / `nextCursor`; DB test page1/page2 |
| Deny non-operator | **PASS** | Isolation test stranger → `PLATFORM_OPERATOR_REQUIRED`; `requireActivePlatformOperator` trước SELECT |
| Projection privacy (H-P1 contract) | **PASS** | Items chỉ `tenantId/slug/name/status/version/createdAt` — khớp handoff §5.3 / `PortalPlatformTenantSummary`; không limits/flags/PII sâu |
| RLS / platform role | **PASS** | `withPlatformRole` → `SET LOCAL ROLE ticket_platform_runtime`; policy `tenants_platform_meta` + GRANT SELECT metadata (M01); platform **không** grant tickets/users PII |
| `platform.tenants.list` capability | **PASS** | `getPlatformMe.permittedCommands` thêm `platform.tenants.list`; asserted in DB test |
| CI xanh exact SHA | **PASS** | Run 39142851475 |

## Security notes (operator + MFA platform)

Abuse / fail-closed đã xét trong scope:

1. **Attendee/staff token trên `/platform/tenants`** — route dùng `platformActor` + platform verifier (audience + ACR MFA). Attendee audience không thỏa → UNAUTHENTICATED/MFA_REQUIRED. Unit chứng minh không fallback `identityVerifier`. **OK.**
2. **Authenticated non-operator** — sau MFA vẫn `requireActivePlatformOperator` → 403 `PLATFORM_OPERATOR_REQUIRED`. Isolation test. **OK.**
3. **Cross-tenant / metadata blast** — list toàn bộ tenant metadata là intentional platform capability; RLS platform `USING (true)` trên `tenants` đã có từ M01; SELECT chỉ cột metadata. **OK** (khớp ADR-20 platform zone).
4. **Cursor injection** — cursor bind `${cursor}::uuid` + UUID_RE; non-uuid → reject trước query. **OK.**
5. **Limit abuse** — clamp `CURSOR_PAGE_LIMIT` min/max/default. **OK.**
6. **Privilege via wrong role** — transaction luôn `ticket_platform_runtime` (NOBYPASSRLS); không dùng `ticket_runtime` cho list. **OK.**

Không thấy blocker security trên SHA này.

## Architecture đối chiếu (ADR-20 / H-P1)

| Quyết định | Impl trên SHA |
| --- | --- |
| `PLATFORM-PORTAL-ZONE` — Operator + MFA / audience tách | Nest `/v1/platform/*` + `createPlatformOidcVerifier` (audience + ACR) |
| H-P1 list metadata only | `PortalPlatformTenantSummary` fields only |
| Platform runtime metadata pool | `withPlatformRole` + existing `tenants_platform_meta` |
| Tenant Owner ≠ Operator | Non-operator deny tested |

Không cần Architect gate riêng để merge: không thấy design drift so với ADR-20 / handoff §5.3 H-P1.

## Findings

### Known gap (không chặn AC H-P1 / security)

1. **Invalid cursor → `INVALID_INPUT`** — PR body ghi đúng; contract comment `PortalCursorQuery` nhắc `INVALID_CURSOR` nhưng platform error codes chưa có mã đó. Hành vi fail-closed vẫn đúng; nên align mã lỗi khi platform codes mở rộng.

### Nit

- `PlatformService.listTenants` parse `limit` bằng `Number(query.limit)` rồi `Number.isFinite` — chuỗi rác → `undefined` → default; ổn, nhưng có thể document trong OpenAPI.

### Blocker

Không.

## Limitations

- Reviewer **không** merge / không deploy / không DNS.
- Không UAT portal UI (ngoài scope BE).
- Local runtime tests không chạy trong worktree này (thiếu deps); CI trên exact SHA là evidence chính.
- Artifact docs có thể commit **sau** code SHA đang duyệt (docs-only); verdict gắn **code SHA** `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb`.

## Merge note

Coordinator **có thể merge** sau khi chấp nhận known gap `INVALID_CURSOR` naming. Reviewer **không** merge.
