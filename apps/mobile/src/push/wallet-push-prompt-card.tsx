import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice } from '@/components/page';
import { walletCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import { runPushOptIn } from './push-opt-in.ts';
import { dismissWalletPushPrompt } from './wallet-push-prompt-store.ts';
import { space } from '@/theme/tokens';

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
    <View style={{ gap: space.md }} testID="wallet-push-prompt-card">
      <Notice title={walletCopy.firstTicketPush.title}>
        {walletCopy.firstTicketPush.body}
      </Notice>
      <AttendeeCta
        label={walletCopy.firstTicketPush.enableCta}
        onPress={() => void onEnable()}
        disabled={busy}
        testID="wallet-push-enable"
      />
      <AttendeeCta
        label={walletCopy.firstTicketPush.dismissCta}
        variant="secondary"
        onPress={() => void onLater()}
        disabled={busy}
        testID="wallet-push-dismiss"
      />
    </View>
  );
}
