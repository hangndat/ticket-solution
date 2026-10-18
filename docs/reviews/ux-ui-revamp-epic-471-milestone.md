# Epic #471 — Milestone DoD index (UX-UI Revamp)

| Field | Value |
| ----- | ----- |
| Epic | [#471](https://github.com/hangndat/ticket-solution/issues/471) |
| Integrated HEAD (evidence close) | `2107c8e7b23f7b8a30395e1056dd987fb092b5ae` (`main`) |
| Deploy prod | **Không** (không ủy quyền) |
| Store submit | **Không** |

## Per-Task (đã merge + DoD)

| Task | Issue | PR | Tip SHA reviewed | DoD | Artifact |
| ---- | ----- | -- | ---------------- | --- | -------- |
| PD handoff | [#472](https://github.com/hangndat/ticket-solution/issues/472) | docs on `hangndat/UX-UI` | `6a3c23f29e333b40bb344404bba2c1b347aff95d` | handoff | `docs/design/ux-ui-revamp/` |
| web coding | [#474](https://github.com/hangndat/ticket-solution/issues/474) | [#477](https://github.com/hangndat/ticket-solution/pull/477) merge `ffcd98bb` | `07ffd92bc67577662591ea34c1b7b3aefdb35e81` | PASS with known gap | `docs/reviews/ux-ui-revamp-web-474.md` |
| iOS coding | [#475](https://github.com/hangndat/ticket-solution/issues/475) | [#476](https://github.com/hangndat/ticket-solution/pull/476) merge `c8f507bb` | `48393deefbaf759c6522a27af0176ae5d8889983` | PASS with known gap | `docs/reviews/ux-ui-revamp-ios-475.md` |

## Milestone gates

| Gate | Result | Evidence | Merge |
| ---- | ------ | -------- | ----- |
| (a) Web headless UAT | **PASS with known gap** | [`ux-ui-revamp-epic-471-web-uat.md`](./ux-ui-revamp-epic-471-web-uat.md) — auth-smoke aligned to thin `/auth`; screenshots Home/redeem/account | PR [#480](https://github.com/hangndat/ticket-solution/pull/480) → `f37f274a576f2ca8231e2407d7838d24f4a99abb` |
| (a) iOS headless UAT | **PASS with known gap** | [`ux-ui-revamp-epic-471-ios-gates.md`](./ux-ui-revamp-epic-471-ios-gates.md) + `docs/reviews/epic-471-ios-gates/*.png` | PR [#481](https://github.com/hangndat/ticket-solution/pull/481) → `2107c8e7b23f7b8a30395e1056dd987fb092b5ae` |
| (b) Local iOS build | **PASS** | same iOS gates doc — Expo prebuild + Release xcodebuild Team `BLUA62D52G`, **no EAS Cloud** | PR #481 |
| (c) Deploy prod | **N/A** | không ủy quyền | — |
| (d) Review artifacts + exact SHA | **PASS** | bảng trên + docs này | this commit |

### Known gaps (chấp nhận đóng Epic)

1. Root/web harness: live Keycloak `auth-logout` path may still need IdP; prod `/auth` 200 noted in web UAT doc — product surface vẫn redirect mỏng theo IA.
2. iOS ticket-detail UAT unsigned → fail-closed «Cần đăng nhập» (không OIDC live trong session gate).
3. Coding DoD gaps đã ghi trên #474/#475 (root auth-smoke cũ đã sửa ở gate (a); sim/xcodebuild đã bổ sung ở gate này).

## Verdict

**Epic #471 acceptance complete** trên `main` @ `2107c8e7b23f7b8a30395e1056dd987fb092b5ae` — không tuyên bố pilot ready / store ready.
