import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, useAuthStore } from '../../store';
import {
  sortFloors,
  getFloorMeta,
  getTableFloor,
  getTableSeatingType,
  SeatingZoneType,
  SEATING_ZONES,
  SEATING_ZONE_TYPES,
} from '../../constants/floors';
import SeatingTypeIcon from '../../components/SeatingTypeIcon';
import SyncStatusBadge from '../../components/SyncStatusBadge';
import { broadcastImmediately } from '../../services/syncService';

const BRAND = '#4a121a';

export default function OrderTakerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const columns = width < 520 ? 1 : width < 860 ? 2 : width < 1250 ? 3 : 4;

  // Stores
  const tables = useRestaurantStore((state) => state.tables) || [];
  const tickets = useRestaurantStore((state) => state.tickets) || [];
  const staff = useRestaurantStore((state) => state.staff) || [];
  const dynamicFloors = useRestaurantStore((state) => state.floors) || [];
  const settleBill = useRestaurantStore((state) => state.settleBill);
  const serveTableTickets = useRestaurantStore((state) => state.serveTableTickets);
  const lastBillPaidAlert = useRestaurantStore((state) => state.lastBillPaidAlert);
  const clearBillPaidAlert = useRestaurantStore((state) => state.clearBillPaidAlert);

  const user = useAuthStore((state) => state.user);

  // 1. Reactively lookup active staff member so floor assignment changes by Admin reflect immediately
  const currentStaff = staff.find(
    (s) =>
      (user?.staffId && s.id === user.staffId) ||
      (user?.name && s.name.trim().toLowerCase() === user.name.trim().toLowerCase())
  );

  // 2. Resolve assigned floors
  const assignedZonesList: string[] =
    currentStaff?.assignedZones && currentStaff.assignedZones.length > 0
      ? currentStaff.assignedZones
      : currentStaff?.assignedZone
      ? [currentStaff.assignedZone]
      : user?.assignedZones && user.assignedZones.length > 0
      ? user.assignedZones
      : user?.assignedZone
      ? [user.assignedZone]
      : ['All Floors'];

  const isAllFloors =
    assignedZonesList.includes('All Floors') ||
    assignedZonesList.length === 0;

  // System-wide available floors from store
  const systemFloors = useMemo(() => {
    const configured = (dynamicFloors || []).map((f) => f.name.trim()).filter(Boolean);
    if (configured.length > 0) return configured;
    const discovered = Array.from(new Set(tables.map((t) => getTableFloor(t)).filter(Boolean)));
    return sortFloors(discovered);
  }, [dynamicFloors, tables]);

  // Authorized floors for this specific Order Taker
  const authorizedFloors: string[] = isAllFloors ? systemFloors : assignedZonesList;

  // Active Floor Filter Tab
  const [selectedFloor, setSelectedFloor] = useState<string>('All');
  // Active Seating Zone Filter (All, Tables, Couches, Majlis Cabins)
  const [seatingTypeFilter, setSeatingTypeFilter] = useState<'all' | SeatingZoneType>('all');
  // Search query
  const [search, setSearch] = useState<string>('');

  // Effective active floor
  const activeFloor =
    !isAllFloors && authorizedFloors.length === 1
      ? authorizedFloors[0]
      : selectedFloor !== 'All' && authorizedFloors.includes(selectedFloor)
      ? selectedFloor
      : 'All';

  // 3. Scoped tables by Floor authorization & selected floor tab
  const scopedByFloorTables = useMemo(() => {
    return tables.filter((t) => {
      const tableFloor = getTableFloor(t);
      if (!isAllFloors && !authorizedFloors.some((af) => af.toLowerCase() === tableFloor.toLowerCase())) {
        return false;
      }
      if (activeFloor !== 'All' && tableFloor.toLowerCase() !== activeFloor.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [tables, isAllFloors, authorizedFloors, activeFloor]);

  // 4. Zone Breakdown Summary (how many Tables, Couches, Majlis Cabins on this floor)
  const zoneSummary = useMemo(() => {
    const tablesList = scopedByFloorTables.filter((t) => getTableSeatingType(t) === 'tables');
    const couchesList = scopedByFloorTables.filter((t) => getTableSeatingType(t) === 'couches');
    const majlisList = scopedByFloorTables.filter((t) => getTableSeatingType(t) === 'majlis');

    return {
      tables: {
        count: tablesList.length,
        seats: tablesList.reduce((s, t) => s + t.seats, 0),
        available: tablesList.filter((t) => t.status === 'available').length,
      },
      couches: {
        count: couchesList.length,
        seats: couchesList.reduce((s, t) => s + t.seats, 0),
        available: couchesList.filter((t) => t.status === 'available').length,
      },
      majlis: {
        cabinsCount: majlisList.length,
        sittingCapacity: majlisList.reduce((s, t) => s + t.seats, 0),
        availableCabins: majlisList.filter((t) => t.status === 'available').length,
      },
    };
  }, [scopedByFloorTables]);

  // 5. Final Visible Tables filtered by Seating Type & Search
  const visibleTables = useMemo(() => {
    return scopedByFloorTables.filter((t) => {
      const tType = getTableSeatingType(t);
      if (seatingTypeFilter !== 'all' && tType !== seatingTypeFilter) {
        return false;
      }
      if (search.trim() && !t.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [scopedByFloorTables, seatingTypeFilter, search]);

  // 6. Filter ready tickets to only tables belonging to authorized floors
  const readyTickets = tickets.filter((t) => {
    if (t.status !== 'ready') return false;
    const targetTable = tables.find((tab) => tab.id === t.tableId);
    if (!targetTable) return true;
    const tableFloor = getTableFloor(targetTable);
    if (!isAllFloors && !authorizedFloors.some((af) => af.toLowerCase() === tableFloor.toLowerCase())) return false;
    return true;
  });

  const handleTablePress = (id: string) => {
    router.push(`/waiter/order/${id}`);
  };

  const renderTable = ({ item }: { item: typeof tables[0] }) => {
    const isOccupied = item.status === 'occupied';
    const isBilled = item.status === 'billed' || item.isPaid;

    const tableTickets = tickets.filter((t) => t.tableId === item.id);
    const isFoodReady = tableTickets.some((t) => t.status === 'ready');
    const isCooking = tableTickets.some((t) => t.status === 'cooking');
    const roundCount = tableTickets.length;

    const assignedServer =
      item.server || (tableTickets.length > 0 ? tableTickets[tableTickets.length - 1].server : null);

    const seatingType = getTableSeatingType(item);
    const floorName = getTableFloor(item);
    const floorMeta = getFloorMeta(floorName, dynamicFloors);
    const zoneMeta = SEATING_ZONES[seatingType];

    const isMajlis = seatingType === 'majlis';
    const isCouch = seatingType === 'couches';

    let statusColor = '#34C759'; // Available: Green
    if (isFoodReady) statusColor = '#007AFF'; // Food Ready: Blue
    else if (isBilled) statusColor = '#E67E22'; // Billed/Paid: Orange/Amber
    else if (isOccupied) statusColor = '#D64541'; // Occupied: Red
    else if (item.status === 'reserved') statusColor = '#7D3C98'; // Reserved: Purple

    return (
      <TouchableOpacity
        style={[
          styles.tableCard,
          { borderTopColor: isMajlis ? '#4a121a' : isCouch ? '#E65100' : statusColor },
          isMajlis && styles.majlisTableCard,
          isFoodReady && styles.tableCardFoodReady,
          isBilled && styles.tableCardBilled,
        ]}
        onPress={() => handleTablePress(item.id)}
        activeOpacity={0.8}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View
              style={[
                styles.seatingIconBubble,
                { backgroundColor: isMajlis ? '#4a121a15' : isCouch ? '#E6510015' : '#1976D215' },
              ]}
            >
              <SeatingTypeIcon type={seatingType} size={18} color={zoneMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableName} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Text style={[styles.zoneTypeBadge, { color: zoneMeta.color }]}>
                  {isMajlis ? '🕌 Majlis Cabin' : isCouch ? '🛋️ Couch' : '🍽️ Table'}
                </Text>
                <Text style={styles.dot}>•</Text>
                <Ionicons name={floorMeta.icon || 'business-outline'} size={11} color={floorMeta.color || '#8E8E93'} />
                <Text style={[styles.floorTagText, { color: floorMeta.color || '#8E8E93' }]} numberOfLines={1}>{floorName}</Text>
              </View>
            </View>
          </View>

          {/* Status Indicator Pill */}
          <View style={[styles.statusIndicator, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusIndicatorText, { color: statusColor }]}>
              {isFoodReady ? 'READY' : isBilled ? 'PAID' : item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Capacity Row */}
          <View style={[styles.capacityRow, isMajlis && styles.majlisCapacityRow]}>
            <Ionicons name="people" size={13} color={isMajlis ? '#4a121a' : '#636366'} />
            <Text style={[styles.capacityText, isMajlis && { color: '#4a121a', fontWeight: '800' }]}>
              {isMajlis ? `Sitting Capacity: ${item.seats} Guests` : `${item.seats} Seats Capacity`}
            </Text>
          </View>

          {/* Running Bill and Server */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            {item.billTotal !== undefined && item.billTotal > 0 ? (
              <Text style={styles.billText}>Rs. {item.billTotal.toLocaleString()}</Text>
            ) : (
              <Text style={[styles.freeNoticeText, { color: statusColor }]}>
                {item.status === 'available' ? 'Ready for Guests' : 'No Bill Yet'}
              </Text>
            )}

            {assignedServer && (isOccupied || isBilled) && (
              <View style={styles.waiterBadge}>
                <Ionicons name="person" size={11} color="#4a121a" style={{ marginRight: 3 }} />
                <Text style={styles.waiterBadgeText} numberOfLines={1}>{assignedServer}</Text>
              </View>
            )}
          </View>

          {/* Kitchen Live Status Badges */}
          {isFoodReady && !isBilled && (
            <View style={styles.foodReadyPill}>
              <Ionicons name="restaurant" size={12} color="#007AFF" />
              <Text style={styles.foodReadyPillText}>
                {roundCount > 1 ? `FOOD READY (Round #${roundCount})` : 'FOOD READY AT PASS!'}
              </Text>
            </View>
          )}
          {isCooking && !isFoodReady && !isBilled && (
            <View style={styles.cookingPill}>
              <Ionicons name="flame" size={12} color="#FF9500" />
              <Text style={styles.cookingPillText}>
                {roundCount > 1 ? `Cooking in Kitchen (R#${roundCount})` : 'Order In Kitchen...'}
              </Text>
            </View>
          )}
        </View>

        {/* Card Footer Actions */}
        <View style={[styles.cardFooter, { backgroundColor: isMajlis ? '#4a121a08' : '#F9F9FA' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tapToOrderPrompt}>
              {isOccupied ? 'Tap to view / add items ➔' : isBilled ? 'Guests Seated ➔' : 'Tap to take order ➔'}
            </Text>
          </View>

          {isFoodReady && !isBilled && (
            <TouchableOpacity
              style={styles.serveNowBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                serveTableTickets(item.id);
                broadcastImmediately();
                const msg = `Food marked served for ${item.name}!`;
                if (Platform.OS !== 'web') {
                  Alert.alert('Served', msg);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={14} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.serveNowBtnText}>Serve Now</Text>
            </TouchableOpacity>
          )}

          {isBilled && (
            <TouchableOpacity
              style={styles.releaseTableBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                const msg = `Release ${item.name}? Table will become AVAILABLE for new guests.`;
                if (Platform.OS === 'web') {
                  if (window.confirm(msg)) settleBill(item.id);
                } else {
                  Alert.alert('Release Table', msg, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Release', style: 'destructive', onPress: () => settleBill(item.id) },
                  ]);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.releaseTableBtnText}>Release</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const displayName = currentStaff?.name || user?.name || 'Order Taker';

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <View style={[styles.container, isMobile && { paddingHorizontal: 12 }]}>
        {/* Header Banner */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.screenTitle, isMobile && { fontSize: 19 }]}>Order Taker Terminal</Text>
              <View style={styles.terminalBadge}>
                <Text style={styles.terminalBadgeText}>LIVE POS</Text>
              </View>
            </View>
            <Text style={styles.screenSubtitle}>
              Floor & Zone-based dining tables, couches & Arabian majlis cabins
            </Text>
          </View>
          <SyncStatusBadge compact={isMobile} />
        </View>

        {/* Staff & Floor Assignment Banner */}
        <View style={styles.assignmentBanner}>
          <View style={styles.assignmentBannerLeft}>
            <View
              style={[
                styles.assignmentIconCircle,
                { backgroundColor: !isAllFloors ? '#E8F5E9' : '#EBF3FF' },
              ]}
            >
              <Ionicons
                name={!isAllFloors ? 'business' : 'grid'}
                size={18}
                color={!isAllFloors ? '#2E7D32' : '#007AFF'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.staffNameTitle}>{displayName}</Text>
                <View
                  style={[
                    styles.floorLockBadge,
                    !isAllFloors ? styles.floorLockBadgeActive : styles.floorLockBadgeAll,
                  ]}
                >
                  <Ionicons
                    name={!isAllFloors ? 'lock-closed' : 'earth'}
                    size={11}
                    color={!isAllFloors ? '#2E7D32' : '#007AFF'}
                  />
                  <Text
                    style={[
                      styles.floorLockBadgeText,
                      !isAllFloors ? styles.floorLockBadgeTextActive : styles.floorLockBadgeTextAll,
                    ]}
                  >
                    {!isAllFloors
                      ? `Assigned: ${authorizedFloors.join(', ')}`
                      : 'All Floors (Unrestricted)'}
                  </Text>
                </View>
              </View>
              <Text style={styles.assignmentSubText}>
                Showing {visibleTables.length} unit{visibleTables.length === 1 ? '' : 's'}{' '}
                {activeFloor === 'All' ? 'across authorized floors' : `on ${activeFloor}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tables, couches, cabins by name..."
            placeholderTextColor="#AEAEB2"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        {/* Floor Filter Tabs */}
        {(isAllFloors || authorizedFloors.length > 1) && (
          <View style={{ marginBottom: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floorTabsContent}
            >
              <TouchableOpacity
                style={[
                  styles.floorTab,
                  activeFloor === 'All' && styles.floorTabActive,
                ]}
                onPress={() => setSelectedFloor('All')}
              >
                <Ionicons
                  name="grid-outline"
                  size={13}
                  color={activeFloor === 'All' ? '#fff' : BRAND}
                />
                <Text
                  style={[
                    styles.floorTabText,
                    activeFloor === 'All' && styles.floorTabTextActive,
                  ]}
                >
                  All Floors ({tables.filter((t) => isAllFloors || authorizedFloors.includes(getTableFloor(t))).length})
                </Text>
              </TouchableOpacity>

              {authorizedFloors.map((floor) => {
                const count = tables.filter((t) => getTableFloor(t).toLowerCase() === floor.toLowerCase()).length;
                const meta = getFloorMeta(floor, dynamicFloors);
                const isActive = activeFloor.toLowerCase() === floor.toLowerCase();
                return (
                  <TouchableOpacity
                    key={floor}
                    style={[
                      styles.floorTab,
                      isActive && {
                        backgroundColor: meta.color || BRAND,
                        borderColor: meta.color || BRAND,
                      },
                    ]}
                    onPress={() => setSelectedFloor(floor)}
                  >
                    <Ionicons
                      name={meta.icon || 'business-outline'}
                      size={13}
                      color={isActive ? '#fff' : meta.color || BRAND}
                    />
                    <Text
                      style={[
                        styles.floorTabText,
                        isActive && styles.floorTabTextActive,
                      ]}
                    >
                      {floor} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Seating Zone Type Filter Pills (Tier 2: Tables, Couches, Majlis Cabins) */}
        <View style={{ marginBottom: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            <TouchableOpacity
              style={[
                styles.zoneTypePill,
                seatingTypeFilter === 'all' && styles.zoneTypePillActive,
              ]}
              onPress={() => setSeatingTypeFilter('all')}
            >
              <Text
                style={[
                  styles.zoneTypePillText,
                  seatingTypeFilter === 'all' && { color: '#fff', fontWeight: '800' },
                ]}
              >
                All Types ({scopedByFloorTables.length})
              </Text>
            </TouchableOpacity>

            {SEATING_ZONE_TYPES.map((type) => {
              const meta = SEATING_ZONES[type];
              const isActive = seatingTypeFilter === type;
              const count = scopedByFloorTables.filter((t) => getTableSeatingType(t) === type).length;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.zoneTypePill,
                    isActive && { backgroundColor: meta.color, borderColor: meta.color },
                  ]}
                  onPress={() => setSeatingTypeFilter(type)}
                >
                  <SeatingTypeIcon type={type} size={15} color={isActive ? '#fff' : meta.color} />
                  <Text
                    style={[
                      styles.zoneTypePillText,
                      isActive && { color: '#fff', fontWeight: '800' },
                    ]}
                  >
                    {meta.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Zone Capacity & Cabins Overview Banner (Horizontal scroll on phones, distributed on tablets) */}
        <View style={{ marginBottom: 10 }}>
          <ScrollView
            horizontal={isMobile}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.zoneSummaryContent,
              !isMobile && { width: '100%', justifyContent: 'space-between' },
            ]}
          >
            <View style={[styles.zoneSummaryItem, isMobile && styles.zoneSummaryItemMobile]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <SeatingTypeIcon type="tables" size={14} color="#1976D2" />
                <Text style={[styles.zoneSummaryItemTitle, { color: '#1976D2' }]}>Dining Tables</Text>
              </View>
              <Text style={styles.zoneSummaryCount}>{zoneSummary.tables.count} Tables</Text>
              <Text style={styles.zoneSummarySub}>{zoneSummary.tables.seats} Seats • {zoneSummary.tables.available} Free</Text>
            </View>

            <View style={[styles.zoneSummaryItem, isMobile && styles.zoneSummaryItemMobile]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <SeatingTypeIcon type="couches" size={14} color="#E65100" />
                <Text style={[styles.zoneSummaryItemTitle, { color: '#E65100' }]}>Couches</Text>
              </View>
              <Text style={styles.zoneSummaryCount}>{zoneSummary.couches.count} Couches</Text>
              <Text style={styles.zoneSummarySub}>{zoneSummary.couches.seats} Seats • {zoneSummary.couches.available} Free</Text>
            </View>

            <View style={[styles.zoneSummaryItem, styles.zoneSummaryItemMajlis, isMobile && styles.zoneSummaryItemMobile]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <SeatingTypeIcon type="majlis" size={14} color="#4a121a" />
                <Text style={[styles.zoneSummaryItemTitle, { color: '#4a121a' }]}>Majlis Sitting</Text>
              </View>
              <Text style={[styles.zoneSummaryCount, { color: '#4a121a' }]}>{zoneSummary.majlis.cabinsCount} Cabins</Text>
              <Text style={styles.zoneSummarySub}>{zoneSummary.majlis.sittingCapacity} Guests Capacity • {zoneSummary.majlis.availableCabins} Free</Text>
            </View>
          </ScrollView>
        </View>

        {/* Real-time Bill Paid Alert Banner */}
        {lastBillPaidAlert && (
          <View style={styles.billPaidAlertBanner}>
            <View style={styles.billPaidIconBox}>
              <Ionicons name="card" size={20} color="#E67E22" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.billPaidAlertTitle}>
                🔔 Bill Paid: {lastBillPaidAlert.tableName}!
              </Text>
              <Text style={styles.billPaidAlertDesc}>
                Rs. {lastBillPaidAlert.billTotal?.toLocaleString()} collected. Guests are still seated — tap Release below when vacated.
              </Text>
            </View>
            <TouchableOpacity style={styles.billPaidDismissBtn} onPress={clearBillPaidAlert}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* Notification banner if food is ready for this Order Taker's tables */}
        {readyTickets.length > 0 && (
          <View style={styles.readyAlertBanner}>
            <Ionicons name="notifications" size={20} color="#007AFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.readyAlertTitle}>
                {readyTickets.length} Order{readyTickets.length > 1 ? 's' : ''} Ready for Pickup!
              </Text>
              <Text style={styles.readyAlertDesc}>
                {readyTickets.map((t) => t.tableName).join(', ')} ready at the pass.
              </Text>
            </View>
          </View>
        )}

        {/* Tables & Cabins Grid */}
        {visibleTables.length > 0 ? (
          <FlatList
            data={visibleTables}
            keyExtractor={(item) => item.id}
            renderItem={renderTable}
            numColumns={columns}
            key={`waiter-cols-${columns}`}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={columns > 1 ? styles.rowWrapper : undefined}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No units found</Text>
            <Text style={styles.emptySubtitle}>
              No tables or cabins match the selected filters on{' '}
              <Text style={{ fontWeight: '700', color: '#1C1C1E' }}>
                {activeFloor === 'All' ? authorizedFloors.join(', ') : activeFloor}
              </Text>.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#F8F9FA',
  },
  header: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  terminalBadge: {
    backgroundColor: '#4a121a15',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4a121a30',
  },
  terminalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4a121a',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  assignmentBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  assignmentBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assignmentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffNameTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  floorLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  floorLockBadgeActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  floorLockBadgeAll: {
    backgroundColor: '#EBF3FF',
    borderWidth: 1,
    borderColor: '#D4E2F6',
  },
  floorLockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  floorLockBadgeTextActive: {
    color: '#2E7D32',
  },
  floorLockBadgeTextAll: {
    color: '#007AFF',
  },
  assignmentSubText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
  },

  floorTabsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  floorTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  floorTabActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  floorTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
  },
  floorTabTextActive: {
    color: '#fff',
  },

  // Zone Type Pills
  zoneTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  zoneTypePillActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  zoneTypePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
  },

  // Zone Summary Banner
  zoneSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoneSummaryItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: 3,
  },
  zoneSummaryItemMobile: {
    flex: 0,
    minWidth: 155,
  },
  zoneSummaryItemMajlis: {
    backgroundColor: '#FDFBF8',
    borderColor: '#4a121a30',
  },
  zoneSummaryItemTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  zoneSummaryCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  zoneSummarySub: {
    fontSize: 10,
    color: '#8E8E93',
  },

  readyAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2FF',
    borderWidth: 1,
    borderColor: '#B8D7FF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  readyAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#007AFF',
  },
  readyAlertDesc: {
    fontSize: 12,
    color: '#0051A8',
    marginTop: 2,
  },
  billPaidAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFE082',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  billPaidIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billPaidAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E67E22',
  },
  billPaidAlertDesc: {
    fontSize: 12,
    color: '#8D6E63',
    marginTop: 2,
    lineHeight: 16,
  },
  billPaidDismissBtn: {
    padding: 6,
  },

  listContent: {
    paddingBottom: 28,
  },
  rowWrapper: {
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },

  // Table & Cabin Cards
  tableCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  majlisTableCard: {
    backgroundColor: '#FDFBF8',
    borderColor: '#4a121a30',
  },
  tableCardFoodReady: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  tableCardBilled: {
    borderColor: '#E67E22',
    borderWidth: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    paddingBottom: 6,
  },
  seatingIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  zoneTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
  },
  dot: {
    fontSize: 10,
    color: '#C7C7CC',
  },
  floorTagText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusIndicatorText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  majlisCapacityRow: {
    backgroundColor: '#4a121a10',
  },
  capacityText: {
    fontSize: 11,
    color: '#636366',
    fontWeight: '700',
  },

  billText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  freeNoticeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  waiterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F0E8',
    borderWidth: 1,
    borderColor: '#D5A943',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  waiterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a121a',
  },

  foodReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F2FF',
    borderWidth: 1,
    borderColor: '#B8D7FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  foodReadyPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#007AFF',
  },
  cookingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  cookingPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF9500',
  },

  cardFooter: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0ECE3',
  },
  tapToOrderPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND,
  },
  serveNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
  },
  serveNowBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  releaseTableBtn: {
    backgroundColor: '#E67E22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  releaseTableBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
