# DoD — PR #366 (UI cleanup iOS debug/noise)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | `reviewer-dod` · Orca Dispatch `ctx_e1667344d9dc` · terminal `term_59ae47d6-eb0d-4e4c-bdd6-7279d2072ed5` · agent `cursor` · **≠** implementer |
| Scope | PR [#366](https://github.com/hangndat/ticket-solution/pull/366) · ownership `apps/mobile` · UI debug/noise cleanup |
| Commit SHA | `3c8d2266467a9459d7ef4af05bba1e5d17ab2063` (exact tip; `git rev-parse HEAD` trên worktree review) |
| Architecture impact | Không |
| Verdict | **PASS** |
| Merge | **Không** (task chỉ DoD review; coordinator quyết định merge) |

## Checks trên SHA

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `3c8d2266467a9459d7ef4af05bba1e5d17ab2063` |
| Tip commit file list (`git show 3c8d226 --name-only`) | Chỉ `apps/mobile/src/**` (13 files) — **mobile-only** |
| GitHub PR files (#366) | Khớp tip: chỉ `apps/mobile` |
| CI GitHub (`ci` / `mobile` / `changes` / `turbo-persist`) | **pass** trên tip ([run 39115954560](https://github.com/hangndat/ticket-solution/actions/runs/39115954560)) |
| `cd apps/mobile && pnpm test` (worktree tip) | **208 pass** / 0 fail |
| Headless sim-uat / local Xcode | Không yêu cầu bởi AC task này (UX copy/chrome) — **N/A** |
| EAS Cloud Build | Không dùng |
| Graph `code-review-graph-ticket` | Stale vs tip (built @ `141dba7…`); đã đối chiếu **source** tip — source wins |

## AC verification

| AC (task / PR) | Kết luận |
| --- | --- |
| Không APNs token-length dump trên UI mặc định | **Met** — `push-status.tsx` bỏ `summarizeToken` (prefix/suffix + `N chars` + EN backend dump); `summarizeRegistration` chỉ copy VI thân thiện; không surface `result.reason` / token |
| Không dead `redactGuestClaimIntent` debug trên claim | **Met** — `claim.tsx` bỏ import + `void redactGuestClaimIntent(peek…)` sau submit; helper còn trong `claim-intent.ts` + unit test (không gắn UI claim) |
| Copy VI | **Met** — push / account / wallet / claim / events / account-deletion chrome đã VI |
| Không bilingual EN noise mặc định | **Met** — `account-deletion-copy.ts` bỏ `bilingual()` / `PROCESSING_NOTE_EN` / title `VI / EN`; account privacy footer bỏ EN dump; wallet bỏ raw UUID/`/v1/me` operator fields |
| Ownership mobile-only | **Met** — tip commit + PR file list chỉ `apps/mobile` |

## Findings

### Blocker

Không có.

### Should-fix

Không có (không chặn PASS theo AC).

### Nit / known limits (không nuốt AC)

1. **Internal EN còn trong non-UI paths** — `push.ts` `settle()` vẫn trả message EN (`APNs device-token client only…`) và `apns-device-token.ts` có reason EN; **không** đưa vào `PushStatus` Notice mặc định (UI map sang VI). Ngoài phạm vi AC “dump trên chrome mặc định”.
2. **Không chạy sim-uat / xcodebuild** trong review này — AC không yêu cầu; unit + CI mobile đủ cho slice copy/chrome.
3. **CRG detect_changes stale** — đừng tin snippet graph cũ (vd. account-deletion copy cũ còn O06/bilingual); đã đọc source tip.

## Revalidation

Commit hành vi mới sau tip này → DoD lại trên exact SHA mới; **không** kế thừa verdict này.
