# #838 / PR 841 — DoD + UX review (PA-01–PA-06)

| Field | Value |
| --- | --- |
| Reviewer | James · `dod+ux` (session độc lập implementer) |
| Issue / PR | [#838](https://github.com/hangndat/ticket-solution/issues/838) · [PR 841](https://github.com/hangndat/ticket-solution/pull/841) |
| Exact SHA | `8014fc30796c25243e954e2d0e6c325de3e03f01` (`hangndat/portal-audit`) |
| Diff base | `b6ad2b0de3268511e3df04417589d919de34100c` |
| Scope | `apps/portal/**`, PD/plan/evidence #838; không mở backend/auth/RBAC/lookup/palette/RSC/table refactor |
| Policy | Incumbent O18/O22 staff AntD — không áp consumer shadcn checklist |
| Lượt sửa tự động | **1/2** (PD specimen batch trước); đây là review đầu toàn scope |
| Runtime | Fixture `portal-fix-838`: API `:3418`, portal prod `:3413`, env `/tmp/portal-fix-838-runtime/env.json` (không commit) |

## Verdict

| Gate | Kết luận | Chặn merge |
| --- | --- | --- |
| **DoD** | **FAIL** | **Có** — AC bắt buộc PA-01 (VI) và PA-02 chưa đạt trên runtime; evidence Web B cũ gắn SHA sai |
| **UI/UX** | **FAIL** | **Có** — locale VI không chứng minh; jargon vận hành còn trên luồng Guests; ma trận 768/keyboard/motion DOM chưa đủ |

**CI (SHA tip):** `./scripts/gh-dod-evidence.sh 841` → `portal` **success**, `ci` **success**, `changes` **success** (2026-10-23). CI xanh **không** bù acceptance runtime thiếu.

## Checks (worktree `8014fc30`)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal lint` | PASS |
| `pnpm --filter @ticket/portal test` | PASS 134/134 |
| `pnpm --filter @ticket/portal build` | PASS |
| Runtime UAT (Orca browser, staff fixture) | Thực hiện — xem assets `docs/reviews/assets/portal-fix-838/review/` |
| `ui-chrome-wrap-probe` (nhúng trong JSON capture) | `chrome.issues: []` trên mẫu đã chụp |
| `ui-evidence-check.sh` | PASS trên PNG review (không trùng hash) |
| Keyboard full journey | **Không kiểm** (giới hạn phiên + Orca click submenu) |
| MFA production / destructive export / full role matrix | **Không claim** (theo spec) |

## AC snapshot (PA-01–06)

| AC | Runtime / code | Ghi chú |
| --- | --- | --- |
| PA-01 header 390/430/768/1024/1440, VI+EN, context/account | **Partial** | Layout probe: `brandLines=1`, `pageOverflowX=false`, 768 `sideBySide=true` (`review/evidence/attempted-vi-rendered-en-guests-768x1024.json`). **VI locale không active** (F01). Tab Import bị cắt chữ trái trên 390 (`attempted-vi-rendered-en-guests-390x844.png`). Keyboard chưa probe. |
| PA-02 copy vận hành, hết jargon luồng chính | **FAIL** | Alert **Dispatch preview does not reserve quota…** trên Guests Import (`attempted-vi-rendered-en-guests-390x844.png`). Keys jargon còn trong `messages.ts` + panels (F02). |
| PA-03 filters chỉ Import; tab/deeplink | **Partial (code + ảnh)** | Filters trong tab Import (ảnh). `guests-import-filters.test.ts` chỉ `readFile`/regex — không chứng minh hành vi tab/back (F03). Hash `#export` chưa xác minh bằng click tab thật. |
| PA-04 locale as-of VI/EN, UTC, invalid | **Partial** | `formatReportAsOf` + unit test `ops-report.test.ts`; Gate gắn ` UTC` trong `gate/page.tsx`. Chưa re-probe runtime Gate analytics trên SHA này. |
| PA-05 export accessible name + placeholder | **PASS (code)** | `export-panel.tsx` `aria-label={t('ops.export.exportIdAria')}`, placeholder i18n (`messages.ts`). Chưa mở tab Export bằng interaction Orca (click tab fail). |
| PA-06 reduced-motion spinner | **Partial** | CSS `@media (prefers-reduced-motion: reduce)` + `animation: none` (`globals.css`). `globals-reduced-motion.test.ts` chỉ đọc file. Không có spinner trên Guests để đo `getComputedStyle` runtime. |

## Findings (ổn định)

| ID | Loại | Chặn merge | Mức | Tóm tắt |
| --- | --- | --- | --- | --- |
| **F01** | thiếu evidence / AC | **Có** | blocker | **Locale VI không đạt trên runtime.** Mọi JSON review ghi `meta.htmlLang: "en"` dù `localeActive: "vi"`. Probe PA-01 đọc cookie sai tên (`portal_locale` thay vì `vemoki_portal_locale` — `probe-pa01-runtime.js`). Ảnh “VI” vẫn EN: Organization/Events, “Dispatch preview…”, tab EN. Web B handoff SHA `efeffdb…` ≠ SHA bàn giao `8014fc30`. |
| **F02** | AC / copy | **Có** | blocker | **Jargon wave/protocol còn hiển thị** (đúng coordinator input): `notify.acceptedDelimitedFilters`, `ops.codes.lookupHint`, `ops.h_1bq4c1u`, `ops.import.dispatchPreviewNotice`, `ops.import.jobType`, `ops.import.codeColumn` — dùng trong `notifications-panel.tsx`, `codes-panel.tsx`, `import-invitations-panel.tsx`. Luồng Guests Import hiển thị dispatch notice (ảnh). |
| **F03** | thiếu evidence / test | **Có** (acceptance) | should-fix → chặn | Ma trận bắt buộc chưa đủ: keyboard focus order; reduced-motion **DOM**; tab Export/Notifications bằng **control click** (Orca `click text=Export list` → `ok: false`); `portal-pa01-header`, `guests-import-filters`, `globals-reduced-motion` chỉ structural/regex — **không thay browser proof** (đúng policy task). |
| **F04** | UI polish | Không | nit | Tab label Import bị cắt ký tự đầu (“mport guests…”) trên 390px — kiểm tra overflow/tab width. |
| **F05** | đề xuất | Không | nit | Cập nhật probe runtime đọc `vemoki_portal_locale` và `html lang` sau `setLocale` để evidence khớp AC-C1. |

### F01 — chi tiết

- **Căn cứ:** Plan PA-01 “VI+EN”; coordinator note Web A/B JSON `localeCookie=en`.
- **Bằng chứng:** `review/evidence/attempted-vi-rendered-en-guests-390x844.json` (`htmlLang: en`); screenshot EN copy; `set_locale` Orca click `portal-locale-vi` không đổi `document.documentElement.lang` (thử `localStorage`/`cookie` vẫn `vemoki_portal_locale=en` sau navigation).
- **Điều kiện đóng:** Runtime capture với `html lang=vi`, nhãn `Tổ chức`/copy VI trên ≥390/768/1024; JSON ghi `vemoki_portal_locale=vi` + route; không dùng SHA stale.

### F02 — chi tiết

- **Căn cứ:** PA-02; audit #832 § copy vận hành.
- **Paths:** `apps/portal/src/i18n/messages.ts` (keys trên); panels import/notifications/codes.
- **Điều kiện đóng:** Chuỗi user-facing thay bằng copy vận hành VI/EN; giữ machine enums trong cell/status nếu cần; Guests Import không còn “Dispatch preview…” / G-N1 / H-C1 trên UI chính.

### F03 — chi tiết

- **Điều kiện đóng:** Browser evidence: 768 (đã có), tenant2 long names (ảnh `attempted-vi-rendered-en-tenant2-guests-390x844.png` — **pass** truncation), filter tab switch + back, export field aria khi tab Export active, `getComputedStyle` spinner với `prefers-reduced-motion: reduce` (emulate nếu Orca hỗ trợ), keyboard path tenant→event→account.

## Evidence paths

| Artifact | Path |
| --- | --- |
| Review PNG + JSON | `docs/reviews/assets/portal-fix-838/review/` + `review/evidence/*.json` |
| Web B batch (coordinator — SHA stale) | `docs/reviews/assets/portal-fix-838/web/` — **không dùng làm proof acceptance SHA `8014fc30` without revalidation** |
| Capture script (reviewer) | `docs/reviews/assets/portal-fix-838/review/capture-review.sh` |
| Handoff PD | `docs/design/portal-audit-fix-2026-10-23/README.md` |
| Plan | `docs/plans/PORTAL-AUDIT-FIX-PLAN-2026-10-23.md` |

## Điểm tích cực (không đủ PASS)

- Hai tầng header: `headerContentRender={false}` + `PortalContextStrip` (`portal-pa01-header.test.ts` structural).
- CI portal lint/test/build xanh trên SHA tip.
- Tenant/event **tenant2** route load, tên dài ellipsis (`attempted-vi-rendered-en-tenant2-guests-390x844.png`).
- Gate 1024/1440: `sideBySide=true`, `chrome.issues=[]` trong probe JSON.

## Limitations

- CRG workspace portal-audit: graph ticket trên checkout khác; review dựa **source + runtime** (graph limitation không đổi verdict).
- Orca browser: click submenu locale / tab ProCard không tin `ok` — đo DOM sau; không dùng Playwright/ComputerUse.
- Không restart Docker/API; không pilot-ready / physical device / MFA production.

## Checkpoint convergence

```text
Issue #838 · PA-01–06 · SHA b6ad2b0 → 8014fc30
Reviewer James · implementer khác · evidence file này
Lượt sửa: 1/2 (trước review) · Ngoại lệ: chưa
Findings mở: F01–F03 (blocker) · F04–F05 nit
Quyết định: FAIL — giao 1 lượt sửa (2/2) batch F01–F03; revalidate exact SHA mới
```

## Ghi chú coordinator sau bàn giao

F01 được phân loại **thiếu evidence**, chưa có bằng chứng kết luận chức năng đổi ngôn ngữ của portal bị lỗi. Coordinator đã mở được submenu Language bằng `snapshot` → `hover @ref` (aria-expanded false→true); click vào submenu dùng hover mặc định không đủ đổi ngôn ngữ. Batch sửa không được thay provider/auth chỉ để vượt lỗi automation. Các ảnh reviewer yêu cầu VI nhưng render EN đã đổi tên `attempted-vi-rendered-en-*`; JSON dùng `requestedLocale` và giữ `meta.htmlLang` thực đo. Đây là bằng chứng lần lập state thất bại, không phải ảnh VI hợp lệ. F01–F03 vẫn mở, chặn merge.
