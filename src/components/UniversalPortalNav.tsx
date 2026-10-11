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
        icon: 'walk-outline' as const,
        color: '#4a121a',
        badge: 'LIVE POS',
      },
      {
        id: 'admin-pos',
        title: 'Cashier POS Counter',
        subtitle: 'Fast billing, payments & receipt printing',
        route: '/admin/pos',
        icon: 'card-outline' as const,
        color: '#2E7D32',
      },
      {
        id: 'menu',
        title: 'Customer Digital Menu',
        subtitle: 'Interactive food catalog with pictures',
        route: '/menu',
        icon: 'restaurant-outline' as const,
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
        icon: 'flame-outline' as const,
        color: '#C62828',
        badge: 'LIVE',
      },
      {
        id: 'juicebar-kds',
        title: 'Juice Bar Display',
        subtitle: 'Beverages, mocktails & fresh juices',
        route: '/juicebar/kds',
        icon: 'cafe-outline' as const,
        color: '#E65100',
        badge: 'BAR',
      },
      {
        id: 'chef-day',
        title: 'Chef Day Console',
        subtitle: 'Session start, mid-day adjustments & yield',
        route: '/kitchen/day',
        icon: 'timer-outline' as const,
        color: '#6A1B9A',
      },
      {
        id: 'kitchen-handover',
        title: 'Kitchen BOM & Requisitions',
        subtitle: 'Ingredient handovers, recipes & returns',
        route: '/admin/kitchen-handover',
        icon: 'clipboard-outline' as const,
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
        icon: 'grid-outline' as const,
        color: '#1A237E',
      },
      {
        id: 'floors',
        title: 'Floors & Zones Setup',
        subtitle: 'Add/edit restaurant floors & seating zones',
        route: '/admin/floors',
        icon: 'business-outline' as const,
        color: '#00695C',
      },
      {
        id: 'tables',
        title: 'Tables & Majlis Cabins',
        subtitle: 'Configure cabins capacity & table arrangements',
        route: '/admin/tables',
        icon: 'apps-outline' as const,
        color: '#4a121a',
      },
      {
        id: 'menu-admin',
        title: 'Menu Catalog Management',
        subtitle: 'Dishes, pricing, variants & categories',
        route: '/admin/menu',
        icon: 'fast-food-outline' as const,
        color: '#D84315',
      },
      {
        id: 'staff',
        title: 'Staff & Order Takers',
        subtitle: 'Employees, roles, PINs & floor assignments',
        route: '/admin/staff',
        icon: 'people-outline' as const,
        color: '#283593',
      },
      {
        id: 'reports',
        title: 'Sales & Business Reports',
        subtitle: 'Daily ledger, item breakdown & profits',
        route: '/admin/reports',
        icon: 'bar-chart-outline' as const,
        color: '#00838F',
      },
      {
        id: 'inventory',
        title: 'Raw Materials & Stock',
        subtitle: 'Inventory, suppliers & unit costs',
        route: '/admin/inventory',
        icon: 'cube-outline' as const,
        color: '#4E342E',
      },
      {
        id: 'playland',
        title: 'Playland Rides & Tickets',
        subtitle: 'Basement kids zone ticketing counter',
        route: '/playland',
        icon: 'game-controller-outline' as const,
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

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handlePortalNavigate = (route: string) => {
    setModalVisible(false);
    router.push(route as Href);
  };

  const handleLogout = () => {
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
        {/* Left: Brand Logo & Portal Title */}
        <View style={styles.brandContainer}>
          <TouchableOpacity
            style={styles.logoTouch}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SultanLogo size="sm" width={26} height={26} />
            <View style={{ marginLeft: 6 }}>
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
          {/* Quick Home Jump */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.homeBtn]}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={15} color="#D5A943" />
            {!isMobile && <Text style={styles.homeBtnText}>Home</Text>}
          </TouchableOpacity>

          {/* Quick All-Portals Switcher Button (Crucial user-friendly feature) */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.portalsSwitchBtn]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="grid" size={15} color="#4a121a" />
            <Text style={styles.portalsSwitchBtnText}>
              {isMobile ? 'Portals' : '☰ All Portals'}
            </Text>
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

      {/* 3. Universal All-Portals Quick Jump Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <SultanLogo size="xs" width={26} height={26} />
                <View>
                  <Text style={styles.modalTitle}>Sultan System Navigation</Text>
                  <Text style={styles.modalSubtitle}>
                    Jump directly to any module across the restaurant
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Quick Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={17} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search modules (e.g. Floors, Tables, KDS, Reports, POS)..."
                placeholderTextColor="#AEAEB2"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={Platform.OS === 'web'}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Categorized Portals Scroll */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {filteredPortals.map((group) => (
                <View key={group.category} style={styles.portalGroup}>
                  <Text style={styles.groupHeader}>{group.category}</Text>
                  <View style={styles.cardsGrid}>
                    {group.items.map((item) => {
                      const isCurrent = pathname === item.route;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.portalCard,
                            isCurrent && styles.portalCardCurrent,
                            isMobile && styles.portalCardMobile,
                          ]}
                          onPress={() => handlePortalNavigate(item.route)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.portalCardIconBox,
                              { backgroundColor: item.color + '15' },
                            ]}
                          >
                            <Ionicons name={item.icon} size={20} color={item.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={styles.portalCardTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              {item.badge && (
                                <View
                                  style={[
                                    styles.itemBadge,
                                    { backgroundColor: item.color + '20' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.itemBadgeText,
                                      { color: item.color },
                                    ]}
                                  >
                                    {item.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.portalCardSubtitle} numberOfLines={2}>
                              {item.subtitle}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#C7C7CC"
                            style={{ marginLeft: 4 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Quick Home Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.footerHomeBtn}
                onPress={() => handlePortalNavigate('/')}
                activeOpacity={0.8}
              >
                <Ionicons name="home-outline" size={16} color="#D5A943" />
                <Text style={styles.footerHomeText}>Return to Main Landing Page</Text>
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
  portalsSwitchBtn: {
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
  portalsSwitchBtnText: {
    color: BRAND.burgundy,
    fontSize: 12,
    fontWeight: '900',
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

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#F8F9FA',
    borderRadius: 18,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContentMobile: {
    maxHeight: '94%',
    borderRadius: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(213, 169, 67, 0.4)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    color: BRAND.goldLight,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
  },
  modalScroll: {
    paddingHorizontal: 16,
  },
  portalGroup: {
    marginTop: 12,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  cardsGrid: {
    gap: 8,
  },
  portalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E1D5',
    gap: 12,
  },
  portalCardMobile: {
    padding: 10,
    gap: 10,
  },
  portalCardCurrent: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FFFDF9',
    borderWidth: 2,
  },
  portalCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  portalCardSubtitle: {
    fontSize: 11,
    color: '#636366',
    marginTop: 2,
    lineHeight: 15,
  },
  itemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalFooter: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E1D5',
    alignItems: 'center',
  },
  footerHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#4a121a',
  },
  footerHomeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D5A943',
  },
});
