import { assertMutatingBrowser } from '../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.branding(tenantId), {
    method: 'GET',
  });
}

export async function PUT(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  let body: {
    displayName?: string;
    primaryColor?: string;
    secondaryColor?: string | null;
    logoAssetId?: string | null;
    expectedVersion?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (
    typeof body.expectedVersion !== 'number' ||
    !Number.isInteger(body.expectedVersion) ||
    body.expectedVersion < 1
  ) {
    return bffApiError(
      'VERSION_REQUIRED',
      'expectedVersion must be a positive integer.',
      422,
    );
  }
  const payload: Record<string, unknown> = {
    expectedVersion: body.expectedVersion,
  };
  if (typeof body.displayName === 'string') {
    payload.displayName = body.displayName.trim();
  }
  if (typeof body.primaryColor === 'string') {
    payload.primaryColor = body.primaryColor.trim();
  }
  if (body.secondaryColor !== undefined) {
    payload.secondaryColor = body.secondaryColor;
  }
  if (body.logoAssetId !== undefined) {
    payload.logoAssetId = body.logoAssetId;
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.branding(tenantId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
