# DoD R2 — Epic #686 docs (#689 · #690 re-review)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD · `term_d8e9405c-4bce-4299-a48c-da6800a6e400` · task `task_583614f991b0` · dispatch `ctx_5f8c28ea0def` |
| Epic | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| Prior artifact | [EPIC686-DOD-DOCS.md](./EPIC686-DOD-DOCS.md) (R1 — FAIL #689/#690) |
| Independence | Reviewer session ≠ implementer PR #689/#690 |

## SHAs reviewed (exact)

| PR | Title | SHA |
| --- | --- | --- |
| [#689](https://github.com/hangndat/ticket-solution/pull/689) | docs(ops): ADR-21 + runbook seed prod Epic #686 | `67c9b8dec1963a4a2ababb7bc38e9e158c4e714b` |
| [#690](https://github.com/hangndat/ticket-solution/pull/690) | docs(design): inventory media prod seed Epic #686 | `1ff91a3bcbb0204fa53cfab537aa0d273f8f1a08` |

Dataset SoT cross-check: `PROD-SEED-DATASET.md` on PR #689 tip (bundled with ops docs) — namespace `686f0001-*`, redeem `VEM-*`, không `· Demo` / không `DEMO-*` làm prefix prod.

## CI on SHA (`./scripts/gh-dod-evidence.sh`)

```text
# PR 689 — head.sha=67c9b8dec1963a4a2ababb7bc38e9e158c4e714b
state=open mergeable=true | ci=success changes=success (app jobs skipped)

# PR 690 — head.sha=1ff91a3bcbb0204fa53cfab537aa0d273f8f1a08
state=open mergeable=true | ci=success changes=success (app jobs skipped)
```

## Epic verdict (R2 scope)

**PASS** — #689 và #690 đã reconcile với contract dataset #688 (`686f0001-*`, `VEM-*`, không `· Demo`). R1 blockers B1–B5 và P1–P3 **đóng** tại SHA trên.

| PR | R1 | R2 | Ghi chú |
| --- | --- | --- | --- |
| #689 | FAIL | **PASS** | ADR-21 + runbook + `epic-686-prod-seed.md` dùng `686f0001-*`; cấm `· Demo`; preflight/rollback allowlist `686f0001-%`; `VEM-*`; manifest `brand/prod/` |
| #690 | FAIL | **PASS** | §4 map org/event/slug/UUID/`primaryColor` khớp BA; header không còn “chưa có trên branch”; checklist §6 G5 ticked |

PR #688 không re-review SHA mới trong R2; ops/PD trên tip #689/#690 tham chiếu cùng `PROD-SEED-DATASET.md` bundled.

## R1 blocker closure

### PR #689 (B1–B5)

| ID | R1 finding | R2 at `67c9b8d…` |
| --- | --- | --- |
| B1 | ADR ghi namespace `d9d9f001` | **Closed** — Epic #686 explicit `686f0001-*`; D9 chỉ historical contrast |
| B2 | Invariant “Marker `· Demo` chỉ trên event.name” | **Closed** — **Không** `· Demo` trên UI prod seed |
| B3 | Runbook §1 copy D9 (`· Demo`, `DEMO-*`, `d9d9f001`, `brand/demo`) | **Closed** — §1 table: `VEM-*`, `686f0001-*`, không `· Demo` UI |
| B4 | Preflight `mfest-demo` / allowlist `d9d9f001-%` | **Closed** — SQL examples `686f0001-0001/0002-…%` |
| B5 | Surgical rollback `d9d9f001` | **Closed** — allowlist `686f0001-…` §8 |

### PR #690 (P1–P3)

| ID | R1 finding | R2 at `1ff91a3…` |
| --- | --- | --- |
| P1 | Header “dataset chưa có trên branch” | **Closed** — link SoT + namespace `686f0001-*` |
| P2 | §4 Alpha/Beta placeholder | **Closed** — `luc-bao-live`, `dem-am-indie`, … + UUID columns |
| P3 | §6 G5 gap BA | **Closed** — `[x] Map §4 khớp PROD-SEED-DATASET.md` |

### Non-blocking (carried)

- P4 / web list h 140 vs iOS 142 — nit; documented in R1, không chặn merge docs.
- G1–G4 product gaps (logoUrl projection, OG) — documented §6; không nuốt owner gate §9 runbook.

## Security / prod gate

- Không secret trong diff (spot review paths ops/design/demo).
- Runbook: backup §3, dry-run §4, owner gates §9, no laptop seed — **unchanged PASS** from R1 structure; **operational contract** now aligned with dataset.

## Verdict

| PR | Verdict |
| --- | --- |
| #689 | **PASS** |
| #690 | **PASS** |

Reviewer không merge. Coordinator merge sau WIP/dependency (#688 integration order per Epic).
