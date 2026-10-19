# DoD — PR #535 / Issue #532 (UX-UI Phase 2 iOS)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | `reviewer-dod` · Orca Dispatch `ctx_9efc56ea0a68` · terminal `term_2300defe-1975-4b31-b612-68c3c8656284` · task `task_27e4eed80b56` · **≠** implementer |
| Scope | Issue [#532](https://github.com/hangndat/ticket-solution/issues/532) · PR [#535](https://github.com/hangndat/ticket-solution/pull/535) · Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) · ownership `apps/mobile` only · handoff `docs/design/ux-ui-revamp/phase-2/` |
| Commit SHA | `6dcd6998ed32a3648536421170ed8c033888db3c` (exact `headRefOid` PR #535) |
| Architecture impact | Không (chrome/visual + existing claim/redeem intent; không đổi OIDC/API contract) |
| Decision IDs áp dụng | N/A chrome-permission O02 — slice attendee surfaces; không đụng Staff tab |
| Verdict | **PASS with known gap** |
| Merge | **Không** (task DoD reviewer; coordinator merge sau đủ gate) |

## Checks trên SHA

| Check | Kết quả |
| --- | --- |
| CI GitHub `ci` / `mobile` / `changes` / `turbo-persist` | **success** trên tip `6dcd699…` ([run](https://github.com/hangndat/ticket-solution/actions/runs/39196287286)) |
| Ownership diff `main...6dcd699` | Chỉ 5 file `apps/mobile/src/screens/{account,claim,event-detail,my-tickets,redeem}.tsx` — **OK** (không web/portal/BE) |
| Author | `hangndat <hangndat@gmail.com>` — **OK** |
| `cd apps/mobile && pnpm lint` (worktree @ exact SHA) | **pass** |
| `pnpm typecheck` | **pass** |
| `pnpm test` | **226 pass** / 0 fail |
| EAS Cloud Build | Không có trong diff / PR — **OK** |
| Headless `scripts/sim-uat.sh` artifacts trên exact SHA | **Thiếu** — xem known gap |
| Local Expo prebuild + `xcodebuild` Team `BLUA62D52G` | Không yêu cầu trong Issue #532 AC hẹp / coordinator checklist (không chặn) |

## AC verification (phase-2 README §4.1)

| ID | Kết luận | Evidence (source @ SHA) |
| -- | --- | --- |
| AC-E1 | **Met (code)** | `PublishedEventComposition`: banner edge-to-edge (`borderRadius: 0`, full-bleed margin), H1 `typography.display`, ≤1 support line, CTA group; comment chống floating card dày |
| AC-E2 | **Met (code)** | `not-found` → «Sự kiện không khả dụng»; error/unreachable → Thử lại; `misconfigured` → «Chưa cấu hình API» + không demo fallback; fixture route nhãn «Demo · dữ liệu mẫu · chưa xuất bản» |
| AC-E3 | **Met (code)** | CTA «Đổi mã lấy vé» `router.push` `/redeem` với `tenantSlug`+`eventSlug`; `redeem.tsx` hydrate từ `useLocalSearchParams` |
| AC-A1 | **Met (code)** | Signed-out → «Đăng nhập» OIDC; `isSignedIn` chỉ `session.status === 'verified'`; OIDC missing → fail-closed notice |
| AC-A2 | **Met (code)** | Signed-in → Đăng xuất + Làm mới hồ sơ; deletion panel + privacy link; hierarchy Live Pulse (`BrandWordmark`, display/body fonts, signal spinner) |
| AC-A3 | **Met (code)** | Offline-bound copy «Xem offline (chưa xác minh phiên)» ≠ signed-in verified |
| AC-C1 | **Met (code)** | `needsLogin` chặn submit; `parkGuestClaimIntent` / `resumeGuestClaimIntent` qua login-return |
| AC-C2 | **Met (code)** | Outcomes qua `presentRedeemDecision(..., { surface: 'claim' })` — issued → ví; pending «chưa phải vé» + Kiểm tra lại; denied plain VI |
| AC-C3 | **Met (code)** | `dropGuestClaimIntentIfStale` + clear answers/decision khi `status !== 'verified'`; clear intent on terminal issued/pending/denied |
| AC-H1 | **Met (baseline)** | `events.tsx` **không** trong diff PR (đã Live Pulse từ #507): `BrandWordmark` + display hero + `ScreenAtmosphere`; tokens platform `vemoki` / signal |
| AC-V1 | **Met (code + theme)** | `brand.signal #E11D48`, ink/paper/focus; fonts Sora / Be Vietnam Pro; không Syne/Inter hero trên 4 màn; anti purple/terracotta trong tokens tests |
| A11y basics | **Met (code)** | `accessibilityRole="header"`, live regions claim/account, `AccessibilityInfo` reduce-motion trên event/claim/events, `AttendeeCta` `minHeight: 48` |

## Findings

### Known gap (không chặn merge theo AC hẹp + checklist DoD lần này)

1. **Thiếu sim-uat headless trên exact SHA** — Issue #532 / handoff map UAT gợi ý `scripts/sim-uat.sh` + screenshot `apps/mobile/.uat-artifacts/`; implementer và reviewer chưa có artifact runtime. Visual/AC được xác minh bằng source + CI/unit trên SHA. **Không** claim device/pilot ready. Coordinator có thể yêu cầu sim-uat trước Epic #527 milestone gate (a) mà không cần re-FAIL Task #532 nếu chỉ thiếu screenshot.

### Should-fix (không chặn PASS)

2. **CTA «Nhận lời mời» trên event-detail luôn hiện** — PD §1.1 ghi secondary «nếu có intent/link»; không token → claim `missingInvite`. Nên ẩn/disable khi không có deep-link invite, hoặc copy giải thích rõ hơn.

3. **Claim form chỉ fetch khi có `tenantSlug`+`eventSlug`** — deep-link chỉ `token`+`tenantId`+`eventId` vẫn park/submit được nhưng form/terms có thể trống; ngoài scope visual Phase 2 nhưng nên theo dõi.

### Nit

- `EventLogo` sau banner trên composition sẵn sàng — hơi dày hơn sketch PD; không phá AC-E1 (không card cluster).
- Graph MCP `detect_changes` lệch path repo khác (`SideProject/…`) — DoD dựa trên `git diff` + source worktree; limitation ghi nhận.

## Revalidation

Tip SHA đổi hành vi UI → DoD lại trên SHA mới; **không** kế thừa verdict này. Nếu chỉ bổ sung sim-uat docs/screenshots không đổi code → có thể gắn artifact UAT vào Issue/PR mà không bắt buộc FAIL lại.

## Verdict rationale

**PASS with known gap:** AC UI Phase 2 + tokens Live Pulse + a11y basics + ownership + CI/lint/typecheck/tests đạt trên exact SHA; gap chủ đích = thiếu sim-uat runtime evidence (không nuốt security/authz; Architecture impact Không). Không merge từ session reviewer.
