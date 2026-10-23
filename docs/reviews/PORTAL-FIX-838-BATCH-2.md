# #838 / PR 841 — Batch sửa 2/2 (F01–F03)

| Field | Value |
| --- | --- |
| Worker | Higo · web |
| Base SHA (dispatch) | `23e7d15288c0ad75f65432f2d78a451e33d27598` |
| Commit (local, post-fix) | `e8e0320` |
| Lượt sửa | **2/2** |
| Verdict worker | **Đã sửa — chờ reviewer revalidate** (không đổi James FAIL độc lập) |

## Findings

| ID | Trạng thái | Thay đổi / evidence |
| --- | --- | --- |
| **F01** | Đã sửa chờ xác minh | Probe `probe-pa01-runtime.js` đọc `vemoki_portal_locale` (cookie + localStorage), `meta.htmlLang`, `accountLabel`. Web B assets mislabeled đổi tên `provenance-stale-en-rendered-*`; `PORTAL-FIX-838-WEB-A/B.md` cập nhật SHA/provenance. Final captures dùng setup cookie+LS + assert trước PNG (`final/evidence/*-assert.json`). |
| **F02** | Đã sửa chờ xác minh | `apps/portal/src/i18n/messages.ts` — keys PA-02: notify filter alert, codes hint/title, import dispatch notice, jobType/codeColumn, catalog revision label, commit labels, preview dispatch copy (VI/EN). |
| **F03** | Đã sửa chờ xác minh | Xóa 3 test mirror (`globals-reduced-motion`, `guests-import-filters`, `portal-pa01-header`). Browser matrix `docs/reviews/assets/portal-fix-838/final/` + `capture-batch2-final.sh`. PA-06: `orca exec set media reduced-motion reduce` → `matchMedia` true; CSS fixture `portal-surface-loading__spinner` → `animationName: none`. PA-05 export tab: `inputAria`/`placeholder` VI trên tab active. |

## Checks (worktree sau sửa)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal lint` | PASS |
| `pnpm --filter @ticket/portal test` | PASS 131/131 |
| `pnpm --filter @ticket/portal build` | PASS |
| `ui-evidence-check.sh` (9 PNG staged `/tmp/portal-fix-838-ui-check`) | PASS — không trùng hash |
| `ui-chrome-wrap-probe` (nhúng JSON PA-01 final) | `chrome.issues: []` trên mẫu đã chụp |

## Runtime

| Item | Value |
| --- | --- |
| Portal | `http://127.0.0.1:3413` PID `47426` (rebuild từ checkout portal-audit, log append `/tmp/portal-fix-838-runtime/portal-3413.log`) |
| Next BUILD_ID | `9b22e17b2b2b771eeab42f6665c3430654547bc7` |
| API / DB | Giữ coordinator (`3418` / `76023`) — không restart |
| Capture script | `docs/reviews/assets/portal-fix-838/final/capture-batch2-final.sh` |

## Evidence matrix (final/)

| Artifact | Ghi chú |
| --- | --- |
| `final-pa01-*` 390/430/768/1024/1440 + tenant2 | VI+EN; probe `htmlLang` khớp `requestedLocale` |
| `final-locale-journey-vi.png` + JSON | Account menu + hover submenu (khi ref tìm được) |
| `final-pa03-filters-import-vi.json` | Import group aria; filters không trên export |
| `final-pa05-export-vi.json` | Tab Xuất active; aria/placeholder VI |
| `final-pa04-gate-vi.json` | Gate copy + UTC snippet |
| `final-pa06-*` | reduced-motion DOM + CSS spinner fixture |

## Limits

- Keyboard full journey (tenant→event→account tab order) chỉ spot-check focus tenant; chưa ma trận phím đầy đủ.
- **F04** tab clip 390px không sửa (nit ngoài batch).
- Locale journey qua UI submenu vẫn phụ thuộc hover AntD; matrix chính dùng cookie+LS+reload (documented trong capture script).
- Không push/PR/merge; James revalidate exact SHA commit mới.
