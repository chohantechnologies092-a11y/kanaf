import React from 'react';
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
  group: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: DashboardAction[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  
  const invoices = useRestaurantStore(state => state.invoices);
  const tickets = useRestaurantStore(state => state.tickets);
  const tables = useRestaurantStore(state => state.tables);
  const customers = useRestaurantStore(state => state.customers);

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todaysInvoices = invoices.filter(inv => inv.status !== 'voided' && (inv.timeSettled || inv.timePlaced) >= today.getTime());
  const todaysSales = todaysInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const activeOrders = tickets.length;
  const activeTables = tables.filter(t => t.status !== 'available').length;

  const STATS = [
    { label: "Today's Sales", value: `Rs. ${todaysSales.toLocaleString()}`, trend: `${todaysInvoices.length} Orders`, icon: 'cash-outline' as const },
    { label: 'Active Orders', value: activeOrders.toString(), trend: 'In Kitchen (KOT)', icon: 'restaurant-outline' as const },
    { label: 'Occupied Tables', value: `${activeTables}/${tables.length}`, trend: 'Dine-In Area', icon: 'grid-outline' as const },
    { label: 'Total Diners', value: customers.length.toString(), trend: 'Registered CRM', icon: 'people-outline' as const },
  ];

  const ACTION_GROUPS: DashboardGroup[] = [
    {
      group: 'Front of House & Dine-In',
      icon: 'restaurant-outline' as const,
      color: '#4a121a',
      items: [
        {
          title: 'POS Terminal',
          desc: 'Instant billing, punch orders, takeaway & split payments.',
          icon: 'calculator-outline' as const,
          route: '/admin/pos',
          color: '#2E7D32',
          badge: 'ACTIVE POS',
        },
        {
          title: 'Invoices & Orders',
          desc: 'Customer bills, order audit logs, reprint & void records.',
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
          desc: 'Live floor plan, dining tables, couches & majlis status.',
          icon: 'grid-outline' as const,
          route: '/admin/tables',
          color: '#D5A943',
        },
        {
          title: 'Floor Management',
          desc: 'Manage floors, level prefixes, codes & themes.',
          icon: 'layers-outline' as const,
          route: '/admin/floors',
          color: '#1976D2',
        },
        {
          title: 'Customer CRM',
          desc: 'VIP diner history, phone directory & visit frequency.',
          icon: 'person-outline' as const,
          route: '/admin/customers',
          color: '#6A1B9A',
        },
      ],
    },
    {
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
          desc: 'Store inventory par levels, requisition drafting & chef cash.',
          icon: 'clipboard-outline' as const,
          route: '/admin/kitchen-handover',
          color: '#E65100',
        },
        {
          title: 'Recipe BOM & Grams',
          desc: 'Exact gram weights, spice formulations & food cost per dish.',
          icon: 'restaurant-outline' as const,
          route: '/admin/recipes',
          color: '#D5A943',
        },
        {
          title: 'EOD Returns & Restock',
          desc: 'Reconcile chef closing counts, audit variances & approve restock.',
          icon: 'checkmark-done-circle-outline' as const,
          route: '/admin/kitchen-returns',
          color: '#2E7D32',
        },
      ],
    },
    {
      group: 'Inventory, Procurement & Control',
      icon: 'cube-outline' as const,
      color: '#00897B',
      items: [
        {
          title: 'Menu Catalog',
          desc: 'Manage categories, item pricing, dietary tags & pictures.',
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
          desc: 'Procurement ledgers, PO invoicing, payment tracking & dues.',
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
      group: 'Management, Finance & Shifts',
      icon: 'bar-chart-outline' as const,
      color: '#2E7D32',
      items: [
        {
          title: 'Financial Reports',
          desc: 'Sales analytics, P&L statements, CSV exports & Z-reports.',
          icon: 'bar-chart-outline' as const,
          route: '/admin/reports',
          color: '#2E7D32',
        },
        {
          title: 'Live Shift & Register',
          desc: 'Reconcile cash drawers, record drop floats & shift reports.',
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

  return (
    <ScrollView style={[styles.container, isMobile && styles.containerMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SultanLogo size="md" variant="circle" width={32} height={32} containerStyle={{ width: 48, height: 48, borderRadius: 24 }} />
              <View>
                <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Executive Dashboard</Text>
                <Text style={styles.pageSubtitle}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </View>
            </View>

            <View style={styles.onlineBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.onlineBadgeText}>Realtime Hub Active</Text>
            </View>
          </View>
        </View>
        
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, idx) => (
            <View key={idx} style={[styles.statCard, isMobile && styles.statCardMobile]}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(213, 169, 67, 0.15)' }]}>
                  <Ionicons name={stat.icon} size={16} color="#4a121a" />
                </View>
              </View>
              <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>{stat.value}</Text>
              <View style={styles.trendRow}>
                <Ionicons name="sparkles" size={11} color="#D5A943" />
                <Text style={styles.statTrend}>{stat.trend}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Categorized Action Groups */}
        {ACTION_GROUPS.map((group, gIdx) => (
          <View key={gIdx} style={styles.groupSection}>
            <View style={styles.groupHeaderRow}>
              <View style={[styles.groupIconCircle, { backgroundColor: group.color + '18' }]}>
                <Ionicons name={group.icon} size={16} color={group.color} />
              </View>
              <Text style={styles.groupTitle}>{group.group}</Text>
              <View style={styles.groupCountBadge}>
                <Text style={styles.groupCountText}>{group.items.length}</Text>
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
                  activeOpacity={0.76}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <View style={styles.actionInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <Text style={styles.actionTitle}>{action.title}</Text>
                      {action.badge && (
                        <View style={[styles.actionTagBadge, { backgroundColor: action.color + '18' }]}>
                          <Text style={[styles.actionTagText, { color: action.color }]}>{action.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actionDesc} numberOfLines={2}>{action.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F8F9FA',
  },
  containerMobile: {
    padding: 14,
  },
  content: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  pageTitleMobile: {
    fontSize: 22,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardMobile: {
    flex: undefined,
    width: '48%',
    minWidth: '47%',
    padding: 14,
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4a121a', // Sultan Burgundy
    marginBottom: 4,
  },
  statValueMobile: {
    fontSize: 18,
  },
  statTrend: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCardDesktop: {
    width: '48%',
    padding: 20,
  },
  actionCardMobile: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  actionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 3,
  },
  actionDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderColor: 'rgba(39, 174, 96, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#27ae60',
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27ae60',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  groupSection: {
    marginBottom: 24,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  groupIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  groupCountBadge: {
    backgroundColor: '#EFEFF4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#636366',
  },
  actionTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
