# D13 — DoD review PR #363 (S3-T1 ASC listing fields evidence)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca dispatch `ctx_f90ea88ac0b6` · terminal `term_6bbfebed-88b3-46e6-a0dd-6adbd11f768d` · task `task_b815eb96849e` · **≠** implementer |
| Scope | Issue [#322](https://github.com/hangndat/ticket-solution/issues/322) · Story [#306](https://github.com/hangndat/ticket-solution/issues/306) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · PR [#363](https://github.com/hangndat/ticket-solution/pull/363) · paths `docs/reviews/D13-S3-T1-ASC-FIELDS*.md|json` |
| Commit SHA (exact) | `5985c750748900f35e5603daf39c5a4d0bc626a8` |
| Architecture impact | **Không** — ASC listing evidence / read-back only |
| Ngày review | 2026-10-18 |
| Verdict | **PASS with known gap** |

Không merge · không ASC mutate trong review này. Artifact DoD **không** commit lên tip PR (giữ exact SHA ổn định).

---

## Checks (trên SHA `5985c750748900f35e5603daf39c5a4d0bc626a8`)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse` / `gh pr view 363` `headRefOid` | Match tip `5985c750748900f35e5603daf39c5a4d0bc626a8` |
| Diff ownership | Chỉ 3 files `docs/reviews/D13-S3-T1-ASC-FIELDS.md` + `.json` + `-READBACK.json` — **không** `apps/**` |
| CI (`gh pr checks 363`) | `changes` pass · `ci` pass · runtime jobs skip (docs path) |
| Secrets scan (receipt JSON/MD) | Không API key / issuer / `.p8` / token / private key |
| Submit / Availability | `submitted: false` · `availabilityChanged: false` · prose cấm submit/release — khớp |
| Support URL live | `curl -sI https://vemoki.com/support` → **HTTP 200** (nginx; rewrite `/marketing/support`); body có `support@vemoki.com` |
| Privacy URL live | `curl -sI https://vemoki.com/privacy` → **HTTP 200** (rewrite `/marketing/privacy`) |
| Marketing URL | `https://vemoki.com` → **HTTP 200** |
| Keywords byte limits | EN ASCII **83** · VI UTF-8 **78** — khớp READBACK + ≤100 |
| Categories | Receipt: primary `ENTERTAINMENT` · secondary `BUSINESS` — khớp claim #354 / JSON |
| Version state | `1.0.0` · `PREPARE_FOR_SUBMISSION` · `releaseType: MANUAL` · `whatsNew: null` |
| Age rating PATCH | Receipt **HTTP 409** `ENTITY_ERROR.ATTRIBUTE.REQUIRED` (4 MED keys) · MED vẫn `null` · **không** silent MED=`NONE` · coordinator option **C** documented |
| What’s New PATCH | Receipt **HTTP 409** `STATE_ERROR` — `whatsNew` cannot be edited · likelyCause no build — honest |
| Age attributes live | READBACK: HIGH/MED keys still `null`; overrides `NONE` — **không** claim “all 4+” / questionnaire done |
| Claim boundary | Listing done; age + what’s New **NOT done**; no TestFlight / In Review / Ready for Sale |
| CRG | `list_graph_stats_tool` OK; `detect_changes_tool` risk score nhiễu (graph build SHA ≠ review tip; docs-only) — fallback source + `gh` + curl |
| ASC re-GET | **Không** gọi ASC API (task: no mutate; tránh credential) — tin receipt + URL live |
| Runtime / UAT | N/A docs-only evidence |

---

## Findings

### Known gaps (chấp nhận cho PR evidence này — **không** đủ đóng Issue #322 Hoàn thành)

1. **`docs/asc/asc-fields-checklist.md` vẫn ☐** — cột “Điền ASC” chưa chuyển ☑ dù receipt claim listing live. AC Issue #322 yêu cầu checklist ☑; gap theo dõi ngoài tip này.
2. **Thiếu evidence ảnh ASC console (che secret)** — AC “evidence ảnh” / checklist §9 screenshot chưa có trong PR #363; implementer đã disclose.
3. **Tip SHA table lệch** — header “Tip SHA (evidence commit)” = `e4c485bb…` (ancestor) trong khi PR tip = `5985c75…` (pin chase). Nội dung evidence không đổi hành vi; nit hygiene.
4. **Age rating + What’s New vẫn mở** — documented 409 + U2 / cần build; **đúng** không claim done. Follow-up Task riêng.
5. **Checklist Support URL vẫn `https://vemoki.com`** trong khi ASC live = `/support` — should-fix sync docs khi tick checklist.
6. **Evidence hygiene** — `appInfoId` trùng UUID `ageRatingDeclarations` trong READBACK; categories vẫn khớp claim ENTERTAINMENT/BUSINESS. `verified: false` vs `verifiedListing: true` trong ops JSON — partial verify honest.

### Không có blocker trong claim của PR

- Listing URLs / keywords / categories / description presence documented + URLs re-verified HTTP 200.
- Age §6A / whatsNew blockers documented honestly; không nuốt MED=`NONE`.
- Không secrets · không submit · state vẫn PREPARE_FOR_SUBMISSION.

---

## Verdict

**PASS with known gap**

Gaps trên **không** làm sai claim “listing fields live + age/whatsNew 409 documented” của PR #363. Chúng **chặn** nghiệm thu đầy đủ Issue #322 (checklist ☑ + screenshot ASC) và cổng age/What’s New cho đến follow-up. Revalidation bắt buộc nếu tip PR đổi nội dung evidence sau `5985c750748900f35e5603daf39c5a4d0bc626a8`. Coordinator: merge chỉ khi được ủy quyền integration + CI xanh; **không** tự Hoàn thành #322 chỉ vì DoD PR này.
