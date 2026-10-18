export type PortalApiError = {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
};

export function bffApiError(
  code: string,
  message: string,
  status: number,
  retryable = false,
): Response {
  const body: PortalApiError = {
    code,
    message,
    requestId: crypto.randomUUID(),
    retryable,
  };
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
