import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, useWindowDimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, MenuItem, OrderItem, Payment, Invoice, useAuthStore, useDiscountStore, EventDiscount } from '../../store';
import { calculateOrderDiscount, checkCampaignValidity } from '../../utils/discountCalculator';
import { broadcastImmediately } from '../../services/syncService';
import InvoiceComponent from '../../components/Invoice';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRolePermissions } from '../../store/roleStore';
import PermissionDeniedScreen from '../../components/PermissionDeniedScreen';

function createInvoicePayload(data: Omit<Invoice, 'id' | 'timePlaced' | 'timeSettled'>): Invoice {
  const now = Date.now();
  return {
    ...data,
    id: `INV-${Math.floor(Math.random() * 90000) + 10000}`,
    timePlaced: now,
    timeSettled: now,
  };
}

export default function ManagerPOS() {
  const router = useRouter();
  const { prefillTableId } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu');

  const user = useAuthStore((state) => state.user);
  const { can, canApplyCustomDiscount } = useRolePermissions();

  if (user?.role !== 'admin' && !can('canAccessPOS')) {
    return (
      <PermissionDeniedScreen
        moduleName="POS Billing Terminal"
        urduModuleName="پی او ایس بلنگ ٹرمینل"
        requiredPermission="canAccessPOS"
        backRoute="/manager/dashboard"
      />
    );
  }
  
  const menuItems = useRestaurantStore(state => state.menuItems);
  const categories = useRestaurantStore(state => state.categories);
  const customers = useRestaurantStore(state => state.customers);
  const tables = useRestaurantStore(state => state.tables);
  const zones = useRestaurantStore(state => state.zones);
  const addCustomer = useRestaurantStore(state => state.addCustomer);
  const updateCustomer = useRestaurantStore(state => state.updateCustomer);
  const saveInvoice = useRestaurantStore(state => state.saveInvoice);
  const placeOrder = useRestaurantStore(state => state.placeOrder);
  const settleBill = useRestaurantStore(state => state.settleBill);
  const markTableBilled = useRestaurantStore(state => state.markTableBilled);
  const tickets = useRestaurantStore(state => state.tickets);
  const [selectedServer, setSelectedServer] = useState<string>('');

  // Menu State
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Order State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [loadedCart, setLoadedCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('dine-in');
  
  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Modals
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [pendingOrdersModalVisible, setPendingOrdersModalVisible] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // New Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);

  // Variant Modal
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);

  // Payment & Event Promo State
  const campaigns = useDiscountStore(state => state.campaigns);
  const recordRedemption = useDiscountStore(state => state.recordRedemption);
  const [selectedEventCampaign, setSelectedEventCampaign] = useState<EventDiscount | null>(null);
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [payments, setPayments] = useState<Payment[]>([{ type: 'cash', amount: 0 }]);

  // Table Modal Filter
  const [tableModalZone, setTableModalZone] = useState('All');

  // Print Preview & Post-Payment Table Decision
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [tableDecisionModal, setTableDecisionModal] = useState<{ tableId: string; tableName: string; invoice: any } | null>(null);
  const prefilledRef = useRef<string | null>(null);

  const handleTableSelect = (tId: string) => {
    setSelectedTableId(tId);
    setOrderType('dine-in');
    setTableModalVisible(false);
    
    // Find all active tickets or saved table orders for this table to load running order
    const tableTickets = tickets.filter(t => t.tableId === tId);
    const targetTable = tables.find(t => t.id === tId);
    let combinedItems: OrderItem[] = [];

    if (tableTickets.length > 0) {
      tableTickets.forEach(ticket => {
        ticket.items.forEach(ti => {
          const existing = combinedItems.find(i => i.id === ti.id);
          if (existing) {
            existing.qty += ti.qty;
          } else {
            combinedItems.push({ ...ti });
          }
        });
      });
    } else if (targetTable && targetTable.orders && targetTable.orders.length > 0) {
      combinedItems = targetTable.orders.map(o => ({ ...o }));
    }

    const foundWaiter = targetTable?.server || tableTickets.find(t => t.server && !t.server.toLowerCase().includes('pos'))?.server;
    if (foundWaiter) {
      setSelectedServer(foundWaiter);
    } else {
      setSelectedServer('');
    }

    if (combinedItems.length > 0) {
      setCart(combinedItems);
      setLoadedCart(JSON.parse(JSON.stringify(combinedItems)));
      if (isMobile) {
        setMobileTab('cart');
      }
    } else {
      setCart([]);
      setLoadedCart([]);
    }
  };

  const handleClearSelectedTable = () => {
    if (!selectedTableId) return;
    const targetTable = tables.find(t => t.id === selectedTableId);
    const confirmMsg = `Are you sure you want to release ${targetTable ? targetTable.name : 'this table'}? Active tickets and running bill will be cleared.`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        settleBill(selectedTableId);
        setCart([]);
        setLoadedCart([]);
        setSelectedTableId('');
      }
    } else {
      Alert.alert('Release Table', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Release', 
          style: 'destructive', 
          onPress: () => {
            settleBill(selectedTableId);
            setCart([]);
            setLoadedCart([]);
            setSelectedTableId('');
          } 
        }
      ]);
    }
  };

  useEffect(() => {
    if (prefillTableId && typeof prefillTableId === 'string' && prefilledRef.current !== prefillTableId) {
      prefilledRef.current = prefillTableId;
      setOrderType('dine-in');
      handleTableSelect(prefillTableId);
    }
  }, [prefillTableId]);

  // Computed Items
  const filteredItems = menuItems.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      item.name.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeCategory === 'All') return true;
    if (activeCategory === '🎁 Deals & Combos' || activeCategory === 'Deals') {
      return item.isDeal || item.category === 'Deals';
    }
    return item.category === activeCategory;
  });

  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountVal = parseFloat(discountAmount) || 0;
  const afterDiscount = Math.max(0, subTotal - discountVal);
  const tax = afterDiscount * 0.16;
  const total = afterDiscount + tax;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);
  const selectedTableObj = tables.find(t => t.id === selectedTableId);

  // Auto Recalculate Promo Discount when cart or event campaign changes
  useEffect(() => {
    if (selectedEventCampaign) {
      if (cart.length === 0) {
        setDiscountAmount('0');
        return;
      }
      const cartWithCat = cart.map(ci => {
        const baseId = ci.id.split('-')[0];
        const mi = menuItems.find(m => m.id === baseId || m.id === ci.id);
        return {
          id: ci.id,
          name: ci.name,
          price: ci.price,
          qty: ci.qty,
          category: mi?.category || 'Mains'
        };
      });
      const res = calculateOrderDiscount(selectedEventCampaign, cartWithCat, subTotal);
      if (res.eligible && res.discountAmount > 0) {
        setDiscountAmount(res.discountAmount.toString());
      } else {
        setDiscountAmount('0');
      }
    }
  }, [cart, selectedEventCampaign, subTotal]);

  const handleApplyPromoCampaign = (campaign: EventDiscount) => {
    if (cart.length === 0) {
      const msg = 'Please add items to cart before applying an event promotion.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Cart is Empty', msg);
      return;
    }

    const cartWithCat = cart.map(ci => {
      const baseId = ci.id.split('-')[0];
      const mi = menuItems.find(m => m.id === baseId || m.id === ci.id);
      return {
        id: ci.id,
        name: ci.name,
        price: ci.price,
        qty: ci.qty,
        category: mi?.category || 'Mains'
      };
    });

    const res = calculateOrderDiscount(campaign, cartWithCat, subTotal);
    if (!res.eligible) {
      const msg = res.reason || 'This order does not meet the criteria for this promotion.';
      if (Platform.OS === 'web') window.alert(`⚠️ Promo Ineligible:\n${msg}`);
      else Alert.alert('Ineligible for Promo', msg);
      return;
    }

    setSelectedEventCampaign(campaign);
    setDiscountAmount(res.discountAmount.toString());
    setPromoModalVisible(false);
    setPromoCodeInput('');
    const successMsg = `🎉 Promo "${campaign.title}" applied! Discount: Rs. ${res.discountAmount.toLocaleString()}`;
    if (Platform.OS === 'web') window.alert(successMsg);
    else Alert.alert('Promo Applied', successMsg);
  };

  const handleVerifyPromoCode = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    const matched = campaigns.find(c => c.code.toUpperCase() === code);
    if (!matched) {
      const msg = `Promo code "${code}" not found or invalid.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Code', msg);
      return;
    }

    handleApplyPromoCampaign(matched);
  };

  const handleRemovePromoCampaign = () => {
    setSelectedEventCampaign(null);
    setDiscountAmount('0');
  };

  // Handlers
  const handleOrderTypeChange = (type: 'dine-in' | 'takeaway' | 'delivery') => {
    setOrderType(type);
    if (type === 'dine-in') {
      setSelectedCustomerId('');
      setTableModalVisible(true);
    } else {
      setSelectedTableId('');
      setCustomerSearchQuery('');
      setIsCreatingNewCustomer(false);
      setCustomerModalVisible(true);
    }
  };

  const addToCart = (item: MenuItem) => {
    // Check Stock
    if (item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0) {
      const msg = `⚠️ "${item.name}" is currently Sold Out in kitchen inventory.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sold Out', msg);
      return;
    }

    if (item.variants && item.variants.length > 0) {
      setVariantModalItem(item);
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (item.trackStock && typeof item.stockQty === 'number' && existing.qty >= item.stockQty) {
          const msg = `⚠️ Stock Limit: Only ${item.stockQty} portions of "${item.name}" available.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Stock Limit', msg);
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, completed: false, station: item.station || 'main' }];
    });
  };

  const handleVariantSelect = (variant: {name: string, price: number}) => {
    if (!variantModalItem) return;
    
    if (variantModalItem.trackStock && typeof variantModalItem.stockQty === 'number' && variantModalItem.stockQty <= 0) {
      const msg = `⚠️ "${variantModalItem.name}" is currently Sold Out.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sold Out', msg);
      return;
    }

    // Create a unique ID for this variant combo so different variants don't stack
    const variantId = `${variantModalItem.id}-${variant.name}`;
    const variantName = `${variantModalItem.name} (${variant.name})`;
    
    setCart(prev => {
      const existing = prev.find(i => i.id === variantId);
      if (existing) {
        if (variantModalItem.trackStock && typeof variantModalItem.stockQty === 'number' && existing.qty >= variantModalItem.stockQty) {
          const msg = `⚠️ Stock Limit: Only ${variantModalItem.stockQty} portions available.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Stock Limit', msg);
          return prev;
        }
        return prev.map(i => i.id === variantId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: variantId, name: variantName, price: variant.price, qty: 1, completed: false, station: variantModalItem.station || 'main' }];
    });
    
    setVariantModalItem(null);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        if (delta > 0) {
          const baseId = i.id.split('-')[0];
          const menuItem = menuItems.find(m => m.id === baseId || m.id === i.id);
          if (menuItem && menuItem.trackStock && typeof menuItem.stockQty === 'number' && i.qty >= menuItem.stockQty) {
            const msg = `⚠️ Stock Limit: Only ${menuItem.stockQty} portions available for "${menuItem.name}".`;
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Stock Limit', msg);
            return i;
          }
        }
        return { ...i, qty: Math.max(1, i.qty + delta) };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const handleSaveNewCustomer = () => {
    if (!customerName || !customerPhone) {
      if (Platform.OS === 'web') window.alert("Name and Phone required");
      else Alert.alert("Error", "Name and Phone required");
      return;
    }
    const existing = customers.find(c => c.phone === customerPhone);
    if (existing) {
      updateCustomer(existing.id, { name: customerName, address: customerAddress });
      setSelectedCustomerId(existing.id);
    } else {
      // Create new customer logic (we just add it, and since we don't have direct access to generated ID easily, 
      // we can do a trick to find it by phone)
      addCustomer({ name: customerName, phone: customerPhone, address: customerAddress });
      // Wait for re-render to pick it up, for now we will just hide modal and let user select it from search
      if (Platform.OS === 'web') window.alert("Customer added! Please select them from the list.");
    }
    setIsCreatingNewCustomer(false);
  };

  const sendToKitchen = () => {
    if (cart.length === 0) return;
    if (orderType === 'dine-in' && !selectedTableId) {
      if (Platform.OS === 'web') window.alert("Please select a table first.");
      return;
    }
    
    const tId = orderType === 'dine-in' ? selectedTableId : orderType;
    
    // Map items for KOT (calculate delta from loadedCart)
    const kotItems: {item: MenuItem, qty: number}[] = [];
    cart.forEach(cartItem => {
      const loadedItem = loadedCart.find(i => i.id === cartItem.id);
      const loadedQty = loadedItem ? loadedItem.qty : 0;
      if (cartItem.qty > loadedQty) {
        // Need to recreate a dummy MenuItem for the variant since it doesn't exist directly in menuItems
        const originalId = cartItem.id.split('-')[0];
        const originalMenu = menuItems.find(m => m.id === originalId);
        
        kotItems.push({
          item: {
            id: cartItem.id,
            name: cartItem.name,
            price: cartItem.price,
            category: originalMenu ? originalMenu.category : 'Mains',
            station: (cartItem as any).station || (originalMenu?.station) || 'main'
          },
          qty: cartItem.qty - loadedQty
        });
      }
    });

    if (kotItems.length === 0) {
      if (Platform.OS === 'web') window.alert("No new items to send.");
      else Alert.alert("Info", "No new items to send.");
      return;
    }
    
    const isAddOn = loadedCart.length > 0;
    placeOrder(tId, 'Manager POS', kotItems, isAddOn);
    
    // Update loaded cart so subsequent clicks don't resend
    setLoadedCart(JSON.parse(JSON.stringify(cart)));
    
    const alertMsg = isAddOn 
      ? `Add-on items sent to Kitchen! (KOT Generated & Table Updated)` 
      : `Order sent to Kitchen! Table is now OCCUPIED.`;
    if (Platform.OS === 'web') window.alert(alertMsg);
    else Alert.alert("Kitchen Notified", alertMsg);
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    if (orderType === 'dine-in' && !selectedTableId) {
      if (Platform.OS === 'web') window.alert("Please select a table.");
      return;
    }
    if ((orderType === 'delivery' || orderType === 'takeaway') && !selectedCustomerId) {
      if (Platform.OS === 'web') window.alert("Please select a customer for this order type.");
      return;
    }
    setPayments([{ type: 'cash', amount: total }]);
    setCheckoutModalVisible(true);
  };


  const handleFinalizeOrder = () => {
    if (remaining > 0.01) { // Floating point safety
      if (Platform.OS === 'web') window.alert("Please collect full payment before checking out.");
      else Alert.alert("Incomplete Payment", "Please collect full payment before checking out.");
      return;
    }

    const targetTableId = selectedTableId;
    const targetTableName = selectedTableObj?.name || `Table ${targetTableId}`;
    const wasDineIn = orderType === 'dine-in' && targetTableId;

    // Detect who took the order vs who is cashier
    const targetTableTickets = targetTableId ? tickets.filter(t => t.tableId === targetTableId) : [];
    const waiterFromTickets = targetTableTickets.find(t => t.server && !t.server.toLowerCase().includes('pos'))?.server;
    const waiterFromTable = selectedTableObj?.server && !selectedTableObj.server.toLowerCase().includes('pos') ? selectedTableObj.server : undefined;

    const currentUserName = user?.name ? (user.name.includes('(Manager)') ? user.name : `${user.name} (Manager)`) : 'Ali Khan (Manager)';
    const orderCreator = selectedServer || waiterFromTable || waiterFromTickets || (wasDineIn ? 'Sara Ahmed (Order Taker)' : currentUserName);
    const cashierName = currentUserName;

    const invoice = createInvoicePayload({
      orderType,
      server: orderCreator,
      orderTakenBy: orderCreator,
      cashier: cashierName,
      customer: selectedCustomerObj,
      tableName: selectedTableObj?.name,
      tableId: selectedTableObj?.id,
      items: cart,
      subTotal,
      discount: discountVal,
      discountEventId: selectedEventCampaign?.id,
      discountEventTitle: selectedEventCampaign?.title,
      tax,
      total,
      payments: payments.filter(p => p.amount > 0)
    });

    // Ensure any items not yet sent via KOT are dispatched so kitchen deduction & forecasting capture them
    const unsentKotItems: { item: MenuItem; qty: number }[] = [];
    cart.forEach(cartItem => {
      const loadedQty = loadedCart.filter(lc => lc.id === cartItem.id).reduce((s, lc) => s + lc.qty, 0);
      if (cartItem.qty > loadedQty) {
        const baseMenu = menuItems.find(m => m.id === cartItem.id || cartItem.id.startsWith(`${m.id}-`));
        const itemObj: MenuItem = baseMenu ? {
          ...baseMenu,
          id: cartItem.id,
          name: cartItem.name,
          price: cartItem.price,
          station: cartItem.station || baseMenu.station || 'main'
        } : {
          id: cartItem.id,
          name: cartItem.name,
          price: cartItem.price,
          category: 'Mains',
          station: cartItem.station || 'main'
        };
        unsentKotItems.push({
          item: itemObj,
          qty: cartItem.qty - loadedQty
        });
      }
    });

    if (unsentKotItems.length > 0) {
      const kotTarget = targetTableId || (orderType === 'delivery' ? 'delivery' : 'takeaway');
      placeOrder(kotTarget, cashierName, unsentKotItems, loadedCart.length > 0);
    }

    saveInvoice(invoice);
    broadcastImmediately();
    
    // Log real-time event discount redemption for analytics
    if (selectedEventCampaign && discountVal > 0) {
      const cartWithCat = cart.map(ci => {
        const baseId = ci.id.split('-')[0];
        const mi = menuItems.find(m => m.id === baseId || m.id === ci.id);
        return {
          id: ci.id,
          name: ci.name,
          price: ci.price,
          qty: ci.qty,
          category: mi?.category || 'Mains'
        };
      });
      recordRedemption({
        campaignId: selectedEventCampaign.id,
        invoiceId: invoice.id,
        orderType,
        tableName: selectedTableObj?.name,
        customerName: selectedCustomerObj?.name,
        customerPhone: selectedCustomerObj?.phone,
        grossSales: subTotal,
        discountApplied: discountVal,
        items: cartWithCat
      });
    }

    if (selectedCustomerObj) {
      updateCustomer(selectedCustomerObj.id, {
        totalOrders: selectedCustomerObj.totalOrders + 1,
        totalSpent: selectedCustomerObj.totalSpent + total,
      });
    }

    setCart([]);
    setSelectedEventCampaign(null);
    setDiscountAmount('0');
    setCheckoutModalVisible(false);
    setSelectedCustomerId('');
    setSelectedTableId('');

    if (wasDineIn) {
      // Prompt user whether to release table now or keep it billed because guests are still seated
      setTableDecisionModal({
        tableId: targetTableId,
        tableName: targetTableName,
        invoice,
      });
    } else {
      setGeneratedInvoice(invoice);
    }
  };

  const addPaymentMethod = () => setPayments([...payments, { type: 'cash', amount: 0 }]);
  const updatePayment = (idx: number, field: 'type' | 'amount', value: string) => {
    const newP = [...payments];
    if (field === 'type') {
      newP[idx].type = value as any;
    } else {
      newP[idx].amount = parseFloat(value) || 0;
    }
    setPayments(newP);
  };
  const removePaymentMethod = (idx: number) => {
    if (payments.length > 1) {
      const newP = [...payments];
      newP.splice(idx, 1);
      setPayments(newP);
    }
  };

  return (
    <View style={[styles.container, isMobile && { flexDirection: 'column' }]}>
      {/* Mobile Tab Switcher */}
      {isMobile && (
        <View style={styles.mobileTabBar}>
          <TouchableOpacity
            style={[styles.mobileTabBtn, mobileTab === 'menu' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('menu')}
          >
            <Ionicons name="fast-food-outline" size={17} color={mobileTab === 'menu' ? '#fff' : '#666'} />
            <Text style={[styles.mobileTabBtnText, mobileTab === 'menu' && styles.mobileTabBtnTextActive]}>
              Menu ({filteredItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mobileTabBtn, mobileTab === 'cart' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('cart')}
          >
            <Ionicons name="cart-outline" size={17} color={mobileTab === 'cart' ? '#fff' : '#666'} />
            <Text style={[styles.mobileTabBtnText, mobileTab === 'cart' && styles.mobileTabBtnTextActive]}>
              Cart ({cart.reduce((s, i) => s + i.qty, 0)})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Area */}
      {(!isMobile || mobileTab === 'menu') && (
        <View style={[styles.menuArea, isMobile && { flex: 1, padding: 14, paddingBottom: cart.length > 0 ? 80 : 14 }]}>
          <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={{marginRight: 10}} onPress={() => (router.canGoBack() ? router.back() : router.replace('/manager/dashboard'))}>
                  <Ionicons name="chevron-back" size={26} color="#1C1C1E" />
                </TouchableOpacity>
                <Text style={[styles.title, isMobile && { fontSize: 20 }]}>POS Terminal</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#F6F3EC', 
                    paddingHorizontal: 10, 
                    paddingVertical: 6, 
                    borderRadius: 8, 
                    borderWidth: 1, 
                    borderColor: '#E8DFC9', 
                    gap: 5
                  }} 
                  onPress={() => router.push('/manager/shift')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={16} color="#52171B" />
                  <Text style={{color: '#52171B', fontWeight: '700', fontSize: 12}}>Shift / Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4}} 
                  onPress={() => setPendingOrdersModalVisible(true)}
                >
                  <Ionicons name="list" size={18} color="#2e7d32" />
                  <Text style={{color: '#2e7d32', fontWeight: 'bold', fontSize: 13}}>Pending ({tickets.length})</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.searchBox, isMobile && { width: '100%' }]}>
              <Ionicons name="search" size={18} color="#888" />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search items..." 
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {!searchQuery && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {['All', '🎁 Deals & Combos', ...categories.filter(c => c !== 'Deals' && c !== 'All')].map(cat => (
                <TouchableOpacity 
                  key={cat}
                  style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.itemsGrid}>
              {filteredItems.map(item => {
                const isOut = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0;
                const isLow = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= (item.lowStockThreshold || 5);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard, 
                      isMobile && { width: '47%', minWidth: 130 },
                      isOut && { opacity: 0.65, borderColor: '#ffcdd2', backgroundColor: '#fff9f9' }
                    ]}
                    onPress={() => addToCart(item)}
                    activeOpacity={0.7}
                  >
                    {/* Top Badges */}
                    {item.isDeal ? (
                      <View style={styles.dealBadge}>
                        <Ionicons name="gift" size={10} color="#fff" style={{ marginRight: 3 }} />
                        <Text style={styles.dealBadgeText}>COMBO DEAL</Text>
                      </View>
                    ) : null}

                    {item.badge ? (
                      <View style={[
                        styles.promoBadge,
                        item.badge.includes('Chef') ? { backgroundColor: '#4a121a' } : 
                        item.badge.includes('Best') || item.badge.includes('Popular') ? { backgroundColor: '#D5A943' } :
                        { backgroundColor: '#e67e22' }
                      ]}>
                        <Text style={styles.promoBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}

                    {/* Image / Fallback Container */}
                    {item.imageUri ? (
                      <Image 
                        source={{ uri: item.imageUri }} 
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.itemPlaceholderImage}>
                        <Ionicons name={item.isDeal ? "gift-outline" : "restaurant-outline"} size={26} color="#8E8E93" />
                      </View>
                    )}

                    {/* Item Details */}
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>

                    {/* Deal Breakdown Preview */}
                    {item.isDeal && item.dealItems && item.dealItems.length > 0 && (
                      <View style={styles.dealItemsPreview}>
                        <Text style={styles.dealItemsPreviewText} numberOfLines={2}>
                          {item.dealItems.map(d => `${d.qty}x ${d.name}`).join(' • ')}
                        </Text>
                      </View>
                    )}

                    {/* Variant Indicator */}
                    {item.variants && item.variants.length > 0 && (
                      <View style={styles.variantBadge}>
                        <Ionicons name="options-outline" size={11} color="#4a121a" />
                        <Text style={styles.variantBadgeText}>{item.variants.length} Sizes</Text>
                      </View>
                    )}

                    {/* Price & Savings */}
                    <View style={styles.priceRow}>
                      <Text style={styles.itemPrice}>Rs. {item.price.toLocaleString()}</Text>
                      {item.dealOriginalPrice && item.dealOriginalPrice > item.price ? (
                        <Text style={styles.itemOriginalPrice}>Rs. {item.dealOriginalPrice.toLocaleString()}</Text>
                      ) : null}
                    </View>

                    {/* Stock Status Indicator */}
                    {item.trackStock && (
                      <View style={[
                        styles.stockPill,
                        isOut ? styles.stockPillOut : (isLow ? styles.stockPillLow : styles.stockPillIn)
                      ]}>
                        <View style={[
                          styles.stockDot,
                          isOut ? { backgroundColor: '#d32f2f' } : (isLow ? { backgroundColor: '#ef6c00' } : { backgroundColor: '#2e7d32' })
                        ]} />
                        <Text style={[
                          styles.stockPillText,
                          isOut ? { color: '#d32f2f' } : (isLow ? { color: '#ef6c00' } : { color: '#2e7d32' })
                        ]}>
                          {isOut ? 'Sold Out' : (isLow ? `Low: ${item.stockQty} left` : `${item.stockQty} in stock`)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {filteredItems.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center', width: '100%' }}>
                  <Ionicons name="search-outline" size={40} color="#ccc" />
                  <Text style={{ marginTop: 10, color: '#888', fontSize: 15 }}>No matching menu items found</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Floating Cart Button on Mobile */}
          {isMobile && cart.length > 0 && (
            <TouchableOpacity style={styles.floatingCartBar} onPress={() => setMobileTab('cart')}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <View style={styles.floatingCartBadge}>
                  <Text style={styles.floatingCartBadgeText}>{cart.reduce((s, i) => s + i.qty, 0)}</Text>
                </View>
                <Text style={styles.floatingCartText}>View Order Cart</Text>
              </View>
              <Text style={styles.floatingCartPrice}>Rs. {total.toFixed(0)}  →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cart Area */}
      {(!isMobile || mobileTab === 'cart') && (
        <View style={[styles.cartArea, isMobile && { flex: 1, borderLeftWidth: 0, width: '100%' }]}>
          {isMobile && (
            <TouchableOpacity style={styles.backToMenuBtn} onPress={() => setMobileTab('menu')}>
              <Ionicons name="arrow-back" size={18} color="#4a121a" />
              <Text style={styles.backToMenuText}>Add More Items</Text>
            </TouchableOpacity>
          )}

          {/* Order Type & Meta */}
          <View style={styles.orderOptions}>
            <View style={styles.typeSelector}>
              {['dine-in', 'takeaway', 'delivery'].map(type => (
                <TouchableOpacity 
                  key={type}
                  style={[styles.typeBtn, orderType === type && styles.typeBtnActive]}
                  onPress={() => handleOrderTypeChange(type as any)}
                >
                  <Text style={[styles.typeBtnText, orderType === type && styles.typeBtnTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {orderType === 'dine-in' && (
              <View style={styles.metaSection}>
                {selectedTableObj ? (
                  <View style={styles.selectedMetaTableCard}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.metaName}>Table: {selectedTableObj.name}</Text>
                        <View style={[
                          styles.tableStatusPill, 
                          selectedTableObj.status === 'available' ? styles.statusAvail : styles.statusOcc
                        ]}>
                          <Text style={styles.tableStatusPillText}>
                            {selectedTableObj.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.metaSub}>
                        {selectedTableObj.zone} • {selectedTableObj.seats} Seats 
                        {selectedTableObj.server ? ` • Server: ${selectedTableObj.server}` : ''}
                      </Text>
                      {(selectedTableObj.status === 'occupied' || selectedTableObj.status === 'billed') && (
                        <Text style={styles.metaRunningBill}>
                          Live Running Bill: Rs. {(selectedTableObj.billTotal || subTotal).toLocaleString()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity 
                        style={styles.changeTableBtn}
                        onPress={() => setTableModalVisible(true)}
                      >
                        <Ionicons name="swap-horizontal" size={16} color="#4a121a" style={{ marginRight: 4 }} />
                        <Text style={styles.changeTableBtnText}>Change</Text>
                      </TouchableOpacity>
                      {(selectedTableObj.status === 'occupied' || selectedTableObj.status === 'billed') && (
                        <TouchableOpacity 
                          style={styles.resetTableBtn}
                          onPress={handleClearSelectedTable}
                        >
                          <Ionicons name="refresh" size={14} color="#e74c3c" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectMetaBtn} onPress={() => setTableModalVisible(true)}>
                    <Ionicons name="grid-outline" size={16} color="#4a121a" style={{ marginRight: 6 }} />
                    <Text style={styles.selectMetaBtnText}>Select Dining Table</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {(orderType === 'takeaway' || orderType === 'delivery') && (
              <View style={styles.metaSection}>
                {selectedCustomerObj ? (
                  <View style={styles.selectedMeta}>
                    <View>
                      <Text style={styles.metaName}>{selectedCustomerObj.name}</Text>
                      <Text style={styles.metaSub}>{selectedCustomerObj.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCustomerModalVisible(true)}>
                      <Ionicons name="pencil" size={20} color="#4a121a" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectMetaBtn} onPress={() => setCustomerModalVisible(true)}>
                    <Text style={styles.selectMetaBtnText}>Select Customer</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Cart List */}
          <ScrollView style={styles.cartScroll} showsVerticalScrollIndicator={false}>
            {cart.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="cart-outline" size={44} color="#ccc" />
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 10, fontSize: 14 }}>
                  Cart is empty. Tap menu items to add.
                </Text>
              </View>
            ) : (
              cart.map(item => {
                const baseId = item.id.split('-')[0];
                const baseMenu = menuItems.find(m => m.id === baseId || m.id === item.id);

                return (
                  <View key={item.id} style={styles.cartItem}>
                    {/* Item Thumbnail */}
                    {baseMenu?.imageUri ? (
                      <Image source={{ uri: baseMenu.imageUri }} style={styles.cartItemThumb} />
                    ) : (
                      <View style={styles.cartItemPlaceholder}>
                        <Ionicons name={baseMenu?.isDeal ? "gift" : "restaurant"} size={14} color="#4a121a" />
                      </View>
                    )}

                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                      {baseMenu?.isDeal && baseMenu?.dealItems && baseMenu.dealItems.length > 0 && (
                        <Text style={styles.cartDealBreakdown} numberOfLines={1}>
                          Includes: {baseMenu.dealItems.map(d => `${d.qty}x ${d.name}`).join(', ')}
                        </Text>
                      )}
                      <Text style={styles.cartItemPrice}>
                        Rs. {item.price.toLocaleString()} × {item.qty} = <Text style={{ fontWeight: '800', color: '#4a121a' }}>Rs. {(item.price * item.qty).toLocaleString()}</Text>
                      </Text>
                    </View>

                    <View style={styles.qtyControls}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFromCart(item.id)}>
                        <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.cartFooter}>
            <View style={styles.kotRow}>
               <TouchableOpacity style={[styles.kotBtn, cart.length === 0 && {opacity: 0.5}]} onPress={sendToKitchen} disabled={cart.length===0}>
                 <Ionicons name="flame-outline" size={20} color="#e67e22" />
                 <Text style={styles.kotBtnText}>Hold Order & Send to Kitchen</Text>
               </TouchableOpacity>
            </View>
            
            {/* Event Promo Deal Selector */}
            <View style={{ marginVertical: 6 }}>
              {selectedEventCampaign ? (
                <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 8, padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="ticket" size={14} color="#52171B" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#52171B' }}>
                        [{selectedEventCampaign.code}] {selectedEventCampaign.title}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                      {selectedEventCampaign.type === 'percentage' ? `${selectedEventCampaign.value}% off` : `Rs. ${selectedEventCampaign.value} off`} • Savings: Rs. {discountVal.toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleRemovePromoCampaign} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#C62828" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF0F2', borderColor: '#FECACA', borderWidth: 1, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => setPromoModalVisible(true)}
                >
                  <Ionicons name="pricetag" size={14} color="#52171B" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#52171B' }}>
                    🎟️ Select Event Promo Deal / Code
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.discountRow}>
              <Text style={styles.label}>Discount (Rs): </Text>
              <TextInput 
                style={styles.discountInput}
                keyboardType="numeric"
                value={discountAmount}
                onChangeText={setDiscountAmount}
              />
            </View>
            
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>Rs. {subTotal.toFixed(0)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>- Rs. {discountVal.toFixed(0)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax (16%)</Text>
              <Text style={styles.totalsValue}>Rs. {tax.toFixed(0)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>Rs. {total.toFixed(0)}</Text>
            </View>
            
            <TouchableOpacity style={[styles.checkoutBtn, cart.length === 0 && {opacity: 0.5}]} onPress={openCheckout} disabled={cart.length === 0}>
              <Text style={styles.checkoutBtnText}>Checkout & Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Promo Code & Event Campaign Modal */}
      <Modal visible={promoModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentLarge, { maxWidth: 580, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Active Event Promotions</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  Apply coupon code or tap an active promotional campaign
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPromoModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Quick Promo Code Input */}
            <View style={{ flexDirection: 'row', gap: 8, padding: 14, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1 }]}
                placeholder="ENTER COUPON CODE (e.g. BBQ15)..."
                value={promoCodeInput}
                onChangeText={setPromoCodeInput}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { paddingHorizontal: 16 }]}
                onPress={handleVerifyPromoCode}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Apply</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 14 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 }}>
                Live Campaigns for Today:
              </Text>

              {campaigns.filter(c => checkCampaignValidity(c).isValid).length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="pricetag-outline" size={40} color="#999" />
                  <Text style={{ color: '#666', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                    No promotional campaigns currently active for today. Create or schedule one in the Events & Discounts module.
                  </Text>
                </View>
              ) : (
                campaigns
                  .filter(c => checkCampaignValidity(c).isValid)
                  .map(camp => {
                    const cartWithCat = cart.map(ci => {
                      const baseId = ci.id.split('-')[0];
                      const mi = menuItems.find(m => m.id === baseId || m.id === ci.id);
                      return {
                        id: ci.id,
                        name: ci.name,
                        price: ci.price,
                        qty: ci.qty,
                        category: mi?.category || 'Mains'
                      };
                    });
                    const check = calculateOrderDiscount(camp, cartWithCat, subTotal);
                    const isApplied = selectedEventCampaign?.id === camp.id;

                    return (
                      <View 
                        key={camp.id} 
                        style={{ 
                          backgroundColor: '#FFFFFF', 
                          borderWidth: isApplied ? 2 : 1, 
                          borderColor: isApplied ? '#52171B' : '#E2E8F0', 
                          borderRadius: 10, 
                          padding: 12, 
                          marginBottom: 10,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 2,
                          elevation: 1
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#52171B' }}>{camp.code}</Text>
                              </View>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A1A1A' }}>{camp.title}</Text>
                            </View>
                            {camp.urduTitle ? (
                              <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{camp.urduTitle}</Text>
                            ) : null}
                            <Text style={{ fontSize: 11, color: '#555', lineHeight: 15 }} numberOfLines={2}>{camp.description}</Text>
                          </View>

                          <View style={{ backgroundColor: '#52171B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignItems: 'center' }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>
                              {camp.type === 'percentage' ? `${camp.value}%` : `Rs.${camp.value}`}
                            </Text>
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>OFF</Text>
                          </View>
                        </View>

                        {/* Scope details */}
                        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, color: '#475569', fontWeight: '700' }}>
                              Scope: {camp.scope === 'item' ? 'Selected Dishes' : camp.scope === 'category' ? `Categories: ${camp.targetCategories.join(', ')}` : 'Entire Order'}
                            </Text>
                          </View>
                          {camp.minSpend > 0 && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '700' }}>
                                Min Bill: Rs. {camp.minSpend.toLocaleString()}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Cart Eligibility Bar */}
                        <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            {check.eligible ? (
                              <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '800' }}>
                                ✓ Cart Qualifies! Will save Rs. {check.discountAmount.toLocaleString()}
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '600' }}>
                                ⚠️ {check.reason}
                              </Text>
                            )}
                          </View>

                          {isApplied ? (
                            <TouchableOpacity
                              style={{ backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                              onPress={handleRemovePromoCampaign}
                            >
                              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Remove</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[
                                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
                                check.eligible ? { backgroundColor: '#52171B' } : { backgroundColor: '#E2E8F0' }
                              ]}
                              onPress={() => handleApplyPromoCampaign(camp)}
                              disabled={!check.eligible}
                            >
                              <Text style={[
                                { fontSize: 11, fontWeight: '800' },
                                check.eligible ? { color: '#FFFFFF' } : { color: '#94A3B8' }
                              ]}>
                                Apply Offer
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer Modal (Search / Create) */}
      <Modal visible={customerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>{isCreatingNewCustomer ? 'New Customer' : 'Select Customer'}</Text>
               <TouchableOpacity onPress={() => setCustomerModalVisible(false)}><Ionicons name="close" size={24}/></TouchableOpacity>
            </View>

            {isCreatingNewCustomer ? (
              <View>
                <TextInput style={styles.input} placeholder="Name" value={customerName} onChangeText={setCustomerName} />
                <TextInput style={styles.input} placeholder="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
                <TextInput style={styles.input} placeholder="Address (Optional)" value={customerAddress} onChangeText={setCustomerAddress} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreatingNewCustomer(false)}><Text>Back to Search</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNewCustomer}><Text style={{color:'#fff'}}>Save</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={20} color="#888" />
                  <TextInput 
                    style={styles.searchInput} 
                    placeholder="Search phone or name..." 
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                  />
                </View>
                <ScrollView style={{maxHeight: 300, marginTop: 10}}>
                  {customers
                    .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone.includes(customerSearchQuery))
                    .map(c => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={styles.selectRow}
                      onPress={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerModalVisible(false);
                      }}
                    >
                      <View>
                        <Text style={{fontWeight:'bold'}}>{c.name}</Text>
                        <Text style={{color:'#666'}}>{c.phone}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.createNewBtn} onPress={() => {
                  setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setIsCreatingNewCustomer(true);
                }}>
                  <Text style={styles.createNewBtnText}>+ Create New Customer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Table Modal */}
      <Modal visible={tableModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 540, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Dining Table</Text>
                <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                  Live integration with Table Service & Kitchen Orders
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTableModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {/* Zone Filter in Modal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10, flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['All', ...zones].map(z => (
                  <TouchableOpacity
                    key={z}
                    style={[styles.modalFilterPill, tableModalZone === z && styles.modalFilterPillActive]}
                    onPress={() => setTableModalZone(z)}
                  >
                    <Text style={[styles.modalFilterText, tableModalZone === z && styles.modalFilterTextActive]}>
                      {z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {tables
                  .filter(t => tableModalZone === 'All' || t.zone === tableModalZone)
                  .map(t => {
                    const tableTickets = tickets.filter(tk => tk.tableId === t.id);
                    const isFoodReady = tableTickets.some(tk => tk.status === 'ready');
                    const hasActiveTickets = tableTickets.some(tk => tk.status === 'cooking' || tk.status === 'ready');
                    const isBusy = t.status === 'occupied' || t.status === 'billed' || hasActiveTickets;
                    const isSelected = selectedTableId === t.id;
                    const statusColor = isFoodReady 
                      ? '#007AFF' 
                      : (t.status === 'billed' 
                          ? '#f39c12' 
                          : (isBusy ? '#e74c3c' : '#27ae60'));
                    const statusLabel = isFoodReady 
                      ? 'FOOD READY' 
                      : (t.status === 'billed' 
                          ? 'BILLED' 
                          : (isBusy ? 'OCCUPIED' : 'AVAILABLE'));

                    return (
                      <TouchableOpacity 
                        key={t.id} 
                        style={[
                          styles.tableSelectCard,
                          isSelected && styles.tableSelectCardActive,
                          isBusy && styles.tableSelectCardBusy,
                        ]}
                        onPress={() => handleTableSelect(t.id)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.tableCardTitle}>{t.name}</Text>
                            <View style={[styles.tableCardStatusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor }]}>
                              <View style={[styles.tableCardStatusDot, { backgroundColor: statusColor }]} />
                              <Text style={[styles.tableCardStatusText, { color: statusColor }]}>
                                {statusLabel}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.tableCardSubtitle}>
                            Zone: {t.zone} • {t.seats} Seats {t.server ? `• Served by ${t.server}` : ''}
                          </Text>

                          {isBusy ? (
                            <View style={styles.tableCardBillRow}>
                              <Text style={styles.tableCardBillAmount}>
                                Active Bill: Rs. {(t.billTotal || 0).toLocaleString()}
                              </Text>
                              <Text style={styles.tableCardTicketsHint}>
                                • {tableTickets.length} active KOT(s) (Tap to Load & Checkout)
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.tableCardAvailableHint}>
                              ✓ Ready for seating • Tap to start order
                            </Text>
                          )}
                        </View>
                        <Ionicons 
                          name={isSelected ? "checkmark-circle" : "chevron-forward-circle-outline"} 
                          size={24} 
                          color={isSelected ? "#27ae60" : (isBusy ? "#e74c3c" : "#8E8E93")} 
                        />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pending Orders Modal */}
      <Modal visible={pendingOrdersModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Pending Orders</Text>
               <TouchableOpacity onPress={() => setPendingOrdersModalVisible(false)}><Ionicons name="close" size={24}/></TouchableOpacity>
            </View>
            <ScrollView style={{maxHeight: 400}}>
              {tickets.length === 0 ? (
                <Text style={{padding: 20, textAlign: 'center', color: '#888'}}>No pending orders.</Text>
              ) : (
                Array.from(new Set(tickets.map(t => t.tableId))).map(tId => {
                  const tableT = tickets.filter(t => t.tableId === tId);
                  const itemsCount = tableT.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.qty, 0), 0);
                  const isTable = tId !== 'takeaway' && tId !== 'delivery';
                  const tObj = isTable ? tables.find(t => t.id === tId) : null;
                  return (
                    <TouchableOpacity 
                      key={tId} 
                      style={[styles.selectRow]}
                      onPress={() => {
                        setOrderType(isTable ? 'dine-in' : tId as 'takeaway' | 'delivery');
                        handleTableSelect(tId);
                        setPendingOrdersModalVisible(false);
                      }}
                    >
                      <View>
                        <Text style={{fontWeight:'bold'}}>{isTable ? `Table: ${tObj?.name || tId}` : tId.toUpperCase()}</Text>
                        <Text style={{color:'#666'}}>{itemsCount} items pending</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#ccc" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Checkout / Split Payment Modal */}
      <Modal visible={checkoutModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <Text style={styles.modalTitle}>Payment & Checkout</Text>
            
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>Total Due: Rs. {total.toFixed(0)}</Text>
              <Text style={[styles.summaryText, remaining > 0 ? {color:'#e74c3c'} : {color:'#2ecc71'}]}>Remaining: Rs. {remaining.toFixed(0)}</Text>
            </View>

            <ScrollView style={styles.paymentsList}>
              {payments.map((p, idx) => (
                <View key={idx} style={styles.paymentRow}>
                  <View style={styles.payTypeSelector}>
                    {['cash', 'card', 'online'].map(pt => (
                      <TouchableOpacity 
                        key={pt} 
                        style={[styles.payTypeBtn, p.type === pt && styles.payTypeBtnActive]}
                        onPress={() => updatePayment(idx, 'type', pt)}
                      >
                        <Text style={[styles.payTypeBtnText, p.type === pt && {color:'#fff'}]}>{pt.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput 
                    style={styles.payInput}
                    keyboardType="numeric"
                    value={p.amount.toString()}
                    onChangeText={(val) => updatePayment(idx, 'amount', val)}
                  />

                  <TouchableOpacity style={styles.payDelBtn} onPress={() => removePaymentMethod(idx)}>
                    <Ionicons name="trash" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addPaymentBtn} onPress={addPaymentMethod}>
                <Text style={styles.addPaymentBtnText}>+ Add Split Payment</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCheckoutModalVisible(false)}>
                <Text>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, remaining > 0 && {backgroundColor: '#ccc'}]} 
                onPress={handleFinalizeOrder}
                disabled={remaining > 0.01}
              >
                <Text style={{color:'#fff', fontWeight: 'bold'}}>Confirm & Generate Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Print Preview Modal */}
      <Modal visible={!!generatedInvoice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.printPreviewContent, { paddingVertical: 24 }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setGeneratedInvoice(null)}>
              <Text style={styles.closeBtnText}>✕ Close Preview</Text>
            </TouchableOpacity>
            
            {generatedInvoice && <InvoiceComponent invoice={generatedInvoice} />}
          </ScrollView>
        </View>
      </Modal>

      {/* Table Release Decision Modal (Prompt whether to free table or keep billed) */}
      <Modal visible={!!tableDecisionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440, padding: 24, borderRadius: 16 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={44} color="#27ae60" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C1C1E', textAlign: 'center' }}>
                Payment Received!
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center' }}>
                {tableDecisionModal?.tableName} • Rs. {tableDecisionModal?.invoice?.total?.toLocaleString()}
              </Text>
            </View>

            <View style={{ backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, textAlign: 'center' }}>
                Would you like to mark <Text style={{ fontWeight: 'bold' }}>{tableDecisionModal?.tableName}</Text> as <Text style={{ color: '#27ae60', fontWeight: 'bold' }}>AVAILABLE</Text> now, or keep it <Text style={{ color: '#E67E22', fontWeight: 'bold' }}>BILLED</Text> because guests are still seated?
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#27ae60',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={() => {
                  if (tableDecisionModal) {
                    settleBill(tableDecisionModal.tableId);
                    const inv = tableDecisionModal.invoice;
                    setTableDecisionModal(null);
                    setGeneratedInvoice(inv);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Release Table (Available Now)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: '#FFF3E0',
                  borderWidth: 1.5,
                  borderColor: '#E67E22',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={() => {
                  if (tableDecisionModal) {
                    markTableBilled(tableDecisionModal.tableId, tableDecisionModal.invoice.id);
                    const inv = tableDecisionModal.invoice;
                    setTableDecisionModal(null);
                    setGeneratedInvoice(inv);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="time" size={18} color="#E67E22" />
                <Text style={{ color: '#E67E22', fontWeight: '800', fontSize: 15 }}>Keep Table (Guests Still Seated)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Variant Selection Modal */}
      <Modal visible={!!variantModalItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460, borderRadius: 16, padding: 22 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                {variantModalItem?.imageUri ? (
                  <Image source={{ uri: variantModalItem.imageUri }} style={{ width: 48, height: 48, borderRadius: 10 }} />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#FFF2F3', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="restaurant" size={24} color="#4a121a" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{variantModalItem?.name}</Text>
                  <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                    {variantModalItem?.category} • Select Portion / Size
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setVariantModalItem(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {variantModalItem?.trackStock && typeof variantModalItem.stockQty === 'number' && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: variantModalItem.stockQty <= (variantModalItem.lowStockThreshold || 5) ? '#FFF3E0' : '#E8F5E9',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                marginBottom: 16,
                gap: 6,
              }}>
                <Ionicons 
                  name={variantModalItem.stockQty <= 0 ? "close-circle" : (variantModalItem.stockQty <= (variantModalItem.lowStockThreshold || 5) ? "alert-circle" : "checkmark-circle")} 
                  size={16} 
                  color={variantModalItem.stockQty <= 0 ? "#d32f2f" : (variantModalItem.stockQty <= (variantModalItem.lowStockThreshold || 5) ? "#e65100" : "#2e7d32")} 
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: variantModalItem.stockQty <= 0 ? "#d32f2f" : (variantModalItem.stockQty <= (variantModalItem.lowStockThreshold || 5) ? "#e65100" : "#2e7d32")
                }}>
                  {variantModalItem.stockQty <= 0 ? "Sold Out in Inventory" : `Live Kitchen Inventory: ${variantModalItem.stockQty} portions available`}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#4a121a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Available Portions & Sizes
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {variantModalItem?.variants?.map((v, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.variantOptionCard}
                    onPress={() => handleVariantSelect(v)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.variantOptionName}>{v.name}</Text>
                      <Text style={styles.variantOptionSub}>Single serving portion</Text>
                    </View>
                    <View style={styles.variantOptionPriceContainer}>
                      <Text style={styles.variantOptionPrice}>Rs. {v.price.toLocaleString()}</Text>
                      <View style={styles.variantAddPill}>
                        <Ionicons name="add" size={14} color="#fff" />
                        <Text style={styles.variantAddText}>Add</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    padding: 8,
    gap: 8,
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  mobileTabBtnActive: {
    backgroundColor: '#4a121a',
  },
  mobileTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  mobileTabBtnTextActive: {
    color: '#fff',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: '#4a121a',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.2)' },
    }),
  },
  floatingCartBadge: {
    backgroundColor: '#D5A943',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  floatingCartBadgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  floatingCartText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  floatingCartPrice: {
    color: '#D5A943',
    fontWeight: '800',
    fontSize: 15,
  },
  backToMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: '#FFF2F3',
    borderBottomWidth: 1,
    borderBottomColor: '#F5D7DA',
  },
  backToMenuText: {
    color: '#4a121a',
    fontWeight: '700',
    fontSize: 14,
  },
  menuArea: {
    flex: 2,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a121a',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    width: 250,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 8,
  },
  catScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  catBtnActive: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  catText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 13,
  },
  catTextActive: {
    color: '#fff',
  },
  itemsScroll: {
    flex: 1,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  itemCard: {
    width: '31%',
    minWidth: 145,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    elevation: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
    }),
  },
  itemImage: {
    width: '100%',
    height: 85,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  itemPlaceholderImage: {
    width: '100%',
    height: 85,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F7F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#6a1b9a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  promoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  promoBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  dealItemsPreview: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  dealItemsPreviewText: {
    fontSize: 10,
    color: '#6a1b9a',
    fontWeight: '600',
  },
  variantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF2F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  variantBadgeText: {
    fontSize: 10,
    color: '#4a121a',
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    color: '#4a121a',
    fontWeight: '800',
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: '#8E8E93',
    textDecorationLine: 'line-through',
  },
  stockPill: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  stockPillIn: {
    backgroundColor: '#E8F5E9',
  },
  stockPillLow: {
    backgroundColor: '#FFF3E0',
  },
  stockPillOut: {
    backgroundColor: '#FFEBEE',
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stockPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cartArea: {
    flex: 1,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
    display: 'flex',
    flexDirection: 'column',
  },
  orderOptions: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fafafa',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#eee',
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeBtnActive: {
    backgroundColor: '#D5A943',
    borderColor: '#D5A943',
  },
  typeBtnText: {
    fontWeight: 'bold',
    color: '#666',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  metaSection: {
    marginTop: 8,
  },
  selectMetaBtn: {
    backgroundColor: '#4a121a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectMetaBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  metaName: {
    fontWeight: 'bold',
    color: '#2e7d32',
    fontSize: 16,
  },
  metaSub: {
    color: '#388e3c',
    fontSize: 12,
  },
  cartScroll: {
    flex: 1,
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  cartItemThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cartItemPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFF2F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cartDealBreakdown: {
    fontSize: 11,
    color: '#6a1b9a',
    marginTop: 1,
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#eee',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  qtyText: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#ffebee',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  variantOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  variantOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  variantOptionSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  variantOptionPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  variantOptionPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4a121a',
  },
  variantAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#4a121a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  variantAddText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cartFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  kotRow: {
    marginBottom: 16,
  },
  kotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdf3f2',
    borderWidth: 1,
    borderColor: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  kotBtnText: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 16,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  discountInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 4,
    width: 80,
    textAlign: 'right',
    borderRadius: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalsValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a121a',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a121a',
  },
  checkoutBtn: {
    backgroundColor: '#D5A943',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: 450,
  },
  modalContentLarge: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: 600,
    maxHeight: '80%',
  },
  printPreviewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a121a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    padding: 12,
  },
  saveBtn: {
    backgroundColor: '#D5A943',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  summaryBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentsList: {
    maxHeight: 300,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  payTypeSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
  },
  payTypeBtn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  payTypeBtnActive: {
    backgroundColor: '#4a121a',
  },
  payTypeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  payInput: {
    width: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 12,
    textAlign: 'right',
  },
  payDelBtn: {
    padding: 8,
  },
  addPaymentBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#D5A943',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addPaymentBtnText: {
    color: '#D5A943',
    fontWeight: 'bold',
  },
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  createNewBtn: {
    marginTop: 16,
    backgroundColor: '#4a121a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createNewBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  closeBtnText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  printBtnAction: {
    backgroundColor: '#4a121a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  printBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  selectedMetaTableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  tableStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusAvail: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
  },
  statusOcc: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
  },
  tableStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  metaRunningBill: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4a121a',
    marginTop: 3,
  },
  changeTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeTableBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a121a',
  },
  resetTableBtn: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: 7,
    borderRadius: 6,
  },
  modalFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  modalFilterPillActive: {
    backgroundColor: '#4a121a',
  },
  modalFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
  },
  modalFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tableSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  tableSelectCardActive: {
    borderColor: '#27ae60',
    borderWidth: 2,
    backgroundColor: '#F0FFF4',
  },
  tableSelectCardBusy: {
    borderColor: '#FFD7D3',
    backgroundColor: '#FFF8F7',
  },
  tableCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  tableCardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  tableCardStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  tableCardStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tableCardSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  tableCardBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tableCardBillAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4a121a',
  },
  tableCardTicketsHint: {
    fontSize: 11,
    color: '#D84315',
    fontWeight: '600',
    marginLeft: 4,
  },
  tableCardAvailableHint: {
    fontSize: 11,
    color: '#27ae60',
    fontWeight: '600',
    marginTop: 4,
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
