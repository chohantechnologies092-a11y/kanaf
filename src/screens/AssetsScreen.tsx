import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useOpsStore,
  useAuthStore,
  Asset,
  AssetCategory,
  AssetCondition,
  AssetStatus,
  ASSET_CATEGORIES,
} from '../store';
import { money, formatDay } from '../utils/format';

const LIGHT = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  burgundySoft: 'rgba(82, 23, 27, 0.08)',
  gold: '#B48214',
  goldSoft: 'rgba(180, 130, 20, 0.12)',
  goldBorder: 'rgba(180, 130, 20, 0.35)',
  ink: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  emerald: '#10B981',
  emeraldSoft: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  amberBorder: '#FDE68A',
  rose: '#E11D48',
  roseSoft: '#FFF1F2',
  roseBorder: '#FECDD3',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  blueBorder: '#BFDBFE',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleBorder: '#DDD6FE',
};

const CONDITIONS: { key: AssetCondition; label: string; color: string; bg: string; border: string }[] = [
  { key: 'brand_new', label: 'Brand New', color: '#047857', bg: LIGHT.emeraldSoft, border: LIGHT.emeraldBorder },
  { key: 'good', label: 'Good Working', color: '#1D4ED8', bg: LIGHT.blueSoft, border: LIGHT.blueBorder },
  { key: 'fair', label: 'Fair / Aging', color: '#B45309', bg: LIGHT.amberSoft, border: LIGHT.amberBorder },
  { key: 'needs_maintenance', label: 'Needs Repair', color: '#BE123C', bg: LIGHT.roseSoft, border: LIGHT.roseBorder },
];

const STATUSES: { key: AssetStatus; label: string; color: string; bg: string; border: string }[] = [
  { key: 'active', label: 'Active in Service', color: '#047857', bg: LIGHT.emeraldSoft, border: LIGHT.emeraldBorder },
  { key: 'in_maintenance', label: 'In Maintenance', color: '#B45309', bg: LIGHT.amberSoft, border: LIGHT.amberBorder },
  { key: 'retired', label: 'Retired / Scrapped', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  { key: 'written_off', label: 'Written Off', color: '#BE123C', bg: LIGHT.roseSoft, border: LIGHT.roseBorder },
];

export default function AssetsScreen({
  backRoute = '/admin/dashboard',
  role = 'admin',
}: {
  backRoute?: string;
  role?: 'admin' | 'manager';
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const assets = useOpsStore((s) => s.assets || []);
  const addAsset = useOpsStore((s) => s.addAsset);
  const updateAsset = useOpsStore((s) => s.updateAsset);
  const deleteAsset = useOpsStore((s) => s.deleteAsset);
  const addAssetMaintenanceLog = useOpsStore((s) => s.addAssetMaintenanceLog);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [maintenanceAsset, setMaintenanceAsset] = useState<Asset | null>(null);
  const [viewAsset, setViewAsset] = useState<Asset | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formUrduName, setFormUrduName] = useState('');
  const [formCategory, setFormCategory] = useState<AssetCategory>(ASSET_CATEGORIES[0]);
  const [formCost, setFormCost] = useState('');
  const [formQty, setFormQty] = useState('1');
  const [formVendor, setFormVendor] = useState('');
  const [formVendorPhone, setFormVendorPhone] = useState('');
  const [formInvoiceNo, setFormInvoiceNo] = useState('');
  const [formLocation, setFormLocation] = useState('Main Kitchen Line 1');
  const [formCondition, setFormCondition] = useState<AssetCondition>('good');
  const [formStatus, setFormStatus] = useState<AssetStatus>('active');
  const [formDepreciationRate, setFormDepreciationRate] = useState('10');
  const [formSerial, setFormSerial] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Maintenance Form State
  const [maintCost, setMaintCost] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintTech, setMaintTech] = useState('');
  const [maintAutoExpense, setMaintAutoExpense] = useState(true);

  // Financial Stats
  const stats = useMemo(() => {
    let totalInvested = 0;
    let activeValue = 0;
    let activeCount = 0;
    let maintCount = 0;
    let totalMaintSpent = 0;

    assets.forEach((a) => {
      totalInvested += a.totalCost || a.cost * a.quantity;
      if (a.status === 'active') {
        activeCount += a.quantity || 1;
        activeValue += a.currentValue || a.totalCost;
      } else if (a.status === 'in_maintenance') {
        maintCount += a.quantity || 1;
      }
      if (a.maintenanceLogs && a.maintenanceLogs.length > 0) {
        a.maintenanceLogs.forEach((log) => {
          totalMaintSpent += log.cost || 0;
        });
      }
    });

    return {
      totalInvested,
      activeValue,
      activeCount,
      maintCount,
      totalMaintSpent,
      totalAssetsCount: assets.length,
    };
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((ast) => {
      if (selectedCategory !== 'All' && ast.category !== selectedCategory) return false;
      if (selectedStatus !== 'All' && ast.status !== selectedStatus) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ast.name.toLowerCase().includes(q) ||
        (ast.urduName && ast.urduName.toLowerCase().includes(q)) ||
        ast.assetCode.toLowerCase().includes(q) ||
        ast.vendor.toLowerCase().includes(q) ||
        ast.location.toLowerCase().includes(q) ||
        (ast.serialNumber && ast.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [assets, selectedCategory, selectedStatus, search]);

  const openAddModal = () => {
    setEditingAsset(null);
    setFormName('');
    setFormUrduName('');
    setFormCategory(ASSET_CATEGORIES[0]);
    setFormCost('');
    setFormQty('1');
    setFormVendor('');
    setFormVendorPhone('');
    setFormInvoiceNo('');
    setFormLocation('Main Kitchen Line 1');
    setFormCondition('good');
    setFormStatus('active');
    setFormDepreciationRate('10');
    setFormSerial('');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (ast: Asset) => {
    setEditingAsset(ast);
    setFormName(ast.name);
    setFormUrduName(ast.urduName || '');
    setFormCategory(ast.category);
    setFormCost(String(ast.cost));
    setFormQty(String(ast.quantity || 1));
    setFormVendor(ast.vendor);
    setFormVendorPhone(ast.vendorPhone || '');
    setFormInvoiceNo(ast.invoiceNo || '');
    setFormLocation(ast.location);
    setFormCondition(ast.condition);
    setFormStatus(ast.status);
    setFormDepreciationRate(String(ast.depreciationRateYearly || 10));
    setFormSerial(ast.serialNumber || '');
    setFormNotes(ast.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveAsset = () => {
    if (!formName.trim()) {
      alertMsg('Missing Information', 'Please enter the asset name.');
      return;
    }
    const cost = parseFloat(formCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      alertMsg('Invalid Cost', 'Please enter a valid purchase cost.');
      return;
    }
    const qty = parseInt(formQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      alertMsg('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }
    const depRate = parseFloat(formDepreciationRate) || 10;
    const totalCost = cost * qty;

    if (editingAsset) {
      updateAsset(editingAsset.id, {
        name: formName.trim(),
        urduName: formUrduName.trim() || undefined,
        category: formCategory,
        cost,
        quantity: qty,
        totalCost,
        vendor: formVendor.trim() || 'General Vendor',
        vendorPhone: formVendorPhone.trim() || undefined,
        invoiceNo: formInvoiceNo.trim() || undefined,
        location: formLocation.trim() || 'Main Kitchen',
        condition: formCondition,
        status: formStatus,
        depreciationRateYearly: depRate,
        serialNumber: formSerial.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      alertMsg('Asset Updated', `[${editingAsset.assetCode}] ${formName} was updated successfully.`);
    } else {
      addAsset({
        assetCode: `AST-${formCategory.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        urduName: formUrduName.trim() || undefined,
        category: formCategory,
        purchaseDate: Date.now(),
        cost,
        quantity: qty,
        totalCost,
        vendor: formVendor.trim() || 'General Vendor',
        vendorPhone: formVendorPhone.trim() || undefined,
        invoiceNo: formInvoiceNo.trim() || undefined,
        location: formLocation.trim() || 'Main Kitchen',
        condition: formCondition,
        status: formStatus,
        depreciationRateYearly: depRate,
        serialNumber: formSerial.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      alertMsg('Capital Asset Added', `New capital investment ${formName} (${money(totalCost)}) recorded.`);
    }
    setIsAddModalOpen(false);
  };

  const handleDelete = (ast: Asset) => {
    const confirm = () => {
      deleteAsset(ast.id);
      alertMsg('Asset Removed', `[${ast.assetCode}] ${ast.name} has been removed.`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete asset [${ast.assetCode}] ${ast.name}?`)) {
        confirm();
      }
    } else {
      Alert.alert('Confirm Delete', `Delete asset [${ast.assetCode}] ${ast.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const handleSaveMaintenance = () => {
    if (!maintenanceAsset) return;
    const cost = parseFloat(maintCost);
    if (!Number.isFinite(cost) || cost < 0) {
      alertMsg('Invalid Cost', 'Please enter a valid repair cost.');
      return;
    }
    if (!maintDesc.trim()) {
      alertMsg('Missing Description', 'Please describe the repair or service performed.');
      return;
    }

    addAssetMaintenanceLog(
      maintenanceAsset.id,
      {
        date: Date.now(),
        cost,
        description: maintDesc.trim(),
        performedBy: maintTech.trim() || user?.name || 'Technician',
      },
      {
        autoRecordExpense: maintAutoExpense && cost > 0,
        paidBy: user?.name || 'Manager',
      }
    );

    alertMsg(
      'Service Logged',
      `Maintenance of ${money(cost)} recorded for [${maintenanceAsset.assetCode}]. ${
        maintAutoExpense && cost > 0 ? 'Also booked into restaurant expenses.' : ''
      }`
    );
    setMaintenanceAsset(null);
    setMaintCost('');
    setMaintDesc('');
    setMaintTech('');
  };

  function alertMsg(title: string, msg: string) {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Light Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push(backRoute as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={LIGHT.burgundy} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="diamond" size={20} color={LIGHT.burgundy} />
              <Text style={styles.headerTitle}>Assets & Capital Capex</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>INVESTMENT AUDIT</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              Heavy machinery, furniture, interior, generators, and capital inventory ledger
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addAssetBtn} onPress={openAddModal} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={18} color="#FFFFFF" />
          <Text style={styles.addAssetBtnText}>+ Add Capital Asset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Light KPI Deck */}
        <View style={styles.kpiGrid}>
          {/* Total Invested */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.goldBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOTAL CAPITAL INVESTED</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.goldSoft }]}>
                <Ionicons name="wallet-outline" size={18} color={LIGHT.gold} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.gold }]}>{money(stats.totalInvested)}</Text>
            <Text style={styles.kpiHint}>{stats.totalAssetsCount} primary equipment & asset lots</Text>
          </View>

          {/* Active Book Value */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.emeraldBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>ACTIVE BOOK VALUE</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.emeraldSoft }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={LIGHT.emerald} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.emerald }]}>{money(stats.activeValue)}</Text>
            <Text style={styles.kpiHint}>{stats.activeCount} live units in daily service</Text>
          </View>

          {/* In Maintenance */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.amberBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>IN MAINTENANCE</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.amberSoft }]}>
                <Ionicons name="construct-outline" size={18} color={LIGHT.amber} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.amber }]}>
              {stats.maintCount} <Text style={{ fontSize: 15, fontWeight: '400', color: LIGHT.textSecondary }}>Units</Text>
            </Text>
            <Text style={styles.kpiHint}>Under active service or inspection</Text>
          </View>

          {/* Maintenance Spend */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.blueBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOTAL REPAIR EXPENSES</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.blueSoft }]}>
                <Ionicons name="repeat-outline" size={18} color={LIGHT.blue} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.blue }]}>{money(stats.totalMaintSpent)}</Text>
            <Text style={styles.kpiHint}>Accumulated maintenance logs</Text>
          </View>
        </View>

        {/* Search and Category Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={LIGHT.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by asset code, name, vendor, location, serial..."
              placeholderTextColor={LIGHT.textDim}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={LIGHT.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Horizontal Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === 'All' && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory('All')}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === 'All' && styles.categoryChipTextActive,
                ]}
              >
                All Categories ({assets.length})
              </Text>
            </TouchableOpacity>

            {ASSET_CATEGORIES.map((cat) => {
              const count = assets.filter((a) => a.category === cat).length;
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Status Filters */}
        <View style={styles.statusFiltersRow}>
          <Text style={styles.filterLeadText}>Filter Status:</Text>
          {['All', 'active', 'in_maintenance', 'retired'].map((st) => {
            const isSel = selectedStatus === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.statusFilterBtn, isSel && styles.statusFilterBtnActive]}
                onPress={() => setSelectedStatus(st)}
              >
                <Text style={[styles.statusFilterText, isSel && styles.statusFilterTextActive]}>
                  {st === 'All' ? 'All Status' : st.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Asset Cards List */}
        <View style={styles.assetList}>
          {filteredAssets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color={LIGHT.textDim} />
              <Text style={styles.emptyTitle}>No Capital Assets Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search criteria or register a new capital asset above.
              </Text>
            </View>
          ) : (
            filteredAssets.map((ast) => {
              const cond = CONDITIONS.find((c) => c.key === ast.condition) || CONDITIONS[1];
              const stat = STATUSES.find((s) => s.key === ast.status) || STATUSES[0];
              const maintTotal = (ast.maintenanceLogs || []).reduce((acc, l) => acc + (l.cost || 0), 0);

              return (
                <View key={ast.id} style={styles.assetCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.codeTag}>
                        <Text style={styles.codeTagText}>{ast.assetCode}</Text>
                      </View>
                      <View style={styles.categoryBadge}>
                        <Ionicons name="pricetag-outline" size={12} color={LIGHT.burgundy} />
                        <Text style={styles.categoryBadgeText}>{ast.category}</Text>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      <View style={[styles.pillBadge, { backgroundColor: cond.bg, borderColor: cond.border }]}>
                        <Text style={[styles.pillBadgeText, { color: cond.color }]}>{cond.label}</Text>
                      </View>
                      <View style={[styles.pillBadge, { backgroundColor: stat.bg, borderColor: stat.border }]}>
                        <Text style={[styles.pillBadgeText, { color: stat.color }]}>{stat.label}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Title and Specs */}
                  <View style={styles.titleSection}>
                    <Text style={styles.assetName}>{ast.name}</Text>
                    {ast.urduName ? <Text style={styles.urduName}>{ast.urduName}</Text> : null}
                  </View>

                  {/* Pricing and Details Grid */}
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>PURCHASE VALUE</Text>
                      <Text style={styles.detailValueGold}>{money(ast.totalCost)}</Text>
                      <Text style={styles.detailSub}>
                        {ast.quantity}x @ {money(ast.cost)}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>EST. BOOK VALUE</Text>
                      <Text style={styles.detailValueDark}>{money(ast.currentValue || ast.totalCost)}</Text>
                      <Text style={styles.detailSub}>{ast.depreciationRateYearly || 10}% yearly dep.</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>LOCATION</Text>
                      <View style={styles.inlineIcon}>
                        <Ionicons name="location-outline" size={13} color={LIGHT.burgundy} />
                        <Text style={styles.detailValueText} numberOfLines={1}>
                          {ast.location}
                        </Text>
                      </View>
                      <Text style={styles.detailSub}>Installed area</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>SUPPLIER / VENDOR</Text>
                      <Text style={styles.detailValueText} numberOfLines={1}>
                        {ast.vendor}
                      </Text>
                      <Text style={styles.detailSub}>
                        {ast.vendorPhone || (ast.invoiceNo ? `Inv #${ast.invoiceNo}` : 'Direct')}
                      </Text>
                    </View>
                  </View>

                  {/* Maintenance Footnote if any */}
                  {ast.maintenanceLogs && ast.maintenanceLogs.length > 0 && (
                    <View style={styles.maintBanner}>
                      <Ionicons name="construct-outline" size={14} color={LIGHT.amber} />
                      <Text style={styles.maintBannerText}>
                        {ast.maintenanceLogs.length} Service Log{ast.maintenanceLogs.length > 1 ? 's' : ''} recorded •
                        Total Repairs: {money(maintTotal)}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => setViewAsset(ast)}
                    >
                      <Ionicons name="document-text-outline" size={14} color={LIGHT.burgundy} />
                      <Text style={styles.actionBtnOutlineText}>Audit Sheet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => setMaintenanceAsset(ast)}
                    >
                      <Ionicons name="build-outline" size={14} color={LIGHT.amber} />
                      <Text style={[styles.actionBtnOutlineText, { color: LIGHT.amber }]}>Log Service</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => openEditModal(ast)}
                    >
                      <Ionicons name="create-outline" size={14} color={LIGHT.textSecondary} />
                      <Text style={[styles.actionBtnOutlineText, { color: LIGHT.textSecondary }]}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDanger}
                      onPress={() => handleDelete(ast)}
                    >
                      <Ionicons name="trash-outline" size={14} color={LIGHT.rose} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* -------------------- ADD / EDIT MODAL -------------------- */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && { width: '95%', maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="cube" size={20} color={LIGHT.burgundy} />
                <Text style={styles.modalTitle}>
                  {editingAsset ? `Edit [${editingAsset.assetCode}]` : 'Register New Capital Asset'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Asset Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset Name / Description *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Commercial 4-Burner Range Cooker"
                  placeholderTextColor={LIGHT.textDim}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Urdu Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Urdu Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. کمرشل چولہا رینج"
                  placeholderTextColor={LIGHT.textDim}
                  value={formUrduName}
                  onChangeText={setFormUrduName}
                />
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                  {ASSET_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.modalChip, formCategory === cat && styles.modalChipActive]}
                      onPress={() => setFormCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          formCategory === cat && styles.modalChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Cost & Qty */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Unit Purchase Cost (PKR) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 250000"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formCost}
                    onChangeText={setFormCost}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Quantity (Units) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formQty}
                    onChangeText={setFormQty}
                  />
                </View>
              </View>

              {/* Vendor & Phone */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Vendor / Supplier Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pak Kitchen Tech Ltd"
                    placeholderTextColor={LIGHT.textDim}
                    value={formVendor}
                    onChangeText={setFormVendor}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Vendor Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 0300-1234567"
                    placeholderTextColor={LIGHT.textDim}
                    value={formVendorPhone}
                    onChangeText={setFormVendorPhone}
                  />
                </View>
              </View>

              {/* Location & Invoice */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Location / Floor Department</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Ground Floor Dining Hall"
                    placeholderTextColor={LIGHT.textDim}
                    value={formLocation}
                    onChangeText={setFormLocation}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Invoice / Bill No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. PKT-8821"
                    placeholderTextColor={LIGHT.textDim}
                    value={formInvoiceNo}
                    onChangeText={setFormInvoiceNo}
                  />
                </View>
              </View>

              {/* Condition & Status */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Physical Condition</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {CONDITIONS.map((c) => (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.smallChip, formCondition === c.key && styles.smallChipActive]}
                        onPress={() => setFormCondition(c.key)}
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            formCondition === c.key && styles.smallChipTextActive,
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Operational Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.smallChip, formStatus === s.key && styles.smallChipActive]}
                        onPress={() => setFormStatus(s.key)}
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            formStatus === s.key && styles.smallChipTextActive,
                          ]}
                        >
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Depreciation & Serial */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Depreciation Rate (%/Year)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formDepreciationRate}
                    onChangeText={setFormDepreciationRate}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Serial / Chassis No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. SN-981249"
                    placeholderTextColor={LIGHT.textDim}
                    value={formSerial}
                    onChangeText={setFormSerial}
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Technical Notes & Specifications</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Warranty terms, power requirements (amps/phases), special maintenance notes..."
                  placeholderTextColor={LIGHT.textDim}
                  multiline
                  value={formNotes}
                  onChangeText={setFormNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveAsset}>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>
                  {editingAsset ? 'Update Asset' : 'Save Capital Asset'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------- LOG MAINTENANCE MODAL -------------------- */}
      <Modal visible={!!maintenanceAsset} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 540 }, isMobile && { width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="construct" size={20} color={LIGHT.amber} />
                <Text style={styles.modalTitle}>
                  Log Maintenance: [{maintenanceAsset?.assetCode}]
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMaintenanceAsset(null)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={{ color: LIGHT.textSecondary, fontSize: 13, marginBottom: 14 }}>
                Record servicing, component replacements, oil change, or technicians fees for{' '}
                <Text style={{ color: LIGHT.burgundy, fontWeight: '700' }}>
                  {maintenanceAsset?.name}
                </Text>
                .
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service / Repair Cost (PKR) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 15000"
                  placeholderTextColor={LIGHT.textDim}
                  keyboardType="numeric"
                  value={maintCost}
                  onChangeText={setMaintCost}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Work Description *</Text>
                <TextInput
                  style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Detail the repair work (e.g., replacement of heating element, descaling, gas refill)..."
                  placeholderTextColor={LIGHT.textDim}
                  multiline
                  value={maintDesc}
                  onChangeText={setMaintDesc}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Technician / Company Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Engr. Asif or Pak Tech Services"
                  placeholderTextColor={LIGHT.textDim}
                  value={maintTech}
                  onChangeText={setMaintTech}
                />
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setMaintAutoExpense(!maintAutoExpense)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={maintAutoExpense ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={LIGHT.burgundy}
                />
                <Text style={styles.checkboxText}>
                  Automatically book this cost as cash expense under "Maintenance & Repair"
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setMaintenanceAsset(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveMaintenance}>
                <Ionicons name="build" size={17} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Save Service Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------- AUDIT SLIP / VIEW MODAL -------------------- */}
      <Modal visible={!!viewAsset} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 640 }, isMobile && { width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="document-text" size={20} color={LIGHT.burgundy} />
                <Text style={styles.modalTitle}>Capital Asset Audit Record</Text>
              </View>
              <TouchableOpacity onPress={() => setViewAsset(null)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            {viewAsset && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Print Sheet Simulation */}
                <View style={styles.sheetPaper}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetRestName}>SULTAN RESTAURANT & RESORT</Text>
                    <Text style={styles.sheetDocTitle}>CAPITAL ASSET REGISTER & AUDIT CERTIFICATE</Text>
                    <Text style={styles.sheetCode}>TAG: {viewAsset.assetCode}</Text>
                  </View>

                  <View style={styles.sheetDivider} />

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Asset Name:</Text>
                    <Text style={styles.sheetValBold}>{viewAsset.name}</Text>
                  </View>

                  {viewAsset.urduName ? (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetKey}>Urdu Name:</Text>
                      <Text style={styles.sheetVal}>{viewAsset.urduName}</Text>
                    </View>
                  ) : null}

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Category:</Text>
                    <Text style={styles.sheetVal}>{viewAsset.category}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Location:</Text>
                    <Text style={styles.sheetVal}>{viewAsset.location}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Supplier / Vendor:</Text>
                    <Text style={styles.sheetVal}>
                      {viewAsset.vendor} {viewAsset.vendorPhone ? `(${viewAsset.vendorPhone})` : ''}
                    </Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Purchase Date:</Text>
                    <Text style={styles.sheetVal}>{formatDay(viewAsset.purchaseDate)}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Unit Cost:</Text>
                    <Text style={styles.sheetVal}>{money(viewAsset.cost)}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Quantity:</Text>
                    <Text style={styles.sheetVal}>{viewAsset.quantity} Unit(s)</Text>
                  </View>

                  <View style={[styles.sheetRow, { backgroundColor: '#FEF3C7', padding: 6, borderRadius: 6 }]}>
                    <Text style={[styles.sheetKey, { color: '#92400E', fontWeight: '800' }]}>TOTAL CAPITAL INVESTED:</Text>
                    <Text style={[styles.sheetValBold, { color: '#92400E' }]}>{money(viewAsset.totalCost)}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Est. Net Book Value:</Text>
                    <Text style={styles.sheetVal}>{money(viewAsset.currentValue || viewAsset.totalCost)}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Condition / Status:</Text>
                    <Text style={styles.sheetVal}>
                      {viewAsset.condition.toUpperCase()} / {viewAsset.status.toUpperCase()}
                    </Text>
                  </View>

                  {viewAsset.serialNumber ? (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetKey}>Serial No:</Text>
                      <Text style={styles.sheetVal}>{viewAsset.serialNumber}</Text>
                    </View>
                  ) : null}

                  {viewAsset.notes ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.sheetKey}>Notes & Specs:</Text>
                      <Text style={[styles.sheetVal, { fontStyle: 'italic', marginTop: 4 }]}>{viewAsset.notes}</Text>
                    </View>
                  ) : null}

                  {/* Maintenance Log Section */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.sheetDocTitle, { textAlign: 'left', marginBottom: 8 }]}>
                      SERVICE & REPAIR HISTORY ({viewAsset.maintenanceLogs?.length || 0})
                    </Text>
                    {(!viewAsset.maintenanceLogs || viewAsset.maintenanceLogs.length === 0) ? (
                      <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                        No repairs logged yet. Asset operating in nominal condition.
                      </Text>
                    ) : (
                      viewAsset.maintenanceLogs.map((log) => (
                        <View key={log.id} style={styles.sheetMaintItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontWeight: '700', fontSize: 13, color: '#111827' }}>
                              {formatDay(log.date)} • {log.performedBy || 'Technician'}
                            </Text>
                            <Text style={{ fontWeight: '700', fontSize: 13, color: '#B45309' }}>
                              {money(log.cost)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>{log.description}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setViewAsset(null)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  alertMsg('Printing', 'Asset record sent to local thermal / document printer.');
                }}
              >
                <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Print Audit Slip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LIGHT.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LIGHT.burgundySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82, 23, 27, 0.15)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LIGHT.ink,
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: LIGHT.burgundySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(82, 23, 27, 0.20)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: LIGHT.burgundy,
    letterSpacing: 0.6,
  },
  addAssetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: LIGHT.burgundy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addAssetBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  container: {
    flex: 1,
    backgroundColor: LIGHT.bg,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: LIGHT.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT.textMuted,
    letterSpacing: 0.5,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  kpiHint: {
    fontSize: 11,
    color: LIGHT.textDim,
    marginTop: 4,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    color: LIGHT.ink,
    fontSize: 14,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: LIGHT.burgundySoft,
    borderColor: LIGHT.burgundy,
  },
  categoryChipText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: LIGHT.burgundy,
    fontWeight: '800',
  },
  statusFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  filterLeadText: {
    fontSize: 12,
    color: LIGHT.textMuted,
    fontWeight: '600',
  },
  statusFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusFilterBtnActive: {
    backgroundColor: LIGHT.burgundy,
    borderColor: LIGHT.burgundy,
  },
  statusFilterText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  assetList: {
    gap: 14,
  },
  assetCard: {
    backgroundColor: LIGHT.cardBg,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeTag: {
    backgroundColor: LIGHT.burgundySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(82, 23, 27, 0.20)',
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: LIGHT.burgundy,
    letterSpacing: 0.5,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  titleSection: {
    marginBottom: 14,
  },
  assetName: {
    fontSize: 17,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  urduName: {
    fontSize: 14,
    color: LIGHT.gold,
    marginTop: 2,
    fontWeight: '600',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    flex: 1,
    minWidth: 130,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LIGHT.textDim,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValueGold: {
    fontSize: 16,
    fontWeight: '800',
    color: LIGHT.gold,
  },
  detailValueDark: {
    fontSize: 16,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  detailValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: LIGHT.ink,
  },
  detailSub: {
    fontSize: 11,
    color: LIGHT.textMuted,
    marginTop: 2,
  },
  inlineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  maintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: LIGHT.amberBorder,
  },
  maintBannerText: {
    fontSize: 11,
    color: LIGHT.amber,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.ink,
  },
  actionBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: LIGHT.roseSoft,
    borderWidth: 1,
    borderColor: LIGHT.roseBorder,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: LIGHT.ink,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: LIGHT.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: 680,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FAFAF9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LIGHT.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: LIGHT.ink,
    fontSize: 14,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  modalChipActive: {
    backgroundColor: LIGHT.burgundySoft,
    borderColor: LIGHT.burgundy,
  },
  modalChipText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: LIGHT.burgundy,
    fontWeight: '800',
  },
  smallChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallChipActive: {
    backgroundColor: LIGHT.burgundySoft,
    borderColor: LIGHT.burgundy,
  },
  smallChipText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: LIGHT.burgundy,
    fontWeight: '800',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkboxText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FAFAF9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalCancelText: {
    color: LIGHT.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT.burgundy,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // Audit Sheet Simulation
  sheetPaper: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetRestName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  sheetDocTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: LIGHT.burgundy,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sheetCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
    marginTop: 4,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sheetKey: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  sheetVal: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  sheetValBold: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '800',
  },
  sheetMaintItem: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
