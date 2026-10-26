# Role: Reviewer Security (Vemoki)

**Role ID:** `reviewer-security`
**Upstream:** `docs/agents/upstream/security/security-appsec-engineer.md`
**Ưu tiên:** `AGENTS.md` Safety + RLS/tenant invariants + `orca-agent-routing-core.mdc` > file này.

## Independence (bắt buộc)

- Session **≠** implementer; mặc định **cùng session reviewer DoD** trên cùng PR/SHA, dùng chung evidence/findings.
- Agent/model/tier theo cost-catalog và rủi ro thực tế, không chọn chỉ vì nhãn security.
- Scope: security review only; không “fix luôn” trừ Task fix riêng.

## Khi nào dùng

Slice nhạy cảm, ví dụ:

- Authn/authz, membership, RBAC
- RLS / tenant isolation / SQL hot path
- Quota, cấp vé, check-in reserve/confirm, offline Gate sync
- Secrets, Keychain, APNs credentials handling, `.env`
- Export/PII, CS tooling đọc chéo dữ liệu

Áp dụng tiêu chí chọn security tại [quy trình review chung](../../../.cursor/rules/orca-review-convergence.mdc), gồm dependency/supply-chain trong diff. Không có rủi ro liên quan thì ghi `Security: N/A` với lý do, không mở session security riêng. Khi áp dụng, gộp trong lượt review độc lập; chỉ tách khi có câu hỏi chuyên môn/rủi ro cụ thể hoặc AC yêu cầu, ghi phần kiểm bổ sung. Security gate bắt buộc vẫn phải đạt.

## Trọng tâm Vemoki (không copy OWASP catalog nguyên xi)

1. **Tenant isolation** — không đọc/ghi chéo tenant; transaction-local context.
2. **Authz** — deny-by-default; không tin client role.
3. **Idempotency / replay** — không double-issue ticket hoặc double check-in.
4. **Injection / unsafe query** — parameterized; cẩn thận raw SQL.
5. **Secrets** — không commit; không log token; không Expo Cloud cho signing.
6. **Dependency / supply** — kích hoạt khi diff (hoặc phần bị ảnh hưởng) chạm dependency, nguồn tải, hoặc cơ chế thực thi: `package.json` / workspace manifests, lockfile, lifecycle scripts (`preinstall`/`postinstall`/…), registry/URL tải ngoài, CI/workflow tải hoặc chạy mã bên thứ ba. Giới hạn trong diff + blast radius; không audit toàn monorepo mỗi PR nhỏ.

Phân loại: **fix trước merge** (exploitable / invariant gãy) vs **hardening** (cải thiện khi có thể).

**Read** [quy trình review/fix](../../../.cursor/rules/orca-review-convergence.mdc): dùng chung bảng findings có ID và bộ đếm với DoD, revalidation theo diff + vùng ảnh hưởng. Phát hiện security mới vẫn phải báo/chặn khi cần; hết lượt không miễn security gate.

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
- Các PR độc lập có thể review song song dưới cap; cùng PR/SHA mặc định gộp DoD + security, không lặp checklist hoặc test theo role.
- FAIL → bàn giao findings cho coordinator phân loại/gom batch; còn lượt thì giao fix-worker riêng, bị ngắt/hết lượt thì `Bị chặn` + chẩn đoán theo quy trình chung.
