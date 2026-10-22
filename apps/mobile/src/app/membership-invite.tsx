import { useState } from 'react';
import { Text, View } from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { AttendeeCta } from '@/components/attendee-cta';
import { BrandWordmark, Notice } from '@/components/page';
import {
  buildMembershipInviteWebUrl,
  isMembershipInviteToken,
} from '@/links/membership-invite-url';
import { getProductWebOrigin } from '@/identity/product-web-origin';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isTrustedMembershipInviteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = getProductWebOrigin().replace(/\/+$/, '');
    const expected = new URL(origin);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === expected.hostname &&
      parsed.pathname.replace(/\/+$/, '') === '/invite'
    );
  } catch {
    return false;
  }
}

/**
 * Phase 3 bridge: membership `/invite` is web-only (no native accept form).
 * Deep-links land here → in-app WebView opens product `/invite` with #token=.
 * Distinct from native `/claim` (guest event ticket).
 */
export default function MembershipInviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token).trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const inviteUrl = buildMembershipInviteWebUrl(token);
  const trusted = isTrustedMembershipInviteUrl(inviteUrl);

  function onRetry() {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.paper }}>
      <View style={{ padding: 20, gap: 16, paddingBottom: 8 }}>
      <BrandWordmark compact />
      <Text accessibilityRole="header" style={{ color: colors.ink, ...typography.display }}>
        Lời mời thành viên
      </Text>
      <Text style={{ color: colors.secondary, ...typography.body, fontFamily: fontFamilies.body }}>
        Nhận lời mời vào tổ chức trên web — đăng nhập đúng email đã được mời. Khác
        với «Nhận vé mời» (vé sự kiện) trong app.
      </Text>

      {!token ? (
        <Notice title="Chưa có mã lời mời">
          Mở đúng liên kết từ thư mời hoặc dán mã sau khi đăng nhập trên trang web.
        </Notice>
      ) : !isMembershipInviteToken(token) ? (
        <Notice title="Liên kết không hợp lệ" tone="deny">
          Mã lời mời không đúng định dạng. Kiểm tra thư mời gốc.
        </Notice>
      ) : null}

      </View>
      {!trusted ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Notice title="Không mở được trang nhận lời mời">
            Bản dựng chưa cấu hình địa chỉ web sản phẩm.
          </Notice>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            marginHorizontal: 20,
            marginBottom: 16,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: brand.paper,
          }}
        >
          {error ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Notice title="Không tải được trang">{error}</Notice>
              <AttendeeCta label="Thử lại" onPress={onRetry} />
            </View>
          ) : null}
          <WebView
            key={reloadKey}
            source={{ uri: inviteUrl }}
            onShouldStartLoadWithRequest={(request) =>
              isTrustedMembershipInviteUrl(request.url)
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
              setError('Trang nhận lời mời không phản hồi. Thử lại sau.');
            }}
            style={{ flex: 1, opacity: error ? 0 : 1 }}
            testID="membership-invite-webview"
          />
          {loading && !error ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spinner accessibilityLabel="Đang tải trang nhận lời mời" />
            </View>
          ) : null}
        </View>
      )}

      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <AttendeeCta
          label="Về Sự kiện"
          variant="secondary"
          onPress={() => router.replace('/(tabs)/(events)')}
          testID="membership-invite-cta-events"
        />
      </View>
    </View>
  );
}
