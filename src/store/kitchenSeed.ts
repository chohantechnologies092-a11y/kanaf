import { useOpsStore, InventoryItem } from './opsStore';
import { useRestaurantStore } from './restaurantStore';
import { useKitchenStore } from './kitchenStore';
import type { Recipe, RecipeIngredient, RecipeUnit } from '../types/kitchen';

/**
 * One-tap starter data for Kanaf Cafe & Bakery: makes sure the raw materials exist in
 * the store inventory and creates realistic starter recipes (grams per portion) for the
 * default menu. Baristas and pastry chefs then fine-tune in the Recipe Manager.
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
  coffeeBeans: { name: 'Arabica Espresso Roast Beans', category: 'Beverages', unit: 'kg', cost: 3400, threshold: 5, stock: 18 },
  milk: { name: 'Fresh Full Cream Milk', category: 'Dairy', unit: 'Liters', cost: 240, threshold: 20, stock: 45 },
  condensedMilk: { name: 'Sweetened Condensed Milk', category: 'Dairy', unit: 'kg', cost: 580, threshold: 5, stock: 15 },
  vanillaSyrup: { name: 'Madagascar Vanilla Syrup', category: 'Pantry', unit: 'Liters', cost: 1800, threshold: 2, stock: 6 },
  caramelSauce: { name: 'Gourmet Salted Caramel Sauce', category: 'Pantry', unit: 'kg', cost: 2100, threshold: 2, stock: 5 },
  pastryFlour: { name: 'French Pastry Flour (T55)', category: 'Grains', unit: 'kg', cost: 220, threshold: 25, stock: 60 },
  croissantButter: { name: 'Pure Unsalted Butter (82% Fat)', category: 'Dairy', unit: 'kg', cost: 2200, threshold: 10, stock: 25 },
  belgianChocolate: { name: 'Belgian 60% Dark Chocolate Batons', category: 'Pantry', unit: 'kg', cost: 3600, threshold: 4, stock: 12 },
  almonds: { name: 'Toasted Sliced Almonds', category: 'Pantry', unit: 'kg', cost: 2800, threshold: 3, stock: 8 },
  creamCheese: { name: 'Philadelphia Cream Cheese', category: 'Dairy', unit: 'kg', cost: 1900, threshold: 6, stock: 16 },
  lotusSpread: { name: 'Lotus Biscoff Spread', category: 'Pantry', unit: 'kg', cost: 2400, threshold: 4, stock: 10 },
  kataifi: { name: 'Kataifi Shredded Pastry', category: 'Grains', unit: 'kg', cost: 750, threshold: 5, stock: 15 },
  akkawiCheese: { name: 'Sweet Akkawi Cheese', category: 'Dairy', unit: 'kg', cost: 1800, threshold: 6, stock: 14 },
  sugar: { name: 'Fine Baker Sugar', category: 'Pantry', unit: 'kg', cost: 150, threshold: 10, stock: 35 },
  pistachio: { name: 'Turkish Roasted Pistachios', category: 'Pantry', unit: 'kg', cost: 3400, threshold: 2, stock: 6 },
  ghee: { name: 'Desi Clarified Butter (Ghee)', category: 'Dairy', unit: 'kg', cost: 1900, threshold: 5, stock: 12 },
  chickenSmoked: { name: 'Smoked Herb Chicken Breast', category: 'Meat', unit: 'kg', cost: 1100, threshold: 5, stock: 12 },
  cheddarCheese: { name: 'Vintage Cheddar Cheese Slices', category: 'Dairy', unit: 'kg', cost: 1850, threshold: 4, stock: 10 },
  ciabattaBread: { name: 'Artisan Ciabatta Panini Loaves', category: 'Bakery', unit: 'pcs', cost: 95, threshold: 15, stock: 35 },
  pestoSauce: { name: 'Fresh Basil Pesto', category: 'Pantry', unit: 'kg', cost: 1950, threshold: 2, stock: 4 },
  mint: { name: 'Fresh Garden Mint', category: 'Produce', unit: 'kg', cost: 400, threshold: 2, stock: 5 },
  lemon: { name: 'Juicy Yellow Lemons', category: 'Produce', unit: 'kg', cost: 260, threshold: 3, stock: 8 },
  peachPuree: { name: 'Natural Peach Fruit Puree', category: 'Beverages', unit: 'Liters', cost: 1200, threshold: 3, stock: 8 },
  sodaWater: { name: 'Chilled Club Soda Water', category: 'Beverages', unit: 'Liters', cost: 80, threshold: 20, stock: 50 },
  ice: { name: 'Purified Crystal Ice', category: 'Supplies', unit: 'kg', cost: 20, threshold: 20, stock: 60 },
};

type Spec = [key: string, qty: number, unit: RecipeUnit, wastage: number, role?: RecipeIngredient['role']];

type RecipeDef = {
  menuId: string;
  base: Spec[];
  packaging: number;
  prepTimeMin?: number;
  notes: string;
  variantScales?: Record<string, number>;
};

const DEFS: RecipeDef[] = [
  {
    menuId: 'm1',
    packaging: 15,
    prepTimeMin: 4,
    notes: 'Kanaf Spanish Latte: Double shot espresso, textured condensed milk & microfoam.',
    base: [
      ['coffeeBeans', 18, 'g', 2, 'main'],
      ['condensedMilk', 35, 'g', 0, 'base'],
      ['milk', 180, 'ml', 3, 'base'],
    ],
  },
  {
    menuId: 'm2',
    packaging: 15,
    prepTimeMin: 4,
    notes: 'Artisan Cappuccino: Rich dark roast, thick milk foam and cocoa.',
    base: [
      ['coffeeBeans', 18, 'g', 2, 'main'],
      ['milk', 160, 'ml', 3, 'base'],
    ],
  },
  {
    menuId: 'm3',
    packaging: 15,
    prepTimeMin: 4,
    notes: 'Caramel Macchiato: Vanilla steamed milk, espresso shot & caramel sauce.',
    base: [
      ['coffeeBeans', 18, 'g', 2, 'main'],
      ['milk', 160, 'ml', 3, 'base'],
      ['vanillaSyrup', 15, 'ml', 0, 'masala'],
      ['caramelSauce', 15, 'g', 0, 'garnish'],
    ],
  },
  {
    menuId: 'm4',
    packaging: 15,
    prepTimeMin: 3,
    notes: 'Cold Brew Iced Americano: Slow steeped Arabica coffee over crystal ice.',
    base: [
      ['coffeeBeans', 22, 'g', 2, 'main'],
      ['ice', 120, 'g', 0, 'base'],
    ],
  },
  {
    menuId: 'm5',
    packaging: 10,
    prepTimeMin: 15,
    notes: 'Butter Croissant: French butter layers baked golden and flaky.',
    base: [
      ['pastryFlour', 85, 'g', 3, 'main'],
      ['croissantButter', 45, 'g', 0, 'oil'],
      ['milk', 30, 'ml', 0, 'base'],
      ['sugar', 10, 'g', 0, 'base'],
    ],
  },
  {
    menuId: 'm6',
    packaging: 10,
    prepTimeMin: 15,
    notes: 'Almond Frangipane Croissant: Filled with almond cream and sliced almonds.',
    base: [
      ['pastryFlour', 85, 'g', 3, 'main'],
      ['croissantButter', 45, 'g', 0, 'oil'],
      ['almonds', 25, 'g', 2, 'garnish'],
      ['sugar', 20, 'g', 0, 'base'],
    ],
  },
  {
    menuId: 'm7',
    packaging: 10,
    prepTimeMin: 15,
    notes: 'Pain au Chocolat: Laminated butter pastry with Belgian dark chocolate batons.',
    base: [
      ['pastryFlour', 85, 'g', 3, 'main'],
      ['croissantButter', 45, 'g', 0, 'oil'],
      ['belgianChocolate', 30, 'g', 0, 'main'],
    ],
  },
  {
    menuId: 'm8',
    packaging: 10,
    prepTimeMin: 15,
    notes: 'Blueberry Cream Cheese Danish: Cream cheese and blueberry compote.',
    base: [
      ['pastryFlour', 75, 'g', 3, 'main'],
      ['croissantButter', 40, 'g', 0, 'oil'],
      ['creamCheese', 30, 'g', 0, 'base'],
      ['sugar', 15, 'g', 0, 'base'],
    ],
  },
  {
    menuId: 'm9',
    packaging: 20,
    prepTimeMin: 20,
    notes: 'Kanaf Royal Cheese Kunafa: Stretchy sweet cheese, rose syrup, roasted pistachios.',
    variantScales: { single: 1, family: 2 },
    base: [
      ['kataifi', 140, 'g', 3, 'main'],
      ['akkawiCheese', 120, 'g', 0, 'main'],
      ['ghee', 40, 'g', 0, 'oil'],
      ['sugar', 60, 'g', 0, 'base'],
      ['pistachio', 15, 'g', 0, 'garnish'],
    ],
  },
  {
    menuId: 'm10',
    packaging: 20,
    prepTimeMin: 20,
    notes: 'Nutella Pistachio Kunafa: Crispy kataifi smothered in Nutella and pistachios.',
    base: [
      ['kataifi', 140, 'g', 3, 'main'],
      ['ghee', 40, 'g', 0, 'oil'],
      ['pistachio', 25, 'g', 0, 'garnish'],
    ],
  },
  {
    menuId: 'm14',
    packaging: 15,
    prepTimeMin: 8,
    notes: 'Smoked Chicken & Cheddar Croissant: Warm croissant sandwich with cheddar.',
    base: [
      ['pastryFlour', 85, 'g', 3, 'base'],
      ['croissantButter', 45, 'g', 0, 'oil'],
      ['chickenSmoked', 90, 'g', 2, 'main'],
      ['cheddarCheese', 35, 'g', 0, 'main'],
    ],
  },
  {
    menuId: 'm16',
    packaging: 12,
    prepTimeMin: 7,
    notes: 'Grilled Mozzarella & Pesto Panini: Pressed ciabatta with pesto and cheese.',
    base: [
      ['ciabattaBread', 1, 'pcs', 0, 'base'],
      ['pestoSauce', 25, 'g', 0, 'masala'],
      ['akkawiCheese', 60, 'g', 0, 'main'],
    ],
  },
  {
    menuId: 'm18',
    packaging: 10,
    prepTimeMin: 4,
    notes: 'Fresh Mint Peach Lemonade: Refreshing fizzy cooler with peach puree.',
    base: [
      ['mint', 12, 'g', 10, 'main'],
      ['lemon', 35, 'g', 15, 'main'],
      ['peachPuree', 40, 'ml', 0, 'base'],
      ['sodaWater', 150, 'ml', 0, 'base'],
      ['ice', 100, 'g', 0, 'base'],
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
