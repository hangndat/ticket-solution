# Evidence — D11-S3-T2 Web Gate (#232)

Ngày: 2026-10-18  
Branch: `hangndat/d11-web-gate-232`  
Story: [#230](https://github.com/hangndat/ticket-solution/issues/230) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222)  
Task: [#232](https://github.com/hangndat/ticket-solution/issues/232) · Spec `docs/tasks/d11/D11-B4-web-gate.md` · AC-G4  
PD: §1.3 / §2.4 · map D7-S3

## Phạm vi đã giao

- Detect browser offline + API unreachable trên staff `/gate`
- Banner VI plain (`Cổng web offline` / API suy giảm) — `data-testid="gate-offline-banner"`
- Fail-closed: disable mở phiên / xác nhận khi offline hoặc degraded; không admit khi API unreachable
- Outcome lớn: Cho vào / Không cho vào / Chưa rõ (+ đối soát); không giả queue iOS trên web
- Ngữ cảnh cổng (kết nối / sự kiện / tenant / phiên); a11y assertive cho unknown

## Ownership

`apps/web` `/gate` only — không sửa BE / iOS / contracts / Dashboard #245 / CS #246.

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web exec tsx --test tests/gate-decide.test.ts tests/gate-connectivity.test.ts tests/gate-outcome-copy.test.ts
# 14 pass
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web lint
# Headless UAT (Playwright; task-owned :3022):
node apps/web/tests/gate-offline-uat.mjs http://localhost:3022
scripts/web-uat.sh screenshot http://localhost:3022/gate apps/web/.uat-artifacts/d11-gate-online-shell.png
```

## SHA tip

_(điền sau commit — `git rev-parse HEAD`)_

## Headless UAT

Screenshots (committed):

- [`d11-uat/web/d11-gate-offline.png`](./d11-uat/web/d11-gate-offline.png)
- [`d11-uat/web/d11-gate-online.png`](./d11-uat/web/d11-gate-online.png)

Quan sát offline: banner «Cổng web offline», copy «Không xếp hàng trên web», confirm/session disabled, không UI queue iOS.

## Ngoài phạm vi

- iOS staff queue / CONFLICT UI (#231)
- Dashboard #245 · CS #246
- BE schema / validate-only
- Merge / Hoàn thành (coordinator sau DoD reviewer độc lập)

## Limitations

- UAT offline mode Playwright — không cần OIDC session để thấy banner shell; confirm disable chỉ assert khi form mount (OIDC configured).
- Không claim pilot ready / acceptance complete.
