import { NativeTabs } from 'expo-router/native-tabs';
import { brand } from '@/theme/colors';

export default function TabLayout() {
  return (
    <NativeTabs tintColor={brand.signal}>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Sự kiện</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-tickets">
        <NativeTabs.Trigger.Icon sf="ticket" />
        <NativeTabs.Trigger.Label>Vé của tôi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="staff">
        <NativeTabs.Trigger.Icon sf="person.badge.shield.checkmark" />
        <NativeTabs.Trigger.Label>Nhân viên</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
