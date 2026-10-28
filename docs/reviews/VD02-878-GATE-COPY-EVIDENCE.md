# #878 residual Web Gate copy — evidence (O23)

- **SHA code:** `3b7b4388` (`origin/main`, sau #1015/#1016). Không restore `apps/web/app/gate`.
- **Runtime local:** `GET /gate` → **308** `Location: /` (không scanner/camera).
- **Marketing HTML:** không `href` `/gate`, không `app.vemoki.com/gate`. Copy cổng: «Quét trên app Staff iOS» / «Scan on the Staff iOS app».
- **Viewport (local `/marketing`, `/marketing/en`):** 390 + 1440, VI + EN. PNG gitignored: `apps/web/.uat-artifacts/vd02-878-2026-10-28/` (`vd02-878-{vi,en}-{390,1440}.png`). Ảnh đính Issue.
- **Không FAIL:** 308→`/` là leftover O23/#788. Overlay Next.js «1 issue» trên `next dev` không phải copy live scanner.

## Known leftover (không sửa lượt này)

`apps/web/src/portal/dual-run.ts` `job === 'gate'` vẫn map `${eventBase}/gate` (sẽ 308 về `/`). Parent: screenshots/docs only.

## Verdict

Copy marketing residual **PASS** trên SHA trên. Không Hoàn thành Epic #874 / Pilot #1008 từ evidence này.
