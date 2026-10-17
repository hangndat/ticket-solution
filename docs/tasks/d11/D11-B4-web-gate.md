# Spec đề xuất — D11-B4-web-gate (S-P0-B web)

> **CHƯA APPROVED** coding. Parent [`D11-B4-gate-staff-ux.md`](./D11-B4-gate-staff-ux.md) = TEMPLATE.
> **Một Issue / một Dispatch / `web` only.** Chỉ khi slot web rảnh và user chọn Gate web trong đợt (không ∥ feature web khác).

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor
- ± `reviewer-security` nếu đụng Gate authz

## Mục tiêu

Web `/gate` fallback clarity khớp PD (D3: web Gate không queue offline như iOS — không giả queue). Copy/state rõ online/denied/already checked-in.

## Phụ thuộc

- Soft: PD §1.3 / web Gate notes; ADR-18 UX hiện có
- Soft: BA S-P0-B (phần web)
- **Không** hard-dep chờ ios B4 xong; **không** trộn ios trong Dispatch này
- Contract change → escalate

## Ownership

`apps/web` — `/gate` only.

## AC

- [ ] States web Gate theo PD; copy VI
- [ ] Không giả offline queue iOS trên web
- [ ] `scripts/web-uat.sh` gate scope + artifacts
- [ ] Không phá check-in invariant
- [ ] `reviewer-dod` exact-SHA

## OUT

iOS staff; invent offline queue web; BE schema; Android.
