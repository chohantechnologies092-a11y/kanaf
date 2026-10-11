import { useOpsStore, InventoryItem } from './opsStore';
import { useRestaurantStore } from './restaurantStore';
import { useKitchenStore } from './kitchenStore';
import type { Recipe, RecipeIngredient, RecipeUnit } from '../types/kitchen';

/**
 * One-tap starter data for Sultan Restaurant: makes sure the raw materials exist in
 * the store inventory and creates realistic starter recipes (grams per portion) for the
 * default menu. Owners then fine-tune the grams in the Recipe Manager.
 */

type IngSpec = {
  name: string;
  category: string;
  unit: string;
  cost: number;
  threshold: number;
  stock: number;
};

const SPECS: Record<string, IngSpec> = {
  chicken: { name: 'Chicken (Boneless)', category: 'Meat', unit: 'kg', cost: 780, threshold: 20, stock: 15 },
  chickenBone: { name: 'Chicken (With Bone)', category: 'Meat', unit: 'kg', cost: 540, threshold: 15, stock: 25 },
  mutton: { name: 'Mutton', category: 'Meat', unit: 'kg', cost: 2200, threshold: 15, stock: 35 },
  muttonRibs: { name: 'Mutton Ribs (Raw)', category: 'Meat', unit: 'kg', cost: 2600, threshold: 8, stock: 12 },
  beef: { name: 'Beef Mince (Keema)', category: 'Meat', unit: 'kg', cost: 1300, threshold: 10, stock: 20 },
  flour: { name: 'Wheat Flour (Naan / Roti)', category: 'Grains', unit: 'kg', cost: 150, threshold: 15, stock: 40 },
  oil: { name: 'Cooking Oil', category: 'Pantry', unit: 'Liters', cost: 520, threshold: 15, stock: 45 },
  yogurt: { name: 'Yogurt (Dahi)', category: 'Dairy', unit: 'kg', cost: 240, threshold: 8, stock: 12 },
  onion: { name: 'Onions', category: 'Produce', unit: 'kg', cost: 120, threshold: 10, stock: 30 },
  tomato: { name: 'Tomatoes', category: 'Produce', unit: 'kg', cost: 150, threshold: 10, stock: 18 },
  mint: { name: 'Mint Leaves', category: 'Produce', unit: 'kg', cost: 400, threshold: 5, stock: 5 },
  gingerGarlic: { name: 'Ginger Garlic Paste', category: 'Pantry', unit: 'kg', cost: 450, threshold: 4, stock: 8 },
  chilli: { name: 'Green Chillies', category: 'Produce', unit: 'kg', cost: 300, threshold: 3, stock: 6 },
  karahiMasala: { name: 'Karahi Masala', category: 'Pantry', unit: 'kg', cost: 1400, threshold: 2, stock: 4 },
  kebabSpice: { name: 'Kebab Spice Mix', category: 'Pantry', unit: 'kg', cost: 1600, threshold: 2, stock: 3 },
  rubSpice: { name: 'Mutton Rib Rub Spice', category: 'Pantry', unit: 'kg', cost: 1800, threshold: 1, stock: 2 },
  salt: { name: 'Salt', category: 'Pantry', unit: 'kg', cost: 60, threshold: 5, stock: 15 },
  ghee: { name: 'Desi Ghee', category: 'Dairy', unit: 'kg', cost: 1900, threshold: 5, stock: 12 },
  mozzarella: { name: 'Mozzarella Cheese', category: 'Dairy', unit: 'kg', cost: 1500, threshold: 5, stock: 10 },
  bellPepper: { name: 'Bell Peppers (Mix)', category: 'Produce', unit: 'kg', cost: 280, threshold: 3, stock: 6 },
  olives: { name: 'Black Olives', category: 'Pantry', unit: 'kg', cost: 900, threshold: 2, stock: 4 },
  pizzaSauce: { name: 'Pizza Sauce', category: 'Pantry', unit: 'kg', cost: 380, threshold: 4, stock: 8 },
  chickpeas: { name: 'Chickpeas (Chana)', category: 'Grains', unit: 'kg', cost: 320, threshold: 5, stock: 12 },
  tahini: { name: 'Tahini Paste', category: 'Pantry', unit: 'kg', cost: 1200, threshold: 2, stock: 4 },
  oliveOil: { name: 'Olive Oil', category: 'Pantry', unit: 'Liters', cost: 2400, threshold: 2, stock: 5 },
  lemon: { name: 'Lemon', category: 'Produce', unit: 'kg', cost: 260, threshold: 3, stock: 6 },
  kataifi: { name: 'Kataifi Pastry', category: 'Grains', unit: 'kg', cost: 700, threshold: 3, stock: 6 },
  sugar: { name: 'Sugar', category: 'Pantry', unit: 'kg', cost: 150, threshold: 10, stock: 25 },
  pistachio: { name: 'Pistachios', category: 'Pantry', unit: 'kg', cost: 3200, threshold: 1, stock: 2 },
  sodaWater: { name: 'Soda Water', category: 'Beverages', unit: 'Liters', cost: 80, threshold: 20, stock: 40 },
  ice: { name: 'Ice', category: 'Supplies', unit: 'kg', cost: 20, threshold: 20, stock: 50 },
};

type Spec = [key: string, qty: number, unit: RecipeUnit, wastage: number, role?: RecipeIngredient['role']];

type RecipeDef = {
  menuId: string;
  base: Spec[];
  packaging: number;
  prepTimeMin?: number;
  notes: string;
  /** Matches variant names (lowercase substring) -> multiplier on the base quantities. */
  variantScales?: Record<string, number>;
};

const DEFS: RecipeDef[] = [
  {
    menuId: 'm1',
    packaging: 0,
    prepTimeMin: 20,
    notes: 'Mutton + beef keema, kebab spice, charcoal grill. 2 skewers per plate.',
    base: [
      ['mutton', 120, 'g', 5, 'main'],
      ['beef', 100, 'g', 5, 'main'],
      ['onion', 40, 'g', 8, 'base'],
      ['kebabSpice', 12, 'g', 0, 'masala'],
      ['gingerGarlic', 10, 'g', 0, 'masala'],
      ['chilli', 5, 'g', 10, 'masala'],
      ['oil', 15, 'ml', 0, 'oil'],
      ['salt', 3, 'g', 0, 'masala'],
      ['mint', 6, 'g', 10, 'garnish'],
    ],
  },
  {
    menuId: 'm2',
    packaging: 0,
    prepTimeMin: 30,
    notes: 'Desi ghee karahi, tomato based, finish with green chilli & ginger.',
    base: [
      ['chickenBone', 650, 'g', 10, 'main'],
      ['tomato', 250, 'g', 5, 'base'],
      ['gingerGarlic', 25, 'g', 0, 'masala'],
      ['chilli', 20, 'g', 10, 'masala'],
      ['karahiMasala', 20, 'g', 0, 'masala'],
      ['ghee', 60, 'g', 0, 'oil'],
      ['oil', 40, 'ml', 0, 'oil'],
      ['yogurt', 50, 'g', 0, 'base'],
      ['salt', 6, 'g', 0, 'masala'],
    ],
  },
  {
    menuId: 'm3',
    packaging: 0,
    prepTimeMin: 10,
    notes: 'Hummus with fresh pita.',
    base: [
      ['chickpeas', 80, 'g', 0, 'main'],
      ['tahini', 30, 'g', 0, 'main'],
      ['oliveOil', 20, 'ml', 0, 'oil'],
      ['lemon', 20, 'g', 20, 'base'],
      ['gingerGarlic', 5, 'g', 0, 'masala'],
      ['salt', 2, 'g', 0, 'masala'],
      ['flour', 120, 'g', 3, 'base'],
      ['oil', 5, 'ml', 0, 'oil'],
    ],
  },
  {
    menuId: 'm4',
    packaging: 0,
    prepTimeMin: 25,
    notes: 'Kataifi pastry, stretchy cheese, sugar syrup, pistachio.',
    base: [
      ['kataifi', 120, 'g', 3, 'main'],
      ['mozzarella', 100, 'g', 0, 'main'],
      ['sugar', 60, 'g', 0, 'base'],
      ['ghee', 40, 'g', 0, 'oil'],
      ['pistachio', 10, 'g', 0, 'garnish'],
    ],
  },
  {
    menuId: 'm5',
    packaging: 0,
    prepTimeMin: 5,
    notes: 'Blend mint + lemon + soda over ice.',
    base: [
      ['mint', 15, 'g', 10, 'main'],
      ['lemon', 40, 'g', 15, 'main'],
      ['sodaWater', 150, 'ml', 0, 'base'],
      ['sugar', 20, 'g', 0, 'base'],
      ['ice', 100, 'g', 0, 'base'],
    ],
  },
  {
    menuId: 'm6',
    packaging: 25,
    prepTimeMin: 22,
    notes: 'Base = Medium (10"). Other sizes scale automatically.',
    variantScales: { small: 0.6, medium: 1, large: 1.5, family: 2.1 },
    base: [
      ['flour', 250, 'g', 3, 'base'],
      ['chicken', 100, 'g', 5, 'main'],
      ['mozzarella', 110, 'g', 0, 'main'],
      ['bellPepper', 35, 'g', 10, 'garnish'],
      ['olives', 12, 'g', 0, 'garnish'],
      ['pizzaSauce', 65, 'g', 0, 'base'],
      ['oil', 8, 'ml', 0, 'oil'],
      ['salt', 2, 'g', 0, 'masala'],
    ],
  },
  {
    menuId: 'm7',
    packaging: 0,
    prepTimeMin: 45,
    notes: 'Slow smoked ribs, rub marinade overnight. Half KG served = 600 g raw.',
    variantScales: { half: 1, '1 kg': 2 },
    base: [
      ['muttonRibs', 600, 'g', 5, 'main'],
      ['rubSpice', 25, 'g', 0, 'masala'],
      ['oil', 20, 'ml', 0, 'oil'],
      ['gingerGarlic', 15, 'g', 0, 'masala'],
      ['lemon', 10, 'g', 0, 'base'],
      ['salt', 4, 'g', 0, 'masala'],
    ],
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

function scaleFor(def: RecipeDef, variantName: string): number {
  if (!def.variantScales) return 1;
  const v = variantName.toLowerCase();
  const key = Object.keys(def.variantScales).find((k) => v.includes(k));
  return key ? def.variantScales[key] : 1;
}

export function seedKitchenStarter(): { ingredientsAdded: number; recipesAdded: number } {
  const ops = useOpsStore.getState();
  const kitchen = useKitchenStore.getState();
  const rest = useRestaurantStore.getState();

  // 1. Ensure every raw material exists in the store inventory
  let ingredientsAdded = 0;
  const findByName = (name: string): InventoryItem | undefined =>
    useOpsStore.getState().inventory.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());

  const idByKey: Record<string, string> = {};
  for (const [key, spec] of Object.entries(SPECS)) {
    let item = findByName(spec.name);
    if (!item) {
      ops.addInventoryItem({
        name: spec.name,
        category: spec.category,
        unit: spec.unit,
        stock: spec.stock,
        threshold: spec.threshold,
        costPerUnit: spec.cost,
        supplier: '',
        supplierPhone: '',
      });
      ingredientsAdded++;
      item = findByName(spec.name);
    }
    if (item) idByKey[key] = item.id;
  }

  // 2. Create recipes for menu items that exist and have no recipe yet
  let recipesAdded = 0;
  for (const def of DEFS) {
    const menu = rest.menuItems.find((m) => m.id === def.menuId);
    if (!menu) continue;

    const variants: (string | undefined)[] =
      menu.variants && menu.variants.length > 0 ? menu.variants.map((v) => v.name) : [undefined];

    for (const variantName of variants) {
      const exists = useKitchenStore
        .getState()
        .recipes.some(
          (r) => r.menuItemId === menu.id && (r.variantName || '') === (variantName || '')
        );
      if (exists) continue;

      const scale = variantName ? scaleFor(def, variantName) : 1;
      const ingredients: RecipeIngredient[] = def.base
        .filter(([key]) => !!idByKey[key])
        .map(([key, qty, unit, wastage, role]) => ({
          inventoryItemId: idByKey[key],
          name: SPECS[key].name,
          qty: r2(qty * scale),
          unit,
          wastagePct: wastage,
          tasteAdjustPct: 0,
          role,
        }));

      const recipe: Omit<Recipe, 'id' | 'version' | 'updatedAt'> = {
        menuItemId: menu.id,
        menuItemName: menu.name,
        variantName,
        yieldPortions: 1,
        prepTimeMin: def.prepTimeMin || 15,
        ingredients,
        packagingCost: r2(def.packaging * (scale >= 1 ? Math.sqrt(scale) : 1)),
        prepNotes: def.notes,
      };
      kitchen.saveRecipe(recipe);
      recipesAdded++;
    }
  }

  return { ingredientsAdded, recipesAdded };
}
