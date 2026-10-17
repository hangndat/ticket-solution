# Spec đề xuất — D11-B2-web-redeem (S-P1-A)

> **CHƯA APPROVED** coding. Parent [`D11-B2-attendee-web.md`](./D11-B2-attendee-web.md) = TEMPLATE.
> **Một Issue / một Dispatch / `web` only.**

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor

## Mục tiêu

Redeem stale / clarity: xử lý `FORM_VERSION_STALE` (D4 evidence) — soft-reload form + copy VI; khớp PD prototype `attendee-redeem.html` (shell; ≠ QA pass).

## Phụ thuộc

- Soft: PD redeem states; BA S-P1-A
- Observed: FORM_VERSION_STALE D4 — không invent mã lỗi mới
- Brand-test AC nếu surface event redeem trong scope: [`D11-S-P0-C-brand-test-ac.md`](./D11-S-P0-C-brand-test-ac.md)
- Contract change → escalate (**không** auto-approve)

## Ownership

`apps/web` — redeem/claim form routes only.

## AC

- [ ] 409/stale không dừng ở lỗi thô: hướng dẫn thử lại / refresh version theo BA
- [ ] States PD cho routes trong scope; copy VI
- [ ] `scripts/web-uat.sh` redeem + JSON lỗi/thành công khi có
- [ ] Brand-test AC nếu trong scope
- [ ] `reviewer-dod` exact-SHA

## OUT

Home/invite; iOS redeem (= `D11-B3`); BE schema lớn; đổi auth contract.
