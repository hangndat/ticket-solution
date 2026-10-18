# D13-S8-T2 — Quyết định đóng hoặc giữ D12 #293

| Field | Value |
| --- | --- |
| Issue | [#340](https://github.com/hangndat/ticket-solution/issues/340) |
| Epic D12 | [#293](https://github.com/hangndat/ticket-solution/issues/293) |
| Date | 2026-10-18 |
| Tip | `9910173dc1c4f016448e2bc230ab6843c419b315` |

## Quyết định đề xuất (coordinator)

**Giữ #293 OPEN** với residual hẹp — **không** Hoàn thành Epic D12 chỉ vì gap-audit Wave A–C.

### Đã đóng trong #293 follow-up (2026-10-18)

- O02 nav/capabilities (#368–#371)
- UX-11 Option A (#372)
- Docs errata + DoD checklist (#373)
- SEC-CACHE (#380)
- O13 sales (#381)
- A11y residual (#382)
- Prod tip redeploy `9910173…` (S2-T1 reval artifact)

### Residual vẫn thuộc D12/#293 hoặc gate D13

| Residual | Owner | Blocker |
| --- | --- | --- |
| SMTP internet (không Mailpit) | ops | Credential/DNS — #319 |
| Physical TF smoke 1.0.0(10) | operator + ios | #327 |
| App Review submit/release | D13 S6–S7 | deps S4-T3 + SMTP policy |
| Claim pilot/prod ready | user | Explicit — không auto |

### Khi nào đóng #293

Khi user chấp nhận: (a) SMTP internet evidence **hoặc** waive email-for-review với ASC notes; **và** (b) không còn AC D12 coding mở; D13 owns store path.

**Không** đóng #293 trong PR này — chỉ ghi quyết định giữ OPEN + residual list.
