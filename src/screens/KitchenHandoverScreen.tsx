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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import KitchenOpsNav from '../components/KitchenOpsNav';
import ShiftForecastPanel, { KitchenAutomationSettingsModal, shiftTitle } from '../components/ShiftForecastPanel';
import { useOpsStore } from '../store/opsStore';
import { useRestaurantStore } from '../store/restaurantStore';
import { useAuthStore } from '../store/authStore';
import { useKitchenStore, getActiveSessions } from '../store/kitchenStore';
import { seedKitchenStarter } from '../store/kitchenSeed';
import type { ShiftKind, ShiftStation } from '../types/kitchen';
import { SHIFT_KIND_META, SHIFT_STATION_META } from '../types/kitchen';
import RoyalDropdown from '../components/RoyalDropdown';
import {
  averageDailyUsage,
  formatQty,
  money,
  recipeItemIds,
  roundQty,
} from '../utils/kitchenMath';

const BRAND = {
  burgundy: '#52171B',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  cream: '#FDFBF7',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
};

export default function KitchenHandoverScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const router = useRouter();

  const { inventory } = useOpsStore();
  const { staff } = useRestaurantStore();
  const {
    kitchenSessions,
    kitchenConsumption,
    recipes,
    kitchenSettings,
    saveDraft,
    issueSession,
    issueTopUp,
    cancelSession,
    submitClosing,
    approveSession,
  } = useKitchenStore();

  // Admin AND manager can both hand over; record who actually did it.
  const authUser = useAuthStore((s) => s.user);
  const actor = authUser?.name || (authUser?.role === 'manager' ? 'Manager' : 'Admin');

  // Several handovers can be live on the same day - pick which one to look at.
  const activeSessions = getActiveSessions(kitchenSessions);
  const [selectedActiveId, setSelectedActiveId] = useState<string | null>(null);
  const activeSession = activeSessions.find((s) => s.id === selectedActiveId) || activeSessions[0];
  const draftSession = kitchenSessions.find((s) => s.status === 'draft');
  const [showAutomation, setShowAutomation] = useState(false);

  // Chef candidates from staff
  const kitchenStaff = useMemo(
    () => staff.filter((s) => s.role === 'Kitchen' || s.role === 'Manager' || s.role === 'Admin'),
    [staff]
  );

  // Focus inventory on items that actually exist in recipes
  const linkedItemIds = useMemo(() => recipeItemIds(recipes), [recipes]);
  const cookingItems = useMemo(() => {
    return inventory.filter(
      (i) =>
        linkedItemIds.has(i.id) ||
        ['Meat', 'Produce', 'Dairy', 'Grains', 'Pantry', 'Fuel'].includes(i.category)
    );
  }, [inventory, linkedItemIds]);

  // Suggested requisition quantities based on par and last 3 days consumption
  const avgUsage = useMemo(
    () => averageDailyUsage(kitchenSessions, kitchenConsumption, 3),
    [kitchenSessions, kitchenConsumption]
  );

  // Form state
  const [headChef, setHeadChef] = useState<string>(
    draftSession?.headChef || kitchenStaff[0]?.name || 'Chef Omar'
  );
  const [notes, setNotes] = useState<string>(draftSession?.notes || 'Morning shift issue');
  const [cashHandedOver, setCashHandedOver] = useState<string>(
    draftSession ? String(draftSession.cashHandedOver) : '5000'
  );
  const [shift, setShift] = useState<ShiftKind>(draftSession?.shift || 'full');
  const [station, setStation] = useState<ShiftStation>(draftSession?.station || 'all');

  // Line quantities entered by user: { [itemId]: string }
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (draftSession) {
      draftSession.lines.forEach((l) => {
        init[l.itemId] = String(l.requested);
      });
    } else {
      cookingItems.forEach((i) => {
        const par = kitchenSettings.par[i.id] || 0;
        const avg = avgUsage.get(i.id) || 0;
        const sug = Math.max(par, avg * 1.15);
        if (sug > 0) {
          init[i.id] = String(roundQty(sug, i.unit));
        }
      });
    }
    return init;
  });

  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyRequested, setShowOnlyRequested] = useState(false);
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Top up modal state
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpItemId, setTopUpItemId] = useState(cookingItems[0]?.id || '');
  const [topUpQty, setTopUpQty] = useState('');

  // Shift closing modal state
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closingCounts, setClosingCounts] = useState<Record<string, string>>({});
  const [closingCashReturned, setClosingCashReturned] = useState('5000');
  const [closingNotes, setClosingNotes] = useState('');

  const shortUnit = (unit: string) => {
    const u = (unit || '').toLowerCase().trim();
    if (u.startsWith('cylin')) return 'cyl';
    if (u.startsWith('bottle')) return 'btl';
    if (u.startsWith('pack')) return 'pk';
    if (u.startsWith('liter') || u.startsWith('litre')) return 'L';
    if (u.startsWith('piece')) return 'pcs';
    return unit;
  };

  const categories = useMemo(() => {
    const set = new Set(cookingItems.map((i) => i.category));
    return ['All', ...Array.from(set)];
  }, [cookingItems]);

  const requestedCount = useMemo(() => {
    return Object.values(quantities).filter((v) => (parseFloat(v) || 0) > 0).length;
  }, [quantities]);

  const lowStockCount = useMemo(() => {
    return cookingItems.filter((i) => i.stock <= (i.threshold || 5)).length;
  }, [cookingItems]);

  const filteredItems = useMemo(() => {
    return cookingItems.filter((i) => {
      if (filterCategory !== 'All' && i.category !== filterCategory) return false;
      if (showOnlyRequested) {
        const q = parseFloat(quantities[i.id] || '0') || 0;
        if (q <= 0) return false;
      }
      if (showOnlyLowStock) {
        if (i.stock > (i.threshold || 5)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cookingItems, filterCategory, searchQuery, showOnlyRequested, showOnlyLowStock, quantities]);

  const totalRequisitionValue = useMemo(() => {
    return Object.entries(quantities).reduce((sum, [id, qtyStr]) => {
      const q = parseFloat(qtyStr) || 0;
      const item = inventory.find((i) => i.id === id);
      return sum + q * (item?.costPerUnit || 0);
    }, 0);
  }, [quantities, inventory]);

  const handleQuickFillPars = () => {
    const next: Record<string, string> = { ...quantities };
    cookingItems.forEach((i) => {
      const par = kitchenSettings.par[i.id] || 0;
      const avg = avgUsage.get(i.id) || 0;
      const sug = Math.max(par, avg * 1.15);
      if (sug > 0) {
        next[i.id] = String(roundQty(sug, i.unit));
      }
    });
    setQuantities(next);
  };

  const handleQuickFillLowStock = () => {
    const next: Record<string, string> = { ...quantities };
    cookingItems.forEach((i) => {
      if (i.stock <= (i.threshold || 5)) {
        const par = kitchenSettings.par[i.id] || 0;
        const avg = avgUsage.get(i.id) || 0;
        const sug = Math.max(par, avg * 1.15, (i.threshold || 5) * 2);
        if (sug > 0) {
          next[i.id] = String(roundQty(sug, i.unit));
        }
      }
    });
    setQuantities(next);
  };

  const handleClearAllQuantities = () => {
    setQuantities({});
  };

  const handleSetItemPar = (itemId: string, parVal: number) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    setQuantities((prev) => ({
      ...prev,
      [itemId]: String(roundQty(parVal, item.unit)),
    }));
  };

  const handleAdjustItemQty = (itemId: string, delta: number) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const current = parseFloat(quantities[itemId] || '0') || 0;
    const next = Math.max(0, current + delta);
    setQuantities((prev) => ({
      ...prev,
      [itemId]: next > 0 ? String(roundQty(next, item.unit)) : '',
    }));
  };

  const activeIssuedValue = !activeSession
    ? 0
    : activeSession.lines.reduce(
        (sum, l) => sum + (l.issued + l.topUp + l.localPurchased) * l.costPerUnit,
        0
      );

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleSeedStarter = () => {
    const res = seedKitchenStarter();
    showAlert(
      'Starter Recipes Loaded',
      `Sultan menu recipes seeded:\n• ${res.recipesAdded} recipes created\n• ${res.ingredientsAdded} raw materials ensured in store inventory.`
    );
  };

  const handleSaveDraft = () => {
    const lines = Object.entries(quantities)
      .map(([itemId, qtyStr]) => {
        const requested = parseFloat(qtyStr) || 0;
        const item = inventory.find((i) => i.id === itemId);
        const par = kitchenSettings.par[itemId] || 0;
        const avg = avgUsage.get(itemId) || 0;
        return {
          itemId,
          requested,
          par,
          suggested: roundQty(Math.max(par, avg * 1.15), item?.unit || 'kg'),
        };
      })
      .filter((l) => l.requested > 0);

    const res = saveDraft(draftSession ? draftSession.id : null, {
      headChef,
      notes,
      cashHandedOver: parseFloat(cashHandedOver) || 0,
      createdBy: actor,
      shift,
      station,
      lines,
    });

    if (res.ok) showAlert('Draft Saved', 'Kitchen requisition draft saved successfully.');
    else showAlert('Error', res.error);
  };

  const handleIssueToChef = () => {
    // Save draft first if not saved
    const lines = Object.entries(quantities)
      .map(([itemId, qtyStr]) => {
        const requested = parseFloat(qtyStr) || 0;
        const item = inventory.find((i) => i.id === itemId);
        const par = kitchenSettings.par[itemId] || 0;
        const avg = avgUsage.get(itemId) || 0;
        return {
          itemId,
          requested,
          par,
          suggested: roundQty(Math.max(par, avg * 1.15), item?.unit || 'kg'),
        };
      })
      .filter((l) => l.requested > 0);

    const draftRes = saveDraft(draftSession ? draftSession.id : null, {
      headChef,
      notes,
      cashHandedOver: parseFloat(cashHandedOver) || 0,
      createdBy: actor,
      shift,
      station,
      lines,
    });

    if (!draftRes.ok) {
      showAlert('Error', draftRes.error);
      return;
    }

    const sessionId = draftRes.id as string;
    const issueRes = issueSession(sessionId, actor);
    if (issueRes.ok) {
      setSelectedActiveId(sessionId);
      // Start the next handover (another chef / shift) from a clean sheet.
      setQuantities({});
      setNotes('');
      showAlert(
        'Handover Successful',
        `Inventory deducted from store and handed over to ${headChef}. POS sales will now be tracked against this handover.`
      );
    } else {
      showAlert('Issue Failed', issueRes.error);
    }
  };

  const handleConfirmTopUp = () => {
    if (!activeSession) return;
    const q = parseFloat(topUpQty);
    if (!q || q <= 0) {
      showAlert('Invalid', 'Please enter a valid quantity.');
      return;
    }
    const res = issueTopUp(activeSession.id, topUpItemId, q, actor);
    if (res.ok) {
      setShowTopUpModal(false);
      setTopUpQty('');
      showAlert('Top-Up Issued', 'Store items transferred to active kitchen stock successfully.');
    } else {
      showAlert('Failed', res.error);
    }
  };

  const handleConfirmCloseKitchenShift = () => {
    if (!activeSession) return;
    const numericCounts: Record<string, number> = {};
    Object.entries(closingCounts).forEach(([itemId, valStr]) => {
      const num = parseFloat(valStr);
      numericCounts[itemId] = Number.isFinite(num) && num >= 0 ? num : 0;
    });

    const cashRet = parseFloat(closingCashReturned) || 0;

    const subRes = submitClosing({
      sessionId: activeSession.id,
      counts: numericCounts,
      cashReturned: cashRet,
      notes: closingNotes.trim() || 'Kitchen Shift Closed & Stock Returned',
      by: actor,
    });

    if (!subRes.ok) {
      showAlert('Closing Error', subRes.error || 'Failed to submit closing.');
      return;
    }

    approveSession(
      activeSession.id,
      actor,
      closingNotes.trim() || 'Approved at shift close. Returned stock restored to inventory.'
    );

    setShowCloseShiftModal(false);

    showAlert(
      'Kitchen Shift Closed',
      `Kitchen Shift "${activeSession.dayLabel}" has been successfully closed!\n• Remaining stock returned to store inventory.\n• Hand cash (Rs. ${cashRet.toLocaleString()}) returned to drawer.`
    );
  };

  return (
    <View style={styles.container}>
      <KitchenOpsNav backRoute={backRoute} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: BRAND.gold }]}>
            <View style={styles.kpiIconBox}>
              <Ionicons name="cube-outline" size={20} color={BRAND.burgundy} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Store Raw Materials</Text>
              <Text style={styles.kpiValue}>{inventory.length} Items</Text>
              <Text style={styles.kpiSub}>Available in main storage</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.info }]}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#E1F5FE' }]}>
              <Ionicons name="restaurant-outline" size={20} color={BRAND.info} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Menu Recipes (BOM)</Text>
              <Text style={styles.kpiValue}>{recipes.length} Dishes</Text>
              <Text style={styles.kpiSub}>Mapped with exact grams</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: activeSession ? BRAND.success : BRAND.warn }]}>
            <View style={[styles.kpiIconBox, { backgroundColor: activeSession ? '#E8F5E9' : '#FFF3E0' }]}>
              <Ionicons
                name={activeSession ? 'flame' : 'time-outline'}
                size={20}
                color={activeSession ? BRAND.success : BRAND.warn}
              />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Kitchen Session Status</Text>
              <Text style={[styles.kpiValue, { color: activeSession ? BRAND.success : BRAND.warn }]}>
                {activeSessions.length > 1
                  ? `${activeSessions.length} LIVE SHIFTS`
                  : activeSession
                    ? 'LIVE ISSUED'
                    : draftSession
                      ? 'DRAFT READY'
                      : 'NO SESSION'}
              </Text>
              <Text style={styles.kpiSub}>
                {activeSession ? activeSession.dayLabel : 'Ready to prepare requisition'}
              </Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.burgundy }]}>
            <View style={styles.kpiIconBox}>
              <Ionicons name="cash-outline" size={20} color={BRAND.burgundy} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Kitchen Hand Cash</Text>
              <Text style={styles.kpiValue}>
                {money(activeSession ? activeSession.cashHandedOver : parseFloat(cashHandedOver) || 0)}
              </Text>
              <Text style={styles.kpiSub}>For market / emergency purchase</Text>
            </View>
          </View>
        </View>

        {/* Recipes empty callout */}
        {recipes.length === 0 && (
          <View style={styles.seedBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.seedBannerTitle}>Sultan Starter Recipes Ready</Text>
              <Text style={styles.seedBannerSub}>
                Load standard gram-per-portion recipes for Sultan Kebab, Chicken Karahi, Hummus, Kunafa, Fajita Pizza, and Mint Margarita with 1 tap.
              </Text>
            </View>
            <TouchableOpacity style={styles.seedBtn} onPress={handleSeedStarter} activeOpacity={0.85}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.seedBtnText}>Load Starter Recipes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LIVE SHIFT SWITCHER (several handovers can run on the same day) */}
        {activeSessions.length > 1 && (
          <View style={{ marginBottom: 12 }}>
            <RoyalDropdown
              label={`Live Handovers Today (${activeSessions.length}) - Select Shift`}
              options={activeSessions.map((s) => ({
                label: shiftTitle(s),
                value: s.id,
                sublabel: `Head Chef: ${s.headChef} • Hand cash: Rs. ${s.cashHandedOver}`,
              }))}
              value={selectedActiveId || (activeSession?.id || '')}
              onSelect={(id) => setSelectedActiveId(id)}
              icon="time-outline"
            />
          </View>
        )}

        {/* ACTIVE SESSION BANNER (if running) */}
        {activeSession && (
          <View style={styles.activeBanner}>
            <View style={styles.activeBannerHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.liveDot} />
                  <Text style={styles.activeTitle}>Active Kitchen Shift: {activeSession.dayLabel}</Text>
                </View>
                <Text style={styles.activeSub}>
                  Head Chef: <Text style={{ fontWeight: '800' }}>{activeSession.headChef}</Text> • Hand Cash:{' '}
                  <Text style={{ fontWeight: '800' }}>{money(activeSession.cashHandedOver)}</Text> • Issued Value:{' '}
                  <Text style={{ fontWeight: '800' }}>{money(activeIssuedValue)}</Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={styles.closeShiftActionBtn}
                  onPress={() => {
                    const initCounts: Record<string, string> = {};
                    activeSession.lines.forEach((l) => {
                      initCounts[l.itemId] = '0';
                    });
                    setClosingCounts(initCounts);
                    setClosingCashReturned(String(activeSession.cashHandedOver || 0));
                    setClosingNotes('Shift closing handover completed. Unused ingredients returned to cold storage.');
                    setShowCloseShiftModal(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.closeShiftActionBtnText}>Close Kitchen Shift</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topUpBtn}
                  onPress={() => setShowTopUpModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.topUpBtnText}>Issue Top-Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.viewDayBtn}
                  onPress={() => router.push('/kitchen/day' as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flame" size={16} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                  <Text style={styles.viewDayBtnText}>Open Chef Console</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Issued lines preview */}
            <View style={styles.activeTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { flex: 3 }]}>Raw Material Item</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Issued</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Top-Up</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Market</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Total In Kitchen</Text>
              </View>
              {activeSession.lines.map((l) => (
                <View key={l.itemId} style={styles.tableRow}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.itemName}>{l.itemName}</Text>
                    <Text style={styles.itemCategory}>{l.category}</Text>
                  </View>
                  <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>{formatQty(l.issued, l.unit)}</Text>
                  <Text style={[styles.td, { flex: 1.5, textAlign: 'right', color: l.topUp > 0 ? BRAND.warn : BRAND.muted }]}>
                    {l.topUp > 0 ? `+${formatQty(l.topUp, l.unit)}` : '-'}
                  </Text>
                  <Text style={[styles.td, { flex: 1.5, textAlign: 'right', color: l.localPurchased > 0 ? BRAND.info : BRAND.muted }]}>
                    {l.localPurchased > 0 ? `+${formatQty(l.localPurchased, l.unit)}` : '-'}
                  </Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: '800' }]}>
                    {formatQty(l.issued + l.topUp + l.localPurchased, l.unit)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* EVENING FORECAST for the selected live handover */}
        {activeSession && (
          <ShiftForecastPanel session={activeSession} onOpenSettings={() => setShowAutomation(true)} />
        )}

        {/* REQUISITION CREATOR SECTION */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {draftSession ? 'Edit Kitchen Requisition Draft' : 'New Kitchen Requisition & Handover'}
              </Text>
              <Text style={styles.sectionSub}>
                Review store inventory balance, assign shift head chef and petty cash float, and issue ingredients to kitchen.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setShowAutomation(true)}
                accessibilityLabel="Automation settings"
              >
                <Ionicons name="settings-outline" size={15} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                <Text style={styles.secondaryBtnText}>Automation</Text>
              </TouchableOpacity>
              {draftSession && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: BRAND.danger }]}
                  onPress={() => cancelSession(draftSession.id)}
                >
                  <Text style={[styles.secondaryBtnText, { color: BRAND.danger }]}>Discard Draft</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveDraft}>
                <Ionicons name="save-outline" size={15} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                <Text style={styles.secondaryBtnText}>Save Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleIssueToChef}>
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.primaryBtnText}>Issue to Head Chef</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Handover Details Header */}
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <RoyalDropdown
                label="Head Chef Name *"
                placeholder="Select or enter chef name..."
                options={kitchenStaff.map((s) => ({
                  label: `${s.name} (${s.role})`,
                  value: s.name,
                  badge: s.role,
                }))}
                value={headChef}
                onSelect={(val) => setHeadChef(val)}
                icon="restaurant-outline"
                searchable
              />
            </View>

            <View style={styles.formCol}>
              <Text style={styles.inputLabel}>Hand Cash Given (Rs) *</Text>
              <TextInput
                style={[styles.input, { fontWeight: '800', color: BRAND.burgundy }]}
                value={cashHandedOver}
                onChangeText={setCashHandedOver}
                keyboardType="numeric"
                placeholder="5000"
              />
              <Text style={styles.inputHint}>Petty cash float for emergency local market purchases</Text>
            </View>

            <View style={styles.formCol}>
              <Text style={styles.inputLabel}>Shift Notes / Prep Target</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Friday special banquet dinner"
              />
            </View>
          </View>

          {/* Shift & kitchen: several handovers can run on the same day */}
          <View style={[styles.formRow, { marginBottom: 12 }]}>
            <View style={styles.formCol}>
              <RoyalDropdown
                label="Shift Period *"
                options={(Object.keys(SHIFT_KIND_META) as ShiftKind[]).map((k) => ({
                  label: SHIFT_KIND_META[k].label,
                  value: k,
                  icon: SHIFT_KIND_META[k].icon as any,
                }))}
                value={shift}
                onSelect={(k) => setShift(k as ShiftKind)}
                icon="time-outline"
              />
            </View>

            <View style={styles.formCol}>
              <RoyalDropdown
                label="Kitchen Station *"
                options={(Object.keys(SHIFT_STATION_META) as ShiftStation[]).map((k) => ({
                  label: SHIFT_STATION_META[k].label,
                  value: k,
                }))}
                value={station}
                onSelect={(k) => setStation(k as ShiftStation)}
                icon="flame-outline"
              />
            </View>
          </View>

          {/* Requisition Table Filter & Quick Actions Bar */}
          <View style={styles.filterRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={BRAND.muted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search raw material ingredient..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.trim().length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={BRAND.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Dropdown and Smart Filter Chips */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              <View style={{ minWidth: 180, flex: 1 }}>
                <RoyalDropdown
                  placeholder="All Categories"
                  options={categories.map((cat) => {
                    const count = cat === 'All' ? cookingItems.length : cookingItems.filter(i => i.category === cat).length;
                    return {
                      label: `${cat} (${count})`,
                      value: cat,
                      badge: `${count}`,
                    };
                  })}
                  value={filterCategory}
                  onSelect={(cat) => {
                    setFilterCategory(cat);
                    setShowOnlyRequested(false);
                    setShowOnlyLowStock(false);
                  }}
                  icon="grid-outline"
                  searchable
                />
              </View>

              {/* Selected Items Toggle Chip */}
              <TouchableOpacity
                style={[styles.smartFilterChip, showOnlyRequested && styles.smartFilterChipActive]}
                onPress={() => setShowOnlyRequested(!showOnlyRequested)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showOnlyRequested ? 'checkbox' : 'checkbox-outline'}
                  size={14}
                  color={showOnlyRequested ? '#FFFFFF' : BRAND.burgundy}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.smartFilterChipText, showOnlyRequested && styles.smartFilterChipTextActive]}>
                  Selected ({requestedCount})
                </Text>
              </TouchableOpacity>

              {/* Low Stock Toggle Chip */}
              <TouchableOpacity
                style={[
                  styles.smartFilterChip,
                  { borderColor: '#FCA5A5' },
                  showOnlyLowStock && { backgroundColor: BRAND.danger, borderColor: BRAND.danger },
                ]}
                onPress={() => setShowOnlyLowStock(!showOnlyLowStock)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={showOnlyLowStock ? '#FFFFFF' : BRAND.danger}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.smartFilterChipText, { color: BRAND.danger }, showOnlyLowStock && { color: '#FFFFFF' }]}>
                  Low In Store ({lowStockCount})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleQuickFillPars}
                activeOpacity={0.8}
              >
                <Ionicons name="flash" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.quickActionBtnText}>Auto-Fill Par</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: '#B45309' }]}
                onPress={handleQuickFillLowStock}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.quickActionBtnText}>Fill Low Stock</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickClearBtn}
                onPress={handleClearAllQuantities}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                <Text style={styles.quickClearBtnText}>Reset All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.reqTotalBox}>
              <Text style={styles.reqTotalLabel}>Requisition Value:</Text>
              <Text style={styles.reqTotalVal}>{money(totalRequisitionValue)}</Text>
            </View>
          </View>

          {/* Requisition Table */}
          <View style={styles.reqTable}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2.8 }]}>Raw Material Ingredient</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Store Stock (Available)</Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: 'right' }]}>Par / Avg</Text>
              <Text style={[styles.th, { flex: 2.8, textAlign: 'right' }]}>Request to Issue</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Line Value</Text>
            </View>

            {filteredItems.map((item) => {
              const reqVal = quantities[item.id] || '';
              const reqNum = parseFloat(reqVal) || 0;
              const isOverStock = reqNum > item.stock;
              const par = kitchenSettings.par[item.id] || 0;
              const avg = avgUsage.get(item.id) || 0;
              const sugVal = Math.max(par, avg * 1.15);
              const lineCost = reqNum * (item.costPerUnit || 0);
              const uLabel = shortUnit(item.unit);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    reqNum > 0 && styles.tableRowSelected,
                    isOverStock && styles.tableRowOverStock,
                  ]}
                >
                  <View style={{ flex: 2.8 }}>
                    <Text style={[styles.itemName, reqNum > 0 && { color: BRAND.burgundy, fontWeight: '800' }]}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemCategory}>
                      {item.category} • Cost: {money(item.costPerUnit || 0)} / {uLabel}
                    </Text>
                  </View>

                  <View style={{ flex: 2, alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.td,
                        {
                          fontWeight: '800',
                          color: item.stock <= (item.threshold || 5) ? BRAND.danger : BRAND.ink,
                        },
                      ]}
                    >
                      {formatQty(item.stock, uLabel)}
                    </Text>
                    {item.stock <= (item.threshold || 5) && (
                      <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockBadgeText}>Low Stock</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1.4, alignItems: 'flex-end' }}>
                    <Text style={styles.td}>
                      {par > 0 ? `${par} ${uLabel}` : avg > 0 ? `~${roundQty(avg, uLabel)}` : '-'}
                    </Text>
                  </View>

                  <View style={{ flex: 2.8, alignItems: 'flex-end' }}>
                    <View style={styles.qtyInputWrap}>
                      {sugVal > 0 && (
                        <TouchableOpacity
                          style={styles.quickParBtn}
                          onPress={() => handleSetItemPar(item.id, sugVal)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickParBtnText}>Par</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => handleAdjustItemQty(item.id, -1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={12} color={BRAND.ink} />
                      </TouchableOpacity>
                      <TextInput
                        style={[
                          styles.qtyInput,
                          reqNum > 0 && styles.qtyInputFilled,
                          isOverStock && styles.qtyInputOverStock,
                        ]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={reqVal}
                        onChangeText={(t) => setQuantities({ ...quantities, [item.id]: t })}
                      />
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => handleAdjustItemQty(item.id, 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={12} color={BRAND.burgundy} />
                      </TouchableOpacity>
                      <Text style={styles.unitSuffix} numberOfLines={1}>{uLabel}</Text>
                    </View>
                    {isOverStock && (
                      <Text style={styles.overStockWarning}>
                        Only {item.stock} {uLabel} available in store inventory!
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1.8, alignItems: 'flex-end' }}>
                    <Text style={[styles.td, reqNum > 0 && { fontWeight: '800', color: BRAND.burgundy }]}>
                      {lineCost > 0 ? money(lineCost) : '-'}
                    </Text>
                  </View>
                </View>
              );
            })}

            {filteredItems.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={32} color={BRAND.muted} />
                <Text style={styles.emptyStateTitle}>No ingredients found</Text>
                <Text style={styles.emptyStateSub}>No items match your active search or filter selection.</Text>
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setFilterCategory('All');
                    setShowOnlyRequested(false);
                    setShowOnlyLowStock(false);
                  }}
                >
                  <Text style={styles.resetFilterBtnText}>Reset All Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bottom Sticky Action Dock */}
      <View style={styles.floatingDock}>
        <View style={styles.dockLeft}>
          <View style={styles.dockBadge}>
            <Ionicons name="basket" size={16} color={BRAND.burgundy} />
            <Text style={styles.dockBadgeText}>{requestedCount} Selected</Text>
          </View>
          <View>
            <Text style={styles.dockSub}>Total Handover Value</Text>
            <Text style={styles.dockVal}>{money(totalRequisitionValue)}</Text>
          </View>
        </View>

        <View style={styles.dockRight}>
          <TouchableOpacity
            style={styles.dockClearBtn}
            onPress={handleClearAllQuantities}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={14} color={BRAND.muted} />
            <Text style={styles.dockClearBtnText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockDraftBtn}
            onPress={handleSaveDraft}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={15} color={BRAND.burgundy} />
            <Text style={styles.dockDraftBtnText}>Save Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockIssueBtn}
            onPress={handleIssueToChef}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
            <Text style={styles.dockIssueBtnText}>Issue to Head Chef</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TOP-UP MODAL */}
      <Modal visible={showTopUpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Mid-Shift Top-Up to Kitchen</Text>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)}>
                <Ionicons name="close" size={22} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Select Ingredient</Text>
              <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
                {cookingItems.map((i) => (
                  <TouchableOpacity
                    key={i.id}
                    style={[styles.topUpItemRow, topUpItemId === i.id && styles.topUpItemRowActive]}
                    onPress={() => setTopUpItemId(i.id)}
                  >
                    <Text style={{ fontWeight: '700', color: BRAND.ink }}>{i.name}</Text>
                    <Text style={{ fontSize: 11, color: BRAND.muted }}>
                      Store: {formatQty(i.stock, i.unit)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Top-up Quantity</Text>
              <TextInput
                style={[styles.input, { fontSize: 16, fontWeight: '800' }]}
                placeholder="Quantity to issue"
                keyboardType="numeric"
                value={topUpQty}
                onChangeText={setTopUpQty}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowTopUpModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmTopUp}>
                <Text style={styles.primaryBtnText}>Issue Top-Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KITCHEN SHIFT CLOSING MODAL */}
      <Modal visible={showCloseShiftModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 640 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={20} color={BRAND.burgundy} />
                <Text style={styles.modalTitle}>Close Kitchen Shift & Return Stock</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCloseShiftModal(false)}>
                <Ionicons name="close" size={22} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.closeShiftIntroCard}>
                <Text style={styles.closeShiftIntroTitle}>
                  Reconciling: {activeSession?.dayLabel} • Head Chef: {activeSession?.headChef}
                </Text>
                <Text style={styles.closeShiftIntroSub}>
                  Record any unused raw materials returned back to the main store / cold room and settle handed cash.
                </Text>
              </View>

              {/* Hand Cash Settlement */}
              <View style={styles.cashCloseSection}>
                <Text style={styles.sectionHeading}>1. Kitchen Hand Cash Settlement</Text>
                <View style={styles.cashCloseRow}>
                  <Text style={styles.cashCloseLabel}>
                    Cash Issued at Shift Start: <Text style={{ fontWeight: '800' }}>{money(activeSession?.cashHandedOver || 0)}</Text>
                  </Text>
                  <View style={styles.cashInputBox}>
                    <Text style={styles.cashInputPrefix}>Cash Returned: Rs.</Text>
                    <TextInput
                      style={styles.cashInput}
                      value={closingCashReturned}
                      onChangeText={setClosingCashReturned}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
              </View>

              {/* Raw Materials Return Table */}
              <View style={styles.itemsCloseSection}>
                <Text style={styles.sectionHeading}>2. Raw Materials Returned to Store (اسٹاک واپسی)</Text>
                <View style={styles.closeItemsTable}>
                  <View style={styles.closeItemsHeader}>
                    <Text style={[styles.closeTh, { flex: 3 }]}>Raw Material Item</Text>
                    <Text style={[styles.closeTh, { flex: 1.5, textAlign: 'right' }]}>Total in Kitchen</Text>
                    <Text style={[styles.closeTh, { flex: 2, textAlign: 'right' }]}>Returned Qty</Text>
                  </View>
                  {activeSession?.lines.map((l) => {
                    const totalKitchen = l.issued + l.topUp + l.localPurchased;
                    return (
                      <View key={l.itemId} style={styles.closeItemsRow}>
                        <View style={{ flex: 3 }}>
                          <Text style={styles.closeItemName}>{l.itemName}</Text>
                          <Text style={styles.closeItemCategory}>{l.category}</Text>
                        </View>
                        <Text style={[styles.closeItemQty, { flex: 1.5, textAlign: 'right' }]}>
                          {formatQty(totalKitchen, l.unit)}
                        </Text>
                        <View style={{ flex: 2, alignItems: 'flex-end' }}>
                          <View style={styles.returnInputWrap}>
                            <TextInput
                              style={styles.returnInput}
                              value={closingCounts[l.itemId] ?? '0'}
                              onChangeText={(val) =>
                                setClosingCounts((prev) => ({ ...prev, [l.itemId]: val }))
                              }
                              keyboardType="numeric"
                              placeholder="0"
                            />
                            <Text style={styles.returnUnit}>{l.unit}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Closing Notes */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.sectionHeading}>3. Handover Remarks / Reason</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={closingNotes}
                  onChangeText={setClosingNotes}
                  placeholder="e.g. Unused chicken and rice returned to cold store. Cash settled."
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setShowCloseShiftModal(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: BRAND.burgundy }]}
                onPress={handleConfirmCloseKitchenShift}
              >
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Confirm Shift Close & Restock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <KitchenAutomationSettingsModal visible={showAutomation} onClose={() => setShowAutomation(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kpiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  seedBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  seedBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  seedBannerSub: {
    fontSize: 11,
    color: BRAND.ink,
    marginTop: 2,
  },
  seedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  seedBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  activeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: BRAND.success,
    marginBottom: 16,
  },
  activeBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.success,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.success,
  },
  activeSub: {
    fontSize: 12,
    color: BRAND.ink,
    marginTop: 2,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.warn,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  topUpBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  viewDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EBE6',
    borderWidth: 1,
    borderColor: BRAND.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewDayBtnText: {
    color: BRAND.burgundy,
    fontWeight: '800',
    fontSize: 12,
  },
  closeShiftActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeShiftActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  closeShiftIntroCard: {
    backgroundColor: '#F6F3EC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8DFC9',
  },
  closeShiftIntroTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  closeShiftIntroSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cashCloseSection: {
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cashCloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  cashCloseLabel: {
    fontSize: 12,
    color: BRAND.ink,
  },
  cashInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F8F9FA',
  },
  cashInputPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
    marginRight: 4,
  },
  cashInput: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
    paddingVertical: 6,
    width: 100,
  },
  itemsCloseSection: {
    marginBottom: 10,
  },
  closeItemsTable: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeItemsHeader: {
    flexDirection: 'row',
    backgroundColor: '#F6F3EC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  closeTh: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  closeItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  closeItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  closeItemCategory: {
    fontSize: 10,
    color: BRAND.muted,
  },
  closeItemQty: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  returnInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: '#F8F9FA',
  },
  returnInput: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
    paddingVertical: 4,
    width: 60,
    textAlign: 'right',
  },
  returnUnit: {
    fontSize: 10,
    color: BRAND.muted,
    marginLeft: 4,
  },
  activeTable: {
    backgroundColor: '#FDFBF7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  sectionSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: BRAND.burgundy,
    fontWeight: '800',
    fontSize: 12,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
    backgroundColor: '#FDFBF7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
  },
  formCol: {
    flex: 1,
    minWidth: 200,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: BRAND.ink,
  },
  inputHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  chefPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginRight: 6,
  },
  chefPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  chefPillText: {
    fontSize: 11,
    color: BRAND.ink,
    fontWeight: '600',
  },
  chefPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: BRAND.ink,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginRight: 6,
  },
  catPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  reqTotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.gold,
  },
  reqTotalLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '700',
  },
  reqTotalVal: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  reqTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  itemCategory: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 1,
  },
  td: {
    fontSize: 12,
    color: BRAND.ink,
  },
  qtyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyInput: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'right',
    backgroundColor: '#FFFFFF',
  },
  qtyInputFilled: {
    borderColor: BRAND.burgundy,
    fontWeight: '800',
    backgroundColor: '#FFFBF9',
  },
  qtyInputOverStock: {
    borderColor: BRAND.danger,
    backgroundColor: '#FFEBEE',
    color: BRAND.danger,
  },
  unitSuffix: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    minWidth: 30,
    marginLeft: 3,
  },
  tableRowSelected: {
    backgroundColor: '#FFFDF6',
    borderLeftWidth: 3,
    borderLeftColor: BRAND.gold,
  },
  tableRowOverStock: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: BRAND.danger,
  },
  lowStockBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  lowStockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  overStockWarning: {
    fontSize: 9,
    color: BRAND.danger,
    fontWeight: '800',
    marginTop: 2,
  },
  lowStockWarning: {
    fontSize: 9,
    color: BRAND.danger,
    fontWeight: '800',
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  quickActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickClearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  quickParBtn: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 2,
  },
  quickParBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
  },
  stepBtn: {
    width: 22,
    height: 30,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#F9FAFB',
  },
  topUpItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    marginBottom: 4,
  },
  topUpItemRowActive: {
    backgroundColor: '#FFF8E1',
    borderColor: BRAND.gold,
  },
  smartFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BRAND.burgundy,
    marginRight: 6,
  },
  smartFilterChipActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  smartFilterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  smartFilterChipTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: BRAND.burgundy,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingDock: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: BRAND.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 10,
  },
  dockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.gold,
  },
  dockBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.goldDark,
  },
  dockSub: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '600',
  },
  dockVal: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  dockRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dockClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#F9FAFB',
  },
  dockClearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    marginLeft: 4,
  },
  dockDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.burgundy,
    backgroundColor: '#FFFFFF',
  },
  dockDraftBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
    marginLeft: 4,
  },
  dockIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: BRAND.burgundy,
  },
  dockIssueBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
});
