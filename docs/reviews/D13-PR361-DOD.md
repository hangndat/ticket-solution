# DoD — PR #361 (D13 S5-T2 demo reviewer prod IdP)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_df3f2a1e-3070-4039-895b-5fb632746fb4` · task `task_47e32072f56b` · dispatch `ctx_3841a56d3757` (≠ implementer) |
| Role | `reviewer-dod` (+ `product-ba` expertise) · `docs/agents/roles/reviewer-dod.md` · `docs/agents/roles/product-ba.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#309](https://github.com/hangndat/ticket-solution/issues/309) · Task [#329](https://github.com/hangndat/ticket-solution/issues/329) · PR [#361](https://github.com/hangndat/ticket-solution/pull/361) · paths: `docs/reviews/D13-S5-T2-DEMO-REVIEWER.md`, `docs/asc/app-review-notes.md`, `docs/asc/asc-fields-checklist.md` |
| Architecture impact | **Không** — demo reviewer ops docs / BA copy; không đổi `apps/**` / OpenAPI / contracts |
| Commit SHA reviewed (PR tip) | `035ba0b254a320a167f7227069fda8cbd47fe2a2` (`git rev-parse` + PR `headRefOid`, live verified) |
| Evidence content commit | `eff4b0ed4af1c34c2f36b758d99687b51fe9db29` (ancestor; tip commits chỉ cite/sync SHA) |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` first; docs-only — **source + HTTP privacy/OIDC thắng** (MCP graph `built_at_sha` lệch worktree khác; không chặn) |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC (Task #329 / PR #361)

| AC | Result |
| --- | --- |
| Exact tip SHA live = claimed review target | **PASS** — `git rev-parse HEAD` = `035ba0b254a320a167f7227069fda8cbd47fe2a2`; `gh pr view 361` `headRefOid` khớp |
| Không commit mật khẩu / prod secret | **PASS** — diff §B dùng placeholder + path VPS `asc-sign-in-required.txt`; không có password literal mới / `client_secret` / Bearer token trong tip |
| How-to paste ASC honest | **PASS** — SSH → secret file mode 600 → ASC Sign-in required; xoay sau mỗi đợt; **không** mở PR chứa password; ghi rõ paste ASC UI **chưa** làm trong S5-T2 docs-only |
| Privacy / O06 vẫn accurate trong App Review notes | **PASS** — notes EN: anonymize ≤ 30 days + audit 730 days + Guideline 5.1.1(v); live `https://vemoki.com/privacy` + `/en/privacy` HTTP 200 khớp O06; DECISION-LOG O06 cùng số |
| Demo access usable for App Review | **PASS (docs path)** — khuyến nghị fixture `attendee@example.com` / `staff@example.com` (vé ACTIVE + `gate.confirm`, staff hết `CONFIGURE_TOTP`); `review-*@vemoki.com` provisioned nhưng attendee chưa có vé ACTIVE → không ưu tiên ASC primary (honest) |
| Cross-check evidence vs notes | **PASS** — bảng cross-check trong `D13-S5-T2-DEMO-REVIEWER.md` khớp refresh §B / checklist |
| Independent DoD exact-SHA | **PASS** — session/dispatch này ≠ implementer |
| Không merge / deploy / submit | **PASS** — reviewer không merge/deploy/submit; artifact claim boundary rõ |

---

## Checks (exact tip SHA `035ba0b254a320a167f7227069fda8cbd47fe2a2`)

```bash
git rev-parse HEAD
# → 035ba0b254a320a167f7227069fda8cbd47fe2a2

gh pr view 361 --json headRefOid,files
# → headRefOid 035ba0b… ; files: app-review-notes.md, asc-fields-checklist.md, D13-S5-T2-DEMO-REVIEWER.md

git merge-base --is-ancestor eff4b0ed4af1c34c2f36b758d99687b51fe9db29 HEAD
# → eff4b0e is ancestor of tip

# Secret scan on tip diff (docs/)
git diff main...HEAD -- docs/ | rg -i 'password\s*[:=]\s*[`"'\''']?[A-Za-z0-9!@#$%^&*]{6,}|client_secret\s*[:=]|Bearer [A-Za-z0-9._-]{20,}'
# → NO_PROD_SECRET_PATTERNS

curl -sS -o /dev/null -w '%{http_code}\n' https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration
# → 200

curl -sS -o /dev/null -w '%{http_code}\n' https://vemoki.com/privacy
curl -sS -o /dev/null -w '%{http_code}\n' https://vemoki.com/en/privacy
# → 200 / 200 ; body: anonymize ≤ 30 ngày|days ; Audit log TTL 730 ngày|days ; O06

gh pr checks 361
# → ci pass; path-filtered jobs skipping (docs-only) — expected
```

| Check | Result |
| --- | --- |
| Tip SHA live | **match** |
| Prod password / client secret in git | **none** |
| Fixture passwords `attendee-demo` / `staff-demo` | **pre-existing §A** (realm import / nội bộ; labeled không phải prod secret) — không phải secret mới của S5-T2 |
| OIDC discovery prod | **HTTP 200** |
| Privacy VI/EN vs O06 | **match** (30d / 730d) |
| ROPC re-run by reviewer | **not run** (cần secret VPS; không lấy/commit password) — tin evidence ROPC_OK của implementer + IdP discovery live |
| ASC UI paste / TestFlight binary | **not claimed done; not run** |
| Device/camera smoke | **not claimed; not run** |

---

## Findings

### Known gap (chấp nhận được — không nuốt security)

1. **Operator paste ASC UI** vẫn mở — cần binary TestFlight/Review + paste từ secret file VPS. Đã tick đúng trong notes/checklist/evidence; **không** bịa ASC state.
2. **Device/camera smoke** trên cặp demo chưa có (S4-T3 / S5 device) — ngoài scope docs S5-T2.
3. **`review-attendee@vemoki.com` chưa có vé ACTIVE** — ASC primary dùng fixture; ghi rõ → App Review path vẫn usable nếu operator paste fixture theo how-to.

Các gap trên **không** phải thiếu gate bắt buộc của docs PR này; Issue #329 “paste ASC” là ops follow-up có chủ đích.

### Residual nits (không chặn PASS)

1. Evidence field “Docs tip SHA” = `eff4b0e…` (evidence) + hướng dẫn `git rev-parse HEAD` cho tip — tip thật = `035ba0b…` (cite-only commits). DoD dùng **PR tip** `035ba0b…`.
2. §A vẫn có caveat MFA/`CONFIGURE_TOTP` cho “một số môi trường”; §B prod nói staff hết TOTP — hơi lệch ngữ cảnh local vs prod nhưng không sai nếu đọc đúng section.
3. CRG MCP `built_at_sha` không khớp worktree tip; kết luận từ git diff + HTTP.

---

## Verdict

**PASS with known gap** trên exact tip `035ba0b254a320a167f7227069fda8cbd47fe2a2`.

Coordinator có thể merge PR docs sau CI xanh; **không** đánh Issue #329 `Hoàn thành` chỉ vì DoD docs nếu còn coi “paste ASC” là AC cứng — đóng Task docs khi chấp nhận gap ops, hoặc giữ checklist ASC paste mở đến binary.

Reviewer **không** merge / deploy / submit store.
