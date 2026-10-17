# DoD review — PR #217 / Issue #142 (D9-S2-T3 web media)

| Trường | Giá trị |
| --- | --- |
| **Verdict** | **PASS** |
| Reviewer / session | Cursor DoD (Orca) · terminal `term_61dedaa6-0a97-42a5-a1a6-5b859b171e34` · task `task_d6157b5e5460` · dispatch `ctx_76bb62ad3d92` · Role `reviewer-dod` · **≠** implementer session |
| Scope | Issue [#142](https://github.com/hangndat/ticket-solution/issues/142) web slice · PR [#217](https://github.com/hangndat/ticket-solution/pull/217) · ownership `apps/web` (+ `docs/reviews` evidence) · iOS sibling PR [#218](https://github.com/hangndat/ticket-solution/pull/218) **riêng** |
| Commit SHA đã duyệt | `a165dfcca52702ea542d2e336fa0653626c75c46` |
| Impl SHA (media) | `99d01b0b9065c4fa8ef73ff8966a3bf90348e303` (ancestor của tip; tip chỉ pin docs evidence) |
| Ngày | 2026-10-18 |
| Revalidation | Bắt buộc nếu có commit hành vi mới sau SHA trên |
| Merge | **Không** — reviewer không merge |

## Checklist DoD

| Tiêu chí | Kết quả |
| --- | --- |
| Một ownership slice (web only; không sửa `apps/mobile`) | PASS — diff `main...SHA` chỉ `apps/web/**` + `docs/reviews/**` |
| Không secrets / `.env` / credential thật | PASS |
| Exact SHA under review khớp tip PR | PASS — `gh pr view 217` headRefOid = `a165dfcca52702ea542d2e336fa0653626c75c46` |
| CI xanh trên SHA | PASS — jobs `web` / `ci` / `changes` / `turbo-persist` green ([run 39047289581](https://github.com/hangndat/ticket-solution/actions/runs/39047289581)); BE/mobile/D5 skip (đúng path filter) |
| AC #142 web: không broken demo image | PASS — screenshots + `SafeEventImage` fail-closed + bundled `/public/demo/*.png` |
| `SafeEventImage` fail-closed | PASS — empty/null/`onError` → `null` (không glyph broken) |
| `sanitizeMediaUrl` https / root-relative only | PASS — unit rejects `http`/`javascript`/`data`/`//`/`..` |
| UAT headless evidence | PASS — curated Playwright screenshots trong `docs/reviews/d9-media/web/` |
| Reviewer độc lập ≠ implementer | PASS — session Orca DoD này |
| Không đóng #142 chỉ vì web | PASS — PR không `Fixes`/`Closes`; iOS #218 riêng |
| Merge / self-merge | N/A — Task: no merge |

## Checks đã chạy (trên SHA)

```bash
git rev-parse HEAD
# → a165dfcca52702ea542d2e336fa0653626c75c46

# Local unit (npx tsx — worktree thiếu pnpm bin tsx):
cd apps/web && npx --yes tsx --test tests/demo-media.test.ts
# → 5 pass / 0 fail

# Asset integrity at SHA:
git cat-file -s …:apps/web/public/demo/logo.png   # 11186
git cat-file -s …:apps/web/public/demo/banner.png # 37546
file apps/web/public/demo/*.png
# logo: PNG 760×200 · banner: PNG 1200×630

gh pr checks 217  # web/ci/changes/turbo-persist = pass
```

### UAT screenshots (visual review)

| Surface | Artifact | Observation |
| --- | --- | --- |
| `/` home cards | `docs/reviews/d9-media/web/d9-media-home.png` | Banner typographic pack hiển thị; không broken-image glyph |
| Fun Fest event | `docs/reviews/d9-media/web/d9-media-fun-fest.png` | Logo Vemoki + hero banner (object-fit cover crop); không broken |
| Form & Forum event | `docs/reviews/d9-media/web/d9-media-form-forum.png` | Tương tự; media load OK |

Implementer evidence (đã đối chiếu): `GET /demo/logo.png` 200 · 11186 B; `GET /demo/banner.png` 200 · 37546 B; Playwright `naturalWidth` logo 760 · banner 1200.

## Diff review (tóm tắt)

- `public/demo/{logo,banner}.png` — bundled từ brand/vemoki; kích thước khớp claim.
- `demo-media.ts` — catalog fixture web + seed ids/UUID; không invent URL cho unknown; `sanitizeMediaUrl` fail-closed.
- `SafeEventImage` — client `onError` → unmount img.
- `EventBanner` / `EventLogo` / `EventMediaHeader` — prefer sanitized URL rồi demo pack.
- Home + event pages wire media; CSS `object-fit: cover` trên banner hero/card (crop có chủ đích, không phải broken).
- Unit `demo-media.test.ts` cover fixtures + sanitize negatives.

## Findings

### Không blocking

1. **Graph MCP trống** trên worktree DoD — review dựa source + tests + screenshots + CI (không chặn).
2. **pnpm exec tsx** thiếu trong worktree — tái chạy qua `npx tsx`; CI `web` job đã xanh trên cùng SHA.
3. **Hero banner crop** (`object-fit: cover`) làm crop chữ brand trên poster — intentional CSS, media vẫn load (naturalWidth > 0).

### Known limitations (không FAIL — đã ghi trên PR/implementer)

- Không resolve MinIO signed URL runtime — demo surface dùng static `/public/demo` (ADR-14 bucket private).
- Web marketing slugs (`sunburst` / `northline`) khác seed iOS; media pack file chung.
- Issue #142 còn iOS sibling (#218) — web DoD **không** đóng #142.

## Verdict

**PASS** trên exact SHA `a165dfcca52702ea542d2e336fa0653626c75c46`.

Coordinator có thể merge PR #217 sau khi xác nhận CI vẫn xanh trên tip; **không** tái dùng verdict nếu tip đổi hành vi. Không merge từ reviewer session này. iOS #218 DoD riêng.
