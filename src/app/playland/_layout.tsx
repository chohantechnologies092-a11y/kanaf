import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot } from 'expo-router';
import UniversalPortalNav, { NavTabDef } from '../../components/UniversalPortalNav';

const PLAYLAND_TABS: NavTabDef[] = [
  { id: 'playland', label: 'Playland Counter', route: '/playland', icon: 'game-controller-outline', badge: 'TICKETS' },
  { id: 'pos', label: 'Cashier POS', route: '/admin/pos', icon: 'card-outline' },
  { id: 'waiter', label: 'Order Taker', route: '/waiter', icon: 'walk-outline', badge: 'POS' },
  { id: 'dashboard', label: 'Admin Dashboard', route: '/admin/dashboard', icon: 'grid-outline' },
];

export default function PlaylandLayout() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar with Playland Tabs */}
      <UniversalPortalNav
        portalName="Sultan Playland"
        portalRole="playland"
        tabs={PLAYLAND_TABS}
        showTabs={true}
      />

      {/* Screen Slot */}
      <View style={styles.body}>
        <Slot />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4a121a',
  },
  body: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
