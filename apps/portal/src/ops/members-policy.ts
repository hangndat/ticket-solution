export function isLastOwnerError(code: string | null | undefined): boolean {
  return code === 'LAST_OWNER_REQUIRED';
}

export function eventAssignmentRoleAllowed(role: string): boolean {
  return (
    role === 'Manager' ||
    role === 'CS' ||
    role === 'Supervisor' ||
    role === 'Scanner'
  );
}
