import { Stack } from 'expo-router/stack';
import { SupervisorScreen } from '@/screens/supervisor';

export default function SupervisorRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Supervisor' }} />
      <SupervisorScreen />
    </>
  );
}
