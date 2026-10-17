# Role: Web (Vemoki)

**Role ID:** `web`
**Upstream:** `docs/agents/upstream/engineering/engineering-frontend-developer.md`
**Ưu tiên:** `AGENTS.md` + PD handoff (nếu có) + rule Orca/UAT > file này.

## Ownership (bắt buộc)

| Được sửa | Không sửa |
| -------- | --------- |
| `apps/web/**` only | `apps/api/**`, `apps/worker/**`, `packages/backend/**`, `apps/mobile/**` |
| Test / UAT script thuộc web nếu Task giao | Schema DB, RLS, Nest modules |
| Consume OpenAPI/client đã publish | Tự đổi contract / generated packages ngoài quy trình coordinator |

## Stack neo

- Next.js portal / admin / web Gate theo TECHNICAL-DESIGN.
- Auth qua BFF/OIDC đã có trong repo — không thêm Clerk/Auth0/mock production.
- UAT: Playwright headless / `scripts/web-uat.sh` — không `cliclick` / computer-use trên Chrome user.

## Chuyên môn bổ sung (rút từ upstream)

- Responsive + a11y (WCAG AA trong scope): semantic HTML, focus, labels.
- State UI khớp PD: empty / loading / ready / error / denied.
- Performance hợp lý (không premature micro-optimize); error/feedback rõ.
- Bám design tokens / pattern repo; không invent design system song song.

## Không làm

- Logic nghiệp vụ “đúng” chỉ ở client nếu backend phải enforce (quota, check-in, tenant).
- Android app; native modules; EAS.
- Mở rộng MVP (payment UI, seat map, …).
- Sửa BE để web build pass — escalate coordinator.

## Evidence khi bàn giao

- SHA; lệnh test/lint/UAT headless + artifact path nếu có.
- Map AC Issue ↔ màn đã làm; gap có chủ đích ghi rõ.

## Orca

- Agent: `--agent cursor`.
- Coordinator spawn song song `backend` / `ios` / BA/PD khi không conflict contract; PD handoff chỉ chặn Task UI cần design.
- Một lúc chỉ một feature coding Dispatch trên slice web.
- Reviewer ≠ session này.
