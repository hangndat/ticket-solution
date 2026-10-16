import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Button, Host } from '@expo/ui';
import { Link } from 'expo-router';
import { demoTenants, eventDate, listDemoEvents } from '@/data/demo-events';
import { Notice } from '@/components/page';
import { colors } from '@/theme/colors';
export function EventsScreen() {
  const [tenant, setTenant] = useState<string>(demoTenants[0]);
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      data={listDemoEvents(tenant)}
      keyExtractor={(item) => `${item.tenantSlug}:${item.id}`}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Notice title="Find your next moment">
            Demo event directory. These fixtures do not offer registration or
            real tickets.
          </Notice>
          <Text selectable style={{ color: colors.secondary }}>
            Organization: {tenant}
          </Text>
          <Host matchContents>
            <Button
              onPress={() =>
                setTenant(
                  tenant === demoTenants[0] ? demoTenants[1] : demoTenants[0],
                )
              }
            >
              Switch demo organization
            </Button>
          </Host>
        </View>
      }
      ListEmptyComponent={
        <Notice title="No demo events">
          This organization has no demo events.
        </Notice>
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: 20,
            gap: 12,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderCurve: 'continuous',
            borderTopWidth: 4,
            borderTopColor: item.brand.primaryColor,
          }}
        >
          <Text selectable style={{ color: colors.secondary }}>
            {item.brand.organizationName}
          </Text>
          <Link
            href={{
              pathname: '/events/[tenantSlug]/[slug]',
              params: { tenantSlug: item.tenantSlug, slug: item.slug },
            }}
            style={{
              color: colors.accent,
              fontSize: 24,
              fontWeight: '600',
              paddingVertical: 8,
            }}
          >
            {item.name}
          </Link>
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {eventDate(item)}
          </Text>
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            {item.location}
          </Text>
        </View>
      )}
    />
  );
}
