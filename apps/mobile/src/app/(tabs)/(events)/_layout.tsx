import { Stack } from 'expo-router/stack';
import { tabAttendeeCompactStackScreenOptions } from '@/navigation/tab-stack-options';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        ...tabAttendeeCompactStackScreenOptions,
        title: 'Sự kiện',
      }}
    />
  );
}
