import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';
import { useOpsStore } from './opsStore';
import { useRestaurantStore } from './restaurantStore';
import type {
  CashEntry,
  ConsumptionEntry,
  KitchenData,
  KitchenSession,
  KitchenSettings,
  ManualUsage,
  ManualUsageReason,
  Recipe,
  SessionLine,
  SessionSummary,
  ShiftKind,
  ShiftStation,
} from '../types/kitchen';
import { computeItemUsage, computeLiveLines, resolveMenuRef } from '../utils/kitchenMath';

/**
 * Kitchen operations store: recipes (BOM), head-chef handover sessions,
 * auto consumption, manual taste/wastage usage, kitchen cash and EOD approval.
 * Lives in its own file so it never conflicts with restaurantStore / opsStore.
 * Synced through the same hub/Firebase payload (see KITCHEN_SYNC_KEYS).
 */

let seq = 0;
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const r3 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 1000) / 1000;

const MAX_CONSUMPTION = 3000;
const MAX_MANUAL = 800;
const MAX_CASH = 800;
const MAX_SESSIONS = 120;

export const DEFAULT_KITCHEN_SETTINGS: KitchenSettings = {
  overheadPct: 12,
  targetMarginPct: 65,
  priceRounding: 10,
  par: {},
  varianceTolerancePct: 3,
  openingHour: 11,
  closingHour: 23,
  shiftLowPct: 25,
  shiftCriticalPct: 10,
  runwayAlertMin: 90,
  alarmSound: true,
  ingredientDefaults: {},
  categoryTemplates: {},
};

/** Older saved / synced settings miss the newer automation keys - fill them in. */
export const withKitchenDefaults = (s?: Partial<KitchenSettings> | null): KitchenSettings => ({
  ...DEFAULT_KITCHEN_SETTINGS,
  ...(s || {}),
  par: { ...DEFAULT_KITCHEN_SETTINGS.par, ...(s?.par || {}) },
  ingredientDefaults: { ...(s?.ingredientDefaults || {}) },
  categoryTemplates: { ...(s?.categoryTemplates || {}) },
});

export const KITCHEN_SYNC_KEYS: (keyof KitchenData)[] = [
  'recipes',
  'kitchenSessions',
  'kitchenConsumption',
  'kitchenManualUsage',
  'kitchenCash',
  'kitchenSettings',
];

export type Result = { ok: true; id?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export type DraftInput = {
  headChef: string;
  notes?: string;
  cashHandedOver: number;
  createdBy: string;
  shift?: ShiftKind;
  station?: ShiftStation;
  lines: { itemId: string; requested: number; par: number; suggested: number }[];
};

type KitchenState = KitchenData & {
  // Recipes
  saveRecipe: (input: Omit<Recipe, 'id' | 'version' | 'updatedAt'> & { id?: string }) => string;
  deleteRecipe: (id: string) => void;

  // Settings
  updateSettings: (patch: Partial<KitchenSettings>) => void;
  setPar: (itemId: string, qty: number) => void;

  // Sessions
  saveDraft: (sessionId: string | null, input: DraftInput) => Result;
  issueSession: (id: string, by: string) => Result;
  acknowledgeSession: (id: string, chef: string) => void;
  issueTopUp: (sessionId: string, itemId: string, qty: number, by: string) => Result;
  recordManualUsage: (input: {
    sessionId: string;
    itemId: string;
    qty: number;
    reason: ManualUsageReason;
    dish?: string;
    note?: string;
    by: string;
  }) => Result;
  addCashEntry: (input: {
    sessionId: string;
    amount: number;
    note: string;
    itemId?: string;
    qty?: number;
    by: string;
  }) => Result;
  submitClosing: (input: {
    sessionId: string;
    counts: Record<string, number>;
    cashReturned: number;
    notes?: string;
    by: string;
  }) => Result;
  approveSession: (sessionId: string, by: string, note?: string) => Result;
  rejectClosing: (sessionId: string, by: string, note: string) => Result;
  cancelSession: (sessionId: string) => void;

  processNewTickets: () => void;
  syncFromServer: (remote: Partial<KitchenData>) => void;
};

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rc-1',
    menuItemId: 'm2',
    menuItemName: 'Chicken Karahi',
    yieldPortions: 1,
    packagingCost: 25,
    prepNotes: 'Fresh chicken cooked in pure oil/ghee, fresh tomatoes, ginger and green chillies.',
    prepTimeMin: 20,
    version: 1,
    updatedAt: Date.now() - 5 * 86400000,
    ingredients: [
      { inventoryItemId: 'inv1', name: 'Chicken (Boneless)', qty: 750, unit: 'g', wastagePct: 3, tasteAdjustPct: 0, role: 'main' },
      { inventoryItemId: 'inv5', name: 'Cooking Oil (Canola 16L)', qty: 150, unit: 'ml', wastagePct: 2, tasteAdjustPct: 0, role: 'oil' },
      { inventoryItemId: 'inv8', name: 'Tomatoes (Tamatar)', qty: 250, unit: 'g', wastagePct: 5, tasteAdjustPct: 0, role: 'base' },
      { inventoryItemId: 'inv6', name: 'Yogurt (Fresh Dahi)', qty: 100, unit: 'g', wastagePct: 2, tasteAdjustPct: 0, role: 'base' },
    ],
  },
  {
    id: 'rc-2',
    menuItemId: 'm1',
    menuItemName: 'Sultan Kebab',
    yieldPortions: 1,
    packagingCost: 20,
    prepNotes: 'Tender minced mutton grilled on open hardwood charcoal with royal spices.',
    prepTimeMin: 15,
    version: 1,
    updatedAt: Date.now() - 5 * 86400000,
    ingredients: [
      { inventoryItemId: 'inv2', name: 'Mutton (Mix Cut)', qty: 450, unit: 'g', wastagePct: 4, tasteAdjustPct: 0, role: 'main' },
      { inventoryItemId: 'inv7', name: 'Onions (Piaz)', qty: 80, unit: 'g', wastagePct: 6, tasteAdjustPct: 0, role: 'base' },
      { inventoryItemId: 'inv13', name: 'Charcoal BBQ (Hardwood)', qty: 350, unit: 'g', wastagePct: 0, tasteAdjustPct: 0, role: 'main' },
    ],
  },
  {
    id: 'rc-3',
    menuItemId: 'm3',
    menuItemName: 'Hummus & Pita',
    yieldPortions: 1,
    packagingCost: 15,
    prepNotes: 'Creamy chickpea hummus served with two fresh tandoor baked pita breads.',
    prepTimeMin: 8,
    version: 1,
    updatedAt: Date.now() - 5 * 86400000,
    ingredients: [
      { inventoryItemId: 'inv4', name: 'Wheat Flour (Fine Atta)', qty: 140, unit: 'g', wastagePct: 2, tasteAdjustPct: 0, role: 'main' },
      { inventoryItemId: 'inv5', name: 'Cooking Oil (Canola 16L)', qty: 40, unit: 'ml', wastagePct: 0, tasteAdjustPct: 0, role: 'oil' },
    ],
  },
  {
    id: 'rc-4',
    menuItemId: 'm-biryani',
    menuItemName: 'Special Chicken Biryani',
    yieldPortions: 1,
    packagingCost: 25,
    prepNotes: 'Aged basmati rice layered with aromatic chicken masala and saffron essence.',
    prepTimeMin: 12,
    version: 1,
    updatedAt: Date.now() - 5 * 86400000,
    ingredients: [
      { inventoryItemId: 'inv3', name: 'Basmati Rice (Kainat)', qty: 350, unit: 'g', wastagePct: 2, tasteAdjustPct: 0, role: 'main' },
      { inventoryItemId: 'inv1', name: 'Chicken (Boneless)', qty: 400, unit: 'g', wastagePct: 3, tasteAdjustPct: 0, role: 'main' },
      { inventoryItemId: 'inv5', name: 'Cooking Oil (Canola 16L)', qty: 70, unit: 'ml', wastagePct: 1, tasteAdjustPct: 0, role: 'oil' },
      { inventoryItemId: 'inv7', name: 'Onions (Piaz)', qty: 90, unit: 'g', wastagePct: 5, tasteAdjustPct: 0, role: 'base' },
      { inventoryItemId: 'inv8', name: 'Tomatoes (Tamatar)', qty: 100, unit: 'g', wastagePct: 4, tasteAdjustPct: 0, role: 'base' },
    ],
  },
];

export const INITIAL_KITCHEN_SESSIONS: KitchenSession[] = [
  {
    id: 'ks-closed-today-morning',
    dayLabel: 'Morning Lunch Handover & Shift Close',
    status: 'closed',
    headChef: 'Ustad Tariq Mehmood',
    createdAt: Date.now() - 10 * 3600000,
    createdBy: 'Manager Imran',
    shift: 'morning',
    station: 'all',
    issuedAt: Date.now() - 9 * 3600000,
    issuedBy: 'Storekeeper Asif',
    acknowledgedAt: Date.now() - 9 * 3600000,
    acknowledgedBy: 'Ustad Tariq Mehmood',
    cashHandedOver: 5000,
    cashReturned: 4200,
    cashVariance: 0,
    closingSubmittedAt: Date.now() - 4 * 3600000,
    closingSubmittedBy: 'Ustad Tariq Mehmood',
    approvedAt: Date.now() - 3.8 * 3600000,
    approvedBy: 'General Manager',
    approvalNote: 'Shift reconciliation verified. Returned stock checked back into cold store.',
    lines: [
      {
        itemId: 'inv1',
        itemName: 'Chicken (Boneless)',
        unit: 'kg',
        category: 'Meat',
        storeStockAtRequest: 35,
        par: 25,
        suggested: 25,
        requested: 25,
        issued: 25,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 780,
        returned: 6.2, // Returned to cold store at shift close
        expectedAtClose: 7.5,
        variance: 1.3, // 25 - (17.5 cooked + 6.2 returned) = 1.3 kg wastage
      },
      {
        itemId: 'inv2',
        itemName: 'Mutton (Mix Cut)',
        unit: 'kg',
        category: 'Meat',
        storeStockAtRequest: 30,
        par: 15,
        suggested: 15,
        requested: 15,
        issued: 15,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 2200,
        returned: 4.5,
        expectedAtClose: 4.8,
        variance: 0.3,
      },
      {
        itemId: 'inv3',
        itemName: 'Basmati Rice (Kainat)',
        unit: 'kg',
        category: 'Grains',
        storeStockAtRequest: 50,
        par: 20,
        suggested: 20,
        requested: 20,
        issued: 20,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 360,
        returned: 3.2,
        expectedAtClose: 4.0,
        variance: 0.8,
      },
      {
        itemId: 'inv5',
        itemName: 'Cooking Oil (Canola 16L)',
        unit: 'Liters',
        category: 'Pantry',
        storeStockAtRequest: 40,
        par: 12,
        suggested: 12,
        requested: 12,
        issued: 12,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 520,
        returned: 2.8,
        expectedAtClose: 3.2,
        variance: 0.4,
      },
      {
        itemId: 'inv8',
        itemName: 'Tomatoes (Tamatar)',
        unit: 'kg',
        category: 'Produce',
        storeStockAtRequest: 25,
        par: 14,
        suggested: 14,
        requested: 14,
        issued: 14,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 150,
        returned: 2.5,
        expectedAtClose: 3.5,
        variance: 1.0,
      },
      {
        itemId: 'inv6',
        itemName: 'Yogurt (Fresh Dahi)',
        unit: 'kg',
        category: 'Dairy',
        storeStockAtRequest: 18,
        par: 10,
        suggested: 10,
        requested: 10,
        issued: 10,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 240,
        returned: 2.2,
        expectedAtClose: 2.5,
        variance: 0.3,
      },
      {
        itemId: 'inv7',
        itemName: 'Onions (Piaz)',
        unit: 'kg',
        category: 'Produce',
        storeStockAtRequest: 30,
        par: 12,
        suggested: 12,
        requested: 12,
        issued: 12,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 120,
        returned: 2.8,
        expectedAtClose: 3.5,
        variance: 0.7,
      },
    ],
  },
  {
    id: 'ks-active-evening',
    dayLabel: 'Evening Dinner Rush & BBQ Live Shift',
    status: 'issued',
    headChef: 'Chef Omar Farooq',
    createdAt: Date.now() - 3.5 * 3600000,
    createdBy: 'Manager Imran',
    shift: 'evening',
    station: 'all',
    issuedAt: Date.now() - 3 * 3600000,
    issuedBy: 'Storekeeper Asif',
    acknowledgedAt: Date.now() - 3 * 3600000,
    acknowledgedBy: 'Chef Omar Farooq',
    cashHandedOver: 6000,
    lines: [
      {
        itemId: 'inv1',
        itemName: 'Chicken (Boneless)',
        unit: 'kg',
        category: 'Meat',
        storeStockAtRequest: 30,
        par: 30,
        suggested: 30,
        requested: 30,
        issued: 30,
        topUp: 5,
        localPurchased: 0,
        costPerUnit: 780,
      },
      {
        itemId: 'inv2',
        itemName: 'Mutton (Mix Cut)',
        unit: 'kg',
        category: 'Meat',
        storeStockAtRequest: 25,
        par: 20,
        suggested: 20,
        requested: 20,
        issued: 20,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 2200,
      },
      {
        itemId: 'inv3',
        itemName: 'Basmati Rice (Kainat)',
        unit: 'kg',
        category: 'Grains',
        storeStockAtRequest: 40,
        par: 25,
        suggested: 25,
        requested: 25,
        issued: 25,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 360,
      },
      {
        itemId: 'inv5',
        itemName: 'Cooking Oil (Canola 16L)',
        unit: 'Liters',
        category: 'Pantry',
        storeStockAtRequest: 35,
        par: 16,
        suggested: 16,
        requested: 16,
        issued: 16,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 520,
      },
      {
        itemId: 'inv8',
        itemName: 'Tomatoes (Tamatar)',
        unit: 'kg',
        category: 'Produce',
        storeStockAtRequest: 20,
        par: 15,
        suggested: 15,
        requested: 15,
        issued: 15,
        topUp: 0,
        localPurchased: 0,
        costPerUnit: 150,
      },
    ],
  },
];

export const INITIAL_MANUAL_USAGE: ManualUsage[] = [
  {
    id: 'mu-1',
    sessionId: 'ks-closed-today-morning',
    itemId: 'inv1',
    itemName: 'Chicken (Boneless)',
    delta: 0.6,
    reason: 'spoilage',
    dish: 'Chicken Karahi',
    note: 'Fat and tendon heavy trimming removal',
    by: 'Ustad Tariq Mehmood',
    at: Date.now() - 6 * 3600000,
  },
  {
    id: 'mu-2',
    sessionId: 'ks-closed-today-morning',
    itemId: 'inv3',
    itemName: 'Basmati Rice (Kainat)',
    delta: 0.5,
    reason: 'other',
    dish: 'Special Biryani',
    note: 'Bottom handi crust burnt scrapings',
    by: 'Ustad Tariq Mehmood',
    at: Date.now() - 5.5 * 3600000,
  },
  {
    id: 'mu-3',
    sessionId: 'ks-closed-today-morning',
    itemId: 'inv5',
    itemName: 'Cooking Oil (Canola 16L)',
    delta: 0.2,
    reason: 'spill',
    note: 'Accidental counter oil drip spill during high heat fry',
    by: 'Ustad Tariq Mehmood',
    at: Date.now() - 5 * 3600000,
  },
  {
    id: 'mu-4',
    sessionId: 'ks-closed-today-morning',
    itemId: 'inv1',
    itemName: 'Chicken (Boneless)',
    delta: 1.2,
    reason: 'staff_meal',
    dish: 'Staff Lunch Handi',
    note: 'Approved staff meal portion for kitchen and floor crew',
    by: 'Ustad Tariq Mehmood',
    at: Date.now() - 4.5 * 3600000,
  },
];

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      recipes: INITIAL_RECIPES,
      kitchenSessions: INITIAL_KITCHEN_SESSIONS,
      kitchenConsumption: [],
      kitchenManualUsage: INITIAL_MANUAL_USAGE,
      kitchenCash: [],
      kitchenSettings: DEFAULT_KITCHEN_SETTINGS,

      // ---------------- Recipes ----------------
      saveRecipe: (input) => {
        const now = Date.now();
        const existing = input.id ? get().recipes.find((r) => r.id === input.id) : undefined;
        const id = existing ? existing.id : uid('rc');
        const recipe: Recipe = {
          ...input,
          id,
          version: existing ? existing.version + 1 : 1,
          updatedAt: now,
        };
        set((state) => ({
          recipes: existing
            ? state.recipes.map((r) => (r.id === id ? recipe : r))
            : [recipe, ...state.recipes],
        }));
        return id;
      },

      deleteRecipe: (id) => set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) })),

      // ---------------- Settings ----------------
      updateSettings: (patch) =>
        set((state) => ({ kitchenSettings: withKitchenDefaults({ ...state.kitchenSettings, ...patch }) })),

      setPar: (itemId, qty) =>
        set((state) => ({
          kitchenSettings: {
            ...state.kitchenSettings,
            par: { ...state.kitchenSettings.par, [itemId]: Math.max(0, qty) },
          },
        })),

      // ---------------- Sessions ----------------
      saveDraft: (sessionId, input) => {
        const inv = useOpsStore.getState().inventory;
        const lines: SessionLine[] = input.lines
          .filter((l) => l.requested > 0)
          .map((l) => {
            const item = inv.find((i) => i.id === l.itemId);
            return {
              itemId: l.itemId,
              itemName: item?.name || 'Unknown item',
              unit: item?.unit || '',
              category: item?.category || '',
              storeStockAtRequest: item?.stock ?? 0,
              par: l.par,
              suggested: l.suggested,
              requested: r3(l.requested),
              issued: 0,
              topUp: 0,
              localPurchased: 0,
              costPerUnit: item?.costPerUnit ?? 0,
            };
          });
        if (lines.length === 0) return fail('Kam az kam ek item ki quantity daalein.');
        if (!input.headChef.trim()) return fail('Head Chef ka naam likhein.');

        const state = get();
        const existing = sessionId ? state.kitchenSessions.find((s) => s.id === sessionId) : undefined;
        if (existing && existing.status !== 'draft') return fail('Sirf draft edit ho sakta hai.');

        const dayLabel = new Date().toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        if (existing) {
          set((s) => ({
            kitchenSessions: s.kitchenSessions.map((x) =>
              x.id === existing.id
                ? {
                    ...x,
                    headChef: input.headChef.trim(),
                    notes: input.notes,
                    shift: input.shift,
                    station: input.station,
                    cashHandedOver: Math.max(0, input.cashHandedOver),
                    lines,
                  }
                : x
            ),
          }));
          return { ok: true, id: existing.id };
        }

        // one draft at a time keeps things simple (issue it, then start the next handover)
        const draft = state.kitchenSessions.find((s) => s.status === 'draft');
        const id = draft ? draft.id : uid('ks');
        const session: KitchenSession = {
          id,
          dayLabel,
          status: 'draft',
          headChef: input.headChef.trim(),
          createdAt: Date.now(),
          createdBy: input.createdBy,
          notes: input.notes,
          shift: input.shift,
          station: input.station,
          lines,
          cashHandedOver: Math.max(0, input.cashHandedOver),
        };
        set((s) => ({
          kitchenSessions: draft
            ? s.kitchenSessions.map((x) => (x.id === id ? session : x))
            : [session, ...s.kitchenSessions].slice(0, MAX_SESSIONS),
        }));
        return { ok: true, id };
      },

      issueSession: (id, by) => {
        const state = get();
        const session = state.kitchenSessions.find((s) => s.id === id);
        if (!session) return fail('Session not found.');
        if (session.status !== 'draft') return fail('This session has already been issued.');
        // Several handovers may be live at the same time (different chefs / shifts / stations).

        const ops = useOpsStore.getState();
        const now = Date.now();
        const lines: SessionLine[] = session.lines.map((l) => {
          const item = ops.inventory.find((i) => i.id === l.itemId);
          const available = item ? item.stock : 0;
          const issued = r3(Math.max(0, Math.min(l.requested, available)));
          return {
            ...l,
            storeStockAtRequest: available,
            issued,
            costPerUnit: item?.costPerUnit ?? l.costPerUnit,
          };
        });

        if (lines.every((l) => l.issued <= 0)) return fail('None of the requested ingredients are currently available in store stock.');

        lines.forEach((l) => {
          if (l.issued > 0) {
            ops.recordStockMovement(
              l.itemId,
              'usage',
              l.issued,
              `Issued to Head Chef ${session.headChef} - ${session.dayLabel}`,
              by
            );
          }
        });

        set((s) => ({
          kitchenSessions: s.kitchenSessions.map((x) =>
            x.id === id ? { ...x, status: 'issued', lines, issuedAt: now, issuedBy: by } : x
          ),
        }));
        return { ok: true, id };
      },

      acknowledgeSession: (id, chef) =>
        set((state) => ({
          kitchenSessions: state.kitchenSessions.map((s) =>
            s.id === id ? { ...s, acknowledgedAt: Date.now(), acknowledgedBy: chef } : s
          ),
        })),

      issueTopUp: (sessionId, itemId, qty, by) => {
        const state = get();
        const session = state.kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'issued') return fail('No active kitchen shift found.');
        if (!(qty > 0)) return fail('Quantity must be greater than 0.');
        const ops = useOpsStore.getState();
        const item = ops.inventory.find((i) => i.id === itemId);
        if (!item) return fail('Item not found in store inventory.');
        if (item.stock < qty) return fail(`Store has only ${item.stock} ${item.unit} available in stock.`);

        ops.recordStockMovement(itemId, 'usage', qty, `Top-up to Head Chef - ${session.dayLabel}`, by);

        set((s) => ({
          kitchenSessions: s.kitchenSessions.map((x) => {
            if (x.id !== sessionId) return x;
            const has = x.lines.some((l) => l.itemId === itemId);
            const lines = has
              ? x.lines.map((l) => (l.itemId === itemId ? { ...l, topUp: r3(l.topUp + qty) } : l))
              : [
                  ...x.lines,
                  {
                    itemId,
                    itemName: item.name,
                    unit: item.unit,
                    category: item.category,
                    storeStockAtRequest: item.stock,
                    par: 0,
                    suggested: 0,
                    requested: 0,
                    issued: 0,
                    topUp: r3(qty),
                    localPurchased: 0,
                    costPerUnit: item.costPerUnit ?? 0,
                  },
                ];
            return { ...x, lines };
          }),
        }));
        return { ok: true };
      },

      recordManualUsage: ({ sessionId, itemId, qty, reason, dish, note, by }) => {
        const session = get().kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'issued') return fail('No active kitchen shift found.');
        const line = session.lines.find((l) => l.itemId === itemId);
        if (!line) return fail('This item was not issued in the current session.');
        if (!(qty > 0)) return fail('Quantity must be greater than 0.');
        const delta = reason === 'taste_down' ? -qty : qty;
        const entry: ManualUsage = {
          id: uid('mu'),
          sessionId,
          itemId,
          itemName: line.itemName,
          delta: r3(delta),
          reason,
          dish,
          note,
          by,
          at: Date.now(),
        };
        set((s) => ({ kitchenManualUsage: [entry, ...s.kitchenManualUsage].slice(0, MAX_MANUAL) }));
        return { ok: true, id: entry.id };
      },

      addCashEntry: ({ sessionId, amount, note, itemId, qty, by }) => {
        const state = get();
        const session = state.kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'issued') return fail('No active kitchen shift found.');
        if (!(amount > 0)) return fail('Amount must be greater than 0.');

        const spent = state.kitchenCash.filter((c) => c.sessionId === sessionId).reduce((a, c) => a + c.amount, 0);
        if (spent + amount > session.cashHandedOver + 0.5) {
          return fail(
            `Insufficient hand cash: Only Rs. ${Math.max(0, session.cashHandedOver - spent).toLocaleString()} remaining.`
          );
        }

        const ops = useOpsStore.getState();
        const item = itemId ? ops.inventory.find((i) => i.id === itemId) : undefined;
        const hasQty = !!item && !!qty && qty > 0;

        const entry: CashEntry = {
          id: uid('kc'),
          sessionId,
          amount,
          note: note.trim() || (item ? `Local purchase: ${item.name}` : 'Kitchen expense'),
          itemId: hasQty ? item!.id : undefined,
          itemName: hasQty ? item!.name : undefined,
          qty: hasQty ? qty : undefined,
          by,
          at: Date.now(),
        };

        ops.addExpense({
          category: 'Groceries & Produce',
          amount,
          note: `[Kitchen cash] ${entry.note}`,
          method: 'cash',
          paidBy: by,
        });

        set((s) => ({
          kitchenCash: [entry, ...s.kitchenCash].slice(0, MAX_CASH),
          kitchenSessions: hasQty
            ? s.kitchenSessions.map((x) => {
                if (x.id !== sessionId) return x;
                const has = x.lines.some((l) => l.itemId === item!.id);
                const lines = has
                  ? x.lines.map((l) =>
                      l.itemId === item!.id ? { ...l, localPurchased: r3(l.localPurchased + (qty as number)) } : l
                    )
                  : [
                      ...x.lines,
                      {
                        itemId: item!.id,
                        itemName: item!.name,
                        unit: item!.unit,
                        category: item!.category,
                        storeStockAtRequest: item!.stock,
                        par: 0,
                        suggested: 0,
                        requested: 0,
                        issued: 0,
                        topUp: 0,
                        localPurchased: r3(qty as number),
                        costPerUnit: amount / (qty as number),
                      },
                    ];
                return { ...x, lines };
              })
            : s.kitchenSessions,
        }));
        return { ok: true, id: entry.id };
      },

      submitClosing: ({ sessionId, counts, cashReturned, notes, by }) => {
        const state = get();
        const session = state.kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'issued') return fail('An active shift is required to submit closing count.');

        const live = computeLiveLines(session, state.kitchenConsumption, state.kitchenManualUsage);
        const lines: SessionLine[] = live.map((l) => {
          const counted = counts[l.itemId];
          const returned = r3(Number.isFinite(counted) && counted >= 0 ? counted : 0);
          const expected = r3(l.expectedOnHand);
          const base: SessionLine = {
            itemId: l.itemId,
            itemName: l.itemName,
            unit: l.unit,
            category: l.category,
            storeStockAtRequest: l.storeStockAtRequest,
            par: l.par,
            suggested: l.suggested,
            requested: l.requested,
            issued: l.issued,
            topUp: l.topUp,
            localPurchased: l.localPurchased,
            costPerUnit: l.costPerUnit,
            returned,
            expectedAtClose: expected,
            variance: r3(returned - expected),
          };
          return base;
        });

        const cashSpent = state.kitchenCash.filter((c) => c.sessionId === sessionId).reduce((a, c) => a + c.amount, 0);
        const expectedCash = session.cashHandedOver - cashSpent;
        const cashVariance = r3((Number.isFinite(cashReturned) ? cashReturned : 0) - expectedCash);

        set((s) => ({
          kitchenSessions: s.kitchenSessions.map((x) =>
            x.id === sessionId
              ? {
                  ...x,
                  status: 'pending_approval',
                  lines,
                  cashReturned: Number.isFinite(cashReturned) ? cashReturned : 0,
                  cashVariance,
                  closingSubmittedAt: Date.now(),
                  closingSubmittedBy: by,
                  closingNotes: notes,
                  rejectionNote: undefined,
                }
              : x
          ),
        }));
        return { ok: true, id: sessionId };
      },

      approveSession: (sessionId, by, note) => {
        const state = get();
        const session = state.kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'pending_approval') return fail('No shift session awaiting approval.');

        const ops = useOpsStore.getState();
        session.lines.forEach((l) => {
          const back = l.returned ?? 0;
          if (back > 0) {
            ops.recordStockMovement(
              l.itemId,
              'receive',
              back,
              `Returned from kitchen - ${session.dayLabel} (approved by ${by})`,
              by
            );
          }
        });

        const consumption = state.kitchenConsumption.filter((c) => c.sessionId === sessionId);
        const cashSpent = state.kitchenCash.filter((c) => c.sessionId === sessionId).reduce((a, c) => a + c.amount, 0);
        let issuedValue = 0;
        let returnedValue = 0;
        let varianceValue = 0;
        session.lines.forEach((l) => {
          issuedValue += (l.issued + l.topUp + l.localPurchased) * l.costPerUnit;
          returnedValue += (l.returned ?? 0) * l.costPerUnit;
          varianceValue += (l.variance ?? 0) * l.costPerUnit;
        });
        const summary: SessionSummary = {
          dishesSold: consumption.reduce((a, c) => a + c.qty, 0),
          theoreticalCost: consumption.reduce((a, c) => a + c.cost, 0),
          issuedValue,
          returnedValue,
          usedValue: issuedValue - returnedValue,
          varianceValue,
          cashSpent,
          cashVariance: session.cashVariance ?? 0,
        };

        set((s) => ({
          kitchenSessions: s.kitchenSessions.map((x) =>
            x.id === sessionId
              ? { ...x, status: 'closed', approvedAt: Date.now(), approvedBy: by, approvalNote: note, summary }
              : x
          ),
        }));
        return { ok: true, id: sessionId };
      },

      rejectClosing: (sessionId, by, note) => {
        const session = get().kitchenSessions.find((s) => s.id === sessionId);
        if (!session || session.status !== 'pending_approval') return fail('No shift session awaiting approval.');
        set((s) => ({
          kitchenSessions: s.kitchenSessions.map((x) =>
            x.id === sessionId
              ? { ...x, status: 'issued', rejectionNote: `${by}: ${note || 'Please recount inventory'}` }
              : x
          ),
        }));
        return { ok: true };
      },

      cancelSession: (sessionId) =>
        set((state) => ({
          kitchenSessions: state.kitchenSessions.filter((s) => !(s.id === sessionId && s.status === 'draft')),
        })),

      // ---------------- Auto deduction ----------------
      processNewTickets: () => {
        const k = get();
        // Oldest handover first: its stock is consumed before a newer handover's stock (FIFO).
        const activeSessions = k.kitchenSessions
          .filter((s) => s.status === 'issued' && !!s.issuedAt)
          .sort((a, b) => (a.issuedAt as number) - (b.issuedAt as number));
        if (activeSessions.length === 0) return;

        const rest = useRestaurantStore.getState();
        const inventory = useOpsStore.getState().inventory;
        const existing = new Set(k.kitchenConsumption.map((c) => c.id));
        const fresh: ConsumptionEntry[] = [];

        // Running expected-on-hand per shift so we can tell which shift really holds the ingredients.
        const onHand = new Map<string, Map<string, number>>();
        for (const s of activeSessions) {
          const m = new Map<string, number>();
          computeLiveLines(s, k.kitchenConsumption, k.kitchenManualUsage).forEach((l) =>
            m.set(l.itemId, l.expectedOnHand)
          );
          onHand.set(s.id, m);
        }

        const pickSession = (
          placedAt: number,
          menuStation: string | undefined,
          usage: { itemId: string; qty: number }[]
        ): KitchenSession | undefined => {
          const cands = activeSessions.filter((s) => placedAt >= (s.issuedAt as number));
          if (cands.length <= 1) return cands[0];
          let best: KitchenSession | undefined;
          let bestScore = -Infinity;
          for (const s of cands) {
            let score = 0;
            const st = s.station && s.station !== 'all' ? s.station : undefined;
            if (st && menuStation) score += st === menuStation ? 1 : -10;
            const held = onHand.get(s.id);
            if (held && usage.length > 0) {
              const cover =
                usage.reduce((a, u) => a + Math.min(1, Math.max(0, held.get(u.itemId) ?? 0) / (u.qty || 1)), 0) /
                usage.length;
              score += cover * 2;
            }
            if (score > bestScore) {
              best = s;
              bestScore = score;
            }
          }
          return best;
        };

        const tickets = [...(rest.tickets || [])].sort((a, b) => (a.timePlaced || 0) - (b.timePlaced || 0));
        for (const t of tickets) {
          for (const it of t.items || []) {
            const id = `ce-${t.id}-${t.timePlaced}-${it.id}`;
            if (existing.has(id)) continue;
            const placedAt = t.timePlaced || 0;
            // Tickets placed before any live handover are not part of any shift.
            if (!activeSessions.some((s) => placedAt >= (s.issuedAt as number))) continue;

            existing.add(id);
            const ref = resolveMenuRef(it.id, rest.menuItems || []);
            const qty = it.qty || 1;
            if (!ref) {
              const target = pickSession(placedAt, undefined, []);
              if (!target) continue;
              fresh.push({
                id,
                sessionId: target.id,
                ticketId: t.id,
                menuItemId: it.id,
                menuItemName: it.name,
                qty,
                at: t.timePlaced,
                revenue: (it.price || 0) * qty,
                cost: 0,
                usage: [],
                missingRecipe: true,
              });
              continue;
            }
            const res = computeItemUsage(
              ref.menu.id,
              ref.variantName,
              qty,
              k.recipes,
              rest.menuItems,
              inventory,
              k.kitchenSettings
            );
            const target = pickSession(placedAt, ref.menu.station, res.usage);
            if (!target) continue;

            const held = onHand.get(target.id);
            if (held) res.usage.forEach((u) => held.set(u.itemId, (held.get(u.itemId) ?? 0) - u.qty));

            fresh.push({
              id,
              sessionId: target.id,
              ticketId: t.id,
              menuItemId: ref.menu.id,
              menuItemName: it.name,
              variantName: ref.variantName,
              qty,
              at: t.timePlaced,
              revenue: (it.price || 0) * qty,
              cost: res.cost,
              usage: res.usage.map((u) => ({ itemId: u.itemId, qty: r3(u.qty) })),
              missingRecipe: res.missingRecipe,
            });
          }
        }

        if (fresh.length > 0) {
          set((s) => ({
            kitchenConsumption: [...fresh, ...s.kitchenConsumption].slice(0, MAX_CONSUMPTION),
          }));
        }
      },

      syncFromServer: (remote) => {
        const next: Partial<KitchenData> = {};
        if (Array.isArray(remote.recipes)) next.recipes = remote.recipes;
        if (Array.isArray(remote.kitchenSessions)) next.kitchenSessions = remote.kitchenSessions;
        if (Array.isArray(remote.kitchenConsumption)) next.kitchenConsumption = remote.kitchenConsumption;
        if (Array.isArray(remote.kitchenManualUsage)) next.kitchenManualUsage = remote.kitchenManualUsage;
        if (Array.isArray(remote.kitchenCash)) next.kitchenCash = remote.kitchenCash;
        if (remote.kitchenSettings && typeof remote.kitchenSettings === 'object') {
          next.kitchenSettings = withKitchenDefaults(remote.kitchenSettings);
        }
        if (Object.keys(next).length > 0) set((state) => ({ ...state, ...next }));
      },
    }),
    {
      name: 'kitchen-storage',
      storage: appStorage,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<KitchenState>;
        return {
          ...current,
          ...p,
          recipes: p.recipes && p.recipes.length > 0 ? p.recipes : INITIAL_RECIPES,
          kitchenSessions: p.kitchenSessions && p.kitchenSessions.length > 0 ? p.kitchenSessions : INITIAL_KITCHEN_SESSIONS,
          kitchenManualUsage: p.kitchenManualUsage && p.kitchenManualUsage.length > 0 ? p.kitchenManualUsage : INITIAL_MANUAL_USAGE,
          kitchenSettings: withKitchenDefaults(p.kitchenSettings),
        };
      },
    }
  )
);

/** Snapshot of the kitchen data keys pushed to the sync hub. */
export function getKitchenSyncState(): KitchenData {
  const s = useKitchenStore.getState();
  return {
    recipes: s.recipes,
    kitchenSessions: s.kitchenSessions,
    kitchenConsumption: s.kitchenConsumption,
    kitchenManualUsage: s.kitchenManualUsage,
    kitchenCash: s.kitchenCash,
    kitchenSettings: s.kitchenSettings,
  };
}

export const getActiveSession = (sessions: KitchenSession[]) =>
  sessions.find((s) => s.status === 'issued' || s.status === 'pending_approval');

/** Every handover currently live in the kitchen (several can run on the same day). */
export const getActiveSessions = (sessions: KitchenSession[]) =>
  sessions
    .filter((s) => s.status === 'issued')
    .sort((a, b) => (a.issuedAt || 0) - (b.issuedAt || 0));

// Auto-deduct raw materials whenever new KOT tickets appear (idempotent per ticket item).
useRestaurantStore.subscribe(() => {
  useKitchenStore.getState().processNewTickets();
});
setTimeout(() => useKitchenStore.getState().processNewTickets(), 1500);
