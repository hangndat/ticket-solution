import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { walletCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import { runPushOptIn } from './push-opt-in.ts';
import { dismissWalletPushPrompt } from './wallet-push-prompt-store.ts';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type Props = {
  onDismiss: () => void;
  onEnabled?: () => void;
};

export function WalletPushPromptCard({ onDismiss, onEnabled }: Props) {
  const [busy, setBusy] = useState(false);

  const onEnable = useCallback(async () => {
    setBusy(true);
    try {
      await runPushOptIn({ session });
      onEnabled?.();
      onDismiss();
    } finally {
      setBusy(false);
    }
  }, [onDismiss, onEnabled]);

  const onLater = useCallback(async () => {
    await dismissWalletPushPrompt();
    onDismiss();
  }, [onDismiss]);

  return (
    <View
      testID="wallet-push-prompt-card"
      style={{
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radius.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        gap: space.xs
      }}
    >
      <Text style={{ ...typography.footnote, color: colors.secondary }}>
        {walletCopy.firstTicketPush.title}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button
          variant="ghost"
          label={walletCopy.firstTicketPush.enableCta}
          onPress={() => void onEnable()}
          disabled={busy}
          testID="wallet-push-enable"
        />
        <Button
          variant="ghost"
          label={walletCopy.firstTicketPush.dismissCta}
          onPress={() => void onLater()}
          disabled={busy}
          testID="wallet-push-dismiss"
        />
      </View>
    </View>
  );
}
