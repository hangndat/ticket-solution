import { Stack } from 'expo-router/stack';
import { BrandWordmark } from '@/components/page';
import { tabAttendeeCompactStackScreenOptions } from '@/navigation/tab-stack-options';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        ...tabAttendeeCompactStackScreenOptions,
        headerTitle: () => <BrandWordmark compact />,
      }}
    />
  );
}
