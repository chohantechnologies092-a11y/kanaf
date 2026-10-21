import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore, MenuItem } from '../store/restaurantStore';
import { useOpsStore } from '../store/opsStore';
import { BRAND } from '../constants/brand';
import { money } from '../utils/format';
import RoyalDropdown from '../components/RoyalDropdown';

export default function ItemAvailabilityScreen({ backRoute = '/kitchen/kds' }: { backRoute?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const menuItems = useRestaurantStore((s) => s.menuItems) || [];
  const categories = useRestaurantStore((s) => s.categories) || [];
  const unavailableIds = useOpsStore((s) => s.unavailableItemIds) || [];
  const setItemAvailability = useOpsStore((s) => s.setItemAvailability);
  const resetAvailability = useOpsStore((s) => s.resetAvailability);

  const [activeCat, setActiveCat] = useState<string>('All');
  const [search, setSearch] = useState('');

  const unavailableSet = new Set(unavailableIds);

  const filteredItems = menuItems.filter((m) => {
    const matchCat = activeCat === 'All' || m.category === activeCat;
    const matchSearch = !search.trim() || m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const outOfStockCount = unavailableIds.length;

  const handleToggle = (item: MenuItem) => {
    const isOut = unavailableSet.has(item.id);
    setItemAvailability(item.id, isOut); // if was out, make available; else make unavailable
  };

  const handleReset = () => {
    const msg = 'Make all menu dishes Available again? (Recommended at start of day/shift)';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) resetAvailability();
    } else {
      Alert.alert('Reset All Dishes', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset All', onPress: resetAvailability },
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
          <Ionicons name="arrow-back" size={20} color={BRAND.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Kitchen Sold-Out (86 List)</Text>
          <Text style={styles.headerSubtitle}>
            Disable Out-of-Stock Dishes Across Waiters, POS & Menu
          </Text>
        </View>
        {outOfStockCount > 0 && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={14} color={BRAND.ink} style={{ marginRight: 4 }} />
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Banner */}
      <View style={styles.kpiBanner}>
        <View style={styles.kpiCol}>
          <Text style={styles.kpiLabel}>Total Menu Dishes</Text>
          <Text style={styles.kpiVal}>{menuItems.length}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiCol}>
          <Text style={styles.kpiLabel}>Live Available</Text>
          <Text style={[styles.kpiVal, { color: BRAND.success }]}>
            {menuItems.length - outOfStockCount}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiCol}>
          <Text style={styles.kpiLabel}>Sold Out (86)</Text>
          <Text style={[styles.kpiVal, { color: outOfStockCount > 0 ? '#D32F2F' : BRAND.muted }]}>
            {outOfStockCount}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={BRAND.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search dish name (e.g. Karahi, Kebab, Kunafa)..."
          placeholderTextColor={BRAND.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={BRAND.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Dropdown Filter */}
      <View style={{ marginBottom: 14 }}>
        <RoyalDropdown
          label="Filter by Category"
          placeholder="All Categories"
          options={[
            {
              label: `All Categories (${menuItems.length})`,
              value: 'All',
              badge: unavailableIds.length > 0 ? `${unavailableIds.length} Sold Out` : undefined,
            },
            ...categories.map((c) => {
              const outCount = menuItems.filter((m) => m.category === c && unavailableSet.has(m.id)).length;
              const totalCount = menuItems.filter((m) => m.category === c).length;
              return {
                label: `${c} (${totalCount})`,
                value: c,
                badge: outCount > 0 ? `${outCount} Out` : undefined,
              };
            }),
          ]}
          value={activeCat}
          onSelect={(c) => setActiveCat(c)}
          icon="restaurant-outline"
          searchable
        />
      </View>

      {/* Items List */}
      <Text style={styles.listTitle}>
        Tap Dish to Toggle In-Stock / Sold-Out ({filteredItems.length})
      </Text>

      <View style={styles.itemsGrid}>
        {filteredItems.map((item) => {
          const isSoldOut = unavailableSet.has(item.id);

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                isSoldOut && styles.itemCardSoldOut,
              ]}
              onPress={() => handleToggle(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, isSoldOut && styles.itemNameSoldOut]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemCat}>{item.category}</Text>
                </View>
                <Text style={styles.itemPrice}>{money(item.price)}</Text>
              </View>

              <View style={styles.itemBottom}>
                <View
                  style={[
                    styles.stockStatusBadge,
                    { backgroundColor: isSoldOut ? '#FFEBEE' : '#E8F5E9' },
                  ]}
                >
                  <Ionicons
                    name={isSoldOut ? 'close-circle' : 'checkmark-circle'}
                    size={14}
                    color={isSoldOut ? '#D32F2F' : '#2E7D32'}
                  />
                  <Text
                    style={[
                      styles.stockStatusText,
                      { color: isSoldOut ? '#D32F2F' : '#2E7D32' },
                    ]}
                  >
                    {isSoldOut ? 'SOLD OUT (86)' : 'AVAILABLE'}
                  </Text>
                </View>

                <View style={[styles.toggleBtn, isSoldOut ? styles.toggleBtnOff : styles.toggleBtnOn]}>
                  <Text style={[styles.toggleBtnText, isSoldOut && { color: BRAND.ink }]}>
                    {isSoldOut ? 'Make Available' : 'Mark Sold Out'}
                  </Text>
                </View>
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
    marginBottom: 16,
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  kpiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 36,
    backgroundColor: BRAND.border,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: BRAND.ink,
  },
  catScroll: {
    marginBottom: 16,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    gap: 6,
  },
  catPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.ink,
  },
  catPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  outBadge: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  outBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.muted,
    marginBottom: 12,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: '48%',
    minWidth: 155,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    justifyContent: 'space-between',
  },
  itemCardSoldOut: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FFCDD2',
    opacity: 0.88,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.ink,
  },
  itemNameSoldOut: {
    textDecorationLine: 'line-through',
    color: '#757575',
  },
  itemCat: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.burgundy,
    marginLeft: 6,
  },
  itemBottom: {
    gap: 8,
  },
  stockStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  toggleBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnOn: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  toggleBtnOff: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D32F2F',
  },
});
