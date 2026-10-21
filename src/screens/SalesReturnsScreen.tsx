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
  Share,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore, Invoice } from '../store/restaurantStore';
import { useAuthStore } from '../store/authStore';
import { useKitchenStore } from '../store/kitchenStore';
import { broadcastImmediately } from '../services/syncService';
import SultanLogo from '../components/SultanLogo';
import RoyalDropdown from '../components/RoyalDropdown';
import {
  SalesReturn,
  ReturnedItem,
  ReturnReasonCategory,
  ReturnedItemCondition,
  RefundMethod,
  RETURN_REASONS,
} from '../types/returns';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  burgundyLight: '#6B1F24',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  cream: '#FDFBF7',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
  surface: '#F8F9FA',
};

const money = (n: number) => `Rs. ${(Math.round(Number.isFinite(n) ? n : 0)).toLocaleString()}`;

interface SalesReturnsScreenProps {
  userRole: 'admin' | 'manager';
  backRoute?: string;
}

export default function SalesReturnsScreen({ userRole, backRoute = '/admin/dashboard' }: SalesReturnsScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const currentUserName = user?.name || (userRole === 'admin' ? 'Admin' : 'Manager');

  const { invoices, salesReturns, processSalesReturn } = useRestaurantStore();
  const recordManualUsage = useKitchenStore((s) => s.recordManualUsage);
  const activeKitchenSession = useKitchenStore((s) => s.kitchenSessions.find((x) => x.status === 'issued'));

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'full' | 'partial'>('all');

  // New Return Modal Wizard state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>('');
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [selectedReason, setSelectedReason] = useState<ReturnReasonCategory>('taste_quality');
  const [customReasonNotes, setCustomReasonNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');

  // Quantities & conditions per item for the selected invoice
  const [itemSelections, setItemSelections] = useState<
    Record<string, { qty: number; condition: ReturnedItemCondition }>
  >({});

  // Credit Note Slip Modal state
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);

  // Date Boundaries
  const dateRanges = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const endOfYesterday = startOfToday - 1;
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = startOfToday - 29 * 24 * 60 * 60 * 1000;
    return {
      today: startOfToday,
      yesterdayStart: startOfYesterday,
      yesterdayEnd: endOfYesterday,
      week: startOfWeek,
      month: startOfMonth,
    };
  }, []);

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    let list = [...(salesReturns || [])];

    // Date
    if (dateFilter === 'today') {
      list = list.filter((r) => r.returnedAt >= dateRanges.today);
    } else if (dateFilter === 'yesterday') {
      list = list.filter((r) => r.returnedAt >= dateRanges.yesterdayStart && r.returnedAt <= dateRanges.yesterdayEnd);
    } else if (dateFilter === 'week') {
      list = list.filter((r) => r.returnedAt >= dateRanges.week);
    } else if (dateFilter === 'month') {
      list = list.filter((r) => r.returnedAt >= dateRanges.month);
    }

    // Reason
    if (reasonFilter !== 'all') {
      list = list.filter((r) => r.reasonCategory === reasonFilter);
    }

    // Return Type
    if (typeFilter !== 'all') {
      list = list.filter((r) => r.returnType === typeFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const idMatch = r.id.toLowerCase().includes(q);
        const invMatch = r.invoiceId.toLowerCase().includes(q);
        const custMatch = r.customer?.name?.toLowerCase().includes(q) || r.customer?.phone?.includes(q);
        const tableMatch = r.tableName?.toLowerCase().includes(q);
        const itemMatch = r.items?.some((it) => it.name.toLowerCase().includes(q));
        const noteMatch = r.reasonNotes?.toLowerCase().includes(q);
        return idMatch || invMatch || custMatch || tableMatch || itemMatch || noteMatch;
      });
    }

    // Sort newest first
    list.sort((a, b) => b.returnedAt - a.returnedAt);
    return list;
  }, [salesReturns, dateFilter, reasonFilter, typeFilter, searchQuery, dateRanges]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    const list = filteredReturns.filter((r) => r.status !== 'cancelled');
    const totalRefunded = list.reduce((sum, r) => sum + r.refundAmount, 0);
    const fullCount = list.filter((r) => r.returnType === 'full').length;
    const partialCount = list.filter((r) => r.returnType === 'partial').length;

    let wastedValue = 0;
    let restockedValue = 0;

    list.forEach((r) => {
      r.items?.forEach((it) => {
        if (it.condition === 'waste') wastedValue += it.refundAmount || it.price * it.quantityReturned;
        else restockedValue += it.refundAmount || it.price * it.quantityReturned;
      });
    });

    return {
      count: list.length,
      totalRefunded,
      fullCount,
      partialCount,
      wastedValue,
      restockedValue,
    };
  }, [filteredReturns]);

  // Candidate invoices eligible for return (settled, not already 100% refunded)
  const candidateInvoices = useMemo(() => {
    return (invoices || [])
      .filter((inv) => inv.status !== 'voided' && inv.returnStatus !== 'full')
      .filter((inv) => {
        if (!invoiceSearchQuery.trim()) return true;
        const q = invoiceSearchQuery.toLowerCase().trim();
        return (
          inv.id.toLowerCase().includes(q) ||
          inv.tableName?.toLowerCase().includes(q) ||
          inv.customer?.name?.toLowerCase().includes(q) ||
          inv.customer?.phone?.includes(q)
        );
      })
      .sort((a, b) => (b.timeSettled || b.timePlaced) - (a.timeSettled || a.timePlaced))
      .slice(0, 25);
  }, [invoices, invoiceSearchQuery]);

  // Selected invoice for wizard
  const activeInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  // When active invoice changes, initialize item selections
  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoiceId(inv.id);
    const defaultReasonMeta = RETURN_REASONS.find((r) => r.id === selectedReason) || RETURN_REASONS[0];
    const initialMap: Record<string, { qty: number; condition: ReturnedItemCondition }> = {};
    inv.items?.forEach((item) => {
      initialMap[item.id] = {
        qty: item.qty, // Default to full qty
        condition: defaultReasonMeta.suggestedCondition,
      };
    });
    setItemSelections(initialMap);
  };

  // Switch return type: full selects all items with full qty, partial allows picking
  const handleSetReturnType = (type: 'full' | 'partial') => {
    setReturnType(type);
    if (!activeInvoice) return;
    const defaultReasonMeta = RETURN_REASONS.find((r) => r.id === selectedReason) || RETURN_REASONS[0];
    if (type === 'full') {
      const fullMap: Record<string, { qty: number; condition: ReturnedItemCondition }> = {};
      activeInvoice.items?.forEach((item) => {
        fullMap[item.id] = {
          qty: item.qty,
          condition: defaultReasonMeta.suggestedCondition,
        };
      });
      setItemSelections(fullMap);
    }
  };

  // Calculate live refund amount based on current item selections
  const calculatedRefund = useMemo(() => {
    if (!activeInvoice) return 0;
    if (returnType === 'full') {
      const alreadyRefunded = activeInvoice.refundAmount || 0;
      return Math.max(0, activeInvoice.total - alreadyRefunded);
    }

    // Partial: calculate proportional refund
    let sum = 0;
    activeInvoice.items?.forEach((item) => {
      const sel = itemSelections[item.id];
      if (sel && sel.qty > 0) {
        const itemLineTotal = item.price * sel.qty;
        sum += itemLineTotal;
      }
    });

    // If invoice had discount, calculate proportional discount reduction
    if (activeInvoice.subTotal > 0 && activeInvoice.discount > 0) {
      const discountRatio = activeInvoice.discount / activeInvoice.subTotal;
      sum = sum * (1 - discountRatio);
    }

    // Add proportional tax if tax was applied
    if (activeInvoice.subTotal > 0 && activeInvoice.tax > 0) {
      const taxRatio = activeInvoice.tax / activeInvoice.subTotal;
      sum = sum * (1 + taxRatio);
    }

    const alreadyRefunded = activeInvoice.refundAmount || 0;
    const remainingInvoiceMax = Math.max(0, activeInvoice.total - alreadyRefunded);
    return Math.min(Math.round(sum), remainingInvoiceMax);
  }, [activeInvoice, returnType, itemSelections]);

  // Submit return
  const handleSubmitReturn = () => {
    if (!activeInvoice) {
      Alert.alert('Required', 'Please select an invoice to return.');
      return;
    }

    const returnedItemsList: ReturnedItem[] = [];
    activeInvoice.items?.forEach((item) => {
      const sel = itemSelections[item.id];
      if (sel && sel.qty > 0) {
        const itemLineTotal = item.price * sel.qty;
        let lineRefund = itemLineTotal;
        if (activeInvoice.subTotal > 0 && activeInvoice.discount > 0) {
          lineRefund = lineRefund * (1 - activeInvoice.discount / activeInvoice.subTotal);
        }
        if (activeInvoice.subTotal > 0 && activeInvoice.tax > 0) {
          lineRefund = lineRefund * (1 + activeInvoice.tax / activeInvoice.subTotal);
        }
        returnedItemsList.push({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantityPurchased: item.qty,
          quantityReturned: sel.qty,
          condition: sel.condition,
          refundAmount: Math.round(lineRefund),
          reason: selectedReason,
        });
      }
    });

    if (returnedItemsList.length === 0) {
      Alert.alert('Validation', 'Please select at least 1 item with quantity to return.');
      return;
    }

    if (calculatedRefund <= 0) {
      Alert.alert('Validation', 'Refund amount must be greater than 0.');
      return;
    }

    const res = processSalesReturn({
      invoiceId: activeInvoice.id,
      orderType: activeInvoice.orderType,
      tableName: activeInvoice.tableName,
      tableId: activeInvoice.tableId,
      customer: activeInvoice.customer,
      processedBy: currentUserName,
      returnType,
      items: returnedItemsList,
      reasonCategory: selectedReason,
      reasonNotes: customReasonNotes.trim() || undefined,
      refundAmount: calculatedRefund,
      refundMethod,
    });

    if (!res.ok) {
      Alert.alert('Error', res.error || 'Failed to process sales return.');
      return;
    }

    // If culinary waste, record in kitchenManualUsage so kitchen stock accounting reflects the discard
    if (activeKitchenSession) {
      returnedItemsList.forEach((it) => {
        if (it.condition === 'waste') {
          recordManualUsage({
            sessionId: activeKitchenSession.id,
            itemId: it.itemId,
            qty: it.quantityReturned,
            reason: 'spoilage',
            dish: it.name,
            note: `[Sales Return #${res.id}] Reason: ${selectedReason}. ${customReasonNotes.trim()}`,
            by: currentUserName,
          });
        }
      });
    }

    broadcastImmediately();

    // Find the newly created return and open thermal receipt
    const createdReturn: SalesReturn = {
      id: res.id,
      invoiceId: activeInvoice.id,
      orderType: activeInvoice.orderType,
      tableName: activeInvoice.tableName,
      tableId: activeInvoice.tableId,
      customer: activeInvoice.customer,
      returnedAt: Date.now(),
      processedBy: currentUserName,
      returnType,
      items: returnedItemsList,
      reasonCategory: selectedReason,
      reasonNotes: customReasonNotes.trim() || undefined,
      refundAmount: calculatedRefund,
      refundMethod,
      status: 'completed',
    };

    setCreateModalOpen(false);
    setSelectedReturn(createdReturn);
    setSlipModalOpen(true);

    // Reset wizard
    setSelectedInvoiceId('');
    setItemSelections({});
    setCustomReasonNotes('');
  };

  // Generate plain thermal slip text
  const generateThermalSlip = (ret: SalesReturn) => {
    const pad = (str: string, length: number) => (str + ' '.repeat(length)).slice(0, length);
    const padRight = (str: string, length: number) => (' '.repeat(length) + str).slice(-length);

    const reasonMeta = RETURN_REASONS.find((r) => r.id === ret.reasonCategory) || RETURN_REASONS[0];

    let t = '';
    t += '================================\n';
    t += '       SULTAN RESTAURANT        \n';
    t += '  REFUND VOUCHER & CREDIT NOTE  \n';
    t += '================================\n';
    t += `Return Slip #: ${ret.id}\n`;
    t += `Original Inv:  ${ret.invoiceId}\n`;
    t += `Date & Time:   ${new Date(ret.returnedAt).toLocaleString('en-PK')}\n`;
    t += `Order Type:    ${ret.orderType.toUpperCase()}${ret.tableName ? ` (${ret.tableName})` : ''}\n`;
    t += `Processed By:  ${ret.processedBy}\n`;
    if (ret.customer) {
      t += `Customer:      ${ret.customer.name} (${ret.customer.phone})\n`;
    }
    t += '--------------------------------\n';
    t += `Reason: ${reasonMeta.label}\n`;
    t += `Detail: ${reasonMeta.urdu}\n`;
    if (ret.reasonNotes) {
      t += `Notes:  ${ret.reasonNotes}\n`;
    }
    t += '--------------------------------\n';
    t += 'Qty  Returned Item        Refund\n';
    t += '--------------------------------\n';
    ret.items?.forEach((it) => {
      const name = it.name.length > 18 ? it.name.substring(0, 16) + '..' : it.name;
      const qtyStr = pad(`${it.quantityReturned}x`, 5);
      const nameStr = pad(name, 17);
      const amtStr = padRight(`Rs. ${it.refundAmount.toLocaleString()}`, 10);
      t += `${qtyStr}${nameStr}${amtStr}\n`;
      t += `     [${it.condition === 'waste' ? 'Culinary Discard' : 'Restocked'}]\n`;
    });
    t += '================================\n';
    t += `${pad('TOTAL REFUND:', 18)}${padRight(`Rs. ${ret.refundAmount.toLocaleString()}`, 14)}\n`;
    t += `${pad('REFUND METHOD:', 18)}${padRight(ret.refundMethod.toUpperCase(), 14)}\n`;
    t += '================================\n';
    t += 'Customer Signature: ____________\n';
    t += 'Manager Signature:  ____________\n';
    t += '       Thank You - Sultan       \n';
    t += '================================\n';
    return t;
  };

  const handleShareSlip = async (ret: SalesReturn) => {
    try {
      const text = generateThermalSlip(ret);
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          window.alert('Refund slip copied to clipboard.');
        } else {
          window.alert(text);
        }
      } else {
        await Share.share({
          message: text,
          title: `Refund Slip #${ret.id} - Sultan Restaurant`,
        });
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push(backRoute as never)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={BRAND.burgundy} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>Sales Returns & Refunds</Text>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{metrics.count}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Customer returns, item refunds, culinary waste & credit notes
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newReturnBtn}
          onPress={() => {
            setSelectedInvoiceId('');
            setItemSelections({});
            setCreateModalOpen(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color="#FFFFFF" />
          <Text style={styles.newReturnBtnText}>Process New Return</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollBody} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* KPI Row */}
        <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
          <View style={[styles.kpiCard, { borderLeftColor: BRAND.danger }]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>Total Refunded Amount</Text>
              <Ionicons name="wallet-outline" size={18} color={BRAND.danger} />
            </View>
            <Text style={[styles.kpiValue, { color: BRAND.danger }]}>{money(metrics.totalRefunded)}</Text>
            <Text style={styles.kpiSub}>Total cash/card credited back</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.gold }]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>Return Cases Processed</Text>
              <Ionicons name="receipt-outline" size={18} color={BRAND.goldDark} />
            </View>
            <Text style={styles.kpiValue}>{metrics.count}</Text>
            <Text style={styles.kpiSub}>
              {metrics.fullCount} Full Order • {metrics.partialCount} Partial Item
            </Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.warn }]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>Culinary Waste Value</Text>
              <Ionicons name="trash-outline" size={18} color={BRAND.warn} />
            </View>
            <Text style={[styles.kpiValue, { color: BRAND.warn }]}>{money(metrics.wastedValue)}</Text>
            <Text style={styles.kpiSub}>Food discarded due to quality/spill</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.success }]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>Restocked Goods Value</Text>
              <Ionicons name="cube-outline" size={18} color={BRAND.success} />
            </View>
            <Text style={[styles.kpiValue, { color: BRAND.success }]}>{money(metrics.restockedValue)}</Text>
            <Text style={styles.kpiSub}>Packaged items returned to stock</Text>
          </View>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={BRAND.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Return #, Invoice #, Customer, Table..."
                placeholderTextColor={BRAND.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={BRAND.muted} />
                </TouchableOpacity>
              )}
            </View>

          </View>

          {/* Dual Dropdowns: Date Filter & Reason Category */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <RoyalDropdown
                label="Filter by Period"
                options={[
                  { label: 'All Time', value: 'all', icon: 'calendar-outline' as const },
                  { label: 'Today', value: 'today', icon: 'today-outline' as const },
                  { label: 'Yesterday', value: 'yesterday', icon: 'time-outline' as const },
                  { label: 'Past 7 Days', value: 'week', icon: 'calendar-clear-outline' as const },
                  { label: 'Past 30 Days', value: 'month', icon: 'calendar-number-outline' as const },
                ]}
                value={dateFilter}
                onSelect={(d) => setDateFilter(d as any)}
                icon="calendar-outline"
              />
            </View>

            <View style={{ flex: 1, minWidth: 180 }}>
              <RoyalDropdown
                label="Filter by Return Reason"
                options={[
                  { label: 'All Reasons', value: 'all' },
                  ...RETURN_REASONS.map((r) => ({
                    label: r.label,
                    value: r.id,
                    sublabel: r.urdu,
                  })),
                ]}
                value={reasonFilter}
                onSelect={(r) => setReasonFilter(r as any)}
                icon="alert-circle-outline"
                searchable
              />
            </View>
          </View>
        </View>

        {/* Returns List */}
        {filteredReturns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="return-down-back-outline" size={48} color={BRAND.muted} />
            <Text style={styles.emptyTitle}>No Sales Returns Recorded</Text>
            <Text style={styles.emptySub}>
              {salesReturns.length === 0
                ? 'No orders have been returned or refunded yet.'
                : 'No returns match your current search and filter criteria.'}
            </Text>
            <TouchableOpacity
              style={[styles.newReturnBtn, { marginTop: 12 }]}
              onPress={() => setCreateModalOpen(true)}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.newReturnBtnText}>Process New Return</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredReturns.map((ret) => {
              const reasonMeta = RETURN_REASONS.find((r) => r.id === ret.reasonCategory) || RETURN_REASONS[0];
              return (
                <View key={ret.id} style={styles.returnCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.returnIdBadge, { backgroundColor: reasonMeta.bg }]}>
                        <Text style={[styles.returnIdText, { color: reasonMeta.color }]}>{ret.id}</Text>
                      </View>
                      <View style={styles.orderTypeTag}>
                        <Text style={styles.orderTypeTagText}>{ret.orderType.toUpperCase()}</Text>
                      </View>
                      {ret.tableName && (
                        <View style={styles.tableTag}>
                          <Ionicons name="restaurant-outline" size={12} color={BRAND.muted} />
                          <Text style={styles.tableTagText}>{ret.tableName}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.returnTypeBadge,
                          ret.returnType === 'full' ? styles.badgeFull : styles.badgePartial,
                        ]}
                      >
                        <Text
                          style={[
                            styles.returnTypeBadgeText,
                            ret.returnType === 'full' ? styles.textFull : styles.textPartial,
                          ]}
                        >
                          {ret.returnType === 'full' ? 'FULL BILL RETURN' : 'PARTIAL ITEM RETURN'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.refundAmountText}>{money(ret.refundAmount)}</Text>
                  </View>

                  {/* Reason & Meta Row */}
                  <View style={styles.reasonCardRow}>
                    <View style={[styles.reasonIconCircle, { backgroundColor: reasonMeta.bg }]}>
                      <Ionicons name={reasonMeta.icon} size={18} color={reasonMeta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reasonTitle, { color: reasonMeta.color }]}>{reasonMeta.label}</Text>
                      <Text style={styles.reasonUrdu}>{reasonMeta.urdu}</Text>
                      {ret.reasonNotes ? (
                        <Text style={styles.reasonNotesText}>Note: &ldquo;{ret.reasonNotes}&rdquo;</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={styles.methodPill}>
                        <Ionicons
                          name={ret.refundMethod === 'cash' ? 'cash-outline' : 'card-outline'}
                          size={14}
                          color={BRAND.ink}
                        />
                        <Text style={styles.methodPillText}>
                          {ret.refundMethod === 'customer_credit'
                            ? 'Customer Credit'
                            : `${ret.refundMethod.toUpperCase()} REFUND`}
                        </Text>
                      </View>
                      <Text style={styles.metaDateText}>
                        {new Date(ret.returnedAt).toLocaleDateString('en-PK', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Returned Items Table */}
                  <View style={styles.itemsTable}>
                    <View style={styles.itemsTableHeader}>
                      <Text style={[styles.thText, { flex: 2 }]}>Returned Item</Text>
                      <Text style={[styles.thText, { width: 50, textAlign: 'center' }]}>Qty</Text>
                      <Text style={[styles.thText, { flex: 1.5, textAlign: 'center' }]}>Handling</Text>
                      <Text style={[styles.thText, { width: 90, textAlign: 'right' }]}>Refund</Text>
                    </View>
                    {ret.items?.map((it, idx) => (
                      <View key={`${it.itemId}-${idx}`} style={styles.itemsTableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.itemNameText}>{it.name}</Text>
                          <Text style={styles.itemPriceSub}>{money(it.price)} each</Text>
                        </View>
                        <Text style={[styles.itemQtyText, { width: 50, textAlign: 'center' }]}>
                          {it.quantityReturned}x
                        </Text>
                        <View style={{ flex: 1.5, alignItems: 'center' }}>
                          <View
                            style={[
                              styles.conditionTag,
                              it.condition === 'waste' ? styles.condWaste : styles.condRestock,
                            ]}
                          >
                            <Ionicons
                              name={it.condition === 'waste' ? 'trash-outline' : 'cube-outline'}
                              size={12}
                              color={it.condition === 'waste' ? BRAND.warn : BRAND.success}
                            />
                            <Text
                              style={[
                                styles.conditionTagText,
                                it.condition === 'waste' ? { color: BRAND.warn } : { color: BRAND.success },
                              ]}
                            >
                              {it.condition === 'waste' ? 'Culinary Waste' : 'Restocked'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.itemRefundText, { width: 90, textAlign: 'right' }]}>
                          {money(it.refundAmount)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Footer with processed by & actions */}
                  <View style={styles.cardFooterRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="person-circle-outline" size={16} color={BRAND.muted} />
                      <Text style={styles.footerProcessedText}>
                        Processed by: <Text style={{ fontWeight: '600', color: BRAND.ink }}>{ret.processedBy}</Text>
                      </Text>
                      <Text style={styles.footerDot}>•</Text>
                      <Text style={styles.footerInvText}>Inv #{ret.invoiceId}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.slipBtn}
                        onPress={() => {
                          setSelectedReturn(ret);
                          setSlipModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="receipt-outline" size={14} color={BRAND.burgundy} />
                        <Text style={styles.slipBtnText}>Thermal Slip</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => handleShareSlip(ret)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="share-social-outline" size={14} color={BRAND.goldDark} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: Process New Return Wizard */}
      <Modal visible={createModalOpen} animationType="slide" transparent onRequestClose={() => setCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && { width: '96%', maxHeight: '92%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Process Sales Return & Refund</Text>
                <Text style={styles.modalSubtitle}>Search bill, select items, specify reason & refund</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCreateModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
              {/* Step 1: Select Invoice */}
              <View style={[styles.wizardSection, { zIndex: 20 }]}>
                <Text style={styles.wizardSectionTitle}>1. Select Customer Bill / Invoice</Text>
                <RoyalDropdown
                  placeholder="Choose invoice by #, table or amount..."
                  options={candidateInvoices.map((inv) => ({
                    label: `#${inv.id} • ${inv.tableName ? inv.tableName + ' • ' : ''}${money(inv.total)}`,
                    value: inv.id,
                    badge: `${money(inv.total)}`,
                    sublabel: `${inv.items?.length || 0} items • ${new Date(inv.timeSettled || inv.timePlaced).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })} • ${inv.status?.toUpperCase() || 'PLACED'}`,
                  }))}
                  value={selectedInvoiceId || ''}
                  onSelect={(id) => {
                    const inv = candidateInvoices.find((i) => i.id === id);
                    if (inv) handleSelectInvoice(inv);
                  }}
                  icon="receipt-outline"
                  searchable
                  searchPlaceholder="Search invoice #, table, customer..."
                />
              </View>

              {activeInvoice && (
                <>
                  {/* Step 2: Return Type */}
                  <View style={styles.wizardSection}>
                    <Text style={styles.wizardSectionTitle}>2. Choose Return Scope</Text>
                    <View style={styles.scopeToggleRow}>
                      <TouchableOpacity
                        style={[styles.scopeBtn, returnType === 'full' && styles.scopeBtnActive]}
                        onPress={() => handleSetReturnType('full')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={returnType === 'full' ? BRAND.burgundy : BRAND.muted}
                        />
                        <View>
                          <Text style={[styles.scopeTitle, returnType === 'full' && styles.scopeTitleActive]}>
                            Full Order Return
                          </Text>
                          <Text style={styles.scopeSub}>Entire bill cancelled & fully refunded</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.scopeBtn, returnType === 'partial' && styles.scopeBtnActive]}
                        onPress={() => handleSetReturnType('partial')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="checkbox-outline"
                          size={18}
                          color={returnType === 'partial' ? BRAND.burgundy : BRAND.muted}
                        />
                        <View>
                          <Text style={[styles.scopeTitle, returnType === 'partial' && styles.scopeTitleActive]}>
                            Partial Items Return
                          </Text>
                          <Text style={styles.scopeSub}>Return specific dishes / drinks only</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Step 3: Items to return & handling */}
                  <View style={styles.wizardSection}>
                    <Text style={styles.wizardSectionTitle}>3. Select Quantities & Kitchen Disposal</Text>
                    <View style={styles.returnItemsBox}>
                      {activeInvoice.items?.map((item) => {
                        const sel = itemSelections[item.id] || { qty: 0, condition: 'waste' };
                        const isIncluded = sel.qty > 0;

                        return (
                          <View
                            key={item.id}
                            style={[styles.itemSelectRow, isIncluded && styles.itemSelectRowActive]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemSelectName}>{item.name}</Text>
                              <Text style={styles.itemSelectSub}>
                                Billed: {item.qty} portions • {money(item.price)} each
                              </Text>
                            </View>

                            {/* Stepper */}
                            <View style={styles.stepperWrap}>
                              <TouchableOpacity
                                style={styles.stepBtn}
                                onPress={() => {
                                  const current = sel.qty;
                                  setItemSelections({
                                    ...itemSelections,
                                    [item.id]: {
                                      ...sel,
                                      qty: Math.max(0, current - 1),
                                    },
                                  });
                                }}
                              >
                                <Ionicons name="remove" size={16} color={BRAND.ink} />
                              </TouchableOpacity>
                              <Text style={styles.stepVal}>{sel.qty}</Text>
                              <TouchableOpacity
                                style={styles.stepBtn}
                                onPress={() => {
                                  const current = sel.qty;
                                  setItemSelections({
                                    ...itemSelections,
                                    [item.id]: {
                                      ...sel,
                                      qty: Math.min(item.qty, current + 1),
                                    },
                                  });
                                }}
                              >
                                <Ionicons name="add" size={16} color={BRAND.ink} />
                              </TouchableOpacity>
                            </View>

                            {/* Disposal toggle */}
                            {isIncluded && (
                              <View style={styles.condToggleWrap}>
                                <TouchableOpacity
                                  style={[styles.condBtn, sel.condition === 'waste' && styles.condBtnWasteActive]}
                                  onPress={() =>
                                    setItemSelections({
                                      ...itemSelections,
                                      [item.id]: { ...sel, condition: 'waste' },
                                    })
                                  }
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={12}
                                    color={sel.condition === 'waste' ? '#FFFFFF' : BRAND.muted}
                                  />
                                  <Text
                                    style={[
                                      styles.condBtnText,
                                      sel.condition === 'waste' && { color: '#FFFFFF', fontWeight: '700' },
                                    ]}
                                  >
                                    Waste
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.condBtn, sel.condition === 'restock' && styles.condBtnRestockActive]}
                                  onPress={() =>
                                    setItemSelections({
                                      ...itemSelections,
                                      [item.id]: { ...sel, condition: 'restock' },
                                    })
                                  }
                                >
                                  <Ionicons
                                    name="cube-outline"
                                    size={12}
                                    color={sel.condition === 'restock' ? '#FFFFFF' : BRAND.muted}
                                  />
                                  <Text
                                    style={[
                                      styles.condBtnText,
                                      sel.condition === 'restock' && { color: '#FFFFFF', fontWeight: '700' },
                                    ]}
                                  >
                                    Restock
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Step 4: Reason Category */}
                  <View style={styles.wizardSection}>
                    <Text style={styles.wizardSectionTitle}>4. Reason for Return</Text>
                    <View style={styles.reasonsGrid}>
                      {RETURN_REASONS.map((r) => {
                        const isChosen = selectedReason === r.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.reasonChoiceCard,
                              isChosen && { borderColor: r.color, backgroundColor: r.bg },
                            ]}
                            onPress={() => {
                              setSelectedReason(r.id);
                              // Auto update default suggested condition on items
                              const updated: Record<string, { qty: number; condition: ReturnedItemCondition }> = {};
                              Object.keys(itemSelections).forEach((k) => {
                                updated[k] = {
                                  ...itemSelections[k],
                                  condition: r.suggestedCondition,
                                };
                              });
                              setItemSelections(updated);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name={r.icon} size={16} color={r.color} />
                              <Text style={[styles.reasonChoiceLabel, isChosen && { color: r.color, fontWeight: '700' }]}>
                                {r.label}
                              </Text>
                            </View>
                            <Text style={styles.reasonChoiceUrdu}>{r.urdu}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add detailed remarks / customer complaint notes..."
                      placeholderTextColor={BRAND.muted}
                      value={customReasonNotes}
                      onChangeText={setCustomReasonNotes}
                      multiline
                    />
                  </View>

                  {/* Step 5: Refund Method & Total */}
                  <View style={styles.wizardSection}>
                    <Text style={styles.wizardSectionTitle}>5. Refund Payment Method</Text>
                    <View style={styles.methodChoiceRow}>
                      {(['cash', 'card', 'customer_credit'] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.methodChoiceBtn, refundMethod === m && styles.methodChoiceBtnActive]}
                          onPress={() => setRefundMethod(m)}
                        >
                          <Ionicons
                            name={m === 'cash' ? 'cash-outline' : m === 'card' ? 'card-outline' : 'person-outline'}
                            size={16}
                            color={refundMethod === m ? BRAND.burgundy : BRAND.muted}
                          />
                          <Text
                            style={[
                              styles.methodChoiceText,
                              refundMethod === m && styles.methodChoiceTextActive,
                            ]}
                          >
                            {m === 'cash' ? 'Cash Refund' : m === 'card' ? 'Card / Bank' : 'Customer Account Credit'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Summary bar */}
                  <View style={styles.summaryBar}>
                    <View>
                      <Text style={styles.summaryLabel}>Total Refund Due to Customer:</Text>
                      <Text style={styles.summaryRefundAmount}>{money(calculatedRefund)}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.confirmReturnBtn}
                      onPress={handleSubmitReturn}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmReturnBtnText}>Issue Refund & Credit Note</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Thermal Credit Note / Refund Slip */}
      <Modal visible={slipModalOpen} animationType="fade" transparent onRequestClose={() => setSlipModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.thermalModalCard, isMobile && { width: '92%' }]}>
            <View style={styles.thermalModalHeader}>
              <View>
                <Text style={styles.thermalModalTitle}>Refund Credit Note</Text>
                <Text style={styles.thermalModalSub}>Official Customer Return Voucher</Text>
              </View>
              <TouchableOpacity onPress={() => setSlipModalOpen(false)}>
                <Ionicons name="close-circle" size={26} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            {selectedReturn && (
              <>
                <ScrollView style={styles.thermalPaperWrap} contentContainerStyle={{ padding: 14 }}>
                  <Text style={styles.thermalMonoText}>{generateThermalSlip(selectedReturn)}</Text>
                </ScrollView>

                <View style={styles.thermalModalFooter}>
                  <TouchableOpacity
                    style={styles.thermalShareBtn}
                    onPress={() => handleShareSlip(selectedReturn)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-social-outline" size={16} color={BRAND.burgundy} />
                    <Text style={styles.thermalShareBtnText}>Share / WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.thermalDoneBtn}
                    onPress={() => setSlipModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.thermalDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: BRAND.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  headerSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
  },
  badgeCount: {
    backgroundColor: BRAND.burgundy,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  newReturnBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollBody: {
    flex: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiRowMobile: {
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
    borderLeftWidth: 4,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.muted,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: 6,
  },
  kpiSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND.ink,
    padding: 0,
  },
  datePills: {
    flexDirection: 'row',
    gap: 6,
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  datePillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  datePillTextActive: {
    color: '#FFFFFF',
  },
  reasonPills: {
    flexDirection: 'row',
    gap: 6,
  },
  reasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  reasonPillActive: {
    backgroundColor: BRAND.ink,
    borderColor: BRAND.ink,
  },
  reasonPillText: {
    fontSize: 11,
    color: BRAND.ink,
  },
  reasonPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 360,
  },
  returnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  returnIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  returnIdText: {
    fontSize: 12,
    fontWeight: '800',
  },
  orderTypeTag: {
    backgroundColor: BRAND.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  orderTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.ink,
  },
  tableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableTagText: {
    fontSize: 11,
    color: BRAND.ink,
  },
  returnTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeFull: {
    backgroundColor: '#FEE2E2',
  },
  badgePartial: {
    backgroundColor: '#FEF3C7',
  },
  returnTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textFull: {
    color: '#DC2626',
  },
  textPartial: {
    color: '#D97706',
  },
  refundAmountText: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.danger,
  },
  reasonCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: BRAND.surface,
    padding: 10,
    borderRadius: 8,
  },
  reasonIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reasonUrdu: {
    fontSize: 11,
    color: BRAND.muted,
  },
  reasonNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: BRAND.ink,
    marginTop: 2,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  methodPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.ink,
  },
  metaDateText: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  itemsTable: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemsTableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  itemsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  itemPriceSub: {
    fontSize: 10,
    color: BRAND.muted,
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  conditionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  condWaste: {
    backgroundColor: '#FFF3E0',
  },
  condRestock: {
    backgroundColor: '#E8F5E9',
  },
  conditionTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemRefundText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.danger,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  footerProcessedText: {
    fontSize: 11,
    color: BRAND.muted,
  },
  footerDot: {
    color: BRAND.border,
  },
  footerInvText: {
    fontSize: 11,
    color: BRAND.muted,
  },
  slipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.burgundy,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  shareBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: BRAND.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  modalCard: {
    width: '88%',
    maxWidth: 720,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
  },
  wizardSection: {
    gap: 8,
  },
  wizardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  invoiceSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  invoiceSearchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND.ink,
    padding: 0,
  },
  invoiceChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  invoiceChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
    minWidth: 140,
    gap: 2,
  },
  invoiceChipActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  invoiceChipId: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  invoiceChipIdActive: {
    color: BRAND.burgundy,
  },
  invoiceChipTable: {
    fontSize: 11,
    color: BRAND.muted,
  },
  invoiceChipTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.ink,
  },
  invoiceChipTotalActive: {
    color: BRAND.burgundy,
  },
  invoiceChipMeta: {
    fontSize: 10,
    color: BRAND.muted,
  },
  scopeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    padding: 10,
  },
  scopeBtnActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  scopeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  scopeTitleActive: {
    color: BRAND.burgundy,
  },
  scopeSub: {
    fontSize: 10,
    color: BRAND.muted,
  },
  returnItemsBox: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: '#FFFFFF',
  },
  itemSelectRowActive: {
    backgroundColor: '#FFFDF9',
  },
  itemSelectName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  itemSelectSub: {
    fontSize: 10,
    color: BRAND.muted,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.surface,
  },
  stepVal: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  condToggleWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  condBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: BRAND.surface,
  },
  condBtnWasteActive: {
    backgroundColor: BRAND.warn,
  },
  condBtnRestockActive: {
    backgroundColor: BRAND.success,
  },
  condBtnText: {
    fontSize: 10,
    color: BRAND.ink,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChoiceCard: {
    width: '48%',
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  reasonChoiceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.ink,
  },
  reasonChoiceUrdu: {
    fontSize: 10,
    color: BRAND.muted,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: BRAND.ink,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  methodChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodChoiceBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  methodChoiceBtnActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  methodChoiceText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.ink,
  },
  methodChoiceTextActive: {
    color: BRAND.burgundy,
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 14,
    borderRadius: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: BRAND.burgundy,
    fontWeight: '600',
  },
  summaryRefundAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.danger,
  },
  confirmReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmReturnBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  thermalModalCard: {
    width: 380,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thermalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: BRAND.surface,
  },
  thermalModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  thermalModalSub: {
    fontSize: 11,
    color: BRAND.muted,
  },
  thermalPaperWrap: {
    maxHeight: 460,
    backgroundColor: '#FCFCFA',
  },
  thermalMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#111827',
  },
  thermalModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FFFFFF',
  },
  thermalShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.burgundy,
    backgroundColor: '#FFFFFF',
  },
  thermalShareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  thermalDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
  },
  thermalDoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
