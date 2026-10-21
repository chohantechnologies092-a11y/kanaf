import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

export type Table = {
  id: string;
  name: string;
  floor?: string;
  zone: string;
  seatingType?: 'tables' | 'couches' | 'majlis';
  cabinNumber?: string;
  seats: number;
  status: 'available' | 'occupied' | 'billed' | 'reserved';
  server?: string;
  billTotal?: number;
  orders?: OrderItem[];
  isPaid?: boolean;
  lastInvoiceId?: string;
  occupiedSince?: number;
  reservationId?: string;
  /** If set, this table is physically joined to the given primary table (merged reservation / big party). */
  mergedInto?: string;
  x?: number;
  y?: number;
  shape?: 'square' | 'round' | 'rectangle';
};

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
  completed: boolean;
  station?: 'main' | 'juice';
};

export type Ticket = {
  id: string;
  tableId: string;
  tableName: string;
  server: string;
  timePlaced: number;
  status: 'cooking' | 'ready' | 'served';
  items: OrderItem[];
  isAddOn?: boolean;
  roundNumber?: number;
};

export type MenuVariant = {
  name: string;
  price: number;
};

export type ComboItem = {
  menuItemId: string;
  name: string;
  qty: number;
  price?: number;
  variantName?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  variants?: MenuVariant[];
  station?: 'main' | 'juice';
  // Option 3: Image & Visuals
  imageUri?: string;
  description?: string;
  badge?: string; // e.g., 'Chef Special', 'Best Seller', 'Family Deal', 'Discount 20%'
  // Option 4: Inventory, Cost & Profit Margin Tracking
  costPrice?: number;
  trackStock?: boolean;
  stockQty?: number;
  lowStockThreshold?: number;
  // Option 5: Deals & Combo Packs
  isDeal?: boolean;
  dealItems?: ComboItem[];
  dealOriginalPrice?: number;
};

export type CustomerTier = 'Regular' | 'Silver' | 'Gold' | 'VIP';

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tier?: CustomerTier;
  notes?: string;
  tags?: string[];
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints?: number;
  firstVisit?: number;
  lastVisit?: number;
  favoriteDishes?: string[];
};

export type ItemFeedback = {
  itemId: string;
  itemName: string;
  rating: number; // 1 to 5 stars
  tags?: string[]; // e.g. ['Delicious', 'Served Hot', 'Too Spicy', etc.]
  comment?: string;
};

export type InvoiceFeedback = {
  id: string;
  invoiceId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  overallRating: number; // 1 to 5 stars
  serviceRating?: number; // 1 to 5 stars
  ambianceRating?: number; // 1 to 5 stars
  items: ItemFeedback[];
  generalComments?: string;
  createdAt: number;
  status?: 'published' | 'reviewed';
};

export type Payment = {
  type: 'cash' | 'card' | 'online';
  amount: number;
};

export * from '../types/returns';
import type { SalesReturn } from '../types/returns';

export type Invoice = {
  id: string;
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  tableId?: string;
  tableName?: string;
  customer?: Customer;
  server: string;
  orderTakenBy?: string;
  cashier?: string;
  timePlaced: number;
  timeSettled: number;
  items: OrderItem[];
  subTotal: number;
  discount: number;
  discountEventId?: string;
  discountEventTitle?: string;
  tax: number;
  total: number;
  payments: Payment[];
  status?: 'settled' | 'voided' | 'refunded';
  voidReason?: string;
  voidedAt?: number;
  voidedBy?: string;
  notes?: string;
  refundAmount?: number;
  returnStatus?: 'none' | 'partial' | 'full';
  returnIds?: string[];
  feedback?: InvoiceFeedback;
  feedbackSubmitted?: boolean;
};

export type StaffRole = 'Admin' | 'Manager' | 'Waiter' | 'Kitchen' | 'JuiceBar' | 'Playland' | string;
export type StaffShift = 'Morning' | 'Evening' | 'Night';
export type StaffStatus = 'Active' | 'On Leave' | 'Inactive';

export type StaffMember = {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  pin: string;
  status: StaffStatus;
  shift: StaffShift;
  joinedDate?: string;
  assignedZone?: string;
  assignedZones?: string[];
  customRoleId?: string;
};

export type Reservation = {
  id: string;
  tableId: string;
  tableName: string;
  /** Extra available tables merged with the primary table for large parties. */
  linkedTableIds?: string[];
  customerName: string;
  phone: string;
  guestsCount: number;
  reservationDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "08:00 PM"
  status: 'confirmed' | 'seated' | 'cancelled';
  notes?: string;
  createdAt: number;
};

export type Floor = {
  id: string;
  name: string;
  shortCode: string;
  prefix: string;
  color: string;
  icon: string;
  description?: string;
  order?: number;
};

type RestaurantState = {
  tables: Table[];
  tickets: Ticket[];
  invoices: Invoice[];
  customers: Customer[];
  staff: StaffMember[];
  menuItems: MenuItem[];
  categories: string[];
  zones: string[];
  floors: Floor[];
  reservations: Reservation[];
  lastBillPaidAlert?: { tableId: string; tableName: string; billTotal: number; time: number } | null;
  
  // Actions
  placeOrder: (tableId: string, serverName: string, items: {item: MenuItem, qty: number, notes?: string}[], isAddOn?: boolean) => void;
  toggleTicketItem: (ticketId: string, itemId: string) => void;
  bumpTicket: (ticketId: string) => void;
  updateTicketStatus: (ticketId: string, status: Ticket['status']) => void;
  serveTableTickets: (tableId: string) => void;
  markTableBilled: (tableId: string, invoiceId?: string) => void;
  clearBillPaidAlert: (tableIdOrName?: string) => void;
  settleBill: (tableId: string) => void;
  transferTable: (fromTableId: string, toTableId: string) => void;
  mergeTables: (primaryTableId: string, secondaryTableId: string) => void;
  assignTableServer: (tableId: string, serverName: string) => void;
  addReservation: (res: Omit<Reservation, 'id' | 'createdAt' | 'status'> & { status?: Reservation['status'] }) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  cancelReservation: (id: string) => void;
  seatReservation: (reservationId: string) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, item: Partial<Omit<MenuItem, 'id'>>) => void;
  deleteMenuItem: (id: string) => void;
  adjustMenuItemStock: (id: string, deltaOrQuantity: number, mode?: 'set' | 'add') => void;
  addCategory: (categoryName: string) => void;
  deleteCategory: (categoryName: string) => void;
  addTable: (table: Omit<Table, 'id' | 'status'> & { status?: Table['status'] }) => void;
  updateTable: (id: string, table: Partial<Omit<Table, 'id'>>) => void;
  deleteTable: (id: string) => void;
  addFloor: (floor: Omit<Floor, 'id'>) => void;
  updateFloor: (id: string, updates: Partial<Omit<Floor, 'id'>>) => void;
  deleteFloor: (id: string, cascadeDeleteTables?: boolean) => void;
  addZone: (zoneName: string) => void;
  deleteZone: (zoneName: string) => void;
  salesReturns: SalesReturn[];
  saveInvoice: (invoice: Invoice) => void;
  voidInvoice: (invoiceId: string, reason?: string, voidedBy?: string) => void;
  deleteInvoice: (invoiceId: string) => void;
  processSalesReturn: (input: Omit<SalesReturn, 'id' | 'returnedAt' | 'status'> & { id?: string }) => { ok: true; id: string } | { ok: false; error: string };
  cancelSalesReturn: (returnId: string, by: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  feedbacks: InvoiceFeedback[];
  addFeedback: (feedback: Omit<InvoiceFeedback, 'id' | 'createdAt'>) => void;
  deleteFeedback: (id: string) => void;
  addStaff: (staff: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, staff: Partial<Omit<StaffMember, 'id'>>) => void;
  deleteStaff: (id: string) => void;
  onlineFeedbackUrl?: string;
  setOnlineFeedbackUrl: (url: string) => void;
  syncFromServer: (remoteState: Partial<RestaurantState>) => void;
};

export const INITIAL_FLOORS: Floor[] = [
  {
    id: 'fl-gf',
    name: 'Ground Floor',
    shortCode: 'GF',
    prefix: 'G',
    color: '#2E7D32',
    icon: 'restaurant-outline',
    description: 'Family dining hall & takeaway counter',
    order: 1,
  },
  {
    id: 'fl-1f',
    name: '1st Floor',
    shortCode: '1F',
    prefix: 'F1',
    color: '#1976D2',
    icon: 'people-outline',
    description: 'Family hall, Couches & Traditional Majlis',
    order: 2,
  },
  {
    id: 'fl-2f',
    name: '2nd Floor',
    shortCode: '2F',
    prefix: 'F2',
    color: '#6A1B9A',
    icon: 'sparkles-outline',
    description: 'Banquet hall & Executive lounges',
    order: 3,
  },
  {
    id: 'fl-3f',
    name: '3rd Floor',
    shortCode: '3F',
    prefix: 'F3',
    color: '#B8860B',
    icon: 'diamond-outline',
    description: 'VIP lounges, Royal Majlis & Private rooms',
    order: 4,
  },
  {
    id: 'fl-rt',
    name: 'Rooftop',
    shortCode: 'RT',
    prefix: 'R',
    color: '#E65100',
    icon: 'moon-outline',
    description: 'Open-air BBQ & Sky Majlis',
    order: 5,
  },
];

// Initial Mock Data
const INITIAL_TABLES: Table[] = [
  // Ground Floor
  { id: '1', floor: 'Ground Floor', zone: 'Ground Floor', seatingType: 'tables', name: 'T-01', seats: 4, status: 'available' },
  { id: '2', floor: 'Ground Floor', zone: 'Ground Floor', seatingType: 'tables', name: 'T-02', seats: 4, status: 'occupied', billTotal: 2500, server: 'Junaid' },
  { id: '3', floor: 'Ground Floor', zone: 'Ground Floor', seatingType: 'couches', name: 'Couch 1', seats: 6, status: 'available' },
  { id: '4', floor: 'Ground Floor', zone: 'Ground Floor', seatingType: 'majlis', cabinNumber: 'Cabin 1', name: 'Cabin 1', seats: 8, status: 'available' },
  { id: '5', floor: 'Ground Floor', zone: 'Ground Floor', seatingType: 'majlis', cabinNumber: 'Cabin 2', name: 'Cabin 2', seats: 10, status: 'available' },

  // 1st Floor
  { id: 'f1-t1', floor: '1st Floor', zone: '1st Floor', seatingType: 'tables', name: 'F1-T01', seats: 4, status: 'available' },
  { id: 'f1-t2', floor: '1st Floor', zone: '1st Floor', seatingType: 'tables', name: 'F1-T02', seats: 6, status: 'available' },
  { id: 'f1-c1', floor: '1st Floor', zone: '1st Floor', seatingType: 'couches', name: 'Couch 1', seats: 6, status: 'available' },
  { id: 'f1-c2', floor: '1st Floor', zone: '1st Floor', seatingType: 'couches', name: 'Couch 2', seats: 6, status: 'occupied', billTotal: 4800, server: 'Sara Ahmed' },
  { id: 'f1-m1', floor: '1st Floor', zone: '1st Floor', seatingType: 'majlis', cabinNumber: 'Cabin 1', name: 'Cabin 1', seats: 8, status: 'available' },
  { id: 'f1-m2', floor: '1st Floor', zone: '1st Floor', seatingType: 'majlis', cabinNumber: 'Cabin 2', name: 'Cabin 2', seats: 10, status: 'occupied', billTotal: 12500, server: 'Hamza' },
  { id: 'f1-m3', floor: '1st Floor', zone: '1st Floor', seatingType: 'majlis', cabinNumber: 'Cabin 3', name: 'Cabin 3', seats: 12, status: 'available' },
  { id: 'f1-m4', floor: '1st Floor', zone: '1st Floor', seatingType: 'majlis', cabinNumber: 'Cabin 4', name: 'Cabin 4', seats: 6, status: 'reserved', reservationId: 'res-1' },

  // Rooftop
  { id: 'rt-1', floor: 'Rooftop', zone: 'Rooftop', seatingType: 'tables', name: 'R-01', seats: 4, status: 'available' },
  { id: 'rt-2', floor: 'Rooftop', zone: 'Rooftop', seatingType: 'majlis', cabinNumber: 'Cabin 1', name: 'Sky Cabin 1', seats: 8, status: 'available' },
];

const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res-1',
    tableId: 'f1-m4',
    tableName: 'Cabin 4',
    customerName: 'Hamza Malik',
    phone: '03219988776',
    guestsCount: 6,
    reservationDate: new Date().toISOString().split('T')[0],
    timeSlot: '08:30 PM',
    status: 'confirmed',
    notes: 'Birthday celebration, requested quiet corner',
    createdAt: Date.now() - 3600000,
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  { 
    id: 'c1', 
    name: 'Zubair Tariq', 
    phone: '03009876543', 
    email: 'zubair.tariq@gmail.com',
    address: 'DHA Phase 5, Lahore', 
    tier: 'VIP',
    notes: 'Prefers Family Majlis Cabin. Likes low spice in Karahi.',
    tags: ['VIP', 'Family Majlis', 'High Spender'],
    totalOrders: 14, 
    totalSpent: 38400,
    loyaltyPoints: 380,
    firstVisit: Date.now() - 45 * 86400000,
    lastVisit: Date.now() - 2 * 86400000,
    favoriteDishes: ['Chicken Karahi', 'Sultan Kebab']
  },
  { 
    id: 'c2', 
    name: 'Fatima Noor', 
    phone: '03214567890', 
    email: 'fatima.noor@outlook.com',
    address: 'Gulberg III, Lahore', 
    tier: 'Gold',
    notes: 'Regular weekend diner. Enjoys fresh mint margaritas.',
    tags: ['Gold', 'Weekend Regular'],
    totalOrders: 6, 
    totalSpent: 16200,
    loyaltyPoints: 160,
    firstVisit: Date.now() - 30 * 86400000,
    lastVisit: Date.now() - 5 * 86400000,
    favoriteDishes: ['Mint Margarita', 'Kunafa']
  },
  { 
    id: 'c3', 
    name: 'Bilal Siddiqui', 
    phone: '03331122334', 
    email: 'bilal.s@yahoo.com',
    address: 'Model Town, Block C', 
    tier: 'Silver',
    notes: 'Corporate lunches on weekdays.',
    tags: ['Silver', 'Corporate'],
    totalOrders: 3, 
    totalSpent: 7500,
    loyaltyPoints: 75,
    firstVisit: Date.now() - 20 * 86400000,
    lastVisit: Date.now() - 10 * 86400000,
    favoriteDishes: ['Fajita Pizza (Medium)']
  },
  { 
    id: 'c4', 
    name: 'Dr. Ayesha Imran', 
    phone: '03028889900', 
    email: 'ayesha.imran@health.pk',
    address: 'Bahria Town, Sector C', 
    tier: 'VIP',
    notes: 'Requests extra garlic naan with Mutton Karahi.',
    tags: ['VIP', 'Doctor'],
    totalOrders: 19, 
    totalSpent: 52600,
    loyaltyPoints: 520,
    firstVisit: Date.now() - 60 * 86400000,
    lastVisit: Date.now() - 1 * 86400000,
    favoriteDishes: ['Mutton Shinwari Karahi', 'Sultan Special Roghni Naan']
  },
  { 
    id: 'c5', 
    name: 'Usman Ghani', 
    phone: '03456781234', 
    address: 'Johar Town, Phase 1', 
    tier: 'Regular',
    notes: 'Takeaway orders mostly.',
    tags: ['Takeaway Frequent'],
    totalOrders: 4, 
    totalSpent: 5400,
    loyaltyPoints: 50,
    firstVisit: Date.now() - 15 * 86400000,
    lastVisit: Date.now() - 3 * 86400000,
    favoriteDishes: ['Chicken Dum Biryani Special']
  },
];

const INITIAL_FEEDBACKS: InvoiceFeedback[] = [
  {
    id: 'fb-1',
    invoiceId: 'INV-1090',
    customerId: 'c1',
    customerName: 'Zubair Tariq',
    customerPhone: '03009876543',
    overallRating: 5,
    serviceRating: 5,
    ambianceRating: 5,
    items: [
      { itemId: 'm2', itemName: 'Chicken Karahi', rating: 5, tags: ['Delicious', 'Served Hot'], comment: 'Desi ghee flavor was exceptional.' },
      { itemId: 'm1', itemName: 'Sultan Kebab', rating: 5, tags: ['Authentic Taste'] },
    ],
    generalComments: 'Sultan restaurant provides an unmatched royal family dining experience. Server Hamza was very attentive.',
    createdAt: Date.now() - 86400000,
    status: 'published'
  },
  {
    id: 'fb-2',
    invoiceId: 'INV-1092',
    customerId: 'c2',
    customerName: 'Fatima Noor',
    customerPhone: '03214567890',
    overallRating: 4,
    serviceRating: 5,
    ambianceRating: 4,
    items: [
      { itemId: 'm5', itemName: 'Mint Margarita', rating: 5, tags: ['Refreshing'] },
      { itemId: 'm4', itemName: 'Kunafa', rating: 4, tags: ['Delicious'] },
    ],
    generalComments: 'Beverages and desserts were mouth watering! Will return with family this weekend.',
    createdAt: Date.now() - 43200000,
    status: 'published'
  }
];

const INITIAL_MENU: MenuItem[] = [
  {
    id: 'm1',
    name: 'Sultan Kebab',
    price: 1450,
    costPrice: 650,
    category: 'Mains',
    imageUri: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&q=80',
    description: 'Tender minced mutton & beef grilled with royal Sultan spices on open charcoal.',
    badge: 'Chef Special',
    trackStock: true,
    stockQty: 35,
    lowStockThreshold: 10,
    station: 'main'
  },
  {
    id: 'm2',
    name: 'Chicken Karahi',
    price: 1850,
    costPrice: 820,
    category: 'Mains',
    imageUri: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80',
    description: 'Fresh chicken cooked in pure desi ghee, fresh tomatoes, ginger and green chillies.',
    badge: 'Best Seller',
    trackStock: true,
    stockQty: 22,
    lowStockThreshold: 5,
    station: 'main'
  },
  {
    id: 'm3',
    name: 'Hummus & Pita',
    price: 650,
    costPrice: 220,
    category: 'Appetizers',
    imageUri: 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=600&q=80',
    description: 'Creamy chickpea dip with extra virgin olive oil and freshly baked pita bread.',
    badge: 'Healthy',
    trackStock: true,
    stockQty: 40,
    lowStockThreshold: 10,
    station: 'main'
  },
  {
    id: 'm4',
    name: 'Kunafa',
    price: 850,
    costPrice: 320,
    category: 'Desserts',
    imageUri: 'https://images.unsplash.com/photo-1608836561226-d621b10a26e8?w=600&q=80',
    description: 'Crunchy golden pastry filled with stretchy sweet cheese, soaked in rose syrup & pistachios.',
    badge: 'Signature',
    trackStock: true,
    stockQty: 18,
    lowStockThreshold: 6,
    station: 'main'
  },
  {
    id: 'm5',
    name: 'Mint Margarita',
    price: 450,
    costPrice: 120,
    category: 'Drinks',
    imageUri: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80',
    description: 'Blended fresh mint leaves, lemon juice, soda and crushed ice.',
    badge: 'Chilled',
    trackStock: true,
    stockQty: 50,
    lowStockThreshold: 15,
    station: 'juice'
  },
  { 
    id: 'm6', 
    name: 'Fajita Pizza', 
    price: 1400,
    costPrice: 550,
    category: 'Mains',
    imageUri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80',
    description: 'Crispy crust loaded with fajita chicken, bell peppers, olives and mozzarella.',
    badge: 'Popular',
    trackStock: false,
    station: 'main',
    variants: [
      { name: 'Small (7")', price: 850 },
      { name: 'Medium (10")', price: 1400 },
      { name: 'Large (13")', price: 1950 },
      { name: 'Family (16")', price: 2500 }
    ]
  },
  {
    id: 'm7',
    name: 'Mutton Ribs',
    price: 3500,
    costPrice: 1800,
    category: 'Mains',
    imageUri: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
    description: 'Slow-smoked juicy mutton ribs marinated in Sultan royal rub.',
    badge: 'Signature',
    trackStock: true,
    stockQty: 8,
    lowStockThreshold: 4,
    station: 'main',
    variants: [
      { name: 'Half KG', price: 3500 },
      { name: '1 KG', price: 6800 }
    ]
  },
  {
    id: 'deal1',
    name: 'Sultan Family Feast (4-5 Persons)',
    price: 4999,
    costPrice: 2300,
    category: 'Deals',
    imageUri: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
    description: 'Complete family banquet: 1x Chicken Karahi + 2x Sultan Kebabs + 1x Medium Pizza + 2x Mint Margaritas + 1x Kunafa Dessert.',
    badge: 'Family Deal',
    isDeal: true,
    dealOriginalPrice: 6050,
    dealItems: [
      { menuItemId: 'm2', name: 'Chicken Karahi', qty: 1, price: 1850 },
      { menuItemId: 'm1', name: 'Sultan Kebab', qty: 2, price: 1450 },
      { menuItemId: 'm6', name: 'Fajita Pizza (Medium)', qty: 1, price: 1400 },
      { menuItemId: 'm5', name: 'Mint Margarita', qty: 2, price: 450 },
      { menuItemId: 'm4', name: 'Kunafa', qty: 1, price: 850 }
    ],
    trackStock: true,
    stockQty: 15,
    lowStockThreshold: 5,
    station: 'main'
  },
  {
    id: 'deal2',
    name: 'Royal Couple Platter (2 Persons)',
    price: 2850,
    costPrice: 1250,
    category: 'Deals',
    imageUri: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
    description: 'Perfect for two: 2x Sultan Kebabs + 1x Hummus & Pita + 2x Mint Margaritas + 1x Kunafa Dessert.',
    badge: 'Couple Deal',
    isDeal: true,
    dealOriginalPrice: 3400,
    dealItems: [
      { menuItemId: 'm1', name: 'Sultan Kebab', qty: 2, price: 1450 },
      { menuItemId: 'm3', name: 'Hummus & Pita', qty: 1, price: 650 },
      { menuItemId: 'm5', name: 'Mint Margarita', qty: 2, price: 450 },
      { menuItemId: 'm4', name: 'Kunafa', qty: 1, price: 850 }
    ],
    trackStock: true,
    stockQty: 20,
    lowStockThreshold: 5,
    station: 'main'
  }
];

const INITIAL_STAFF: StaffMember[] = [
  { id: 'st1', name: 'Junaid Ahsan', phone: '+92 300 1234567', role: 'Admin', pin: '1122', status: 'Active', shift: 'Morning', joinedDate: '2025-01-15' },
  { id: 'st2', name: 'Ali Khan', phone: '+92 301 7654321', role: 'Manager', pin: '2233', status: 'Active', shift: 'Morning', joinedDate: '2025-02-01' },
  { id: 'st3', name: 'Chef Omar', phone: '+92 302 9876543', role: 'Kitchen', pin: '3344', status: 'Active', shift: 'Evening', joinedDate: '2025-03-10' },
  { id: 'st4', name: 'Sara Ahmed', phone: '+92 303 5556677', role: 'Waiter', pin: '4455', status: 'Active', shift: 'Evening', joinedDate: '2025-04-05', assignedZone: 'Ground Floor', assignedZones: ['Ground Floor'] },
  { id: 'st5', name: 'Hamza Malik', phone: '+92 304 4443322', role: 'Waiter', pin: '5566', status: 'On Leave', shift: 'Night', joinedDate: '2025-05-12', assignedZone: '1st Floor', assignedZones: ['1st Floor'] },
  { id: 'st6', name: 'Ali Raza', phone: '+92 305 9988776', role: 'Playland', pin: '1234', status: 'Active', shift: 'Evening', joinedDate: '2025-06-01' },
];

/**
 * Reconciles tables with active tickets:
 * If a table has active tickets (cooking, ready, or unbilled served orders),
 * its status MUST be 'occupied' with its active bill and server preserved,
 * preventing any race condition where a table displays as 'available' while food is in progress.
 */
export function reconcileTablesWithTickets(tables: Table[], tickets: Ticket[]): Table[] {
  if (!tables || !Array.isArray(tables)) return [];
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  // Guarantee every table has a unique ID across the application
  const seenIds = new Map<string, number>();
  const sanitizedTables = tables.map((t, idx) => {
    const rawId = t.id || `t_${idx}`;
    const count = seenIds.get(rawId) || 0;
    seenIds.set(rawId, count + 1);
    if (count > 0) {
      return { ...t, id: `${rawId}_${count + 1}` };
    }
    return { ...t, id: rawId };
  });

  return sanitizedTables.map(table => {
    // If table is already marked billed, preserve billed state until settled
    if (table.status === 'billed') return table;

    const tableTickets = safeTickets.filter(t => t.tableId === table.id);
    const activeCookingOrReady = tableTickets.filter(t => t.status === 'cooking' || t.status === 'ready');
    const hasUnbilledTickets = tableTickets.some(t => t.status === 'cooking' || t.status === 'ready' || t.status === 'served');

    if (activeCookingOrReady.length > 0 || (hasUnbilledTickets && !table.isPaid)) {
      const ticketTotal = tableTickets.reduce((sum, t) =>
        sum + (t.items || []).reduce((itemSum, item) => itemSum + ((item.price || 0) * (item.qty || 1)), 0),
        0
      );

      const orders = (table.orders && table.orders.length > 0)
        ? table.orders
        : tableTickets.flatMap(t => (t.items || []).map(i => ({ ...i })));

      const serverName = table.server || (tableTickets.length > 0 ? tableTickets[tableTickets.length - 1].server : undefined);

      return {
        ...table,
        status: 'occupied',
        billTotal: (table.billTotal && table.billTotal > 0) ? table.billTotal : ticketTotal,
        orders,
        server: serverName || table.server,
        isPaid: false,
      };
    }

    return table;
  });
}

function notifySync() {
  try {
    const { broadcastImmediately } = require('../services/syncService');
    if (typeof broadcastImmediately === 'function') {
      broadcastImmediately();
    }
  } catch (e) {}
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set) => ({
      tables: INITIAL_TABLES,
      invoices: [],
      salesReturns: [],
      customers: INITIAL_CUSTOMERS,
      feedbacks: INITIAL_FEEDBACKS,
      staff: INITIAL_STAFF,
      reservations: INITIAL_RESERVATIONS,
      tickets: [
        {
          id: 'KOT-1042',
          tableId: '2',
          tableName: 'T-02',
          server: 'Junaid',
          timePlaced: Date.now() - 12 * 60000,
          status: 'cooking',
          items: [
            { id: 'm1', name: 'Sultan Kebab', price: 15.99, qty: 2, completed: false },
          ]
        }
      ],
      menuItems: INITIAL_MENU,
      categories: ['Appetizers', 'Mains', 'Desserts', 'Drinks', 'Deals'],
      zones: INITIAL_FLOORS.map(f => f.name),
      floors: INITIAL_FLOORS,

      placeOrder: (tableId, serverName, orderItems, isAddOn) => set((state) => {
        const table = state.tables.find(t => t.id === tableId);
        const existingTickets = state.tickets.filter(t => t.tableId === tableId);
        const isActuallyAddOn = isAddOn !== undefined ? isAddOn : existingTickets.length > 0;
        const roundNumber = existingTickets.length + 1;
        
        const newTicketId = `KOT-${Math.floor(Math.random() * 9000) + 1000}`;
        const itemsTotal = orderItems.reduce((sum, i) => sum + (i.item.price * i.qty), 0);

        const newTicket: Ticket = {
          id: newTicketId,
          tableId, // can be dummy like 'takeaway' or actual tableId
          tableName: table ? (isActuallyAddOn ? `${table.name} (Add-on #${roundNumber})` : table.name) : (tableId === 'delivery' ? 'Delivery' : 'Takeaway'),
          server: serverName,
          timePlaced: Date.now(),
          status: 'cooking',
          isAddOn: isActuallyAddOn,
          roundNumber: isActuallyAddOn ? roundNumber : 1,
          items: orderItems.map(oi => ({
            id: oi.item.id,
            name: oi.item.name,
            price: oi.item.price,
            qty: oi.qty,
            notes: oi.notes,
            completed: false,
            station: oi.item.station || 'main'
          }))
        };

        const updatedMenuItems = state.menuItems.map(m => {
          if (!m.trackStock || typeof m.stockQty !== 'number') return m;
          const matchingQty = orderItems
            .filter(oi => oi.item.id === m.id || oi.item.id.startsWith(`${m.id}-`))
            .reduce((sum, oi) => sum + oi.qty, 0);

          if (matchingQty > 0) {
            return { ...m, stockQty: Math.max(0, m.stockQty - matchingQty) };
          }
          return m;
        });

        return {
          tickets: [...state.tickets, newTicket],
          menuItems: updatedMenuItems,
          tables: table 
            ? state.tables.map(t => {
                if (t.id !== tableId) return t;
                const existingOrders = t.orders || [];
                const mergedOrders = existingOrders.map(o => ({ ...o }));
                orderItems.forEach(oi => {
                  const found = mergedOrders.find(m => m.id === oi.item.id);
                  if (found) {
                    found.qty += oi.qty;
                  } else {
                    mergedOrders.push({
                      id: oi.item.id,
                      name: oi.item.name,
                      price: oi.item.price,
                      qty: oi.qty,
                      notes: oi.notes,
                      completed: false
                    });
                  }
                });
                return {
                  ...t,
                  status: 'occupied',
                  server: serverName,
                  billTotal: (t.billTotal || 0) + itemsTotal,
                  orders: mergedOrders
                };
              })
            : state.tables
        };
      }),

      toggleTicketItem: (ticketId, itemId) => set((state) => ({
        tickets: state.tickets.map(t => {
          if (t.id === ticketId) {
            return {
              ...t,
              items: t.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i)
            };
          }
          return t;
        })
      })),

      bumpTicket: (ticketId) => set((state) => {
        const ticket = state.tickets.find(t => t.id === ticketId);
        if (!ticket) return state;

        return {
          tickets: state.tickets.map(t => t.id === ticketId ? { ...t, status: 'served' } : t),
        };
      }),

      updateTicketStatus: (ticketId, status) => set((state) => ({
        tickets: state.tickets.map(t => t.id === ticketId ? { ...t, status } : t)
      })),

      serveTableTickets: (tableId) => set((state) => {
        const hasReady = state.tickets.some(t => t.tableId === tableId && t.status === 'ready');
        if (!hasReady) return state;

        const updatedTickets = state.tickets.map(t =>
          (t.tableId === tableId && t.status === 'ready') ? { ...t, status: 'served' as const } : t
        );

        return {
          tickets: updatedTickets,
          tables: state.tables.map(t => 
            t.id === tableId && t.status !== 'billed' ? { ...t, status: 'occupied' } : t
          ),
        };
      }),

      markTableBilled: (tableId, invoiceId) => set((state) => {
        const table = state.tables.find(t => t.id === tableId);
        const amount = table?.billTotal || 0;
        const tableName = table ? table.name : `Table ${tableId}`;

        return {
          tables: state.tables.map(t => 
            t.id === tableId ? { 
              ...t, 
              status: 'billed', 
              isPaid: true, 
              lastInvoiceId: invoiceId 
            } : t
          ),
          lastBillPaidAlert: {
            tableId,
            tableName,
            billTotal: amount,
            time: Date.now()
          }
        };
      }),

      clearBillPaidAlert: (tableIdOrName?: string) => set((state) => {
        if (!tableIdOrName) {
          return { lastBillPaidAlert: null };
        }
        const alert = state.lastBillPaidAlert;
        if (!alert) return { lastBillPaidAlert: null };
        const query = tableIdOrName.trim().toLowerCase();
        const matches =
          alert.tableId.toLowerCase() === query ||
          alert.tableName.trim().toLowerCase() === query;
        return { lastBillPaidAlert: matches ? null : alert };
      }),

      settleBill: (tableId) => set((state) => {
        const targetTable = state.tables.find(t => t.id === tableId);
        const targetTableName = targetTable?.name;
        const alert = state.lastBillPaidAlert;
        const matchesAlert = alert && (
          alert.tableId === tableId ||
          (targetTableName && alert.tableName.trim().toLowerCase() === targetTableName.trim().toLowerCase())
        );

        return {
          tables: state.tables.map(t => 
            (t.id === tableId || t.mergedInto === tableId) ? { 
              ...t, 
              status: 'available', 
              billTotal: 0, 
              server: undefined, 
              orders: [], 
              isPaid: false, 
              lastInvoiceId: undefined,
              occupiedSince: undefined,
              mergedInto: undefined,
              reservationId: undefined,
            } : t
          ),
          tickets: state.tickets.filter(t => t.tableId !== tableId),
          lastBillPaidAlert: matchesAlert ? null : state.lastBillPaidAlert
        };
      }),

      transferTable: (fromTableId, toTableId) => set((state) => {
        const fromTable = state.tables.find(t => t.id === fromTableId);
        const toTable = state.tables.find(t => t.id === toTableId);
        if (!fromTable || !toTable || toTable.status === 'occupied' || toTable.status === 'billed') {
          return state;
        }

        const updatedTables = state.tables.map(t => {
          if (t.id === toTableId) {
            return {
              ...t,
              status: fromTable.status,
              billTotal: fromTable.billTotal || 0,
              orders: fromTable.orders ? [...fromTable.orders] : [],
              server: fromTable.server,
              isPaid: fromTable.isPaid,
              lastInvoiceId: fromTable.lastInvoiceId,
              occupiedSince: fromTable.occupiedSince || Date.now(),
            };
          }
          if (t.id === fromTableId) {
            return {
              ...t,
              status: 'available' as const,
              billTotal: 0,
              orders: [],
              server: undefined,
              isPaid: false,
              lastInvoiceId: undefined,
              occupiedSince: undefined,
            };
          }
          return t;
        });

        const updatedTickets = state.tickets.map(tk => {
          if (tk.tableId === fromTableId) {
            return {
              ...tk,
              tableId: toTableId,
              tableName: `${toTable.name} (from ${fromTable.name})`
            };
          }
          return tk;
        });

        let updatedAlert = state.lastBillPaidAlert;
        if (updatedAlert && updatedAlert.tableId === fromTableId) {
          updatedAlert = {
            ...updatedAlert,
            tableId: toTableId,
            tableName: toTable.name
          };
        }

        return {
          tables: updatedTables,
          tickets: updatedTickets,
          lastBillPaidAlert: updatedAlert
        };
      }),

      mergeTables: (primaryTableId, secondaryTableId) => set((state) => {
        const primary = state.tables.find(t => t.id === primaryTableId);
        const secondary = state.tables.find(t => t.id === secondaryTableId);
        if (!primary || !secondary) return state;

        // Combine orders
        const combinedOrders = (primary.orders || []).map(o => ({ ...o }));
        (secondary.orders || []).forEach(secItem => {
          const found = combinedOrders.find(o => o.id === secItem.id);
          if (found) {
            found.qty += secItem.qty;
          } else {
            combinedOrders.push({ ...secItem });
          }
        });

        const newBillTotal = (primary.billTotal || 0) + (secondary.billTotal || 0);

        const updatedTables = state.tables.map(t => {
          if (t.id === primaryTableId) {
            return {
              ...t,
              orders: combinedOrders,
              billTotal: newBillTotal,
              status: (primary.status === 'billed' && secondary.status === 'billed') ? 'billed' as const : 'occupied' as const,
            };
          }
          if (t.id === secondaryTableId) {
            return {
              ...t,
              status: 'available' as const,
              billTotal: 0,
              orders: [],
              server: undefined,
              isPaid: false,
              lastInvoiceId: undefined,
              occupiedSince: undefined,
            };
          }
          return t;
        });

        const updatedTickets = state.tickets.map(tk => {
          if (tk.tableId === secondaryTableId) {
            return {
              ...tk,
              tableId: primaryTableId,
              tableName: `${primary.name} (Merged ${secondary.name})`
            };
          }
          return tk;
        });

        return {
          tables: updatedTables,
          tickets: updatedTickets
        };
      }),

      assignTableServer: (tableId, serverName) => set((state) => ({
        tables: state.tables.map(t => t.id === tableId ? { ...t, server: serverName } : t)
      })),

      addReservation: (res) => set((state) => {
        const newId = `res-${Date.now()}`;
        const linked = (res.linkedTableIds || []).filter(id => id !== res.tableId);
        const newReservation: Reservation = {
          ...res,
          linkedTableIds: linked,
          id: newId,
          status: res.status || 'confirmed',
          createdAt: Date.now()
        };

        const updatedTables = state.tables.map(t => {
          if (t.id === res.tableId) {
            return { ...t, status: 'reserved' as const, reservationId: newId, mergedInto: undefined };
          }
          if (linked.includes(t.id)) {
            return { ...t, status: 'reserved' as const, reservationId: newId, mergedInto: res.tableId };
          }
          return t;
        });

        return {
          reservations: [newReservation, ...state.reservations],
          tables: updatedTables
        };
      }),

      updateReservation: (id, updates) => set((state) => {
        const targetRes = state.reservations.find(r => r.id === id);
        if (!targetRes) return state;

        const updatedRes: Reservation = { ...targetRes, ...updates };
        updatedRes.linkedTableIds = (updatedRes.linkedTableIds || []).filter(tid => tid !== updatedRes.tableId);

        const tablesChanged = updates.tableId !== undefined || updates.linkedTableIds !== undefined;
        let updatedTables = state.tables;
        if (tablesChanged && targetRes.status === 'confirmed') {
          // Release all previously held tables for this reservation, then reserve the new set
          updatedTables = updatedTables.map(t => {
            if (t.reservationId === id && t.status === 'reserved') {
              return { ...t, status: 'available' as const, reservationId: undefined, mergedInto: undefined };
            }
            return t;
          }).map(t => {
            if (t.id === updatedRes.tableId) {
              return { ...t, status: 'reserved' as const, reservationId: id, mergedInto: undefined };
            }
            if (updatedRes.linkedTableIds!.includes(t.id)) {
              return { ...t, status: 'reserved' as const, reservationId: id, mergedInto: updatedRes.tableId };
            }
            return t;
          });
        }

        return {
          reservations: state.reservations.map(r => r.id === id ? updatedRes : r),
          tables: updatedTables
        };
      }),

      cancelReservation: (id) => set((state) => {
        const targetRes = state.reservations.find(r => r.id === id);
        if (!targetRes) return state;
        const allIds = [targetRes.tableId, ...(targetRes.linkedTableIds || [])];

        const updatedTables = state.tables.map(t => {
          if (allIds.includes(t.id) && t.status === 'reserved') {
            return { ...t, status: 'available' as const, reservationId: undefined, mergedInto: undefined };
          }
          return t;
        });

        return {
          reservations: state.reservations.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r),
          tables: updatedTables
        };
      }),

      seatReservation: (reservationId) => set((state) => {
        const targetRes = state.reservations.find(r => r.id === reservationId);
        if (!targetRes) return state;
        const linked = targetRes.linkedTableIds || [];
        const now = Date.now();

        const updatedTables = state.tables.map(t => {
          if (t.id === targetRes.tableId) {
            return { ...t, status: 'occupied' as const, occupiedSince: now, reservationId: undefined, mergedInto: undefined };
          }
          if (linked.includes(t.id)) {
            // Linked tables stay blocked as part of the primary table's party
            return { ...t, status: 'occupied' as const, occupiedSince: now, reservationId: undefined, mergedInto: targetRes.tableId };
          }
          return t;
        });

        return {
          reservations: state.reservations.map(r => r.id === reservationId ? { ...r, status: 'seated' as const } : r),
          tables: updatedTables
        };
      }),
      
      saveInvoice: (invoice) => set((state) => {
        let updatedCustomers = state.customers;
        if (invoice.customer && (invoice.customer.id || invoice.customer.phone)) {
          const custPhone = (invoice.customer.phone || '').replace(/\D/g, '');
          updatedCustomers = state.customers.map(c => {
            const isMatch = (invoice.customer?.id && c.id === invoice.customer.id) ||
              (custPhone && c.phone && c.phone.replace(/\D/g, '').endsWith(custPhone));
            if (isMatch) {
              const newOrders = (c.totalOrders || 0) + 1;
              const newSpent = (c.totalSpent || 0) + (invoice.total || 0);
              const pointsEarned = Math.round((invoice.total || 0) * 0.01);
              let tier: CustomerTier = c.tier || 'Regular';
              if (newSpent >= 50000 || newOrders >= 15) tier = 'VIP';
              else if (newSpent >= 25000 || newOrders >= 8) tier = 'Gold';
              else if (newSpent >= 10000 || newOrders >= 3) tier = 'Silver';

              return {
                ...c,
                totalOrders: newOrders,
                totalSpent: newSpent,
                loyaltyPoints: (c.loyaltyPoints || 0) + pointsEarned,
                lastVisit: Date.now(),
                tier,
              };
            }
            return c;
          });
        }

        return {
          invoices: [invoice, ...state.invoices],
          customers: updatedCustomers,
        };
      }),

      voidInvoice: (invoiceId, reason, voidedBy) => set((state) => ({
        invoices: state.invoices.map(inv =>
          inv.id === invoiceId
            ? {
                ...inv,
                status: 'voided' as const,
                voidReason: reason || 'Voided by authorized manager',
                voidedAt: Date.now(),
                voidedBy: voidedBy || 'Staff',
              }
            : inv
        )
      })),

      deleteInvoice: (invoiceId) => set((state) => ({
        invoices: state.invoices.filter(inv => inv.id !== invoiceId)
      })),

      processSalesReturn: (input) => {
        const returnId = input.id || `RET-${Math.floor(10000 + Math.random() * 90000)}`;
        let success = false;
        let errorMessage = '';

        set((state) => {
          const invoice = state.invoices.find(inv => inv.id === input.invoiceId);
          if (!invoice) {
            errorMessage = 'Original invoice not found.';
            return state;
          }

          const now = Date.now();
          const refundAmt = Math.max(0, input.refundAmount);

          const newReturn: SalesReturn = {
            ...input,
            id: returnId,
            returnedAt: now,
            status: 'completed',
            refundAmount: refundAmt,
          };

          const existingRefund = invoice.refundAmount || 0;
          const newTotalRefund = existingRefund + refundAmt;
          const isFullRefund = input.returnType === 'full' || newTotalRefund >= invoice.total;

          const updatedInvoices = state.invoices.map(inv => {
            if (inv.id !== invoice.id) return inv;
            return {
              ...inv,
              status: isFullRefund ? ('refunded' as const) : inv.status,
              returnStatus: isFullRefund ? ('full' as const) : ('partial' as const),
              refundAmount: newTotalRefund,
              returnIds: [...(inv.returnIds || []), returnId],
            };
          });

          // Adjust customer spent if customer linked
          let updatedCustomers = state.customers;
          if (invoice.customer?.id) {
            updatedCustomers = state.customers.map(c => {
              if (c.id === invoice.customer!.id) {
                return {
                  ...c,
                  totalSpent: Math.max(0, c.totalSpent - refundAmt),
                };
              }
              return c;
            });
          }

          // Restock items marked 'restock'
          let updatedMenuItems = state.menuItems;
          input.items.forEach(retItem => {
            if (retItem.condition === 'restock' && retItem.quantityReturned > 0) {
              updatedMenuItems = updatedMenuItems.map(m => {
                if (m.id === retItem.itemId || retItem.itemId.startsWith(`${m.id}-`)) {
                  if (m.trackStock && typeof m.stockQty === 'number') {
                    return { ...m, stockQty: m.stockQty + retItem.quantityReturned };
                  }
                }
                return m;
              });
            }
          });

          success = true;
          return {
            salesReturns: [newReturn, ...(state.salesReturns || [])],
            invoices: updatedInvoices,
            customers: updatedCustomers,
            menuItems: updatedMenuItems,
          };
        });

        if (!success) return { ok: false, error: errorMessage || 'Failed to process return.' };
        return { ok: true, id: returnId };
      },

      cancelSalesReturn: (returnId, by) => set((state) => ({
        salesReturns: (state.salesReturns || []).map(r => 
          r.id === returnId ? { ...r, status: 'cancelled' as const, notes: `${r.notes ? r.notes + ' | ' : ''}Cancelled by ${by}` } : r
        )
      })),

      addCustomer: (customer) => set((state) => ({
        customers: [
          ...state.customers,
          {
            ...customer,
            id: `c${Date.now()}`,
            totalOrders: 0,
            totalSpent: 0,
            loyaltyPoints: 50,
            firstVisit: Date.now(),
            lastVisit: Date.now(),
            tier: customer.tier || 'Regular',
          }
        ]
      })),

      updateCustomer: (id, customer) => set((state) => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
      })),

      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.id !== id)
      })),

      addFeedback: (feedbackData) => set((state) => {
        const newFeedback: InvoiceFeedback = {
          ...feedbackData,
          id: `fb-${Date.now()}`,
          createdAt: Date.now(),
          status: 'published'
        };

        const updatedInvoices = state.invoices.map(inv => {
          if (inv.id === feedbackData.invoiceId) {
            return {
              ...inv,
              feedback: newFeedback,
              feedbackSubmitted: true
            };
          }
          return inv;
        });

        let updatedCustomers = state.customers;
        const targetPhone = (feedbackData.customerPhone || '').replace(/\D/g, '');
        if (targetPhone || feedbackData.customerId) {
          updatedCustomers = state.customers.map(cust => {
            const custPhone = (cust.phone || '').replace(/\D/g, '');
            const isMatch = (feedbackData.customerId && cust.id === feedbackData.customerId) ||
              (targetPhone && custPhone && (custPhone.endsWith(targetPhone) || targetPhone.endsWith(custPhone)));
            
            if (isMatch) {
              const currentPoints = cust.loyaltyPoints || 0;
              return {
                ...cust,
                loyaltyPoints: currentPoints + 50,
              };
            }
            return cust;
          });
        }

        return {
          feedbacks: [newFeedback, ...(state.feedbacks || [])],
          invoices: updatedInvoices,
          customers: updatedCustomers,
        };
      }),

      deleteFeedback: (id) => set((state) => ({
        feedbacks: (state.feedbacks || []).filter(f => f.id !== id)
      })),

      onlineFeedbackUrl: 'http://192.168.1.17:8081',

      setOnlineFeedbackUrl: (url) => set({
        onlineFeedbackUrl: url.trim().replace(/\/+$/, '')
      }),

      addMenuItem: (item) => {
        set((state) => {
          const newCategories = (item.category && !state.categories.includes(item.category))
            ? [...state.categories, item.category]
            : state.categories;
          return {
            menuItems: [...state.menuItems, { ...item, id: `m${Date.now()}` }],
            categories: newCategories,
          };
        });
        notifySync();
      },
      
      updateMenuItem: (id, item) => {
        set((state) => {
          const newCategories = (item.category && !state.categories.includes(item.category))
            ? [...state.categories, item.category]
            : state.categories;
          return {
            menuItems: state.menuItems.map(m => m.id === id ? { ...m, ...item } : m),
            categories: newCategories,
          };
        });
        notifySync();
      },

      deleteMenuItem: (id) => {
        set((state) => ({
          menuItems: state.menuItems.filter(m => m.id !== id)
        }));
        notifySync();
      },

      adjustMenuItemStock: (id, deltaOrQuantity, mode = 'add') => {
        set((state) => ({
          menuItems: state.menuItems.map(m => {
            if (m.id !== id) return m;
            const current = typeof m.stockQty === 'number' ? m.stockQty : 0;
            const newQty = mode === 'set' ? Math.max(0, deltaOrQuantity) : Math.max(0, current + deltaOrQuantity);
            return { ...m, trackStock: true, stockQty: newQty };
          })
        }));
        notifySync();
      },

      addCategory: (categoryName) => {
        set((state) => ({
          categories: state.categories.includes(categoryName) ? state.categories : [...state.categories, categoryName]
        }));
        notifySync();
      },

      deleteCategory: (categoryName) => {
        set((state) => ({
          categories: state.categories.filter(c => c !== categoryName)
        }));
        notifySync();
      },

      addTable: (table) => set((state) => ({
        tables: [...state.tables, { ...table, status: table.status || 'available', id: `t${Date.now()}` }]
      })),
      
      updateTable: (id, updatedTable) => set((state) => {
        let alert = state.lastBillPaidAlert;
        if (updatedTable.status === 'available' && alert) {
          const targetTable = state.tables.find(t => t.id === id);
          if (
            alert.tableId === id ||
            (targetTable && alert.tableName.trim().toLowerCase() === targetTable.name.trim().toLowerCase())
          ) {
            alert = null;
          }
        }
        return {
          tables: state.tables.map(t => t.id === id ? { ...t, ...updatedTable } : t),
          lastBillPaidAlert: alert
        };
      }),

      deleteTable: (id) => set((state) => ({
        tables: state.tables.filter(t => t.id !== id)
      })),

      addFloor: (floor) => set((state) => {
        const newId = `fl-${Date.now()}`;
        const newFloor: Floor = {
          ...floor,
          id: newId,
          order: (state.floors || []).length + 1,
        };
        const currentFloors = state.floors && state.floors.length > 0 ? state.floors : INITIAL_FLOORS;
        const updatedFloors = [...currentFloors, newFloor];
        const updatedZones = state.zones.includes(floor.name) ? state.zones : [...state.zones, floor.name];
        return {
          floors: updatedFloors,
          zones: updatedZones,
        };
      }),

      updateFloor: (id, updates) => set((state) => {
        const currentFloors = state.floors && state.floors.length > 0 ? state.floors : INITIAL_FLOORS;
        const target = currentFloors.find((f) => f.id === id);
        if (!target) return state;

        const oldName = target.name;
        const newName = updates.name ? updates.name.trim() : oldName;
        const nameChanged = newName && newName.toLowerCase() !== oldName.toLowerCase();

        const updatedFloors = currentFloors.map((f) => (f.id === id ? { ...f, ...updates, name: newName } : f));

        // Cascade floor name rename to tables, zones, and staff assignedZones
        const updatedTables = nameChanged
          ? state.tables.map((t) => {
              const matchesFloor = (t.floor && t.floor.toLowerCase() === oldName.toLowerCase()) ||
                (t.zone && t.zone.toLowerCase() === oldName.toLowerCase());
              if (matchesFloor) {
                return {
                  ...t,
                  floor: newName,
                  zone: newName,
                };
              }
              return t;
            })
          : state.tables;

        const updatedZones = nameChanged
          ? state.zones.map((z) => (z.toLowerCase() === oldName.toLowerCase() ? newName : z))
          : state.zones;

        const updatedStaff = nameChanged
          ? (state.staff || []).map((s) => ({
              ...s,
              assignedZone: s.assignedZone && s.assignedZone.toLowerCase() === oldName.toLowerCase() ? newName : s.assignedZone,
              assignedZones: (s.assignedZones || []).map((z) => (z.toLowerCase() === oldName.toLowerCase() ? newName : z)),
            }))
          : state.staff;

        return {
          floors: updatedFloors,
          tables: updatedTables,
          zones: updatedZones,
          staff: updatedStaff,
        };
      }),

      deleteFloor: (id, cascadeDeleteTables = false) => set((state) => {
        const currentFloors = state.floors && state.floors.length > 0 ? state.floors : INITIAL_FLOORS;
        const target = currentFloors.find((f) => f.id === id);
        if (!target) return state;

        const floorName = target.name.toLowerCase();
        const updatedFloors = currentFloors.filter((f) => f.id !== id);
        const updatedZones = state.zones.filter((z) => z.toLowerCase() !== floorName);

        const updatedTables = cascadeDeleteTables
          ? state.tables.filter((t) => {
              const tFloor = (t.floor || t.zone || '').toLowerCase();
              return tFloor !== floorName;
            })
          : state.tables;

        return {
          floors: updatedFloors,
          zones: updatedZones,
          tables: updatedTables,
        };
      }),

      addZone: (zoneName) => set((state) => ({
        zones: [...state.zones, zoneName]
      })),
      
      deleteZone: (zoneName) => set((state) => ({
        zones: state.zones.filter(z => z !== zoneName)
      })),

      addStaff: (newStaff) => set((state) => ({
        staff: [...(state.staff || []), { ...newStaff, id: `st${Date.now()}` }]
      })),

      updateStaff: (id, staffUpdates) => set((state) => ({
        staff: (state.staff || []).map(s => s.id === id ? { ...s, ...staffUpdates } : s)
      })),

      deleteStaff: (id) => set((state) => ({
        staff: (state.staff || []).filter(s => s.id !== id)
      })),

      syncFromServer: (remoteState) => set((state) => {
        let mergedTickets = remoteState.tickets;
        if (remoteState.tickets && state.tickets) {
          mergedTickets = remoteState.tickets.map(rt => {
            const local = state.tickets.find(lt => lt.id === rt.id);
            // If local already marked this ticket as served, don't let a stale remote packet revert it to cooking or ready!
            if (local && local.status === 'served' && rt.status !== 'served') {
              return local;
            }
            return rt;
          });
        }

        const rawTables = remoteState.tables || state.tables;
        const finalTickets = mergedTickets || state.tickets;
        const reconciledTables = reconcileTablesWithTickets(rawTables, finalTickets);

        return {
          ...state,
          tables: reconciledTables,
          ...(mergedTickets ? { tickets: mergedTickets } : {}),
          ...(remoteState.invoices ? {
            invoices: (() => {
              const remoteList = remoteState.invoices || [];
              const remoteMap = new Map(remoteList.map(i => [i.id, i]));
              const localUnsynced = state.invoices.filter(i => !remoteMap.has(i.id));
              return [...localUnsynced, ...remoteList];
            })()
          } : {}),
          ...(remoteState.menuItems ? { menuItems: remoteState.menuItems } : {}),
          ...(remoteState.categories ? { categories: remoteState.categories } : {}),
          ...(remoteState.zones ? { zones: remoteState.zones } : {}),
          ...(remoteState.floors ? { floors: remoteState.floors } : {}),
          ...(remoteState.staff ? { staff: remoteState.staff } : {}),
          ...(remoteState.customers ? { customers: remoteState.customers } : {}),
          ...(remoteState.reservations ? { reservations: remoteState.reservations } : {}),
          ...(remoteState.salesReturns ? { salesReturns: remoteState.salesReturns } : {}),
          ...(remoteState.feedbacks ? { feedbacks: remoteState.feedbacks } : {}),
          ...(remoteState.lastBillPaidAlert !== undefined ? {
            lastBillPaidAlert: (() => {
              const incoming = remoteState.lastBillPaidAlert;
              if (!incoming) return null;
              // Validate that table still exists and is currently billed
              const matchingTable = reconciledTables.find(
                t => t.id === incoming.tableId || t.name.trim().toLowerCase() === incoming.tableName.trim().toLowerCase()
              );
              if (!matchingTable || matchingTable.status !== 'billed') {
                return null;
              }
              // If alert is older than 30 minutes, discard
              if (incoming.time && Date.now() - incoming.time > 30 * 60 * 1000) {
                return null;
              }
              return incoming;
            })()
          } : (
            state.lastBillPaidAlert ? {
              lastBillPaidAlert: (() => {
                const local = state.lastBillPaidAlert;
                const matchingTable = reconciledTables.find(
                  t => t.id === local.tableId || t.name.trim().toLowerCase() === local.tableName.trim().toLowerCase()
                );
                if (!matchingTable || matchingTable.status !== 'billed' || (local.time && Date.now() - local.time > 30 * 60 * 1000)) {
                  return null;
                }
                return local;
              })()
            } : {}
          )),
        };
      }),
    }),
    {
      name: 'restaurant-storage',
      storage: appStorage,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.tables = reconcileTablesWithTickets(state.tables, state.tickets);
          if (!state.floors || !Array.isArray(state.floors) || state.floors.length === 0) {
            state.floors = INITIAL_FLOORS;
          }
          // Clean out legacy ghost zones (e.g. 'Main Hall', 'VIP', 'Majlis Floor 1') that have no tables
          const validFloorNames = (state.floors || []).map((f) => f.name.toLowerCase());
          const tablesFloorNames = (state.tables || []).map((t) => (t.floor || t.zone || '').toLowerCase());
          state.zones = (state.zones || []).filter(
            (z) => validFloorNames.includes(z.toLowerCase()) || tablesFloorNames.includes(z.toLowerCase())
          );
          state.floors.forEach((f) => {
            if (!state.zones.some((z) => z.toLowerCase() === f.name.toLowerCase())) {
              state.zones.push(f.name);
            }
          });

          // Purge stale or already-available bill paid alerts on rehydration
          if (state.lastBillPaidAlert) {
            const matchingTable = state.tables.find(
              (t) =>
                t.id === state.lastBillPaidAlert?.tableId ||
                t.name.trim().toLowerCase() === state.lastBillPaidAlert?.tableName.trim().toLowerCase()
            );
            if (
              !matchingTable ||
              matchingTable.status !== 'billed' ||
              (state.lastBillPaidAlert.time && Date.now() - state.lastBillPaidAlert.time > 30 * 60 * 1000)
            ) {
              state.lastBillPaidAlert = null;
            }
          }
        }
      },
    }
  )
);

