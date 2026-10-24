# UI fix-all — Portal review (#859)

> Coordinator: PASS dưới đây thuộc checkpoint trước khi mở ảnh và phát hiện PORTAL-CHROME-390 / PORTAL-LOCALE-EVID. **Chưa chốt acceptance cuối**; source fix lượt1/2 đang chạy. Xem [trạng thái tổng hợp](UI-FIXALL-2026-10-23.md).

| Field | Value |
| --- | --- |
| Reviewer | Composer · `reviewer-uiux` + `reviewer-dod` · Orca `task_4f80f6fae9f9` → revalidate `task_1ad532f0862e` |
| Issue | [#859](https://github.com/hangndat/ticket-solution/issues/859) |
| Scope | `apps/portal` local tree (4 scoped files) · design pack `docs/design/portal-audit-fix-2026-10-23/` |
| Commit SHA | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (`git rev-parse HEAD`) |
| Verdict | **PASS** (revalidation R2 on same SHA, source fingerprints unchanged) |
| Evidence | `docs/reviews/assets/UI-FIXALL-PORTAL-REVIEW-2026-10-23/` |
| Owner cross-ref | `docs/reviews/assets/FA-PORTAL-2026-10-23/` (platform grants/deny) |
| Root reconciliation | `assets/UI-FIXALL-PORTAL-REVIEW-2026-10-23/RECONCILIATION-REPORT-PORTAL.md` |

**Note:** Local dirty SHA — not integrated `main` / pilot.

## Checks (this SHA)

| Check | Result |
| --- | --- |
| API `http://127.0.0.1:3001/v1/health` | 200 |
| Portal `http://127.0.0.1:3013` | 200 |
| Scoped fingerprint drift | None — `fingerprint-scoped.json` |
| `ui-evidence-check.sh` (reviewer assets) | OK (32 files) |
| PA-06 canonical | `portal-pa06-rm-vi-390x844.json` — `rmMedia: true`, spinner `animationName: none`, `animationDuration: 0s`; command `set media light reduced-motion`, restore `set media light` |
| DB long tenant (PA-01 fixture) | `tenants.name` = «Tổ chức sự kiện MFest – Đơn vị vận hành khách mời nhiều ngôn ngữ năm 2026» (root seed; restore after capture) |

## Revalidation matrix (open findings from R1)

| ID | R1 | R2 | Evidence |
| --- | --- | --- | --- |
| **PORTAL-PLATFORM-OPERATOR** | Open | **Closed** | Owner `FA-PORTAL-2026-10-23/portal-platform-grants-vi-1024x900.*` — measured 1024×900, `grants: true`, `operator: true`, `assurance: mfa`. Reviewer cross-ref `owner-platform-grants-crossref.json`. Handoff tab staff session still shows deny (expected without platform cookie). |
| **PORTAL-ATTENDEE-DENY** | Open | **Closed** | Owner `portal-platform-attendee-deny-vi-1024x900.*` — `denied: true`, `operator: false`, `platformStatus: 200`. `owner-platform-attendee-deny-crossref.json`. |
| **PORTAL-PA01-LONG-390** | Open | **Closed** | Staff session page `180a8f74-…` @390×844: `longNamePresent: true`, `stacked: true`, `overflowX: false` — `header-pa01-long-vi-390x844.*`; @1024 `header-pa01-long-vi-1024x900.*`. EN @390 probe-only (`header-pa01-long-en-390x844.json`) — tenant string locale-invariant, shares VI PNG. |
| **PORTAL-PA04-EN-EVID** | Open | **Closed** | Probe-only `probe-pa04-locale-en-vi.json` — `vemoki_portal_locale` cookie+localStorage; `localeSwitchVerified: true`; `formatted` EN `10/23/26, 1:46:10 PM` vs VI `13:46:15 23/10/26`; both `utc: true`. No fabricated distinct PNG. |
| **PORTAL-EVID-PA06-FA** | Closed | **Closed** | Owner FA PA-06 remains invalid media command; reviewer canonical proof unchanged. |
| **PORTAL-PA03-PROBE** | Closed | **Closed** | Prior `probe-guests-pending.json` + import/export captures unchanged (source fingerprint stable). |
| **PORTAL-SOURCE-DELTA** | Pass | Pass | No drift on scoped files. |
| **PORTAL-UNAUTH-GATE** | Pass | Pass | R1 captures retained. |
| **PORTAL-PA06-RM** | Pass | Pass | Rechecked `rmMedia: true` on staff session R2. |
| **PORTAL-PA05-ARIA** | Pass | Pass | R1 export capture retained. |
| **PORTAL-AUDIT-PANEL** | Pass | Pass | R1 audit capture retained. |

## Source delta (unchanged R1 → R2)

Hash/tab sync, testid wrappers (import filters, PA-04, audit, platform grants panel) — no permission or PA-02 copy regression.

## Limitations

- Integrated CI / `main` merge not in scope.
- Platform operator runtime on reviewer handoff tab not re-OIDC’d (owner FA capture authoritative post `PLATFORM_OIDC_AUDIENCE` fix).
- Prod portal unverified.

## Coordinator

Root may restore tenant display name per `private/tenant-label-before.json` after PA-01 evidence. Update `REPORT-PORTAL.md` from `RECONCILIATION-REPORT-PORTAL.md`.
