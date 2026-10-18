# DoD — PR #353 (D13 iOS plain-language account deletion + SDK #316 evidence)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_7edef7b3-ec68-4ac9-a637-c10729cc76a0` · task `task_0052b414f5b8` · dispatch `ctx_f3176023efdc` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic D13 · Issues [#328](https://github.com/hangndat/ticket-solution/issues/328) / [#316](https://github.com/hangndat/ticket-solution/issues/316) · PR [#353](https://github.com/hangndat/ticket-solution/pull/353) · paths: `apps/mobile/src/account-deletion/{account-deletion-copy,account-deletion-flow,account-deletion-panel,account-deletion-flow.test}.ts(x)`, `apps/mobile/src/screens/account.tsx`, `docs/reviews/D13-IOS-PLAIN-LANGUAGE.md`, `docs/reviews/D13-S1-T3-SDK-ELIGIBILITY.md` |
| Architecture impact | **Không** — mobile plain-language copy + SDK evidence; không đổi OpenAPI/contract authz; `AccountDeletionUiPhase` vẫn giữ `ackMeansDeleted: false` (internal truth label), UI không còn render |
| Commit SHA reviewed (PR tip) | `cbf84078c5423cb148c469fb64fb26f0436f2037` (`git rev-parse` + PR `headRefOid`) |
| Behavior / code SHA | `e72514bd5a0bedee8fa809801bd2a70914a8c72e` — tip = docs-only evidence chỉnh sau behavior |
| Base | `723d46dd218e10f988772509c0ca4a85cfca8929` |
| Skills before review | `expo-overview` → `react-native-best-practices` (copy/panel; không animation/gesture mới) |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` + `detect_changes_tool` (scoped mobile files); MCP graph `built_at_sha` lệch worktree khác → **source + unit tests + live Apple HTTP thắng** |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC

| AC | Result |
| --- | --- |
| Deletion request path authenticated (`Bearer` → `/v1/me/account-deletion-requests`) | **PASS** — API unchanged in tip; POST/GET require bearer; panel chỉ khi `verified`; không mock auth |
| Request received ≠ instant delete | **PASS** — explainer/confirm/status: “không bị xóa ngay” / “not wiped instantly”; confirm CTA “Submit (not instant wipe)” |
| ≤30 days + audit retention truthful | **PASS** — VI/EN processing note: ≤30 ngày; audit có thể giữ theo pháp lý |
| No O06 / ACK / anonymize / raw enum / debug userflow | **PASS** — copy + panel bỏ jargon/debug `ackMeansDeleted: …`; enums map → plain titles; `assertsNoInternalJargon` + reviewer string sweep `ALL_COPY_OK` |
| Flow object shape không phá callers/tests | **PASS** — `ackMeansDeleted: false` vẫn trên phase `acknowledged`/`status`; panel không đọc field đó; tests vẫn assert |
| Unit 14 + mobile typecheck | **PASS** — reviewer re-run 14 pass; `pnpm run typecheck` exit 0 trên tip |
| Không bắt buộc full rebuild chỉ vì copy | **PASS** — diff chỉ copy/flow messages/panel labels + docs; không đổi native deps/`app.config` trong PR commits |
| Apple live minimum Xcode 26 + iOS 26 SDK since 2026-04-28 | **PASS** — live HTTP 2026-10-18 upcoming `?id=04282026a` + screenshot primary |
| Không nhầm Apr 2027 Xcode 27 / iOS 27 SDK | **PASS** — live submitting page: khuyến khích Xcode 27; **Starting April 2027** → iOS & iPadOS **27 SDK**; evidence doc tách rõ |
| Local inventory Xcode 26.5 / SDK 26.5 / deploy 16.4 + dated screenshots | **PASS** — reviewer `xcodebuild` 26.5 (17F42), SDK 26.5 (23F73); `IPHONEOS_DEPLOYMENT_TARGET=16.4`; 4 PNG + `inventory.json` dated `2026-10-18T08:08:09.104Z` |
| Không claim store-validated chỉ từ inventory | **PASS** — evidence + PR body ghi ASC upload chưa; Help vẫn có note Xcode 14 lệch bảng |
| Signed-in E2E / device gaps preserved | **PASS (gap)** — không giả E2E; gap ghi trong evidence + PR |

---

## Checks (exact tip SHA `cbf84078c5423cb148c469fb64fb26f0436f2037`)

```bash
git rev-parse HEAD
# → cbf84078c5423cb148c469fb64fb26f0436f2037

node --experimental-strip-types --test \
  apps/mobile/src/account-deletion/account-deletion-api.test.ts \
  apps/mobile/src/account-deletion/account-deletion-flow.test.ts
# → 14 pass / 0 fail

cd apps/mobile && pnpm run typecheck
# → exit 0

# Live Apple (reviewer 2026-10-18):
# GET https://developer.apple.com/news/upcoming-requirements/?id=04282026a
#   → Since April 28, 2026 · Xcode 26 · iOS 26 SDK
# GET https://developer.apple.com/app-store/submitting/
#   → Xcode 27 (encourage) · Starting April 2027 · iOS & iPadOS 27 SDK
# GET ASC Help upload-builds → table Xcode 26 or later (+ residual “Xcode 14” note)

xcodebuild -version                        # Xcode 26.5 / 17F42
xcrun --sdk iphoneos --show-sdk-version    # 26.5
```

| Check | Result |
| --- | --- |
| Unit tests | **14 pass** (reviewer re-run on tip) |
| Mobile typecheck | **exit 0** |
| CI | [run 39110434950](https://github.com/hangndat/ticket-solution/actions/runs/39110434950) tip `cbf84078…` → **success** (`mobile`, `ci`, `changes`, `turbo-persist`; backend/web skipped) |
| Screenshots | `apps/mobile/.uat-artifacts/sdk-eligibility-2026-10-18/` (gitignored): primary 154368 · index 912972 · upload-builds 458526 · submitting 1323927 + `inventory.json` |
| Live Apple vs docs | Align với `D13-S1-T3-SDK-ELIGIBILITY.md` |

---

## Findings

### Residual / known gaps (không nuốt AC bắt buộc của PR copy+evidence)

1. **Signed-in E2E / device UAT** — chưa chạy trên tip; cần session thật. Gap có chủ đích, đã ghi.
2. **ASC archive/upload** — chưa; inventory ≠ store validation. Không EAS Cloud.
3. **Account screen identity `Notice`** — vẫn có field kỹ thuật subject/issuer ngoài scope deletion copy (implementer đã ghi).
4. **CRG MCP lag** — graph `built_at_sha` trỏ workspace/branch khác; kết luận từ source/tests/CI/live HTTP.
5. **Upload-builds Help** — bảng “Xcode 26 or later” đồng thời còn note “Xcode 14” (Apple wording lệch); không dùng để claim upload luôn accept.

### Nits (không chặn)

1. Internal type field `ackMeansDeleted` + comment “erasure” vẫn trong `account-deletion-flow.ts` / API comment — **không** user-visible; tests cố ý giữ.
2. Status `COMPLETED` vẫn kèm note “không xóa ngay” / audit — fail-closed; chấp nhận được cho plain UX.

### Out of scope / intentional non-claims

- Không merge, không prod, không archive/upload ASC, không OS mouse UAT.
- Không tuyên bố store-validated / ASC binary accepted.
- Review-only: không implementation edit; artifact này **không** push lên branch implementer.

---

## Verdict

**PASS with known gap** trên exact SHA `cbf84078c5423cb148c469fb64fb26f0436f2037`.

Gap còn lại (E2E signed-in / device, ASC upload) đã được ROADMAP/PR chấp nhận có chủ đích và không làm sai AC plain-language + SDK inventory. Coordinator sync Project sau artifact này.
