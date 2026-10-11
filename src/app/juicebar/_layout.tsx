import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const JUICEBAR_TABS: NavTabDef[] = [
  { id: 'kds', label: 'Juice Bar Orders', route: '/juicebar/kds', icon: 'cafe-outline', badge: 'LIVE' },
  { id: 'availability', label: 'Sold Out (86)', route: '/juicebar/availability', icon: 'close-circle-outline' },
  { id: 'kitchen', label: 'Kitchen KDS', route: '/kitchen/kds', icon: 'flame-outline', badge: 'KDS' },
  { id: 'waiter', label: 'Order Taker', route: '/waiter', icon: 'walk-outline', badge: 'POS' },
  { id: 'pos', label: 'Cashier POS', route: '/admin/pos', icon: 'card-outline' },
];

export default function JuiceBarLayout() {
  const { ready } = useRoleGuard(['juicebar', 'manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Juice Bar Tabs */}
      <UniversalPortalNav
        portalName="Sultan Juice Bar"
        portalRole="juicebar"
        tabs={JUICEBAR_TABS}
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
