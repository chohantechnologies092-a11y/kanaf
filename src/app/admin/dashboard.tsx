import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  useWindowDimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore } from '../../store/restaurantStore';
import SultanLogo from '../../components/SultanLogo';

interface DashboardAction {
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  badge?: string;
}

interface DashboardGroup {
  id: string;
  group: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: DashboardAction[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1100;
  
  const invoices = useRestaurantStore(state => state.invoices);
  const tickets = useRestaurantStore(state => state.tickets);
  const tables = useRestaurantStore(state => state.tables);
  const customers = useRestaurantStore(state => state.customers);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todaysInvoices = invoices.filter(inv => inv.status !== 'voided' && (inv.timeSettled || inv.timePlaced) >= today.getTime());
  const todaysSales = todaysInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const activeOrders = tickets.length;
  const occupiedTables = tables.filter(t => t.status === 'occupied' || t.status === 'billed').length;
  const occupancyRate = tables.length > 0 ? Math.round((occupiedTables / tables.length) * 100) : 0;

  const STATS = [
    { 
      label: "Today's Revenue", 
      value: `Rs. ${todaysSales.toLocaleString()}`, 
      subtext: `${todaysInvoices.length} Settled Invoices`, 
      icon: 'cash-outline' as const,
      color: '#D5A943',
      bgGlow: '#4A121A',
      trend: '+ Live Sync'
    },
    { 
      label: 'Kitchen KDS Load', 
      value: `${activeOrders} Active`, 
      subtext: activeOrders > 0 ? 'Tickets in Preparation' : 'All Orders Dispatched', 
      icon: 'flame-outline' as const,
      color: '#E65100',
      bgGlow: '#FF6F00',
      trend: activeOrders > 3 ? '⚡ High Rush' : 'Normal Flow'
    },
    { 
      label: 'Dine-In Occupancy', 
      value: `${occupiedTables} / ${tables.length}`, 
      subtext: `${occupancyRate}% Floor Capacity Occupied`, 
      icon: 'restaurant-outline' as const,
      color: '#27AE60',
      bgGlow: '#2E7D32',
      trend: `${tables.length - occupiedTables} Tables Free`
    },
    { 
      label: 'Registered Diners', 
      value: customers.length.toString(), 
      subtext: 'Loyalty & VIP Profiles', 
      icon: 'people-outline' as const,
      color: '#8E44AD',
      bgGlow: '#6C3483',
      trend: 'CRM Database'
    },
  ];

  const ACTION_GROUPS: DashboardGroup[] = [
    {
      id: 'foh',
      group: 'Front of House & Dine-In',
      icon: 'restaurant-outline' as const,
      color: '#4a121a',
      items: [
        {
          title: 'POS Terminal',
          desc: 'Instant touch billing, punch orders, takeaway & split payments.',
          icon: 'calculator-outline' as const,
          route: '/admin/pos',
          color: '#27AE60',
          badge: 'ACTIVE POS',
        },
        {
          title: 'Invoices & Orders',
          desc: 'Customer bills, order audit logs, thermal reprint & void records.',
          icon: 'receipt-outline' as const,
          route: '/admin/invoices',
          color: '#4a121a',
        },
        {
          title: 'Sales Returns & Refunds',
          desc: 'Customer cancellations, item returns, culinary waste & refunds.',
          icon: 'return-down-back-outline' as const,
          route: '/admin/returns',
          color: '#C62828',
        },
        {
          title: 'Tables & Cabins Blueprint',
          desc: 'Interactive live floor plan, dining tables, couches & majlis cabins.',
          icon: 'grid-outline' as const,
          route: '/admin/tables',
          color: '#D5A943',
        },
        {
          title: 'Floor Management',
          desc: 'Configure restaurant floors, level prefixes, codes & custom themes.',
          icon: 'layers-outline' as const,
          route: '/admin/floors',
          color: '#1976D2',
        },
        {
          title: 'Customer CRM',
          desc: 'VIP diner history, phone directory & visit frequency.',
          icon: 'person-outline' as const,
          route: '/admin/customers',
          color: '#8E44AD',
        },
      ],
    },
    {
      id: 'kitchen',
      group: 'Kitchen & Beverage Operations',
      icon: 'flame-outline' as const,
      color: '#C62828',
      items: [
        {
          title: 'Chef Day Console',
          desc: 'Live on-hand inventory, taste/masala ± adjustments & market cash buys.',
          icon: 'flame-outline' as const,
          route: '/kitchen/day',
          color: '#C62828',
          badge: 'LIVE',
        },
        {
          title: 'Kitchen Handover & Requisition',
          desc: 'Store inventory par levels, requisition drafting & chef hand cash.',
          icon: 'clipboard-outline' as const,
          route: '/admin/kitchen-handover',
          color: '#E65100',
        },
        {
          title: 'Recipe BOM & Grams',
          desc: 'Exact gram weights, spices, wastage % and food cost per dish.',
          icon: 'restaurant-outline' as const,
          route: '/admin/recipes',
          color: '#D5A943',
        },
        {
          title: 'EOD Returns & Restock',
          desc: 'Reconcile chef closing counts, audit variances & approve restock.',
          icon: 'checkmark-done-circle-outline' as const,
          route: '/admin/kitchen-returns',
          color: '#27AE60',
        },
      ],
    },
    {
      id: 'inventory',
      group: 'Inventory, Procurement & Control',
      icon: 'cube-outline' as const,
      color: '#00897B',
      items: [
        {
          title: 'Menu Catalog',
          desc: 'Manage categories, item pricing, dietary tags & dish pictures.',
          icon: 'fast-food-outline' as const,
          route: '/admin/menu',
          color: '#4a121a',
        },
        {
          title: 'Inventory & Stock',
          desc: 'Raw ingredient tracking, low stock alerts & reorder levels.',
          icon: 'cube-outline' as const,
          route: '/admin/inventory',
          color: '#00897B',
        },
        {
          title: 'Suppliers & Vendors',
          desc: 'Procurement ledgers, PO invoicing, payment vouchers & dues.',
          icon: 'bus-outline' as const,
          route: '/admin/suppliers',
          color: '#1565C0',
        },
        {
          title: 'Dish Costing & Profit Margins',
          desc: 'Live food cost engine, target margins & 1-tap price optimizer.',
          icon: 'calculator-outline' as const,
          route: '/admin/costing',
          color: '#D5A943',
        },
      ],
    },
    {
      id: 'finance',
      group: 'Management, Finance & Shifts',
      icon: 'bar-chart-outline' as const,
      color: '#27AE60',
      items: [
        {
          title: 'Financial Reports',
          desc: 'Sales analytics, P&L statements, CSV exports & Z-reports.',
          icon: 'bar-chart-outline' as const,
          route: '/admin/reports',
          color: '#27AE60',
        },
        {
          title: 'Live Shift & Register',
          desc: 'Reconcile drawer cash, record drop floats & generate X/Z slips.',
          icon: 'cash-outline' as const,
          route: '/manager/shift',
          color: '#4a121a',
        },
        {
          title: 'Daily Expenses & Live P&L',
          desc: 'Track restaurant purchases, cash outflows & net margin.',
          icon: 'wallet-outline' as const,
          route: '/admin/expenses',
          color: '#C2185B',
        },
        {
          title: 'Business Insights & Trends',
          desc: 'Floor revenue breakdown, rush hour patterns & top sellers.',
          icon: 'trending-up-outline' as const,
          route: '/admin/insights',
          color: '#0288D1',
        },
        {
          title: 'Staff & Roles',
          desc: 'Employee credentials, PIN security & shift attendance.',
          icon: 'people-outline' as const,
          route: '/admin/staff',
          color: '#5D4037',
        },
        {
          title: 'Playland Hub & Invoices',
          desc: 'Ticket sales invoices, rides & variant pricing.',
          icon: 'color-palette-outline' as const,
          route: '/admin/playland',
          color: '#E91E63',
        },
      ],
    },
  ];

  const filteredGroups = useMemo(() => {
    if (selectedCategory === 'all') return ACTION_GROUPS;
    return ACTION_GROUPS.filter(g => g.id === selectedCategory);
  }, [selectedCategory, ACTION_GROUPS]);

  const totalActionsCount = ACTION_GROUPS.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <ScrollView style={[styles.container, isMobile && styles.containerMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>

        {/* ================= ROYAL HERO EXECUTIVE BANNER ================= */}
        <View style={[styles.heroBanner, isMobile && styles.heroBannerMobile]}>
          <View style={styles.heroTopBar} />
          
          <View style={styles.heroMainRow}>
            <View style={styles.heroLeft}>
              <View style={styles.heroBrandRow}>
                <SultanLogo 
                  size="md" 
                  variant="circle" 
                  width={34} 
                  height={34} 
                  containerStyle={styles.heroLogoContainer} 
                />
                <View>
                  <View style={styles.brandTitleRow}>
                    <Text style={styles.heroBrandTag}>SULTAN RESTAURANT & RESORT</Text>
                    <View style={styles.royalCrownBadge}>
                      <Ionicons name="sparkles" size={10} color="#D5A943" />
                      <Text style={styles.royalCrownText}>EXECUTIVE</Text>
                    </View>
                  </View>
                  <Text style={[styles.heroHeading, isMobile && styles.heroHeadingMobile]}>
                    Operational Command Hub
                  </Text>
                </View>
              </View>

              <Text style={styles.heroSubtitle}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • Multi-Zone Operations Center
              </Text>
            </View>

            <View style={[styles.heroRight, isMobile && styles.heroRightMobile]}>
              <View style={styles.onlineStatusBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.onlineStatusText}>REALTIME ACTIVE</Text>
              </View>

              {/* 1-Tap Quick POS Launch */}
              <TouchableOpacity 
                style={styles.heroPosBtn}
                onPress={() => router.push('/admin/pos')}
                activeOpacity={0.88}
              >
                <Ionicons name="flash" size={16} color="#4A121A" />
                <Text style={styles.heroPosBtnText}>Open POS Terminal</Text>
                <Ionicons name="arrow-forward" size={14} color="#4A121A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mini Operational Vitals Ticker */}
          <View style={styles.heroTickerRow}>
            <View style={styles.tickerPill}>
              <Ionicons name="restaurant" size={12} color="#D5A943" />
              <Text style={styles.tickerText}>
                <Text style={styles.tickerBold}>{occupiedTables}</Text> Dine-In Tables Active
              </Text>
            </View>
            <View style={styles.tickerDivider} />
            <View style={styles.tickerPill}>
              <Ionicons name="flame" size={12} color="#FF7043" />
              <Text style={styles.tickerText}>
                <Text style={styles.tickerBold}>{activeOrders}</Text> KOT Tickets Cooking
              </Text>
            </View>
            <View style={styles.tickerDivider} />
            <View style={styles.tickerPill}>
              <Ionicons name="cash" size={12} color="#81C784" />
              <Text style={styles.tickerText}>
                <Text style={styles.tickerBold}>{todaysInvoices.length}</Text> Orders Settled Today
              </Text>
            </View>
          </View>
        </View>

        {/* ================= STATS / KPI GRID ================= */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, idx) => (
            <View key={idx} style={[styles.statCard, isMobile ? styles.statCardMobile : isTablet ? styles.statCardTablet : styles.statCardDesktop]}>
              {/* Top Accent Strip */}
              <View style={[styles.statAccentLine, { backgroundColor: stat.color }]} />

              <View style={styles.statTopRow}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <View style={[styles.statIconCircle, { backgroundColor: stat.color + '18', borderColor: stat.color + '35' }]}>
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                </View>
              </View>

              <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>{stat.value}</Text>

              <View style={styles.statFooterRow}>
                <Text style={styles.statSubtext} numberOfLines={1}>{stat.subtext}</Text>
                <View style={[styles.trendBadge, { backgroundColor: stat.color + '15' }]}>
                  <Text style={[styles.trendText, { color: stat.color }]}>{stat.trend}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ================= CATEGORY QUICK FILTER TABS ================= */}
        <View style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="apps" size={18} color="#4A121A" />
              <Text style={styles.categorySectionTitle}>Management Suites</Text>
            </View>
            <Text style={styles.categoryCountLabel}>{totalActionsCount} Total Operational Modules</Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContainer}
          >
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'all' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('all')}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="grid" 
                size={14} 
                color={selectedCategory === 'all' ? '#D5A943' : '#636366'} 
              />
              <Text style={[styles.categoryTabText, selectedCategory === 'all' && styles.categoryTabTextActive]}>
                All Suites ({totalActionsCount})
              </Text>
            </TouchableOpacity>

            {ACTION_GROUPS.map((group) => {
              const isActive = selectedCategory === group.id;
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.categoryTab, 
                    isActive && styles.categoryTabActive,
                    isActive && { borderColor: group.color }
                  ]}
                  onPress={() => setSelectedCategory(group.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={group.icon} 
                    size={14} 
                    color={isActive ? group.color : '#636366'} 
                  />
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {group.group} ({group.items.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ================= CATEGORIZED ACTION GROUPS ================= */}
        {filteredGroups.map((group) => (
          <View key={group.id} style={styles.groupSection}>
            <View style={styles.groupHeaderRow}>
              <View style={[styles.groupIconCircle, { backgroundColor: group.color + '15', borderColor: group.color + '30' }]}>
                <Ionicons name={group.icon} size={18} color={group.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupTitle}>{group.group}</Text>
                <Text style={styles.groupSubtitle}>Direct executive access & operations</Text>
              </View>
              <View style={[styles.groupCountBadge, { backgroundColor: group.color + '15' }]}>
                <Text style={[styles.groupCountText, { color: group.color }]}>{group.items.length} Modules</Text>
              </View>
            </View>

            <View style={styles.actionsGrid}>
              {group.items.map((action, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={[
                    styles.actionCard,
                    isMobile ? styles.actionCardMobile : styles.actionCardDesktop
                  ]}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.78}
                >
                  {/* Subtle Accent Stripe on Left or Top */}
                  <View style={[styles.cardAccentBar, { backgroundColor: action.color }]} />

                  <View style={[styles.actionIconBadge, { backgroundColor: action.color + '12', borderColor: action.color + '25' }]}>
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>

                  <View style={styles.actionInfo}>
                    <View style={styles.actionTitleRow}>
                      <Text style={styles.actionTitle}>{action.title}</Text>
                      {action.badge && (
                        <View style={[styles.actionTagBadge, { backgroundColor: action.color + '18', borderColor: action.color + '40' }]}>
                          <Text style={[styles.actionTagText, { color: action.color }]}>{action.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actionDesc} numberOfLines={2}>{action.desc}</Text>
                  </View>

                  <View style={styles.cardArrowBox}>
                    <Ionicons name="chevron-forward" size={16} color="#A0A0A5" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Footer Brand Note */}
        <View style={styles.dashboardFooter}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <Ionicons name="shield-checkmark" size={14} color="#D5A943" />
            <Text style={styles.footerText}>
              Sultan Restaurant & Resort Enterprise ERP • Version 1.0.0
            </Text>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 22,
    backgroundColor: '#F5F5F7', // Apple clean background
  },
  containerMobile: {
    padding: 12,
  },
  content: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },

  /* ================= HERO EXECUTIVE BANNER ================= */
  heroBanner: {
    backgroundColor: '#350C12', // Deep Royal Sultan Burgundy
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#D5A943', // Royal Gold Border
    shadowColor: '#350C12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  heroBannerMobile: {
    borderRadius: 16,
    marginBottom: 16,
  },
  heroTopBar: {
    height: 4,
    backgroundColor: '#D5A943', // Gold Accent line
  },
  heroMainRow: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  heroLeft: {
    flex: 1,
    minWidth: 280,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  heroLogoContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#4A121A',
    borderColor: '#D5A943',
    borderWidth: 1.5,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBrandTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D5A943',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  royalCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(213, 169, 67, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  royalCrownText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#D5A943',
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  heroHeadingMobile: {
    fontSize: 20,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#E0D0B5',
    fontWeight: '500',
    marginTop: 2,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroRightMobile: {
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  onlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.18)',
    borderColor: '#27AE60',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
  },
  onlineStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2ECC71',
    letterSpacing: 0.8,
  },
  heroPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D5A943',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  heroPosBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A121A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTickerRow: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(213, 169, 67, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  tickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tickerText: {
    fontSize: 11,
    color: '#ECE5D8',
    fontWeight: '500',
  },
  tickerBold: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tickerDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  /* ================= STATS / KPI GRID ================= */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8EE',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  statCardDesktop: {
    flex: 1,
    minWidth: 240,
  },
  statCardTablet: {
    width: '48%',
  },
  statCardMobile: {
    width: '48%',
    padding: 12,
  },
  statAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  statValueMobile: {
    fontSize: 18,
  },
  statFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  statSubtext: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    flex: 1,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* ================= CATEGORY TABS ================= */
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  categoryCountLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryTabActive: {
    backgroundColor: '#350C12', // Sultan Burgundy
    borderColor: '#D5A943',
    borderWidth: 1.5,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* ================= GROUP SECTIONS & ACTION CARDS ================= */
  groupSection: {
    marginBottom: 26,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  groupIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  groupSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  groupCountBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '800',
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  actionCardDesktop: {
    width: '49%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  actionCardMobile: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  cardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  actionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 2,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  actionTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionDesc: {
    fontSize: 12,
    color: '#6E6E73',
    lineHeight: 16,
    fontWeight: '500',
  },
  cardArrowBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ================= FOOTER ================= */
  dashboardFooter: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
  },
});
