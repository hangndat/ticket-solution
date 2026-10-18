# D11 — DoD review PR #250 Web EventReport O12 Wave P2 (#249)

| Trường | Giá trị |
| --- | --- |
| Verdict | **FAIL** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_be75cb07-f513-4cca-aa5b-01edcde66f89` · Task `task_0c88940d711d` · Dispatch `ctx_1b2fc202ef02` · **≠** implementer `ctx_d7a673179e71` |
| Scope | PR [#250](https://github.com/hangndat/ticket-solution/pull/250) · Issue [#249](https://github.com/hangndat/ticket-solution/issues/249) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **web** (`apps/web/**` only) |
| Commit SHA | `4fa09315cc81920a73bb75bec3df10d74024d489` (exact; = PR tip / CI `headSha`) |
| Architecture impact | **Không** — consume contract EventReport O12 đã merge (P1). Không cần Architect |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / tip | SHA `4fa09315cc81920a73bb75bec3df10d74024d489` tồn tại; commit message khớp Wave P2 #249 |
| Diff ownership | 3 files, **chỉ** `apps/web/app/admin/admin-form.tsx`, `apps/web/src/admin/report.ts`, `apps/web/tests/admin-report.test.ts` — không BE/mobile/OpenAPI |
| Local unit tests | `pnpm exec tsx --test tests/admin-report.test.ts` trên nội dung SHA → **6 pass / 0 fail** |
| CI trên SHA | Run [39058022345](https://github.com/hangndat/ticket-solution/actions/runs/39058022345) **failure** · job `web` FAIL · `lint` error · aggregate `ci` FAIL · tests trong job web: **150 pass / 0 fail** trước khi lint dừng pipeline |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| P3 / out-of-scope | Không deep-link; không auto-poll/`setInterval`; không sửa BE |

## Đối chiếu AC #249

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| Parse/render O12: `checkInSuccessCount`, `rejectByReason`, `quotaRemaining`/`quotaCapacityState`, `emailNeedsCsCount`, `asOf` | `parseShown` require đủ field; UI render Manager/Supervisor/email CS + watermark | Có (logic) |
| Fail-closed shown/unknown/rejected; thiếu field → unknown | Tests: partial 200, missing O12, 5xx/0/network, FINITE thiếu remaining, UNLIMITED với remaining≠null → `unknown` / không leak counts | Có |
| Đổi tenant/event xóa số cũ | `useEffect(() => setReport(null), [tenantId, eventId])` | Intent đúng — **nhưng** bị ESLint chặn (blocker CI) |
| Copy VI + watermark `asOf`; refresh thủ công | `formatReportAsOf` + raw ISO; nút «Tải lại báo cáo»; không auto-refresh | Có |
| Layout Manager (quota/pending) → Supervisor (check-in/reject) | Thứ tự: asOf → Manager → vé theo state → Supervisor → email CS | Có |
| Tests `admin-report.test.ts` | 6 tests pass local + trong CI log | Có |
| Không P3 deep-link; không BE | Diff web-only; không deep-link | Có |
| CI xanh trên tip | Lint FAIL → job web/CI đỏ | **Không** |

## Findings

### Blocker

1. **`react-hooks/set-state-in-effect` tại `admin-form.tsx:272`** — `setReport(null)` đồng bộ trong `useEffect` khi `[tenantId, eventId]` đổi. CI web lint (`eslint . --max-warnings 0`) fail; run `39058022345` đỏ trên exact SHA. AC «xóa số khi đổi tenant/event» vẫn bắt buộc, nhưng cần implement không gọi `setState` trong effect body (ví dụ: clear trong handler đổi tenant/event, hoặc key/reset state theo cặp tenant+event, hoặc pattern đã có trong form cho các view khác).

### Should-fix

Không có (ngoài blocker CI).

### Nit

- Khối «Vé theo trạng thái» nằm giữa Manager và Supervisor — vẫn thỏa «Manager trước, Supervisor sau»; có thể gom/nhãn rõ hơn ở wave sau.
- Không có test component cho clear-on-tenant/event (chỉ unit parse); sau khi sửa lint, nên có assert hành vi clear nếu dễ.

## Limitations / revalidation

- Verdict chỉ pin SHA `4fa09315cc81920a73bb75bec3df10d74024d489`. Push fix lint/hành vi → **bắt buộc DoD lại** trên SHA mới.
- Reviewer **không** merge; giữ `Chờ duyệt` / trả `Đang làm` để fix worker.

## Verdict

**FAIL** — logic O12 / fail-closed / layout / tests unit đạt trên exact SHA, nhưng **CI web lint đỏ** (gate DoD bắt buộc) vì `setReport(null)` trong `useEffect`.
