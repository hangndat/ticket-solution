# DoD — PR #507 / Issue #489 (Visual Identity v2 iOS — Live Pulse)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Orca Dispatch `ctx_5ff361d67ca1` · task `task_debe91e1fec2` · terminal `term_542c535d-b1d0-46af-b678-2fb02a9034c2` · worktree `v2-dod-ios-507` · **≠** implementer |
| Scope | Epic [#486](https://github.com/hangndat/ticket-solution/issues/486) · Issue [#489](https://github.com/hangndat/ticket-solution/issues/489) · PR [#507](https://github.com/hangndat/ticket-solution/pull/507) · ownership `apps/mobile` |
| Commit SHA | `456f68cd10b763728a54f6ffe78308074543b321` (exact — `git rev-parse HEAD` trên worktree review) |
| Architecture impact | Có (hẹp) — brand tokens / type / atmosphere chrome; không đổi API/OIDC/QR payload |
| Decision IDs | Live Pulse freeze `docs/design/visual-identity-v2/` · `brand/vemoki/tokens.json` v2 — **O02 / PD §6.1 chrome permission N/A** (không đụng tab IA / staff hide) |
| Agent | `cursor` (orca-agent-routing) · Cost tier `standard` |
| Ngày review | 2026-10-19 |
| Verdict | **PASS** |

## Checklist (spec DoD)

| # | Gate | Kết luận |
| --- | --- | --- |
| C1 | Colors khớp Live Pulse brand tokens (`ink` / `paper` / `signal` / `focus`) | **PASS** — `apps/mobile/src/theme/tokens.ts` = `brand/vemoki/tokens.json`; `colors.*` map brand; splash/notification plugin hex cập nhật; derived `paperDeep` / `inkMuted` khớp color-mix handoff |
| C2 | Display font **Sora** (thay Syne) + Be Vietnam Pro body | **PASS** — `fonts.ts` `display: 'Sora'`; `BrandFontsGate` load `Sora-Variable.ttf`; OFL + README; Syne asset removed |
| C3 | Không EAS Cloud Build | **PASS** — không `eas.json`; diff không thêm EAS workflow; `app.config.ts` ghi rõ never EAS Cloud |
| C4 | Tests evidence trên exact SHA | **PASS** — xem Checks |
| C5 | 4 attendee surfaces: Events · redeem · Ví · ticket detail | **PASS** — Events + Ví wrap `ScreenAtmosphere`; redeem + ticket-detail qua `Page` (AtmosphereWash); commit message khớp |

## Checks trên SHA `456f68cd10b763728a54f6ffe78308074543b321`

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `456f68cd10b763728a54f6ffe78308074543b321` |
| Diff ownership vs `main` | 16 paths — chỉ `apps/mobile/**` (theme, fonts, Events/Ví, Page/atmosphere, `app.config.ts`) |
| `node --experimental-strip-types --test src/theme/*.test.ts` | **22 pass / 0 fail** (gồm lock `tokens.json` Live Pulse + supersede v1 terracotta) |
| `cd apps/mobile && pnpm test` | **226 pass / 0 fail** |
| EAS Cloud | Không — `NO_EAS_JSON`; chỉ docs/policy nhắc cấm |
| Syne leftover trong `apps/mobile/src` | Không (chỉ assertion “supersedes terracotta” trong test) |
| code-review-graph-ticket | Full rebuild trên SHA review; `detect_changes` risk ~0.60 — gap unit cho `Page`/`AtmosphereWash` (UI chrome; token contract đã test) |
| CI GitHub trên tip | **Không xác minh** — `gh` API rate limit user hangndat lúc review; không dùng làm blocker khi local tests xanh trên exact SHA |

## Findings

### Blocker

Không.

### Should-fix (không chặn PASS theo checklist Task)

1. **Thiếu component/unit test cho `AtmosphereWash` / `Page` wrap** — graph báo untested; hành vi visual. Token lock + full mobile suite đủ cho AC theme; follow-up test render tùy coordinator.

### Nit / known limits

- Không có sim-uat / screenshot first-viewport Live Pulse trên SHA này trong PR. Design handoff đặt UAT headless sau coding; **Task DoD checklist không yêu cầu** sim-uat cho gate này.
- `colors.label` / `secondary` cố định brand ink (không còn `Color.ios.*` adaptive) trên attendee paper — đúng hướng Live Pulse; dark-mode system label không còn trên surface này.
- `Page` atmosphere cũng áp cho claim/account/staff khi dùng `Page` — side effect rộng hơn 4 màn attendee; nhất quán brand, ngoài scope hẹp Issue.

## Verdict

**PASS** trên exact SHA `456f68cd10b763728a54f6ffe78308074543b321`: brand hex + Sora khớp freeze, bốn surface attendee có atmosphere/token path, không EAS Cloud, tests 226 pass trên SHA.

Coordinator: sau CI xanh (khi rate limit hết) + ủy quyền integration → merge; Project `Hoàn thành` chỉ khi đủ gate merge/CI theo `github-project-tracking.mdc`. **Không** kế thừa verdict nếu tip đổi hành vi — revalidation SHA mới.

## Revalidation

Commit hành vi theme/font/screen mới sau tip này → DoD lại trên SHA mới; không reuse PASS này.
