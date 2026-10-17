# DoD review — D9-S2-T3 iOS media demo (#142 / PR #218)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_46c3a32a-5deb-4f0c-95a7-357079ef1792` · dispatch `ctx_cb920ba6064b` · task `task_466c4d6afdab` · worktree `dod-d9-142-ios` |
| Implementer (≠ reviewer) | PR [#218](https://github.com/hangndat/ticket-solution/pull/218) author session (behavior `15370969…`) |
| Scope | Issue [#142](https://github.com/hangndat/ticket-solution/issues/142) · PR [#218](https://github.com/hangndat/ticket-solution/pull/218) · Story [#139](https://github.com/hangndat/ticket-solution/issues/139) · Epic [#134](https://github.com/hangndat/ticket-solution/issues/134) · iOS slice `apps/mobile/**` + evidence `docs/reviews/D9-S2-T3-IOS-MEDIA.md` + `docs/reviews/d9-media/ios/**` |
| Commit SHA | `f5a6c86c02ad7e41f9d15829223868e8c8ee2031` (exact tip PR #218; behavior `15370969d8d2eceb00dfdb292b7a554b35cea040`) |
| Agent | `cursor` (orca-agent-routing) |

## Checklist DoD

| Check | Result |
| --- | --- |
| Tip PR #218 = SHA review | `headRefOid` = `f5a6c86c02ad7e41f9d15829223868e8c8ee2031` |
| Diff ownership | Chỉ `apps/mobile/**` + `docs/reviews/**` — **không** `apps/api` / `apps/web` / Nest |
| EventMedia fail-closed | `SafeEventImage`: null/invalid/`onError` → `null` (collapse); `remoteImageSource` reject empty/relative/`javascript:`/`data:`; demo catalog chỉ fixture ids/UUIDs/tenant slugs — không invent media cho event lạ |
| Screenshots headless | Curated `docs/reviews/d9-media/ios/`: Events FUN FEST + Studio Night (banner+logo), fixture detail FUN FEST, My Tickets signed-out — sim-uat / Expo Go LAN · **không** computer-use |
| Không EAS Cloud | Diff không thêm `eas.json` / EAS build; UAT ghi Expo Go + Metro local; `app.config.ts` giữ `appleTeamId: BLUA62D52G` |
| Team rules | Personal Team `BLUA62D52G` — không company team; không upload signing lên EAS |
| Secrets | Bundle PNG demo + catalog keys — không credential / `.env` thật |
| Local checks (worktree) | `cd apps/mobile && pnpm test` → **187 pass**; `typecheck`/`lint` thiếu `node_modules` trong worktree reviewer — **CI mobile SUCCESS** là authority |
| CI tip PR #218 | `changes` SUCCESS · `mobile` SUCCESS · `ci` SUCCESS · web/backend/db SKIPPED — [run 39047755508](https://github.com/hangndat/ticket-solution/actions/runs/39047755508) |
| Merge | **Không merge** (coordinator) |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận) | Published remote `logoUrl`/`bannerUrl` chưa UAT trên sim (thiếu `EXPO_PUBLIC_API_BASE_URL`) — AC #142 là **media demo** + không broken image; path remote sanitize + fail-closed đã review code/test. |
| Known gap (chấp nhận) | My Tickets screenshot = OIDC unsigned / không hàng vé → chưa chứng minh visual logo/banner trên ticket row/detail; wiring `hasDemoMediaForEventId` + `EventLogo`/`EventBanner` có trong diff; không thấy broken glyph. |
| Nit | Test name `remoteImageSource accepts https URLs only` vẫn assert chấp nhận `http://` (local MinIO) — đúng hành vi, tên test hơi lệch. |

Không blocker ownership / secrets / EAS / Team / thiếu screenshot demo Events/fixture / CI đỏ.

## Verdict

**PASS with known gap**

- Gap: remote published media + ticket-row visual UAT chưa chạy (env/OIDC) — **không** vi phạm AC demo media / không broken image trên Events + fixture detail.
- Fail-closed EventMedia, headless screenshots, no EAS, Team `BLUA62D52G`: **đạt**.
- Reviewer ≠ implementer; exact SHA tip; **không merge**.

## Revalidation

Commit hành vi mới sau `f5a6c86c02ad7e41f9d15829223868e8c8ee2031` → bắt buộc DoD lại; không kế thừa verdict. Commit docs-only (artifact DoD này) không đổi runtime.
