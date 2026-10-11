import { Ionicons } from '@expo/vector-icons';
import type { Customer } from '../store/restaurantStore';

export type ReturnReasonCategory =
  | 'taste_quality'      // Taste / Quality issue (Khana pasand nahi aya / Thanda tha)
  | 'wrong_order'        // Wrong item punched or served (Ghalat order serve hua)
  | 'delayed_order'      // Delayed preparation or delivery (Bohot dair ho gayi)
  | 'customer_cancelled' // Customer changed mind / left before meal
  | 'burnt_undercooked'  // Overcooked / Undercooked / Burnt (Kacha ya Jala hua)
  | 'hygiene_issue'      // Foreign object / Hygiene complaint (Safai ka masla)
  | 'spill_accident'     // Spilled / damaged during serving
  | 'billing_error'      // Overcharged / Billing error
  | 'other';             // Other reason (custom note)

export type ReturnedItemCondition = 'waste' | 'restock';

export type ReturnedItem = {
  itemId: string;
  name: string;
  price: number;
  quantityPurchased: number;
  quantityReturned: number;
  condition: ReturnedItemCondition; // 'waste' (culinary discard) or 'restock' (unopened/intact beverage/store item)
  refundAmount: number;
  reason?: string;
};

export type RefundMethod = 'cash' | 'card' | 'customer_credit' | 'original_payment';

export type SalesReturn = {
  id: string; // e.g. "RET-84920"
  invoiceId: string;
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  tableName?: string;
  tableId?: string;
  customer?: Customer;
  returnedAt: number;
  processedBy: string;
  returnType: 'full' | 'partial';
  items: ReturnedItem[];
  reasonCategory: ReturnReasonCategory;
  reasonNotes?: string;
  refundAmount: number;
  refundMethod: RefundMethod;
  status: 'completed' | 'cancelled';
  notes?: string;
};

export type ReturnReasonMeta = {
  id: ReturnReasonCategory;
  label: string;
  urdu: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  suggestedCondition: ReturnedItemCondition;
  description: string;
};

export const RETURN_REASONS: ReturnReasonMeta[] = [
  {
    id: 'taste_quality',
    label: 'Taste / Quality Issue',
    urdu: 'ذائقہ یا کوالٹی کا مسئلہ (ٹھنڈا / بے مزہ)',
    icon: 'restaurant-outline',
    color: '#D97706',
    bg: '#FEF3C7',
    suggestedCondition: 'waste',
    description: 'Food was not up to taste standards, served cold, or overly spicy.',
  },
  {
    id: 'wrong_order',
    label: 'Wrong Item Served',
    urdu: 'غلط ڈش یا سائز سرو ہو گیا',
    icon: 'close-circle-outline',
    color: '#DC2626',
    bg: '#FEE2E2',
    suggestedCondition: 'waste',
    description: 'Server or cashier punched wrong dish or sent incorrect variant.',
  },
  {
    id: 'delayed_order',
    label: 'Delayed Service / Late',
    urdu: 'آرڈر میں بہت زیادہ تاخیر',
    icon: 'time-outline',
    color: '#2563EB',
    bg: '#DBEAFE',
    suggestedCondition: 'waste',
    description: 'Preparation took too long and customer could not wait.',
  },
  {
    id: 'customer_cancelled',
    label: 'Customer Changed Mind',
    urdu: 'گاہک نے منع کر دیا / کینسل کر دیا',
    icon: 'person-remove-outline',
    color: '#7C3AED',
    bg: '#EDE9FE',
    suggestedCondition: 'restock',
    description: 'Customer decided not to dine or ordered excess quantity.',
  },
  {
    id: 'burnt_undercooked',
    label: 'Burnt / Undercooked',
    urdu: 'کچا رہ گیا یا جل گیا',
    icon: 'flame-outline',
    color: '#EA580C',
    bg: '#FFEDD5',
    suggestedCondition: 'waste',
    description: 'Tandoor or kitchen mistake; meat raw inside or bread burnt.',
  },
  {
    id: 'hygiene_issue',
    label: 'Hygiene Complaint',
    urdu: 'صفائی یا بال / فارن آبجیکٹ کی شکایت',
    icon: 'shield-outline',
    color: '#991B1B',
    bg: '#FEE2E2',
    suggestedCondition: 'waste',
    description: 'Hair, insect, or foreign matter found in plate.',
  },
  {
    id: 'spill_accident',
    label: 'Accidental Spill / Damage',
    urdu: 'گر گیا یا ڈیمج ہو گیا',
    icon: 'warning-outline',
    color: '#B45309',
    bg: '#FEF3C7',
    suggestedCondition: 'waste',
    description: 'Waiter dropped plate or packaging damaged in delivery.',
  },
  {
    id: 'billing_error',
    label: 'Billing / Punch Error',
    urdu: 'بلنگ میں غلطی یا ڈبل پنچ',
    icon: 'receipt-outline',
    color: '#059669',
    bg: '#D1FAE5',
    suggestedCondition: 'restock',
    description: 'Cashier accidentally added extra quantity on invoice.',
  },
  {
    id: 'other',
    label: 'Other Reason',
    urdu: 'دیگر وجہ (تفصیل لکھیں)',
    icon: 'help-circle-outline',
    color: '#52171B',
    bg: '#F5E6BE',
    suggestedCondition: 'waste',
    description: 'Specific reason specified in manager notes.',
  },
];
