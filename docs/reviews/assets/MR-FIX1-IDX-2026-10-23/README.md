# MR-FIX1-IDX — Issue #859 fix round 2/2

| Item | Detail |
| --- | --- |
| Finding | **MR-R02** — mislabeled / wrong-dimension O13 superseded banner PNG |
| Script | `capture-o13-banner.sh` · probe `probe-o13-banner.js` |
| Output (canonical IDX pack) | `../MR-IDX-2026-10-23/o13-index-superseded-banner-390.png` + `.json` |
| Measured | `innerWidth` 390 · `innerHeight` 844 · DPR 1 · PNG 390×844 |

Re-run: `bash capture-o13-banner.sh` with docs server on `:57277`.
