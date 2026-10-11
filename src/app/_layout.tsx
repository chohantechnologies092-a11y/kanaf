import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { initSyncService } from '../services/syncService';
import StockAlarmHost from '../components/StockAlarmHost';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Initialize real-time cross-device sync hub
    initSyncService();

    // Hide splash screen after a short delay to ensure fonts/assets are loaded
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Live stock / kitchen handover alarms for admin, manager and kitchen roles */}
      <StockAlarmHost />
    </>
  );
}
