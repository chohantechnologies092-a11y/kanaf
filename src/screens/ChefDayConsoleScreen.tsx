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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import KitchenOpsNav from '../components/KitchenOpsNav';
import ShiftForecastPanel, { shiftTitle } from '../components/ShiftForecastPanel';
import { useKitchenStore, getActiveSessions } from '../store/kitchenStore';
import type { ManualUsageReason } from '../types/kitchen';
import { MANUAL_REASON_META } from '../types/kitchen';
import {
  computeLiveLines,
  formatQty,
  money,
  roundQty,
} from '../utils/kitchenMath';

import { usePortalBase } from '../hooks/usePortalBase';
import RoyalDropdown from '../components/RoyalDropdown';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
  cream: '#FDFBF7',
};

export default function ChefDayConsoleScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const router = useRouter();
  const portalBase = usePortalBase();
  const {
    kitchenSessions,
    kitchenConsumption,
    kitchenManualUsage,
    kitchenCash,
    recordManualUsage,
    addCashEntry,
    submitClosing,
  } = useKitchenStore();

  // Several handovers can be live at once (different chefs / shifts) - the chef picks theirs.
  const activeSessions = getActiveSessions(kitchenSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0];
  const pendingSession = kitchenSessions.find((s) => s.status === 'pending_approval');

  // Search & Category filter on kitchen stock
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [filterAttentionOnly, setFilterAttentionOnly] = useState(false);

  // 1. Manual Taste / Masala / Spoilage Adjustment Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedAdjustItemId, setSelectedAdjustItemId] = useState<string>('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState<ManualUsageReason>('taste_up');
  const [adjustDish, setAdjustDish] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // 2. Local Market Cash Purchase Modal State
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [marketAmount, setMarketAmount] = useState('');
  const [marketItemName, setMarketItemName] = useState('');
  const [marketInvItemId, setMarketInvItemId] = useState<string | undefined>(undefined);
  const [marketQty, setMarketQty] = useState('');
  const [marketNote, setMarketNote] = useState('');

  // 3. EOD Closing Submission Modal State
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [closingCashReturned, setClosingCashReturned] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // Compute live lines with theoretical KOT deductions and manual usage
  const liveLines = useMemo(() => {
    if (!activeSession) return [];
    return computeLiveLines(activeSession, kitchenConsumption, kitchenManualUsage);
  }, [activeSession, kitchenConsumption, kitchenManualUsage]);

  // Filtered live stock lines
  const filteredLines = useMemo(() => {
    return liveLines.filter((l) => {
      if (filterAttentionOnly && l.status === 'ok') return false;
      if (selectedCat !== 'all' && l.category !== selectedCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return l.itemName.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [liveLines, selectedCat, search, filterAttentionOnly]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    liveLines.forEach((l) => set.add(l.category));
    return Array.from(set);
  }, [liveLines]);

  const depletedLines = useMemo(() => {
    return liveLines.filter((l) => l.status === 'out');
  }, [liveLines]);

  const lowLines = useMemo(() => {
    return liveLines.filter((l) => l.status === 'low');
  }, [liveLines]);

  // Cash Ledger for Active Session
  const sessionCashEntries = useMemo(() => {
    if (!activeSession) return [];
    return kitchenCash.filter((c) => c.sessionId === activeSession.id);
  }, [kitchenCash, activeSession]);

  const totalCashSpent = useMemo(() => {
    return sessionCashEntries.reduce((s, c) => s + c.amount, 0);
  }, [sessionCashEntries]);

  const remainingCashOnHand = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.cashHandedOver - totalCashSpent;
  }, [activeSession, totalCashSpent]);

  // Recent KOT auto-deductions for this session
  const sessionConsumption = useMemo(() => {
    if (!activeSession) return [];
    return kitchenConsumption
      .filter((c) => c.sessionId === activeSession.id)
      .slice(0, 15);
  }, [kitchenConsumption, activeSession]);

  // Recent manual taste/spoilage entries
  const sessionManualAdjustments = useMemo(() => {
    if (!activeSession) return [];
    return kitchenManualUsage
      .filter((m) => m.sessionId === activeSession.id)
      .slice(0, 15);
  }, [kitchenManualUsage, activeSession]);

  // Handlers
  const handleOpenAdjustment = (itemId?: string) => {
    if (!activeSession) return;
    const defaultItem = itemId || liveLines[0]?.itemId || '';
    setSelectedAdjustItemId(defaultItem);
    setAdjustQty('0.2');
    setAdjustReason('taste_up');
    setAdjustDish('');
    setAdjustNote('');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    if (!activeSession) return;
    const qtyVal = parseFloat(adjustQty);
    if (!qtyVal || qtyVal <= 0) {
      Alert.alert('Validation', 'Please enter a valid quantity.');
      return;
    }
    const line = liveLines.find((l) => l.itemId === selectedAdjustItemId);
    if (!line) {
      Alert.alert('Error', 'Please select an inventory item.');
      return;
    }

    const res = recordManualUsage({
      sessionId: activeSession.id,
      itemId: line.itemId,
      qty: qtyVal,
      reason: adjustReason,
      dish: adjustDish.trim() || undefined,
      note: adjustNote.trim() || undefined,
      by: activeSession.headChef,
    });

    if (!res.ok) {
      Alert.alert('Error', res.error);
      return;
    }

    setAdjustModalOpen(false);
    Alert.alert('Logged', `Usage adjustment of ${qtyVal} ${line.unit} recorded for ${line.itemName}.`);
  };

  const handleOpenMarketPurchase = () => {
    if (!activeSession) return;
    setMarketAmount('');
    setMarketItemName('');
    setMarketInvItemId(undefined);
    setMarketQty('');
    setMarketNote('');
    setMarketModalOpen(true);
  };

  const handleSaveMarketPurchase = () => {
    if (!activeSession) return;
    const amt = parseFloat(marketAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Validation', 'Please enter a valid purchase amount in Rs.');
      return;
    }
    if (amt > remainingCashOnHand) {
      Alert.alert(
        'Insufficient Petty Cash',
        `Current remaining cash on hand is ${money(remainingCashOnHand)}. Cannot record ${money(amt)} purchase.`
      );
      return;
    }
    if (!marketItemName.trim()) {
      Alert.alert('Validation', 'Please describe the market item purchased.');
      return;
    }

    const res = addCashEntry({
      sessionId: activeSession.id,
      amount: amt,
      note: marketNote.trim() || marketItemName.trim(),
      itemId: marketInvItemId,
      qty: marketQty ? parseFloat(marketQty) : undefined,
      by: activeSession.headChef,
    });

    if (!res.ok) {
      Alert.alert('Error', res.error);
      return;
    }

    setMarketModalOpen(false);
    Alert.alert('Purchase Recorded', `Spent ${money(amt)} on "${marketItemName}". Hand cash updated.`);
  };

  const handleOpenClosing = () => {
    if (!activeSession) return;
    const initialMap: Record<string, string> = {};
    liveLines.forEach((l) => {
      // Prepopulate with expected on hand rounded to 1 decimal
      const exp = Math.max(0, l.expectedOnHand);
      initialMap[l.itemId] = String(roundQty(exp, l.unit));
    });
    setPhysicalCounts(initialMap);
    setClosingCashReturned(String(Math.max(0, remainingCashOnHand)));
    setClosingNotes('');
    setClosingModalOpen(true);
  };

  const handleSubmitClosingForm = () => {
    if (!activeSession) return;
    const numericCounts: Record<string, number> = {};
    for (const line of liveLines) {
      const val = parseFloat(physicalCounts[line.itemId] || '0');
      numericCounts[line.itemId] = Number.isFinite(val) ? val : 0;
    }

    const cashRet = parseFloat(closingCashReturned);
    if (isNaN(cashRet) || cashRet < 0) {
      Alert.alert('Validation', 'Please enter valid cash returned (0 or more).');
      return;
    }

    Alert.alert(
      'Confirm End of Day Submission',
      `Submit physical counts for ${liveLines.length} items and ${money(cashRet)} cash to GM/Admin for closing verification?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit to Admin/GM',
          style: 'default',
          onPress: () => {
            const res = submitClosing({
              sessionId: activeSession.id,
              counts: numericCounts,
              cashReturned: cashRet,
              notes: closingNotes.trim() || undefined,
              by: activeSession.headChef,
            });

            if (!res.ok) {
              Alert.alert('Submission Failed', res.error);
              return;
            }

            setClosingModalOpen(false);
            Alert.alert(
              'Submitted for Approval',
              'End of day physical count has been sent to Admin/GM for verification and store restocking.'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <KitchenOpsNav backRoute={backRoute} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ACTIVE SESSION BANNER / OR NO SESSION STATE */}
        {activeSession ? (
          <View style={styles.sessionBanner}>
            <View style={styles.bannerMain}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.livePulseDot} />
                <View>
                  <Text style={styles.bannerTitle}>
                    {activeSession.dayLabel} • LIVE KITCHEN SHIFT
                  </Text>
                  <Text style={styles.bannerChef}>Head Chef: {activeSession.headChef}</Text>
                </View>
              </View>

              {/* Hand Cash On Hand Counter */}
              <View style={styles.cashBadge}>
                <Ionicons name="wallet-outline" size={20} color={BRAND.burgundy} />
                <View>
                  <Text style={styles.cashBadgeLabel}>Hand Cash On Hand</Text>
                  <Text style={styles.cashBadgeValue}>{money(remainingCashOnHand)}</Text>
                  <Text style={styles.cashBadgeSub}>
                    Issued: {money(activeSession.cashHandedOver)} | Spent: {money(totalCashSpent)}
                  </Text>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.bannerActions}>
                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => handleOpenAdjustment()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flame" size={16} color={BRAND.burgundy} />
                  <Text style={styles.actionBtnSecondaryText}>Taste / Masala ±</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={handleOpenMarketPurchase}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cart" size={16} color={BRAND.burgundy} />
                  <Text style={styles.actionBtnSecondaryText}>Market Buy (Cash)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={handleOpenClosing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>EOD Count & Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : pendingSession ? (
          <View style={styles.pendingNoticeBanner}>
            <Ionicons name="time-outline" size={24} color={BRAND.goldDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingNoticeTitle}>
                Closing Count Submitted for {pendingSession.dayLabel}
              </Text>
              <Text style={styles.pendingNoticeSub}>
                Waiting for GM / Admin to verify physical inventory counts and authorize restock into main store.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewApprovalBtn}
              onPress={() => router.push(`${portalBase}/kitchen-returns` as any)}
            >
              <Text style={styles.viewApprovalBtnText}>View EOD Approval</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noSessionBanner}>
            <Ionicons name="restaurant-outline" size={32} color={BRAND.goldDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noSessionTitle}>No Active Kitchen Shift</Text>
              <Text style={styles.noSessionSub}>
                Main Store has not issued kitchen requisition and hand cash for today yet.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.startRequisitionBtn}
              onPress={() => router.push(`${portalBase}/kitchen-handover` as any)}
            >
              <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" />
              <Text style={styles.startRequisitionBtnText}>Prepare Requisition</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeSessions.length > 1 && (
          <View style={{ marginBottom: 12 }}>
            <RoyalDropdown
              label={`Live Handovers (${activeSessions.length}) - Choose Active Shift`}
              options={activeSessions.map((s) => ({
                label: shiftTitle(s),
                value: s.id,
                sublabel: `Head Chef: ${s.headChef} • Float: Rs. ${s.cashHandedOver}`,
              }))}
              value={selectedSessionId || (activeSession?.id || '')}
              onSelect={(id) => setSelectedSessionId(id)}
              icon="time-outline"
            />
          </View>
        )}

        {activeSession && <ShiftForecastPanel session={activeSession} />}

        {/* STATS OVERVIEW CARDS */}
        {activeSession && (
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ingredients In Kitchen</Text>
              <Text style={styles.kpiValue}>{liveLines.length} items</Text>
              <Text style={styles.kpiSub}>Tracked live with auto KOT deduct</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>KOT Theoretical Sold</Text>
              <Text style={[styles.kpiValue, { color: BRAND.burgundy }]}>
                {sessionConsumption.reduce((s, c) => s + c.qty, 0)} plates
              </Text>
              <Text style={styles.kpiSub}>Auto-deducted from kitchen stock</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Depleted / Critical Items</Text>
              <Text
                style={[
                  styles.kpiValue,
                  {
                    color:
                      liveLines.filter((l) => l.status === 'out' || l.status === 'low').length > 0
                        ? BRAND.danger
                        : BRAND.success,
                  },
                ]}
              >
                {liveLines.filter((l) => l.status === 'out' || l.status === 'low').length} items
              </Text>
              <Text style={styles.kpiSub}>Running below 20% on hand</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Local Market Buys</Text>
              <Text style={[styles.kpiValue, { color: BRAND.goldDark }]}>{money(totalCashSpent)}</Text>
              <Text style={styles.kpiSub}>{sessionCashEntries.length} receipts logged</Text>
            </View>
          </View>
        )}

        {/* MAIN SECTION: LIVE KITCHEN INVENTORY ON-HAND TABLE */}
        {activeSession && (
          <View style={styles.sectionCard}>
            <View style={styles.tableControlRow}>
              <View>
                <Text style={styles.tableTitle}>Live Kitchen On-Hand Inventory</Text>
                <Text style={styles.tableSubtitle}>
                  Issued Store Stock + Local Purchases − Live POS KOT Deductions ± Chef Adjustments
                </Text>
              </View>

              <View style={styles.filterActions}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={14} color={BRAND.muted} style={{ marginLeft: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search ingredient..."
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                <TouchableOpacity
                  style={styles.quickAdjustBtn}
                  onPress={() => handleOpenAdjustment()}
                >
                  <Ionicons name="add" size={14} color={BRAND.burgundy} />
                  <Text style={styles.quickAdjustBtnText}>Log Usage / Spill</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Critical Stock Depletion Alert Banner */}
            {depletedLines.length > 0 && (
              <View style={styles.criticalAlertBanner}>
                <Ionicons name="warning" size={20} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.criticalAlertTitle}>
                    Critical Depletion: {depletedLines.length} Item{depletedLines.length > 1 ? 's' : ''} Exhausted
                  </Text>
                  <Text style={styles.criticalAlertSub}>
                    {depletedLines.map((d) => d.itemName).join(', ')} • Request urgent store top-up or purchase locally.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.criticalAlertBtn}
                  onPress={() => setMarketModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.criticalAlertBtnText}>Buy Local</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catChipsScroll}
              contentContainerStyle={styles.catChips}
            >
              <TouchableOpacity
                style={[styles.catChip, selectedCat === 'all' && !filterAttentionOnly && styles.catChipActive]}
                onPress={() => {
                  setSelectedCat('all');
                  setFilterAttentionOnly(false);
                }}
              >
                <Text style={[styles.catChipText, selectedCat === 'all' && !filterAttentionOnly && styles.catChipTextActive]}>
                  All ({liveLines.length})
                </Text>
              </TouchableOpacity>

              {/* Needs Attention (Low / Out) Chip */}
              {(depletedLines.length > 0 || lowLines.length > 0) && (
                <TouchableOpacity
                  style={[
                    styles.catChip,
                    { borderColor: '#FCA5A5' },
                    filterAttentionOnly && { backgroundColor: '#DC2626', borderColor: '#DC2626' },
                  ]}
                  onPress={() => setFilterAttentionOnly(!filterAttentionOnly)}
                >
                  <Ionicons
                    name="warning"
                    size={12}
                    color={filterAttentionOnly ? '#FFFFFF' : '#DC2626'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      { color: '#DC2626', fontWeight: '800' },
                      filterAttentionOnly && { color: '#FFFFFF' },
                    ]}
                  >
                    Attention Needed ({depletedLines.length + lowLines.length})
                  </Text>
                </TouchableOpacity>
              )}
              {categories.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, selectedCat === c && styles.catChipActive]}
                  onPress={() => setSelectedCat(c)}
                >
                  <Text style={[styles.catChipText, selectedCat === c && styles.catChipTextActive]}>
                    {c} ({liveLines.filter((l) => l.category === c).length})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Table */}
            <View style={styles.inventoryTable}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { flex: 3 }]}>Ingredient Name</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Issued Store</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Top-Up / Buy</Text>
                <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>KOT Consumed</Text>
                <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Taste/Spills ±</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Live On-Hand</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Status</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Act</Text>
              </View>

              {filteredLines.map((line) => {
                const isCritical = line.status === 'out';
                const isLow = line.status === 'low';

                return (
                  <View key={line.itemId} style={[styles.trRow, isCritical && styles.trRowCritical]}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.trItemName}>{line.itemName}</Text>
                      <Text style={styles.trCategory}>{line.category} • Cost {money(line.costPerUnit)}/{line.unit}</Text>
                    </View>

                    <Text style={[styles.tr, { flex: 1.5, textAlign: 'right' }]}>
                      {formatQty(line.issued, line.unit)}
                    </Text>

                    <Text style={[styles.tr, { flex: 1.5, textAlign: 'right', color: BRAND.info }]}>
                      {line.topUp + line.localPurchased > 0
                        ? `+${formatQty(line.topUp + line.localPurchased, line.unit)}`
                        : '—'}
                    </Text>

                    <Text style={[styles.tr, { flex: 1.8, textAlign: 'right', color: BRAND.burgundy, fontWeight: '700' }]}>
                      {line.theoreticalUsed > 0 ? `-${formatQty(line.theoreticalUsed, line.unit)}` : '0'}
                    </Text>

                    <Text
                      style={[
                        styles.tr,
                        {
                          flex: 1.8,
                          textAlign: 'right',
                          color: line.manualUsed > 0 ? BRAND.danger : line.manualUsed < 0 ? BRAND.success : BRAND.muted,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {line.manualUsed > 0
                        ? `-${formatQty(line.manualUsed, line.unit)}`
                        : line.manualUsed < 0
                        ? `+${formatQty(Math.abs(line.manualUsed), line.unit)}`
                        : '0'}
                    </Text>

                    <Text
                      style={[
                        styles.tr,
                        {
                          flex: 2,
                          textAlign: 'right',
                          fontWeight: '900',
                          fontSize: 14,
                          color: isCritical ? BRAND.danger : isLow ? BRAND.warn : BRAND.ink,
                        },
                      ]}
                    >
                      {formatQty(line.expectedOnHand, line.unit)}
                    </Text>

                    <View style={{ flex: 1.2, alignItems: 'center' }}>
                      <View
                        style={[
                          styles.statusBadge,
                          isCritical
                            ? styles.statusBadgeOut
                            : isLow
                            ? styles.statusBadgeLow
                            : styles.statusBadgeOk,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isCritical
                              ? { color: BRAND.danger }
                              : isLow
                              ? { color: BRAND.warn }
                              : { color: BRAND.success },
                          ]}
                        >
                          {isCritical ? 'DEPLETED' : isLow ? 'LOW' : 'OK'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.tuneBtn}
                        onPress={() => handleOpenAdjustment(line.itemId)}
                      >
                        <Ionicons name="options-outline" size={15} color={BRAND.burgundy} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* BOTTOM DUAL COLUMNS: RECENT KOT DEDUCTIONS & TASTE/CASH LOGS */}
        {activeSession && (
          <View style={styles.dualCols}>
            {/* Left: Live POS KOT Auto Consumption */}
            <View style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <Ionicons name="receipt-outline" size={18} color={BRAND.burgundy} />
                <Text style={styles.logCardTitle}>Live KOT Deductions (Last 15 Tickets)</Text>
              </View>

              {sessionConsumption.length === 0 ? (
                <View style={styles.emptyLog}>
                  <Text style={styles.emptyLogText}>No POS orders placed yet this shift</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {sessionConsumption.map((c) => (
                    <View key={c.id} style={styles.logRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logRowDish}>
                          {c.qty}x {c.menuItemName} {c.variantName ? `(${c.variantName})` : ''}
                        </Text>
                        <Text style={styles.logRowSub}>
                          KOT #{c.ticketId.slice(-4)} • Deducted {c.usage.length} ingredients
                        </Text>
                      </View>
                      <Text style={styles.logRowTime}>
                        {new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Right: Manual Taste / Petty Cash Receipts */}
            <View style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <Ionicons name="cash-outline" size={18} color={BRAND.goldDark} />
                <Text style={styles.logCardTitle}>Hand Cash Receipts & Taste Logs</Text>
              </View>

              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                {sessionCashEntries.map((cash) => (
                  <View key={cash.id} style={styles.cashLogRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashLogTitle}>Market: {cash.note}</Text>
                      <Text style={styles.cashLogSub}>Purchased by {cash.by}</Text>
                    </View>
                    <Text style={styles.cashLogAmount}>-{money(cash.amount)}</Text>
                  </View>
                ))}

                {sessionManualAdjustments.map((man) => {
                  const meta = MANUAL_REASON_META[man.reason];
                  return (
                    <View key={man.id} style={styles.cashLogRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cashLogTitle}>
                          {meta.label}: {man.itemName}
                        </Text>
                        <Text style={styles.cashLogSub}>{man.note || meta.hint}</Text>
                      </View>
                      <Text style={[styles.cashLogAmount, { color: man.delta > 0 ? BRAND.danger : BRAND.success }]}>
                        {man.delta > 0 ? `+${man.delta}` : `${man.delta}`}
                      </Text>
                    </View>
                  );
                })}

                {sessionCashEntries.length === 0 && sessionManualAdjustments.length === 0 && (
                  <View style={styles.emptyLog}>
                    <Text style={styles.emptyLogText}>No petty cash expenses or manual adjustments logged</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: TASTE / MASALA / SPOILAGE ADJUSTMENT MODAL */}
      <Modal visible={adjustModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Kitchen Taste & Spoilage Adjustment</Text>
                <Text style={styles.modalSubtitle}>Log recipe seasoning adjustments, batch variance, spills, or kitchen waste</Text>
              </View>
              <TouchableOpacity onPress={() => setAdjustModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Select Ingredient Dropdown */}
              <RoyalDropdown
                label="Select Kitchen Ingredient *"
                placeholder="Choose ingredient to adjust..."
                options={liveLines.map((l) => ({
                  label: `${l.itemName} (${l.unit})`,
                  value: l.itemId,
                  badge: `${formatQty(l.expectedOnHand, l.unit)} in kitchen`,
                }))}
                value={selectedAdjustItemId || ''}
                onSelect={(id) => setSelectedAdjustItemId(id)}
                icon="cube-outline"
                searchable
                style={{ marginBottom: 12 }}
              />

              {/* Quantity */}
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={adjustQty}
                    onChangeText={setAdjustQty}
                    keyboardType="numeric"
                    placeholder="e.g. 0.5"
                  />
                  {/* Quick Preset Increment Chips */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {[0.1, 0.25, 0.5, 1.0, 2.0].map((step) => (
                      <TouchableOpacity
                        key={step}
                        style={styles.quickStepChip}
                        onPress={() => {
                          const cur = parseFloat(adjustQty) || 0;
                          setAdjustQty(String(Number((cur + step).toFixed(2))));
                        }}
                      >
                        <Text style={styles.quickStepChipText}>+{step}</Text>
                      </TouchableOpacity>
                    ))}
                    {[-0.1, -0.25, -0.5].map((step) => (
                      <TouchableOpacity
                        key={step}
                        style={[styles.quickStepChip, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                        onPress={() => {
                          const cur = parseFloat(adjustQty) || 0;
                          const val = Math.max(0, cur + step);
                          setAdjustQty(val > 0 ? String(Number(val.toFixed(2))) : '');
                        }}
                      >
                        <Text style={[styles.quickStepChipText, { color: '#DC2626' }]}>{step}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.inputHint, { marginTop: 4 }]}>In ingredient&apos;s native kitchen unit</Text>
                </View>

                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Dish / Batch Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={adjustDish}
                    onChangeText={setAdjustDish}
                    placeholder="e.g. Sultan Karahi / Daal"
                  />
                </View>
              </View>

              {/* Reason Grid */}
              <Text style={styles.inputLabel}>Select Reason / Action</Text>
              <View style={styles.reasonGrid}>
                {Object.entries(MANUAL_REASON_META).map(([key, meta]) => {
                  const isSel = adjustReason === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.reasonCard, isSel && { borderColor: meta.color, backgroundColor: meta.color + '15' }]}
                      onPress={() => setAdjustReason(key as ManualUsageReason)}
                    >
                      <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                      <Text style={[styles.reasonLabel, isSel && { color: meta.color, fontWeight: '800' }]}>
                        {meta.label}
                      </Text>
                      <Text style={styles.reasonHint}>{meta.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Chef Note / Explanation</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                  multiline
                  placeholder="e.g. Customer requested extra spicy gravy, added 200g butter and 50g spice mix..."
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdjustModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAdjustment}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Record Adjustment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: LOCAL MARKET CASH PURCHASE MODAL */}
      <Modal visible={marketModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Local Market Emergency Purchase</Text>
                <Text style={styles.modalSubtitle}>Paid from Hand Cash: Available {money(remainingCashOnHand)}</Text>
              </View>
              <TouchableOpacity onPress={() => setMarketModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Amount Paid (Rs.)</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 16, fontWeight: '800' }]}
                    value={marketAmount}
                    onChangeText={setMarketAmount}
                    keyboardType="numeric"
                    placeholder="Rs. 500"
                  />
                </View>

                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Item Purchased</Text>
                  <TextInput
                    style={styles.input}
                    value={marketItemName}
                    onChangeText={setMarketItemName}
                    placeholder="e.g. Fresh Lemons & Coriander"
                  />
                </View>
              </View>

              {/* Link to existing kitchen inventory item (optional) */}
              <RoyalDropdown
                label="Link to Kitchen Stock Item (Optional)"
                placeholder="None (Ad-hoc expense)"
                options={[
                  { label: 'None (Ad-hoc expense / Not in standard inventory)', value: '' },
                  ...liveLines.map((l) => ({
                    label: `${l.itemName} (${l.unit})`,
                    value: l.itemId,
                    badge: `${formatQty(l.expectedOnHand, l.unit)}`,
                  })),
                ]}
                value={marketInvItemId || ''}
                onSelect={(val) => {
                  if (!val) {
                    setMarketInvItemId(undefined);
                  } else {
                    setMarketInvItemId(val);
                    const found = liveLines.find((l) => l.itemId === val);
                    if (found) setMarketItemName(found.itemName);
                  }
                }}
                icon="link-outline"
                searchable
                style={{ marginTop: 6, marginBottom: 12 }}
              />

              {marketInvItemId && (
                <View style={[styles.formCol, { marginTop: 10 }]}>
                  <Text style={styles.inputLabel}>Quantity Added to Kitchen</Text>
                  <TextInput
                    style={styles.input}
                    value={marketQty}
                    onChangeText={setMarketQty}
                    keyboardType="numeric"
                    placeholder="e.g. 2 (kg/pcs)"
                  />
                </View>
              )}

              <View style={[styles.formCol, { marginTop: 10 }]}>
                <Text style={styles.inputLabel}>Receipt / Vendor Note</Text>
                <TextInput
                  style={styles.input}
                  value={marketNote}
                  onChangeText={setMarketNote}
                  placeholder="e.g. Purchased fresh mint and lemons from local produce market"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMarketModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMarketPurchase}>
                <Ionicons name="cash" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Deduct Cash & Add Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: EOD PHYSICAL COUNT SUBMISSION FORM */}
      <Modal visible={closingModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: 800, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>End of Day Physical Kitchen Count</Text>
                <Text style={styles.modalSubtitle}>
                  Count actual items remaining in kitchen and physical cash returned to GM
                </Text>
              </View>
              <TouchableOpacity onPress={() => setClosingModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Cash Reconciliation Row */}
              <View style={styles.closeCashCard}>
                <Text style={styles.closeCashTitle}>Hand Cash Reconciliation</Text>
                <View style={styles.closeCashRow}>
                  <View style={styles.closeCashCol}>
                    <Text style={styles.closeCashLabel}>Initial Issued</Text>
                    <Text style={styles.closeCashVal}>{money(activeSession?.cashHandedOver || 0)}</Text>
                  </View>
                  <Text style={styles.mathOperator}>−</Text>
                  <View style={styles.closeCashCol}>
                    <Text style={styles.closeCashLabel}>Market Spent</Text>
                    <Text style={[styles.closeCashVal, { color: BRAND.danger }]}>{money(totalCashSpent)}</Text>
                  </View>
                  <Text style={styles.mathOperator}>=</Text>
                  <View style={styles.closeCashCol}>
                    <Text style={styles.closeCashLabel}>Expected Remaining</Text>
                    <Text style={[styles.closeCashVal, { color: BRAND.success }]}>{money(remainingCashOnHand)}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Physical Cash Handed Back to GM (Rs.)</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 16, fontWeight: '800' }]}
                    value={closingCashReturned}
                    onChangeText={setClosingCashReturned}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Physical Inventory Count Table */}
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.sectionHeaderTitle}>Count Kitchen Stock Items Remaining</Text>
                  <TouchableOpacity
                    style={styles.prefillBtn}
                    onPress={() => {
                      const initialMap: Record<string, string> = {};
                      liveLines.forEach((l) => {
                        initialMap[l.itemId] = String(roundQty(Math.max(0, l.expectedOnHand), l.unit));
                      });
                      setPhysicalCounts(initialMap);
                    }}
                  >
                    <Text style={styles.prefillBtnText}>Prefill Expected</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.countTableHeader}>
                  <Text style={[styles.th, { flex: 3 }]}>Item Name</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Total In</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Theoretical Used</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Expected Left</Text>
                  <Text style={[styles.th, { flex: 2.5, textAlign: 'right' }]}>Physical Count</Text>
                </View>

                {liveLines.map((line) => {
                  const currentVal = physicalCounts[line.itemId] ?? '';
                  const numVal = parseFloat(currentVal);
                  const variance = Number.isFinite(numVal) ? numVal - line.expectedOnHand : 0;

                  return (
                    <View key={line.itemId} style={styles.countTableRow}>
                      <View style={{ flex: 3 }}>
                        <Text style={styles.trItemName}>{line.itemName}</Text>
                        <Text style={styles.trCategory}>{line.category} ({line.unit})</Text>
                      </View>

                      <Text style={[styles.tr, { flex: 2, textAlign: 'right' }]}>
                        {formatQty(line.totalIn, line.unit)}
                      </Text>

                      <Text style={[styles.tr, { flex: 2, textAlign: 'right', color: BRAND.burgundy }]}>
                        {formatQty(line.theoreticalUsed + line.manualUsed, line.unit)}
                      </Text>

                      <Text style={[styles.tr, { flex: 2, textAlign: 'right', fontWeight: '700' }]}>
                        {formatQty(line.expectedOnHand, line.unit)}
                      </Text>

                      <View style={{ flex: 2.5, alignItems: 'flex-end' }}>
                        <TextInput
                          style={styles.countInput}
                          value={currentVal}
                          onChangeText={(text) =>
                            setPhysicalCounts((prev) => ({ ...prev, [line.itemId]: text }))
                          }
                          keyboardType="numeric"
                          placeholder="0"
                        />
                        {Number.isFinite(numVal) && Math.abs(variance) > 0.05 && (
                          <Text
                            style={[
                              styles.varianceSubText,
                              { color: variance < 0 ? BRAND.danger : BRAND.success },
                            ]}
                          >
                            {variance < 0 ? `Short by ${formatQty(Math.abs(variance), line.unit)}` : `Surplus +${formatQty(variance, line.unit)}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.formCol, { marginTop: 14 }]}>
                <Text style={styles.inputLabel}>Closing Notes for Admin / GM</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={closingNotes}
                  onChangeText={setClosingNotes}
                  multiline
                  placeholder="e.g. Marinated meats safely stored in chiller #2 for tomorrow morning shift..."
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setClosingModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmitClosingForm}>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Submit Counts for GM Restock</Text>
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
    backgroundColor: '#F7F4EE',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sessionBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
    marginBottom: 16,
  },
  bannerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  livePulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BRAND.success,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  bannerChef: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 2,
  },
  cashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BRAND.cream,
    borderWidth: 1,
    borderColor: BRAND.gold,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  cashBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  cashBadgeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  cashBadgeSub: {
    fontSize: 10,
    color: BRAND.goldDark,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0ECE1',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: BRAND.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pendingNoticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.ink,
  },
  pendingNoticeSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  viewApprovalBtn: {
    backgroundColor: BRAND.burgundy,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  viewApprovalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  noSessionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  noSessionSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  startRequisitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  startRequisitionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  tableControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  tableSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    width: 200,
  },
  searchInput: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: BRAND.ink,
    flex: 1,
  },
  quickAdjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0ECE1',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  quickAdjustBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  catChipsScroll: {
    flexGrow: 0,
    height: 38,
    maxHeight: 38,
    marginBottom: 8,
  },
  catChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F0ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: BRAND.burgundy,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  inventoryTable: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F0',
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
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  trRowCritical: {
    backgroundColor: '#FFEBEE44',
  },
  tr: {
    fontSize: 12,
    color: BRAND.ink,
  },
  trItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  trCategory: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 1,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusBadgeOk: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeLow: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeOut: {
    backgroundColor: '#FFEBEE',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tuneBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
  },
  dualCols: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  logCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    marginBottom: 8,
  },
  logCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  emptyLog: {
    padding: 24,
    alignItems: 'center',
  },
  emptyLogText: {
    fontSize: 12,
    color: BRAND.muted,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  logRowDish: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  logRowSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  logRowTime: {
    fontSize: 11,
    color: BRAND.muted,
  },
  cashLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  cashLogTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  cashLogSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  cashLogAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FAF7F0',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalBody: {
    padding: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: BRAND.ink,
  },
  inputHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 3,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  formCol: {
    marginBottom: 10,
  },
  ingPillRow: {
    gap: 6,
    marginBottom: 12,
  },
  ingPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
  },
  ingPillActive: {
    backgroundColor: BRAND.burgundy,
  },
  ingPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  ingPillTextActive: {
    color: '#FFFFFF',
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonCard: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#FDFBF7',
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 4,
  },
  reasonHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FAF7F0',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeCashCard: {
    backgroundColor: '#FDFBF7',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  closeCashTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginBottom: 8,
  },
  closeCashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  closeCashCol: {
    alignItems: 'center',
  },
  closeCashLabel: {
    fontSize: 10,
    color: BRAND.muted,
  },
  closeCashVal: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 2,
  },
  mathOperator: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.muted,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  prefillBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: BRAND.goldLight,
  },
  prefillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.goldDark,
  },
  countTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  countTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  countInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.gold,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
    width: 90,
    textAlign: 'right',
  },
  varianceSubText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  quickStepChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickStepChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  criticalAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  criticalAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  criticalAlertSub: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 2,
  },
  criticalAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  criticalAlertBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
