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

const BRAND = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  burgundy: '#701A26',
  burgundyLight: '#FDF2F4',
  gold: '#B48214',
  goldLight: '#FEF3C7',
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
  
  const invoices = useRestaurantStore(state => state.invoices);
  const tickets = useRestaurantStore(state => state.tickets);
  const tables = useRestaurantStore(state => state.tables);
  const staff = useRestaurantStore(state => state.staff);

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
            <Text style={styles.headerTitle}>Manager Shift Console & Analytics</Text>
            <View style={styles.livePulsePill}>
              <View style={styles.pulseDot} {...({ dataSet: { beacon: 'pulse' } } as any)} />
              <Text style={styles.livePulseText}>Shift Active</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            {formattedDate} • Real-time dining occupancy, shift revenue & kitchen preparation queue
          </Text>
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
              color={BRAND.burgundy} 
              {...(isRefreshing ? ({ dataSet: { spin: 'true' } } as any) : {})}
            />
            <Text style={styles.refreshSyncBtnText}>{isRefreshing ? 'Refreshing...' : 'Live Sync'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPosBtn}
            onPress={() => router.push('/manager/pos')}
            activeOpacity={0.8}
            {...({ dataSet: { btn: 'hover' } } as any)}
          >
            <Ionicons name="calculator" size={16} color="#FFFFFF" />
            <Text style={styles.actionPosBtnText}>Punch Order (POS)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Core KPI Cards (4 Cards) */}
      <View style={styles.kpiGrid}>
        <View 
          style={[styles.kpiCard, isMobile ? styles.kpiCardFull : styles.kpiCardQuarter]}
          {...({ dataSet: { card: 'interactive', stagger: '1' } } as any)}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>SHIFT REVENUE</Text>
            <View 
              style={[styles.kpiIconBox, { backgroundColor: BRAND.emeraldLight }]}
              {...({ dataSet: { icon: 'box' } } as any)}
            >
              <Ionicons name="cash-outline" size={19} color={BRAND.emeraldDark} />
            </View>
          </View>
          {isRefreshing ? (
            <View style={styles.skeletonValue} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValue}>Rs. {shiftSales.toLocaleString()}</Text>
          )}
          <Text style={styles.kpiSubtext}>{todaysInvoices.length} settled tickets</Text>
        </View>

        <View 
          style={[styles.kpiCard, isMobile ? styles.kpiCardFull : styles.kpiCardQuarter]}
          {...({ dataSet: { card: 'interactive', stagger: '2' } } as any)}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>DINE-IN OCCUPANCY</Text>
            <View 
              style={[styles.kpiIconBox, { backgroundColor: BRAND.skyLight }]}
              {...({ dataSet: { icon: 'box' } } as any)}
            >
              <Ionicons name="restaurant-outline" size={19} color={BRAND.sky} />
            </View>
          </View>
          {isRefreshing ? (
            <View style={styles.skeletonValue} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValue}>{occupiedTables} / {tables.length}</Text>
          )}
          <Text style={styles.kpiSubtext}>{freeTables} free tables ({occupancyRate}%)</Text>
        </View>

        <View 
          style={[styles.kpiCard, isMobile ? styles.kpiCardFull : styles.kpiCardQuarter]}
          {...({ dataSet: { card: 'interactive', stagger: '3' } } as any)}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>KITCHEN LOAD</Text>
            <View 
              style={[styles.kpiIconBox, { backgroundColor: BRAND.amberLight }]}
              {...({ dataSet: { icon: 'box' } } as any)}
            >
              <Ionicons name="flame-outline" size={19} color={BRAND.amber} />
            </View>
          </View>
          {isRefreshing ? (
            <View style={styles.skeletonValue} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValue}>{activeOrders} Orders</Text>
          )}
          <Text style={styles.kpiSubtext}>Cooking & Plating</Text>
        </View>

        <View 
          style={[styles.kpiCard, isMobile ? styles.kpiCardFull : styles.kpiCardQuarter]}
          {...({ dataSet: { card: 'interactive', stagger: '4' } } as any)}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>ACTIVE CREW</Text>
            <View 
              style={[styles.kpiIconBox, { backgroundColor: BRAND.indigoLight }]}
              {...({ dataSet: { icon: 'box' } } as any)}
            >
              <Ionicons name="people-outline" size={19} color={BRAND.indigo} />
            </View>
          </View>
          {isRefreshing ? (
            <View style={styles.skeletonValue} {...({ dataSet: { skeleton: 'box' } } as any)} />
          ) : (
            <Text style={styles.kpiMainValue}>{activeStaff.length} On Duty</Text>
          )}
          <Text style={styles.kpiSubtext}>{activeWaiters} Waiters • {activeKitchen} Kitchen</Text>
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
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: BRAND.burgundy }]} />
              <Text style={styles.legendText}>Volume (PKR)</Text>
            </View>
          </View>

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
            <TouchableOpacity onPress={() => router.push('/manager/pos')}>
              <Text style={styles.tableActionLink}>Menu POS</Text>
            </TouchableOpacity>
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
                  <Text style={styles.revenueText}>Rs. {dish.revenue.toLocaleString()}</Text>
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
            <TouchableOpacity onPress={() => router.push('/manager/invoices')}>
              <Text style={styles.tableActionLink}>All Orders</Text>
            </TouchableOpacity>
          </View>

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
                  <Text style={styles.invoiceTotalText}>Rs. {(inv.total || 0).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
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
    backgroundColor: BRAND.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BRAND.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
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
    gap: 10,
    flexWrap: 'wrap',
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
    backgroundColor: BRAND.burgundyLight,
    borderWidth: 1,
    borderColor: 'rgba(112, 26, 38, 0.2)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshSyncBtnActive: {
    backgroundColor: '#FDE8EB',
  },
  refreshSyncBtnText: {
    color: BRAND.burgundy,
    fontSize: 12,
    fontWeight: '800',
  },
  actionPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionPosBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
    backgroundColor: BRAND.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BRAND.cardBorder,
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
});
