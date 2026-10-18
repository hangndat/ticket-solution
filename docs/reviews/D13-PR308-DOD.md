# D13 — DoD review PR #308 (BA ASC privacy / listing)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca dispatch `ctx_133860fe7b9c` · terminal `term_ef65cf8d-5eac-4307-8e5e-5cae39506892` · **≠** implementer `ctx_c6045bdf4cee` |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · PR [#308](https://github.com/hangndat/ticket-solution/pull/308) · paths `docs/asc/**` + `docs/reviews/D13-BA-PRIVACY-ELIGIBILITY.md` |
| Commit SHA (exact) | `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a` |
| Architecture impact | **Không** (docs ASC/privacy reconciliation only) |
| Ngày review | 2026-10-18 |
| Verdict | **PASS with known gap** |

Primary durable evidence for this SHA is also the PR comment on #308 (keeps tip SHA unchanged — this file is uncommitted reviewer output).

---

## Checks (trên SHA `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a`)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse` tip PR = reviewed SHA | Match `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a` |
| Diff ownership | Chỉ 7 files under `docs/asc/**` + `docs/reviews/D13-BA-PRIVACY-ELIGIBILITY.md` — **không** `apps/**` |
| CI (`gh pr checks 308`) | `changes` pass · `ci` pass · runtime jobs skip (docs path) |
| Live Privacy URL | `curl -sI https://vemoki.com/privacy` → **HTTP 200**; VI/EN retention **30 / 365 / 730 / 90** khớp O06 |
| Live Support page | `https://vemoki.com/support` → **HTTP 200**; có email `support@vemoki.com` + SLA giờ hành chính / Gate on-call |
| O06 numbers vs `docs/DECISION-LOG.md` + ASC docs | Consistent (anonymize ≤30d; vé 365d; audit 730d; object ≤90d) |
| BE policyStatus | `packages/backend/src/account-deletion.ts` → `RESOLVED`; `O06_ACCOUNT_ANONYMIZE_MAX_DAYS = 30` |
| Ticket/object jobs | `retention-o06.ts` stubs `NO_JOB_FRAMEWORK` — BA artifact ghi limitation đúng; không bịa enforcement |
| SDK inventory vs `apps/mobile/package.json` @ source tip | Không Firebase/ads/Crashlytics/OneSignal; `expo-notifications` / `expo-camera` / OIDC modules khớp Nutrition “App Functionality” + Device ID Linked |
| Camera usage string | `app.config.ts` → `Scan ticket QR codes at the gate.` khớp Review notes |
| Listing limits | EN keywords **83** bytes; VI keywords **78** UTF-8 bytes; subtitle EN 29 / VI 26; promo EN 128 — trong giới hạn ASC |
| Offline Gate copy | Honest: queue ≠ admit; no multi-device offline dedupe — khớp D7/D11 intent |
| Sign in with Apple statement | Cơ sở Guideline **4.8**: exclusive own OIDC (Keycloak) → SIWA **not required** — browse 2026-10-18 |
| Account deletion 5.1.1(v) (browse) | In-app initiate + timeline inform allowed; no CS phone/email required — ASC notes/policy draft khớp; **in-app copy vẫn stale** (gap dưới) |
| Docs ≠ ASC filled | Checklist ☐ ASC UI; README/eligibility **không** claim paste/submit |
| Apple primary URLs browsed | App Privacy Details; Guidelines §Privacy / 4.8; Account deletion 5.1.1(v) support page; third-party SDK requirements (via eligibility + live browse) |
| CRG | `list_graph_stats_tool` OK nhưng graph build SHA ≠ review tip (`141dba…` / khác branch) — **fallback** lean-ctx + source + `gh` (limitation ghi ở đây) |
| Runtime tests | Không chạy (docs-only; đúng scope) |

---

## Findings

### Known gaps (chấp nhận cho slice docs này — không FAIL AC BA)

1. **Stale in-app O06 copy (S5-T1 / PR #313)** — `apps/mobile/src/account-deletion/account-deletion-copy.ts` tại source base `f551b6d2bdc0…` vẫn nói “O06 chưa chốt”. BA docs **đúng** khi disclose và **không** sửa `apps/**`. Submit store vẫn bị chặn bởi gap này cho đến khi iOS merge tip `6585f596c87f14cfc30601f4c85355cd26494534` (hoặc tương đương) — **không** đòi PR #308 tự code app.
2. **Support URL paste** — listing/checklist dùng `https://vemoki.com`; trang hỗ trợ đầy đủ contact là `https://vemoki.com/support` (200 + email). **Should-fix khi paste ASC:** ưu tiên Support URL → `/support` (nit; không làm sai URL hiện có).
3. **Live `/privacy` mỏng hơn draft** — thiếu camera/deletion path chi tiết so với `privacy-policy-draft.md` (đã ghi S2-T3). Không false claim; optional trước submit.
4. **ASC UI / G2, territory, demo prod, SMTP/device/archive** — còn mở theo plan D13; **không** miễn bởi PR docs này.

### Không có blocker trong diff docs

- Nutrition purposes / linked / tracking “No” khớp inventory + không ads SDK.
- Policy/review notes **không** hứa xóa ngay / không hứa xóa cứng audit trong TTL 730d.
- Version public `1.0.0` ghi rõ BA không claim upload; binary tip phải khớp trước S4.
- Keywords localized per locale (sửa sai D10 “một chuỗi dùng chung”).

---

## Verdict

**PASS with known gap**

Gaps trên **không** vi phạm acceptance của ownership docs BA (truthful reconcile + disclose deps). Không waive release mandatory gates (SMTP / physical device / ASC filled / submit). Revalidation bắt buộc nếu tip PR #308 đổi hành vi/docs sau SHA này.
