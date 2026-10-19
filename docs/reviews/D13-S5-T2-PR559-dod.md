# D13 S5-T2 — PR #559 DoD review (#329)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | James · Orca `term_1b00f001-9977-48a6-a7db-2b17e9646d26` · dispatch `ctx_acf2631188b7` · task `task_9b83eeac65d5` · role `reviewer-dod` · ≠ implementer |
| Scope | Issue **#329** · PR **#559** · `docs/reviews/D13-S5-T2-DEMO-REVIEWER.md` · `docs/asc/app-review-notes.md` |
| Architecture impact | **Không** |
| **Exact SHA** | **`c9707da5f3d61cf8b23c90c4053770d12fd08a48`** (`gh pr view 559 --json headRefOid` khớp) |
| Verdict | **PASS with known gap** |

## Diff / scope

PR chỉ sửa 2 file docs (20 insertions / 13 deletions): revalidation ngày 2026-10-19, log ROPC HTTP status, operator ROPC smoke how-to (`OIDC_CLIENT_SECRET`), narrative 401→kcadm→200, cross-check table cập nhật ngày.

Không đụng `apps/*`, infra, secrets file, ASC mutate.

## Checks (reviewer, trên SHA `c9707da`)

```text
gh pr view 559 --json headRefOid → c9707da5f3d61cf8b23c90c4053770d12fd08a48
git diff main...c9707da --stat → 2 files (scope khớp Task)

# Không commit prod password / client secret / token (scan nội dung @ SHA):
git show c9707da:docs/reviews/D13-S5-T2-DEMO-REVIEWER.md
git show c9707da:docs/asc/app-review-notes.md
→ prod: placeholders [ASC only] / VPS path; không Bearer eyJ*, không OIDC_CLIENT_SECRET value

# Đối chiếu claim HTTP công khai (artifact ghi 200):
curl -sS -o /dev/null -w '%{http_code}' https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration → 200
curl -sS -o /dev/null -w '%{http_code}' https://api.vemoki.com/v1/health → 200
curl -sS -o /dev/null -w '%{http_code}' https://vemoki.com/privacy → 200
curl -sS -o /dev/null -w '%{http_code}' https://vemoki.com/en/privacy → 200

# ROPC / kcadm / prod DB read-only: KHÔNG re-run trên VPS (docs-only reviewer); tin cậy artifact + nội bộ nhất quán
Runtime CI: không áp dụng (docs-only PR)
```

## ROPC / operator claims vs artifact

| Claim (implementer artifact) | Reviewer đối chiếu | Kết luận |
| --- | --- | --- |
| 4 user ROPC `ticket-web` → HTTP 200 sau re-sync | Log text trong DEMO-REVIEWER; procedure 401→set-password→200 hợp lý; env key `OIDC_CLIENT_SECRET` (không dùng tên giả) | **Accepted as ops evidence** — không tái chứng minh ROPC |
| kcadm: enabled, `emailVerified`, `requiredActions=[]` | Ghi trong cùng block; khớp mục tiêu staff hết TOTP gate | OK (artifact) |
| Prod DB: fixture attendee 1× ACTIVE `uat-device`; staff + review-staff STAFF + gate perms | Ghi rõ; không query DB độc lập | OK (artifact) |
| Operator paste ASC + secret file `/opt/vemoki/secrets/.../asc-sign-in-required.txt` | How-to đầy đủ; checklist §B app-review-notes; **chưa paste ASC** (binary TestFlight) | **Known gap** — đúng Issue |
| Không escalate demo → platform owner | Cả hai doc + operator §5 | OK |

## Cross-check `app-review-notes.md`

- §B S5-T2 date + “ROPC re-sync từ VPS secret file” khớp DEMO-REVIEWER revalidation 2026-10-19.
- Khuyến nghị ASC primary = fixture §A (vé ACTIVE + staff `gate.confirm`, không TOTP) khớp Outcome / Accounts table.
- §A vẫn liệt kê `attendee-demo` / `staff-demo` cho **local/realm import** (đã công bố nội bộ) — tách biệt §B prod-only-in-ASC; không coi là leak prod mới trong PR.
- EN Notes: O06 deletion / privacy / OIDC / camera — không mâu thuẫn DEMO-REVIEWER cross-check table.

## Issue #329 acceptance

| AC (Issue) | Trạng thái @ `c9707da` |
| --- | --- |
| Hai account attendee/staff prod + không commit mật khẩu | **Met** (artifact + git scan); paste ASC **chưa** |
| Evidence tip SHA | **Met** PR tip = `c9707da` |
| DoD reviewer độc lập exact-SHA | **Met** (artifact này) |
| Headless UAT / physical-device | **Ngoài slice PR** — DEMO-REVIEWER ghi gap device/camera (S4-T3/S5) |
| Gap checklist D13 / không bịa ASC state | **Met** — ASC paste unchecked, không claim In Review |

## Findings

| Mức | Nội dung |
| --- | --- |
| Known gap (Issue) | Operator chưa paste credential vào ASC UI — chờ binary TestFlight/Review; docs ghi rõ. |
| Known gap (ops) | Reviewer không SSH/VPS re-run ROPC; verdict dựa artifact + HTTP công khai. |
| Known gap (app path) | `review-attendee@vemoki.com` chưa vé ACTIVE — đúng khuyến nghị dùng fixture cho Sign-in required. |
| Nit | `Docs tip SHA` dùng placeholder `git rev-parse HEAD` thay literal `c9707da` — chấp nhận được vì DoD cite exact SHA. |

## Security (docs slice)

Không hot path authz/code. Prod secrets không vào git trên diff này. Operator doc không in token body.

## Verdict rationale

**PASS with known gap:** Docs revalidation nhất quán, không secret prod trong PR, claim HTTP công khai xác minh được, ROPC/operator narrative và cross-check ASC notes khớp phạm vi S5-T2. Gap còn lại (ASC paste, device smoke, ROPC tái chạy bởi reviewer) đã được ghi và không nuốt acceptance bắt buộc **của slice docs-only**; coordinator vẫn cần ops paste ASC trước submit store.

Không merge (theo Task).
