import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Notice, Page } from '@/components/page';
import { verifyViaMe } from '@/identity/fetch-me';
import { session } from '@/identity/session';
import { parseInstalledAppLink } from '@/links/installed-app-link';
import { colors } from '@/theme/colors';

function tokenFromParams(
  raw: string | string[] | undefined,
): string | null {
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

async function resolveAccessToken(
  paramToken: string | null,
): Promise<string | null> {
  if (paramToken && paramToken.length >= 32) return paramToken;
  // Query params can truncate long JWTs — recover from the raw deep link.
  const initial = await Linking.getInitialURL();
  if (initial) {
    const parsed = parseInstalledAppLink(initial);
    if (parsed.kind === 'uat-staff-session') return parsed.accessToken;
  }
  return paramToken;
}

/**
 * Headless sim-uat bootstrap: real Keycloak access_token → SessionBoundary.establish
 * → GET /v1/me. Never invents verified identity without API success (not fixture auth).
 */
export default function UatStaffSessionRoute() {
  const params = useLocalSearchParams<{ access_token?: string | string[] }>();
  const [status, setStatus] = useState('Đang xác minh…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromParams = tokenFromParams(params.access_token);
      const token = await resolveAccessToken(fromParams);
      if (!token) {
        setStatus('Thiếu access_token hợp lệ.');
        return;
      }
      try {
        await session.establish(token, verifyViaMe);
        if (cancelled) return;
        const snap = session.getSnapshot();
        if (snap.status !== 'verified') {
          setStatus(
            `Không verified (status=${snap.status}, tokenLen=${token.length}, paramLen=${fromParams?.length ?? 0}). Kiểm tra API / OIDC.`,
          );
          return;
        }
        setStatus('Staff session verified — chuyển Nhân viên…');
        router.replace('/(tabs)/staff' as never);
      } catch {
        if (!cancelled) setStatus('Lỗi establish /v1/me.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.access_token]);

  return (
    <Page>
      <Notice title="UAT staff session">
        Bootstrap headless (sim-uat). Không ghi log token. Vẫn bắt buộc verify
        /v1/me — không stub identity.
      </Notice>
      <Text style={{ color: colors.label, fontSize: 16 }}>{status}</Text>
      <Text style={{ color: colors.secondary, fontSize: 14 }}>
        Phiên: {session.getSnapshot().status}
      </Text>
    </Page>
  );
}
