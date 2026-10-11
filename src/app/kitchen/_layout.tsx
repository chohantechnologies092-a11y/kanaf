import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const KITCHEN_TABS: NavTabDef[] = [
  { id: 'kds', label: 'Orders KDS', route: '/kitchen/kds', icon: 'flame-outline', badge: 'LIVE' },
  { id: 'day', label: 'Chef Day Ops', route: '/kitchen/day', icon: 'timer-outline' },
  { id: 'availability', label: 'Sold Out (86)', route: '/kitchen/availability', icon: 'close-circle-outline' },
  { id: 'handover', label: 'BOM & Requisitions', route: '/admin/kitchen-handover', icon: 'clipboard-outline' },
  { id: 'juicebar', label: 'Juice Bar', route: '/juicebar/kds', icon: 'cafe-outline', badge: 'BAR' },
  { id: 'waiter', label: 'Order Taker', route: '/waiter', icon: 'walk-outline', badge: 'POS' },
];

export default function KitchenLayout() {
  const { ready } = useRoleGuard(['kitchen', 'manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Kitchen Tabs */}
      <UniversalPortalNav
        portalName="Sultan Kitchen KDS"
        portalRole="kitchen"
        tabs={KITCHEN_TABS}
        showTabs={true}
      />

      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#121212' },
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4a121a',
  },
  content: {
    flex: 1,
    backgroundColor: '#121212',
  },
});
