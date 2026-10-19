import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AttendeeCta } from '@/components/attendee-cta';
import { BrandWordmark, Notice, Page } from '@/components/page';
import { buildMembershipInviteWebUrl } from '@/links/membership-invite-url';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Phase 3 bridge: membership `/invite` is web-only (no native accept form).
 * Deep-links land here → in-app browser opens product `/invite` with #token=.
 * Distinct from native `/claim` (guest event ticket).
 */
export default function MembershipInviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token).trim();
  const [openError, setOpenError] = useState<string | null>(null);
  const openedOnce = useRef(false);

  const inviteUrl = buildMembershipInviteWebUrl(token);

  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    void (async () => {
      setOpenError(null);
      try {
        await WebBrowser.openBrowserAsync(inviteUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        });
      } catch (err) {
        setOpenError(
          err instanceof Error
            ? err.message
            : 'Không mở được trang nhận lời mời thành viên.',
        );
      }
    })();
  }, [inviteUrl]);

  async function openWebInvite() {
    setOpenError(null);
    try {
      await WebBrowser.openBrowserAsync(inviteUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch (err) {
      setOpenError(
        err instanceof Error
          ? err.message
          : 'Không mở được trang nhận lời mời thành viên.',
      );
    }
  }

  return (
    <Page>
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
      ) : null}

      {openError ? (
        <Notice title="Không mở được trang web" tone="deny">
          {openError}
        </Notice>
      ) : null}

      <AttendeeCta
        label="Mở trang nhận lời mời thành viên"
        onPress={() => void openWebInvite()}
        testID="membership-invite-cta-open"
      />
      <AttendeeCta
        label="Về Sự kiện"
        variant="secondary"
        onPress={() => router.replace('/(tabs)/(events)')}
        testID="membership-invite-cta-events"
      />
    </Page>
  );
}
