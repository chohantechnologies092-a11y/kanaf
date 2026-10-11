import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot } from 'expo-router';
import UniversalPortalNav from '../../components/UniversalPortalNav';

export default function PlaylandLayout() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />

      {/* Universal Top Navigation Bar */}
      <UniversalPortalNav
        portalName="Sultan Playland"
        portalRole="playland"
        showTabs={false}
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
