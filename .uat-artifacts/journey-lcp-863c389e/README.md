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
Each `*.report.json`'s `configSettings.screenEmulation` is `{"mobile":true,"width":390,"height":844,"deviceScaleFactor":3,"disabled":false}` and `configSettings.formFactor` is `"mobile"` — confirmed per run (see raw JSON). `experience-run1-final-screenshot.png` extracted from the report's `final-screenshot` audit has pixel ratio 230x498 ≈ 390x844 (same aspect ratio, downscaled thumbnail — Lighthouse embeds a scaled preview, not a full-res capture).

## Results (LCP, ms)

| Page | Run 1 | Run 2 | Run 3 | Median |
|---|---|---|---|---|
| `/experience` (VI) | 5788.1 | 7391.0 | 7462.9 | **7391.0 ms** |
| `/en/experience` (EN) | 7387.8 | 7467.1 | 7461.7 | **7461.7 ms** |

Both medians are **~3x the 2.5s "good" threshold** and nowhere near the 76ms/72ms previously reported. The earlier figures were not valid mobile measurements.

## Files
- `experience-run{1,2,3}.report.json` / `.report.html` — raw Lighthouse reports, VI page.
- `en-experience-run{1,2,3}.report.json` / `.report.html` — raw Lighthouse reports, EN page.
- `experience-run1-final-screenshot.png` — thumbnail extracted from run1 report, aspect-ratio-verified 390x844.
- `*.stderr.log` — Lighthouse CLI stderr per run (non-fatal warnings only).

## Status
LCP exceeds the acceptable threshold on both locales. Per task instructions, work stops here — no source changes made — and the coordinator has been notified for a decision on next steps (investigate regression vs. accept finding as-is).
