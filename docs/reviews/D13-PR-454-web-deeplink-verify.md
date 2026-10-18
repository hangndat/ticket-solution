# D13 — DoD review · PR #454 web ticket deeplink verify (#398)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Agent Cursor · Orca terminal `term_2e85cf6e-7318-433b-b8da-3e84f5bf5c75` · Task `task_d70f33eeeb2e` · Dispatch `ctx_26f79126f7f9` · Run `run_34fde1e32ed1` · **≠** implementer verify (`ctx_bc885656091f`) |
| Scope | PR [#454](https://github.com/hangndat/ticket-solution/pull/454) · Issue [#398](https://github.com/hangndat/ticket-solution/issues/398) · ownership **docs/reviews** (verify artifact) · route/BFF đã merge qua [#405](https://github.com/hangndat/ticket-solution/pull/405) |
| Commit SHA | `d854db09af964178c97041b0e86b79250efc648a` (exact · `git rev-parse HEAD` = tip PR) |
| Architecture impact | **Không** — docs/verify; không đổi shared contract trong PR này |
| Graph | `code-review-graph-ticket` list_graph_stats OK; `detect_changes` vs `main` nhiễu (graph DB lệch branch) → **source + unit + artifact thắng** |

## Diff PR #454

Chỉ 1 file: `docs/reviews/D13-BUG-WEB-TICKET-DEEPLINK.md` (+30/−26). Không đụng `apps/web` code trong PR này — đúng task verify docs.

## Đối chiếu acceptance #398

| AC / DoD | Kết luận |
| --- | --- |
| Route tồn tại; anonymous ≠ generic event 404 (auth redirect) | **Met** — route `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` có trên tree; merge #405 `f6eb2d4e1bd7673e883617cff07009baeb2e212d` là ancestor của tip `main` `cd7f2261b829dc366b3a8e946f33ae092f69a396` và của tip PR. `proxy.ts` soft-redirect anonymous owner-ticket → `/auth?next=…` (307). Page `redirect` khi `unauthenticated`. `routes.integration.mjs` assert 307 + Location `/auth` + `next=` chứa `tickets`; cấm HTML `owner-ticket-missing` / event 404. |
| Auth gate fail-closed + copy ≠ event not-found | **Met** — missing/forbidden/invalid → `OWNER_TICKET_COPY.missing` «Không tìm thấy vé»; `sanitizePostLoginPath` allowlist `isOwnerTicketPath`. |
| Link resolve khi owner đã login (BE `GET /me/tickets/{id}`) | **Partial / known gap** — BFF `GET /api/bff/tickets/[ticketId]` + Nest `/v1/me/tickets/{id}` đã có (#400/#405). Authenticated attendee khi `me/tenants` thiếu tenant có vé → `tenant-unresolved` — theo dõi PR [#441](https://github.com/hangndat/ticket-solution/pull/441) (OPEN). Gap đã ghi trong artifact verify; **không FAIL** docs PR theo ủy quyền task. |
| Checks + SHA + artifact `D13-BUG-WEB-TICKET-DEEPLINK.md` | **Met** — artifact tip verify ghi checks trên `cd7f226…`; PR tip `d854db09…` cập nhật artifact. |

## Checks (reviewer trên exact SHA `d854db09…`)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `d854db09af964178c97041b0e86b79250efc648a` |
| `git merge-base --is-ancestor f6eb2d4… HEAD` | OK (#405 trên tree) |
| `pnpm --filter @ticket/contracts build` | PASS |
| `pnpm --filter @ticket/web exec tsx --test tests/owner-ticket.test.ts` | **PASS (12)** — revalidate reviewer |
| `pnpm --filter @ticket/web test:routes` | Không hoàn tất local (lean-ctx 120s/8MB kill, exit 137). Evidence thay thế: source assert 307 trong `routes.integration.mjs` + claim implementer trên tip `main` + CI docs. |
| `pnpm --filter @ticket/web build` | Không re-run (docs PR; route đã merge #405). |
| CI run [39139089365](https://github.com/hangndat/ticket-solution/actions/runs/39139089365) | **success** trên SHA `d854db09…` — jobs `changes`+`ci` xanh; `web` skipped (path filter docs-only — đúng). |

## Findings

### Known gap (chấp nhận — không blocker docs PR)

1. **Authenticated attendee resolve phụ thuộc #441** — `me/tenants` chưa UNION tenant có vé → `tenant-unresolved`. Ngoài scope verify docs #454; artifact verify đã ghi. Đóng #398 end-to-end attendee cần #441 merge + revalidation riêng.

### Should-fix / nit

2. Artifact verify ghi tip `main` `cd7f226…` trong lúc PR tip là `d854db09…` (docs-only) — rõ ràng, OK. Sau commit hành vi web mới trên route → revalidate DoD.

### Blocker

Không có.

## Verdict rationale

PR #454 chỉ xác minh/ghi evidence cho route/BFF/auth-gate đã merge #405. Source + unit (12 PASS) + ancestry #405 + CI docs khớp AC route/auth-gate. Gap #441 được ủy quyền ghi nhận → **PASS with known gap** (không nuốt security; không tuyên bố attendee resolve E2E xong).

**Không merge** trong session reviewer này — coordinator quyết định sau DoD.
