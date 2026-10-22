import { Button } from '@/components/ui/button';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** signal fill (primary) vs paper/ink outline secondary vs destructive logout */
  variant?: 'primary' | 'secondary' | 'destructive';
  accessibilityLabel?: string;
  testID?: string;
};

/** Shared attendee CTA — Live Pulse signal fill, ≥44pt hit, focus ring. */
export function AttendeeCta({
  label,
  onPress,
  disabled,
  variant = 'primary',
  accessibilityLabel,
  testID
}: Props) {
  return (
    <Button
      testID={testID}
      label={label}
      variant={variant}
      size="lg"
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    />
  );
}
