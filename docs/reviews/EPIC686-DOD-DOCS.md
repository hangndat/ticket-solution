# DoD — Epic #686 docs wave (PR #688 · #689 · #690)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD · `term_59de47f6-c193-4b3b-93c1-b13917cbfcaf` · task `task_132bea6663cb` · dispatch `ctx_9cea9c1b17b9` |
| Epic | [#686](https://github.com/hangndat/ticket-solution/issues/686) — Seed prod: 4 org, 6 event, staff, media |
| Scope | Docs-only PRs (dataset BA, ADR-21/runbook, PD media inventory) — **không** review BE seed runtime |
| Independence | Reviewer session ≠ implementer các PR feature |

## SHAs reviewed (exact)

| PR | Title | SHA (`git rev-parse` / `gh pr view`) |
| --- | --- | --- |
| [#688](https://github.com/hangndat/ticket-solution/pull/688) | docs(demo): dataset seed prod Epic #686 | `ecd3471e94723e0bf6e94f7dca4c37395d0771da` |
| [#689](https://github.com/hangndat/ticket-solution/pull/689) | docs(ops): ADR-21 + runbook seed prod Epic #686 | `6316d3c2535694c73691eaa19ebdcd343cfd6b03` |
| [#690](https://github.com/hangndat/ticket-solution/pull/690) | docs(design): inventory media prod seed Epic #686 | `eaf0fd1bf8956889befe1f43f45d510fb04290ed` |

## CI on SHA (`./scripts/gh-dod-evidence.sh`)

```text
# PR 688 — head.sha=ecd3471e94723e0bf6e94f7dca4c37395d0771da
ci=success changes=success (app jobs skipped — docs-only)

# PR 689 — head.sha=6316d3c2535694c73691eaa19ebdcd343cfd6b03
ci=success changes=success (app jobs skipped)

# PR 690 — head.sha=eaf0fd1bf8956889befe1f43f45d510fb04290ed
ci=success changes=success (app jobs skipped)
```

## Epic verdict

**FAIL** — BA dataset (#688) đạt AC mục A, nhưng ADR/runbook (#689) và PD inventory (#690) **chưa khớp contract** `686f0001-*` / tên org-event / `VEM-*` / không `· Demo`. Không an toàn cho owner gate §9 (dataset UUID khớp code) cho đến khi reconcile và re-review.

| PR | Verdict | Ghi chú |
| --- | --- | --- |
| #688 | **PASS** | Dataset 4 org (1+2+3+0), 6 khung giờ ICT, staff plus-address, ma trận vai |
| #689 | **FAIL** | Còn mô tả D9 (`d9d9f001`, `· Demo`, `DEMO-*`) — mâu thuẫn #688 |
| #690 | **FAIL** | Surface audit khớp code; map dataset §4 vẫn placeholder Alpha/Beta |

---

## PR #688 — `docs/demo/PROD-SEED-DATASET.md`

### PASS — AC §A

- **4 org / 6 event / 0 event org4:** bảng phân bố `docs/demo/PROD-SEED-DATASET.md` (org slugs `luc-bao-live`, `saigon-pulse`, `heritage-hoi-an`, `mekong-makers`).
- **Không `· Demo`:** stated line 4–5 và tên event UI không chứa marker.
- **6 khung giờ phân biệt**, anchor `2026-10-21`: E01 quá khứ xa → E06 sắp tới xa (bảng Events ~lines 47–54 tại SHA).
- **Staff:** pattern `hangndat+<orgKey>-<roleKey>@gmail.com`; 4×5 roster + assignment matrix; org4 không event assignment.
- **Namespace:** `686f0001-*` UUID tables; redeem prefix `VEM-` (không `DEMO-`).
- **Role map:** bảng `MembershipRole` tham chiếu `packages/backend/src/role-map.ts` — hợp lý cho BE handoff.

### Should-fix (non-blocking cho PASS doc BA)

- AC checklist cuối file vẫn `[ ]` — OK cho template; coordinator có thể tick khi merge.

---

## PR #689 — ADR-21 + runbook + architecture handoff

### PASS — safety / ops structure

- **Backup:** `PROD-SEED-RUNBOOK.md` §3 — `pg_dump` bắt buộc, Owner gate #1.
- **Dry-run:** §4 — preflight SQL read-only + restore/staging; ghi rõ CLI chưa `--dry-run` (handoff `PROD_SEED_DRY_RUN`).
- **Rollback:** §8 — full restore khuyến nghị + surgical theo allowlist UUID + MinIO key delete có kiểm soát.
- **Owner gates:** §9 — 10 bước, gate #7 dod+sec, gate #9 owner explicit trước prod mutate.
- **Secrets:** không paste `.env` / pepper; HMAC prod invariant ADR-21 §Quyết định (3).
- **Staff / email:** ADR-21 chọn OIDC login + DB grant; không bulk invite; stop worker §5 — khớp Epic.

### FAIL — blockers (contract drift vs #688)

| # | Severity | Location | Finding |
| --- | --- | --- | --- |
| B1 | **blocker** | `docs/ops/ADR-21-PROD-DEMO-SEED.md` ~L18 | “mở rộng cùng namespace UUID `d9d9f001-…`” — **sai** so với BA `686f0001-*` (#688). |
| B2 | **blocker** | `docs/ops/ADR-21-PROD-DEMO-SEED.md` ~L44 | Invariant “Marker `· Demo` chỉ trên `event.name`” — **mâu thuẫn** Epic + #688 (cấm `· Demo` UI). |
| B3 | **blocker** | `docs/ops/PROD-SEED-RUNBOOK.md` §1 (~L28–36) | Liệt kê `· Demo` trên `event.name`, redeem `DEMO-*`, UUID `d9d9f001-…`, `brand/demo/manifest.json` — copy D9, không phản ánh prod seed doc. |
| B4 | **blocker** | `docs/ops/PROD-SEED-RUNBOOK.md` §4.1 (~L88–96) | Preflight slug ví dụ `mfest-demo`, `demo-studio` + allowlist `d9d9f001-%` — operator chạy sai allowlist nếu theo #688. |
| B5 | **blocker** | `docs/ops/PROD-SEED-RUNBOOK.md` §8.2 (~L108) | Surgical rollback UUID `d9d9f001-…` — không khớp namespace seed mới. |

### Should-fix

- `docs/architecture/epic-686-prod-seed.md` — handoff table “Dataset UUID 4/6 | BA | Song song” nên cập nhật khi #688 merge; link ADR khi reconcile B1–B5.

---

## PR #690 — `docs/design/prod-seed-media/README.md`

### PASS — surface audit vs code (spot-check `main` tree)

| Claim (doc §2) | Code | Result |
| --- | --- | --- |
| iOS list banner h **142**, cover | `apps/mobile/src/screens/events.tsx` L75–81 `height={142}` | OK |
| iOS detail hero h **220** | `apps/mobile/src/screens/event-detail.tsx` L326–333 | OK |
| iOS `EventLogo` h **36**, w ≈115 | `apps/mobile/src/components/event-media.tsx` L97–120 `height=36`, `width: height * 3.2` | OK |
| Web banner export **1200×630** | `apps/web/src/ui/event-media.tsx` L39–46 `width={1200} height={630}` | OK |
| AX labels banner/logo | `event-media.tsx` L68, L104 | OK |

### FAIL — blockers (dataset / brand alignment)

| # | Severity | Location | Finding |
| --- | --- | --- | --- |
| P1 | **blocker** | `README.md` header table ~L9 | “Dataset BA … **chưa có trên branch**” — **stale** khi #688 open; §4 vẫn placeholder. |
| P2 | **blocker** | `README.md` §4.1–4.2 | Org/event **Alpha/Beta/Gamma/Delta** + `TBD-*` slugs — không map `luc-bao-live` / `dem-am-indie` / `primaryColor` từ #688 (`#1B4D3E`, `#E85D04`, …). |
| P3 | **blocker** | `README.md` §6 G5 | Gap “`PROD-SEED-DATASET.md` | BA” — DoD Epic yêu cầu inventory **khớp dataset**; chưa đạt. |
| P4 | should-fix | `README.md` §2.1 (web) | Doc ghi list banner h 140; iOS list dùng 142 — nit, không chặn sau P1–P3. |

### Known gaps (documented, OK for PD task scope)

- G1–G4 (logoUrl projection, OG per event) — ghi trong §6; không nuốt security prod gate.

---

## Security / prod gate (cross-cutting)

- Không secret trong PR diff (reviewed via GitHub content API).
- Runbook cấm seed từ laptop, Keycloak import staff, bulk invite — **PASS** hướng dẫn.
- **FAIL** operational safety nếu owner dùng runbook hiện tại với dataset #688 — cần sửa B1–B5 trước prod.

## Revalidation

Sau khi #689/#690 reconcile với `ecd3471…` (hoặc tip mới): re-review exact SHA mới; không kế thừa PASS #688 cho ops/PD.

## Merge note

Reviewer **không** merge PR feature #688–#690. Artifact PR docs (`EPIC686-DOD-DOCS.md`) chờ coordinator merge theo process.
