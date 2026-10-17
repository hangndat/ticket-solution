# Spec đề xuất — D11-B2-web-invite (S-P0-A)

> **CHƯA APPROVED** coding. Parent [`D11-B2-attendee-web.md`](./D11-B2-attendee-web.md) = TEMPLATE.
> **Một Issue / một Dispatch / `web` only.**

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor

## Mục tiêu

Onboarding Owner / invite member theo BA S-P0-A; đóng known gap D4/D5 invite UX — **không** invent invite API.

## Phụ thuộc

- Soft: PD invite/onboarding notes; BA S-P0-A
- Known gap D4/D5 invite — xác minh source trước claim
- Thiếu contract field → escalate coordinator (**không** auto-approve OpenAPI)

## Ownership

`apps/web` — invite/onboarding routes only.

## AC

- [ ] States/copy VI theo PD/BA cho flow invite trong scope
- [ ] Không regress authz membership
- [ ] `scripts/web-uat.sh` invite scope + artifacts
- [ ] `reviewer-dod` exact-SHA (± `reviewer-security` nếu đụng grant/invite token)

## OUT

Home/redeem (sub-spec khác); BE schema lớn; iOS; store.
