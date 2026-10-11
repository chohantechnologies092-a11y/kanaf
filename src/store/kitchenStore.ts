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

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      recipes: [],
      kitchenSessions: [],
      kitchenConsumption: [],
      kitchenManualUsage: [],
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
