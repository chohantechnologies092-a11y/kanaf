import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav from '../../components/UniversalPortalNav';
import BottomNav from '../../components/BottomNav';

export default function WaiterLayout() {
  const { ready, logout } = useRoleGuard(['waiter', 'manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar */}
      <UniversalPortalNav
        portalName="Sultan Order Taker"
        portalRole="waiter"
        showTabs={false}
      />

      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8F9FA' },
          }}
        />
      </View>
      <BottomNav role="waiter" onLogout={logout} />
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
