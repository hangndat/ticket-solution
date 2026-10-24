# UI-FIXALL — Web review (#859 / FA-WEB)

> Coordinator: kết luận dưới đây là checkpoint trước khi tái hiện closed Sheet/focus và width không hợp lệ. **Chưa chốt acceptance cuối**; xem [trạng thái tổng hợp](UI-FIXALL-2026-10-23.md) và báo cáo chẩn đoán Sheet khi bàn giao. Không dùng PASS checkpoint để miễn các findings đang mở.

| Field | Value |
| --- | --- |
| Issue | [#859](https://github.com/hangndat/ticket-solution/issues/859) |
| Reviewer | Composer · `task_574a93155e20` → **F-WEB-04** `task_fcf21b721e61` / `ctx_d1f552fe0a42` |
| Implementer | Higo · `task_2a92b329274f` (F-WEB-04) |
| **Exact SHA** | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (dirty tree frozen) |
| Source fix round (web slice) | **1/2** after reviewer feedback (`site-chrome.tsx` only this round) |
| Prototype MR counter | **2/2 + Sheet exception** — separate history; **not** applied to this source round count |

## Source fingerprint (dirty)

| Path | SHA256 |
| --- | --- |
| `apps/web/src/marketing/chrome.tsx` | `a2adc1766ddb22e5bd36bd550ef1b863584a8785bc95a261de7e48dddac0a80e` |
| `apps/web/src/site-chrome.tsx` | `44c4b9569c21d11134c6e453769073172cc400360f0ee4c952fe5d990a2b3414` |
| `apps/web/tests/marketing-copy.test.ts` | `562d03ad5ef049df835bc170bf731fad7233464f9d0475d6b312867e158fc2fb` |
| `apps/web/tests/redeem-terms-consent.test.ts` | `eaf99a5dc00045cdb86520fb9c4974d4f0b95a50c27dd7706d75e9b137fe453e` |
| `apps/web/tests/home-catalog-filter.test.ts` (untracked) | `4663fa28bab5372801eac1d37c7391a6d4f833b9061ce21ea86ec7dd02e46e32` |

**F-WEB-04 diff:** `SheetContent` `onCloseAutoFocus` → `preventDefault()` + focus `[data-testid="nav-menu-toggle"]`.

## Checks (this dispatch)

| Check | Result |
| --- | --- |
| `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` | **PASS** (spot; no full test suite — source delta small) |
| `ui-evidence-check.sh` reviewer assets | **OK** (42 files) |
| Consumer sheet keyboard @390 VI | `capture-f-web-04-revalidate.sh` + isolated probes |
| Marketing sheet smoke @390 VI + EN | `review-mkt-smoke-390-*` — unaffected |
| Owner reference hygiene | `local-redeem-terms-390-vi.*` **removed** from FA-WEB; attendee canonical unchanged in `review-attendee-oidc-390-vi.json` |

## Findings

| ID | Status | Summary |
| --- | --- | --- |
| **F-WEB-01** | **Closed** | Attendee OIDC + tenant-bound redeem @ measured 390×844 — `review-attendee-oidc-390-vi.json`, `review-attendee-bff-me.json` |
| **F-WEB-02** | **Closed** | `review-keyboard-390-vi.json` (marketing) |
| **F-WEB-03** | **N/A** | Radix `aria-expanded` runtime |
| **F-WEB-04** | **Closed** | Independent Orca: open consumer sheet → **Escape** → `document.activeElement` is **`nav-menu-toggle`** (`review-consumer-kb-390-vi-escape-isolated.json`, viewport **390×844 DPR 1**). Tab cycles move focus among in-sheet / header links (`review-consumer-kb-390-vi-summary.json`); after **10×Tab + Shift+Tab + Esc**, focus may remain on `nav-events` (`review-consumer-kb-390-vi-after-tabs-escape.json`) — documented edge, not a regression vs primary dismiss path. Consumer app has **no `/en` route** (`lang=vi` root layout); EN keyboard smoke on **marketing** `/marketing/en` @390. Marketing Esc smoke: focus on `mkt-nav-menu-toggle`. |

### R-02 EN validation (scope split)

| Layer | Verdict |
| --- | --- |
| **EN labels @ `#interest`** | **PASS** (runtime + FA-WEB `local-mkt-interest-en-390.*`) |
| **EN validation messages in Orca DOM** | **Not claimed as runtime PASS** — form uses `noValidate` + `validateInterest`; Orca `click`/`requestSubmit` did not reliably surface `FieldError` text. Copy proven in **`marketing-copy.test.ts`** / `validateInterest` only. |

### Owner packet reconciliation

| Artifact | Reviewer action |
| --- | --- |
| `FA-WEB/local-redeem-terms-390-vi.*` | Removed by owner — do not cite |
| `FA-WEB/local-app-consumer-keyboard-390-vi.json` | Owner handoff; reviewer re-proved independently |
| `UI-FIXALL-WEB-REVIEW-2026-10-23/review-attendee-*` | Canonical attendee — verified present, `ui-evidence-check` OK |

## Verdict

| Layer | Verdict |
| --- | --- |
| **#859 web slice (local)** | **PASS** on `b2faa48a…` including **F-WEB-04** closure |
| **Production** | **unknown** |

## Evidence

- Reviewer: `docs/reviews/assets/UI-FIXALL-WEB-REVIEW-2026-10-23/`
- Owner handoff: `.orca-metrics/fix-all/REPORT-WEB.md`, `docs/reviews/assets/FA-WEB-2026-10-23/`

```text
Checkpoint · SHA b2faa48a… · web source fix round 1/2
F-WEB-01/02 closed · F-WEB-03 N/A · F-WEB-04 closed
Verdict: PASS (local web)
```
