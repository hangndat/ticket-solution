/** Allowed orchestration.message values in structural telemetry (no raw payloads). */
export const ORCHESTRATION_MESSAGE_ALLOWLIST = new Set([
  'task',
  'worker_done',
  'heartbeat',
  'escalation',
  'ask',
  'check',
  'delivery',
  'redirect',
]);

/**
 * @param {unknown} message
 * @returns {string|null}
 */
export function sanitizeOrchestrationMessage(message) {
  if (message == null || message === '') return null;
  const s = String(message).trim();
  if (!ORCHESTRATION_MESSAGE_ALLOWLIST.has(s)) return null;
  return s;
}

/**
 * @param {object|null|undefined} orch
 */
export function sanitizeOrchestrationBlock(orch) {
  if (!orch || typeof orch !== 'object') return null;
  const msg = sanitizeOrchestrationMessage(orch.message);
  return {
    runId: orch.runId ?? null,
    taskId: orch.taskId ?? null,
    dispatchId: orch.dispatchId ?? null,
    ...(msg ? { message: msg } : { messageOmitted: true }),
  };
}
