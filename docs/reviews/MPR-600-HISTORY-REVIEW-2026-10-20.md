# DoD review — PR #603 / Issue #600 (iOS staff device history pagination)

| Trường | Giá trị |
| --- | --- |
| Reviewer | James (Orca worker · `task_3026beb014a4` / `ctx_75e3426e938e`) — **khác** implementer Linh |
| Issue | [#600](https://github.com/hangndat/ticket-solution/issues/600) — Lịch sử quét staff: phân trang Tải thêm |
| PR | [#603](https://github.com/hangndat/ticket-solution/pull/603) |
| Commit SHA | `38676dac7ea8454f7221d155592febca04b02552` (`git rev-parse HEAD` on worktree `r-600-ios-history-review`, branch `pr-603`) |
| Scope | `apps/mobile/src/gate/staff-gate-device-history.ts`, `staff-gate-device-history-panel.tsx`, `staff-gate-device-history.test.ts`, `apps/mobile/src/screens/staff-history.tsx` |
| Verdict | **PASS with known gap** |

## Acceptance criteria

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | "Tải thêm" tăng số dòng theo trang, không cap cứng 12 | **PASS** — `buildDeviceScanHistory` bỏ `.slice(0, 12)`; `DEVICE_HISTORY_PAGE_SIZE = 12` chỉ là page size; `staff-history` tăng `visibleCount` +12 qua `handleLoadMore`. |
| 2 | "Đã xem hết lịch sử lưu trên máy này" khi hết `ops` scope | **PASS** — `computeDeviceHistoryPageView` `hasMore: limit < allRows.length`; panel hiện copy khi `!hasMore` và footer bật. |
| 3 | "Đã tải N lượt" (N = số dòng đang render) | **PASS** — footer dùng `rows.length` sau filter (khớp AC literal). |
| 4 | Rỗng → copy phù hợp; không đụng `StaffGateNoEventState` | **PASS** — `StaffGateNoEventState` giữ; `totalAvailable === 0` + pagination → "Chưa có lượt quét trên thiết bị này." |
| 5 | Search client-side trong lượt đã tải, không API | **PASS** — `filterLoadedDeviceHistoryRows` trên slice `loaded`; placeholder "Tìm trong các lượt đã tải". |
| 6 | `node --test` + tsc + eslint scope | **PASS** (tests local worktree; tsc/eslint main checkout) — xem Checks. |
| 7 | Không đổi hành vi gây hại cho caller `buildDeviceScanHistory` | **PASS with gap** — caller duy nhất `staff-gate-workspace-context` nhận **đầy đủ** rows (trước cap 12). `StaffGateHistorySheet` vẫn không pagination → sheet có thể list dài hơn 12 (cải thiện nhất quán dữ liệu local, chưa có "Tải thêm" trên sheet). |

## Claim: không cần BE / contract mới

**PASS** — Diff chỉ 4 file `apps/mobile`; không API, schema, hay `apps/api`. Lịch sử vẫn từ `ops` + queue trong workspace context (`buildDeviceScanHistory`); pagination thuần client.

## Checks (trên SHA)

```text
git rev-parse HEAD
→ 38676dac7ea8454f7221d155592febca04b02552

cd apps/mobile && node --test src/gate/staff-gate-device-history.test.ts
→ 6 pass, 0 fail (worktree r-600-ios-history-review)

cd apps/mobile && npx tsc --noEmit -p tsconfig.json
→ exit 0 (checkout main — worktree Orca không có node_modules)

cd apps/mobile && npx eslint \
  src/gate/staff-gate-device-history.ts \
  src/gate/staff-gate-device-history-panel.tsx \
  src/gate/staff-gate-device-history.test.ts \
  src/screens/staff-history.tsx
→ exit 0 (checkout main)

./scripts/gh-dod-evidence.sh 603
→ head.sha=38676dac7ea8454f7221d155592febca04b02552 state=open mergeable=true
→ ci success, turbo-persist success, mobile success, changes success
→ database-isolation, d5-rint, d5-observability, backend, d5-drills, web, portal skipped
```

## Findings

| Mức | Finding |
| --- | --- |
| Info | `loadMoreError` / retry UI bọc `setVisibleCount` trong try/catch — đồng bộ, praktisch không kích hoạt; vẫn khớp mockup nếu sau này có bước async. |
| Gap | `StaffGateHistorySheet` nhận full `deviceHistory` sau bỏ slice — không có footer "Tải thêm" trên sheet (ngoài scope tab Lịch sử). |

## Limitations

- Reviewer không merge/sửa code PR.
- `tsc`/`eslint` không chạy trong worktree Orca (thiếu `node_modules`); đã chạy trên `main` cùng repo + CI `mobile` xanh trên exact SHA.
- Không UAT manual simulator trong session reviewer.

## Verdict

**PASS with known gap** — AC tab Lịch sử (#600) đạt; không BE; tests + CI trên SHA xanh. Gap: sheet lịch sử hiển thị full local list không paginate. Sẵn sàng merge (coordinator).
