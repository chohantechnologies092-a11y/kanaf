import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

/**
 * Operations store: business features that sit next to `restaurantStore`
 * (guest service requests, real inventory, expenses, sold-out list, feedback).
 * Kept in its own file so both developers can work without merge conflicts.
 * It is synced across devices through the same LAN hub (see OPS_SYNC_KEYS).
 */

// ---------- Types ----------

export type ServiceRequestType = 'call_waiter' | 'bill' | 'water' | 'cleaning' | 'complaint' | 'other';
export type ServiceRequestStatus = 'pending' | 'acknowledged' | 'resolved';

export type ServiceRequest = {
  id: string;
  tableId: string;
  tableName: string;
  zone: string;
  type: ServiceRequestType;
  note?: string;
  status: ServiceRequestStatus;
  source: 'guest' | 'staff';
  createdAt: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
};

export type InventoryItem = {
  id: string;
  itemCode?: string;
  barcode?: string;
  name: string;
  urduName?: string;
  category: string;
  unit: string;
  stock: number;
  /** Reorder level - at or below this the item is "low". */
  threshold: number;
  costPerUnit?: number;
  supplier?: string;
  supplierPhone?: string;
  location?: string;
  batchNumber?: string;
  expiryDate?: number;
  receivedDate?: number;
  invoiceNo?: string;
  notes?: string;
  updatedAt: number;
};

export type StockMovementType = 'receive' | 'usage' | 'wastage' | 'adjust';

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  type: StockMovementType;
  /** Absolute quantity entered by the user. */
  qty: number;
  /** Signed change applied to stock. */
  delta: number;
  note?: string;
  by?: string;
  at: number;
  supplier?: string;
  invoiceNo?: string;
  batchNumber?: string;
  unitCost?: number;
  expiryDate?: number;
};

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'fresh' | 'none';

export function getExpiryStatus(item: InventoryItem): {
  status: ExpiryStatus;
  daysRemaining?: number;
  label: string;
  color: string;
  bgColor: string;
} {
  if (!item.expiryDate) {
    return { status: 'none', label: 'No Expiry Set', color: '#64748B', bgColor: '#F1F5F9' };
  }
  const now = Date.now();
  const diffDays = Math.ceil((item.expiryDate - now) / 86400000);

  if (diffDays <= 0) {
    return {
      status: 'expired',
      daysRemaining: diffDays,
      label: diffDays === 0 ? 'Expires Today!' : `Expired ${Math.abs(diffDays)}d ago`,
      color: '#DC2626',
      bgColor: '#FEE2E2',
    };
  }
  if (diffDays <= 3) {
    return {
      status: 'critical',
      daysRemaining: diffDays,
      label: `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}!`,
      color: '#EA580C',
      bgColor: '#FFEDD5',
    };
  }
  if (diffDays <= 7) {
    return {
      status: 'warning',
      daysRemaining: diffDays,
      label: `${diffDays} days left`,
      color: '#D97706',
      bgColor: '#FEF3C7',
    };
  }
  return {
    status: 'fresh',
    daysRemaining: diffDays,
    label: `${diffDays} days fresh`,
    color: '#16A34A',
    bgColor: '#DCFCE7',
  };
}

export const STORAGE_LOCATIONS = [
  'Walk-in Chiller',
  'Deep Freezer #1 (Meat)',
  'Deep Freezer #2 (Poultry)',
  'Dry Ration Store - Shelf A',
  'Dry Ration Store - Shelf B',
  'Spice & Masala Rack',
  'Beverage Cold Room',
  'Cooking Line / Kitchen',
  'Packaging Store',
] as const;

export type ExpenseMethod = 'cash' | 'online';

export type Expense = {
  id: string;
  category: string;
  amount: number;
  note?: string;
  method: ExpenseMethod;
  paidBy?: string;
  at: number;
};

export type GuestFeedback = {
  id: string;
  rating: number; // 1-5
  comment?: string;
  tableName?: string;
  zone?: string;
  at: number;
};

export const SERVICE_REQUEST_META: Record<
  ServiceRequestType,
  { label: string; icon: string; color: string }
> = {
  call_waiter: { label: 'Call Waiter', icon: 'hand-left-outline', color: '#1976D2' },
  bill: { label: 'Request Bill', icon: 'receipt-outline', color: '#2E7D32' },
  water: { label: 'Water / Refill', icon: 'water-outline', color: '#0097A7' },
  cleaning: { label: 'Clean Table', icon: 'sparkles-outline', color: '#6A1B9A' },
  complaint: { label: 'Complaint', icon: 'alert-circle-outline', color: '#D32F2F' },
  other: { label: 'Other', icon: 'chatbubble-ellipses-outline', color: '#546E7A' },
};

export const EXPENSE_CATEGORIES = [
  'Groceries & Produce',
  'Meat & Poultry',
  'Dairy & Bakery',
  'Gas / LPG / Charcoal',
  'Electricity & Utilities',
  'Staff Salary / Advance',
  'Rent',
  'Maintenance & Repair',
  'Packaging & Supplies',
  'Marketing',
  'Other',
] as const;

export const INVENTORY_CATEGORIES = [
  'Meat',
  'Produce',
  'Grains',
  'Dairy',
  'Pantry',
  'Beverages',
  'Fuel',
  'Packaging',
  'Supplies',
] as const;

// ---------- Helpers ----------

let seq = 0;
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const MAX_REQUESTS = 200;
const MAX_MOVEMENTS = 400;
const MAX_FEEDBACK = 300;

export const isActiveRequest = (r: ServiceRequest) => r.status !== 'resolved';

export type StockLevel = 'ok' | 'low' | 'critical' | 'out';

export function getStockLevel(item: InventoryItem): StockLevel {
  if (item.stock <= 0) return 'out';
  if (item.stock <= item.threshold * 0.5) return 'critical';
  if (item.stock <= item.threshold) return 'low';
  return 'ok';
}

// ---------- Seed data ----------

const seedItem = (
  id: string,
  itemCode: string,
  name: string,
  urduName: string,
  category: string,
  unit: string,
  stock: number,
  threshold: number,
  costPerUnit: number,
  supplier: string,
  supplierPhone: string,
  location: string,
  batchNumber: string,
  expiryOffsetDays?: number,
  invoiceNo?: string
): InventoryItem => ({
  id,
  itemCode,
  name,
  urduName,
  category,
  unit,
  stock,
  threshold,
  costPerUnit,
  supplier,
  supplierPhone,
  location,
  batchNumber,
  expiryDate: expiryOffsetDays !== undefined ? Date.now() + expiryOffsetDays * 86400000 : undefined,
  receivedDate: Date.now() - 3 * 86400000,
  invoiceNo: invoiceNo || `INV-${id.toUpperCase()}-01`,
  updatedAt: Date.now() - 86400000,
});

export const INITIAL_INVENTORY: InventoryItem[] = [
  seedItem('inv1', 'SKU-MT-001', 'Chicken (Boneless)', 'چکن بون لیس', 'Meat', 'kg', 15, 20, 780, 'Al-Madina Fresh Poultry Ltd', '+92 300 4567891', 'Deep Freezer #2 (Poultry)', 'B-26-CHK-081', 3, 'AMP-8821'),
  seedItem('inv2', 'SKU-MT-002', 'Mutton (Mix Cut)', 'مٹن مکس بوٹی', 'Meat', 'kg', 35, 15, 2200, 'Hazrat Bilal Meat & Beef Center', '+92 321 8765432', 'Deep Freezer #1 (Meat)', 'B-26-MUT-044', 12, 'HBM-5501'),
  seedItem('inv3', 'SKU-GR-001', 'Basmati Rice (Kainat)', 'باسمتی چاول کائنات', 'Grains', 'kg', 50, 15, 360, 'National Spices & Grains Mart', '+92 345 9988776', 'Dry Ration Store - Shelf A', 'B-26-RIC-012', 180, 'NSG-4412'),
  seedItem('inv4', 'SKU-GR-002', 'Wheat Flour (Fine Atta)', 'فائن آٹا / میدہ', 'Grains', 'kg', 40, 20, 150, 'National Spices & Grains Mart', '+92 345 9988776', 'Dry Ration Store - Shelf A', 'B-26-FLR-009', 90, 'NSG-4412'),
  seedItem('inv5', 'SKU-PT-001', 'Cooking Oil (Canola 16L)', 'کوکنگ آئل کنولا', 'Pantry', 'Liters', 45, 15, 520, 'National Spices & Grains Mart', '+92 345 9988776', 'Dry Ration Store - Shelf B', 'B-26-OIL-091', 120, 'NSG-4412'),
  seedItem('inv6', 'SKU-DY-001', 'Yogurt (Fresh Dahi)', 'تازہ دہی', 'Dairy', 'kg', 12, 10, 240, 'Punjab Pure Dairy & Khoya Farm', '+92 302 9876543', 'Walk-in Chiller', 'B-26-YOG-015', 2, 'PPD-1022'),
  seedItem('inv7', 'SKU-PR-001', 'Onions (Piaz)', 'پیاز دیسی', 'Produce', 'kg', 30, 15, 120, 'Sindh Green Fresh Produce Wholesale', '+92 333 5551234', 'Dry Ration Store - Shelf B', 'B-26-ONN-032', 8, 'SGP-9011'),
  seedItem('inv8', 'SKU-PR-002', 'Tomatoes (Tamatar)', 'ٹماٹر فارمی', 'Produce', 'kg', 18, 12, 150, 'Sindh Green Fresh Produce Wholesale', '+92 333 5551234', 'Walk-in Chiller', 'B-26-TOM-088', 4, 'SGP-9011'),
  seedItem('inv9', 'SKU-PR-003', 'Mint & Coriander Leaves', 'پودینہ و دھنیا', 'Produce', 'kg', 1.5, 5, 400, 'Sindh Green Fresh Produce Wholesale', '+92 333 5551234', 'Walk-in Chiller', 'B-26-MNT-003', -1, 'SGP-8977'),
  seedItem('inv10', 'SKU-BV-001', 'Pepsi 1L Bottled', 'پیپسی ایک لیٹر', 'Beverages', 'bottles', 12, 24, 150, 'Gourmet Beverages & Mineral Water', '+92 300 1234567', 'Beverage Cold Room', 'B-26-PEP-210', 60, 'GBM-3320'),
  seedItem('inv11', 'SKU-BV-002', 'Mineral Water 500ml', 'منرل واٹر', 'Beverages', 'bottles', 60, 48, 55, 'Gourmet Beverages & Mineral Water', '+92 300 1234567', 'Beverage Cold Room', 'B-26-WAT-110', 90, 'GBM-3320'),
  seedItem('inv12', 'SKU-FL-001', 'Commercial LPG Cylinder (45kg)', 'کمرشل گیس سلنڈر', 'Fuel', 'cylinders', 3, 2, 11000, 'Al-Rehman LPG & Charcoal Agency', '+92 322 1199887', 'Cooking Line / Kitchen', 'B-26-LPG-004', undefined, 'ARL-7712'),
  seedItem('inv13', 'SKU-FL-002', 'Charcoal BBQ (Hardwood)', 'کوئلہ باربی کیو', 'Fuel', 'kg', 80, 50, 90, 'Al-Rehman LPG & Charcoal Agency', '+92 322 1199887', 'Dry Ration Store - Shelf B', 'B-26-CHR-055', undefined, 'ARL-7712'),
  seedItem('inv14', 'SKU-SP-001', 'Tissue & Cutlery Packs', 'ٹشو اور کٹلری', 'Supplies', 'packs', 20, 15, 180, 'Modern Pack & Eco Disposables', '+92 301 7766554', 'Packaging Store', 'B-26-TIS-022', undefined, 'MPE-1230'),
  seedItem('inv15', 'SKU-PK-001', 'Sultan Takeaway Boxes (Embossed)', 'سلطان باکسز', 'Packaging', 'pcs', 150, 200, 25, 'Modern Pack & Eco Disposables', '+92 301 7766554', 'Packaging Store', 'B-26-BOX-101', undefined, 'MPE-1230'),
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mv-01',
    itemId: 'inv1',
    itemName: 'Chicken (Boneless)',
    itemCode: 'SKU-MT-001',
    type: 'receive',
    qty: 30,
    delta: 30,
    note: 'Inward receiving from Al-Madina Fresh Poultry Ltd',
    supplier: 'Al-Madina Fresh Poultry Ltd',
    invoiceNo: 'AMP-8821',
    batchNumber: 'B-26-CHK-081',
    unitCost: 780,
    expiryDate: Date.now() + 3 * 86400000,
    by: 'Chef Omar',
    at: Date.now() - 2 * 86400000,
  },
  {
    id: 'mv-02',
    itemId: 'inv3',
    itemName: 'Basmati Rice (Kainat)',
    itemCode: 'SKU-GR-001',
    type: 'receive',
    qty: 100,
    delta: 100,
    note: 'PO #PO-2026-082 delivery verified',
    supplier: 'National Spices & Grains Mart',
    invoiceNo: 'NSG-4412',
    batchNumber: 'B-26-RIC-012',
    unitCost: 360,
    by: 'Manager Ali',
    at: Date.now() - 4 * 86400000,
  },
  {
    id: 'mv-03',
    itemId: 'inv1',
    itemName: 'Chicken (Boneless)',
    itemCode: 'SKU-MT-001',
    type: 'usage',
    qty: 15,
    delta: -15,
    note: 'Kitchen prep issue for Handi & Tikka line',
    by: 'Chef Asghar',
    at: Date.now() - 1 * 86400000,
  },
  {
    id: 'mv-04',
    itemId: 'inv9',
    itemName: 'Mint & Coriander Leaves',
    itemCode: 'SKU-PR-003',
    type: 'wastage',
    qty: 1,
    delta: -1,
    note: 'Discarded wilted stock past shelf life',
    by: 'Kitchen Supervisor',
    at: Date.now() - 12 * 3600000,
  },
];

export type SupplierCategory =
  | 'Meat & Poultry'
  | 'Fresh Produce'
  | 'Dairy & Bakery'
  | 'Grains & Dry Ration'
  | 'Beverages & Drinks'
  | 'Fuel & Charcoal'
  | 'Packaging & Disposables'
  | 'Cleaning & Kitchen Supplies'
  | 'Equipment & Maintenance'
  | 'Other';

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  'Meat & Poultry',
  'Fresh Produce',
  'Dairy & Bakery',
  'Grains & Dry Ration',
  'Beverages & Drinks',
  'Fuel & Charcoal',
  'Packaging & Disposables',
  'Cleaning & Kitchen Supplies',
  'Equipment & Maintenance',
  'Other',
];

export type Supplier = {
  id: string;
  name: string;
  category: SupplierCategory;
  contactPerson: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  paymentTerms: string; // 'Cash on Delivery' | 'Credit 7 Days' | 'Credit 15 Days' | 'Credit 30 Days' | 'Advance'
  bankDetails?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string;
  };
  suppliedItems: string[];
  currentBalance: number; // pending payable amount
  totalPurchases: number;
  rating: number; // 1-5
  status: 'active' | 'inactive' | 'hold';
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type PurchaseOrderItem = {
  itemId?: string;
  name: string;
  category: string;
  unit: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
  totalCost: number;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceNo?: string;
  orderDate: number;
  deliveryDate?: number;
  status: 'ordered' | 'received' | 'partial' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  items: PurchaseOrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  freight: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: 'cash' | 'online' | 'cheque' | 'credit';
  receivedBy?: string;
  notes?: string;
  createdAt: number;
};

export type SupplierPayment = {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  amount: number;
  method: 'cash' | 'online' | 'cheque';
  reference?: string;
  notes?: string;
  paidBy?: string;
  paidAt: number;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: string;
  receivedByContact?: string;
  sourceAccount?: string;
};

// ---------- Store ----------

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Al-Madina Fresh Poultry Ltd',
    category: 'Meat & Poultry',
    contactPerson: 'Haji Muhammad Rafiq',
    phone: '+92 300 4567891',
    whatsapp: '+92 300 4567891',
    email: 'madinapoultry.lhr@gmail.com',
    address: 'Shop #14, Tollinton Poultry Market, Jail Road',
    city: 'Lahore',
    paymentTerms: 'Credit 7 Days',
    bankDetails: {
      bankName: 'Meezan Bank',
      accountTitle: 'Al-Madina Poultry Traders',
      accountNumber: '0101-0102938475',
      iban: 'PK45MEZN0001010102938475'
    },
    suppliedItems: ['Chicken (Boneless)', 'Chicken Whole (Skinless)', 'Chicken Wings & Drumsticks', 'Chicken Broiler'],
    currentBalance: 24500,
    totalPurchases: 680000,
    rating: 5,
    status: 'active',
    notes: 'Daily fresh delivery at 8:00 AM. 100% Halal Certified hand-slaughtered.',
    createdAt: Date.now() - 60 * 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sup-2',
    name: 'Hazrat Bilal Meat & Beef Center',
    category: 'Meat & Poultry',
    contactPerson: 'Ch. Bilal Hussain',
    phone: '+92 321 8765432',
    whatsapp: '+92 321 8765432',
    email: 'bilalmeat.lahore@gmail.com',
    address: 'Bakra Mandi Gate #2, Shahpur Kanjran, Multan Road',
    city: 'Lahore',
    paymentTerms: 'Cash on Delivery',
    bankDetails: {
      bankName: 'Bank Alfalah',
      accountTitle: 'Hazrat Bilal Meat Supplies',
      accountNumber: '0342-100293849',
      iban: 'PK12ALFH0342100293849001'
    },
    suppliedItems: ['Mutton (Mix Cut)', 'Mutton Chops', 'Beef Boneless Keema', 'Beef Nihari Cuts'],
    currentBalance: 0,
    totalPurchases: 1450000,
    rating: 5,
    status: 'active',
    notes: 'Premium goat mutton and fresh beef cuts for BBQ skewers and Karahi.',
    createdAt: Date.now() - 90 * 86400000,
    updatedAt: Date.now() - 2 * 86400000,
  },
  {
    id: 'sup-3',
    name: 'Sindh Green Fresh Produce Wholesale',
    category: 'Fresh Produce',
    contactPerson: 'Malik Zulfiqar',
    phone: '+92 333 5551234',
    whatsapp: '+92 333 5551234',
    email: 'sindhgreens.mandi@yahoo.com',
    address: 'Shed #48, Badami Bagh Vegetable Wholesale Market',
    city: 'Lahore',
    paymentTerms: 'Credit 15 Days',
    bankDetails: {
      bankName: 'Habib Bank Limited (HBL)',
      accountTitle: 'Sindh Green Vegetable Commission',
      accountNumber: '0042-7901823901',
      iban: 'PK89HABB0042790182390101'
    },
    suppliedItems: ['Onions (Piaz)', 'Tomatoes (Tamatar)', 'Garlic & Ginger', 'Mint & Coriander', 'Green Chillies', 'Lemon'],
    currentBalance: 18200,
    totalPurchases: 320000,
    rating: 4.8,
    status: 'active',
    notes: 'Morning crates dispatched at 6:00 AM directly from Mandi auction.',
    createdAt: Date.now() - 45 * 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sup-4',
    name: 'National Spices & Grains Mart',
    category: 'Grains & Dry Ration',
    contactPerson: 'Sheikh Tariq Mehmood',
    phone: '+92 302 9988776',
    whatsapp: '+92 302 9988776',
    email: 'nationalspices.akbari@gmail.com',
    address: 'Shop 112, Akbari Mandi, Circular Road, Walled City',
    city: 'Lahore',
    paymentTerms: 'Credit 30 Days',
    bankDetails: {
      bankName: 'MCB Bank',
      accountTitle: 'National Grains & Spices Wholesale',
      accountNumber: '1092-882736192',
      iban: 'PK33MUCB1092882736192001'
    },
    suppliedItems: ['Super Basmati Rice (Kainat 1121)', 'Wheat Flour (Fine Atta)', 'Cooking Oil (Canola 16L)', 'Shan Karahi/Biryani Masala', 'Whole Spices (Garam Masala)'],
    currentBalance: 45000,
    totalPurchases: 940000,
    rating: 4.9,
    status: 'active',
    notes: 'Direct bulk import from mills. Top grade aroma aged rice for Sultan Biryani.',
    createdAt: Date.now() - 120 * 86400000,
    updatedAt: Date.now() - 3 * 86400000,
  },
  {
    id: 'sup-5',
    name: 'Mehran Fresh Dairy Farms & Processing',
    category: 'Dairy & Bakery',
    contactPerson: 'Ustad Nasir Dairywala',
    phone: '+92 312 6677889',
    whatsapp: '+92 312 6677889',
    email: 'mehrandairyfarms@gmail.com',
    address: 'Farm #8, Raiwind Road Dairy Complex',
    city: 'Lahore',
    paymentTerms: 'Credit 7 Days',
    bankDetails: {
      bankName: 'Faysal Bank',
      accountTitle: 'Mehran Dairy & Milk Farm',
      accountNumber: '3091-0029381928',
      iban: 'PK56FAYS3091002938192801'
    },
    suppliedItems: ['Fresh Buffalo Milk', 'Thick Yogurt (Dahi)', 'Desi Butter (Makhan)', 'Fresh Cream (Malai)', 'Desi Ghee (Tin 5kg)'],
    currentBalance: 12800,
    totalPurchases: 410000,
    rating: 5,
    status: 'active',
    notes: 'Unadulterated pure buffalo milk and dahi for Raita, Lassi, and Karahi gravies.',
    createdAt: Date.now() - 75 * 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sup-6',
    name: 'Sultan Beverage & Cola Distributors',
    category: 'Beverages & Drinks',
    contactPerson: 'Kamran Siddiqui',
    phone: '+92 304 3322110',
    whatsapp: '+92 304 3322110',
    email: 'sultanbeverages.dist@gmail.com',
    address: 'Pepsi Route Depot, Kot Lakhpat Industrial Area',
    city: 'Lahore',
    paymentTerms: 'Credit 15 Days',
    bankDetails: {
      bankName: 'United Bank Limited (UBL)',
      accountTitle: 'Sultan Beverage Distributors',
      accountNumber: '2401-9988776655',
      iban: 'PK77UNIL2401998877665501'
    },
    suppliedItems: ['Pepsi (1.5L / 500ml / Cans)', '7Up (1.5L / Cans)', 'Marinda (1.5L)', 'Nestle Pure Life Mineral Water (500ml / 1.5L)', 'Gourmet Club Soda'],
    currentBalance: 15600,
    totalPurchases: 520000,
    rating: 4.7,
    status: 'active',
    notes: 'Official franchisee distributor with returnable glass bottle crates exchange.',
    createdAt: Date.now() - 100 * 86400000,
    updatedAt: Date.now() - 4 * 86400000,
  },
  {
    id: 'sup-7',
    name: 'Al-Rehman LPG & Charcoal Agency',
    category: 'Fuel & Charcoal',
    contactPerson: 'Mian Farooq Gaswala',
    phone: '+92 322 1199887',
    whatsapp: '+92 322 1199887',
    address: 'Main Ferozepur Road near Kahna Nau',
    city: 'Lahore',
    paymentTerms: 'Cash on Delivery',
    bankDetails: {
      bankName: 'Allied Bank Limited (ABL)',
      accountTitle: 'Al-Rehman Gas & Energy Services',
      accountNumber: '0010-0982736152',
      iban: 'PK19ABPA0010098273615201'
    },
    suppliedItems: ['Commercial 45kg LPG Cylinders', 'Domestic 11.8kg LPG Cylinders', 'Babul Hardwood BBQ Charcoal (50kg Bags)'],
    currentBalance: 0,
    totalPurchases: 290000,
    rating: 4.8,
    status: 'active',
    notes: 'Emergency LPG cylinder replacement within 45 minutes on call.',
    createdAt: Date.now() - 60 * 86400000,
    updatedAt: Date.now() - 5 * 86400000,
  },
  {
    id: 'sup-8',
    name: 'Modern Pack & Eco Disposables',
    category: 'Packaging & Disposables',
    contactPerson: 'Salman Butt',
    phone: '+92 301 7766554',
    whatsapp: '+92 301 7766554',
    email: 'modernpack.lahore@gmail.com',
    address: 'Urdu Bazaar Packaging Plaza, Hall Road',
    city: 'Lahore',
    paymentTerms: 'Credit 15 Days',
    bankDetails: {
      bankName: 'Askari Bank',
      accountTitle: 'Modern Pack & Paper Products',
      accountNumber: '0192-3847561029',
      iban: 'PK44ASCM0192384756102901'
    },
    suppliedItems: ['Sultan Printed Takeaway Boxes', 'Foil Containers (500ml/1000ml)', 'Butter Paper Rolls', 'Paper Bags & Napkins', 'Cutlery Packs'],
    currentBalance: 22000,
    totalPurchases: 260000,
    rating: 4.9,
    status: 'active',
    notes: 'Food-grade heat-resistant packaging with Sultan Restaurant custom golden embossed logo.',
    createdAt: Date.now() - 80 * 86400000,
    updatedAt: Date.now() - 6 * 86400000,
  },
  {
    id: 'sup-9',
    name: 'Master Clean & Kitchen Hygiene Solutions',
    category: 'Cleaning & Kitchen Supplies',
    contactPerson: 'Asif Iqbal',
    phone: '+92 306 4433221',
    whatsapp: '+92 306 4433221',
    email: 'masterclean.hygiene@gmail.com',
    address: 'Brandreth Road Industrial Market',
    city: 'Lahore',
    paymentTerms: 'Credit 30 Days',
    bankDetails: {
      bankName: 'Dubai Islamic Bank',
      accountTitle: 'Master Hygiene Solutions',
      accountNumber: '0281-9988776611',
      iban: 'PK60DIBP0281998877661101'
    },
    suppliedItems: ['Commercial Dishwashing Liquid (20L)', 'Heavy Floor Degreaser', 'Grill Wire Brushes & Sponges', 'Hand Sanitizer', 'Chef Caps & Aprons'],
    currentBalance: 6500,
    totalPurchases: 140000,
    rating: 4.6,
    status: 'active',
    notes: 'Pest control & kitchen sanitation chemical supplies with safety compliance sheets.',
    createdAt: Date.now() - 50 * 86400000,
    updatedAt: Date.now() - 7 * 86400000,
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-101',
    poNumber: 'PO-2026-081',
    supplierId: 'sup-1',
    supplierName: 'Al-Madina Fresh Poultry Ltd',
    invoiceNo: 'AMP-8821',
    orderDate: Date.now() - 2 * 86400000,
    deliveryDate: Date.now() - 2 * 86400000,
    status: 'received',
    paymentStatus: 'partial',
    items: [
      { itemId: 'inv1', name: 'Chicken (Boneless)', category: 'Meat', unit: 'kg', qtyOrdered: 30, qtyReceived: 30, unitCost: 780, totalCost: 23400 },
      { name: 'Chicken Whole (Skinless)', category: 'Meat', unit: 'kg', qtyOrdered: 20, qtyReceived: 20, unitCost: 540, totalCost: 10800 },
    ],
    subtotal: 34200,
    discount: 700,
    tax: 0,
    freight: 500,
    totalAmount: 34000,
    amountPaid: 15000,
    balanceDue: 19000,
    paymentMethod: 'cash',
    receivedBy: 'Chef Omar',
    notes: 'Delivered in chilled van. Quality verified by kitchen chef.',
    createdAt: Date.now() - 2 * 86400000,
  },
  {
    id: 'po-102',
    poNumber: 'PO-2026-082',
    supplierId: 'sup-4',
    supplierName: 'National Spices & Grains Mart',
    invoiceNo: 'NSG-4412',
    orderDate: Date.now() - 4 * 86400000,
    deliveryDate: Date.now() - 4 * 86400000,
    status: 'received',
    paymentStatus: 'paid',
    items: [
      { itemId: 'inv3', name: 'Basmati Rice (Kainat)', category: 'Grains', unit: 'kg', qtyOrdered: 100, qtyReceived: 100, unitCost: 360, totalCost: 36000 },
      { itemId: 'inv5', name: 'Cooking Oil (Canola 16L)', category: 'Pantry', unit: 'Tins', qtyOrdered: 5, qtyReceived: 5, unitCost: 8320, totalCost: 41600 },
    ],
    subtotal: 77600,
    discount: 1600,
    tax: 0,
    freight: 0,
    totalAmount: 76000,
    amountPaid: 76000,
    balanceDue: 0,
    paymentMethod: 'online',
    receivedBy: 'Manager Ali',
    notes: 'Paid via Meezan Bank Online Transfer. In stock at pantry.',
    createdAt: Date.now() - 4 * 86400000,
  }
];

export const INITIAL_SUPPLIER_PAYMENTS: SupplierPayment[] = [
  {
    id: 'spay-1',
    supplierId: 'sup-1',
    supplierName: 'Al-Madina Fresh Poultry Ltd',
    purchaseOrderId: 'po-101',
    amount: 15000,
    method: 'cash',
    reference: 'Cash Voucher #981',
    notes: 'Advance partial payment at time of delivery to driver Rafiq',
    paidBy: 'Admin Omar',
    paidAt: Date.now() - 2 * 86400000,
    sourceAccount: 'Main Cash Counter',
    receivedByContact: 'Driver Rafiq',
  },
  {
    id: 'spay-2',
    supplierId: 'sup-4',
    supplierName: 'National Spices & Grains Mart',
    purchaseOrderId: 'po-102',
    amount: 76000,
    method: 'online',
    reference: 'Meezan IBFT #882194',
    notes: 'Full payment via Meezan Bank Online Transfer upon invoice receipt',
    paidBy: 'Manager Ali',
    paidAt: Date.now() - 4 * 86400000,
    bankName: 'Meezan Bank Ltd',
    sourceAccount: 'Sultan Rest. Business A/C',
    receivedByContact: 'Tariq Mehmood',
  },
];

// ---------- Assets & Capital Purchases ----------

export const ASSET_CATEGORIES = [
  'Crockery (Plates & Bowls)',
  'Glassware & Tumblers',
  'Cutlery & Utensils',
  'Clayware & Specialty Pots',
  'Kitchen Machinery & Heavy Line',
  'Kitchen Equipment & Tools',
  'Refrigeration & Cold Storage',
  'Dining Furniture & Decor',
  'Dining Furniture & Seating',
  'Crockery & Cutlery (Bulk Assets)',
  'HVAC, Electrical & Generators',
  'IT, POS & Surveillance Hardware',
  'Amusement & Playland Rides',
  'Playland Assets & Rides',
  'Interior, Signage & Royal Decor',
  'Other Capital Assets',
] as const;

export type AssetCategory = typeof ASSET_CATEGORIES[number];

export type AssetCondition = 'brand_new' | 'good' | 'fair' | 'needs_maintenance';
export type AssetStatus = 'active' | 'in_maintenance' | 'retired' | 'written_off';

export type AssetMaintenanceLog = {
  id: string;
  date: number;
  cost: number;
  description: string;
  performedBy?: string;
  vendor?: string;
  invoiceNo?: string;
};

export type Asset = {
  id: string;
  assetCode: string;
  name: string;
  urduName?: string;
  category: AssetCategory;
  purchaseDate: number;
  cost: number;
  quantity: number;
  totalCost: number;
  vendor: string;
  vendorPhone?: string;
  invoiceNo?: string;
  warrantyExpiry?: number;
  location: string;
  condition: AssetCondition;
  status: AssetStatus;
  depreciationRateYearly?: number; // e.g. 10%
  currentValue: number;
  serialNumber?: string;
  notes?: string;
  maintenanceLogs: AssetMaintenanceLog[];
  createdAt: number;
  updatedAt: number;
};

// ---------- Damage Control & Breakages ----------

export const DAMAGE_CATEGORIES = [
  'Crockery (Plates & Bowls)',
  'Glassware & Tumblers',
  'Cutlery & Utensils',
  'Clayware & Specialty Pots',
  'Kitchen Machinery & Heavy Line',
  'Kitchen Equipment & Tools',
  'Refrigeration & Cold Storage',
  'Dining Furniture & Decor',
  'Dining Furniture & Seating',
  'HVAC, Electrical & Generators',
  'IT, POS & Surveillance Hardware',
  'Playland Assets & Rides',
  'Interior, Signage & Royal Decor',
  'Other Breakage',
] as const;

export type DamageCategory = typeof DAMAGE_CATEGORIES[number];

export const DAMAGE_REASONS = [
  'Staff Accidental Drop',
  'Customer / Guest Mishap',
  'Dishwashing Pit Collision',
  'Thermal Shock / Heat Crack',
  'Wear & Tear / Chipped Edge',
  'Storage & Transit Slip',
  'Equipment Burnout / Overheating',
  'Other Incident',
] as const;

export type DamageReason = typeof DAMAGE_REASONS[number];

export type DamageResponsibility = 'staff' | 'customer' | 'dishwashing' | 'wear_and_tear' | 'unknown';

export const DAMAGE_ACTIONS = [
  'Written Off (Restaurant Loss)',
  'Deducted from Staff Salary',
  'Charged to Customer Bill',
  'Replaced from Buffer Stock',
  'Sent for Repair / Welding',
] as const;

export type DamageAction = typeof DAMAGE_ACTIONS[number];
export type DamageStatus = 'logged' | 'approved_writeoff' | 'recovered' | 'repaired';

export type DamageRecord = {
  id: string;
  incidentCode: string;
  itemName: string;
  category: DamageCategory;
  quantity: number;
  unitCost: number;
  totalLoss: number;
  incidentDate: number;
  location: string;
  reason: DamageReason;
  reportedBy: string;
  responsibleParty: DamageResponsibility;
  responsiblePersonName?: string;
  actionTaken: DamageAction;
  status: DamageStatus;
  amountRecovered: number;
  netLoss: number;
  notes?: string;
  assetId?: string;
  assetCode?: string;
  createdAt: number;
  resolvedAt?: number;
};

export const INITIAL_ASSETS: Asset[] = [
  {
    id: 'ast-1',
    assetCode: 'AST-KTC-01',
    name: 'Rational Combi Steamer Oven (10-Tray)',
    urduName: 'کومبی اسٹیمر اوون',
    category: 'Kitchen Machinery & Heavy Line',
    purchaseDate: Date.now() - 180 * 86400000,
    cost: 1850000,
    quantity: 1,
    totalCost: 1850000,
    vendor: 'Pak Commercial Kitchen Tech',
    vendorPhone: '+92 300 8472910',
    invoiceNo: 'PCK-9921',
    warrantyExpiry: Date.now() + 185 * 86400000,
    location: 'Main Kitchen Line 1',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 10,
    currentValue: 1757500,
    serialNumber: 'RAT-X10-99482',
    notes: 'Premium intelligent cooking center for karahi roasts, baking, and steaming.',
    maintenanceLogs: [
      {
        id: 'm-1',
        date: Date.now() - 30 * 86400000,
        cost: 15000,
        description: 'Scheduled descaling and door gasket inspection',
        performedBy: 'Engr. Kamran',
        vendor: 'Pak Commercial Kitchen Tech',
      },
    ],
    createdAt: Date.now() - 180 * 86400000,
    updatedAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'ast-2',
    assetCode: 'AST-KTC-02',
    name: 'Commercial Double Gas Fryer (24L)',
    urduName: 'کمرشل گیس ڈیپ فرائیر',
    category: 'Kitchen Machinery & Heavy Line',
    purchaseDate: Date.now() - 150 * 86400000,
    cost: 240000,
    quantity: 2,
    totalCost: 480000,
    vendor: 'Lahore Kitchenware Hub',
    vendorPhone: '+92 321 7766554',
    invoiceNo: 'LKH-4412',
    warrantyExpiry: Date.now() + 215 * 86400000,
    location: 'Main Kitchen - Starters Station',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 12,
    currentValue: 456000,
    serialNumber: 'FRY-GF-24-08',
    notes: 'Fast recovery gas fryers for broast, fries, and tempura.',
    maintenanceLogs: [],
    createdAt: Date.now() - 150 * 86400000,
    updatedAt: Date.now() - 150 * 86400000,
  },
  {
    id: 'ast-3',
    assetCode: 'AST-PWR-01',
    name: 'Perkins 50 kVA Silent Diesel Generator',
    urduName: 'پرکنز 50 کے وی اے جنریٹر',
    category: 'HVAC, Electrical & Generators',
    purchaseDate: Date.now() - 300 * 86400000,
    cost: 2650000,
    quantity: 1,
    totalCost: 2650000,
    vendor: 'Allied Engineering & Power Ltd',
    vendorPhone: '+92 301 9922881',
    invoiceNo: 'AEP-GEN-1029',
    warrantyExpiry: Date.now() + 65 * 86400000,
    location: 'Rear Power Yard',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 8,
    currentValue: 2475000,
    serialNumber: 'PERK-50KVA-88192',
    notes: 'Automated ATS panel. Powers complete restaurant, chillers, and basement amusement.',
    maintenanceLogs: [
      {
        id: 'm-2',
        date: Date.now() - 45 * 86400000,
        cost: 28000,
        description: 'Engine oil 15W40 change, oil filter & diesel fuel filters replaced',
        performedBy: 'Allied Power Tech Team',
        vendor: 'Allied Engineering',
      },
    ],
    createdAt: Date.now() - 300 * 86400000,
    updatedAt: Date.now() - 45 * 86400000,
  },
  {
    id: 'ast-4',
    assetCode: 'AST-COLD-01',
    name: 'Walk-in Blast Chiller & Cold Room (10x8 ft)',
    urduName: 'واک ان کولڈ روم چیلر',
    category: 'Refrigeration & Cold Storage',
    purchaseDate: Date.now() - 240 * 86400000,
    cost: 1420000,
    quantity: 1,
    totalCost: 1420000,
    vendor: 'CoolTech Refrigeration Systems',
    vendorPhone: '+92 333 4455667',
    invoiceNo: 'CTR-8812',
    warrantyExpiry: Date.now() + 125 * 86400000,
    location: 'Basement Storage Area',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 10,
    currentValue: 1325000,
    serialNumber: 'CT-COLD-108-01',
    notes: 'Digital thermostat maintained at -2C to +4C for daily meat and poultry storage.',
    maintenanceLogs: [],
    createdAt: Date.now() - 240 * 86400000,
    updatedAt: Date.now() - 240 * 86400000,
  },
  {
    id: 'ast-5',
    assetCode: 'AST-FUR-01',
    name: 'Solid Teak Wood Dining Tables & Royal Velvet Chairs (6-Seater)',
    urduName: 'شاہی شیشم ڈائننگ ٹیبلز اور کرسیاں',
    category: 'Dining Furniture & Seating',
    purchaseDate: Date.now() - 210 * 86400000,
    cost: 65000,
    quantity: 18,
    totalCost: 1170000,
    vendor: 'Chiniot Heritage Woodworks',
    vendorPhone: '+92 300 6677889',
    invoiceNo: 'CHW-3319',
    location: 'Ground Floor & 1st Floor Halls',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 10,
    currentValue: 1102000,
    notes: 'Custom carved Sultan imperial insignia with stain-resistant velvet fabric.',
    maintenanceLogs: [],
    createdAt: Date.now() - 210 * 86400000,
    updatedAt: Date.now() - 210 * 86400000,
  },
  {
    id: 'ast-6',
    assetCode: 'AST-CRK-01',
    name: 'Sultan Royal Gold Rim Bone China Dinner Set (500 Pcs)',
    urduName: 'شاہی گولڈ رم کراکری سیٹ',
    category: 'Crockery & Cutlery (Bulk Assets)',
    purchaseDate: Date.now() - 160 * 86400000,
    cost: 550000,
    quantity: 1,
    totalCost: 550000,
    vendor: 'Imperial Tableware Importers',
    vendorPhone: '+92 304 9988771',
    invoiceNo: 'ITI-7712',
    location: 'Main Service Stations',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 15,
    currentValue: 513000,
    notes: 'Premium 24K gold rim porcelain plates, handi bowls, and platters for dining service.',
    maintenanceLogs: [],
    createdAt: Date.now() - 160 * 86400000,
    updatedAt: Date.now() - 160 * 86400000,
  },
  {
    id: 'ast-7',
    assetCode: 'AST-POS-01',
    name: 'Sunmi Dual-Screen Touch POS Terminals + Thermal ESC/POS Printers',
    urduName: 'ٹچ پی او ایس اور تھرمل پرنٹر سسٹم',
    category: 'IT, POS & Surveillance Hardware',
    purchaseDate: Date.now() - 120 * 86400000,
    cost: 165000,
    quantity: 3,
    totalCost: 495000,
    vendor: 'Retail Solutions Tech Ltd',
    vendorPhone: '+92 302 3344556',
    invoiceNo: 'RST-9912',
    warrantyExpiry: Date.now() + 245 * 86400000,
    location: 'Cashier Counters & Manager Desk',
    condition: 'brand_new',
    status: 'active',
    depreciationRateYearly: 20,
    currentValue: 462000,
    serialNumber: 'SNM-D2-882194',
    notes: 'Handles cashier billing, kitchen slip printing, and offline sync hub.',
    maintenanceLogs: [],
    createdAt: Date.now() - 120 * 86400000,
    updatedAt: Date.now() - 120 * 86400000,
  },
  {
    id: 'ast-8',
    assetCode: 'AST-AMU-01',
    name: 'Basement Amusement Carousel & Bumper Cars Set',
    urduName: 'بیسمنٹ پلے لینڈ جھولے و بمپر کاریں',
    category: 'Amusement & Playland Rides',
    purchaseDate: Date.now() - 190 * 86400000,
    cost: 3200000,
    quantity: 1,
    totalCost: 3200000,
    vendor: 'Sino Amusement Rides Imports',
    vendorPhone: '+92 334 1122334',
    invoiceNo: 'SARI-4019',
    warrantyExpiry: Date.now() + 175 * 86400000,
    location: 'Playland Basement Zone',
    condition: 'good',
    status: 'active',
    depreciationRateYearly: 10,
    currentValue: 3034000,
    notes: 'Includes 8-seat motorized carousel, 4 electric bumper cars with floor grid.',
    maintenanceLogs: [
      {
        id: 'm-3',
        date: Date.now() - 20 * 86400000,
        cost: 35000,
        description: 'Monthly motor bearing lubrication and DC controller diagnostics',
        performedBy: 'Ustad Farooq Rides Specialist',
      },
    ],
    createdAt: Date.now() - 190 * 86400000,
    updatedAt: Date.now() - 20 * 86400000,
  },
];

export const INITIAL_DAMAGES: DamageRecord[] = [
  {
    id: 'dmg-1',
    incidentCode: 'DMG-2026-001',
    itemName: 'Sultan Royal Gold Rim Dinner Plate 11"',
    category: 'Crockery (Plates & Bowls)',
    quantity: 2,
    unitCost: 950,
    totalLoss: 1900,
    incidentDate: Date.now() - 3 * 86400000,
    location: 'Main Hall - Table T-04',
    reason: 'Staff Accidental Drop',
    reportedBy: 'Sara Ahmed (Waiter)',
    responsibleParty: 'staff',
    responsiblePersonName: 'Waiter Bilal',
    actionTaken: 'Written Off (Restaurant Loss)',
    status: 'approved_writeoff',
    amountRecovered: 0,
    netLoss: 1900,
    notes: 'Waiter slipped while busing large party table during busy evening dinner rush.',
    assetId: 'ast-6',
    assetCode: 'AST-CRK-01',
    createdAt: Date.now() - 3 * 86400000,
    resolvedAt: Date.now() - 3 * 86400000,
  },
  {
    id: 'dmg-2',
    incidentCode: 'DMG-2026-002',
    itemName: 'Water Goblet Crystal Glass (350ml)',
    category: 'Glassware & Tumblers',
    quantity: 4,
    unitCost: 420,
    totalLoss: 1680,
    incidentDate: Date.now() - 2 * 86400000,
    location: 'Dishwashing Pit',
    reason: 'Thermal Shock / Heat Crack',
    reportedBy: 'Chef Omar',
    responsibleParty: 'dishwashing',
    responsiblePersonName: 'Dishwashing Crew',
    actionTaken: 'Written Off (Restaurant Loss)',
    status: 'approved_writeoff',
    amountRecovered: 0,
    netLoss: 1680,
    notes: 'Hot sanitizing rinse followed immediately by ice cold wash water caused thermal crack.',
    createdAt: Date.now() - 2 * 86400000,
    resolvedAt: Date.now() - 2 * 86400000,
  },
  {
    id: 'dmg-3',
    incidentCode: 'DMG-2026-003',
    itemName: 'Heavy Clay Biryani Handi (1kg Pot)',
    category: 'Clayware & Specialty Pots',
    quantity: 1,
    unitCost: 650,
    totalLoss: 650,
    incidentDate: Date.now() - 1 * 86400000,
    location: 'Tandoor & Dum Counter',
    reason: 'Thermal Shock / Heat Crack',
    reportedBy: 'Chef Omar',
    responsibleParty: 'wear_and_tear',
    actionTaken: 'Replaced from Buffer Stock',
    status: 'approved_writeoff',
    amountRecovered: 0,
    netLoss: 650,
    notes: 'Cracked along base rim during high heat dum finishing. Replaced from store.',
    createdAt: Date.now() - 1 * 86400000,
    resolvedAt: Date.now() - 1 * 86400000,
  },
  {
    id: 'dmg-4',
    incidentCode: 'DMG-2026-004',
    itemName: 'Commercial Blender Polycarbonate Pitcher Jug (2L)',
    category: 'Kitchen Equipment & Tools',
    quantity: 1,
    unitCost: 4500,
    totalLoss: 4500,
    incidentDate: Date.now() - 4 * 86400000,
    location: 'Juice Bar Prep Counter',
    reason: 'Staff Accidental Drop',
    reportedBy: 'Barista Hamza',
    responsibleParty: 'staff',
    responsiblePersonName: 'Barista Hamza',
    actionTaken: 'Deducted from Staff Salary',
    status: 'recovered',
    amountRecovered: 2250,
    netLoss: 2250,
    notes: 'Dropped during rush hour shake prep. 50% subsidized by management, 50% salary adjustment.',
    createdAt: Date.now() - 4 * 86400000,
    resolvedAt: Date.now() - 4 * 86400000,
  },
  {
    id: 'dmg-5',
    incidentCode: 'DMG-2026-005',
    itemName: 'Mint Margarita Stem Glass',
    category: 'Glassware & Tumblers',
    quantity: 1,
    unitCost: 550,
    totalLoss: 550,
    incidentDate: Date.now() - 5 * 86400000,
    location: 'Rooftop Lounge - Table R-02',
    reason: 'Customer / Guest Mishap',
    reportedBy: 'Sara Ahmed',
    responsibleParty: 'customer',
    responsiblePersonName: 'Table R-02 Guest',
    actionTaken: 'Written Off (Restaurant Loss)',
    status: 'approved_writeoff',
    amountRecovered: 0,
    netLoss: 550,
    notes: 'Guest child accidentally knocked over glass. Waived off as VIP courtesy.',
    createdAt: Date.now() - 5 * 86400000,
    resolvedAt: Date.now() - 5 * 86400000,
  },
];

export type OpsData = {
  serviceRequests: ServiceRequest[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  expenses: Expense[];
  feedback: GuestFeedback[];
  unavailableItemIds: string[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  assets: Asset[];
  damageRecords: DamageRecord[];
};

/** Keys exchanged with the LAN sync hub (kept in sync with server.js allowedKeys). */
export const OPS_SYNC_KEYS: (keyof OpsData)[] = [
  'serviceRequests',
  'inventory',
  'stockMovements',
  'expenses',
  'feedback',
  'unavailableItemIds',
  'suppliers',
  'purchaseOrders',
  'supplierPayments',
  'assets',
  'damageRecords',
];

type NewServiceRequest = {
  tableId: string;
  tableName: string;
  zone: string;
  type: ServiceRequestType;
  note?: string;
  source: 'guest' | 'staff';
};

type OpsState = OpsData & {
  // Service requests
  addServiceRequest: (req: NewServiceRequest) => boolean;
  acknowledgeRequest: (id: string, by: string) => void;
  resolveRequest: (id: string) => void;
  clearResolvedRequests: () => void;

  // Inventory
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => void;
  updateInventoryItem: (id: string, patch: Partial<Omit<InventoryItem, 'id'>>) => void;
  deleteInventoryItem: (id: string) => void;
  recordStockMovement: (
    itemId: string,
    type: StockMovementType,
    qty: number,
    note?: string,
    by?: string,
    meta?: {
      supplier?: string;
      invoiceNo?: string;
      batchNumber?: string;
      unitCost?: number;
      expiryDate?: number;
      location?: string;
    }
  ) => void;

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'at'> & { at?: number }) => void;
  deleteExpense: (id: string) => void;

  // Sold-out list
  setItemAvailability: (menuItemId: string, available: boolean) => void;
  resetAvailability: () => void;

  // Feedback
  addFeedback: (fb: Omit<GuestFeedback, 'id' | 'at'>) => void;

  // Supplier & Vendor Management
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSupplier: (id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => void;
  deleteSupplier: (id: string) => void;
  populateDefaultSuppliers: () => void;

  // Purchase Orders & Inflow
  addPurchaseOrder: (
    po: Omit<PurchaseOrder, 'id' | 'createdAt'>,
    options?: { autoReceiveToInventory?: boolean; autoRecordExpense?: boolean; receivedBy?: string }
  ) => void;
  receivePurchaseOrder: (
    poId: string,
    receivedItems?: { itemId?: string; qtyReceived: number }[],
    receivedBy?: string
  ) => void;
  deletePurchaseOrder: (id: string) => void;

  // Supplier Payments
  recordSupplierPayment: (
    payment: Omit<SupplierPayment, 'id' | 'paidAt'>,
    options?: { autoRecordExpense?: boolean }
  ) => void;
  deleteSupplierPayment: (id: string) => void;

  // Assets & Capital Purchases
  addAsset: (
    asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'totalCost' | 'currentValue' | 'maintenanceLogs'> & {
      totalCost?: number;
      currentValue?: number;
    }
  ) => void;
  updateAsset: (id: string, patch: Partial<Omit<Asset, 'id' | 'createdAt'>>) => void;
  deleteAsset: (id: string) => void;
  addAssetMaintenanceLog: (
    assetId: string,
    log: Omit<AssetMaintenanceLog, 'id'>,
    options?: { autoRecordExpense?: boolean; paidBy?: string }
  ) => void;

  // Damage Control & Breakages
  logDamageIncident: (
    record: Omit<DamageRecord, 'id' | 'createdAt' | 'totalLoss' | 'netLoss'> & {
      totalLoss?: number;
      netLoss?: number;
    }
  ) => void;
  updateDamageRecord: (id: string, patch: Partial<Omit<DamageRecord, 'id' | 'createdAt'>>) => void;
  deleteDamageRecord: (id: string) => void;
  resolveDamageRecord: (
    id: string,
    resolution: {
      actionTaken: DamageAction;
      status?: DamageStatus;
      amountRecovered?: number;
      notes?: string;
    }
  ) => void;

  syncFromServer: (remote: Partial<OpsData>) => void;
};

export const useOpsStore = create<OpsState>()(
  persist(
    (set, get) => ({
      serviceRequests: [],
      inventory: INITIAL_INVENTORY,
      stockMovements: INITIAL_STOCK_MOVEMENTS,
      expenses: [],
      feedback: [],
      unavailableItemIds: [],
      suppliers: INITIAL_SUPPLIERS,
      purchaseOrders: INITIAL_PURCHASE_ORDERS,
      supplierPayments: INITIAL_SUPPLIER_PAYMENTS,
      assets: INITIAL_ASSETS,
      damageRecords: INITIAL_DAMAGES,

      addServiceRequest: (req) => {
        const duplicate = get().serviceRequests.some(
          (r) => r.tableId === req.tableId && r.type === req.type && isActiveRequest(r)
        );
        if (duplicate) return false;
        const created: ServiceRequest = {
          ...req,
          id: uid('sr'),
          status: 'pending',
          createdAt: Date.now(),
        };
        set((state) => ({
          serviceRequests: [created, ...state.serviceRequests].slice(0, MAX_REQUESTS),
        }));
        return true;
      },

      acknowledgeRequest: (id, by) =>
        set((state) => ({
          serviceRequests: state.serviceRequests.map((r) =>
            r.id === id && r.status === 'pending'
              ? { ...r, status: 'acknowledged', acknowledgedBy: by, acknowledgedAt: Date.now() }
              : r
          ),
        })),

      resolveRequest: (id) =>
        set((state) => ({
          serviceRequests: state.serviceRequests.map((r) =>
            r.id === id ? { ...r, status: 'resolved', resolvedAt: Date.now() } : r
          ),
        })),

      clearResolvedRequests: () =>
        set((state) => ({ serviceRequests: state.serviceRequests.filter(isActiveRequest) })),

      addInventoryItem: (item) =>
        set((state) => ({
          inventory: [...state.inventory, { ...item, id: uid('inv'), updatedAt: Date.now() }],
        })),

      updateInventoryItem: (id, patch) =>
        set((state) => ({
          inventory: state.inventory.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i
          ),
        })),

      deleteInventoryItem: (id) =>
        set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) })),

      recordStockMovement: (itemId, type, qty, note, by, meta) =>
        set((state) => {
          const item = state.inventory.find((i) => i.id === itemId);
          if (!item || !Number.isFinite(qty) || qty < 0) return state;

          let newStock = item.stock;
          if (type === 'receive') newStock = item.stock + qty;
          else if (type === 'adjust') newStock = qty;
          else newStock = Math.max(0, item.stock - qty);

          const movement: StockMovement = {
            id: uid('mv'),
            itemId,
            itemName: item.name,
            itemCode: item.itemCode,
            type,
            qty,
            delta: newStock - item.stock,
            note,
            by,
            at: Date.now(),
            supplier: meta?.supplier || item.supplier,
            invoiceNo: meta?.invoiceNo || item.invoiceNo,
            batchNumber: meta?.batchNumber || item.batchNumber,
            unitCost: meta?.unitCost ?? item.costPerUnit,
            expiryDate: meta?.expiryDate ?? item.expiryDate,
          };

          return {
            inventory: state.inventory.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    stock: newStock,
                    updatedAt: movement.at,
                    ...(meta?.unitCost !== undefined && { costPerUnit: meta.unitCost }),
                    ...(meta?.batchNumber && { batchNumber: meta.batchNumber }),
                    ...(meta?.expiryDate !== undefined && { expiryDate: meta.expiryDate }),
                    ...(meta?.location && { location: meta.location }),
                    ...(meta?.invoiceNo && { invoiceNo: meta.invoiceNo }),
                    ...(meta?.supplier && { supplier: meta.supplier }),
                  }
                : i
            ),
            stockMovements: [movement, ...state.stockMovements].slice(0, MAX_MOVEMENTS),
          };
        }),

      addExpense: (expense) =>
        set((state) => ({
          expenses: [{ ...expense, id: uid('ex'), at: expense.at ?? Date.now() }, ...state.expenses],
        })),

      deleteExpense: (id) =>
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),

      setItemAvailability: (menuItemId, available) =>
        set((state) => {
          const has = state.unavailableItemIds.includes(menuItemId);
          if (available && has) {
            return { unavailableItemIds: state.unavailableItemIds.filter((i) => i !== menuItemId) };
          }
          if (!available && !has) {
            return { unavailableItemIds: [...state.unavailableItemIds, menuItemId] };
          }
          return state;
        }),

      resetAvailability: () => set({ unavailableItemIds: [] }),

      addFeedback: (fb) =>
        set((state) => ({
          feedback: [{ ...fb, id: uid('fb'), at: Date.now() }, ...state.feedback].slice(0, MAX_FEEDBACK),
        })),

      // Supplier & Vendor Actions
      addSupplier: (supplier) =>
        set((state) => ({
          suppliers: [
            {
              ...supplier,
              id: uid('sup'),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...state.suppliers,
          ],
        })),

      updateSupplier: (id, patch) =>
        set((state) => ({
          suppliers: state.suppliers.map((s) =>
            s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
          ),
        })),

      deleteSupplier: (id) =>
        set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id),
        })),

      populateDefaultSuppliers: () =>
        set({
          suppliers: INITIAL_SUPPLIERS,
          purchaseOrders: INITIAL_PURCHASE_ORDERS,
          supplierPayments: INITIAL_SUPPLIER_PAYMENTS,
        }),

      addPurchaseOrder: (poData, options = {}) => {
        const { autoReceiveToInventory = true, autoRecordExpense = true, receivedBy } = options;
        const poId = uid('po');
        const now = Date.now();
        const po: PurchaseOrder = {
          ...poData,
          id: poId,
          createdAt: now,
        };

        set((state) => {
          // 1. Update supplier stats
          const supplier = state.suppliers.find((s) => s.id === po.supplierId);
          let updatedSuppliers = state.suppliers;
          if (supplier) {
            const addedBalance = po.balanceDue || 0;
            const addedPurchases = po.totalAmount || 0;
            updatedSuppliers = state.suppliers.map((s) =>
              s.id === po.supplierId
                ? {
                    ...s,
                    currentBalance: Math.max(0, (s.currentBalance || 0) + addedBalance),
                    totalPurchases: (s.totalPurchases || 0) + addedPurchases,
                    updatedAt: now,
                  }
                : s
            );
          }

          // 2. Auto Receive to inventory if marked received/ordered with option
          let nextInventory = state.inventory;
          let nextMovements = state.stockMovements;
          if (autoReceiveToInventory && (po.status === 'received' || po.status === 'partial')) {
            po.items.forEach((item) => {
              const qtyToAdd = item.qtyReceived > 0 ? item.qtyReceived : item.qtyOrdered;
              if (qtyToAdd > 0) {
                const existing = nextInventory.find(
                  (inv) => (item.itemId && inv.id === item.itemId) || inv.name.toLowerCase() === item.name.toLowerCase()
                );
                if (existing) {
                  const newStock = existing.stock + qtyToAdd;
                  nextInventory = nextInventory.map((inv) =>
                    inv.id === existing.id
                      ? { ...inv, stock: newStock, costPerUnit: item.unitCost || inv.costPerUnit, updatedAt: now }
                      : inv
                  );
                  nextMovements = [
                    {
                      id: uid('mv'),
                      itemId: existing.id,
                      itemName: existing.name,
                      type: 'receive' as StockMovementType,
                      qty: qtyToAdd,
                      delta: qtyToAdd,
                      note: `PO #${po.poNumber} from ${po.supplierName}`,
                      by: receivedBy || po.receivedBy || 'Admin',
                      at: now,
                    },
                    ...nextMovements,
                  ];
                }
              }
            });
          }

          // 3. Auto Record Expense if amount paid > 0
          let nextExpenses = state.expenses;
          if (autoRecordExpense && po.amountPaid > 0) {
            nextExpenses = [
              {
                id: uid('ex'),
                category: supplier?.category ? (supplier.category === 'Meat & Poultry' ? 'Meat & Poultry' : 'Groceries & Produce') : 'Groceries & Produce',
                amount: po.amountPaid,
                note: `PO #${po.poNumber} Payment to ${po.supplierName}`,
                method: po.paymentMethod === 'online' ? 'online' : 'cash',
                paidBy: receivedBy || po.receivedBy || 'Admin',
                at: now,
              },
              ...nextExpenses,
            ];
          }

          // 4. Record Supplier Payment if amount paid > 0
          let nextPayments = state.supplierPayments;
          if (po.amountPaid > 0) {
            nextPayments = [
              {
                id: uid('spay'),
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                purchaseOrderId: po.id,
                amount: po.amountPaid,
                method: po.paymentMethod === 'online' ? 'online' : po.paymentMethod === 'cheque' ? 'cheque' : 'cash',
                reference: `PO Creation Payment #${po.poNumber}`,
                notes: `Advance / Delivery Payment against PO #${po.poNumber}`,
                paidBy: receivedBy || po.receivedBy || 'Admin',
                paidAt: now,
                sourceAccount: po.paymentMethod === 'online' ? 'Bank Account' : 'Cash Drawer',
              },
              ...nextPayments,
            ];
          }

          return {
            purchaseOrders: [po, ...state.purchaseOrders],
            suppliers: updatedSuppliers,
            inventory: nextInventory,
            stockMovements: nextMovements.slice(0, MAX_MOVEMENTS),
            expenses: nextExpenses,
            supplierPayments: nextPayments,
          };
        });
      },

      receivePurchaseOrder: (poId, receivedItems, receivedBy) => {
        set((state) => {
          const po = state.purchaseOrders.find((p) => p.id === poId);
          if (!po) return state;
          const now = Date.now();

          let nextInventory = state.inventory;
          let nextMovements = state.stockMovements;

          const updatedItems = po.items.map((item) => {
            const match = receivedItems?.find((ri) => (ri.itemId && ri.itemId === item.itemId) || ri.itemId === item.name);
            const qtyRec = match ? match.qtyReceived : item.qtyOrdered;

            // Increment inventory stock
            const existing = nextInventory.find(
              (inv) => (item.itemId && inv.id === item.itemId) || inv.name.toLowerCase() === item.name.toLowerCase()
            );
            if (existing && qtyRec > 0) {
              const newStock = existing.stock + qtyRec;
              nextInventory = nextInventory.map((inv) =>
                inv.id === existing.id
                  ? { ...inv, stock: newStock, costPerUnit: item.unitCost || inv.costPerUnit, updatedAt: now }
                  : inv
              );
              nextMovements = [
                {
                  id: uid('mv'),
                  itemId: existing.id,
                  itemName: existing.name,
                  type: 'receive' as StockMovementType,
                  qty: qtyRec,
                  delta: qtyRec,
                  note: `Received PO #${po.poNumber} from ${po.supplierName}`,
                  by: receivedBy || 'Admin',
                  at: now,
                },
                ...nextMovements,
              ];
            }

            return {
              ...item,
              qtyReceived: qtyRec,
            };
          });

          return {
            purchaseOrders: state.purchaseOrders.map((p) =>
              p.id === poId
                ? {
                    ...p,
                    status: 'received',
                    deliveryDate: now,
                    receivedBy: receivedBy || p.receivedBy || 'Admin',
                    items: updatedItems,
                  }
                : p
            ),
            inventory: nextInventory,
            stockMovements: nextMovements.slice(0, MAX_MOVEMENTS),
          };
        });
      },

      deletePurchaseOrder: (id) =>
        set((state) => {
          const po = state.purchaseOrders.find((p) => p.id === id);
          if (!po) return state;
          const updatedSuppliers = state.suppliers.map((s) => {
            if (s.id === po.supplierId) {
              return {
                ...s,
                currentBalance: Math.max(0, (s.currentBalance || 0) - (po.balanceDue || 0)),
                totalPurchases: Math.max(0, (s.totalPurchases || 0) - (po.totalAmount || 0)),
                updatedAt: Date.now(),
              };
            }
            return s;
          });
          return {
            purchaseOrders: state.purchaseOrders.filter((p) => p.id !== id),
            suppliers: updatedSuppliers,
          };
        }),

      recordSupplierPayment: (paymentData, options = {}) => {
        const { autoRecordExpense = true } = options;
        const now = Date.now();
        const payment: SupplierPayment = {
          ...paymentData,
          id: uid('spay'),
          paidAt: now,
        };

        set((state) => {
          // 1. Deduct balance from supplier
          const updatedSuppliers = state.suppliers.map((s) =>
            s.id === payment.supplierId
              ? {
                  ...s,
                  currentBalance: Math.max(0, (s.currentBalance || 0) - payment.amount),
                  updatedAt: now,
                }
              : s
          );

          // 2. If PO ID is provided, deduct from PO balanceDue
          let updatedPOs = state.purchaseOrders;
          if (payment.purchaseOrderId) {
            updatedPOs = state.purchaseOrders.map((po) => {
              if (po.id === payment.purchaseOrderId) {
                const newPaid = (po.amountPaid || 0) + payment.amount;
                const newDue = Math.max(0, (po.totalAmount || 0) - newPaid);
                return {
                  ...po,
                  amountPaid: newPaid,
                  balanceDue: newDue,
                  paymentStatus: newDue === 0 ? 'paid' : 'partial',
                };
              }
              return po;
            });
          }

          // 3. Record to expenses if requested
          let nextExpenses = state.expenses;
          if (autoRecordExpense && payment.amount > 0) {
            const supplier = state.suppliers.find((s) => s.id === payment.supplierId);
            nextExpenses = [
              {
                id: uid('ex'),
                category: supplier?.category === 'Meat & Poultry' ? 'Meat & Poultry' : 'Groceries & Produce',
                amount: payment.amount,
                note: `Vendor Payment to ${payment.supplierName}${payment.reference ? ` (Ref: ${payment.reference})` : ''}`,
                method: payment.method === 'online' ? 'online' : 'cash',
                paidBy: payment.paidBy || 'Admin',
                at: now,
              },
              ...nextExpenses,
            ];
          }

          return {
            supplierPayments: [payment, ...state.supplierPayments],
            suppliers: updatedSuppliers,
            purchaseOrders: updatedPOs,
            expenses: nextExpenses,
          };
        });
      },

      deleteSupplierPayment: (id) =>
        set((state) => {
          const payment = state.supplierPayments.find((p) => p.id === id);
          if (!payment) return state;

          const updatedSuppliers = state.suppliers.map((s) =>
            s.id === payment.supplierId
              ? {
                  ...s,
                  currentBalance: (s.currentBalance || 0) + payment.amount,
                  updatedAt: Date.now(),
                }
              : s
          );

          let updatedPOs = state.purchaseOrders;
          if (payment.purchaseOrderId) {
            updatedPOs = state.purchaseOrders.map((po) => {
              if (po.id === payment.purchaseOrderId) {
                const newPaid = Math.max(0, (po.amountPaid || 0) - payment.amount);
                const newDue = Math.max(0, (po.totalAmount || 0) - newPaid);
                return {
                  ...po,
                  amountPaid: newPaid,
                  balanceDue: newDue,
                  paymentStatus: newDue === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid',
                };
              }
              return po;
            });
          }

          return {
            supplierPayments: state.supplierPayments.filter((p) => p.id !== id),
            suppliers: updatedSuppliers,
            purchaseOrders: updatedPOs,
          };
        }),

      // Assets & Capital Purchases
      addAsset: (asset) =>
        set((state) => {
          const now = Date.now();
          const totalCost = asset.totalCost !== undefined ? asset.totalCost : asset.cost * asset.quantity;
          const currentValue = asset.currentValue !== undefined ? asset.currentValue : totalCost;
          const newAsset: Asset = {
            ...asset,
            id: uid('ast'),
            assetCode: asset.assetCode || `AST-${Date.now().toString().slice(-4)}`,
            totalCost,
            currentValue,
            maintenanceLogs: [],
            createdAt: now,
            updatedAt: now,
          };
          return { assets: [newAsset, ...state.assets] };
        }),

      updateAsset: (id, patch) =>
        set((state) => {
          const updated = state.assets.map((ast) => {
            if (ast.id !== id) return ast;
            const cost = patch.cost !== undefined ? patch.cost : ast.cost;
            const quantity = patch.quantity !== undefined ? patch.quantity : ast.quantity;
            const totalCost = patch.totalCost !== undefined ? patch.totalCost : cost * quantity;
            return {
              ...ast,
              ...patch,
              cost,
              quantity,
              totalCost,
              updatedAt: Date.now(),
            };
          });
          return { assets: updated };
        }),

      deleteAsset: (id) =>
        set((state) => ({ assets: state.assets.filter((a) => a.id !== id) })),

      addAssetMaintenanceLog: (assetId, log, options) => {
        const now = Date.now();
        const newLog: AssetMaintenanceLog = {
          ...log,
          id: uid('mlog'),
        };

        let nextExpenses = get().expenses;
        if (options?.autoRecordExpense && log.cost > 0) {
          const targetAsset = get().assets.find((a) => a.id === assetId);
          const assetName = targetAsset ? `[${targetAsset.assetCode}] ${targetAsset.name}` : 'Asset';
          const newExp: Expense = {
            id: uid('exp'),
            category: 'Maintenance & Repair',
            amount: log.cost,
            note: `Maintenance for ${assetName}: ${log.description}`,
            method: 'cash',
            paidBy: options.paidBy || 'Manager',
            at: now,
          };
          nextExpenses = [newExp, ...nextExpenses];
        }

        set((state) => ({
          expenses: nextExpenses,
          assets: state.assets.map((ast) => {
            if (ast.id !== assetId) return ast;
            return {
              ...ast,
              maintenanceLogs: [newLog, ...(ast.maintenanceLogs || [])],
              updatedAt: now,
            };
          }),
        }));
      },

      // Damage Control & Breakages
      logDamageIncident: (record) =>
        set((state) => {
          const now = Date.now();
          const totalLoss = record.totalLoss !== undefined ? record.totalLoss : record.quantity * record.unitCost;
          const amountRecovered = record.amountRecovered || 0;
          const netLoss = record.netLoss !== undefined ? record.netLoss : Math.max(0, totalLoss - amountRecovered);
          const newDmg: DamageRecord = {
            ...record,
            id: uid('dmg'),
            incidentCode: record.incidentCode || `DMG-${Date.now().toString().slice(-4)}`,
            totalLoss,
            amountRecovered,
            netLoss,
            createdAt: now,
          };
          return { damageRecords: [newDmg, ...state.damageRecords] };
        }),

      updateDamageRecord: (id, patch) =>
        set((state) => {
          const updated = state.damageRecords.map((d) => {
            if (d.id !== id) return d;
            const quantity = patch.quantity !== undefined ? patch.quantity : d.quantity;
            const unitCost = patch.unitCost !== undefined ? patch.unitCost : d.unitCost;
            const totalLoss = patch.totalLoss !== undefined ? patch.totalLoss : quantity * unitCost;
            const amountRecovered = patch.amountRecovered !== undefined ? patch.amountRecovered : d.amountRecovered;
            const netLoss = Math.max(0, totalLoss - amountRecovered);
            return {
              ...d,
              ...patch,
              quantity,
              unitCost,
              totalLoss,
              amountRecovered,
              netLoss,
            };
          });
          return { damageRecords: updated };
        }),

      deleteDamageRecord: (id) =>
        set((state) => ({ damageRecords: state.damageRecords.filter((d) => d.id !== id) })),

      resolveDamageRecord: (id, resolution) =>
        set((state) => {
          const updated = state.damageRecords.map((d) => {
            if (d.id !== id) return d;
            const amountRecovered = resolution.amountRecovered !== undefined ? resolution.amountRecovered : d.amountRecovered;
            const netLoss = Math.max(0, d.totalLoss - amountRecovered);
            return {
              ...d,
              actionTaken: resolution.actionTaken,
              status: resolution.status || 'approved_writeoff',
              amountRecovered,
              netLoss,
              notes: resolution.notes !== undefined ? resolution.notes : d.notes,
              resolvedAt: Date.now(),
            };
          });
          return { damageRecords: updated };
        }),

      syncFromServer: (remote) =>
        set((state) => {
          const next: Partial<OpsData> = {};
          if (Array.isArray(remote.serviceRequests)) next.serviceRequests = remote.serviceRequests;
          if (Array.isArray(remote.inventory)) next.inventory = remote.inventory;
          if (Array.isArray(remote.stockMovements)) next.stockMovements = remote.stockMovements;
          if (Array.isArray(remote.expenses)) next.expenses = remote.expenses;
          if (Array.isArray(remote.feedback)) next.feedback = remote.feedback;
          if (Array.isArray(remote.unavailableItemIds)) next.unavailableItemIds = remote.unavailableItemIds;
          if (Array.isArray(remote.suppliers)) next.suppliers = remote.suppliers;
          if (Array.isArray(remote.purchaseOrders)) next.purchaseOrders = remote.purchaseOrders;
          if (Array.isArray(remote.supplierPayments)) next.supplierPayments = remote.supplierPayments;
          if (Array.isArray(remote.assets)) next.assets = remote.assets;
          if (Array.isArray(remote.damageRecords)) next.damageRecords = remote.damageRecords;
          return { ...state, ...next };
        }),
    }),
    {
      name: 'ops-storage',
      storage: appStorage,
    }
  )
);

/** Snapshot of the data keys to push to the sync hub. */
export function getOpsSyncState(): OpsData {
  const s = useOpsStore.getState();
  return {
    serviceRequests: s.serviceRequests,
    inventory: s.inventory,
    stockMovements: s.stockMovements,
    expenses: s.expenses,
    feedback: s.feedback,
    unavailableItemIds: s.unavailableItemIds,
    suppliers: s.suppliers,
    purchaseOrders: s.purchaseOrders,
    supplierPayments: s.supplierPayments,
    assets: s.assets,
    damageRecords: s.damageRecords,
  };
}
