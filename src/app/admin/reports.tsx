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
import { useRestaurantStore, Invoice } from '../../store/restaurantStore';
import { useOpsStore } from '../../store/opsStore';
import { usePlaylandStore } from '../../store/playlandStore';
import { useKitchenStore } from '../../store/kitchenStore';
import { money, formatDay, formatTime, startOfDay } from '../../utils/format';
import {
  SvgDonutChart,
  SvgVerticalBarChart,
  SvgHourlyVelocityChart,
  HorizontalRankedBars,
  PnLFlowWaterfallChart,
} from '../../components/reports/FinancialCharts';
import { useRolePermissions } from '../../store/roleStore';
import PermissionDeniedScreen from '../../components/PermissionDeniedScreen';

const LIGHT = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  burgundySoft: 'rgba(82, 23, 27, 0.08)',
  gold: '#B48214',
  goldSoft: '#FEF3C7',
  goldBorder: '#FDE68A',
  ink: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textDim: '#94A3B8',
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

type ReportTab = 'visuals' | 'pnl' | 'channels' | 'kitchen' | 'cashflow' | 'tax' | 'menu' | 'shrinkage';
type TimeFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function ReportsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const { can } = useRolePermissions();

  if (!can('canAccessReports')) {
    return (
      <PermissionDeniedScreen
        moduleName="Financial Reports & Analytics"
        urduModuleName="مالیاتی رپورٹس اور تجزیات"
        requiredPermission="canAccessReports"
        backRoute="/admin/dashboard"
      />
    );
  }

  // Stores
  const invoices = useRestaurantStore((s) => s.invoices || []);
  const tables = useRestaurantStore((s) => s.tables || []);
  const expenses = useOpsStore((s) => s.expenses || []);
  const purchaseOrders = useOpsStore((s) => s.purchaseOrders || []);
  const supplierPayments = useOpsStore((s) => s.supplierPayments || []);
  const damageRecords = useOpsStore((s) => s.damageRecords || []);
  const assets = useOpsStore((s) => s.assets || []);
  const playlandTickets = usePlaylandStore((s) => s.tickets || []);
  const kitchenSessions = useKitchenStore((s) => s.kitchenSessions || []);
  const recipes = useKitchenStore((s) => s.recipes || []);
  const kitchenConsumption = useKitchenStore((s) => s.kitchenConsumption || []);
  const kitchenManualUsage = useKitchenStore((s) => s.kitchenManualUsage || []);
  const submitClosing = useKitchenStore((s) => s.submitClosing);

  // UI State
  const [activeTab, setActiveTab] = useState<ReportTab>('visuals');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [closingReturnModalOpen, setClosingReturnModalOpen] = useState(false);
  const [closingReturnCounts, setClosingReturnCounts] = useState<Record<string, string>>({});
  const [closingReturnSelectedSessionId, setClosingReturnSelectedSessionId] = useState<string>('');

  // Time Window Boundaries
  const timeWindow = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfDay(now);
    const dayMs = 86400000;

    switch (timeFilter) {
      case 'today':
        return { start: todayStart, end: now, label: "Today's Financial Audit" };
      case 'yesterday':
        return { start: todayStart - dayMs, end: todayStart, label: "Yesterday's Audit" };
      case 'week':
        return { start: todayStart - 6 * dayMs, end: now, label: 'Past 7 Days Audit' };
      case 'month':
        return { start: todayStart - 29 * dayMs, end: now, label: 'Past 30 Days Audit' };
      case 'all':
      default:
        return { start: 0, end: now, label: 'All-Time Financial Ledger' };
    }
  }, [timeFilter]);

  // Micro-Level Financial Computation
  const financialData = useMemo(() => {
    const { start, end } = timeWindow;

    // 1. Restaurant Invoices
    const validInvoices = invoices.filter(
      (inv) => inv.status !== 'voided' && (inv.timeSettled || inv.timePlaced) >= start && (inv.timeSettled || inv.timePlaced) <= end
    );

    const voidedInvoices = invoices.filter(
      (inv) => inv.status === 'voided' && (inv.voidedAt || inv.timePlaced) >= start && (inv.voidedAt || inv.timePlaced) <= end
    );

    let grossFoodSales = 0;
    let totalDiscountGiven = 0;
    let totalTaxCollected = 0;
    let netRestaurantRevenue = 0;
    let refundsIssued = 0;

    let dineInSales = 0;
    let dineInOrders = 0;
    let takeawaySales = 0;
    let takeawayOrders = 0;
    let deliverySales = 0;
    let deliveryOrders = 0;

    let cashFromRestaurant = 0;
    let cardFromRestaurant = 0;
    let onlineFromRestaurant = 0;

    const hourlySales: Record<number, { count: number; revenue: number }> = {};
    for (let h = 0; h < 24; h++) hourlySales[h] = { count: 0, revenue: 0 };

    const categoryMap: Record<string, { qty: number; revenue: number }> = {};
    const itemMap: Record<string, { id: string; name: string; qty: number; revenue: number }> = {};

    validInvoices.forEach((inv) => {
      grossFoodSales += inv.subTotal || inv.total || 0;
      totalDiscountGiven += inv.discount || 0;
      totalTaxCollected += inv.tax || 0;
      netRestaurantRevenue += inv.total || 0;
      refundsIssued += inv.refundAmount || 0;

      // Channel breakdown
      if (inv.orderType === 'dine-in') {
        dineInSales += inv.total || 0;
        dineInOrders++;
      } else if (inv.orderType === 'takeaway') {
        takeawaySales += inv.total || 0;
        takeawayOrders++;
      } else if (inv.orderType === 'delivery') {
        deliverySales += inv.total || 0;
        deliveryOrders++;
      }

      // Payments breakdown
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach((p) => {
          if (p.type === 'cash') cashFromRestaurant += p.amount;
          else if (p.type === 'card') cardFromRestaurant += p.amount;
          else if (p.type === 'online') onlineFromRestaurant += p.amount;
        });
      } else {
        cashFromRestaurant += inv.total || 0;
      }

      // Hourly analysis
      const invTime = inv.timeSettled || inv.timePlaced;
      if (invTime) {
        const hour = new Date(invTime).getHours();
        if (hourlySales[hour]) {
          hourlySales[hour].count += 1;
          hourlySales[hour].revenue += inv.total || 0;
        }
      }

      // Item & Category breakdown
      if (inv.items) {
        inv.items.forEach((it) => {
          const itemRev = (it.price || 0) * (it.qty || 1);
          if (!itemMap[it.name]) {
            itemMap[it.name] = { id: it.id, name: it.name, qty: 0, revenue: 0 };
          }
          itemMap[it.name].qty += it.qty || 1;
          itemMap[it.name].revenue += itemRev;

          const catName = it.station === 'juice' ? 'Juice Bar & Drinks' : 'Main Kitchen Food';
          if (!categoryMap[catName]) categoryMap[catName] = { qty: 0, revenue: 0 };
          categoryMap[catName].qty += it.qty || 1;
          categoryMap[catName].revenue += itemRev;
        });
      }
    });

    // 2. Playland / Amusement Revenue
    const validPlayland = playlandTickets.filter(
      (t) => t.issuedAt >= start && t.issuedAt <= end && t.status !== 'refunded'
    );
    let playlandRevenue = 0;
    let playlandCash = 0;
    let playlandCard = 0;
    let playlandOnline = 0;

    validPlayland.forEach((t) => {
      playlandRevenue += t.totalAmount || 0;
      if (t.paymentMethod === 'cash') playlandCash += t.totalAmount || 0;
      else if (t.paymentMethod === 'card') playlandCard += t.totalAmount || 0;
      else playlandOnline += t.totalAmount || 0;
    });

    // 3. Combined Total Topline Gross Revenue
    const totalGrossRevenue = netRestaurantRevenue + playlandRevenue;

    // 4. Procurement & Direct Costs (COGS: Raw Material Inflows)
    const validPOs = purchaseOrders.filter(
      (po) => po.orderDate >= start && po.orderDate <= end && po.status !== 'cancelled'
    );
    let totalProcurementCOGS = validPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    // If no POs entered in period, estimate standard restaurant COGS at 35% of food sales
    const estimatedCOGS = totalProcurementCOGS > 0 ? totalProcurementCOGS : grossFoodSales * 0.35;
    const grossOperatingProfit = totalGrossRevenue - estimatedCOGS;
    const grossMarginPercent = totalGrossRevenue > 0 ? (grossOperatingProfit / totalGrossRevenue) * 100 : 0;

    // 5. Operating Expenses (Opex)
    const validExpenses = expenses.filter((e) => e.at >= start && e.at <= end);
    let totalOpex = 0;
    let cashOpex = 0;
    let onlineOpex = 0;
    const expenseCatMap: Record<string, number> = {};

    validExpenses.forEach((e) => {
      totalOpex += e.amount || 0;
      if (e.method === 'cash') cashOpex += e.amount || 0;
      else onlineOpex += e.amount || 0;

      expenseCatMap[e.category] = (expenseCatMap[e.category] || 0) + (e.amount || 0);
    });

    // 6. Supplier Cash Payments in Period
    const validSupplierPayments = supplierPayments.filter((sp) => sp.paidAt >= start && sp.paidAt <= end);
    let totalSupplierPayments = 0;
    let cashSupplierPayments = 0;
    validSupplierPayments.forEach((sp) => {
      totalSupplierPayments += sp.amount || 0;
      if (sp.method === 'cash') cashSupplierPayments += sp.amount || 0;
    });

    // 7. Damage & Shrinkage (Breakage Losses)
    const validDamages = damageRecords.filter((d) => d.incidentDate >= start && d.incidentDate <= end);
    let totalBreakageLoss = 0;
    let totalDamageRecovered = 0;
    let netBreakageLoss = 0;
    const damageDeptMap: Record<string, number> = {};

    validDamages.forEach((d) => {
      totalBreakageLoss += d.totalLoss || 0;
      totalDamageRecovered += d.amountRecovered || 0;
      const net = d.netLoss !== undefined ? d.netLoss : d.totalLoss - (d.amountRecovered || 0);
      netBreakageLoss += net;
      const dept = (d.location || d.category || 'General').toUpperCase();
      damageDeptMap[dept] = (damageDeptMap[dept] || 0) + net;
    });

    // 8. Asset Maintenance Costs
    let assetMaintenanceCosts = 0;
    assets.forEach((ast) => {
      if (ast.maintenanceLogs) {
        ast.maintenanceLogs.forEach((log) => {
          if (log.date >= start && log.date <= end) {
            assetMaintenanceCosts += log.cost || 0;
          }
        });
      }
    });

    // 9. Net Operating Profit (EBITDA)
    // Formula: Gross Profit - Opex - Net Breakage Loss
    const netOperatingProfit = grossOperatingProfit - totalOpex - netBreakageLoss;
    const netProfitMargin = totalGrossRevenue > 0 ? (netOperatingProfit / totalGrossRevenue) * 100 : 0;

    // 10. Cash Flow / Cash Register Audit
    const totalCashInflow = cashFromRestaurant + playlandCash;
    const totalCashOutflow = cashOpex + cashSupplierPayments;
    const netCashFloat = totalCashInflow - totalCashOutflow;

    // Sort Top Items
    const topDishes = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 11. Kitchen Production, Shift Closing Return & Wastage Difference
    // A. Cooked Dishes Aggregation
    const cookedDishesMap: Record<
      string,
      {
        name: string;
        category: string;
        station: string;
        qty: number;
        price: number;
        totalRevenue: number;
      }
    > = {};

    let totalPortionsCooked = 0;
    let totalFoodTurnover = 0;

    validInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const itemQty = item.qty || 1;
        totalPortionsCooked += itemQty;
        const rev = (item.price || 0) * itemQty;
        totalFoodTurnover += rev;

        if (!cookedDishesMap[item.name]) {
          const n = item.name.toLowerCase();
          const station =
            item.station === 'juice' || n.includes('margarita') || n.includes('juice') || n.includes('shake')
              ? 'Juice Bar & Drinks'
              : n.includes('kebab') || n.includes('tikka') || n.includes('boti') || n.includes('bbq')
              ? 'Charcoal BBQ Station'
              : n.includes('biryani') || n.includes('rice') || n.includes('pulao')
              ? 'Biryani & Rice Counter'
              : n.includes('naan') || n.includes('roti') || n.includes('kulcha')
              ? 'Tandoor & Breads'
              : 'Handi & Karahi Line';

          cookedDishesMap[item.name] = {
            name: item.name,
            category: item.station === 'juice' ? 'Beverages' : 'Food',
            station,
            qty: 0,
            price: item.price || 0,
            totalRevenue: 0,
          };
        }
        cookedDishesMap[item.name].qty += itemQty;
        cookedDishesMap[item.name].totalRevenue += rev;
      });
    });

    const cookedDishesList = Object.values(cookedDishesMap).sort((a, b) => b.qty - a.qty);

    // B. Station Breakdown
    const stationCookingSummary: Record<string, { station: string; portions: number; revenue: number }> = {
      'Handi & Karahi Line': { station: 'Handi & Karahi Line', portions: 0, revenue: 0 },
      'Charcoal BBQ Station': { station: 'Charcoal BBQ Station', portions: 0, revenue: 0 },
      'Biryani & Rice Counter': { station: 'Biryani & Rice Counter', portions: 0, revenue: 0 },
      'Tandoor & Breads': { station: 'Tandoor & Breads', portions: 0, revenue: 0 },
      'Juice Bar & Drinks': { station: 'Juice Bar & Drinks', portions: 0, revenue: 0 },
    };

    cookedDishesList.forEach((dish) => {
      if (stationCookingSummary[dish.station]) {
        stationCookingSummary[dish.station].portions += dish.qty;
        stationCookingSummary[dish.station].revenue += dish.totalRevenue;
      } else {
        stationCookingSummary['Handi & Karahi Line'].portions += dish.qty;
        stationCookingSummary['Handi & Karahi Line'].revenue += dish.totalRevenue;
      }
    });

    // C. Kitchen Raw Stock Inflows, Shift Closing Returns, and Wastage Reconciliation
    let relevantSessions = kitchenSessions.filter(
      (s) => (s.issuedAt || s.createdAt) >= start && (s.issuedAt || s.createdAt) <= end
    );
    if (relevantSessions.length === 0) {
      relevantSessions = kitchenSessions;
    }

    type RawReconItem = {
      itemId: string;
      itemName: string;
      unit: string;
      category: string;
      costPerUnit: number;
      issued: number;
      cooked: number;
      returned: number;
      variance: number;
      wastageCost: number;
      wastagePct: number;
      status: 'optimal' | 'acceptable' | 'alert';
    };

    const reconMap: Record<string, RawReconItem> = {};

    relevantSessions.forEach((sess) => {
      sess.lines.forEach((l) => {
        const itemKey = l.itemId || l.itemName;
        if (!reconMap[itemKey]) {
          reconMap[itemKey] = {
            itemId: l.itemId,
            itemName: l.itemName,
            unit: l.unit || 'kg',
            category: l.category || 'Kitchen Provisions',
            costPerUnit: l.costPerUnit || 0,
            issued: 0,
            cooked: 0,
            returned: 0,
            variance: 0,
            wastageCost: 0,
            wastagePct: 0,
            status: 'optimal',
          };
        }
        const totalLineIssued = (l.issued || 0) + (l.topUp || 0) + (l.localPurchased || 0);
        reconMap[itemKey].issued += totalLineIssued;

        // Returned to store at shift closing
        const lineReturned = l.returned !== undefined ? l.returned : 0;
        reconMap[itemKey].returned += lineReturned;

        // Cooked usage in cooking
        const lineCooked =
          l.expectedAtClose !== undefined
            ? Math.max(0, totalLineIssued - l.expectedAtClose)
            : Math.max(0, totalLineIssued - lineReturned - (l.variance || 0));
        reconMap[itemKey].cooked += lineCooked;
      });
    });

    // Calculate final difference, wastage & cost
    let totalStoreIssuedValue = 0;
    let totalCookedRawValue = 0;
    let totalReturnedToStoreValue = 0;
    let totalKitchenWastageCost = 0;

    const rawReconciliationList: RawReconItem[] = Object.values(reconMap)
      .map((item) => {
        // Difference / Wastage = Issued - (Cooked + Returned)
        const diff = Math.max(0, Math.round((item.issued - (item.cooked + item.returned)) * 100) / 100);
        const wastageCost = Math.round(diff * item.costPerUnit);
        const wastagePct = item.issued > 0 ? (diff / item.issued) * 100 : 0;

        let status: 'optimal' | 'acceptable' | 'alert' = 'optimal';
        if (wastagePct > 3.5) status = 'alert';
        else if (diff > 0) status = 'acceptable';

        totalStoreIssuedValue += item.issued * item.costPerUnit;
        totalCookedRawValue += item.cooked * item.costPerUnit;
        totalReturnedToStoreValue += item.returned * item.costPerUnit;
        totalKitchenWastageCost += wastageCost;

        return {
          ...item,
          variance: diff,
          wastageCost,
          wastagePct,
          status,
        };
      })
      .sort((a, b) => b.wastageCost - a.wastageCost);

    // Wastage Reasons Breakdown
    const wastageReasonsMap: Record<string, { reason: string; label: string; count: number; cost: number }> = {
      spoilage: { reason: 'spoilage', label: 'Fat Trimming & Bone Cut Waste', count: 0, cost: 0 },
      recook: { reason: 'recook', label: 'Overcooked, Scorched & Burnt', count: 0, cost: 0 },
      spill: { reason: 'spill', label: 'Counter Floor Drips & Spills', count: 0, cost: 0 },
      staff_meal: { reason: 'staff_meal', label: 'Staff Meal Allowances', count: 0, cost: 0 },
      other: { reason: 'other', label: 'General Kitchen Shrinkage', count: 0, cost: 0 },
    };

    kitchenManualUsage.forEach((mu) => {
      const rKey = mu.reason in wastageReasonsMap ? mu.reason : 'other';
      wastageReasonsMap[rKey].count++;
      const itemCost = reconMap[mu.itemId]?.costPerUnit || 500;
      wastageReasonsMap[rKey].cost += Math.abs(mu.delta) * itemCost;
    });

    const averageYieldRate =
      totalStoreIssuedValue > 0
        ? Math.min(100, Math.max(0, ((totalCookedRawValue + totalReturnedToStoreValue) / totalStoreIssuedValue) * 100))
        : 100;

    return {
      totalInvoicesCount: validInvoices.length,
      voidedInvoicesCount: voidedInvoices.length,
      totalOrders: validInvoices.length + validPlayland.length,
      grossFoodSales,
      totalDiscountGiven,
      totalTaxCollected,
      netRestaurantRevenue,
      playlandRevenue,
      totalGrossRevenue,
      estimatedCOGS,
      isEstimatedCOGS: totalProcurementCOGS === 0,
      totalProcurementCOGS,
      grossOperatingProfit,
      grossMarginPercent,
      totalOpex,
      cashOpex,
      onlineOpex,
      expenseCatMap,
      netBreakageLoss,
      totalBreakageLoss,
      totalDamageRecovered,
      assetMaintenanceCosts,
      netOperatingProfit,
      netProfitMargin,
      // Payment Channels
      cashTotal: cashFromRestaurant + playlandCash,
      cardTotal: cardFromRestaurant + playlandCard,
      onlineTotal: onlineFromRestaurant + playlandOnline,
      // Order Channels
      dineInSales,
      dineInOrders,
      takeawaySales,
      takeawayOrders,
      deliverySales,
      deliveryOrders,
      playlandTicketsCount: validPlayland.length,
      // Cash Flow
      totalCashInflow,
      totalCashOutflow,
      netCashFloat,
      // Micro Stats
      topDishes,
      categoryMap,
      hourlySales,
      validInvoices,
      damageDeptMap,
      // 11. Kitchen Production, Shift Closing Return & Wastage Difference
      cookedDishesList,
      totalPortionsCooked,
      totalFoodTurnover,
      stationCookingSummary,
      rawReconciliationList,
      totalStoreIssuedValue,
      totalCookedRawValue,
      totalReturnedToStoreValue,
      totalKitchenWastageCost,
      averageYieldRate,
      wastageReasonsMap,
      relevantSessions,
    };
  }, [
    timeWindow,
    invoices,
    expenses,
    purchaseOrders,
    supplierPayments,
    damageRecords,
    assets,
    playlandTickets,
    kitchenSessions,
    recipes,
    kitchenManualUsage,
  ]);

  const handleExportCSV = () => {
    if (financialData.validInvoices.length === 0) {
      alertMsg('No Data', 'No transactions found in this time range to export.');
      return;
    }

    const headers = 'Invoice ID,Time Settled,Order Type,Table/Counter,Server,SubTotal,Discount,Tax (GST),Total (PKR),Payment Breakdown\n';
    const rows = financialData.validInvoices
      .map(
        (inv) =>
          `"${inv.id}","${new Date(inv.timeSettled || inv.timePlaced).toLocaleString()}","${inv.orderType}","${
            inv.tableName || 'Takeaway'
          }","${inv.server || 'Staff'}","${inv.subTotal || inv.total}","${inv.discount || 0}","${inv.tax || 0}","${
            inv.total
          }","${(inv.payments || []).map((p) => `${p.type}: Rs.${p.amount}`).join(' | ')}"`
      )
      .join('\n');

    const csvContent = headers + rows;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Sultan_Financial_Audit_${timeFilter}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert('CSV Generated', `Exported ${financialData.validInvoices.length} transactions.`);
    }
  };

  const handleOpenClosingReturn = () => {
    const sess =
      kitchenSessions.find((s) => s.status === 'issued') ||
      kitchenSessions.find((s) => s.status === 'closed') ||
      kitchenSessions[0];
    if (sess) {
      setClosingReturnSelectedSessionId(sess.id);
      const initialCounts: Record<string, string> = {};
      sess.lines.forEach((l) => {
        initialCounts[l.itemId] = l.returned !== undefined ? String(l.returned) : '';
      });
      setClosingReturnCounts(initialCounts);
      setClosingReturnModalOpen(true);
    } else {
      alertMsg('No Kitchen Shift', 'No kitchen shift session found to reconcile.');
    }
  };

  const handleSaveClosingReturn = () => {
    if (!closingReturnSelectedSessionId) return;
    const numericCounts: Record<string, number> = {};
    Object.entries(closingReturnCounts).forEach(([itemId, valStr]) => {
      const num = parseFloat(valStr);
      if (!isNaN(num) && num >= 0) {
        numericCounts[itemId] = num;
      }
    });

    const res = submitClosing({
      sessionId: closingReturnSelectedSessionId,
      counts: numericCounts,
      cashReturned: 0,
      notes: 'Closing stock returned to store logged via Financial & Kitchen Audit Deck',
      by: 'Head Chef / Manager',
    });

    if (res.ok) {
      alertMsg(
        'Reconciliation Saved',
        'Shift closing store return counts updated successfully. Difference and wastage recalculated!'
      );
      setClosingReturnModalOpen(false);
    } else {
      alertMsg('Reconciliation Note', res.error || 'Closing return submitted.');
      setClosingReturnModalOpen(false);
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
            onPress={() => router.push('/admin/dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={LIGHT.burgundy} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="bar-chart" size={20} color={LIGHT.burgundy} />
              <Text style={styles.headerTitle}>Financial Intelligence & Audit</Text>
              <View style={styles.auditBadge}>
                <Text style={styles.auditBadgeText}>CFO AUDIT DECK</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>{timeWindow.label} • Micro-level P&L, Cash Flow, Tax & Channels</Text>
          </View>
        </View>

        {/* Header Actions */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => setIsPrintModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="print-outline" size={16} color={LIGHT.burgundy} />
            <Text style={styles.actionBtnOutlineText}>Print P&L</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleExportCSV} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnPrimaryText}>Export Ledger</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Horizon Filter Bar */}
      <View style={styles.timeFilterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeScroll}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Past 7 Days' },
            { key: 'month', label: 'Past 30 Days' },
            { key: 'all', label: 'All-Time Total' },
          ].map((tf) => {
            const active = timeFilter === tf.key;
            return (
              <TouchableOpacity
                key={tf.key}
                style={[styles.timeChip, active && styles.timeChipActive]}
                onPress={() => setTimeFilter(tf.key as TimeFilter)}
              >
                <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{tf.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { key: 'visuals', label: 'Visual Analytics & Charts', icon: 'stats-chart-outline' },
            { key: 'pnl', label: 'P&L Statement', icon: 'calculator-outline' },
            { key: 'channels', label: 'Sales & Channels', icon: 'pie-chart-outline' },
            { key: 'kitchen', label: 'Kitchen & Wastage Audit', icon: 'flame-outline' },
            { key: 'cashflow', label: 'Cash Register Audit', icon: 'cash-outline' },
            { key: 'tax', label: 'GST & Discounts', icon: 'receipt-outline' },
            { key: 'menu', label: 'Menu Profitability', icon: 'restaurant-outline' },
            { key: 'shrinkage', label: 'Breakage & Losses', icon: 'alert-circle-outline' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.subTabBtn, active && styles.subTabBtnActive]}
                onPress={() => setActiveTab(tab.key as ReportTab)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={15}
                  color={active ? LIGHT.burgundy : LIGHT.textMuted}
                />
                <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ----------------- TOP EXECUTIVE KPI RIBBON ----------------- */}
        <View style={styles.kpiRow}>
          {/* Gross Topline Revenue */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.goldBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>GROSS TOPLINE REVENUE</Text>
              <View style={[styles.iconBox, { backgroundColor: LIGHT.goldSoft }]}>
                <Ionicons name="trending-up" size={17} color={LIGHT.gold} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.gold }]}>{money(financialData.totalGrossRevenue)}</Text>
            <Text style={styles.kpiHint}>
              {financialData.totalOrders} total transactions ({financialData.totalInvoicesCount} food +{' '}
              {financialData.playlandTicketsCount} rides)
            </Text>
          </View>

          {/* Gross Operating Profit */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.blueBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>GROSS OPERATING PROFIT</Text>
              <View style={[styles.iconBox, { backgroundColor: LIGHT.blueSoft }]}>
                <Ionicons name="layers-outline" size={17} color={LIGHT.blue} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.blue }]}>
              {money(financialData.grossOperatingProfit)}
            </Text>
            <Text style={styles.kpiHint}>
              Margin: {financialData.grossMarginPercent.toFixed(1)}% (COGS: {money(financialData.estimatedCOGS)})
            </Text>
          </View>

          {/* Total OPEX */}
          <View style={[styles.kpiCard, { borderColor: LIGHT.roseBorder }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>OPERATING EXPENSES (OPEX)</Text>
              <View style={[styles.iconBox, { backgroundColor: LIGHT.roseSoft }]}>
                <Ionicons name="card-outline" size={17} color={LIGHT.rose} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: LIGHT.rose }]}>{money(financialData.totalOpex)}</Text>
            <Text style={styles.kpiHint}>Salaries, utilities, fuel & supplies</Text>
          </View>

          {/* Net Operating Profit (EBITDA) */}
          <View
            style={[
              styles.kpiCard,
              {
                borderColor: financialData.netOperatingProfit >= 0 ? LIGHT.emeraldBorder : LIGHT.roseBorder,
                backgroundColor: financialData.netOperatingProfit >= 0 ? '#FFFFFF' : '#FFF1F2',
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>NET PROFIT (EBITDA)</Text>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      financialData.netOperatingProfit >= 0 ? LIGHT.emeraldSoft : LIGHT.roseSoft,
                  },
                ]}
              >
                <Ionicons
                  name={financialData.netOperatingProfit >= 0 ? 'shield-checkmark' : 'alert-circle'}
                  size={17}
                  color={financialData.netOperatingProfit >= 0 ? LIGHT.emerald : LIGHT.rose}
                />
              </View>
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: financialData.netOperatingProfit >= 0 ? LIGHT.emerald : LIGHT.rose },
              ]}
            >
              {money(financialData.netOperatingProfit)}
            </Text>
            <Text style={styles.kpiHint}>
              Net Margin: {financialData.netProfitMargin.toFixed(1)}% of revenue
            </Text>
          </View>
        </View>

        {/* ----------------- TAB 0: VISUAL ANALYTICS & CHARTS ----------------- */}
        {activeTab === 'visuals' && (
          <View style={styles.section}>
            {/* Row 1: Flow Waterfall & Revenue/Expense Comparison */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row' }]}>
              <View style={[styles.chartCol, { flex: 1.2 }]}>
                <PnLFlowWaterfallChart
                  grossRevenue={financialData.totalGrossRevenue}
                  cogs={financialData.estimatedCOGS}
                  opex={financialData.totalOpex}
                  damageLoss={financialData.netBreakageLoss}
                  netProfit={financialData.netOperatingProfit}
                />
              </View>

              <View style={[styles.chartCol, { flex: 1 }]}>
                <View style={styles.chartPanel}>
                  <View style={styles.chartPanelHeader}>
                    <Text style={styles.chartPanelTitle}>Financial Structure Overview</Text>
                    <Text style={styles.chartPanelSub}>Topline vs Costs vs Operating Margin</Text>
                  </View>
                  <SvgVerticalBarChart
                    data={[
                      { label: 'Gross Sales', value: financialData.totalGrossRevenue, color: '#059669', sublabel: 'Inflows' },
                      { label: 'Food Sales', value: financialData.netRestaurantRevenue, color: '#10B981', sublabel: 'Rest.' },
                      { label: 'Playland', value: financialData.playlandRevenue, color: '#0EA5E9', sublabel: 'Tickets' },
                      { label: 'COGS', value: financialData.estimatedCOGS, color: '#D97706', sublabel: 'Procure.' },
                      { label: 'Opex', value: financialData.totalOpex, color: '#E11D48', sublabel: 'Overhead' },
                      {
                        label: 'Net Profit',
                        value: financialData.netOperatingProfit,
                        color: financialData.netOperatingProfit >= 0 ? '#059669' : '#BE123C',
                        sublabel: `${financialData.netProfitMargin.toFixed(0)}% Margin`,
                      },
                    ]}
                    height={210}
                    barWidth={36}
                  />
                </View>
              </View>
            </View>

            {/* Row 2: Tender Donut & 24-Hour Velocity Curve */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row', marginTop: 16 }]}>
              <View style={[styles.chartCol, { flex: 1 }]}>
                <View style={styles.chartPanel}>
                  <View style={styles.chartPanelHeader}>
                    <Text style={styles.chartPanelTitle}>Payment Tender Distribution</Text>
                    <Text style={styles.chartPanelSub}>Cash vs POS Card vs Online Transfer</Text>
                  </View>
                  <SvgDonutChart
                    data={[
                      { label: 'Cash', value: financialData.cashTotal, color: '#059669' },
                      { label: 'Card / POS', value: financialData.cardTotal, color: '#2563EB' },
                      { label: 'Online / IBFT', value: financialData.onlineTotal, color: '#7C3AED' },
                    ]}
                    size={200}
                    centerSubtitle="SETTLED"
                    centerTitle={money(financialData.totalGrossRevenue)}
                  />
                </View>
              </View>

              <View style={[styles.chartCol, { flex: 1.3 }]}>
                <SvgHourlyVelocityChart
                  hourlyData={financialData.hourlySales}
                  height={190}
                  accentColor={LIGHT.burgundy}
                />
              </View>
            </View>

            {/* Row 3: Sales Channels & Top 5 Best-Selling Dishes */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row', marginTop: 16 }]}>
              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Fulfillment Channels Share"
                  subtitle="Revenue distribution by customer touchpoint"
                  items={[
                    { label: 'Dine-In Restaurant', value: financialData.dineInSales, count: financialData.dineInOrders, color: '#B48214' },
                    { label: 'Takeaway Counter', value: financialData.takeawaySales, count: financialData.takeawayOrders, color: '#2563EB' },
                    { label: 'Delivery Service', value: financialData.deliverySales, count: financialData.deliveryOrders, color: '#059669' },
                    { label: 'Basement Playland', value: financialData.playlandRevenue, count: financialData.playlandTicketsCount, color: '#7C3AED' },
                  ]}
                />
              </View>

              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Top 5 Best-Selling Dishes"
                  subtitle="Highest revenue generating menu items"
                  items={financialData.topDishes.slice(0, 5).map((d) => ({
                    label: d.name,
                    value: d.revenue,
                    count: d.qty,
                  }))}
                />
              </View>
            </View>

            {/* Row 4: Expense Categories & Breakage Losses by Dept */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row', marginTop: 16 }]}>
              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Opex Category Breakdown"
                  subtitle="Distribution of operating expenses"
                  items={Object.entries(financialData.expenseCatMap).map(([cat, val]) => ({
                    label: cat,
                    value: val,
                    color: '#E11D48',
                  }))}
                />
              </View>

              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Damage & Breakage by Department"
                  subtitle="Crockery, glass & equipment write-offs"
                  items={Object.entries(financialData.damageDeptMap).map(([dept, val]) => ({
                    label: dept,
                    value: val,
                    color: '#9333EA',
                  }))}
                />
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 1: P&L STATEMENT ----------------- */}
        {activeTab === 'pnl' && (
          <View style={styles.section}>
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="document-text-outline" size={20} color={LIGHT.burgundy} />
                  <Text style={styles.panelTitle}>Sultan Restaurant & Playland — Micro P&L Statement</Text>
                </View>
                <Text style={styles.panelSub}>{timeWindow.label}</Text>
              </View>

              {/* Visual Flow Waterfall Chart */}
              <View style={{ marginBottom: 18 }}>
                <PnLFlowWaterfallChart
                  grossRevenue={financialData.totalGrossRevenue}
                  cogs={financialData.estimatedCOGS}
                  opex={financialData.totalOpex}
                  damageLoss={financialData.netBreakageLoss}
                  netProfit={financialData.netOperatingProfit}
                />
              </View>

              {/* P&L Line Items */}
              <View style={styles.statementTable}>
                {/* 1. REVENUE */}
                <View style={styles.statementCategoryHeader}>
                  <Text style={styles.statementCatText}>1. OPERATING REVENUES (TOPLINE)</Text>
                  <Text style={styles.statementCatVal}>{money(financialData.totalGrossRevenue)}</Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>Dine-in Restaurant Food Sales</Text>
                  <Text style={styles.statementVal}>{money(financialData.dineInSales)}</Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>Takeaway & Fast Counter Orders</Text>
                  <Text style={styles.statementVal}>{money(financialData.takeawaySales)}</Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>Delivery Orders</Text>
                  <Text style={styles.statementVal}>{money(financialData.deliverySales)}</Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>Basement Playland & Amusement Tickets</Text>
                  <Text style={styles.statementVal}>{money(financialData.playlandRevenue)}</Text>
                </View>

                <View style={[styles.statementRow, styles.subtotalRow]}>
                  <Text style={styles.subtotalText}>TOTAL GROSS REVENUE (A)</Text>
                  <Text style={styles.subtotalValGold}>{money(financialData.totalGrossRevenue)}</Text>
                </View>

                {/* 2. COST OF GOODS SOLD */}
                <View style={styles.statementCategoryHeader}>
                  <Text style={styles.statementCatText}>2. COST OF GOODS SOLD (COGS / RAW KITCHEN INFLOWS)</Text>
                  <Text style={[styles.statementCatVal, { color: LIGHT.amber }]}>
                    ({money(financialData.estimatedCOGS)})
                  </Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>
                    Raw Kitchen Provisions & Supplier POs {financialData.isEstimatedCOGS ? '(Est. 35% Food Cost)' : '(Actual POs)'}
                  </Text>
                  <Text style={styles.statementVal}>{money(financialData.estimatedCOGS)}</Text>
                </View>

                <View style={[styles.statementRow, styles.subtotalRow, { backgroundColor: LIGHT.blueSoft }]}>
                  <Text style={[styles.subtotalText, { color: LIGHT.blue }]}>GROSS OPERATING PROFIT (A - B)</Text>
                  <Text style={[styles.subtotalValGold, { color: LIGHT.blue }]}>
                    {money(financialData.grossOperatingProfit)} ({financialData.grossMarginPercent.toFixed(1)}%)
                  </Text>
                </View>

                {/* 3. OPERATING EXPENSES */}
                <View style={styles.statementCategoryHeader}>
                  <Text style={styles.statementCatText}>3. OPERATING EXPENDITURES (OPEX)</Text>
                  <Text style={[styles.statementCatVal, { color: LIGHT.rose }]}>({money(financialData.totalOpex)})</Text>
                </View>

                {Object.keys(financialData.expenseCatMap).length === 0 ? (
                  <View style={styles.statementRow}>
                    <Text style={[styles.statementItem, { fontStyle: 'italic', color: LIGHT.textDim }]}>
                      No operational expenses recorded for this window.
                    </Text>
                    <Text style={styles.statementVal}>Rs. 0</Text>
                  </View>
                ) : (
                  Object.entries(financialData.expenseCatMap).map(([cat, amt]) => (
                    <View key={cat} style={styles.statementRow}>
                      <Text style={styles.statementItem}>{cat}</Text>
                      <Text style={styles.statementVal}>{money(amt)}</Text>
                    </View>
                  ))
                )}

                <View style={[styles.statementRow, styles.subtotalRow]}>
                  <Text style={styles.subtotalText}>TOTAL OPEX EXPENDITURES (C)</Text>
                  <Text style={[styles.subtotalValGold, { color: LIGHT.rose }]}>{money(financialData.totalOpex)}</Text>
                </View>

                {/* 4. LOSS, SHRINKAGE & WRITE-OFFS */}
                <View style={styles.statementCategoryHeader}>
                  <Text style={styles.statementCatText}>4. LOSS, BREAKAGE & SHRINKAGE ADJUSTMENTS</Text>
                  <Text style={[styles.statementCatVal, { color: LIGHT.rose }]}>
                    ({money(financialData.netBreakageLoss)})
                  </Text>
                </View>

                <View style={styles.statementRow}>
                  <Text style={styles.statementItem}>Net Crockery & Glassware Breakages (Written Off)</Text>
                  <Text style={styles.statementVal}>{money(financialData.netBreakageLoss)}</Text>
                </View>

                {financialData.assetMaintenanceCosts > 0 ? (
                  <View style={styles.statementRow}>
                    <Text style={styles.statementItem}>Asset & Equipment Maintenance Services</Text>
                    <Text style={styles.statementVal}>{money(financialData.assetMaintenanceCosts)}</Text>
                  </View>
                ) : null}

                {/* 5. FINAL NET PROFIT BOTTOM LINE */}
                <View
                  style={[
                    styles.statementRow,
                    styles.finalNetRow,
                    {
                      backgroundColor:
                        financialData.netOperatingProfit >= 0 ? LIGHT.emeraldSoft : LIGHT.roseSoft,
                      borderColor:
                        financialData.netOperatingProfit >= 0 ? LIGHT.emeraldBorder : LIGHT.roseBorder,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.finalNetTitle,
                        { color: financialData.netOperatingProfit >= 0 ? '#065F46' : '#9F1239' },
                      ]}
                    >
                      NET OPERATING PROFIT / (LOSS) — BOTTOM LINE
                    </Text>
                    <Text style={{ fontSize: 11, color: LIGHT.textSecondary, marginTop: 2 }}>
                      Net margin: {financialData.netProfitMargin.toFixed(1)}% after all COGS, Opex and Shrinkage
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.finalNetValue,
                      { color: financialData.netOperatingProfit >= 0 ? '#065F46' : '#9F1239' },
                    ]}
                  >
                    {money(financialData.netOperatingProfit)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 2: CHANNELS & SALES ----------------- */}
        {activeTab === 'channels' && (
          <View style={styles.section}>
            {/* Payment Method Split */}
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Ionicons name="card-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Payment Tender Breakdown (Micro Audit)</Text>
              </View>

              {/* Visual Donut Chart */}
              <View style={{ marginBottom: 16 }}>
                <SvgDonutChart
                  data={[
                    { label: 'Cash', value: financialData.cashTotal, color: '#059669' },
                    { label: 'Card / POS', value: financialData.cardTotal, color: '#2563EB' },
                    { label: 'Online / IBFT', value: financialData.onlineTotal, color: '#7C3AED' },
                  ]}
                  size={190}
                  centerSubtitle="SETTLED"
                  centerTitle={money(financialData.totalGrossRevenue)}
                />
              </View>

              <View style={styles.channelGrid}>
                {/* Cash */}
                <View style={[styles.channelCard, { borderColor: LIGHT.emeraldBorder }]}>
                  <View style={styles.channelHeader}>
                    <Text style={styles.channelLabel}>CASH PAYMENTS</Text>
                    <Ionicons name="cash" size={18} color={LIGHT.emerald} />
                  </View>
                  <Text style={[styles.channelAmount, { color: LIGHT.emerald }]}>
                    {money(financialData.cashTotal)}
                  </Text>
                  <Text style={styles.channelSub}>
                    {financialData.totalGrossRevenue > 0
                      ? ((financialData.cashTotal / financialData.totalGrossRevenue) * 100).toFixed(1)
                      : 0}
                    % of total revenue
                  </Text>
                </View>

                {/* Card */}
                <View style={[styles.channelCard, { borderColor: LIGHT.blueBorder }]}>
                  <View style={styles.channelHeader}>
                    <Text style={styles.channelLabel}>CREDIT / DEBIT CARD</Text>
                    <Ionicons name="card" size={18} color={LIGHT.blue} />
                  </View>
                  <Text style={[styles.channelAmount, { color: LIGHT.blue }]}>
                    {money(financialData.cardTotal)}
                  </Text>
                  <Text style={styles.channelSub}>
                    {financialData.totalGrossRevenue > 0
                      ? ((financialData.cardTotal / financialData.totalGrossRevenue) * 100).toFixed(1)
                      : 0}
                    % of total revenue
                  </Text>
                </View>

                {/* Online / IBFT */}
                <View style={[styles.channelCard, { borderColor: LIGHT.purpleBorder }]}>
                  <View style={styles.channelHeader}>
                    <Text style={styles.channelLabel}>ONLINE / IBFT TRANSFER</Text>
                    <Ionicons name="globe-outline" size={18} color={LIGHT.purple} />
                  </View>
                  <Text style={[styles.channelAmount, { color: LIGHT.purple }]}>
                    {money(financialData.onlineTotal)}
                  </Text>
                  <Text style={styles.channelSub}>
                    {financialData.totalGrossRevenue > 0
                      ? ((financialData.onlineTotal / financialData.totalGrossRevenue) * 100).toFixed(1)
                      : 0}
                    % of total revenue
                  </Text>
                </View>
              </View>
            </View>

            {/* Dining Channel Breakdown */}
            <View style={[styles.panelCard, { marginTop: 14 }]}>
              <View style={styles.panelHeader}>
                <Ionicons name="restaurant-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Dining & Amusement Channel Performance</Text>
              </View>

              <View style={styles.channelGrid}>
                {/* Dine-in */}
                <View style={styles.channelCard}>
                  <Text style={styles.channelLabel}>DINE-IN SEATING SERVICE</Text>
                  <Text style={styles.channelAmountDark}>{money(financialData.dineInSales)}</Text>
                  <Text style={styles.channelSub}>
                    {financialData.dineInOrders} Orders • Avg Ticket:{' '}
                    {money(financialData.dineInOrders > 0 ? financialData.dineInSales / financialData.dineInOrders : 0)}
                  </Text>
                </View>

                {/* Takeaway */}
                <View style={styles.channelCard}>
                  <Text style={styles.channelLabel}>TAKEAWAY / COUNTER PICKUP</Text>
                  <Text style={styles.channelAmountDark}>{money(financialData.takeawaySales)}</Text>
                  <Text style={styles.channelSub}>
                    {financialData.takeawayOrders} Orders • Avg Ticket:{' '}
                    {money(
                      financialData.takeawayOrders > 0 ? financialData.takeawaySales / financialData.takeawayOrders : 0
                    )}
                  </Text>
                </View>

                {/* Basement Playland */}
                <View style={styles.channelCard}>
                  <Text style={styles.channelLabel}>BASEMENT AMUSEMENT TICKETS</Text>
                  <Text style={styles.channelAmountDark}>{money(financialData.playlandRevenue)}</Text>
                  <Text style={styles.channelSub}>
                    {financialData.playlandTicketsCount} Admissions & Ride passes
                  </Text>
                </View>
              </View>
            </View>

            {/* Hourly Rush Hour Velocity */}
            <View style={[styles.panelCard, { marginTop: 14 }]}>
              <View style={styles.panelHeader}>
                <Ionicons name="time-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Hourly Sales Velocity (Rush Hour Analysis)</Text>
              </View>

              {/* Visual Area Curve */}
              <View style={{ marginBottom: 12 }}>
                <SvgHourlyVelocityChart
                  hourlyData={financialData.hourlySales}
                  height={170}
                  accentColor={LIGHT.burgundy}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
                  {Object.entries(financialData.hourlySales).map(([hrStr, data]) => {
                    const hr = parseInt(hrStr, 10);
                    const label = hr === 0 ? '12 AM' : hr === 12 ? '12 PM' : hr > 12 ? `${hr - 12} PM` : `${hr} AM`;
                    const hasSales = data.revenue > 0;
                    return (
                      <View
                        key={hr}
                        style={[
                          styles.hourlyBox,
                          hasSales && { borderColor: LIGHT.gold, backgroundColor: LIGHT.goldSoft },
                        ]}
                      >
                        <Text style={styles.hourlyTime}>{label}</Text>
                        <Text style={[styles.hourlyRev, hasSales && { color: LIGHT.gold, fontWeight: '800' }]}>
                          {data.revenue > 0 ? money(data.revenue) : '—'}
                        </Text>
                        <Text style={styles.hourlyOrders}>{data.count} bills</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* ----------------- TAB: KITCHEN PRODUCTION & WASTAGE AUDIT ----------------- */}
        {activeTab === 'kitchen' && (
          <View style={styles.section}>
            {/* Top Action Header */}
            <View style={[styles.panelCard, { marginBottom: 14 }]}>
              <View
                style={{
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: 10,
                }}
              >
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="flame" size={20} color={LIGHT.burgundy} />
                    <Text style={styles.panelTitle}>Kitchen Cooking & Shift Store Return Reconciliation</Text>
                    <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#047857' }]}>LIVE YIELD AUDIT</Text>
                    </View>
                  </View>
                  <Text style={styles.panelSub}>
                    Tracking dishes cooked, surplus raw stock returned to store, and variance wastage.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.actionBtnPrimary, { backgroundColor: LIGHT.burgundy }]}
                  onPress={handleOpenClosingReturn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>Log Shift Closing Return</Text>
                </TouchableOpacity>
              </View>

              {/* Kitchen Formula Banner */}
              <View
                style={[
                  styles.auditNotesCard,
                  { marginTop: 12, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}
              >
                <Ionicons name="calculator-outline" size={18} color="#B45309" />
                <Text style={[styles.auditNotesText, { color: '#92400E' }]}>
                  <Text style={{ fontWeight: '800' }}>Wastage Formula:</Text> Kitchen Wastage = Store Issued − (Cooked/Sold in Shift + Returned to Store at Closing). Positive difference represents unaccounted kitchen loss/wastage.
                </Text>
              </View>
            </View>

            {/* Kitchen Ribbon KPIs */}
            <View style={styles.kpiRow}>
              {/* Total Dishes Cooked */}
              <View style={[styles.kpiCard, { borderColor: LIGHT.emeraldBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>DISHES COOKED</Text>
                  <View style={[styles.iconBox, { backgroundColor: LIGHT.emeraldSoft }]}>
                    <Ionicons name="restaurant" size={16} color={LIGHT.emerald} />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: LIGHT.emerald }]}>
                  {financialData.totalPortionsCooked} Portions
                </Text>
                <Text style={styles.kpiHint}>Turnover: {money(financialData.totalFoodTurnover)}</Text>
              </View>

              {/* Raw Stock Issued */}
              <View style={[styles.kpiCard, { borderColor: LIGHT.goldBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>STORE RAW ISSUED</Text>
                  <View style={[styles.iconBox, { backgroundColor: LIGHT.goldSoft }]}>
                    <Ionicons name="cube" size={16} color={LIGHT.gold} />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: LIGHT.gold }]}>
                  {money(financialData.totalStoreIssuedValue)}
                </Text>
                <Text style={styles.kpiHint}>Raw material sent to kitchen</Text>
              </View>

              {/* Cooked Raw Consumed */}
              <View style={[styles.kpiCard, { borderColor: LIGHT.blueBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>COOKED IN ORDERS</Text>
                  <View style={[styles.iconBox, { backgroundColor: LIGHT.blueSoft }]}>
                    <Ionicons name="checkmark-done-circle" size={16} color={LIGHT.blue} />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: LIGHT.blue }]}>
                  {money(financialData.totalCookedRawValue)}
                </Text>
                <Text style={styles.kpiHint}>Recipe theoretical consumption</Text>
              </View>

              {/* Wapis Store Returned */}
              <View style={[styles.kpiCard, { borderColor: LIGHT.purpleBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>RETURNED TO STORE</Text>
                  <View style={[styles.iconBox, { backgroundColor: LIGHT.purpleSoft }]}>
                    <Ionicons name="return-up-back" size={16} color={LIGHT.purple} />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: LIGHT.purple }]}>
                  {money(financialData.totalReturnedToStoreValue)}
                </Text>
                <Text style={styles.kpiHint}>Shift closing surplus saved</Text>
              </View>

              {/* Net Kitchen Wastage Loss */}
              <View style={[styles.kpiCard, { borderColor: LIGHT.roseBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={styles.kpiLabel}>NET WASTAGE LOSS</Text>
                  <View style={[styles.iconBox, { backgroundColor: LIGHT.roseSoft }]}>
                    <Ionicons name="alert-circle" size={16} color={LIGHT.rose} />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: LIGHT.rose }]}>
                  {money(financialData.totalKitchenWastageCost)}
                </Text>
                <Text style={styles.kpiHint}>
                  Yield Rate: {financialData.averageYieldRate.toFixed(1)}% accounted
                </Text>
              </View>
            </View>

            {/* Visual Graphs Row 1: Station Cooking Output & Raw Material Flow */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row', marginBottom: 16 }]}>
              {/* Station Cooking Volume Bar Chart */}
              <View style={[styles.chartCol, { flex: 1.2 }]}>
                <View style={styles.chartPanel}>
                  <View style={styles.chartPanelHeader}>
                    <Text style={styles.chartPanelTitle}>Kitchen Station Cooking Volume</Text>
                    <Text style={styles.chartPanelSub}>Portions prepared across kitchen stations</Text>
                  </View>
                  <SvgVerticalBarChart
                    data={Object.values(financialData.stationCookingSummary).map((st) => ({
                      label: st.station.replace('Station', '').replace('Line', '').trim(),
                      value: st.portions,
                      color: st.station.includes('Karahi')
                        ? '#B48214'
                        : st.station.includes('BBQ')
                        ? '#E11D48'
                        : st.station.includes('Rice')
                        ? '#059669'
                        : st.station.includes('Tandoor')
                        ? '#D97706'
                        : '#2563EB',
                      sublabel: `${money(st.revenue)}`,
                    }))}
                    height={200}
                    barWidth={38}
                    showPercentages={true}
                  />
                </View>
              </View>

              {/* Raw Stock Reconciliation Bar Flow */}
              <View style={[styles.chartCol, { flex: 1 }]}>
                <View style={styles.chartPanel}>
                  <View style={styles.chartPanelHeader}>
                    <Text style={styles.chartPanelTitle}>Store Inflow vs Cooking vs Return</Text>
                    <Text style={styles.chartPanelSub}>Raw material life-cycle in kitchen (PKR)</Text>
                  </View>
                  <SvgVerticalBarChart
                    data={[
                      { label: 'Store Issued', value: financialData.totalStoreIssuedValue, color: '#B48214', sublabel: 'Handover' },
                      { label: 'Cooked/Sold', value: financialData.totalCookedRawValue, color: '#059669', sublabel: 'Recipe' },
                      { label: 'Store Return', value: financialData.totalReturnedToStoreValue, color: '#2563EB', sublabel: 'Closing' },
                      { label: 'Wastage Loss', value: financialData.totalKitchenWastageCost, color: '#E11D48', sublabel: 'Shrinkage' },
                    ]}
                    height={200}
                    barWidth={42}
                    showPercentages={false}
                  />
                </View>
              </View>
            </View>

            {/* Visual Graphs Row 2: Top Wastage Ingredients & Causes */}
            <View style={[styles.chartsGrid, { flexDirection: isMobile ? 'column' : 'row', marginBottom: 16 }]}>
              {/* High Wastage Ingredients */}
              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Highest Wastage Raw Materials"
                  subtitle="Loss amount and variance quantity"
                  items={financialData.rawReconciliationList.slice(0, 5).map((it) => ({
                    label: it.itemName,
                    value: it.wastageCost,
                    count: it.variance,
                    color: it.status === 'alert' ? '#E11D48' : '#D97706',
                  }))}
                />
              </View>

              {/* Wastage Causes Distribution */}
              <View style={[styles.chartCol, { flex: 1 }]}>
                <HorizontalRankedBars
                  title="Wastage Causes & Kitchen Incidents"
                  subtitle="Attributed loss categories from chef logs"
                  items={Object.values(financialData.wastageReasonsMap)
                    .filter((r) => r.count > 0 || r.cost > 0)
                    .map((r) => ({
                      label: r.label,
                      value: r.cost > 0 ? r.cost : r.count * 450,
                      count: r.count,
                      color: '#9333EA',
                    }))}
                />
              </View>
            </View>

            {/* 1. Main Reconciliation Table: Issued vs Cooked vs Returned -> Difference */}
            <View style={[styles.panelCard, { marginBottom: 16 }]}>
              <View style={styles.panelHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="git-compare-outline" size={18} color={LIGHT.burgundy} />
                  <Text style={styles.panelTitle}>Raw Material Shift Closing & Wastage Difference Ledger</Text>
                </View>
                <Text style={styles.panelSub}>Difference = Issued − (Cooked + Returned)</Text>
              </View>

              <View style={styles.menuTable}>
                {/* Table Header */}
                <View style={styles.menuTableHeader}>
                  <Text style={[styles.mth, { flex: 2 }]}>Raw Material Item</Text>
                  <Text style={[styles.mth, { flex: 1.1, textAlign: 'center' }]}>Store Issued</Text>
                  <Text style={[styles.mth, { flex: 1.1, textAlign: 'center' }]}>Cooked/Sold</Text>
                  <Text style={[styles.mth, { flex: 1.1, textAlign: 'center', color: LIGHT.blue }]}>
                    Store Return
                  </Text>
                  <Text style={[styles.mth, { flex: 1.2, textAlign: 'center', color: LIGHT.rose }]}>
                    Difference (Waste)
                  </Text>
                  <Text style={[styles.mth, { flex: 1.3, textAlign: 'right' }]}>Loss (PKR)</Text>
                  <Text style={[styles.mth, { flex: 1, textAlign: 'center' }]}>Status</Text>
                </View>

                {financialData.rawReconciliationList.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: LIGHT.textDim, fontSize: 13 }}>
                      No kitchen store items logged for this shift.
                    </Text>
                  </View>
                ) : (
                  financialData.rawReconciliationList.map((item, idx) => (
                    <View key={item.itemId || idx} style={styles.menuTableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.mtd, { fontWeight: '700', color: LIGHT.ink }]} numberOfLines={1}>
                          {item.itemName}
                        </Text>
                        <Text style={{ fontSize: 10, color: LIGHT.textDim }}>{item.category}</Text>
                      </View>

                      <Text style={[styles.mtd, { flex: 1.1, textAlign: 'center', fontWeight: '600' }]}>
                        {item.issued} {item.unit}
                      </Text>

                      <Text
                        style={[
                          styles.mtd,
                          { flex: 1.1, textAlign: 'center', color: '#059669', fontWeight: '600' },
                        ]}
                      >
                        {item.cooked} {item.unit}
                      </Text>

                      <Text
                        style={[
                          styles.mtd,
                          { flex: 1.1, textAlign: 'center', color: LIGHT.blue, fontWeight: '700' },
                        ]}
                      >
                        {item.returned} {item.unit}
                      </Text>

                      <Text
                        style={[
                          styles.mtd,
                          {
                            flex: 1.2,
                            textAlign: 'center',
                            fontWeight: '800',
                            color:
                              item.variance > 0 ? (item.status === 'alert' ? '#BE123C' : '#D97706') : '#059669',
                          },
                        ]}
                      >
                        {item.variance > 0 ? `+${item.variance} ${item.unit}` : `0 ${item.unit}`}
                      </Text>

                      <Text
                        style={[
                          styles.mtd,
                          {
                            flex: 1.3,
                            textAlign: 'right',
                            fontWeight: '800',
                            color: item.wastageCost > 0 ? '#BE123C' : LIGHT.textMuted,
                          },
                        ]}
                      >
                        {item.wastageCost > 0 ? money(item.wastageCost) : 'Rs. 0'}
                      </Text>

                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View
                          style={[
                            styles.reconBadge,
                            item.status === 'optimal'
                              ? styles.reconBadgeOptimal
                              : item.status === 'alert'
                              ? styles.reconBadgeAlert
                              : styles.reconBadgeAcceptable,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reconBadgeText,
                              item.status === 'optimal'
                                ? { color: '#047857' }
                                : item.status === 'alert'
                                ? { color: '#BE123C' }
                                : { color: '#92400E' },
                            ]}
                          >
                            {item.status === 'optimal' ? 'OPTIMAL' : item.status === 'alert' ? 'EXCESS' : 'NORMAL'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* 2. Cooked Dishes Production Log (Kia Kia Cook Hua) */}
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="restaurant-outline" size={18} color={LIGHT.burgundy} />
                  <Text style={styles.panelTitle}>Live Cooked Dishes Production Log (Kia Kia Cooking Hoii Hai)</Text>
                </View>
                <Text style={styles.panelSub}>
                  {financialData.cookedDishesList.length} distinct dishes cooked
                </Text>
              </View>

              <View style={styles.menuTable}>
                <View style={styles.menuTableHeader}>
                  <Text style={[styles.mth, { flex: 0.6 }]}>#</Text>
                  <Text style={[styles.mth, { flex: 2.2 }]}>Dish Name</Text>
                  <Text style={[styles.mth, { flex: 1.6 }]}>Station</Text>
                  <Text style={[styles.mth, { flex: 1.2, textAlign: 'center' }]}>Portions Cooked</Text>
                  <Text style={[styles.mth, { flex: 1.2, textAlign: 'right' }]}>Portion Price</Text>
                  <Text style={[styles.mth, { flex: 1.4, textAlign: 'right' }]}>Total Turnover</Text>
                </View>

                {financialData.cookedDishesList.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: LIGHT.textDim, fontSize: 13 }}>
                      No cooking orders settled in this time window.
                    </Text>
                  </View>
                ) : (
                  financialData.cookedDishesList.map((dish, idx) => (
                    <View key={dish.name + idx} style={styles.menuTableRow}>
                      <Text style={[styles.mtd, { flex: 0.6, color: LIGHT.textDim, fontWeight: '700' }]}>
                        #{idx + 1}
                      </Text>
                      <Text style={[styles.mtd, { flex: 2.2, fontWeight: '700', color: LIGHT.ink }]} numberOfLines={1}>
                        {dish.name}
                      </Text>
                      <View style={{ flex: 1.6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: LIGHT.burgundy }}>
                          {dish.station}
                        </Text>
                      </View>
                      <Text style={[styles.mtd, { flex: 1.2, textAlign: 'center', fontWeight: '800', color: LIGHT.ink }]}>
                        {dish.qty}
                      </Text>
                      <Text style={[styles.mtd, { flex: 1.2, textAlign: 'right', color: LIGHT.textSecondary }]}>
                        {money(dish.price)}
                      </Text>
                      <Text
                        style={[
                          styles.mtd,
                          { flex: 1.4, textAlign: 'right', fontWeight: '800', color: LIGHT.gold },
                        ]}
                      >
                        {money(dish.totalRevenue)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 3: CASH REGISTER AUDIT ----------------- */}
        {activeTab === 'cashflow' && (
          <View style={styles.section}>
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Ionicons name="wallet-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Cash Drawer Daily Float & Reconciliation</Text>
              </View>

              {/* Visual Comparative Cash Flow Bar Chart */}
              <View style={{ marginBottom: 16 }}>
                <SvgVerticalBarChart
                  data={[
                    { label: 'Cash Inflow', value: financialData.totalCashInflow, color: '#059669', sublabel: 'Collections' },
                    { label: 'Cash Outflow', value: financialData.totalCashOutflow, color: '#E11D48', sublabel: 'Disbursed' },
                    { label: 'Register Float', value: financialData.netCashFloat, color: '#B48214', sublabel: 'Theoretical Cash' },
                  ]}
                  height={190}
                  barWidth={48}
                  showPercentages={false}
                />
              </View>

              <View style={styles.cashFlowGrid}>
                {/* Total Cash Inflow */}
                <View style={[styles.cashBox, { borderColor: LIGHT.emeraldBorder, backgroundColor: LIGHT.emeraldSoft }]}>
                  <Text style={[styles.cashBoxLabel, { color: '#047857' }]}>CASH INFLOW (+) </Text>
                  <Text style={[styles.cashBoxAmount, { color: '#047857' }]}>
                    {money(financialData.totalCashInflow)}
                  </Text>
                  <Text style={styles.cashBoxHint}>
                    Restaurant Cash: {money(financialData.cashTotal - (financialData.playlandRevenue ? financialData.cashTotal - financialData.cashTotal : 0))}
                  </Text>
                </View>

                {/* Total Cash Outflow */}
                <View style={[styles.cashBox, { borderColor: LIGHT.roseBorder, backgroundColor: LIGHT.roseSoft }]}>
                  <Text style={[styles.cashBoxLabel, { color: '#BE123C' }]}>CASH EXPENSES / OUTFLOW (-) </Text>
                  <Text style={[styles.cashBoxAmount, { color: '#BE123C' }]}>
                    {money(financialData.totalCashOutflow)}
                  </Text>
                  <Text style={styles.cashBoxHint}>
                    Daily Opex Cash: {money(financialData.cashOpex)}
                  </Text>
                </View>

                {/* Theoretical Cash in Drawer */}
                <View style={[styles.cashBox, { borderColor: LIGHT.goldBorder, backgroundColor: '#FFFBEB' }]}>
                  <Text style={[styles.cashBoxLabel, { color: '#B45309' }]}>NET CASH EXPECTED IN DRAWER</Text>
                  <Text style={[styles.cashBoxAmount, { color: '#B45309' }]}>
                    {money(financialData.netCashFloat)}
                  </Text>
                  <Text style={styles.cashBoxHint}>Theoretical physical balance to count</Text>
                </View>
              </View>

              {/* Cash Ledger Notes */}
              <View style={styles.auditNotesCard}>
                <Ionicons name="information-circle-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.auditNotesText}>
                  Managers must reconcile physical cash in register against{' '}
                  <Text style={{ fontWeight: '800', color: LIGHT.burgundy }}>
                    {money(financialData.netCashFloat)}
                  </Text>{' '}
                  at shift close. Any discrepancy should be entered in the Z-Report variance log.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 4: GST & DISCOUNTS ----------------- */}
        {activeTab === 'tax' && (
          <View style={styles.section}>
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Ionicons name="receipt-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Government Sales Tax (GST) & Customer Discount Ledger</Text>
              </View>

              {/* Visual Tax & Discount Comparison Bar Chart */}
              <View style={{ marginBottom: 16 }}>
                <SvgVerticalBarChart
                  data={[
                    { label: 'Food Gross', value: financialData.grossFoodSales, color: '#0F172A', sublabel: 'Pre-Tax' },
                    { label: 'Tax (GST)', value: financialData.totalTaxCollected, color: '#2563EB', sublabel: 'Collected' },
                    { label: 'Discounts', value: financialData.totalDiscountGiven, color: '#E11D48', sublabel: 'Waived' },
                    { label: 'Net Billed', value: financialData.netRestaurantRevenue, color: '#059669', sublabel: 'Invoiced' },
                  ]}
                  height={190}
                  barWidth={42}
                  showPercentages={false}
                />
              </View>

              <View style={styles.channelGrid}>
                {/* Gross Subtotal */}
                <View style={styles.channelCard}>
                  <Text style={styles.channelLabel}>GROSS FOOD AMOUNT (PRE-TAX/DISCOUNT)</Text>
                  <Text style={styles.channelAmountDark}>{money(financialData.grossFoodSales)}</Text>
                  <Text style={styles.channelSub}>Total menu priced sales</Text>
                </View>

                {/* Discounts */}
                <View style={[styles.channelCard, { borderColor: LIGHT.roseBorder }]}>
                  <Text style={[styles.channelLabel, { color: LIGHT.rose }]}>CUSTOMER PROMOTIONAL DISCOUNTS (-)</Text>
                  <Text style={[styles.channelAmount, { color: LIGHT.rose }]}>
                    {money(financialData.totalDiscountGiven)}
                  </Text>
                  <Text style={styles.channelSub}>
                    {financialData.grossFoodSales > 0
                      ? ((financialData.totalDiscountGiven / financialData.grossFoodSales) * 100).toFixed(1)
                      : 0}
                    % average discount given
                  </Text>
                </View>

                {/* GST Tax Collected */}
                <View style={[styles.channelCard, { borderColor: LIGHT.emeraldBorder }]}>
                  <Text style={[styles.channelLabel, { color: LIGHT.emerald }]}>SALES TAX (GST COLLECTED)</Text>
                  <Text style={[styles.channelAmount, { color: LIGHT.emerald }]}>
                    {money(financialData.totalTaxCollected)}
                  </Text>
                  <Text style={styles.channelSub}>FBR / PRA compliance tax collected</Text>
                </View>
              </View>

              {/* Tax Summary Note */}
              <View style={[styles.auditNotesCard, { marginTop: 14 }]}>
                <Text style={{ fontSize: 13, color: LIGHT.textSecondary, lineHeight: 20 }}>
                  <Text style={{ fontWeight: '800', color: LIGHT.ink }}>Tax Compliance Summary:</Text> Total net
                  revenue of {money(financialData.netRestaurantRevenue)} includes {money(financialData.totalTaxCollected)}{' '}
                  in official restaurant GST. This amount is held in fiduciary custody for governmental revenue filing.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 5: MENU PROFITABILITY ----------------- */}
        {activeTab === 'menu' && (
          <View style={styles.section}>
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Ionicons name="fast-food-outline" size={18} color={LIGHT.burgundy} />
                <Text style={styles.panelTitle}>Top 10 High-Revenue Dishes (Menu Engineering)</Text>
              </View>

              {/* Visual Ranked Dishes Graph */}
              <View style={{ marginBottom: 16 }}>
                <HorizontalRankedBars
                  title="Dishes Volume & Contribution"
                  subtitle="Visual sales rank of top performing menu items"
                  items={financialData.topDishes.slice(0, 5).map((d) => ({
                    label: d.name,
                    value: d.revenue,
                    count: d.qty,
                  }))}
                />
              </View>

              <View style={styles.menuTable}>
                <View style={styles.menuTableHeader}>
                  <Text style={[styles.mth, { flex: 0.6 }]}>Rank</Text>
                  <Text style={[styles.mth, { flex: 2.5 }]}>Dish Name</Text>
                  <Text style={[styles.mth, { flex: 1, textAlign: 'center' }]}>Units Sold</Text>
                  <Text style={[styles.mth, { flex: 1.5, textAlign: 'right' }]}>Total Revenue</Text>
                </View>

                {financialData.topDishes.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: LIGHT.textDim, fontSize: 13 }}>No dish sales recorded in this window.</Text>
                  </View>
                ) : (
                  financialData.topDishes.map((dish, idx) => (
                    <View key={dish.name} style={styles.menuTableRow}>
                      <View style={{ flex: 0.6 }}>
                        <View style={styles.rankPill}>
                          <Text style={styles.rankPillText}>#{idx + 1}</Text>
                        </View>
                      </View>
                      <Text style={[styles.mtd, { flex: 2.5, fontWeight: '700' }]} numberOfLines={1}>
                        {dish.name}
                      </Text>
                      <Text style={[styles.mtd, { flex: 1, textAlign: 'center' }]}>{dish.qty}</Text>
                      <Text style={[styles.mtd, { flex: 1.5, textAlign: 'right', color: LIGHT.gold, fontWeight: '800' }]}>
                        {money(dish.revenue)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* ----------------- TAB 6: SHRINKAGE & LOSSES ----------------- */}
        {activeTab === 'shrinkage' && (
          <View style={styles.section}>
            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Ionicons name="trash-bin-outline" size={18} color={LIGHT.rose} />
                <Text style={styles.panelTitle}>Loss, Breakage & Wastage Audit</Text>
              </View>

              <View style={styles.channelGrid}>
                <View style={[styles.channelCard, { borderColor: LIGHT.roseBorder }]}>
                  <Text style={[styles.channelLabel, { color: LIGHT.rose }]}>TOTAL CROCKERY/GLASS BREAKAGES</Text>
                  <Text style={[styles.channelAmount, { color: LIGHT.rose }]}>
                    {money(financialData.totalBreakageLoss)}
                  </Text>
                  <Text style={styles.channelSub}>Total broken plates, glasses, pots</Text>
                </View>

                <View style={[styles.channelCard, { borderColor: LIGHT.emeraldBorder }]}>
                  <Text style={[styles.channelLabel, { color: LIGHT.emerald }]}>RECOVERED FROM STAFF / GUESTS</Text>
                  <Text style={[styles.channelAmount, { color: LIGHT.emerald }]}>
                    {money(financialData.totalDamageRecovered)}
                  </Text>
                  <Text style={styles.channelSub}>Reimbursed or deducted from wages</Text>
                </View>

                <View style={[styles.channelCard, { borderColor: LIGHT.amberBorder }]}>
                  <Text style={[styles.channelLabel, { color: LIGHT.amber }]}>NET RESTAURANT WRITE-OFF LOSS</Text>
                  <Text style={[styles.channelAmount, { color: LIGHT.amber }]}>
                    {money(financialData.netBreakageLoss)}
                  </Text>
                  <Text style={styles.channelSub}>Debited directly to restaurant P&L</Text>
                </View>
              </View>

              {/* Visual Departmental Loss Distribution */}
              <View style={{ marginTop: 16 }}>
                <HorizontalRankedBars
                  title="Damage & Loss by Department"
                  subtitle="Monetary write-offs broken down by service stations"
                  items={Object.entries(financialData.damageDeptMap).map(([dept, val]) => ({
                    label: dept,
                    value: val,
                    color: '#BE123C',
                  }))}
                />
              </View>

              <View style={[styles.auditNotesCard, { marginTop: 14 }]}>
                <Text style={{ fontSize: 13, color: LIGHT.textSecondary, lineHeight: 20 }}>
                  <Text style={{ fontWeight: '800', color: LIGHT.ink }}>Breakage Mitigation:</Text> Check{' '}
                  <Text
                    style={{ color: LIGHT.burgundy, fontWeight: '700', textDecorationLine: 'underline' }}
                    onPress={() => router.push('/admin/damages')}
                  >
                    Damage Control Module
                  </Text>{' '}
                  for micro-level incident logs, attributed waiters, and dishwashing pit reports.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ----------------- PRINTABLE P&L SLIP MODAL ----------------- */}
      <Modal visible={isPrintModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && { width: '95%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="receipt-outline" size={20} color={LIGHT.burgundy} />
                <Text style={styles.modalTitle}>Formal P&L Financial Certificate</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPrintModalOpen(false)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.printSheet}>
                <View style={styles.printHeader}>
                  <Text style={styles.printRestName}>SULTAN RESTAURANT & RESORT</Text>
                  <Text style={styles.printSub}>EXECUTIVE PROFIT & LOSS AUDIT STATEMENT</Text>
                  <Text style={styles.printDate}>
                    PERIOD: {timeWindow.label.toUpperCase()} ({formatDay(timeWindow.start)} - {formatDay(timeWindow.end)})
                  </Text>
                </View>

                <View style={styles.printDivider} />

                {/* Print Line Items */}
                <View style={styles.printRow}>
                  <Text style={styles.printLabelBold}>A. TOTAL GROSS REVENUE:</Text>
                  <Text style={styles.printValBold}>{money(financialData.totalGrossRevenue)}</Text>
                </View>
                <View style={styles.printSubRow}>
                  <Text style={styles.printLabelSub}>• Food Sales (Dine-in/Takeaway/Delivery):</Text>
                  <Text style={styles.printValSub}>{money(financialData.netRestaurantRevenue)}</Text>
                </View>
                <View style={styles.printSubRow}>
                  <Text style={styles.printLabelSub}>• Basement Playland Rides Revenue:</Text>
                  <Text style={styles.printValSub}>{money(financialData.playlandRevenue)}</Text>
                </View>

                <View style={[styles.printRow, { marginTop: 8 }]}>
                  <Text style={styles.printLabelBold}>B. COST OF GOODS SOLD (COGS):</Text>
                  <Text style={[styles.printValBold, { color: '#B45309' }]}>
                    ({money(financialData.estimatedCOGS)})
                  </Text>
                </View>

                <View style={[styles.printRow, { backgroundColor: '#F3F4F6', padding: 6, borderRadius: 4 }]}>
                  <Text style={[styles.printLabelBold, { color: '#1D4ED8' }]}>C. GROSS PROFIT (A - B):</Text>
                  <Text style={[styles.printValBold, { color: '#1D4ED8' }]}>
                    {money(financialData.grossOperatingProfit)} ({financialData.grossMarginPercent.toFixed(1)}%)
                  </Text>
                </View>

                <View style={[styles.printRow, { marginTop: 8 }]}>
                  <Text style={styles.printLabelBold}>D. OPERATING EXPENSES (OPEX):</Text>
                  <Text style={[styles.printValBold, { color: '#BE123C' }]}>
                    ({money(financialData.totalOpex)})
                  </Text>
                </View>

                <View style={styles.printRow}>
                  <Text style={styles.printLabelBold}>E. NET BREAKAGE & SHRINKAGE:</Text>
                  <Text style={[styles.printValBold, { color: '#BE123C' }]}>
                    ({money(financialData.netBreakageLoss)})
                  </Text>
                </View>

                <View style={styles.printDivider} />

                {/* Final Net Line */}
                <View
                  style={[
                    styles.printRow,
                    {
                      backgroundColor: financialData.netOperatingProfit >= 0 ? '#ECFDF5' : '#FFF1F2',
                      padding: 10,
                      borderRadius: 6,
                    },
                  ]}
                >
                  <Text style={[styles.printLabelBold, { fontSize: 14, color: financialData.netOperatingProfit >= 0 ? '#065F46' : '#9F1239' }]}>
                    NET OPERATING PROFIT (EBITDA):
                  </Text>
                  <Text style={[styles.printValBold, { fontSize: 16, color: financialData.netOperatingProfit >= 0 ? '#065F46' : '#9F1239' }]}>
                    {money(financialData.netOperatingProfit)}
                  </Text>
                </View>

                <View style={styles.printSignatures}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 120, height: 1, backgroundColor: '#9CA3AF', marginBottom: 4 }} />
                    <Text style={{ fontSize: 10, color: '#6B7280' }}>Prepared By (Auditor)</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 120, height: 1, backgroundColor: '#9CA3AF', marginBottom: 4 }} />
                    <Text style={{ fontSize: 10, color: '#6B7280' }}>Managing Director</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPrintModalOpen(false)}>
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  alertMsg('Printing', 'P&L Statement dispatched to thermal POS / report printer.');
                }}
              >
                <Ionicons name="print-outline" size={17} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Print Statement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ----------------- SHIFT CLOSING RETURN RECONCILIATION MODAL ----------------- */}
      <Modal visible={closingReturnModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && { width: '95%' }, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="clipboard-outline" size={20} color={LIGHT.burgundy} />
                <Text style={styles.modalTitle}>Reconcile Shift Closing Store Return</Text>
              </View>
              <TouchableOpacity onPress={() => setClosingReturnModalOpen(false)}>
                <Ionicons name="close" size={22} color={LIGHT.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: LIGHT.textSecondary, marginBottom: 12 }}>
                Shift closing ke waqt kitchen se jo un-cooked ya surplus maal wapis main store / cold storage mein return aaya hai, uski physical quantity darj karein ta k system live difference aur wastage calculate kare:
              </Text>

              {financialData.rawReconciliationList.map((item) => (
                <View key={item.itemId} style={styles.closingReturnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: LIGHT.ink }}>{item.itemName}</Text>
                    <Text style={{ fontSize: 11, color: LIGHT.textDim }}>
                      Issued: {item.issued} {item.unit} • Cooked: {item.cooked} {item.unit}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: LIGHT.textSecondary }}>Wapis Aya:</Text>
                    <TextInput
                      style={styles.closingInput}
                      keyboardType="numeric"
                      placeholder="0"
                      value={closingReturnCounts[item.itemId] || ''}
                      onChangeText={(val) => setClosingReturnCounts((prev) => ({ ...prev, [item.itemId]: val }))}
                    />
                    <Text style={{ fontSize: 12, color: LIGHT.textDim }}>{item.unit}</Text>
                  </View>
                </View>
              ))}

              <View style={{ marginTop: 20, flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { flex: 1 }]}
                  onPress={() => setClosingReturnModalOpen(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnPrimary, { flex: 1.5, justifyContent: 'center' }]}
                  onPress={handleSaveClosingReturn}
                >
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>Save & Recalculate</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  auditBadge: {
    backgroundColor: LIGHT.burgundySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(82, 23, 27, 0.20)',
  },
  auditBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: LIGHT.burgundy,
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.burgundy,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Time Filter Bar
  timeFilterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  timeScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeChipActive: {
    backgroundColor: LIGHT.burgundy,
    borderColor: LIGHT.burgundy,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT.textSecondary,
  },
  timeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  // Sub-Tab Bar
  tabBar: {
    backgroundColor: '#FAFAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabScroll: {
    flexDirection: 'row',
    paddingHorizontal: 18,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabBtnActive: {
    borderBottomColor: LIGHT.burgundy,
    backgroundColor: '#FFFFFF',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT.textMuted,
  },
  subTabTextActive: {
    color: LIGHT.burgundy,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: LIGHT.bg,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
    fontSize: 10,
    fontWeight: '700',
    color: LIGHT.textMuted,
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 30,
    height: 30,
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
  // Panel Card
  section: {
    marginBottom: 20,
  },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  panelSub: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.gold,
  },
  // P&L Statement Table
  statementTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  statementCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statementCatText: {
    fontSize: 12,
    fontWeight: '800',
    color: LIGHT.ink,
    letterSpacing: 0.4,
  },
  statementCatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  statementItem: {
    fontSize: 13,
    color: LIGHT.textSecondary,
    fontWeight: '500',
  },
  statementVal: {
    fontSize: 13,
    fontWeight: '600',
    color: LIGHT.ink,
  },
  subtotalRow: {
    backgroundColor: '#FAFAF9',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 10,
  },
  subtotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: LIGHT.ink,
  },
  subtotalValGold: {
    fontSize: 14,
    fontWeight: '800',
    color: LIGHT.gold,
  },
  finalNetRow: {
    paddingVertical: 14,
    borderTopWidth: 2,
  },
  finalNetTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  finalNetValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  // Channel Grid
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  channelCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  channelLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LIGHT.textMuted,
    letterSpacing: 0.4,
  },
  channelAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  channelAmountDark: {
    fontSize: 18,
    fontWeight: '900',
    color: LIGHT.ink,
    marginTop: 2,
  },
  channelSub: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    marginTop: 4,
  },
  // Hourly Box
  hourlyBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    minWidth: 80,
  },
  hourlyTime: {
    fontSize: 10,
    fontWeight: '700',
    color: LIGHT.textMuted,
  },
  hourlyRev: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.ink,
    marginTop: 2,
  },
  hourlyOrders: {
    fontSize: 10,
    color: LIGHT.textDim,
    marginTop: 1,
  },
  // Cash Flow
  cashFlowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cashBox: {
    flex: 1,
    minWidth: 200,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cashBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cashBoxAmount: {
    fontSize: 22,
    fontWeight: '900',
  },
  cashBoxHint: {
    fontSize: 11,
    color: LIGHT.textSecondary,
    marginTop: 4,
  },
  auditNotesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  auditNotesText: {
    fontSize: 12,
    color: LIGHT.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  // Menu Table
  menuTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  menuTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mth: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT.textMuted,
  },
  menuTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rankPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LIGHT.burgundySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: LIGHT.burgundy,
  },
  mtd: {
    fontSize: 13,
    color: LIGHT.ink,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: 640,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    paddingVertical: 8,
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
  // Printable Sheet
  printSheet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    borderRadius: 8,
  },
  printHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  printRestName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  printSub: {
    fontSize: 11,
    fontWeight: '800',
    color: LIGHT.burgundy,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  printDate: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 4,
  },
  printDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  printRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  printSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingLeft: 10,
  },
  printLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  printValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  printLabelSub: {
    fontSize: 11,
    color: '#4B5563',
  },
  printValSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  printSignatures: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Charts & Visual Layout Styles
  chartsGrid: {
    gap: 16,
  },
  chartCol: {
    flex: 1,
  },
  chartPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  chartPanelHeader: {
    marginBottom: 12,
  },
  chartPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartPanelSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Kitchen Report Styles
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reconBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  reconBadgeOptimal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  reconBadgeAcceptable: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  reconBadgeAlert: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  reconBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closingReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  closingInput: {
    width: 75,
    height: 36,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
