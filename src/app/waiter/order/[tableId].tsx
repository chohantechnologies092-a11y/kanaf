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
  Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, MenuItem, useAuthStore } from '../../../store';
import { getTableFloor, getTableSeatingType, getFloorMeta } from '../../../constants/floors';
import SeatingTypeIcon from '../../../components/SeatingTypeIcon';
import SyncStatusBadge from '../../../components/SyncStatusBadge';
import { broadcastImmediately } from '../../../services/syncService';

const COLORS = ['#FFF3E0', '#E8F5E9', '#E3F2FD', '#FCE4EC', '#E0F7FA'];

export default function TableOrderScreen() {
  const { tableId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const menuColumns = isMobile ? (width < 360 ? 1 : 2) : (width < 1100 ? 2 : 3);

  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu');
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [newCart, setNewCart] = useState<{ item: MenuItem; qty: number; notes?: string }[]>([]);
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [now] = useState(() => Date.now());

  const tables = useRestaurantStore(state => state.tables);
  const tickets = useRestaurantStore(state => state.tickets);
  const menuItems = useRestaurantStore(state => state.menuItems);
  const storeCategories = useRestaurantStore(state => state.categories);
  const dynamicFloors = useRestaurantStore(state => state.floors) || [];
  const placeOrder = useRestaurantStore(state => state.placeOrder);
  const serveTableTickets = useRestaurantStore(state => state.serveTableTickets);
  const updateTicketStatus = useRestaurantStore(state => state.updateTicketStatus);
  const user = useAuthStore(state => state.user);

  const table = tables.find(t => t.id === tableId);
  const tableName = table ? table.name : `Table ${tableId}`;
  const seatingType = table ? getTableSeatingType(table) : 'tables';
  const floorName = table ? getTableFloor(table) : 'Ground Floor';
  const floorMeta = getFloorMeta(floorName, dynamicFloors);
  const isMajlis = seatingType === 'majlis';
  const isCouch = seatingType === 'couches';

  // Find all active tickets placed for this table
  const activeTickets = tickets.filter(t => t.tableId === tableId);
  const isExistingOrderActive = activeTickets.length > 0 || table?.status === 'occupied';

  // Flatten all already ordered items
  const alreadyOrderedItems: { 
    id: string; 
    name: string; 
    price: number; 
    qty: number; 
    status: 'cooking' | 'ready' | 'served';
    ticketId: string;
    timePlaced: number;
  }[] = [];

  if (activeTickets.length > 0) {
    activeTickets.forEach(ticket => {
      ticket.items.forEach(it => {
        alreadyOrderedItems.push({
          id: it.id,
          name: it.name,
          price: it.price,
          qty: it.qty,
          status: ticket.status,
          ticketId: ticket.id,
          timePlaced: ticket.timePlaced,
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
        status: 'served',
        ticketId: 'ORDER-SAVED',
        timePlaced: now,
      });
    });
  }

  const categories = ['All', ...storeCategories];

  const addToCart = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      setVariantModalItem(item);
      return;
    }
    setNewCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleVariantSelect = (variant: {name: string, price: number}) => {
    if (!variantModalItem) return;
    
    const variantId = `${variantModalItem.id}-${variant.name}`;
    const variantName = `${variantModalItem.name} (${variant.name})`;
    const variantItem: MenuItem = {
      id: variantId,
      name: variantName,
      price: variant.price,
      category: variantModalItem.category
    };
    
    setNewCart(prev => {
      const existing = prev.find(i => i.item.id === variantId);
      if (existing) {
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/waiter'));

  const handleSendToKitchen = () => {
    if (newCart.length === 0) return;

    const isAddOn = isExistingOrderActive;
    const orderTakerName = user?.name 
      ? (user.name.includes('(Order Taker)') ? user.name : `${user.name} (Order Taker)`) 
      : 'Sara Ahmed (Order Taker)';
    placeOrder(tableId as string, orderTakerName, newCart, isAddOn);
    broadcastImmediately();

    const message = isAddOn 
      ? `Add-on items sent to Kitchen! (KOT Generated & KDS Notified)`
      : `New order sent to Kitchen! (KOT Generated)`;

    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Kitchen Notified', message);
    }

    setNewCart([]);
    goBack();
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter((i) => {
      if (activeCat !== 'All' && i.category !== activeCat) return false;
      if (searchQuery.trim() && !i.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
      return true;
    });
  }, [menuItems, activeCat, searchQuery]);

  const alreadyOrderedTotal = alreadyOrderedItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const newCartTotal = newCart.reduce((sum, c) => sum + (c.item.price * c.qty), 0);
  const totalBillSoFar = (table?.billTotal || alreadyOrderedTotal) + newCartTotal;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4a121a" />
      
      {/* Top Header */}
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
              <View style={[
                styles.statusBadge, 
                isExistingOrderActive ? styles.statusBadgeOccupied : styles.statusBadgeAvailable
              ]}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: isExistingOrderActive ? '#FF3B30' : '#34C759' }
                ]} />
                <Text style={[
                  styles.statusBadgeText,
                  { color: isExistingOrderActive ? '#FF3B30' : '#2E7D32' }
                ]}>
                  {isExistingOrderActive ? 'ACTIVE ORDER' : 'AVAILABLE'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              <Text style={styles.headerSubtitleType}>
                {isMajlis ? '🕌 Majlis Cabin' : isCouch ? '🛋️ Couch Lounge' : '🍽️ Dining Table'}
              </Text>
              <Text style={styles.headerDot}>•</Text>
              <Text style={[styles.headerSubtitle, isMajlis && { color: '#D5A943', fontWeight: '800' }]}>
                {isMajlis ? `Sitting Capacity: ${table?.seats || 8} Guests` : `${table?.seats || 4} Seats Capacity`}
              </Text>
              <Text style={styles.headerDot}>•</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={floorMeta.icon || 'business-outline'} size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.headerSubtitleFloor}>
                  {floorName}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <SyncStatusBadge compact={isMobile} />
      </View>

      {/* Mobile Mode Tab Switcher */}
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
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Layout */}
      <View style={styles.mainLayout}>
        {/* ================= LEFT / MENU SECTION ================= */}
        {(!isMobile || activeTab === 'menu') && (
          <View style={styles.menuSection}>
            {/* Search Dishes Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search dishes, drinks, appetizers..."
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
              renderItem={({ item, index }) => {
                const inCartItem = newCart.find(c => c.item.id === item.id);
                return (
                  <TouchableOpacity 
                    style={[styles.menuItemCard, { backgroundColor: COLORS[index % COLORS.length] }]}
                    onPress={() => addToCart(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.menuItemCat}>{item.category}</Text>
                      {inCartItem && (
                        <View style={styles.cartCountPill}>
                          <Text style={styles.cartCountPillText}>+{inCartItem.qty}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menuItemName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.cardBottomRow}>
                      <Text style={styles.menuItemPrice}>Rs. {item.price.toLocaleString()}</Text>
                      <View style={styles.addIconCircle}>
                        <Ionicons name="add" size={18} color="#4a121a" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Mobile Floating Review Bar if new items were picked */}
            {isMobile && newCart.length > 0 && (
              <TouchableOpacity 
                style={styles.floatingCartBar}
                onPress={() => setActiveTab('order')}
                activeOpacity={0.9}
              >
                <View style={styles.floatingCartLeft}>
                  <View style={styles.floatingBadge}>
                    <Text style={styles.floatingBadgeText}>{newCart.length}</Text>
                  </View>
                  <Text style={styles.floatingCartText}>
                    {isExistingOrderActive ? 'New Add-on Items' : 'Items Added'}
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

        {/* ================= RIGHT / ORDER & ADD-ON SECTION ================= */}
        {(!isMobile || activeTab === 'order') && (
          <View style={[styles.cartSection, isMobile && styles.cartSectionMobile]}>
            <View style={styles.cartHeader}>
              <View>
                <Text style={styles.cartTitle}>
                  {isExistingOrderActive ? 'Running Table Order' : 'Current Order'}
                </Text>
                <Text style={styles.cartSubtitle}>
                  {isExistingOrderActive 
                    ? `Live Bill: Rs. ${totalBillSoFar.toLocaleString()}` 
                    : 'New Table Guest'}
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

                  {activeTickets.some(t => t.status === 'ready') && (
                    <View style={styles.readyAlertBanner}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="restaurant" size={20} color="#007AFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.readyAlertTitle}>Food is Ready!</Text>
                          <Text style={styles.readyAlertSubtitle}>Kitchen has dispatched orders for this table</Text>
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
                    <Ionicons name="fast-food-outline" size={32} color="#C7C7CC" />
                    <Text style={styles.emptyAddonTitle}>
                      {isExistingOrderActive 
                        ? 'No new items selected' 
                        : 'Your order is currently empty'}
                    </Text>
                    <Text style={styles.emptyAddonDesc}>
                      {isExistingOrderActive 
                        ? 'Tap "Menu Catalog" above to add more drinks, food or desserts for this table.' 
                        : 'Select dishes from the menu catalog to begin taking the order.'}
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
                  newCart.map((c) => (
                    <View key={c.item.id} style={styles.newCartItemRow}>
                      <View style={styles.newCartItemMain}>
                        <Text style={styles.newCartItemName}>{c.item.name}</Text>
                        <Text style={styles.newCartItemUnit}>Rs. {c.item.price.toLocaleString()} each</Text>
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
                  ))
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
                    <Text style={styles.breakdownLabel}>New Add-on:</Text>
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
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.sendButtonText}>
                    {isExistingOrderActive 
                      ? `Send Add-on to Kitchen (Round ${activeTickets.length + 1})` 
                      : 'Send Order to Kitchen (KOT)'}
                  </Text>
                </TouchableOpacity>
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

      {/* Variant Selection Modal */}
      <Modal visible={!!variantModalItem} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxWidth: 400 }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVariantModalItem(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Choose Option</Text>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#666', fontSize: 16 }}>
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
                  <Text style={styles.variantPrice}>Rs. {v.price}</Text>
                </TouchableOpacity>
              ))}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '900',
    color: '#D5A943', // Sultan Gold
  },
  headerSubtitleType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D5A943',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
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
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
  },
  menuSection: {
    flex: 3,
    backgroundColor: '#F8F9FA',
  },
  categoriesBar: {
    flexGrow: 0,
    paddingVertical: 12,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryBadgeActive: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  menuGrid: {
    paddingHorizontal: 14,
    paddingBottom: 80,
  },
  menuGridRow: {
    gap: 10,
    marginBottom: 12,
  },
  menuItemCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuItemCat: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  cartCountPill: {
    backgroundColor: '#4a121a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cartCountPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4a121a',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAFC',
  },
  cartTitle: {
    fontSize: 17,
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtotal: {
    fontSize: 13,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  readyServeBtnText: {
    color: '#fff',
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  existingItemTicket: {
    fontSize: 11,
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
    fontSize: 10,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#3A3A3C',
    marginTop: 10,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  newCartItemUnit: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQty: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
    minWidth: 22,
    textAlign: 'center',
  },
  newCartItemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#27ae60',
    minWidth: 64,
    textAlign: 'right',
    marginRight: 6,
  },
  removeBtn: {
    padding: 6,
  },
  cartFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  billBreakdown: {
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4a121a', // Sultan Burgundy
  },
  sendButton: {
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  backToTablesBtn: {
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  backToTablesBtnText: {
    color: '#4a121a',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 16,
    padding: 24,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  closeBtnText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4a121a',
    textAlign: 'center',
    marginBottom: 8,
  },
  variantBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
  },
  variantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  variantPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D5A943',
  },
});
