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
  DamageRecord,
  DamageCategory,
  DamageReason,
  DamageResponsibility,
  DamageAction,
  DamageStatus,
  DAMAGE_CATEGORIES,
  DAMAGE_REASONS,
  DAMAGE_ACTIONS,
  Asset,
} from '../store';
import { money, formatDay, formatTime, startOfDay } from '../utils/format';
import { useRolePermissions } from '../store/roleStore';
import PermissionDeniedScreen from '../components/PermissionDeniedScreen';
import RoyalDropdown from '../components/RoyalDropdown';

const LIGHT = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  burgundy: '#52171B',
  burgundySoft: 'rgba(82, 23, 27, 0.08)',
  gold: '#B48214',
  goldSoft: '#FEF3C7',
  goldBorder: '#FDE68A',
  ink: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  emerald: '#059669',
  emeraldSoft: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  amberBorder: '#FDE68A',
  rose: '#E11D48',
  roseDark: '#BE123C',
  roseSoft: '#FFF1F2',
  roseBorder: '#FECDD3',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  blueBorder: '#BFDBFE',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleBorder: '#DDD6FE',
};

// Quick 1-Tap Breakage Presets for Fast Floor Reporting
const QUICK_PRESETS = [
  { name: 'Water Goblet Glass (350ml)', cat: 'Glassware & Tumblers' as DamageCategory, cost: 420, icon: 'wine-outline' },
  { name: 'Sultan Royal Gold Rim Plate 11"', cat: 'Crockery (Plates & Bowls)' as DamageCategory, cost: 950, icon: 'disc-outline' },
  { name: 'Clay Biryani Handi (1kg)', cat: 'Clayware & Specialty Pots' as DamageCategory, cost: 650, icon: 'restaurant-outline' },
  { name: 'Tea Cup & Saucer Gold Rim', cat: 'Crockery (Plates & Bowls)' as DamageCategory, cost: 400, icon: 'cafe-outline' },
  { name: 'Mint Margarita Stem Glass', cat: 'Glassware & Tumblers' as DamageCategory, cost: 550, icon: 'beer-outline' },
  { name: 'Dessert Serving Bowl 6"', cat: 'Crockery (Plates & Bowls)' as DamageCategory, cost: 480, icon: 'ellipse-outline' },
];

const RESPONSIBILITIES: { key: DamageResponsibility; label: string; icon: string }[] = [
  { key: 'staff', label: 'Service Staff / Waiter', icon: 'person-outline' },
  { key: 'customer', label: 'Guest / Customer', icon: 'people-outline' },
  { key: 'dishwashing', label: 'Dishwashing Pit', icon: 'water-outline' },
  { key: 'wear_and_tear', label: 'Wear & Tear / Thermal Crack', icon: 'flame-outline' },
  { key: 'unknown', label: 'Unattributed / Mystery', icon: 'help-circle-outline' },
];

const STATUS_PILLS: Record<DamageStatus, { label: string; color: string; bg: string; border: string }> = {
  logged: { label: 'Pending Review', color: LIGHT.amber, bg: LIGHT.amberSoft, border: LIGHT.amberBorder },
  approved_writeoff: { label: 'Written Off (Loss)', color: LIGHT.roseDark, bg: LIGHT.roseSoft, border: LIGHT.roseBorder },
  recovered: { label: 'Settled / Recovered', color: LIGHT.emerald, bg: LIGHT.emeraldSoft, border: LIGHT.emeraldBorder },
  repaired: { label: 'Repaired / Restored', color: LIGHT.blue, bg: LIGHT.blueSoft, border: LIGHT.blueBorder },
};

export default function DamageControlScreen({
  backRoute = '/manager/dashboard',
  role = 'manager',
}: {
  backRoute?: string;
  role?: 'admin' | 'manager';
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const { can } = useRolePermissions();

  if (user?.role !== 'admin' && !can('canAccessInventory')) {
    return (
      <PermissionDeniedScreen
        moduleName="Damage & Breakage Control"
        urduModuleName="نقصان اور ٹوٹ پھوٹ کا کنٹرول"
        requiredPermission="canAccessInventory"
        backRoute={backRoute}
      />
    );
  }
  const damageRecords = useOpsStore((s) => s.damageRecords || []);
  const assets = useOpsStore((s) => s.assets || []);
  const logDamageIncident = useOpsStore((s) => s.logDamageIncident);
  const updateDamageRecord = useOpsStore((s) => s.updateDamageRecord);
  const deleteDamageRecord = useOpsStore((s) => s.deleteDamageRecord);
  const resolveDamageRecord = useOpsStore((s) => s.resolveDamageRecord);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'all'>('all');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [resolvingRecord, setResolvingRecord] = useState<DamageRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<DamageRecord | null>(null);

  // Asset Dropdown & Source Selection State (Unified with Capital Assets)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'asset' | 'manual'>('asset');
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  // Form State
  const [formItemName, setFormItemName] = useState('');
  const [formCategory, setFormCategory] = useState<DamageCategory>(DAMAGE_CATEGORIES[0]);
  const [formQty, setFormQty] = useState('1');
  const [formUnitCost, setFormUnitCost] = useState('');
  const [formLocation, setFormLocation] = useState('Main Hall - Table T-01');
  const [formReason, setFormReason] = useState<DamageReason>(DAMAGE_REASONS[0]);
  const [formResponsibleParty, setFormResponsibleParty] = useState<DamageResponsibility>('staff');
  const [formResponsiblePerson, setFormResponsiblePerson] = useState('');
  const [formActionTaken, setFormActionTaken] = useState<DamageAction>(DAMAGE_ACTIONS[0]);
  const [formAmountRecovered, setFormAmountRecovered] = useState('0');
  const [formNotes, setFormNotes] = useState('');

  // Settle Form State
  const [settleAction, setSettleAction] = useState<DamageAction>(DAMAGE_ACTIONS[0]);
  const [settleStatus, setSettleStatus] = useState<DamageStatus>('approved_writeoff');
  const [settleAmount, setSettleAmount] = useState('0');
  const [settleNotes, setSettleNotes] = useState('');

  // Selected Asset Details & Filtered List for Dropdown
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  const filteredAssets = useMemo(() => {
    if (!assetSearchQuery.trim()) return assets;
    const q = assetSearchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.assetCode.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.location && a.location.toLowerCase().includes(q))
    );
  }, [assets, assetSearchQuery]);

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    setSelectedAssetCode(asset.assetCode);
    setFormItemName(asset.name);
    // Auto-select category if matching
    if (DAMAGE_CATEGORIES.includes(asset.category as any)) {
      setFormCategory(asset.category as DamageCategory);
    }
    const unitPrice =
      asset.cost ||
      (asset.totalCost && asset.quantity ? Math.round(asset.totalCost / asset.quantity) : 0);
    setFormUnitCost(String(unitPrice || 0));
    if (asset.location) {
      setFormLocation(asset.location);
    }
    setIsAssetDropdownOpen(false);
  };

  const handleClearAssetLink = () => {
    setSelectedAssetId(null);
    setSelectedAssetCode(null);
    setFormItemName('');
    setFormUnitCost('');
  };

  // Analytics & KPIs
  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfDay(now);
    const weekStart = todayStart - 6 * 86400000;

    let totalLoss = 0;
    let netLoss = 0;
    let totalRecovered = 0;
    let todayLoss = 0;
    let todayItems = 0;
    const catLossMap: Record<string, number> = {};

    damageRecords.forEach((d) => {
      totalLoss += d.totalLoss || 0;
      netLoss += d.netLoss !== undefined ? d.netLoss : d.totalLoss;
      totalRecovered += d.amountRecovered || 0;

      if (d.incidentDate >= todayStart) {
        todayLoss += d.totalLoss || 0;
        todayItems += d.quantity || 1;
      }

      catLossMap[d.category] = (catLossMap[d.category] || 0) + (d.totalLoss || 0);
    });

    // Find top fragile category
    let topCat = 'None';
    let maxCatLoss = 0;
    Object.entries(catLossMap).forEach(([cat, val]) => {
      if (val > maxCatLoss) {
        maxCatLoss = val;
        topCat = cat;
      }
    });

    return {
      totalLoss,
      netLoss,
      totalRecovered,
      todayLoss,
      todayItems,
      topCategory: topCat,
      totalIncidents: damageRecords.length,
    };
  }, [damageRecords]);

  // Filtered List
  const filteredRecords = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfDay(now);
    const weekStart = todayStart - 6 * 86400000;

    return damageRecords.filter((d) => {
      if (selectedCategory !== 'All' && d.category !== selectedCategory) return false;
      if (selectedStatus !== 'All' && d.status !== selectedStatus) return false;
      if (periodFilter === 'today' && d.incidentDate < todayStart) return false;
      if (periodFilter === 'week' && d.incidentDate < weekStart) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.itemName.toLowerCase().includes(q) ||
        d.incidentCode.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.reportedBy.toLowerCase().includes(q) ||
        (d.responsiblePersonName && d.responsiblePersonName.toLowerCase().includes(q)) ||
        d.reason.toLowerCase().includes(q)
      );
    });
  }, [damageRecords, selectedCategory, selectedStatus, periodFilter, search]);

  const openReportModal = (preset?: typeof QUICK_PRESETS[0]) => {
    setSelectedAssetId(null);
    setSelectedAssetCode(null);
    setEntryMode('asset');
    setIsAssetDropdownOpen(false);
    setAssetSearchQuery('');
    if (preset) {
      setFormItemName(preset.name);
      setFormCategory(preset.cat);
      setFormQty('1');
      setFormUnitCost(String(preset.cost));
    } else {
      setFormItemName('');
      setFormCategory(DAMAGE_CATEGORIES[0]);
      setFormQty('1');
      setFormUnitCost('');
    }
    setFormLocation('Main Hall');
    setFormReason(DAMAGE_REASONS[0]);
    setFormResponsibleParty('staff');
    setFormResponsiblePerson(user?.name || '');
    setFormActionTaken(DAMAGE_ACTIONS[0]);
    setFormAmountRecovered('0');
    setFormNotes('');
    setIsReportModalOpen(true);
  };

  const handleSaveReport = () => {
    if (!formItemName.trim()) {
      alertMsg('Missing Information', 'Please select or enter the damaged item name.');
      return;
    }
    const unitCost = parseFloat(formUnitCost);
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      alertMsg('Invalid Cost', 'Please enter a valid replacement unit cost.');
      return;
    }
    const qty = parseInt(formQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      alertMsg('Invalid Quantity', 'Please enter quantity broken.');
      return;
    }
    const recovered = parseFloat(formAmountRecovered) || 0;
    const totalLoss = unitCost * qty;

    logDamageIncident({
      incidentCode: `DMG-${Date.now().toString().slice(-4)}`,
      assetId: selectedAssetId || undefined,
      assetCode: selectedAssetCode || undefined,
      itemName: formItemName.trim(),
      category: formCategory,
      quantity: qty,
      unitCost,
      totalLoss,
      incidentDate: Date.now(),
      location: formLocation.trim() || 'Floor Service',
      reason: formReason,
      reportedBy: user?.name || 'Manager on Duty',
      responsibleParty: formResponsibleParty,
      responsiblePersonName: formResponsiblePerson.trim() || undefined,
      actionTaken: formActionTaken,
      status: recovered >= totalLoss ? 'recovered' : 'approved_writeoff',
      amountRecovered: recovered,
      netLoss: Math.max(0, totalLoss - recovered),
      notes: formNotes.trim() || undefined,
    });

    alertMsg(
      'Breakage Recorded',
      `Damage of ${money(totalLoss)} for ${qty}x ${formItemName} has been logged in damage control.`
    );
    setIsReportModalOpen(false);
  };

  const openResolveModal = (record: DamageRecord) => {
    setResolvingRecord(record);
    setSettleAction(record.actionTaken);
    setSettleStatus(record.status);
    setSettleAmount(String(record.amountRecovered || 0));
    setSettleNotes(record.notes || '');
  };

  const handleSaveResolution = () => {
    if (!resolvingRecord) return;
    const recovered = parseFloat(settleAmount) || 0;

    resolveDamageRecord(resolvingRecord.id, {
      actionTaken: settleAction,
      status: settleStatus,
      amountRecovered: recovered,
      notes: settleNotes.trim() || undefined,
    });

    alertMsg(
      'Incident Resolved',
      `[${resolvingRecord.incidentCode}] settled as "${settleAction}". Net loss updated.`
    );
    setResolvingRecord(null);
  };

  const handleDelete = (record: DamageRecord) => {
    const confirm = () => {
      deleteDamageRecord(record.id);
      alertMsg('Incident Deleted', `[${record.incidentCode}] record removed.`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete breakage incident [${record.incidentCode}] (${record.itemName})?`)) {
        confirm();
      }
    } else {
      Alert.alert('Confirm Delete', `Delete incident [${record.incidentCode}]?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
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
            {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
            onPress={() => router.push(backRoute as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={LIGHT.rose} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="shield-outline" size={20} color={LIGHT.rose} />
              <Text style={styles.headerTitle}>Damage Control & Breakages</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>LOSS MITIGATION</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              Crockery, glassware, utensils, and equipment breakage accountability ledger
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.reportBtn}
          {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
          onPress={() => openReportModal()}
          activeOpacity={0.85}
        >
          <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
          <Text style={styles.reportBtnText}>+ Report Breakage</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Light KPI Deck */}
        <View style={styles.kpiGrid}>
          {/* Total Loss */}
          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.kpiCard,
              {
                backgroundColor: 'rgba(254, 242, 242, 0.95)',
                borderColor: 'rgba(244, 63, 94, 0.45)',
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#BE123C' }]}>TOTAL BREAKAGE LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash-bin-outline" size={18} color="#E11D48" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#BE123C' }]}>{money(stats.totalLoss)}</Text>
            <Text style={[styles.kpiHint, { color: '#9F1239' }]}>{stats.totalIncidents} total incidents recorded</Text>
          </View>

          {/* Today's Breakage */}
          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.kpiCard,
              {
                backgroundColor: 'rgba(254, 243, 199, 0.95)',
                borderColor: 'rgba(245, 158, 11, 0.45)',
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#B45309' }]}>TODAY'S LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FDE68A' }]}>
                <Ionicons name="today-outline" size={18} color="#D97706" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>{money(stats.todayLoss)}</Text>
            <Text style={[styles.kpiHint, { color: '#92400E' }]}>
              {stats.todayItems} item{stats.todayItems === 1 ? '' : 's'} broken today
            </Text>
          </View>

          {/* Net Unrecovered Loss */}
          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.kpiCard,
              {
                backgroundColor: 'rgba(254, 252, 232, 0.95)',
                borderColor: 'rgba(212, 175, 55, 0.55)',
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#92400E' }]}>NET RESTAURANT LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEF08A' }]}>
                <Ionicons name="wallet-outline" size={18} color="#B48214" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#92400E' }]}>{money(stats.netLoss)}</Text>
            <Text style={[styles.kpiHint, { color: '#78350F' }]}>Recovered: {money(stats.totalRecovered)}</Text>
          </View>

          {/* Most Fragile Category */}
          <View
            {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
            style={[
              styles.kpiCard,
              {
                backgroundColor: 'rgba(250, 245, 255, 0.95)',
                borderColor: 'rgba(168, 85, 247, 0.45)',
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#6B21A8' }]}>TOP BREAKAGE HOTSPOT</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="wine-outline" size={18} color="#7C3AED" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#6B21A8', fontSize: 16 }]} numberOfLines={1}>
              {stats.topCategory}
            </Text>
            <Text style={[styles.kpiHint, { color: '#581C87' }]}>Highest financial loss volume</Text>
          </View>
        </View>

        {/* Quick Presets Section */}
        <View style={styles.quickPresetSection}>
          <RoyalDropdown
            label="Quick 1-Tap Breakage Reporting (Auto-fills incident form)"
            placeholder="Select common breakage preset (e.g. Water Glass, Karahi Bowl, Dinner Plate)..."
            options={QUICK_PRESETS.map((p) => ({
              label: `${p.name} (${money(p.cost)} / unit)`,
              value: p.name,
              icon: p.icon as any,
              badge: money(p.cost),
              sublabel: p.cat,
            }))}
            value=""
            onSelect={(name) => {
              const found = QUICK_PRESETS.find((p) => p.name === name);
              if (found) openReportModal(found);
            }}
            icon="flash-outline"
            searchable
          />
        </View>

        {/* Search & Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={LIGHT.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by item name, incident code, location, staff name..."
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

          {/* Time Period Filter Chips */}
          <View style={styles.periodRow}>
            {(['all', 'today', 'week'] as const).map((p) => {
              const label = p === 'all' ? 'All Incidents' : p === 'today' ? "Today's Incidents" : 'Past 7 Days';
              const active = periodFilter === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  onPress={() => setPeriodFilter(p)}
                >
                  <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category & Status Dropdown Filters */}
          <View style={[styles.filterDropdownRow, isMobile && { flexDirection: 'column' }]}>
            <RoyalDropdown
              style={{ flex: 1 }}
              label="Filter by Breakage Category"
              icon="funnel-outline"
              placeholder="All Categories"
              options={[
                { label: `All Categories (${damageRecords.length})`, value: 'All' },
                ...DAMAGE_CATEGORIES.map((cat) => ({
                  label: `${cat} (${damageRecords.filter((d) => d.category === cat).length})`,
                  value: cat,
                })),
              ]}
              value={selectedCategory}
              onSelect={(val) => setSelectedCategory(val)}
              searchable
            />
            <RoyalDropdown
              style={{ flex: isMobile ? 1 : 0.6 }}
              label="Filter by Status"
              icon="shield-checkmark-outline"
              placeholder="All Statuses"
              options={[
                { label: `All Statuses (${damageRecords.length})`, value: 'All' },
                ...Object.entries(STATUS_PILLS).map(([key, pill]) => ({
                  label: `${pill.label} (${damageRecords.filter((d) => d.status === key).length})`,
                  value: key,
                })),
              ]}
              value={selectedStatus}
              onSelect={(val) => setSelectedStatus(val)}
            />
          </View>
        </View>

        {/* Damage Records List */}
        <View style={styles.recordList}>
          {filteredRecords.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={48} color={LIGHT.emerald} />
              <Text style={styles.emptyTitle}>Zero Breakage Incidents</Text>
              <Text style={styles.emptySub}>
                No damage reports found matching the selected filter criteria.
              </Text>
            </View>
          ) : (
            filteredRecords.map((rec) => {
              const statusPill = STATUS_PILLS[rec.status] || STATUS_PILLS.logged;
              const resp = RESPONSIBILITIES.find((r) => r.key === rec.responsibleParty) || RESPONSIBILITIES[0];

              return (
                <View key={rec.id} style={styles.recordCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.codeTag}>
                        <Text style={styles.codeTagText}>{rec.incidentCode}</Text>
                      </View>
                      {rec.assetCode ? (
                        <View style={[styles.codeTag, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                          <Ionicons name="cube-outline" size={11} color="#B45309" style={{ marginRight: 3 }} />
                          <Text style={[styles.codeTagText, { color: '#B45309', fontWeight: '800' }]}>
                            {rec.assetCode}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{rec.category}</Text>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      <View style={[styles.pillBadge, { backgroundColor: statusPill.bg, borderColor: statusPill.border }]}>
                        <Text style={[styles.pillBadgeText, { color: statusPill.color }]}>
                          {statusPill.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Title & Loss Highlight */}
                  <View style={styles.titleRowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>
                        {rec.quantity}x {rec.itemName}
                      </Text>
                      <Text style={styles.incidentDate}>
                        Reported on {formatDay(rec.incidentDate)} at {formatTime(rec.incidentDate)} by{' '}
                        <Text style={{ color: LIGHT.ink, fontWeight: '700' }}>{rec.reportedBy}</Text>
                      </Text>
                    </View>

                    <View style={styles.lossBox}>
                      <Text style={styles.lossLabel}>TOTAL LOSS</Text>
                      <Text style={styles.lossValue}>{money(rec.totalLoss)}</Text>
                      {rec.amountRecovered > 0 ? (
                        <Text style={styles.lossRecovered}>
                          Rec: {money(rec.amountRecovered)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Operational Details Row */}
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>LOCATION</Text>
                      <View style={styles.inlineIcon}>
                        <Ionicons name="location-outline" size={13} color={LIGHT.rose} />
                        <Text style={styles.detailValue} numberOfLines={1}>
                          {rec.location}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>PRIMARY REASON</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {rec.reason}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>RESPONSIBILITY</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {rec.responsiblePersonName
                          ? `${rec.responsiblePersonName} (${resp.label})`
                          : resp.label}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>SETTLEMENT ACTION</Text>
                      <Text style={[styles.detailValue, { color: LIGHT.burgundy }]} numberOfLines={1}>
                        {rec.actionTaken}
                      </Text>
                    </View>
                  </View>

                  {/* Notes if any */}
                  {rec.notes ? (
                    <View style={styles.notesBox}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={LIGHT.textMuted} />
                      <Text style={styles.notesText}>{rec.notes}</Text>
                    </View>
                  ) : null}

                  {/* Card Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => setViewRecord(rec)}
                    >
                      <Ionicons name="receipt-outline" size={14} color={LIGHT.ink} />
                      <Text style={styles.actionBtnOutlineText}>Breakage Slip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => openResolveModal(rec)}
                    >
                      <Ionicons name="checkbox-outline" size={14} color={LIGHT.emerald} />
                      <Text style={[styles.actionBtnOutlineText, { color: LIGHT.emerald }]}>
                        Settle / Resolve
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDanger}
                      onPress={() => handleDelete(rec)}
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

      {/* -------------------- REPORT BREAKAGE MODAL -------------------- */}
      <Modal visible={isReportModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && { width: '95%', maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="alert-circle" size={20} color={LIGHT.rose} />
                <Text style={styles.modalTitle}>Report Breakage & Damage</Text>
              </View>
              <TouchableOpacity onPress={() => setIsReportModalOpen(false)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Mode Switcher: Choose from Registered Assets vs Custom Item */}
              <View style={styles.entryModeContainer}>
                <TouchableOpacity
                  style={[
                    styles.entryModeTab,
                    entryMode === 'asset' && styles.entryModeTabActive,
                  ]}
                  onPress={() => {
                    setEntryMode('asset');
                    setIsAssetDropdownOpen(true);
                  }}
                >
                  <Ionicons
                    name="cube"
                    size={15}
                    color={entryMode === 'asset' ? LIGHT.burgundy : LIGHT.textMuted}
                  />
                  <Text
                    style={[
                      styles.entryModeTabText,
                      entryMode === 'asset' && styles.entryModeTabTextActive,
                    ]}
                  >
                    Select Capital Asset
                  </Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Synced</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.entryModeTab,
                    entryMode === 'manual' && styles.entryModeTabActive,
                  ]}
                  onPress={() => {
                    setEntryMode('manual');
                    handleClearAssetLink();
                  }}
                >
                  <Ionicons
                    name="create-outline"
                    size={15}
                    color={entryMode === 'manual' ? LIGHT.burgundy : LIGHT.textMuted}
                  />
                  <Text
                    style={[
                      styles.entryModeTabText,
                      entryMode === 'manual' && styles.entryModeTabTextActive,
                    ]}
                  >
                    Custom / Floor Item
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Asset Dropdown Selector */}
              {entryMode === 'asset' && (
                <View style={styles.assetSelectorWrapper}>
                  <Text style={styles.inputLabel}>
                    Choose Damaged Asset from Capex Inventory *
                  </Text>

                  {/* Selected Asset Banner */}
                  {selectedAsset ? (
                    <View style={styles.selectedAssetBanner}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View style={styles.selectedAssetCodeChip}>
                            <Ionicons name="cube-outline" size={11} color="#B45309" />
                            <Text style={styles.selectedAssetCodeText}>{selectedAsset.assetCode}</Text>
                          </View>
                          <Text style={styles.selectedAssetCategoryText}>• {selectedAsset.category}</Text>
                        </View>
                        <Text style={styles.selectedAssetNameText}>{selectedAsset.name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          <Text style={styles.selectedAssetMetaText}>
                            Stock: <Text style={{ fontWeight: '700', color: LIGHT.ink }}>{selectedAsset.quantity || 1} units</Text>
                          </Text>
                          <Text style={styles.selectedAssetMetaText}>
                            Unit Cost: <Text style={{ fontWeight: '700', color: LIGHT.ink }}>{money(selectedAsset.cost)}</Text>
                          </Text>
                          {selectedAsset.location ? (
                            <Text style={styles.selectedAssetMetaText}>
                              Location: <Text style={{ fontWeight: '700', color: LIGHT.ink }}>{selectedAsset.location}</Text>
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <TouchableOpacity
                          style={styles.changeAssetBtn}
                          onPress={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
                        >
                          <Ionicons name="swap-horizontal" size={12} color={LIGHT.burgundy} />
                          <Text style={styles.changeAssetBtnText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.clearAssetBtn}
                          onPress={handleClearAssetLink}
                        >
                          <Ionicons name="close" size={12} color={LIGHT.rose} />
                          <Text style={styles.clearAssetBtnText}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.assetDropdownTrigger}
                      onPress={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.assetDropdownIconBox}>
                          <Ionicons name="cube-outline" size={16} color={LIGHT.burgundy} />
                        </View>
                        <Text style={styles.assetDropdownTriggerPlaceholder} numberOfLines={1}>
                          Tap to select registered asset (Crockery, Glassware, Machinery, etc.)...
                        </Text>
                      </View>
                      <Ionicons
                        name={isAssetDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={LIGHT.textSecondary}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Dropdown Popover List */}
                  {isAssetDropdownOpen && (
                    <View style={styles.assetDropdownListCard}>
                      <View style={styles.assetDropdownSearchRow}>
                        <Ionicons name="search" size={15} color={LIGHT.textMuted} />
                        <TextInput
                          style={styles.assetDropdownSearchInput}
                          placeholder="Search assets by code, name, category, location..."
                          placeholderTextColor={LIGHT.textDim}
                          value={assetSearchQuery}
                          onChangeText={setAssetSearchQuery}
                          autoFocus
                        />
                        {assetSearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setAssetSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={LIGHT.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <ScrollView
                        style={styles.assetDropdownScroll}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {filteredAssets.length === 0 ? (
                          <View style={styles.assetDropdownEmpty}>
                            <Ionicons name="alert-circle-outline" size={24} color={LIGHT.textDim} />
                            <Text style={styles.assetDropdownEmptyText}>No matching assets found.</Text>
                          </View>
                        ) : (
                          filteredAssets.map((asset) => {
                            const isSelected = selectedAssetId === asset.id;
                            const unitPrice =
                              asset.cost ||
                              (asset.totalCost && asset.quantity
                                ? Math.round(asset.totalCost / asset.quantity)
                                : 0);

                            return (
                              <TouchableOpacity
                                key={asset.id}
                                style={[
                                  styles.assetDropDownItem,
                                  isSelected && styles.assetDropDownItemActive,
                                ]}
                                onPress={() => handleSelectAsset(asset)}
                              >
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={styles.codeTagSmall}>
                                      <Text style={styles.codeTagSmallText}>{asset.assetCode}</Text>
                                    </View>
                                    <Text style={styles.assetItemCategory}>{asset.category}</Text>
                                  </View>
                                  <Text style={styles.assetItemName} numberOfLines={1}>
                                    {asset.name}
                                  </Text>
                                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                                    <Text style={styles.assetItemSub}>
                                      Cost: <Text style={{ fontWeight: '700', color: LIGHT.ink }}>{money(unitPrice)}</Text>
                                    </Text>
                                    <Text style={styles.assetItemSub}>
                                      Stock: <Text style={{ fontWeight: '700', color: LIGHT.emerald }}>{asset.quantity || 1} pcs</Text>
                                    </Text>
                                    {asset.location ? (
                                      <Text style={styles.assetItemSub} numberOfLines={1}>
                                        Loc: {asset.location}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                                <View style={styles.selectAssetIconBox}>
                                  <Ionicons
                                    name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                                    size={20}
                                    color={isSelected ? LIGHT.emerald : LIGHT.gold}
                                  />
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Item Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {entryMode === 'asset' ? 'Item Name (Auto-filled from Asset)' : 'Broken Item Name *'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sultan Royal Gold Rim Dinner Plate 11 inch"
                  placeholderTextColor={LIGHT.textDim}
                  value={formItemName}
                  onChangeText={setFormItemName}
                />
              </View>

              {/* Category Dropdown Selector */}
              <RoyalDropdown
                label="Item Category"
                required
                icon="pricetag-outline"
                placeholder="Select breakage category..."
                options={DAMAGE_CATEGORIES}
                value={formCategory}
                onSelect={(cat) => setFormCategory(cat as DamageCategory)}
                searchable
              />

              {/* Qty & Unit Cost */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Quantity Broken *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formQty}
                    onChangeText={setFormQty}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Unit Replacement Cost (PKR) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 850"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formUnitCost}
                    onChangeText={setFormUnitCost}
                  />
                </View>
              </View>

              {/* Location & Reason */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Incident Location *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Table T-04 / Dishwashing Pit"
                    placeholderTextColor={LIGHT.textDim}
                    value={formLocation}
                    onChangeText={setFormLocation}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <RoyalDropdown
                    label="Primary Reason"
                    required
                    icon="help-circle-outline"
                    placeholder="Select primary reason..."
                    options={DAMAGE_REASONS}
                    value={formReason}
                    onSelect={(r) => setFormReason(r as DamageReason)}
                    searchable
                  />
                </View>
              </View>

              {/* Responsibility */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <RoyalDropdown
                    label="Attributed Responsibility"
                    icon="person-outline"
                    placeholder="Select responsibility..."
                    options={RESPONSIBILITIES.map((resp) => ({
                      label: resp.label,
                      value: resp.key,
                    }))}
                    value={formResponsibleParty}
                    onSelect={(party) => setFormResponsibleParty(party as DamageResponsibility)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Responsible Person / Table No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Waiter Tariq / Table #5"
                    placeholderTextColor={LIGHT.textDim}
                    value={formResponsiblePerson}
                    onChangeText={setFormResponsiblePerson}
                  />
                </View>
              </View>

              {/* Action Taken & Amount Recovered */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <RoyalDropdown
                    label="Initial Settlement Action"
                    icon="receipt-outline"
                    placeholder="Select action..."
                    options={DAMAGE_ACTIONS}
                    value={formActionTaken}
                    onSelect={(act) => setFormActionTaken(act as DamageAction)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Amount Recovered (PKR)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={LIGHT.textDim}
                    keyboardType="numeric"
                    value={formAmountRecovered}
                    onChangeText={setFormAmountRecovered}
                  />
                </View>
              </View>

              {/* Incident Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Incident Notes / Circumstances</Text>
                <TextInput
                  style={[styles.input, { height: 65, textAlignVertical: 'top' }]}
                  placeholder="Explain how the breakage occurred and any immediate precautions taken..."
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
                onPress={() => setIsReportModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveReport}>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Record Breakage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------- SETTLE / RESOLVE MODAL -------------------- */}
      <Modal visible={!!resolvingRecord} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 540 }, isMobile && { width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkbox" size={20} color={LIGHT.emerald} />
                <Text style={styles.modalTitle}>
                  Settle Incident [{resolvingRecord?.incidentCode}]
                </Text>
              </View>
              <TouchableOpacity onPress={() => setResolvingRecord(null)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={{ color: LIGHT.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Settle loss for{' '}
                <Text style={{ color: LIGHT.ink, fontWeight: '700' }}>
                  {resolvingRecord?.quantity}x {resolvingRecord?.itemName}
                </Text>{' '}
                (Total Loss: {money(resolvingRecord?.totalLoss || 0)}).
              </Text>

              <RoyalDropdown
                label="Resolution Action"
                required
                icon="receipt-outline"
                placeholder="Select resolution action..."
                options={DAMAGE_ACTIONS}
                value={settleAction}
                onSelect={(act) => setSettleAction(act as DamageAction)}
              />

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount Recovered (PKR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={LIGHT.textDim}
                  keyboardType="numeric"
                  value={settleAmount}
                  onChangeText={setSettleAmount}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Resolution Notes</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Deducted from waiter's monthly salary / waived off / replaced..."
                  placeholderTextColor={LIGHT.textDim}
                  multiline
                  value={settleNotes}
                  onChangeText={setSettleNotes}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setResolvingRecord(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveResolution}>
                <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Confirm Settlement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------- BREAKAGE AUDIT SLIP MODAL -------------------- */}
      <Modal visible={!!viewRecord} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 520 }, isMobile && { width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="receipt" size={20} color={LIGHT.ink} />
                <Text style={styles.modalTitle}>Breakage Incident Slip</Text>
              </View>
              <TouchableOpacity onPress={() => setViewRecord(null)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            {viewRecord && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.sheetPaper}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetRestName}>KANAF CAFE & BAKERY</Text>
                    <Text style={styles.sheetDocTitle}>BREAKAGE & DAMAGE INCIDENT REPORT</Text>
                    <Text style={styles.sheetCode}>INCIDENT ID: {viewRecord.incidentCode}</Text>
                  </View>

                  <View style={styles.sheetDivider} />

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Incident Date & Time:</Text>
                    <Text style={styles.sheetVal}>
                      {formatDay(viewRecord.incidentDate)} {formatTime(viewRecord.incidentDate)}
                    </Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Damaged Item:</Text>
                    <Text style={styles.sheetValBold}>{viewRecord.itemName}</Text>
                  </View>

                  {viewRecord.assetCode ? (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetKey}>Linked Asset Code:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="cube-outline" size={13} color="#B45309" />
                        <Text style={[styles.sheetValBold, { color: '#B45309' }]}>
                          {viewRecord.assetCode} (Capital Capex Asset)
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Category:</Text>
                    <Text style={styles.sheetVal}>{viewRecord.category}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Quantity Broken:</Text>
                    <Text style={styles.sheetValBold}>{viewRecord.quantity} Unit(s)</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Unit Replacement Cost:</Text>
                    <Text style={styles.sheetVal}>{money(viewRecord.unitCost)}</Text>
                  </View>

                  <View style={[styles.sheetRow, { backgroundColor: '#FEE2E2', padding: 6, borderRadius: 6 }]}>
                    <Text style={[styles.sheetKey, { color: '#B91C1C', fontWeight: '800' }]}>
                      TOTAL FINANCIAL LOSS:
                    </Text>
                    <Text style={[styles.sheetValBold, { color: '#B91C1C' }]}>
                      {money(viewRecord.totalLoss)}
                    </Text>
                  </View>

                  {viewRecord.amountRecovered > 0 ? (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetKey}>Amount Recovered:</Text>
                      <Text style={[styles.sheetVal, { color: '#15803D', fontWeight: '700' }]}>
                        {money(viewRecord.amountRecovered)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Net Restaurant Loss:</Text>
                    <Text style={styles.sheetValBold}>{money(viewRecord.netLoss)}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Location / Floor:</Text>
                    <Text style={styles.sheetVal}>{viewRecord.location}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Reported By:</Text>
                    <Text style={styles.sheetVal}>{viewRecord.reportedBy}</Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Responsible Staff / Guest:</Text>
                    <Text style={styles.sheetVal}>
                      {viewRecord.responsiblePersonName || 'General Service Team'}
                    </Text>
                  </View>

                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetKey}>Settlement Action:</Text>
                    <Text style={[styles.sheetValBold, { color: LIGHT.burgundy }]}>
                      {viewRecord.actionTaken}
                    </Text>
                  </View>

                  {viewRecord.notes ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.sheetKey}>Incident Description:</Text>
                      <Text style={[styles.sheetVal, { fontStyle: 'italic', marginTop: 4 }]}>
                        {viewRecord.notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 120, height: 1, backgroundColor: '#9CA3AF', marginBottom: 4 }} />
                      <Text style={{ fontSize: 10, color: '#6B7280' }}>Staff Signature</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 120, height: 1, backgroundColor: '#9CA3AF', marginBottom: 4 }} />
                      <Text style={{ fontSize: 10, color: '#6B7280' }}>Manager Signature</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setViewRecord(null)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  alertMsg('Printing', 'Breakage slip sent to POS thermal printer.');
                }}
              >
                <Ionicons name="print-outline" size={17} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Print Slip</Text>
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
    backgroundColor: LIGHT.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LIGHT.roseBorder,
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
  alertBadge: {
    backgroundColor: LIGHT.roseSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LIGHT.roseBorder,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: LIGHT.rose,
    letterSpacing: 0.6,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT.rose,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: LIGHT.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  reportBtnText: {
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
  // Quick Presets
  quickPresetSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  quickPresetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  quickPresetTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: LIGHT.rose,
    letterSpacing: 0.7,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
  },
  presetIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LIGHT.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.ink,
    maxWidth: 160,
  },
  presetCost: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT.rose,
    marginTop: 1,
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
    marginBottom: 10,
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
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodChipActive: {
    backgroundColor: LIGHT.rose,
    borderColor: LIGHT.rose,
  },
  periodChipText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterDropdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  recordList: {
    gap: 14,
  },
  recordCard: {
    backgroundColor: LIGHT.cardBg,
    borderRadius: 14,
    padding: 16,
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
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeTag: {
    backgroundColor: LIGHT.roseSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LIGHT.roseBorder,
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: LIGHT.rose,
    letterSpacing: 0.5,
  },
  categoryBadge: {
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
  cardHeaderRight: {},
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  titleRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  incidentDate: {
    fontSize: 11,
    color: LIGHT.textMuted,
    marginTop: 3,
  },
  lossBox: {
    alignItems: 'flex-end',
  },
  lossLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: LIGHT.textDim,
    letterSpacing: 0.5,
  },
  lossValue: {
    fontSize: 17,
    fontWeight: '900',
    color: LIGHT.rose,
  },
  lossRecovered: {
    fontSize: 10,
    color: LIGHT.emerald,
    fontWeight: '700',
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    flex: 1,
    minWidth: 120,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LIGHT.textDim,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT.ink,
  },
  inlineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
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
    width: 660,
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
    backgroundColor: LIGHT.roseSoft,
    borderColor: LIGHT.rose,
  },
  modalChipText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: LIGHT.rose,
    fontWeight: '800',
  },
  smallChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
    marginBottom: 4,
  },
  smallChipActive: {
    backgroundColor: LIGHT.roseSoft,
    borderColor: LIGHT.rose,
  },
  smallChipText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: LIGHT.rose,
    fontWeight: '800',
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
    backgroundColor: LIGHT.rose,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // Audit Sheet
  sheetPaper: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 8,
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
    color: LIGHT.rose,
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
  // Asset Dropdown & Dual Entry Mode
  entryModeContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 8,
    marginBottom: 14,
  },
  entryModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  entryModeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  entryModeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT.textMuted,
  },
  entryModeTabTextActive: {
    color: LIGHT.burgundy,
    fontWeight: '800',
  },
  recommendedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  assetSelectorWrapper: {
    marginBottom: 14,
  },
  selectedAssetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(180, 130, 20, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(180, 130, 20, 0.4)',
    borderRadius: 8,
    padding: 12,
  },
  selectedAssetCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  selectedAssetCodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  selectedAssetCategoryText: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  selectedAssetNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  selectedAssetMetaText: {
    fontSize: 11,
    color: LIGHT.textMuted,
  },
  changeAssetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LIGHT.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  changeAssetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT.burgundy,
  },
  clearAssetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearAssetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT.rose,
  },
  assetDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: LIGHT.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assetDropdownIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(180, 130, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetDropdownTriggerPlaceholder: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  assetDropdownListCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  assetDropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  assetDropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: LIGHT.ink,
    paddingVertical: 2,
  },
  assetDropdownScroll: {
    maxHeight: 220,
  },
  assetDropdownEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  assetDropdownEmptyText: {
    fontSize: 12,
    color: LIGHT.textDim,
  },
  assetDropDownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  assetDropDownItemActive: {
    backgroundColor: '#FEF3C7',
  },
  codeTagSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  codeTagSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  assetItemCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: LIGHT.textMuted,
  },
  assetItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.ink,
    marginTop: 2,
  },
  assetItemSub: {
    fontSize: 10,
    color: LIGHT.textSecondary,
  },
  selectAssetIconBox: {
    marginLeft: 10,
  },
});
