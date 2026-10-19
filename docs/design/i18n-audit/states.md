# Locale UX — state matrix (Issue #566)

Bổ sung cho [`PD-I18N-HANDOFF.md`](./PD-I18N-HANDOFF.md). Chỉ state liên quan locale / copy consistency.

---

## Marketing (`apps/web/src/marketing`)

| State | Khi nào | UI / copy | `lang` | Test gợi ý |
| ----- | ------- | --------- | ------ | ----------- |
| ready_vi | Path `/`, `/privacy`, `/support` | `t('vi', …)` | `vi` | `data-testid` `privacy-vi` |
| ready_en | Path `/en…` | `t('en', …)` | `en` | `privacy-en` |
| switching | Click `LocaleSwitch` | Full navigation tới path đối ứng | Sau load | URL + lang |
| interest_hash | `#interest` trên sales | Form copy theo locale trang | Theo locale | Hash preserved AC-M2 |

**Error / empty:** Legal pages static copy — không async locale load.

---

## Portal (`apps/portal`)

| State | Khi nào | UI / copy | Ghi chú |
| ----- | ------- | --------- | ------- |
| ssr_default | Server render | `DEFAULT_PORTAL_LOCALE` (vi) | `layout.tsx` `html lang="vi"` |
| hydrating | `hydrated === false` | UI dùng state locale initial vi | Có thể mismatch 1 frame với stored en |
| ready | Sau `readStoredPortalLocale` | `t(locale, key)` | `document.documentElement.lang` |
| locale_vi | User chọn VI | Menu ✓ Tiếng Việt | `portal-locale-vi` |
| locale_en | User chọn EN | Menu ✓ English | `portal-locale-en` |
| missing_en_key | EN dict thiếu string | Fallback VI + dev warn | `t.ts` |
| unknown_key | Key không catalog | `[VI] key` | Không accept prod |

**Loading data (ops):** `interpretPendingList(..., locale)` — message theo locale param; không trộn với shell locale nếu truyền đúng.

---

## Product web — Redeem

| State | Kind (`RedeemUxKind`) | Title/detail source | Locale đợt 1 |
| ----- | --------------------- | ------------------- | ------------- |
| idle | — | Page intro VI | vi |
| verifying | `verifying` | `verifyingMessage()` | vi |
| polling | `polling` | `BY_CODE` / retry | vi |
| success | `success` | `successMessage` | vi |
| pending | `pending` | `pendingMessage` | vi |
| unknown | `unknown` | `unknownMessage` | vi |
| error | `error`, `timeout`, … | `messageForApiError` / network | vi |
| auth_notice | — | `authNotice` OIDC | vi (page) |

**Anti-pattern:** Hiển thị `fallbackMessage` API tiếng Anh raw khi UI VI — map hoặc generic VI.

---

## iOS (`apps/mobile`)

| State | Copy module | Locale đợt 1 |
| ----- | ----------- | ------------- |
| wallet loading | `walletCopy.loading` | vi |
| wallet empty online | `walletCopy.emptyOnline` | vi |
| wallet empty offline | `walletCopy.emptyOffline` | vi |
| events list loading | `eventsCopy.loadingList` | vi |
| scan idle | `scanCopy.idle` | vi |
| redeem offline | `redeemCopy.offlineTitle/Body` | vi |

**Future `locale_en`:** Mỗi object trong `*-copy.ts` thêm nhánh `en` hoặc dict song song — giữ cùng shape title/body.

---

## Cross-surface consistency

| Scenario | Trạng thái mong muốn (PD) | Hiện trạng |
| -------- | -------------------------- | ---------- |
| Marketing EN → Login | User expect EN **không** guaranteed | Product VI |
| Portal EN → mở `/redeem` tab mới | Redeem VI | OK nếu documented |
| Portal cookie en + marketing `/` | Độc lập | OK |
| Cùng user mobile + portal EN | Không sync | Gap wave sau |
