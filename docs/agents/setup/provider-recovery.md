# Provider recovery preflight

Leader chỉ xét recovery của provider liên quan trước `worker-start` mới. Khi đã chọn agent/model/effort, wrapper kiểm đúng route đó; không dò provider khác để so sánh. Không đổi leader/worker đang chạy, không daemon.

## State

- Thư mục: `.orca-metrics/provider-recovery/` (dir `0700`, file `0600`, gitignored).
- Key: hash(provider + identity + model + effort). Identity Claude = hash từ `claude auth status --json` (firstParty `claude.ai` only); **không** lưu email/orgId/token trong state.
- TTL evidence: 5 phút. Backoff sau `limited`/`unknown`: 5 phút. Probe timeout: 30 giây.
- `resetAt` ISO (từ `record-limit`): trước reset **không** probe; sau reset vẫn `unknown`/`limited` cho đến khi probe thành công.

## CLI

```bash
node scripts/agent-provider-recovery.mjs route --cost-tier advanced
node scripts/agent-provider-recovery.mjs check --provider claude --model claude-sonnet-5 --effort medium
node scripts/agent-provider-recovery.mjs status --provider claude --model claude-sonnet-5 --effort medium
node scripts/agent-provider-recovery.mjs record-limit --provider claude --model claude-sonnet-5 --effort medium --limited-at 2026-10-26T00:00:00.000Z [--reset-at ISO]
```

- `route`: bước chọn route tùy chọn cho **reviewer/chuyên gia không coding**, tier `focused|advanced|high`; ưu tiên Claude khi `serviceAvailable` mới. Không dùng lệnh này cho coding hoặc sau khi route đã được chỉ định. Coding theo primary/fallback trong cost catalog; OpenCode thiếu quota adapter không phải lỗi để chuyển provider.
- Codex: dùng snapshot telemetry + `assessCodexQuota` (20% reserve không đổi).
- Claude: probe bounded (`Reply exactly OK.`), thành công ⇒ `serviceAvailable: true`, `remainingPercent: null` (không giả >20%).

## Wrapper

`agent-workflow-run.mjs start --agent claude` gọi check cho đúng model/effort đã chọn; chặn start nếu chưa `serviceAvailable`. Receipt: `provider-recovery.json`, không khuyến nghị đổi route. Codex chỉ dùng quota gate của Codex; start Codex/OpenCode/Cursor không gọi auth/probe Claude. Snapshot Codex phục vụ telemetry không chứng minh quota provider khác và không chặn họ.

## Coordinator

1. Chỉ dùng `route` khi cần chọn provider cho non-coding. Khi route đã chốt, start qua wrapper; không chạy thêm vòng probe các provider khác.
2. Ưu tiên Claude khi evidence probe mới hợp lệ; `unknown` **số lượng** quota ≠ `unknown` **khả dụng dịch vụ**.
3. CLI account ≠ Orca worker account trừ khi đã xác minh binding — wrapper chỉ ghi `identityBinding: cli_only`.
