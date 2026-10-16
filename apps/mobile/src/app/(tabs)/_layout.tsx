import { NativeTabs } from 'expo-router/native-tabs';
export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-tickets">
        <NativeTabs.Trigger.Icon sf="ticket" />
        <NativeTabs.Trigger.Label>My Tickets</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="staff">
        <NativeTabs.Trigger.Icon sf="person.badge.shield.checkmark" />
        <NativeTabs.Trigger.Label>Staff</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
