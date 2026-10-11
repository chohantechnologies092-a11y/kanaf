import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const ADMIN_TABS: NavTabDef[] = [
  { id: 'dashboard', label: 'Dashboard', route: '/admin/dashboard', icon: 'grid-outline' },
  { id: 'pos', label: 'POS Billing', route: '/admin/pos', icon: 'card-outline' },
  { id: 'floors', label: 'Floors', route: '/admin/floors', icon: 'business-outline' },
  { id: 'tables', label: 'Tables & Cabins', route: '/admin/tables', icon: 'apps-outline' },
  { id: 'menu', label: 'Menu Catalog', route: '/admin/menu', icon: 'fast-food-outline' },
  { id: 'kitchen-ops', label: 'Kitchen Ops', route: '/admin/kitchen-handover', icon: 'clipboard-outline' },
  { id: 'inventory', label: 'Inventory', route: '/admin/inventory', icon: 'cube-outline' },
  { id: 'staff', label: 'Staff & Waiters', route: '/admin/staff', icon: 'people-outline' },
  { id: 'reports', label: 'Reports', route: '/admin/reports', icon: 'bar-chart-outline' },
  { id: 'waiter', label: 'Order Taker', route: '/waiter', icon: 'walk-outline', badge: 'POS' },
  { id: 'kitchen-kds', label: 'Kitchen KDS', route: '/kitchen/kds', icon: 'flame-outline', badge: 'KDS' },
  { id: 'juicebar-kds', label: 'Juice Bar', route: '/juicebar/kds', icon: 'cafe-outline' },
  { id: 'playland', label: 'Playland', route: '/admin/playland', icon: 'game-controller-outline' },
  { id: 'customers', label: 'Customers', route: '/admin/customers', icon: 'person-outline' },
];

export default function AdminLayout() {
  const { ready } = useRoleGuard(['admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Sub-Navbar */}
      <UniversalPortalNav
        portalName="Sultan Admin"
        portalRole="admin"
        tabs={ADMIN_TABS}
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
    backgroundColor: '#4a121a', // Sultan Burgundy covers safe area
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
