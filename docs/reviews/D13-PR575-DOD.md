# DoD — PR #575 (D13 S4-T3 prod bake 1.0.0/14 + Dexter USB smoke)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_f3d0b1df-c7d9-454f-afb6-a4da527c57e4` · task `task_c060d89df902` · dispatch `ctx_41f304950fdd` (≠ implementer Zico `ios`) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Task [#327](https://github.com/hangndat/ticket-solution/issues/327) (S4-T3) · PR [#575](https://github.com/hangndat/ticket-solution/pull/575) · paths: `apps/mobile/app.config.ts`, `docs/reviews/D13-S4-T3-DEVICE-SMOKE.*`, `docs/reviews/D13-PR574-DOD.md` (duplicate of `main`) |
| Architecture impact | **Không** — build number bump + device smoke evidence |
| Commit SHA reviewed (PR tip) | `b73e968a284d2165a70679afcbdc16114030ea15` (`gh pr view 575` `headRefOid` + `./scripts/gh-dod-evidence.sh 575`) |
| S4-T3 smoke artifact verdict (claimed) | **FAIL** — `physicalTfSmokePass: false`, `prodBakeOnDevice: true` |
| Verdict (PR DoD) | **PASS with known gap** |

---

## Checklist vs AC

| AC / gate | Result |
| --- | --- |
| Exact tip SHA live = claimed | **PASS** — `head.sha=b73e968a284d2165a70679afcbdc16114030ea15` |
| PR diff scoped | **PASS** — vs base `d3c3a9d265d4be2c3af99b313634089f8074bf54`: `app.config.ts` build `13`→`14`, smoke MD/JSON refresh, `D13-PR574-DOD.md` trùng nội dung đã có trên `main` (no functional delta) |
| CI on tip SHA | **PASS** — `ci`, `changes`, **`mobile`** success; slice jobs skipped where N/A |
| S4-T3 **FAIL** verdict honest | **PASS** — MD/JSON khớp: build **14** prod bake (`launchProdBake` **PASS**, `prodBakeVerifiedIpa` / `prodBakeOnDevice` true); **OIDC**, **attendee QR**, **staff GateCamera** **FAIL** với `automationLimits` (accessibility tap, WDA passcode, deep link) — không inflate PASS; operator sign-in / camera vẫn cần |
| Không claim Submit / publish | **PASS** — `submittedForReview: false`, `released: false`; MD nêu rõ không Submit |
| USB vs TF wording | **PASS** — `tfBinaryOnDevice: false`, `usbDevInstall14: true` phản ánh coordinator USB install (không chờ TF) |
| Issue #327 AC (device smoke PASS) | **GAP (intentional)** — AC chưa đóng; artifact **FAIL** đúng, không đánh dấu Hoàn thành |
| No secrets in diff | **PASS** — API Key ID only; no `.p8`/credentials |

---

## Checks (exact tip SHA `b73e968a284d2165a70679afcbdc16114030ea15`)

```bash
./scripts/gh-dod-evidence.sh 575
# head.sha=b73e968a284d2165a70679afcbdc16114030ea15 state=open mergeable=true
# ci=success changes=success mobile=success

gh pr view 575 --json headRefOid,baseRefOid
# headRefOid=b73e968a284d2165a70679afcbdc16114030ea15 baseRefOid=d3c3a9d265d4be2c3af99b313634089f8074bf54

git diff d3c3a9d265d4be2c3af99b313634089f8074bf54..b73e968a284d2165a70679afcbdc16114030ea15 --stat
# 4 files — app.config + smoke artifacts + duplicate PR574 DoD
```

| Check | Result |
| --- | --- |
| Tip SHA / CI | **match / green (incl. mobile)** |
| S4-T3 `verdict` MD ↔ JSON | **FAIL / false physicalTfSmokePass** |
| Prod bake vs OIDC/QR/camera | **Honest partial** — launch prod catalog PASS; interactive flows not claimed PASS |
| Submit / release | **not claimed** |

---

## Findings

### Blockers

None for **merging this evidence PR** — documentation matches limitations.

### Known gaps (do not treat as #327 DoD complete)

1. **#327** — Operator (hoặc WDA passcode enabled) cần hoàn OIDC prod sign-in, attendee QR, và staff `GateCamera` trên Dexter build **14**.
2. Build **13** TF prod-bake gap đã được ghi nhận; **14** khắc phục bake nhưng smoke end-to-end vẫn **FAIL**.

### Nit (non-blocking)

- `D13-PR574-DOD.md` trong diff PR #575 trùng file đã merge `main` — có thể gỡ ở follow-up để giảm noise.

---

## Verdict

**PASS with known gap** cho PR #575 @ `b73e968a284d2165a70679afcbdc16114030ea15`: reviewer độc lập xác nhận verdict **FAIL** trên S4-T3 là **trung thực** — prod bake + launch **PASS**, OIDC/QR/`GateCamera` **FAIL** do giới hạn automation/operator, không Submit/publish. Gap có chủ đích: Issue #327 AC device smoke vẫn mở.

Không merge / submit / ASC mutate trong session reviewer này.
