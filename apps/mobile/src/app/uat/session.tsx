import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Notice, Page } from '@/components/page';
import { LoadingState } from '@/components/screen-state';
import { verifyViaMe } from '@/identity/fetch-me';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { uatSessionRouteAllowed } from '@/navigation/dev-only-routes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

/**
 * Local UAT session injector for headless sim-uat (O02 dual persona).
 * Allowed only when `__DEV__` or `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` (never on prod bake).
 */

export default function UatSessionScreen() {
  const params = useLocalSearchParams<{ access_token?: string }>();
  const [phase, setPhase] = useState<'boot' | 'ok' | 'deny'>('boot');
  const [detail, setDetail] = useState('Đang nạp phiên UAT…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!uatSessionRouteAllowed()) {
        if (!cancelled) {
          setDetail('Đường dẫn UAT chỉ dùng khi phát triển / UAT local. Không cho vào.');
          setPhase('deny');
        }
        return;
      }
      const token =
        typeof params.access_token === 'string' ? params.access_token.trim() : '';
      if (!token) {
        if (!cancelled) {
          setDetail('Thiếu access_token trên deep link UAT. Không cho vào.');
          setPhase('deny');
        }
        return;
      }
      try {
        await session.establish(token, verifyViaMe);
        const snap = session.getSnapshot();
        if (snap.status !== 'verified') {
          if (!cancelled) {
            setDetail(
              'Máy chủ không xác minh được phiên UAT (API /v1/me). Không cho vào.',
            );
            setPhase('deny');
          }
          return;
        }
        await staffEligibility.refresh(session);
        if (!cancelled) {
          setPhase('ok');
          router.replace('/(tabs)/(events)');
        }
      } catch (error) {
        if (!cancelled) {
          const reason =
            error instanceof Error ? error.message : 'lỗi không xác định';
          setDetail(`Không thiết lập được phiên UAT (${reason}). Không cho vào.`);
          setPhase('deny');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.access_token]);

  if (phase === 'ok') {
    return <Redirect href="/(tabs)/(events)" />;
  }

  if (phase === 'deny') {
    return (
      <Page>
        <Notice title="UAT session bị từ chối" tone="deny">
          {detail}
        </Notice>
        <Text style={{ ...typography.subhead, color: colors.secondary }}>{detail}</Text>
      </Page>
    );
  }

  return (
    <Page>
      <LoadingState title="UAT session">{detail}</LoadingState>
    </Page>
  );
}
