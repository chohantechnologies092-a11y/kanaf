import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import SultanLogo from '../SultanLogo';
import { useRolePermissions } from '../../store/roleStore';

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

export type NavCategoryGroup = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeColor?: string;
  routes: string[];
};

// Categorize items into structured, logical, and managed operational groups
function getCategoryGroups(role: 'admin' | 'manager'): NavCategoryGroup[] {
  if (role === 'admin') {
    return [
      {
        id: 'ops_floor',
        title: 'POS & FLOOR COMMAND',
        icon: 'flash-outline',
        routes: [
          '/admin/dashboard',
          '/admin/pos',
          '/admin/shift',
          '/admin/tables',
          '/admin/floors',
        ],
      },
      {
        id: 'sales_billing',
        title: 'SALES & BILLING CRM',
        icon: 'receipt-outline',
        routes: [
          '/admin/invoices',
          '/admin/returns',
          '/admin/discounts',
          '/admin/customers',
        ],
      },
      {
        id: 'inventory_procurement',
        title: 'INVENTORY & SUPPLY',
        icon: 'cube-outline',
        routes: [
          '/admin/inventory',
          '/admin/suppliers',
          '/admin/damages',
        ],
      },
      {
        id: 'kitchen_craft',
        title: 'KITCHEN & RECIPES',
        icon: 'restaurant-outline',
        routes: [
          '/admin/kitchen-handover',
          '/admin/kitchen-returns',
          '/admin/menu',
          '/admin/recipes',
          '/admin/costing',
        ],
      },
      {
        id: 'finance_intelligence',
        title: 'FINANCE & REPORTS',
        icon: 'bar-chart-outline',
        routes: [
          '/admin/reports',
          '/admin/expenses',
          '/admin/assets',
          '/admin/insights',
        ],
      },
      {
        id: 'admin_management',
        title: 'STAFF & MANAGEMENT',
        icon: 'people-outline',
        routes: [
          '/admin/staff',
          '/admin/playland',
        ],
      },
    ];
  }

  // Manager specific categorization
  return [
    {
      id: 'manager_floor',
      title: 'FLOOR & POS TERMINAL',
      icon: 'flash-outline',
      routes: [
        '/manager/dashboard',
        '/manager/pos',
        '/manager/floor-plan',
        '/manager/floors',
        '/manager/shift',
      ],
    },
    {
      id: 'manager_billing',
      title: 'GUEST ORDERS & BILLING',
      icon: 'receipt-outline',
      routes: [
        '/manager/invoices',
        '/manager/returns',
        '/manager/discounts',
      ],
    },
    {
      id: 'manager_inventory',
      title: 'STOCK & PROCUREMENT',
      icon: 'cube-outline',
      routes: [
        '/manager/inventory',
        '/manager/suppliers',
        '/manager/damages',
      ],
    },
    {
      id: 'manager_kitchen',
      title: 'KITCHEN PRODUCTION',
      icon: 'restaurant-outline',
      routes: [
        '/manager/kitchen-handover',
        '/manager/kitchen-returns',
        '/manager/recipes',
        '/manager/costing',
      ],
    },
    {
      id: 'manager_finance',
      title: 'FINANCIALS & EXPENSES',
      icon: 'wallet-outline',
      routes: [
        '/manager/reports',
        '/manager/expenses',
        '/manager/assets',
      ],
    },
  ];
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
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const { roleName, roleBadgeColor } = useRolePermissions();

  const rawRole = roleName || user?.role || role || 'Staff';
  const displayRole = rawRole.toUpperCase();
  const badgeColor =
    roleBadgeColor && roleBadgeColor !== '#52171B' && roleBadgeColor !== '#1A1A1A'
      ? roleBadgeColor
      : '#D4AF37';

  const toggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setCollapsed(!collapsed);
    }
  };

  const currentCollapsed = onToggleCollapse !== undefined ? isCollapsed : collapsed;
  const groups = useMemo(() => getCategoryGroups(role), [role]);

  // Toggle single category accordion
  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleNavigate = (route: string) => {
    if (onCloseMobile) onCloseMobile();
    router.push(route as any);
  };

  // Filter items by search query if user is searching
  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const showExpanded = isMobileDrawer || !currentCollapsed;

    return (
      <View style={[styles.sidebarInner, isMobileDrawer && styles.sidebarInnerMobile]}>
        {/* CSS for Liquid Glass effects & Web Micro-interactions */}
        {Platform.OS === 'web' && (
          <style>{`
            .liquid-glass-sidebar {
              background: linear-gradient(180deg, rgba(56, 10, 17, 0.88) 0%, rgba(28, 4, 8, 0.94) 55%, rgba(18, 3, 5, 0.98) 100%) !important;
              backdrop-filter: blur(28px) saturate(180%) !important;
              -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
            }
            [data-nav="item"], .sidebar-nav-item {
              transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
              cursor: pointer !important;
            }
            [data-nav="item"]:hover:not(.sidebar-nav-active) {
              background: rgba(212, 175, 55, 0.12) !important;
              border-color: rgba(212, 175, 55, 0.3) !important;
              transform: translateX(4px) !important;
            }
            .sidebar-search-input:focus {
              border-color: rgba(243, 209, 121, 0.75) !important;
              box-shadow: 0 0 16px rgba(212, 175, 55, 0.28) !important;
            }
            .liquid-glass-card {
              background: rgba(255, 255, 255, 0.05) !important;
              backdrop-filter: blur(16px) !important;
              -webkit-backdrop-filter: blur(16px) !important;
            }
            .liquid-glass-active-pill {
              background: linear-gradient(135deg, #F3D179 0%, #D4AF37 50%, #B8860B 100%) !important;
              box-shadow: 0 4px 20px rgba(212, 175, 55, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
            }
            .sidebar-scroll::-webkit-scrollbar {
              width: 4px;
            }
            .sidebar-scroll::-webkit-scrollbar-thumb {
              background: rgba(212, 175, 55, 0.22);
              border-radius: 4px;
            }
            .sidebar-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(212, 175, 55, 0.45);
            }
          `}</style>
        )}

        {/* 1. BRAND HEADER (Liquid Glass Glow Header) */}
        {showExpanded ? (
          <View style={styles.brandHeader}>
            <TouchableOpacity 
              style={styles.brandRow} 
              activeOpacity={0.8}
              onPress={() => handleNavigate(role === 'admin' ? '/admin/dashboard' : '/manager/dashboard')}
            >
              <View style={styles.logoGlassOrb}>
                <SultanLogo size="sm" width={32} height={32} />
                <View style={styles.orbGlowOverlay} />
              </View>
              <View style={styles.brandTextCol}>
                <View style={styles.brandTitleRow}>
                  <Text style={styles.brandTitle}>KANAF</Text>
                  <View
                    style={[
                      styles.roleTagGlass,
                      badgeColor !== '#D4AF37' && {
                        backgroundColor: badgeColor + '22',
                        borderColor: badgeColor + '66',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleTagText,
                        badgeColor !== '#D4AF37' && { color: badgeColor },
                      ]}
                    >
                      {displayRole}
                    </Text>
                  </View>
                </View>
                <Text style={styles.brandSubtitle}>Cafe & Bakery Operations</Text>
              </View>
            </TouchableOpacity>

            {/* Action icon: Close for Mobile Drawer, Collapse for Desktop */}
            {isMobileDrawer ? (
              <TouchableOpacity onPress={onCloseMobile} style={styles.glassCircleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#FFE0CB" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={toggle} 
                style={styles.glassCircleBtn}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={16} 
                  color="#FFE0CB" 
                />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.brandHeader, styles.brandHeaderCollapsed]}>
            <TouchableOpacity 
              onPress={toggle} 
              style={styles.collapsedBrandToggle}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? ({ title: 'Expand Sidebar' } as any) : {})}
            >
              <View style={styles.logoGlassOrbCollapsed}>
                <SultanLogo size="xs" width={28} height={28} />
                <View style={styles.collapsedExpandBadge}>
                  <Ionicons name="chevron-forward" size={10} color="#440112" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. USER PROFILE LIQUID CAPSULE */}
        {showExpanded ? (
          <View style={styles.userCardGlass}>
            <View style={styles.avatarGlowCircle}>
              <Text style={styles.avatarText}>{(user?.name || displayRole)[0].toUpperCase()}</Text>
              <View style={styles.onlineBeaconLive} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || displayRole}</Text>
              <View style={styles.userStatusRow}>
                <View style={styles.statusDotLive} />
                <Text style={styles.userStatusText}>Cloud Synced • Live</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.userCardCollapsed}>
            <View style={styles.avatarGlowCircleSmall}>
              <Text style={styles.avatarTextSmall}>{(user?.name || displayRole)[0].toUpperCase()}</Text>
              <View style={styles.onlineBeaconLiveSmall} />
            </View>
          </View>
        )}

        {/* 3. QUICK SEARCH & FILTER BAR (Managed Navigation) */}
        {showExpanded && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBarGlass}>
              <Ionicons name="search-outline" size={14} color="rgba(243, 209, 121, 0.7)" style={{ marginRight: 8 }} />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Search screens..."
                placeholderTextColor="rgba(255, 255, 255, 0.38)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {isSearching && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={15} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 4. PROPERLY CATEGORIZED NAVIGATION ITEMS */}
        <ScrollView 
          style={styles.navScrollView} 
          contentContainerStyle={styles.navScrollContent}
          showsVerticalScrollIndicator={false}
          {...({ dataSet: { sidebarScroll: 'true' } } as any)}
        >
          {groups.map((group) => {
            const groupItemsList = items.filter(it => {
              const inGroup = group.routes.includes(it.route);
              if (!inGroup) return false;
              if (isSearching) {
                return it.label.toLowerCase().includes(normalizedQuery);
              }
              return true;
            });

            if (groupItemsList.length === 0) return null;

            // Check if active route is in this category to keep it open
            const hasActiveRoute = group.routes.some(r => pathname === r);
            const isGroupCollapsed = showExpanded && !isSearching && !!collapsedCategories[group.id] && !hasActiveRoute;

            return (
              <View key={group.id} style={styles.groupCardSection}>
                {/* Category Header with Glass Glow & Item Count */}
                {showExpanded ? (
                  <TouchableOpacity 
                    style={styles.groupHeaderRow} 
                    onPress={() => toggleCategory(group.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.groupHeaderLeft}>
                      <View style={styles.groupIconSphere}>
                        <Ionicons name={group.icon} size={12} color="#F3D179" />
                      </View>
                      <Text style={styles.groupHeaderTitle}>{group.title}</Text>
                    </View>
                    <View style={styles.groupHeaderRight}>
                      <View style={styles.groupCountPill}>
                        <Text style={styles.groupCountText}>{groupItemsList.length}</Text>
                      </View>
                      <Ionicons 
                        name={isGroupCollapsed ? 'chevron-down' : 'chevron-up'} 
                        size={12} 
                        color="rgba(243, 209, 121, 0.65)" 
                        style={{ marginLeft: 4 }}
                      />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.groupDividerMini} />
                )}

                {/* Items in this category */}
                {!isGroupCollapsed && groupItemsList.map((item, iIdx) => {
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
                      activeOpacity={0.8}
                      {...({ dataSet: { nav: 'item' } } as any)}
                    >
                      {/* Active liquid highlight bar */}
                      {isActive && <View style={styles.activeIndicatorLiquidBar} />}

                      <View style={[styles.navIconBox, isActive && styles.navIconBoxActive]}>
                        <Ionicons
                          name={item.icon}
                          size={showExpanded ? 18 : 20}
                          color={isActive ? '#200408' : '#F3D179'}
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
                            <View style={[styles.itemBadgeGlass, isActive && styles.itemBadgeGlassActive]}>
                              <Text style={[styles.itemBadgeText, isActive && styles.itemBadgeTextActive]}>
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {showExpanded && isActive && (
                        <Ionicons name="chevron-forward" size={13} color="#200408" style={styles.activeChevron} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {/* Any remaining unassigned items (Safety Net) */}
          {(() => {
            const allGroupedRoutes = groups.flatMap(g => g.routes);
            const unassignedItems = items.filter(it => {
              if (allGroupedRoutes.includes(it.route)) return false;
              if (isSearching) {
                return it.label.toLowerCase().includes(normalizedQuery);
              }
              return true;
            });
            if (unassignedItems.length === 0) return null;

            return (
              <View style={styles.groupCardSection}>
                {showExpanded ? (
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupHeaderLeft}>
                      <View style={styles.groupIconSphere}>
                        <Ionicons name="apps-outline" size={12} color="#F3D179" />
                      </View>
                      <Text style={styles.groupHeaderTitle}>OTHER OPERATIONS</Text>
                    </View>
                    <View style={styles.groupCountPill}>
                      <Text style={styles.groupCountText}>{unassignedItems.length}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.groupDividerMini} />
                )}

                {unassignedItems.map((item, iIdx) => {
                  const isActive = pathname === item.route;
                  return (
                    <TouchableOpacity
                      key={`unassigned-${iIdx}`}
                      style={[
                        styles.navItem,
                        !showExpanded && styles.navItemCollapsed,
                        isActive && styles.navItemActive,
                      ]}
                      onPress={() => handleNavigate(item.route)}
                      activeOpacity={0.8}
                      {...({ dataSet: { nav: 'item' } } as any)}
                    >
                      {isActive && <View style={styles.activeIndicatorLiquidBar} />}

                      <View style={[styles.navIconBox, isActive && styles.navIconBoxActive]}>
                        <Ionicons
                          name={item.icon}
                          size={showExpanded ? 18 : 20}
                          color={isActive ? '#200408' : '#F3D179'}
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
                            <View style={[styles.itemBadgeGlass, isActive && styles.itemBadgeGlassActive]}>
                              <Text style={[styles.itemBadgeText, isActive && styles.itemBadgeTextActive]}>
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {showExpanded && isActive && (
                        <Ionicons name="chevron-forward" size={13} color="#200408" style={styles.activeChevron} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>

        {/* 5. FOOTER QUICK ACTION & LOGOUT (Liquid Glass) */}
        <View style={[styles.sidebarFooterGlass, !showExpanded && styles.sidebarFooterCollapsed]}>
          {/* Quick POS Terminal Shortcut CTA */}
          <TouchableOpacity
            style={[
              styles.quickPosGlassBtn,
              !showExpanded && styles.quickPosBtnCollapsed,
            ]}
            onPress={() => handleNavigate(role === 'admin' ? '/admin/pos' : '/manager/pos')}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={16} color="#200408" />
            {showExpanded && <Text style={styles.quickPosBtnText}>Launch POS Terminal</Text>}
          </TouchableOpacity>

          {/* Logout Action */}
          <TouchableOpacity
            style={[
              styles.logoutGlassBtn,
              !showExpanded && styles.logoutBtnCollapsed,
            ]}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={17} color="#EF4444" />
            {showExpanded && <Text style={styles.logoutBtnText}>Sign Out</Text>}
          </TouchableOpacity>

          {showExpanded && (
            <Text style={styles.versionStamp}>SULTAN CLOUD POS • v2.5</Text>
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
    width: 275,
    backgroundColor: '#1E0408',
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.25)',
    zIndex: 100,
    height: '100%',
    ...Platform.select({
      web: {
        transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundImage: 'linear-gradient(180deg, rgba(56, 10, 17, 0.9) 0%, rgba(30, 4, 8, 0.94) 55%, rgba(18, 3, 5, 0.98) 100%)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
      } as any,
    }),
  },
  desktopSidebarCollapsed: {
    width: 78,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    width: 295,
    maxWidth: '85%',
    backgroundColor: '#1E0408',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.28)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, rgba(56, 10, 17, 0.92) 0%, rgba(26, 4, 8, 0.97) 100%)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
      } as any,
    }),
  },

  // 1. Brand Header
  brandHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 224, 203, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  brandHeaderCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedBrandToggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlassOrbCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 224, 203, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 0 16px rgba(255, 224, 203, 0.25)',
      } as any,
    }),
  },
  collapsedExpandBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFE0CB',
    borderWidth: 1.5,
    borderColor: '#440112',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoGlassOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 224, 203, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 0 16px rgba(255, 224, 203, 0.3)',
      } as any,
    }),
  },
  orbGlowOverlay: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 224, 203, 0.2)',
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
    color: '#FFE0CB',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  roleTagGlass: {
    backgroundColor: 'rgba(255, 224, 203, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 203, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  roleTagText: {
    color: '#FFE0CB',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    color: 'rgba(255, 224, 203, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  glassCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 203, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. User Profile Card (Liquid Glass Capsule)
  userCardGlass: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      } as any,
    }),
  },
  userCardCollapsed: {
    marginVertical: 12,
    alignItems: 'center',
  },
  avatarGlowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
      } as any,
    }),
  },
  avatarGlowCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
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
  onlineBeaconLive: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1E0408',
  },
  onlineBeaconLiveSmall: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#1E0408',
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
  statusDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  userStatusText: {
    color: 'rgba(243, 209, 121, 0.7)',
    fontSize: 10,
    fontWeight: '600',
  },

  // 3. Search Bar
  searchContainer: {
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  searchBarGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      } as any,
    }),
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    padding: 0,
    fontWeight: '500',
  },

  // 4. Group Section & Navigation Items
  navScrollView: {
    flex: 1,
  },
  navScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 20,
  },
  groupCardSection: {
    marginBottom: 12,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 3,
    borderRadius: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  groupIconSphere: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeaderTitle: {
    color: 'rgba(243, 209, 121, 0.85)',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCountPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  groupCountText: {
    color: '#F3D179',
    fontSize: 9,
    fontWeight: '800',
  },
  groupDividerMini: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    marginHorizontal: 12,
    marginVertical: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8.5,
    paddingHorizontal: 11,
    borderRadius: 10,
    marginBottom: 2.5,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  navItemActive: {
    backgroundColor: '#D4AF37',
    borderWidth: 1,
    borderColor: '#F3D179',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #F3D179 0%, #D4AF37 50%, #B8860B 100%)',
        boxShadow: '0 4px 18px rgba(212, 175, 55, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      } as any,
    }),
  },
  activeIndicatorLiquidBar: {
    position: 'absolute',
    left: 0,
    top: 5,
    bottom: 5,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#200408',
  },
  navIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: {
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
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#200408',
    fontWeight: '900',
  },
  activeChevron: {
    marginLeft: 4,
    opacity: 0.8,
  },
  itemBadgeGlass: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  itemBadgeGlassActive: {
    backgroundColor: 'rgba(32, 4, 8, 0.25)',
    borderColor: '#200408',
  },
  itemBadgeText: {
    color: '#F3D179',
    fontSize: 9,
    fontWeight: '900',
  },
  itemBadgeTextActive: {
    color: '#200408',
  },

  // 5. Liquid Glass Footer
  sidebarFooterGlass: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.18)',
    gap: 8,
    backgroundColor: 'rgba(15, 2, 4, 0.45)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
    }),
  },
  sidebarFooterCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quickPosGlassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#F3D179',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #F3D179 0%, #D4AF37 55%, #B8860B 100%)',
        boxShadow: '0 4px 18px rgba(212, 175, 55, 0.45)',
        cursor: 'pointer',
      } as any,
    }),
  },
  quickPosBtnCollapsed: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 12,
  },
  quickPosBtnText: {
    color: '#200408',
    fontWeight: '900',
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  logoutGlassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  logoutBtnCollapsed: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },
  versionStamp: {
    color: 'rgba(243, 209, 121, 0.55)',
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
