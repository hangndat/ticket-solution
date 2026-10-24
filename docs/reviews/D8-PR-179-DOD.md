# DoD Review — PR #179 (D8 web theme · #124–#126)

**PR:** https://github.com/hangndat/ticket-solution/pull/179  
**Branch:** `hangndat/d8-web-theme` → `main`  
**Issues:** [#124](https://github.com/hangndat/ticket-solution/issues/124) (story), [#125](https://github.com/hangndat/ticket-solution/issues/125) (T1), [#126](https://github.com/hangndat/ticket-solution/issues/126) (T2) · Epic [#119](https://github.com/hangndat/ticket-solution/issues/119)  
**Reviewer / session:** Cursor DoD reviewer độc lập (≠ implementer) · Orca terminal `term_da52f35b-b5c4-4e1b-aecd-615ea68d6da4` · task `task_ee85415e3460` · dispatch `ctx_f1c0195e09ea` · worktree `dod-d8-179`  
**Ngày review:** 2026-10-17  
**Phạm vi chỉnh sửa reviewer:** chỉ `docs/reviews/*` — không sửa `apps/web` product; **không** self-merge.

## Exact SHA đối chiếu

| Vai trò | SHA (full) | Xác minh |
| --- | --- | --- |
| **Commit đang duyệt (tip PR lúc spawn)** | `bf4b1fb0d1af13f3e6f74d67d6d6ff9b84a09e8d` | `git rev-parse HEAD` + `git log -1` khớp; PR tip lúc review |
| Commit message | `feat(web): D8 tenant theme provider + wordmark surfaces` | Refs #124 #125 #126 #119 |
| Implementer | hangndat (khác session reviewer) | `git log -1 --format='%an %ae'` |

> Revalidation: mọi commit hành vi mới **sau** SHA trên → bắt buộc DoD lại; không tái dùng verdict này.

## Phạm vi ownership

Diff `main...bf4b1fb` chỉ:

- `apps/web/**` (ThemeProvider, branding parse/load, BFF public branding, chrome wordmark, tests)
- `docs/reviews/d8-web-uat-notes.md` + `docs/reviews/d8-uat/web/*.png`

**PASS** — một ownership slice web; không trộn BE/iOS; không secrets/`.env`/credential thật trong diff.

## Checklist DoD

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| 1 | #125 T1 — Load branding → CSS vars / ThemeProvider + fallback Vemoki | **PASS** | `ThemeProvider`, `brandingToCssVars` (`--ink/--paper/--signal/--focus/--brand`), root layout áp Vemoki trên `<html>`; `loadTenantBranding` / BFF fail-closed → `source=vemoki-default` |
| 2 | #126 T2 — Logo/wordmark trên surfaces chính | **PASS** | `Wordmark` / `BrandMark` / `FooterBrand` / `HeroWordmark` đọc context; event page `brandingFromEventBrand` + nested `ThemeProvider`; UAT screenshots home/admin/gate/demo events |
| 3 | #124 story — theming guest/admin/gate không phá brand test D6 | **PASS** | Token names D6 giữ nguyên; unit assert O09 colors; demo event themes vẫn qua fixture + CSS theme class |
| 4 | Security-sensitive: hex + logoUrl sanitize | **PASS** | `parseHex` allowlist `#RGB/#RRGGBB/#RRGGBBAA`; `sanitizeLogoUrl` chỉ https hoặc root-relative (reject `javascript:`, `data:`, `http:`, `//`, `..`); unit tests cover reject paths |
| 5 | BFF public branding proxy fail-closed | **PASS** | `GET /api/bff/public/tenants/[tenantSlug]/branding` — slug validate 422; upstream miss/invalid → **200** + Vemoki DTO; `Cache-Control: private, no-store` |
| 6 | Evidence / UAT headless (không EAS Cloud) | **PASS** | `docs/reviews/d8-web-uat-notes.md` + 5 PNG tracked; Playwright headless notes; không EAS |
| 7 | CI xanh trên exact SHA | **PASS** | Check-runs trên `bf4b1fb…`: `web` SUCCESS, `ci` SUCCESS, `changes` SUCCESS, `turbo-persist` SUCCESS (BE/mobile/db skipped — đúng slice) |
| 8 | Reviewer độc lập + exact SHA artifact | **PASS** | Artifact này; session Orca ≠ implementer |

## Checks đã chạy (trên SHA `bf4b1fb0d1af13f3e6f74d67d6d6ff9b84a09e8d`)

```bash
git rev-parse HEAD
# bf4b1fb0d1af13f3e6f74d67d6d6ff9b84a09e8d

cd apps/web
pnpm exec tsx --test tests/branding-theme.test.ts   # 7/7 pass
pnpm test                                           # 133/133 pass
pnpm typecheck                                      # pass (sau pnpm --filter @ticket/contracts build local)
pnpm lint                                           # pass
pnpm build                                          # pass — route branding BFF xuất hiện trong route table

gh api repos/hangndat/ticket-solution/commits/bf4b1fb0d1af13f3e6f74d67d6d6ff9b84a09e8d/check-runs
# web/ci/changes/turbo-persist → success
```

UAT screenshots đã có sẵn trên SHA (không re-run Playwright trong session review; visual spot-check `d8-uat/web/d8-home.png` + `d8-uat/web/d8-event-sunburst.png`: home Vemoki lockup; event chrome wordmark tenant/demo).

## Findings

### Không blocking

1. **Event page `--brand` raw override:** `EventPage` set `--brand` từ `event.brand.primaryColor` sau `brandingToCssVars` (đã parseHex). Fixture demo là nguồn tin cậy; nếu fixture lệch hex thì CSS nhận raw — rủi ro thấp, trong phạm vi demo.
2. **Footer platform trên event route:** `FooterBrand` nằm ở root layout (Vemoki) trong khi nav event dùng nested `ThemeProvider` (demo-event) — footer có thể vẫn hiện `vemoki` khi wordmark event đã đổi. Khớp giới hạn “platform chrome = Vemoki” đã ghi trên PR; không phá AC T2 (surfaces chính / chrome đã themed).

### Known gaps (chủ đích — không FAIL)

| Gap | Ghi chú |
| --- | --- |
| S1 BE `GET …/branding` (#122) song song | Web dùng path đề xuất + fallback Vemoki; chrome không blank khi upstream thiếu |
| `logoAssetId` chưa resolve URL công khai | Chỉ render `<img>` khi `logoUrl` allowlisted; asset id giữ DTO |
| Tenant slug chưa resolve trên home/admin/gate | Surfaces platform dùng Vemoki cho đến khi slug được đưa vào `ThemeProvider` |
| D8-S2 code complete ≠ epic #119 milestone PASS | White-label epic còn slice khác |

Không phát hiện secrets, mock auth trên production path, hoặc vượt ownership slice.

## Verdict

**PASS with known gap**

Đủ DoD cho #124 / #125 / #126 trên SHA `bf4b1fb0d1af13f3e6f74d67d6d6ff9b84a09e8d`. Gap còn lại là chủ đích (BE S1 song song, logoAssetId, platform slug). Coordinator có thể merge PR #179 khi CI vẫn xanh trên tip (revalidate nếu tip ≠ SHA trên); reviewer **không** merge.

## Việc còn lại (coordinator)

- Merge PR #179 sau khi xác nhận tip vẫn = SHA đã duyệt **hoặc** re-spawn DoD nếu có commit hành vi mới.
- Project #3: sau merge + CI xanh → có thể đặt #124/#125/#126 → `Hoàn thành` theo DoD board rules.
- Không tuyên bố pilot ready / store submission từ PR web theme này.
