# D13-S8-T2 — DoD review PR #387 (ops reval docs)

| Field | Value |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Orca worker `term_8e94fc44-b4ca-42a9-b61b-e8da741eb543` · task `task_a3ea17aba45d` · dispatch `ctx_455d32f16d09` (≠ implementer) |
| Scope | PR [#387](https://github.com/hangndat/ticket-solution/pull/387) · branch `hangndat/d13-ops-reval-319` · Parent [#301](https://github.com/hangndat/ticket-solution/issues/301) / [#340](https://github.com/hangndat/ticket-solution/issues/340) · Related [#319](https://github.com/hangndat/ticket-solution/issues/319) [#293](https://github.com/hangndat/ticket-solution/issues/293) |
| Paths | `docs/reviews/D13-S2-T1-RUNTIME-REVAL-2026-10-18.md` · `docs/reviews/D13-S8-T2-D12-293-DECISION.md` · `docs/reviews/O02-DEPLOY-UPLOAD-2026-10-18.md` |
| Commit SHA | `64f6df168082532e8eccbf4d72fd66f31ec8e7ce` |
| Architecture impact | Không — docs decision |
| Date | 2026-10-18 |

## Checks (exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` / PR tip | `64f6df168082532e8eccbf4d72fd66f31ec8e7ce` |
| Diff scope | Docs-only — 3 files under `docs/reviews/` (matches PR file list) |
| CI on PR #387 | `changes` SUCCESS · `ci` SUCCESS · app jobs SKIPPED (docs-only) |
| Mergeable | MERGEABLE |

Docs-only review — no runtime/UAT re-run required on this SHA; claims verified against artifact text + consistency across the three files.

## Acceptance checklist

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Giữ #293 OPEN có lý do | PASS | `D13-S8-T2-D12-293-DECISION.md`: residual SMTP / TF smoke / App Review / pilot-claim; điều kiện đóng #293; **không** Hoàn thành Epic chỉ vì Wave A–C |
| SMTP blocker ghi đúng | PASS | `D13-S2-T1-…`: `SMTP_URL` → `smtp://mailpit`; FAIL gate SMTP internet; #319 giữ **Bị chặn**; O02 cũng ghi SMTP Mailpit |
| Không false-claim Submit | PASS | S2-T1: không Submit (#332); O02: **Chưa** Submit for Review / production release; chỉ UPLOAD SUCCEEDED + `processingState=VALID` cho build **11** |
| Không false-claim pilot/Ready for Sale | PASS | Limitations explicit trên S2-T1 + decision residual |

## Findings

### Blocker
Không.

### Should-fix / nit
- Residual TF trong decision ghi `1.0.0(10)` trong khi O02 evidence upload là build **11** — lệch versioning nhỏ, không ảnh hưởng quyết định giữ #293 OPEN hay SMTP/Submit gates.

### Limitations
- Board sync #319/#305/#340/#320 sau merge vẫn thuộc coordinator (PR test plan unchecked).
- iOS `buildNumber` 11 bump **chưa** trên `main` (đã ghi trong O02) — ngoài scope PR docs này.

## Verdict

**PASS**

Đủ gate docs decision cho D13-S8-T2 / #340. Ủy quyền integration: merge PR #387 tại SHA `64f6df168082532e8eccbf4d72fd66f31ec8e7ce`.
