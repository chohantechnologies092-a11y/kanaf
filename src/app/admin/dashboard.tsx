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

  const ACTIONS = [
    {
      title: 'POS Terminal',
      desc: 'Punch orders, takeaway, delivery & instant billing.',
      icon: 'calculator-outline' as const,
      route: '/admin/pos',
      color: '#D5A943'
    },
    {
      title: 'Invoices & Orders',
      desc: 'All customer bills, order details, reprint & void records.',
      icon: 'receipt-outline' as const,
      route: '/admin/invoices',
      color: '#4a121a'
    },
    {
      title: 'Sales Returns & Refunds',
      desc: 'Customer order cancellations, item returns, culinary waste & refunds.',
      icon: 'return-down-back-outline' as const,
      route: '/admin/returns',
      color: '#C62828'
    },
    {
      title: 'Menu Catalog',
      desc: 'Add or edit categories, items, and pricing.',
      icon: 'restaurant-outline' as const,
      route: '/admin/menu',
      color: '#4a121a'
    },
    {
      title: 'Staff & Roles',
      desc: 'Manage employee access, shifts, and PINs.',
      icon: 'people-outline' as const,
      route: '/admin/staff',
      color: '#D5A943'
    },
    {
      title: 'Financial Reports',
      desc: 'View sales analytics, export CSV & Z-reports.',
      icon: 'bar-chart-outline' as const,
      route: '/admin/reports',
      color: '#4a121a'
    },
    {
      title: 'Inventory & Stock',
      desc: 'Track raw ingredients and stock warning levels.',
      icon: 'cube-outline' as const,
      route: '/admin/inventory',
      color: '#D5A943'
    },
    {
      title: 'Suppliers & Vendors',
      desc: 'Procurement, vendor ledgers, PO bills & dues.',
      icon: 'bus-outline' as const,
      route: '/admin/suppliers',
      color: '#4a121a'
    },
    {
      title: 'Floor Management',
      desc: 'Add, edit, or delete restaurant floors, floor codes & themes.',
      icon: 'layers-outline' as const,
      route: '/admin/floors',
      color: '#2C3E50'
    },
    {
      title: 'Tables & Cabins Blueprint',
      desc: 'Manage dining tables, couches, majlis cabins & dine-in status.',
      icon: 'grid-outline' as const,
      route: '/admin/tables',
      color: '#4a121a'
    },
    {
      title: 'Customer CRM',
      desc: 'Manage VIP diners, phone logs, and addresses.',
      icon: 'person-outline' as const,
      route: '/admin/customers',
      color: '#D5A943'
    },
    {
      title: 'Live Shift & Register',
      desc: 'Reconcile drawer cash and generate X/Z slips.',
      icon: 'cash-outline' as const,
      route: '/manager/shift',
      color: '#4a121a'
    },
    {
      title: 'Business Insights & Trends',
      desc: 'Floor revenue breakdown, hourly rush patterns, top sellers.',
      icon: 'trending-up-outline' as const,
      route: '/admin/insights',
      color: '#D5A943'
    },
    {
      title: 'Daily Expenses & Live P&L',
      desc: 'Track restaurant purchases, cash outflows, and net margin.',
      icon: 'wallet-outline' as const,
      route: '/admin/expenses',
      color: '#4a121a'
    },
    {
      title: 'Kitchen Handover & Requisition',
      desc: 'Store inventory par levels, requisition drafting & chef hand cash handover.',
      icon: 'clipboard-outline' as const,
      route: '/admin/kitchen-handover',
      color: '#4a121a'
    },
    {
      title: 'Recipe BOM & Grams',
      desc: 'Exact gram weights, spices, wastage % and food cost per dish & variant.',
      icon: 'restaurant-outline' as const,
      route: '/admin/recipes',
      color: '#D5A943'
    },
    {
      title: 'Chef Day Console (Live)',
      desc: 'Live on-hand inventory, taste/masala ± adjustments & market cash buys.',
      icon: 'flame-outline' as const,
      route: '/kitchen/day',
      color: '#4a121a'
    },
    {
      title: 'EOD Returns & Restock',
      desc: 'Reconcile chef closing counts, audit variances & approve store restock.',
      icon: 'checkmark-done-circle-outline' as const,
      route: '/admin/kitchen-returns',
      color: '#D5A943'
    },
    {
      title: 'Dish Costing & Profit Margins',
      desc: 'Live food cost engine, target margin optimizer & 1-tap menu price updater.',
      icon: 'calculator-outline' as const,
      route: '/admin/costing',
      color: '#4a121a'
    },
    {
      title: 'Playland Hub & Invoices',
      desc: 'View ticket sales invoices, add jhooley/rides & set time-based variant pricing.',
      icon: 'color-palette-outline' as const,
      route: '/admin/playland',
      color: '#D5A943'
    }
  ];

  return (
    <ScrollView style={[styles.container, isMobile && styles.containerMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <SultanLogo size="md" variant="circle" width={32} height={32} containerStyle={{ width: 48, height: 48, borderRadius: 24 }} />
            <View>
              <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Executive Dashboard</Text>
              <Text style={styles.pageSubtitle}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, idx) => (
            <View key={idx} style={[styles.statCard, isMobile && styles.statCardMobile]}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Ionicons name={stat.icon} size={18} color="#D5A943" />
              </View>
              <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>{stat.value}</Text>
              <Text style={styles.statTrend}>{stat.trend}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Operations & Management</Text>
        <View style={styles.actionsGrid}>
          {ACTIONS.map((action, idx) => (
            <TouchableOpacity 
              key={idx}
              style={[
                styles.actionCard,
                isMobile ? styles.actionCardMobile : styles.actionCardDesktop
              ]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBadge, { backgroundColor: isMobile ? 'rgba(74, 18, 26, 0.08)' : 'rgba(213, 169, 67, 0.12)' }]}>
                <Ionicons name={action.icon} size={22} color="#4a121a" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDesc} numberOfLines={2}>{action.desc}</Text>
              </View>
              {isMobile && (
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
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
});
