import type { InventoryItem } from '../store/opsStore';
import type { MenuItem } from '../store/restaurantStore';
import type {
  ConsumptionEntry,
  KitchenSession,
  KitchenSettings,
  ManualUsage,
  Recipe,
  RecipeIngredient,
  RecipeUnit,
  SessionLine,
} from '../types/kitchen';

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

type Dim = 'mass' | 'volume' | 'count';

export const RECIPE_UNITS: RecipeUnit[] = ['g', 'kg', 'ml', 'L', 'pcs'];

const RECIPE_UNIT_META: Record<RecipeUnit, { dim: Dim; factor: number }> = {
  g: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  ml: { dim: 'volume', factor: 1 },
  L: { dim: 'volume', factor: 1000 },
  pcs: { dim: 'count', factor: 1 },
};

export function inventoryUnitMeta(unit: string): { dim: Dim; factor: number } {
  const u = (unit || '').trim().toLowerCase();
  if (['kg', 'kgs', 'kilo', 'kilogram', 'kilograms'].includes(u)) return { dim: 'mass', factor: 1000 };
  if (['g', 'gm', 'gram', 'grams'].includes(u)) return { dim: 'mass', factor: 1 };
  if (['l', 'lt', 'ltr', 'liter', 'liters', 'litre', 'litres'].includes(u)) return { dim: 'volume', factor: 1000 };
  if (['ml', 'milliliter', 'milliliters'].includes(u)) return { dim: 'volume', factor: 1 };
  return { dim: 'count', factor: 1 };
}

/** Converts a quantity entered in recipe units into the inventory item's own unit. */
export function recipeQtyToInventory(qty: number, recipeUnit: RecipeUnit, invUnit: string): number {
  const r = RECIPE_UNIT_META[recipeUnit];
  const i = inventoryUnitMeta(invUnit);
  if (r.dim === i.dim) return (qty * r.factor) / i.factor;
  return qty; // incompatible (e.g. grams vs "bottles") - treated 1:1, UI warns
}

export function unitsCompatible(recipeUnit: RecipeUnit, invUnit: string): boolean {
  return RECIPE_UNIT_META[recipeUnit].dim === inventoryUnitMeta(invUnit).dim;
}

export function defaultRecipeUnit(invUnit: string): RecipeUnit {
  const meta = inventoryUnitMeta(invUnit);
  if (meta.dim === 'mass') return 'g';
  if (meta.dim === 'volume') return 'ml';
  return 'pcs';
}

const trimNum = (n: number, digits = 2) => {
  const f = Math.pow(10, digits);
  return String(Math.round(n * f) / f);
};

/** Human friendly stock quantity: 0.35 kg -> "350 g". */
export function formatQty(qty: number, invUnit: string): string {
  const q = Number.isFinite(qty) ? qty : 0;
  const meta = inventoryUnitMeta(invUnit);
  if (meta.dim === 'mass' && meta.factor === 1000 && Math.abs(q) < 1 && q !== 0) {
    return `${trimNum(q * 1000, 0)} g`;
  }
  if (meta.dim === 'volume' && meta.factor === 1000 && Math.abs(q) < 1 && q !== 0) {
    return `${trimNum(q * 1000, 0)} ml`;
  }
  return `${trimNum(q)} ${invUnit}`;
}

export const money = (n: number) => `Rs. ${Math.round(Number.isFinite(n) ? n : 0).toLocaleString()}`;

// ---------------------------------------------------------------------------
// Recipe cost
// ---------------------------------------------------------------------------

/** Recipe-unit quantity needed for ONE portion (taste + wastage applied). */
export function portionQtyInRecipeUnit(ing: RecipeIngredient, yieldPortions: number): number {
  const taste = 1 + (ing.tasteAdjustPct || 0) / 100;
  const waste = 1 + (ing.wastagePct || 0) / 100;
  return ((ing.qty || 0) * taste * waste) / (yieldPortions > 0 ? yieldPortions : 1);
}

export type CostLine = {
  inventoryItemId: string;
  name: string;
  portionQty: number;
  unit: RecipeUnit;
  invQty: number;
  unitCost: number;
  cost: number;
  pct: number;
  missing: boolean;
  incompatible: boolean;
};

export type RecipeCost = {
  lines: CostLine[];
  ingredientCost: number;
  packagingCost: number;
  overheadCost: number;
  totalCost: number;
  missingCount: number;
};

export function computeRecipeCost(
  recipe: Pick<Recipe, 'ingredients' | 'yieldPortions' | 'packagingCost'>,
  inventory: InventoryItem[],
  settings: Pick<KitchenSettings, 'overheadPct'>
): RecipeCost {
  const lines: CostLine[] = recipe.ingredients.map((ing) => {
    const inv = inventory.find((i) => i.id === ing.inventoryItemId);
    const portionQty = portionQtyInRecipeUnit(ing, recipe.yieldPortions);
    const invQty = inv ? recipeQtyToInventory(portionQty, ing.unit, inv.unit) : 0;
    const unitCost = inv?.costPerUnit ?? 0;
    return {
      inventoryItemId: ing.inventoryItemId,
      name: inv?.name || ing.name,
      portionQty,
      unit: ing.unit,
      invQty,
      unitCost,
      cost: invQty * unitCost,
      pct: 0,
      missing: !inv || !(inv.costPerUnit && inv.costPerUnit > 0),
      incompatible: inv ? !unitsCompatible(ing.unit, inv.unit) : false,
    };
  });
  const ingredientCost = lines.reduce((s, l) => s + l.cost, 0);
  lines.forEach((l) => {
    l.pct = ingredientCost > 0 ? (l.cost / ingredientCost) * 100 : 0;
  });
  const packagingCost = recipe.packagingCost || 0;
  const overheadCost = (ingredientCost * (settings.overheadPct || 0)) / 100;
  return {
    lines,
    ingredientCost,
    packagingCost,
    overheadCost,
    totalCost: ingredientCost + packagingCost + overheadCost,
    missingCount: lines.filter((l) => l.missing).length,
  };
}

export const marginPct = (price: number, cost: number) => (price > 0 ? ((price - cost) / price) * 100 : 0);

export function suggestPrice(totalCost: number, targetMarginPct: number, rounding: number): number {
  const m = Math.min(Math.max(targetMarginPct, 0), 95) / 100;
  const raw = totalCost / (1 - m);
  const step = rounding > 0 ? rounding : 10;
  return Math.ceil(raw / step) * step;
}

// ---------------------------------------------------------------------------
// Menu / ticket resolution
// ---------------------------------------------------------------------------

/** POS builds variant ids as `${menuId}-${variantName}`. */
export function resolveMenuRef(
  itemId: string,
  menuItems: MenuItem[]
): { menu: MenuItem; variantName?: string } | null {
  let best: MenuItem | null = null;
  for (const m of menuItems) {
    if (itemId === m.id || itemId.startsWith(`${m.id}-`)) {
      if (!best || m.id.length > best.id.length) best = m;
    }
  }
  if (!best) return null;
  const variantName = itemId === best.id ? undefined : itemId.slice(best.id.length + 1);
  return { menu: best, variantName };
}

export function findRecipe(recipes: Recipe[], menuItemId: string, variantName?: string): Recipe | undefined {
  if (variantName) {
    const exact = recipes.find(
      (r) => r.menuItemId === menuItemId && (r.variantName || '').toLowerCase() === variantName.toLowerCase()
    );
    if (exact) return exact;
  }
  return recipes.find((r) => r.menuItemId === menuItemId && !r.variantName);
}

export type UsageResult = {
  usage: { itemId: string; qty: number }[];
  cost: number;
  missingRecipe: boolean;
};

/** Ingredient usage (inventory units) for `qty` portions of a sold menu item. Deals expand into components. */
export function computeItemUsage(
  menuItemId: string,
  variantName: string | undefined,
  qty: number,
  recipes: Recipe[],
  menuItems: MenuItem[],
  inventory: InventoryItem[],
  settings: Pick<KitchenSettings, 'overheadPct'>,
  depth = 0
): UsageResult {
  const map = new Map<string, number>();
  let cost = 0;
  let missingRecipe = false;

  const add = (itemId: string, q: number) => map.set(itemId, (map.get(itemId) || 0) + q);

  const menu = menuItems.find((m) => m.id === menuItemId);
  if (menu?.isDeal && menu.dealItems && depth < 2) {
    for (const comp of menu.dealItems) {
      const sub = computeItemUsage(
        comp.menuItemId,
        comp.variantName,
        comp.qty * qty,
        recipes,
        menuItems,
        inventory,
        settings,
        depth + 1
      );
      sub.usage.forEach((u) => add(u.itemId, u.qty));
      cost += sub.cost;
      if (sub.missingRecipe) missingRecipe = true;
    }
    return { usage: Array.from(map, ([itemId, q]) => ({ itemId, qty: q })), cost, missingRecipe };
  }

  const recipe = findRecipe(recipes, menuItemId, variantName);
  if (!recipe) return { usage: [], cost: 0, missingRecipe: true };

  for (const ing of recipe.ingredients) {
    const inv = inventory.find((i) => i.id === ing.inventoryItemId);
    if (!inv) continue;
    const perPortion = recipeQtyToInventory(portionQtyInRecipeUnit(ing, recipe.yieldPortions), ing.unit, inv.unit);
    add(ing.inventoryItemId, perPortion * qty);
  }
  const rc = computeRecipeCost(recipe, inventory, settings);
  cost = rc.totalCost * qty;
  return { usage: Array.from(map, ([itemId, q]) => ({ itemId, qty: q })), cost, missingRecipe: false };
}

// ---------------------------------------------------------------------------
// Session live numbers
// ---------------------------------------------------------------------------

export type LiveLine = SessionLine & {
  theoreticalUsed: number;
  manualUsed: number;
  expectedOnHand: number;
  totalIn: number;
  status: 'ok' | 'low' | 'out';
};

export function computeLiveLines(
  session: KitchenSession,
  consumption: ConsumptionEntry[],
  manual: ManualUsage[]
): LiveLine[] {
  if (!session || !Array.isArray(session.lines)) return [];
  const safeConsumption = Array.isArray(consumption) ? consumption : [];
  const safeManual = Array.isArray(manual) ? manual : [];

  const theo = new Map<string, number>();
  safeConsumption
    .filter((c) => c && c.sessionId === session.id)
    .forEach((c) => {
      const usageList = Array.isArray(c?.usage) ? c.usage : [];
      usageList.forEach((u) => {
        if (u && u.itemId) {
          theo.set(u.itemId, (theo.get(u.itemId) || 0) + (Number(u.qty) || 0));
        }
      });
    });

  const man = new Map<string, number>();
  safeManual
    .filter((m) => m && m.sessionId === session.id)
    .forEach((m) => {
      if (m && m.itemId) {
        man.set(m.itemId, (man.get(m.itemId) || 0) + (Number(m.delta) || 0));
      }
    });

  return session.lines.map((l) => {
    const theoreticalUsed = theo.get(l.itemId) || 0;
    const manualUsed = man.get(l.itemId) || 0;
    const totalIn = (Number(l.issued) || 0) + (Number(l.topUp) || 0) + (Number(l.localPurchased) || 0);
    const expectedOnHand = totalIn - theoreticalUsed - manualUsed;
    const ratio = totalIn > 0 ? expectedOnHand / totalIn : 0;
    return {
      ...l,
      theoreticalUsed,
      manualUsed,
      totalIn,
      expectedOnHand,
      status: expectedOnHand <= 0 ? 'out' : ratio < 0.2 ? 'low' : 'ok',
    };
  });
}

/** Items that appear in at least one recipe (so requisition can focus on cooking ingredients). */
export function recipeItemIds(recipes: Recipe[]): Set<string> {
  const s = new Set<string>();
  (recipes || []).forEach((r) => {
    (r?.ingredients || []).forEach((i) => {
      if (i?.inventoryItemId) s.add(i.inventoryItemId);
    });
  });
  return s;
}

/** Average daily theoretical usage of the last `days` closed sessions per inventory item. */
export function averageDailyUsage(
  sessions: KitchenSession[],
  consumption: ConsumptionEntry[],
  days = 3
): Map<string, number> {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeConsumption = Array.isArray(consumption) ? consumption : [];

  const closed = safeSessions
    .filter((s) => s && s.status === 'closed')
    .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0))
    .slice(0, days);
  const out = new Map<string, number>();
  if (closed.length === 0) return out;
  const ids = new Set(closed.map((s) => s.id));
  safeConsumption
    .filter((c) => c && ids.has(c.sessionId))
    .forEach((c) => {
      const usageList = Array.isArray(c?.usage) ? c.usage : [];
      usageList.forEach((u) => {
        if (u && u.itemId) {
          out.set(u.itemId, (out.get(u.itemId) || 0) + (Number(u.qty) || 0));
        }
      });
    });
  out.forEach((v, k) => out.set(k, v / closed.length));
  return out;
}

export function roundQty(n: number, invUnit: string): number {
  const dim = inventoryUnitMeta(invUnit).dim;
  if (dim === 'count') return Math.ceil(n);
  return Math.ceil(n * 10) / 10; // 0.1 kg / 0.1 L steps
}
