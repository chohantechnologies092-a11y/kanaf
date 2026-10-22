export interface FoodPreset {
  id: string;
  name: string;
  category: string;
  imageUri: string;
  icon: string;
  defaultPrice: number;
  defaultCost: number;
  badge?: string;
  description: string;
}

export const FOOD_PRESETS: FoodPreset[] = [
  // 1. Specialty Coffee & Espresso
  {
    id: 'kanaf-spanish-latte',
    name: 'Kanaf Spanish Latte',
    category: 'Coffee & Espresso',
    imageUri: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&q=80',
    icon: 'cafe-outline',
    defaultPrice: 680,
    defaultCost: 210,
    badge: 'Bestseller',
    description: 'Signature double espresso shot blended with textured condensed milk and velvety microfoam.'
  },
  {
    id: 'artisan-cappuccino',
    name: 'Artisan Cappuccino',
    category: 'Coffee & Espresso',
    imageUri: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&q=80',
    icon: 'cafe-outline',
    defaultPrice: 550,
    defaultCost: 160,
    badge: 'Classic',
    description: 'Rich dark roast espresso topped with thick steamed milk foam and Belgian cocoa dusting.'
  },
  {
    id: 'caramel-macchiato',
    name: 'Caramel Macchiato',
    category: 'Coffee & Espresso',
    imageUri: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600&q=80',
    icon: 'cafe-outline',
    defaultPrice: 640,
    defaultCost: 190,
    badge: 'Popular',
    description: 'Freshly steamed vanilla milk marked with espresso and finished with buttery caramel drizzle.'
  },
  {
    id: 'iced-americano',
    name: 'Cold Brew Iced Americano',
    category: 'Coffee & Espresso',
    imageUri: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80',
    icon: 'cafe-outline',
    defaultPrice: 490,
    defaultCost: 120,
    badge: 'Chilled',
    description: '18-hour slow-steeped Arabica coffee served over crystal artisanal ice cubes.'
  },

  // 2. French Bakery & Croissants
  {
    id: 'butter-croissant',
    name: 'Butter Croissant (Artisan Flaky)',
    category: 'Bakery & Croissants',
    imageUri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80',
    icon: 'restaurant-outline',
    defaultPrice: 420,
    defaultCost: 140,
    badge: 'Freshly Baked',
    description: 'Authentic French golden croissant baked fresh with 100% pure unsalted Normandy butter.'
  },
  {
    id: 'almond-croissant',
    name: 'Almond Frangipane Croissant',
    category: 'Bakery & Croissants',
    imageUri: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
    icon: 'restaurant-outline',
    defaultPrice: 580,
    defaultCost: 190,
    badge: 'Chef Special',
    description: 'Double-baked flaky croissant filled with almond frangipane cream and toasted almond flakes.'
  },
  {
    id: 'pain-au-chocolat',
    name: 'Pain au Chocolat (Dark Chocolate)',
    category: 'Bakery & Croissants',
    imageUri: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600&q=80',
    icon: 'restaurant-outline',
    defaultPrice: 520,
    defaultCost: 170,
    badge: 'Popular',
    description: 'Crisp buttery laminated pastry loaded with two bars of premium Belgian 60% dark chocolate.'
  },
  {
    id: 'blueberry-danish',
    name: 'Blueberry Cream Cheese Danish',
    category: 'Bakery & Croissants',
    imageUri: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&q=80',
    icon: 'restaurant-outline',
    defaultPrice: 490,
    defaultCost: 160,
    badge: 'Fresh',
    description: 'Sweet flaky Danish pastry centered with whipped vanilla cream cheese and wild blueberry compote.'
  },

  // 3. Kunafa & Arabian Sweets
  {
    id: 'royal-cheese-kunafa',
    name: 'Kanaf Royal Cheese Kunafa',
    category: 'Kunafa & Sweets',
    imageUri: 'https://images.unsplash.com/photo-1608836561226-d621b10a26e8?w=600&q=80',
    icon: 'flame-outline',
    defaultPrice: 950,
    defaultCost: 340,
    badge: 'Signature',
    description: 'Crunchy golden kataifi shredded pastry filled with stretchy sweet Akkawi cheese & pistachios.'
  },
  {
    id: 'nutella-kunafa',
    name: 'Nutella Pistachio Kunafa',
    category: 'Kunafa & Sweets',
    imageUri: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&q=80',
    icon: 'flame-outline',
    defaultPrice: 1100,
    defaultCost: 420,
    badge: 'Indulgent',
    description: 'Crisp golden kataifi smothered with melted Nutella ganache and crushed roasted Turkish pistachios.'
  },

  // 4. Cakes & Patisserie
  {
    id: 'lotus-cheesecake',
    name: 'Lotus Biscoff Cheesecake Slice',
    category: 'Cakes & Patisserie',
    imageUri: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80',
    icon: 'heart-outline',
    defaultPrice: 720,
    defaultCost: 260,
    badge: 'Bestseller',
    description: 'Silky smooth baked New York cheesecake on a spiced Speculoos crust topped with molten Lotus.'
  },
  {
    id: 'fudge-cake',
    name: 'Belgian Chocolate Fudge Cake',
    category: 'Cakes & Patisserie',
    imageUri: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80',
    icon: 'heart-outline',
    defaultPrice: 680,
    defaultCost: 230,
    badge: 'Signature',
    description: 'Moist dark chocolate sponge layered with rich Belgian fudge cream and chocolate ganache curls.'
  },
  {
    id: 'tiramisu-cup',
    name: 'Classic Italian Tiramisu Cup',
    category: 'Cakes & Patisserie',
    imageUri: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80',
    icon: 'heart-outline',
    defaultPrice: 650,
    defaultCost: 210,
    badge: 'Chef Special',
    description: 'Traditional espresso-soaked Italian savoiardi biscuits layered with light mascarpone sabayon.'
  },

  // 5. Cafe Brunch & Paninis
  {
    id: 'smoked-chicken-croissant',
    name: 'Smoked Chicken & Cheddar Croissant',
    category: 'Cafe Brunch & Paninis',
    imageUri: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=600&q=80',
    icon: 'fast-food-outline',
    defaultPrice: 850,
    defaultCost: 310,
    badge: 'Chef Special',
    description: 'Flaky butter croissant filled with sliced smoked herb chicken, cheddar cheese & honey mustard.'
  },
  {
    id: 'kanaf-club-sandwich',
    name: 'Kanaf Club Sandwich & Fries',
    category: 'Cafe Brunch & Paninis',
    imageUri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80',
    icon: 'fast-food-outline',
    defaultPrice: 950,
    defaultCost: 340,
    badge: 'Popular',
    description: 'Triple-decker artisan sandwich with grilled chicken, fried egg, cheddar, salad & salted fries.'
  },
  {
    id: 'mozzarella-panini',
    name: 'Grilled Mozzarella & Pesto Panini',
    category: 'Cafe Brunch & Paninis',
    imageUri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80',
    icon: 'fast-food-outline',
    defaultPrice: 790,
    defaultCost: 280,
    badge: 'Vegetarian',
    description: 'Pressed ciabatta bread stuffed with fresh mozzarella, basil pesto, sundried tomatoes & balsamic.'
  },

  // 6. Beverages & Shakes
  {
    id: 'lotus-frappe',
    name: 'Lotus Biscoff Frappe',
    category: 'Beverages & Shakes',
    imageUri: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80',
    icon: 'wine-outline',
    defaultPrice: 620,
    defaultCost: 190,
    badge: 'Chilled',
    description: 'Creamy iced frappe blended with Lotus Biscoff butter, whole milk, espresso shot & whipped cream.'
  },
  {
    id: 'mint-lemonade',
    name: 'Fresh Mint Peach Lemonade',
    category: 'Beverages & Shakes',
    imageUri: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80',
    icon: 'wine-outline',
    defaultPrice: 460,
    defaultCost: 110,
    badge: 'Refreshing',
    description: 'Fizzy refreshing cooler with fresh crushed mint leaves, peach puree, fresh lemon and soda.'
  },

  // 7. Combos & Deals
  {
    id: 'barista-morning-combo',
    name: 'Barista Morning Combo (Coffee + Croissant)',
    category: 'Deals & Combos',
    imageUri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80',
    icon: 'gift-outline',
    defaultPrice: 890,
    defaultCost: 320,
    badge: 'Breakfast Deal',
    description: '1x Specialty Coffee (Spanish Latte or Cappuccino) + 1x Freshly Baked Butter Croissant.'
  },
  {
    id: 'bakers-high-tea',
    name: "Baker's High Tea Platter (2-3 Persons)",
    category: 'Deals & Combos',
    imageUri: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
    icon: 'gift-outline',
    defaultPrice: 2650,
    defaultCost: 980,
    badge: 'Best Value',
    description: '2x Specialty Coffees + 2x Smoked Chicken Croissants + 1x Lotus Cheesecake + 1x Cheese Kunafa.'
  }
];

export const POPULAR_BADGES = [
  'Bestseller',
  'Chef Special',
  'Signature',
  'Freshly Baked',
  'Classic',
  'Popular',
  'Chilled',
  'Indulgent',
  'Breakfast Deal',
  'Best Value',
  'Vegetarian 🥬',
  'New'
];
