# D13 PR #313 — DoD + Security review (độc lập)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Cursor · Role `reviewer-dod` + `reviewer-security` · Orca `task_5cf99a498816` / `ctx_8f88e0c0fb9e` / `term_a3ef0472-fde7-4e5b-88bc-6ab1d9fa9cb7` |
| Independence | ≠ implementer `ctx_284cb2cea2d7` / `term_b801a15d-59f9-4511-aac7-094206921cde` (đã release) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · PR [#313](https://github.com/hangndat/ticket-solution/pull/313) · iOS `apps/mobile` + `docs/reviews/D13-*` |
| Architecture impact | **Không** — Privacy/deletion copy + link + version trên contract O06 hiện hữu |
| Commit SHA (exact) | `6585f596c87f14cfc30601f4c85355cd26494534` |
| Behavior SHA (Privacy/deletion) | `639cde6a8179b3383195fb9d12db85a140307bfc` |
| Plan | `/Users/admin/orca/workspaces/ticket-solution/main/docs/plans/D13-APP-STORE-RELEASE-PLAN.md` (S1-T3, S5-T1) |
| Ngày review | 2026-10-18 |
| **Verdict (DoD)** | **PASS with known gap** |
| **Verdict (Security)** | **PASS with known gap** |

## 1. SHA / scope verify

```text
git rev-parse HEAD
→ 6585f596c87f14cfc30601f4c85355cd26494534
branch: hangndat/d13-ios-s1t3-s5t1-privacy-asc
```

Diff ownership đúng slice iOS + evidence docs; không trộn BE/web apps.

## 2. Checks trên exact SHA

| Check | Kết quả |
| ----- | ------- |
| `cd apps/mobile && node --experimental-strip-types --test src/account-deletion/*.test.ts` | **14/14 pass** |
| CI run [39107588199](https://github.com/hangndat/ticket-solution/actions/runs/39107588199) | `headSha` = `6585f596c87f14cfc30601f4c85355cd26494534` · **success** (`mobile` pass) |
| `curl -s -o /dev/null -w '%{http_code}' https://vemoki.com/privacy` | **200**; body khớp O06 (anonymize ≤30 ngày) |
| Unauth `POST/GET …/account-deletion-requests` | **422** `PLATFORM_MISCONFIGURED` (fail-closed; route sống, không 404) |
| `xcodebuild -version` / `xcrun --sdk iphoneos --show-sdk-version` | **Xcode 26.5 (17F42)** / **26.5** |
| Apple Upcoming Requirements (primary, live) | Xcode 26+ / iOS 26 SDK từ 2026-04-28 — [link](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) |
| Apple Help upload-builds | Bảng: iOS **Built using Xcode 26**; Note vẫn ghi “Xcode 14” — **mâu thuẫn xác nhận**; S1-T3 **không** claim eligibility PASS giả |

### Headless sim UAT (reviewer bù gap)

| Hạng mục | Evidence |
| -------- | -------- |
| Dedicated sim | `iPhone 17` UDID `0F1CAFB0-A392-4591-A93D-A0F5F5E81E1A` (không dùng sim Booted của worker khác) |
| Artifacts | `apps/mobile/.uat-artifacts/pr313-dod/01-launch.png` (+ 02/03) — gitignored |
| Binary trên sim | **`CFBundleShortVersionString` 0.1.0 / build 9** — **không** phải tip `1.0.0 (10)` |
| Quan sát UI | Tab Events / Vé / Nhân viên; **không** thấy Account / Privacy / deletion của PR tip |
| Kết luận UAT | **Không** chứng minh UI tip-SHA; chỉ chứng minh attempt trên binary cũ |

Sau UAT: `simctl shutdown` dedicated UDID. Không mouse / không EAS / không upload/submit.

## 3. DoD findings (S5-T1 / S1-T3 / version)

### Pass

1. In-app Privacy: `PRIVACY_POLICY_URL = https://vemoki.com/privacy`; `PrivacyPolicyLink` trên Account (kể cả khi OIDC chưa cấu hình); HTTPS public, live 200.
2. O06 copy: explainer / policy notes = anonymize ≤30 ngày; ACK ≠ erasure; `assertsNoDeletedClaim` + tests.
3. Deletion panel chỉ khi `identity.status === 'verified'`; submit cần SessionBoundary verified + bearer; không mock auth production path.
4. API client từ chối body ACK `COMPLETED`; Idempotency-Key + epoch cancel / account-switch isolation (unit).
5. Public version `1.0.0`, `buildNumber` `10` (`app.config.ts` / `package.json` / README).
6. S1-T3: cite primary Upcoming Requirements + Help conflict; inventory máy khớp Xcode/SDK 26.5; **không** tuyên bố ASC upload always-accept.
7. ASC preflight RO: Team `BLUA62D52G`, bundle `com.hangndat.ticket`; gaps S3/S6 escalate — không mutation.

### Known gaps (không nuốt thành PASS vô điều kiện)

| ID | Gap | Loại | Theo dõi |
| -- | --- | ---- | -------- |
| G-UI | Thiếu screenshot/device **tip SHA** cho Account → Privacy / deletion (AC S5-T1). Sim chỉ có binary `0.1.0 (9)`. | Acceptance UI | Local rebuild tip + `sim-uat` / device trước S4 archive |
| G-AUTH | Chưa smoke **authenticated** POST deletion trên prod | Security e2e | S5-T2 demo reviewer |
| G-REL | ASC metadata/screenshots/territory/name “Ticket Solution” vs Vemoki | Milestone release | S3 / S6 / S7 — **không** fail PR code slice này |
| G-CRG | MCP `code-review-graph-ticket` graph `head_sha` lệch worktree tip; review bằng lean-ctx + source | Process limitation | Ghi nhận |

### Nits (không blocker)

- Implementer evidence files còn tip stamp cũ (`7da8b9a…`) trước commit version; behavior SHA `639cde6…` vẫn đúng.
- Unauth API: implementer ghi POST 400; reviewer quan sát **422** `PLATFORM_MISCONFIGURED` — vẫn fail-closed.

## 4. Security review

**Threat / abuse cases xét trong scope**

| Case | Kết luận |
| ---- | -------- |
| Unauthenticated deletion POST | Không bearer → client `invalid`; server 422 platform misconfig — không erasure |
| Offline-display / unverified session gửi deletion | Panel `null` nếu chưa verified; confirm path check epoch verified |
| ACK spoof COMPLETED | Client reject; copy không claim “đã xóa” |
| Cross-user status leak | SessionScoped remount + epoch cancel + pending key isolation (tests) |
| Privacy URL open (phishing / http) | Constant HTTPS `vemoki.com/privacy` only |
| Secrets / EAS | Diff không chứa secrets; docs cấm EAS Cloud |
| Mock auth production | Không — OIDC + `/v1/me` verify; Notice khi thiếu config |

**Security verdict:** **PASS with known gap** — gap = authenticated prod deletion chưa chứng minh (S5-T2); không thấy authz bypass trong diff iOS.

## 5. Phân biệt

| Layer | Status |
| ----- | ------ |
| Code complete (PR tip) | Đủ cho Privacy link + O06 copy + version + S1-T3 docs |
| Acceptance complete (S5-T1 AC screenshot tip) | **Chưa** — G-UI |
| Release / publish ready | **Không** — G-REL + Epic §0 |

## 6. Recommendation cho coordinator

- Merge PR #313 **được phép** sau khi chấp nhận known gaps G-UI / G-AUTH (không phải security FAIL).
- Trước S4 archive: rebuild local tip `1.0.0 (10)` + headless sim Account→Privacy evidence.
- Không dùng S1-T3 làm “eligibility PASS”; upload thật vẫn phụ thuộc Apple processing.
- **Không** đổi tip SHA bằng commit artifact trên branch PR này — evidence chính = comment PR + file này (có thể commit branch docs riêng).
