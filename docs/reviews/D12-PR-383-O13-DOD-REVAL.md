# DoD revalidation — PR #383 / Issue #381 (O13 trang bán platform)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Orca terminal `term_902eb6fb-7c6e-47d0-9c50-5bc23c9a009e` · task `task_acf2e15a87e9` · dispatch `ctx_fe79ff538916` · Agent cursor |
| Independence | ≠ fix implementer `ctx_67884a3e7b1d` · ≠ prior FAIL reviewer `ctx_97a1a8c5b8cd` |
| Scope | Issue [#381](https://github.com/hangndat/ticket-solution/issues/381) · PR [#383](https://github.com/hangndat/ticket-solution/pull/383) · ownership `apps/web` (+ UAT docs/script) · Architecture impact: **Có** (subdomain/cookie boundary documented; **không** DNS cutover) |
| Commit SHA | **`d99c834634a1ba5342631274c92c923e6f143d2d`** (exact tip; `git rev-parse` + `gh pr view 383` `headRefOid`) |
| Prior FAIL (không kế thừa) | SHA `7932d09f9f3341870c01eaf50ae291e15e803834` · artifact `docs/reviews/D12-PR-383-O13-DOD.md` · **FAIL** vì CI `web` lint đỏ (`setHash` sync trong `useEffect` — `react-hooks` / set-state-in-effect) |
| Verdict | **PASS** |

## Checks (trên exact SHA)

| Check | Kết quả | Evidence |
| ----- | ------- | -------- |
| Tip SHA khớp PR | **PASS** | Worktree HEAD = `d99c834634a1ba5342631274c92c923e6f143d2d`; PR #383 `headRefOid` cùng SHA |
| Diff fix vs FAIL tip | **PASS** | `7932d09..d99c834` chỉ `apps/web/src/marketing/locale-switch.tsx` — bỏ `useState`+`useEffect`/`setHash`; đọc hash qua `useSyncExternalStore` (`subscribeHash` / `getHashSnapshot` / `getServerHashSnapshot`) |
| setState-in-effect | **PASS** | Không còn `setHash` / sync setState trong effect trên tip |
| CI web (+ aggregate) | **PASS** | Run [39123776134](https://github.com/hangndat/ticket-solution/actions/runs/39123776134) · `headSha=d99c834634a1ba5342631274c92c923e6f143d2d` · conclusion **success** · jobs `web` + `ci` + `changes` + `turbo-persist` SUCCESS; backend/mobile/db/d5 skipped (path filter) |
| Lint local worktree | **N/A** | `node_modules` thiếu trong worktree reviewer; dựa CI `web` turbo lint/typecheck/test/build trên exact SHA |
| Ownership | **PASS** | `main...d99c834`: chỉ `apps/web` marketing + `scripts/web-uat.mjs` + `docs/reviews/o13-issue-381-uat/*` — không BE/iOS/DNS/infra |

## Checklist revalidation

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | -------- | ------- | ------- |
| 1 | Lint/CI web xanh trên SHA này | **PASS** | Fix commit `d99c834`; CI run `39123776134` (mới hơn FAIL run `39123196221` trên `7932d09…`) |
| 2 | O13 AC vẫn đúng | **PASS** | Dual primary CTA (demo + quan tâm); badge `Demo giả lập` / `Simulated demo`; skip `#main`; VI\|EN + `localeSwitchHref` giữ hash; privacy/support; tracked UAT PNGs + `EVIDENCE.md` (feature/UAT content SHA `5cbfde0…`) |
| 3 | Không DNS cutover | **PASS** | Diff không đụng DNS/terraform/OIDC/deploy; PR/Issue OUT vẫn cấm cutover host |
| 4 | Artifact REVAL exact SHA + verdict | **PASS** | File này |

### O13 AC (spot-check trên tip)

- **Surface marketing / PD:** `sales-page.tsx` brand-first hero + dual primary CTA + secondary login; `chrome.tsx` skip link + `LocaleSwitch`.
- **Demo giả lập:** copy VI/EN `badge.demo` + demo section banner — không đổi giữa FAIL tip và fix tip.
- **VI+EN + hash:** unit `locale switch preserves hash (PD F3)` trong `marketing-host.test.ts`; switcher vẫn truyền `hash` vào `localeSwitchHref`.
- **Headless UAT:** tracked `docs/reviews/o13-issue-381-uat/{o13-sales-vi,o13-sales-en,o13-privacy,o13-support}.png` — content SHA `5cbfde0386d033001036091aaf4af21cddabff06`; tip sau đó chỉ stamp/docs + lint fix (không đổi UI giữa feature và tip).

## Findings

- **Blocker:** không (FAIL lint trên `7932d09…` đã đóng bởi tip `d99c834…` + CI web xanh).
- **Should-fix trước merge:** không.
- **Nit (non-blocking):** `EVIDENCE.md` vẫn ghi Tip SHA branch `7e6d161…` trong khi tip duyệt là `d99c834…` — đã có Feature/UAT content SHA; nên đồng bộ tip field khi merge/handoff (không chặn DoD).

## Limitations

1. Reviewer không tái chạy headless UAT trong session này — dựa artifact tracked trên feature SHA `5cbfde0…` + CI `web` lint/typecheck/test/build/routes trên exact tip.
2. Không merge / không đổi Project Status (coordinator).
3. Không kế thừa verdict từ `7932d09…`.

## Verdict

**PASS** — revalidation DoD trên exact SHA `d99c834634a1ba5342631274c92c923e6f143d2d`. Prior FAIL (lint setState-in-effect) **không** kế thừa. Coordinator có thể merge khi sẵn sàng; reviewer **không** merge.
