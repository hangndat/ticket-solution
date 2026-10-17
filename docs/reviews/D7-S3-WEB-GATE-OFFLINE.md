# Evidence — D7-S3 Web gate offline UX (#113 / #114)

Ngày: 2026-10-17  
Branch: `hangndat/d7-web-gate-offline`  
Story: [#112](https://github.com/hangndat/ticket-solution/issues/112) · Epic [#103](https://github.com/hangndat/ticket-solution/issues/103)  
Tasks: [#113](https://github.com/hangndat/ticket-solution/issues/113) · [#114](https://github.com/hangndat/ticket-solution/issues/114)  
Contract align: [#105](https://github.com/hangndat/ticket-solution/issues/105) / ADR-18 (`CHECKIN_OFFLINE`, conflict codes)

## Phạm vi đã giao

- Detect browser offline + API unreachable (timeout / network / 5xx) trên staff `/gate`
- Banner VI `data-testid="gate-offline-banner"` (offline / degraded)
- Fail-closed: không admit khi API unreachable; disable confirm khi offline; confirm dialog khi retry lúc degraded
- Hướng dẫn dùng iOS queue `CHECKIN_OFFLINE` (web không enqueue offline)
- Giữ `ALREADY_CHECKED_IN` admit (cùng mã conflict #105)

## Ownership

`apps/web` only — không sửa BE / iOS / contracts.

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web exec tsx --test tests/gate-decide.test.ts tests/gate-connectivity.test.ts
# Headless UAT (Playwright; server on :3010):
node apps/web/tests/gate-offline-uat.mjs http://127.0.0.1:3010
# or: scripts/web-uat.sh screenshot http://127.0.0.1:3010/gate
```

## SHA tip

`fbdade1f2fdf5b7954e36cd2df2e03a63898b077`

(Behavior commit after rebase onto main; docs tip may advance.)

## Headless UAT

```bash
node apps/web/tests/gate-offline-uat.mjs http://localhost:3010
scripts/web-uat.sh screenshot http://localhost:3010/gate apps/web/.uat-artifacts/d7-gate-online.png
```

Screenshots: [`d7-uat/web/d7-gate-offline.png`](./d7-uat/web/d7-gate-offline.png), [`d7-uat/web/d7-gate-online.png`](./d7-uat/web/d7-gate-online.png)

## Ngoài phạm vi

- Durable offline-sync apply (#106)
- iOS SecureStore queue UI (D7-S2)
- D8–D10
