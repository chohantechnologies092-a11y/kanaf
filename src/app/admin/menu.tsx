import React, { useState, useMemo } from 'react';
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
  Image,
  useWindowDimensions,
  Switch,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore, MenuItem, ComboItem } from '../../store/restaurantStore';
import { BRAND } from '../../constants/brand';
import { FOOD_PRESETS, POPULAR_BADGES } from '../../constants/foodPresets';
import { money } from '../../utils/format';
import { broadcastImmediately } from '../../services/syncService';

export default function MenuManagement() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const menuItems = useRestaurantStore(state => state.menuItems) || [];
  const addMenuItem = useRestaurantStore(state => state.addMenuItem);
  const updateMenuItem = useRestaurantStore(state => state.updateMenuItem);
  const deleteMenuItem = useRestaurantStore(state => state.deleteMenuItem);
  const adjustMenuItemStock = useRestaurantStore(state => state.adjustMenuItemStock);
  const resetMenuToBakeryDefaults = useRestaurantStore(state => state.resetMenuToBakeryDefaults);
  const categories = useRestaurantStore(state => state.categories) || [];
  const addCategory = useRestaurantStore(state => state.addCategory);
  const deleteCategory = useRestaurantStore(state => state.deleteCategory);
  
  // Tabs: 'items' | 'deals' | 'stock' | 'categories'
  const [activeTab, setActiveTab] = useState<'items' | 'deals' | 'stock' | 'categories'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  
  // Item Modal state (Add / Edit)
  const [isItemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [modalTab, setModalTab] = useState<'basic' | 'image' | 'pricing_stock' | 'combo'>('basic');

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemCategory, setItemCategory] = useState(categories[0] || 'Mains');
  const [itemDescription, setItemDescription] = useState('');
  const [itemBadge, setItemBadge] = useState('');
  const [itemImageUri, setItemImageUri] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [itemStation, setItemStation] = useState<'main' | 'juice'>('main');
  const [itemVariants, setItemVariants] = useState<{ name: string; price: string }[]>([]);
  
  // Stock Tracking Form Fields (Option 4)
  const [itemTrackStock, setItemTrackStock] = useState(false);
  const [itemStockQty, setItemStockQty] = useState('20');
  const [itemLowStockThreshold, setItemLowStockThreshold] = useState('5');

  // Deals / Combo Form Fields (Option 5)
  const [itemIsDeal, setItemIsDeal] = useState(false);
  const [itemDealItems, setItemDealItems] = useState<ComboItem[]>([]);
  const [itemDealOriginalPrice, setItemDealOriginalPrice] = useState('');
  
  // Quick Stock Adjustment Modal
  const [stockAdjustItem, setStockAdjustItem] = useState<MenuItem | null>(null);
  const [stockDeltaInput, setStockDeltaInput] = useState('');
  const [stockMode, setStockMode] = useState<'add' | 'set'>('add');

  // Dropdown states
  const [isCategoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isBadgeDropdownOpen, setBadgeDropdownOpen] = useState(false);

  // Category Modal state
  const [isCatModalVisible, setCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // -------------------------------------------------------------
  // KPI Calculations
  // -------------------------------------------------------------
  const kpiStats = useMemo(() => {
    const totalItems = menuItems.length;
    const dealsCount = menuItems.filter(i => i.isDeal || i.category === 'Deals').length;
    const lowStockItems = menuItems.filter(i => 
      i.trackStock && typeof i.stockQty === 'number' && i.stockQty <= (i.lowStockThreshold || 5)
    );
    const outOfStockItems = menuItems.filter(i => 
      i.trackStock && typeof i.stockQty === 'number' && i.stockQty <= 0
    );

    // Average Margin Calculation across items that have both Price and CostPrice
    const itemsWithCost = menuItems.filter(i => i.price > 0 && typeof i.costPrice === 'number' && i.costPrice > 0);
    const avgMargin = itemsWithCost.length > 0 
      ? Math.round(
          itemsWithCost.reduce((sum, i) => sum + (((i.price - (i.costPrice || 0)) / i.price) * 100), 0) / itemsWithCost.length
        ) 
      : 0;

    return {
      totalItems,
      dealsCount,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      avgMargin
    };
  }, [menuItems]);

  // -------------------------------------------------------------
  // Filtered Items based on Active Tab & Search
  // -------------------------------------------------------------
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.category.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeTab === 'deals') {
        return item.isDeal || item.category === 'Deals';
      }

      if (activeTab === 'stock') {
        return item.trackStock;
      }

      if (activeTab === 'items') {
        const matchesCat = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;
        return matchesCat;
      }

      return true;
    });
  }, [menuItems, activeTab, searchQuery, selectedCategoryFilter]);

  // Derived Categories Data
  const categoriesData = useMemo(() => {
    return categories.map(cat => ({
      id: cat,
      name: cat,
      itemsCount: menuItems.filter(i => i.category === cat).length
    }));
  }, [categories, menuItems]);

  const filteredCategories = useMemo(() => {
    return categoriesData.filter(cat => 
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categoriesData, searchQuery]);

  // -------------------------------------------------------------
  // Modal Open Handlers
  // -------------------------------------------------------------
  const openAddItemModal = (isForDeal = false) => {
    setEditingItem(null);
    setModalTab('basic');
    setItemName('');
    setItemPrice('');
    setItemCostPrice('');
    setItemCategory(isForDeal ? 'Deals' : (categories[0] || 'Mains'));
    setItemDescription('');
    setItemBadge(isForDeal ? 'Family Deal' : '');
    setItemImageUri('');
    setItemStation('main');
    setItemVariants([]);
    setItemTrackStock(true);
    setItemStockQty('25');
    setItemLowStockThreshold('5');
    setItemIsDeal(isForDeal);
    setItemDealItems([]);
    setItemDealOriginalPrice('');
    setCategoryDropdownOpen(false);
    setBadgeDropdownOpen(false);
    setItemModalVisible(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setModalTab('basic');
    setItemName(item.name);
    setItemPrice(item.price ? item.price.toString() : '');
    setItemCostPrice(item.costPrice ? item.costPrice.toString() : '');
    setItemCategory(item.category || (categories[0] || 'Mains'));
    setItemDescription(item.description || '');
    setItemBadge(item.badge || '');
    setItemImageUri(item.imageUri || '');
    setItemStation((item.station as 'main'|'juice') || 'main');
    setItemVariants(item.variants ? item.variants.map(v => ({ name: v.name, price: v.price.toString() })) : []);
    setItemTrackStock(Boolean(item.trackStock));
    setItemStockQty(typeof item.stockQty === 'number' ? item.stockQty.toString() : '20');
    setItemLowStockThreshold(typeof item.lowStockThreshold === 'number' ? item.lowStockThreshold.toString() : '5');
    setItemIsDeal(Boolean(item.isDeal || item.category === 'Deals'));
    setItemDealItems(item.dealItems || []);
    setItemDealOriginalPrice(item.dealOriginalPrice ? item.dealOriginalPrice.toString() : '');
    setCategoryDropdownOpen(false);
    setBadgeDropdownOpen(false);
    setItemModalVisible(true);
  };

  // -------------------------------------------------------------
  // Image Upload / Camera Handlers (with Web Canvas Downscaling)
  // -------------------------------------------------------------
  const compressImageFileOnWeb = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new (window as any).Image();
        img.onload = () => {
          const MAX_DIM = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Ultra-compact JPEG ~25KB-45KB: easily stored, synced and loaded
            const compressed = canvas.toDataURL('image/jpeg', 0.78);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const pickImageFromDevice = async () => {
    try {
      setIsUploadingImage(true);

      // On Web: Native HTML file input with automatic canvas downscaler
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp,image/jpg';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            setIsUploadingImage(false);
            return;
          }
          try {
            const compressedUri = await compressImageFileOnWeb(file);
            setItemImageUri(compressedUri);
          } catch (err: any) {
            window.alert('Failed to process image: ' + (err.message || ''));
          } finally {
            setIsUploadingImage(false);
          }
        };
        input.click();
        return;
      }

      // On Native Mobile (iOS / Android)
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access photos is required to upload dish images!');
        setIsUploadingImage(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setItemImageUri(`data:${mime};base64,${asset.base64}`);
        } else {
          setItemImageUri(asset.uri);
        }
      }
    } catch (err: any) {
      console.error('Image picker error:', err);
      const msg = 'Failed to pick image: ' + (err.message || '');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      setIsUploadingImage(true);

      // On Web: file input with camera capture
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            setIsUploadingImage(false);
            return;
          }
          try {
            const compressedUri = await compressImageFileOnWeb(file);
            setItemImageUri(compressedUri);
          } catch (err: any) {
            window.alert('Failed to process camera photo: ' + (err.message || ''));
          } finally {
            setIsUploadingImage(false);
          }
        };
        input.click();
        return;
      }

      // On Native Mobile
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture dish photos!');
        setIsUploadingImage(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setItemImageUri(`data:${mime};base64,${asset.base64}`);
        } else {
          setItemImageUri(asset.uri);
        }
      }
    } catch (err: any) {
      console.error('Camera capture error:', err);
      const msg = 'Failed to capture photo: ' + (err.message || '');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // -------------------------------------------------------------
  // Preset Selection Helper
  // -------------------------------------------------------------
  // Only applies the image to avoid wiping the user's custom dish name & price
  const handleSelectPresetImageOnly = (imageUri: string) => {
    setItemImageUri(imageUri);
  };

  // Full autofill if user explicitly wants to clone the preset
  const handleSelectPresetFull = (preset: typeof FOOD_PRESETS[0]) => {
    setItemName(preset.name);
    if (!itemPrice) setItemPrice(preset.defaultPrice.toString());
    if (!itemCostPrice) setItemCostPrice(preset.defaultCost.toString());
    if (preset.imageUri) setItemImageUri(preset.imageUri);
    if (preset.description) setItemDescription(preset.description);
    if (preset.badge) setItemBadge(preset.badge);
    if (preset.category && categories.includes(preset.category)) {
      setItemCategory(preset.category);
    }
  };

  // -------------------------------------------------------------
  // Combo Builder Helper (Option 5)
  // -------------------------------------------------------------
  const addDishToDeal = (menuItem: MenuItem) => {
    const existingIndex = itemDealItems.findIndex(d => d.menuItemId === menuItem.id);
    let updated: ComboItem[];
    if (existingIndex >= 0) {
      updated = [...itemDealItems];
      updated[existingIndex].qty += 1;
    } else {
      updated = [
        ...itemDealItems, 
        { menuItemId: menuItem.id, name: menuItem.name, qty: 1, price: menuItem.price }
      ];
    }
    setItemDealItems(updated);

    // Recalculate original total value
    const sumOriginal = updated.reduce((s, it) => s + ((it.price || 0) * it.qty), 0);
    setItemDealOriginalPrice(sumOriginal.toString());
  };

  const removeDishFromDeal = (index: number) => {
    const updated = [...itemDealItems];
    updated.splice(index, 1);
    setItemDealItems(updated);
    const sumOriginal = updated.reduce((s, it) => s + ((it.price || 0) * it.qty), 0);
    setItemDealOriginalPrice(sumOriginal.toString());
  };

  const updateDishDealQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeDishFromDeal(index);
      return;
    }
    const updated = [...itemDealItems];
    updated[index].qty = newQty;
    setItemDealItems(updated);
    const sumOriginal = updated.reduce((s, it) => s + ((it.price || 0) * it.qty), 0);
    setItemDealOriginalPrice(sumOriginal.toString());
  };

  // -------------------------------------------------------------
  // Save Item Handler
  // -------------------------------------------------------------
  const handleSaveItem = () => {
    const parsedVariants = itemVariants
      .filter(v => v.name.trim() !== '' && !isNaN(parseFloat(v.price)))
      .map(v => ({ name: v.name.trim(), price: parseFloat(v.price) }));

    const hasVariants = parsedVariants.length > 0;

    if (!itemName.trim() || !itemCategory) {
      const msg = 'Please enter item name and category.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }
    
    let priceNum = parseFloat(itemPrice);
    if (!hasVariants && (isNaN(priceNum) || priceNum < 0)) {
      const msg = 'Please enter a valid price (or add variants).';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }

    if (hasVariants && isNaN(priceNum)) {
      priceNum = 0;
    }

    const costNum = parseFloat(itemCostPrice);
    const parsedCost = !isNaN(costNum) && costNum >= 0 ? costNum : undefined;

    const stockNum = parseInt(itemStockQty, 10);
    const lowThreshNum = parseInt(itemLowStockThreshold, 10);

    const dealOrigPriceNum = parseFloat(itemDealOriginalPrice);

    const itemPayload: Omit<MenuItem, 'id'> = {
      name: itemName.trim(),
      price: priceNum,
      costPrice: parsedCost,
      category: itemCategory,
      station: itemStation,
      description: itemDescription.trim() || undefined,
      badge: itemBadge.trim() || undefined,
      imageUri: itemImageUri.trim() || undefined,
      variants: parsedVariants.length > 0 ? parsedVariants : undefined,
      trackStock: itemTrackStock,
      stockQty: itemTrackStock && !isNaN(stockNum) ? stockNum : undefined,
      lowStockThreshold: itemTrackStock && !isNaN(lowThreshNum) ? lowThreshNum : undefined,
      isDeal: itemIsDeal,
      dealItems: itemIsDeal && itemDealItems.length > 0 ? itemDealItems : undefined,
      dealOriginalPrice: itemIsDeal && !isNaN(dealOrigPriceNum) ? dealOrigPriceNum : undefined
    };

    if (editingItem) {
      updateMenuItem(editingItem.id, itemPayload);
    } else {
      addMenuItem(itemPayload);
    }
    broadcastImmediately();
    
    setItemModalVisible(false);
  };

  const handleDeleteItem = (item: MenuItem) => {
    const confirmDelete = () => {
      deleteMenuItem(item.id);
      broadcastImmediately();
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Item',
        `Are you sure you want to remove "${item.name}" from the menu?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  // -------------------------------------------------------------
  // Quick Stock Adjustment Handler
  // -------------------------------------------------------------
  const handleApplyStockAdjust = () => {
    if (!stockAdjustItem) return;
    const val = parseInt(stockDeltaInput, 10);
    if (isNaN(val)) {
      if (Platform.OS === 'web') window.alert('Please enter a valid numeric value');
      else Alert.alert('Invalid Number', 'Please enter a valid numeric quantity.');
      return;
    }

    adjustMenuItemStock(stockAdjustItem.id, val, stockMode);
    broadcastImmediately();
    setStockAdjustItem(null);
    setStockDeltaInput('');
  };

  // -------------------------------------------------------------
  // Category Management Handlers
  // -------------------------------------------------------------
  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      const msg = 'Please enter a category name';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }
    
    if (categories.some(c => c.toLowerCase() === newCatName.trim().toLowerCase())) {
      const msg = 'This category already exists.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Duplicate', msg);
      return;
    }

    addCategory(newCatName.trim());
    broadcastImmediately();
    setCatModalVisible(false);
    setNewCatName('');
  };

  const handleDeleteCategory = (catName: string) => {
    const count = menuItems.filter(i => i.category === catName).length;
    const confirmDelete = () => {
      deleteCategory(catName);
      broadcastImmediately();
    };

    const warning = count > 0 
      ? `This category contains ${count} item(s). Deleting it will remove the category classification.` 
      : `Are you sure you want to delete "${catName}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(warning)) confirmDelete();
    } else {
      Alert.alert('Delete Category', warning, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]);
    }
  };

  // Margin Calculation Helper
  const calculateMargin = (price: number, cost?: number) => {
    if (!cost || price <= 0) return null;
    const grossProfit = price - cost;
    const marginPct = Math.round((grossProfit / price) * 100);
    return { grossProfit, marginPct };
  };

  const handleResetToBakeryDefaults = () => {
    const doReset = () => {
      resetMenuToBakeryDefaults();
      broadcastImmediately();
      if (Platform.OS === 'web') {
        window.alert('Kanaf Cafe & Bakery menu items & categories loaded successfully!');
      } else {
        Alert.alert('Success', 'Kanaf Cafe & Bakery menu items & categories loaded successfully!');
      }
    };

    const msg = 'This will load all standard Kanaf Cafe & Bakery items (Specialty Coffees, French Croissants, Kunafa, Biscoff Cakes, Paninis & Breakfast Combos). Continue?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doReset();
    } else {
      Alert.alert('Load Bakery & Cafe Menu', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load Bakery Menu', style: 'default', onPress: doReset }
      ]);
    }
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Header */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.titleWrap}>
          <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Menu & Items Master</Text>
          <Text style={styles.pageSubtitle}>
            Full Menu Catalog, Pricing, Images, Inventory & Combo Deals
          </Text>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1' }]} 
            onPress={handleResetToBakeryDefaults}
            activeOpacity={0.8}
          >
            <Ionicons name="cafe-outline" size={17} color={BRAND.burgundy} style={{ marginRight: 6 }} />
            <Text style={[styles.addButtonText, { color: BRAND.burgundy }]}>Load Bakery Menu</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: BRAND.burgundy }]} 
            onPress={() => openAddItemModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="gift-outline" size={17} color={BRAND.gold} style={{ marginRight: 6 }} />
            <Text style={[styles.addButtonText, { color: BRAND.gold }]}>New Deal / Combo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => activeTab === 'categories' ? setCatModalVisible(true) : openAddItemModal(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#4a121a" style={{ marginRight: 4 }} />
            <Text style={styles.addButtonText}>
              {activeTab === 'categories' ? 'New Category' : 'New Dish'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Overview Banner */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: BRAND.goldSoft }]}>
            <Ionicons name="restaurant-outline" size={20} color={BRAND.gold} />
          </View>
          <View>
            <Text style={styles.kpiVal}>{kpiStats.totalItems}</Text>
            <Text style={styles.kpiLabel}>Total Dishes</Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: BRAND.purpleSoft }]}>
            <Ionicons name="gift-outline" size={20} color={BRAND.purple} />
          </View>
          <View>
            <Text style={[styles.kpiVal, { color: BRAND.purple }]}>{kpiStats.dealsCount}</Text>
            <Text style={styles.kpiLabel}>Active Deals</Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: BRAND.successSoft }]}>
            <Ionicons name="trending-up-outline" size={20} color={BRAND.success} />
          </View>
          <View>
            <Text style={[styles.kpiVal, { color: BRAND.success }]}>{kpiStats.avgMargin}%</Text>
            <Text style={styles.kpiLabel}>Avg Profit Margin</Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: kpiStats.lowStockCount > 0 ? BRAND.dangerSoft : BRAND.infoSoft }]}>
            <Ionicons 
              name={kpiStats.lowStockCount > 0 ? "alert-circle" : "cube-outline"} 
              size={20} 
              color={kpiStats.lowStockCount > 0 ? BRAND.danger : BRAND.info} 
            />
          </View>
          <View>
            <Text style={[styles.kpiVal, { color: kpiStats.lowStockCount > 0 ? BRAND.danger : BRAND.ink }]}>
              {kpiStats.lowStockCount}
            </Text>
            <Text style={styles.kpiLabel}>Low / Out of Stock</Text>
          </View>
        </View>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'items' && styles.tabActive]}
          onPress={() => setActiveTab('items')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="restaurant" 
            size={16} 
            color={activeTab === 'items' ? BRAND.burgundy : BRAND.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>
            Dishes & Items ({menuItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'deals' && styles.tabActive]}
          onPress={() => setActiveTab('deals')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="gift" 
            size={16} 
            color={activeTab === 'deals' ? BRAND.burgundy : BRAND.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'deals' && styles.tabTextActive]}>
            Deals & Combos ({kpiStats.dealsCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'stock' && styles.tabActive]}
          onPress={() => setActiveTab('stock')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="cube" 
            size={16} 
            color={activeTab === 'stock' ? BRAND.burgundy : BRAND.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>
            Stock & Inventory ({menuItems.filter(i => i.trackStock).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="grid" 
            size={16} 
            color={activeTab === 'categories' ? BRAND.burgundy : BRAND.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Categories ({categories.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Category Filter Pills */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <View style={styles.searchIconOrb}>
            <Ionicons name="search" size={16} color={BRAND.burgundy} />
          </View>
          <TextInput 
            style={styles.searchInput}
            placeholder={`Search dishes, combos, badges, prices...`}
            placeholderTextColor="#8A7A70"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.searchClearBtn}>
              <Ionicons name="close-circle" size={18} color={BRAND.gold} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchShortcutBadge}>
              <Ionicons name="sparkles" size={11} color="#B45309" style={{ marginRight: 3 }} />
              <Text style={styles.searchShortcutText}>MENU</Text>
            </View>
          )}
        </View>

        {activeTab === 'items' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsScroll}
          >
            {['All', ...categories].map(cat => {
              const isSelected = selectedCategoryFilter === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                  onPress={() => setSelectedCategoryFilter(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Main Content Area */}
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {activeTab !== 'categories' ? (
            // ================= MENU ITEMS / DEALS / STOCK LIST =================
            filteredItems.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="restaurant-outline" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No items or deals found</Text>
                <Text style={styles.emptySubtitle}>Try changing your search query or category filter</Text>
              </View>
            ) : isMobile ? (
              // MOBILE VIEW: RICH CARDS
              <View style={styles.mobileCardsList}>
                {filteredItems.map(item => {
                  const marginInfo = calculateMargin(item.price, item.costPrice);
                  const isLow = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= (item.lowStockThreshold || 5);
                  const isOut = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0;

                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemCardMain}>
                        {/* Option 3: Image Thumbnail */}
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={styles.itemThumbImage} />
                        ) : (
                          <View style={styles.itemIconBadge}>
                            <Ionicons name={item.isDeal ? "gift" : "fast-food-outline"} size={24} color={BRAND.gold} />
                          </View>
                        )}
                        
                        <View style={styles.itemInfo}>
                          <View style={styles.itemHeaderRow}>
                            <Text style={styles.itemCardName} numberOfLines={1}>{item.name}</Text>
                            {item.badge && (
                              <View style={[styles.badgeTag, item.isDeal ? styles.dealBadgeTag : null]}>
                                <Text style={[styles.badgeTagText, item.isDeal ? styles.dealBadgeTagText : null]}>
                                  {item.badge}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 }}>
                            <View style={styles.catBadge}>
                              <Text style={styles.catBadgeText}>{item.category}</Text>
                            </View>
                            <Text style={styles.stationText}>
                              {item.station === 'juice' ? '🍹 Juice Bar' : '🍳 Main Kitchen'}
                            </Text>
                          </View>

                          {/* Deal Combo Contents preview */}
                          {item.isDeal && item.dealItems && item.dealItems.length > 0 && (
                            <View style={styles.comboPreviewWrap}>
                              <Text style={styles.comboPreviewTitle}>Includes:</Text>
                              <Text style={styles.comboPreviewText} numberOfLines={2}>
                                {item.dealItems.map(d => `${d.qty}x ${d.name}`).join(' • ')}
                              </Text>
                            </View>
                          )}

                          {/* Pricing & Margin info */}
                          <View style={styles.itemPriceRow}>
                            <View>
                              <Text style={styles.itemCardPrice}>
                                {item.price > 0 ? money(item.price) : 'Variant based'}
                              </Text>
                              {item.dealOriginalPrice && item.dealOriginalPrice > item.price && (
                                <Text style={styles.originalPriceText}>
                                  Save {money(item.dealOriginalPrice - item.price)}
                                </Text>
                              )}
                            </View>

                            {/* Option 4: Margin Badge */}
                            {marginInfo && (
                              <View style={styles.marginPill}>
                                <Text style={styles.marginPillText}>
                                  {marginInfo.marginPct}% Margin
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Option 4: Stock Pill */}
                          {item.trackStock ? (
                            <TouchableOpacity 
                              style={[
                                styles.stockPill, 
                                isOut ? styles.stockPillOut : (isLow ? styles.stockPillLow : styles.stockPillIn)
                              ]}
                              onPress={() => {
                                setStockAdjustItem(item);
                                setStockDeltaInput(item.stockQty?.toString() || '0');
                                setStockMode('set');
                              }}
                            >
                              <Ionicons 
                                name={isOut ? "alert-circle" : (isLow ? "warning-outline" : "checkmark-circle")} 
                                size={12} 
                                color={isOut ? BRAND.danger : (isLow ? BRAND.warn : BRAND.success)} 
                              />
                              <Text style={[
                                styles.stockPillText,
                                isOut ? styles.stockTextOut : (isLow ? styles.stockTextLow : styles.stockTextIn)
                              ]}>
                                {isOut ? 'Sold Out' : `Stock: ${item.stockQty} portions`}
                              </Text>
                              <Ionicons name="create-outline" size={12} color={BRAND.muted} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.untrackedStockText}>Stock Tracking: Off</Text>
                          )}
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.itemCardActions}>
                        <TouchableOpacity 
                          style={styles.editBtn} 
                          onPress={() => openEditItemModal(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="pencil" size={14} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>

                        {item.trackStock && (
                          <TouchableOpacity 
                            style={styles.restockQuickBtn}
                            onPress={() => adjustMenuItemStock(item.id, 10, 'add')}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add-circle-outline" size={14} color={BRAND.success} style={{ marginRight: 4 }} />
                            <Text style={styles.restockQuickBtnText}>+10 Stock</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                          style={styles.deleteBtn} 
                          onPress={() => handleDeleteItem(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={14} color={BRAND.danger} style={{ marginRight: 4 }} />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              // DESKTOP VIEW: RICH TABLE
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2.2 }]}>Dish / Combo</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.1 }]}>Category & Area</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>Price / Cost</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Profit Margin</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>Inventory Stock</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Actions</Text>
                </View>
                
                {filteredItems.map(item => {
                  const marginInfo = calculateMargin(item.price, item.costPrice);
                  const isLow = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= (item.lowStockThreshold || 5);
                  const isOut = item.trackStock && typeof item.stockQty === 'number' && item.stockQty <= 0;

                  return (
                    <View key={item.id} style={styles.tableRow}>
                      {/* Name & Image */}
                      <View style={[styles.tableCell, { flex: 2.2, flexDirection: 'row', alignItems: 'center' }]}>
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={styles.tableThumbImage} />
                        ) : (
                          <View style={styles.tableThumbPlaceholder}>
                            <Ionicons name={item.isDeal ? "gift" : "restaurant-outline"} size={18} color={BRAND.gold} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.tableItemName}>{item.name}</Text>
                            {item.badge && (
                              <View style={[styles.badgeTagSmall, item.isDeal ? styles.dealBadgeTag : null]}>
                                <Text style={[styles.badgeTagSmallText, item.isDeal ? styles.dealBadgeTagText : null]}>
                                  {item.badge}
                                </Text>
                              </View>
                            )}
                          </View>
                          {item.isDeal && item.dealItems && (
                            <Text style={styles.comboIncludedMini} numberOfLines={1}>
                              {item.dealItems.map(d => `${d.qty}x ${d.name}`).join(', ')}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Category & Station */}
                      <View style={[styles.tableCell, { flex: 1.1 }]}>
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{item.category}</Text>
                        </View>
                        <Text style={styles.stationTextSmall}>
                          {item.station === 'juice' ? '🍹 Juice Bar' : '🍳 Main Kitchen'}
                        </Text>
                      </View>

                      {/* Price & Cost */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <Text style={styles.tablePriceText}>
                          {item.price > 0 ? money(item.price) : 'Variants'}
                        </Text>
                        {item.costPrice ? (
                          <Text style={styles.tableCostText}>Cost: {money(item.costPrice)}</Text>
                        ) : (
                          <Text style={styles.tableCostTextNone}>Cost: —</Text>
                        )}
                      </View>

                      {/* Margin */}
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        {marginInfo ? (
                          <View>
                            <View style={[
                              styles.marginBadge, 
                              marginInfo.marginPct >= 50 ? styles.marginHigh : (marginInfo.marginPct >= 30 ? styles.marginMid : styles.marginLow)
                            ]}>
                              <Text style={[
                                styles.marginBadgeText,
                                marginInfo.marginPct >= 50 ? styles.marginHighText : (marginInfo.marginPct >= 30 ? styles.marginMidText : styles.marginLowText)
                              ]}>
                                {marginInfo.marginPct}%
                              </Text>
                            </View>
                            <Text style={styles.marginProfitSub}>+{money(marginInfo.grossProfit)}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: BRAND.muted, fontSize: 12 }}>—</Text>
                        )}
                      </View>

                      {/* Stock Inventory */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        {item.trackStock ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity 
                              style={[
                                styles.stockPill, 
                                isOut ? styles.stockPillOut : (isLow ? styles.stockPillLow : styles.stockPillIn)
                              ]}
                              onPress={() => {
                                setStockAdjustItem(item);
                                setStockDeltaInput(item.stockQty?.toString() || '0');
                                setStockMode('set');
                              }}
                            >
                              <Text style={[
                                styles.stockPillText,
                                isOut ? styles.stockTextOut : (isLow ? styles.stockTextLow : styles.stockTextIn)
                              ]}>
                                {isOut ? 'Sold Out (0)' : `${item.stockQty} pcs`}
                              </Text>
                              <Ionicons name="create-outline" size={12} color={BRAND.muted} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={styles.quickAddStockMini}
                              onPress={() => adjustMenuItemStock(item.id, 10, 'add')}
                            >
                              <Text style={styles.quickAddStockMiniText}>+10</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={{ color: BRAND.muted, fontSize: 12 }}>Untracked</Text>
                        )}
                      </View>

                      {/* Actions */}
                      <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                        <TouchableOpacity 
                          style={styles.desktopActionBtn} 
                          onPress={() => openEditItemModal(item)}
                        >
                          <Ionicons name="pencil" size={16} color={BRAND.burgundy} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.desktopActionBtn, { backgroundColor: BRAND.dangerSoft }]} 
                          onPress={() => handleDeleteItem(item)}
                        >
                          <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            // ================= CATEGORIES LIST =================
            filteredCategories.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="grid-outline" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No categories found</Text>
              </View>
            ) : isMobile ? (
              // MOBILE VIEW: CATEGORY CARDS
              <View style={styles.mobileCardsList}>
                {filteredCategories.map(cat => (
                  <View key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryCardLeft}>
                      <View style={styles.categoryIconBadge}>
                        <Ionicons name="folder-outline" size={22} color={BRAND.burgundy} />
                      </View>
                      <View>
                        <Text style={styles.categoryCardTitle}>{cat.name}</Text>
                        <Text style={styles.categoryCardCount}>{cat.itemsCount} Dishes listed</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteCategoryBtn}
                      onPress={() => handleDeleteCategory(cat.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color={BRAND.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              // DESKTOP VIEW: CATEGORIES TABLE
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2 }]}>Category Name</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell]}>Assigned Items</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Actions</Text>
                </View>
                
                {filteredCategories.map(cat => (
                  <View key={cat.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '700', fontSize: 16, color: BRAND.ink }]}>
                      {cat.name}
                    </Text>
                    <Text style={styles.tableCell}>{cat.itemsCount} Items</Text>
                    <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }]}>
                      <TouchableOpacity 
                        style={[styles.desktopActionBtn, { backgroundColor: BRAND.dangerSoft }]} 
                        onPress={() => handleDeleteCategory(cat.name)}
                      >
                        <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}
        </ScrollView>
      </View>

      {/* ============================================================== */}
      {/* ADD / EDIT ITEM MODAL (With Tabbed Upgrades for 3, 4, and 5)   */}
      {/* ============================================================== */}
      <Modal visible={isItemModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingItem ? (itemIsDeal ? 'Edit Deal / Combo Pack' : 'Edit Menu Dish') : (itemIsDeal ? 'Create New Deal / Combo Pack' : 'Add New Menu Dish')}
                </Text>
                <Text style={styles.modalSub}>
                  {itemIsDeal ? 'Configure bundled dishes, special pricing & badges' : 'Configure dish details, image, cost margin & stock'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setItemModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            {/* Modal Sub-Tabs */}
            <View style={styles.modalTabsBar}>
              <TouchableOpacity 
                style={[styles.modalSubTab, modalTab === 'basic' && styles.modalSubTabActive]}
                onPress={() => setModalTab('basic')}
              >
                <Ionicons name="information-circle-outline" size={15} color={modalTab === 'basic' ? BRAND.burgundy : BRAND.muted} />
                <Text style={[styles.modalSubTabText, modalTab === 'basic' && styles.modalSubTabTextActive]}>
                  1. Basic Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalSubTab, modalTab === 'image' && styles.modalSubTabActive]}
                onPress={() => setModalTab('image')}
              >
                <Ionicons name="image-outline" size={15} color={modalTab === 'image' ? BRAND.burgundy : BRAND.muted} />
                <Text style={[styles.modalSubTabText, modalTab === 'image' && styles.modalSubTabTextActive]}>
                  2. Image & Presets
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalSubTab, modalTab === 'pricing_stock' && styles.modalSubTabActive]}
                onPress={() => setModalTab('pricing_stock')}
              >
                <Ionicons name="cash-outline" size={15} color={modalTab === 'pricing_stock' ? BRAND.burgundy : BRAND.muted} />
                <Text style={[styles.modalSubTabText, modalTab === 'pricing_stock' && styles.modalSubTabTextActive]}>
                  3. Pricing & Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalSubTab, modalTab === 'combo' && styles.modalSubTabActive]}
                onPress={() => setModalTab('combo')}
              >
                <Ionicons name="gift-outline" size={15} color={modalTab === 'combo' ? BRAND.burgundy : BRAND.muted} />
                <Text style={[styles.modalSubTabText, modalTab === 'combo' && styles.modalSubTabTextActive]}>
                  4. Combo / Deal {itemIsDeal && '✨'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {/* TAB 1: BASIC DETAILS */}
              {modalTab === 'basic' && (
                <View style={styles.modalTabPane}>
                  {/* Photo Quick Status & Switch */}
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: itemImageUri ? '#FDFBF7' : '#F8F9FA',
                      borderWidth: 1.5,
                      borderColor: itemImageUri ? '#D4AF37' : '#E2E8F0',
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 16
                    }}
                    onPress={() => setModalTab('image')}
                    activeOpacity={0.8}
                  >
                    {itemImageUri ? (
                      <Image source={{ uri: itemImageUri }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#52141C15', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="camera-outline" size={22} color="#52141C" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E293B' }}>
                        {itemImageUri ? 'Dish Photo Attached' : 'Add Dish Photo (Recommended)'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        {itemImageUri ? 'Tap to change photo or pick curated preset' : 'Tap to upload from device, snap photo or choose preset'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D4AF37" />
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Dish / Deal Name *</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="e.g. Royal Sultan Special Kebab" 
                    placeholderTextColor="#8E8E93"
                    value={itemName} 
                    onChangeText={setItemName} 
                  />

                  {/* Category Dropdown */}
                  <Text style={styles.inputLabel}>Category *</Text>
                  <TouchableOpacity 
                    style={styles.dropdownBtn}
                    activeOpacity={0.8}
                    onPress={() => setCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  >
                    <Text style={styles.dropdownBtnText}>{itemCategory}</Text>
                    <Ionicons name={isCategoryDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#8E8E93" />
                  </TouchableOpacity>
                  
                  {isCategoryDropdownOpen && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                        {categories.map(cat => (
                          <TouchableOpacity 
                            key={cat}
                            style={[styles.dropdownItem, itemCategory === cat && styles.dropdownItemActive]}
                            onPress={() => {
                              setItemCategory(cat);
                              setCategoryDropdownOpen(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, itemCategory === cat && styles.dropdownItemTextActive]}>
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Station / Preparation Area */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>Kitchen Routing / Station</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[
                        styles.stationSelectBtn, 
                        itemStation === 'main' && styles.stationSelectBtnActive
                      ]}
                      onPress={() => setItemStation('main')}
                    >
                      <Ionicons name="restaurant" size={18} color={itemStation === 'main' ? BRAND.burgundy : BRAND.muted} style={{ marginRight: 6 }} />
                      <Text style={[styles.stationSelectText, itemStation === 'main' && styles.stationSelectTextActive]}>
                        Main Kitchen
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.stationSelectBtn, 
                        itemStation === 'juice' && styles.stationSelectBtnActive
                      ]}
                      onPress={() => setItemStation('juice')}
                    >
                      <Ionicons name="wine" size={18} color={itemStation === 'juice' ? BRAND.burgundy : BRAND.muted} style={{ marginRight: 6 }} />
                      <Text style={[styles.stationSelectText, itemStation === 'juice' && styles.stationSelectTextActive]}>
                        Juice & Drinks Bar
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Badge Selection */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>Special Badge (Optional)</Text>
                  <View style={styles.badgePillsRow}>
                    {POPULAR_BADGES.map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.badgeOptionPill, itemBadge === b && styles.badgeOptionPillActive]}
                        onPress={() => setItemBadge(itemBadge === b ? '' : b)}
                      >
                        <Text style={[styles.badgeOptionPillText, itemBadge === b && styles.badgeOptionPillTextActive]}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>Description / Ingredients</Text>
                  <TextInput 
                    style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]} 
                    placeholder="Short appetising description for digital menu and waiters..." 
                    placeholderTextColor="#8E8E93"
                    multiline
                    value={itemDescription} 
                    onChangeText={setItemDescription} 
                  />
                </View>
              )}

              {/* TAB 2: IMAGE & PRESETS (OPTION 3) */}
              {modalTab === 'image' && (
                <View style={styles.modalTabPane}>
                  <Text style={styles.sectionHeading}>Dish Image & Visual Presets</Text>
                  <Text style={styles.sectionDesc}>
                    Upload high-res photos from your device, take a live kitchen photo, paste an image URL, or choose a 1-tap preset.
                  </Text>

                  {/* Upload Action Buttons */}
                  <View style={styles.uploadActionsRow}>
                    <TouchableOpacity 
                      style={[styles.uploadButton, isUploadingImage && styles.uploadButtonDisabled]}
                      onPress={pickImageFromDevice}
                      disabled={isUploadingImage}
                      activeOpacity={0.8}
                    >
                      <View style={styles.uploadIconWrap}>
                        <Ionicons name="cloud-upload-outline" size={22} color={BRAND.burgundy} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadButtonTitle}>Upload from Device / Gallery</Text>
                        <Text style={styles.uploadButtonSub}>Select JPG, PNG or WebP from PC or Phone</Text>
                      </View>
                      {isUploadingImage && <ActivityIndicator size="small" color={BRAND.burgundy} />}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.cameraButton, isUploadingImage && styles.uploadButtonDisabled]}
                      onPress={takePhotoWithCamera}
                      disabled={isUploadingImage}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.uploadIconWrap, { backgroundColor: BRAND.goldSoft }]}>
                        <Ionicons name="camera-outline" size={22} color="#8c6b1b" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadButtonTitle}>Take Photo with Camera</Text>
                        <Text style={styles.uploadButtonSub}>Snap fresh dish in kitchen or table</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Image Preview */}
                  <View style={styles.imagePreviewContainer}>
                    {itemImageUri ? (
                      <View style={styles.previewImageWrap}>
                        <Image source={{ uri: itemImageUri }} style={styles.imagePreview} />
                        <View style={styles.previewActiveBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#fff" />
                          <Text style={styles.previewActiveBadgeText}>Active Image</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={40} color={BRAND.muted} />
                        <Text style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>No Image Selected</Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Or Enter Image URL:</Text>
                      <TextInput 
                        style={styles.modalInput} 
                        placeholder="https://images.unsplash.com/..." 
                        placeholderTextColor="#8E8E93"
                        value={itemImageUri} 
                        onChangeText={setItemImageUri} 
                      />
                      {itemImageUri ? (
                        <TouchableOpacity 
                          style={styles.clearImageBtn}
                          onPress={() => setItemImageUri('')}
                        >
                          <Ionicons name="trash-outline" size={14} color={BRAND.danger} style={{ marginRight: 4 }} />
                          <Text style={{ color: BRAND.danger, fontSize: 12, fontWeight: '700' }}>Remove Image</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* 1-Tap Curated Food Presets */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Or Choose 1-Tap Curated Preset (Click to apply image)</Text>
                  <View style={styles.presetGrid}>
                    {FOOD_PRESETS.map(preset => {
                      const isSelected = itemImageUri === preset.imageUri;
                      return (
                        <TouchableOpacity 
                          key={preset.id}
                          style={[styles.presetCard, isSelected && styles.presetCardActive]}
                          onPress={() => handleSelectPresetImageOnly(preset.imageUri)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: preset.imageUri }} style={styles.presetImage} />
                          <View style={styles.presetOverlay}>
                            <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
                            <Text style={styles.presetPrice}>{money(preset.defaultPrice)}</Text>
                          </View>
                          {isSelected && (
                            <View style={styles.presetSelectedBadge}>
                              <Ionicons name="checkmark-circle" size={16} color="#059669" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* TAB 3: PRICING, COST & STOCK (OPTION 4) */}
              {modalTab === 'pricing_stock' && (
                <View style={styles.modalTabPane}>
                  <Text style={styles.sectionHeading}>Pricing & Profit Margin Analysis</Text>

                  {/* Price & Cost Inputs */}
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Selling Price (Rs.) *</Text>
                      <TextInput 
                        style={styles.modalInput} 
                        placeholder="e.g. 1450" 
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric" 
                        value={itemPrice} 
                        onChangeText={setItemPrice} 
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Cost of Goods (Rs.)</Text>
                      <TextInput 
                        style={styles.modalInput} 
                        placeholder="e.g. 650" 
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric" 
                        value={itemCostPrice} 
                        onChangeText={setItemCostPrice} 
                      />
                    </View>
                  </View>

                  {/* Live Profit Margin Calculator */}
                  {(() => {
                    const p = parseFloat(itemPrice) || 0;
                    const c = parseFloat(itemCostPrice) || 0;
                    if (p > 0 && c > 0) {
                      const profit = p - c;
                      const margin = Math.round((profit / p) * 100);
                      const isHigh = margin >= 50;
                      const isMid = margin >= 30 && margin < 50;

                      return (
                        <View style={[
                          styles.marginAnalysisBanner, 
                          isHigh ? styles.marginAnalysisBannerGreen : (isMid ? styles.marginAnalysisBannerYellow : styles.marginAnalysisBannerRed)
                        ]}>
                          <Ionicons 
                            name={isHigh ? "trending-up-outline" : (isMid ? "stats-chart-outline" : "alert-circle-outline")} 
                            size={24} 
                            color={isHigh ? BRAND.success : (isMid ? BRAND.warn : BRAND.danger)} 
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.marginAnalysisTitle}>
                              Gross Profit: {money(profit)} ({margin}% Margin)
                            </Text>
                            <Text style={styles.marginAnalysisDesc}>
                              {isHigh 
                                ? '✨ Healthy margin! High profitability per portion sold.' 
                                : (isMid ? '👍 Balanced margin covering standard restaurant overhead.' : '⚠️ Low profit margin. Consider adjusting cost or price.')}
                            </Text>
                          </View>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  {/* Stock Inventory Tracking (Option 4) */}
                  <View style={styles.stockTrackingSection}>
                    <View style={styles.stockToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stockToggleTitle}>Track Stock Inventory</Text>
                        <Text style={styles.stockToggleSubtitle}>
                          Auto-decrements stock when orders are placed and alerts kitchen when low
                        </Text>
                      </View>
                      <Switch
                        value={itemTrackStock}
                        onValueChange={setItemTrackStock}
                        trackColor={{ false: '#ccc', true: BRAND.gold }}
                        thumbColor={itemTrackStock ? BRAND.burgundy : '#f4f3f4'}
                      />
                    </View>

                    {itemTrackStock && (
                      <View style={{ marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Current In-Stock (Portions)</Text>
                            <TextInput 
                              style={styles.modalInput} 
                              placeholder="e.g. 25" 
                              placeholderTextColor="#8E8E93"
                              keyboardType="numeric" 
                              value={itemStockQty} 
                              onChangeText={setItemStockQty} 
                            />
                            {/* Quick +10, +25, +50 pills */}
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                              {[10, 25, 50].map(addVal => (
                                <TouchableOpacity 
                                  key={addVal}
                                  style={styles.quickAddStockPill}
                                  onPress={() => {
                                    const current = parseInt(itemStockQty, 10) || 0;
                                    setItemStockQty((current + addVal).toString());
                                  }}
                                >
                                  <Text style={styles.quickAddStockPillText}>+{addVal}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Low Stock Alert Threshold</Text>
                            <TextInput 
                              style={styles.modalInput} 
                              placeholder="e.g. 5" 
                              placeholderTextColor="#8E8E93"
                              keyboardType="numeric" 
                              value={itemLowStockThreshold} 
                              onChangeText={setItemLowStockThreshold} 
                            />
                          </View>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Multi-variants */}
                  <View style={{ marginTop: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.inputLabel}>Portion Variants (e.g. Small / Large / 1 KG)</Text>
                      <TouchableOpacity 
                        style={styles.addOptionBtn}
                        onPress={() => setItemVariants([...itemVariants, { name: '', price: '' }])}
                      >
                        <Text style={styles.addOptionBtnText}>+ Add Variant</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {itemVariants.map((variant, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <TextInput
                          style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                          placeholder="Variant (e.g. Small / 10 inch)"
                          placeholderTextColor="#8E8E93"
                          value={variant.name}
                          onChangeText={(val) => {
                            const newVars = [...itemVariants];
                            newVars[idx].name = val;
                            setItemVariants(newVars);
                          }}
                        />
                        <TextInput
                          style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                          placeholder="Price"
                          placeholderTextColor="#8E8E93"
                          keyboardType="numeric"
                          value={variant.price}
                          onChangeText={(val) => {
                            const newVars = [...itemVariants];
                            newVars[idx].price = val;
                            setItemVariants(newVars);
                          }}
                        />
                        <TouchableOpacity 
                          style={{ padding: 8 }}
                          onPress={() => {
                            const newVars = [...itemVariants];
                            newVars.splice(idx, 1);
                            setItemVariants(newVars);
                          }}
                        >
                          <Ionicons name="trash" size={20} color={BRAND.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* TAB 4: COMBO & DEAL BUILDER (OPTION 5) */}
              {modalTab === 'combo' && (
                <View style={styles.modalTabPane}>
                  <View style={styles.dealToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dealToggleTitle}>This is a Combo / Deal Package</Text>
                      <Text style={styles.dealToggleSubtitle}>
                        Bundle multiple menu dishes together into a discounted package
                      </Text>
                    </View>
                    <Switch
                      value={itemIsDeal}
                      onValueChange={(val) => {
                        setItemIsDeal(val);
                        if (val && itemCategory !== 'Deals') {
                          setItemCategory('Deals');
                          if (!itemBadge) setItemBadge('Family Deal');
                        }
                      }}
                      trackColor={{ false: '#ccc', true: BRAND.purple }}
                      thumbColor={itemIsDeal ? BRAND.gold : '#f4f3f4'}
                    />
                  </View>

                  {itemIsDeal ? (
                    <View style={{ marginTop: 16 }}>
                      {/* Included Items Summary */}
                      <Text style={styles.sectionHeading}>Items Included in this Deal</Text>
                      {itemDealItems.length === 0 ? (
                        <View style={styles.emptyComboWrap}>
                          <Ionicons name="gift-outline" size={32} color={BRAND.muted} />
                          <Text style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>
                            No dishes added yet. Pick from the menu below!
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.comboItemsList}>
                          {itemDealItems.map((dItem, idx) => (
                            <View key={idx} style={styles.comboItemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.comboItemName}>{dItem.name}</Text>
                                <Text style={styles.comboItemPrice}>
                                  {money(dItem.price || 0)} each • Total: {money((dItem.price || 0) * dItem.qty)}
                                </Text>
                              </View>
                              
                              <View style={styles.qtyControlRow}>
                                <TouchableOpacity 
                                  style={styles.qtyBtn}
                                  onPress={() => updateDishDealQty(idx, dItem.qty - 1)}
                                >
                                  <Ionicons name="remove" size={14} color={BRAND.ink} />
                                </TouchableOpacity>
                                <Text style={styles.qtyText}>{dItem.qty}</Text>
                                <TouchableOpacity 
                                  style={styles.qtyBtn}
                                  onPress={() => updateDishDealQty(idx, dItem.qty + 1)}
                                >
                                  <Ionicons name="add" size={14} color={BRAND.ink} />
                                </TouchableOpacity>
                              </View>

                              <TouchableOpacity 
                                style={{ padding: 6, marginLeft: 6 }}
                                onPress={() => removeDishFromDeal(idx)}
                              >
                                <Ionicons name="trash-outline" size={18} color={BRAND.danger} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Original Value & Discount calculation */}
                      {itemDealOriginalPrice && parseFloat(itemDealOriginalPrice) > 0 ? (
                        <View style={styles.dealCalculationCard}>
                          <View style={styles.dealCalculationRow}>
                            <Text style={styles.dealCalcLabel}>Sum of Individual Dishes:</Text>
                            <Text style={styles.dealCalcValueStrike}>{money(parseFloat(itemDealOriginalPrice))}</Text>
                          </View>
                          <View style={styles.dealCalculationRow}>
                            <Text style={styles.dealCalcLabel}>Special Combo Deal Price:</Text>
                            <Text style={styles.dealCalcValueHighlight}>
                              {itemPrice ? money(parseFloat(itemPrice)) : 'Set in Step 3'}
                            </Text>
                          </View>
                          {itemPrice && parseFloat(itemPrice) < parseFloat(itemDealOriginalPrice) && (
                            <View style={styles.dealSavingsBanner}>
                              <Ionicons name="sparkles" size={16} color={BRAND.purple} />
                              <Text style={styles.dealSavingsText}>
                                Customer Saves {money(parseFloat(itemDealOriginalPrice) - parseFloat(itemPrice))} ({Math.round(((parseFloat(itemDealOriginalPrice) - parseFloat(itemPrice)) / parseFloat(itemDealOriginalPrice)) * 100)}% Discount)
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Pick Dish to Add */}
                      <Text style={[styles.inputLabel, { marginTop: 20 }]}>+ Tap Any Menu Dish to Add into Deal:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.menuPickerScroll}>
                        {menuItems.filter(m => !m.isDeal).map(menuIt => (
                          <TouchableOpacity 
                            key={menuIt.id}
                            style={styles.menuPickCard}
                            onPress={() => addDishToDeal(menuIt)}
                          >
                            <Text style={styles.menuPickName} numberOfLines={1}>{menuIt.name}</Text>
                            <Text style={styles.menuPickPrice}>{money(menuIt.price)}</Text>
                            <Text style={styles.menuPickAdd}>+ Add</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: BRAND.muted, textAlign: 'center', lineHeight: 20 }}>
                        Enable the switch above if this item represents a Combo Deal or Family Feast package.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            
            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setItemModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveItem}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#4a121a" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>{editingItem ? 'Update Dish' : 'Save Dish'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* QUICK STOCK ADJUSTMENT MODAL (OPTION 4)                         */}
      {/* ============================================================== */}
      <Modal visible={Boolean(stockAdjustItem)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 450 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Quick Restock / Stock Adjustment</Text>
                <Text style={styles.modalSub}>{stockAdjustItem?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setStockAdjustItem(null)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 16 }}>
              <Text style={styles.inputLabel}>Current Stock: {stockAdjustItem?.stockQty || 0} portions</Text>
              
              <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
                <TouchableOpacity 
                  style={[styles.stockModeBtn, stockMode === 'add' && styles.stockModeBtnActive]}
                  onPress={() => setStockMode('add')}
                >
                  <Text style={[styles.stockModeBtnText, stockMode === 'add' && styles.stockModeBtnTextActive]}>
                    + Add to Stock
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.stockModeBtn, stockMode === 'set' && styles.stockModeBtnActive]}
                  onPress={() => setStockMode('set')}
                >
                  <Text style={[styles.stockModeBtnText, stockMode === 'set' && styles.stockModeBtnTextActive]}>
                    Set Exact Quantity
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput 
                style={styles.modalInput} 
                placeholder={stockMode === 'add' ? 'e.g. 20 (to add 20 portions)' : 'e.g. 50'} 
                placeholderTextColor="#8E8E93"
                keyboardType="numeric" 
                value={stockDeltaInput} 
                onChangeText={setStockDeltaInput} 
                autoFocus
              />

              {stockMode === 'add' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {[5, 10, 20, 50].map(num => (
                    <TouchableOpacity 
                      key={num}
                      style={styles.quickAddStockPill}
                      onPress={() => setStockDeltaInput(num.toString())}
                    >
                      <Text style={styles.quickAddStockPillText}>+{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStockAdjustItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleApplyStockAdjust}>
                <Text style={styles.saveBtnText}>Apply Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={isCatModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && styles.modalContentMobile, { maxWidth: 450 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Category</Text>
              <TouchableOpacity onPress={() => setCatModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Category Name</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="e.g. Seafood, Platters, Soups, Platters" 
              placeholderTextColor="#8E8E93"
              value={newCatName} 
              onChangeText={setNewCatName} 
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCatModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
                <Text style={styles.saveBtnText}>Save Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F8F9FA',
  },
  containerMobile: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: BRAND.ink,
    letterSpacing: -0.5,
  },
  pageTitleMobile: {
    fontSize: 20,
  },
  pageSubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addButton: {
    backgroundColor: BRAND.gold,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: BRAND.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#4a121a',
    fontWeight: '800',
    fontSize: 14,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
    })
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
  },
  kpiLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
    marginTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: BRAND.burgundy,
  },
  tabText: {
    fontSize: 14,
    color: BRAND.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  filterSection: {
    marginBottom: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingRight: 10,
    height: 46,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(82, 20, 28, 0.06), 0 2px 6px rgba(212, 175, 55, 0.12), inset 0 1px 0 #FFFFFF',
        transition: 'all 0.2s ease',
      } as any,
      ios: {
        shadowColor: '#52141C',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
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
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: BRAND.ink,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any,
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
  },
  searchShortcutText: {
    color: '#92400E',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  categoryPillsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  categoryPillText: {
    fontSize: 13,
    color: BRAND.muted,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: BRAND.gold,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentMobile: {
    paddingBottom: 20,
  },
  listContainer: {
    flex: 1,
  },
  emptyWrap: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 4,
  },
  mobileCardsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
    })
  },
  itemCardMain: {
    flexDirection: 'row',
    gap: 12,
  },
  itemThumbImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  itemIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3E5C8',
  },
  itemInfo: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.ink,
    flex: 1,
  },
  badgeTag: {
    backgroundColor: BRAND.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dealBadgeTag: {
    backgroundColor: BRAND.purpleSoft,
  },
  badgeTagText: {
    color: '#8c6b1b',
    fontSize: 11,
    fontWeight: '700',
  },
  dealBadgeTagText: {
    color: BRAND.purple,
  },
  badgeTagSmall: {
    backgroundColor: BRAND.goldSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTagSmallText: {
    color: '#8c6b1b',
    fontSize: 10,
    fontWeight: '700',
  },
  catBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  catBadgeText: {
    fontSize: 11,
    color: BRAND.ink,
    fontWeight: '600',
  },
  stationText: {
    fontSize: 11,
    color: BRAND.muted,
  },
  stationTextSmall: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  comboPreviewWrap: {
    backgroundColor: '#FAF5FF',
    padding: 6,
    borderRadius: 6,
    marginVertical: 4,
  },
  comboPreviewTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.purple,
    textTransform: 'uppercase',
  },
  comboPreviewText: {
    fontSize: 11,
    color: '#553C9A',
    marginTop: 1,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemCardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  originalPriceText: {
    fontSize: 11,
    color: BRAND.purple,
    fontWeight: '700',
  },
  marginPill: {
    backgroundColor: BRAND.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  marginPillText: {
    color: BRAND.success,
    fontSize: 11,
    fontWeight: '700',
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  stockPillIn: {
    backgroundColor: BRAND.successSoft,
  },
  stockPillLow: {
    backgroundColor: BRAND.warnSoft,
  },
  stockPillOut: {
    backgroundColor: BRAND.dangerSoft,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockTextIn: { color: BRAND.success },
  stockTextLow: { color: BRAND.warn },
  stockTextOut: { color: BRAND.danger },
  untrackedStockText: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 4,
  },
  itemCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: BRAND.burgundySoft,
  },
  editBtnText: {
    color: BRAND.burgundy,
    fontSize: 13,
    fontWeight: '700',
  },
  restockQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: BRAND.successSoft,
  },
  restockQuickBtnText: {
    color: BRAND.success,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: BRAND.dangerSoft,
  },
  deleteBtnText: {
    color: BRAND.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderCell: {
    fontWeight: '700',
    color: BRAND.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableCell: {
    flex: 1,
  },
  tableThumbImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 10,
  },
  tableThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F3E5C8',
  },
  tableItemName: {
    fontWeight: '700',
    fontSize: 15,
    color: BRAND.ink,
  },
  comboIncludedMini: {
    fontSize: 11,
    color: BRAND.purple,
    marginTop: 2,
    fontWeight: '500',
  },
  tablePriceText: {
    fontWeight: '800',
    color: BRAND.burgundy,
    fontSize: 14,
  },
  tableCostText: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  tableCostTextNone: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 2,
  },
  marginBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  marginHigh: { backgroundColor: BRAND.successSoft },
  marginMid: { backgroundColor: BRAND.warnSoft },
  marginLow: { backgroundColor: BRAND.dangerSoft },
  marginBadgeText: { fontSize: 11, fontWeight: '800' },
  marginHighText: { color: BRAND.success },
  marginMidText: { color: BRAND.warn },
  marginLowText: { color: BRAND.danger },
  marginProfitSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  quickAddStockMini: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  quickAddStockMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  desktopActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BRAND.burgundySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  categoryCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: BRAND.burgundySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.ink,
  },
  categoryCardCount: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  deleteCategoryBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: BRAND.dangerSoft,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 5 },
      web: { boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }
    })
  },
  modalContentMobile: {
    padding: 16,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.ink,
  },
  modalSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalTabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 16,
    gap: 6,
    flexWrap: 'wrap',
  },
  modalSubTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  modalSubTabActive: {
    backgroundColor: BRAND.burgundySoft,
  },
  modalSubTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.muted,
  },
  modalSubTabTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  modalBodyScroll: {
    maxHeight: 440,
  },
  modalTabPane: {
    paddingBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: BRAND.muted,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BRAND.ink,
    marginBottom: 12,
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dropdownBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.ink,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    marginTop: -8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  dropdownItemActive: {
    backgroundColor: BRAND.goldSoft,
  },
  dropdownItemText: {
    fontSize: 14,
    color: BRAND.ink,
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: '#8c6b1b',
  },
  stationSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  stationSelectBtnActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: BRAND.burgundySoft,
  },
  stationSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.muted,
  },
  stationSelectTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  badgePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badgeOptionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  badgeOptionPillActive: {
    backgroundColor: BRAND.goldSoft,
    borderColor: BRAND.gold,
  },
  badgeOptionPillText: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: '600',
  },
  badgeOptionPillTextActive: {
    color: '#8c6b1b',
    fontWeight: '800',
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  uploadButton: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundySoft,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cameraButton: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
    })
  },
  uploadButtonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.ink,
  },
  uploadButtonSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 1,
  },
  previewImageWrap: {
    position: 'relative',
  },
  previewActiveBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(46, 125, 50, 0.85)',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  previewActiveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '31%',
    minWidth: 100,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetCardActive: {
    borderColor: BRAND.gold,
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
  },
  presetName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  presetPrice: {
    color: BRAND.gold,
    fontSize: 9,
    fontWeight: '800',
  },
  presetSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
    zIndex: 4,
  },
  marginAnalysisBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  marginAnalysisBannerGreen: {
    backgroundColor: BRAND.successSoft,
  },
  marginAnalysisBannerYellow: {
    backgroundColor: BRAND.warnSoft,
  },
  marginAnalysisBannerRed: {
    backgroundColor: BRAND.dangerSoft,
  },
  marginAnalysisTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
  },
  marginAnalysisDesc: {
    fontSize: 12,
    color: BRAND.text,
    marginTop: 2,
  },
  stockTrackingSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 8,
  },
  stockToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockToggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
  },
  stockToggleSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  quickAddStockPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickAddStockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  addOptionBtn: {
    backgroundColor: BRAND.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addOptionBtnText: {
    color: '#8c6b1b',
    fontWeight: '700',
    fontSize: 12,
  },
  dealToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D8FD',
  },
  dealToggleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.purple,
  },
  dealToggleSubtitle: {
    fontSize: 11,
    color: '#6B46C1',
    marginTop: 2,
  },
  emptyComboWrap: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  comboItemsList: {
    gap: 8,
    marginVertical: 10,
  },
  comboItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 10,
  },
  comboItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
  },
  comboItemPrice: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    padding: 2,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    paddingHorizontal: 8,
    fontWeight: '800',
    fontSize: 13,
    color: BRAND.ink,
  },
  dealCalculationCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E9D8FD',
  },
  dealCalculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  dealCalcLabel: {
    fontSize: 13,
    color: '#6B46C1',
    fontWeight: '600',
  },
  dealCalcValueStrike: {
    fontSize: 13,
    color: BRAND.muted,
    textDecorationLine: 'line-through',
  },
  dealCalcValueHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.purple,
  },
  dealSavingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  dealSavingsText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.purple,
  },
  menuPickerScroll: {
    paddingVertical: 8,
    gap: 8,
  },
  menuPickCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 10,
    minWidth: 120,
  },
  menuPickName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  menuPickPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginTop: 2,
  },
  menuPickAdd: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.purple,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: BRAND.muted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BRAND.gold,
  },
  saveBtnText: {
    fontWeight: '800',
    color: '#4a121a',
  },
  stockModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  stockModeBtnActive: {
    backgroundColor: BRAND.burgundy,
  },
  stockModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  stockModeBtnTextActive: {
    color: '#fff',
  },
});
