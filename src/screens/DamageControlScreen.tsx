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
} from '../store';
import { money, formatDay, formatTime, startOfDay } from '../utils/format';
import { useRolePermissions } from '../store/roleStore';
import PermissionDeniedScreen from '../components/PermissionDeniedScreen';

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
      alertMsg('Missing Information', 'Please enter the damaged item name.');
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

        <TouchableOpacity style={styles.reportBtn} onPress={() => openReportModal()} activeOpacity={0.85}>
          <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
          <Text style={styles.reportBtnText}>+ Report Breakage</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Light KPI Deck */}
        <View style={styles.kpiGrid}>
          {/* Total Loss */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.roseBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOTAL BREAKAGE LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.roseSoft }]}>
                <Ionicons name="trash-bin-outline" size={18} color={LIGHT.rose} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.rose }]}>{money(stats.totalLoss)}</Text>
            <Text style={styles.kpiHint}>{stats.totalIncidents} total incidents recorded</Text>
          </View>

          {/* Today's Breakage */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.amberBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TODAY'S LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.amberSoft }]}>
                <Ionicons name="today-outline" size={18} color={LIGHT.amber} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.amber }]}>{money(stats.todayLoss)}</Text>
            <Text style={styles.kpiHint}>
              {stats.todayItems} item{stats.todayItems === 1 ? '' : 's'} broken today
            </Text>
          </View>

          {/* Net Unrecovered Loss */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.goldBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>NET RESTAURANT LOSS</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.goldSoft }]}>
                <Ionicons name="wallet-outline" size={18} color={LIGHT.gold} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.gold }]}>{money(stats.netLoss)}</Text>
            <Text style={styles.kpiHint}>Recovered: {money(stats.totalRecovered)}</Text>
          </View>

          {/* Most Fragile Category */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.purpleBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOP BREAKAGE HOTSPOT</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: LIGHT.purpleSoft }]}>
                <Ionicons name="wine-outline" size={18} color={LIGHT.purple} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.purple, fontSize: 16 }]} numberOfLines={1}>
              {stats.topCategory}
            </Text>
            <Text style={styles.kpiHint}>Highest financial loss volume</Text>
          </View>
        </View>

        {/* Quick Presets Section */}
        <View style={styles.quickPresetSection}>
          <View style={styles.quickPresetHeader}>
            <Ionicons name="flash-outline" size={15} color={LIGHT.rose} />
            <Text style={styles.quickPresetTitle}>QUICK 1-TAP BREAKAGE REPORTING</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {QUICK_PRESETS.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetCard}
                onPress={() => openReportModal(p)}
                activeOpacity={0.8}
              >
                <View style={styles.presetIconBox}>
                  <Ionicons name={p.icon as any} size={16} color={LIGHT.rose} />
                </View>
                <View>
                  <Text style={styles.presetName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.presetCost}>{money(p.cost)} per item</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

          {/* Category Horizontal Scroll */}
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
                All Items ({damageRecords.length})
              </Text>
            </TouchableOpacity>

            {DAMAGE_CATEGORIES.map((cat) => {
              const count = damageRecords.filter((d) => d.category === cat).length;
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
              {/* Item Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Broken Item Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sultan Royal Gold Rim Dinner Plate 11 inch"
                  placeholderTextColor={LIGHT.textDim}
                  value={formItemName}
                  onChangeText={setFormItemName}
                />
              </View>

              {/* Category Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                  {DAMAGE_CATEGORIES.map((cat) => (
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
                  <Text style={styles.inputLabel}>Primary Reason *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {DAMAGE_REASONS.slice(0, 4).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.smallChip, formReason === r && styles.smallChipActive]}
                        onPress={() => setFormReason(r)}
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            formReason === r && styles.smallChipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Responsibility */}
              <View style={styles.twoCol}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Attributed Responsibility</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6 }}>
                    {RESPONSIBILITIES.map((resp) => (
                      <TouchableOpacity
                        key={resp.key}
                        style={[
                          styles.smallChip,
                          formResponsibleParty === resp.key && styles.smallChipActive,
                        ]}
                        onPress={() => setFormResponsibleParty(resp.key)}
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            formResponsibleParty === resp.key && styles.smallChipTextActive,
                          ]}
                        >
                          {resp.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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
                  <Text style={styles.inputLabel}>Initial Settlement Action</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {DAMAGE_ACTIONS.map((act) => (
                      <TouchableOpacity
                        key={act}
                        style={[styles.smallChip, formActionTaken === act && styles.smallChipActive]}
                        onPress={() => setFormActionTaken(act)}
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            formActionTaken === act && styles.smallChipTextActive,
                          ]}
                        >
                          {act}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Resolution Action</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {DAMAGE_ACTIONS.map((act) => (
                    <TouchableOpacity
                      key={act}
                      style={[styles.smallChip, settleAction === act && styles.smallChipActive]}
                      onPress={() => setSettleAction(act)}
                    >
                      <Text
                        style={[
                          styles.smallChipText,
                          settleAction === act && styles.smallChipTextActive,
                        ]}
                      >
                        {act}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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
                    <Text style={styles.sheetRestName}>SULTAN RESTAURANT</Text>
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
    backgroundColor: LIGHT.roseSoft,
    borderColor: LIGHT.rose,
  },
  categoryChipText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: LIGHT.rose,
    fontWeight: '800',
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
});
