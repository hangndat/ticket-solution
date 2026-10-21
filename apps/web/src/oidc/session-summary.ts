export type SessionSummary =
  | { kind: 'signed-in'; subjectHint: string | null }
  | { kind: 'signed-out' }
  | { kind: 'error'; detail: string };

const LOCALHOST_ORIGIN_HINT =
  'Dùng một địa chỉ cho localhost (khuyến nghị http://localhost:3000) — OIDC_REDIRECT_URI và WEB_PUBLIC_ORIGIN phải khớp, không trộn 127.0.0.1.';

function readApiErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { code?: unknown };
    return typeof parsed.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}

function subjectHintFromBody(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const subject =
      typeof parsed.sub === 'string'
        ? parsed.sub
        : typeof parsed.email === 'string'
          ? parsed.email
          : typeof parsed.subject === 'string'
            ? parsed.subject
            : null;
    if (!subject?.trim()) return null;
    const s = subject.trim();
    return s.includes('@') ? s : s.length > 12 ? `${s.slice(0, 8)}…` : s;
  } catch {
    return null;
  }
}

/** Client-side summary for GET /api/bff/me (account session panel). */
export function summarizeBffMeSession(status: number, body: string): SessionSummary {
  if (status === 401 || status === 403) {
    return { kind: 'signed-out' };
  }
  if (status >= 200 && status < 300) {
    return { kind: 'signed-in', subjectHint: subjectHintFromBody(body) };
  }
  if (status === 0) {
    return {
      kind: 'error',
      detail:
        'Không kết nối được máy chủ. Kiểm tra mạng, API (port 3001) và dùng một origin localhost. ' +
        LOCALHOST_ORIGIN_HINT,
    };
  }

  const code = readApiErrorCode(body);
  if (status === 503 && code === 'OIDC_MISCONFIGURED') {
    return {
      kind: 'error',
      detail:
        'OIDC chưa cấu hình đúng (.env.local). Kiểm tra OIDC_* và WEB_PUBLIC_ORIGIN. ' +
        LOCALHOST_ORIGIN_HINT,
    };
  }
  if (status === 502 || status === 503 || code === 'UPSTREAM_UNAVAILABLE' || code === 'IDENTITY_UNAVAILABLE') {
    return {
      kind: 'error',
      detail:
        'Máy chủ vé hoặc đăng nhập tạm thời không phản hồi. Chạy API Nest (API_BASE_URL, thường :3001) và Keycloak, rồi thử lại. ' +
        LOCALHOST_ORIGIN_HINT,
    };
  }

  return {
    kind: 'error',
    detail:
      'Không tải được trạng thái phiên lúc này. Thử tải lại trang hoặc đăng xuất rồi đăng nhập lại. ' +
      LOCALHOST_ORIGIN_HINT,
  };
}
