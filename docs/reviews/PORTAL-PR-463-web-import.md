# DoD — PR #463 portal web import/invitations + pending BFF + CS/notify/report/export (#425)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_a5cf90f4-fe84-4111-bc09-2eab9ed64a32` · task `task_eccd5851db26` · dispatch `ctx_ae97381499cc` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_7c5d683288f4` |
| Scope | PR [#463](https://github.com/hangndat/ticket-solution/pull/463) · Issue [#425](https://github.com/hangndat/ticket-solution/issues/425) · Story [#421](https://github.com/hangndat/ticket-solution/issues/421) · Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · paths `apps/portal` (+ artifact `docs/reviews`) |
| Commit SHA | `b1c5b954d735fda8aa7dbd25343f11ed4ebb742e` (confirmed `git rev-parse HEAD` = tip PR; CI run head_sha khớp) |
| Architecture | **Có** — ADR-20 portal admin / same-origin BFF · handoff [`docs/architecture/PORTAL-CONTRACT-HANDOFF.md`](../architecture/PORTAL-CONTRACT-HANDOFF.md) (import multi-step + invitations masked) · Decision IDs: **ADR-20** · **O12** (report deep-link) · **G-R2** (pending) |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `b1c5b954d735fda8aa7dbd25343f11ed4ebb742e` |
| CI Actions run [39142864112](https://github.com/hangndat/ticket-solution/actions/runs/39142864112) trên tip | **portal / changes / ci / turbo-persist** = SUCCESS; backend/web/mobile/database-isolation/d5-* = skipped (path filter — PR chỉ `apps/portal`) |
| Local: build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm exec tsx --test tests/ops-*.test.ts` (5 file) | **PASS** 20/20 — import/invite fail-closed PII; pending G-R2; CS ACCEPTED≠DELIVERED + export reject `downloadUrl`; O12 report deep-links; PORTAL_UPSTREAM paths |
| Mock UAT / mock auth trên path production | **Không** — mutate BFF dùng Origin+CSRF; `forwardStaffBearer` refresh fail → clear+401; không fixture session trên surface |
| Graph `detect_changes` | Hạn chế: MCP graph DB resolve nhầm checkout SideProject khi diff vs `origin/main` → reviewer đọc source/worktree + unit tests thay (không dựa risk score graph) |

## Acceptance mapping (T-WEB-OPS / #425)

| AC | Verdict | Evidence |
| --- | --- | --- |
| Import multi-step (upload → create → preview → commit/errors) | **PASS** | BFF: `imports/upload` (`assertMutatingMultipart`), `imports` POST create, `[importId]/preview|commit|errors|GET`; UI `ImportInvitationsPanel` Steps; upstream `…/imports/files` (server-minted fileId); preview copy «không giữ quota» |
| Invitations list + dispatch-preview + dispatch | **PASS** | BFF GET list (masked); POST dispatch-preview; POST invitations → Nest `/invitations/dispatch` + Idempotency-Key UUID; UI preview rồi dispatch; interpreters reject raw `invitedEmail`/`token` |
| G-R2 GET pending + approve/deny | **PASS** | BFF GET redemptions + approve/deny CSRF; `PendingPanel` filter `PENDING_REVIEW`; nút Approve/Deny chỉ khi `redemption.approve` |
| CS tickets/timeline/resend | **PASS** | `/support` + `CsPanel` gated `cs.lookup`; helpers + tests resend requires PENDING; ACCEPTED label ≠ delivered |
| Notifications retry; ACCEPTED ≠ DELIVERED | **PASS** | BFF list + retry CSRF; `notifications.ts` / `cs.ts` labels; unit test `labels ACCEPTED ≠ delivered` |
| O12 report + deep-link CTA | **PASS** | `gate/page.tsx` report + deep-link; overview link guests/support; `ops-report.test.ts` KPI → portal guests/support (không approve/resend trên KPI) |
| Export history/download recovery | **PASS** | BFF exports list/create/status/download; `interpretExportDownload` fail-closed nếu JSON `downloadUrl`; history bỏ row có `downloadUrl`/`objectKey`/`url` |
| Auth fail-closed / no mock UAT | **PASS** | Mọi mutate JSON: `assertMutatingBrowser`; upload: `assertMutatingMultipart`; mọi route `forwardStaffBearer` + UUID scope; UI permission-denied / tab theo Me permissions |
| Không UUID tay luồng chính | **PASS** | Catalog Select source/type; Idempotency-Key = `crypto.randomUUID()` |

## Architecture đối chiếu (ADR-20 / handoff)

| Quyết định | Impl trên SHA |
| --- | --- |
| Same-origin BFF + Origin/CSRF fail-closed | `assertMutatingBrowser` / `assertMutatingMultipart` trên mọi mutate mới |
| UI không cấp quyền (Nest+RLS) | Chrome/tab từ Me permissions; BFF chỉ forward Bearer |
| Import multi-step + quarantine fileId server | Upload Nest `imports/files`; UI không gửi object key |
| Invitations masked; dispatch sau previewRevision | Interpreters + BFF validation; preview không reserve (copy + BE đã DoD #455) |
| GATE-STAY-APP / O12 | Gate page report + deeplink; không host Gate scan |

Không cần Architect gate riêng để merge: không thấy design drift đáng kể so với ADR-20 / handoff cho wave portal web OPS. Gap mail outbox BE (`InvitationReady` handler) đã ghi ở DoD #455 — ngoài scope PR này.

## Findings

### Should-fix (không chặn AC #425)

1. **`/guests` vào được với chỉ `report.read`** — `canOps` gồm `report.read`; tab pending/notify/export vẫn render (mutate UI vẫn gated `canApprove`/`canNotify`; Nest deny). Nên thu hẹp entry hoặc ẩn tab theo permission từng surface.
2. **`ExportPanel` không nhận prop permission UI** — mọi user vào `/guests` thấy CTA export; authz thật ở API. Nên gắn permission export (nếu contract có) giống pending/notify.
3. **Thiếu unit test riêng từng BFF route handler** — CSRF/origin cover bởi foundation + pattern audit; interpreters có tests. Nên smoke route-level khi harden.
4. **Headless UAT portal** chưa chạy trên SHA này — đúng roadmap (`T-UAT-PORTAL`); không phải AC T-WEB-OPS.

### Nit

- Support page chỉ chặn `permission-denied` discovery; `canCs=false` vẫn mount `CsPanel` (panel tự disabled) — ổn nhưng có thể early-return rõ hơn.

### Blocker

Không.

## Limitations

- Reviewer không merge / không deploy / không DNS.
- Không UAT headless Playwright trên portal (gap đã ghi).
- Artifact docs có thể commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `b1c5b954d735fda8aa7dbd25343f11ed4ebb742e`.

## Draft comment PR (VI) — coordinator đăng nếu cần

```text
## DoD review (reviewer-dod) — PASS with known gap

- SHA: `b1c5b954d735fda8aa7dbd25343f11ed4ebb742e` (≠ implementer `ctx_7c5d683288f4`)
- Artifact: `docs/reviews/PORTAL-PR-463-web-import.md`
- CI run 39142864112: portal/changes/ci/turbo-persist xanh trên exact SHA
- Local: 20/20 ops unit tests (import/invite/pending/CS-export/report/paths)
- AC #425: import multi-step, invitations dispatch, G-R2 pending, CS/notify/report/export, auth fail-closed, ACCEPTED≠DELIVERED — đạt
- Gap đã biết (không chặn): entry `/guests` với `report.read`; ExportPanel thiếu gate UI; chưa headless UAT portal; thiếu test từng BFF route
```

## Merge note

Coordinator có thể merge sau khi chấp nhận known gaps ở trên + CI xanh (đã có). Revalidation bắt buộc nếu có commit hành vi mới sau SHA này.
