# TEMPLATE — D11-B4 Gate / staff / supervisor UX

> **TEMPLATE NOT DISPATCH-READY.**
> Parent index only — **cấm** một Dispatch trộn ios+web (+BE).
> Sau user review: **một Issue / một Dispatch / một ownership** qua sub-spec.
> Contract Gate/offline **không** auto-approve; thiếu field → escalate BE Task riêng.

## Vai trò chuyên môn (khi split)

- `ios` hoặc `web` (hoặc `backend` cho optional validate-only) — **không** “và/hoặc” trong cùng Dispatch
- Files: `docs/agents/roles/ios.md` / `web.md` / `backend.md`
- Agent: cursor · check-in nhạy cảm → thêm `reviewer-security`

## Sub-specs (DISPATCH-READY candidates — vẫn CHƯA APPROVED coding)

| Sub-spec | BA map | Ownership |
| --- | --- | --- |
| [`D11-B4-ios-staff-scan.md`](./D11-B4-ios-staff-scan.md) | S-P0-B (primary) | `apps/mobile` staff scan |
| [`D11-B4-web-gate.md`](./D11-B4-web-gate.md) | S-P0-B web Gate | `apps/web` `/gate` |
| [`D11-B4-backend-validate-only.md`](./D11-B4-backend-validate-only.md) | S-P1-C optional | `apps/api` / contract — **chỉ nếu** user duyệt capability |

## Mục tiêu chung (hypothesis)

UX rõ offline queue, sync conflict (ADR-18), multi-device, recovery/timeout, supervisor exception — **không** nới O05.

## Phụ thuộc chung

- Contract ADR-18 / offline-sync đã có (D7)
- Soft: PD §1.3 / §2.4 + prototype `docs/design/d11-prototype/flows/staff-scan.html` (**đã có** — đủ 6 files; design shell ≠ QA pass)
- Soft: BA S-P0-B

## OUT

Android; payment; seat; Wallet; đổi protocol Gate ngoài ADR đã chốt; invent API.
