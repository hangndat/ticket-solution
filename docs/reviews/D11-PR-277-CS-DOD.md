# DoD + Security review — PR #277 / Issue #246 (CS / email recovery UX)

| Trường | Giá trị |
| --- | --- |
| **Verdict (DoD)** | **PASS with known gap** |
| **Verdict (Security)** | **PASS** |
| Reviewer / session | Cursor · Role `reviewer-dod` + `reviewer-security` · terminal `term_5a3f7b70-b574-4f12-b842-9ba10b6326d3` · task `task_b4b90d6b4cbe` · dispatch `ctx_3639bb85f5f1` · **≠** implementer CS (`ctx_359224f7ea27`) · reuse session sau review #253 đã settle |
| Scope | PR [#277](https://github.com/hangndat/ticket-solution/pull/277) · Issue [#246](https://github.com/hangndat/ticket-solution/issues/246) · `apps/web` only · O14 gộp đợt |
| Commit SHA đã duyệt | `62a50a6bca3a3b6e17169516d0159891b364e498` |
| Architecture impact | Không — CS UI consume API sẵn |
| Ngày | 2026-10-18 |
| Revalidation | Bắt buộc nếu tip PR đổi hành vi sau SHA này |

## Phân loại: code review vs acceptance

| Lớp | Phạm vi | Kết quả |
| --- | --- | --- |
| **Code review / AC #246** | Timeline VI; mapping PENDING/FAILED/DEAD/ACCEPTED≠DELIVERED; unknown fail-closed; cooldown UI + busy; deny quyền; PII masked; Dashboard KPI không resend | **PASS** (source + unit + CI) |
| **Acceptance tích hợp authenticated** | Resend/list/detail với OIDC session thật trên BFF + Nest | **Chưa có trong worker** — **không claim PASS**; coverage thuộc milestone [#236](https://github.com/hangndat/ticket-solution/issues/236) (UAT tích hợp). Gap **không waive** như đã nghiệm thu end-to-end. |

Issue #246 body không liệt kê “resend authenticated e2e” là AC bắt buộc của Task web này; AC tập trung copy/timeline/cooldown. Headless UAT hiện chỉ chứng minh fail-closed khi chưa auth — đúng giới hạn, không thay bằng chứng API thật (#236).

## Checklist DoD (#246 / O14)

| Tiêu chí | Kết quả |
| --- | --- |
| Exact SHA = tip PR | PASS — REST `head.sha` = local `git rev-parse HEAD` = `62a50a6…` |
| Timeline thời gian · hành động · kết quả (VI) | PASS — `formatCsTimelineItem` + UI `cs-timeline` |
| PENDING/FAILED/DEAD/ACCEPTED không giả DELIVERED | PASS — `csProviderStatusLabel`; ACCEPTED copy ≠ đã giao; DELIVERED chỉ literal |
| Unknown fail-closed | PASS — `CS_UNKNOWN` trên 5xx/network/shape lỏng; resend không nhận ACCEPTED làm success |
| Retry/cooldown không double-submit | PASS — `busy` + `disabled={busy \|\| resendCooldownActive}`; cooldown ~60s sau `resent`/`RESEND_COOLDOWN`; idempotency key reuse khi unclear |
| Authorization deny + PII | PASS — `PERMISSION_DENIED` UI; reject body có `ownerEmail`/`email`/`rawEmail`; chỉ `ownerEmailMasked` |
| Không tạo vé mới / Dashboard không resend | PASS — copy cooldown “Chưa tạo vé mới”; `admin-report.test.ts` KPI không chứa `resendTicketEmail` / `/resend` |
| CI xanh trên SHA | PASS — `web` + aggregate `ci` success ([run 39092039492](https://github.com/hangndat/ticket-solution/actions/runs/39092039492)) |
| Reviewer độc lập | PASS |
| Merge | N/A — reviewer không merge |

## Checklist Security

| Threat / abuse | Kết quả |
| --- | --- |
| UI tuyên bố DELIVERED từ ACCEPTED | Không — copy + tests |
| Resend thành công với shape/status sai | Fail-closed `unknown` |
| Lộ PII thô từ API | Parse reject raw email keys |
| Resend khi thiếu quyền | Rejected + alert `cs-permission-denied` |
| Resend từ Dashboard KPI | Không — deep-link only (O12/O14) |
| Mock auth production path | Không — UAT fail-closed không bypass |
| Cooldown chỉ client | UI gate; server vẫn trả `RESEND_COOLDOWN` — hardening BE ngoài PR |

## Known gap (bắt buộc ghi — không waive)

1. **Không có OIDC session** trên worker cho authenticated CS search/detail/resend headless → UAT chỉ fail-closed notice. **Bằng chứng real API** cần thu dưới [#236](https://github.com/hangndat/ticket-solution/issues/236) (hoặc Task UAT có session), không tính là acceptance e2e của #246 đã xong.
2. Graph MCP `detect_changes` lệch worktree/SHA khác — verdict dựa source + tests + CI REST.

## Checks đã chạy trên SHA `62a50a6bca3a3b6e17169516d0159891b364e498`

```bash
git rev-parse HEAD
# → 62a50a6bca3a3b6e17169516d0159891b364e498

pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm -C apps/web exec tsx --test tests/admin-cs-export.test.ts   # 14 pass
pnpm -C apps/web exec tsx --test tests/admin-report.test.ts      # 8 pass
pnpm --filter @ticket/web run typecheck                          # exit 0

gh api repos/hangndat/ticket-solution/commits/62a50a6…/check-runs
# web success · ci success
```

Không chạy authenticated UAT / DB shared / mock auth / EAS. Không sửa source / commit / push / merge. Artifact #253 (`docs/reviews/PR-253-MFEST-DOD-REVAL.md`) giữ untracked, không đụng.

## Diff tóm tắt

- `apps/web/src/admin/cs.ts` — label/timeline/resend reject copy; strict interpreters.
- `apps/web/app/admin/admin-form.tsx` — cooldown UI, timeline grid, list/detail structured, permission alert, pending resend status.
- `apps/web/app/globals.css` — CS list/timeline layout.
- Tests + `d11-cs-email-uat.mjs` headless fail-closed.

## Verdict

**PASS with known gap** trên exact SHA `62a50a6bca3a3b6e17169516d0159891b364e498`.

Code/AC #246 và security UI đạt; CI xanh. Gap authenticated real-API UAT **mở** theo #236 — coordinator có thể merge #246 theo DoD Task web nếu chấp nhận gap đã ghi; **không** đánh Hoàn thành milestone #236 từ artifact này.
