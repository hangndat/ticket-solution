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
