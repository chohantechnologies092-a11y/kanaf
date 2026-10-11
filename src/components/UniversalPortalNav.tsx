import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  useWindowDimensions,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import SultanLogo from './SultanLogo';
import SyncStatusBadge from './SyncStatusBadge';

const BRAND = {
  burgundy: '#4a121a',
  burgundyDark: '#360b11',
  burgundyLight: '#5c1722',
  gold: '#D5A943',
  goldLight: '#F5E8C7',
  goldMuted: 'rgba(213, 169, 67, 0.3)',
  white: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.75)',
  cardBg: '#FFFFFF',
  border: '#E8E1D5',
};

export type NavTabDef = {
  id: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
};

export type PortalItem = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badge?: string;
};

export type PortalGroup = {
  category: string;
  items: PortalItem[];
};

// All available portals across the entire restaurant system
const ALL_PORTALS_CONFIG: PortalGroup[] = [
  {
    category: 'Front of House & Dine-In',
    items: [
      {
        id: 'waiter',
        title: 'Order Taker Terminal',
        subtitle: 'Floor tables, couches & Arabian majlis cabins',
        route: '/waiter',
        icon: 'walk-outline',
        color: '#4a121a',
        badge: 'LIVE POS',
      },
      {
        id: 'admin-pos',
        title: 'Cashier POS Counter',
        subtitle: 'Fast billing, payments & receipt printing',
        route: '/admin/pos',
        icon: 'card-outline',
        color: '#2E7D32',
      },
      {
        id: 'menu',
        title: 'Customer Digital Menu',
        subtitle: 'Interactive food catalog with pictures',
        route: '/menu',
        icon: 'restaurant-outline',
        color: '#D5A943',
      },
    ],
  },
  {
    category: 'Kitchen & Beverage Operations',
    items: [
      {
        id: 'kitchen-kds',
        title: 'Kitchen Display (KDS)',
        subtitle: 'Live kitchen orders & course timings',
        route: '/kitchen/kds',
        icon: 'flame-outline',
        color: '#C62828',
        badge: 'LIVE',
      },
      {
        id: 'juicebar-kds',
        title: 'Juice Bar Display',
        subtitle: 'Beverages, mocktails & fresh juices',
        route: '/juicebar/kds',
        icon: 'cafe-outline',
        color: '#E65100',
        badge: 'BAR',
      },
      {
        id: 'chef-day',
        title: 'Chef Day Console',
        subtitle: 'Session start, mid-day adjustments & yield',
        route: '/kitchen/day',
        icon: 'timer-outline',
        color: '#6A1B9A',
      },
      {
        id: 'kitchen-handover',
        title: 'Kitchen BOM & Requisitions',
        subtitle: 'Ingredient handovers, recipes & returns',
        route: '/admin/kitchen-handover',
        icon: 'clipboard-outline',
        color: '#1565C0',
      },
    ],
  },
  {
    category: 'Management & Floor Setup',
    items: [
      {
        id: 'dashboard',
        title: 'Executive Dashboard',
        subtitle: 'Live revenue, active tables & shift summary',
        route: '/admin/dashboard',
        icon: 'grid-outline',
        color: '#1A237E',
      },
      {
        id: 'floors',
        title: 'Floors & Zones Setup',
        subtitle: 'Add/edit restaurant floors & seating zones',
        route: '/admin/floors',
        icon: 'business-outline',
        color: '#00695C',
      },
      {
        id: 'tables',
        title: 'Tables & Majlis Cabins',
        subtitle: 'Configure cabins capacity & table arrangements',
        route: '/admin/tables',
        icon: 'apps-outline',
        color: '#4a121a',
      },
      {
        id: 'menu-admin',
        title: 'Menu Catalog Management',
        subtitle: 'Dishes, pricing, variants & categories',
        route: '/admin/menu',
        icon: 'fast-food-outline',
        color: '#D84315',
      },
      {
        id: 'staff',
        title: 'Staff & Order Takers',
        subtitle: 'Employees, roles, PINs & floor assignments',
        route: '/admin/staff',
        icon: 'people-outline',
        color: '#283593',
      },
      {
        id: 'reports',
        title: 'Sales & Business Reports',
        subtitle: 'Daily ledger, item breakdown & profits',
        route: '/admin/reports',
        icon: 'bar-chart-outline',
        color: '#00838F',
      },
      {
        id: 'inventory',
        title: 'Raw Materials & Stock',
        subtitle: 'Inventory, suppliers & unit costs',
        route: '/admin/inventory',
        icon: 'cube-outline',
        color: '#4E342E',
      },
      {
        id: 'playland',
        title: 'Playland Rides & Tickets',
        subtitle: 'Basement kids zone ticketing counter',
        route: '/playland',
        icon: 'game-controller-outline',
        color: '#AD1457',
      },
    ],
  },
];

interface UniversalPortalNavProps {
  portalName: string;
  portalRole?: string;
  tabs?: NavTabDef[];
  activeTabId?: string;
  onTabPress?: (tab: NavTabDef) => void;
  showTabs?: boolean;
}

export default function UniversalPortalNav({
  portalName,
  portalRole,
  tabs,
  activeTabId,
  onTabPress,
  showTabs = true,
}: UniversalPortalNavProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handlePortalNavigate = (route: string) => {
    setSidebarOpen(false);
    router.push(route as Href);
  };

  const handleLogout = () => {
    setSidebarOpen(false);
    logout();
    router.replace('/login');
  };

  const filteredPortals = ALL_PORTALS_CONFIG.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <View style={styles.navRoot}>
      {/* 1. Main Top Header Bar */}
      <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
        {/* Left: Hamburger Button (Opens Sidebar) + Brand Logo & Portal Title */}
        <View style={styles.brandContainer}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setSidebarOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="menu" size={24} color="#D5A943" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoTouch}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SultanLogo size="sm" width={26} height={26} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.brandTitle}>
                {isMobile ? 'Sultan' : 'Sultan Restaurant'}
              </Text>
              <View style={styles.portalBadge}>
                <Text style={styles.portalBadgeText}>
                  {portalRole ? portalRole.toUpperCase() : portalName.toUpperCase()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Center / Right: Quick Navigation Actions */}
        <View style={styles.actionsRight}>
          {/* Sidebar Trigger Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.sidebarTriggerBtn]}
            onPress={() => setSidebarOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="apps" size={15} color="#4a121a" />
            <Text style={styles.sidebarTriggerBtnText}>
              {isMobile ? 'Menu' : '☰ Side Bar'}
            </Text>
          </TouchableOpacity>

          {/* Quick Home Jump */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.homeBtn]}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={15} color="#D5A943" />
            {!isMobile && <Text style={styles.homeBtnText}>Home</Text>}
          </TouchableOpacity>

          {/* LAN Sync Status */}
          <SyncStatusBadge compact={isMobile} />

          {/* Active User Badge (Desktop / Tablet) */}
          {!isMobile && user?.name && (
            <View style={styles.userBadge}>
              <Ionicons name="person-circle-outline" size={16} color="#D5A943" />
              <Text style={styles.userName} numberOfLines={1}>
                {user.name}
              </Text>
            </View>
          )}

          {/* Logout / Switch User */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.logoutBtn]}
            onPress={handleLogout}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="log-out-outline" size={16} color="#D5A943" />
            {!isMobile && <Text style={styles.logoutBtnText}>Logout</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Sub-Navbar (Scrollable Module Tabs) */}
      {showTabs && tabs && tabs.length > 0 && (
        <View style={styles.tabsStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {tabs.map((tab) => {
              const isActive =
                activeTabId === tab.id ||
                pathname === tab.route ||
                (tab.route !== '/admin/dashboard' &&
                  tab.route !== '/manager/dashboard' &&
                  pathname.startsWith(tab.route));

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => {
                    if (onTabPress) {
                      onTabPress(tab);
                    } else {
                      router.push(tab.route as Href);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={isActive ? BRAND.burgundy : '#666'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                    {tab.label}
                  </Text>
                  {tab.badge && (
                    <View
                      style={[
                        styles.tabBadge,
                        isActive ? styles.tabBadgeActive : styles.tabBadgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabBadgeText,
                          isActive && styles.tabBadgeTextActive,
                        ]}
                      >
                        {tab.badge}
                      </Text>
                    </View>
                  )}
                  {isActive && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. Left Slide-In Side Bar Navigation Drawer */}
      <Modal
        visible={sidebarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          {/* Backdrop (tap to close) */}
          <Pressable
            style={styles.sidebarBackdrop}
            onPress={() => setSidebarOpen(false)}
          />

          {/* The Sidebar Drawer */}
          <View
            style={[
              styles.sidebarDrawer,
              isMobile ? styles.sidebarDrawerMobile : styles.sidebarDrawerTablet,
            ]}
          >
            {/* Sidebar Royal Header */}
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarBrandRow}>
                <SultanLogo size="sm" width={32} height={32} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.sidebarTitle}>Sultan Restaurant</Text>
                  <Text style={styles.sidebarSubtitle}>Royal Operations System</Text>
                </View>
                <TouchableOpacity
                  style={styles.sidebarCloseBtn}
                  onPress={() => setSidebarOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color="#D5A943" />
                </TouchableOpacity>
              </View>

              {/* User Profile Card inside Sidebar */}
              <View style={styles.sidebarProfileCard}>
                <View style={styles.profileAvatarBox}>
                  <Ionicons name="person" size={16} color="#4a121a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {user?.name || 'Staff User'}
                  </Text>
                  <Text style={styles.profileRole}>
                    {portalRole ? portalRole.toUpperCase() : 'ACTIVE SESSION'}
                  </Text>
                </View>
                <View style={styles.profileLiveDot} />
              </View>
            </View>

            {/* Sidebar Search Bar */}
            <View style={styles.sidebarSearchBar}>
              <Ionicons name="search" size={15} color="#8E8E93" />
              <TextInput
                style={styles.sidebarSearchInput}
                placeholder="Search modules..."
                placeholderTextColor="#AEAEB2"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Modules List inside Sidebar */}
            <ScrollView
              style={styles.sidebarScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {filteredPortals.map((group) => (
                <View key={group.category} style={styles.sidebarGroup}>
                  <Text style={styles.sidebarGroupHeader}>{group.category}</Text>
                  <View style={styles.sidebarItemsList}>
                    {group.items.map((item) => {
                      const isCurrent = pathname === item.route;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.sidebarItem,
                            isCurrent && styles.sidebarItemCurrent,
                          ]}
                          onPress={() => handlePortalNavigate(item.route)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.sidebarItemIconBox,
                              { backgroundColor: item.color + '15' },
                              isCurrent && { backgroundColor: item.color },
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={18}
                              color={isCurrent ? '#FFFFFF' : item.color}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.sidebarItemTitle,
                                isCurrent && styles.sidebarItemTitleCurrent,
                              ]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text style={styles.sidebarItemSubtitle} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          </View>
                          {item.badge && (
                            <View
                              style={[
                                styles.sidebarBadge,
                                { backgroundColor: item.color + '20' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.sidebarBadgeText,
                                  { color: item.color },
                                ]}
                              >
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Sidebar Bottom Sticky Actions */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={styles.sidebarHomeBtn}
                onPress={() => handlePortalNavigate('/')}
                activeOpacity={0.8}
              >
                <Ionicons name="home-outline" size={17} color="#D5A943" />
                <Text style={styles.sidebarHomeText}>Home Landing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarLogoutBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={17} color="#FF3B30" />
                <Text style={styles.sidebarLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  navRoot: {
    backgroundColor: BRAND.burgundy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(213, 169, 67, 0.25)',
    zIndex: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BRAND.burgundy,
  },
  topBarMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  portalBadge: {
    backgroundColor: 'rgba(213, 169, 67, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.4)',
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  portalBadgeText: {
    color: BRAND.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sidebarTriggerBtn: {
    backgroundColor: BRAND.gold,
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sidebarTriggerBtnText: {
    color: BRAND.burgundy,
    fontSize: 12,
    fontWeight: '900',
  },
  homeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.4)',
    gap: 4,
  },
  homeBtnText: {
    color: BRAND.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.3)',
    gap: 4,
  },
  logoutBtnText: {
    color: BRAND.gold,
    fontSize: 12,
    fontWeight: '700',
  },

  // Sub-Navbar (Tabs Strip)
  tabsStrip: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(213, 169, 67, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E1D5',
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: 'rgba(74, 18, 26, 0.08)',
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
  },
  tabItemTextActive: {
    color: BRAND.burgundy,
    fontWeight: '900',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeInactive: {
    backgroundColor: '#F0ECE3',
  },
  tabBadgeActive: {
    backgroundColor: BRAND.burgundy,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: BRAND.burgundy,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Left Sidebar Drawer Styles
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sidebarDrawer: {
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 16,
    zIndex: 1000,
  },
  sidebarDrawerMobile: {
    width: '82%',
    maxWidth: 320,
  },
  sidebarDrawerTablet: {
    width: 330,
  },
  sidebarHeader: {
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(213, 169, 67, 0.4)',
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sidebarSubtitle: {
    fontSize: 11,
    color: BRAND.goldLight,
    marginTop: 1,
  },
  sidebarCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
  },
  profileAvatarBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileRole: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND.goldLight,
  },
  profileLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  sidebarSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    gap: 8,
  },
  sidebarSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1C1C1E',
  },
  sidebarScroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  sidebarGroup: {
    marginTop: 14,
  },
  sidebarGroupHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  sidebarItemsList: {
    gap: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  sidebarItemCurrent: {
    backgroundColor: 'rgba(74, 18, 26, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: BRAND.burgundy,
  },
  sidebarItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sidebarItemTitleCurrent: {
    color: BRAND.burgundy,
    fontWeight: '900',
  },
  sidebarItemSubtitle: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 1,
  },
  sidebarBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  sidebarBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sidebarFooter: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E1D5',
    flexDirection: 'row',
    gap: 8,
  },
  sidebarHomeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
  },
  sidebarHomeText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.gold,
  },
  sidebarLogoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  sidebarLogoutText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D32F2F',
  },
});
