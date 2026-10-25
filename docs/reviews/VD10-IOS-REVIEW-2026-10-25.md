# VD10 — iOS design system review (attendee + staff chrome)

**Ngày:** 2026-10-25 · **Reviewer:** James (`reviewer-uiux`, dispatch `task_e5e4d945b5ed`)  
**Implementer (khác reviewer):** Zico  
**Exact SHA:** `a0d94d8cabad2eb2db35725a5b0ea225fc180494`  
**Worktree:** `vd09-marketing-neon` · **Scope:** `apps/mobile` commits `94b62fd0`, `6d18b16d`, `a0d94d8c` (+ logo kit `5dc0c05a` / `e9355e9c` trong lịch sử slice) since `227dfdd5`  
**SoT:** `docs/reviews/VD10-DESIGN-SYSTEM-AUDIT-2026-10-25.md` (`DS-IOS-01`…`06`), **DEC-01** (attendee primary gradient restrained, aligned web `attendeePrimary`), new Vemoki logo/glyph policy

## Tóm tắt điều hành

Batch B-IOS-UI đã **đóng các finding High/Med** trong audit (`destructive`/`deny` → `#B3213A`, gate map `colors.deny`, primary CTA gradient DEC-01, focus 3px, card CTA dùng shared `Button`). Typecheck và full unit test suite mobile **pass** trên SHA này; `expo-linear-gradient` `~58.0.3` khớp Expo SDK 58. Evidence simulator @ SHA (script `apps/mobile/scripts/capture-vd10-screenshots.sh`) cover feed, published detail, redeem tab, fixture event detail, staff access deny — **chưa** cover ví/QR, quét cổng admit/deny/offline, account, Dynamic Type lớn, hay pressed/disabled/loading runtime.

**Verdict:** **PASS with known gap** (DS batch mergeable; pilot/UAT đầy đủ cần bổ sung journey evidence).

---

## Độc lập & phương pháp

| Mục | Chi tiết |
| --- | --- |
| Reviewer ≠ implementer | James vs Zico |
| Static | Diff `227dfdd5..a0d94d8c`, đọc `button.tsx`, `colors.ts`, `attendee-primary.ts`, gate chrome, `TenantLogo`, `parse`/`resolve` glyph, `screenshot-capture.ts`, `app.config.ts` |
| Automated | `pnpm --filter @ticket/mobile typecheck`; `pnpm --filter @ticket/mobile test` (0 fail) |
| Runtime | Đối chiếu `docs/reviews/assets/vd10-ios/*.png` (capture @ SHA implementer); reviewer relaunch simulator — Metro không chạy → red screen; không ghi đè evidence lỗi |
| Evidence reviewer | Copy verified vào `docs/reviews/assets/vd10-ios-review/` (5 PNG, `ui-evidence-check.sh` → OK, không trùng hash) |

### Evidence (SHA `a0d94d8c`)

| File | Journey / state | MD5 (partial) |
| --- | --- | --- |
| `ios-events-feed.png` | Tab Sự kiện, published card + primary CTA | `ef57daf8…` |
| `ios-event-detail-fixture.png` | Published MFest detail, redeem CTA | `7a215cd5…` |
| `ios-redeem-global.png` | Tab Đổi mã (global redeem) | `c7f335e1…` |
| `ios-ticket-detail-fixture.png` | Fixture event detail (demo, chưa QR ví) | `e6c1bb87…` |
| `ios-staff-access-deny.png` | Deep link staff, fail-closed deny + `Notice` tone deny | `06db4cc8…` |

---

## Đối chiếu audit `DS-IOS-*`

| Audit ID | Trạng thái @ `a0d94d8c` | Ghi chú |
| --- | --- | --- |
| **DS-IOS-01** | **Closed** | `destructive` border/label/spinner → `colors.deny` (`#B3213A`), không `colors.accent` |
| **DS-IOS-02** | **Closed** | `colors.deny` cố định `#B3213A`; gate toast/status/history dùng `colors.deny` |
| **DS-IOS-03** | **Closed (partial)** | `PublishedEventCard` dùng shared `Button` primary; layout card vẫn custom (chấp nhận handoff) |
| **DS-IOS-04** | **Closed** | `LinearGradient` + `attendeePrimaryGradient` (signal → color-mix 88% ink), DEC-01 |
| **DS-IOS-05** | **Closed** | `focusRing` `borderWidth: 3` |
| **DS-IOS-06** | **Closed** | Simulator PNG @ SHA (vd10-ios + review mirror) |

### DEC-01 & logo

- Gradient primary **restrained** (góc chéo signal→ink); trên screenshot gần solid — đúng mix 88% ink, contrast chữ trắng trên nút OK trong evidence.
- Default theme: `signalMark` rỗng (không ↗ mặc định); tenant `signalGlyph` parse/resolve có test.
- Demo `banner.png` / `logo.png` refresh @ `a0d94d8c`; feed/detail **không** còn V chạm mép card (banner có padding trong asset) — coordinator concern **mitigated cho demo pack**; `EventBanner` vẫn `resizeMode="cover"` cho URL remote (xem R-02).

### `EXPO_PUBLIC_UAT_SCREENSHOT`

- Chỉ `LogBox.ignoreAllLogs` khi `1`/`true` (`src/uat/screenshot-capture.ts`); import sớm trong `_layout` **không** đổi navigation/auth khi flag absent. Không leak hành vi production.

### Native dep

- `expo-linear-gradient` `~58.0.3` với `expo` `58.0.12` — khớp SDK 58.

### Dark mode / Dynamic Type

- `app.config.ts`: `userInterfaceStyle: 'light'` — dark mode **không** trong scope product hiện tại (limitation, không finding).
- Dynamic Type XL / accessibility text sizes: **chưa** runtime test (gap R-01).

---

## Findings (`VD10-IOS-R-xx`)

| ID | Sev | Loại | Vấn đề | Tác động | Evidence / tái hiện | Đóng khi |
| --- | --- | --- | --- | --- | --- | --- |
| **VD10-IOS-R-01** | **Med** | a11y / runtime | Thiếu capture (hoặc reviewer verify) cho: ví **ticket detail + QR**, staff **scan admit/deny/offline** sticky, tab **Tài khoản** (signed-in/out), trạng thái **pressed/disabled/loading** trên `Button`, **Dynamic Type** lớn | Không chứng minh contrast/CTA/hierarchy trên journey bắt buộc VD-05/06; pilot sign-off thiếu | Chỉ 5 PNG trên; `ios-ticket-detail-fixture` là fixture đăng ký, không QR; reviewer simulator lỗi Metro khi relaunch | Bộ screenshot axe + accessibility size XL trên cùng SHA |
| **VD10-IOS-R-02** | **Low** | chrome | `EventBanner` luôn `resizeMode="cover"` (`event-media.tsx`) | Banner tenant tùy ý có thể crop artwork/logo sát mép card (risk sau demo asset fix) | Code + pattern cover; demo OK trong `ios-events-feed.png` | `contain`/`cover` policy theo handoff hoặc safe-zone asset guide |

Không phát hiện High chặn merge cho batch DS-IOS. Staff deny dùng `Notice` accent deny + `AttendeeCta` primary cho «Về Sự kiện» — đúng hierarchy (navigation, không destructive).

---

## Checks

| Check | Kết quả |
| --- | --- |
| SHA | `a0d94d8cabad2eb2db35725a5b0ea225fc180494` |
| `pnpm --filter @ticket/mobile typecheck` | Pass |
| `pnpm --filter @ticket/mobile test` | Pass (0 fail) |
| `ui-evidence-check.sh` `docs/reviews/assets/vd10-ios-review` | OK (5 files) |
| Verdict | **PASS with known gap** (`VD10-IOS-R-01` Med evidence; `R-02` Low) |

---

## Limitations

- Reviewer không chạy lại full axe capture (Metro packager down trên relaunch); tin capture implementer @ SHA + static review.
- Không EAS / thiết bị thật.
- Web/portal VD10 review song song (Mira) — ngoài scope file này.

---

## Revalidation — solid primary violet @ `4f3e4109`

**Ngày:** 2026-10-25 · **Reviewer:** James (`reviewer-uiux`, dispatch `task_0dd9d352ed3b`)  
**Implementer (khác reviewer):** Zico  
**Exact SHA:** `4f3e41097042f1505a2bc8ee46960a8ff6999da4`  
**Diff:** `a0d94d8c..4f3e4109` · **Worktree:** `vd09-marketing-neon` · **Scope:** `apps/mobile` (read-only)  
**Quyết định sản phẩm:** primary attendee **solid** `#7C4DED`; đỏ `#B3213A` chỉ semantic (deny/destructive); admit gate `#1B7F4A` giữ semantic.

### Tóm tắt điều hành

Commit `4f3e4109` bỏ `LinearGradient` / `attendee-primary.ts`, map `colors.accent` và `colors.signal` → `brand.primary` (`#7C4DED`), primary `Button` solid + chữ `onAccent` trắng; `colors.deny` vẫn `#B3213A`. Typecheck và full unit test mobile **pass** trên SHA này. Icon tab «Sự kiện» **xanh đậm** trong `docs/reviews/assets/vd10-ios/ios-events-feed.png` **không** phải token `admit` cũ: nguồn là `NativeTabs tintColor={theme.signal}` sau `EventsScreen` gọi `applyBranding` với `primaryColor` catalog đầu tiên (demo MFest `#245B47`), trong khi CTA dùng `colors.accent` tĩnh `#7C4DED` — lệch quyết định primary violet thống nhất trên attendee chrome.

**Verdict @ `4f3e4109`:** **PASS with known gap** (migration violet đúng trên CTA/tokens tĩnh; tab tint tenant vs platform primary — `VD10-IOS-R-03`).

### Đối chiếu thay đổi mobile

| Hạng mục | @ `4f3e4109` | Ghi chú |
| --- | --- | --- |
| Primary CTA | **OK** | `button.tsx`: `backgroundColor: colors.accent` (`#7C4DED`), không gradient |
| `LinearGradient` | **Removed** | Không import trong `apps/mobile/src`; dep `expo-linear-gradient` vẫn trong `package.json` (orphan, Low) |
| `colors.deny` / destructive | **OK** | `#B3213A`; `account-grouped-section` destructive label → `colors.deny` (không `brand.signal` đỏ marketing) |
| Gate admit / deny | **OK** | `colors.admit` `#1B7F4A`, `colors.deny` `#B3213A`; toast/status/history/staff-access deny không đổi semantic |
| Contrast trắng / violet | **OK** | `#FFFFFF` on `#7C4DED` ≈ **5.07:1** (AA body); pressed `opacity: 0.85`, disabled `0.45` — giữ pattern |
| Tab active tint | **Gap** | `(tabs)/_layout.tsx` → `theme.signal`; runtime tenant override, không `brand.primary` |

### Tab tint — nguồn màu xanh coordinator

1. `apps/mobile/src/app/(tabs)/_layout.tsx`: `<NativeTabs tintColor={theme.signal}>`.
2. `defaultThemeTokens()` @ SHA này: `signal: vemokiBrand.primary` (`#7C4DED`) — guest chưa branding → tab violet.
3. `EventsScreen` (`events.tsx` L201–214): khi catalog `ready`, `applyBranding({ primaryColor: first.brand.primaryColor, … })` → `resolveThemeTokens` gán `signal: branding.primaryColor`.
4. Demo / catalog MFest: `primaryColor: '#245B47'` (`demo-events.ts` / API) → tab active **xanh đậm**, không liên quan pill «Đã xuất bản» (`colors.admit` trên card).
5. CTA card «Xem sự kiện» vẫn `#7C4DED` vì `colors.accent` đọc `brand.primary` tĩnh, **không** theo `ThemeProvider`.

Các tab khác (Đổi mã, Tài khoản) dùng cùng `tintColor` — không token stale riêng; inactive theo chrome hệ thống.

### Findings bổ sung (`VD10-IOS-R-xx`)

| ID | Sev | Loại | Vấn đề | Evidence | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| **VD10-IOS-R-03** | **Med** | brand / chrome | Tab attendee tint theo tenant `primaryColor` (`theme.signal`) trong khi product primary violet cố định trên CTA (`colors.accent`) | `ios-events-feed.png` + `(tabs)/_layout.tsx`, `events.tsx` applyBranding, `resolve.ts` | Tab tint dùng `brand.primary` / token product hoặc policy tenant chỉ logo/wordmark, không tab |
| **VD10-IOS-R-04** | **Low** | deps | `expo-linear-gradient` còn dependency sau khi bỏ gradient | `package.json` | Gỡ dep khi coordinator cho phép slice cleanup |

`VD10-IOS-R-01`, `R-02` từ review @ `a0d94d8c` **vẫn mở** (evidence journey / EventBanner).

### Cập nhật audit `DS-IOS-04`

@ `4f3e4109`: **Closed** — primary attendee **solid** `#7C4DED` (thay gradient DEC-01); marketing `brand.signal` (`#E11D48`) không còn drive product CTA.

### Checks @ `4f3e4109`

| Check | Kết quả |
| --- | --- |
| SHA | `4f3e41097042f1505a2bc8ee46960a8ff6999da4` |
| `pnpm --filter @ticket/mobile typecheck` | Pass |
| `pnpm --filter @ticket/mobile test` | Pass (0 fail) |
| Verdict | **PASS with known gap** (`R-03` Med tab/tenant vs violet; `R-01` evidence; `R-04` Low dep) |
