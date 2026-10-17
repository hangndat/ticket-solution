# Evidence — D10 S1+S3 App Store metadata docs

| Field | Value |
| --- | --- |
| Scope | Issues #151–#153, #157–#159 · Epic #150 |
| Paths | `docs/asc/**`, `apps/mobile/ASC-METADATA.md`, `apps/mobile/README.md` (pointer) |
| Implementer | Orca Cursor worker `term_3fc31cb0-815f-43ac-ab9a-b89e43fcc7f5` · task `task_855fcfd274b8` · dispatch `ctx_574e82e7088e` |
| Commit SHA | `e5d04332c8920ccd8305c6343f72f591a1b225e6` |
| Checks | Docs-only — không archive, không TestFlight submit, không store submit |
| Verdict (impl handoff) | Artifacts complete for **Chờ duyệt**; **không** claim submitted |

## Deliverables

- [listing-metadata.md](../asc/listing-metadata.md) — VI/EN + keywords (#152)
- [asc-fields-checklist.md](../asc/asc-fields-checklist.md) — ASC fields (#153)
- [privacy-nutrition.md](../asc/privacy-nutrition.md) + [privacy-policy-draft.md](../asc/privacy-policy-draft.md) (#158)
- [app-review-notes.md](../asc/app-review-notes.md) — review notes + demo (#159)

## Known gaps (không chặn docs; chặn submit)

1. `https://vemoki.com/privacy` còn 404 — cần publish trước submit.
2. Screenshot ASC UI sau khi điền tay (che secret).
3. Credential production-demo chỉ paste ASC, không vào git.
4. Screenshots/preview + local archive/TestFlight = stories khác trong Epic #150.

## Claim boundary

**Chưa submit** App Store / TestFlight từ công việc này.
