# DoD review — PR #605 / Issue #602 (iOS wallet grouping + CTAs)

| Trường | Giá trị |
| --- | --- |
| Reviewer | Orca worker · `task_6a21713588ca` / `ctx_f9385ec2265e` — **khác** implementer Linh |
| Issue | [#602](https://github.com/hangndat/ticket-solution/issues/602) — Ví nhóm theo sự kiện + bộ lọc + CTA từ Sự kiện |
| PR | [#605](https://github.com/hangndat/ticket-solution/pull/605) |
| Commit SHA | `745e85ba30babf0bd8df02356426c4f5dfcb35ca` (`git rev-parse HEAD` on worktree `r-602-ios-wallet-review`, branch `pr-605`) |
| Scope | `apps/mobile/src/attendee/attendee-outcome-copy.ts`(+test), `apps/mobile/src/screens/{my-tickets,events,event-detail}.tsx`, `apps/mobile/src/tickets/wallet-event-grouping.ts`(+test), `apps/mobile/src/tickets/use-attendee-owned-tickets.ts`, `apps/mobile/src/components/wallet-owned-tickets-link.tsx` |
| Verdict | **PASS with known gap** |

## Acceptance criteria

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Wallet không filter: subtitle `N vé · M sự kiện` từ dữ liệu thật | **PASS** — `walletListSubtitle` + `countDistinctEvents` khi không có `filterEventId`. |
| 2 | Wallet có filter: tên sự kiện + "Xem tất cả" về danh sách đầy đủ | **PASS** — `useLocalSearchParams` → `parseWalletEventIdFilter`; `router.replace('/(tabs)/my-tickets')` clear param. |
| 3 | Nhóm vé theo sự kiện, section header `Tên · N vé` | **PASS** — `WalletGroupedTicketList` + `groupTicketsByEvent` / `walletEventSectionHeader`. |
| 4 | Events home: CTA khi đăng nhập + có vé; guest/không vé → ẩn | **PASS** — `WalletOwnedTicketsLink` (`verified` + `countTicketsForEventId`). |
| 5 | Event detail: CTA tương tự | **PASS** — `WalletOwnedTicketsLink` trên `PublishedEventComposition`. |
| 6 | `presentTicketRow` ưu tiên `eventName` API; demo chỉ fallback tên | **PASS** — `ticket.eventName?.trim() \|\| demo?.name \|\| 'Sự kiện'`; test mới. |
| 7 | `OfflineDisplayWallet` — quyết định ghi trong PR | **PASS** — PR body + comment trong code: flat list, không grouping khi cache thiếu `eventName`. |
| 8 | Pure helpers + `node --test` | **PASS** — 13/13 tests (`wallet-event-grouping.test.ts`, `attendee-outcome-copy.test.ts`). |
| 9 | `tsc` + `eslint` | **PASS (CI)** — `./scripts/gh-dod-evidence.sh 605`: `mobile` + `changes` success trên SHA. Local Orca worktree thiếu `node_modules` → `tsc`/`eslint` không chạy được; không chặn khi CI mobile đã xanh. |
| 10 | Điều hướng "Xem vé" → `/my-tickets` + `eventId` param | **PASS** — `router.push({ pathname: '/(tabs)/my-tickets', params: { eventId } })`. |

## Navigation & state

- Filter dùng **route param** (`eventId`), không global mutable store — phù hợp AC.
- "Xem tất cả" dùng `router.replace` (không stack filter sâu) — hợp lý.

## `useAttendeeOwnedTickets` / N+1 (task item 4)

| Mức | Finding |
| --- | --- |
| **Known gap** | Mỗi `WalletOwnedTicketsLink` gọi hook riêng. Cache `session.read` ấm → không fetch. **Cold start** trên Events home (nhiều card mount cùng lúc): nhiều effect có thể gọi `probeMeTickets` song song trước khi `session.load` ghi cache — `session.load` **không** dedupe in-flight; hook gọi probe **trước** `load`. Khuyến nghị follow-up: provider/context một lần fetch hoặc shared in-flight promise cho `me-tickets`. |

Sau khi user đã mở tab Ví (hoặc probe đầu hoàn tất), hành vi đúng AC và không lặp API.

## Dependency #601

- `TicketSummary.eventName?: string` có trong `packages/contracts` — consume-only, không đổi contract trong PR.

## Checks (trên SHA)

```text
git rev-parse HEAD
→ 745e85ba30babf0bd8df02356426c4f5dfcb35ca

node --test apps/mobile/src/tickets/wallet-event-grouping.test.ts \
  apps/mobile/src/attendee/attendee-outcome-copy.test.ts
→ 13 pass, 0 fail

./scripts/gh-dod-evidence.sh 605
→ head.sha=745e85ba30babf0bd8df02356426c4f5dfcb35ca state=open mergeable=true
→ ci success, turbo-persist success, mobile success, changes success
```

## Security

- Chỉ hiển thị số vé đã sở hữu sau `verified` identity; không leak cho guest.
- Không secrets / không đổi auth contract.

## Limitations

- Reviewer không merge, không sửa code PR.
- Evidence file ghi trên `main` worktree (docs-only, coordinator commit).

## Verdict

**PASS with known gap** — AC #602 đạt; CI xanh trên exact SHA. Gap: duplicate `probeMeTickets` tiềm năng trên Events home cold cache (không chặn pilot nếu coordinator chấp nhận follow-up).
