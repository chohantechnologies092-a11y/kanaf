import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const WAITER_TABS: NavTabDef[] = [
  { id: 'tables', label: 'Tables & Cabins', route: '/waiter', icon: 'apps-outline' },
  { id: 'menu', label: 'Digital Menu', route: '/menu', icon: 'restaurant-outline' },
  { id: 'kitchen-kds', label: 'Kitchen KDS', route: '/kitchen/kds', icon: 'flame-outline', badge: 'KDS' },
  { id: 'juicebar-kds', label: 'Juice Bar', route: '/juicebar/kds', icon: 'cafe-outline', badge: 'BAR' },
  { id: 'pos', label: 'Cashier POS', route: '/admin/pos', icon: 'card-outline' },
];

export default function WaiterLayout() {
  const { ready } = useRoleGuard(['waiter', 'manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Waiter Tabs */}
      <UniversalPortalNav
        portalName="Sultan Order Taker"
        portalRole="waiter"
        tabs={WAITER_TABS}
        showTabs={true}
      />

      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8F9FA' },
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4a121a', // Sultan Burgundy for status bar area
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
