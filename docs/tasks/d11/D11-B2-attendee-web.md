# TEMPLATE — D11-B2 Attendee journeys (web)

> **TEMPLATE NOT DISPATCH-READY.**
> Parent index only — **cấm** `worker-start` / tạo một Issue trộn home+invite+redeem.
> Sau user review roadmap: mở **một Issue + một Dispatch** cho đúng **một** sub-spec bên dưới.
> Contract/OpenAPI **không** auto-approve từ template này.

## Vai trò chuyên môn (khi split)

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor
- Brand-test (S-P0-C): gắn [`D11-S-P0-C-brand-test-ac.md`](./D11-S-P0-C-brand-test-ac.md) vào sub-spec surface tương ứng

## Sub-specs (DISPATCH-READY candidates — vẫn CHƯA APPROVED coding)

| Sub-spec | BA map | Ownership |
| --- | --- | --- |
| [`D11-B2-web-home.md`](./D11-B2-web-home.md) | S-P0-F | `apps/web` guest home |
| [`D11-B2-web-invite.md`](./D11-B2-web-invite.md) | S-P0-A | `apps/web` invite/onboarding |
| [`D11-B2-web-redeem.md`](./D11-B2-web-redeem.md) | S-P1-A | `apps/web` redeem |

## Phụ thuộc chung

- Soft: PD `D11-PRODUCTION-UX-UI.md` + prototype `attendee-redeem.html` (prototype headless QA ≠ runtime/app QA)
- Soft: BA AC ưu tiên
- Không hard-dep iOS B3 (song song được khi khác ownership)

## OUT (mọi sub-spec)

BE schema lớn; Android; store; deploy không ủy quyền; trộn nhiều slice trong một Dispatch.
