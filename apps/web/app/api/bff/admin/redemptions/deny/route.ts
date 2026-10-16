import {
  denialReason,
  forwardApproval,
  isApprovalCommand,
  readApprovalCommand,
} from '../../../../../../src/admin/approval-forward';

/** POST /api/bff/admin/redemptions/deny → staff deny; reason is required. */
export async function POST(request: Request) {
  const command = await readApprovalCommand(request);
  if (!isApprovalCommand(command)) return command;
  const reason = denialReason(command.body);
  if (typeof reason !== 'string') return reason;
  return forwardApproval(command, 'deny', { reason });
}
