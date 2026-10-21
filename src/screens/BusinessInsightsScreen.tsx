import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore } from '../store/restaurantStore';
import { BRAND } from '../constants/brand';
import { FLOOR_TEMPLATE, sortFloors } from '../constants/floors';
import { money, percent, hourLabel } from '../utils/format';

export default function BusinessInsightsScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const router = useRouter();

  const invoices = useRestaurantStore((s) => s.invoices);
  const tables = useRestaurantStore((s) => s.tables);

  const [period, setPeriod] = useState<'today' | 'week' | 'all'>('all');
  const [now] = useState(() => Date.now());

  const filteredInvoices = useMemo(() => {
    const list = (invoices || []).filter((inv) => inv.status !== 'voided');
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return list.filter((inv) => {
      const t = inv.timeSettled || inv.timePlaced;
      if (period === 'today') return t >= oneDayAgo;
      if (period === 'week') return t >= oneWeekAgo;
      return true;
    });
  }, [invoices, period, now]);

  const totalSales = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalBills = filteredInvoices.length;
  const avgTicket = totalBills > 0 ? totalSales / totalBills : 0;

  // Order Type Breakdown
  const dineInInvoices = filteredInvoices.filter((i) => i.orderType === 'dine-in');
  const takeawayInvoices = filteredInvoices.filter((i) => i.orderType === 'takeaway');
  const deliveryInvoices = filteredInvoices.filter((i) => i.orderType === 'delivery');

  const dineInSales = dineInInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const takeawaySales = takeawayInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const deliverySales = deliveryInvoices.reduce((s, i) => s + (i.total || 0), 0);

  // Floor revenue breakdown (map invoice tableId to table.zone)
  const tableZoneMap = new Map<string, string>();
  (tables || []).forEach((t) => tableZoneMap.set(t.id, t.zone || 'Ground Floor'));

  const floorRevenueMap: Record<string, number> = {};
  dineInInvoices.forEach((inv) => {
    const zone = (inv.tableId && tableZoneMap.get(inv.tableId)) || 'Ground Floor';
    floorRevenueMap[zone] = (floorRevenueMap[zone] || 0) + (inv.total || 0);
  });

  const allFloors = sortFloors([
    ...FLOOR_TEMPLATE.map((f) => f.zone),
    ...Object.keys(floorRevenueMap),
  ]);

  // Hourly Peak Rush Distribution (0 to 23)
  const hourlyCount: number[] = new Array(24).fill(0);
  filteredInvoices.forEach((inv) => {
    const hour = new Date(inv.timePlaced || inv.timeSettled).getHours();
    hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
  });
  const maxHourOrders = Math.max(...hourlyCount, 1);

  // Top Selling Items
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  filteredInvoices.forEach((inv) => {
    (inv.items || []).forEach((it) => {
      if (!itemMap[it.id]) {
        itemMap[it.id] = { name: it.name, qty: 0, revenue: 0 };
      }
      itemMap[it.id].qty += it.qty;
      itemMap[it.id].revenue += it.qty * it.price;
    });
  });

  const topDishes = Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backRoute as any))}
        >
          <Ionicons name="arrow-back" size={20} color={BRAND.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sultan Business Analytics</Text>
          <Text style={styles.headerSubtitle}>
            5-Floor Revenue, Peak Rush Hours & Best Sellers
          </Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodPills}>
          <TouchableOpacity
            style={[styles.periodPill, period === 'today' && styles.periodPillActive]}
            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
            onPress={() => setPeriod('today')}
          >
            <Text style={[styles.periodPillText, period === 'today' && styles.periodPillTextActive]}>
              24h
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodPill, period === 'week' && styles.periodPillActive]}
            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
            onPress={() => setPeriod('week')}
          >
            <Text style={[styles.periodPillText, period === 'week' && styles.periodPillTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodPill, period === 'all' && styles.periodPillActive]}
            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
            onPress={() => setPeriod('all')}
          >
            <Text style={[styles.periodPillText, period === 'all' && styles.periodPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View
          {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
          style={[
            styles.kpiCard,
            {
              backgroundColor: 'rgba(254, 243, 199, 0.95)',
              borderColor: 'rgba(212, 175, 55, 0.45)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.kpiLabel, { color: '#B45309' }]}>Total Period Sales</Text>
            <Ionicons name="cash" size={16} color="#B45309" />
          </View>
          <Text style={[styles.kpiVal, { color: '#52141C' }]}>{money(totalSales)}</Text>
          <Text style={[styles.kpiMeta, { color: '#78350F' }]}>{totalBills} Invoices Closed</Text>
        </View>
        <View
          {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
          style={[
            styles.kpiCard,
            {
              backgroundColor: 'rgba(240, 249, 255, 0.95)',
              borderColor: 'rgba(2, 132, 199, 0.35)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.kpiLabel, { color: '#0369A1' }]}>Average Ticket Size</Text>
            <Ionicons name="receipt-outline" size={16} color="#0284C7" />
          </View>
          <Text style={[styles.kpiVal, { color: '#0369A1' }]}>{money(avgTicket)}</Text>
          <Text style={[styles.kpiMeta, { color: '#075985' }]}>Spend per Table/Order</Text>
        </View>
        <View
          {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
          style={[
            styles.kpiCard,
            {
              backgroundColor: 'rgba(236, 253, 245, 0.95)',
              borderColor: 'rgba(16, 185, 129, 0.35)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.kpiLabel, { color: '#047857' }]}>Dine-In Revenue Share</Text>
            <Ionicons name="restaurant-outline" size={16} color="#059669" />
          </View>
          <Text style={[styles.kpiVal, { color: '#047857' }]}>
            {percent(dineInSales, totalSales)}%
          </Text>
          <Text style={[styles.kpiMeta, { color: '#065F46' }]}>{money(dineInSales)} in Halls</Text>
        </View>
      </View>

      {/* 5 Floors Revenue Contribution */}
      <View
        {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>Floor-wise Dine-In Revenue Breakdown</Text>
        <Text style={styles.cardSubtitle}>
          {"Sales performance distributed across Sultan's 5 dining levels:"}
        </Text>

        <View style={styles.floorList}>
          {allFloors.map((floor) => {
            const rev = floorRevenueMap[floor] || 0;
            const pct = percent(rev, dineInSales);
            return (
              <View key={floor} style={styles.floorBarRow}>
                <View style={styles.floorLabelRow}>
                  <Text style={styles.floorNameText}>{floor}</Text>
                  <Text style={styles.floorAmountText}>
                    {money(rev)} ({pct}%)
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, pct)}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Channel Breakdown (Dine-In vs Takeaway vs Delivery) */}
      <View
        {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>Order Channels (Revenue & Volume)</Text>
        <View style={styles.channelRow}>
          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.channelCol,
              {
                backgroundColor: 'rgba(236, 253, 245, 0.9)',
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.3)',
              },
            ]}
          >
            <View style={[styles.channelIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="restaurant" size={20} color="#059669" />
            </View>
            <Text style={styles.channelName}>Dine-In</Text>
            <Text style={[styles.channelAmount, { color: '#047857' }]}>{money(dineInSales)}</Text>
            <Text style={[styles.channelMeta, { color: '#065F46' }]}>{dineInInvoices.length} Orders</Text>
          </View>

          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.channelCol,
              {
                backgroundColor: 'rgba(254, 243, 199, 0.9)',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.3)',
              },
            ]}
          >
            <View style={[styles.channelIcon, { backgroundColor: '#FDE68A' }]}>
              <Ionicons name="bag-handle" size={20} color="#D97706" />
            </View>
            <Text style={styles.channelName}>Takeaway</Text>
            <Text style={[styles.channelAmount, { color: '#B45309' }]}>{money(takeawaySales)}</Text>
            <Text style={[styles.channelMeta, { color: '#92400E' }]}>{takeawayInvoices.length} Orders</Text>
          </View>

          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.channelCol,
              {
                backgroundColor: 'rgba(240, 249, 255, 0.9)',
                borderWidth: 1,
                borderColor: 'rgba(2, 132, 199, 0.3)',
              },
            ]}
          >
            <View style={[styles.channelIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="bicycle" size={20} color="#0284C7" />
            </View>
            <Text style={styles.channelName}>Delivery</Text>
            <Text style={[styles.channelAmount, { color: '#0369A1' }]}>{money(deliverySales)}</Text>
            <Text style={[styles.channelMeta, { color: '#075985' }]}>{deliveryInvoices.length} Orders</Text>
          </View>
        </View>
      </View>

      {/* Peak Service Rush Hours (11am to 1am) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Peak Service Hours (Order Traffic)</Text>
        <Text style={styles.cardSubtitle}>
          Highlights the busiest dinner & lunch rushes to optimize kitchen staffing:
        </Text>
        <View style={styles.hourlyContainer}>
          {[12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 0].map((hour) => {
            const count = hourlyCount[hour] || 0;
            const barHeight = Math.max(12, Math.round((count / maxHourOrders) * 90));
            return (
              <View key={hour} style={styles.hourBarWrapper}>
                <Text style={styles.hourBarCount}>{count > 0 ? count : ''}</Text>
                <View style={styles.hourBarColumn}>
                  <View
                    style={[
                      styles.hourBar,
                      {
                        height: barHeight,
                        backgroundColor: count >= maxHourOrders * 0.7 ? '#D32F2F' : BRAND.burgundy,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.hourBarLabel}>{hourLabel(hour)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top 6 Best Sellers */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Menu Revenue Drivers</Text>
        <Text style={styles.cardSubtitle}>Highest grossing dishes across all orders:</Text>

        <View style={styles.topDishesGrid}>
          {topDishes.map((dish, idx) => (
            <View key={idx} style={styles.dishCard}>
              <View style={styles.dishRankBadge}>
                <Text style={styles.dishRankText}>#{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dishName}>{dish.name}</Text>
                <Text style={styles.dishSold}>{dish.qty} portions served</Text>
              </View>
              <Text style={styles.dishRevenue}>{money(dish.revenue)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.ink,
  },
  headerSubtitle: {
    fontSize: 13,
    color: BRAND.muted,
  },
  periodPills: {
    flexDirection: 'row',
    backgroundColor: '#EBEBEF',
    borderRadius: 8,
    padding: 2,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodPillActive: {
    backgroundColor: BRAND.burgundy,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  periodPillTextActive: {
    color: '#fff',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  kpiLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.ink,
  },
  kpiMeta: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  cardSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginBottom: 16,
    marginTop: 2,
  },
  floorList: {
    gap: 12,
  },
  floorBarRow: {
    gap: 4,
  },
  floorLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floorNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  floorAmountText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  barTrack: {
    height: 8,
    backgroundColor: '#F0F0F3',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: BRAND.gold,
    borderRadius: 4,
  },
  channelRow: {
    flexDirection: 'row',
    gap: 12,
  },
  channelCol: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F9F9FB',
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  channelName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  channelAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginTop: 4,
  },
  channelMeta: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  hourlyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 10,
  },
  hourBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  hourBarCount: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '700',
    marginBottom: 4,
  },
  hourBarColumn: {
    height: 95,
    justifyContent: 'flex-end',
  },
  hourBar: {
    width: 14,
    borderRadius: 4,
  },
  hourBarLabel: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 6,
  },
  topDishesGrid: {
    gap: 10,
  },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9FB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  dishRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND.burgundySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
  },
  dishSold: {
    fontSize: 11,
    color: BRAND.muted,
  },
  dishRevenue: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
});
