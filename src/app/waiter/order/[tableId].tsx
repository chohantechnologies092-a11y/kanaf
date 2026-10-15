import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  Alert, 
  StatusBar, 
  TextInput, 
  useWindowDimensions, 
  Modal,
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  useRestaurantStore, 
  MenuItem, 
  OrderItem, 
  useAuthStore, 
  useOpsStore,
  Table,
  Invoice
} from '../../../store';
import { getTableFloor, getTableSeatingType, getFloorMeta } from '../../../constants/floors';
import SeatingTypeIcon from '../../../components/SeatingTypeIcon';
import SyncStatusBadge from '../../../components/SyncStatusBadge';
import { broadcastImmediately } from '../../../services/syncService';
import { printInvoiceReceipt } from '../../../components/Invoice';

const PALETTE = ['#FFF3E0', '#E8F5E9', '#E3F2FD', '#FCE4EC', '#F3E5F5', '#E0F7FA'];

const NOTE_PRESETS = [
  '🌶️ Less Spicy',
  '🔥 Extra Spicy',
  '🧅 No Onion',
  '🍟 Extra Crispy',
  '🥗 Starter First',
  '⚡ Jaldi / Rush',
  '🧂 Low Salt',
  '🥡 Pack To-Go',
  '☕ Less Sugar',
  '🧊 Extra Ice',
  '🧀 Extra Cheese',
  '🥣 Extra Raita',
];

export default function TableOrderScreen() {
  const { tableId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const menuColumns = isMobile ? (width < 380 ? 1 : 2) : (width < 1100 ? 2 : 3);

  // Core navigation & filter states
  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu');
  const [activeCat, setActiveCat] = useState('All');
  const [activeStation, setActiveStation] = useState<'all' | 'main' | 'juice' | 'deals'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart & Item customisations
  const [newCart, setNewCart] = useState<{ item: MenuItem; qty: number; notes?: string }[]>([]);
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [dealDetailItem, setDealDetailItem] = useState<MenuItem | null>(null);
  const [editingNoteItem, setEditingNoteItem] = useState<{ item: MenuItem; notes?: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isRushOrder, setIsRushOrder] = useState(false);

  // Modals for Table Operations
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [billSlipModalVisible, setBillSlipModalVisible] = useState(false);
  const [guestCountModalVisible, setGuestCountModalVisible] = useState(false);
  
  // Timestamp for running timers
  const [now] = useState(() => Date.now());

  // Store bindings
  const tables = useRestaurantStore(state => state.tables) || [];
  const tickets = useRestaurantStore(state => state.tickets) || [];
  const menuItems = useRestaurantStore(state => state.menuItems) || [];
  const storeCategories = useRestaurantStore(state => state.categories) || [];
  const dynamicFloors = useRestaurantStore(state => state.floors) || [];
  const placeOrder = useRestaurantStore(state => state.placeOrder);
  const serveTableTickets = useRestaurantStore(state => state.serveTableTickets);
  const updateTicketStatus = useRestaurantStore(state => state.updateTicketStatus);
  const transferTable = useRestaurantStore(state => state.transferTable);
  const markTableBilled = useRestaurantStore(state => state.markTableBilled);
  const updateTable = useRestaurantStore(state => state.updateTable);
  
  // Kitchen 86'd / Unavailable stock check
  const unavailableIds = useOpsStore(state => state.unavailableItemIds) || [];
  const unavailableSet = useMemo(() => new Set(unavailableIds), [unavailableIds]);

  const user = useAuthStore(state => state.user);

  // Support takeaway / express counter or table
  const isTakeaway = tableId === 'takeaway';
  const table = tables.find(t => t.id === tableId);
  const tableName = isTakeaway ? '🛍️ Takeaway / Counter' : (table ? table.name : `Table ${tableId}`);
  const seatingType = table ? getTableSeatingType(table) : 'tables';
  const floorName = isTakeaway ? 'Express Counter' : (table ? getTableFloor(table) : 'Ground Floor');
  const floorMeta = getFloorMeta(floorName, dynamicFloors);
  const isMajlis = seatingType === 'majlis';
  const isCouch = seatingType === 'couches';

  // Active tickets & orders for this table
  const activeTickets = tickets.filter(t => t.tableId === tableId);
  const isExistingOrderActive = activeTickets.length > 0 || table?.status === 'occupied' || table?.status === 'billed';
  const isBilled = table?.status === 'billed' || table?.isPaid;

  // Flatten already placed items
  const alreadyOrderedItems: { 
    id: string; 
    name: string; 
    price: number; 
    qty: number; 
    notes?: string;
    status: 'cooking' | 'ready' | 'served';
    ticketId: string;
    timePlaced: number;
    roundNumber?: number;
  }[] = [];

  if (activeTickets.length > 0) {
    activeTickets.forEach(ticket => {
      ticket.items.forEach(it => {
        alreadyOrderedItems.push({
          id: it.id,
          name: it.name,
          price: it.price,
          qty: it.qty,
          notes: it.notes,
          status: ticket.status,
          ticketId: ticket.id,
          timePlaced: ticket.timePlaced,
          roundNumber: ticket.roundNumber,
        });
      });
    });
  } else if (table && table.orders && table.orders.length > 0) {
    table.orders.forEach(it => {
      alreadyOrderedItems.push({
        id: it.id,
        name: it.name,
        price: it.price,
        qty: it.qty,
        notes: it.notes,
        status: 'served',
        ticketId: 'ORDER-SAVED',
        timePlaced: now,
      });
    });
  }

  // Categories list
  const categories = useMemo(() => {
    return ['All', ...storeCategories];
  }, [storeCategories]);

  // Available tables for transfer
  const availableTransferTables = useMemo(() => {
    return tables.filter(t => t.id !== tableId && t.status === 'available');
  }, [tables, tableId]);

  // Check item availability status
  const getItemStockStatus = (item: MenuItem) => {
    if (unavailableSet.has(item.id)) {
      return { isSoldOut: true, label: 'Sold Out (86\'d)', isLowStock: false };
    }
    if (item.trackStock && typeof item.stockQty === 'number') {
      if (item.stockQty <= 0) {
        return { isSoldOut: true, label: 'Sold Out', isLowStock: false };
      }
      const threshold = item.lowStockThreshold ?? 5;
      if (item.stockQty <= threshold) {
        return { isSoldOut: false, label: `Only ${item.stockQty} Left`, isLowStock: true, remaining: item.stockQty };
      }
    }
    return { isSoldOut: false, label: '', isLowStock: false };
  };

  // Add item to cart with stock guard
  const addToCart = (item: MenuItem) => {
    const stockStatus = getItemStockStatus(item);
    if (stockStatus.isSoldOut) {
      const msg = `"${item.name}" is currently Sold Out in the kitchen.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Item Unavailable', msg);
      return;
    }

    if (item.variants && item.variants.length > 0) {
      setVariantModalItem(item);
      return;
    }

    setNewCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        if (item.trackStock && typeof item.stockQty === 'number' && existing.qty >= item.stockQty) {
          const msg = `Kitchen stock limit reached: Only ${item.stockQty} portions available.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Stock Limit', msg);
          return prev;
        }
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleVariantSelect = (variant: { name: string; price: number }) => {
    if (!variantModalItem) return;
    
    const variantId = `${variantModalItem.id}-${variant.name}`;
    const variantName = `${variantModalItem.name} (${variant.name})`;
    const variantItem: MenuItem = {
      ...variantModalItem,
      id: variantId,
      name: variantName,
      price: variant.price,
    };
    
    setNewCart(prev => {
      const existing = prev.find(i => i.item.id === variantId);
      if (existing) {
        if (variantModalItem.trackStock && typeof variantModalItem.stockQty === 'number' && existing.qty >= variantModalItem.stockQty) {
          const msg = `Kitchen stock limit reached: Only ${variantModalItem.stockQty} portions available.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Stock Limit', msg);
          return prev;
        }
        return prev.map(i => i.item.id === variantId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item: variantItem, qty: 1 }];
    });
    
    setVariantModalItem(null);
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setNewCart(prev => {
      return prev
        .map(i => {
          if (i.item.id === itemId) {
            const itemDef = menuItems.find(m => m.id === i.item.id || i.item.id.startsWith(`${m.id}-`));
            if (delta > 0 && itemDef?.trackStock && typeof itemDef.stockQty === 'number') {
              if (i.qty + delta > itemDef.stockQty) {
                const msg = `Kitchen stock limit: Only ${itemDef.stockQty} portions available.`;
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert('Stock Limit', msg);
                return i;
              }
            }
            const newQty = i.qty + delta;
            return newQty > 0 ? { ...i, qty: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as { item: MenuItem; qty: number; notes?: string }[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setNewCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  // Cooking Instructions Notes Modal
  const openNoteModal = (cartItem: { item: MenuItem; notes?: string }) => {
    setEditingNoteItem(cartItem);
    setNoteDraft(cartItem.notes || '');
  };

  const saveItemNote = () => {
    if (!editingNoteItem) return;
    setNewCart(prev => prev.map(c => {
      if (c.item.id === editingNoteItem.item.id) {
        return { ...c, notes: noteDraft.trim() || undefined };
      }
      return c;
    }));
    setEditingNoteItem(null);
    setNoteDraft('');
  };

  const appendNotePreset = (preset: string) => {
    setNoteDraft(prev => {
      if (!prev.trim()) return preset;
      if (prev.includes(preset)) return prev;
      return `${prev}, ${preset}`;
    });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/waiter'));

  // Place Order / Send to Kitchen KOT
  const handleSendToKitchen = () => {
    if (newCart.length === 0) return;

    const isAddOn = isExistingOrderActive;
    const orderTakerName = user?.name 
      ? (user.name.includes('(Order Taker)') ? user.name : `${user.name} (Order Taker)`) 
      : 'Sara Ahmed (Order Taker)';

    // Prepend Rush Order tag if toggled
    const finalCart = newCart.map(c => {
      if (isRushOrder) {
        const rushPrefix = '⚡ [RUSH / JALDI]';
        const updatedNotes = c.notes ? `${rushPrefix} ${c.notes}` : rushPrefix;
        return { ...c, notes: updatedNotes };
      }
      return c;
    });

    placeOrder(tableId as string, orderTakerName, finalCart, isAddOn);
    broadcastImmediately();

    const roundNum = activeTickets.length + 1;
    const message = isAddOn 
      ? `Add-on items sent to Kitchen! (KOT Round #${roundNum} Generated & KDS Notified)`
      : `New order sent to Kitchen! (KOT Generated & KDS Live)`;

    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Kitchen Notified', message);
    }

    setNewCart([]);
    setIsRushOrder(false);
    goBack();
  };

  // Table Transfer
  const handleTransferTable = (targetTable: Table) => {
    if (!table) return;
    const confirmMsg = `Transfer running order from "${table.name}" to "${targetTable.name}"?`;
    
    const execute = () => {
      transferTable(table.id, targetTable.id);
      broadcastImmediately();
      setTransferModalVisible(false);
      
      const successMsg = `Order successfully moved to ${targetTable.name}!`;
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Table Moved', successMsg);

      router.replace(`/waiter/order/${targetTable.id}`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) execute();
    } else {
      Alert.alert('Confirm Table Transfer', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Move Order', style: 'default', onPress: execute },
      ]);
    }
  };

  // Request Bill from Cashier / Mark Billed
  const handleRequestBill = () => {
    if (!table) return;
    const confirmMsg = `Request final bill for "${table.name}"? This alerts Cashier & Manager POS to print invoice.`;

    const execute = () => {
      markTableBilled(table.id);
      broadcastImmediately();
      const successMsg = `Bill requested! Cashier and Manager POS have been notified.`;
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Bill Requested', successMsg);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) execute();
    } else {
      Alert.alert('Request Final Bill', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Request Bill', style: 'default', onPress: execute },
      ]);
    }
  };

  // Update guest seats
  const handleSetGuestCount = (count: number) => {
    if (!table) return;
    updateTable(table.id, { seats: count });
    broadcastImmediately();
    setGuestCountModalVisible(false);
  };

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((i) => {
      // Station filter
      if (activeStation === 'main' && i.station !== 'main') return false;
      if (activeStation === 'juice' && i.station !== 'juice') return false;
      if (activeStation === 'deals' && !i.isDeal && i.category !== 'Deals') return false;

      // Category filter
      if (activeCat !== 'All' && i.category !== activeCat) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = i.name.toLowerCase().includes(query);
        const matchCat = i.category.toLowerCase().includes(query);
        const matchDesc = i.description ? i.description.toLowerCase().includes(query) : false;
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [menuItems, activeCat, activeStation, searchQuery]);

  // Totals
  const alreadyOrderedTotal = alreadyOrderedItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const newCartTotal = newCart.reduce((sum, c) => sum + (c.item.price * c.qty), 0);
  const totalBillSoFar = (table?.billTotal || alreadyOrderedTotal) + newCartTotal;

  // Running Bill Slip Invoice Payload
  const runningInvoicePreview: Invoice = useMemo(() => {
    const allItems: OrderItem[] = [
      ...alreadyOrderedItems.map(it => ({
        id: it.id,
        name: it.name,
        price: it.price,
        qty: it.qty,
        notes: it.notes,
        completed: it.status === 'served',
      })),
      ...newCart.map(c => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        qty: c.qty,
        notes: c.notes,
        completed: false,
      }))
    ];

    return {
      id: `DRAFT-${tableId}`,
      orderType: isTakeaway ? 'takeaway' : 'dine-in',
      tableName,
      tableId: tableId as string,
      server: table?.server || user?.name || 'Order Taker',
      timePlaced: table?.occupiedSince || now,
      timeSettled: now,
      items: allItems,
      subTotal: totalBillSoFar,
      discount: 0,
      tax: 0,
      total: totalBillSoFar,
      payments: [{ type: 'cash', amount: totalBillSoFar }],
      status: 'settled',
    };
  }, [alreadyOrderedItems, newCart, isTakeaway, tableName, tableId, table, user, now, totalBillSoFar]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />
      
      {/* ================= TOP HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#D5A943" />
          <View style={{ marginLeft: 6, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View
                style={[
                  styles.headerIconBubble,
                  { backgroundColor: isMajlis ? '#D5A94325' : isCouch ? '#E6510025' : '#1976D225' },
                ]}
              >
                <SeatingTypeIcon type={seatingType} size={18} color="#D5A943" />
              </View>
              <Text style={styles.headerTitle}>{tableName}</Text>
              
              {/* Status Badge */}
              <View style={[
                styles.statusBadge, 
                isBilled ? styles.statusBadgeBilled : isExistingOrderActive ? styles.statusBadgeOccupied : styles.statusBadgeAvailable
              ]}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: isBilled ? '#FF9500' : isExistingOrderActive ? '#FF3B30' : '#34C759' }
                ]} />
                <Text style={[
                  styles.statusBadgeText,
                  { color: isBilled ? '#D84315' : isExistingOrderActive ? '#FF3B30' : '#2E7D32' }
                ]}>
                  {isBilled ? 'BILL REQUESTED' : isExistingOrderActive ? 'ACTIVE ORDER' : 'AVAILABLE'}
                </Text>
              </View>
            </View>

            {/* Sub-header with Seating details & Guest Pax */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
              <Text style={styles.headerSubtitleType}>
                {isMajlis ? '🕌 Majlis Cabin' : isCouch ? '🛋️ Couch Lounge' : isTakeaway ? '🛍️ Parcel Counter' : '🍽️ Dining Table'}
              </Text>
              <Text style={styles.headerDot}>•</Text>
              
              {!isTakeaway && (
                <TouchableOpacity 
                  style={styles.paxChip} 
                  onPress={() => setGuestCountModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people" size={11} color="#D5A943" style={{ marginRight: 3 }} />
                  <Text style={styles.paxChipText}>{table?.seats || 4} Guests</Text>
                  <Ionicons name="chevron-down" size={10} color="#D5A943" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              )}
              
              <Text style={styles.headerDot}>•</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={floorMeta.icon || 'business-outline'} size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.headerSubtitleFloor}>{floorName}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Header Quick Action Buttons */}
        <View style={styles.headerActions}>
          {isExistingOrderActive && !isTakeaway && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={() => setTransferModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="swap-horizontal" size={18} color="#D5A943" />
              <Text style={styles.headerIconBtnText}>Move</Text>
            </TouchableOpacity>
          )}

          {isExistingOrderActive && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={() => setBillSlipModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="receipt-outline" size={18} color="#D5A943" />
              <Text style={styles.headerIconBtnText}>Bill Slip</Text>
            </TouchableOpacity>
          )}

          <SyncStatusBadge compact={isMobile} />
        </View>
      </View>

      {/* ================= MOBILE TAB SWITCHER ================= */}
      {isMobile && (
        <View style={styles.mobileTabs}>
          <TouchableOpacity 
            style={[styles.mobileTab, activeTab === 'menu' && styles.mobileTabActive]}
            onPress={() => setActiveTab('menu')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="restaurant-outline" 
              size={16} 
              color={activeTab === 'menu' ? '#4a121a' : '#8E8E93'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.mobileTabText, activeTab === 'menu' && styles.mobileTabTextActive]}>
              Menu Catalog
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mobileTab, activeTab === 'order' && styles.mobileTabActive]}
            onPress={() => setActiveTab('order')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="receipt-outline" 
              size={16} 
              color={activeTab === 'order' ? '#4a121a' : '#8E8E93'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.mobileTabText, activeTab === 'order' && styles.mobileTabTextActive]}>
              Table Order ({alreadyOrderedItems.length + newCart.length})
            </Text>
            {newCart.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>+{newCart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ================= MAIN LAYOUT ================= */}
      <View style={styles.mainLayout}>
        {/* ================= LEFT: MENU SECTION ================= */}
        {(!isMobile || activeTab === 'menu') && (
          <View style={styles.menuSection}>
            {/* Search Bar & Station Toggle */}
            <View style={styles.searchAndStationBar}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search dishes, drinks, deals, karahi..."
                  placeholderTextColor="#AEAEB2"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Station Quick Filter Chips */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stationFilterContainer}
              >
                <TouchableOpacity 
                  style={[styles.stationChip, activeStation === 'all' && styles.stationChipActive]}
                  onPress={() => setActiveStation('all')}
                >
                  <Text style={[styles.stationChipText, activeStation === 'all' && styles.stationChipTextActive]}>
                    All ({menuItems.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.stationChip, activeStation === 'deals' && styles.stationChipActive]}
                  onPress={() => setActiveStation('deals')}
                >
                  <Text style={[styles.stationChipText, activeStation === 'deals' && styles.stationChipTextActive]}>
                    ⭐ Deals & Combos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.stationChip, activeStation === 'main' && styles.stationChipActive]}
                  onPress={() => setActiveStation('main')}
                >
                  <Text style={[styles.stationChipText, activeStation === 'main' && styles.stationChipTextActive]}>
                    🍳 Kitchen
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.stationChip, activeStation === 'juice' && styles.stationChipActive]}
                  onPress={() => setActiveStation('juice')}
                >
                  <Text style={[styles.stationChipText, activeStation === 'juice' && styles.stationChipTextActive]}>
                    🍹 Juice Bar
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Category Pills Bar */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.categoriesBar}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
            >
              {categories.map(cat => {
                const isActive = activeCat === cat;
                return (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.categoryBadge, isActive && styles.categoryBadgeActive]}
                    onPress={() => setActiveCat(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Menu Items Grid */}
            <FlatList
              data={filteredItems}
              keyExtractor={item => item.id}
              numColumns={menuColumns}
              key={`order-menu-cols-${menuColumns}`}
              contentContainerStyle={styles.menuGrid}
              columnWrapperStyle={menuColumns > 1 ? styles.menuGridRow : undefined}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const inCartItem = newCart.find(c => c.item.id === item.id);
                const stockStatus = getItemStockStatus(item);
                const isDeal = item.isDeal || item.category === 'Deals';

                return (
                  <View 
                    style={[
                      styles.menuItemCard, 
                      inCartItem && styles.menuItemCardInCart,
                      stockStatus.isSoldOut && styles.cardSoldOut
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.menuItemCardTouch}
                      onPress={() => addToCart(item)}
                      activeOpacity={stockStatus.isSoldOut ? 0.9 : 0.8}
                    >
                      {/* Visual Thumbnail & Badges */}
                      <View style={styles.cardHeaderArea}>
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={styles.dishThumbnail} resizeMode="cover" />
                        ) : (
                          <View style={styles.dishPlaceholderIcon}>
                            <Ionicons 
                              name={item.station === 'juice' ? 'cafe-outline' : 'restaurant-outline'} 
                              size={18} 
                              color="#8E8E93" 
                            />
                          </View>
                        )}

                        <View style={styles.cardHeaderRight}>
                          <View style={styles.cardTopRow}>
                            <View style={styles.categoryPill}>
                              <Text style={styles.menuItemCat} numberOfLines={1}>{item.category}</Text>
                            </View>
                            {inCartItem && (
                              <View style={styles.cartCountPill}>
                                <Text style={styles.cartCountPillText}>{inCartItem.qty} in cart</Text>
                              </View>
                            )}
                          </View>

                          {/* Badges / Deal Pill / Station */}
                          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                            {item.station === 'juice' && (
                              <View style={styles.stationBadge}>
                                <Text style={styles.stationBadgeText}>JUICE</Text>
                              </View>
                            )}
                            {item.badge && (
                              <View style={styles.specialBadge}>
                                <Text style={styles.specialBadgeText}>{item.badge}</Text>
                              </View>
                            )}
                            {isDeal && (
                              <View style={styles.dealTag}>
                                <Text style={styles.dealTagText}>COMBO DEAL</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Dish Title */}
                      <Text style={[styles.menuItemName, stockStatus.isSoldOut && styles.textSoldOut]} numberOfLines={2}>
                        {item.name}
                      </Text>

                      {/* Stock Status Notification */}
                      {stockStatus.isSoldOut ? (
                        <View style={styles.soldOutPill}>
                          <Ionicons name="close-circle" size={11} color="#C62828" />
                          <Text style={styles.soldOutText}>Sold Out in Kitchen</Text>
                        </View>
                      ) : stockStatus.isLowStock ? (
                        <View style={styles.lowStockPill}>
                          <Ionicons name="alert-circle" size={11} color="#E65100" />
                          <Text style={styles.lowStockText}>{stockStatus.label}</Text>
                        </View>
                      ) : null}

                      {/* Deal Combo Content Preview */}
                      {isDeal && item.dealItems && item.dealItems.length > 0 && (
                        <TouchableOpacity 
                          style={styles.dealItemsPreview} 
                          onPress={() => setDealDetailItem(item)}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <Text style={styles.dealItemsCount} numberOfLines={1}>
                            Includes: {item.dealItems.map(d => `${d.qty}x ${d.name}`).join(', ')}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Price Row */}
                      <View style={styles.cardBottomRow}>
                        <View>
                          <Text style={styles.menuItemPrice}>Rs. {item.price.toLocaleString()}</Text>
                          {item.dealOriginalPrice && (
                            <Text style={styles.dealOriginalPrice}>Rs. {item.dealOriginalPrice.toLocaleString()}</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Quick Add or Quantity Stepper */}
                    <View style={styles.cardActionRow}>
                      {stockStatus.isSoldOut ? (
                        <View style={styles.disabledAddCircle}>
                          <Ionicons name="ban" size={14} color="#8E8E93" />
                        </View>
                      ) : inCartItem ? (
                        <View style={styles.cardInlineStepper}>
                          <TouchableOpacity
                            style={styles.stepperSubBtn}
                            onPress={() => updateCartQty(item.id, -1)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="remove" size={14} color="#C0392B" />
                          </TouchableOpacity>
                          <Text style={styles.cardStepperQty}>{inCartItem.qty}</Text>
                          <TouchableOpacity
                            style={styles.stepperAddBtn}
                            onPress={() => updateCartQty(item.id, 1)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="add" size={14} color="#27AE60" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.quickAddButton}
                          onPress={() => addToCart(item)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="add" size={15} color="#4a121a" style={{ marginRight: 2 }} />
                          <Text style={styles.quickAddText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {/* Mobile Floating Review Bar */}
            {isMobile && newCart.length > 0 && (
              <TouchableOpacity 
                style={styles.floatingCartBar}
                onPress={() => setActiveTab('order')}
                activeOpacity={0.9}
              >
                <View style={styles.floatingCartLeft}>
                  <View style={styles.floatingBadge}>
                    <Text style={styles.floatingBadgeText}>{newCart.reduce((s, c) => s + c.qty, 0)}</Text>
                  </View>
                  <Text style={styles.floatingCartText}>
                    {isExistingOrderActive ? 'New Add-on Round' : 'Table Order Punch'}
                  </Text>
                </View>
                <View style={styles.floatingCartRight}>
                  <Text style={styles.floatingCartPrice}>+Rs. {newCartTotal.toLocaleString()}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ================= RIGHT: ORDER & ADD-ON SECTION ================= */}
        {(!isMobile || activeTab === 'order') && (
          <View style={[styles.cartSection, isMobile && styles.cartSectionMobile]}>
            {/* Cart Header */}
            <View style={styles.cartHeader}>
              <View>
                <Text style={styles.cartTitle}>
                  {isExistingOrderActive ? 'Running Table Order' : 'Current Order Punch'}
                </Text>
                <Text style={styles.cartSubtitle}>
                  {isExistingOrderActive 
                    ? `Live Bill: Rs. ${totalBillSoFar.toLocaleString()}` 
                    : `${tableName} • Guest Order`}
                </Text>
              </View>
              
              {isExistingOrderActive && (
                <View style={styles.activePill}>
                  <Ionicons name="flame" size={13} color="#FF9500" style={{ marginRight: 4 }} />
                  <Text style={styles.activePillText}>{activeTickets.length} Round(s)</Text>
                </View>
              )}
            </View>
            
            <ScrollView style={styles.cartItemsScroll} showsVerticalScrollIndicator={false}>
              {/* SECTION 1: EXISTING ORDER (ALREADY IN KITCHEN) */}
              {isExistingOrderActive && (
                <View style={styles.existingSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="restaurant" size={15} color="#4a121a" />
                      <Text style={styles.sectionTitle}>Already in Kitchen ({alreadyOrderedItems.length})</Text>
                    </View>
                    <Text style={styles.sectionSubtotal}>Rs. {alreadyOrderedTotal.toLocaleString()}</Text>
                  </View>

                  {/* Ready to Serve Alert Banner */}
                  {activeTickets.some(t => t.status === 'ready') && (
                    <View style={styles.readyAlertBanner}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="notifications" size={20} color="#007AFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.readyAlertTitle}>Food is Ready for Table!</Text>
                          <Text style={styles.readyAlertSubtitle}>Kitchen KDS has dispatched dishes</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.readyServeBtn}
                        onPress={() => {
                          serveTableTickets(tableId as string);
                          broadcastImmediately();
                          if (Platform.OS !== 'web') {
                            Alert.alert('Served', 'All ready items marked as served!');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.readyServeBtnText}>Serve All</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {alreadyOrderedItems.map((item, idx) => (
                    <View key={`${item.ticketId}-${idx}`} style={styles.existingItemRow}>
                      <View style={styles.existingQtyBadge}>
                        <Text style={styles.existingQtyText}>{item.qty}x</Text>
                      </View>
                      <View style={styles.existingItemInfo}>
                        <Text style={styles.existingItemName}>{item.name}</Text>
                        {item.notes && (
                          <Text style={styles.existingItemNote}>📝 {item.notes}</Text>
                        )}
                        <Text style={styles.existingItemTicket}>
                          {item.ticketId} • {Math.max(0, Math.floor((now - item.timePlaced) / 60000))}m ago
                        </Text>
                      </View>
                      <View style={styles.existingStatusWrap}>
                        <TouchableOpacity 
                          style={[
                            styles.foodStatusPill, 
                            item.status === 'served' 
                              ? styles.statusServed 
                              : item.status === 'ready' 
                                ? styles.statusReady 
                                : styles.statusCooking
                          ]}
                          onPress={() => {
                            if (item.status === 'ready') {
                              updateTicketStatus(item.ticketId, 'served');
                              broadcastImmediately();
                              if (Platform.OS !== 'web') {
                                Alert.alert('Served', `${item.name} served!`);
                              }
                            }
                          }}
                          disabled={item.status !== 'ready'}
                          activeOpacity={0.7}
                        >
                          <Ionicons 
                            name={
                              item.status === 'served' 
                                ? 'checkmark-done-circle' 
                                : item.status === 'ready' 
                                  ? 'checkmark-circle' 
                                  : 'time-outline'
                            } 
                            size={12} 
                            color={
                              item.status === 'served' 
                                ? '#34C759' 
                                : item.status === 'ready' 
                                  ? '#007AFF' 
                                  : '#FF9500'
                            } 
                            style={{ marginRight: 3 }} 
                          />
                          <Text style={[
                            styles.foodStatusText,
                            { color: item.status === 'served' ? '#34C759' : item.status === 'ready' ? '#007AFF' : '#FF9500' }
                          ]}>
                            {item.status === 'served' ? 'SERVED' : item.status === 'ready' ? 'READY (SERVE)' : 'COOKING'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.existingItemPrice}>Rs. {(item.price * item.qty).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* SECTION 2: NEW ITEMS TO SEND (ROUND 2 / ADD-ON) */}
              <View style={styles.newCartSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons 
                      name={isExistingOrderActive ? "add-circle" : "cart"} 
                      size={16} 
                      color={isExistingOrderActive ? "#FF9500" : "#2E7D32"} 
                    />
                    <Text style={[styles.sectionTitle, { color: isExistingOrderActive ? '#D84315' : '#1C1C1E' }]}>
                      {isExistingOrderActive ? 'New Items to Add (Next Round)' : 'Selected Items'}
                    </Text>
                  </View>
                  {newCart.length > 0 && (
                    <Text style={[styles.sectionSubtotal, { color: '#27ae60' }]}>
                      +Rs. {newCartTotal.toLocaleString()}
                    </Text>
                  )}
                </View>

                {newCart.length === 0 ? (
                  <View style={styles.emptyAddonBox}>
                    <Ionicons name="fast-food-outline" size={36} color="#C7C7CC" />
                    <Text style={styles.emptyAddonTitle}>
                      {isExistingOrderActive 
                        ? 'No new items selected for next round' 
                        : 'Your order punch is currently empty'}
                    </Text>
                    <Text style={styles.emptyAddonDesc}>
                      {isExistingOrderActive 
                        ? 'Tap "Menu Catalog" above to add more drinks, food or desserts for this table.' 
                        : 'Select dishes from the menu catalog to begin taking the guest order.'}
                    </Text>
                    {isMobile && (
                      <TouchableOpacity 
                        style={styles.openMenuBtn}
                        onPress={() => setActiveTab('menu')}
                      >
                        <Ionicons name="add" size={16} color="#4a121a" style={{ marginRight: 4 }} />
                        <Text style={styles.openMenuBtnText}>Browse Menu</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <>
                    {/* Rush Order Priority Flag Toggle */}
                    <TouchableOpacity 
                      style={[styles.rushBanner, isRushOrder && styles.rushBannerActive]}
                      onPress={() => setIsRushOrder(!isRushOrder)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="flash" size={18} color={isRushOrder ? '#D5A943' : '#8E8E93'} />
                        <View>
                          <Text style={[styles.rushBannerTitle, isRushOrder && styles.rushBannerTitleActive]}>
                            {isRushOrder ? '⚡ RUSH / VIP PRIORITY ACTIVE' : 'Mark as Rush Order (Jaldi)'}
                          </Text>
                          <Text style={styles.rushBannerSub}>
                            {isRushOrder ? 'Kitchen KDS will highlight this ticket at the top' : 'Tap to alert chef for urgent delivery'}
                          </Text>
                        </View>
                      </View>
                      <Ionicons 
                        name={isRushOrder ? 'checkbox' : 'square-outline'} 
                        size={20} 
                        color={isRushOrder ? '#D5A943' : '#8E8E93'} 
                      />
                    </TouchableOpacity>

                    {newCart.map((c) => (
                      <View key={c.item.id} style={styles.newCartItemRow}>
                        <View style={styles.newCartItemMain}>
                          <Text style={styles.newCartItemName}>{c.item.name}</Text>
                          <Text style={styles.newCartItemUnit}>Rs. {c.item.price.toLocaleString()} each</Text>

                          {/* Notes / Special Instructions Chip */}
                          <TouchableOpacity 
                            style={[styles.itemNoteChip, c.notes && styles.itemNoteChipActive]}
                            onPress={() => openNoteModal(c)}
                            activeOpacity={0.7}
                          >
                            <Ionicons 
                              name="create-outline" 
                              size={12} 
                              color={c.notes ? '#B8860B' : '#8E8E93'} 
                              style={{ marginRight: 4 }} 
                            />
                            <Text 
                              style={[styles.itemNoteText, c.notes && styles.itemNoteTextActive]} 
                              numberOfLines={1}
                            >
                              {c.notes ? c.notes : '+ Add Cooking Note (e.g. Less Spicy)'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Quantity Stepper */}
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity 
                            style={styles.stepBtn}
                            onPress={() => updateCartQty(c.item.id, -1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="remove" size={16} color="#1C1C1E" />
                          </TouchableOpacity>

                          <Text style={styles.stepQty}>{c.qty}</Text>

                          <TouchableOpacity 
                            style={styles.stepBtn}
                            onPress={() => updateCartQty(c.item.id, 1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={16} color="#1C1C1E" />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.newCartItemTotal}>
                          Rs. {(c.item.price * c.qty).toLocaleString()}
                        </Text>

                        <TouchableOpacity 
                          style={styles.removeBtn}
                          onPress={() => removeFromCart(c.item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </ScrollView>

            {/* Cart Footer */}
            <View style={styles.cartFooter}>
              <View style={styles.billBreakdown}>
                {isExistingOrderActive && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Already In Kitchen:</Text>
                    <Text style={styles.breakdownVal}>Rs. {alreadyOrderedTotal.toLocaleString()}</Text>
                  </View>
                )}
                {newCart.length > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>New Round Add-on:</Text>
                    <Text style={[styles.breakdownVal, { color: '#27ae60' }]}>
                      +Rs. {newCartTotal.toLocaleString()}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Running Bill</Text>
                  <Text style={styles.totalAmount}>Rs. {totalBillSoFar.toLocaleString()}</Text>
                </View>
              </View>
              
              {newCart.length > 0 ? (
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={handleSendToKitchen}
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane" size={18} color="#4a121a" style={{ marginRight: 8 }} />
                  <Text style={styles.sendButtonText}>
                    {isExistingOrderActive 
                      ? `Send Add-on to Kitchen (Round #${activeTickets.length + 1})` 
                      : 'Send Order to Kitchen (KOT)'}
                  </Text>
                </TouchableOpacity>
              ) : isExistingOrderActive && !isTakeaway ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    style={[styles.requestBillBtn, isBilled && styles.requestBillBtnDone]}
                    onPress={handleRequestBill}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name={isBilled ? "checkmark-circle" : "receipt"} 
                      size={16} 
                      color={isBilled ? "#2E7D32" : "#D84315"} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={[styles.requestBillBtnText, isBilled && styles.requestBillBtnTextDone]}>
                      {isBilled ? 'Bill Requested' : 'Request Final Bill'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.backToTablesBtn}
                    onPress={goBack}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-back" size={16} color="#4a121a" style={{ marginRight: 4 }} />
                    <Text style={styles.backToTablesBtnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.backToTablesBtn}
                  onPress={goBack}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={16} color="#4a121a" style={{ marginRight: 6 }} />
                  <Text style={styles.backToTablesBtnText}>Back to Tables Floor</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ================= MODAL 1: COOKING INSTRUCTIONS / ITEM NOTES ================= */}
      <Modal visible={!!editingNoteItem} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 440 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cooking Instructions</Text>
                <Text style={styles.modalSubtitle}>{editingNoteItem?.item.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingNoteItem(null)}>
                <Ionicons name="close-circle" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Quick Presets Grid */}
            <Text style={styles.notePresetTitle}>Tap Quick Kitchen Presets:</Text>
            <View style={styles.notePresetsWrap}>
              {NOTE_PRESETS.map((p) => (
                <TouchableOpacity 
                  key={p} 
                  style={[styles.notePresetChip, noteDraft.includes(p) && styles.notePresetChipActive]}
                  onPress={() => appendNotePreset(p)}
                >
                  <Text style={[styles.notePresetText, noteDraft.includes(p) && styles.notePresetTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Freeform Note Input */}
            <Text style={[styles.notePresetTitle, { marginTop: 14 }]}>Custom Cooking Note:</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Serve extra hot, separate sauces, no garnish..."
              placeholderTextColor="#AEAEB2"
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setEditingNoteItem(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalSaveBtn}
                onPress={saveItemNote}
              >
                <Text style={styles.modalSaveBtnText}>Save Instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 2: VARIANT SELECTION ================= */}
      <Modal visible={!!variantModalItem} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 400 }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVariantModalItem(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Select Size / Portion</Text>
            <Text style={{ textAlign: 'center', marginBottom: 16, color: '#666', fontSize: 15 }}>
              {variantModalItem?.name}
            </Text>

            <View style={{ gap: 10 }}>
              {variantModalItem?.variants?.map((v, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.variantBtn}
                  onPress={() => handleVariantSelect(v)}
                >
                  <Text style={styles.variantName}>{v.name}</Text>
                  <Text style={styles.variantPrice}>Rs. {v.price.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 3: COMBO DEAL DETAILS ================= */}
      <Modal visible={!!dealDetailItem} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 420 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>⭐ Combo Deal Details</Text>
                <Text style={styles.modalSubtitle}>{dealDetailItem?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setDealDetailItem(null)}>
                <Ionicons name="close-circle" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#444', fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
              {dealDetailItem?.description}
            </Text>

            <View style={styles.dealItemsBox}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#52171B', marginBottom: 8, textTransform: 'uppercase' }}>
                Included in this Deal:
              </Text>
              {dealDetailItem?.dealItems?.map((di, idx) => (
                <View key={idx} style={styles.dealItemRow}>
                  <Text style={styles.dealItemQty}>{di.qty}x</Text>
                  <Text style={styles.dealItemName}>{di.name}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 }}>
              <View>
                <Text style={{ fontSize: 11, color: '#888' }}>Deal Price</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#4a121a' }}>
                  Rs. {dealDetailItem?.price.toLocaleString()}
                </Text>
              </View>
              {dealDetailItem?.dealOriginalPrice && (
                <View style={styles.savingsPill}>
                  <Text style={styles.savingsPillText}>
                    Save Rs. {(dealDetailItem.dealOriginalPrice - dealDetailItem.price).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={styles.modalSaveBtn}
              onPress={() => {
                if (dealDetailItem) addToCart(dealDetailItem);
                setDealDetailItem(null);
              }}
            >
              <Text style={styles.modalSaveBtnText}>Add Deal to Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 4: MOVE / TRANSFER TABLE ================= */}
      <Modal visible={transferModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 460, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🔀 Move Table Order</Text>
                <Text style={styles.modalSubtitle}>From: {tableName}</Text>
              </View>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              Select an available table or Majlis cabin to move all active tickets and running orders:
            </Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {availableTransferTables.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Ionicons name="business-outline" size={36} color="#CCC" />
                  <Text style={{ color: '#888', marginTop: 8, fontSize: 13 }}>No other tables currently available.</Text>
                </View>
              ) : (
                availableTransferTables.map((t) => {
                  const sType = getTableSeatingType(t);
                  const fName = getTableFloor(t);
                  return (
                    <TouchableOpacity 
                      key={t.id} 
                      style={styles.transferTableRow}
                      onPress={() => handleTransferTable(t)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <SeatingTypeIcon type={sType} size={18} color="#D5A943" />
                        <View>
                          <Text style={styles.transferTableName}>{t.name}</Text>
                          <Text style={styles.transferTableFloor}>{fName} • {t.seats} Seats</Text>
                        </View>
                      </View>
                      <View style={styles.transferPickBtn}>
                        <Text style={styles.transferPickBtnText}>Move Here</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 5: GUEST COUNT (PAX) ================= */}
      <Modal visible={guestCountModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Guest Count (Pax)</Text>
              <TouchableOpacity onPress={() => setGuestCountModalVisible(false)}>
                <Ionicons name="close-circle" size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#666', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              How many guests are seated at {tableName}?
            </Text>

            <View style={styles.paxSelectorGrid}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                <TouchableOpacity 
                  key={num} 
                  style={[styles.paxBtn, table?.seats === num && styles.paxBtnActive]}
                  onPress={() => handleSetGuestCount(num)}
                >
                  <Text style={[styles.paxBtnText, table?.seats === num && styles.paxBtnTextActive]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 6: RUNNING BILL SLIP PREVIEW ================= */}
      <Modal visible={billSlipModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 440, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🧾 Running Bill Slip</Text>
                <Text style={styles.modalSubtitle}>{tableName}</Text>
              </View>
              <TouchableOpacity onPress={() => setBillSlipModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.slipHeader}>
                <Text style={styles.slipBrand}>SULTAN RESTAURANT</Text>
                <Text style={styles.slipSub}>Table Bill Check • Server: {table?.server || user?.name || 'Sara Ahmed'}</Text>
                <Text style={styles.slipTime}>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>

              <View style={styles.slipDivider} />

              {/* Items List */}
              <View style={{ gap: 6 }}>
                {runningInvoicePreview.items.map((it, idx) => (
                  <View key={idx} style={styles.slipItemRow}>
                    <Text style={styles.slipItemQty}>{it.qty}x</Text>
                    <Text style={styles.slipItemName}>{it.name}</Text>
                    <Text style={styles.slipItemPrice}>Rs. {(it.price * it.qty).toLocaleString()}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.slipDivider} />

              <View style={styles.slipTotalRow}>
                <Text style={styles.slipTotalLabel}>TOTAL AMOUNT:</Text>
                <Text style={styles.slipTotalVal}>Rs. {totalBillSoFar.toLocaleString()}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={styles.modalPrintBtn}
                onPress={() => printInvoiceReceipt(runningInvoicePreview)}
              >
                <Ionicons name="print" size={16} color="#4a121a" style={{ marginRight: 6 }} />
                <Text style={styles.modalPrintBtnText}>Print Bill Slip</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalSaveBtn}
                onPress={() => setBillSlipModalVisible(false)}
              >
                <Text style={styles.modalSaveBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4a121a', // Sultan Burgundy safe area
  },
  header: {
    backgroundColor: '#4a121a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(213, 169, 67, 0.25)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D5A943', // Sultan Gold
  },
  headerSubtitleType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D5A943',
  },
  headerSubtitleFloor: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  headerDot: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  paxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(213, 169, 67, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paxChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D5A943',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.3)',
  },
  headerIconBtnText: {
    color: '#D5A943',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeOccupied: {
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  statusBadgeBilled: {
    backgroundColor: 'rgba(255, 149, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.4)',
  },
  statusBadgeAvailable: {
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mobileTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  mobileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mobileTabActive: {
    borderBottomColor: '#4a121a',
  },
  mobileTabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  mobileTabTextActive: {
    color: '#4a121a',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
  },
  menuSection: {
    flex: 3,
    backgroundColor: '#F8F9FA',
  },
  searchAndStationBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
  },
  stationFilterContainer: {
    paddingHorizontal: 14,
    gap: 6,
  },
  stationChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  stationChipActive: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  stationChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#636366',
  },
  stationChipTextActive: {
    color: '#FFFFFF',
  },
  categoriesBar: {
    flexGrow: 0,
    paddingVertical: 10,
  },
  categoryBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryBadgeActive: {
    backgroundColor: '#D5A943',
    borderColor: '#D5A943',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
  },
  categoryTextActive: {
    color: '#4a121a',
    fontWeight: '800',
  },
  menuGrid: {
    paddingHorizontal: 14,
    paddingBottom: 90,
  },
  menuGridRow: {
    gap: 10,
    marginBottom: 12,
  },
  menuItemCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    minHeight: 125,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1.2,
    borderColor: '#ECE8DF',
  },
  menuItemCardInCart: {
    borderColor: '#D5A943',
    backgroundColor: '#FFFEFA',
  },
  menuItemCardTouch: {
    flex: 1,
  },
  categoryPill: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  cardSoldOut: {
    opacity: 0.55,
    backgroundColor: '#F5F5F5',
  },
  cardHeaderArea: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  dishThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  dishPlaceholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRight: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuItemCat: {
    fontSize: 10,
    color: '#8A6D3B',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cartCountPill: {
    backgroundColor: '#D5A943',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cartCountPillText: {
    color: '#4a121a',
    fontSize: 10,
    fontWeight: '800',
  },
  stationBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  stationBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  specialBadge: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  specialBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B78103',
  },
  dealTag: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dealTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 18,
  },
  textSoldOut: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  soldOutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  soldOutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C62828',
  },
  lowStockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E65100',
  },
  dealItemsPreview: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 6,
  },
  dealItemsCount: {
    fontSize: 10,
    color: '#555',
    fontStyle: 'italic',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#4a121a',
    marginTop: 2,
  },
  dealOriginalPrice: {
    fontSize: 10,
    color: '#8E8E93',
    textDecorationLine: 'line-through',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F2EB',
    paddingTop: 6,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(213, 169, 67, 0.18)',
    borderWidth: 1,
    borderColor: '#D5A943',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickAddText: {
    color: '#4a121a',
    fontSize: 12,
    fontWeight: '800',
  },
  cardInlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#D5A943',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  stepperSubBtn: {
    padding: 3,
  },
  cardStepperQty: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1C1C1E',
    minWidth: 16,
    textAlign: 'center',
  },
  stepperAddBtn: {
    padding: 3,
  },
  addBtn: {
    backgroundColor: '#D5A943',
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  addIconCircle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledAddCircle: {
    backgroundColor: '#E5E5EA',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 4,
    height: 30,
    borderWidth: 1,
    borderColor: '#4a121a',
  },
  cardStepBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepQty: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4a121a',
    minWidth: 16,
    textAlign: 'center',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: '#4a121a',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingBadge: {
    backgroundColor: '#D5A943',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBadgeText: {
    color: '#4a121a',
    fontSize: 12,
    fontWeight: '900',
  },
  floatingCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingCartPrice: {
    color: '#D5A943',
    fontSize: 15,
    fontWeight: '900',
  },
  cartSection: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5EA',
  },
  cartSectionMobile: {
    flex: 1,
    borderLeftWidth: 0,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAFC',
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  cartSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  activePillText: {
    color: '#D84315',
    fontSize: 11,
    fontWeight: '800',
  },
  cartItemsScroll: {
    flex: 1,
  },
  existingSection: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FBFBFD',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1C1E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4a121a',
  },
  readyAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 10,
  },
  readyAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0055B3',
  },
  readyAlertSubtitle: {
    fontSize: 11,
    color: '#4A6984',
    marginTop: 1,
  },
  readyServeBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  readyServeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  existingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  existingQtyBadge: {
    backgroundColor: '#EAEAEF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  existingQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  existingItemInfo: {
    flex: 1,
  },
  existingItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  existingItemNote: {
    fontSize: 11,
    color: '#B8860B',
    marginTop: 1,
    fontStyle: 'italic',
  },
  existingItemTicket: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 1,
  },
  existingStatusWrap: {
    alignItems: 'flex-end',
  },
  foodStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 3,
  },
  statusCooking: {
    backgroundColor: '#FFF3E0',
  },
  statusReady: {
    backgroundColor: '#E3F2FD',
  },
  statusServed: {
    backgroundColor: '#E8F5E9',
  },
  foodStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  existingItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
  },
  newCartSection: {
    padding: 14,
  },
  emptyAddonBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyAddonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3A3A3C',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyAddonDesc: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  openMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F3EC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E8DFC9',
  },
  openMenuBtnText: {
    color: '#4a121a',
    fontSize: 13,
    fontWeight: '700',
  },
  rushBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  rushBannerActive: {
    backgroundColor: '#FFF8E1',
    borderColor: '#D5A943',
  },
  rushBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
  },
  rushBannerTitleActive: {
    color: '#7B5200',
  },
  rushBannerSub: {
    fontSize: 10,
    color: '#888',
  },
  newCartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  newCartItemMain: {
    flex: 1,
  },
  newCartItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  newCartItemUnit: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  itemNoteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    maxWidth: 200,
  },
  itemNoteChipActive: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  itemNoteText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
  },
  itemNoteTextActive: {
    color: '#8A6200',
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
    minWidth: 20,
    textAlign: 'center',
  },
  newCartItemTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#27ae60',
    minWidth: 60,
    textAlign: 'right',
    marginRight: 6,
  },
  removeBtn: {
    padding: 4,
  },
  cartFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  billBreakdown: {
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4a121a', // Sultan Burgundy
  },
  sendButton: {
    backgroundColor: '#D5A943',
    borderWidth: 1.5,
    borderColor: '#E8C76D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonText: {
    color: '#4a121a',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  requestBillBtn: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  requestBillBtnDone: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  requestBillBtnText: {
    color: '#D84315',
    fontSize: 12,
    fontWeight: '800',
  },
  requestBillBtnTextDone: {
    color: '#2E7D32',
  },
  backToTablesBtn: {
    flex: 1,
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  backToTablesBtnText: {
    color: '#4a121a',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4a121a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  closeBtnText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  variantBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
  },
  variantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D5A943',
  },
  notePresetTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  notePresetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  notePresetChip: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  notePresetChipActive: {
    backgroundColor: '#FFF8E1',
    borderColor: '#D5A943',
  },
  notePresetText: {
    fontSize: 11,
    color: '#444',
    fontWeight: '600',
  },
  notePresetTextActive: {
    color: '#7B5200',
    fontWeight: '800',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FAFAFC',
    textAlignVertical: 'top',
    minHeight: 65,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#636366',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#4a121a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#D5A943',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrintBtnText: {
    color: '#4a121a',
    fontWeight: '800',
    fontSize: 13,
  },
  dealItemsBox: {
    backgroundColor: '#FFFBF2',
    borderWidth: 1,
    borderColor: '#FFE8B6',
    borderRadius: 10,
    padding: 12,
  },
  dealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  dealItemQty: {
    fontSize: 12,
    fontWeight: '800',
    color: '#52171B',
  },
  dealItemName: {
    fontSize: 12,
    color: '#333',
  },
  savingsPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D32',
  },
  transferTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  transferTableName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  transferTableFloor: {
    fontSize: 11,
    color: '#8E8E93',
  },
  transferPickBtn: {
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#D5A943',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  transferPickBtnText: {
    color: '#4a121a',
    fontSize: 11,
    fontWeight: '800',
  },
  paxSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  paxBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  paxBtnActive: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  paxBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  paxBtnTextActive: {
    color: '#D5A943',
  },
  slipHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  slipBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4a121a',
    letterSpacing: 1.5,
  },
  slipSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  slipTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },
  slipDivider: {
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  slipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slipItemQty: {
    width: 24,
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  slipItemName: {
    flex: 1,
    fontSize: 12,
    color: '#1C1C1E',
  },
  slipItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  slipTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  slipTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  slipTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4a121a',
  },
});
