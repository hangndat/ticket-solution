# UAT evidence — O26-PR1 (#975)

**Code SHA:** `d0ecaec66e3bef0ee9ab918c3bc02787099eb22e` (branch `hangndat/vcx-975-antd-foundation`)  
**Build ID:** `7Qfwb2SQSHT43LNsWaG_L`  
**Origin:** `http://uat975.localhost:3017`

## Screenshot standard (F-977-ROOT-03)

| Field | Rule |
| --- | --- |
| **CSS viewport** | Suffix `390x844` / `1024x900` / `1440x900` = `innerWidth`×`innerHeight` asserted before capture |
| **PNG IHDR** | Must equal CSS viewport when `devicePixelRatio === 1` |
| **Capture** | Orca `agent-browser screenshot <path>` (viewport, not `--full`) after `set viewport` + retry if pane drift |
| **Manifest** | Each shot: `screenshot.pngWidth/Height`, `pixelPass`, `dpr` in `uat-results.json` |
| **Gate** | `pngPixelPassAll: true` required — no PASS if IHDR ≠ suffix (e.g. 1462×1834 pane capture) |

**Giới hạn Orca:** nếu CSS viewport chưa khóa, embedded pane có thể chụp bitmap lớn hơn (vd. 1462×1834 @ DPR 2). Driver retry `applyViewport` + đọc IHDR; run fail (`exit 3`) khi `pixelPass: false`.

Verify local: `python3` đọc IHDR hoặc `sips -g pixelWidth -g pixelHeight` trên từng PNG.

## Owner / fixture

- `ownerMatrixPass: true` — `#portal-main`, title `Sự kiện`, Pro table, không `Không có quyền`
- Fixture read-only: `.local-dev/portal975/verify-fixture-readonly.sh`

**Migration #975 chưa đóng** — PR1 foundation only.
