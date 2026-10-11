/**
 * Kitchen Operations domain types (recipes, handover sessions, consumption, cash).
 * Kept separate from stores so utils and screens can import them without cycles.
 */

export type RecipeUnit = 'g' | 'kg' | 'ml' | 'L' | 'pcs';

export type RecipeIngredient = {
  inventoryItemId: string;
  name: string;
  /** Quantity for the whole recipe batch (see yieldPortions), in `unit`. */
  qty: number;
  unit: RecipeUnit;
  /** Trim / cooking loss on top of the quantity, 0-100. */
  wastagePct: number;
  /** Taste tuning: +10 = 10% more (e.g. spicier), -10 = 10% less. */
  tasteAdjustPct: number;
  role?: 'main' | 'masala' | 'oil' | 'garnish' | 'base';
};

export type Recipe = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  /** Matches MenuVariant.name when the recipe is for a specific size. */
  variantName?: string;
  /** How many portions this ingredient list makes (1 = per plate). */
  yieldPortions: number;
  ingredients: RecipeIngredient[];
  /** Fixed extra cost per portion (box, foil, sauce sachet...). */
  packagingCost: number;
  prepNotes?: string;
  /** Minutes the kitchen needs to get one order of this dish ready. */
  prepTimeMin?: number;
  version: number;
  updatedAt: number;
};

/** Which kitchen a handover feeds. Sales are matched to a shift using the menu item's station. */
export type ShiftStation = 'all' | 'main' | 'juice';

export type ShiftKind = 'morning' | 'afternoon' | 'evening' | 'night' | 'full';

export const SHIFT_KIND_META: Record<ShiftKind, { label: string; icon: string }> = {
  morning: { label: 'Morning', icon: 'sunny-outline' },
  afternoon: { label: 'Afternoon', icon: 'partly-sunny-outline' },
  evening: { label: 'Evening', icon: 'moon-outline' },
  night: { label: 'Night', icon: 'cloudy-night-outline' },
  full: { label: 'Full Day', icon: 'time-outline' },
};

export const SHIFT_STATION_META: Record<ShiftStation, { label: string }> = {
  all: { label: 'All Kitchen' },
  main: { label: 'Main Kitchen' },
  juice: { label: 'Juice Bar' },
};

/** Default recipe quantity remembered per inventory item so it auto-fills next time. */
export type IngredientDefault = { qty: number; unit: RecipeUnit };

/** Starting ingredient list applied to every new recipe of a menu category. */
export type CategoryTemplate = {
  ingredients: RecipeIngredient[];
  packagingCost: number;
  prepTimeMin?: number;
  updatedAt: number;
};

export type SessionStatus = 'draft' | 'issued' | 'pending_approval' | 'closed' | 'cancelled';

export type SessionLine = {
  itemId: string;
  itemName: string;
  unit: string;
  category: string;
  /** Snapshot of store stock when the requisition was prepared (starting available balance). */
  storeStockAtRequest: number;
  par: number;
  suggested: number;
  requested: number;
  issued: number;
  /** Extra issued during the day when the chef runs short. */
  topUp: number;
  /** Bought locally by the chef with the handed cash. */
  localPurchased: number;
  costPerUnit: number;
  /** Physical count at end of day (entered by chef). */
  returned?: number;
  /** Expected on hand frozen when the chef submitted the closing count. */
  expectedAtClose?: number;
  variance?: number;
};

export type KitchenSession = {
  id: string;
  dayLabel: string;
  status: SessionStatus;
  headChef: string;
  createdAt: number;
  createdBy: string;
  notes?: string;
  /** Several handovers can run on the same day (e.g. morning chef + evening chef). */
  shift?: ShiftKind;
  station?: ShiftStation;
  lines: SessionLine[];

  issuedAt?: number;
  issuedBy?: string;
  acknowledgedAt?: number;
  acknowledgedBy?: string;

  cashHandedOver: number;
  cashReturned?: number;
  cashVariance?: number;

  closingSubmittedAt?: number;
  closingSubmittedBy?: string;
  closingNotes?: string;

  approvedAt?: number;
  approvedBy?: string;
  approvalNote?: string;
  rejectionNote?: string;

  summary?: SessionSummary;
};

export type SessionSummary = {
  dishesSold: number;
  theoreticalCost: number;
  issuedValue: number;
  returnedValue: number;
  varianceValue: number;
  usedValue: number;
  cashSpent: number;
  cashVariance: number;
};

export type ConsumptionEntry = {
  id: string;
  sessionId: string;
  ticketId: string;
  menuItemId: string;
  menuItemName: string;
  variantName?: string;
  qty: number;
  at: number;
  revenue: number;
  cost: number;
  /** Ingredient usage in INVENTORY units (already multiplied by qty). */
  usage: { itemId: string; qty: number }[];
  missingRecipe?: boolean;
};

export type ManualUsageReason =
  | 'taste_up'
  | 'taste_down'
  | 'extra_masala'
  | 'spoilage'
  | 'spill'
  | 'staff_meal'
  | 'recook'
  | 'other';

export type ManualUsage = {
  id: string;
  sessionId: string;
  itemId: string;
  itemName: string;
  /** Signed, inventory units. Positive = used MORE than recipe, negative = used LESS. */
  delta: number;
  reason: ManualUsageReason;
  dish?: string;
  note?: string;
  by: string;
  at: number;
};

export type CashEntry = {
  id: string;
  sessionId: string;
  amount: number;
  note: string;
  itemId?: string;
  itemName?: string;
  qty?: number;
  by: string;
  at: number;
};

export type KitchenSettings = {
  /** Gas, labour, electricity as % of ingredient cost. */
  overheadPct: number;
  targetMarginPct: number;
  /** Round suggested prices up to this step (Rs). */
  priceRounding: number;
  /** Per inventory item daily kitchen par level. */
  par: Record<string, number>;
  /** Variance within this % of issued value is treated as normal. */
  varianceTolerancePct: number;

  // ---- Automation (forecast + alarms) ----
  /** Hour of day (0-23) the restaurant opens. Used to turn history into an hourly rate. */
  openingHour: number;
  /** Hour of day (0-23) the restaurant closes. Evening forecast is projected up to this time. */
  closingHour: number;
  /** Alarm (warning) when an item in the kitchen drops to this % of what was handed over. */
  shiftLowPct: number;
  /** Alarm (critical) when an item in the kitchen drops to this % of what was handed over. */
  shiftCriticalPct: number;
  /** Alarm when an item is forecast to finish within this many minutes. */
  runwayAlertMin: number;
  /** Beep / vibrate when a new alarm appears. */
  alarmSound: boolean;
  /** Remembered default recipe qty + unit per inventory item. */
  ingredientDefaults: Record<string, IngredientDefault>;
  /** Starting recipe per menu category. */
  categoryTemplates: Record<string, CategoryTemplate>;
};

export type KitchenData = {
  recipes: Recipe[];
  kitchenSessions: KitchenSession[];
  kitchenConsumption: ConsumptionEntry[];
  kitchenManualUsage: ManualUsage[];
  kitchenCash: CashEntry[];
  kitchenSettings: KitchenSettings;
};

export const MANUAL_REASON_META: Record<
  ManualUsageReason,
  { label: string; icon: string; color: string; hint: string; signed: 'plus' | 'minus' | 'plus' }
> = {
  taste_up: { label: 'Seasoning / Spice Up', icon: 'trending-up-outline', color: '#C62828', hint: 'Used extra spices or oil above recipe standard', signed: 'plus' },
  taste_down: { label: 'Mild / Spice Reduced', icon: 'trending-down-outline', color: '#2E7D32', hint: 'Used less spices than recipe standard (saved)', signed: 'minus' },
  extra_masala: { label: 'Tarka & Flavor Adjustment', icon: 'flame-outline', color: '#E65100', hint: 'Additional tempering or seasoning added to batch', signed: 'plus' },
  spoilage: { label: 'Spoilage / Expired', icon: 'trash-outline', color: '#6A1B9A', hint: 'Discarded due to expiration or quality defect', signed: 'plus' },
  spill: { label: 'Accidental Spill / Loss', icon: 'water-outline', color: '#0277BD', hint: 'Accidentally dropped, burned, or wasted', signed: 'plus' },
  staff_meal: { label: 'Staff Meal Allocation', icon: 'people-outline', color: '#4E342E', hint: 'Ingredients consumed for employee dinner', signed: 'plus' },
  recook: { label: 'Re-cook / Dish Remake', icon: 'refresh-outline', color: '#00695C', hint: 'Portion remade due to customer preference', signed: 'plus' },
  other: { label: 'Other Operational Loss', icon: 'ellipsis-horizontal-circle-outline', color: '#546E7A', hint: 'Other custom kitchen operational adjustment', signed: 'plus' },
};
