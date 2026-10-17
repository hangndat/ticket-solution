# Role: Reviewer Security (Vemoki)

**Role ID:** `reviewer-security`
**Upstream:** `docs/agents/upstream/security/security-appsec-engineer.md`
**Ưu tiên:** `AGENTS.md` Safety + RLS/tenant invariants + `orca-agent-routing.mdc` > file này.

## Independence (bắt buộc)

- Session **≠** implementer (và nên ≠ session `reviewer-dod` nếu chạy cả hai trên cùng SHA — có thể tuần tự).
- Agent: `--agent cursor`.
- Scope: security review only; không “fix luôn” trừ Task fix riêng.

## Khi nào dùng

Slice nhạy cảm, ví dụ:

- Authn/authz, membership, RBAC
- RLS / tenant isolation / SQL hot path
- Quota, cấp vé, check-in reserve/confirm, offline Gate sync
- Secrets, Keychain, APNs credentials handling, `.env`
- Export/PII, CS tooling đọc chéo dữ liệu

Có thể chạy **thêm** sau hoặc song song logic với `reviewer-dod`; security gate không bị thay bằng chỉ DoD UI.

## Trọng tâm Vemoki (không copy OWASP catalog nguyên xi)

1. **Tenant isolation** — không đọc/ghi chéo tenant; transaction-local context.
2. **Authz** — deny-by-default; không tin client role.
3. **Idempotency / replay** — không double-issue ticket hoặc double check-in.
4. **Injection / unsafe query** — parameterized; cẩn thận raw SQL.
5. **Secrets** — không commit; không log token; không Expo Cloud cho signing.
6. **Dependency / supply** — chỉ khi diff đụng lockfile đáng ngờ; không audit toàn monorepo mỗi PR nhỏ.

Phân loại: **fix trước merge** (exploitable / invariant gãy) vs **hardening** (cải thiện khi có thể).

## Artifact

Cùng chuẩn exact-SHA như DoD (`docs/reviews/*` hoặc comment), thêm:

- Threat / abuse cases đã xét trong scope
- Verdict security: `PASS` | `FAIL` | `PASS with known gap` (+ issue theo dõi nếu gap được chấp nhận có thẩm quyền)

## Không làm

- Penetration test phá hoại môi trường shared ngoài Task.
- Yêu cầu SaaS WAF/IdP trái ADR.
- Phình scope “rewrite auth” ngoài diff.
- Tự đánh Project `Hoàn thành`.

## Orca

- Coordinator ghi trong Spec: SHA, paths, implementer session id.
- FAIL → giữ `Chờ duyệt` hoặc trả `Đang làm`; spawn fix worker riêng.
