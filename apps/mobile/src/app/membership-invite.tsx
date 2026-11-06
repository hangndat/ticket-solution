import { useEffect, useState } from 'react';
import { Keyboard, Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Spinner } from '@/components/ui/spinner';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice } from '@/components/page';
import { buildMembershipInviteWebUrl, classifyMembershipInviteNavigation, clearMembershipInviteToken, membershipInviteGuidance, peekMembershipInviteToken } from '@/links/membership-invite-url';
import { getProductWebOrigin } from '@/identity/product-web-origin';
import { getOidcIssuer } from '@/identity/config';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';
import { space, radius } from '@/theme/tokens';

/** The web page owns verification, acceptance, result, and permissions. */
export default function MembershipInviteScreen() {
  const { intent, invalid } = useLocalSearchParams<{ intent?: string; invalid?: string }>();
  const insets = useSafeAreaInsets();
  const token = intent ? peekMembershipInviteToken() : '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const config = {
    productOrigin: getProductWebOrigin(),
    oidcIssuer: getOidcIssuer(),
    portalOrigin: process.env.EXPO_PUBLIC_PORTAL_ORIGIN || 'https://portal.vemoki.com',
  };
  const inviteUrl = buildMembershipInviteWebUrl(token);
  const ready = classifyMembershipInviteNavigation(inviteUrl, config) === 'web';

  function retry() {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  function leave() {
    clearMembershipInviteToken();
    router.replace('/(tabs)/(events)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.paper }}>
      <Text style={{ color: colors.secondary, ...typography.body, fontFamily: fontFamilies.body, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md }}>
        {membershipInviteGuidance(invalid === '1' ? 'invalid' : token ? 'linked' : 'manual')}
      </Text>
      {invalid === '1' ? (
        <ScrollView contentContainerStyle={{ padding: space.xl }}>
          <Notice title="Liên kết không hợp lệ" tone="deny">Mã lời mời không đúng định dạng. Kiểm tra thư mời gốc.</Notice>
        </ScrollView>
      ) : !ready ? (
        <ScrollView contentContainerStyle={{ padding: space.xl }}>
          <Notice title="Không mở được trang nhận lời mời" tone="deny">Địa chỉ trang web chưa hợp lệ. Vui lòng thử lại từ thư mời.</Notice>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, marginHorizontal: space.xl, borderRadius: radius.md, overflow: 'hidden', backgroundColor: brand.paper }}>
          <WebView
            key={reloadKey}
            source={{ uri: inviteUrl }}
            injectedJavaScriptBeforeContentLoaded={`(function(){if(location.pathname!=='/invite')return;function mask(){var field=document.querySelector('input[autocomplete="off"][spellcheck="false"]');if(field&&field.type!=='password')field.type='password';}new MutationObserver(mask).observe(document,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',mask);mask();})();true;`}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onShouldStartLoadWithRequest={(request) => {
              const destination = classifyMembershipInviteNavigation(request.url, config);
              if (destination === 'portal') {
                void Linking.openURL(request.url).catch(() => setError('Không mở được Portal. Vui lòng thử lại.'));
                return false;
              }
              if (destination === 'blocked') {
                setError('Trang chuyển đến địa chỉ không được tin cậy. Hãy quay lại thư mời và thử lại.');
                return false;
              }
              return true;
            }}
            onLoadStart={() => { setLoading(true); setError(null); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError('Không kết nối được trang nhận lời mời. Kiểm tra mạng rồi thử lại.'); }}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 500) {
                setLoading(false);
                setError('Trang nhận lời mời chưa phản hồi. Vui lòng thử lại.');
              }
            }}
            style={{ flex: 1, opacity: error ? 0 : 1 }}
            testID="membership-invite-webview"
          />
          {loading && !error ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.paper }}>
              <Spinner accessibilityLabel="Đang tải trang nhận lời mời" />
            </View>
          ) : null}
          {error ? (
            <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
              <Notice title="Không mở được trang" tone="deny">{error}</Notice>
              <AttendeeCta label="Thử lại" onPress={retry} />
            </ScrollView>
          ) : null}
        </View>
      )}
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: keyboardHeight ? space.sm : Math.max(insets.bottom, space.md), marginBottom: keyboardHeight }}>
        <AttendeeCta label="Về Sự kiện" variant="secondary" onPress={leave} testID="membership-invite-cta-events" />
      </View>
    </View>
  );
}
