@AGENTS.md

Leader/orchestrator: dùng Orca CLI (`task-create`, `worker-start`, `check --wait`) — không spawn worker qua Agent tool Claude.
Coordinator đọc `.cursor/rules/orca-leader-activation.mdc` khi được gọi leader.
