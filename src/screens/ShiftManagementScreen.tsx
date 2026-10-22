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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRestaurantStore } from '../store/restaurantStore';
import { useOpsStore } from '../store/opsStore';
import {
  useShiftStore,
  ShiftRecord,
  ShiftType,
  CashDenominations,
  INITIAL_DENOMINATIONS,
  calculateDenominationTotal,
} from '../store/shiftStore';

const REGISTER_OPTIONS = [
  'Counter #1 (Main Dining)',
  'Counter #2 (Family Hall)',
  'Takeaway & Delivery Counter',
  'Juice Bar & Cafe Counter',
];

const SHIFT_TYPES: { type: ShiftType; label: string; timing: string; icon: any }[] = [
  { type: 'Morning', label: 'Morning Shift', timing: '09:00 AM - 04:00 PM', icon: 'sunny-outline' },
  { type: 'Evening', label: 'Evening Dinner Rush', timing: '04:00 PM - 12:00 AM', icon: 'moon-outline' },
  { type: 'Night', label: 'Night / Late Shift', timing: '12:00 AM - 05:00 AM', icon: 'cloudy-night-outline' },
];

export default function ShiftManagementScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Stores
  const user = useAuthStore((s) => s.user);
  const staff = useRestaurantStore((s) => s.staff);
  const invoices = useRestaurantStore((s) => s.invoices);
  const expenses = useOpsStore((s) => s.expenses);

  const shifts = useShiftStore((s) => s.shifts);
  const activeShiftId = useShiftStore((s) => s.activeShiftId);
  const openShift = useShiftStore((s) => s.openShift);
  const closeShiftBlind = useShiftStore((s) => s.closeShiftBlind);
  const auditShift = useShiftStore((s) => s.auditShift);
  const reopenShift = useShiftStore((s) => s.reopenShift);

  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  // State
  // If not admin/manager, always lock to Cashier Blind mode.
  const [viewMode, setViewMode] = useState<'cashier' | 'auditor'>(
    isManagerOrAdmin ? 'auditor' : 'cashier'
  );
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<ShiftRecord | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportModalType, setReportModalType] = useState<'X-Report' | 'Z-Report'>('Z-Report');
  const [auditNotesInput, setAuditNotesInput] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Form State: Open New Shift
  const [newShiftType, setNewShiftType] = useState<ShiftType>('Evening');
  const [newRegisterId, setNewRegisterId] = useState(REGISTER_OPTIONS[0]);
  const [newCashierId, setNewCashierId] = useState(user?.staffId || staff[0]?.id || 'st1');
  const [newCashierName, setNewCashierName] = useState(user?.name || staff[0]?.name || 'Cashier');
  const [newOpeningFloat, setNewOpeningFloat] = useState('5000');
  const [newOpeningNotes, setNewOpeningNotes] = useState('');

  // Form State: Blind Cashier Shift Close
  const [blindInputMethod, setBlindInputMethod] = useState<'denomination' | 'direct'>('denomination');
  const [directCountedCash, setDirectCountedCash] = useState('');
  const [denominations, setDenominations] = useState<CashDenominations>(INITIAL_DENOMINATIONS);
  const [cardSlipsCount, setCardSlipsCount] = useState('');
  const [cardSlipsTotal, setCardSlipsTotal] = useState('');
  const [cashierNotes, setCashierNotes] = useState('');
  const [blindSubmittedSuccess, setBlindSubmittedSuccess] = useState(false);

  // Active shift - strictly bound to activeShiftId
  const activeShift = useMemo(() => {
    if (activeShiftId) {
      return shifts.find((s) => s.id === activeShiftId && s.status === 'open') || null;
    }
    return null;
  }, [shifts, activeShiftId]);

  // Denomination computed total
  const calculatedDenomTotal = useMemo(() => {
    return calculateDenominationTotal(denominations);
  }, [denominations]);

  const effectiveCashierCount = useMemo(() => {
    if (blindInputMethod === 'denomination') {
      return calculatedDenomTotal;
    }
    return parseFloat(directCountedCash) || 0;
  }, [blindInputMethod, calculatedDenomTotal, directCountedCash]);

  // Live financials calculation for the active shift (calculated internally by system)
  const shiftFinancials = useMemo(() => {
    if (!activeShift) {
      return {
        cashSales: 0,
        cardSales: 0,
        onlineSales: 0,
        totalSales: 0,
        ordersCount: 0,
        cashPayouts: 0,
        expectedCash: 0,
      };
    }

    const startT = activeShift.openedAt;
    const endT = activeShift.closedAt || Date.now();

    const shiftInvoices = (invoices || []).filter((inv) => {
      if (inv.status === 'voided') return false;
      const t = inv.timeSettled || inv.timePlaced;
      return t >= startT && t <= endT;
    });

    let cashSales = 0;
    let cardSales = 0;
    let onlineSales = 0;

    shiftInvoices.forEach((inv) => {
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach((p) => {
          if (p.type === 'cash') cashSales += p.amount;
          else if (p.type === 'card') cardSales += p.amount;
          else if (p.type === 'online') onlineSales += p.amount;
        });
      } else if (inv.status === 'settled' || !inv.status) {
        cashSales += inv.total || 0;
      }
    });

    const shiftExpenses = (expenses || []).filter((e) => {
      return e.method === 'cash' && e.at >= startT && e.at <= endT;
    });
    const cashPayouts = shiftExpenses.reduce((sum, e) => sum + e.amount, 0);
    const expectedCash = activeShift.openingFloat + cashSales - cashPayouts;

    return {
      cashSales,
      cardSales,
      onlineSales,
      totalSales: cashSales + cardSales + onlineSales,
      ordersCount: shiftInvoices.length,
      cashPayouts,
      expectedCash,
    };
  }, [activeShift, invoices, expenses]);

  // Handlers
  const handleStartShift = () => {
    const floatNum = parseFloat(newOpeningFloat) || 0;
    if (floatNum < 0) {
      Alert.alert('Invalid Float', 'Please enter a valid opening float amount.');
      return;
    }

    const created = openShift({
      shiftType: newShiftType,
      registerId: newRegisterId,
      cashierId: newCashierId,
      cashierName: newCashierName,
      openedBy: user?.name ? `${user.name} (${user.role || 'Staff'})` : 'Duty Manager',
      openingFloat: floatNum,
      openingNotes: newOpeningNotes.trim() || undefined,
    });

    // Reset blind form
    setDirectCountedCash('');
    setDenominations(INITIAL_DENOMINATIONS);
    setCardSlipsCount('');
    setCardSlipsTotal('');
    setCashierNotes('');
    setBlindSubmittedSuccess(false);

    Alert.alert('Shift Opened', `Shift ${created.id} is now LIVE on ${created.registerId}.`);
  };

  const handleBlindCloseSubmit = () => {
    if (!activeShift) return;

    if (effectiveCashierCount <= 0) {
      Alert.alert(
        'Physical Cash Count Required',
        'Please enter the counted cash amount or bill denominations before submitting.'
      );
      return;
    }

    const closed = closeShiftBlind(activeShift.id, {
      countedCash: effectiveCashierCount,
      denominations: blindInputMethod === 'denomination' ? denominations : undefined,
      cardSlipsCount: cardSlipsCount ? parseInt(cardSlipsCount, 10) : undefined,
      cardSlipsTotal: cardSlipsTotal ? parseFloat(cardSlipsTotal) : undefined,
      cashierNotes: cashierNotes.trim() || undefined,
      closedBy: user?.name ? `${user.name} (${user.role || 'Cashier'})` : activeShift.cashierName,
      closedRole: user?.role || 'Cashier',
      systemCashSales: shiftFinancials.cashSales,
      systemCardSales: shiftFinancials.cardSales,
      systemOnlineSales: shiftFinancials.onlineSales,
      settledOrdersCount: shiftFinancials.ordersCount,
      cashPayouts: shiftFinancials.cashPayouts,
    });

    if (closed) {
      setBlindSubmittedSuccess(true);
      setSelectedShiftForDetail(closed);
      setActiveTab('history');
      Alert.alert(
        'Shift Closed & Sealed',
        `Shift ${closed.id} successfully closed! Physical cash count submitted for Manager Audit.`
      );
    }
  };

  const handleAuditApprove = (shiftId: string) => {
    auditShift(shiftId, {
      auditedBy: user?.name ? `${user.name} (${user.role})` : 'Executive Auditor',
      auditNotes: auditNotesInput.trim() || 'Shift reconciled and verified with CCTV & cash physical drop.',
      isApproved: true,
    });
    setAuditNotesInput('');
    Alert.alert('Shift Audited', 'Shift marked as officially audited & sealed.');
  };

  const handleUpdateDenomination = (key: keyof CashDenominations, val: string) => {
    const num = parseInt(val, 10) || 0;
    setDenominations((prev) => ({
      ...prev,
      [key]: num >= 0 ? num : 0,
    }));
  };

  const openReportModal = (type: 'X-Report' | 'Z-Report', shift?: ShiftRecord) => {
    setReportModalType(type);
    if (shift) setSelectedShiftForDetail(shift);
    setShowReportModal(true);
  };

  const handlePrint = () => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      Alert.alert('Printing Slip', 'Sending report to Sultan Thermal Receipt Printer...');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/manager/dashboard'))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Shift & Cash Drawer Management</Text>
            <Text style={styles.headerSubtitle}>
              {activeShift
                ? `Active: ${activeShift.id} • ${activeShift.registerId}`
                : 'No active shift open'}
            </Text>
          </View>
        </View>

        {/* View Mode Toggle (Manager/Admin Only) */}
        <View style={styles.headerRight}>
          {isManagerOrAdmin ? (
            <View style={styles.modeToggleShell}>
              <TouchableOpacity
                style={[styles.modeToggleBtn, viewMode === 'auditor' && styles.modeToggleBtnActive]}
                onPress={() => setViewMode('auditor')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={viewMode === 'auditor' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modeToggleText,
                    viewMode === 'auditor' && styles.modeToggleTextActive,
                  ]}
                >
                  Auditor View
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeToggleBtn, viewMode === 'cashier' && styles.modeToggleBtnActive]}
                onPress={() => setViewMode('cashier')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="lock-closed"
                  size={14}
                  color={viewMode === 'cashier' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modeToggleText,
                    viewMode === 'cashier' && styles.modeToggleTextActive,
                  ]}
                >
                  Cashier Blind Close
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cashierLockBadge}>
              <Ionicons name="lock-closed" size={13} color="#B48214" />
              <Text style={styles.cashierLockBadgeText}>Cashier Blind Mode (Sales Hidden)</Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeShift ? 'radio-button-on' : 'play-circle-outline'}
            size={16}
            color={activeTab === 'active' ? '#52171B' : '#64748B'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
            {activeShift ? 'Live Shift Console' : 'Start New Shift'}
          </Text>
          {activeShift && <View style={styles.livePulseDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'history' ? '#52171B' : '#64748B'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            Shift Audit History ({shifts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
        {/* ======================================================== */}
        {/* TAB 1: ACTIVE / OPEN SHIFT OR START NEW SHIFT           */}
        {/* ======================================================== */}
        {activeTab === 'active' && (
          <>
            {/* CASE A: NO ACTIVE SHIFT -> START NEW SHIFT FORM */}
            {!activeShift && (
              <View style={styles.formCard}>
                <View style={styles.formHeader}>
                  <View style={styles.formIconBadge}>
                    <Ionicons name="key-outline" size={24} color="#52171B" />
                  </View>
                  <View>
                    <Text style={styles.formTitle}>Open Cash Drawer & Start Shift</Text>
                    <Text style={styles.formSub}>
                      Select register, cashier, and starting cash float to begin operations.
                    </Text>
                  </View>
                </View>

                {/* Shift Type Selection */}
                <Text style={styles.fieldLabel}>Select Shift Type</Text>
                <View style={styles.shiftTypeGrid}>
                  {SHIFT_TYPES.map((st) => (
                    <TouchableOpacity
                      key={st.type}
                      style={[
                        styles.shiftTypeCard,
                        newShiftType === st.type && styles.shiftTypeCardActive,
                      ]}
                      onPress={() => setNewShiftType(st.type)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={st.icon}
                        size={22}
                        color={newShiftType === st.type ? '#52171B' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.shiftTypeLabel,
                          newShiftType === st.type && styles.shiftTypeLabelActive,
                        ]}
                      >
                        {st.label}
                      </Text>
                      <Text style={styles.shiftTypeTiming}>{st.timing}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Register Selection */}
                <Text style={styles.fieldLabel}>Register / POS Counter</Text>
                <View style={styles.registerChipsRow}>
                  {REGISTER_OPTIONS.map((reg) => (
                    <TouchableOpacity
                      key={reg}
                      style={[
                        styles.chipBtn,
                        newRegisterId === reg && styles.chipBtnActive,
                      ]}
                      onPress={() => setNewRegisterId(reg)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="desktop-outline"
                        size={14}
                        color={newRegisterId === reg ? '#FFFFFF' : '#475569'}
                      />
                      <Text
                        style={[
                          styles.chipBtnText,
                          newRegisterId === reg && styles.chipBtnTextActive,
                        ]}
                      >
                        {reg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Cashier Selection */}
                <View style={styles.formRowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Cashier / Operator</Text>
                    <View style={styles.cashierSelectContainer}>
                      {staff.map((st) => (
                        <TouchableOpacity
                          key={st.id}
                          style={[
                            styles.cashierChip,
                            newCashierId === st.id && styles.cashierChipActive,
                          ]}
                          onPress={() => {
                            setNewCashierId(st.id);
                            setNewCashierName(st.name);
                          }}
                        >
                          <Text
                            style={[
                              styles.cashierChipText,
                              newCashierId === st.id && styles.cashierChipTextActive,
                            ]}
                          >
                            {st.name} ({st.role})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Text style={styles.fieldLabel}>Opening Cash Float (Petty Change in Drawer)</Text>
                    <View style={styles.inputBoxWithIcon}>
                      <Text style={styles.inputPrefix}>Rs.</Text>
                      <TextInput
                        style={styles.textInputBold}
                        value={newOpeningFloat}
                        onChangeText={setNewOpeningFloat}
                        keyboardType="numeric"
                        placeholder="5000"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <Text style={styles.inputHelpText}>
                      Standard float: Rs. 5,000 in small change (50s, 100s, 500s).
                    </Text>
                  </View>
                </View>

                {/* Opening Notes */}
                <Text style={styles.fieldLabel}>Opening Remarks (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 70 }]}
                  value={newOpeningNotes}
                  onChangeText={setNewOpeningNotes}
                  placeholder="e.g. Clean cash drawer verified with 5k float..."
                  placeholderTextColor="#94A3B8"
                  multiline
                />

                {/* Submit Open Shift */}
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleStartShift}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>
                    Open Cash Drawer & Start Shift (شفٹ شروع کریں)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CASE B: ACTIVE SHIFT IS CURRENTLY OPEN */}
            {activeShift && (
              <>
                {/* Active Shift Header Badge */}
                <View
                  {...(Platform.OS === 'web' ? ({ className: 'interactive-card' } as any) : {})}
                  style={styles.activeShiftBanner}
                >
                  <View style={styles.activeBannerLeft}>
                    <View style={styles.activeStatusPill}>
                      <View
                        {...(Platform.OS === 'web' ? ({ className: 'pulse-beacon' } as any) : {})}
                        style={styles.greenPulseDot}
                      />
                      <Text style={styles.activeStatusPillText}>REGISTER LIVE • {activeShift.shiftType.toUpperCase()} SHIFT</Text>
                    </View>
                    <Text style={styles.activeShiftTitle}>{activeShift.registerId}</Text>
                    <Text style={styles.activeShiftMeta}>
                      Shift ID: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{activeShift.id}</Text> • 
                      Cashier: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{activeShift.cashierName}</Text> • 
                      Opened: {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {/* Mid-Shift X-Report for Manager Audit (only via modal) */}
                  {isManagerOrAdmin && (
                    <View style={styles.activeBannerRight}>
                      <TouchableOpacity
                        style={styles.secondarySmallBtn}
                        onPress={() => openReportModal('X-Report', activeShift)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text-outline" size={15} color="#52171B" />
                        <Text style={styles.secondarySmallBtnText}>Mid-Shift X-Report Slip</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* CASHIER BLIND CLOSE WORKFLOW */}
                <View style={styles.blindCloseCard}>
                  {/* Alert Header explaining Blind Shift Close */}
                  <View style={styles.blindPolicyAlert}>
                    <Ionicons name="lock-closed" size={24} color="#B48214" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.blindPolicyTitle}>
                        Blind Cash Drawer Drop Policy (بلائنڈ کیش کلوزنگ پالیسی)
                      </Text>
                      <Text style={styles.blindPolicyText}>
                        Cashiers count the physical drawer cash independently without viewing system sales.
                        The system will seal the count and compare with expected revenue for Manager Audit.
                      </Text>
                    </View>
                  </View>

                  {/* Input Method Selector: Denominations vs Direct */}
                  <View style={styles.methodSelectorRow}>
                    <TouchableOpacity
                      style={[
                        styles.methodBtn,
                        blindInputMethod === 'denomination' && styles.methodBtnActive,
                      ]}
                      onPress={() => setBlindInputMethod('denomination')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="calculator-outline"
                        size={16}
                        color={blindInputMethod === 'denomination' ? '#52171B' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.methodBtnText,
                          blindInputMethod === 'denomination' && styles.methodBtnTextActive,
                        ]}
                      >
                        Count Notes by Denominations (نوٹوں کی گنتی)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.methodBtn,
                        blindInputMethod === 'direct' && styles.methodBtnActive,
                      ]}
                      onPress={() => setBlindInputMethod('direct')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="cash-outline"
                        size={16}
                        color={blindInputMethod === 'direct' ? '#52171B' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.methodBtnText,
                          blindInputMethod === 'direct' && styles.methodBtnTextActive,
                        ]}
                      >
                        Direct Lump-Sum Total (براہ راست رقم)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* METHOD 1: DENOMINATION COUNTER */}
                  {blindInputMethod === 'denomination' ? (
                    <View style={styles.denominationSection}>
                      <Text style={styles.sectionSubtitle}>
                        Enter note counts physically in drawer:
                      </Text>

                      <View style={styles.denomGrid}>
                        {/* 5000 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#78350F' }]}>
                            <Text style={styles.noteBadgeText}>₨. 5,000</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d5000 ? String(denominations.d5000) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d5000', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d5000 || 0) * 5000).toLocaleString()}
                          </Text>
                        </View>

                        {/* 1000 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#1E3A8A' }]}>
                            <Text style={styles.noteBadgeText}>₨. 1,000</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d1000 ? String(denominations.d1000) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d1000', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d1000 || 0) * 1000).toLocaleString()}
                          </Text>
                        </View>

                        {/* 500 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#065F46' }]}>
                            <Text style={styles.noteBadgeText}>₨. 500</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d500 ? String(denominations.d500) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d500', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d500 || 0) * 500).toLocaleString()}
                          </Text>
                        </View>

                        {/* 100 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#991B1B' }]}>
                            <Text style={styles.noteBadgeText}>₨. 100</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d100 ? String(denominations.d100) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d100', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d100 || 0) * 100).toLocaleString()}
                          </Text>
                        </View>

                        {/* 50 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#6B21A8' }]}>
                            <Text style={styles.noteBadgeText}>₨. 50</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d50 ? String(denominations.d50) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d50', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d50 || 0) * 50).toLocaleString()}
                          </Text>
                        </View>

                        {/* 20 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#C2410C' }]}>
                            <Text style={styles.noteBadgeText}>₨. 20</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d20 ? String(denominations.d20) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d20', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d20 || 0) * 20).toLocaleString()}
                          </Text>
                        </View>

                        {/* 10 */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#15803D' }]}>
                            <Text style={styles.noteBadgeText}>₨. 10</Text>
                          </View>
                          <Text style={styles.timesSign}>×</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.d10 ? String(denominations.d10) : ''}
                            onChangeText={(t) => handleUpdateDenomination('d10', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {((denominations.d10 || 0) * 10).toLocaleString()}
                          </Text>
                        </View>

                        {/* Coins */}
                        <View style={styles.denomRow}>
                          <View style={[styles.noteBadge, { backgroundColor: '#64748B' }]}>
                            <Text style={styles.noteBadgeText}>Coins / چینج</Text>
                          </View>
                          <Text style={styles.timesSign}>=</Text>
                          <TextInput
                            style={styles.denomCountInput}
                            value={denominations.coins ? String(denominations.coins) : ''}
                            onChangeText={(t) => handleUpdateDenomination('coins', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                          />
                          <Text style={styles.denomTotalText}>
                            = Rs. {(denominations.coins || 0).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      {/* Denomination Total Display (Cashier Sees Their Own Count Only) */}
                      <View style={styles.denomTotalCard}>
                        <Text style={styles.denomTotalCardLabel}>Total Cash Counted in Drawer:</Text>
                        <Text style={styles.denomTotalCardValue}>
                          Rs. {calculatedDenomTotal.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* METHOD 2: DIRECT INPUT */
                    <View style={styles.directInputSection}>
                      <Text style={styles.fieldLabel}>Total Counted Cash in Drawer (کل گنتی شدہ رقم)</Text>
                      <View style={[styles.inputBoxWithIcon, { paddingVertical: 10 }]}>
                        <Text style={[styles.inputPrefix, { fontSize: 24 }]}>Rs.</Text>
                        <TextInput
                          style={[styles.textInputBold, { fontSize: 28 }]}
                          value={directCountedCash}
                          onChangeText={setDirectCountedCash}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  )}

                  {/* Card Terminal Slips Count */}
                  <View style={styles.formRowTwoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>POS Card Slips Count (سلپس کی تعداد)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={cardSlipsCount}
                        onChangeText={setCardSlipsCount}
                        keyboardType="numeric"
                        placeholder="e.g. 14 slips"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Total Card Slips Amount (سلپس کی کل رقم)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={cardSlipsTotal}
                        onChangeText={setCardSlipsTotal}
                        keyboardType="numeric"
                        placeholder="e.g. 25000"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Handover Notes */}
                  <Text style={styles.fieldLabel}>Cashier Handover Notes (ہینڈ اوور کے ریمارکس)</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60 }]}
                    value={cashierNotes}
                    onChangeText={setCashierNotes}
                    placeholder="e.g. Handed over drawer keys & cash drop envelope to Manager..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  {/* Submit Blind Close Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitCloseBtn,
                      effectiveCashierCount <= 0 && styles.submitCloseBtnDisabled,
                    ]}
                    onPress={handleBlindCloseSubmit}
                    disabled={effectiveCashierCount <= 0}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                    <Text style={styles.submitCloseBtnText}>
                      🔒 Submit Counted Cash & Close Shift (کیش جمع کر کے شفٹ بند کریں)
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.submitHintText}>
                    Upon submission, cash drawer will be locked and sent for Manager Audit.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SHIFT AUDIT HISTORY & PAST LOGS                  */}
        {/* ======================================================== */}
        {activeTab === 'history' && (
          <View style={styles.historyDeck}>
            <View style={styles.historyHeaderRow}>
              <View>
                <Text style={styles.historyTitle}>Shift Reconciliation & Audit Ledger</Text>
                <Text style={styles.historySub}>
                  Historical shift records with blind cashier counts vs expected drawer sales.
                </Text>
              </View>
            </View>

            {shifts.map((s) => {
              const isClosed = s.status === 'closed' || s.status === 'audited';
              const variance = s.cashVariance ?? 0;
              const isShortage = variance < 0;
              const isOverage = variance > 0;
              const isBalanced = variance === 0 && isClosed;

              return (
                <View key={s.id} style={styles.historyCard}>
                  {/* Card Header */}
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyHeaderLeft}>
                      <View
                        style={[
                          styles.shiftTypeBadge,
                          s.shiftType === 'Morning'
                            ? styles.badgeMorning
                            : s.shiftType === 'Evening'
                            ? styles.badgeEvening
                            : styles.badgeNight,
                        ]}
                      >
                        <Text style={styles.shiftTypeBadgeText}>{s.shiftType.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.historyCardTitle}>{s.id}</Text>
                      <Text style={styles.historyCardRegister}>• {s.registerId}</Text>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.auditStatusPill,
                        s.status === 'open'
                          ? styles.pillOpen
                          : s.status === 'audited'
                          ? styles.pillAudited
                          : styles.pillClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.auditStatusPillText,
                          s.status === 'open'
                            ? styles.pillTextOpen
                            : s.status === 'audited'
                            ? styles.pillTextAudited
                            : styles.pillTextClosed,
                        ]}
                      >
                        {s.status === 'open'
                          ? 'LIVE REGISTER'
                          : s.status === 'audited'
                          ? 'OFFICIALLY AUDITED'
                          : 'PENDING AUDIT'}
                      </Text>
                    </View>
                  </View>

                  {/* Operator Info */}
                  <View style={styles.historyOperatorRow}>
                    <Text style={styles.historyOpText}>
                      👤 Cashier: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{s.cashierName}</Text>
                    </Text>
                    <Text style={styles.historyOpText}>
                      🕒 Opened: {new Date(s.openedAt).toLocaleString()}
                    </Text>
                    {s.closedAt && (
                      <Text style={styles.historyOpText}>
                        🏁 Closed: {new Date(s.closedAt).toLocaleTimeString()} by {s.closedBy}
                      </Text>
                    )}
                  </View>

                  {/* Financial Grid (Visible to Auditor or for Closed Shifts) */}
                  {isClosed && (
                    <View style={styles.historyFinancialGrid}>
                      <View style={styles.historyFinCol}>
                        <Text style={styles.finColLabel}>Opening Float</Text>
                        <Text style={styles.finColVal}>Rs. {s.openingFloat.toLocaleString()}</Text>
                      </View>

                      <View style={styles.historyFinCol}>
                        <Text style={styles.finColLabel}>System Cash Sales</Text>
                        <Text style={[styles.finColVal, { color: '#10B981' }]}>
                          + Rs. {(s.systemCashSales || 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.historyFinCol}>
                        <Text style={styles.finColLabel}>Card / Digital</Text>
                        <Text style={styles.finColVal}>
                          Rs. {((s.systemCardSales || 0) + (s.systemOnlineSales || 0)).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.historyFinCol}>
                        <Text style={styles.finColLabel}>Expected Cash</Text>
                        <Text style={[styles.finColVal, { fontWeight: '800' }]}>
                          Rs. {(s.expectedCashInDrawer || 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.historyFinCol}>
                        <Text style={styles.finColLabel}>Cashier Blind Count</Text>
                        <Text style={[styles.finColVal, { color: '#52171B', fontWeight: '800' }]}>
                          Rs. {(s.actualCountedCash || 0).toLocaleString()}
                        </Text>
                      </View>

                      {/* Variance Indicator */}
                      <View
                        style={[
                          styles.varianceCol,
                          isBalanced
                            ? styles.varBalanced
                            : isShortage
                            ? styles.varShortage
                            : styles.varOverage,
                        ]}
                      >
                        <Text style={styles.varLabel}>
                          {isBalanced ? 'EXACT MATCH' : isShortage ? 'SHORTAGE' : 'OVERAGE'}
                        </Text>
                        <Text
                          style={[
                            styles.varVal,
                            {
                              color: isBalanced
                                ? '#059669'
                                : isShortage
                                ? '#DC2626'
                                : '#2563EB',
                            },
                          ]}
                        >
                          {isBalanced
                            ? 'Balanced (0)'
                            : isShortage
                            ? `- Rs. ${Math.abs(variance).toLocaleString()}`
                            : `+ Rs. ${variance.toLocaleString()}`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Cashier Handover Note */}
                  {s.cashierNotes && (
                    <View style={styles.noteBox}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color="#64748B" />
                      <Text style={styles.noteBoxText}>
                        Cashier Note: "{s.cashierNotes}"
                      </Text>
                    </View>
                  )}

                  {/* Audit Note & Approval Info */}
                  {s.auditNotes && (
                    <View style={styles.auditApprovalBox}>
                      <Ionicons name="shield-checkmark" size={15} color="#059669" />
                      <Text style={styles.auditApprovalText}>
                        Audited by {s.auditedBy}: "{s.auditNotes}"
                      </Text>
                    </View>
                  )}

                  {/* Actions Row */}
                  <View style={styles.historyActionsRow}>
                    {/* View Z-Report */}
                    {isClosed && (
                      <TouchableOpacity
                        style={styles.historyReportBtn}
                        onPress={() => openReportModal('Z-Report', s)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="receipt-outline" size={15} color="#52171B" />
                        <Text style={styles.historyReportBtnText}>View Z-Report Receipt</Text>
                      </TouchableOpacity>
                    )}

                    {/* Manager Audit Approval (if pending) */}
                    {isManagerOrAdmin && s.status === 'closed' && (
                      <TouchableOpacity
                        style={styles.approveAuditBtn}
                        onPress={() => handleAuditApprove(s.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                        <Text style={styles.approveAuditBtnText}>Approve & Sign-Off Audit</Text>
                      </TouchableOpacity>
                    )}

                    {/* Reopen Shift (if manager needs correction) */}
                    {isManagerOrAdmin && isClosed && (
                      <TouchableOpacity
                        style={styles.reopenSmallBtn}
                        onPress={() => {
                          Alert.alert(
                            'Reopen Register?',
                            `Are you sure you want to reopen shift ${s.id}?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Reopen', onPress: () => reopenShift(s.id, user?.name || 'Manager') },
                            ]
                          );
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh-outline" size={14} color="#64748B" />
                        <Text style={styles.reopenSmallBtnText}>Reopen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: OFFICIAL X-REPORT / Z-REPORT SLIP                 */}
      {/* ======================================================== */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.receiptBox, isMobile && styles.receiptBoxMobile]}>
            {/* Kanaf Cafe & Bakery Branding */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>KANAF CAFE & BAKERY</Text>
              <Text style={styles.receiptTagline}>ARTISAN BAKERY & SPECIALTY COFFEE</Text>
              <View style={styles.reportTypeBadge}>
                <Text style={styles.reportTypeBadgeText}>
                  {reportModalType === 'X-Report'
                    ? 'MID-SHIFT AUDIT (X-REPORT)'
                    : 'FINAL CLOSING RECONCILIATION (Z-REPORT)'}
                </Text>
              </View>
              <Text style={styles.receiptDateTime}>
                Date: {new Date().toLocaleDateString()} • Time: {new Date().toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.receiptDashedDivider} />

            {/* Shift Metadata */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Shift Reference:</Text>
              <Text style={styles.receiptVal}>
                {selectedShiftForDetail?.id || activeShift?.id || 'SH-LIVE'}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Register / Terminal:</Text>
              <Text style={styles.receiptVal}>
                {selectedShiftForDetail?.registerId || activeShift?.registerId}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Cashier on Duty:</Text>
              <Text style={styles.receiptVal}>
                {selectedShiftForDetail?.cashierName || activeShift?.cashierName}
              </Text>
            </View>

            <View style={styles.receiptDashedDivider} />

            {/* Financial Breakdown */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Opening Cash Float:</Text>
              <Text style={styles.receiptVal}>
                Rs. {(selectedShiftForDetail?.openingFloat ?? activeShift?.openingFloat ?? 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Cash Orders Revenue:</Text>
              <Text style={[styles.receiptVal, { color: '#059669', fontWeight: '700' }]}>
                Rs. {((selectedShiftForDetail ? selectedShiftForDetail.systemCashSales : shiftFinancials.cashSales) || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Card / Digital Revenue:</Text>
              <Text style={styles.receiptVal}>
                Rs. {((selectedShiftForDetail ? (selectedShiftForDetail.systemCardSales || 0) + (selectedShiftForDetail.systemOnlineSales || 0) : shiftFinancials.cardSales + shiftFinancials.onlineSales)).toLocaleString()}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Cash Expenses Payout:</Text>
              <Text style={[styles.receiptVal, { color: '#DC2626' }]}>
                - Rs. {((selectedShiftForDetail ? selectedShiftForDetail.cashPayouts : shiftFinancials.cashPayouts) || 0).toLocaleString()}
              </Text>
            </View>

            <View style={styles.receiptDashedDivider} />

            {/* Expected vs Actual Count */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { fontWeight: '800', color: '#0F172A' }]}>
                Expected Cash in Drawer:
              </Text>
              <Text style={[styles.receiptVal, { fontWeight: '800', color: '#0F172A' }]}>
                Rs. {((selectedShiftForDetail ? selectedShiftForDetail.expectedCashInDrawer : shiftFinancials.expectedCash) || 0).toLocaleString()}
              </Text>
            </View>

            {selectedShiftForDetail?.actualCountedCash !== undefined && (
              <>
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { fontWeight: '800', color: '#52171B' }]}>
                    Cashier Counted Cash:
                  </Text>
                  <Text style={[styles.receiptVal, { fontWeight: '800', color: '#52171B' }]}>
                    Rs. {selectedShiftForDetail.actualCountedCash.toLocaleString()}
                  </Text>
                </View>

                {/* Variance */}
                <View style={[styles.receiptRow, { marginTop: 4 }]}>
                  <Text style={[styles.receiptLabel, { fontWeight: '900' }]}>Reconciliation Variance:</Text>
                  <Text
                    style={[
                      styles.receiptVal,
                      {
                        fontWeight: '900',
                        color:
                          (selectedShiftForDetail.cashVariance || 0) === 0
                            ? '#059669'
                            : (selectedShiftForDetail.cashVariance || 0) > 0
                            ? '#2563EB'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {(selectedShiftForDetail.cashVariance || 0) === 0
                      ? 'EXACT MATCH (Balanced)'
                      : (selectedShiftForDetail.cashVariance || 0) > 0
                      ? `+ Rs. ${selectedShiftForDetail.cashVariance?.toLocaleString()} (Overage)`
                      : `- Rs. ${Math.abs(selectedShiftForDetail.cashVariance || 0).toLocaleString()} (Shortage)`}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.receiptDashedDivider} />

            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>Shift Operator: {selectedShiftForDetail?.cashierName || user?.name}</Text>
              <Text style={styles.receiptFooterText}>Audited by: {selectedShiftForDetail?.auditedBy || 'Pending Manager Sign-off'}</Text>
              <Text style={styles.receiptFooterText}>System: Sultan Cloud POS Terminal</Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowReportModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrintBtn}
                onPress={handlePrint}
                activeOpacity={0.8}
              >
                <Ionicons name="print" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalPrintBtnText}>Print Thermal Slip</Text>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeToggleShell: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: '#52171B',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  cashierLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cashierLockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#52171B',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#52171B',
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 4,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    maxWidth: 1050,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  formIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  formSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  shiftTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shiftTypeCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  shiftTypeCardActive: {
    backgroundColor: '#FAF7F3',
    borderColor: '#52171B',
  },
  shiftTypeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  shiftTypeLabelActive: {
    color: '#52171B',
  },
  shiftTypeTiming: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  registerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipBtnActive: {
    backgroundColor: '#52171B',
    borderColor: '#52171B',
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
  },
  formRowTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  cashierSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cashierChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cashierChipActive: {
    backgroundColor: '#52171B',
    borderColor: '#52171B',
  },
  cashierChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  cashierChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputBoxWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  inputPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#94A3B8',
    marginRight: 8,
  },
  textInputBold: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 10,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    color: '#0F172A',
  },
  inputHelpText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#52171B',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 24,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  activeShiftBanner: {
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  activeBannerLeft: {
    flex: 1,
    minWidth: 260,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 8,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  activeShiftTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  activeShiftMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  activeBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondarySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondarySmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52171B',
  },
  auditorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  auditorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  auditorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  auditorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  confidentialNote: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricCardHighlight: {
    backgroundColor: '#FAF7F3',
    borderColor: '#E8DFC9',
    borderWidth: 1.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  blindCloseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  blindPolicyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  blindPolicyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  blindPolicyText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 18,
  },
  methodSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  methodBtnActive: {
    backgroundColor: '#FAF7F3',
    borderColor: '#52171B',
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  methodBtnTextActive: {
    color: '#52171B',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  denominationSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  denomGrid: {
    gap: 10,
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteBadge: {
    width: 86,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  timesSign: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  denomCountInput: {
    width: 90,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  denomTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  denomTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F3',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8DFC9',
    marginTop: 14,
  },
  denomTotalCardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#52171B',
  },
  denomTotalCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#52171B',
  },
  directInputSection: {
    marginBottom: 16,
  },
  submitCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#52171B',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  submitCloseBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitCloseBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  submitHintText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  historyDeck: {
    gap: 16,
  },
  historyHeaderRow: {
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  historySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeMorning: {
    backgroundColor: '#FEF3C7',
  },
  badgeEvening: {
    backgroundColor: '#F3E8FF',
  },
  badgeNight: {
    backgroundColor: '#E0E7FF',
  },
  shiftTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyCardRegister: {
    fontSize: 12,
    color: '#64748B',
  },
  auditStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pillClosed: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  pillAudited: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  auditStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillTextOpen: {
    color: '#047857',
  },
  pillTextClosed: {
    color: '#92400E',
  },
  pillTextAudited: {
    color: '#475569',
  },
  historyOperatorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  historyOpText: {
    fontSize: 12,
    color: '#475569',
  },
  historyFinancialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  historyFinCol: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  finColLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  finColVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  varianceCol: {
    flex: 1,
    minWidth: 130,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  varBalanced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  varShortage: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  varOverage: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  varLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  varVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  noteBoxText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  auditApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  auditApprovalText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  historyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  historyReportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52171B',
  },
  approveAuditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  approveAuditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reopenSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  reopenSmallBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  receiptBoxMobile: {
    padding: 18,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#52171B',
    letterSpacing: 1.5,
  },
  receiptTagline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B48214',
    letterSpacing: 1,
    marginTop: 2,
  },
  reportTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  reportTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptDateTime: {
    fontSize: 11,
    color: '#64748B',
  },
  receiptDashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  receiptLabel: {
    fontSize: 12,
    color: '#475569',
  },
  receiptVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  receiptFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  receiptFooterText: {
    fontSize: 10,
    color: '#94A3B8',
    marginVertical: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#52171B',
  },
  modalPrintBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
