import { Stack } from 'expo-router';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  Platform,
  useWindowDimensions 
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import SyncStatusBadge from '../../components/SyncStatusBadge';
import SultanLogo from '../../components/SultanLogo';
import RoleDrawer, { DrawerItem } from '../../components/RoleDrawer';
import BottomNav from '../../components/BottomNav';

const MANAGER_MENU_ITEMS: DrawerItem[] = [
  { label: 'Dashboard', route: '/manager/dashboard', icon: 'grid-outline' },
  { label: 'POS Terminal', route: '/manager/pos', icon: 'calculator-outline' },
  { label: 'Floor Plan', route: '/manager/floor-plan', icon: 'business-outline' },
  { label: 'Live Shift', route: '/manager/shift', icon: 'time-outline' },
  { label: 'Invoices & Orders', route: '/manager/invoices', icon: 'receipt-outline' },
  { label: 'Sales Returns & Refunds', route: '/manager/returns', icon: 'return-down-back-outline' },
  { label: 'Inventory', route: '/manager/inventory', icon: 'cube-outline' },
  { label: 'Suppliers', route: '/manager/suppliers', icon: 'bus-outline' },
  { label: 'Live Expenses', route: '/manager/expenses', icon: 'wallet-outline' },
  { label: 'Floor Command', route: '/manager/floors', icon: 'layers-outline' },
  { label: 'Kitchen Handover', route: '/manager/kitchen-handover', icon: 'clipboard-outline' },
  { label: 'Kitchen Returns', route: '/manager/kitchen-returns', icon: 'checkmark-done-circle-outline' },
  { label: 'Recipe BOM', route: '/manager/recipes', icon: 'restaurant-outline' },
  { label: 'Dish Costing', route: '/manager/costing', icon: 'calculator-outline' },
];

export default function ManagerLayout() {
  // Admin can also open manager screens (e.g. Inventory from the admin dashboard)
  const { ready, user, logout } = useRoleGuard(['manager', 'admin']);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.hamburgerBtn} 
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <SultanLogo 
            size="xs" 
            variant="circle" 
            width={20} 
            height={20} 
            containerStyle={{ marginRight: 8, marginLeft: 8, width: 32, height: 32, borderRadius: 16 }} 
          />
          <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
            {isMobile ? 'Manager' : 'Sultan Manager'}
          </Text>
          <View style={styles.shiftBadge}>
            <Text style={styles.shiftBadgeText}>SHIFT OPEN</Text>
          </View>
        </View>
        
        <View style={[styles.headerRight, isMobile && styles.headerRightMobile]}>
          <SyncStatusBadge compact={isMobile} />
          
          {!isMobile && (
            <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
          )}

          <TouchableOpacity 
            style={[styles.logoutButton, isMobile && styles.logoutButtonMobile]}
            onPress={logout}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons 
              name="log-out-outline" 
              size={17} 
              color="#e74c3c" 
              style={!isMobile ? { marginRight: 6 } : undefined} 
            />
            {!isMobile && <Text style={styles.logoutText}>Logout</Text>}
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.content}>
        <Stack 
          screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: '#F8F9FA' }
          }} 
        />
      </View>

      <BottomNav role="manager" onOpenDrawer={() => setIsDrawerOpen(true)} />

      <RoleDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        items={MANAGER_MENU_ITEMS}
        roleName="Manager"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean top status bar area
    ...Platform.select({
      web: {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      },
    }),
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  headerTitleMobile: {
    fontSize: 17,
  },
  hamburgerBtn: {
    padding: 4,
  },
  shiftBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  shiftBadgeText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRightMobile: {
    gap: 8,
  },
  userName: {
    fontSize: 14,
    color: '#636366',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FADCD8',
  },
  logoutButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    overflow: 'hidden',
  }
});
