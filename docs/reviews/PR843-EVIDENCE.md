# PR #843 — Portal C-N notify parity (G-791-1)

| Field | Value |
| --- | --- |
| Issue | [#843](https://github.com/hangndat/ticket-solution/issues/843) |
| Branch | `hangndat/portal-843-notify-cn` |
| SHA (tip) | `1e8278a2e89b750fbb2714c04b35f3e92c182023` |
| Stack | `docker compose up -d postgres redis keycloak`; `./scripts/fe-uat-stack.sh bootstrap`; API `:3001`; portal `:3013` |

## Parity (web admin → portal)

| Web action | Portal BFF | Portal UI |
| --- | --- | --- |
| POST `/api/bff/admin/notification-templates/preview` | POST `/api/bff/tenants/:tenantId/events/:eventId/notification-templates/preview` | Guests → Thông báo → Preview template |
| POST `/api/bff/admin/notification-templates/publish` | POST `…/notification-templates/publish` | Publish template (Modal confirm) |
| POST `/api/bff/admin/reminders/preview` | POST `…/reminders/preview` | Preview nhắc |
| POST `/api/bff/admin/reminders` | POST `…/reminders` | Tạo nhắc |
| POST `/api/bff/admin/reminders/:id/cancel` | POST `…/reminders/:reminderId/cancel` | Huỷ nhắc (Modal confirm) |
| GET notifications list (existing) | GET `…/notifications` | Table + filters (existing panel) |

## Checks

```bash
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build
pnpm --filter @ticket/portal typecheck lint test build
```

UAT (local):

```bash
./scripts/portal-843-notify-uat.mjs
```

Artifacts: `docs/reviews/assets/PR843/` (PNG md5 in `manifest.json`). Axe serious/critical on `#portal-cn-notify-section`: **0** (reducedMotion reduce, post-settle).

## UAT note

D9 `staff@example.com` lacks `notify.send`; guests tab also opens for `event.config` so template/reminder UI is reachable. Reminder **create/cancel** may reject without `notify.send` upstream — cancel screenshot omitted when no `reminderId`; BFF routes covered by unit tests.
