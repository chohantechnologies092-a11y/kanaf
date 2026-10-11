import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import UniversalPortalNav from '../../components/UniversalPortalNav';

export default function ManagerLayout() {
  const { ready } = useRoleGuard(['manager', 'admin']);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar */}
      <UniversalPortalNav
        portalName="Sultan Manager"
        portalRole="manager"
        showTabs={false}
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
