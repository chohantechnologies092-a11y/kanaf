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
import { useOpsStore, getStockLevel } from '../../store/opsStore';
import SultanLogo from '../../components/SultanLogo';

export default function ManagerDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const staff = useRestaurantStore((state) => state.staff) || [];
  const activeWaiters = staff.filter((s) => s.role === 'Waiter' && s.status === 'Active').length;
  const activeKitchen = staff.filter((s) => s.role === 'Kitchen' && s.status === 'Active').length;
  const tables = useRestaurantStore((state) => state.tables) || [];
  const tickets = useRestaurantStore((state) => state.tickets) || [];
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;

  // Real-time inventory alerts
  const inventory = useOpsStore((state) => state.inventory) || [];
  const lowStockItems = inventory.filter((item) => {
    const level = getStockLevel(item);
    return level === 'low' || level === 'critical' || level === 'out';
  });

  // Live kitchen stats for badges
  const cookingCount = tickets.filter(t => t.status === 'cooking').length;
  const readyCount = tickets.filter(t => t.status === 'ready').length;
  const hasUrgent = readyCount > 0;

  return (
    <ScrollView style={[styles.container, isMobile && styles.containerMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <SultanLogo size="md" variant="circle" width={32} height={32} containerStyle={{ width: 48, height: 48, borderRadius: 24 }} />
            <View>
              <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Manager Duty</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Shift Summary Bar */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiPill}>
            <Ionicons name="grid" size={16} color="#1976D2" style={{ marginRight: 6 }} />
            <Text style={styles.kpiText}>{occupiedCount}/{tables.length} Tables Busy</Text>
          </View>
          <View style={styles.kpiPill}>
            <Ionicons name="people" size={16} color="#7B1FA2" style={{ marginRight: 6 }} />
            <Text style={styles.kpiText}>{activeWaiters} Order Takers • {activeKitchen} Kitchen</Text>
          </View>
        </View>
        
        {/* Urgent food-ready alert */}
        {hasUrgent && (
          <View style={styles.urgentBanner}>
            <Ionicons name="notifications" size={20} color="#FF9500" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.urgentBannerTitle}>
                🔔 {readyCount} Order{readyCount > 1 ? 's' : ''} Ready for Pickup!
              </Text>
              <Text style={styles.urgentBannerDesc}>
                Food is at the pass — direct order takers to serve tables immediately.
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/waiter')} style={styles.urgentBannerBtn}>
              <Text style={styles.urgentBannerBtnText}>View Tables</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Urgent Alerts Section */}
        {lowStockItems.length > 0 ? (
          <View style={[styles.alertCard, isMobile && styles.alertCardMobile]}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={22} color="#e74c3c" />
              <Text style={styles.alertTitle}>Stock & Inventory Notice ({lowStockItems.length} Low)</Text>
            </View>
            <Text style={styles.alertDesc}>
              {lowStockItems.slice(0, 3).map(i => i.name).join(', ')}
              {lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more items` : ''} are below reorder threshold.
            </Text>
            <TouchableOpacity 
              style={styles.alertButton} 
              onPress={() => router.push('/manager/inventory')}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>Manage Stock Levels</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.alertCard, isMobile && styles.alertCardMobile, { borderLeftColor: '#27ae60' }]}>
            <View style={styles.alertHeader}>
              <Ionicons name="checkmark-circle" size={22} color="#27ae60" />
              <Text style={[styles.alertTitle, { color: '#27ae60' }]}>Inventory Health Normal</Text>
            </View>
            <Text style={styles.alertDesc}>All kitchen raw materials and pantry items are well above reorder thresholds.</Text>
            <TouchableOpacity 
              style={[styles.alertButton, { backgroundColor: '#27ae60' }]} 
              onPress={() => router.push('/manager/inventory')}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>View Raw Materials</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manager Actions */}
        <Text style={styles.sectionTitle}>Shift Operations</Text>
        <View style={styles.grid}>
          
          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/floor-plan')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="grid" size={24} color="#1976D2" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Floor Plan & Blueprint</Text>
              <Text style={styles.cardDesc}>View live table layout, bills & assign guest tables.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/pos')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="calculator" size={24} color="#F57C00" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>POS Cashier Terminal</Text>
              <Text style={styles.cardDesc}>Fast order punching, takeaway, card & cash billing.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/invoices')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FDF2F0' }]}>
              <Ionicons name="receipt" size={24} color="#4a121a" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Invoices & Order History</Text>
              <Text style={styles.cardDesc}>Complete order receipts, reprint bills & payment records.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/returns' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="return-down-back" size={24} color="#C62828" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Sales Returns & Refunds</Text>
              <Text style={styles.cardDesc}>Issue item returns, taste/quality refunds & credit vouchers.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/shift')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="cash" size={24} color="#2E7D32" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Shift & Cash Drawer</Text>
              <Text style={styles.cardDesc}>Count cash, reconcile variance & print X/Z reports.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/admin/staff')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="people" size={24} color="#7B1FA2" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Staff Attendance & PINs</Text>
              <Text style={styles.cardDesc}>
                {activeWaiters + activeKitchen} Active staff on current shift roster.
              </Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          {/* KDS Card — with live cooking/ready badge */}
          <TouchableOpacity 
            style={[
              styles.card, 
              isMobile && styles.cardMobile,
              (cookingCount > 0 || readyCount > 0) && styles.cardActive,
            ]}
            onPress={() => router.push('/kitchen/kds')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: readyCount > 0 ? '#E3F2FD' : '#FBE9E7' }]}>
              <Ionicons 
                name={readyCount > 0 ? 'checkmark-done-circle' : 'flame'} 
                size={24} 
                color={readyCount > 0 ? '#007AFF' : '#D84315'} 
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                <Text style={styles.cardTitle}>Kitchen Display (KDS)</Text>
                {cookingCount > 0 && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>{cookingCount} cooking</Text>
                  </View>
                )}
                {readyCount > 0 && (
                  <View style={[styles.liveBadge, styles.liveBadgeReady]}>
                    <Text style={[styles.liveBadgeText, { color: '#0058CC' }]}>{readyCount} ready!</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>
                {cookingCount === 0 && readyCount === 0
                  ? 'No active tickets in kitchen right now.'
                  : `${cookingCount} being prepared • ${readyCount} waiting to be served.`}
              </Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          {/* Waiter Table Handheld Card — with live table count */}
          <TouchableOpacity 
            style={[
              styles.card, 
              isMobile && styles.cardMobile,
              hasUrgent && styles.cardUrgent,
            ]}
            onPress={() => router.push('/waiter')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: hasUrgent ? '#FFF3E0' : '#F6F3EC' }]}>
              <Ionicons 
                name={hasUrgent ? 'notifications' : 'fast-food'} 
                size={24} 
                color={hasUrgent ? '#FF9500' : '#4a121a'} 
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                <Text style={styles.cardTitle}>Order Taker Handheld</Text>
                {occupiedCount > 0 && (
                  <View style={[styles.liveBadge, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}>
                    <Text style={[styles.liveBadgeText, { color: '#C62828' }]}>{occupiedCount} occupied</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>
                {hasUrgent 
                  ? `\u26a0\ufe0f ${readyCount} orders ready \u2014 check tables now!`
                  : `Floor-based table orders, send to kitchen & punch KOT.`}
              </Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/floors')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EDE7F6' }]}>
              <Ionicons name="business" size={24} color="#512DA8" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>5-Floor Multi-Level Command</Text>
              <Text style={styles.cardDesc}>Ground, 1st, Banquet, VIP Lounge & Rooftop BBQ live state.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/expenses')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E0F2F1' }]}>
              <Ionicons name="wallet" size={24} color="#00796B" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Daily Cash Expenses & P&L</Text>
              <Text style={styles.cardDesc}>Log groceries, dairy, gas, utilities & shift net profit.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/kitchen-handover' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FBE9E7' }]}>
              <Ionicons name="clipboard" size={24} color="#52171B" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Kitchen Handover & Requisition</Text>
              <Text style={styles.cardDesc}>Issue store stock, hand cash & monitor shift consumption.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, isMobile && styles.cardMobile]}
            onPress={() => router.push('/manager/kitchen-returns' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-done-circle" size={24} color="#2E7D32" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>EOD Returns & Store Restock</Text>
              <Text style={styles.cardDesc}>Verify chef physical closing counts, variance & restock.</Text>
            </View>
            {isMobile && (
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            )}
          </TouchableOpacity>
          
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
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  pageTitleMobile: {
    fontSize: 22,
  },
  dateText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  kpiText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFB300',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  urgentBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 2,
  },
  urgentBannerDesc: {
    fontSize: 13,
    color: '#795548',
  },
  urgentBannerBtn: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  urgentBannerBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  alertCard: {
    backgroundColor: '#FDF2F0',
    borderWidth: 1,
    borderColor: '#FADCD8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  alertCardMobile: {
    padding: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#e74c3c',
    marginLeft: 8,
  },
  alertDesc: {
    fontSize: 14,
    color: '#636366',
    lineHeight: 20,
    marginBottom: 14,
  },
  alertButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alertButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '48%',
    borderWidth: 1,
    borderColor: '#EFEFF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardMobile: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardActive: {
    borderColor: '#FF9500',
    borderWidth: 1.5,
  },
  cardUrgent: {
    borderColor: '#007AFF',
    borderWidth: 1.5,
    backgroundColor: '#F0F8FF',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardInfo: {
    flex: 1,
    marginHorizontal: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  liveBadge: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFB74D',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeReady: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E65100',
  },
});
