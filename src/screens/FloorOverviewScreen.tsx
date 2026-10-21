import { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore } from '../store/restaurantStore';
import { BRAND } from '../constants/brand';
import { FLOOR_TEMPLATE, getFloorMeta, sortFloors, getTableFloor, getTableSeatingType, SEATING_ZONES } from '../constants/floors';
import { money, percent } from '../utils/format';
import SeatingTypeIcon from '../components/SeatingTypeIcon';

export default function FloorOverviewScreen({ backRoute = '/manager/dashboard' }: { backRoute?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const rawTables = useRestaurantStore((s) => s.tables) || [];
  // Deduplicate by id — guards against duplicate-id data from server
  const seenIds = new Set<string>();
  const tables = rawTables.filter((t) => {
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  });
  const tickets = useRestaurantStore((s) => s.tickets) || [];
  const addTable = useRestaurantStore((s) => s.addTable);

  const [selectedFloor, setSelectedFloor] = useState<string>('All');

  // Discover all distinct zones from tables, plus the standard 5 floors
  const allZones = sortFloors([
    ...FLOOR_TEMPLATE.map((f) => f.zone),
    ...tables.map((t) => t.zone),
  ]);

  // Aggregate stats per floor
  const floorStats = allZones.map((zone) => {
    const floorTables = tables.filter((t) => getTableFloor(t).toLowerCase() === zone.toLowerCase());
    const occupied = floorTables.filter((t) => t.status === 'occupied').length;
    const billed = floorTables.filter((t) => t.status === 'billed').length;
    const reserved = floorTables.filter((t) => t.status === 'reserved').length;
    const available = floorTables.filter((t) => t.status === 'available').length;
    const totalRevenue = floorTables.reduce((sum, t) => sum + (t.billTotal || 0), 0);
    const totalSeats = floorTables.reduce((sum, t) => sum + (t.seats || 4), 0);

    const tablesList = floorTables.filter((t) => getTableSeatingType(t) === 'tables');
    const couchesList = floorTables.filter((t) => getTableSeatingType(t) === 'couches');
    const majlisList = floorTables.filter((t) => getTableSeatingType(t) === 'majlis');
    const majlisSeats = majlisList.reduce((sum, t) => sum + (t.seats || 8), 0);

    const floorTableIds = new Set(floorTables.map((t) => t.id));
    const activeTickets = tickets.filter((tk) => floorTableIds.has(tk.tableId));

    const meta = getFloorMeta(zone);

    return {
      zone,
      meta,
      tablesCount: floorTables.length,
      occupied,
      billed,
      reserved,
      available,
      totalRevenue,
      totalSeats,
      tablesZoneCount: tablesList.length,
      couchesZoneCount: couchesList.length,
      majlisCabinsCount: majlisList.length,
      majlisSeats,
      activeTickets: activeTickets.length,
      occupancyRate: percent(occupied + billed, floorTables.length),
    };
  });

  const totalTables = tables.length;
  const totalOccupied = tables.filter((t) => t.status === 'occupied' || t.status === 'billed').length;
  const totalAvailable = tables.filter((t) => t.status === 'available').length;
  const totalActiveRevenue = tables.reduce((sum, t) => sum + (t.billTotal || 0), 0);

  // Filtered tables for the grid view
  const displayTables = selectedFloor === 'All'
    ? tables
    : tables.filter((t) => (t.zone || 'Main Hall').toLowerCase() === selectedFloor.toLowerCase());

  // Function to apply 5-floor template if tables are missing
  const handlePopulateFloors = () => {
    const msg = 'This will generate standard tables across all 5 Sultan floors (Ground, 1st, 2nd Banquet, 3rd VIP, and Rooftop BBQ). Continue?';
    const doPopulate = () => {
      let created = 0;
      FLOOR_TEMPLATE.forEach((f) => {
        const existingForFloor = tables.filter((t) => (t.zone || '').toLowerCase() === f.zone.toLowerCase());
        if (existingForFloor.length === 0) {
          f.seats.forEach((seatCount, idx) => {
            const tableNum = String(idx + 1).padStart(2, '0');
            addTable({
              name: `${f.prefix}-${tableNum}`,
              zone: f.zone,
              seats: seatCount,
              status: 'available',
            });
            created++;
          });
        }
      });
      const notify = created > 0 ? `Successfully set up ${created} tables across the 5 floors!` : 'All 5 floors already have tables configured.';
      if (Platform.OS === 'web') window.alert(notify);
      else Alert.alert('Floors Setup', notify);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doPopulate();
    } else {
      Alert.alert('Setup 5-Floor Template', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Populate', onPress: doPopulate },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backRoute as any))}
        >
          <Ionicons name="arrow-back" size={20} color="#F3D179" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sultan 5-Floor Operations</Text>
          <Text style={styles.headerSubtitle}>Multi-Level Dine-In, Banquet & Rooftop Management</Text>
        </View>
        <TouchableOpacity style={styles.setupBtn} onPress={handlePopulateFloors}>
          <Ionicons name="layers-outline" size={16} color="#24050A" style={{ marginRight: 6 }} />
          <Text style={styles.setupBtnText}>{isMobile ? 'Template' : '5-Floor Template'}</Text>
        </TouchableOpacity>
      </View>

      {/* Top Mega-KPI Bar */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Restaurant Capacity</Text>
          <Text style={styles.kpiValue}>{totalOccupied}/{totalTables} Tables</Text>
          <Text style={styles.kpiMeta}>{percent(totalOccupied, totalTables)}% Seated Across Floors</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Live Running Tabs</Text>
          <Text style={[styles.kpiValue, { color: BRAND.burgundy }]}>{money(totalActiveRevenue)}</Text>
          <Text style={styles.kpiMeta}>Currently Unbilled Diners</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Active Kitchen Tickets</Text>
          <Text style={[styles.kpiValue, { color: '#E65100' }]}>{tickets.length} KOTs</Text>
          <Text style={styles.kpiMeta}>Orders Cooking / Ready</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Available Tables</Text>
          <Text style={[styles.kpiValue, { color: BRAND.success }]}>
            {totalAvailable} Tables
          </Text>
          <Text style={styles.kpiMeta}>Ready for Seating</Text>
        </View>
      </View>

      {/* 5 Floors Cards */}
      <Text style={styles.sectionTitle}>Floor-by-Floor Performance</Text>
      <View style={styles.floorGrid}>
        {floorStats.map((fs) => {
          const isSelected = selectedFloor.toLowerCase() === fs.zone.toLowerCase();
          return (
            <TouchableOpacity
              key={fs.zone}
              style={[
                styles.floorCard,
                isSelected && { borderColor: BRAND.burgundy, borderWidth: 2 },
              ]}
              onPress={() => setSelectedFloor(isSelected ? 'All' : fs.zone)}
              activeOpacity={0.8}
            >
              <View style={styles.floorCardTop}>
                <View style={[styles.floorBadge, { backgroundColor: fs.meta.color + '15' }]}>
                  <Ionicons name={fs.meta.icon as any} size={20} color={fs.meta.color} />
                  <Text style={[styles.floorBadgeText, { color: fs.meta.color }]}>{fs.meta.short}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.floorName}>{fs.zone}</Text>
                  <Text style={styles.floorBlurb} numberOfLines={1}>{fs.meta.blurb}</Text>
                </View>
              </View>

              <View style={styles.floorProgressBar}>
                <View
                  style={[
                    styles.floorProgressFill,
                    {
                      width: `${Math.min(100, fs.occupancyRate)}%`,
                      backgroundColor: fs.occupancyRate > 75 ? '#D32F2F' : fs.meta.color,
                    },
                  ]}
                />
              </View>

              <View style={styles.floorMetricsRow}>
                <View>
                  <Text style={styles.metricLabel}>Occupancy</Text>
                  <Text style={styles.metricVal}>
                    {fs.occupied}/{fs.tablesCount} ({fs.occupancyRate}%)
                  </Text>
                </View>
                <View>
                  <Text style={styles.metricLabel}>Available</Text>
                  <Text style={[styles.metricVal, { color: BRAND.success }]}>{fs.available} Tables</Text>
                </View>
                <View>
                  <Text style={styles.metricLabel}>Active Tab</Text>
                  <Text style={[styles.metricVal, { color: BRAND.burgundy }]}>{money(fs.totalRevenue)}</Text>
                </View>
              </View>

              {/* 3-Zone Distribution Chips */}
              <View style={styles.floorZonesRow}>
                <View style={styles.floorZoneChip}>
                  <SeatingTypeIcon type="tables" size={12} color="#1976D2" />
                  <Text style={styles.floorZoneChipText}>{fs.tablesZoneCount} Tables</Text>
                </View>
                <View style={styles.floorZoneChip}>
                  <SeatingTypeIcon type="couches" size={12} color="#E65100" />
                  <Text style={styles.floorZoneChipText}>{fs.couchesZoneCount} Couches</Text>
                </View>
                <View style={[styles.floorZoneChip, { backgroundColor: '#4a121a15', borderColor: '#4a121a30' }]}>
                  <SeatingTypeIcon type="majlis" size={12} color="#4a121a" />
                  <Text style={[styles.floorZoneChipText, { color: '#4a121a', fontWeight: '800' }]}>
                    {fs.majlisCabinsCount} Cabins ({fs.majlisSeats} Guests)
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filtered Table Grid */}
      <View style={styles.tableSectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {selectedFloor === 'All' ? 'All Tables' : `${selectedFloor} Tables`} ({displayTables.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Tap any table, couch, or cabin to open in Manager Floor Plan or POS
          </Text>
        </View>
        {selectedFloor !== 'All' && (
          <TouchableOpacity style={styles.clearFloorBtn} onPress={() => setSelectedFloor('All')}>
            <Text style={styles.clearFloorBtnText}>Show All Floors</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tablesGrid}>
        {displayTables.map((t) => {
          const type = getTableSeatingType(t);
          const floorName = getTableFloor(t);
          const isMajlis = type === 'majlis';
          const isCouch = type === 'couches';
          const zoneMeta = SEATING_ZONES[type];

          let statusBg = '#E8F5E9';
          let statusText = '#2E7D32';
          if (t.status === 'occupied') {
            statusBg = '#FFEBEE';
            statusText = '#D32F2F';
          } else if (t.status === 'billed') {
            statusBg = '#FFF8E1';
            statusText = '#F57F17';
          } else if (t.status === 'reserved') {
            statusBg = '#EDE7F6';
            statusText = '#512DA8';
          }

          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tableTile, isMajlis && { backgroundColor: '#FFFAF7', borderColor: '#4a121a40' }]}
              onPress={() => router.push(`/manager/pos?prefillTableId=${t.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.tileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <SeatingTypeIcon type={type} size={16} color={zoneMeta.color} />
                  <Text style={styles.tileName} numberOfLines={1}>{t.name}</Text>
                </View>
                <View style={[styles.tileBadge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.tileBadgeText, { color: statusText }]}>
                    {t.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.tileZone, { color: zoneMeta.color }]}>
                {isMajlis ? '🕌 Majlis Cabin' : isCouch ? '🛋️ Couch' : '🍽️ Table'} • {floorName}
              </Text>
              <View style={styles.tileFooter}>
                <Text style={[styles.tileSeats, isMajlis && { color: '#4a121a', fontWeight: '800' }]}>
                  <Ionicons name="people-outline" size={13} color={isMajlis ? '#4a121a' : BRAND.muted} />{' '}
                  {isMajlis ? `${t.seats} Guests Capacity` : `${t.seats} seats`}
                </Text>
                {t.billTotal !== undefined && t.billTotal > 0 && (
                  <Text style={styles.tileBill}>{money(t.billTotal)}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
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
    padding: 16,
    borderRadius: 14,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #380A11 0%, #200408 100%)',
      },
      default: {
        backgroundColor: '#24050A',
      },
    }),
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    shadowColor: '#24050A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F3D179',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  setupBtnText: {
    color: '#24050A',
    fontSize: 13,
    fontWeight: '900',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
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
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: '600',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 2,
  },
  kpiMeta: {
    fontSize: 11,
    color: BRAND.muted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginBottom: 12,
  },
  floorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 28,
  },
  floorCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  floorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  floorBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 1,
  },
  floorName: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  floorBlurb: {
    fontSize: 12,
    color: BRAND.muted,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  alertPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  floorProgressBar: {
    height: 6,
    backgroundColor: '#F0F0F3',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  floorProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  floorMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
  },
  metricLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 2,
  },
  tableSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clearFloorBtn: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearFloorBtnText: {
    color: '#512DA8',
    fontSize: 12,
    fontWeight: '700',
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tableTile: {
    width: 155,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tileName: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.ink,
  },
  tileBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tileBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tileZone: {
    fontSize: 11,
    color: BRAND.muted,
    marginBottom: 8,
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
  },
  tileSeats: {
    fontSize: 11,
    color: BRAND.muted,
  },
  tileBill: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  floorZonesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0EFEA',
  },
  floorZoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  floorZoneChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.ink,
  },
});
