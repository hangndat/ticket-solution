# Spec đề xuất — D11-B2-web-home (S-P0-F)

> **CHƯA APPROVED** coding. Parent [`D11-B2-attendee-web.md`](./D11-B2-attendee-web.md) = TEMPLATE.  
> **Một Issue / một Dispatch / `web` only.**

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor

## Mục tiêu

Guest home production-lite: gỡ jargon Nest BFF/fixture trên đường khách (evidence tươi `vemoki.com`); brand-first first viewport theo PD; CTA chính rõ.

## Phụ thuộc

- Soft: PD first viewport / guest IA; BA S-P0-F
- Brand-test: [`D11-S-P0-C-brand-test-ac.md`](./D11-S-P0-C-brand-test-ac.md) khi surface guest trong scope

## Ownership

`apps/web` — `/` và chrome guest liên quan only.

## AC

- [ ] Không lộ jargon triển khai trên đường khách; demo → nhãn DEMO rõ
- [ ] Copy VI; không chrome POC/đợt
- [ ] Brand-test AC (S-P0-C) nếu trong scope duyệt
- [ ] `scripts/web-uat.sh` screenshots home + artifact path
- [ ] `reviewer-dod` exact-SHA

## Proof limits

Public baseline screenshot ≠ SHA deploy; prototype ≠ QA pass.

## OUT

Invite/redeem (sub-spec khác); BE; iOS; deploy không ủy quyền.
