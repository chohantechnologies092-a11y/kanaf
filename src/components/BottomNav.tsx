import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BottomNavRole = 'admin' | 'manager' | 'waiter';

const NAV_CONFIG = {
  admin: [
    { label: 'Dash', route: '/admin/dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { label: 'POS', route: '/admin/pos', icon: 'calculator-outline', activeIcon: 'calculator' },
    { label: 'Tables', route: '/admin/tables', icon: 'browsers-outline', activeIcon: 'browsers' },
    { label: 'Menu', route: '/admin/menu', icon: 'restaurant-outline', activeIcon: 'restaurant' },
    { label: 'More', action: 'open_drawer', icon: 'menu-outline', activeIcon: 'menu' },
  ],
  manager: [
    { label: 'Dash', route: '/manager/dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { label: 'POS', route: '/manager/pos', icon: 'calculator-outline', activeIcon: 'calculator' },
    { label: 'Floor', route: '/manager/floor-plan', icon: 'business-outline', activeIcon: 'business' },
    { label: 'Shift', route: '/manager/shift', icon: 'time-outline', activeIcon: 'time' },
    { label: 'More', action: 'open_drawer', icon: 'menu-outline', activeIcon: 'menu' },
  ],
  waiter: [
    { label: 'Floor', route: '/waiter', icon: 'apps-outline', activeIcon: 'apps' },
    { label: 'Logout', action: 'logout', icon: 'log-out-outline', activeIcon: 'log-out' },
  ],
};

const BRAND = {
  burgundy: '#52171B', // Using the harmonized #52171B background
  gold: '#D5A943',
  inactive: '#8E8E93',
  bg: '#FFFFFF',
  border: '#E5E5EA',
};

interface BottomNavProps {
  role: BottomNavRole;
  onOpenDrawer?: () => void;
  onLogout?: () => void;
}

export default function BottomNav({ role, onOpenDrawer, onLogout }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // On large screens, we might just hide the bottom nav since the top bar or side drawer is spacious enough,
  // but showing it universally is fine for quick access. 
  // Waiter uses mobile phones mostly, so they need it.

  const tabs = NAV_CONFIG[role] || [];

  const handlePress = (tab: any) => {
    if (tab.action === 'open_drawer' && onOpenDrawer) {
      onOpenDrawer();
    } else if (tab.action === 'logout' && onLogout) {
      onLogout();
    } else if (tab.route) {
      router.push(tab.route as any);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabContainer}>
        {tabs.map((tab, idx) => {
          const isActive = pathname === tab.route;
          return (
            <TouchableOpacity
              key={idx}
              style={styles.tab}
              onPress={() => handlePress(tab)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isActive ? (tab.activeIcon as any) : (tab.icon as any)} 
                size={22} 
                color={isActive ? BRAND.burgundy : BRAND.inactive} 
                style={styles.icon}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BRAND.bg,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 10,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.inactive,
  },
  labelActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  }
});
