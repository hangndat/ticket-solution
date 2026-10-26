# VCX-926 actor/session delta — Noah · `20261026T1200Z-noah-actor`

| Mục | Giá trị |
| --- | --- |
| Issue | [#926](https://github.com/hangndat/ticket-solution/issues/926) |
| PR | [#959](https://github.com/hangndat/ticket-solution/pull/959) |
| sourceSHA | `aaafad413f8c3071e5558405203f5d57fe0484ff` |
| previousPacket | `20261026T0956Z-noah` (measurements giữ nguyên) |
| Verdict runtime | **GAP / NO-GO** — không claim acceptance; delta chứng minh actor + session đúng |

## Harness fix (private, gitignored)

`manual-context-probe.mjs`: sanitizer `/api/bff/me/subject` đọc `userId` (khớp `apps/portal/app/api/bff/me/subject/route.ts`). `actorVerification`: `actorMatch` khi `userId` === Keycloak fixture `sub` cho email persona (chỉ publish sha256 prefix).

## Actor match (cùng tab, MFA thật, portal :3013)

| Persona | actorMatch | me/subject | me/events mfest | BFF report | gate | guests | audit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Owner | **true** | 200, userIdPresent | full Owner perms incl. `inventory.import`, `report.read` | 200 | content | no deny (probe: content false, xem ảnh) | content |
| report-only | **true** | 200, userIdPresent | chỉ `report.read` | 200 | content | denied (đúng AC) | content |

**F05 (High):** Với session đúng, report-only **gate allowed** (content) — khác deny «Không có quyền báo cáo cổng» trên tab/login sai origin trong packet cũ; **không** đổi nhãn manual cũ, phân loại session/harness.

**F01 (Low):** Owner guests/audit tại packet cũ (1024 manual) denied; context probe cùng SHA **audit content**, guests không ant-result deny — chưa chứng minh regression product giữa `d00a265` và `aaafad41` (diff product không đổi theo coordinator); cần review UI AC cho guests probe heuristic.

## Chưa chạy (budget)

Supervisor @1024; viewport 390/1440 — sau actor pass, không full matrix.

## Artifacts

`context-probe-*.json`, `context-*.png`, `actor-delta.json`, `ports-orca.json`, `manifest.json` — sanitized, không TOTP/token.
