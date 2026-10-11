import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const MANAGER_TABS: NavTabDef[] = [
  { id: 'dashboard', label: 'Dashboard', route: '/manager/dashboard', icon: 'grid-outline' },
  { id: 'pos', label: 'POS Billing', route: '/manager/pos', icon: 'card-outline' },
  { id: 'shift', label: 'Shift Register', route: '/manager/shift', icon: 'timer-outline' },
  { id: 'floor-plan', label: 'Floor Plan', route: '/manager/floor-plan', icon: 'apps-outline' },
  { id: 'inventory', label: 'Inventory', route: '/manager/inventory', icon: 'cube-outline' },
  { id: 'kitchen-handover', label: 'Kitchen Handover', route: '/manager/kitchen-handover', icon: 'clipboard-outline' },
  { id: 'waiter', label: 'Order Taker', route: '/waiter', icon: 'walk-outline', badge: 'POS' },
  { id: 'kitchen-kds', label: 'Kitchen KDS', route: '/kitchen/kds', icon: 'flame-outline', badge: 'KDS' },
  { id: 'juicebar-kds', label: 'Juice Bar', route: '/juicebar/kds', icon: 'cafe-outline' },
];

export default function ManagerLayout() {
  const { ready } = useRoleGuard(['manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Manager Tabs */}
      <UniversalPortalNav
        portalName="Sultan Manager"
        portalRole="manager"
        tabs={MANAGER_TABS}
        showTabs={true}
      />

      {/* Main Content Area */}
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
    backgroundColor: '#4a121a',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
