import { Stack, usePathname, useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  Platform,
  useWindowDimensions 
} from 'react-native';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useRolePermissions } from '../../store/roleStore';
import SyncStatusBadge from '../../components/SyncStatusBadge';
import SultanLogo from '../../components/SultanLogo';
import BottomNav from '../../components/BottomNav';
import AppSidebar, { NavItem } from '../../components/layout/AppSidebar';
import PermissionDeniedScreen from '../../components/PermissionDeniedScreen';
import { getManagerRouteRule, isManagerRouteAllowed } from '../../constants/managerAccess';

const MANAGER_MENU_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/manager/dashboard', icon: 'grid-outline' },
  { label: 'POS Terminal', route: '/manager/pos', icon: 'calculator-outline', badge: 'POS' },
  { label: 'Floor Plan', route: '/manager/floor-plan', icon: 'business-outline' },
  { label: 'Live Shift & Cash', route: '/manager/shift', icon: 'time-outline' },
  { label: 'Invoices & Orders', route: '/manager/invoices', icon: 'receipt-outline' },
  { label: 'Sales Returns & Refunds', route: '/manager/returns', icon: 'return-down-back-outline' },
  { label: 'Events & Discounts', route: '/manager/discounts', icon: 'pricetags-outline', badge: 'PROMO' },
  { label: 'Inventory', route: '/manager/inventory', icon: 'cube-outline' },
  { label: 'Suppliers', route: '/manager/suppliers', icon: 'bus-outline' },
  { label: 'Live Expenses', route: '/manager/expenses', icon: 'wallet-outline' },
  { label: 'Financial Reports', route: '/manager/reports', icon: 'bar-chart-outline' },
  { label: 'Damage Control', route: '/manager/damages', icon: 'shield-outline' },
  { label: 'Assets & Capex', route: '/manager/assets', icon: 'diamond-outline' },
  { label: 'Floor Command', route: '/manager/floors', icon: 'layers-outline' },
  { label: 'Kitchen Handover', route: '/manager/kitchen-handover', icon: 'clipboard-outline' },
  { label: 'Kitchen Returns', route: '/manager/kitchen-returns', icon: 'checkmark-done-circle-outline' },
  { label: 'Recipe BOM', route: '/manager/recipes', icon: 'restaurant-outline' },
  { label: 'Dish Costing', route: '/manager/costing', icon: 'pricetag-outline' },
];

export default function ManagerLayout() {
  // Admin can also open manager screens (e.g. Inventory from the admin dashboard)
  const { ready, user, logout } = useRoleGuard(['manager', 'admin']);
  const isActualManager = user?.role !== 'admin';
  const { can, roleName } = useRolePermissions(isActualManager ? undefined : 'manager');
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();

  const isMobile = width < 768;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // If user is Admin, they see all menu items. If actual manager, filter based on their allowed permissions.
  const filteredMenuItems = useMemo(() => {
    if (!isActualManager) return MANAGER_MENU_ITEMS;
    return MANAGER_MENU_ITEMS.filter((item) => isManagerRouteAllowed(item.route, can));
  }, [isActualManager, can]);

  // Route guard: Only actual Manager is blocked from screens the Admin has not allowed. Admin has full access.
  const blockedRule = isActualManager && !isManagerRouteAllowed(pathname, can)
    ? getManagerRouteRule(pathname)
    : undefined;

  if (!ready) return null;

  // POS Terminal is Fullscreen (No Sidebar, No Outer Layout Header, No Mobile BottomNav)
  const isPos = pathname === '/manager/pos' || pathname.endsWith('/pos');
  if (isPos) {
    return (
      <View style={{ flex: 1, backgroundColor: '#140306' }}>
        <StatusBar barStyle="light-content" backgroundColor="#140306" />
        <Stack 
          screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' }
          }} 
        />
      </View>
    );
  }

  const currentItem = filteredMenuItems.find(it => it.route === pathname);
  const screenTitle = currentItem ? currentItem.label : 'Floor Operations';

  // Desktop Sidebar Layout
  if (!isMobile) {
    return (
      <View style={styles.desktopShell}>
        <StatusBar barStyle="light-content" backgroundColor="#140306" />

        {/* Global Web Animations & Micro-Interactions */}
        {Platform.OS === 'web' && (
          <style>{`
            @keyframes sultanPageLanding {
              0% {
                opacity: 0;
                transform: translateY(14px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes pulseBeacon {
              0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
              50% { transform: scale(1.1); opacity: 0.85; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            }
            @keyframes pulseGlowGold {
              0%, 100% { box-shadow: 0 0 12px rgba(212, 175, 55, 0.3); }
              50% { box-shadow: 0 0 24px rgba(212, 175, 55, 0.55); }
            }
            [data-page-landing="true"],
            .page-animate-fade {
              animation: sultanPageLanding 0.35s cubic-bezier(0.16, 1, 0.3, 1) both !important;
            }
            /* Universal Card / Box / Tile Hover */
            [data-card],
            [data-hover],
            [data-interactive],
            [data-tile],
            [data-box],
            .interactive-card {
              transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                          box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                          filter 0.22s ease,
                          border-color 0.22s ease !important;
            }
            [data-card]:hover,
            [data-hover]:hover,
            [data-interactive]:hover,
            [data-tile]:hover,
            [data-box]:hover,
            .interactive-card:hover {
              transform: translateY(-3.5px) scale(1.006) !important;
              box-shadow: 0 14px 32px rgba(82, 20, 28, 0.14), 0 0 0 1.5px rgba(212, 175, 55, 0.48) !important;
              filter: brightness(1.03) !important;
              z-index: 4 !important;
            }
            [data-card]:active,
            [data-hover]:active,
            [data-interactive]:active,
            [data-tile]:active,
            [data-box]:active,
            .interactive-card:active {
              transform: translateY(-0.5px) scale(0.985) !important;
            }
          `}</style>
        )}

        {/* 1. Permanent Left Liquid Glass Sidebar */}
        <AppSidebar
          role="manager"
          items={filteredMenuItems}
          user={user}
          onLogout={logout}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* 2. Main Workspace (Top Bar + Screen Stack) */}
        <View style={styles.workspaceArea}>
          {/* Top Royal Sultan Header Bar */}
          <View style={styles.desktopTopBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.topLogoCapsule}>
                <SultanLogo size="xs" width={24} height={24} style={{ marginRight: 8 }} />
                <Text style={styles.topBrandName}>KANAF CAFE & BAKERY</Text>
              </View>

              <View style={styles.shiftPill}>
                <View style={styles.shiftBeacon} />
                <Text style={styles.shiftPillText}>ACTIVE SHIFT</Text>
              </View>

              <Text style={styles.breadcrumbDivider}>/</Text>
              <Text style={styles.topBarScreenTitle}>{screenTitle}</Text>
            </View>

            <View style={styles.topBarRight}>
              <SyncStatusBadge compact={false} />

              {can('canAccessPOS') && (
                <TouchableOpacity
                  style={styles.headerPosBtn}
                  onPress={() => router.push('/manager/pos')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calculator" size={15} color="#24050A" />
                  <Text style={styles.headerPosBtnText}>POS Billing</Text>
                </TouchableOpacity>
              )}

              <View style={styles.topUserSnippet}>
                <View style={styles.topAvatarCircle}>
                  <Text style={styles.topAvatarText}>
                    {(user?.name || 'Manager')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userTextCol}>
                  <Text style={styles.userGreetingSub}>Welcome,</Text>
                  <Text style={styles.topUserName} numberOfLines={1}>
                    {user?.name || 'Manager'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.logoutBtn}
                onPress={logout}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="log-out-outline" size={16} color="#F87171" style={{ marginRight: 5 }} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Screen Content */}
          <View 
            key={pathname}
            style={styles.desktopContent}
            {...(Platform.OS === 'web' ? ({ dataSet: { pageLanding: 'true' } } as any) : {})}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#F8FAFC' },
              }}
            />
            {blockedRule && (
              <View style={StyleSheet.absoluteFill}>
                <PermissionDeniedScreen
                  moduleName={blockedRule.moduleName}
                  urduModuleName={blockedRule.urduModuleName}
                  requiredPermission={blockedRule.requires.join(' + ')}
                  backRoute="/manager/dashboard"
                />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView style={styles.mobileShell} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#24050A" />

      {/* Mobile Top Header */}
      <View style={styles.mobileHeader}>
        <View style={styles.mobileHeaderLeft}>
          <TouchableOpacity 
            style={styles.hamburgerBtn} 
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color="#F3D179" />
          </TouchableOpacity>
          <View style={styles.mobileLogoBox}>
            <SultanLogo size="xs" width={22} height={22} style={{ marginRight: 6 }} />
            <Text style={styles.mobileHeaderTitle}>SULTAN {roleName?.toUpperCase() || 'MANAGER'}</Text>
          </View>
          <View style={styles.mobileShiftBadge}>
            <Text style={styles.mobileShiftText}>SHIFT</Text>
          </View>
        </View>

        <View style={styles.mobileHeaderRight}>
          <SyncStatusBadge compact />
          <TouchableOpacity 
            style={styles.mobileLogoutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Mobile Screen Stack */}
      <View 
        key={pathname}
        style={styles.mobileContent}
        {...(Platform.OS === 'web' ? ({ dataSet: { pageLanding: 'true' } } as any) : {})}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' },
          }}
        />
        {blockedRule && (
          <View style={StyleSheet.absoluteFill}>
            <PermissionDeniedScreen
              moduleName={blockedRule.moduleName}
              urduModuleName={blockedRule.urduModuleName}
              requiredPermission={blockedRule.requires.join(' + ')}
              backRoute="/manager/dashboard"
            />
          </View>
        )}
      </View>

      {/* Mobile Bottom Nav */}
      <BottomNav role="manager" onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* Mobile Slide-out Drawer */}
      <AppSidebar
        role="manager"
        items={filteredMenuItems}
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
    height: 64,
    backgroundColor: '#28010B',
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 224, 203, 0.22)',
    zIndex: 10,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, rgba(68, 1, 18, 0.95) 0%, rgba(40, 1, 11, 0.98) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      } as any,
    }),
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topLogoCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 224, 203, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 203, 0.35)',
    marginRight: 4,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      } as any,
    }),
  },
  topBrandName: {
    color: '#FFE0CB',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  shiftBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  shiftPillText: {
    color: '#34D399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  breadcrumbDivider: {
    color: 'rgba(212, 175, 55, 0.4)',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 3,
  },
  topBarScreenTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 14,
    paddingVertical: 7.5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#F3D179',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #F3D179 0%, #D4AF37 55%, #B8860B 100%)',
        boxShadow: '0 4px 16px rgba(212, 175, 55, 0.45)',
        cursor: 'pointer',
      } as any,
    }),
  },
  headerPosBtnText: {
    color: '#24050A',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  topUserSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      } as any,
    }),
  },
  topAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3D179',
    ...Platform.select({
      web: {
        boxShadow: '0 0 10px rgba(212, 175, 55, 0.4)',
      } as any,
    }),
  },
  topAvatarText: {
    color: '#24050A',
    fontSize: 12,
    fontWeight: '900',
  },
  userTextCol: {
    marginRight: 4,
  },
  userGreetingSub: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 9.5,
    fontWeight: '600',
    lineHeight: 11,
  },
  topUserName: {
    color: '#F3D179',
    fontSize: 12.5,
    fontWeight: '800',
    maxWidth: 130,
    lineHeight: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  logoutText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 11.5,
  },
  desktopContent: {
    flex: 1,
    backgroundColor: '#F7F4EE',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage: 'radial-gradient(circle at 12% 8%, rgba(82, 20, 28, 0.05) 0%, transparent 40%), radial-gradient(circle at 88% 92%, rgba(212, 175, 55, 0.04) 0%, transparent 45%), linear-gradient(180deg, #FBF9F5 0%, #F4EEE4 100%)',
      } as any,
    }),
  },

  // Mobile
  mobileShell: {
    flex: 1,
    backgroundColor: '#200408',
  },
  mobileHeader: {
    backgroundColor: '#200408',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.28)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, rgba(56, 10, 17, 0.94) 0%, rgba(28, 4, 8, 0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
    }),
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hamburgerBtn: {
    padding: 6,
    marginRight: 6,
  },
  mobileLogoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  mobileHeaderTitle: {
    color: '#F3D179',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mobileShiftBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mobileShiftText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mobileHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogoutBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  mobileContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
