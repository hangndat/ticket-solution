# VCX-926 — Runtime acceptance F01/F05 (Noah · next stack)

| Mục | Giá trị |
| --- | --- |
| Issue | [#926](https://github.com/hangndat/ticket-solution/issues/926) |
| Runner | Noah · fixture/UAT |
| **testedSHA** | `5136c92a6b1d2c52d95399a096002f44fb910756` |
| Packet | `docs/reviews/evidence/vcx-926/20261026T2100Z-noah-next/` |
| Packet cũ (PR #959) | `20261026T0956Z-noah` — F03/F04 harness; F05 report-only gate deny trên session sai origin |
| **Verdict acceptance runtime (#926 AC)** | **PASS** — F01 đóng; F05 đạt theo AC thật (O23) |

## Căn cứ sản phẩm (coordinator đối chiếu)

- [DECISION-LOG O23](../DECISION-LOG.md) (L27–31): bỏ Web Gate admission; Portal chỉ **đọc báo cáo Gate** theo `report.read`; quét/xác nhận cổng chỉ **iOS Staff**.
- [PRD](../PRD.md) (L5): cùng phạm vi O23 — Portal báo cáo read-only, không admission web.
- [TECHNICAL-DESIGN](../TECHNICAL-DESIGN.md) (L80–82): `portal/` = báo cáo Gate read-only; staff admission trên mobile.
- [Roadmap 2026-10-26 G-14](../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) (L41): Portal không admission (O23); trang Gate portal theo `report.read`.

**Issue #926 không yêu cầu** persona Scanner xem báo cáo Gate trên Portal. `gate.confirm` trên assignment Scanner phục vụ **admission iOS Staff**, không mở route Portal `/gate`.

## Stack (ownership riêng)

| Thành phần | Giá trị |
| --- | --- |
| API | `http://127.0.0.1:3546` |
| Portal | `http://uat926.localhost:3018` |
| DB | `ticket_vcx926_next_20261026` · `vcx926_next_rt` (NOBYPASSRLS) |
| Snapshot | `ticket_vcx932_leader_20261026` (pg_dump read-only) |
| OIDC | `ticket-admin-web-vcx926-next` @ `:8180` — không sửa client/DB #928 |

Signal stack: `.orca-metrics/vcx926-stack-ready.json`.

## Phương pháp

Actor (`me/subject`, `me/events`) trước probe màn; tab Orca riêng/persona; MFA TOTP thật; viewport sau `goto`; không mock auth; không sửa code/DB sản phẩm.

## Kết quả theo AC #926 (F05 + F01)

| Case | Persona | Viewport | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- |
| CS Support / `cs.lookup` | CS | 1024 | **PASS** | content `/support` |
| CS Setup | CS | 1024 | **PASS** | denied |
| report-only Gate | report-only | 1024, 390, 1440 | **PASS** | content — `report.read` |
| report-only Guests | report-only | 1024–1440 | **PASS** | denied |
| report-only Audit | report-only | 1024–1440 | **PASS** | content (read-only workspace) |
| Manager cross-tenant | Manager | 1024 | **PASS** | studio denied |
| Owner guests / audit | Owner | 1024 | **PASS** | F01 deep-link |
| Scanner → Portal `/gate` | Scanner | 390, 1024, 1440 | **PASS (expected-deny)** | denied đúng O23; **không** trong AC #926; evidence actor + PNG giữ |

## Findings

| ID | Sev | Verdict | Mô tả |
| --- | --- | --- | --- |
| F01 | Low | **Đóng** | guests/audit Owner; report-only guests deny / audit read-only |
| F03 | Med | **Harness** | packet cũ tenants 404 — phiên này actor + tenants 200 |
| F04 | Med | **Mitigated** | TOTP fixture private |
| F05 | High | **Đóng (AC)** | CS, report-only gate, manager cross-tenant, chrome giới hạn đúng persona trong AC; Scanner Portal `/gate` = **expected-deny** theo O23, non-blocking |
| F02 | Info | Open | `next-env.d.ts` (PR #952 DoD), ngoài runtime #926 |

## Scanner — diễn giải (không phải gap sản phẩm)

Probe `scanner-gate-viewports.json`: BFF có `gate.confirm`, UI `/gate` hiển thị «Không có quyền» vì route Portal Gate gắn `report.read` — **khớp O23/G-14**, không nới quyền Scanner để pass UI. Admission Scanner: iOS Staff (B03/PR #972, ngoài scope Portal #926).

## Deferred

#901, #903, #904, AR891. B03 camera PR #972 tái dùng. B04 inbox user-confirmed.

## Owner

Recheck guests/audit trên stack mới — PASS; không rerun full matrix Owner.

## Tách verdict

| Phạm vi | Kết luận |
| --- | --- |
| Runtime acceptance **#926** (F01/F05 AC) | **PASS** @ `5136c92a6b1d2c52d95399a096002f44fb910756` |
| DoD code PR #952 | Giữ reviewer (PASS with known gap F02) |
| Pilot / launch production | Ngoài phạm vi phiên fixture local |

## Lệnh tái hiện

```bash
bash .local-dev/.uat-artifacts/vcx926-noah/start-stack.sh
PORTAL_BASE=http://uat926.localhost:3018 \
VCX926_EVIDENCE_DIR=$PWD/docs/reviews/evidence/vcx-926/20261026T2100Z-noah-next \
node apps/portal/.uat-artifacts/vcx-926/f01-f05-next-probe.mjs
node apps/portal/.uat-artifacts/vcx-926/scanner-gate-viewports.mjs
```
