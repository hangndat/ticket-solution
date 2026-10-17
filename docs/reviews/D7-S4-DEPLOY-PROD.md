# D7-S4 — Deploy prod evidence (#118)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#118](https://github.com/hangndat/ticket-solution/issues/118)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)

## Authorization check

Issue [#118](https://github.com/hangndat/ticket-solution/issues/118) body:

> Ghi SHA deploy + health check; **chỉ thu thập evidence khi đã có ủy quyền deploy.**

| Check | Finding |
| --- | --- |
| Explicit “authorize deploy prod” / “ủy quyền deploy” in #118 | **Absent** |
| Explicit authorize on parent Story #115 | **Absent** (lists gate scope only) |
| Explicit authorize on Epic #103 | **Absent** |
| Task dispatcher instruction | Deploy prod **ONLY if** explicitly authorized — otherwise document NOT authorized + skip |

## Verdict

**NOT authorized — deploy skipped.**

No production rsync, compose restart, migrate, or nginx change was performed for D7-S4.  
This document is the required evidence note so the milestone gate does **not** claim a prod deploy.

## What was not done

- No SSH deploy to `conanphong` / `/opt/vemoki`
- No health-check claim for a new D7 deploy SHA
- No reuse of [D6-DEPLOY-PROD-2026-10-17.md](./D6-DEPLOY-PROD-2026-10-17.md) as D7 deploy proof (D6 ≠ D7)

## If authorize later

Re-run with `.cursor/skills/deploy-prod/SKILL.md`, record exact deploy SHA + health table, then DoD revalidation on that SHA.

## Related

- UAT: [D7-S4-UAT.md](./D7-S4-UAT.md)
- iOS build: [D7-S4-IOS-BUILD.md](./D7-S4-IOS-BUILD.md)
