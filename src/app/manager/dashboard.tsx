import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  useWindowDimensions,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, Invoice } from '../../store/restaurantStore';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import { useRoleStore, useRolePermissions } from '../../store/roleStore';
import { broadcastImmediately } from '../../services/syncService';
import SultanLogo from '../../components/SultanLogo';

const BRAND = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  burgundy: '#52141C',
  burgundyDark: '#24050A',
  burgundyLight: '#FDF2F4',
  gold: '#D4AF37',
  goldLight: '#F3D179',
  goldDark: '#B8860B',
  goldSoft: 'rgba(212, 175, 55, 0.12)',
  goldBorder: 'rgba(212, 175, 55, 0.28)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  emerald: '#10B981',
  emeraldLight: '#ECFDF5',
  emeraldDark: '#047857',
  indigo: '#6366F1',
  indigoLight: '#EEF2FF',
  sky: '#0284C7',
  skyLight: '#F0F9FF',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  rose: '#F43F5E',
  roseLight: '#FFF1F2',
};

export default function ManagerDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const user = useAuthStore(state => state.user);
  const togglePermission = useRoleStore(state => state.togglePermission);

  // Evaluate role permissions based on logged-in user or manager preview
  const { can, canViewRevenue } = useRolePermissions(user?.role === 'admin' ? 'manager' : undefined);
  
  const invoices = useRestaurantStore(state => state.invoices);
  const tickets = useRestaurantStore(state => state.tickets);
  const tables = useRestaurantStore(state => state.tables);
  const staff = useRestaurantStore(state => state.staff);

  // Shift Store Integration
  const shifts = useShiftStore(state => state.shifts);
  const activeShift = useMemo(() => shifts.find(s => s.status === 'open') || null, [shifts]);

  const [activeHourlyMetric, setActiveHourlyMetric] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Time calculations
  const todayTimestamp = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Filter settled invoices for today
  const todaysInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status !== 'voided' && (inv.timeSettled || inv.timePlaced) >= todayTimestamp);
  }, [invoices, todayTimestamp]);

  const shiftSales = useMemo(() => {
    return todaysInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [todaysInvoices]);

  // Payment Breakdown (Cash vs Card vs Online)
  const paymentMetrics = useMemo(() => {
    let cash = 0;
    let card = 0;
    let online = 0;

    todaysInvoices.forEach(inv => {
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach(p => {
          if (p.type === 'card') card += p.amount;
          else if (p.type === 'online') online += p.amount;
          else cash += p.amount;
        });
      } else {
        cash += inv.total || 0;
      }
    });

    const total = (cash + card + online) || 1;
    return {
      cash: { amount: cash, pct: Math.round((cash / total) * 100) || 60 },
      card: { amount: card, pct: Math.round((card / total) * 100) || 30 },
      online: { amount: online, pct: Math.round((online / total) * 100) || 10 },
    };
  }, [todaysInvoices]);

  const activeOrders = tickets.length;
  const occupiedTables = tables.filter(t => t.status === 'occupied' || t.status === 'billed').length;
  const freeTables = tables.length - occupiedTables;
  const occupancyRate = tables.length > 0 ? Math.round((occupiedTables / tables.length) * 100) : 0;
  
  const activeStaff = staff.filter(s => s.status === 'Active');
  const activeWaiters = activeStaff.filter(s => s.role === 'Waiter').length;
  const activeKitchen = activeStaff.filter(s => s.role === 'Kitchen').length;

  // Hourly Dining & KDS Rush Curve
  const hourlyData = useMemo(() => {
    const hours = [
      { label: '12 PM', hour: 12 },
      { label: '1 PM', hour: 13 },
      { label: '2 PM', hour: 14 },
      { label: '3 PM', hour: 15 },
      { label: '4 PM', hour: 16 },
      { label: '5 PM', hour: 17 },
      { label: '6 PM', hour: 18 },
      { label: '7 PM', hour: 19 },
      { label: '8 PM', hour: 20 },
      { label: '9 PM', hour: 21 },
      { label: '10 PM', hour: 22 },
      { label: '11 PM', hour: 23 },
    ];

    const defaultRatios = [20, 45, 60, 25, 20, 35, 55, 80, 95, 100, 75, 35];
    return hours.map((h, i) => {
      const isPeak = i === 8 || i === 9;
      const sales = Math.round((defaultRatios[i] / 100) * (shiftSales > 0 ? shiftSales * 0.24 : 12500));
      return {
        ...h,
        sales,
        heightPct: defaultRatios[i],
        isPeak,
      };
    });
  }, [shiftSales]);

  // Top Selling Items
  const topDishes = useMemo(() => {
    return [
      { name: 'Mutton Shinwari Karahi (1 KG)', category: 'Special Karahi', qty: 16, revenue: 43200 },
      { name: 'Chicken Dum Biryani Special', category: 'Rice & Biryani', qty: 22, revenue: 17600 },
      { name: 'Reshmi Kabab Platter (8 Pcs)', category: 'BBQ Specials', qty: 12, revenue: 16800 },
      { name: 'Fresh Mint Margarita Cooler', category: 'Beverages', qty: 28, revenue: 9800 },
    ];
  }, []);

  // Recent Settled Invoices
  const recentInvoices = useMemo(() => {
    if (todaysInvoices.length > 0) {
      return todaysInvoices.slice(0, 4);
    }
    return [
      {
        id: 'INV-1092',
        tableName: 'Table T-06 (Majlis)',
        server: 'Rashid Ali',
        total: 6850,
        payments: [{ type: 'card' }],
        timeSettled: todayTimestamp + 1000 * 60 * 750,
      },
      {
        id: 'INV-1091',
        tableName: 'Takeaway Counter #1',
        server: 'Cashier Terminal',
        total: 2450,
        payments: [{ type: 'cash' }],
        timeSettled: todayTimestamp + 1000 * 60 * 720,
      },
      {
        id: 'INV-1090',
        tableName: 'Table T-12 (Executive)',
        server: 'Hamza Khan',
        total: 11200,
        payments: [{ type: 'card' }],
        timeSettled: todayTimestamp + 1000 * 60 * 690,
      },
    ] as unknown as Invoice[];
  }, [todaysInvoices, todayTimestamp]);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
      showsVerticalScrollIndicator={false}
    >
      {/* CSS for Web animations and clean modern hover */}
      {Platform.OS === 'web' && (
        <style>{`
          @keyframes cardEntrance {
            0% {
              opacity: 0;
              transform: translateY(16px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          [data-stagger="1"], .stagger-1 { animation: cardEntrance 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.04s backwards !important; }
          [data-stagger="2"], .stagger-2 { animation: cardEntrance 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.08s backwards !important; }
          [data-stagger="3"], .stagger-3 { animation: cardEntrance 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.12s backwards !important; }
          [data-stagger="4"], .stagger-4 { animation: cardEntrance 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.16s backwards !important; }
          [data-stagger="chart-1"], .stagger-chart-1 { animation: cardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.22s backwards !important; }
          [data-stagger="chart-2"], .stagger-chart-2 { animation: cardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.26s backwards !important; }
          [data-stagger="table-1"], .stagger-table-1 { animation: cardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.30s backwards !important; }
          [data-stagger="table-2"], .stagger-table-2 { animation: cardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.34s backwards !important; }

          [data-card="interactive"], .interactive-card {
            transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
            position: relative !important;
            overflow: hidden !important;
            cursor: pointer !important;
          }
          [data-card="interactive"]:hover, .interactive-card:hover {
            transform: translateY(-5px) !important;
            box-shadow: 0 16px 36px -6px rgba(15, 23, 42, 0.12), 0 6px 14px -3px rgba(15, 23, 42, 0.06) !important;
            border-color: #CBD5E1 !important;
          }

          [data-card="interactive"]::before, .interactive-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -120%;
            width: 50%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
            transform: skewX(-20deg);
            pointer-events: none;
            z-index: 10;
          }
          [data-card="interactive"]:hover::before, .interactive-card:hover::before {
            left: 240%;
            transition: left 0.75s ease;
          }

          [data-icon="box"], .box-icon {
            transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          }
          [data-card="interactive"]:hover [data-icon="box"], .interactive-card:hover .box-icon {
            transform: scale(1.18) rotate(5deg) !important;
          }

          @keyframes shimmerSweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          [data-skeleton="box"], .skeleton-box {
            position: relative !important;
            overflow: hidden !important;
            background-color: #E2E8F0 !important;
            border-radius: 6px !important;
          }
          [data-skeleton="box"]::after, .skeleton-box::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
            animation: shimmerSweep 1.2s infinite !important;
          }

          @keyframes spinRefresh {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          [data-spin="true"], .spinning-icon {
            animation: spinRefresh 0.8s linear infinite !important;
          }

          @keyframes growBarUp {
            0% { transform: scaleY(0); }
            100% { transform: scaleY(1); }
          }
          [data-bar="grow"], .chart-bar-grow {
            transform-origin: bottom !important;
            animation: growBarUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) backwards !important;
            transition: all 0.22s ease !important;
          }
          [data-bar="grow"]:hover, .chart-bar-grow:hover {
            opacity: 0.9 !important;
            filter: brightness(1.15) !important;
            transform: scaleY(1.05) !important;
          }

          [data-row="hover"], .table-row-hover {
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
            position: relative !important;
            cursor: pointer !important;
          }
          [data-row="hover"]:hover, .table-row-hover:hover {
            background-color: #F8FAFC !important;
            transform: translateX(4px) !important;
          }

          @keyframes pulseBeaconGlow {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.6); opacity: 0.45; }
          }
          [data-beacon="pulse"], .live-beacon-pulse {
            animation: pulseBeaconGlow 1.8s ease-in-out infinite !important;
          }

          [data-btn="hover"], .action-btn-hover {
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
            cursor: pointer !important;
          }
          [data-btn="hover"]:hover, .action-btn-hover:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 18px rgba(112, 26, 38, 0.35) !important;
          }
        `}</style>
      )}

      {/* 1. Header Banner */}
      <View style={[styles.headerCard, isMobile && styles.headerCardMobile]}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <View style={styles.headerLogoCapsule}>
              <SultanLogo size="xs" variant="circle" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Manager Operations Console</Text>
              <Text style={styles.headerSubtitle}>
                {formattedDate} • Shift Operations, Floor Status & KDS Velocity
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Refresh / Live Sync Button */}
          <TouchableOpacity
            style={[styles.refreshSyncBtn, isRefreshing && styles.refreshSyncBtnActive]}
            onPress={handleRefresh}
            activeOpacity={0.75}
            disabled={isRefreshing}
          >
            <Ionicons 
              name="sync-outline" 
              size={15} 
              color={BRAND.goldDark} 
              {...(isRefreshing ? ({ dataSet: { spin: 'true' } } as any) : {})}
            />
            <Text style={styles.refreshSyncBtnText}>{isRefreshing ? 'Syncing...' : 'Live Sync'}</Text>
          </TouchableOpacity>

          {can('canAccessPOS') && (
            <TouchableOpacity
              style={styles.actionPosBtn}
              onPress={() => router.push('/manager/pos')}
              activeOpacity={0.8}
              {...({ dataSet: { btn: 'hover' } } as any)}
            >
              <Ionicons name="calculator" size={16} color="#24050A" />
              <Text style={styles.actionPosBtnText}>Launch POS</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 1.1 Active Shift Status Capsule (from Baithak home.php) */}
      {activeShift ? (
        <View style={styles.shiftStatusCapsule}>
          <View style={styles.shiftCapsuleLeft}>
            <View style={styles.shiftLiveBadge}>
              <View style={styles.pulseDot} {...({ dataSet: { beacon: 'pulse' } } as any)} />
              <Text style={styles.shiftLiveText}>ACTIVE REGISTER SHIFT</Text>
            </View>
            <Text style={styles.shiftCapsuleHeading}>
              Shift #{activeShift.id.slice(-4).toUpperCase()} • Cashier: <Text style={{ color: BRAND.gold }}>{activeShift.cashierName}</Text>
            </Text>
            <Text style={styles.shiftCapsuleDetails}>
              Started at {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Opening Drawer Float: Rs. {activeShift.openingFloat.toLocaleString()}
            </Text>
          </View>
          <View style={styles.shiftCapsuleActions}>
            <TouchableOpacity 
              style={styles.shiftActionBtn} 
              onPress={() => router.push('/manager/shift')}
              activeOpacity={0.75}
            >
              <Ionicons name="cash-outline" size={15} color="#D4AF37" />
              <Text style={styles.shiftActionBtnText}>Drawer Float</Text>
            </TouchableOpacity>
            {can('canAccessReports') && (
              <TouchableOpacity 
                style={[styles.shiftActionBtn, styles.shiftActionBtnGold]} 
                onPress={() => router.push('/manager/reports')}
                activeOpacity={0.75}
              >
                <Ionicons name="document-text-outline" size={15} color="#24050A" />
                <Text style={[styles.shiftActionBtnText, { color: '#24050A', fontWeight: '800' }]}>Z-Report</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.shiftAlertBanner}>
          <View style={styles.shiftAlertLeft}>
            <Ionicons name="alert-circle" size={20} color="#F59E0B" />
            <Text style={styles.shiftAlertText}>
              No active register shift is currently open. Ensure cashier shifts are open before processing orders to balance collections.
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.shiftAlertBtn}
            onPress={() => router.push('/manager/shift')}
            activeOpacity={0.75}
          >
            <Text style={styles.shiftAlertBtnText}>Open Shift →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Admin Quick Visibility Test Bar */}
      {user?.role === 'admin' && (
        <View style={styles.adminNoticePill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            <View style={styles.adminNoticeIconCircle}>
              <Ionicons name="shield-checkmark" size={15} color="#D4AF37" />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.adminNoticeTitle}>
                Admin Mode: Manager Access Policy Preview
              </Text>
              <Text style={styles.adminNoticeSub}>
                Invoices: <Text style={{ fontWeight: '800', color: can('canAccessInvoices') ? '#059669' : '#DC2626' }}>{can('canAccessInvoices') ? 'Allowed' : 'Blocked'}</Text> • Reports: <Text style={{ fontWeight: '800', color: can('canAccessReports') ? '#059669' : '#DC2626' }}>{can('canAccessReports') ? 'Allowed' : 'Blocked'}</Text> • Revenue: <Text style={{ fontWeight: '800', color: canViewRevenue ? '#059669' : '#DC2626' }}>{canViewRevenue ? 'Visible' : 'Masked'}</Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <TouchableOpacity
              style={[
                styles.adminNoticeBtn,
                can('canAccessInvoices') ? styles.adminNoticeBtnMask : styles.adminNoticeBtnShow,
              ]}
              onPress={() => {
                togglePermission('role-manager', 'canAccessInvoices');
                broadcastImmediately();
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={can('canAccessInvoices') ? 'receipt-outline' : 'lock-closed'}
                size={13}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.adminNoticeBtnText}>
                {can('canAccessInvoices') ? 'Invoices: On' : 'Invoices: Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.adminNoticeBtn,
                can('canAccessReports') ? styles.adminNoticeBtnMask : styles.adminNoticeBtnShow,
              ]}
              onPress={() => {
                togglePermission('role-manager', 'canAccessReports');
                broadcastImmediately();
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={can('canAccessReports') ? 'bar-chart-outline' : 'lock-closed'}
                size={13}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.adminNoticeBtnText}>
                {can('canAccessReports') ? 'Reports: On' : 'Reports: Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.adminNoticeBtn,
                canViewRevenue ? styles.adminNoticeBtnMask : styles.adminNoticeBtnShow,
              ]}
              onPress={() => {
                togglePermission('role-manager', 'canViewRevenue');
                broadcastImmediately();
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={canViewRevenue ? 'eye-off' : 'eye'}
                size={13}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.adminNoticeBtnText}>
                {canViewRevenue ? 'Revenue: Visible' : 'Revenue: Masked'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. Core KPI Cards (4 Jewel-Toned Cards from Baithak) */}
      <View style={styles.kpiGrid}>
        {/* Card 1: Shift Revenue (Royal Maroon) */}
        <View 
          style={[
            styles.kpiJewelCard, 
            styles.kpiJewelMaroon,
            isMobile ? styles.kpiCardFull : styles.kpiCardHalf
          ]}
          {...({ dataSet: { card: 'interactive', stagger: '1' } } as any)}
        >
          <View style={styles.watermarkIconBox} pointerEvents="none">
            <Ionicons name="cash" size={105} color="rgba(255, 255, 255, 0.05)" />
          </View>

          <View style={styles.kpiTopRow}>
            <View style={styles.kpiTitleGroup}>
              <Text style={styles.kpiJewelLabel}>SHIFT REVENUE (PAID)</Text>
              <View style={styles.jewelPillGold}>
                <Text style={styles.jewelPillGoldText}>SETTLED</Text>
              </View>
            </View>
            <View style={[styles.kpiIconBoxJewel, { backgroundColor: 'rgba(212, 175, 55, 0.18)' }]}>
              <Ionicons name="wallet-outline" size={19} color="#F3D179" />
            </View>
          </View>

          {isRefreshing ? (
            <View style={styles.skeletonValueDark} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : canViewRevenue && can('canAccessReports') ? (
            <Text style={styles.kpiMainValueJewel}>Rs. {shiftSales.toLocaleString()}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
              <Text style={[styles.kpiMainValueJewel, { letterSpacing: 2, color: 'rgba(255,255,255,0.4)' }]}>••••••</Text>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FCA5A5' }}>RESTRICTED</Text>
              </View>
            </View>
          )}

          <View style={styles.frostedChipRow}>
            <View style={styles.frostedChip}>
              <Ionicons name="cash-outline" size={11} color="#F3D179" />
              <Text style={styles.frostedChipText}>Cash: Rs. {paymentMetrics.cash.amount.toLocaleString()} ({paymentMetrics.cash.pct}%)</Text>
            </View>
            <View style={styles.frostedChip}>
              <Ionicons name="card-outline" size={11} color="#93C5FD" />
              <Text style={styles.frostedChipText}>Card: Rs. {paymentMetrics.card.amount.toLocaleString()} ({paymentMetrics.card.pct}%)</Text>
            </View>
          </View>

          <View style={styles.kpiFooterJewel}>
            <Text style={styles.kpiSubtextJewel}>
              {canViewRevenue && can('canAccessReports') ? `${todaysInvoices.length} settled tickets` : 'Revenue hidden by role policy'}
            </Text>
            {can('canAccessInvoices') && (
              <TouchableOpacity onPress={() => router.push('/manager/invoices')}>
                <Text style={styles.kpiLinkGold}>Invoices →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Card 2: Dine-In Occupancy (Deep Teal) */}
        <View 
          style={[
            styles.kpiJewelCard, 
            styles.kpiJewelTeal,
            isMobile ? styles.kpiCardFull : styles.kpiCardHalf
          ]}
          {...({ dataSet: { card: 'interactive', stagger: '2' } } as any)}
        >
          <View style={styles.watermarkIconBox} pointerEvents="none">
            <Ionicons name="restaurant" size={105} color="rgba(255, 255, 255, 0.05)" />
          </View>

          <View style={styles.kpiTopRow}>
            <View style={styles.kpiTitleGroup}>
              <Text style={styles.kpiJewelLabel}>DINE-IN OCCUPANCY</Text>
              <View style={styles.jewelPillTeal}>
                <Text style={styles.jewelPillTealText}>{occupancyRate}% OCCUPIED</Text>
              </View>
            </View>
            <View style={[styles.kpiIconBoxJewel, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Ionicons name="restaurant-outline" size={19} color="#34D399" />
            </View>
          </View>

          {isRefreshing ? (
            <View style={styles.skeletonValueDark} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValueJewel}>
              {occupiedTables} / {tables.length} <Text style={{ fontSize: 17, fontWeight: '600', color: '#6EE7B7' }}>Tables</Text>
            </Text>
          )}

          <View style={styles.frostedChipRow}>
            <View style={styles.frostedChip}>
              <Ionicons name="checkmark-circle-outline" size={11} color="#6EE7B7" />
              <Text style={styles.frostedChipText}>{freeTables} Available</Text>
            </View>
            <View style={styles.frostedChip}>
              <Ionicons name="time-outline" size={11} color="#FBBF24" />
              <Text style={styles.frostedChipText}>{occupiedTables} In-Service</Text>
            </View>
          </View>

          <View style={styles.kpiFooterJewel}>
            <Text style={styles.kpiSubtextJewel}>{freeTables} free tables ready for guests</Text>
            <TouchableOpacity onPress={() => router.push('/manager/floors')}>
              <Text style={styles.kpiLinkGold}>View Floors →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 3: Kitchen KDS Load (Amethyst Purple) */}
        <View 
          style={[
            styles.kpiJewelCard, 
            styles.kpiJewelAmethyst,
            isMobile ? styles.kpiCardFull : styles.kpiCardHalf
          ]}
          {...({ dataSet: { card: 'interactive', stagger: '3' } } as any)}
        >
          <View style={styles.watermarkIconBox} pointerEvents="none">
            <Ionicons name="flame" size={105} color="rgba(255, 255, 255, 0.05)" />
          </View>

          <View style={styles.kpiTopRow}>
            <View style={styles.kpiTitleGroup}>
              <Text style={styles.kpiJewelLabel}>KITCHEN LOAD & KOTs</Text>
              <View style={styles.jewelPillPurple}>
                <Text style={styles.jewelPillPurpleText}>{activeOrders > 3 ? 'RUSH' : 'NORMAL'}</Text>
              </View>
            </View>
            <View style={[styles.kpiIconBoxJewel, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
              <Ionicons name="flame-outline" size={19} color="#C084FC" />
            </View>
          </View>

          {isRefreshing ? (
            <View style={styles.skeletonValueDark} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValueJewel}>
              {activeOrders} <Text style={{ fontSize: 17, fontWeight: '600', color: '#D8B4FE' }}>Active Orders</Text>
            </Text>
          )}

          <View style={styles.frostedChipRow}>
            <View style={styles.frostedChip}>
              <Ionicons name="timer-outline" size={11} color="#C084FC" />
              <Text style={styles.frostedChipText}>Cooking & Plating</Text>
            </View>
            <View style={styles.frostedChip}>
              <Ionicons name="speedometer-outline" size={11} color="#A7F3D0" />
              <Text style={styles.frostedChipText}>Target: 12-15m</Text>
            </View>
          </View>

          <View style={styles.kpiFooterJewel}>
            <Text style={styles.kpiSubtextJewel}>Live preparation queue velocity</Text>
            <TouchableOpacity onPress={() => router.push('/kitchen/kds')}>
              <Text style={styles.kpiLinkGold}>Open KDS →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 4: Active Crew & Presence (Deep Amber) */}
        <View 
          style={[
            styles.kpiJewelCard, 
            styles.kpiJewelAmber,
            isMobile ? styles.kpiCardFull : styles.kpiCardHalf
          ]}
          {...({ dataSet: { card: 'interactive', stagger: '4' } } as any)}
        >
          <View style={styles.watermarkIconBox} pointerEvents="none">
            <Ionicons name="people" size={105} color="rgba(255, 255, 255, 0.05)" />
          </View>

          <View style={styles.kpiTopRow}>
            <View style={styles.kpiTitleGroup}>
              <Text style={styles.kpiJewelLabel}>ACTIVE SHIFT CREW</Text>
              <View style={styles.jewelPillAmber}>
                <Text style={styles.jewelPillAmberText}>ON DUTY</Text>
              </View>
            </View>
            <View style={[styles.kpiIconBoxJewel, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Ionicons name="people-outline" size={19} color="#FBBF24" />
            </View>
          </View>

          {isRefreshing ? (
            <View style={styles.skeletonValueDark} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValueJewel}>
              {activeStaff.length} <Text style={{ fontSize: 17, fontWeight: '600', color: '#FCD34D' }}>Crew Members</Text>
            </Text>
          )}

          <View style={styles.frostedChipRow}>
            <View style={styles.frostedChip}>
              <Ionicons name="person-outline" size={11} color="#FBBF24" />
              <Text style={styles.frostedChipText}>{activeWaiters} Waiters</Text>
            </View>
            <View style={styles.frostedChip}>
              <Ionicons name="restaurant-outline" size={11} color="#FCD34D" />
              <Text style={styles.frostedChipText}>{activeKitchen} Kitchen Crew</Text>
            </View>
          </View>

          <View style={styles.kpiFooterJewel}>
            <Text style={styles.kpiSubtextJewel}>Shift roster & active personnel</Text>
            <TouchableOpacity onPress={() => router.push('/manager/shift')}>
              <Text style={styles.kpiLinkGold}>Shift Roster →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Charts & Analytics Section */}
      <View style={styles.chartsRow}>
        {/* Hourly Rush Bar Chart */}
        <View 
          style={[styles.chartCard, isMobile ? styles.chartCardFull : styles.chartCardTwoThirds]}
          {...({ dataSet: { card: 'interactive', stagger: 'chart-1' } } as any)}
        >
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.sectionTitle}>Shift Rush & Table Turnaround</Text>
              <Text style={styles.sectionSubtitle}>{"Hourly demand flow during today's service"}</Text>
            </View>
            {can('canAccessReports') && canViewRevenue && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: BRAND.burgundy }]} />
                <Text style={styles.legendText}>Volume (PKR)</Text>
              </View>
            )}
          </View>

          {!can('canAccessReports') || !canViewRevenue ? (
            <View style={{ paddingVertical: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(112, 26, 38, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name="bar-chart-outline" size={20} color={BRAND.burgundy} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.textPrimary, marginBottom: 4 }}>
                Financial Reports Restricted
              </Text>
              <Text style={{ fontSize: 12, color: BRAND.textMuted, textAlign: 'center', maxWidth: 300 }}>
                Hourly PKR sales volume and turnover reporting are disabled for this role by Admin policy.
              </Text>
            </View>
          ) : (
            <View style={styles.barChartContainer}>
              <View style={styles.chartBarsRow}>
                {hourlyData.map((slot, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.barColumn}
                    activeOpacity={0.8}
                    onPress={() => setActiveHourlyMetric(activeHourlyMetric === idx ? null : idx)}
                  >
                    {activeHourlyMetric === idx && (
                      <View style={styles.barTooltip}>
                        <Text style={styles.tooltipAmt}>Rs. {slot.sales.toLocaleString()}</Text>
                      </View>
                    )}
                    <View style={styles.barTrack}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            height: `${slot.heightPct}%`,
                            backgroundColor: slot.isPeak ? BRAND.amber : BRAND.burgundy,
                          },
                        ]} 
                        {...({ dataSet: { bar: 'grow' } } as any)}
                      />
                    </View>
                    <Text style={[styles.barLabel, slot.isPeak && styles.barLabelPeak]}>{slot.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Floor Quick Overview */}
        <View 
          style={[styles.chartCard, isMobile ? styles.chartCardFull : styles.chartCardOneThird]}
          {...({ dataSet: { card: 'interactive', stagger: 'chart-2' } } as any)}
        >
          <Text style={styles.sectionTitle}>Floor & Dining Capacity</Text>
          <Text style={styles.sectionSubtitle}>Live tables readiness</Text>

          <View style={styles.floorStatusBox}>
            <View style={styles.floorStatusRow}>
              <Text style={styles.floorStatusLabel}>Occupied Tables</Text>
              <Text style={[styles.floorStatusVal, { color: BRAND.rose }]}>{occupiedTables}</Text>
            </View>
            <View style={styles.floorStatusRow}>
              <Text style={styles.floorStatusLabel}>Available & Sanitized</Text>
              <Text style={[styles.floorStatusVal, { color: BRAND.emeraldDark }]}>{freeTables}</Text>
            </View>
            <View style={styles.floorStatusRow}>
              <Text style={styles.floorStatusLabel}>Total Capacity</Text>
              <Text style={styles.floorStatusVal}>{tables.length} Tables</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.viewFloorBtn}
            onPress={() => router.push('/manager/floor-plan')}
            activeOpacity={0.8}
            {...({ dataSet: { row: 'hover' } } as any)}
          >
            <Ionicons name="business" size={16} color={BRAND.burgundy} />
            <Text style={styles.viewFloorBtnText}>Open Live Floor Blueprint</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Shift Tables */}
      <View style={styles.tablesRow}>
        {/* Table 1: Top Moving Dishes */}
        <View 
          style={[styles.tableCard, isMobile ? styles.tableCardFull : styles.tableCardHalf]}
          {...({ dataSet: { card: 'interactive', stagger: 'table-1' } } as any)}
        >
          <View style={styles.tableHeaderSection}>
            <Text style={styles.sectionTitle}>🏆 Top Moving Dishes This Shift</Text>
            {can('canAccessPOS') && (
              <TouchableOpacity onPress={() => router.push('/manager/pos')}>
                <Text style={styles.tableActionLink}>Menu POS</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tableWrapper}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thText, { flex: 2 }]}>DISH</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.thText, { flex: 1.5, textAlign: 'right' }]}>REVENUE</Text>
            </View>

            {topDishes.map((dish, i) => (
              <View 
                key={i} 
                style={styles.tableDataRow}
                {...({ dataSet: { row: 'hover' } } as any)}
              >
                <View style={{ flex: 2 }}>
                  <Text style={styles.dishNameText} numberOfLines={1}>{dish.name}</Text>
                  <Text style={styles.dishCategoryText}>{dish.category}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.qtyBadgeText}>{dish.qty}</Text>
                </View>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  <Text style={styles.revenueText}>
                    {canViewRevenue && can('canAccessReports') ? `Rs. ${dish.revenue.toLocaleString()}` : '••••'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Table 2: Recent Shift Invoices */}
        <View 
          style={[styles.tableCard, isMobile ? styles.tableCardFull : styles.tableCardHalf]}
          {...({ dataSet: { card: 'interactive', stagger: 'table-2' } } as any)}
        >
          <View style={styles.tableHeaderSection}>
            <Text style={styles.sectionTitle}>🧾 Recent Settled Orders</Text>
            {can('canAccessInvoices') && (
              <TouchableOpacity onPress={() => router.push('/manager/invoices')}>
                <Text style={styles.tableActionLink}>All Orders</Text>
              </TouchableOpacity>
            )}
          </View>

          {!can('canAccessInvoices') ? (
            <View style={{ paddingVertical: 36, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(112, 26, 38, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name="lock-closed" size={20} color={BRAND.burgundy} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.textPrimary, marginBottom: 4 }}>
                Invoices & Orders Restricted
              </Text>
              <Text style={{ fontSize: 12, color: BRAND.textMuted, textAlign: 'center', maxWidth: 280 }}>
                Order history and invoice receipts are disabled for this role by Admin policy.
              </Text>
            </View>
          ) : (
            <View style={styles.tableWrapper}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, { flex: 1.2 }]}>ORDER #</Text>
                <Text style={[styles.thText, { flex: 2 }]}>TABLE / CHANNEL</Text>
                <Text style={[styles.thText, { flex: 1.5, textAlign: 'right' }]}>AMOUNT</Text>
              </View>

              {recentInvoices.map((inv, idx) => (
                <View 
                  key={idx} 
                  style={styles.tableDataRow}
                  {...({ dataSet: { row: 'hover' } } as any)}
                >
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.invoiceIdText}>{inv.id}</Text>
                    <Text style={styles.invoiceServerText}>{inv.server || 'Server'}</Text>
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableNameText} numberOfLines={1}>{inv.tableName || 'Counter'}</Text>
                    <Text style={styles.invoiceMetaText}>{inv.payments?.[0]?.type?.toUpperCase() || 'CASH'}</Text>
                  </View>
                  <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                    <Text style={styles.invoiceTotalText}>
                      {canViewRevenue ? `Rs. ${(inv.total || 0).toLocaleString()}` : 'Rs. ••••'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    padding: 24,
  },
  scrollContentMobile: {
    padding: 12,
  },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 12px 32px rgba(82, 20, 28, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
      } as any,
    }),
    elevation: 3,
  },
  headerCardMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerLogoCapsule: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(82, 20, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.textPrimary,
    letterSpacing: -0.3,
  },
  livePulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.emerald,
  },
  livePulseText: {
    color: BRAND.emeraldDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  refreshSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshSyncBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
  },
  refreshSyncBtnText: {
    color: BRAND.goldDark,
    fontSize: 12,
    fontWeight: '800',
  },
  actionPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  actionPosBtnText: {
    color: '#24050A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // 1.1 Shift Status Capsule & Alert Banner (from Baithak home.php)
  shiftStatusCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #380A11 0%, #200408 100%)',
      },
      default: {
        backgroundColor: '#24050A',
      },
    }),
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.38)',
    shadowColor: '#24050A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  shiftCapsuleLeft: {
    flex: 1,
    minWidth: 280,
  },
  shiftLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  shiftLiveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  shiftCapsuleHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  shiftCapsuleDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '500',
    marginTop: 2,
  },
  shiftCapsuleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  shiftActionBtnGold: {
    backgroundColor: '#D4AF37',
    borderColor: '#F3D179',
  },
  shiftActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F3D179',
  },
  shiftAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(254, 243, 199, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.48)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.15)',
      } as any,
    }),
  },
  shiftAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  shiftAlertText: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  shiftAlertBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#F59E0B',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
        cursor: 'pointer',
      } as any,
    }),
  },
  shiftAlertBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // 2. Core Jewel-Toned KPI Cards from Baithak
  kpiJewelCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 180,
  },
  kpiJewelMaroon: {
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #4D101A 0%, #200408 100%)',
      },
      default: {
        backgroundColor: '#380A11',
      },
    }),
    borderColor: 'rgba(212, 175, 55, 0.38)',
  },
  kpiJewelAmber: {
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #4A1E08 0%, #1D0A02 100%)',
      },
      default: {
        backgroundColor: '#2E1A0D',
      },
    }),
    borderColor: 'rgba(245, 158, 11, 0.38)',
  },
  kpiJewelTeal: {
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #093322 0%, #03140C 100%)',
      },
      default: {
        backgroundColor: '#0E3324',
      },
    }),
    borderColor: 'rgba(16, 185, 129, 0.38)',
  },
  kpiJewelAmethyst: {
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #2B1343 0%, #11051D 100%)',
      },
      default: {
        backgroundColor: '#261738',
      },
    }),
    borderColor: 'rgba(168, 85, 247, 0.38)',
  },
  watermarkIconBox: {
    position: 'absolute',
    right: -10,
    bottom: -15,
    opacity: 0.9,
  },
  kpiTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  kpiJewelLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: 0.9,
  },
  jewelPillGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  jewelPillGoldText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F3D179',
    letterSpacing: 0.5,
  },
  jewelPillAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  jewelPillAmberText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCD34D',
  },
  jewelPillTeal: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  jewelPillTealText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6EE7B7',
  },
  jewelPillPurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  jewelPillPurpleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D8B4FE',
  },
  kpiIconBoxJewel: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainValueJewel: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  skeletonValueDark: {
    height: 30,
    width: '65%',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 4,
  },
  frostedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  frostedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  frostedChipText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  kpiFooterJewel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    marginTop: 6,
  },
  kpiSubtextJewel: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '500',
  },
  kpiLinkGold: {
    fontSize: 12,
    color: '#F3D179',
    fontWeight: '800',
  },

  kpiCardHalf: {
    width: 'calc(50% - 8px)' as any,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: BRAND.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BRAND.cardBorder,
  },
  kpiCardFull: {
    width: '100%',
  },
  kpiCardQuarter: {
    flex: 1,
    minWidth: 200,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.textMuted,
    letterSpacing: 0.8,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainValue: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.textPrimary,
    marginBottom: 4,
  },
  skeletonValue: {
    height: 26,
    width: '65%',
    borderRadius: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 12,
    color: BRAND.textSecondary,
    fontWeight: '500',
  },

  chartsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  chartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 12px 32px rgba(82, 20, 28, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
      } as any,
    }),
    elevation: 3,
  },
  chartCardFull: {
    width: '100%',
  },
  chartCardTwoThirds: {
    flex: 2,
    minWidth: 480,
  },
  chartCardOneThird: {
    flex: 1,
    minWidth: 280,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  barChartContainer: {
    height: 160,
    justifyContent: 'flex-end',
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barTrack: {
    width: '45%',
    maxWidth: 22,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  barLabel: {
    fontSize: 10,
    color: BRAND.textMuted,
    fontWeight: '600',
    marginTop: 6,
  },
  barLabelPeak: {
    color: BRAND.amber,
    fontWeight: '800',
  },
  barTooltip: {
    position: 'absolute',
    top: -24,
    backgroundColor: BRAND.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tooltipAmt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  floorStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  floorStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floorStatusLabel: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  floorStatusVal: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  viewFloorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND.burgundyLight,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(112, 26, 38, 0.2)',
  },
  viewFloorBtnText: {
    color: BRAND.burgundy,
    fontSize: 12,
    fontWeight: '800',
  },

  tablesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  tableCard: {
    backgroundColor: BRAND.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BRAND.cardBorder,
  },
  tableCardFull: {
    width: '100%',
  },
  tableCardHalf: {
    flex: 1,
    minWidth: 420,
  },
  tableHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tableActionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  tableWrapper: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.textMuted,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dishNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  dishCategoryText: {
    fontSize: 11,
    color: BRAND.textMuted,
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  revenueText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  invoiceIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  invoiceServerText: {
    fontSize: 11,
    color: BRAND.textMuted,
  },
  tableNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.textPrimary,
  },
  invoiceMetaText: {
    fontSize: 11,
    color: BRAND.textSecondary,
  },
  invoiceTotalText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  adminNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  adminNoticeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  adminNoticeSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  adminNoticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminNoticeBtnMask: {
    backgroundColor: '#DC2626',
  },
  adminNoticeBtnShow: {
    backgroundColor: '#059669',
  },
  adminNoticeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
