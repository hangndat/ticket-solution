# VCX-926 · `20261026T2100Z-noah-next` — báo cáo chạy

| Mục | Giá trị |
| --- | --- |
| testedSHA | `5136c92a6b1d2c52d95399a096002f44fb910756` |
| Verdict runtime #926 | **PASS** |
| Runner | Noah |

## Tóm tắt

Ma trận F01/F05 trong AC #926 đạt trên stack `uat926.localhost:3018` / API `:3546`. report-only Gate **allowed** (khác packet `20261026T0956Z-noah` do harness/origin). Scanner truy cập trực tiếp `/gate` bị từ chối — **đúng kỳ vọng** theo O23 (Portal chỉ `report.read`; `gate.confirm` = iOS Staff), không tính fail F05.

## Artifact chính

- `f01-f05-probe-results.json` — probe thô (một số dòng Scanner dùng heuristic cũ; xem `scanner-gate-viewports.json` cho AC Scanner)
- `scanner-gate-viewports.json` — PASS expected-deny @ 390/1024/1440
- `ports-orca.json`
- PNG theo persona/route

## Không làm

Sửa code, DB #928, nới quyền Scanner trên Portal.
