# Invite + staff thin — polish priorities (Phase 3 residual)

| Trường | Giá trị |
| ------ | ------- |
| Epic (planning) | [#546](https://github.com/hangndat/ticket-solution/issues/546) — **đóng sau coding wave** — xem [`EPIC-TRIAGE-546.md`](./EPIC-TRIAGE-546.md) |
| Handoff đầy đủ | [`README.md`](./README.md) · [`visual-notes.md`](./visual-notes.md) |
| Visual budget | **Không invent** — Live Pulse [`brand/vemoki/tokens.json`](../../../../brand/vemoki/tokens.json) |
| Scope doc này | Chỉ **membership invite** + **staff thin soft-entry** — **không** marketing/redeem/portal/Gate scanner |

**Mục đích:** 5 ưu tiên polish có thể quan sát (AC/UAT) sau wave #554 / #555 — dùng khi spawn Task nhỏ web hoặc iOS **ngoài** Epic #546.

---

## Priority polish (5)

| # | Ưu tiên | Surface | Việc polish | AC / evidence gợi ý |
| - | ------- | ------- | ----------- | ------------------- |
| **P1** | Invite guest chrome | Web `/invite` | Đồng bộ copy guest-safe: «lời mời thành viên», empty «Chưa có mã lời mời», outcome plain VI — **không** Keycloak/Nest/BFF trên chrome | AC-I2, AC-I3 · `invite-http-uat.mjs` + screenshot |
| **P2** | Invite security UX | Web `/invite` | Token park `#token` / `?token` → strip URL; không lộ token trên address bar sau park; submit busy đến khi có kết quả rõ | AC-I4 · `tokenLeakedInUrl: false` trong UAT gap |
| **P3** | Invite a11y | Web `/invite` | Outcome success/denied/network: `role="alert"` / `aria-live`; tab order login → field → submit; focus-visible ring `focus` | visual-notes § a11y · axe smoke |
| **P4** | Staff thin deny | iOS `staff-access` | Notice deny: title/body VI fail-closed + **assertive** announce; CTA signal «Về Sự kiện» (thống nhất copy, tránh lệch «Về trang Sự kiện») | AC-S2 · `scripts/sim-uat.sh` + `staff-access-deny.png` |
| **P5** | Invite deep link (iOS) | iOS bridge → web | Runtime: `vemoki://invite?token=…` không Unmatched Route — rebuild local dev client từ tip `main`; deep-link mở web `/invite` (không invent native invite screen) | `docs/reviews/ux-ui-p3-ios-pr557-uat-gap.md` § Membership-invite |

**OUT polish list này:** live accept E2E cần Nest (ops) · reskin `/(tabs)/staff` scanner · `/claim` guest ticket · marketing/redeem (đã wave web #554).

---

## Trạng thái UI (tóm tắt — không thay README)

### `/invite` (web)

| State | Polish focus |
| ----- | ------------ |
| empty | Một support line + CTA đăng nhập `return=/invite` |
| loading / busy | Không hiện success sớm |
| success / used / invalid / denied | Plain VI + link Admin khi success only |
| network / unknown | Không claim success |

### `staff-access` (iOS)

| State | Polish focus |
| ----- | ------------ |
| loading | «Đang kiểm tra quyền nhân viên» — không flash scanner |
| denied | Full-bleed Notice — không camera/QR preview |
| eligible | Redirect tab staff — scanner visual OUT |

---

## Triển khai (good enough)

1. Web: P1 → P2 → P3 (cùng PR nếu Task web nhỏ).
2. iOS: P4 (copy/announce) có thể ship trước P5; P5 = build/dev-client Task riêng.
3. Mỗi Task Spec: link file này + `visual-notes.md` freeze — không đổi palette/font.

---

## UAT headless (không computer-use)

| Surface | Script |
| ------- | ------ |
| Web invite | `scripts/web-uat.sh` · `apps/web/tests/invite-http-uat.mjs` |
| iOS staff deny | `scripts/sim-uat.sh` + stub `scripts/o02-me-events-stub.mjs` |

---

## Liên kết

- Epic triage: [`EPIC-TRIAGE-546.md`](./EPIC-TRIAGE-546.md)
- Full Phase 3 PD: [`README.md`](./README.md)
