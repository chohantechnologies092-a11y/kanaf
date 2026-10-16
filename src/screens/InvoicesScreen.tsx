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
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore, Invoice } from '../store/restaurantStore';
import { broadcastImmediately } from '../services/syncService';
import SultanLogo from '../components/SultanLogo';
import { printInvoiceReceipt } from '../components/Invoice';
import { useAuthStore } from '../store/authStore';
import { useRolePermissions } from '../store/roleStore';
import PermissionDeniedScreen from '../components/PermissionDeniedScreen';

interface InvoicesScreenProps {
  userRole: 'admin' | 'manager';
  targetRoleOverride?: string;
  backRoute?: string;
}

export default function InvoicesScreen({ userRole, targetRoleOverride, backRoute = '/admin/dashboard' }: InvoicesScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmallMobile = width < 480;

  const user = useAuthStore((s) => s.user);
  const isActualAdmin = user?.role === 'admin' || userRole === 'admin';
  const effectiveRoleTarget = isActualAdmin ? undefined : (targetRoleOverride || (userRole === 'manager' ? 'manager' : undefined));
  const { can, canViewRevenue, canVoidInvoice, canProcessReturns, canExportReports } = useRolePermissions(effectiveRoleTarget);

  if (!isActualAdmin && !can('canAccessInvoices')) {
    return (
      <PermissionDeniedScreen
        moduleName="Invoices & Order History"
        urduModuleName="انوائسز اور آرڈر ہسٹری"
        requiredPermission="canAccessInvoices"
        backRoute={backRoute}
      />
    );
  }

  const kpiCardResponsiveStyle = useMemo<ViewStyle>(() => {
    if (width < 380) {
      return { width: '100%', minWidth: '100%' };
    }
    if (width < 768) {
      return { width: '47%', minWidth: 140 };
    }
    if (width < 1024) {
      return { width: '48%', minWidth: 180 };
    }
    return { flex: 1, minWidth: 200 };
  }, [width]);

  const metaColResponsiveStyle = useMemo<ViewStyle>(() => {
    if (isSmallMobile) {
      return { width: '100%' };
    }
    if (isMobile) {
      return { width: '47%' };
    }
    return { minWidth: 140 };
  }, [isSmallMobile, isMobile]);

  const rawInvoices = useRestaurantStore((state) => state.invoices);
  const invoices = useMemo(() => rawInvoices || [], [rawInvoices]);
  const voidInvoice = useRestaurantStore((state) => state.voidInvoice);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'dine-in' | 'takeaway' | 'delivery'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'online'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'voided' | 'refunded'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low'>('newest');

  // Selected Invoice for Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsTab, setDetailsTab] = useState<'breakdown' | 'thermal'>('breakdown');

  // Void Reason Modal
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [customVoidReason, setCustomVoidReason] = useState('');

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

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // Date Filter
    if (dateFilter === 'today') {
      result = result.filter((inv) => (inv.timeSettled || inv.timePlaced) >= dateRanges.today);
    } else if (dateFilter === 'yesterday') {
      result = result.filter((inv) => {
        const t = inv.timeSettled || inv.timePlaced;
        return t >= dateRanges.yesterdayStart && t <= dateRanges.yesterdayEnd;
      });
    } else if (dateFilter === 'week') {
      result = result.filter((inv) => (inv.timeSettled || inv.timePlaced) >= dateRanges.week);
    } else if (dateFilter === 'month') {
      result = result.filter((inv) => (inv.timeSettled || inv.timePlaced) >= dateRanges.month);
    }

    // Order Type Filter
    if (orderTypeFilter !== 'all') {
      result = result.filter((inv) => inv.orderType === orderTypeFilter);
    }

    // Payment Filter
    if (paymentFilter !== 'all') {
      result = result.filter((inv) =>
        inv.payments?.some((p) => p.type?.toLowerCase() === paymentFilter)
      );
    }

    // Status Filter
    if (statusFilter === 'settled') {
      result = result.filter((inv) => inv.status !== 'voided' && inv.status !== 'refunded');
    } else if (statusFilter === 'voided') {
      result = result.filter((inv) => inv.status === 'voided');
    } else if (statusFilter === 'refunded') {
      result = result.filter((inv) => inv.status === 'refunded' || inv.returnStatus === 'full' || inv.returnStatus === 'partial');
    }

    // Search Query (Invoice ID, Table, Server, Customer Name/Phone, or Items)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((inv) => {
        const idMatch = inv.id?.toLowerCase().includes(q);
        const tableMatch = inv.tableName?.toLowerCase().includes(q);
        const serverMatch = inv.server?.toLowerCase().includes(q);
        const customerMatch =
          inv.customer?.name?.toLowerCase().includes(q) ||
          inv.customer?.phone?.includes(q);
        const itemMatch = inv.items?.some((it) => it.name?.toLowerCase().includes(q));

        return idMatch || tableMatch || serverMatch || customerMatch || itemMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      const timeA = a.timeSettled || a.timePlaced || 0;
      const timeB = b.timeSettled || b.timePlaced || 0;
      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'amount_high') return (b.total || 0) - (a.total || 0);
      if (sortBy === 'amount_low') return (a.total || 0) - (b.total || 0);
      return 0;
    });

    return result;
  }, [invoices, dateFilter, orderTypeFilter, paymentFilter, statusFilter, searchQuery, sortBy, dateRanges]);

  // Financial KPI Metrics
  const metrics = useMemo(() => {
    const validInvoices = filteredInvoices.filter((inv) => inv.status !== 'voided');
    const voidedInvoices = filteredInvoices.filter((inv) => inv.status === 'voided');

    const totalSales = validInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalTax = validInvoices.reduce((sum, inv) => sum + (inv.tax || 0), 0);
    const totalDiscount = validInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
    const aov = validInvoices.length > 0 ? Math.round(totalSales / validInvoices.length) : 0;

    let cashTotal = 0;
    let digitalTotal = 0;

    validInvoices.forEach((inv) => {
      inv.payments?.forEach((p) => {
        if (p.type === 'cash') cashTotal += p.amount || 0;
        else digitalTotal += p.amount || 0;
      });
    });

    return {
      count: validInvoices.length,
      voidedCount: voidedInvoices.length,
      totalSales,
      totalTax,
      totalDiscount,
      aov,
      cashTotal,
      digitalTotal,
    };
  }, [filteredInvoices]);

  // Format Date and Time
  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Void Action Trigger
  const handleOpenVoidModal = (invoice: Invoice) => {
    setInvoiceToVoid(invoice);
    setVoidReason('Wrong order punched');
    setCustomVoidReason('');
    setVoidModalVisible(true);
  };

  const handleConfirmVoid = () => {
    if (!invoiceToVoid) return;
    const finalReason = voidReason === 'Other' ? (customVoidReason || 'Voided by authorized manager') : voidReason;

    voidInvoice(invoiceToVoid.id, finalReason, userRole === 'admin' ? 'Admin' : 'Manager');
    broadcastImmediately();

    setVoidModalVisible(false);
    if (selectedInvoice && selectedInvoice.id === invoiceToVoid.id) {
      setSelectedInvoice({
        ...selectedInvoice,
        status: 'voided',
        voidReason: finalReason,
        voidedAt: Date.now(),
        voidedBy: userRole === 'admin' ? 'Admin' : 'Manager',
      });
    }
    setInvoiceToVoid(null);

    if (Platform.OS === 'web') {
      window.alert(`Invoice ${invoiceToVoid.id} has been marked as VOID.`);
    } else {
      Alert.alert('Invoice Voided', `Invoice ${invoiceToVoid.id} has been marked as VOID.`);
    }
  };

  // Plain Text Thermal Slip Generator (Used for Share, WhatsApp & Mobile Print)
  const generateReceiptText = (inv: Invoice) => {
    const pad = (str: string, length: number) => (str + ' '.repeat(length)).slice(0, length);
    const padRight = (str: string, length: number) => (' '.repeat(length) + str).slice(-length);

    let text = '';
    text += '================================\n';
    text += '       SULTAN RESTAURANT        \n';
    text += '   Luxury Dining & Culinary Art \n';
    text += '     Food Street, Lahore, PK    \n';
    text += '       Phone: 0300-1234567      \n';
    text += '================================\n';
    text += `Invoice #: ${inv.id}\n`;
    text += `Date: ${formatDateTime(inv.timeSettled || inv.timePlaced)}\n`;
    text += `Order Type: ${inv.orderType.toUpperCase()}\n`;
    if (inv.tableName) text += `Table: ${inv.tableName}\n`;
    
    const orderCreator = inv.orderTakenBy || (inv.server && !inv.server.toLowerCase().includes('pos') ? inv.server : 'Staff');
    const cashierName = inv.cashier || (inv.server?.toLowerCase().includes('pos') ? inv.server : 'Manager');
    if (orderCreator === cashierName) {
      text += `Staff / Cashier: ${cashierName}\n`;
    } else {
      text += `Order Taken By: ${orderCreator}\n`;
      text += `Billed By (Cashier): ${cashierName}\n`;
    }
    
    if (inv.customer) {
      text += `Customer: ${inv.customer.name} (${inv.customer.phone})\n`;
      if (inv.customer.address) text += `Address: ${inv.customer.address}\n`;
    }
    if (inv.status === 'voided') {
      text += '*** STATUS: VOIDED / CANCELLED ***\n';
      if (inv.voidReason) text += `Reason: ${inv.voidReason}\n`;
    }
    text += '--------------------------------\n';
    text += 'Qty  Item                 Amount\n';
    text += '--------------------------------\n';
    inv.items?.forEach((item) => {
      const name = item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name;
      const qtyStr = pad(`${item.qty}x`, 4);
      const nameStr = pad(name, 19);
      const amtStr = padRight(`Rs. ${(item.price * item.qty).toLocaleString()}`, 9);
      text += `${qtyStr}${nameStr}${amtStr}\n`;
    });
    text += '--------------------------------\n';
    text += `${pad('Subtotal:', 20)}${padRight(`Rs. ${(inv.subTotal || 0).toLocaleString()}`, 12)}\n`;
    if ((inv.discount || 0) > 0) {
      text += `${pad('Discount:', 20)}${padRight(`- Rs. ${(inv.discount || 0).toLocaleString()}`, 12)}\n`;
    }
    text += `${pad('GST Tax (16%):', 20)}${padRight(`Rs. ${(inv.tax || 0).toLocaleString()}`, 12)}\n`;
    text += '================================\n';
    text += `${pad('NET TOTAL:', 20)}${padRight(`Rs. ${(inv.total || 0).toLocaleString()}`, 12)}\n`;
    text += '================================\n';
    if (inv.payments && inv.payments.length > 0) {
      text += 'Payment Details:\n';
      inv.payments.forEach((p) => {
        text += `  • ${p.type.toUpperCase()}: Rs. ${(p.amount || 0).toLocaleString()}\n`;
      });
    }
    text += '--------------------------------\n';
    text += ' Thank you for dining at Sultan!\n';
    text += '   Please visit us again soon!  \n';
    text += '================================\n';
    return text;
  };

  // Print or Share Receipt
  const handlePrintOrShare = async (inv: Invoice) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setSelectedInvoice(inv);
      printInvoiceReceipt(inv);
    } else {
      const receiptText = generateReceiptText(inv);
      try {
        await Share.share({
          message: receiptText,
          title: `Invoice #${inv.id} - Sultan Restaurant`,
        });
      } catch {
        Alert.alert('Invoice', receiptText);
      }
    }
  };

  // Export Filtered Invoices to CSV
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      const msg = 'No invoices found matching current filter criteria.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Export Notice', msg);
      return;
    }

    const headers = 'Invoice ID,Date,Status,Order Type,Table,Server,Customer Name,Customer Phone,Items Summary,Subtotal,Discount,Tax,Total,Payments\n';
    const rows = filteredInvoices
      .map((inv) => {
        const itemsStr = (inv.items || []).map((it) => `${it.qty}x ${it.name}`).join(' | ');
        const paymentsStr = (inv.payments || []).map((p) => `${p.type}: Rs.${p.amount}`).join('; ');
        const dateStr = formatDateTime(inv.timeSettled || inv.timePlaced);
        return `"${inv.id}","${dateStr}","${inv.status || 'settled'}","${inv.orderType}","${inv.tableName || 'N/A'}","${inv.server || 'N/A'}","${inv.customer?.name || 'Walk-in'}","${inv.customer?.phone || 'N/A'}","${itemsStr}","${inv.subTotal || 0}","${inv.discount || 0}","${inv.tax || 0}","${inv.total || 0}","${paymentsStr}"`;
      })
      .join('\n');

    const csvContent = headers + rows;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sultan_invoices_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Share.share({
        message: csvContent,
        title: `Sultan_Invoices_Export_${Date.now()}.csv`,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, isMobile && styles.headerMobile, isSmallMobile && styles.headerSmallMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push(backRoute as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.headerTitle, isSmallMobile && { fontSize: 17 }]}>Order Invoices & Billing</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{userRole.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, isSmallMobile && { fontSize: 11 }]} numberOfLines={1}>
              Live order history, customer bills & audit
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {canExportReports && (
            <TouchableOpacity
              style={[styles.exportBtn, isSmallMobile && { paddingHorizontal: 10, paddingVertical: 6 }]}
              onPress={handleExportCSV}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={17} color="#4a121a" style={{ marginRight: isSmallMobile ? 3 : 6 }} />
              <Text style={styles.exportBtnText}>{isMobile ? 'Export' : 'Export CSV'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* KPI Financial Overview */}
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, kpiCardResponsiveStyle, { borderLeftColor: '#27AE60' }]}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="cash-outline" size={20} color="#27AE60" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, isSmallMobile && { fontSize: 10 }]}>Total Revenue</Text>
              <Text style={[styles.kpiValue, isSmallMobile && { fontSize: 16 }]}>
                {canViewRevenue ? `Rs. ${metrics.totalSales.toLocaleString()}` : '••••••••'}
              </Text>
              <Text style={[styles.kpiSub, isSmallMobile && { fontSize: 10 }]}>From {metrics.count} settled bills</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, kpiCardResponsiveStyle, { borderLeftColor: '#007AFF' }]}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="receipt-outline" size={20} color="#007AFF" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, isSmallMobile && { fontSize: 10 }]}>Settled Invoices</Text>
              <Text style={[styles.kpiValue, isSmallMobile && { fontSize: 16 }]}>{metrics.count}</Text>
              <Text style={[styles.kpiSub, isSmallMobile && { fontSize: 10 }]}>
                Avg: {canViewRevenue ? `Rs. ${metrics.aov.toLocaleString()}` : '••••'} / bill
              </Text>
            </View>
          </View>

          <View style={[styles.kpiCard, kpiCardResponsiveStyle, { borderLeftColor: '#F39C12' }]}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="wallet-outline" size={20} color="#F39C12" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, isSmallMobile && { fontSize: 10 }]}>Cash vs Digital</Text>
              <Text style={[styles.kpiValue, isSmallMobile && { fontSize: 16 }]}>
                {canViewRevenue ? `Rs. ${metrics.cashTotal.toLocaleString()}` : '••••••••'}
              </Text>
              <Text style={[styles.kpiSub, isSmallMobile && { fontSize: 10 }]}>
                Card/Online: {canViewRevenue ? `Rs. ${metrics.digitalTotal.toLocaleString()}` : '••••••••'}
              </Text>
            </View>
          </View>

          <View style={[styles.kpiCard, kpiCardResponsiveStyle, { borderLeftColor: '#E74C3C' }]}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="close-circle-outline" size={20} color="#E74C3C" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, isSmallMobile && { fontSize: 10 }]}>Voided / Cancelled</Text>
              <Text style={[styles.kpiValue, { color: '#E74C3C' }, isSmallMobile && { fontSize: 16 }]}>{metrics.voidedCount}</Text>
              <Text style={[styles.kpiSub, isSmallMobile && { fontSize: 10 }]}>Tax: Rs. {metrics.totalTax.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Search & Filter Control Bar */}
        <View style={styles.filterSection}>
          {/* Search Box */}
          <View style={[styles.searchRow, isSmallMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={[styles.searchBox, isSmallMobile && { minWidth: '100%' }]}>
              <Ionicons name="search" size={19} color="#8E8E93" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={isSmallMobile ? "Search invoices..." : "Search by Invoice ID, Table, Server, Customer, or Item..."}
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color="#C7C7CC" />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Selector */}
            <View style={[styles.sortContainer, isSmallMobile && { alignSelf: 'flex-start' }]}>
              <Ionicons name="swap-vertical" size={16} color="#4a121a" style={{ marginRight: 4 }} />
              <TouchableOpacity
                onPress={() => {
                  if (sortBy === 'newest') setSortBy('oldest');
                  else if (sortBy === 'oldest') setSortBy('amount_high');
                  else if (sortBy === 'amount_high') setSortBy('amount_low');
                  else setSortBy('newest');
                }}
                style={styles.sortBtn}
              >
                <Text style={styles.sortBtnText}>
                  {sortBy === 'newest' && 'Newest First'}
                  {sortBy === 'oldest' && 'Oldest First'}
                  {sortBy === 'amount_high' && 'Highest Bill'}
                  {sortBy === 'amount_low' && 'Lowest Bill'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Date Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            <Text style={styles.filterLabel}>Period:</Text>
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.filterChip, dateFilter === period && styles.filterChipActive]}
                onPress={() => setDateFilter(period)}
              >
                <Text style={[styles.filterChipText, dateFilter === period && styles.filterChipTextActive]}>
                  {period === 'all' && 'All Time'}
                  {period === 'today' && 'Today'}
                  {period === 'yesterday' && 'Yesterday'}
                  {period === 'week' && 'Past 7 Days'}
                  {period === 'month' && 'Past 30 Days'}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.filterDivider} />

            {/* Order Type Filters */}
            <Text style={styles.filterLabel}>Type:</Text>
            {(['all', 'dine-in', 'takeaway', 'delivery'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, orderTypeFilter === type && styles.filterChipActive]}
                onPress={() => setOrderTypeFilter(type)}
              >
                <Text style={[styles.filterChipText, orderTypeFilter === type && styles.filterChipTextActive]}>
                  {type === 'all' && 'All Orders'}
                  {type === 'dine-in' && '🍽️ Dine-In'}
                  {type === 'takeaway' && '🛍️ Takeaway'}
                  {type === 'delivery' && '🛵 Delivery'}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.filterDivider} />

            {/* Payment Filters */}
            <Text style={styles.filterLabel}>Payment:</Text>
            {(['all', 'cash', 'card', 'online'] as const).map((pm) => (
              <TouchableOpacity
                key={pm}
                style={[styles.filterChip, paymentFilter === pm && styles.filterChipActive]}
                onPress={() => setPaymentFilter(pm)}
              >
                <Text style={[styles.filterChipText, paymentFilter === pm && styles.filterChipTextActive]}>
                  {pm.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.filterDivider} />

            {/* Status Filter */}
            <Text style={styles.filterLabel}>Status:</Text>
            {(['all', 'settled', 'refunded', 'voided'] as const).map((st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.filterChip,
                  statusFilter === st && (st === 'voided' ? styles.filterChipVoidActive : st === 'refunded' ? styles.filterChipRefundActive : styles.filterChipActive),
                ]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === st && (st === 'voided' ? styles.filterChipVoidTextActive : styles.filterChipTextActive),
                  ]}
                >
                  {st === 'all' ? 'All Status' : st === 'settled' ? '✅ Settled' : st === 'refunded' ? '↩️ Returned / Refunded' : '❌ Voided'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results Counter */}
        <View style={styles.resultsCounterRow}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ fontWeight: '800', color: '#1C1C1E' }}>{filteredInvoices.length}</Text> invoice(s)
          </Text>
          {(searchQuery || dateFilter !== 'all' || orderTypeFilter !== 'all' || paymentFilter !== 'all' || statusFilter !== 'all') && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setDateFilter('all');
                setOrderTypeFilter('all');
                setPaymentFilter('all');
                setStatusFilter('all');
              }}
              style={styles.clearFilterBtn}
            >
              <Ionicons name="refresh" size={14} color="#D84315" style={{ marginRight: 4 }} />
              <Text style={styles.clearFilterText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Invoices Found</Text>
            <Text style={styles.emptySubtitle}>
              No billing records match your current search and filters.
            </Text>
          </View>
        ) : (
          <View style={styles.invoicesList}>
            {filteredInvoices.map((inv) => {
              const isVoided = inv.status === 'voided';
              const isRefunded = inv.status === 'refunded' || inv.returnStatus === 'full';
              const isPartialReturn = inv.returnStatus === 'partial';
              const itemsCount = inv.items?.reduce((sum, it) => sum + (it.qty || 1), 0) || 0;
              const itemsPreview = (inv.items || [])
                .slice(0, 3)
                .map((it) => `${it.qty}x ${it.name}`)
                .join(', ');
              const hasMoreItems = (inv.items || []).length > 3;

              return (
                <View
                  key={inv.id}
                  style={[
                    styles.invoiceCard,
                    isVoided && styles.invoiceCardVoided,
                    isRefunded && styles.invoiceCardRefunded,
                  ]}
                >
                  {/* Card Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      {isVoided ? (
                        <View style={[styles.statusPill, styles.statusPillVoided]}>
                          <Ionicons name="close-circle" size={13} color="#C62828" style={{ marginRight: 4 }} />
                          <Text style={[styles.statusPillText, styles.statusPillTextVoided]}>VOIDED</Text>
                        </View>
                      ) : isRefunded ? (
                        <View style={[styles.statusPill, styles.statusPillRefunded]}>
                          <Ionicons name="return-down-back" size={13} color="#6A1B9A" style={{ marginRight: 4 }} />
                          <Text style={[styles.statusPillText, styles.statusPillTextRefunded]}>REFUNDED</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, styles.statusPillSettled]}>
                          <Ionicons name="checkmark-circle" size={13} color="#2E7D32" style={{ marginRight: 4 }} />
                          <Text style={[styles.statusPillText, styles.statusPillTextSettled]}>PAID</Text>
                        </View>
                      )}

                      {isPartialReturn && (
                        <View style={[styles.statusPill, styles.statusPillPartialReturn]}>
                          <Ionicons name="alert-circle" size={12} color="#D84315" style={{ marginRight: 3 }} />
                          <Text style={[styles.statusPillText, styles.statusPillTextPartialReturn]}>
                            PARTIAL RETURN (-Rs. {(inv.refundAmount || 0).toLocaleString()})
                          </Text>
                        </View>
                      )}

                      {(inv.feedbackSubmitted || inv.feedback) && (
                        <View style={[styles.statusPill, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                          <Ionicons name="star" size={11} color="#D97706" style={{ marginRight: 3 }} />
                          <Text style={[styles.statusPillText, { color: '#B45309' }]}>
                            ⭐ {inv.feedback?.overallRating || 5}/5 REVIEW
                          </Text>
                        </View>
                      )}

                      <Text style={styles.invoiceIdText}>#{inv.id}</Text>

                      <View style={[styles.typeBadge, {
                        backgroundColor: inv.orderType === 'dine-in' ? '#E3F2FD' : inv.orderType === 'takeaway' ? '#FFF3E0' : '#EDE7F6',
                        borderColor: inv.orderType === 'dine-in' ? '#BBDEFB' : inv.orderType === 'takeaway' ? '#FFE0B2' : '#D1C4E9',
                      }]}>
                        <Ionicons
                          name={inv.orderType === 'dine-in' ? 'restaurant' : inv.orderType === 'takeaway' ? 'bag-handle' : 'bicycle'}
                          size={12}
                          color={inv.orderType === 'dine-in' ? '#1976D2' : inv.orderType === 'takeaway' ? '#F57C00' : '#512DA8'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.typeBadgeText, {
                          color: inv.orderType === 'dine-in' ? '#1976D2' : inv.orderType === 'takeaway' ? '#F57C00' : '#512DA8',
                        }]}>
                          {inv.orderType === 'dine-in' ? (inv.tableName || 'DINE-IN') : inv.orderType.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.cardDateText}>
                      {formatDateTime(inv.timeSettled || inv.timePlaced)}
                    </Text>
                  </View>

                  {/* Middle Meta Info */}
                  <View style={styles.metaRow}>
                    <View style={[styles.metaCol, metaColResponsiveStyle]}>
                      <Text style={styles.metaLabel}>Order Taken By:</Text>
                      <Text style={styles.metaValue}>
                        <Ionicons name="person-outline" size={13} color="#4a121a" /> {inv.orderTakenBy || (inv.server && !inv.server.toLowerCase().includes('pos') ? inv.server : 'Staff')}
                      </Text>
                    </View>

                    <View style={[styles.metaCol, metaColResponsiveStyle]}>
                      <Text style={styles.metaLabel}>Billed By (Cashier):</Text>
                      <Text style={styles.metaValue}>
                        <Ionicons name="cash-outline" size={13} color="#27AE60" /> {inv.cashier || (inv.server?.toLowerCase().includes('pos') ? inv.server : 'Manager')}
                      </Text>
                    </View>

                    {inv.customer && (
                      <View style={[styles.metaCol, metaColResponsiveStyle]}>
                        <Text style={styles.metaLabel}>Customer:</Text>
                        <Text style={styles.metaValue} numberOfLines={1}>
                          <Ionicons name="person-circle-outline" size={13} color="#D5A943" /> {inv.customer.name} ({inv.customer.phone})
                        </Text>
                      </View>
                    )}

                    <View style={[styles.metaCol, metaColResponsiveStyle]}>
                      <Text style={styles.metaLabel}>Payment Mode:</Text>
                      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                        {inv.payments?.map((p, idx) => (
                          <View key={idx} style={styles.paymentMethodPill}>
                            <Text style={styles.paymentMethodText}>
                              {p.type?.toUpperCase()} {canViewRevenue ? `Rs. ${p.amount?.toLocaleString()}` : '••••'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Items Preview */}
                  <View style={styles.itemsPreviewBox}>
                    <Text style={styles.itemsCountLabel}>{itemsCount} Item(s):</Text>
                    <Text style={styles.itemsPreviewText} numberOfLines={2}>
                      {itemsPreview}
                      {hasMoreItems && ` + ${(inv.items || []).length - 3} more...`}
                    </Text>
                  </View>

                  {/* If Voided notice */}
                  {isVoided && inv.voidReason && (
                    <View style={styles.voidAlertBox}>
                      <Ionicons name="alert-circle" size={16} color="#C62828" style={{ marginRight: 6 }} />
                      <Text style={styles.voidAlertText}>
                        Void Reason: {inv.voidReason} {inv.voidedBy ? `(by ${inv.voidedBy})` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Total & Action Footer */}
                  <View style={[styles.cardFooter, isSmallMobile && styles.cardFooterMobile]}>
                    <View style={[styles.amountBreakdown, isSmallMobile && styles.amountBreakdownMobile]}>
                      <Text style={styles.subtotalHint}>
                        Sub: {canViewRevenue ? `Rs. ${(inv.subTotal || 0).toLocaleString()}` : '••••'} • Tax: {canViewRevenue ? `Rs. ${(inv.tax || 0).toLocaleString()}` : '••••'}
                        {(inv.discount || 0) > 0 ? ` • Disc: -${canViewRevenue ? `Rs. ${(inv.discount || 0).toLocaleString()}` : '••••'}` : ''}
                      </Text>
                      <Text style={[styles.grandTotalText, isVoided && styles.grandTotalVoided]}>
                        {canViewRevenue ? `Rs. ${(inv.total || 0).toLocaleString()}` : 'Rs. ••••••'}
                      </Text>
                    </View>

                    <View style={[styles.actionButtonsRow, isSmallMobile && styles.actionButtonsRowMobile]}>
                      <TouchableOpacity
                        style={[styles.detailBtn, isSmallMobile && styles.detailBtnMobile]}
                        onPress={() => {
                          setSelectedInvoice(inv);
                          setDetailsTab('breakdown');
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="eye-outline" size={16} color="#4a121a" style={{ marginRight: 4 }} />
                        <Text style={styles.detailBtnText}>Details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.printActionBtn, isSmallMobile && styles.printActionBtnMobile]}
                        onPress={() => handlePrintOrShare(inv)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="print-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.printActionBtnText}>Receipt</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.cardFeedbackBtn, isSmallMobile && styles.cardFeedbackBtnMobile]}
                        onPress={() => router.push(`/feedback?invoiceId=${encodeURIComponent(inv.id)}` as any)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="star" size={14} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.cardFeedbackBtnText}>
                          {inv.feedbackSubmitted ? 'Feedback' : 'QR Review'}
                        </Text>
                      </TouchableOpacity>

                      {!isVoided && !isRefunded && canProcessReturns && (
                        <TouchableOpacity
                          style={[styles.cardReturnBtn, isSmallMobile && styles.cardReturnBtnMobile]}
                          onPress={() => {
                            const targetPath = userRole === 'admin' ? '/admin/returns' : '/manager/returns';
                            router.push(targetPath as any);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="return-down-back-outline" size={15} color="#D84315" style={{ marginRight: 4 }} />
                          <Text style={styles.cardReturnBtnText}>Return</Text>
                        </TouchableOpacity>
                      )}

                      {!isVoided && canVoidInvoice && (
                        <TouchableOpacity
                          style={styles.voidBtn}
                          onPress={() => handleOpenVoidModal(inv)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={15} color="#E74C3C" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* FULL INVOICE DETAILS & THERMAL RECEIPT MODAL */}
      <Modal visible={!!selectedInvoice} transparent animationType="fade">
        <View style={[styles.modalBackdrop, isSmallMobile && { padding: 6 }]}>
          <View style={[styles.modalSheet, isMobile && styles.modalSheetMobile, isSmallMobile && styles.modalSheetSmallMobile]}>
            {selectedInvoice && (
              <>
                {/* Modal Header */}
                <View style={styles.modalTopBar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <SultanLogo size="xs" variant="circle" width={22} height={22} />
                    <View>
                      <Text style={[styles.modalInvoiceTitle, isSmallMobile && { fontSize: 14 }]}>Invoice #{selectedInvoice.id}</Text>
                      <Text style={[styles.modalInvoiceSubtitle, isSmallMobile && { fontSize: 10 }]}>
                        {formatDateTime(selectedInvoice.timeSettled || selectedInvoice.timePlaced)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedInvoice(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={22} color="#1C1C1E" />
                  </TouchableOpacity>
                </View>

                {/* Tab Switcher */}
                <View style={styles.modalTabBar}>
                  <TouchableOpacity
                    style={[styles.modalTabBtn, detailsTab === 'breakdown' && styles.modalTabBtnActive]}
                    onPress={() => setDetailsTab('breakdown')}
                  >
                    <Ionicons
                      name="list-outline"
                      size={16}
                      color={detailsTab === 'breakdown' ? '#4a121a' : '#8E8E93'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.modalTabText, detailsTab === 'breakdown' && styles.modalTabTextActive]}>
                      Order Breakdown
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalTabBtn, detailsTab === 'thermal' && styles.modalTabBtnActive]}
                    onPress={() => setDetailsTab('thermal')}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color={detailsTab === 'thermal' ? '#4a121a' : '#8E8E93'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.modalTabText, detailsTab === 'thermal' && styles.modalTabTextActive]}>
                      Thermal Slip (80mm)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                  {detailsTab === 'breakdown' ? (
                    <View style={{ gap: 16 }}>
                      {/* Status Banner */}
                      {selectedInvoice.status === 'voided' ? (
                        <View style={styles.voidBannerModal}>
                          <Ionicons name="warning" size={20} color="#C62828" style={{ marginRight: 8 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.voidBannerTitle}>THIS INVOICE WAS VOIDED</Text>
                            <Text style={styles.voidBannerDesc}>
                              Reason: {selectedInvoice.voidReason || 'Cancelled by manager'}
                              {selectedInvoice.voidedBy ? ` • By ${selectedInvoice.voidedBy}` : ''}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.paidBannerModal}>
                          <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={{ marginRight: 8 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.paidBannerTitle}>PAYMENT SETTLED & RECORDED</Text>
                            <Text style={styles.paidBannerDesc}>
                              Order fully finalized and synced with central server.
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Order Context Grid */}
                      <View style={styles.metaDetailCard}>
                        <View style={styles.metaDetailRow}>
                          <Text style={styles.metaDetailKey}>Order Type</Text>
                          <Text style={styles.metaDetailVal}>{selectedInvoice.orderType.toUpperCase()}</Text>
                        </View>
                        {selectedInvoice.tableName && (
                          <View style={styles.metaDetailRow}>
                            <Text style={styles.metaDetailKey}>Table / Zone</Text>
                            <Text style={styles.metaDetailVal}>{selectedInvoice.tableName}</Text>
                          </View>
                        )}
                        <View style={styles.metaDetailRow}>
                          <Text style={styles.metaDetailKey}>Order Taken By</Text>
                          <Text style={styles.metaDetailVal}>
                            {selectedInvoice.orderTakenBy || (selectedInvoice.server && !selectedInvoice.server.toLowerCase().includes('pos') ? selectedInvoice.server : 'Staff')}
                          </Text>
                        </View>
                        <View style={styles.metaDetailRow}>
                          <Text style={styles.metaDetailKey}>Billed By (Cashier)</Text>
                          <Text style={styles.metaDetailVal}>
                            {selectedInvoice.cashier || (selectedInvoice.server?.toLowerCase().includes('pos') ? selectedInvoice.server : 'Manager')}
                          </Text>
                        </View>
                        {selectedInvoice.customer && (
                          <>
                            <View style={styles.metaDetailRow}>
                              <Text style={styles.metaDetailKey}>Customer Name</Text>
                              <Text style={styles.metaDetailVal}>{selectedInvoice.customer.name}</Text>
                            </View>
                            <View style={styles.metaDetailRow}>
                              <Text style={styles.metaDetailKey}>Customer Phone</Text>
                              <Text style={styles.metaDetailVal}>{selectedInvoice.customer.phone}</Text>
                            </View>
                            {selectedInvoice.customer.address && (
                              <View style={styles.metaDetailRow}>
                                <Text style={styles.metaDetailKey}>Delivery Address</Text>
                                <Text style={[styles.metaDetailVal, { maxWidth: '60%' }]}>
                                  {selectedInvoice.customer.address}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>

                      {/* Itemized Order Table */}
                      <View style={styles.itemizedBox}>
                        <Text style={styles.itemizedBoxTitle}>Order Items Details</Text>
                        <View style={styles.itemizedHeaderRow}>
                          <Text style={[styles.itemizedColText, isSmallMobile && { fontSize: 10 }, { flex: isSmallMobile ? 2.5 : 3 }]}>Item</Text>
                          <Text style={[styles.itemizedColText, isSmallMobile && { fontSize: 10 }, { flex: isSmallMobile ? 0.8 : 1, textAlign: 'center' }]}>Qty</Text>
                          <Text style={[styles.itemizedColText, isSmallMobile && { fontSize: 10 }, { flex: isSmallMobile ? 1.3 : 1.5, textAlign: 'right' }]}>Price</Text>
                          <Text style={[styles.itemizedColText, isSmallMobile && { fontSize: 10 }, { flex: isSmallMobile ? 1.4 : 1.5, textAlign: 'right' }]}>Total</Text>
                        </View>

                        {selectedInvoice.items?.map((item, idx) => (
                          <View key={idx} style={styles.itemizedDataRow}>
                            <View style={{ flex: isSmallMobile ? 2.5 : 3 }}>
                              <Text style={[styles.itemizedItemName, isSmallMobile && { fontSize: 12 }]}>{item.name}</Text>
                              {item.notes ? (
                                <Text style={styles.itemizedItemNotes}>Note: {item.notes}</Text>
                              ) : null}
                            </View>
                            <Text style={[styles.itemizedItemQty, isSmallMobile && { fontSize: 12 }, { flex: isSmallMobile ? 0.8 : 1, textAlign: 'center' }]}>
                              {item.qty}
                            </Text>
                            <Text style={[styles.itemizedItemPrice, isSmallMobile && { fontSize: 11 }, { flex: isSmallMobile ? 1.3 : 1.5, textAlign: 'right' }]}>
                              Rs. {item.price.toLocaleString()}
                            </Text>
                            <Text style={[styles.itemizedItemTotal, isSmallMobile && { fontSize: 12 }, { flex: isSmallMobile ? 1.4 : 1.5, textAlign: 'right' }]}>
                              Rs. {(item.price * item.qty).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Financial Bill Calculation */}
                      <View style={styles.calculationCard}>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcKey}>Subtotal</Text>
                          <Text style={styles.calcVal}>Rs. {(selectedInvoice.subTotal || 0).toLocaleString()}</Text>
                        </View>
                        {(selectedInvoice.discount || 0) > 0 && (
                          <View style={styles.calcRow}>
                            <Text style={[styles.calcKey, { color: '#E74C3C' }]}>Discount Given</Text>
                            <Text style={[styles.calcVal, { color: '#E74C3C' }]}>
                              - Rs. {(selectedInvoice.discount || 0).toLocaleString()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.calcRow}>
                          <Text style={styles.calcKey}>GST Tax (16%)</Text>
                          <Text style={styles.calcVal}>Rs. {(selectedInvoice.tax || 0).toLocaleString()}</Text>
                        </View>
                        <View style={[styles.calcRow, styles.calcGrandRow]}>
                          <Text style={[styles.calcGrandKey, isSmallMobile && { fontSize: 14 }]}>TOTAL AMOUNT</Text>
                          <Text style={[styles.calcGrandVal, isSmallMobile && { fontSize: 16 }]}>Rs. {(selectedInvoice.total || 0).toLocaleString()}</Text>
                        </View>
                      </View>

                      {/* Payment Receipts Section */}
                      <View style={styles.paymentsSection}>
                        <Text style={styles.itemizedBoxTitle}>Payment Breakdown</Text>
                        {selectedInvoice.payments?.map((p, idx) => (
                          <View key={idx} style={styles.paymentDetailRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons
                                name={p.type === 'cash' ? 'cash-outline' : p.type === 'card' ? 'card-outline' : 'phone-portrait-outline'}
                                size={18}
                                color="#4a121a"
                              />
                              <Text style={[styles.paymentMethodName, isSmallMobile && { fontSize: 12 }]}>{p.type.toUpperCase()} PAYMENT</Text>
                            </View>
                            <Text style={[styles.paymentAmountVal, isSmallMobile && { fontSize: 13 }]}>Rs. {(p.amount || 0).toLocaleString()}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    /* THERMAL 80MM RECEIPT PREVIEW */
                    <View style={styles.thermalContainer}>
                      {Platform.OS === 'web' && (
                        <style dangerouslySetInnerHTML={{ __html: `
                          @media print {
                            body * {
                              visibility: hidden !important;
                            }
                            #thermal-printable-receipt, #thermal-printable-receipt * {
                              visibility: visible !important;
                            }
                            #thermal-printable-receipt {
                              position: fixed !important;
                              left: 0 !important;
                              top: 0 !important;
                              width: 80mm !important;
                              max-width: 100% !important;
                              margin: 0 !important;
                              padding: 6mm 4mm !important;
                              box-shadow: none !important;
                              border: none !important;
                              background: #fff !important;
                            }
                          }
                        `}} />
                      )}

                      <View nativeID="thermal-printable-receipt" style={[styles.thermalPaper, isSmallMobile && styles.thermalPaperSmallMobile]}>
                        <View style={styles.thermalHeader}>
                          <SultanLogo size="md" variant="bare" width={80} height={74} style={{ alignSelf: 'center', marginBottom: 6 }} />
                          <Text style={[styles.thermalBrandTitle, isSmallMobile && { fontSize: 18, letterSpacing: 1.5 }]}>SULTAN RESTAURANT</Text>
                          <Text style={styles.thermalBrandSub}>LUXURY DINING & BANQUET</Text>
                          <Text style={styles.thermalContactText}>Food Street, Culinary District, Lahore</Text>
                          <Text style={styles.thermalContactText}>Tel: 0300-1234567 • NTN: 8943120-4</Text>
                        </View>

                        <Text style={[styles.thermalDashedLine, isSmallMobile && { fontSize: 10 }]}>- - - - - - - - - - - - - - - - - - - -</Text>

                        <View style={styles.thermalMetaRow}>
                          <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>INV: #{selectedInvoice.id}</Text>
                          <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>
                            {new Date(selectedInvoice.timeSettled || selectedInvoice.timePlaced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.thermalMetaRow}>
                          <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>Type: {selectedInvoice.orderType.toUpperCase()}</Text>
                          <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>
                            Date: {new Date(selectedInvoice.timeSettled || selectedInvoice.timePlaced).toLocaleDateString()}
                          </Text>
                        </View>
                        {selectedInvoice.tableName && (
                          <View style={styles.thermalMetaRow}>
                            <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>Table: {selectedInvoice.tableName}</Text>
                          </View>
                        )}

                        {/* Order Creator & Cashier Display */}
                        {(() => {
                          const orderCreator = selectedInvoice.orderTakenBy || (selectedInvoice.server && !selectedInvoice.server.toLowerCase().includes('pos') ? selectedInvoice.server : 'Staff');
                          const cashierName = selectedInvoice.cashier || (selectedInvoice.server?.toLowerCase().includes('pos') ? selectedInvoice.server : 'Manager');
                          const isSame = orderCreator === cashierName;

                          if (isSame) {
                            return (
                              <View style={styles.thermalMetaRow}>
                                <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>Staff / Cashier: {cashierName}</Text>
                              </View>
                            );
                          }
                          return (
                            <>
                              <View style={styles.thermalMetaRow}>
                                <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>Order Taken By:</Text>
                                <Text style={[styles.thermalMetaText, { fontWeight: 'bold' }, isSmallMobile && { fontSize: 10 }]}>{orderCreator}</Text>
                              </View>
                              <View style={styles.thermalMetaRow}>
                                <Text style={[styles.thermalMetaText, isSmallMobile && { fontSize: 10 }]}>Billed By (Cashier):</Text>
                                <Text style={[styles.thermalMetaText, { fontWeight: 'bold' }, isSmallMobile && { fontSize: 10 }]}>{cashierName}</Text>
                              </View>
                            </>
                          );
                        })()}
                        {selectedInvoice.customer && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={styles.thermalMetaText}>Guest: {selectedInvoice.customer.name}</Text>
                            <Text style={styles.thermalMetaText}>Phone: {selectedInvoice.customer.phone}</Text>
                          </View>
                        )}

                        {selectedInvoice.status === 'voided' && (
                          <View style={{ marginVertical: 6, alignItems: 'center' }}>
                            <Text style={styles.thermalVoidNotice}>*** BILL VOIDED / CANCELLED ***</Text>
                          </View>
                        )}

                        <Text style={[styles.thermalDashedLine, isSmallMobile && { fontSize: 10 }]}>- - - - - - - - - - - - - - - - - - - -</Text>

                        {/* Items Header */}
                        <View style={styles.thermalItemHeader}>
                          <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '15%' }]}>Qty</Text>
                          <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '50%' }]}>Item</Text>
                          <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '35%', textAlign: 'right' }]}>Amount</Text>
                        </View>

                        {selectedInvoice.items?.map((item, idx) => (
                          <View key={idx} style={styles.thermalItemRow}>
                            <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '15%' }]}>{item.qty}x</Text>
                            <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '50%' }]}>{item.name}</Text>
                            <Text style={[styles.thermalCol, isSmallMobile && { fontSize: 10 }, { width: '35%', textAlign: 'right' }]}>
                              {(item.price * item.qty).toLocaleString()}
                            </Text>
                          </View>
                        ))}

                        <Text style={[styles.thermalDashedLine, isSmallMobile && { fontSize: 10 }]}>- - - - - - - - - - - - - - - - - - - -</Text>

                        <View style={styles.thermalSummaryRow}>
                          <Text style={[styles.thermalSummaryKey, isSmallMobile && { fontSize: 10 }]}>Sub Total:</Text>
                          <Text style={[styles.thermalSummaryVal, isSmallMobile && { fontSize: 10 }]}>Rs. {(selectedInvoice.subTotal || 0).toLocaleString()}</Text>
                        </View>
                        {(selectedInvoice.discount || 0) > 0 && (
                          <View style={styles.thermalSummaryRow}>
                            <Text style={[styles.thermalSummaryKey, isSmallMobile && { fontSize: 10 }]}>Discount:</Text>
                            <Text style={[styles.thermalSummaryVal, isSmallMobile && { fontSize: 10 }]}>- Rs. {(selectedInvoice.discount || 0).toLocaleString()}</Text>
                          </View>
                        )}
                        <View style={styles.thermalSummaryRow}>
                          <Text style={[styles.thermalSummaryKey, isSmallMobile && { fontSize: 10 }]}>GST Tax (16%):</Text>
                          <Text style={[styles.thermalSummaryVal, isSmallMobile && { fontSize: 10 }]}>Rs. {(selectedInvoice.tax || 0).toLocaleString()}</Text>
                        </View>

                        <Text style={[styles.thermalDashedLine, isSmallMobile && { fontSize: 10 }]}>================================</Text>

                        <View style={styles.thermalGrandRow}>
                          <Text style={[styles.thermalGrandKey, isSmallMobile && { fontSize: 13 }]}>NET PAYABLE:</Text>
                          <Text style={[styles.thermalGrandVal, isSmallMobile && { fontSize: 14 }]}>Rs. {(selectedInvoice.total || 0).toLocaleString()}</Text>
                        </View>

                        <Text style={[styles.thermalDashedLine, isSmallMobile && { fontSize: 10 }]}>================================</Text>

                        {selectedInvoice.payments?.map((p, idx) => (
                          <View key={idx} style={styles.thermalSummaryRow}>
                            <Text style={[styles.thermalSummaryKey, isSmallMobile && { fontSize: 10 }]}>Paid via {p.type.toUpperCase()}:</Text>
                            <Text style={[styles.thermalSummaryVal, isSmallMobile && { fontSize: 10 }]}>Rs. {(p.amount || 0).toLocaleString()}</Text>
                          </View>
                        ))}

                        <View style={styles.thermalFooter}>
                          <Text style={[styles.thermalFooterText, isSmallMobile && { fontSize: 10 }]}>Thank you for dining with Sultan!</Text>
                          <Text style={[styles.thermalFooterSub, isSmallMobile && { fontSize: 8 }]}>We look forward to serving you again.</Text>
                          <Text style={[styles.thermalFooterSub, isSmallMobile && { fontSize: 8 }]}>Software by Sultan POS System</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Action Bar */}
                <View style={[styles.modalActionBar, isSmallMobile && { padding: 10, gap: 8 }]}>
                  <TouchableOpacity
                    style={[styles.modalPrintBtn, isSmallMobile && { paddingVertical: 10 }]}
                    onPress={() => handlePrintOrShare(selectedInvoice)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="print" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalPrintBtnText, isSmallMobile && { fontSize: 13 }]}>Print / Share Receipt</Text>
                  </TouchableOpacity>

                  {selectedInvoice.status !== 'voided' && selectedInvoice.status !== 'refunded' && canProcessReturns && (
                    <TouchableOpacity
                      style={[styles.modalReturnBtn, isSmallMobile && { paddingVertical: 10, paddingHorizontal: 12 }]}
                      onPress={() => {
                        setSelectedInvoice(null);
                        const targetPath = userRole === 'admin' ? '/admin/returns' : '/manager/returns';
                        router.push(targetPath as any);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="return-down-back" size={18} color="#D84315" style={{ marginRight: 4 }} />
                      <Text style={[styles.modalReturnBtnText, isSmallMobile && { fontSize: 12 }]}>Return / Refund</Text>
                    </TouchableOpacity>
                  )}

                  {selectedInvoice.status !== 'voided' && canVoidInvoice && (
                    <TouchableOpacity
                      style={[styles.modalVoidBtn, isSmallMobile && { paddingVertical: 10, paddingHorizontal: 12 }]}
                      onPress={() => handleOpenVoidModal(selectedInvoice)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#E74C3C" style={{ marginRight: 4 }} />
                      <Text style={[styles.modalVoidBtnText, isSmallMobile && { fontSize: 12 }]}>Void</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* VOID CONFIRMATION MODAL */}
      <Modal visible={voidModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.voidModalCard}>
            <View style={styles.voidModalHeader}>
              <View style={styles.voidIconWrap}>
                <Ionicons name="warning" size={24} color="#C62828" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voidModalTitle}>Confirm Void Invoice</Text>
                <Text style={styles.voidModalSub}>
                  Invoice #{invoiceToVoid?.id} • Total: Rs. {(invoiceToVoid?.total || 0).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVoidModalVisible(false)}>
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.voidPromptText}>Select or specify reason for voiding this invoice:</Text>

            <View style={styles.reasonPresets}>
              {[
                'Wrong order punched',
                'Guest walked out / cancelled',
                'Duplicate billing entry',
                'Food return / customer dispute',
                'Other',
              ].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonChip, voidReason === reason && styles.reasonChipActive]}
                  onPress={() => setVoidReason(reason)}
                >
                  <Text style={[styles.reasonChipText, voidReason === reason && styles.reasonChipTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {voidReason === 'Other' && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Enter specific reason..."
                placeholderTextColor="#8E8E93"
                value={customVoidReason}
                onChangeText={setCustomVoidReason}
              />
            )}

            <View style={styles.voidActionRow}>
              <TouchableOpacity
                style={styles.cancelVoidBtn}
                onPress={() => setVoidModalVisible(false)}
              >
                <Text style={styles.cancelVoidBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmVoidBtn}
                onPress={handleConfirmVoid}
              >
                <Text style={styles.confirmVoidBtnText}>Confirm Void</Text>
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
    backgroundColor: '#4a121a',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  headerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerSmallMobile: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roleBadge: {
    backgroundColor: '#D5A943',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#4a121a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D5A943',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exportBtnText: {
    color: '#4a121a',
    fontWeight: '800',
    fontSize: 13,
  },
  contentScroll: {
    flex: 1,
    padding: 16,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiIconWrap: {
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: '#636366',
    marginTop: 3,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    paddingVertical: 0,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  sortBtn: {},
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a121a',
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    marginLeft: 4,
  },
  filterChip: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterChipActive: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  filterChipVoidActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  filterChipRefundActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  filterChipText: {
    fontSize: 12,
    color: '#3A3A3C',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipVoidTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 6,
  },
  resultsCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultsCountText: {
    fontSize: 13,
    color: '#636366',
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D84315',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 6,
    textAlign: 'center',
  },
  invoicesList: {
    gap: 12,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  invoiceCardVoided: {
    borderLeftColor: '#E74C3C',
    backgroundColor: '#FFFDFD',
  },
  invoiceCardRefunded: {
    borderLeftColor: '#6A1B9A',
    backgroundColor: '#FAF5FF',
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
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillSettled: {
    backgroundColor: '#E8F5E9',
  },
  statusPillVoided: {
    backgroundColor: '#FFEBEE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPillTextSettled: {
    color: '#2E7D32',
  },
  statusPillTextVoided: {
    color: '#C62828',
  },
  statusPillRefunded: {
    backgroundColor: '#F3E5F5',
  },
  statusPillTextRefunded: {
    color: '#6A1B9A',
  },
  statusPillPartialReturn: {
    backgroundColor: '#FFF3E0',
  },
  statusPillTextPartialReturn: {
    color: '#D84315',
  },
  invoiceIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDateText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F2F2F7',
  },
  metaCol: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  paymentMethodPill: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentMethodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a121a',
  },
  itemsPreviewBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  itemsCountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#636366',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  itemsPreviewText: {
    fontSize: 12,
    color: '#3A3A3C',
    lineHeight: 18,
  },
  voidAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  voidAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C62828',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F2F2F7',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardFooterMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  amountBreakdown: {
    gap: 2,
  },
  amountBreakdownMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  subtotalHint: {
    fontSize: 11,
    color: '#8E8E93',
  },
  grandTotalText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#4a121a',
  },
  grandTotalVoided: {
    textDecorationLine: 'line-through',
    color: '#C62828',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonsRowMobile: {
    width: '100%',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  detailBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a121a',
  },
  printActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a121a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  printActionBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  printActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voidBtn: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cardReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  cardReturnBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  cardReturnBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D84315',
  },
  cardFeedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cardFeedbackBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  cardFeedbackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },

  /* MODAL STYLES */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalSheetMobile: {
    maxWidth: '100%',
    maxHeight: '95%',
  },
  modalSheetSmallMobile: {
    maxHeight: '98%',
    borderRadius: 12,
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalInvoiceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  modalInvoiceSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F8F9FA',
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabBtnActive: {
    borderBottomColor: '#4a121a',
    backgroundColor: '#FFFFFF',
  },
  modalTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modalTabTextActive: {
    color: '#4a121a',
    fontWeight: '800',
  },
  modalBodyScroll: {
    padding: 18,
  },
  voidBannerModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  voidBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C62828',
  },
  voidBannerDesc: {
    fontSize: 11,
    color: '#B71C1C',
    marginTop: 2,
  },
  paidBannerModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  paidBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E7D32',
  },
  paidBannerDesc: {
    fontSize: 11,
    color: '#1B5E20',
    marginTop: 2,
  },
  metaDetailCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  metaDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaDetailKey: {
    fontSize: 12,
    color: '#636366',
    fontWeight: '500',
  },
  metaDetailVal: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '700',
  },
  itemizedBox: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemizedBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1C1E',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemizedHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  itemizedColText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#636366',
  },
  itemizedDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  itemizedItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  itemizedItemNotes: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemizedItemQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  itemizedItemPrice: {
    fontSize: 12,
    color: '#636366',
  },
  itemizedItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  calculationCard: {
    backgroundColor: '#FDFBF7',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6D2',
    gap: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcKey: {
    fontSize: 13,
    color: '#636366',
  },
  calcVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  calcGrandRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0D4BE',
    paddingTop: 8,
    marginTop: 4,
  },
  calcGrandKey: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4a121a',
  },
  calcGrandVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4a121a',
  },
  paymentsSection: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentMethodName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  paymentAmountVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#27AE60',
  },

  /* THERMAL PAPER RECEIPT PREVIEW */
  thermalContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  thermalPaper: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  thermalPaperSmallMobile: {
    padding: 12,
    borderRadius: 6,
    maxWidth: '100%',
  },
  thermalHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  thermalBrandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: 2,
    textAlign: 'center',
  },
  thermalBrandSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  thermalContactText: {
    fontSize: 10,
    color: '#636366',
    textAlign: 'center',
    marginTop: 2,
  },
  thermalDashedLine: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 4,
    letterSpacing: 1,
  },
  thermalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  thermalMetaText: {
    fontSize: 11,
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalVoidNotice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C62828',
    letterSpacing: 1,
  },
  thermalItemHeader: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  thermalItemRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  thermalCol: {
    fontSize: 11,
    color: '#222222',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  thermalSummaryKey: {
    fontSize: 11,
    color: '#444444',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalSummaryVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#222222',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  thermalGrandKey: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalGrandVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111111',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  thermalFooter: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  thermalFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  thermalFooterSub: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 3,
  },

  /* MODAL ACTION BAR */
  modalActionBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  modalPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a121a',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalPrintBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  modalVoidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  modalVoidBtnText: {
    color: '#C62828',
    fontWeight: '700',
    fontSize: 13,
  },
  modalReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  modalReturnBtnText: {
    color: '#D84315',
    fontWeight: '700',
    fontSize: 13,
  },

  /* VOID MODAL */
  voidModalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  voidModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  voidIconWrap: {
    backgroundColor: '#FFEBEE',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voidModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  voidModalSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  voidPromptText: {
    fontSize: 13,
    color: '#3A3A3C',
    fontWeight: '600',
    marginBottom: 10,
  },
  reasonPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  reasonChip: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  reasonChipActive: {
    backgroundColor: '#FFEBEE',
    borderColor: '#C62828',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#3A3A3C',
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: '#C62828',
    fontWeight: '700',
  },
  customReasonInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 10,
    fontSize: 13,
    color: '#1C1C1E',
    marginBottom: 16,
  },
  voidActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelVoidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  cancelVoidBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#636366',
  },
  confirmVoidBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#C62828',
  },
  confirmVoidBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
