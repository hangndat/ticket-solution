# N-IOS — báo cáo worker

**SHA:** `a74d7a97ab380967137fb3f03932d172082191a0`  
**Branch:** `hangndat/d5-ios-n-ios-push-response`  
**Scope:** `apps/mobile` only  
**Base:** F-IOS `7c54c4c` (published routes + redeem) — PR stack trên #68

## Đã làm

1. **Cold/warm response listener:** `attachNotificationRouting` + injectable transport; production lazy-load `expo-notifications` (`getLastNotificationResponseAsync` + `addNotificationResponseReceivedListener`).
2. **Dedupe:** `responseId` = identifier|date|action; `beginResponseResolve` / `markResponseConsumed` — nhiều tap cùng response chỉ một route.
3. **Validate C-N:** kind allowlist + `payloadVersion` + opaque UUID refs; event kinds bắt buộc `tenantSlug`/`eventSlug` — **không** route `eventId` → fixture.
4. **Intent queue:** park khi unsigned; resume sau verified epoch; clear logout/switch (`wallet-logout` + session subscribe).
5. **Re-authz resolve:** TicketIssued → `GET /v1/me/tickets` ownership; Event* → published API rồi `/events/{tenantSlug}/{slug}`; foreign/invalid không navigate.
6. **Wallet không bị chặn:** listener lỗi/native thiếu/push denied không đụng SessionBoundary; registration deny path giữ nguyên.

## Checks

| Check | Result |
| --- | --- |
| `pnpm test` | PASS 133 |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` (expo export iOS) | PASS, 1538 modules |

## Files chính

- `src/push/notification-contract.ts`, `notification-payload.ts`, `notification-intent.ts`
- `src/push/notification-resolve.ts`, `notification-response.ts`, `notification-routing.ts`
- `src/push/*.test.ts` (payload/intent/response/routing)
- `src/app/_layout.tsx`, `src/tickets/wallet-logout.ts`

## Gaps / không claim Done

- Live N-BE APNs payload + physical device delivery thuộc D5 / integration — unit dùng injected transport (test-only), không claim delivery.
- Headless sim UAT VoiceOver không nằm scope code này.
- Stack phụ thuộc published + F-IOS commits chưa merge main; live owner status/event resolve cần BE published ổn định.
- Không merge/close; không EAS Cloud; không secrets.
