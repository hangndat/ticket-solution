# DoD review — PR #396 (D13 BUG BE ticket link audit)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_599d735c-970b-4a79-b771-93c2be673dbb` · Task `task_a6cb2893a2ce` · Dispatch `ctx_bdae30335d37` · **≠** implementer |
| Scope | PR [#396](https://github.com/hangndat/ticket-solution/pull/396) · branch `hangndat/d13-bug-be-ticket-link-audit` · ownership **backend** (`packages/backend/**` + audit doc) |
| Commit SHA (tip under review) | `541bad97d165460e11cdb181b65a6b18e11181e7` (exact; = PR `headRefOid`) |
| Behavior SHA (contract lock) | `e5b09a14d16c87dc57cc65befd8574735f132aea` (ancestor of tip; path/impl unchanged after this) |
| Architecture impact | Không — giữ path `/t/{tenant}/tickets/{id}`; không đổi contract URL path |
| Decision IDs | N/A (không đụng O02 / PD §6.1 chrome) |

> Spec preamble typo: task cited tip `…81b7`; object không tồn tại. Reviewed exact tip `…81e7` from PR head.

## Diff scope (vs `origin/main`)

| Path | Change |
| --- | --- |
| `packages/backend/src/web-links.ts` | JSDoc handoff trên `buildOwnerTicketLink` only — **body path unchanged** |
| `packages/backend/test/qr-ticket-link-unit.test.cjs` | Contract lock path + encoding |
| `packages/backend/package.json` | Thêm `web-links-unit` + `qr-ticket-link-unit` vào script `test` |
| `docs/reviews/D13-BUG-BE-TICKET-LINK-AUDIT.md` | Matrix BE↔web + acceptance |

Không đụng `apps/web`, `apps/mobile`, OpenAPI, migrations, secrets.

## Correctness / AC

1. **Không silent đổi path:** `buildOwnerTicketLink` vẫn `${base}/t/${encodeURIComponent(tenantSlug)}/tickets/${encodeURIComponent(ticketId)}` — khớp `origin/main` trừ JSDoc.
2. **Outbox:** `processClaimedOutbox` vẫn gọi `buildOwnerTicketLink` cho `TicketIssued` → `vars.ticketLink` (graph `callers_of` → `outbox.ts`).
3. **Web matrix:** `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` có trên tip **và** `origin/main` (#405) — claim “web page yes” đúng.
4. **Re-export:** `qr-ticket.ts` re-export từ `web-links` — callers cũ ổn.
5. **Security surface:** Link owner không thêm query token/credential; unit assert `?` / `#` / `token` absent.

## Checks (trên exact tip SHA `541bad97…81e7`)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / PR head | `541bad97d165460e11cdb181b65a6b18e11181e7` |
| `git merge-base --is-ancestor e5b09a14… tip` | yes |
| Local: `pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build && pnpm --filter @ticket/backend exec node --test test/qr-ticket-link-unit.test.cjs test/web-links-unit.test.cjs` | **7 pass / 0 fail** |
| CI on tip | [run 39132891408](https://github.com/hangndat/ticket-solution/actions/runs/39132891408) — `changes`, `backend`, database-isolation×8, `turbo-persist`, `ci` **SUCCESS**; web/mobile/d5-* skipped (đúng backend slice) |
| Secret scan (PR files) | Không credentials / `.env` thật |

## Findings

| Severity | Finding |
| --- | --- |
| nit | Audit doc “Branch tip at handoff” = `4e1fb85…` (parent), không phải tip `541bad97…` — pin lag do commit tự-cập-nhật tip; behavior SHA vẫn đúng. |
| note | Implementer self-verdict PASS trong audit doc không thay independent DoD này. |

Không blocker / should-fix cho acceptance của Task (audit + contract lock, không path cutover).

## Limitations

- Không chạy e2e email MIME / outbox DB trên SHA này (ngoài AC unit + CI backend).
- Không UAT headless web owner page (đã ship #405 trên main; ngoài ownership PR này).
- Graph index trên worktree lệch nhẹ vs tip; correctness xác minh bằng source + unit test.

## Verdict

**PASS** — exact tip `541bad97d165460e11cdb181b65a6b18e11181e7`; behavior lock `e5b09a14d16c87dc57cc65befd8574735f132aea`; path contract giữ; tests + CI xanh; sẵn sàng merge khi coordinator ủy quyền integration.
