# Journey mobile LCP re-measurement — SHA 863c389e

Context: PR #1091 review (James) opened F03 High — the two mobile LCP screenshots in `.uat-artifacts` were actually 923x1059px, not 390x844, so the previously reported LCP (76ms VI / 72ms EN) could not be verified as a real mobile measurement. This re-measurement provides a verifiable-viewport mobile LCP reading.

## Tool / method
- Lighthouse CLI v13.6.0 (`npx lighthouse`), headless Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
- Explicit screen emulation: `--screenEmulation.mobile=true --screenEmulation.width=390 --screenEmulation.height=844 --screenEmulation.deviceScaleFactor=3`, `--form-factor=mobile`.
- Throttling: `--throttling-method=simulate` (Lighthouse's standard simulated mobile throttling: RTT 150ms, throughput ~1.6Mbps down, CPU slowdown 4x) — confirmed in each report's `configSettings.throttling`.
- Target: local production build (`next build && next start --port 3911`), not dev server.
- 3 runs per page (`/experience`, `/en/experience`).
- Threshold: LCP "good" <= 2.5s (Core Web Vitals).

## Viewport verification
Each report's `configSettings.screenEmulation` was `{"mobile":true,"width":390,"height":844,"deviceScaleFactor":3,"disabled":false}` and `configSettings.formFactor` was `"mobile"` — confirmed per run. The run 1 final screenshot had pixel ratio 230x498 ≈ 390x844 (same aspect ratio, downscaled thumbnail). One raw sample is retained below; the other reports and screenshot remain in the Git history of PR #1091.

## Results (LCP, ms)

| Page | Run 1 | Run 2 | Run 3 | Median |
|---|---|---|---|---|
| `/experience` (VI) | 5788.1 | 7391.0 | 7462.9 | **7391.0 ms** |
| `/en/experience` (EN) | 7387.8 | 7467.1 | 7461.7 | **7461.7 ms** |

Both medians are **~3x the 2.5s "good" threshold** and nowhere near the 76ms/72ms previously reported. The earlier figures were not valid mobile measurements.

## Files
- `experience-run2.report.json` — one retained Lighthouse sample for the VI median.
- The results table above records all six runs; other raw reports remain available in the Git history of PR #1091.

## Status
LCP exceeds the acceptable threshold on both locales. Per task instructions, work stops here — no source changes made — and the coordinator has been notified for a decision on next steps (investigate regression vs. accept finding as-is).
