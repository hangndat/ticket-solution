import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice } from '@/components/page';
import { PRIVACY_POLICY_URL } from '@/account-deletion/privacy-policy';
import { brand, colors } from '@/theme/colors';
import { Stack } from 'expo-router';
import { TabStackTitle } from '@/navigation/tab-stack-title';

type PrivacyPresentation = 'tab' | 'root';

function isTrustedPrivacyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'vemoki.com' &&
      parsed.pathname.startsWith('/privacy')
    );
  } catch {
    return false;
  }
}

function shouldAllowPrivacyNavigation(url: string): boolean {
  return isTrustedPrivacyUrl(url);
}

export function PrivacyPolicyWebViewScreen({
  presentation = 'tab',
}: {
  presentation?: PrivacyPresentation;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const onRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  if (!isTrustedPrivacyUrl(PRIVACY_POLICY_URL)) {
    return (
      <>
        <View style={{ flex: 1, padding: 20, backgroundColor: brand.paper }}>
          <Notice title="Không mở được chính sách">
            Liên kết chính sách không hợp lệ trên bản dựng này.
          </Notice>
        </View>
        {presentation === 'tab' ? (
          <TabStackTitle title="Chính sách quyền riêng tư" large={false} />
        ) : (
          <Stack.Screen options={{ title: 'Chính sách quyền riêng tư' }} />
        )}
      </>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: brand.paper }}>
        {error ? (
          <View style={{ padding: 20, gap: 12 }}>
            <Notice title="Không tải được trang">{error}</Notice>
            <AttendeeCta label="Thử lại" onPress={onRetry} />
          </View>
        ) : null}
        <WebView
          key={reloadKey}
          source={{ uri: PRIVACY_POLICY_URL }}
          onShouldStartLoadWithRequest={(request) =>
            shouldAllowPrivacyNavigation(request.url)
          }
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Kiểm tra kết nối rồi thử lại.');
          }}
          onHttpError={() => {
            setLoading(false);
            setError('Trang chính sách không phản hồi.');
          }}
          style={{ flex: 1, opacity: error ? 0 : 1 }}
          incognito
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
        />
        {loading && !error ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: 24,
              alignItems: 'center',
              backgroundColor: brand.paper,
            }}
          >
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
      </View>
      {presentation === 'tab' ? (
        <TabStackTitle title="Chính sách quyền riêng tư" large={false} />
      ) : (
        <Stack.Screen options={{ title: 'Chính sách quyền riêng tư' }} />
      )}
    </>
  );
}
