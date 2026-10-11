import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePortalBase } from '../hooks/usePortalBase';
import {
  useOpsStore,
  InventoryItem,
  StockMovement,
  StockMovementType,
  INVENTORY_CATEGORIES,
  STORAGE_LOCATIONS,
  getStockLevel,
  getExpiryStatus,
  StockLevel,
  ExpiryStatus,
} from '../store/opsStore';
import { useRestaurantStore, MenuItem } from '../store/restaurantStore';
import { BRAND } from '../constants/brand';
import { money, formatTime, formatDay, toWhatsAppNumber } from '../utils/format';

const UNITS = ['kg', 'Liters', 'bottles', 'packs', 'grams', 'cylinders', 'pcs', 'cartons', 'crates', 'bags', 'Tins'];

interface Props {
  backRoute?: string;
}

type TabType = 'raw' | 'receiving' | 'expiries' | 'lowstock' | 'movements' | 'dishes';

export default function InventoryScreen({ backRoute = '/manager/dashboard' }: Props) {
  const router = useRouter();
  const portalBase = usePortalBase();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const inventory = useOpsStore((s) => s.inventory);
  const stockMovements = useOpsStore((s) => s.stockMovements);
  const suppliers = useOpsStore((s) => s.suppliers);
  const addInventoryItem = useOpsStore((s) => s.addInventoryItem);
  const updateInventoryItem = useOpsStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useOpsStore((s) => s.deleteInventoryItem);
  const recordStockMovement = useOpsStore((s) => s.recordStockMovement);

  // Menu items from restaurant store for dishes stock tab
  const menuItems = useRestaurantStore((s) => s.menuItems);
  const updateMenuItem = useRestaurantStore((s) => s.updateMenuItem);

  // UI Navigation Tabs
  const [activeTab, setActiveTab] = useState<TabType>('raw');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StockLevel | 'all'>('all');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryStatus | 'all'>('all');
  const [movementFilter, setMovementFilter] = useState<StockMovementType | 'all'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  // Add / Edit Form State
  const [formItemCode, setFormItemCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formUrduName, setFormUrduName] = useState('');
  const [formCategory, setFormCategory] = useState<string>(INVENTORY_CATEGORIES[0]);
  const [formLocation, setFormLocation] = useState<string>(STORAGE_LOCATIONS[0]);
  const [formUnit, setFormUnit] = useState('kg');
  const [formStock, setFormStock] = useState('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formSupplierPhone, setFormSupplierPhone] = useState('');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formExpiryDays, setFormExpiryDays] = useState('');
  const [formInvoiceNo, setFormInvoiceNo] = useState('');

  // Quick Movement Form State
  const [movementType, setMovementType] = useState<StockMovementType>('receive');
  const [movementQty, setMovementQty] = useState('');
  const [movementNote, setMovementNote] = useState('');

  // Receiving & Invoicing Form State
  const [recItemId, setRecItemId] = useState('');
  const [recSupplier, setRecSupplier] = useState('');
  const [recInvoiceNo, setRecInvoiceNo] = useState('');
  const [recBatchNumber, setRecBatchNumber] = useState('');
  const [recQty, setRecQty] = useState('');
  const [recUnitCost, setRecUnitCost] = useState('');
  const [recExpiryDays, setRecExpiryDays] = useState('30');
  const [recLocation, setRecLocation] = useState<string>(STORAGE_LOCATIONS[0]);
  const [recReceivedBy, setRecReceivedBy] = useState('Storekeeper / Chef');
  const [recNotes, setRecNotes] = useState('');

  // Last Generated GRN State
  const [lastGrn, setLastGrn] = useState<{
    grnNo: string;
    itemName: string;
    itemCode?: string;
    qty: number;
    unit: string;
    unitCost: number;
    totalAmount: number;
    supplier: string;
    invoiceNo: string;
    batchNumber: string;
    location: string;
    receivedBy: string;
    at: number;
  } | null>(null);

  // Analytics & Summary Metrics
  const metrics = useMemo(() => {
    let totalValuation = 0;
    let lowCount = 0;
    let outCount = 0;
    let expiredCount = 0;
    let criticalExpiryCount = 0;
    let warningExpiryCount = 0;
    let totalShortageValue = 0;

    inventory.forEach((item) => {
      const val = (item.stock || 0) * (item.costPerUnit || 0);
      totalValuation += val;

      const level = getStockLevel(item);
      if (level === 'out') outCount++;
      else if (level === 'low' || level === 'critical') lowCount++;

      const exp = getExpiryStatus(item);
      if (exp.status === 'expired') expiredCount++;
      else if (exp.status === 'critical') criticalExpiryCount++;
      else if (exp.status === 'warning') warningExpiryCount++;

      if (item.stock < item.threshold) {
        const shortage = Math.max(0, item.threshold * 1.5 - item.stock);
        totalShortageValue += shortage * (item.costPerUnit || 0);
      }
    });

    return {
      totalValuation,
      totalItems: inventory.length,
      lowCount,
      outCount,
      expiredCount,
      criticalExpiryCount,
      warningExpiryCount,
      totalShortageValue,
    };
  }, [inventory]);

  // Filtered Raw Materials
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.urduName && item.urduName.toLowerCase().includes(q)) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.batchNumber && item.batchNumber.toLowerCase().includes(q)) ||
        (item.supplier && item.supplier.toLowerCase().includes(q));

      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchLocation = selectedLocation === 'All' || item.location === selectedLocation;

      const level = getStockLevel(item);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ok' && level === 'ok') ||
        (statusFilter === 'low' && (level === 'low' || level === 'critical')) ||
        (statusFilter === 'out' && level === 'out');

      return matchSearch && matchCategory && matchLocation && matchStatus;
    });
  }, [inventory, searchQuery, selectedCategory, selectedLocation, statusFilter]);

  // Filtered Expiries
  const filteredExpiries = useMemo(() => {
    return inventory
      .map((item) => ({ item, expiry: getExpiryStatus(item) }))
      .filter(({ item, expiry }) => {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q);

        const matchFilter =
          expiryFilter === 'all'
            ? expiry.status !== 'none'
            : expiry.status === expiryFilter;

        return matchSearch && matchFilter;
      })
      .sort((a, b) => (a.expiry.daysRemaining ?? 999) - (b.expiry.daysRemaining ?? 999));
  }, [inventory, searchQuery, expiryFilter]);

  // Low Stock & Shortage Reorder Items
  const lowStockItems = useMemo(() => {
    return inventory
      .filter((item) => {
        const level = getStockLevel(item);
        const matchSearch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase());
        return (level === 'low' || level === 'critical' || level === 'out') && matchSearch;
      })
      .map((item) => {
        const targetStock = Math.ceil(item.threshold * 1.5);
        const shortage = Math.max(1, targetStock - item.stock);
        const estCost = shortage * (item.costPerUnit || 0);
        return { item, targetStock, shortage, estCost };
      });
  }, [inventory, searchQuery]);

  // Inward Receiving Logs (Movements of type 'receive')
  const receivingLogs = useMemo(() => {
    return stockMovements
      .filter((m) => m.type === 'receive')
      .filter((m) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          !q ||
          m.itemName.toLowerCase().includes(q) ||
          (m.invoiceNo && m.invoiceNo.toLowerCase().includes(q)) ||
          (m.supplier && m.supplier.toLowerCase().includes(q)) ||
          (m.batchNumber && m.batchNumber.toLowerCase().includes(q)) ||
          (m.itemCode && m.itemCode.toLowerCase().includes(q))
        );
      });
  }, [stockMovements, searchQuery]);

  // All Filtered Stock Movements
  const filteredMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      const matchType = movementFilter === 'all' || m.type === movementFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.itemName.toLowerCase().includes(q) ||
        (m.itemCode && m.itemCode.toLowerCase().includes(q)) ||
        (m.note && m.note.toLowerCase().includes(q)) ||
        (m.by && m.by.toLowerCase().includes(q)) ||
        (m.invoiceNo && m.invoiceNo.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [stockMovements, movementFilter, searchQuery]);

  // Tracked Dishes in Menu
  const trackedDishes = useMemo(() => {
    return menuItems.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      return !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    });
  }, [menuItems, searchQuery]);

  // ---------------- Handlers ----------------

  const handleOpenAdd = () => {
    const nextCodeNum = inventory.length + 1;
    setFormItemCode(`SKU-RM-${String(nextCodeNum).padStart(3, '0')}`);
    setFormName('');
    setFormUrduName('');
    setFormCategory(INVENTORY_CATEGORIES[0]);
    setFormLocation(STORAGE_LOCATIONS[0]);
    setFormUnit('kg');
    setFormStock('');
    setFormThreshold('10');
    setFormCost('');
    setFormSupplier('');
    setFormSupplierPhone('');
    setFormBatchNumber(`B-${new Date().getFullYear()}-${String(nextCodeNum).padStart(3, '0')}`);
    setFormExpiryDays('30');
    setFormInvoiceNo('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormItemCode(item.itemCode || '');
    setFormName(item.name);
    setFormUrduName(item.urduName || '');
    setFormCategory(item.category);
    setFormLocation(item.location || STORAGE_LOCATIONS[0]);
    setFormUnit(item.unit);
    setFormStock(item.stock.toString());
    setFormThreshold(item.threshold.toString());
    setFormCost(item.costPerUnit ? item.costPerUnit.toString() : '');
    setFormSupplier(item.supplier || '');
    setFormSupplierPhone(item.supplierPhone || '');
    setFormBatchNumber(item.batchNumber || '');
    setFormInvoiceNo(item.invoiceNo || '');
    if (item.expiryDate) {
      const days = Math.max(0, Math.ceil((item.expiryDate - Date.now()) / 86400000));
      setFormExpiryDays(days.toString());
    } else {
      setFormExpiryDays('');
    }
    setShowEditModal(true);
  };

  const handleOpenMovement = (item: InventoryItem, defaultType: StockMovementType = 'receive') => {
    setSelectedItem(item);
    setMovementType(defaultType);
    setMovementQty('');
    setMovementNote('');
    setShowMovementModal(true);
  };

  const handleOpenReceiveModal = (presetItem?: InventoryItem) => {
    const item = presetItem || inventory[0];
    if (item) {
      setRecItemId(item.id);
      setRecSupplier(item.supplier || (suppliers[0]?.name ?? ''));
      setRecUnitCost(item.costPerUnit ? item.costPerUnit.toString() : '');
      setRecLocation(item.location || STORAGE_LOCATIONS[0]);
    }
    setRecInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
    setRecBatchNumber(`B-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setRecQty('');
    setRecExpiryDays('30');
    setRecReceivedBy('Staff Storekeeper');
    setRecNotes('');
    setShowReceiveModal(true);
  };

  const handleSaveAdd = () => {
    if (!formName.trim()) {
      alertMsg('Missing Name', 'Please enter the item name.');
      return;
    }
    const stockNum = parseFloat(formStock) || 0;
    const threshNum = parseFloat(formThreshold) || 5;
    const costNum = parseFloat(formCost) || 0;
    const expiryDaysNum = parseInt(formExpiryDays, 10);

    addInventoryItem({
      itemCode: formItemCode.trim() || undefined,
      name: formName.trim(),
      urduName: formUrduName.trim() || undefined,
      category: formCategory,
      location: formLocation,
      unit: formUnit,
      stock: stockNum,
      threshold: threshNum,
      costPerUnit: costNum,
      supplier: formSupplier.trim() || undefined,
      supplierPhone: formSupplierPhone.trim() || undefined,
      batchNumber: formBatchNumber.trim() || undefined,
      invoiceNo: formInvoiceNo.trim() || undefined,
      expiryDate: Number.isFinite(expiryDaysNum) && expiryDaysNum > 0 ? Date.now() + expiryDaysNum * 86400000 : undefined,
    });

    setShowAddModal(false);
    alertMsg('Success', `"${formName.trim()}" added to inventory.`);
  };

  const handleSaveEdit = () => {
    if (!selectedItem) return;
    if (!formName.trim()) {
      alertMsg('Missing Name', 'Please enter the item name.');
      return;
    }

    const stockNum = parseFloat(formStock) || 0;
    const threshNum = parseFloat(formThreshold) || 5;
    const costNum = parseFloat(formCost) || 0;
    const expiryDaysNum = parseInt(formExpiryDays, 10);

    updateInventoryItem(selectedItem.id, {
      itemCode: formItemCode.trim() || undefined,
      name: formName.trim(),
      urduName: formUrduName.trim() || undefined,
      category: formCategory,
      location: formLocation,
      unit: formUnit,
      stock: stockNum,
      threshold: threshNum,
      costPerUnit: costNum,
      supplier: formSupplier.trim() || undefined,
      supplierPhone: formSupplierPhone.trim() || undefined,
      batchNumber: formBatchNumber.trim() || undefined,
      invoiceNo: formInvoiceNo.trim() || undefined,
      expiryDate: Number.isFinite(expiryDaysNum) && expiryDaysNum > 0 ? Date.now() + expiryDaysNum * 86400000 : undefined,
    });

    setShowEditModal(false);
    alertMsg('Updated', `"${formName.trim()}" updated successfully.`);
  };

  const handleSaveMovement = () => {
    if (!selectedItem) return;
    const qtyNum = parseFloat(movementQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      alertMsg('Invalid Quantity', 'Please enter a valid positive quantity.');
      return;
    }

    recordStockMovement(
      selectedItem.id,
      movementType,
      qtyNum,
      movementNote.trim() || undefined,
      'Staff'
    );

    setShowMovementModal(false);
    const actionLabel =
      movementType === 'receive'
        ? `Added +${qtyNum} ${selectedItem.unit}`
        : movementType === 'usage'
        ? `Deducted -${qtyNum} ${selectedItem.unit} (Kitchen Usage)`
        : movementType === 'wastage'
        ? `Deducted -${qtyNum} ${selectedItem.unit} (Wastage)`
        : `Adjusted to ${qtyNum} ${selectedItem.unit}`;

    alertMsg('Stock Recorded', `${selectedItem.name}: ${actionLabel}`);
  };

  // Submit Goods Receiving & Invoicing
  const handleSaveReceive = () => {
    const item = inventory.find((i) => i.id === recItemId);
    if (!item) {
      alertMsg('Select Item', 'Please select an item to receive.');
      return;
    }
    const qtyNum = parseFloat(recQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      alertMsg('Invalid Quantity', 'Please enter a valid positive quantity.');
      return;
    }
    const unitCostNum = parseFloat(recUnitCost) || item.costPerUnit || 0;
    const expiryDaysNum = parseInt(recExpiryDays, 10);
    const expiryDate = Number.isFinite(expiryDaysNum) && expiryDaysNum > 0 ? Date.now() + expiryDaysNum * 86400000 : undefined;
    const grnNo = `GRN-${Date.now().toString().slice(-6)}`;
    const totalAmount = qtyNum * unitCostNum;

    // Record Stock Movement with meta
    recordStockMovement(
      item.id,
      'receive',
      qtyNum,
      `Inward Invoice #${recInvoiceNo.trim()} from ${recSupplier.trim() || 'Vendor'}. ${recNotes.trim()}`,
      recReceivedBy.trim() || 'Storekeeper',
      {
        supplier: recSupplier.trim() || item.supplier,
        invoiceNo: recInvoiceNo.trim() || undefined,
        batchNumber: recBatchNumber.trim() || undefined,
        unitCost: unitCostNum,
        expiryDate,
        location: recLocation,
      }
    );

    // Save GRN for voucher modal
    const grnData = {
      grnNo,
      itemName: item.name,
      itemCode: item.itemCode,
      qty: qtyNum,
      unit: item.unit,
      unitCost: unitCostNum,
      totalAmount,
      supplier: recSupplier.trim() || item.supplier || 'N/A',
      invoiceNo: recInvoiceNo.trim() || 'N/A',
      batchNumber: recBatchNumber.trim() || 'N/A',
      location: recLocation,
      receivedBy: recReceivedBy.trim() || 'Storekeeper',
      at: Date.now(),
    };
    setLastGrn(grnData);

    setShowReceiveModal(false);
    setShowGrnModal(true);
  };

  // Dispose Expired / Spoiled Batch as Wastage
  const handleDisposeWastage = (item: InventoryItem) => {
    const confirmMsg = `Dispose entire or partial stock of "${item.name}" (${item.stock} ${item.unit}) as Spoilage / Wastage?`;
    const executeDispose = () => {
      recordStockMovement(
        item.id,
        'wastage',
        item.stock,
        `Disposed expired / spoiled batch ${item.batchNumber || ''}`,
        'Kitchen Supervisor'
      );
      alertMsg('Disposed', `${item.stock} ${item.unit} marked as wastage.`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) executeDispose();
    } else {
      Alert.alert('Confirm Wastage Write-Off', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Write Off (Dispose)', style: 'destructive', onPress: executeDispose },
      ]);
    }
  };

  // Send WhatsApp Reorder to Supplier
  const handleSendWhatsAppReorder = (item: InventoryItem, shortageQty: number) => {
    const phone = item.supplierPhone;
    const cleanNumber = phone ? toWhatsAppNumber(phone) : '';
    const message = `*SULTAN RESTAURANT - PURCHASE REORDER ORDER*
---------------------------------------
Supplier: *${item.supplier || 'Vendor'}*
Date: ${new Date().toLocaleDateString('en-GB')}

Item Name: *${item.name}* ${item.urduName ? `(${item.urduName})` : ''}
Item Code: *${item.itemCode || 'N/A'}*
Current Stock: ${item.stock} ${item.unit} (LOW STOCK ALERT)
Required Quantity: *${shortageQty} ${item.unit}*
Estimated Price: ${item.costPerUnit ? money(item.costPerUnit) : 'As agreed'} / ${item.unit}

Delivery Address: Sultan Restaurant & BBQ, Main Commercial Area
Please confirm delivery schedule and send invoice copy. Shukriya!`;

    const encoded = encodeURIComponent(message);
    if (cleanNumber) {
      Linking.openURL(`https://wa.me/${cleanNumber}?text=${encoded}`);
    } else {
      // Copy to clipboard or open general WA
      Linking.openURL(`https://wa.me/?text=${encoded}`).catch(() => {
        alertMsg('Reorder Message Generated', message);
      });
    }
  };

  const handleDelete = (item: InventoryItem) => {
    const confirmText = `Are you sure you want to delete "${item.name}" from inventory?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmText)) {
        deleteInventoryItem(item.id);
      }
    } else {
      Alert.alert('Delete Inventory Item', confirmText, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteInventoryItem(item.id) },
      ]);
    }
  };

  const handleAdjustDishStock = (dish: MenuItem, delta: number) => {
    const current = dish.stockQty || 0;
    const next = Math.max(0, current + delta);
    updateMenuItem(dish.id, {
      trackStock: true,
      stockQty: next,
    });
  };

  const alertMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const getStatusBadge = (item?: InventoryItem | null) => {
    if (!item) {
      return { bg: BRAND.successSoft, text: BRAND.success, label: 'In Stock', icon: 'checkmark-circle' };
    }
    const level = getStockLevel(item);
    switch (level) {
      case 'ok':
        return { bg: BRAND.successSoft, text: BRAND.success, label: 'In Stock', icon: 'checkmark-circle' };
      case 'low':
        return { bg: BRAND.warnSoft, text: BRAND.warn, label: 'Low Stock', icon: 'alert-circle' };
      case 'critical':
      case 'out':
      default:
        return {
          bg: BRAND.dangerSoft,
          text: BRAND.danger,
          label: (item.stock ?? 0) <= 0 ? 'Out of Stock' : 'Critical Low',
          icon: 'close-circle',
        };
    }
  };

  const getMovementConfig = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t === 'receive' || t === 'in' || t === 'add') {
      return { label: 'Received Stock', color: BRAND.success, bg: BRAND.successSoft, icon: 'arrow-down-circle' };
    }
    if (t === 'usage' || t === 'out' || t === 'used' || t === 'kitchen') {
      return { label: 'Kitchen Usage', color: BRAND.info, bg: BRAND.infoSoft, icon: 'restaurant' };
    }
    if (t === 'wastage' || t === 'waste' || t === 'damage' || t === 'spoilage') {
      return { label: 'Wastage / Spoilage', color: BRAND.danger, bg: BRAND.dangerSoft, icon: 'trash' };
    }
    return { label: 'Manual Adjustment', color: BRAND.purple, bg: BRAND.purpleSoft, icon: 'options' };
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(backRoute as any))}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={BRAND.ink} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Inventory & Stock Control</Text>
            <Text style={styles.headerSubtitle}>
              SKU Codes, Goods Receiving, Invoicing, Expiry & Automated Reorders
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.border }]}
            onPress={() => router.push(`${portalBase}/suppliers` as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="bus-outline" size={16} color={BRAND.burgundy} style={{ marginRight: 4 }} />
            <Text style={[styles.addBtnText, { color: BRAND.burgundy }]}>Suppliers Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: BRAND.success }]}
            onPress={() => handleOpenReceiveModal()}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>+ Receive & Invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add SKU</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { borderLeftColor: BRAND.gold }]}>
          <View style={styles.kpiIconBox}>
            <Ionicons name="cash-outline" size={22} color={BRAND.burgundy} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Total Asset Valuation</Text>
            <Text style={styles.kpiValue}>{money(metrics.totalValuation)}</Text>
          </View>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: BRAND.info }]}>
          <View style={[styles.kpiIconBox, { backgroundColor: BRAND.infoSoft }]}>
            <Ionicons name="cube-outline" size={22} color={BRAND.info} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Total SKU Items</Text>
            <Text style={styles.kpiValue}>{metrics.totalItems} Items</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.kpiCard, { borderLeftColor: BRAND.warn }]}
          onPress={() => setActiveTab('lowstock')}
          activeOpacity={0.7}
        >
          <View style={[styles.kpiIconBox, { backgroundColor: BRAND.warnSoft }]}>
            <Ionicons name="alert-circle-outline" size={22} color={BRAND.warn} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Low Stock & Out</Text>
            <Text style={[styles.kpiValue, { color: BRAND.warn }]}>
              {metrics.lowCount + metrics.outCount} Items
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.kpiCard, { borderLeftColor: BRAND.danger }]}
          onPress={() => setActiveTab('expiries')}
          activeOpacity={0.7}
        >
          <View style={[styles.kpiIconBox, { backgroundColor: BRAND.dangerSoft }]}>
            <Ionicons name="timer-outline" size={22} color={BRAND.danger} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Expiry Alerts</Text>
            <Text style={[styles.kpiValue, { color: BRAND.danger }]}>
              {metrics.expiredCount + metrics.criticalExpiryCount} Urgencies
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 6 Main Navigation Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'raw' && styles.tabBtnActive]}
          onPress={() => setActiveTab('raw')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cube"
            size={16}
            color={activeTab === 'raw' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'raw' && styles.tabBtnTextActive]}>
            Items Directory ({inventory.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'receiving' && styles.tabBtnActive]}
          onPress={() => setActiveTab('receiving')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="receipt"
            size={16}
            color={activeTab === 'receiving' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'receiving' && styles.tabBtnTextActive]}>
            Receiving & Invoicing ({receivingLogs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'expiries' && styles.tabBtnActive]}
          onPress={() => setActiveTab('expiries')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="timer"
            size={16}
            color={activeTab === 'expiries' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'expiries' && styles.tabBtnTextActive]}>
            Expiries & Shelf-Life ({metrics.expiredCount + metrics.criticalExpiryCount + metrics.warningExpiryCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'lowstock' && styles.tabBtnActive]}
          onPress={() => setActiveTab('lowstock')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="alert-circle"
            size={16}
            color={activeTab === 'lowstock' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'lowstock' && styles.tabBtnTextActive]}>
            Low Stock & Reorders ({lowStockItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'movements' && styles.tabBtnActive]}
          onPress={() => setActiveTab('movements')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="swap-horizontal"
            size={16}
            color={activeTab === 'movements' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'movements' && styles.tabBtnTextActive]}>
            Movement Log ({stockMovements.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'dishes' && styles.tabBtnActive]}
          onPress={() => setActiveTab('dishes')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="restaurant"
            size={16}
            color={activeTab === 'dishes' ? BRAND.burgundy : BRAND.muted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'dishes' && styles.tabBtnTextActive]}>
            Ready Dishes ({trackedDishes.filter((d) => d.trackStock).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Global Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={BRAND.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'raw'
                ? 'Search SKU code, item name, Urdu name, location, supplier...'
                : activeTab === 'receiving'
                ? 'Search invoice #, supplier, batch #, item...'
                : activeTab === 'expiries'
                ? 'Search expiring items or batches...'
                : activeTab === 'lowstock'
                ? 'Search low stock shortages...'
                : activeTab === 'movements'
                ? 'Search movement history, notes, staff...'
                : 'Search menu dishes...'
            }
            placeholderTextColor={BRAND.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={BRAND.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: RAW INGREDIENTS & ITEMS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'raw' && (
        <View>
          {/* Category Chips Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContent}
          >
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === 'All' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('All')}
            >
              <Text style={[styles.categoryChipText, selectedCategory === 'All' && styles.categoryChipTextActive]}>
                All Categories ({inventory.length})
              </Text>
            </TouchableOpacity>
            {INVENTORY_CATEGORIES.map((cat) => {
              const count = inventory.filter((i) => i.category === cat).length;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                    {cat} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Storage Locations Filter Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ gap: 6 }}
          >
            <TouchableOpacity
              style={[styles.locationChip, selectedLocation === 'All' && styles.locationChipActive]}
              onPress={() => setSelectedLocation('All')}
            >
              <Ionicons
                name="location-outline"
                size={12}
                color={selectedLocation === 'All' ? '#FFF' : BRAND.muted}
              />
              <Text style={[styles.locationChipText, selectedLocation === 'All' && styles.locationChipTextActive]}>
                All Storage Zones
              </Text>
            </TouchableOpacity>
            {STORAGE_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationChip, selectedLocation === loc && styles.locationChipActive]}
                onPress={() => setSelectedLocation(loc)}
              >
                <Ionicons
                  name="file-tray-full-outline"
                  size={12}
                  color={selectedLocation === loc ? '#FFF' : BRAND.muted}
                />
                <Text style={[styles.locationChipText, selectedLocation === loc && styles.locationChipTextActive]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Status Filter Chips */}
          <View style={styles.statusFilterRow}>
            {(['all', 'ok', 'low', 'out'] as const).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.statusFilterBtn, statusFilter === st && styles.statusFilterBtnActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[styles.statusFilterBtnText, statusFilter === st && styles.statusFilterBtnTextActive]}>
                  {st === 'all'
                    ? 'All Stock Levels'
                    : st === 'ok'
                    ? '🟢 In Stock (Safe)'
                    : st === 'low'
                    ? '🟠 Low Stock Warning'
                    : '🔴 Out of Stock'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Items Grid */}
          {filteredInventory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>No Inventory Items Found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search query or add a new ingredient.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.addBtnText}>Add First Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.itemsGrid}>
              {filteredInventory.map((item) => {
                const badge = getStatusBadge(item);
                const expiry = getExpiryStatus(item);
                const isLow = item.stock <= item.threshold;
                const totalItemVal = item.stock * (item.costPerUnit || 0);
                const percentLeft = Math.min(100, Math.round((item.stock / (item.threshold * 2 || 1)) * 100));

                return (
                  <View key={item.id} style={styles.itemCard}>
                    {/* Item Card Header */}
                    <View style={styles.itemCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {item.itemCode ? (
                            <View style={styles.skuBadge}>
                              <Text style={styles.skuBadgeText}>{item.itemCode}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.categoryTagText}>{item.category}</Text>
                        </View>
                        <Text style={styles.itemCardTitle}>{item.name}</Text>
                        {item.urduName ? <Text style={styles.urduTitle}>{item.urduName}</Text> : null}
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                          <Ionicons
                            name={badge.icon as any}
                            size={12}
                            color={badge.text}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                        {expiry.status !== 'none' ? (
                          <View style={[styles.expiryMiniBadge, { backgroundColor: expiry.bgColor }]}>
                            <Text style={[styles.expiryMiniBadgeText, { color: expiry.color }]}>
                              {expiry.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Storage Location & Batch Info */}
                    <View style={styles.locationMetaBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="location" size={13} color={BRAND.burgundy} />
                        <Text style={styles.locationMetaText}>{item.location || 'Dry Ration Store'}</Text>
                      </View>
                      {item.batchNumber ? (
                        <Text style={styles.batchMetaText}>Batch: #{item.batchNumber}</Text>
                      ) : null}
                    </View>

                    {/* Stock Numbers & Progress Bar */}
                    <View style={styles.stockDetailsBox}>
                      <View style={styles.stockStatRow}>
                        <View>
                          <Text style={styles.stockStatLabel}>Current Stock</Text>
                          <Text style={[styles.stockStatValue, isLow && { color: badge.text }]}>
                            {item.stock} <Text style={{ fontSize: 13, fontWeight: '500' }}>{item.unit}</Text>
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.stockStatLabel}>Reorder Alert Level</Text>
                          <Text style={styles.stockStatValue}>
                            {item.threshold} <Text style={{ fontSize: 13, fontWeight: '500' }}>{item.unit}</Text>
                          </Text>
                        </View>
                      </View>

                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${percentLeft}%`,
                              backgroundColor: item.stock <= 0 ? BRAND.danger : isLow ? BRAND.warn : BRAND.success,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Valuation & Cost */}
                    <View style={styles.valuationRow}>
                      <View>
                        <Text style={styles.valLabel}>Unit Purchase Cost</Text>
                        <Text style={styles.valValue}>
                          {item.costPerUnit ? money(item.costPerUnit) : 'N/A'}{' '}
                          <Text style={{ fontSize: 11, color: BRAND.muted }}>/{item.unit}</Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.valLabel}>Stock Valuation</Text>
                        <Text style={[styles.valValue, { color: BRAND.burgundy }]}>{money(totalItemVal)}</Text>
                      </View>
                    </View>

                    {/* Supplier Box */}
                    {item.supplier ? (
                      <View style={styles.supplierRow}>
                        <Ionicons name="business-outline" size={14} color={BRAND.muted} style={{ marginRight: 6 }} />
                        <Text style={styles.supplierName} numberOfLines={1}>
                          {item.supplier}
                        </Text>
                        {item.supplierPhone ? (
                          <TouchableOpacity
                            style={styles.supplierCallBtn}
                            onPress={() => {
                              const num = toWhatsAppNumber(item.supplierPhone!);
                              Linking.openURL(`https://wa.me/${num}`);
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                            <Text style={styles.supplierCallText}>WhatsApp</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.quickMovementBtn}
                        onPress={() => handleOpenReceiveModal(item)}
                      >
                        <Ionicons name="arrow-down-circle" size={16} color={BRAND.success} />
                        <Text style={[styles.quickMovementBtnText, { color: BRAND.success }]}>Receive</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickUsageBtn}
                        onPress={() => handleOpenMovement(item, 'usage')}
                      >
                        <Ionicons name="restaurant" size={15} color={BRAND.info} />
                        <Text style={styles.quickUsageBtnText}>Usage (-)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: '#F3F4F6' }]}
                        onPress={() => handleOpenMovement(item, 'adjust')}
                        accessibilityLabel="Adjust Stock"
                      >
                        <Ionicons name="options-outline" size={16} color={BRAND.ink} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleOpenEdit(item)}
                        accessibilityLabel="Edit Item"
                      >
                        <Ionicons name="pencil-outline" size={16} color={BRAND.ink} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: BRAND.dangerSoft }]}
                        onPress={() => handleDelete(item)}
                        accessibilityLabel="Delete Item"
                      >
                        <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIVING & INVOICING MODULE */}
      {/* ========================================================================= */}
      {activeTab === 'receiving' && (
        <View>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Goods Receiving & Inward Shipments</Text>
              <Text style={styles.sectionDesc}>
                Log vendor deliveries, inward invoice numbers, batch shelf-life, and print Goods Receipt Notes (GRN).
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: BRAND.success }]}
              onPress={() => handleOpenReceiveModal()}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.addBtnText}>Receive New Stock</Text>
            </TouchableOpacity>
          </View>

          {receivingLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={48} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>No Inward Deliveries Recorded</Text>
              <Text style={styles.emptyDesc}>Receive inventory shipments with invoice numbers and batch numbers.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {receivingLogs.map((m) => {
                const totalVal = (m.qty || 0) * (m.unitCost || 0);

                return (
                  <View key={m.id} style={styles.receivingCard}>
                    <View style={styles.receivingCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {m.itemCode ? (
                            <View style={styles.skuBadge}>
                              <Text style={styles.skuBadgeText}>{m.itemCode}</Text>
                            </View>
                          ) : null}
                          {m.invoiceNo ? (
                            <View style={[styles.skuBadge, { backgroundColor: '#EDE9FE' }]}>
                              <Text style={[styles.skuBadgeText, { color: '#6D28D9' }]}>Inv: {m.invoiceNo}</Text>
                            </View>
                          ) : null}
                          {m.batchNumber ? (
                            <View style={[styles.skuBadge, { backgroundColor: '#FEF3C7' }]}>
                              <Text style={[styles.skuBadgeText, { color: '#B45309' }]}>Batch: {m.batchNumber}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.receivingItemName}>{m.itemName}</Text>
                        <Text style={styles.receivingSupplierText}>
                          Vendor: <Text style={{ fontWeight: '700', color: BRAND.ink }}>{m.supplier || 'Vendor'}</Text>
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.receivingQtyText}>+{m.qty}</Text>
                        {totalVal > 0 ? (
                          <Text style={styles.receivingValText}>{money(totalVal)}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.receivingDetailsGrid}>
                      <View>
                        <Text style={styles.receivingMetaLabel}>Received Date & Time</Text>
                        <Text style={styles.receivingMetaValue}>
                          {formatDay(m.at)} • {formatTime(m.at)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.receivingMetaLabel}>Unit Purchase Cost</Text>
                        <Text style={styles.receivingMetaValue}>
                          {m.unitCost ? money(m.unitCost) : 'As per PO'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.receivingMetaLabel}>Received By</Text>
                        <Text style={styles.receivingMetaValue}>{m.by || 'Storekeeper'}</Text>
                      </View>
                    </View>

                    {m.note ? (
                      <Text style={styles.receivingNoteText}>
                        <Ionicons name="document-text-outline" size={13} color={BRAND.muted} /> {m.note}
                      </Text>
                    ) : null}

                    <View style={styles.receivingActionRow}>
                      <TouchableOpacity
                        style={styles.grnBtn}
                        onPress={() => {
                          setLastGrn({
                            grnNo: `GRN-${m.id.slice(-6).toUpperCase()}`,
                            itemName: m.itemName,
                            itemCode: m.itemCode,
                            qty: m.qty,
                            unit: '',
                            unitCost: m.unitCost || 0,
                            totalAmount: (m.qty || 0) * (m.unitCost || 0),
                            supplier: m.supplier || 'Vendor',
                            invoiceNo: m.invoiceNo || 'N/A',
                            batchNumber: m.batchNumber || 'N/A',
                            location: 'Kitchen Store',
                            receivedBy: m.by || 'Storekeeper',
                            at: m.at,
                          });
                          setShowGrnModal(true);
                        }}
                      >
                        <Ionicons name="print-outline" size={14} color={BRAND.burgundy} />
                        <Text style={styles.grnBtnText}>View Goods Receipt Note (GRN)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPIRIES & SHELF-LIFE MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'expiries' && (
        <View>
          {/* Expiry Header & Filter Chips */}
          <View style={styles.expiryKpiRow}>
            <TouchableOpacity
              style={[
                styles.expiryKpiCard,
                { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
                expiryFilter === 'expired' && { borderWidth: 2 },
              ]}
              onPress={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
            >
              <Text style={[styles.expiryKpiCount, { color: '#DC2626' }]}>{metrics.expiredCount}</Text>
              <Text style={[styles.expiryKpiLabel, { color: '#B91C1C' }]}>Expired (Danger!)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.expiryKpiCard,
                { backgroundColor: '#FFEDD5', borderColor: '#EA580C' },
                expiryFilter === 'critical' && { borderWidth: 2 },
              ]}
              onPress={() => setExpiryFilter(expiryFilter === 'critical' ? 'all' : 'critical')}
            >
              <Text style={[styles.expiryKpiCount, { color: '#EA580C' }]}>{metrics.criticalExpiryCount}</Text>
              <Text style={[styles.expiryKpiLabel, { color: '#C2410C' }]}>Critical (≤ 3 Days)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.expiryKpiCard,
                { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
                expiryFilter === 'warning' && { borderWidth: 2 },
              ]}
              onPress={() => setExpiryFilter(expiryFilter === 'warning' ? 'all' : 'warning')}
            >
              <Text style={[styles.expiryKpiCount, { color: '#D97706' }]}>{metrics.warningExpiryCount}</Text>
              <Text style={[styles.expiryKpiLabel, { color: '#B45309' }]}>Warning (≤ 7 Days)</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Bar */}
          <View style={styles.statusFilterRow}>
            {(['all', 'expired', 'critical', 'warning', 'fresh'] as const).map((ef) => (
              <TouchableOpacity
                key={ef}
                style={[styles.statusFilterBtn, expiryFilter === ef && styles.statusFilterBtnActive]}
                onPress={() => setExpiryFilter(ef)}
              >
                <Text style={[styles.statusFilterBtnText, expiryFilter === ef && styles.statusFilterBtnTextActive]}>
                  {ef === 'all'
                    ? 'All Dated Batches'
                    : ef === 'expired'
                    ? '🔴 Expired Only'
                    : ef === 'critical'
                    ? '🟠 Urgent (3d)'
                    : ef === 'warning'
                    ? '🟡 Within 7 Days'
                    : '🟢 Fresh'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredExpiries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={48} color={BRAND.success} />
              <Text style={styles.emptyTitle}>No Expiry Issues Found</Text>
              <Text style={styles.emptyDesc}>All tracked raw ingredients and batches are fresh and within shelf-life.</Text>
            </View>
          ) : (
            <View style={styles.itemsGrid}>
              {filteredExpiries.map(({ item, expiry }) => {
                const isExpired = expiry.status === 'expired';
                const isCritical = expiry.status === 'critical';

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemCard,
                      isExpired && { borderColor: '#F87171', borderWidth: 2 },
                      isCritical && { borderColor: '#FDBA74', borderWidth: 1.5 },
                    ]}
                  >
                    <View style={styles.itemCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {item.itemCode ? (
                            <View style={styles.skuBadge}>
                              <Text style={styles.skuBadgeText}>{item.itemCode}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.categoryTagText}>{item.category}</Text>
                        </View>
                        <Text style={styles.itemCardTitle}>{item.name}</Text>
                        {item.urduName ? <Text style={styles.urduTitle}>{item.urduName}</Text> : null}
                      </View>

                      <View style={[styles.expiryPill, { backgroundColor: expiry.bgColor }]}>
                        <Ionicons
                          name={isExpired ? 'alert-circle' : 'timer'}
                          size={13}
                          color={expiry.color}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.expiryPillText, { color: expiry.color }]}>{expiry.label}</Text>
                      </View>
                    </View>

                    <View style={styles.expiryDetailsBox}>
                      <View style={styles.stockStatRow}>
                        <View>
                          <Text style={styles.stockStatLabel}>Current At-Risk Stock</Text>
                          <Text style={[styles.stockStatValue, isExpired && { color: BRAND.danger }]}>
                            {item.stock} {item.unit}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.stockStatLabel}>Batch Number</Text>
                          <Text style={styles.stockStatValue}>{item.batchNumber || 'N/A'}</Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.valLabel}>Storage Location:</Text>
                        <Text style={[styles.valValue, { fontSize: 12 }]}>{item.location || 'Dry Store'}</Text>
                      </View>

                      {item.expiryDate ? (
                        <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.valLabel}>Expiry Date:</Text>
                          <Text style={[styles.valValue, { fontSize: 12, color: expiry.color }]}>
                            {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Expiry Actions */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={[styles.quickUsageBtn, { backgroundColor: '#EDE9FE', borderColor: '#8B5CF6' }]}
                        onPress={() => handleOpenMovement(item, 'usage')}
                      >
                        <Ionicons name="restaurant" size={15} color="#6D28D9" />
                        <Text style={[styles.quickUsageBtnText, { color: '#6D28D9' }]}>Use Immediately</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickMovementBtn, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
                        onPress={() => handleDisposeWastage(item)}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
                        <Text style={[styles.quickMovementBtnText, { color: '#DC2626' }]}>Dispose as Wastage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LOW STOCK & AUTOMATED REORDERS */}
      {/* ========================================================================= */}
      {activeTab === 'lowstock' && (
        <View>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Automated Shortage & Reorder Control</Text>
              <Text style={styles.sectionDesc}>
                Items at or below reorder threshold. Generate instant WhatsApp purchase orders or POs.
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.kpiLabel}>Est. Reorder Budget</Text>
              <Text style={[styles.kpiValue, { color: BRAND.burgundy }]}>{money(metrics.totalShortageValue)}</Text>
            </View>
          </View>

          {lowStockItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={48} color={BRAND.success} />
              <Text style={styles.emptyTitle}>All Stocks Healthy</Text>
              <Text style={styles.emptyDesc}>No ingredients are currently below their reorder threshold limit.</Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {lowStockItems.map(({ item, targetStock, shortage, estCost }) => {
                const isOut = item.stock <= 0;

                return (
                  <View key={item.id} style={[styles.reorderCard, isOut && { borderLeftColor: BRAND.danger }]}>
                    <View style={styles.reorderCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {item.itemCode ? (
                            <View style={styles.skuBadge}>
                              <Text style={styles.skuBadgeText}>{item.itemCode}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.categoryTagText}>{item.category}</Text>
                        </View>
                        <Text style={styles.itemCardTitle}>{item.name}</Text>
                        {item.urduName ? <Text style={styles.urduTitle}>{item.urduName}</Text> : null}
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: isOut ? BRAND.dangerSoft : BRAND.warnSoft },
                        ]}
                      >
                        <Ionicons
                          name={isOut ? 'close-circle' : 'alert-circle'}
                          size={13}
                          color={isOut ? BRAND.danger : BRAND.warn}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.statusBadgeText, { color: isOut ? BRAND.danger : BRAND.warn }]}>
                          {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </Text>
                      </View>
                    </View>

                    {/* Shortage Calculator Grid */}
                    <View style={styles.shortageGrid}>
                      <View style={styles.shortageCol}>
                        <Text style={styles.shortageLabel}>Current Stock</Text>
                        <Text style={[styles.shortageVal, { color: isOut ? BRAND.danger : BRAND.warn }]}>
                          {item.stock} {item.unit}
                        </Text>
                      </View>

                      <View style={styles.shortageCol}>
                        <Text style={styles.shortageLabel}>Threshold Limit</Text>
                        <Text style={styles.shortageVal}>
                          {item.threshold} {item.unit}
                        </Text>
                      </View>

                      <View style={styles.shortageCol}>
                        <Text style={styles.shortageLabel}>Suggested Reorder</Text>
                        <Text style={[styles.shortageVal, { color: BRAND.burgundy, fontWeight: '800' }]}>
                          +{shortage} {item.unit}
                        </Text>
                      </View>

                      <View style={styles.shortageCol}>
                        <Text style={styles.shortageLabel}>Est. Cost</Text>
                        <Text style={[styles.shortageVal, { color: BRAND.ink }]}>{money(estCost)}</Text>
                      </View>
                    </View>

                    {/* Preferred Supplier Info */}
                    <View style={styles.reorderSupplierRow}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="bus-outline" size={15} color={BRAND.muted} />
                        <Text style={styles.reorderSupplierText}>
                          Vendor:{' '}
                          <Text style={{ fontWeight: '700', color: BRAND.ink }}>
                            {item.supplier || 'No Vendor Assigned'}
                          </Text>
                        </Text>
                      </View>

                      {/* 1-Tap Actions */}
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={styles.reorderWaBtn}
                          onPress={() => handleSendWhatsAppReorder(item, shortage)}
                        >
                          <Ionicons name="logo-whatsapp" size={15} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={styles.reorderWaBtnText}>WhatsApp Reorder</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.reorderReceiveBtn}
                          onPress={() => handleOpenReceiveModal(item)}
                        >
                          <Ionicons name="add-circle-outline" size={15} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={styles.reorderReceiveBtnText}>Receive Now</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STOCK MOVEMENTS AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'movements' && (
        <View>
          {/* Movement Filter Chips */}
          <View style={styles.statusFilterRow}>
            {(['all', 'receive', 'usage', 'wastage', 'adjust'] as const).map((mType) => (
              <TouchableOpacity
                key={mType}
                style={[styles.statusFilterBtn, movementFilter === mType && styles.statusFilterBtnActive]}
                onPress={() => setMovementFilter(mType)}
              >
                <Text style={[styles.statusFilterBtnText, movementFilter === mType && styles.statusFilterBtnTextActive]}>
                  {mType === 'all'
                    ? 'All Logs'
                    : mType === 'receive'
                    ? '📥 Inward Deliveries'
                    : mType === 'usage'
                    ? '🍳 Kitchen Usage'
                    : mType === 'wastage'
                    ? '🗑️ Spoilage / Wastage'
                    : '⚖️ Physical Adjustments'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredMovements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={48} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>No Stock Movements Recorded</Text>
              <Text style={styles.emptyDesc}>
                Whenever staff receives goods or kitchen consumes ingredients, audit logs will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.movementsList}>
              {filteredMovements.map((m) => {
                const isPositive = (m.delta ?? 0) > 0;
                const typeConfig = getMovementConfig(m.type);

                return (
                  <View key={m.id} style={styles.movementCard}>
                    <View style={[styles.movementIconBox, { backgroundColor: typeConfig.bg }]}>
                      <Ionicons name={typeConfig.icon as any} size={20} color={typeConfig.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.movementHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {m.itemCode ? (
                            <View style={styles.skuBadge}>
                              <Text style={styles.skuBadgeText}>{m.itemCode}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.movementItemName}>{m.itemName}</Text>
                        </View>
                        <Text
                          style={[
                            styles.movementDelta,
                            { color: isPositive ? BRAND.success : m.type === 'wastage' ? BRAND.danger : BRAND.info },
                          ]}
                        >
                          {isPositive ? `+${m.qty}` : `-${m.qty}`}
                        </Text>
                      </View>

                      <View style={styles.movementMetaRow}>
                        <View style={[styles.movementTypeBadge, { backgroundColor: typeConfig.bg }]}>
                          <Text style={[styles.movementTypeBadgeText, { color: typeConfig.color }]}>
                            {typeConfig.label}
                          </Text>
                        </View>
                        {m.invoiceNo ? (
                          <Text style={styles.movementInvoice}>Inv: #{m.invoiceNo}</Text>
                        ) : null}
                        {m.batchNumber ? (
                          <Text style={styles.movementInvoice}>Batch: #{m.batchNumber}</Text>
                        ) : null}
                        <Text style={styles.movementTime}>
                          {formatDay(m.at)} • {formatTime(m.at)}
                        </Text>
                      </View>

                      {m.note ? (
                        <Text style={styles.movementNote}>
                          <Ionicons name="document-text-outline" size={13} color={BRAND.muted} /> {`"${m.note}"`}
                        </Text>
                      ) : null}

                      {m.by ? (
                        <Text style={styles.movementStaff}>
                          Recorded by: <Text style={{ fontWeight: '700', color: BRAND.ink }}>{m.by}</Text>
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: READY DISHES MENU STOCK */}
      {/* ========================================================================= */}
      {activeTab === 'dishes' && (
        <View>
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={BRAND.burgundy} style={{ marginRight: 8 }} />
            <Text style={styles.infoBannerText}>
              Keep track of prepared food & limited daily specials. Set ready portions so POS auto-warns when items run low.
            </Text>
          </View>

          <View style={styles.itemsGrid}>
            {trackedDishes.map((dish) => {
              const isTracked = !!dish.trackStock;
              const stockQty = dish.stockQty || 0;
              const cost = dish.costPrice || 0;
              const margin = dish.price > 0 && cost > 0 ? Math.round(((dish.price - cost) / dish.price) * 100) : null;

              return (
                <View key={dish.id} style={styles.dishCard}>
                  <View style={styles.dishCardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.dishTitle}>{dish.name}</Text>
                      <Text style={styles.dishCategory}>{dish.category}</Text>
                    </View>
                    <View style={styles.dishPriceBox}>
                      <Text style={styles.dishPrice}>{money(dish.price)}</Text>
                      {margin !== null ? (
                        <Text style={styles.dishMargin}>{margin}% Margin</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.dishStockControlRow}>
                    <View>
                      <Text style={styles.dishStockLabel}>Ready Portions Available</Text>
                      <Text
                        style={[
                          styles.dishStockValue,
                          stockQty <= 0 && isTracked && { color: BRAND.danger },
                          stockQty > 0 && stockQty <= 5 && isTracked && { color: BRAND.warn },
                        ]}
                      >
                        {isTracked ? `${stockQty} Portions Left` : 'Unlimited / Untracked'}
                      </Text>
                    </View>

                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustDishStock(dish, -1)}
                      >
                        <Ionicons name="remove" size={18} color={BRAND.ink} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.stepperBtn, { backgroundColor: BRAND.burgundy }]}
                        onPress={() => handleAdjustDishStock(dish, 1)}
                      >
                        <Ionicons name="add" size={18} color="#FFF" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.stepperBtn, { backgroundColor: BRAND.goldSoft }]}
                        onPress={() => handleAdjustDishStock(dish, 5)}
                      >
                        <Text style={{ fontWeight: '800', color: BRAND.burgundy, fontSize: 13 }}>+5</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW RAW MATERIAL (SKU) */}
      {/* ========================================================================= */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Raw Material / SKU</Text>
                <Text style={styles.modalSubtitle}>Create new tracked ingredient with SKU and storage zone</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Item SKU Code *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. SKU-MT-001"
                    value={formItemCode}
                    onChangeText={setFormItemCode}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Urdu Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. چکن بون لیس"
                    value={formUrduName}
                    onChangeText={setFormUrduName}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Item Name (English) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Boneless Chicken, Basmati Rice, Cooking Oil"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {INVENTORY_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.formChip, formCategory === cat && styles.formChipActive]}
                    onPress={() => setFormCategory(cat)}
                  >
                    <Text style={[styles.formChipText, formCategory === cat && styles.formChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Storage Location / Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {STORAGE_LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.formChip, formLocation === loc && styles.formChipActive]}
                    onPress={() => setFormLocation(loc)}
                  >
                    <Text style={[styles.formChipText, formLocation === loc && styles.formChipTextActive]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Measurement Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.formChip, formUnit === u && styles.formChipActive]}
                    onPress={() => setFormUnit(u)}
                  >
                    <Text style={[styles.formChipText, formUnit === u && styles.formChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Initial Stock ({formUnit})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 25"
                    keyboardType="numeric"
                    value={formStock}
                    onChangeText={setFormStock}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Low Stock Alert ({formUnit}) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    keyboardType="numeric"
                    value={formThreshold}
                    onChangeText={setFormThreshold}
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit Cost (Rs. per {formUnit})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 780"
                    keyboardType="numeric"
                    value={formCost}
                    onChangeText={setFormCost}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Shelf Life (Days from Receipt)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 30"
                    keyboardType="numeric"
                    value={formExpiryDays}
                    onChangeText={setFormExpiryDays}
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Preferred Vendor / Supplier</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Al-Madina Fresh Poultry"
                    value={formSupplier}
                    onChangeText={setFormSupplier}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Supplier WhatsApp Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 03001234567"
                    keyboardType="phone-pad"
                    value={formSupplierPhone}
                    onChangeText={setFormSupplierPhone}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveAdd}>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Save SKU Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: GOODS RECEIVING & INVOICING MODAL */}
      {/* ========================================================================= */}
      <Modal visible={showReceiveModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receive Goods & Inward Invoice</Text>
                <Text style={styles.modalSubtitle}>
                  Stock-in from supplier with batch number, invoice #, and Goods Receipt Note
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Ingredient / Material *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {inventory.map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.formChip, recItemId === inv.id && styles.formChipActive]}
                    onPress={() => {
                      setRecItemId(inv.id);
                      if (inv.supplier) setRecSupplier(inv.supplier);
                      if (inv.costPerUnit) setRecUnitCost(inv.costPerUnit.toString());
                      if (inv.location) setRecLocation(inv.location);
                    }}
                  >
                    <Text style={[styles.formChipText, recItemId === inv.id && styles.formChipTextActive]}>
                      {inv.name} ({inv.stock} {inv.unit})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Supplier Invoice No. *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. AMP-8821"
                    value={recInvoiceNo}
                    onChangeText={setRecInvoiceNo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Batch / Lot Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. B-26-CHK-081"
                    value={recBatchNumber}
                    onChangeText={setRecBatchNumber}
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Supplier / Vendor Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Al-Madina Fresh Poultry"
                    value={recSupplier}
                    onChangeText={setRecSupplier}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Received By Staff</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Chef Omar / Storekeeper"
                    value={recReceivedBy}
                    onChangeText={setRecReceivedBy}
                  />
                </View>
              </View>

              {/* Quick Supplier Picker if available */}
              {suppliers.length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.inputLabel, { fontSize: 11, color: BRAND.muted }]}>
                    Quick Pick Supplier:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {suppliers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.smallChip, recSupplier === s.name && styles.smallChipActive]}
                        onPress={() => setRecSupplier(s.name)}
                      >
                        <Text style={[styles.smallChipText, recSupplier === s.name && styles.smallChipTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Quantity Received *</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 18, fontWeight: '700' }]}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    value={recQty}
                    onChangeText={setRecQty}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit Purchase Cost (PKR)</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 18, fontWeight: '700' }]}
                    placeholder="e.g. 780"
                    keyboardType="numeric"
                    value={recUnitCost}
                    onChangeText={setRecUnitCost}
                  />
                </View>
              </View>

              {/* Live Invoice Value */}
              {recQty && recUnitCost ? (
                <View style={styles.impactBox}>
                  <Text style={styles.impactLabel}>Total Inward Shipment Amount:</Text>
                  <Text style={styles.impactValue}>
                    {money((parseFloat(recQty) || 0) * (parseFloat(recUnitCost) || 0))}
                  </Text>
                </View>
              ) : null}

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Batch Expiry (Days from Today)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 7 (days)"
                    keyboardType="numeric"
                    value={recExpiryDays}
                    onChangeText={setRecExpiryDays}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Store in Zone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Walk-in Chiller"
                    value={recLocation}
                    onChangeText={setRecLocation}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Delivery Remarks / Inspection Note</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chilled delivery van verified, seals intact, quality approved"
                value={recNotes}
                onChangeText={setRecNotes}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReceiveModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: BRAND.success }]}
                onPress={handleSaveReceive}
              >
                <Ionicons name="checkmark-done-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Confirm Inward Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: GOODS RECEIPT NOTE (GRN) VOUCHER SLIP */}
      {/* ========================================================================= */}
      <Modal visible={showGrnModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 520 }]}>
            <View style={styles.grnVoucherHeader}>
              <Text style={styles.grnVoucherBrand}>SULTAN RESTAURANT & BBQ</Text>
              <Text style={styles.grnVoucherTitle}>OFFICIAL GOODS RECEIPT NOTE (GRN)</Text>
              <Text style={styles.grnVoucherNo}>GRN #{lastGrn?.grnNo}</Text>
            </View>

            <View style={styles.grnDetailsBox}>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Date & Time:</Text>
                <Text style={styles.grnValue}>
                  {lastGrn?.at ? `${formatDay(lastGrn.at)} ${formatTime(lastGrn.at)}` : ''}
                </Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Supplier / Vendor:</Text>
                <Text style={[styles.grnValue, { fontWeight: '800' }]}>{lastGrn?.supplier}</Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Supplier Invoice #:</Text>
                <Text style={styles.grnValue}>{lastGrn?.invoiceNo}</Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Batch Number:</Text>
                <Text style={styles.grnValue}>{lastGrn?.batchNumber}</Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Storage Location:</Text>
                <Text style={styles.grnValue}>{lastGrn?.location}</Text>
              </View>

              <View style={styles.grnDivider} />

              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Item Received:</Text>
                <Text style={[styles.grnValue, { fontWeight: '800' }]}>
                  {lastGrn?.itemName} {lastGrn?.itemCode ? `(${lastGrn.itemCode})` : ''}
                </Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Quantity Verified:</Text>
                <Text style={[styles.grnValue, { fontSize: 16, color: BRAND.success, fontWeight: '800' }]}>
                  {lastGrn?.qty} {lastGrn?.unit}
                </Text>
              </View>
              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Unit Cost:</Text>
                <Text style={styles.grnValue}>{lastGrn ? money(lastGrn.unitCost) : ''}</Text>
              </View>
              <View style={[styles.grnRow, { marginTop: 6 }]}>
                <Text style={[styles.grnLabel, { fontWeight: '800', color: BRAND.ink }]}>Total Inward Value:</Text>
                <Text style={[styles.grnValue, { fontSize: 18, color: BRAND.burgundy, fontWeight: '900' }]}>
                  {lastGrn ? money(lastGrn.totalAmount) : ''}
                </Text>
              </View>

              <View style={styles.grnDivider} />

              <View style={styles.grnRow}>
                <Text style={styles.grnLabel}>Received & Verified By:</Text>
                <Text style={styles.grnValue}>{lastGrn?.receivedBy}</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowGrnModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: BRAND.burgundy }]}
                onPress={() => {
                  setShowGrnModal(false);
                  alertMsg('GRN Recorded', `GRN #${lastGrn?.grnNo} saved to receiving audit ledger.`);
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: QUICK STOCK MOVEMENT (USAGE / WASTAGE / ADJUST) */}
      {/* ========================================================================= */}
      <Modal visible={showMovementModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Stock Movement</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedItem?.name} (Current: {selectedItem?.stock} {selectedItem?.unit})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowMovementModal(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.movementTypeSelector}>
              <TouchableOpacity
                style={[styles.typeSelectBtn, movementType === 'receive' && styles.typeSelectBtnReceive]}
                onPress={() => setMovementType('receive')}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={18}
                  color={movementType === 'receive' ? '#FFF' : BRAND.success}
                />
                <Text style={[styles.typeSelectText, movementType === 'receive' && styles.typeSelectTextActive]}>
                  Receive (+)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeSelectBtn, movementType === 'usage' && styles.typeSelectBtnUsage]}
                onPress={() => setMovementType('usage')}
              >
                <Ionicons name="restaurant" size={18} color={movementType === 'usage' ? '#FFF' : BRAND.info} />
                <Text style={[styles.typeSelectText, movementType === 'usage' && styles.typeSelectTextActive]}>
                  Usage (-)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeSelectBtn, movementType === 'wastage' && styles.typeSelectBtnWastage]}
                onPress={() => setMovementType('wastage')}
              >
                <Ionicons name="trash" size={18} color={movementType === 'wastage' ? '#FFF' : BRAND.danger} />
                <Text style={[styles.typeSelectText, movementType === 'wastage' && styles.typeSelectTextActive]}>
                  Wastage (-)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeSelectBtn, movementType === 'adjust' && styles.typeSelectBtnAdjust]}
                onPress={() => setMovementType('adjust')}
              >
                <Ionicons name="options" size={18} color={movementType === 'adjust' ? '#FFF' : BRAND.purple} />
                <Text style={[styles.typeSelectText, movementType === 'adjust' && styles.typeSelectTextActive]}>
                  Adjust (=)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              {movementType === 'adjust'
                ? `New Total Stock Count (${selectedItem?.unit}) *`
                : `Quantity (${selectedItem?.unit}) *`}
            </Text>
            <TextInput
              style={[styles.input, { fontSize: 20, fontWeight: '700' }]}
              placeholder="e.g. 10"
              keyboardType="numeric"
              autoFocus
              value={movementQty}
              onChangeText={setMovementQty}
            />

            <Text style={styles.inputLabel}>Reason / Remarks (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={
                movementType === 'receive'
                  ? 'e.g. Morning delivery invoice #402'
                  : movementType === 'usage'
                  ? 'e.g. Dinner Karahi prep'
                  : movementType === 'wastage'
                  ? 'e.g. Expired batch or spillage'
                  : 'e.g. Weekly physical inventory audit'
              }
              value={movementNote}
              onChangeText={setMovementNote}
            />

            {selectedItem && movementQty ? (
              <View style={styles.impactBox}>
                <Text style={styles.impactLabel}>Resulting Stock After Update:</Text>
                <Text style={styles.impactValue}>
                  {movementType === 'receive'
                    ? `${selectedItem.stock + (parseFloat(movementQty) || 0)} ${selectedItem.unit}`
                    : movementType === 'adjust'
                    ? `${parseFloat(movementQty) || 0} ${selectedItem.unit}`
                    : `${Math.max(0, selectedItem.stock - (parseFloat(movementQty) || 0))} ${selectedItem.unit}`}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMovementModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveMovement}>
                <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Confirm Movement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT INVENTORY ITEM */}
      {/* ========================================================================= */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit SKU Details</Text>
                <Text style={styles.modalSubtitle}>{selectedItem?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Item SKU Code *</Text>
                  <TextInput style={styles.input} value={formItemCode} onChangeText={setFormItemCode} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Urdu Name</Text>
                  <TextInput style={styles.input} value={formUrduName} onChangeText={setFormUrduName} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Item Name (English) *</Text>
              <TextInput style={styles.input} value={formName} onChangeText={setFormName} />

              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {INVENTORY_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.formChip, formCategory === cat && styles.formChipActive]}
                    onPress={() => setFormCategory(cat)}
                  >
                    <Text style={[styles.formChipText, formCategory === cat && styles.formChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Storage Location / Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {STORAGE_LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.formChip, formLocation === loc && styles.formChipActive]}
                    onPress={() => setFormLocation(loc)}
                  >
                    <Text style={[styles.formChipText, formLocation === loc && styles.formChipTextActive]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Current Stock ({formUnit})</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formStock}
                    onChangeText={setFormStock}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Low Stock Alert ({formUnit})</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formThreshold}
                    onChangeText={setFormThreshold}
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit Purchase Cost (PKR)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formCost}
                    onChangeText={setFormCost}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Shelf Life (Days Remaining)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formExpiryDays}
                    onChangeText={setFormExpiryDays}
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Batch Number</Text>
                  <TextInput style={styles.input} value={formBatchNumber} onChangeText={setFormBatchNumber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Last Inward Invoice #</Text>
                  <TextInput style={styles.input} value={formInvoiceNo} onChangeText={setFormInvoiceNo} />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Supplier Name</Text>
                  <TextInput style={styles.input} value={formSupplier} onChangeText={setFormSupplier} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Supplier WhatsApp</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={formSupplierPhone}
                    onChangeText={setFormSupplierPhone}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Update SKU Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    shadowColor: BRAND.burgundy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: BRAND.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.muted,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: BRAND.goldSoft,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.muted,
  },
  tabBtnTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  searchSection: {
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND.ink,
  },
  categoriesScroll: {
    marginBottom: 10,
  },
  categoriesContent: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryChipActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.text,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  locationChipActive: {
    backgroundColor: '#4B5563',
    borderColor: '#4B5563',
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.muted,
  },
  locationChipTextActive: {
    color: '#FFFFFF',
  },
  statusFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  statusFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statusFilterBtnActive: {
    backgroundColor: BRAND.burgundySoft,
    borderColor: BRAND.burgundy,
  },
  statusFilterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.text,
  },
  statusFilterBtnTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  urduTitle: {
    fontSize: 13,
    color: BRAND.muted,
    fontWeight: '500',
    marginTop: 1,
  },
  skuBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  skuBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  categoryTagText: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expiryMiniBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expiryMiniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  locationMetaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  locationMetaText: {
    fontSize: 11,
    color: BRAND.text,
    fontWeight: '600',
  },
  batchMetaText: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
  },
  stockDetailsBox: {
    backgroundColor: '#FAFAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  stockStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  stockStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: 1,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  valuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    marginBottom: 8,
  },
  valLabel: {
    fontSize: 11,
    color: BRAND.muted,
  },
  valValue: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  supplierName: {
    fontSize: 12,
    color: BRAND.ink,
    fontWeight: '600',
    flex: 1,
  },
  supplierCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  supplierCallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  quickMovementBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 7,
    borderRadius: 7,
    gap: 4,
  },
  quickMovementBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickUsageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.infoSoft,
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingVertical: 7,
    borderRadius: 7,
    gap: 4,
  },
  quickUsageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.info,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
  },
  sectionDesc: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  // Receiving Card
  receivingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  receivingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  receivingItemName: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  receivingSupplierText: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  receivingQtyText: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.success,
  },
  receivingValText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
    marginTop: 1,
  },
  receivingDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  receivingMetaLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  receivingMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  receivingNoteText: {
    fontSize: 11,
    color: BRAND.muted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  receivingActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  grnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: BRAND.goldSoft,
  },
  grnBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  // Expiry KPI Row
  expiryKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  expiryKpiCard: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  expiryKpiCount: {
    fontSize: 22,
    fontWeight: '900',
  },
  expiryKpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiryPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  expiryDetailsBox: {
    backgroundColor: '#FAFAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  // Reorder Card
  reorderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    borderLeftWidth: 4,
    borderLeftColor: BRAND.warn,
  },
  reorderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  shortageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  shortageCol: {
    minWidth: 90,
  },
  shortageLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  shortageVal: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
  },
  reorderSupplierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  reorderSupplierText: {
    fontSize: 12,
    color: BRAND.muted,
  },
  reorderWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  reorderWaBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  reorderReceiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  reorderReceiveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  // Movement History List
  movementsList: {
    gap: 10,
  },
  movementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFF4',
    gap: 10,
  },
  movementIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movementItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
  },
  movementDelta: {
    fontSize: 16,
    fontWeight: '800',
  },
  movementMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  movementTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  movementTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  movementInvoice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  movementTime: {
    fontSize: 11,
    color: BRAND.muted,
  },
  movementNote: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  movementStaff: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  // Dishes
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.goldSoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: BRAND.burgundy,
    fontWeight: '600',
  },
  dishCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  dishCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dishTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.ink,
  },
  dishCategory: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 1,
  },
  dishPriceBox: {
    alignItems: 'flex-end',
  },
  dishPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  dishMargin: {
    fontSize: 10,
    color: BRAND.success,
    fontWeight: '700',
  },
  dishStockControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  dishStockLabel: {
    fontSize: 10,
    color: BRAND.muted,
  },
  dishStockValue: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    maxWidth: 360,
  },
  // Modal Base
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalCardMobile: {
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.ink,
  },
  modalSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 5,
    marginTop: 2,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: BRAND.ink,
    marginBottom: 10,
  },
  formRow2: {
    flexDirection: 'row',
    gap: 10,
  },
  formChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    marginRight: 6,
  },
  formChipActive: {
    backgroundColor: BRAND.burgundy,
  },
  formChipText: {
    fontSize: 11,
    color: BRAND.text,
    fontWeight: '600',
  },
  formChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: BRAND.burgundy,
  },
  smallChipText: {
    fontSize: 10,
    color: BRAND.text,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#FFF',
  },
  movementTypeSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  typeSelectBtn: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFF',
    gap: 4,
  },
  typeSelectBtnReceive: {
    backgroundColor: BRAND.success,
    borderColor: BRAND.success,
  },
  typeSelectBtnUsage: {
    backgroundColor: BRAND.info,
    borderColor: BRAND.info,
  },
  typeSelectBtnWastage: {
    backgroundColor: BRAND.danger,
    borderColor: BRAND.danger,
  },
  typeSelectBtnAdjust: {
    backgroundColor: BRAND.purple,
    borderColor: BRAND.purple,
  },
  typeSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  typeSelectTextActive: {
    color: '#FFF',
  },
  impactBox: {
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
  },
  impactValue: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.muted,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 7,
  },
  modalSaveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // GRN Slip
  grnVoucherHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: BRAND.gold,
    paddingBottom: 10,
    marginBottom: 12,
  },
  grnVoucherBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.burgundy,
    letterSpacing: 1,
  },
  grnVoucherTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 2,
  },
  grnVoucherNo: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.gold,
    marginTop: 2,
  },
  grnDetailsBox: {
    backgroundColor: '#FAFAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  grnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  grnLabel: {
    fontSize: 12,
    color: BRAND.muted,
  },
  grnValue: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  grnDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
});
