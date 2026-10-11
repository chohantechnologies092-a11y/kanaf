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
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useOpsStore,
  Supplier,
  SupplierCategory,
  SUPPLIER_CATEGORIES,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierPayment,
} from '../store/opsStore';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0E11',
  burgundyLight: '#6E2025',
  gold: '#D5A943',
  goldLight: '#E8C56B',
  goldDark: '#9E7A23',
  paper: '#FDFBF7',
  cardBg: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  success: '#2E7D32',
  danger: '#C62828',
  warning: '#E65100',
  info: '#1565C0',
};

const CATEGORY_COLORS: Record<SupplierCategory, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'Meat & Poultry': { bg: '#FFEBEE', text: '#C62828', icon: 'restaurant-outline' },
  'Fresh Produce': { bg: '#E8F5E9', text: '#2E7D32', icon: 'leaf-outline' },
  'Dairy & Bakery': { bg: '#FFF8E1', text: '#F57F17', icon: 'nutrition-outline' },
  'Grains & Dry Ration': { bg: '#EFEBE9', text: '#4E342E', icon: 'basket-outline' },
  'Beverages & Drinks': { bg: '#E1F5FE', text: '#0277BD', icon: 'wine-outline' },
  'Fuel & Charcoal': { bg: '#FBE9E7', text: '#D84315', icon: 'flame-outline' },
  'Packaging & Disposables': { bg: '#F3E5F5', text: '#7B1FA2', icon: 'cube-outline' },
  'Cleaning & Kitchen Supplies': { bg: '#E0F2F1', text: '#00695C', icon: 'sparkles-outline' },
  'Equipment & Maintenance': { bg: '#ECEFF1', text: '#37474F', icon: 'construct-outline' },
  'Other': { bg: '#F5F5F5', text: '#616161', icon: 'ellipsis-horizontal-circle-outline' },
};

export default function SuppliersScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Store data
  const {
    suppliers,
    purchaseOrders,
    supplierPayments,
    inventory,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    populateDefaultSuppliers,
    addPurchaseOrder,
    receivePurchaseOrder,
    deletePurchaseOrder,
    recordSupplierPayment,
    deleteSupplierPayment,
  } = useOpsStore();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'directory' | 'orders' | 'payments'>('directory');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBalance, setFilterBalance] = useState<'all' | 'due' | 'clear'>('all');

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<Supplier | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<PurchaseOrder | null>(null);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);

  // Additional feature modals & states
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [selectedPaymentForVoucher, setSelectedPaymentForVoucher] = useState<SupplierPayment | null>(null);

  const [isPODetailsModalOpen, setIsPODetailsModalOpen] = useState(false);
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<PurchaseOrder | null>(null);

  // Ledger filters
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'bills' | 'payments'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSortAsc, setLedgerSortAsc] = useState(false);

  // Payment tab filters
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'online' | 'cheque'>('all');
  const [paymentSupplierFilter, setPaymentSupplierFilter] = useState<string>('all');

  // Form State: Supplier Modal
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    category: 'Meat & Poultry' as SupplierCategory,
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: 'Lahore',
    paymentTerms: 'Credit 15 Days',
    bankName: '',
    accountTitle: '',
    accountNumber: '',
    iban: '',
    suppliedItemsInput: '',
    currentBalance: '0',
    notes: '',
  });

  // Form State: PO Modal
  const [poForm, setPOForm] = useState({
    supplierId: '',
    invoiceNo: '',
    paymentStatus: 'unpaid' as 'unpaid' | 'partial' | 'paid',
    paymentMethod: 'cash' as 'cash' | 'online' | 'cheque',
    amountPaid: '0',
    discount: '0',
    freight: '0',
    receivedBy: 'Admin',
    notes: '',
    autoReceive: true,
    autoExpense: true,
  });
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([
    { name: '', category: 'Meat', unit: 'kg', qtyOrdered: 10, qtyReceived: 10, unitCost: 0, totalCost: 0 },
  ]);

  // Form State: Payment Modal (Full Details)
  const [paymentForm, setPaymentForm] = useState({
    supplierId: '',
    purchaseOrderId: '',
    amount: '',
    method: 'cash' as 'cash' | 'online' | 'cheque',
    bankName: '',
    sourceAccount: 'Main Cash Drawer',
    reference: '',
    chequeNumber: '',
    chequeDate: '',
    paidBy: 'Admin',
    receivedByContact: '',
    notes: '',
    autoExpense: true,
  });

  // ----------------------------------------------------
  // Derived KPIs
  // ----------------------------------------------------
  const totalSuppliers = suppliers.length;
  const totalPayableDue = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0),
    [suppliers]
  );
  const totalPurchasesVolume = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.totalPurchases || 0), 0),
    [suppliers]
  );
  const pendingDeliveriesCount = useMemo(
    () => purchaseOrders.filter((po) => po.status === 'ordered').length,
    [purchaseOrders]
  );

  const totalPaymentsDisbursed = useMemo(
    () => supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [supplierPayments]
  );
  const cashPaymentsTotal = useMemo(
    () => supplierPayments.filter((p) => p.method === 'cash').reduce((sum, p) => sum + (p.amount || 0), 0),
    [supplierPayments]
  );
  const onlinePaymentsTotal = useMemo(
    () => supplierPayments.filter((p) => p.method === 'online').reduce((sum, p) => sum + (p.amount || 0), 0),
    [supplierPayments]
  );

  const filteredPayments = useMemo(() => {
    return supplierPayments.filter((p) => {
      if (paymentMethodFilter !== 'all' && p.method !== paymentMethodFilter) return false;
      if (paymentSupplierFilter !== 'all' && p.supplierId !== paymentSupplierFilter) return false;
      if (paymentSearch.trim()) {
        const q = paymentSearch.toLowerCase();
        const mSup = p.supplierName.toLowerCase().includes(q);
        const mRef = p.reference?.toLowerCase().includes(q);
        const mNote = p.notes?.toLowerCase().includes(q);
        const mBank = p.bankName?.toLowerCase().includes(q);
        const mId = p.id.toLowerCase().includes(q);
        if (!mSup && !mRef && !mNote && !mBank && !mId) return false;
      }
      return true;
    });
  }, [supplierPayments, paymentMethodFilter, paymentSupplierFilter, paymentSearch]);

  // ----------------------------------------------------
  // Filtered Suppliers
  // ----------------------------------------------------
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      // Category filter
      if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
      // Balance filter
      if (filterBalance === 'due' && (s.currentBalance || 0) <= 0) return false;
      if (filterBalance === 'clear' && (s.currentBalance || 0) > 0) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchContact = s.contactPerson?.toLowerCase().includes(q);
        const matchPhone = s.phone?.toLowerCase().includes(q);
        const matchCity = s.city?.toLowerCase().includes(q);
        const matchItems = s.suppliedItems?.some((item) => item.toLowerCase().includes(q));
        if (!matchName && !matchContact && !matchPhone && !matchCity && !matchItems) return false;
      }
      return true;
    });
  }, [suppliers, selectedCategory, filterBalance, searchQuery]);

  // ----------------------------------------------------
  // Handlers
  // ----------------------------------------------------
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      category: 'Meat & Poultry',
      contactPerson: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      city: 'Lahore',
      paymentTerms: 'Credit 15 Days',
      bankName: '',
      accountTitle: '',
      accountNumber: '',
      iban: '',
      suppliedItemsInput: '',
      currentBalance: '0',
      notes: '',
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      category: s.category,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      whatsapp: s.whatsapp || s.phone || '',
      email: s.email || '',
      address: s.address || '',
      city: s.city || 'Lahore',
      paymentTerms: s.paymentTerms || 'Credit 15 Days',
      bankName: s.bankDetails?.bankName || '',
      accountTitle: s.bankDetails?.accountTitle || '',
      accountNumber: s.bankDetails?.accountNumber || '',
      iban: s.bankDetails?.iban || '',
      suppliedItemsInput: s.suppliedItems ? s.suppliedItems.join(', ') : '',
      currentBalance: String(s.currentBalance || 0),
      notes: s.notes || '',
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = () => {
    if (!supplierForm.name.trim()) {
      showAlert('Required', 'Please enter supplier or company name.');
      return;
    }
    if (!supplierForm.phone.trim()) {
      showAlert('Required', 'Please provide a contact phone number.');
      return;
    }

    const items = supplierForm.suppliedItemsInput
      ? supplierForm.suppliedItemsInput.split(',').map((x) => x.trim()).filter(Boolean)
      : [];

    const bankDetails =
      supplierForm.bankName || supplierForm.accountNumber
        ? {
            bankName: supplierForm.bankName.trim(),
            accountTitle: supplierForm.accountTitle.trim(),
            accountNumber: supplierForm.accountNumber.trim(),
            iban: supplierForm.iban.trim(),
          }
        : undefined;

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, {
        name: supplierForm.name.trim(),
        category: supplierForm.category,
        contactPerson: supplierForm.contactPerson.trim(),
        phone: supplierForm.phone.trim(),
        whatsapp: supplierForm.whatsapp.trim() || supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
        city: supplierForm.city.trim(),
        paymentTerms: supplierForm.paymentTerms.trim(),
        bankDetails,
        suppliedItems: items,
        currentBalance: parseFloat(supplierForm.currentBalance) || 0,
        notes: supplierForm.notes.trim(),
      });
      showAlert('Success', 'Supplier details updated successfully.');
    } else {
      addSupplier({
        name: supplierForm.name.trim(),
        category: supplierForm.category,
        contactPerson: supplierForm.contactPerson.trim(),
        phone: supplierForm.phone.trim(),
        whatsapp: supplierForm.whatsapp.trim() || supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
        city: supplierForm.city.trim(),
        paymentTerms: supplierForm.paymentTerms.trim(),
        bankDetails,
        suppliedItems: items,
        currentBalance: parseFloat(supplierForm.currentBalance) || 0,
        totalPurchases: 0,
        rating: 5,
        status: 'active',
        notes: supplierForm.notes.trim(),
      });
      showAlert('Success', 'New supplier profile created.');
    }

    setIsSupplierModalOpen(false);
  };

  const handleDeleteSupplier = (s: Supplier) => {
    confirmAction(
      'Delete Supplier',
      `Are you sure you want to remove "${s.name}" from your suppliers directory?`,
      () => deleteSupplier(s.id)
    );
  };

  const handleResetDefaults = () => {
    confirmAction(
      'Reset Sultan Default Vendors',
      'This will restore standard pre-configured Sultan Restaurant suppliers (Poultry, Meat, Fresh Produce, Spices, Dairy, LPG, Packaging). Continue?',
      () => {
        populateDefaultSuppliers();
        showAlert('Restored', 'Default Sultan Restaurant vendors restored.');
      }
    );
  };

  // ----------------------------------------------------
  // PO Handlers
  // ----------------------------------------------------
  const handleOpenNewPO = (supplier?: Supplier) => {
    const sup = supplier || suppliers[0];
    setSelectedSupplierForPO(sup || null);

    const initialItems: PurchaseOrderItem[] = sup?.suppliedItems?.length
      ? sup.suppliedItems.slice(0, 2).map((name) => ({
          name,
          category: sup.category,
          unit: 'kg',
          qtyOrdered: 10,
          qtyReceived: 10,
          unitCost: 500,
          totalCost: 5000,
        }))
      : [{ name: '', category: 'Meat', unit: 'kg', qtyOrdered: 10, qtyReceived: 10, unitCost: 0, totalCost: 0 }];

    setPOForm({
      supplierId: sup ? sup.id : '',
      invoiceNo: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      amountPaid: '0',
      discount: '0',
      freight: '0',
      receivedBy: 'Admin',
      notes: '',
      autoReceive: true,
      autoExpense: true,
    });
    setPOItems(initialItems);
    setIsPOModalOpen(true);
  };

  const handleAddPOItem = () => {
    setPOItems([
      ...poItems,
      { name: '', category: 'General', unit: 'kg', qtyOrdered: 1, qtyReceived: 1, unitCost: 0, totalCost: 0 },
    ]);
  };

  const handleUpdatePOItem = (index: number, field: keyof PurchaseOrderItem, val: any) => {
    const updated = [...poItems];
    const item = { ...updated[index], [field]: val };

    if (field === 'qtyOrdered' || field === 'unitCost') {
      const q = parseFloat(String(item.qtyOrdered)) || 0;
      const c = parseFloat(String(item.unitCost)) || 0;
      item.totalCost = q * c;
      if (item.qtyReceived === undefined || item.qtyReceived === 0) {
        item.qtyReceived = q;
      }
    }

    updated[index] = item;
    setPOItems(updated);
  };

  const handleRemovePOItem = (index: number) => {
    if (poItems.length <= 1) return;
    setPOItems(poItems.filter((_, i) => i !== index));
  };

  const calculatePOTotals = () => {
    const subtotal = poItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const discount = parseFloat(poForm.discount) || 0;
    const freight = parseFloat(poForm.freight) || 0;
    const totalAmount = Math.max(0, subtotal - discount + freight);
    const amountPaid = parseFloat(poForm.amountPaid) || 0;
    const balanceDue = Math.max(0, totalAmount - amountPaid);
    return { subtotal, discount, freight, totalAmount, amountPaid, balanceDue };
  };

  const handleSavePO = () => {
    const targetSupplier = suppliers.find((s) => s.id === poForm.supplierId) || selectedSupplierForPO;
    if (!targetSupplier) {
      showAlert('Required', 'Please select a supplier.');
      return;
    }

    const validItems = poItems.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      showAlert('Required', 'Please add at least one item with name and quantity.');
      return;
    }

    const totals = calculatePOTotals();
    // eslint-disable-next-line react-hooks/purity
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    // eslint-disable-next-line react-hooks/purity
    const nowTs = Date.now();

    addPurchaseOrder(
      {
        poNumber,
        supplierId: targetSupplier.id,
        supplierName: targetSupplier.name,
        invoiceNo: poForm.invoiceNo.trim(),
        orderDate: nowTs,
        deliveryDate: poForm.autoReceive ? nowTs : undefined,
        status: poForm.autoReceive ? 'received' : 'ordered',
        paymentStatus: totals.balanceDue === 0 ? 'paid' : totals.amountPaid > 0 ? 'partial' : 'unpaid',
        items: validItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: 0,
        freight: totals.freight,
        totalAmount: totals.totalAmount,
        amountPaid: totals.amountPaid,
        balanceDue: totals.balanceDue,
        paymentMethod: poForm.paymentMethod,
        receivedBy: poForm.receivedBy.trim(),
        notes: poForm.notes.trim(),
      },
      {
        autoReceiveToInventory: poForm.autoReceive,
        autoRecordExpense: poForm.autoExpense,
        receivedBy: poForm.receivedBy.trim(),
      }
    );

    setIsPOModalOpen(false);
    showAlert('Success', `Purchase Order #${poNumber} recorded successfully.`);
  };

  // ----------------------------------------------------
  // Payment Handlers & Full Details Support
  // ----------------------------------------------------
  const handleOpenPaymentModal = (supplier: Supplier, po?: PurchaseOrder) => {
    setSelectedSupplierForPayment(supplier);
    setSelectedPOForPayment(po || null);
    const suggestedAmount = po ? po.balanceDue : supplier.currentBalance || 0;

    setPaymentForm({
      supplierId: supplier.id,
      purchaseOrderId: po?.id || '',
      amount: String(suggestedAmount > 0 ? suggestedAmount : ''),
      method: 'cash',
      bankName: supplier.bankDetails?.bankName || '',
      sourceAccount: 'Main Cash Drawer',
      reference: '',
      chequeNumber: '',
      chequeDate: new Date().toISOString().slice(0, 10),
      paidBy: 'Admin',
      receivedByContact: supplier.contactPerson || '',
      notes: po ? `Clearance for PO #${po.poNumber} (Bill #${po.invoiceNo || 'N/A'})` : `Vendor Account Settlement`,
      autoExpense: true,
    });
    setIsPaymentModalOpen(true);
  };

  const handleQuickFillAmount = (val: number) => {
    setPaymentForm((prev) => ({ ...prev, amount: String(Math.max(0, Math.round(val))) }));
  };

  const handleSavePayment = () => {
    const targetSupplier =
      suppliers.find((s) => s.id === paymentForm.supplierId) || selectedSupplierForPayment;
    if (!targetSupplier) {
      showAlert('Required', 'Please select a supplier.');
      return;
    }
    const amount = parseFloat(paymentForm.amount) || 0;
    if (amount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid payment amount greater than zero.');
      return;
    }

    const newPaymentData = {
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      purchaseOrderId: paymentForm.purchaseOrderId || selectedPOForPayment?.id || undefined,
      amount,
      method: paymentForm.method,
      reference: paymentForm.reference.trim(),
      notes: paymentForm.notes.trim(),
      paidBy: paymentForm.paidBy.trim() || 'Admin',
      bankName: paymentForm.bankName.trim() || undefined,
      chequeNumber: paymentForm.method === 'cheque' ? paymentForm.chequeNumber.trim() : undefined,
      chequeDate: paymentForm.method === 'cheque' ? paymentForm.chequeDate.trim() : undefined,
      receivedByContact: paymentForm.receivedByContact.trim() || undefined,
      sourceAccount: paymentForm.sourceAccount.trim() || undefined,
    };

    recordSupplierPayment(newPaymentData, {
      autoRecordExpense: paymentForm.autoExpense,
    });

    setIsPaymentModalOpen(false);

    // Create payment object for voucher preview
    const createdPayment: SupplierPayment = {
      ...newPaymentData,
      id: `spay-${Date.now().toString(36)}`,
      paidAt: Date.now(),
    };
    setSelectedPaymentForVoucher(createdPayment);
    setIsVoucherModalOpen(true);

    showAlert('Payment Recorded', `Rs. ${amount.toLocaleString()} paid to ${targetSupplier.name}. Official voucher generated.`);
  };

  const handleDeletePayment = (payment: SupplierPayment) => {
    confirmAction(
      'Delete Payment Voucher',
      `Are you sure you want to reverse payment of Rs. ${payment.amount.toLocaleString()} for ${payment.supplierName}?\n\nThis will restore the outstanding balance back to the supplier account.`,
      () => {
        deleteSupplierPayment(payment.id);
        showAlert('Reversed', `Payment voucher deleted and Rs. ${payment.amount.toLocaleString()} restored to supplier balance.`);
      }
    );
  };

  const handleOpenVoucherModal = (payment: SupplierPayment) => {
    setSelectedPaymentForVoucher(payment);
    setIsVoucherModalOpen(true);
  };

  const handleOpenPODetails = (po: PurchaseOrder) => {
    setSelectedPOForDetails(po);
    setIsPODetailsModalOpen(true);
  };

  // Clipboard copy helper
  const copyToClipboard = (text: string, title: string = 'Copied') => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showAlert(title, 'Text copied to clipboard successfully!');
      }).catch(() => {
        showAlert(title, text);
      });
    } else {
      showAlert(title, text);
    }
  };

  // ----------------------------------------------------
  // Ledger Statement Computation & Share
  // ----------------------------------------------------
  type LedgerEntry = {
    id: string;
    date: number;
    type: 'bill' | 'payment';
    docNumber: string;
    invoiceNo?: string;
    title: string;
    subtitle: string;
    debit: number;
    credit: number;
    runningBalance: number;
    po?: PurchaseOrder;
    payment?: SupplierPayment;
  };

  const getSupplierLedgerEntries = (supplierId: string): LedgerEntry[] => {
    const sPOs = purchaseOrders.filter((po) => po.supplierId === supplierId);
    const sPays = supplierPayments.filter((p) => p.supplierId === supplierId);

    const rawList: { date: number; type: 'bill' | 'payment'; po?: PurchaseOrder; payment?: SupplierPayment }[] = [];

    sPOs.forEach((po) => {
      rawList.push({ date: po.orderDate || po.createdAt, type: 'bill', po });
    });

    sPays.forEach((pay) => {
      rawList.push({ date: pay.paidAt, type: 'payment', payment: pay });
    });

    rawList.sort((a, b) => a.date - b.date);

    let currentRunBal = 0;
    const computedEntries: LedgerEntry[] = [];

    rawList.forEach((item, index) => {
      if (item.type === 'bill' && item.po) {
        const po = item.po;
        const debit = po.totalAmount;
        currentRunBal += debit;

        const itemsSummary = po.items.map((i) => `${i.name} (${i.qtyReceived || i.qtyOrdered} ${i.unit})`).join(', ');

        computedEntries.push({
          id: `ledger-po-${po.id}-${index}`,
          date: item.date,
          type: 'bill',
          docNumber: po.poNumber,
          invoiceNo: po.invoiceNo,
          title: `Purchase Bill / Inward Delivery`,
          subtitle: itemsSummary || 'Procurement supplies received',
          debit,
          credit: 0,
          runningBalance: currentRunBal,
          po,
        });
      } else if (item.type === 'payment' && item.payment) {
        const pay = item.payment;
        const credit = pay.amount;
        currentRunBal = Math.max(0, currentRunBal - credit);

        const methodDetails = [
          pay.method.toUpperCase(),
          pay.bankName || pay.sourceAccount,
          pay.reference ? `Ref: ${pay.reference}` : null,
        ].filter(Boolean).join(' • ');

        computedEntries.push({
          id: `ledger-pay-${pay.id}-${index}`,
          date: item.date,
          type: 'payment',
          docNumber: `VCH-${pay.id.slice(-6).toUpperCase()}`,
          title: `Payment Cleared / Settlement`,
          subtitle: `${methodDetails}${pay.notes ? ` • Note: ${pay.notes}` : ''}`,
          debit: 0,
          credit,
          runningBalance: currentRunBal,
          payment: pay,
        });
      }
    });

    return computedEntries;
  };

  const handleShareLedger = (supplier: Supplier, entries: LedgerEntry[]) => {
    const totalBilled = entries.filter((e) => e.type === 'bill').reduce((sum, e) => sum + e.debit, 0);
    const totalPaid = entries.filter((e) => e.type === 'payment').reduce((sum, e) => sum + e.credit, 0);
    const curBal = supplier.currentBalance || 0;

    let text = `==============================\n`;
    text += `🏛️ SULTAN RESTAURANT & BBQ\n`;
    text += `VENDOR ACCOUNT STATEMENT\n`;
    text += `==============================\n`;
    text += `Supplier: ${supplier.name}\n`;
    text += `Category: ${supplier.category}\n`;
    text += `Contact: ${supplier.contactPerson} (${supplier.phone})\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;
    text += `📊 FINANCIAL SUMMARY:\n`;
    text += `• Total Bills (Dr): Rs. ${totalBilled.toLocaleString()}\n`;
    text += `• Total Payments (Cr): Rs. ${totalPaid.toLocaleString()}\n`;
    text += `• NET OUTSTANDING DUE: Rs. ${curBal.toLocaleString()}\n`;
    text += `------------------------------\n`;
    text += `📜 RECENT TRANSACTIONS:\n`;

    const recent = entries.slice(-10);
    recent.forEach((e) => {
      const dStr = new Date(e.date).toLocaleDateString();
      if (e.type === 'bill') {
        text += `• [${dStr}] BILL ${e.docNumber}: +Rs. ${e.debit.toLocaleString()} (Bal: Rs. ${e.runningBalance.toLocaleString()})\n`;
      } else {
        text += `• [${dStr}] PAID ${e.docNumber}: -Rs. ${e.credit.toLocaleString()} (Bal: Rs. ${e.runningBalance.toLocaleString()})\n`;
      }
    });

    if (supplier.bankDetails?.accountNumber) {
      text += `------------------------------\n`;
      text += `🏦 BANK DETAILS:\n`;
      text += `Bank: ${supplier.bankDetails.bankName}\n`;
      text += `A/C Title: ${supplier.bankDetails.accountTitle}\n`;
      text += `A/C No: ${supplier.bankDetails.accountNumber}\n`;
      if (supplier.bankDetails.iban) text += `IBAN: ${supplier.bankDetails.iban}\n`;
    }
    text += `==============================\n`;

    copyToClipboard(text, 'Ledger Statement');
  };

  const handleSharePaymentVoucher = (pay: SupplierPayment) => {
    let text = `==============================\n`;
    text += `🏛️ SULTAN RESTAURANT & BBQ\n`;
    text += `OFFICIAL PAYMENT SETTLEMENT VOUCHER\n`;
    text += `==============================\n`;
    text += `Voucher #: VCH-${pay.id.toUpperCase()}\n`;
    text += `Date: ${new Date(pay.paidAt).toLocaleString()}\n`;
    text += `Payee: ${pay.supplierName}\n`;
    text += `AMOUNT PAID: Rs. ${pay.amount.toLocaleString()}\n`;
    text += `Method: ${pay.method.toUpperCase()}\n`;
    if (pay.bankName) text += `Bank: ${pay.bankName}\n`;
    if (pay.sourceAccount) text += `Source: ${pay.sourceAccount}\n`;
    if (pay.reference) text += `Reference / Trx ID: ${pay.reference}\n`;
    if (pay.chequeNumber) text += `Cheque #: ${pay.chequeNumber} (Date: ${pay.chequeDate || 'N/A'})\n`;
    if (pay.purchaseOrderId) text += `Linked PO: #${pay.purchaseOrderId}\n`;
    text += `Paid By: ${pay.paidBy || 'Admin'}\n`;
    if (pay.receivedByContact) text += `Received By: ${pay.receivedByContact}\n`;
    if (pay.notes) text += `Notes: ${pay.notes}\n`;
    text += `Status: CLEARED & VERIFIED\n`;
    text += `==============================\n`;

    copyToClipboard(text, 'Payment Voucher Slip');
  };

  // ----------------------------------------------------
  // Communication Helpers
  // ----------------------------------------------------
  const handleCall = (phone: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    if (clean) Linking.openURL(`tel:${clean}`);
  };

  const handleWhatsApp = (supplier: Supplier) => {
    const phone = (supplier.whatsapp || supplier.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;

    const itemsText = supplier.suppliedItems?.slice(0, 4).join(', ') || 'supplies';
    const message = encodeURIComponent(
      `Assalam-o-Alaikum ${supplier.contactPerson || supplier.name},\nThis is Sultan Restaurant management. We would like to place an order for: ${itemsText}.\nPlease confirm current stock and dispatch time.`
    );
    Linking.openURL(`https://wa.me/${phone}?text=${message}`);
  };

  const handleOpenLedger = (s: Supplier) => {
    setLedgerSupplier(s);
    setIsLedgerModalOpen(true);
  };

  // Utilities
  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const confirmAction = (title: string, msg: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) onConfirm();
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(backRoute as any))}
          >
            <Ionicons name="arrow-back" size={20} color={BRAND.burgundy} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>Sultan Supplier & Vendor Hub</Text>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>RAW MATERIALS</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Procurement, Purchase Invoices, Vendor Ledgers & Dues</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleResetDefaults}>
            <Ionicons name="refresh-outline" size={16} color={BRAND.burgundy} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryBtnText}>{isMobile ? 'Reset' : 'Reset Vendors'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenAddSupplier}>
            <Ionicons name="person-add-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>Add Supplier</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: BRAND.goldDark }]} onPress={() => handleOpenNewPO()}>
            <Ionicons name="cart-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>{isMobile ? 'New PO' : 'Create PO'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* Top Mega-KPI Bar */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: BRAND.gold }]}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="business" size={20} color={BRAND.goldDark} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Active Suppliers</Text>
              <Text style={styles.kpiValue}>{totalSuppliers} Vendors</Text>
              <Text style={styles.kpiMeta}>Across 9 Food & Supply Categories</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.danger }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="alert-circle" size={20} color={BRAND.danger} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Total Payable Dues</Text>
              <Text style={[styles.kpiValue, { color: BRAND.danger }]}>
                Rs. {totalPayableDue.toLocaleString()}
              </Text>
              <Text style={styles.kpiMeta}>Outstanding Vendor Balances</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.success }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="receipt" size={20} color={BRAND.success} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Lifetime Purchases</Text>
              <Text style={[styles.kpiValue, { color: BRAND.success }]}>
                Rs. {totalPurchasesVolume.toLocaleString()}
              </Text>
              <Text style={styles.kpiMeta}>Procured Raw Materials Value</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: BRAND.info }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#E1F5FE' }]}>
              <Ionicons name="cube" size={20} color={BRAND.info} />
            </View>
            <View>
              <Text style={styles.kpiLabel}>Pending Deliveries</Text>
              <Text style={[styles.kpiValue, { color: BRAND.info }]}>{pendingDeliveriesCount} Orders</Text>
              <Text style={styles.kpiMeta}>Awaiting Kitchen Receipt</Text>
            </View>
          </View>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'directory' && styles.tabBtnActive]}
            onPress={() => setActiveTab('directory')}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={activeTab === 'directory' ? BRAND.burgundy : BRAND.muted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'directory' && styles.tabBtnTextActive]}>
              Suppliers Directory ({suppliers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'orders' && styles.tabBtnActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={activeTab === 'orders' ? BRAND.burgundy : BRAND.muted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'orders' && styles.tabBtnTextActive]}>
              Purchase Orders / Invoices ({purchaseOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'payments' && styles.tabBtnActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={activeTab === 'payments' ? BRAND.burgundy : BRAND.muted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'payments' && styles.tabBtnTextActive]}>
              Payment History ({supplierPayments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: SUPPLIERS DIRECTORY */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'directory' && (
          <View>
            {/* Filter & Search Bar */}
            <View style={styles.filterSection}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={BRAND.muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search supplier by name, contact, item, phone or city..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9E9E9E"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={BRAND.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.balanceFilterRow}>
                <Text style={styles.filterLabel}>Balance:</Text>
                <TouchableOpacity
                  style={[styles.balancePill, filterBalance === 'all' && styles.balancePillActive]}
                  onPress={() => setFilterBalance('all')}
                >
                  <Text style={[styles.balancePillText, filterBalance === 'all' && styles.balancePillTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.balancePill, filterBalance === 'due' && styles.balancePillActive]}
                  onPress={() => setFilterBalance('due')}
                >
                  <Text style={[styles.balancePillText, filterBalance === 'due' && styles.balancePillTextActive]}>
                    Has Due Balance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.balancePill, filterBalance === 'clear' && styles.balancePillActive]}
                  onPress={() => setFilterBalance('clear')}
                >
                  <Text style={[styles.balancePillText, filterBalance === 'clear' && styles.balancePillTextActive]}>
                    Cleared (Rs. 0)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <TouchableOpacity
                style={[styles.categoryPill, selectedCategory === 'All' && styles.categoryPillActive]}
                onPress={() => setSelectedCategory('All')}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === 'All' && styles.categoryPillTextActive,
                  ]}
                >
                  All Categories
                </Text>
              </TouchableOpacity>
              {SUPPLIER_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const meta = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={14}
                      color={isSelected ? '#FFFFFF' : meta.text}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Supplier Cards Grid */}
            <View style={styles.suppliersGrid}>
              {filteredSuppliers.map((s) => {
                const meta = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.Other;
                const hasDue = (s.currentBalance || 0) > 0;

                return (
                  <View key={s.id} style={styles.supplierCard}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
                            <Ionicons name={meta.icon} size={12} color={meta.text} style={{ marginRight: 4 }} />
                            <Text style={[styles.catBadgeText, { color: meta.text }]}>{s.category}</Text>
                          </View>
                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: s.status === 'active' ? '#E8F5E9' : '#FFF3E0' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                { color: s.status === 'active' ? '#2E7D32' : '#E65100' },
                              ]}
                            >
                              {s.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.supplierName}>{s.name}</Text>
                        <Text style={styles.contactPerson}>
                          <Ionicons name="person-outline" size={13} color={BRAND.muted} /> {s.contactPerson} •{' '}
                          <Text style={{ color: BRAND.muted }}>{s.city || 'Lahore'}</Text>
                        </Text>
                      </View>

                      {/* Quick Communication Buttons */}
                      <View style={styles.commBtnRow}>
                        <TouchableOpacity
                          style={[styles.commBtn, { backgroundColor: '#E8F5E9' }]}
                          onPress={() => handleWhatsApp(s)}
                          accessibilityLabel="WhatsApp Reorder"
                        >
                          <Ionicons name="logo-whatsapp" size={18} color="#2E7D32" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.commBtn, { backgroundColor: '#E1F5FE' }]}
                          onPress={() => handleCall(s.phone)}
                          accessibilityLabel="Call Supplier"
                        >
                          <Ionicons name="call" size={16} color="#0277BD" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Supplied Items Chips */}
                    <View style={styles.itemsSection}>
                      <Text style={styles.sectionMiniLabel}>Supplied Raw Materials:</Text>
                      <View style={styles.chipsWrap}>
                        {s.suppliedItems && s.suppliedItems.length > 0 ? (
                          s.suppliedItems.map((item, idx) => (
                            <View key={idx} style={styles.itemChip}>
                              <Text style={styles.itemChipText}>{item}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noItemsText}>No items mapped</Text>
                        )}
                      </View>
                    </View>

                    {/* Financial Stats Bar */}
                    <View style={styles.financialBox}>
                      <View style={styles.finStat}>
                        <Text style={styles.finLabel}>Payable Balance</Text>
                        <Text
                          style={[
                            styles.finValue,
                            { color: hasDue ? BRAND.danger : BRAND.success, fontWeight: '800' },
                          ]}
                        >
                          Rs. {(s.currentBalance || 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.finDivider} />

                      <View style={styles.finStat}>
                        <Text style={styles.finLabel}>Total Purchases</Text>
                        <Text style={styles.finValue}>Rs. {(s.totalPurchases || 0).toLocaleString()}</Text>
                      </View>

                      <View style={styles.finDivider} />

                      <View style={styles.finStat}>
                        <Text style={styles.finLabel}>Payment Terms</Text>
                        <Text style={[styles.finValue, { fontSize: 11, color: BRAND.goldDark }]}>
                          {s.paymentTerms || 'COD'}
                        </Text>
                      </View>
                    </View>

                    {/* Bank Account Info (if present) */}
                    {s.bankDetails?.accountNumber && (
                      <View style={styles.bankBox}>
                        <Ionicons name="card-outline" size={14} color={BRAND.muted} style={{ marginRight: 6 }} />
                        <Text style={styles.bankText} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{s.bankDetails.bankName}:</Text>{' '}
                          {s.bankDetails.accountNumber} ({s.bankDetails.accountTitle})
                        </Text>
                      </View>
                    )}

                    {/* Card Actions Footer */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => handleOpenNewPO(s)}
                      >
                        <Ionicons name="cart-outline" size={14} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                        <Text style={styles.cardActionBtnText}>Create PO</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.cardActionBtn, hasDue && { backgroundColor: '#FFEBEE' }]}
                        onPress={() => handleOpenPaymentModal(s)}
                      >
                        <Ionicons
                          name="cash-outline"
                          size={14}
                          color={hasDue ? BRAND.danger : BRAND.burgundy}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.cardActionBtnText,
                            hasDue && { color: BRAND.danger, fontWeight: '800' },
                          ]}
                        >
                          Pay Dues
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => handleOpenLedger(s)}
                      >
                        <Ionicons name="newspaper-outline" size={14} color={BRAND.muted} style={{ marginRight: 4 }} />
                        <Text style={[styles.cardActionBtnText, { color: BRAND.muted }]}>Ledger</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.cardActionBtn, { paddingHorizontal: 8 }]}
                        onPress={() => handleOpenEditSupplier(s)}
                      >
                        <Ionicons name="pencil" size={14} color={BRAND.muted} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.cardActionBtn, { paddingHorizontal: 8 }]}
                        onPress={() => handleDeleteSupplier(s)}
                      >
                        <Ionicons name="trash-outline" size={14} color={BRAND.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {filteredSuppliers.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={BRAND.muted} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyStateTitle}>No Suppliers Found</Text>
                  <Text style={styles.emptyStateSub}>
                    Try adjusting your search filters or add a new supplier using the button above.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: PURCHASE ORDERS / INVOICES */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'orders' && (
          <View style={styles.ordersSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Procurement & Purchase Invoices</Text>
                <Text style={styles.sectionSub}>All recorded supply deliveries and purchase order vouchers</Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleOpenNewPO()}>
                <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>New Purchase Order</Text>
              </TouchableOpacity>
            </View>

            {purchaseOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={BRAND.muted} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateTitle}>No Purchase Orders Logged</Text>
                <Text style={styles.emptyStateSub}>Create your first purchase order to track ingredient supplies.</Text>
              </View>
            ) : (
              purchaseOrders.map((po) => {
                const isPending = po.status === 'ordered';
                const hasDue = (po.balanceDue || 0) > 0;

                return (
                  <View key={po.id} style={styles.poCard}>
                    <View style={styles.poCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={styles.poNumber}>{po.poNumber}</Text>
                          {po.invoiceNo && <Text style={styles.poInvoiceNo}>(Bill #{po.invoiceNo})</Text>}

                          <View
                            style={[
                              styles.poStatusBadge,
                              { backgroundColor: po.status === 'received' ? '#E8F5E9' : '#FFF3E0' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.poStatusBadgeText,
                                { color: po.status === 'received' ? '#2E7D32' : '#E65100' },
                              ]}
                            >
                              {po.status.toUpperCase()}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.poStatusBadge,
                              {
                                backgroundColor:
                                  po.paymentStatus === 'paid'
                                    ? '#E8F5E9'
                                    : po.paymentStatus === 'partial'
                                    ? '#FFF8E1'
                                    : '#FFEBEE',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.poStatusBadgeText,
                                {
                                  color:
                                    po.paymentStatus === 'paid'
                                      ? '#2E7D32'
                                      : po.paymentStatus === 'partial'
                                      ? '#F57F17'
                                      : '#C62828',
                                },
                              ]}
                            >
                              {po.paymentStatus.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.poSupplierName}>
                          <Ionicons name="business-outline" size={14} color={BRAND.burgundy} /> {po.supplierName}
                        </Text>
                        <Text style={styles.poMetaText}>
                          Date: {new Date(po.orderDate).toLocaleDateString()} • Received by:{' '}
                          {po.receivedBy || 'Admin'}
                        </Text>
                      </View>

                      {/* Total & Due */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.poTotalLabel}>Total Amount</Text>
                        <Text style={styles.poTotalValue}>Rs. {po.totalAmount.toLocaleString()}</Text>
                        {hasDue ? (
                          <Text style={styles.poDueWarning}>Due: Rs. {po.balanceDue.toLocaleString()}</Text>
                        ) : (
                          <Text style={styles.poPaidStatus}>✓ Paid in Full</Text>
                        )}
                      </View>
                    </View>

                    {/* Items table */}
                    <View style={styles.poItemsTable}>
                      <View style={styles.poTableHeader}>
                        <Text style={[styles.poTh, { flex: 3 }]}>Item Description</Text>
                        <Text style={[styles.poTh, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                        <Text style={[styles.poTh, { flex: 1.5, textAlign: 'right' }]}>Rate (Rs)</Text>
                        <Text style={[styles.poTh, { flex: 1.5, textAlign: 'right' }]}>Total (Rs)</Text>
                      </View>
                      {po.items.map((item, i) => (
                        <View key={i} style={styles.poTableRow}>
                          <Text style={[styles.poTd, { flex: 3, fontWeight: '600' }]}>{item.name}</Text>
                          <Text style={[styles.poTd, { flex: 1, textAlign: 'center' }]}>
                            {item.qtyReceived || item.qtyOrdered} {item.unit}
                          </Text>
                          <Text style={[styles.poTd, { flex: 1.5, textAlign: 'right' }]}>
                            {item.unitCost.toLocaleString()}
                          </Text>
                          <Text style={[styles.poTd, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>
                            {item.totalCost.toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* PO Actions */}
                    <View style={styles.poActionsRow}>
                      {isPending && (
                        <TouchableOpacity
                          style={[styles.secondaryBtn, { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' }]}
                          onPress={() => receivePurchaseOrder(po.id, undefined, 'Admin')}
                        >
                          <Ionicons name="checkmark-done" size={14} color="#2E7D32" style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryBtnText, { color: '#2E7D32' }]}>Receive into Kitchen Stock</Text>
                        </TouchableOpacity>
                      )}

                      {hasDue && (
                        <TouchableOpacity
                          style={[styles.secondaryBtn, { backgroundColor: '#FFEBEE', borderColor: BRAND.danger }]}
                          onPress={() => {
                            const sup = suppliers.find((s) => s.id === po.supplierId);
                            if (sup) handleOpenPaymentModal(sup, po);
                          }}
                        >
                          <Ionicons name="cash-outline" size={14} color={BRAND.danger} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryBtnText, { color: BRAND.danger }]}>Pay PO Due (Rs. {po.balanceDue})</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: BRAND.border }]}
                        onPress={() => deletePurchaseOrder(po.id)}
                      >
                        <Ionicons name="trash-outline" size={14} color={BRAND.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: PAYMENT HISTORY */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'payments' && (
          <View style={styles.paymentsSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Vendor Settlements & Payment Logs</Text>
                <Text style={styles.sectionSub}>All cleared payouts made to restaurant suppliers</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const firstSup = suppliers[0];
                  if (firstSup) handleOpenPaymentModal(firstSup);
                }}
              >
                <Ionicons name="cash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Record Payment</Text>
              </TouchableOpacity>
            </View>

            {/* Payment KPIs Summary Bar */}
            <View style={styles.paymentKpiRow}>
              <View style={[styles.paymentKpiCard, { borderLeftColor: BRAND.success }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="cash" size={20} color={BRAND.success} />
                </View>
                <View>
                  <Text style={styles.kpiLabel}>Total Paid Out</Text>
                  <Text style={[styles.kpiValue, { color: BRAND.success }]}>
                    Rs. {totalPaymentsDisbursed.toLocaleString()}
                  </Text>
                  <Text style={styles.kpiMeta}>{supplierPayments.length} Total Vouchers</Text>
                </View>
              </View>

              <View style={[styles.paymentKpiCard, { borderLeftColor: BRAND.burgundy }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#F5EBE6' }]}>
                  <Ionicons name="wallet-outline" size={20} color={BRAND.burgundy} />
                </View>
                <View>
                  <Text style={styles.kpiLabel}>Cash Disbursements</Text>
                  <Text style={[styles.kpiValue, { color: BRAND.burgundy }]}>
                    Rs. {cashPaymentsTotal.toLocaleString()}
                  </Text>
                  <Text style={styles.kpiMeta}>From Cash Drawers / Counters</Text>
                </View>
              </View>

              <View style={[styles.paymentKpiCard, { borderLeftColor: BRAND.info }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#E1F5FE' }]}>
                  <Ionicons name="card-outline" size={20} color={BRAND.info} />
                </View>
                <View>
                  <Text style={styles.kpiLabel}>Bank & Online</Text>
                  <Text style={[styles.kpiValue, { color: BRAND.info }]}>
                    Rs. {onlinePaymentsTotal.toLocaleString()}
                  </Text>
                  <Text style={styles.kpiMeta}>IBFT / Online Transfers</Text>
                </View>
              </View>
            </View>

            {/* Payment Search & Filter Section */}
            <View style={styles.filterSection}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={BRAND.muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search payments by vendor, reference, bank, or notes..."
                  value={paymentSearch}
                  onChangeText={setPaymentSearch}
                  placeholderTextColor="#9E9E9E"
                />
                {paymentSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={BRAND.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Method filter pills */}
              <View style={styles.balanceFilterRow}>
                <Text style={styles.filterLabel}>Method:</Text>
                {(['all', 'cash', 'online', 'cheque'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.balancePill, paymentMethodFilter === m && styles.balancePillActive]}
                    onPress={() => setPaymentMethodFilter(m)}
                  >
                    <Text
                      style={[
                        styles.balancePillText,
                        paymentMethodFilter === m && styles.balancePillTextActive,
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Vendor Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <TouchableOpacity
                style={[styles.categoryPill, paymentSupplierFilter === 'all' && styles.categoryPillActive]}
                onPress={() => setPaymentSupplierFilter('all')}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    paymentSupplierFilter === 'all' && styles.categoryPillTextActive,
                  ]}
                >
                  All Vendors ({supplierPayments.length})
                </Text>
              </TouchableOpacity>
              {suppliers.map((s) => {
                const count = supplierPayments.filter((p) => p.supplierId === s.id).length;
                if (count === 0) return null;
                const isSelected = paymentSupplierFilter === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    onPress={() => setPaymentSupplierFilter(s.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {s.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payments List */}
            {filteredPayments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cash-outline" size={48} color={BRAND.muted} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateTitle}>No Payments Found</Text>
                <Text style={styles.emptyStateSub}>
                  {supplierPayments.length === 0
                    ? 'No payments recorded yet. Click "Record Payment" to log a settlement.'
                    : 'No payments match the active search or filters.'}
                </Text>
              </View>
            ) : (
              filteredPayments.map((pay) => {
                const sup = suppliers.find((s) => s.id === pay.supplierId);
                const isCash = pay.method === 'cash';
                const isOnline = pay.method === 'online';
                const isCheque = pay.method === 'cheque';

                return (
                  <View key={pay.id} style={styles.paymentCardFull}>
                    <View style={styles.paymentCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View
                          style={[
                            styles.payIconWrapLarge,
                            {
                              backgroundColor: isCash
                                ? '#E8F5E9'
                                : isOnline
                                ? '#E1F5FE'
                                : '#FFF3E0',
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isCash
                                ? 'cash-outline'
                                : isOnline
                                ? 'phone-portrait-outline'
                                : 'document-text-outline'
                            }
                            size={22}
                            color={isCash ? '#2E7D32' : isOnline ? '#0277BD' : '#E65100'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.paymentSupplierNameLarge}>{pay.supplierName}</Text>
                            <View
                              style={[
                                styles.payMethodTag,
                                {
                                  backgroundColor: isCash
                                    ? '#E8F5E9'
                                    : isOnline
                                    ? '#E1F5FE'
                                    : '#FFF3E0',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.payMethodTagText,
                                  { color: isCash ? '#2E7D32' : isOnline ? '#0277BD' : '#E65100' },
                                ]}
                              >
                                {pay.method.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.paymentVoucherId}>
                            Voucher: VCH-{pay.id.slice(-6).toUpperCase()} •{' '}
                            {new Date(pay.paidAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Text>
                        </View>
                      </View>

                      {/* Right amount badge */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.paymentAmountLarge}>
                          Rs. {pay.amount.toLocaleString()}
                        </Text>
                        <Text style={styles.paidByTag}>Disbursed by: {pay.paidBy || 'Admin'}</Text>
                      </View>
                    </View>

                    {/* Detailed info pills row */}
                    <View style={styles.payDetailsGrid}>
                      {pay.sourceAccount && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="wallet-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Paid From:</Text> {pay.sourceAccount}
                          </Text>
                        </View>
                      )}

                      {pay.bankName && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="business-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Bank:</Text> {pay.bankName}
                          </Text>
                        </View>
                      )}

                      {pay.reference && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="barcode-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Trx / Ref:</Text> {pay.reference}
                          </Text>
                        </View>
                      )}

                      {pay.chequeNumber && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="newspaper-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Cheque #:</Text> {pay.chequeNumber}
                            {pay.chequeDate ? ` (Due: ${pay.chequeDate})` : ''}
                          </Text>
                        </View>
                      )}

                      {pay.receivedByContact && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="person-circle-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Received By:</Text> {pay.receivedByContact}
                          </Text>
                        </View>
                      )}

                      {pay.purchaseOrderId && (
                        <View style={styles.payDetailItem}>
                          <Ionicons name="document-attach-outline" size={13} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.payDetailText}>
                            <Text style={{ fontWeight: '700' }}>Linked PO:</Text> #{pay.purchaseOrderId}
                          </Text>
                        </View>
                      )}
                    </View>

                    {pay.notes ? (
                      <View style={styles.paymentNoteBox}>
                        <Ionicons name="information-circle-outline" size={14} color={BRAND.goldDark} style={{ marginRight: 6 }} />
                        <Text style={styles.paymentNoteText}>{pay.notes}</Text>
                      </View>
                    ) : null}

                    {/* Action buttons */}
                    <View style={styles.paymentCardActions}>
                      <TouchableOpacity
                        style={styles.payActionBtn}
                        onPress={() => handleOpenVoucherModal(pay)}
                      >
                        <Ionicons name="receipt-outline" size={14} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                        <Text style={styles.payActionBtnText}>View Voucher Slip</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.payActionBtn}
                        onPress={() => handleSharePaymentVoucher(pay)}
                      >
                        <Ionicons name="share-social-outline" size={14} color={BRAND.muted} style={{ marginRight: 4 }} />
                        <Text style={[styles.payActionBtnText, { color: BRAND.ink }]}>Copy Receipt</Text>
                      </TouchableOpacity>

                      {sup && (
                        <TouchableOpacity
                          style={styles.payActionBtn}
                          onPress={() => handleOpenLedger(sup)}
                        >
                          <Ionicons name="newspaper-outline" size={14} color={BRAND.muted} style={{ marginRight: 4 }} />
                          <Text style={[styles.payActionBtnText, { color: BRAND.ink }]}>Vendor Ledger</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.payActionBtn, { borderColor: '#FFCDD2' }]}
                        onPress={() => handleDeletePayment(pay)}
                      >
                        <Ionicons name="trash-outline" size={14} color={BRAND.danger} style={{ marginRight: 4 }} />
                        <Text style={[styles.payActionBtnText, { color: BRAND.danger }]}>Reverse</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT SUPPLIER */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isSupplierModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, isMobile && { width: '95%', maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSupplier ? 'Edit Supplier Profile' : 'Add New Food / Raw Material Supplier'}
              </Text>
              <TouchableOpacity onPress={() => setIsSupplierModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Supplier & Category */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Supplier / Company Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Al-Madina Fresh Poultry Ltd"
                    value={supplierForm.name}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, name: t })}
                  />
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Category *</Text>
                  <View style={styles.pickerWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {SUPPLIER_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.catChoicePill,
                            supplierForm.category === cat && styles.catChoicePillActive,
                          ]}
                          onPress={() => setSupplierForm({ ...supplierForm, category: cat })}
                        >
                          <Text
                            style={[
                              styles.catChoicePillText,
                              supplierForm.category === cat && styles.catChoicePillTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              {/* Contact Person & Phone */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Contact Person / Dealer Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Haji Muhammad Rafiq"
                    value={supplierForm.contactPerson}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, contactPerson: t })}
                  />
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. +92 300 4567891"
                    keyboardType="phone-pad"
                    value={supplierForm.phone}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, phone: t })}
                  />
                </View>
              </View>

              {/* WhatsApp & Email */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>WhatsApp Number (for 1-tap reordering)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. +92 300 4567891"
                    keyboardType="phone-pad"
                    value={supplierForm.whatsapp}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, whatsapp: t })}
                  />
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>City / Location</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Lahore / Badami Bagh"
                    value={supplierForm.city}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, city: t })}
                  />
                </View>
              </View>

              {/* Address */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Full Shop / Warehouse Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Shop #14, Tollinton Poultry Market, Jail Road"
                  value={supplierForm.address}
                  onChangeText={(t) => setSupplierForm({ ...supplierForm, address: t })}
                />
              </View>

              {/* Supplied Items */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Supplied Raw Materials / Items (Comma separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chicken Boneless, Wings, Mutton Chops, Basmati Rice"
                  value={supplierForm.suppliedItemsInput}
                  onChangeText={(t) => setSupplierForm({ ...supplierForm, suppliedItemsInput: t })}
                />
                <Text style={styles.inputHint}>Tip: Separate each ingredient with a comma.</Text>
              </View>

              {/* Payment Terms & Initial Balance */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Payment Terms</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Credit 15 Days / COD / Weekly"
                    value={supplierForm.paymentTerms}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, paymentTerms: t })}
                  />
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Current Payable Balance (Rs)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={supplierForm.currentBalance}
                    onChangeText={(t) => setSupplierForm({ ...supplierForm, currentBalance: t })}
                  />
                </View>
              </View>

              {/* Bank Account Details */}
              <View style={styles.formSectionBox}>
                <Text style={styles.formSectionTitle}>Bank / Online Payment Details</Text>
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.inputLabel}>Bank Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Meezan Bank / HBL / JazzCash"
                      value={supplierForm.bankName}
                      onChangeText={(t) => setSupplierForm({ ...supplierForm, bankName: t })}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.inputLabel}>Account Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Al-Madina Poultry Traders"
                      value={supplierForm.accountTitle}
                      onChangeText={(t) => setSupplierForm({ ...supplierForm, accountTitle: t })}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.inputLabel}>Account / IBAN Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 0101-0102938475"
                      value={supplierForm.accountNumber}
                      onChangeText={(t) => setSupplierForm({ ...supplierForm, accountNumber: t })}
                    />
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Internal Notes / Delivery Schedule</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  multiline
                  placeholder="e.g. Morning 8 AM delivery, Halal certified."
                  value={supplierForm.notes}
                  onChangeText={(t) => setSupplierForm({ ...supplierForm, notes: t })}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsSupplierModalOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveSupplier}>
                <Text style={styles.primaryBtnText}>
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier Profile'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: CREATE PURCHASE ORDER */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isPOModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: isMobile ? '95%' : 750, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Purchase Order / Delivery Log
              </Text>
              <TouchableOpacity onPress={() => setIsPOModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Supplier Selection */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Select Supplier *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6 }}>
                    {suppliers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.supChoicePill,
                          poForm.supplierId === s.id && styles.supChoicePillActive,
                        ]}
                        onPress={() => {
                          setPOForm({ ...poForm, supplierId: s.id });
                          setSelectedSupplierForPO(s);
                        }}
                      >
                        <Text
                          style={[
                            styles.supChoicePillText,
                            poForm.supplierId === s.id && styles.supChoicePillTextActive,
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Vendor Bill / Invoice #</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. AMP-8821"
                    value={poForm.invoiceNo}
                    onChangeText={(t) => setPOForm({ ...poForm, invoiceNo: t })}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Received By Staff / Chef</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Chef Omar"
                    value={poForm.receivedBy}
                    onChangeText={(t) => setPOForm({ ...poForm, receivedBy: t })}
                  />
                </View>
              </View>

              {/* Multi-Item Repeater */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Supplied Ingredients / Items *</Text>
                  <TouchableOpacity style={styles.addSmallBtn} onPress={handleAddPOItem}>
                    <Ionicons name="add" size={14} color={BRAND.burgundy} />
                    <Text style={styles.addSmallBtnText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {poItems.map((item, idx) => (
                  <View key={idx} style={styles.poItemRow}>
                    <View style={{ flex: 3 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="Item Name (e.g. Boneless Chicken)"
                        value={item.name}
                        onChangeText={(t) => handleUpdatePOItem(idx, 'name', t)}
                      />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="Qty"
                        keyboardType="numeric"
                        value={String(item.qtyOrdered || '')}
                        onChangeText={(t) => handleUpdatePOItem(idx, 'qtyOrdered', parseFloat(t) || 0)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="Unit (kg)"
                        value={item.unit}
                        onChangeText={(t) => handleUpdatePOItem(idx, 'unit', t)}
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="Rate (Rs)"
                        keyboardType="numeric"
                        value={String(item.unitCost || '')}
                        onChangeText={(t) => handleUpdatePOItem(idx, 'unitCost', parseFloat(t) || 0)}
                      />
                    </View>
                    <View style={{ flex: 1.5, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 4 }}>
                      <Text style={{ fontWeight: '800', color: BRAND.ink }}>
                        Rs. {(item.totalCost || 0).toLocaleString()}
                      </Text>
                    </View>
                    {poItems.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemovePOItem(idx)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Financial Calculation Box */}
              {(() => {
                const totals = calculatePOTotals();
                return (
                  <View style={styles.poSummaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal:</Text>
                      <Text style={styles.summaryVal}>Rs. {totals.subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Discount:</Text>
                      <TextInput
                        style={[styles.smallInput, { width: 90 }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={poForm.discount}
                        onChangeText={(t) => setPOForm({ ...poForm, discount: t })}
                      />
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Freight / Delivery Charges:</Text>
                      <TextInput
                        style={[styles.smallInput, { width: 90 }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={poForm.freight}
                        onChangeText={(t) => setPOForm({ ...poForm, freight: t })}
                      />
                    </View>
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: BRAND.border, paddingTop: 6, marginTop: 4 }]}>
                      <Text style={[styles.summaryLabel, { fontWeight: '800', fontSize: 15 }]}>Net PO Total:</Text>
                      <Text style={[styles.summaryVal, { fontWeight: '900', fontSize: 16, color: BRAND.burgundy }]}>
                        Rs. {totals.totalAmount.toLocaleString()}
                      </Text>
                    </View>

                    {/* Payment settlement row */}
                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                      <Text style={styles.summaryLabel}>Amount Paid Today:</Text>
                      <TextInput
                        style={[styles.smallInput, { width: 110, fontWeight: '700' }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={poForm.amountPaid}
                        onChangeText={(t) => setPOForm({ ...poForm, amountPaid: t })}
                      />
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Remaining Balance Due:</Text>
                      <Text
                        style={[
                          styles.summaryVal,
                          { color: totals.balanceDue > 0 ? BRAND.danger : BRAND.success, fontWeight: '800' },
                        ]}
                      >
                        Rs. {totals.balanceDue.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Auto Toggles */}
              <View style={styles.togglesBox}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setPOForm({ ...poForm, autoReceive: !poForm.autoReceive })}
                >
                  <Ionicons
                    name={poForm.autoReceive ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={BRAND.burgundy}
                  />
                  <Text style={styles.toggleText}>
                    Instantly update Raw Material Inventory Stock levels
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setPOForm({ ...poForm, autoExpense: !poForm.autoExpense })}
                >
                  <Ionicons
                    name={poForm.autoExpense ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={BRAND.burgundy}
                  />
                  <Text style={styles.toggleText}>
                    Auto-record Amount Paid in Daily Restaurant Cash Expenses
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsPOModalOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePO}>
                <Text style={styles.primaryBtnText}>Record & Save PO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: RECORD VENDOR PAYMENT (FULL DETAILS) */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isPaymentModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: isMobile ? '95%' : 560, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Vendor Payment Voucher</Text>
                <Text style={styles.modalSub}>Disburse settlement & update supplier ledger balance</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPaymentModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Supplier info banner */}
              {(() => {
                const curSup =
                  suppliers.find((s) => s.id === paymentForm.supplierId) || selectedSupplierForPayment;
                const outstanding = curSup?.currentBalance || 0;
                const pendingPOs = purchaseOrders.filter(
                  (po) => po.supplierId === curSup?.id && (po.balanceDue || 0) > 0
                );

                return (
                  <View>
                    <View style={styles.paymentSupBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentSupBannerName}>{curSup?.name}</Text>
                        <Text style={styles.paymentSupBannerMeta}>
                          {curSup?.category} • {curSup?.contactPerson} ({curSup?.phone})
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.paymentSupBannerDueLabel}>Outstanding Payable</Text>
                        <Text
                          style={[
                            styles.paymentSupBannerDueVal,
                            { color: outstanding > 0 ? BRAND.danger : BRAND.success },
                          ]}
                        >
                          Rs. {outstanding.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Amount Fill Shortcuts */}
                    {outstanding > 0 && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={styles.inputHintBold}>Quick Amount Shortcuts:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          <TouchableOpacity
                            style={styles.quickFillPill}
                            onPress={() => handleQuickFillAmount(outstanding)}
                          >
                            <Text style={styles.quickFillPillText}>
                              Full Due (Rs. {outstanding.toLocaleString()})
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.quickFillPill}
                            onPress={() => handleQuickFillAmount(outstanding * 0.5)}
                          >
                            <Text style={styles.quickFillPillText}>
                              50% Due (Rs. {Math.round(outstanding * 0.5).toLocaleString()})
                            </Text>
                          </TouchableOpacity>
                          {[5000, 10000, 25000, 50000].map((preset) => {
                            if (preset > outstanding * 1.5) return null;
                            return (
                              <TouchableOpacity
                                key={preset}
                                style={styles.quickFillPill}
                                onPress={() => handleQuickFillAmount(preset)}
                              >
                                <Text style={styles.quickFillPillText}>Rs. {preset.toLocaleString()}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* PO Specific Allocation (Optional) */}
                    {pendingPOs.length > 0 && (
                      <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>Allocate Against Specific Invoice / PO (Optional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                          <TouchableOpacity
                            style={[
                              styles.poAllocPill,
                              !paymentForm.purchaseOrderId && styles.poAllocPillActive,
                            ]}
                            onPress={() => setPaymentForm((prev) => ({ ...prev, purchaseOrderId: '' }))}
                          >
                            <Text
                              style={[
                                styles.poAllocPillText,
                                !paymentForm.purchaseOrderId && styles.poAllocPillTextActive,
                              ]}
                            >
                              General Account Settlement
                            </Text>
                          </TouchableOpacity>
                          {pendingPOs.map((po) => {
                            const isSelected = paymentForm.purchaseOrderId === po.id;
                            return (
                              <TouchableOpacity
                                key={po.id}
                                style={[styles.poAllocPill, isSelected && styles.poAllocPillActive]}
                                onPress={() => {
                                  setPaymentForm((prev) => ({
                                    ...prev,
                                    purchaseOrderId: po.id,
                                    amount: String(po.balanceDue),
                                    notes: `Settlement for PO #${po.poNumber}${po.invoiceNo ? ` (Bill #${po.invoiceNo})` : ''}`,
                                  }));
                                }}
                              >
                                <Text
                                  style={[
                                    styles.poAllocPillText,
                                    isSelected && styles.poAllocPillTextActive,
                                  ]}
                                >
                                  {po.poNumber}: Due Rs. {po.balanceDue.toLocaleString()}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Amount input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Settlement Amount (PKR) *</Text>
                <TextInput
                  style={[
                    styles.input,
                    { fontSize: 20, fontWeight: '900', color: BRAND.burgundy, paddingVertical: 10 },
                  ]}
                  placeholder="0"
                  keyboardType="numeric"
                  value={paymentForm.amount}
                  onChangeText={(t) => setPaymentForm({ ...paymentForm, amount: t })}
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Payment Method *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['cash', 'online', 'cheque'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodPill, paymentForm.method === m && styles.methodPillActive]}
                      onPress={() => setPaymentForm({ ...paymentForm, method: m })}
                    >
                      <Ionicons
                        name={
                          m === 'cash'
                            ? 'cash-outline'
                            : m === 'online'
                            ? 'phone-portrait-outline'
                            : 'document-text-outline'
                        }
                        size={16}
                        color={paymentForm.method === m ? '#FFFFFF' : BRAND.ink}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.methodPillText,
                          paymentForm.method === m && styles.methodPillTextActive,
                        ]}
                      >
                        {m === 'cash' ? 'Cash Counter' : m === 'online' ? 'Online / IBFT' : 'Bank Cheque'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Contextual Fields: Cash Mode */}
              {paymentForm.method === 'cash' && (
                <View style={styles.formSectionBox}>
                  <Text style={styles.formSectionTitle}>Cash Payment Details</Text>
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Cash Drawer / Source</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Main Cash Drawer / Safe Vault"
                        value={paymentForm.sourceAccount}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, sourceAccount: t })}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Cash Receiver / Vendor Agent</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Driver Rafiq / Sales Rep"
                        value={paymentForm.receivedByContact}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, receivedByContact: t })}
                      />
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Cash Receipt Voucher / Serial #</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Cash Voucher #981 / Slip #12"
                      value={paymentForm.reference}
                      onChangeText={(t) => setPaymentForm({ ...paymentForm, reference: t })}
                    />
                  </View>
                </View>
              )}

              {/* Contextual Fields: Online Mode */}
              {paymentForm.method === 'online' && (
                <View style={styles.formSectionBox}>
                  <Text style={styles.formSectionTitle}>Online / IBFT Transfer Details</Text>
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Restaurant Debit Account</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Meezan Bank A/C #0281"
                        value={paymentForm.sourceAccount}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, sourceAccount: t })}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Beneficiary Bank</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Meezan Bank / HBL / Bank Alfalah"
                        value={paymentForm.bankName}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, bankName: t })}
                      />
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Bank Transaction ID / UTR / Reference *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. IBFT-9821381283 / Trx #882194"
                      value={paymentForm.reference}
                      onChangeText={(t) => setPaymentForm({ ...paymentForm, reference: t })}
                    />
                  </View>
                </View>
              )}

              {/* Contextual Fields: Cheque Mode */}
              {paymentForm.method === 'cheque' && (
                <View style={styles.formSectionBox}>
                  <Text style={styles.formSectionTitle}>Cheque Instrument Details</Text>
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Cheque Number *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. CHQ-0098231"
                        value={paymentForm.chequeNumber}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, chequeNumber: t })}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Bank Name</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Meezan Bank Ltd"
                        value={paymentForm.bankName}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, bankName: t })}
                      />
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Cheque Clearance Date</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={paymentForm.chequeDate}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, chequeDate: t })}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Cheque Delivered To</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Supplier Manager"
                        value={paymentForm.receivedByContact}
                        onChangeText={(t) => setPaymentForm({ ...paymentForm, receivedByContact: t })}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Authorized by & Notes */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Disbursed / Authorized By</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Admin / Cashier Omar"
                    value={paymentForm.paidBy}
                    onChangeText={(t) => setPaymentForm({ ...paymentForm, paidBy: t })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Payment Remarks / Ledger Narration</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  multiline
                  placeholder="e.g. Weekly vendor settlement cleared after quality verification."
                  value={paymentForm.notes}
                  onChangeText={(t) => setPaymentForm({ ...paymentForm, notes: t })}
                />
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setPaymentForm({ ...paymentForm, autoExpense: !paymentForm.autoExpense })}
              >
                <Ionicons
                  name={paymentForm.autoExpense ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={BRAND.burgundy}
                />
                <Text style={styles.toggleText}>
                  Auto-record as cash expense in Daily Restaurant Shift Ledger
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsPaymentModalOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePayment}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Confirm & Generate Voucher</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: DEDICATED SEPARATE SUPPLIER ACCOUNT LEDGER */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isLedgerModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: isMobile ? '95%' : 840, maxHeight: '92%' }]}>
            {(() => {
              const currentSup =
                suppliers.find((s) => s.id === ledgerSupplier?.id) || ledgerSupplier;
              if (!currentSup) return null;

              const allLedgerEntries = getSupplierLedgerEntries(currentSup.id);
              const totalBilled = allLedgerEntries
                .filter((e) => e.type === 'bill')
                .reduce((sum, e) => sum + e.debit, 0);
              const totalPaid = allLedgerEntries
                .filter((e) => e.type === 'payment')
                .reduce((sum, e) => sum + e.credit, 0);
              const currentDue = currentSup.currentBalance || 0;

              // Filtered entries within ledger
              const displayedEntries = allLedgerEntries
                .filter((e) => {
                  if (ledgerFilter === 'bills' && e.type !== 'bill') return false;
                  if (ledgerFilter === 'payments' && e.type !== 'payment') return false;
                  if (ledgerSearch.trim()) {
                    const q = ledgerSearch.toLowerCase();
                    const mDoc = e.docNumber.toLowerCase().includes(q);
                    const mInv = e.invoiceNo?.toLowerCase().includes(q);
                    const mSub = e.subtitle.toLowerCase().includes(q);
                    if (!mDoc && !mInv && !mSub) return false;
                  }
                  return true;
                })
                .sort((a, b) => (ledgerSortAsc ? a.date - b.date : b.date - a.date));

              return (
                <View style={{ flex: 1 }}>
                  {/* Ledger Header */}
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.modalTitle}>Supplier Account Statement & Ledger</Text>
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>{currentSup.category.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.modalSub}>
                        {currentSup.name} • Contact: {currentSup.contactPerson} ({currentSup.phone})
                      </Text>
                    </View>

                    <TouchableOpacity onPress={() => setIsLedgerModalOpen(false)}>
                      <Ionicons name="close" size={24} color={BRAND.ink} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                    {/* Supplier Contact & Quick Actions Strip */}
                    <View style={styles.ledgerSupplierStrip}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ledgerSupAddress}>
                          <Ionicons name="location-outline" size={13} color={BRAND.muted} />{' '}
                          {currentSup.address || currentSup.city || 'Lahore'}
                          {currentSup.paymentTerms ? ` • Terms: ${currentSup.paymentTerms}` : ''}
                        </Text>
                        {currentSup.bankDetails?.accountNumber ? (
                          <TouchableOpacity
                            style={styles.ledgerBankCopyRow}
                            onPress={() =>
                              copyToClipboard(
                                `${currentSup.bankDetails?.bankName} - ${currentSup.bankDetails?.accountNumber} (${currentSup.bankDetails?.accountTitle})`,
                                'Bank Details Copied'
                              )
                            }
                          >
                            <Ionicons name="card-outline" size={13} color={BRAND.goldDark} />
                            <Text style={styles.ledgerBankCopyText}>
                              {currentSup.bankDetails.bankName}: {currentSup.bankDetails.accountNumber} (
                              {currentSup.bankDetails.accountTitle}) • Tap to copy
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={[styles.commBtn, { backgroundColor: '#E8F5E9' }]}
                          onPress={() => handleWhatsApp(currentSup)}
                          accessibilityLabel="WhatsApp Vendor"
                        >
                          <Ionicons name="logo-whatsapp" size={18} color="#2E7D32" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.commBtn, { backgroundColor: '#E1F5FE' }]}
                          onPress={() => handleCall(currentSup.phone)}
                          accessibilityLabel="Call Vendor"
                        >
                          <Ionicons name="call" size={16} color="#0277BD" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.ledgerActionBtnSmall}
                          onPress={() => handleShareLedger(currentSup, allLedgerEntries)}
                        >
                          <Ionicons name="share-social-outline" size={14} color={BRAND.burgundy} style={{ marginRight: 4 }} />
                          <Text style={styles.ledgerActionBtnSmallText}>Copy Statement</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.primaryBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}
                          onPress={() => handleOpenPaymentModal(currentSup)}
                        >
                          <Ionicons name="cash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={[styles.primaryBtnText, { fontSize: 11 }]}>Pay Dues</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.primaryBtn, { backgroundColor: BRAND.goldDark, paddingVertical: 6, paddingHorizontal: 10 }]}
                          onPress={() => handleOpenNewPO(currentSup)}
                        >
                          <Ionicons name="cart-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={[styles.primaryBtnText, { fontSize: 11 }]}>New PO</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Financial Summary KPI Cards */}
                    <View style={styles.ledgerKpiRow}>
                      <View style={[styles.ledgerKpiBox, { borderLeftColor: BRAND.burgundy }]}>
                        <Text style={styles.ledgerKpiLabel}>Total Procurement (Dr)</Text>
                        <Text style={[styles.ledgerKpiVal, { color: BRAND.burgundy }]}>
                          Rs. {totalBilled.toLocaleString()}
                        </Text>
                        <Text style={styles.ledgerKpiSub}>Invoices / Goods Received</Text>
                      </View>

                      <View style={[styles.ledgerKpiBox, { borderLeftColor: BRAND.success }]}>
                        <Text style={styles.ledgerKpiLabel}>Total Paid Out (Cr)</Text>
                        <Text style={[styles.ledgerKpiVal, { color: BRAND.success }]}>
                          Rs. {totalPaid.toLocaleString()}
                        </Text>
                        <Text style={styles.ledgerKpiSub}>Payments Cleared</Text>
                      </View>

                      <View style={[styles.ledgerKpiBox, { borderLeftColor: currentDue > 0 ? BRAND.danger : BRAND.success }]}>
                        <Text style={styles.ledgerKpiLabel}>Net Outstanding Payable</Text>
                        <Text
                          style={[
                            styles.ledgerKpiVal,
                            { color: currentDue > 0 ? BRAND.danger : BRAND.success },
                          ]}
                        >
                          Rs. {currentDue.toLocaleString()}
                        </Text>
                        <Text style={styles.ledgerKpiSub}>
                          {currentDue > 0 ? '⚠️ Outstanding Dues Pending' : '✓ Account Fully Settled'}
                        </Text>
                      </View>
                    </View>

                    {/* Ledger Filter & Search Toolbar */}
                    <View style={styles.ledgerToolbar}>
                      <View style={styles.ledgerFilterTabs}>
                        <TouchableOpacity
                          style={[styles.ledgerTabPill, ledgerFilter === 'all' && styles.ledgerTabPillActive]}
                          onPress={() => setLedgerFilter('all')}
                        >
                          <Text
                            style={[
                              styles.ledgerTabPillText,
                              ledgerFilter === 'all' && styles.ledgerTabPillTextActive,
                            ]}
                          >
                            All ({allLedgerEntries.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.ledgerTabPill, ledgerFilter === 'bills' && styles.ledgerTabPillActive]}
                          onPress={() => setLedgerFilter('bills')}
                        >
                          <Text
                            style={[
                              styles.ledgerTabPillText,
                              ledgerFilter === 'bills' && styles.ledgerTabPillTextActive,
                            ]}
                          >
                            Bills (Dr) ({allLedgerEntries.filter((e) => e.type === 'bill').length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.ledgerTabPill, ledgerFilter === 'payments' && styles.ledgerTabPillActive]}
                          onPress={() => setLedgerFilter('payments')}
                        >
                          <Text
                            style={[
                              styles.ledgerTabPillText,
                              ledgerFilter === 'payments' && styles.ledgerTabPillTextActive,
                            ]}
                          >
                            Payments (Cr) ({allLedgerEntries.filter((e) => e.type === 'payment').length})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.ledgerSearchBox}>
                        <Ionicons name="search" size={14} color={BRAND.muted} style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.ledgerSearchInput}
                          placeholder="Search statement..."
                          value={ledgerSearch}
                          onChangeText={setLedgerSearch}
                          placeholderTextColor="#9E9E9E"
                        />
                        {ledgerSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setLedgerSearch('')}>
                            <Ionicons name="close-circle" size={14} color={BRAND.muted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.ledgerSortBtn}
                        onPress={() => setLedgerSortAsc(!ledgerSortAsc)}
                      >
                        <Ionicons
                          name={ledgerSortAsc ? 'arrow-up-outline' : 'arrow-down-outline'}
                          size={14}
                          color={BRAND.burgundy}
                        />
                        <Text style={styles.ledgerSortBtnText}>
                          {ledgerSortAsc ? 'Oldest First' : 'Newest First'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Chronological Table Header */}
                    <View style={styles.ledgerTableHeader}>
                      <Text style={[styles.ledgerTh, { flex: 2 }]}>Date & Time</Text>
                      <Text style={[styles.ledgerTh, { flex: 4 }]}>Voucher & Transaction Details</Text>
                      <Text style={[styles.ledgerTh, { flex: 2, textAlign: 'right' }]}>Billed (Dr)</Text>
                      <Text style={[styles.ledgerTh, { flex: 2, textAlign: 'right' }]}>Paid (Cr)</Text>
                      <Text style={[styles.ledgerTh, { flex: 2.2, textAlign: 'right' }]}>Running Balance</Text>
                      <Text style={[styles.ledgerTh, { flex: 1.5, textAlign: 'center' }]}>Action</Text>
                    </View>

                    {/* Chronological Statement Rows */}
                    {displayedEntries.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Ionicons name="newspaper-outline" size={40} color={BRAND.muted} style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyStateTitle}>No Ledger Entries</Text>
                        <Text style={styles.emptyStateSub}>No matching bills or payments found for this vendor.</Text>
                      </View>
                    ) : (
                      displayedEntries.map((entry) => {
                        const isBill = entry.type === 'bill';
                        const isPay = entry.type === 'payment';

                        return (
                          <View key={entry.id} style={styles.ledgerTableRow}>
                            {/* Date */}
                            <View style={{ flex: 2 }}>
                              <Text style={styles.ledgerRowDate}>
                                {new Date(entry.date).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                              <Text style={styles.ledgerRowTime}>
                                {new Date(entry.date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>

                            {/* Voucher & Description */}
                            <View style={{ flex: 4, paddingRight: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View
                                  style={[
                                    styles.ledgerTypeBadge,
                                    { backgroundColor: isBill ? '#F5EBE6' : '#E8F5E9' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.ledgerTypeBadgeText,
                                      { color: isBill ? BRAND.burgundy : BRAND.success },
                                    ]}
                                  >
                                    {isBill ? 'BILL' : 'PAID'}
                                  </Text>
                                </View>
                                <Text style={styles.ledgerDocNo}>{entry.docNumber}</Text>
                                {entry.invoiceNo ? (
                                  <Text style={styles.ledgerInvNo}>(Inv: {entry.invoiceNo})</Text>
                                ) : null}
                              </View>
                              <Text style={styles.ledgerRowSubtitle} numberOfLines={2}>
                                {entry.subtitle}
                              </Text>
                            </View>

                            {/* Billed (Debit) */}
                            <View style={{ flex: 2, alignItems: 'flex-end' }}>
                              {entry.debit > 0 ? (
                                <Text style={[styles.ledgerAmountVal, { color: BRAND.burgundy }]}>
                                  + Rs. {entry.debit.toLocaleString()}
                                </Text>
                              ) : (
                                <Text style={styles.ledgerAmountDash}>-</Text>
                              )}
                            </View>

                            {/* Paid (Credit) */}
                            <View style={{ flex: 2, alignItems: 'flex-end' }}>
                              {entry.credit > 0 ? (
                                <Text style={[styles.ledgerAmountVal, { color: BRAND.success }]}>
                                  - Rs. {entry.credit.toLocaleString()}
                                </Text>
                              ) : (
                                <Text style={styles.ledgerAmountDash}>-</Text>
                              )}
                            </View>

                            {/* Running Balance */}
                            <View style={{ flex: 2.2, alignItems: 'flex-end' }}>
                              <Text style={styles.ledgerRunBalVal}>
                                Rs. {entry.runningBalance.toLocaleString()}
                              </Text>
                              <Text
                                style={[
                                  styles.ledgerRunBalStatus,
                                  { color: entry.runningBalance > 0 ? BRAND.danger : BRAND.success },
                                ]}
                              >
                                {entry.runningBalance > 0 ? 'Payable Due' : 'Settled'}
                              </Text>
                            </View>

                            {/* Action Button */}
                            <View style={{ flex: 1.5, alignItems: 'center' }}>
                              {isBill && entry.po && (
                                <TouchableOpacity
                                  style={styles.ledgerRowBtn}
                                  onPress={() => handleOpenPODetails(entry.po!)}
                                >
                                  <Text style={styles.ledgerRowBtnText}>Bill Slip</Text>
                                </TouchableOpacity>
                              )}
                              {isPay && entry.payment && (
                                <TouchableOpacity
                                  style={[styles.ledgerRowBtn, { borderColor: '#A5D6A7' }]}
                                  onPress={() => handleOpenVoucherModal(entry.payment!)}
                                >
                                  <Text style={[styles.ledgerRowBtnText, { color: BRAND.success }]}>
                                    Voucher
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => handleShareLedger(currentSup, allLedgerEntries)}
                    >
                      <Ionicons name="logo-whatsapp" size={15} color="#2E7D32" style={{ marginRight: 6 }} />
                      <Text style={[styles.secondaryBtnText, { color: '#2E7D32' }]}>Send Statement</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: BRAND.danger }]}
                      onPress={() => {
                        setIsLedgerModalOpen(false);
                        handleOpenPaymentModal(currentSup);
                      }}
                    >
                      <Ionicons name="cash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>
                        Pay Dues (Rs. {currentDue.toLocaleString()})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsLedgerModalOpen(false)}>
                      <Text style={styles.primaryBtnText}>Close Statement</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: OFFICIAL PAYMENT VOUCHER SLIP MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isVoucherModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: isMobile ? '95%' : 540, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Official Payment Settlement Voucher</Text>
                <Text style={styles.modalSub}>Sultan Restaurant Accounts Disbursement Record</Text>
              </View>
              <TouchableOpacity onPress={() => setIsVoucherModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            {selectedPaymentForVoucher && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Official Voucher Card */}
                <View style={styles.voucherContainer}>
                  {/* Voucher Header Banner */}
                  <View style={styles.voucherHeaderBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="restaurant" size={20} color={BRAND.burgundy} />
                      <Text style={styles.voucherBrandTitle}>SULTAN RESTAURANT & BBQ</Text>
                    </View>
                    <Text style={styles.voucherBrandSub}>Procurement & Vendor Payment Settlement</Text>
                    <View style={styles.voucherNoPill}>
                      <Text style={styles.voucherNoText}>
                        VOUCHER #{selectedPaymentForVoucher.id.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Main Amount Callout */}
                  <View style={styles.voucherAmountBox}>
                    <Text style={styles.voucherAmountLabel}>AMOUNT PAID / SETTLED</Text>
                    <Text style={styles.voucherAmountNumber}>
                      Rs. {selectedPaymentForVoucher.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.voucherMethodText}>
                      via {selectedPaymentForVoucher.method.toUpperCase()}
                      {selectedPaymentForVoucher.reference ? ` (${selectedPaymentForVoucher.reference})` : ''}
                    </Text>
                  </View>

                  {/* Voucher Key-Value Details Table */}
                  <View style={styles.voucherTable}>
                    <View style={styles.voucherRow}>
                      <Text style={styles.voucherKey}>Vendor / Payee:</Text>
                      <Text style={styles.voucherValBold}>{selectedPaymentForVoucher.supplierName}</Text>
                    </View>

                    <View style={styles.voucherRow}>
                      <Text style={styles.voucherKey}>Disbursement Date:</Text>
                      <Text style={styles.voucherVal}>
                        {new Date(selectedPaymentForVoucher.paidAt).toLocaleString([], {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </Text>
                    </View>

                    {selectedPaymentForVoucher.bankName ? (
                      <View style={styles.voucherRow}>
                        <Text style={styles.voucherKey}>Bank Name:</Text>
                        <Text style={styles.voucherVal}>{selectedPaymentForVoucher.bankName}</Text>
                      </View>
                    ) : null}

                    {selectedPaymentForVoucher.sourceAccount ? (
                      <View style={styles.voucherRow}>
                        <Text style={styles.voucherKey}>Source Drawer / A/C:</Text>
                        <Text style={styles.voucherVal}>{selectedPaymentForVoucher.sourceAccount}</Text>
                      </View>
                    ) : null}

                    {selectedPaymentForVoucher.chequeNumber ? (
                      <View style={styles.voucherRow}>
                        <Text style={styles.voucherKey}>Cheque Number:</Text>
                        <Text style={styles.voucherVal}>
                          {selectedPaymentForVoucher.chequeNumber}
                          {selectedPaymentForVoucher.chequeDate
                            ? ` (Due: ${selectedPaymentForVoucher.chequeDate})`
                            : ''}
                        </Text>
                      </View>
                    ) : null}

                    {selectedPaymentForVoucher.purchaseOrderId ? (
                      <View style={styles.voucherRow}>
                        <Text style={styles.voucherKey}>Allocated PO #:</Text>
                        <Text style={styles.voucherVal}>{selectedPaymentForVoucher.purchaseOrderId}</Text>
                      </View>
                    ) : null}

                    <View style={styles.voucherRow}>
                      <Text style={styles.voucherKey}>Disbursed By:</Text>
                      <Text style={styles.voucherVal}>{selectedPaymentForVoucher.paidBy || 'Admin'}</Text>
                    </View>

                    {selectedPaymentForVoucher.receivedByContact ? (
                      <View style={styles.voucherRow}>
                        <Text style={styles.voucherKey}>Received By:</Text>
                        <Text style={styles.voucherVal}>{selectedPaymentForVoucher.receivedByContact}</Text>
                      </View>
                    ) : null}

                    {selectedPaymentForVoucher.notes ? (
                      <View style={[styles.voucherRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.voucherKey}>Narration / Notes:</Text>
                        <Text style={[styles.voucherVal, { fontStyle: 'italic' }]}>
                          {selectedPaymentForVoucher.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Signatures Row */}
                  <View style={styles.voucherSignaturesRow}>
                    <View style={styles.signatureBox}>
                      <View style={styles.signLine} />
                      <Text style={styles.signLabel}>Accountant / Disbursed By</Text>
                    </View>

                    <View style={styles.signatureBox}>
                      <View style={styles.signLine} />
                      <Text style={styles.signLabel}>Vendor / Received By</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  if (selectedPaymentForVoucher) handleSharePaymentVoucher(selectedPaymentForVoucher);
                }}
              >
                <Ionicons name="copy-outline" size={15} color={BRAND.burgundy} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryBtnText}>Copy Voucher Text</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsVoucherModalOpen(false)}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* MODAL 6: PURCHASE ORDER / INVOICE ITEM BREAKDOWN */}
      {/* ---------------------------------------------------- */}
      <Modal visible={isPODetailsModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: isMobile ? '95%' : 640, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Purchase Bill & Goods Delivery</Text>
                <Text style={styles.modalSub}>{selectedPOForDetails?.poNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPODetailsModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            {selectedPOForDetails && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.poSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Supplier / Vendor:</Text>
                    <Text style={styles.summaryVal}>{selectedPOForDetails.supplierName}</Text>
                  </View>
                  {selectedPOForDetails.invoiceNo && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Vendor Bill / Invoice #:</Text>
                      <Text style={styles.summaryVal}>{selectedPOForDetails.invoiceNo}</Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Order Date:</Text>
                    <Text style={styles.summaryVal}>
                      {new Date(selectedPOForDetails.orderDate).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery Status:</Text>
                    <Text style={[styles.summaryVal, { color: BRAND.success, fontWeight: '800' }]}>
                      {selectedPOForDetails.status.toUpperCase()} (by {selectedPOForDetails.receivedBy || 'Admin'})
                    </Text>
                  </View>
                </View>

                {/* Items table */}
                <Text style={[styles.formSectionTitle, { marginTop: 12 }]}>Procured Ingredients & Items</Text>
                <View style={styles.poItemsTable}>
                  <View style={styles.poTableHeader}>
                    <Text style={[styles.poTh, { flex: 3 }]}>Item Name</Text>
                    <Text style={[styles.poTh, { flex: 1.5, textAlign: 'center' }]}>Qty Recv</Text>
                    <Text style={[styles.poTh, { flex: 1.5, textAlign: 'right' }]}>Unit Rate</Text>
                    <Text style={[styles.poTh, { flex: 2, textAlign: 'right' }]}>Total Cost</Text>
                  </View>
                  {selectedPOForDetails.items.map((it, idx) => (
                    <View key={idx} style={styles.poTableRow}>
                      <Text style={[styles.poTd, { flex: 3, fontWeight: '700' }]}>{it.name}</Text>
                      <Text style={[styles.poTd, { flex: 1.5, textAlign: 'center' }]}>
                        {it.qtyReceived || it.qtyOrdered} {it.unit}
                      </Text>
                      <Text style={[styles.poTd, { flex: 1.5, textAlign: 'right' }]}>
                        Rs. {it.unitCost.toLocaleString()}
                      </Text>
                      <Text style={[styles.poTd, { flex: 2, textAlign: 'right', fontWeight: '800' }]}>
                        Rs. {it.totalCost.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Bill Totals breakdown */}
                <View style={styles.poSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryVal}>Rs. {selectedPOForDetails.subtotal.toLocaleString()}</Text>
                  </View>
                  {selectedPOForDetails.discount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Discount Received:</Text>
                      <Text style={[styles.summaryVal, { color: BRAND.success }]}>
                        - Rs. {selectedPOForDetails.discount.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {selectedPOForDetails.freight > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Freight / Cartage:</Text>
                      <Text style={styles.summaryVal}>+ Rs. {selectedPOForDetails.freight.toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#EFE8DC', paddingTop: 6 }]}>
                    <Text style={[styles.summaryLabel, { fontWeight: '800', color: BRAND.ink }]}>
                      Total Bill Amount:
                    </Text>
                    <Text style={[styles.summaryVal, { fontSize: 16, fontWeight: '900', color: BRAND.burgundy }]}>
                      Rs. {selectedPOForDetails.totalAmount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount Paid (Advance/Receipt):</Text>
                    <Text style={[styles.summaryVal, { color: BRAND.success, fontWeight: '800' }]}>
                      Rs. {selectedPOForDetails.amountPaid.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Remaining Due on this PO:</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        {
                          color: selectedPOForDetails.balanceDue > 0 ? BRAND.danger : BRAND.success,
                          fontWeight: '800',
                        },
                      ]}
                    >
                      Rs. {selectedPOForDetails.balanceDue.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              {selectedPOForDetails && selectedPOForDetails.balanceDue > 0 && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: BRAND.danger }]}
                  onPress={() => {
                    const sup = suppliers.find((s) => s.id === selectedPOForDetails.supplierId);
                    setIsPODetailsModalOpen(false);
                    if (sup) handleOpenPaymentModal(sup, selectedPOForDetails);
                  }}
                >
                  <Ionicons name="cash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>
                    Pay PO Due (Rs. {selectedPOForDetails.balanceDue.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsPODetailsModalOpen(false)}>
                <Text style={styles.primaryBtnText}>Close Bill Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------
// Styles
// ----------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    flexWrap: 'wrap',
    gap: 12,
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
    backgroundColor: '#F5EBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.burgundy,
    letterSpacing: 0.3,
  },
  badgePill: {
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
    fontWeight: '700',
    fontSize: 12,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
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
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 2,
  },
  kpiMeta: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#F5EBE6',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.muted,
  },
  tabBtnTextActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  filterSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND.ink,
  },
  balanceFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: '700',
  },
  balancePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  balancePillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  balancePillTextActive: {
    color: '#FFFFFF',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  suppliersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  supplierCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  contactPerson: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  commBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  commBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsSection: {
    marginVertical: 8,
  },
  sectionMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  itemChip: {
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  itemChipText: {
    fontSize: 11,
    color: BRAND.ink,
    fontWeight: '600',
  },
  noItemsText: {
    fontSize: 11,
    color: BRAND.muted,
    fontStyle: 'italic',
  },
  financialBox: {
    flexDirection: 'row',
    backgroundColor: '#FDFBF7',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    alignItems: 'center',
  },
  finStat: {
    flex: 1,
    alignItems: 'center',
  },
  finDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#EFE8DC',
  },
  finLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  finValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 2,
  },
  bankBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 6,
    borderRadius: 4,
    marginBottom: 10,
  },
  bankText: {
    fontSize: 11,
    color: BRAND.muted,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
    gap: 6,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  emptyState: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  emptyStateSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 320,
  },
  ordersSection: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.ink,
  },
  sectionSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  poCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  poCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  poNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  poInvoiceNo: {
    fontSize: 12,
    color: BRAND.muted,
  },
  poStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  poStatusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  poSupplierName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 2,
  },
  poMetaText: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  poTotalLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  poTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: BRAND.ink,
  },
  poDueWarning: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.danger,
    marginTop: 2,
  },
  poPaidStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.success,
    marginTop: 2,
  },
  poItemsTable: {
    backgroundColor: '#FBFBFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    padding: 8,
    marginBottom: 10,
  },
  poTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
    paddingBottom: 4,
    marginBottom: 4,
  },
  poTh: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  poTableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  poTd: {
    fontSize: 11,
    color: BRAND.ink,
  },
  poActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentsSection: {
    width: '100%',
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 10,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F5EBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSupplierName: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
  },
  paymentMeta: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  paymentNote: {
    fontSize: 11,
    color: BRAND.goldDark,
    marginTop: 2,
    fontStyle: 'italic',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.success,
  },
  paidByTag: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSub: {
    fontSize: 12,
    color: BRAND.muted,
  },
  modalBody: {
    padding: 20,
    maxHeight: 520,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FBFBFC',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: BRAND.ink,
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    textAlign: 'right',
  },
  inputHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 4,
  },
  catChoicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginRight: 6,
  },
  catChoicePillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  catChoicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  catChoicePillTextActive: {
    color: '#FFFFFF',
  },
  formSectionBox: {
    backgroundColor: '#FDFBF7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 12,
  },
  formSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  supChoicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    marginRight: 6,
  },
  supChoicePillActive: {
    backgroundColor: BRAND.burgundy,
  },
  supChoicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  supChoicePillTextActive: {
    color: '#FFFFFF',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EBE6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  addSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  poItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  poSummaryBox: {
    backgroundColor: '#FDFBF7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  togglesBox: {
    marginTop: 12,
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 12,
    color: BRAND.ink,
    fontWeight: '600',
    flex: 1,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  methodPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  methodPillTextActive: {
    color: '#FFFFFF',
  },
  ledgerHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBF7',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 16,
  },
  ledgerMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  ledgerDueAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  ledgerLifetimeAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 2,
  },
  ledgerSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ledgerPoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ledgerPayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  // Payment KPIs & cards
  paymentKpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  paymentKpiCard: {
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
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentCardFull: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  payIconWrapLarge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSupplierNameLarge: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.ink,
  },
  payMethodTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  payMethodTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  paymentVoucherId: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  paymentAmountLarge: {
    fontSize: 17,
    fontWeight: '900',
    color: BRAND.success,
  },
  payDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#FBFBFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    marginVertical: 8,
  },
  payDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  payDetailText: {
    fontSize: 11,
    color: BRAND.ink,
  },
  paymentNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  paymentNoteText: {
    fontSize: 11,
    color: '#F57F17',
    fontStyle: 'italic',
    flex: 1,
  },
  paymentCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  payActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  payActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },

  // Payment Modal Banner & Quick Fill
  paymentSupBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDFBF7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 12,
  },
  paymentSupBannerName: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  paymentSupBannerMeta: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  paymentSupBannerDueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  paymentSupBannerDueVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  inputHintBold: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  quickFillPill: {
    backgroundColor: '#F5EBE6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EBDAD1',
  },
  quickFillPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  poAllocPill: {
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  poAllocPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  poAllocPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  poAllocPillTextActive: {
    color: '#FFFFFF',
  },

  // Ledger Strip & Header
  ledgerSupplierStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDFBF7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 12,
    gap: 8,
  },
  ledgerSupAddress: {
    fontSize: 12,
    color: BRAND.ink,
    fontWeight: '600',
  },
  ledgerBankCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ledgerBankCopyText: {
    fontSize: 11,
    color: BRAND.goldDark,
    fontWeight: '700',
  },
  ledgerActionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ledgerActionBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  ledgerKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  ledgerKpiBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderLeftWidth: 4,
  },
  ledgerKpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  ledgerKpiVal: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  ledgerKpiSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },

  // Ledger Toolbar
  ledgerToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  ledgerFilterTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  ledgerTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  ledgerTabPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  ledgerTabPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  ledgerTabPillTextActive: {
    color: '#FFFFFF',
  },
  ledgerSearchBox: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 34,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  ledgerSearchInput: {
    flex: 1,
    fontSize: 12,
    color: BRAND.ink,
  },
  ledgerSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  ledgerSortBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },

  // Ledger Table
  ledgerTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5EBE6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  ledgerTh: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.burgundy,
    textTransform: 'uppercase',
  },
  ledgerTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  ledgerRowDate: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  ledgerRowTime: {
    fontSize: 10,
    color: BRAND.muted,
  },
  ledgerTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ledgerTypeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  ledgerDocNo: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
  },
  ledgerInvNo: {
    fontSize: 11,
    color: BRAND.muted,
  },
  ledgerRowSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  ledgerAmountVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  ledgerAmountDash: {
    fontSize: 12,
    color: BRAND.muted,
  },
  ledgerRunBalVal: {
    fontSize: 12,
    fontWeight: '900',
    color: BRAND.ink,
  },
  ledgerRunBalStatus: {
    fontSize: 9,
    fontWeight: '800',
  },
  ledgerRowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#FAFAFA',
  },
  ledgerRowBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.burgundy,
  },

  // Voucher Modal Card
  voucherContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BRAND.goldDark,
    borderRadius: 10,
    padding: 16,
  },
  voucherHeaderBox: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8DC',
    paddingBottom: 12,
    marginBottom: 12,
  },
  voucherBrandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: BRAND.burgundy,
    letterSpacing: 0.5,
  },
  voucherBrandSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  voucherNoPill: {
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
  },
  voucherNoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  voucherAmountBox: {
    alignItems: 'center',
    backgroundColor: '#FDFBF7',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE8DC',
    marginBottom: 12,
  },
  voucherAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.muted,
    letterSpacing: 0.5,
  },
  voucherAmountNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: BRAND.success,
    marginVertical: 4,
  },
  voucherMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  voucherTable: {
    borderWidth: 1,
    borderColor: '#ECEFF1',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#FAFAFA',
  },
  voucherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  voucherKey: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    flex: 1,
  },
  voucherValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
    flex: 2,
    textAlign: 'right',
  },
  voucherVal: {
    fontSize: 11,
    color: BRAND.ink,
    flex: 2,
    textAlign: 'right',
  },
  voucherSignaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingTop: 8,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
  },
  signLine: {
    width: '100%',
    height: 1,
    backgroundColor: BRAND.ink,
    marginBottom: 4,
  },
  signLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
  },
});
