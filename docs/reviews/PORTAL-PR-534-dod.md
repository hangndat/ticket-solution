# DoD review — PR #534 / Issue #519 (P2-ROLES-PRESET)

| Field | Value |
| --- | --- |
| Reviewer / session | `reviewer-dod` · James · Orca Dispatch `ctx_62405302c3f0` · terminal `term_4f695e37-0b33-4ac2-9bf6-73fc11202da5` (≠ implementer) |
| Scope | Issue [#519](https://github.com/hangndat/ticket-solution/issues/519) · PR [#534](https://github.com/hangndat/ticket-solution/pull/534) · ownership `apps/portal` (web/portal) |
| Commit SHA | **`ea7c5d499ac02cdb93cc6c3a2d7ebb5354aea9a7`** (post-rebase tip; **không** kế thừa PASS từ `4b3d2b6a2e1add835ac8969e272b0376ce496eef`) |
| Architecture impact | Có — tab Vai trò / named server presets; đối chiếu ADR [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) **§7** + UX AC-PS4 |
| Decision IDs | O17 (P2 ADR) · `P2-ROLES-PRESET` · ADR-20 portal BFF |
| Verdict | **PASS** |

## Checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| MERGEABLE CLEAN | PASS | `gh pr view 534`: `mergeable=MERGEABLE`, `mergeStateStatus=CLEAN`, `headRefOid=ea7c5d499ac02cdb93cc6c3a2d7ebb5354aea9a7` |
| CI xanh trên SHA | PASS | Actions run `39197025581`: `changes`/`portal`/`turbo-persist`/`ci` = **SUCCESS**; out-of-scope jobs SKIPPED (expected portal-only) |
| Preset picker, **không** checkbox matrix (AC-PS4 / BA AC-D1) | PASS | Invite `Select` system + `preset:<uuid>`; catalog permissions = read-only `Tag`; **no** `Checkbox` / editable permission composer in `members/page.tsx` |
| BFF role-presets + member role | PASS | `GET …/role-presets` proxy; `PATCH …/members/{id}/role` built-in only + reject permission arrays; invite `POST` accepts `MembershipRole \| { presetId }` via `inviteRoleFromUnknown` |
| last-Owner | PASS | `showLastOwnerGuard` → `Modal.error` when `LAST_OWNER_REQUIRED` on role change **and** revoke member |
| ADR §7 | PASS | Named presets only (phương án A); client never sends permission arrays; handoff web=picker, no checkbox UI |

## Checks (exact SHA)

```text
git rev-parse HEAD
# ea7c5d499ac02cdb93cc6c3a2d7ebb5354aea9a7

gh pr view 534 --json mergeable,mergeStateStatus,headRefOid,statusCheckRollup
# MERGEABLE / CLEAN / ea7c5d499ac02cdb93cc6c3a2d7ebb5354aea9a7
# portal + changes + turbo-persist + ci = SUCCESS

# Local unit tests: node_modules missing in this reval worktree — not re-run here.
# Relied on CI job `portal` SUCCESS on the same SHA (run 39197025581), which executes
# `tsx --test tests/*.test.ts` including ops-role-presets / ops-paths / i18n.
```

Static review of diff `main...ea7c5d4` (10 files, +845/−66):

- `apps/portal/src/ops/role-presets.ts` — rejects `permissions` / `tenantPermissions` / `eventPermissions` on invite role body; UUID preset id only.
- `apps/portal/app/api/bff/tenants/[tenantId]/role-presets/route.ts` — staff bearer GET forward.
- `apps/portal/app/api/bff/tenants/[tenantId]/members/[membershipId]/role/route.ts` — CSRF + system role + reason; rejects client permission arrays.
- `apps/portal/app/api/bff/tenants/[tenantId]/invites/route.ts` — `inviteRoleFromUnknown`; rejects permission arrays.
- `apps/portal/app/t/[tenantId]/members/page.tsx` — Tabs Users / Invites / **Vai trò**; alert server-defined; last-Owner modal; assign modal built-in-only (documented; changeRole OpenAPI enum-only — preset gán qua invite path, khớp ADR §7 handoff).
- Unit tests assert no permission-composer accept path and role-presets upstream path.

## Findings

| Severity | Item |
| --- | --- |
| — | No blockers. |
| nit | PR body «Exact SHA» vẫn ghi `4b3d2b6a…` — tip thực tế là `ea7c5d4…` (docs metadata only). |
| known gap (accepted) | Manual UAT invite/demote last-Owner chưa tick trên PR template; AC coding covered by unit + static + CI. Headless browser UAT không bắt buộc cho Task #519 này. |
| known gap (accepted) | Assign existing member = built-in roles only; preset assignment qua invite — đúng contract note trong BFF route / ADR §7.3. |

## Limitations

- Reviewer session không có `node_modules` → không chạy lại `pnpm --filter @ticket/portal test` local; CI `portal` SUCCESS trên cùng SHA là bằng chứng runtime unit.
- Không merge (per task). Coordinator merge sau khi đủ DoD + CI (đã xanh).

## Verdict

**PASS** trên exact SHA `ea7c5d499ac02cdb93cc6c3a2d7ebb5354aea9a7`. Revalidation bắt buộc nếu có commit hành vi mới sau SHA này.
