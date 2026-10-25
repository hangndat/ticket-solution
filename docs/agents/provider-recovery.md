# Provider recovery preflight

Leader kiểm tra provider đã hết quota có hồi phục **trước** `worker-start` mới. Không đổi leader/worker đang chạy, không daemon.

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
node scripts/agent-provider-recovery.mjs record-limit --provider claude --model claude-sonnet-5 --limited-at 2026-10-26T00:00:00.000Z [--reset-at ISO]
```

- `route`: gợi ý route đã đăng ký cho `focused|advanced|high`; ưu tiên Claude khi `serviceAvailable` mới.
- Codex: dùng snapshot telemetry + `assessCodexQuota` (20% reserve không đổi).
- Claude: probe bounded (`Reply exactly OK.`), thành công ⇒ `serviceAvailable: true`, `remainingPercent: null` (không giả >20%).

## Wrapper

`agent-workflow-run.mjs start` với tier `focused|advanced|high` và `--agent claude` gọi check; chặn start nếu chưa `serviceAvailable`. Receipt: `provider-recovery.json`. Composer/Cursor **không** bị gate Codex.

## Coordinator

1. `route` hoặc `check` trước chọn provider (tier nặng).
2. Ưu tiên Claude khi evidence probe mới hợp lệ; `unknown` **số lượng** quota ≠ `unknown` **khả dụng dịch vụ**.
3. CLI account ≠ Orca worker account trừ khi đã xác minh binding — wrapper chỉ ghi `identityBinding: cli_only`.
