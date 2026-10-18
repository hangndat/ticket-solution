# D13 — DoD review PR #304 (roadmap duyệt + runtime preflight)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca dispatch `ctx_8aea34de8531` · terminal `term_ef65cf8d-5eac-4307-8e5e-5cae39506892` · **≠** implementer root `codex_e4d5db07_a531_4587_a319_3f80d3ac690a` |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · PR [#304](https://github.com/hangndat/ticket-solution/pull/304) · `docs/ROADMAP.md` · `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` · `docs/reviews/D13-S2-T1-RUNTIME-PREFLIGHT.md` |
| Commit SHA (exact) | `84569ef3d68984efd01762c099d7ae4b58d4091c` |
| Worktree đọc source | `/Users/admin/orca/workspaces/ticket-solution/d13-coord-release` (không dùng untracked root/ba artifact làm reviewed source) |
| Architecture impact | **Không** |
| Ngày review | 2026-10-18 |
| Verdict | **PASS with known gap** |

Primary durable evidence: PR comment on #304 (keeps tip SHA unchanged). This file is uncommitted reviewer output. Prior BA DoD `D13-PR308-DOD.md` (other worktree, untracked) is **out of scope** — separate verdict.

---

## Checks (SHA `84569ef3d68984efd01762c099d7ae4b58d4091c`)

| Check | Kết quả |
| ----- | ------- |
| Tip = reviewed SHA | `git rev-parse` / `gh pr view headRefOid` → `84569ef3d68984efd01762c099d7ae4b58d4091c` |
| Ownership diff | Chỉ 3 files docs trên — **không** runtime / `apps/**` |
| CI | `changes` pass · `ci` pass · runtime jobs skip |
| User approval documented | Plan banner + ROADMAP D13 callouts: user “duyệt” 2026-10-18; Epic #301; publish sau mandatory gates |
| No ritual re-auth submit | Plan §2/§6/§10: sau duyệt roadmap **không** xin lại quyền submit nghi thức; chặn bằng dữ kiện (credential/territory/go-no-go/Apple) |
| Archive deps | S4-T1 **sau** S1-T3, S2-T1, và S5-T1/fix mobile merge + DoD/CI — không archive trước thay đổi hành vi cuối |
| Mandatory gates (account/privacy/device/local build/SMTP) | Documented as open / evidence-gated; **không** tick PASS giả |
| Territory | **Chưa chốt**; đề xuất VN; **không** tự chọn All (`S7-T1`) |
| Source vs deploy SHA | Preflight: source `f551b6d2bdc0…` ≠ deploy marker `0a65f3c2f2d5…`; ops branch context tách |
| Preflight honesty | **NO-GO** submit khi email bắt buộc chỉ tới Mailpit; HTTP 200 ≠ E2E |
| Live spot-check (reviewer) | `privacy` / `api health` / `auth OIDC` / `app` → HTTP **200** (2026-10-18) |
| History vs effective state | Snapshot ROADMAP D10/D11/D5 cũ còn; D13 banners đánh dấu authority thực thi |
| CRG | Graph stale vs tip — fallback source/`gh` (limitation) |
| Runtime tests | Không chạy (docs-only) |

---

## Findings

### Known gaps (không FAIL AC docs này)

1. **Residual Pha-A wording** trong plan (“Ủy quyền hiện tại: lập roadmap… để user review”; §10.6 “chờ review roadmap / chưa coding”) còn nghe như roadmap chưa duyệt, trong khi banner đầu file + ROADMAP D13 đã ghi **đã duyệt**. Should-fix polish khi reconcile — **không** làm false-pass gate; effective banners thắng nếu đọc từ đầu.
2. **SMTP / device / ASC / local Distribution archive / account-deletion in-app** — vẫn mở / NO-GO theo preflight+plan; đúng vì documented, không claim GO.
3. Board Status snapshot trong plan §1.1 có thể lệch Project #3 theo thời gian — plan đã ghi board thắng; không suy Hoàn thành Epic từ PR này.

### Không blocker trong scope PR

- Không claim publish / pilot ready / ASC filled.
- Hard dep email thật trước S6 rõ; Mailpit không đủ cho luồng bắt buộc.
- Tái sử dụng D10/D12 theo SHA + revalidate; không kế thừa PASS cũ mù quáng.

---

## Verdict

**PASS with known gap**

Gaps trên không nuốt mandatory acceptance của slice docs coordinator (ghi duyệt + preflight trung thực + deps archive). Không waive release gates. Revalidate nếu tip #304 đổi sau SHA này. Verdict **độc lập** với PR #308 BA DoD.
