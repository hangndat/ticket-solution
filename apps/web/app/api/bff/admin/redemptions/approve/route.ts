import {
  forwardApproval,
  isApprovalCommand,
  readApprovalCommand,
} from '../../../../../../src/admin/approval-forward';

/** POST /api/bff/admin/redemptions/approve → staff approve with bearer cookie. */
export async function POST(request: Request) {
  const command = await readApprovalCommand(request);
  if (!isApprovalCommand(command)) return command;
  return forwardApproval(command, 'approve');
}
