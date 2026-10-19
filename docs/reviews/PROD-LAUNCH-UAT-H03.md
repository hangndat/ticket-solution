# PROD-LAUNCH-UAT — H03 (customer email / controlled inbox)

| Field | Value |
| --- | --- |
| Case | H03 (Suite H — Thư và push) |
| Worker | Gonic · backend |
| Task | `task_54a862effa82` |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Repo SHA (review) | `979483083f5f1d44f01d012b48b0bd2fb30b5ffb` |
| Date | 2026-10-19 |

## Question

Does this production launch **deliver** customer email (redeem ticket issued, membership invite, guest invite, check-in)?

## Verdict

**H03 does not block this launch** — production has **no internet customer-mail delivery path**. Outbox email relay runs in the worker but terminates at **internal Mailpit**; check-in has **no** email channel.

| Sub-flow | Outbox / notification enqueued? | Worker SMTP send? | Reaches customer inbox on internet? |
| --- | --- | --- | --- |
| Redeem → ticket issued | Yes (`TicketIssued`, channel `email`) | Yes, if worker + `SMTP_URL` set | **No** (default `smtp://mailpit:1025`) |
| Portal membership invite | Yes (`MembershipInvite`) | Yes | **No** (same Mailpit sink) |
| Guest invitation dispatch | Yes (`InvitationReady` / guest invite types in outbox) | Yes (`sendGuestInvitation`) | **No** (same Mailpit sink) |
| Gate / check-in | No email outbox | — | **No** |

## Code paths (git)

### Redeem enqueues ticket email (API transaction → outbox; send is async in worker)

`redeemAndIssueTicket` inserts `outbox` type `TicketIssued` and `notifications` channel `email` in the same commit as ticket issue (`packages/backend/src/issue.ts`).

### Invites enqueued on create / dispatch

- Membership: `INSERT INTO outbox … 'MembershipInvite'` (`packages/backend/src/membership-invite.ts`).
- Guest: processed in `packages/backend/src/outbox.ts` (`sendGuestInvitation`).

### Worker is the only SMTP sender

`apps/worker/src/index.ts` builds `createSmtpEmailAdapter(readEmailEnvironment(env))` and `relayOutboxOnce` calls `email.sendTicketIssued` / `sendMembershipInvite` / `sendGuestInvitation` (`packages/backend/src/outbox.ts`, `packages/backend/src/email-adapter.ts`).

Production without a real `SMTP_URL` is **fail-closed** for missing URL; compose **always** supplies a default URL pointing at Mailpit, not the public internet.

### Infra: Mailpit sink, production SMTP not enabled

- `infra/deploy/compose.yaml`: service `mailpit` on network `internal` only (no edge publish); worker `SMTP_URL: ${SMTP_URL:-smtp://mailpit:1025}`, `SMTP_FROM: ${SMTP_FROM:-noreply@vemoki.com}`.
- `infra/deploy/README.md`: «SMTP production (ADR-13) **chưa bật**; worker vẫn trỏ Mailpit.»

`createSmtpEmailAdapter` documents that delivery is via configured SMTP URL; with Mailpit, provider status `ACCEPTED` means **captured in Mailpit**, not SPF/DKIM delivery to a customer domain (`packages/backend/src/email-adapter.ts` header + `apps/worker/src/main.ts` log line).

### Check-in

Gate/check-in flows use `checkins` and related APIs; no outbox email enqueue for admit/confirm (search under `packages/backend/src` for check-in paths shows no mail/outbox coupling).

## Production env check (SSH)

Attempted read-only VPS check per task (`ssh conanphong`, worker env names only, values redacted): **host `conanphong` not resolved** on this worker machine (no `VEMOKI_SSH_HOST`). Did **not** read `/opt/vemoki/.env`.

Prior runtime evidence on the same stack (for operator cross-check only): `docs/reviews/D13-S2-T1-RUNTIME-REVAL-2026-10-18.md` records worker `SMTP_URL` host **mailpit**, internet SMTP **not** configured.

## H03 catalog mapping

Catalog H03 applies when launch **sends mail to real customer inboxes** (controlled inbox + SPF/DKIM). This launch **does not**: messages stop at Mailpit unless an operator overrides `SMTP_URL` to an internet MTA (not documented as enabled in deploy README; not verified on VPS this session).

**Case H03:** `PASS` (non-blocking) — not `BLOCKED`.

## Limits

- No live redeem/invite was executed on prod; conclusion is from code + compose + deploy docs (+ historical runtime note).
- If VPS `.env` sets `SMTP_URL` to an external relay without a controlled inbox, H03 would become `BLOCKED`; that was not observable here.

## Actions not taken (per task)

No inbox creation, no test sends, no prod config changes, no git commit/push/merge.
