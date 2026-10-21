import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Alert, 
  Platform, 
  useWindowDimensions, 
  StatusBar,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  useRestaurantStore, 
  MenuItem, 
  OrderItem, 
  Payment, 
  Invoice, 
  useAuthStore, 
  useDiscountStore, 
  EventDiscount 
} from '../store';
import { useShiftStore } from '../store/shiftStore';
import { useRolePermissions } from '../store/roleStore';
import { calculateOrderDiscount } from '../utils/discountCalculator';
import { broadcastImmediately } from '../services/syncService';
import InvoiceComponent from '../components/Invoice';
import PermissionDeniedScreen from '../components/PermissionDeniedScreen';
import SultanLogo from '../components/SultanLogo';

function createInvoicePayload(data: Omit<Invoice, 'id' | 'timePlaced' | 'timeSettled'>): Invoice {
  const now = Date.now();
  return {
    ...data,
    id: `INV-${Math.floor(Math.random() * 90000) + 10000}`,
    timePlaced: now,
    timeSettled: now,
  };
}

interface POSTerminalScreenProps {
  role?: 'admin' | 'manager';
  backRoute?: string;
  shiftRoute?: string;
}

export default function POSTerminalScreen({
  role = 'admin',
  backRoute = '/admin/dashboard',
  shiftRoute = '/admin/shift',
}: POSTerminalScreenProps) {
  const router = useRouter();
  const { prefillTableId } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  // Live Digital Clock (as in Baithak Header)
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('en-GB'));
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [pendingOrderSearchQuery, setPendingOrderSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const user = useAuthStore(state => state.user);
  const { can, canApplyCustomDiscount } = useRolePermissions();

  // Permission Guard
  if (role !== 'admin' && !can('canAccessPOS')) {
    return (
      <PermissionDeniedScreen
        moduleName="POS Billing Terminal"
        urduModuleName="پی او ایس بلنگ ٹرمینل"
        requiredPermission="canAccessPOS"
        backRoute={backRoute}
      />
    );
  }

  // Restaurant Store
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

  // Shift Store
  const shifts = useShiftStore(state => state.shifts);
  const activeShiftId = useShiftStore(state => state.activeShiftId);
  const activeShift = shifts.find(s => s.id === activeShiftId && s.status === 'open');

  // Menu State
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);

  // Cart & Order State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [loadedCart, setLoadedCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<'takeaway' | 'dine-in' | 'delivery'>('takeaway');
  
  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<string>('');

  // Modals
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [pendingOrdersModalVisible, setPendingOrdersModalVisible] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [customDiscountInput, setCustomDiscountInput] = useState('');

  // New Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);

  // Payment & Event Promo State
  const campaigns = useDiscountStore(state => state.campaigns);
  const recordRedemption = useDiscountStore(state => state.recordRedemption);
  const [selectedEventCampaign, setSelectedEventCampaign] = useState<EventDiscount | null>(null);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [payments, setPayments] = useState<Payment[]>([{ type: 'cash', amount: 0 }]);

  // Table Modal Filter
  const [tableModalZone, setTableModalZone] = useState('All');

  // Print Preview & Post-Payment Table Decision
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [tableDecisionModal, setTableDecisionModal] = useState<{ tableId: string; tableName: string; invoice: any } | null>(null);
  const prefilledRef = useRef<string | null>(null);

  // Toggle Fullscreen (Browser Kiosk)
  const toggleFullscreen = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Table Selection
  const handleTableSelect = (tId: string) => {
    setSelectedTableId(tId);
    setOrderType('dine-in');
    setTableModalVisible(false);
    
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
    setSelectedServer(foundWaiter || '');

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
    const confirmMsg = `Are you sure you want to release ${targetTable ? targetTable.name : 'this table'}? Running bill will be reset.`;
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

  // Categories list for 2-column sidebar (Auto-syncs dynamic categories from catalog)
  const categoryTiles = useMemo(() => {
    const set = new Set<string>();
    (categories || []).forEach(c => {
      if (c && c !== 'All' && c !== 'ALL') set.add(c);
    });
    // Ensure all unique categories assigned to menu items are visible in POS tiles
    (menuItems || []).forEach(m => {
      if (m.category && m.category !== 'All' && m.category !== 'ALL') {
        set.add(m.category);
      }
    });
    const list = Array.from(set);
    if (!categorySearchQuery) return list;
    const q = categorySearchQuery.toLowerCase().trim();
    return list.filter(c => c.toLowerCase().includes(q));
  }, [categories, menuItems, categorySearchQuery]);

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return (menuItems || []).filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeCategory === 'ALL' || activeCategory === 'All') return true;
      if (activeCategory === '🎁 Deals & Combos' || activeCategory === 'Deals') {
        return Boolean(item.isDeal || (item.category && item.category.toLowerCase() === 'deals'));
      }
      return (item.category || '').trim().toLowerCase() === activeCategory.trim().toLowerCase();
    });
  }, [menuItems, searchQuery, activeCategory]);

  // Financial Calculations
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountVal = parseFloat(discountAmount) || 0;
  const afterDiscount = Math.max(0, subTotal - discountVal);
  const deliveryCharges = orderType === 'delivery' ? 150 : 0;
  const tax = afterDiscount * 0.16;
  const total = afterDiscount + tax + deliveryCharges;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);
  const selectedTableObj = tables.find(t => t.id === selectedTableId);

  // Recalculate Promo Discount
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
  }, [cart, selectedEventCampaign, subTotal, menuItems]);

  const handleOrderTypeChange = (type: 'takeaway' | 'dine-in' | 'delivery') => {
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
    if (item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0) {
      const msg = `⚠️ "${item.name}" is currently Sold Out.`;
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
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [
        ...prev, 
        { 
          id: item.id, 
          name: item.name, 
          price: item.price, 
          qty: 1, 
          completed: false, 
          station: item.station || 'main' 
        }
      ];
    });
  };

  const handleVariantSelect = (variant: { name: string; price: number }) => {
    if (!variantModalItem) return;

    const variantId = `${variantModalItem.id}-${variant.name}`;
    const variantName = `${variantModalItem.name} (${variant.name})`;

    setCart(prev => {
      const existing = prev.find(i => i.id === variantId);
      if (existing) {
        return prev.map(i => i.id === variantId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [
        ...prev, 
        { 
          id: variantId, 
          name: variantName, 
          price: variant.price, 
          qty: 1, 
          completed: false, 
          station: variantModalItem.station || 'main' 
        }
      ];
    });

    setVariantModalItem(null);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, qty: Math.max(1, i.qty + delta) };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const clearCart = () => {
    setCart([]);
    setLoadedCart([]);
    setSelectedCustomerId('');
    setSelectedTableId('');
    setDiscountAmount('0');
  };

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
      addCustomer({ name: customerName, phone: customerPhone, address: customerAddress });
      if (Platform.OS === 'web') window.alert("Customer registered successfully.");
    }
    setIsCreatingNewCustomer(false);
  };

  const sendToKitchen = () => {
    if (cart.length === 0) return;
    if (orderType === 'dine-in' && !selectedTableId) {
      if (Platform.OS === 'web') window.alert("Please assign a dining table first.");
      return;
    }
    
    const tId = orderType === 'dine-in' ? selectedTableId : orderType;
    
    const kotItems: { item: MenuItem; qty: number }[] = [];
    cart.forEach(cartItem => {
      const loadedItem = loadedCart.find(i => i.id === cartItem.id);
      const loadedQty = loadedItem ? loadedItem.qty : 0;
      if (cartItem.qty > loadedQty) {
        const baseId = cartItem.id.split('-')[0];
        const baseMenu = menuItems.find(m => m.id === baseId || m.id === cartItem.id);
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

        kotItems.push({
          item: itemObj,
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
    placeOrder(tId, `${user?.name || 'Staff'} (POS)`, kotItems, isAddOn);
    setLoadedCart(JSON.parse(JSON.stringify(cart)));
    
    const alertMsg = isAddOn 
      ? `Add-on items sent to Kitchen!` 
      : `Order sent to Kitchen! Table occupied.`;
    if (Platform.OS === 'web') window.alert(alertMsg);
    else Alert.alert("Kitchen Notified", alertMsg);
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    if (orderType === 'dine-in' && !selectedTableId) {
      const msg = "Please select a table for Dine-in orders.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert("Select Table", msg);
      return;
    }
    if (orderType === 'delivery' && !selectedCustomerId) {
      const msg = "Please select customer contact and address for delivery orders.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert("Customer Contact Required", msg);
      return;
    }
    setPayments([{ type: 'cash', amount: total }]);
    setCheckoutModalVisible(true);
  };

  const handleCreateBillFromTicket = (ticket: typeof tickets[0], autoOpenCheckout = true) => {
    const isTable = ticket.tableId && ticket.tableId !== 'takeaway' && ticket.tableId !== 'delivery';
    const targetTable = isTable ? tables.find(t => 
      t.id === ticket.tableId || 
      (ticket.tableName && t.name.trim().toLowerCase() === ticket.tableName.trim().toLowerCase())
    ) : null;

    if (targetTable) {
      handleTableSelect(targetTable.id);
    } else {
      const isDelivery = ticket.tableId?.toLowerCase() === 'delivery';
      setOrderType(isDelivery ? 'delivery' : 'takeaway');
      setSelectedTableId('');
      setSelectedServer(ticket.server || '');
      
      const itemsCopy = ticket.items.map(i => ({ ...i }));
      setCart(itemsCopy);
      setLoadedCart(JSON.parse(JSON.stringify(itemsCopy)));
    }

    setPendingOrdersModalVisible(false);

    if (autoOpenCheckout) {
      setTimeout(() => {
        setCheckoutModalVisible(true);
      }, 150);
    } else if (isMobile) {
      setMobileTab('cart');
    }
  };

  const handleFinalizeOrder = () => {
    if (remaining > 0.01) {
      if (Platform.OS === 'web') window.alert("Please collect full payment before checking out.");
      else Alert.alert("Incomplete Payment", "Please collect full payment before checking out.");
      return;
    }

    const targetTableId = selectedTableId;
    const targetTableName = selectedTableObj?.name || `Table ${targetTableId}`;
    const wasDineIn = orderType === 'dine-in' && targetTableId;

    const currentUserName = user?.name ? (user.name.includes('(Admin)') ? user.name : `${user.name} (Admin)`) : 'Junaid Ahsan (Admin)';
    const orderCreator = selectedServer || (wasDineIn ? 'Sara Ahmed' : currentUserName);
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
      tax,
      total,
      payments: payments.filter(p => p.amount > 0)
    });

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
        unsentKotItems.push({ item: itemObj, qty: cartItem.qty - loadedQty });
      }
    });

    if (unsentKotItems.length > 0) {
      const kotTarget = targetTableId || (orderType === 'delivery' ? 'delivery' : 'takeaway');
      placeOrder(kotTarget, cashierName, unsentKotItems, loadedCart.length > 0);
    }

    saveInvoice(invoice);
    broadcastImmediately();

    if (selectedCustomerObj) {
      updateCustomer(selectedCustomerObj.id, {
        totalOrders: selectedCustomerObj.totalOrders + 1,
        totalSpent: selectedCustomerObj.totalSpent + total,
      });
    }

    setCart([]);
    setLoadedCart([]);
    setSelectedEventCampaign(null);
    setDiscountAmount('0');
    setCheckoutModalVisible(false);
    setSelectedCustomerId('');
    setSelectedTableId('');

    if (wasDineIn) {
      setTableDecisionModal({
        tableId: targetTableId,
        tableName: targetTableName,
        invoice,
      });
    } else {
      setGeneratedInvoice(invoice);
    }
  };

  const updatePayment = (idx: number, field: 'type' | 'amount', value: string) => {
    const newP = [...payments];
    if (field === 'type') {
      newP[idx].type = value as any;
    } else {
      newP[idx].amount = parseFloat(value) || 0;
    }
    setPayments(newP);
  };

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#32070D" />

      {/* ========================================================
          1. BAITHAK TOP HEADER (Dark Maroon with Gold Accents)
          ======================================================== */}
      <View style={styles.topHeader}>
        {/* Left Side: Back Arrow + Brand Calligraphy + Live Clock */}
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.replace(backRoute as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#D4AF37" />
          </TouchableOpacity>

          <View style={styles.brandBox}>
            <SultanLogo size="xs" width={22} height={22} style={{ marginRight: 6 }} />
            <Text style={styles.brandTitle}>SULTAN RESTAURANT</Text>
          </View>

          <Text style={styles.clockText}>{currentTime}</Text>
        </View>

        {/* Right Side: Shift Status + Fullscreen + Admin Avatar */}
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.shiftCapsule} 
            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
            onPress={() => router.push(shiftRoute as any)}
            activeOpacity={0.8}
          >
            <View
              {...(Platform.OS === 'web' ? ({ className: 'pulse-beacon' } as any) : {})}
              style={styles.shiftDot}
            />
            <Text style={styles.shiftText}>
              {activeShift ? `Shift #${activeShift.id.slice(-9)} (${user?.name || 'admin'})` : 'Shift #SH-261019-001 (admin)'}
            </Text>
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <TouchableOpacity 
              style={styles.iconSquareBtn}
              onPress={toggleFullscreen}
              activeOpacity={0.7}
            >
              <Ionicons name={isFullscreen ? "contract-outline" : "scan-outline"} size={16} color="#D4AF37" />
            </TouchableOpacity>
          )}

          <View style={styles.userSection}>
            <Text style={styles.roleLabel}>{user?.name || 'admin'}</Text>
            <View style={styles.userAvatarCircle}>
              <Text style={styles.userAvatarText}>
                {(user?.name || 'A')[0].toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Mobile Mode Switcher Bar */}
      {isMobile && (
        <View style={styles.mobileSwitcher}>
          <TouchableOpacity 
            style={[styles.mobileSwitchBtn, mobileTab === 'menu' && styles.mobileSwitchBtnActive]}
            onPress={() => setMobileTab('menu')}
          >
            <Text style={[styles.mobileSwitchText, mobileTab === 'menu' && styles.mobileSwitchTextActive]}>
              Menu Dishes ({filteredItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mobileSwitchBtn, mobileTab === 'cart' && styles.mobileSwitchBtnActive]}
            onPress={() => setMobileTab('cart')}
          >
            <Text style={[styles.mobileSwitchText, mobileTab === 'cart' && styles.mobileSwitchTextActive]}>
              Current Cart ({cart.reduce((s, i) => s + i.qty, 0)})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================
          2. MAIN 3-SECTION WORKSPACE
          [LEFT: 2-Col Categories] [CENTER: Dishes Grid] [RIGHT: Cart]
          ======================================================== */}
      <View style={[styles.mainWorkspace, isMobile && { flexDirection: 'column' }]}>

        {/* --------------------------------------------------------
            LEFT: CATEGORIES 2-COLUMN TILES (BAITHAK PATTERN)
            -------------------------------------------------------- */}
        {(!isMobile || mobileTab === 'menu') && (
          <View style={[styles.categorySidebar, isMobile && styles.categorySidebarMobile]}>
            <Text style={styles.categoryHeading}>CATEGORIES</Text>

            <View style={styles.quickFindBox}>
              <View style={styles.quickFindIconOrb}>
                <Ionicons name="search" size={12} color="#D4AF37" />
              </View>
              <TextInput
                style={styles.quickFindInput}
                placeholder="Quick find category..."
                placeholderTextColor="rgba(254, 243, 199, 0.45)"
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
              />
              {categorySearchQuery ? (
                <TouchableOpacity onPress={() => setCategorySearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={15} color="#D4AF37" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView 
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesGrid}
              showsVerticalScrollIndicator={false}
              horizontal={isMobile}
            >
              {/* ALL Category Button */}
              <TouchableOpacity
                {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
                style={[
                  styles.categoryTile,
                  (activeCategory === 'ALL' || activeCategory === 'All') && styles.categoryTileActive
                ]}
                onPress={() => setActiveCategory('ALL')}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="grid" 
                  size={18} 
                  color={(activeCategory === 'ALL' || activeCategory === 'All') ? '#1E293B' : '#E2E8F0'} 
                />
                <Text style={[
                  styles.categoryTileText,
                  (activeCategory === 'ALL' || activeCategory === 'All') && styles.categoryTileTextActive
                ]}>
                  ALL
                </Text>
              </TouchableOpacity>

              {/* Dynamic Categories Tiles (2 per row) */}
              {categoryTiles.map(cat => {
                const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat}
                    {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
                    style={[
                      styles.categoryTile,
                      isActive && styles.categoryTileActive
                    ]}
                    onPress={() => setActiveCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name="restaurant" 
                      size={16} 
                      color={isActive ? '#1E293B' : '#E2E8F0'} 
                    />
                    <Text 
                      style={[
                        styles.categoryTileText,
                        isActive && styles.categoryTileTextActive
                      ]}
                      numberOfLines={2}
                    >
                      {cat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* --------------------------------------------------------
            CENTER: DISH CATALOG GRID (5 COLUMNS ON DESKTOP)
            -------------------------------------------------------- */}
        {(!isMobile || mobileTab === 'menu') && (
          <View style={styles.centerCatalog}>
            {/* Catalog Top Subheader Bar */}
            <View style={styles.catalogSubheader}>
              <View style={styles.catalogTitleRow}>
                <Text style={styles.catalogTitle}>SULTAN RESTAURANT Menu</Text>

                {/* Running Orders Pill */}
                <TouchableOpacity 
                  style={styles.runningOrdersPill}
                  {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
                  onPress={() => setPendingOrdersModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time" size={13} color="#D97706" />
                  <Text style={styles.runningOrdersText}>Running Orders</Text>
                  <View style={styles.runningOrdersBadge}>
                    <Text style={styles.runningOrdersBadgeText}>{tickets.length}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Sultan Royal Luxury Search Bar */}
              <View style={styles.searchPillBox}>
                <View style={styles.searchIconOrb}>
                  <Ionicons name="search" size={15} color="#52141C" />
                </View>
                <TextInput
                  style={styles.searchPillInput}
                  placeholder="Search dishes, codes, or categories..."
                  placeholderTextColor="#8A7A70"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity 
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.searchClearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color="#D4AF37" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.searchShortcutBadge}>
                    <Ionicons name="sparkles" size={11} color="#B45309" style={{ marginRight: 3 }} />
                    <Text style={styles.searchShortcutText}>MENU</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Dishes Grid */}
            <ScrollView 
              style={styles.dishesScrollView}
              contentContainerStyle={styles.dishesGridContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.dishesGrid}>
                {filteredItems.map(item => {
                  const inCartQty = cart
                    .filter(c => c.id === item.id || c.id.startsWith(`${item.id}-`))
                    .reduce((sum, c) => sum + c.qty, 0);
                  const isItemInCart = inCartQty > 0;
                  const isOutOfStock = Boolean(item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
                      style={[
                        styles.dishCard,
                        isItemInCart && styles.dishCardInCart,
                        isOutOfStock && { opacity: 0.65 },
                        isMobile && { width: '47%' }
                      ]}
                      onPress={() => addToCart(item)}
                      activeOpacity={0.75}
                      disabled={isOutOfStock}
                    >
                      {/* Floating M3 In-Cart Badge */}
                      {isItemInCart && (
                        <View style={styles.inCartBadge}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                          <Text style={styles.inCartBadgeText}>{inCartQty}</Text>
                        </View>
                      )}

                      {/* Top: Dish Photo or Fallback Icon */}
                      <View style={styles.dishCardImageWrapper}>
                        {item.imageUri ? (
                          <Image 
                            source={{ uri: item.imageUri }} 
                            style={styles.dishCardImage} 
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.dishCardPlaceholderBox}>
                            <Ionicons 
                              name={item.isDeal ? "gift" : "restaurant-outline"} 
                              size={26} 
                              color="#D4AF37" 
                            />
                          </View>
                        )}

                        {/* Category Chip overlayed on top left */}
                        <View style={styles.dishCardCategoryChip}>
                          <Text style={styles.dishCardCategory} numberOfLines={1}>
                            {(item.category || 'Mains').toUpperCase()}
                          </Text>
                        </View>

                        {/* Special Badge tag */}
                        {item.badge ? (
                          <View style={styles.dishCardBadgeTag}>
                            <Text style={styles.dishCardBadgeText} numberOfLines={1}>
                              {item.badge}
                            </Text>
                          </View>
                        ) : null}

                        {/* Out of Stock Overlay */}
                        {isOutOfStock && (
                          <View style={styles.dishSoldOutOverlay}>
                            <Text style={styles.dishSoldOutText}>SOLD OUT</Text>
                          </View>
                        )}
                      </View>

                      {/* Middle: Dish Name */}
                      <Text style={styles.dishCardTitle} numberOfLines={2}>
                        {item.name}
                      </Text>

                      {/* Bottom: Warm Cream Price Capsule */}
                      <View style={[styles.dishCardPricePill, isItemInCart && styles.dishCardPricePillActive]}>
                        <Text style={[styles.dishCardPriceText, isItemInCart && styles.dishCardPriceTextActive]}>
                          Rs. {item.price.toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {filteredItems.length === 0 && (
                  <View style={styles.noItemsBox}>
                    <Ionicons name="search" size={40} color="#CBD5E1" />
                    <Text style={styles.noItemsText}>No items found matching your filter</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* --------------------------------------------------------
            RIGHT: CURRENT CART (BAITHAK SPEC)
            -------------------------------------------------------- */}
        {(!isMobile || mobileTab === 'cart') && (
          <View style={[styles.cartSidebar, isMobile && styles.cartSidebarMobile]}>
            {/* Header: Title + Reset */}
            <View style={styles.cartHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="bag-handle" size={18} color="#52141C" />
                <Text style={styles.cartHeaderTitle}>Current Cart</Text>
                {cart.length > 0 && (
                  <View style={styles.cartCountPill}>
                    <Text style={styles.cartCountText}>{cart.reduce((s, i) => s + i.qty, 0)}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={styles.cartResetBtn}
                onPress={clearCart}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={15} color="#DC2626" />
              </TouchableOpacity>
            </View>

            {/* Order Type Segmented Switcher (Takeaway / Dine-in / Delivery) */}
            <View style={styles.orderTypeTabs}>
              <TouchableOpacity
                style={[styles.orderTypeTab, orderType === 'takeaway' && styles.orderTypeTabActive]}
                onPress={() => handleOrderTypeChange('takeaway')}
              >
                <Ionicons name="bag-handle" size={12} color={orderType === 'takeaway' ? '#FFFFFF' : '#475569'} style={{ marginRight: 4 }} />
                <Text style={[styles.orderTypeTabText, orderType === 'takeaway' && styles.orderTypeTabTextActive]}>
                  Takeaway
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.orderTypeTab, orderType === 'dine-in' && styles.orderTypeTabActive]}
                onPress={() => handleOrderTypeChange('dine-in')}
              >
                <Ionicons name="restaurant" size={12} color={orderType === 'dine-in' ? '#FFFFFF' : '#475569'} style={{ marginRight: 4 }} />
                <Text style={[styles.orderTypeTabText, orderType === 'dine-in' && styles.orderTypeTabTextActive]}>
                  Dine-in
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.orderTypeTab, orderType === 'delivery' && styles.orderTypeTabActive]}
                onPress={() => handleOrderTypeChange('delivery')}
              >
                <Ionicons name="bicycle" size={12} color={orderType === 'delivery' ? '#FFFFFF' : '#475569'} style={{ marginRight: 4 }} />
                <Text style={[styles.orderTypeTabText, orderType === 'delivery' && styles.orderTypeTabTextActive]}>
                  Delivery
                </Text>
              </TouchableOpacity>
            </View>

            {/* Table or Customer Bar depending on Order Type */}
            {orderType === 'dine-in' ? (
              <View style={styles.tableCabinBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="restaurant" size={14} color="#D97706" />
                  <Text style={styles.tableCabinLabel}>Table / Cabin:</Text>
                  <View style={styles.tableCabinPill}>
                    <Text style={styles.tableCabinPillText}>
                      {selectedTableObj ? selectedTableObj.name : 'None'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.changeTablePill}
                  onPress={() => setTableModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={12} color="#475569" style={{ marginRight: 3 }} />
                  <Text style={styles.changeTablePillText}>Change Table</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tableCabinBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="person" size={14} color="#D97706" />
                  <Text style={styles.tableCabinLabel}>Customer:</Text>
                  <View style={styles.tableCabinPill}>
                    <Text style={styles.tableCabinPillText} numberOfLines={1}>
                      {selectedCustomerObj ? selectedCustomerObj.name : 'Walk-in Guest'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.changeTablePill}
                  onPress={() => {
                    setCustomerSearchQuery('');
                    setIsCreatingNewCustomer(false);
                    setCustomerModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
                  <Text style={styles.changeTablePillText}>
                    {selectedCustomerObj ? 'Change' : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Columns Subheader */}
            <View style={styles.cartColumnSubheader}>
              <Text style={[styles.cartColLabel, { flex: 1.8 }]}>PRODUCT</Text>
              <Text style={[styles.cartColLabel, { flex: 1, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.cartColLabel, { flex: 1, textAlign: 'right' }]}>PRICE</Text>
            </View>

            {/* Cart Items or Empty Bag View */}
            <ScrollView 
              style={styles.cartItemsScroll}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {cart.length === 0 ? (
                <View style={styles.emptyCartBox}>
                  <Ionicons name="bag" size={54} color="#94A3B8" />
                  <Text style={styles.emptyCartText}>Cart is empty</Text>
                </View>
              ) : (
                cart.map(item => (
                  <View key={item.id} style={styles.cartItemRow}>
                    <View style={{ flex: 1.8, paddingRight: 4 }}>
                      <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.cartItemUnit}>Rs. {item.price.toLocaleString()}</Text>
                    </View>

                    {/* Stepper Controls */}
                    <View style={styles.cartStepperBox}>
                      <TouchableOpacity 
                        style={styles.cartStepBtn} 
                        onPress={() => updateQty(item.id, -1)}
                      >
                        <Text style={styles.cartStepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartStepQty}>{item.qty}</Text>
                      <TouchableOpacity 
                        style={styles.cartStepBtn} 
                        onPress={() => updateQty(item.id, 1)}
                      >
                        <Text style={styles.cartStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Total & Delete */}
                    <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={styles.cartItemTotal}>
                        Rs. {(item.price * item.qty).toLocaleString()}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => removeFromCart(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={13} color="#DC2626" style={{ marginTop: 3 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Settlement Bottom Section */}
            <View style={styles.cartBottomSettlement}>
              {/* Financial Lines */}
              <View style={styles.mathSummaryLines}>
                <View style={styles.mathLine}>
                  <Text style={styles.mathLabel}>Subtotal</Text>
                  <Text style={styles.mathValue}>Rs. {subTotal.toFixed(2)}</Text>
                </View>

                <View style={styles.mathLine}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.mathLabel}>Discount-</Text>
                    <TouchableOpacity 
                      style={styles.discountBadgePill}
                      onPress={() => {
                        setCustomDiscountInput(discountAmount);
                        setDiscountModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pricetag" size={10} color="#059669" />
                      <Text style={styles.discountBadgeText}>
                        {selectedEventCampaign ? selectedEventCampaign.title : (discountVal > 0 ? `Rs. ${discountVal}` : '+ Promo')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.mathValue, { color: '#059669' }]}>Rs. {discountVal.toFixed(2)}</Text>
                </View>

                <View style={styles.mathLine}>
                  <Text style={[styles.mathLabel, { color: '#0284C7' }]}>Delivery+</Text>
                  <Text style={[styles.mathValue, { color: '#0284C7' }]}>Rs. {deliveryCharges.toFixed(2)}</Text>
                </View>

                {/* Payable Grand Total */}
                <View style={styles.payableRow}>
                  <Text style={styles.payableLabel}>PAYABLE</Text>
                  <Text style={styles.payableAmount}>Rs. {total.toFixed(2)}</Text>
                </View>
              </View>

              {/* Big Action Button 1: PROCEED TO PAYMENT */}
              <TouchableOpacity 
                style={[styles.proceedPayBtn, cart.length === 0 && { opacity: 0.55 }]}
                {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
                onPress={openCheckout}
                disabled={cart.length === 0}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.proceedPayBtnText}>PROCEED TO PAYMENT</Text>
              </TouchableOpacity>

              {/* Action Button 2: HOLD / PENDING ORDER */}
              <TouchableOpacity 
                style={[styles.holdOrderBtn, cart.length === 0 && { opacity: 0.55 }]}
                {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
                onPress={sendToKitchen}
                disabled={cart.length === 0}
                activeOpacity={0.85}
              >
                <Ionicons name="pause-circle-outline" size={15} color="#52141C" style={{ marginRight: 6 }} />
                <Text style={styles.holdOrderBtnText}>HOLD / PENDING ORDER</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ========================================================
          MODAL: DINING TABLE SELECTION
          ======================================================== */}
      <Modal visible={tableModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 680 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Select Table / Cabin</Text>
              <TouchableOpacity onPress={() => setTableModalVisible(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Table Search Bar */}
            <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
              <View style={styles.modalSearchBar}>
                <View style={styles.modalSearchIconOrb}>
                  <Ionicons name="search" size={14} color="#52141C" />
                </View>
                <TextInput 
                  style={styles.modalSearchInput}
                  placeholder="Search table by name or zone..."
                  placeholderTextColor="#8A7A70"
                  value={tableSearchQuery}
                  onChangeText={setTableSearchQuery}
                />
                {tableSearchQuery ? (
                  <TouchableOpacity onPress={() => setTableSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#D4AF37" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.modalZonesRow}>
              {['All', ...zones].map(z => (
                <TouchableOpacity
                  key={z}
                  style={[styles.modalZonePill, tableModalZone === z && styles.modalZonePillActive]}
                  onPress={() => setTableModalZone(z)}
                >
                  <Text style={[styles.modalZoneText, tableModalZone === z && styles.modalZoneTextActive]}>{z}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 360, padding: 14 }}>
              <View style={styles.tablesModalGrid}>
                {tables
                  .filter(t => tableModalZone === 'All' || t.zone === tableModalZone)
                  .filter(t => !tableSearchQuery || t.name.toLowerCase().includes(tableSearchQuery.toLowerCase()) || t.zone.toLowerCase().includes(tableSearchQuery.toLowerCase()))
                  .map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.tableModalCard,
                        t.status === 'occupied' && styles.tableModalCardBusy,
                        t.status === 'available' && styles.tableModalCardAvail
                      ]}
                      onPress={() => handleTableSelect(t.id)}
                    >
                      <Text style={styles.tableModalCardName}>{t.name}</Text>
                      <Text style={styles.tableModalCardMeta}>{t.zone} • {t.seats} seats</Text>
                      <Text style={[
                        styles.tableModalCardStatus,
                        t.status === 'available' ? { color: '#059669' } : { color: '#DC2626' }
                      ]}>
                        {t.status.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: CUSTOMER SELECTOR
          ======================================================== */}
      <Modal visible={customerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Select or Register Customer</Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              {isCreatingNewCustomer ? (
                <View>
                  <Text style={styles.inputLabel}>Customer Name</Text>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="e.g. Tariq Khan"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />

                  <Text style={styles.inputLabel}>Mobile Phone</Text>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="0300-1234567"
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />

                  <Text style={styles.inputLabel}>Delivery Address</Text>
                  <TextInput 
                    style={[styles.modalInput, { height: 60 }]}
                    placeholder="Full street address..."
                    multiline
                    value={customerAddress}
                    onChangeText={setCustomerAddress}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity 
                      style={[styles.modalSecondaryBtn, { flex: 1 }]}
                      onPress={() => setIsCreatingNewCustomer(false)}
                    >
                      <Text style={styles.modalSecondaryBtnText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, { flex: 1 }]}
                      onPress={handleSaveNewCustomer}
                    >
                      <Text style={styles.modalPrimaryBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={[styles.modalSearchBar, { marginBottom: 12 }]}>
                    <View style={styles.modalSearchIconOrb}>
                      <Ionicons name="search" size={14} color="#52141C" />
                    </View>
                    <TextInput 
                      style={styles.modalSearchInput}
                      placeholder="Search customer by name or phone..."
                      placeholderTextColor="#8A7A70"
                      value={customerSearchQuery}
                      onChangeText={setCustomerSearchQuery}
                    />
                    {customerSearchQuery ? (
                      <TouchableOpacity onPress={() => setCustomerSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#D4AF37" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity 
                    style={styles.addNewCustBar}
                    onPress={() => setIsCreatingNewCustomer(true)}
                  >
                    <Ionicons name="person-add" size={14} color="#BE123C" style={{ marginRight: 6 }} />
                    <Text style={styles.addNewCustBarText}>+ Register New Customer</Text>
                  </TouchableOpacity>

                  <ScrollView style={{ maxHeight: 220 }}>
                    {customers
                      .filter(c => !customerSearchQuery || c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone.includes(customerSearchQuery))
                      .map(cust => (
                        <TouchableOpacity
                          key={cust.id}
                          style={styles.custRow}
                          onPress={() => {
                            setSelectedCustomerId(cust.id);
                            setCustomerModalVisible(false);
                          }}
                        >
                          <View>
                            <Text style={styles.custRowName}>{cust.name}</Text>
                            <Text style={styles.custRowPhone}>{cust.phone}</Text>
                          </View>
                          <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: CHECKOUT & MULTI-PAYMENT SPLIT
          ======================================================== */}
      <Modal visible={checkoutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 540 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Settle & Pay Bill</Text>
              <TouchableOpacity onPress={() => setCheckoutModalVisible(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 18 }}>
              <View style={styles.checkoutTotalCard}>
                <Text style={styles.checkoutTotalCardLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={styles.checkoutTotalCardVal}>Rs. {total.toFixed(2)}</Text>
              </View>

              {/* Payment Row */}
              <View style={{ marginVertical: 10 }}>
                {payments.map((p, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <View style={styles.payTypeSelector}>
                      {(['cash', 'card', 'online'] as const).map(m => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.payTypePill, p.type === m && styles.payTypePillActive]}
                          onPress={() => updatePayment(idx, 'type', m)}
                        >
                          <Text style={[styles.payTypePillText, p.type === m && styles.payTypePillTextActive]}>
                            {m.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput 
                      style={styles.payAmountInput}
                      keyboardType="numeric"
                      value={p.amount.toString()}
                      onChangeText={v => updatePayment(idx, 'amount', v)}
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.proceedPayBtn, remaining > 0.01 && { opacity: 0.55 }, { marginTop: 10 }]}
                onPress={handleFinalizeOrder}
              >
                <Text style={styles.proceedPayBtnText}>CONFIRM PAYMENT & PRINT BILL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: RUNNING ORDERS / KITCHEN TICKETS
          ======================================================== */}
      <Modal visible={pendingOrdersModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 580 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Running Orders ({tickets.length})</Text>
              <TouchableOpacity onPress={() => setPendingOrdersModalVisible(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Running Orders Search Bar */}
            <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
              <View style={styles.modalSearchBar}>
                <View style={styles.modalSearchIconOrb}>
                  <Ionicons name="search" size={14} color="#52141C" />
                </View>
                <TextInput 
                  style={styles.modalSearchInput}
                  placeholder="Search ticket #, table, or server..."
                  placeholderTextColor="#8A7A70"
                  value={pendingOrderSearchQuery}
                  onChangeText={setPendingOrderSearchQuery}
                />
                {pendingOrderSearchQuery ? (
                  <TouchableOpacity onPress={() => setPendingOrderSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#D4AF37" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <ScrollView style={{ maxHeight: 420, padding: 14 }}>
              {tickets.filter(t => !pendingOrderSearchQuery || 
                t.id.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase()) || 
                t.tableId?.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase()) ||
                t.server?.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase())
              ).length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={36} color="#CBD5E1" style={{ marginBottom: 6 }} />
                  <Text style={{ color: '#64748B', fontWeight: '700' }}>No active running orders found.</Text>
                </View>
              ) : (
                tickets
                  .filter(t => !pendingOrderSearchQuery || 
                    t.id.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase()) || 
                    t.tableId?.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase()) ||
                    t.server?.toLowerCase().includes(pendingOrderSearchQuery.toLowerCase())
                  )
                  .map(t => {
                    const ticketSubtotal = t.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
                    const isTable = t.tableId && t.tableId !== 'takeaway' && t.tableId !== 'delivery';
                    const targetTable = isTable ? tables.find(tbl => tbl.id === t.tableId) : null;
                    const tableNameDisplay = targetTable ? targetTable.name : (t.tableName || (t.tableId ? t.tableId.toUpperCase() : 'TAKEAWAY'));
                    const statusColor = t.status === 'served' ? '#059669' : '#D97706';
                    const statusBg = t.status === 'served' ? 'rgba(209, 250, 229, 0.85)' : 'rgba(254, 243, 199, 0.85)';

                    return (
                      <View key={t.id} style={styles.ticketCard}>
                        {/* Top Row: Ticket ID + Table & Status Badge */}
                        <View style={styles.ticketCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="receipt-outline" size={16} color="#52141C" />
                            <Text style={styles.ticketCardNumber}>Ticket #{t.id.slice(-6).toUpperCase()}</Text>
                            <View style={styles.ticketTablePill}>
                              <Ionicons name={isTable ? "restaurant-outline" : "bag-handle-outline"} size={11} color="#52141C" />
                              <Text style={styles.ticketTableText}>{tableNameDisplay}</Text>
                            </View>
                          </View>

                          <View style={[styles.ticketStatusPill, { backgroundColor: statusBg, borderColor: statusColor }]}>
                            <Text style={[styles.ticketStatusText, { color: statusColor }]}>
                              {t.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Meta info: Server, Items Count, Running Total */}
                        <View style={styles.ticketMetaRow}>
                          <Text style={styles.ticketMetaText}>
                            Server: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{t.server || 'Staff'}</Text> • {t.items.reduce((s, i) => s + i.qty, 0)} items
                          </Text>
                          <Text style={styles.ticketSubtotalText}>
                            Rs. {ticketSubtotal.toLocaleString()}
                          </Text>
                        </View>

                        {/* Items preview list */}
                        <View style={styles.ticketItemsList}>
                          {t.items.map((it, idx) => (
                            <View key={idx} style={styles.ticketItemRow}>
                              <Text style={styles.ticketItemQty}>{it.qty}x</Text>
                              <Text style={styles.ticketItemName} numberOfLines={1}>{it.name}</Text>
                              <Text style={styles.ticketItemPrice}>Rs. {(it.price * it.qty).toLocaleString()}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Interactive Action Row: Create Bill & Settle / Load to Cart */}
                        <View style={styles.ticketActionRow}>
                          <TouchableOpacity
                            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
                            style={styles.ticketCartBtn}
                            onPress={() => handleCreateBillFromTicket(t, false)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="cart-outline" size={14} color="#475569" style={{ marginRight: 4 }} />
                            <Text style={styles.ticketCartBtnText}>Load Cart</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
                            style={styles.ticketBillBtn}
                            onPress={() => handleCreateBillFromTicket(t, true)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="flash" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.ticketBillBtnText}>⚡ Create Bill & Settle</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post-Payment Table Decision Modal */}
      {tableDecisionModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxWidth: 460, padding: 18 }]}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#1E293B', marginBottom: 6 }}>
                Bill Settled for {tableDecisionModal.tableName}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 14 }}>
                Would you like to release this table now, or are guests still seated?
              </Text>

              <TouchableOpacity 
                style={[styles.proceedPayBtn, { marginBottom: 8 }]}
                onPress={() => {
                  settleBill(tableDecisionModal.tableId);
                  setGeneratedInvoice(tableDecisionModal.invoice);
                  setTableDecisionModal(null);
                }}
              >
                <Text style={styles.proceedPayBtnText}>Release Table Now</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.holdOrderBtn}
                onPress={() => {
                  markTableBilled(tableDecisionModal.tableId);
                  setGeneratedInvoice(tableDecisionModal.invoice);
                  setTableDecisionModal(null);
                }}
              >
                <Text style={styles.holdOrderBtnText}>Keep Seated as Billed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================
          MODAL: VARIANT / PORTION SELECTION (GLASSMORPHIC)
          ======================================================== */}
      {variantModalItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxWidth: 440 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="options-outline" size={18} color="#D4AF37" />
                  <Text style={styles.modalHeaderTitle}>Select Portion / Variant</Text>
                </View>
                <TouchableOpacity onPress={() => setVariantModalItem(null)}>
                  <Ionicons name="close" size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#1E293B', marginBottom: 4 }}>
                  {variantModalItem.name}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 14 }}>
                  Category: {variantModalItem.category} • Choose serving portion
                </Text>

                <View style={{ gap: 8 }}>
                  {variantModalItem.variants?.map((v, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.variantOptionRow}
                      onPress={() => handleVariantSelect(v)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.variantDot} />
                        <Text style={styles.variantOptionName}>{v.name}</Text>
                      </View>
                      <View style={styles.variantPricePill}>
                        <Text style={styles.variantPriceText}>Rs. {v.price.toLocaleString()}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================
          MODAL: DISCOUNT & EVENT PROMO SELECTOR (GLASSMORPHIC)
          ======================================================== */}
      {discountModalVisible && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxWidth: 480 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pricetags-outline" size={18} color="#059669" />
                  <Text style={styles.modalHeaderTitle}>Apply Discount or Promo</Text>
                </View>
                <TouchableOpacity onPress={() => setDiscountModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18 }}>
                {/* Active Event Campaigns */}
                <Text style={styles.inputLabel}>Active Promotional Campaigns</Text>
                {campaigns.filter(c => c.status === 'active').length === 0 ? (
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginBottom: 12 }}>
                    No automated event promos currently active.
                  </Text>
                ) : (
                  <View style={{ gap: 6, marginBottom: 14 }}>
                    {campaigns.filter(c => c.status === 'active').map(camp => {
                      const isSelected = selectedEventCampaign?.id === camp.id;
                      return (
                        <TouchableOpacity
                          key={camp.id}
                          style={[styles.promoCampaignCard, isSelected && styles.promoCampaignCardActive]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedEventCampaign(null);
                              setDiscountAmount('0');
                            } else {
                              setSelectedEventCampaign(camp);
                            }
                            setDiscountModalVisible(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.promoCampaignTitle, isSelected && { color: '#059669' }]}>
                              {camp.title}
                            </Text>
                            <Text style={styles.promoCampaignSub}>
                              {camp.type === 'percentage' ? `${camp.value}% Off` : `Rs. ${camp.value} Off`}
                              {camp.minSpend ? ` • Min Order: Rs. ${camp.minSpend}` : ''}
                            </Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={18} color="#059669" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Custom Discount Input (Role Guarded) */}
                {canApplyCustomDiscount ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.inputLabel}>Manual Discount Amount (Rs.)</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={customDiscountInput}
                        onChangeText={setCustomDiscountInput}
                      />
                      <TouchableOpacity
                        style={[styles.modalPrimaryBtn, { paddingHorizontal: 16 }]}
                        onPress={() => {
                          setSelectedEventCampaign(null);
                          setDiscountAmount(customDiscountInput || '0');
                          setDiscountModalVisible(false);
                        }}
                      >
                        <Text style={styles.modalPrimaryBtnText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 8, padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 }}>
                    <Text style={{ fontSize: 10.5, color: '#64748B' }}>
                      Manual custom discount requires Admin or Manager authorization.
                    </Text>
                  </View>
                )}

                {/* Reset Discount Button */}
                {discountVal > 0 && (
                  <TouchableOpacity
                    style={{ marginTop: 12, alignItems: 'center' }}
                    onPress={() => {
                      setSelectedEventCampaign(null);
                      setDiscountAmount('0');
                      setCustomDiscountInput('0');
                      setDiscountModalVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#DC2626' }}>
                      Remove Discount
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Invoice Print Preview Modal */}
      {generatedInvoice && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxWidth: 650, maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>Invoice #{generatedInvoice.id}</Text>
                <TouchableOpacity onPress={() => setGeneratedInvoice(null)}>
                  <Ionicons name="close" size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: 14 }}>
                <InvoiceComponent invoice={generatedInvoice} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage: 'radial-gradient(circle at 12% 18%, rgba(212, 175, 55, 0.08) 0%, transparent 45%), radial-gradient(circle at 88% 82%, rgba(82, 20, 28, 0.06) 0%, transparent 45%), linear-gradient(135deg, #FBF8F2 0%, #F3EDE2 50%, #ECE4D5 100%)',
        minHeight: '100vh',
      } as any
    }),
  },

  /* --------------------------------------------------------
     1. TOP HEADER (MODERN GLASSMORPHIC MAROON)
     -------------------------------------------------------- */
  topHeader: {
    height: 50,
    backgroundColor: 'rgba(38, 5, 9, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.35)',
    zIndex: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.22)',
      } as any
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any
    }),
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  clockText: {
    color: '#F59E0B',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any
    }),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shiftCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
      } as any
    }),
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  shiftText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  iconSquareBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
      } as any
    }),
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  userAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(229, 184, 59, 0.22)',
    borderWidth: 1.5,
    borderColor: '#E5B83B',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(229, 184, 59, 0.3)',
      } as any
    }),
  },
  userAvatarText: {
    color: '#FFE082',
    fontSize: 12,
    fontWeight: '900',
  },

  /* --------------------------------------------------------
     MOBILE SWITCHER
     -------------------------------------------------------- */
  mobileSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(38, 5, 9, 0.96)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.35)',
  },
  mobileSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
  },
  mobileSwitchBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#E5B83B',
  },
  mobileSwitchText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileSwitchTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* --------------------------------------------------------
     2. MAIN WORKSPACE
     -------------------------------------------------------- */
  mainWorkspace: {
    flex: 1,
    flexDirection: 'row',
  },

  /* --------------------------------------------------------
     LEFT: CATEGORIES (2-COL FROSTED GLASS TILES)
     -------------------------------------------------------- */
  categorySidebar: {
    width: 180,
    backgroundColor: 'rgba(28, 4, 7, 0.95)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 65%), repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 10px, transparent 10px, transparent 20px)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
      } as any
    }),
    padding: 8,
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(212, 175, 55, 0.25)',
  },
  categorySidebarMobile: {
    width: '100%',
    maxHeight: 110,
  },
  categoryHeading: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E5B83B',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 6,
    marginLeft: 2,
  },
  quickFindBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderRadius: 22,
    paddingHorizontal: 7,
    paddingRight: 9,
    height: 38,
    marginBottom: 12,
    gap: 7,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 3px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        transition: 'all 0.2s ease',
      } as any
    }),
  },
  quickFindIconOrb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFindInput: {
    flex: 1,
    height: '100%',
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 2,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any
    }),
  },
  categoriesScroll: {
    flex: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 20,
  },
  categoryTile: {
    width: '48%',
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    gap: 4,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      } as any
    }),
  },
  categoryTileActive: {
    backgroundColor: 'rgba(229, 184, 59, 0.95)',
    borderColor: '#FFE082',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 6px 18px rgba(229, 184, 59, 0.45), inset 0 1px 0 rgba(255,255,255,0.7)',
        transform: 'translateY(-1px)',
      } as any
    }),
  },
  categoryTileText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#E2E8F0',
    textAlign: 'center',
  },
  categoryTileTextActive: {
    color: '#1E293B',
    fontWeight: '900',
  },

  /* --------------------------------------------------------
     CENTER: MENU DISHES GRID (FROSTED GLASS)
     -------------------------------------------------------- */
  centerCatalog: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  catalogSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.22)',
    gap: 12,
    zIndex: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.03), inset 0 -1px 0 rgba(255, 255, 255, 0.8)',
      } as any
    }),
  },
  catalogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#32070D',
    letterSpacing: 0.3,
  },
  runningOrdersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
        cursor: 'pointer',
      } as any
    }),
  },
  runningOrdersText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  runningOrdersBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  runningOrdersBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  searchPillBox: {
    flex: 1,
    minWidth: 280,
    maxWidth: 440,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.48)',
    borderRadius: 28,
    height: 44,
    paddingHorizontal: 8,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 18px rgba(82, 20, 28, 0.07), 0 2px 8px rgba(212, 175, 55, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      } as any
    }),
  },
  searchIconOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(82, 20, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPillInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any
    }),
  },
  searchClearBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchShortcutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(245, 158, 11, 0.15)',
      } as any
    }),
  },
  searchShortcutText: {
    color: '#92400E',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dishesScrollView: {
    flex: 1,
  },
  dishesGridContainer: {
    padding: 14,
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dishCard: {
    width: '18.7%',
    minWidth: 155,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 148,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    position: 'relative',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      } as any
    }),
  },
  dishCardInCart: {
    borderColor: 'rgba(82, 20, 28, 0.55)',
    backgroundColor: 'rgba(255, 248, 248, 0.9)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 10px 28px rgba(82, 20, 28, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        transform: 'translateY(-2px)',
      } as any
    }),
  },
  inCartBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    backgroundColor: '#52141C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 5,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(82, 20, 28, 0.3)',
      } as any
    }),
  },
  inCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  dishCardImageWrapper: {
    width: '100%',
    height: 94,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.7)',
  },
  dishCardImage: {
    width: '100%',
    height: '100%',
  },
  dishCardPlaceholderBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.35)',
  },
  dishCardBadgeTag: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(82, 20, 28, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 4,
  },
  dishCardBadgeText: {
    color: '#D4AF37',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  dishSoldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  dishSoldOutText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dishCardCategoryChip: {
    backgroundColor: 'rgba(241, 245, 249, 0.75)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    marginBottom: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      } as any
    }),
  },
  dishCardCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  dishCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 17,
    marginVertical: 4,
  },
  dishCardPricePill: {
    backgroundColor: 'rgba(254, 243, 199, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)',
      } as any
    }),
  },
  dishCardPricePillActive: {
    backgroundColor: '#52141C',
    borderColor: '#52141C',
  },
  dishCardPriceText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#92400E',
  },
  dishCardPriceTextActive: {
    color: '#FFFFFF',
  },
  noItemsBox: {
    width: '100%',
    padding: 50,
    alignItems: 'center',
  },
  noItemsText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },

  /* --------------------------------------------------------
     RIGHT: CURRENT CART (CRYSTAL FROSTED GLASS)
     -------------------------------------------------------- */
  cartSidebar: {
    width: 330,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(212, 175, 55, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '-4px 0 28px rgba(0, 0, 0, 0.05), inset 1px 0 0 rgba(255, 255, 255, 0.8)',
      } as any
    }),
  },
  cartSidebarMobile: {
    width: '100%',
    borderLeftWidth: 0,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
  },
  cartHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
  cartCountPill: {
    backgroundColor: '#52141C',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  cartResetBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(254, 242, 242, 0.8)',
  },
  orderTypeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      } as any
    }),
  },
  orderTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 11,
  },
  orderTypeTabActive: {
    backgroundColor: 'rgba(53, 8, 14, 0.92)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(53, 8, 14, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
      } as any
    }),
  },
  orderTypeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  orderTypeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tableCabinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  tableCabinLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  tableCabinPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    maxWidth: 120,
  },
  tableCabinPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  changeTablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      } as any
    }),
  },
  changeTablePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  cartColumnSubheader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(250, 250, 250, 0.6)',
  },
  cartColLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  cartItemsScroll: {
    flex: 1,
  },
  emptyCartBox: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.8)',
  },
  cartItemName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  cartItemUnit: {
    fontSize: 10,
    color: '#94A3B8',
  },
  cartStepperBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cartStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      } as any
    }),
  },
  cartStepBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
  },
  cartStepQty: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#1E293B',
    minWidth: 18,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#1E293B',
  },

  /* --------------------------------------------------------
     SETTLEMENT BOTTOM (FROSTED GLASS)
     -------------------------------------------------------- */
  cartBottomSettlement: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(229, 184, 59, 0.55)',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)',
      } as any
    }),
  },
  mathSummaryLines: {
    gap: 3,
    marginBottom: 8,
  },
  mathLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mathLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  mathValue: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '700',
  },
  discountBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    gap: 3,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any
    }),
  },
  discountBadgeText: {
    fontSize: 9.5,
    color: '#059669',
    fontWeight: '800',
  },
  payableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  payableLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  payableAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  proceedPayBtn: {
    backgroundColor: '#35080E',
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 59, 0.45)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #3D070E 0%, #5E121C 50%, #440810 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 6px 20px rgba(53, 8, 14, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any
    }),
  },
  proceedPayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  holdOrderBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        cursor: 'pointer',
      } as any
    }),
  },
  holdOrderBtnText: {
    color: '#35080E',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* --------------------------------------------------------
     MODALS (FROSTED GLASS SURFACES)
     -------------------------------------------------------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any
    }),
  },
  modalBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      } as any
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.9)',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.38)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingRight: 10,
    height: 42,
    gap: 8,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05), inset 0 1px 0 #FFFFFF',
      } as any
    }),
  },
  modalSearchIconOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(82, 20, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchInput: {
    flex: 1,
    height: '100%',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any
    }),
  },
  modalZonesRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.9)',
  },
  modalZonePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
  },
  modalZonePillActive: {
    backgroundColor: '#35080E',
  },
  modalZoneText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  modalZoneTextActive: {
    color: '#FFFFFF',
  },
  tablesModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tableModalCard: {
    width: '31%',
    backgroundColor: 'rgba(250, 250, 252, 0.85)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any
    }),
  },
  tableModalCardAvail: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(240, 253, 244, 0.85)',
  },
  tableModalCardBusy: {
    borderColor: 'rgba(220, 38, 38, 0.5)',
    backgroundColor: 'rgba(254, 242, 242, 0.85)',
  },
  tableModalCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableModalCardMeta: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  tableModalCardStatus: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    marginBottom: 8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any
    }),
  },
  addNewCustBar: {
    backgroundColor: 'rgba(255, 241, 242, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(254, 205, 211, 0.9)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 10,
  },
  addNewCustBarText: {
    color: '#BE123C',
    fontSize: 11.5,
    fontWeight: '800',
  },
  custRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 9,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    marginBottom: 6,
  },
  custRowName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  custRowPhone: {
    fontSize: 10.5,
    color: '#64748B',
  },
  modalPrimaryBtn: {
    backgroundColor: '#35080E',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalSecondaryBtn: {
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  checkoutTotalCard: {
    backgroundColor: 'rgba(53, 8, 14, 0.96)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 59, 0.35)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 16px rgba(53, 8, 14, 0.25)',
      } as any
    }),
  },
  checkoutTotalCardLabel: {
    color: '#E5B83B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  checkoutTotalCardVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  payTypeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderRadius: 10,
    padding: 3,
  },
  payTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  payTypePillActive: {
    backgroundColor: '#35080E',
  },
  payTypePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  payTypePillTextActive: {
    color: '#FFFFFF',
  },
  payAmountInput: {
    flex: 1,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any
    }),
  },
  ticketCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    padding: 12,
    marginBottom: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
      } as any
    }),
  },
  ticketCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.9)',
  },
  ticketCardNumber: {
    fontWeight: '900',
    color: '#0F172A',
    fontSize: 12.5,
  },
  ticketTablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  ticketTableText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#52141C',
  },
  ticketStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketStatusText: {
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  ticketMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  ticketSubtotalText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#52141C',
  },
  ticketItemsList: {
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    gap: 4,
  },
  ticketItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketItemQty: {
    width: 24,
    fontSize: 11,
    fontWeight: '800',
    color: '#52141C',
  },
  ticketItemName: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
  },
  ticketItemPrice: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  ticketActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241, 245, 249, 0.9)',
  },
  ticketCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' } as any
    }),
  },
  ticketCartBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  ticketBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#52141C',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(82, 20, 28, 0.25)',
        cursor: 'pointer',
      } as any
    }),
  },
  ticketBillBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  variantOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any
    }),
  },
  variantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#52141C',
  },
  variantOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  variantPricePill: {
    backgroundColor: 'rgba(254, 243, 199, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  variantPriceText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
  },
  promoCampaignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  promoCampaignCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
  },
  promoCampaignTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  promoCampaignSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
});
