# DoD + Security review — PR #588 / Issues #581 #583 #584 #585 (Portal Pro)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | James · `reviewer-dod` + `reviewer-security` · Persona James · `task_f2fc68b3b084` / `ctx_b7e952dc0e64` |
| Implementer (≠ reviewer) | Higo (portal Pro wave) |
| Scope | [#581](https://github.com/hangndat/ticket-solution/issues/581) epic · [#583](https://github.com/hangndat/ticket-solution/issues/583) openKeys · [#584](https://github.com/hangndat/ticket-solution/issues/584) locale VI · [#585](https://github.com/hangndat/ticket-solution/issues/585) handoff/UAT · PR [#588](https://github.com/hangndat/ticket-solution/pull/588) |
| Paths (declared) | `apps/portal`, `pnpm-lock.yaml`, docs ADR/handoff/UAT |
| Paths (actual diff vs `main`) | Above + `packages/contracts`, `packages/backend`, `apps/api` (MPR platform catalog commits merged on branch; **no** `apps/web` / `apps/mobile` diff) |
| Commit SHA | `d926669636746f62c599d03c14de3ac28d07bb50` (`git rev-parse HEAD` on review worktree @ SHA) |
| Architecture | **Có** — [`ADR-PORTAL-PRO-COMPONENTS.md`](../architecture/ADR-PORTAL-PRO-COMPONENTS.md); BE slice cross-ref [`MPR-PR586-REVIEW-2026-10-20.md`](./MPR-PR586-REVIEW-2026-10-20.md) @ `a037410` |
| Verdict (DoD) | **PASS with known gap** |
| Verdict (security) | **PASS** |

## Acceptance (#583 — ProLayout `openKeys`)

| Tiêu chí | Kết quả |
| --- | --- |
| Nhóm menu chứa `pathname` được mở | **PASS** — `resolvePortalMenuKeys` trả `openKeys: [groupKey]`; `portal-pro-layout.tsx` merge `pathOpenKeys` vào `openKeys` (Set) nên route-active group luôn expanded. |
| `onOpenChange` không đóng nhóm active sai | **PASS** — `onOpenChange` chỉ cập nhật `userOpenKeys`; `pathOpenKeys` vẫn re-merge mỗi render. Unit: `tests/portal-menu-keys.test.ts`. |
| Runtime evidence | **PASS (prior UAT)** — [`PORTAL-PRO-FIX-LOCAL-UAT-2026-10-20.md`](./PORTAL-PRO-FIX-LOCAL-UAT-2026-10-20.md) cases 1–2 @ `c3adcbd` (ancestor of review SHA); logic unchanged at tip. |

## Acceptance (#584 — locale VI / legacy copy)

| Tiêu chí | Kết quả |
| --- | --- |
| Không hiển thị `MeEvents` trên UI | **PASS** — chỉ type/parser/BFF (`capabilities.ts`, `discovery/me.ts`); không label UI. |
| Không «quyền server» / `Quota allocated` / `Guest invitations` trên VI | **PASS** — VI catalog: `gate.stat.quotaAllocated` → «Suất đã phân bổ»; `ops.invitation.sectionTitle` → «Lời mời khách — gửi hàng loạt» (`messages.ts` VI block). EN strings chỉ trong `EN` dict. |
| `CODES` không lộ literal trên UI VI | **PASS** — import kind dùng `formatImportKind` → `enum.importKind.CODES` = «Mã vé (CSV)». |
| `dispatch` trên UI VI | **PASS with nit** — action labels VI («Gửi lời mời», «Xem trước gửi»); vài chuỗi trạng thái vẫn lẫn từ «dispatch»/«reserve» (EN loanword) trong câu tiếng Việt — UAT body scan @ `c3adcbd` `found: []` cho blacklist AC; không blocker. |
| Catalog tests | **PASS** — `pnpm --filter @ticket/portal test` (130/130), incl. VI/EN parity + «EN catalog has no Vietnamese leakage». |

## ADR / stack (#581 #585)

| ADR gate | Kết quả |
| --- | --- |
| `@ant-design/pro-components@3.1.15-7` exact pin | **PASS** — `apps/portal/package.json` |
| Không Umi / `@umijs` | **PASS** — 0 import trong `apps/portal` |
| Next 16 + antd 6.6.6 + `@ant-design/nextjs-registry` | **PASS** — unchanged versions |
| ProLayout thay custom sider; RBAC/capabilities ở portal layer | **PASS** — `portal-shell.tsx` → `PortalProLayout`; `nav/capabilities` unchanged trust model |
| OIDC/BFF không nới | **PASS** — `git diff main...SHA` **empty** cho `apps/portal/app/api/auth/**`, `src/oidc/**`, `src/session/**` |
| Gate vẫn `app.vemoki.com` | **PASS** — `GateDeeplinkButton` + tests `gateDeeplinkUrl`; ADR `GATE-STAY-APP` |
| Ownership | **PASS with gap** — portal + lockfile per ADR; branch còn BE/contracts cho platform catalog (đã DoD+sec riêng PR #586) |

## Scope hygiene

| Check | Kết quả |
| --- | --- |
| `apps/web`, `apps/mobile` diff vs `main` | **PASS** — 0 lines |
| `apps/api` / `packages/*` | **Known gap** — intentional MPR commits on same branch (`aa8927b`, `a037410`, …); not drive-by web/mobile. Coordinator epic scope; BE evidence: `MPR-PR586-REVIEW-2026-10-20.md`. |

## Generated / ancillary files

| File | Ghi chú |
| --- | --- |
| `apps/portal/next-env.d.ts` | Next-generated (`// NOTE: This file should not be edited`); local wt có thể dirty sau `next dev` — không secret, không FAIL. |
| `apps/portal/AGENTS.md` | Next `next dev` agent-rules block — generated; commit giữ tree sạch theo comment trong file. |

## Security (portal slice)

**Threat / abuse cases (diff + blast radius)**

1. **Auth/session loosening via Pro** — No auth route changes; logout vẫn `/api/auth/logout`; cookie/JWKS tests pass.
2. **Client-side permission grant** — ProTable/ProLayout không thêm permission array; `capabilities` deny-by-default + server discovery (tests unchanged).
3. **Supply chain** — Pin exact `3.1.15-7`; lockfile delta scoped; no Umi preset; no lifecycle script surprises in portal `package.json`.
4. **PII / ops panels** — Existing interpreter fail-closed tests pass (invitation/import).
5. **Public catalog BE** — Out of portal diff ownership; reviewed @ `a037410` (RLS + summary-only).

**Security verdict: PASS** (no fix-before-merge items in portal/auth diff).

## Findings

| Mức | Finding |
| --- | --- |
| Known gap | PR #588 tip includes MPR BE/contracts beyond declared portal-only paths; web/mobile clean; BE covered by artifact PR #586. |
| Known gap | CI `turbo-persist` **in_progress** khi chạy evidence lần đầu; **aggregate `ci` + shard `portal`/`backend`/`web`/`mobile`/`changes` completed success** trên SHA sau ~90s wait. |
| Nit | VI ops copy vẫn có loanword «dispatch»/«reserve» trong vài message dài — không nằm blacklist UAT #584. |
| — | No blocker / should-fix before merge for portal AC on this SHA. |

## Checks (exact SHA)

```text
git rev-parse HEAD
→ d926669636746f62c599d03c14de3ac28d07bb50

./scripts/gh-dod-evidence.sh 588  (final poll)
→ head.sha=d926669636746f62c599d03c14de3ac28d07bb50 mergeable=true
→ ci success; portal success; backend success; web success; mobile success; changes success
→ turbo-persist in_progress (non-blocking vs aggregate ci success)

pnpm --filter @ticket/portal test
→ 130 pass, 0 fail

pnpm --filter @ticket/portal lint
→ exit 0

pnpm --filter @ticket/portal typecheck
→ exit 0
```

## Verdict

**DoD: PASS with known gap** · **Security: PASS** on exact SHA `d926669636746f62c599d03c14de3ac28d07bb50`.

Gaps: (1) branch diff includes MPR backend/contracts (separate reviewed SHA); (2) `turbo-persist` lagging while aggregate CI green; (3) Next-generated `next-env.d.ts` / `AGENTS.md` housekeeping.
