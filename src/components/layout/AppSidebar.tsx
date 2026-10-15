import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import SultanLogo from '../SultanLogo';

export type NavItem = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  category?: string;
};

interface AppSidebarProps {
  role: 'admin' | 'manager';
  items: NavItem[];
  user: { name?: string; role?: string | null; email?: string } | null;
  onLogout: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const BRAND = {
  bgGradient: 'linear-gradient(180deg, #180408 0%, #0D0104 100%)',
  bgSolid: '#120205',
  borderGold: 'rgba(213, 169, 67, 0.22)',
  gold: '#D5A943',
  goldHover: '#F5C968',
  goldGlow: 'rgba(213, 169, 67, 0.35)',
  activePill: 'linear-gradient(90deg, rgba(213, 169, 67, 0.22) 0%, rgba(213, 169, 67, 0.05) 100%)',
  activePillSolid: 'rgba(213, 169, 67, 0.16)',
  textLight: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.62)',
  textDim: 'rgba(255, 255, 255, 0.38)',
  accentRed: '#EF4444',
  accentGreen: '#10B981',
};

// Categorize items into organized groups
function groupItems(items: NavItem[], role: 'admin' | 'manager') {
  if (role === 'admin') {
    return [
      {
        title: 'OPERATIONS & POS',
        icon: 'flash-outline' as const,
        routes: ['/admin/dashboard', '/admin/pos', '/admin/invoices', '/admin/returns', '/admin/tables', '/admin/floors'],
      },
      {
        title: 'CATALOG & INVENTORY',
        icon: 'cube-outline' as const,
        routes: ['/admin/menu', '/admin/inventory', '/admin/recipes', '/admin/costing', '/admin/suppliers'],
      },
      {
        title: 'INTELLIGENCE & FINANCE',
        icon: 'bar-chart-outline' as const,
        routes: ['/admin/reports', '/admin/insights', '/admin/expenses', '/admin/staff', '/admin/customers'],
      },
      {
        title: 'KITCHEN & PLAYLAND',
        icon: 'restaurant-outline' as const,
        routes: ['/admin/kitchen-handover', '/admin/kitchen-returns', '/admin/playland'],
      },
    ];
  } else {
    return [
      {
        title: 'OPERATIONS & SHIFT',
        icon: 'time-outline' as const,
        routes: ['/manager/dashboard', '/manager/pos', '/manager/floor-plan', '/manager/floors', '/manager/shift'],
      },
      {
        title: 'BILLING & AUDIT',
        icon: 'receipt-outline' as const,
        routes: ['/manager/invoices', '/manager/returns', '/manager/expenses'],
      },
      {
        title: 'INVENTORY & RECIPES',
        icon: 'cube-outline' as const,
        routes: ['/manager/inventory', '/manager/suppliers', '/manager/kitchen-handover', '/manager/kitchen-returns', '/manager/recipes', '/manager/costing'],
      },
    ];
  }
}

export default function AppSidebar({
  role,
  items,
  user,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const toggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setCollapsed(!collapsed);
    }
  };

  const currentCollapsed = onToggleCollapse !== undefined ? isCollapsed : collapsed;
  const groups = groupItems(items, role);

  const handleNavigate = (route: string) => {
    if (onCloseMobile) onCloseMobile();
    router.push(route as any);
  };

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const showExpanded = isMobileDrawer || !currentCollapsed;

    return (
      <View style={[styles.sidebarInner, isMobileDrawer && styles.sidebarInnerMobile]}>
        {/* CSS for Web Hover and Glow */}
        {Platform.OS === 'web' && (
          <style>{`
            [data-sidebar-nav="item"], .sidebar-nav-item {
              transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
              cursor: pointer !important;
            }
            [data-sidebar-nav="item"]:hover, .sidebar-nav-item:hover {
              background: rgba(213, 169, 67, 0.14) !important;
              transform: translateX(4px) !important;
            }
            [data-sidebar-collapse="btn"], .sidebar-collapse-btn {
              transition: all 0.2s ease !important;
              cursor: pointer !important;
            }
            [data-sidebar-collapse="btn"]:hover, .sidebar-collapse-btn:hover {
              background: rgba(213, 169, 67, 0.25) !important;
              color: #FFD778 !important;
            }
            [data-sidebar-pos="btn"], .sidebar-pos-btn {
              transition: all 0.25s ease !important;
              cursor: pointer !important;
            }
            [data-sidebar-pos="btn"]:hover, .sidebar-pos-btn:hover {
              transform: translateY(-2px) !important;
              box-shadow: 0 6px 20px rgba(213, 169, 67, 0.45) !important;
            }
            [data-sidebar-logout="btn"], .sidebar-logout-btn {
              transition: all 0.25s ease !important;
              cursor: pointer !important;
            }
            [data-sidebar-logout="btn"]:hover, .sidebar-logout-btn:hover {
              background: rgba(239, 68, 68, 0.22) !important;
              border-color: rgba(239, 68, 68, 0.5) !important;
            }
            .sidebar-scroll::-webkit-scrollbar {
              width: 5px;
            }
            .sidebar-scroll::-webkit-scrollbar-thumb {
              background: rgba(213, 169, 67, 0.2);
              border-radius: 4px;
            }
            .sidebar-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(213, 169, 67, 0.4);
            }
          `}</style>
        )}

        {/* 1. BRAND HEADER */}
        <View style={[styles.brandHeader, !showExpanded && styles.brandHeaderCollapsed]}>
          <TouchableOpacity 
            style={styles.brandRow} 
            activeOpacity={0.8}
            onPress={() => handleNavigate(role === 'admin' ? '/admin/dashboard' : '/manager/dashboard')}
          >
            <View style={styles.logoGlowRing}>
              <SultanLogo size={showExpanded ? 'sm' : 'xs'} width={showExpanded ? 34 : 26} height={showExpanded ? 34 : 26} />
            </View>
            {showExpanded && (
              <View style={styles.brandTextCol}>
                <View style={styles.brandTitleRow}>
                  <Text style={styles.brandTitle}>SULTAN</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{role.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.brandSubtitle}>Restaurant Operations</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Close button for Mobile, or Collapse Toggle for Desktop */}
          {isMobileDrawer ? (
            <TouchableOpacity onPress={onCloseMobile} style={styles.iconActionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={BRAND.gold} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={toggle} 
              style={[styles.iconActionBtn, styles.collapseBtn]}
              {...({ dataSet: { sidebarCollapse: 'btn' } } as any)}
            >
              <Ionicons 
                name={showExpanded ? 'chevron-back' : 'chevron-forward'} 
                size={18} 
                color={BRAND.gold} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* 2. USER PROFILE BANNER */}
        {showExpanded ? (
          <View style={styles.userCard}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{(user?.name || role)[0].toUpperCase()}</Text>
              <View style={styles.onlineBeacon} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Administrator'}</Text>
              <View style={styles.userStatusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.userStatusText}>Cloud Synced • Live</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.userCardCollapsed}>
            <View style={styles.avatarBoxSmall}>
              <Text style={styles.avatarTextSmall}>{(user?.name || role)[0].toUpperCase()}</Text>
              <View style={styles.onlineBeaconSmall} />
            </View>
          </View>
        )}

        {/* 3. NAVIGATION ITEMS */}
        <ScrollView 
          style={styles.navScrollView} 
          contentContainerStyle={styles.navScrollContent}
          showsVerticalScrollIndicator={false}
          {...({ dataSet: { sidebarScroll: 'true' } } as any)}
        >
          {groups.map((group, gIdx) => {
            const groupItemsList = items.filter(it => group.routes.includes(it.route));
            if (groupItemsList.length === 0) return null;

            return (
              <View key={gIdx} style={styles.groupSection}>
                {showExpanded ? (
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name={group.icon} size={12} color={BRAND.gold} style={{ opacity: 0.8, marginRight: 6 }} />
                    <Text style={styles.groupHeaderTitle}>{group.title}</Text>
                  </View>
                ) : (
                  <View style={styles.groupDividerMini} />
                )}

                {groupItemsList.map((item, iIdx) => {
                  const isActive = pathname === item.route;

                  return (
                    <TouchableOpacity
                      key={iIdx}
                      style={[
                        styles.navItem,
                        !showExpanded && styles.navItemCollapsed,
                        isActive && styles.navItemActive,
                      ]}
                      onPress={() => handleNavigate(item.route)}
                      activeOpacity={0.75}
                      {...({ dataSet: { sidebarNav: 'item' } } as any)}
                    >
                      {isActive && <View style={styles.activeIndicatorBar} />}

                      <View style={[styles.navIconContainer, isActive && styles.navIconContainerActive]}>
                        <Ionicons
                          name={item.icon}
                          size={showExpanded ? 19 : 21}
                          color={isActive ? BRAND.gold : BRAND.textMuted}
                        />
                      </View>

                      {showExpanded && (
                        <View style={styles.navLabelContainer}>
                          <Text
                            style={[
                              styles.navLabel,
                              isActive && styles.navLabelActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {item.badge && (
                            <View style={styles.itemBadge}>
                              <Text style={styles.itemBadgeText}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {showExpanded && isActive && (
                        <Ionicons name="chevron-forward" size={14} color={BRAND.gold} style={styles.activeChevron} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        {/* 4. FOOTER QUICK ACTION & LOGOUT */}
        <View style={[styles.sidebarFooter, !showExpanded && styles.sidebarFooterCollapsed]}>
          {/* Quick POS Terminal shortcut */}
          <TouchableOpacity
            style={[
              styles.quickPosBtn,
              !showExpanded && styles.quickPosBtnCollapsed,
            ]}
            onPress={() => handleNavigate(role === 'admin' ? '/admin/pos' : '/manager/pos')}
            activeOpacity={0.85}
            {...({ dataSet: { sidebarPos: 'btn' } } as any)}
          >
            <Ionicons name="flash" size={17} color="#160406" />
            {showExpanded && <Text style={styles.quickPosBtnText}>POS Terminal</Text>}
          </TouchableOpacity>

          {/* Logout Action */}
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              !showExpanded && styles.logoutBtnCollapsed,
            ]}
            onPress={onLogout}
            activeOpacity={0.8}
            {...({ dataSet: { sidebarLogout: 'btn' } } as any)}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            {showExpanded && <Text style={styles.logoutBtnText}>Sign Out</Text>}
          </TouchableOpacity>

          {showExpanded && (
            <Text style={styles.versionStamp}>Sultan Cloud POS • v2.4</Text>
          )}
        </View>
      </View>
    );
  };

  // If Mobile drawer is active
  if (isMobileOpen) {
    return (
      <Modal
        visible={isMobileOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseMobile}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={onCloseMobile} />
          <View style={styles.mobileDrawerContainer}>
            {renderSidebarContent(true)}
          </View>
        </View>
      </Modal>
    );
  }

  // Desktop/Tablet Sidebar
  return (
    <View style={[styles.desktopSidebar, currentCollapsed && styles.desktopSidebarCollapsed]}>
      {renderSidebarContent(false)}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopSidebar: {
    width: 260,
    backgroundColor: BRAND.bgSolid,
    borderRightWidth: 1,
    borderRightColor: BRAND.borderGold,
    zIndex: 100,
    height: '100%',
    ...Platform.select({
      web: {
        transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(20px)',
        backgroundImage: BRAND.bgGradient,
      } as any,
    }),
  },
  desktopSidebarCollapsed: {
    width: 76,
  },
  sidebarInner: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  sidebarInnerMobile: {
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mobileDrawerContainer: {
    width: 290,
    maxWidth: '85%',
    backgroundColor: BRAND.bgSolid,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: BRAND.borderGold,
    ...Platform.select({
      web: {
        backgroundImage: BRAND.bgGradient,
      } as any,
    }),
  },

  // 1. Brand Header
  brandHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(213, 169, 67, 0.14)',
  },
  brandHeaderCollapsed: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoGlowRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(213, 169, 67, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(213, 169, 67, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  brandTextCol: {
    marginLeft: 11,
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: BRAND.gold,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  roleTag: {
    backgroundColor: 'rgba(213, 169, 67, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.4)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleTagText: {
    color: BRAND.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: BRAND.textDim,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  collapseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.2)',
  },

  // 2. User Profile Card
  userCard: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  userCardCollapsed: {
    marginVertical: 12,
    alignItems: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(213, 169, 67, 0.2)',
    borderWidth: 1.5,
    borderColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarBoxSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(213, 169, 67, 0.2)',
    borderWidth: 1.5,
    borderColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#FFD778',
    fontSize: 14,
    fontWeight: '900',
  },
  avatarTextSmall: {
    color: '#FFD778',
    fontSize: 13,
    fontWeight: '900',
  },
  onlineBeacon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: BRAND.bgSolid,
  },
  onlineBeaconSmall: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: BRAND.bgSolid,
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  userStatusText: {
    color: BRAND.textDim,
    fontSize: 10,
    fontWeight: '600',
  },

  // 3. Navigation List
  navScrollView: {
    flex: 1,
  },
  navScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 16,
  },
  groupSection: {
    marginBottom: 14,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 3,
  },
  groupHeaderTitle: {
    color: BRAND.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  groupDividerMini: {
    height: 1,
    backgroundColor: 'rgba(213, 169, 67, 0.1)',
    marginHorizontal: 12,
    marginVertical: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  navItemActive: {
    backgroundColor: BRAND.activePillSolid,
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.28)',
    ...Platform.select({
      web: {
        backgroundImage: BRAND.activePill,
      } as any,
    }),
  },
  activeIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: BRAND.gold,
  },
  navIconContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainerActive: {
    transform: [{ scale: 1.05 }],
  },
  navLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  navLabel: {
    color: BRAND.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#FFD778',
    fontWeight: '800',
  },
  activeChevron: {
    marginLeft: 4,
    opacity: 0.7,
  },
  itemBadge: {
    backgroundColor: 'rgba(213, 169, 67, 0.25)',
    borderWidth: 1,
    borderColor: BRAND.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  itemBadgeText: {
    color: BRAND.gold,
    fontSize: 9,
    fontWeight: '900',
  },

  // 4. Footer
  sidebarFooter: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(213, 169, 67, 0.14)',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  sidebarFooterCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quickPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND.gold,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: BRAND.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  quickPosBtnCollapsed: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 12,
  },
  quickPosBtnText: {
    color: '#160406',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutBtnCollapsed: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 12,
  },
  versionStamp: {
    color: BRAND.textDim,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
});
