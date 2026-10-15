import { Stack, usePathname, useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  useWindowDimensions, 
  Platform 
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import SyncStatusBadge from '../../components/SyncStatusBadge';
import SultanLogo from '../../components/SultanLogo';
import BottomNav from '../../components/BottomNav';
import AppSidebar, { NavItem } from '../../components/layout/AppSidebar';

const ADMIN_MENU_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/admin/dashboard', icon: 'grid-outline' },
  { label: 'POS Terminal', route: '/admin/pos', icon: 'calculator-outline', badge: 'POS' },
  { label: 'Invoices & Orders', route: '/admin/invoices', icon: 'receipt-outline' },
  { label: 'Sales Returns & Refunds', route: '/admin/returns', icon: 'return-down-back-outline' },
  { label: 'Menu Catalog', route: '/admin/menu', icon: 'restaurant-outline' },
  { label: 'Staff & Roles', route: '/admin/staff', icon: 'people-outline' },
  { label: 'Financial Reports', route: '/admin/reports', icon: 'bar-chart-outline' },
  { label: 'Inventory & Stock', route: '/admin/inventory', icon: 'cube-outline' },
  { label: 'Suppliers & Vendors', route: '/admin/suppliers', icon: 'bus-outline' },
  { label: 'Table Blueprint', route: '/admin/tables', icon: 'grid-outline' },
  { label: 'Customer CRM', route: '/admin/customers', icon: 'person-outline' },
  { label: 'Floor Command', route: '/admin/floors', icon: 'business-outline' },
  { label: 'Business Insights', route: '/admin/insights', icon: 'trending-up-outline' },
  { label: 'Live Expenses', route: '/admin/expenses', icon: 'wallet-outline' },
  { label: 'Kitchen Handover', route: '/admin/kitchen-handover', icon: 'clipboard-outline' },
  { label: 'Recipe BOM', route: '/admin/recipes', icon: 'fast-food-outline' },
  { label: 'Kitchen Returns', route: '/admin/kitchen-returns', icon: 'checkmark-done-circle-outline' },
  { label: 'Dish Costing', route: '/admin/costing', icon: 'pricetag-outline' },
  { label: 'Playland Hub', route: '/admin/playland', icon: 'balloon-outline' },
];

export default function AdminLayout() {
  const { ready, user, logout } = useRoleGuard(['admin']);
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  
  const isMobile = width < 768;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!ready) return null;

  // Find active screen title for desktop breadcrumbs
  const currentItem = ADMIN_MENU_ITEMS.find(it => it.route === pathname);
  const screenTitle = currentItem ? currentItem.label : 'Admin Operations';

  // Desktop Sidebar Layout
  if (!isMobile) {
    return (
      <View style={styles.desktopShell}>
        <StatusBar barStyle="light-content" backgroundColor="#140306" />

        {/* 1. Permanent Left Liquid Glass Sidebar */}
        <AppSidebar
          role="admin"
          items={ADMIN_MENU_ITEMS}
          user={user}
          onLogout={logout}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* 2. Main Workspace (Top Bar + Screen Stack) */}
        <View style={styles.workspaceArea}>
          {/* Top Glass Header Bar */}
          <View style={styles.desktopTopBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.breadcrumbBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#D5A943" />
                <Text style={styles.breadcrumbAdmin}>Executive Admin</Text>
              </View>
              <Text style={styles.breadcrumbDivider}>/</Text>
              <Text style={styles.topBarScreenTitle}>{screenTitle}</Text>
            </View>

            <View style={styles.topBarRight}>
              <SyncStatusBadge compact={false} />

              {/* Fast POS Shortcut */}
              <TouchableOpacity
                style={styles.headerPosBtn}
                onPress={() => router.push('/admin/pos')}
                activeOpacity={0.8}
              >
                <Ionicons name="calculator" size={15} color="#160406" />
                <Text style={styles.headerPosBtnText}>POS Billing</Text>
              </TouchableOpacity>

              {/* User greeting */}
              <View style={styles.topUserSnippet}>
                <View style={styles.userDot} />
                <Text style={styles.topUserName} numberOfLines={1}>
                  {user?.name || 'Admin'}
                </Text>
              </View>

              {/* Logout button */}
              <TouchableOpacity 
                style={styles.logoutBtn}
                onPress={logout}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="log-out-outline" size={18} color="#D5A943" style={{ marginRight: 6 }} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Screen Content */}
          <View style={styles.desktopContent}>
            <Stack 
              screenOptions={{ 
                headerShown: false,
                contentStyle: { backgroundColor: '#F8FAFC' }
              }} 
            />
          </View>
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView style={styles.mobileShell} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#140306" />

      {/* Mobile Top Header */}
      <View style={styles.mobileHeader}>
        <View style={styles.mobileHeaderLeft}>
          <TouchableOpacity 
            style={styles.hamburgerBtn} 
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color="#D5A943" />
          </TouchableOpacity>
          <SultanLogo size="xs" width={24} height={24} style={{ marginRight: 6, marginLeft: 6 }} />
          <Text style={styles.mobileHeaderTitle}>Sultan Admin</Text>
        </View>

        <View style={styles.mobileHeaderRight}>
          <SyncStatusBadge compact />
          <TouchableOpacity 
            style={styles.mobileLogoutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#D5A943" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Mobile Screen Stack */}
      <View style={styles.mobileContent}>
        <Stack 
          screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' }
          }} 
        />
      </View>

      {/* Mobile Bottom Nav */}
      <BottomNav role="admin" onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* Mobile Slide-out Drawer */}
      <AppSidebar
        role="admin"
        items={ADMIN_MENU_ITEMS}
        user={user}
        onLogout={logout}
        isMobileOpen={isDrawerOpen}
        onCloseMobile={() => setIsDrawerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Desktop
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    ...Platform.select({
      web: {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      },
    }),
  },
  workspaceArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  desktopTopBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      } as any,
    }),
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  breadcrumbAdmin: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  breadcrumbDivider: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  topBarScreenTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#701A26',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#701A26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  headerPosBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  topUserSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  topUserName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 140,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  logoutText: {
    color: '#E11D48',
    fontWeight: '700',
    fontSize: 12,
  },
  desktopContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },

  // Mobile
  mobileShell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mobileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hamburgerBtn: {
    padding: 6,
  },
  mobileHeaderTitle: {
    color: '#701A26',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mobileHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileLogoutBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  mobileContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
