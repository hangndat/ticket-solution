# Spec đề xuất — D11-B4-backend-validate-only (S-P1-C optional)

> **CHƯA APPROVED.** Parent [`D11-B4-gate-staff-ux.md`](./D11-B4-gate-staff-ux.md) = TEMPLATE.
> **Optional Gate capability — chưa approved** (BA §12). Chỉ mở Issue sau user review + kiểm tra capability hiện có.
> **Một Issue / một Dispatch / `backend` only.** Contract **không** auto-approve.

## Vai trò chuyên môn

- Role ID: `backend` · File: `docs/agents/roles/backend.md` · Agent: cursor
- `reviewer-dod` + `reviewer-security` (check-in / authz)

## Mục tiêu

Nếu user duyệt: hỗ trợ validate-only / manual lookup **trên contract đã có hoặc đã duyệt mở rộng** — không mock quyền production trong prototype; không nới O05.

## Phụ thuộc (cứng)

1. User review roadmap chấp nhận S-P1-C
2. Audit capability hiện có (BA §12) — ghi observed vs gap
3. Mọi OpenAPI/schema change = proposal riêng → coordinator + user duyệt **trước** impl
4. Consumer ios/web = Task ownership riêng sau contract merge

## Ownership

`apps/api` / `packages/backend` (+ migration chỉ khi contract đã duyệt) — **không** sửa `apps/web` / `apps/mobile` trong Dispatch này.

## AC

- [ ] Capability check / gap list documented trước code
- [ ] Không invent endpoint “tạm”; tests isolation nếu đụng DB
- [ ] Không PII thừa trong logs/metrics labels
- [ ] `reviewer-dod` + `reviewer-security` exact-SHA

## OUT

UX copy ios/web trong cùng PR; auto-merge contract; Android; payment.
