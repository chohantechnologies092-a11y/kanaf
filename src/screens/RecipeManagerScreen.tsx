import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import KitchenOpsNav from '../components/KitchenOpsNav';
import RoyalDropdown from '../components/RoyalDropdown';
import { useOpsStore } from '../store/opsStore';
import { useRestaurantStore } from '../store/restaurantStore';
import { useKitchenStore } from '../store/kitchenStore';
import { seedKitchenStarter } from '../store/kitchenSeed';
import type { Recipe, RecipeIngredient, RecipeUnit } from '../types/kitchen';
import {
  computeRecipeCost,
  defaultRecipeUnit,
  findRecipe,
  formatQty,
  marginPct,
  money,
  RECIPE_UNITS,
  suggestPrice,
} from '../utils/kitchenMath';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  burgundyLight: '#6B1F24',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
  cream: '#FDFBF7',
};

const INGREDIENT_ROLES: { id: NonNullable<RecipeIngredient['role']>; label: string; color: string }[] = [
  { id: 'main', label: 'Main Protein/Base', color: '#C62828' },
  { id: 'masala', label: 'Masala & Spices', color: '#E65100' },
  { id: 'oil', label: 'Oil / Ghee / Butter', color: '#F57F17' },
  { id: 'garnish', label: 'Garnish & Fresh', color: '#2E7D32' },
  { id: 'base', label: 'Sauce / Broth / Base', color: '#0277BD' },
];

export default function RecipeManagerScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const { inventory } = useOpsStore();
  const { menuItems, categories } = useRestaurantStore();
  const { recipes, kitchenSettings, saveRecipe, deleteRecipe } = useKitchenStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined);

  // Recipe edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Form draft state inside modal
  const [draftYield, setDraftYield] = useState('1');
  const [draftPackaging, setDraftPackaging] = useState('0');
  const [draftPrepTime, setDraftPrepTime] = useState('15');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);

  // Add / edit ingredient sub-modal
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [editingIngIndex, setEditingIngIndex] = useState<number | null>(null);
  const [selectedInvId, setSelectedInvId] = useState<string>('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState<RecipeUnit>('g');
  const [ingWastage, setIngWastage] = useState('0');
  const [ingTaste, setIngTaste] = useState('0');
  const [ingRole, setIngRole] = useState<RecipeIngredient['role']>('main');
  const [invSearch, setInvSearch] = useState('');

  // Target margin calculator inside recipe details
  const [calcMarginPct, setCalcMarginPct] = useState(kitchenSettings.targetMarginPct);
  // Interactive batch scaling multiplier (1x, 5x, 10x, 25x, 50x)
  const [batchScale, setBatchScale] = useState<number>(1);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.isDeal) return false; // Deals are composed of dishes
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, search]);

  // Active dish
  const activeDish = useMemo(() => {
    if (!selectedMenuId) {
      return filteredMenuItems[0] || menuItems[0] || null;
    }
    return menuItems.find((m) => m.id === selectedMenuId) || null;
  }, [selectedMenuId, filteredMenuItems, menuItems]);

  // Active variant (if any)
  const currentVariantName = useMemo(() => {
    if (!activeDish || !activeDish.variants || activeDish.variants.length === 0) return undefined;
    if (selectedVariant && activeDish.variants.some((v) => v.name === selectedVariant)) {
      return selectedVariant;
    }
    return activeDish.variants[0]?.name;
  }, [activeDish, selectedVariant]);

  // Current recipe for active dish and variant
  const currentRecipe = useMemo(() => {
    if (!activeDish) return null;
    return findRecipe(recipes, activeDish.id, currentVariantName);
  }, [recipes, activeDish, currentVariantName]);

  // Live costing for current recipe
  const currentCost = useMemo(() => {
    if (!currentRecipe) return null;
    return computeRecipeCost(currentRecipe, inventory, kitchenSettings);
  }, [currentRecipe, inventory, kitchenSettings]);

  // Effective selling price for current dish / variant
  const currentPrice = useMemo(() => {
    if (!activeDish) return 0;
    if (currentVariantName && activeDish.variants) {
      const v = activeDish.variants.find((x) => x.name === currentVariantName);
      if (v) return v.price;
    }
    return activeDish.price;
  }, [activeDish, currentVariantName]);

  // Open recipe editor
  const handleOpenEditor = (recipeToEdit?: Recipe | null) => {
    if (!activeDish) return;
    if (recipeToEdit) {
      setEditingRecipe(recipeToEdit);
      setDraftYield(String(recipeToEdit.yieldPortions || 1));
      setDraftPackaging(String(recipeToEdit.packagingCost || 0));
      setDraftPrepTime(String(recipeToEdit.prepTimeMin ?? 15));
      setDraftNotes(recipeToEdit.prepNotes || '');
      setDraftIngredients([...recipeToEdit.ingredients]);
    } else {
      setEditingRecipe(null);
      setDraftYield('1');
      setDraftPackaging('15');
      setDraftPrepTime('15');
      setDraftNotes('');
      setDraftIngredients([]);
    }
    setEditModalOpen(true);
  };

  // Open ingredient modal
  const handleOpenIngModal = (index?: number) => {
    if (typeof index === 'number' && draftIngredients[index]) {
      const existing = draftIngredients[index];
      setEditingIngIndex(index);
      setSelectedInvId(existing.inventoryItemId);
      setIngQty(String(existing.qty));
      setIngUnit(existing.unit);
      setIngWastage(String(existing.wastagePct || 0));
      setIngTaste(String(existing.tasteAdjustPct || 0));
      setIngRole(existing.role || 'main');
    } else {
      setEditingIngIndex(null);
      const firstItem = inventory[0];
      setSelectedInvId(firstItem?.id || '');
      setIngQty('100');
      setIngUnit(firstItem ? defaultRecipeUnit(firstItem.unit) : 'g');
      setIngWastage('0');
      setIngTaste('0');
      setIngRole('main');
    }
    setInvSearch('');
    setIngModalOpen(true);
  };

  // Save ingredient into draft
  const handleSaveIngredient = () => {
    const inv = inventory.find((i) => i.id === selectedInvId);
    if (!inv) {
      Alert.alert('Error', 'Please select a valid inventory item.');
      return;
    }
    const qtyNum = parseFloat(ingQty);
    if (!qtyNum || qtyNum <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity greater than 0.');
      return;
    }

    const newIng: RecipeIngredient = {
      inventoryItemId: inv.id,
      name: inv.name,
      qty: qtyNum,
      unit: ingUnit,
      wastagePct: parseFloat(ingWastage) || 0,
      tasteAdjustPct: parseFloat(ingTaste) || 0,
      role: ingRole,
    };

    if (editingIngIndex !== null) {
      const updated = [...draftIngredients];
      updated[editingIngIndex] = newIng;
      setDraftIngredients(updated);
    } else {
      setDraftIngredients([...draftIngredients, newIng]);
    }
    setIngModalOpen(false);
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = draftIngredients.filter((_, i) => i !== index);
    setDraftIngredients(updated);
  };

  // Save recipe
  const handleSaveRecipe = () => {
    if (!activeDish) return;
    if (draftIngredients.length === 0) {
      Alert.alert('Validation', 'A recipe must contain at least 1 ingredient.');
      return;
    }
    const yieldNum = parseFloat(draftYield);
    if (!yieldNum || yieldNum <= 0) {
      Alert.alert('Validation', 'Portion yield must be greater than 0.');
      return;
    }

    saveRecipe({
      id: editingRecipe?.id,
      menuItemId: activeDish.id,
      menuItemName: activeDish.name,
      variantName: currentVariantName,
      yieldPortions: yieldNum,
      prepTimeMin: parseFloat(draftPrepTime) > 0 ? parseFloat(draftPrepTime) : undefined,
      ingredients: draftIngredients,
      packagingCost: parseFloat(draftPackaging) || 0,
      prepNotes: draftNotes.trim() || undefined,
    });

    setEditModalOpen(false);
    Alert.alert('Saved', `Recipe for "${activeDish.name}${currentVariantName ? ` (${currentVariantName})` : ''}" updated successfully.`);
  };

  // Delete recipe
  const handleDeleteRecipe = () => {
    if (!currentRecipe) return;
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete the recipe for "${currentRecipe.menuItemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecipe(currentRecipe.id);
          },
        },
      ]
    );
  };

  // Copy recipe to other variants
  const handleCopyToVariant = (targetVariant: string) => {
    if (!activeDish || !currentRecipe) return;
    saveRecipe({
      menuItemId: activeDish.id,
      menuItemName: activeDish.name,
      variantName: targetVariant,
      yieldPortions: currentRecipe.yieldPortions,
      prepTimeMin: currentRecipe.prepTimeMin,
      ingredients: currentRecipe.ingredients.map((i) => ({ ...i })),
      packagingCost: currentRecipe.packagingCost,
      prepNotes: currentRecipe.prepNotes,
    });
    setSelectedVariant(targetVariant);
    Alert.alert('Copied', `Recipe copied to variant "${targetVariant}". You can now scale the quantities.`);
  };

  // Filtered inventory items for picker
  const filteredInventory = useMemo(() => {
    if (!invSearch.trim()) return inventory;
    const q = invSearch.toLowerCase();
    return inventory.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [inventory, invSearch]);

  return (
    <View style={styles.container}>
      <KitchenOpsNav backRoute={backRoute} />

      <View style={styles.mainLayout}>
        {/* Left Column: Menu Items Selector */}
        <View style={[styles.leftPane, isMobile && styles.leftPaneMobile]}>
          <View style={styles.paneHeader}>
            <Text style={styles.paneTitle}>Menu Dishes ({filteredMenuItems.length})</Text>
            <TouchableOpacity
              style={styles.seedBtn}
              onPress={() => {
                const res = seedKitchenStarter();
                Alert.alert(
                  res.recipesAdded > 0 ? 'Recipes Seeded' : 'Notice',
                  res.recipesAdded > 0
                    ? `Successfully seeded ${res.recipesAdded} Sultan recipes and ${res.ingredientsAdded} ingredients with precise gram weights!`
                    : 'All starter recipes already exist in the database.'
                );
              }}
            >
              <Ionicons name="sparkles" size={13} color={BRAND.goldDark} />
              <Text style={styles.seedBtnText}>Seed Default BOM</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Categories */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={BRAND.muted} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dish or category..."
              placeholderTextColor={BRAND.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={16} color={BRAND.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Dropdown Selector */}
          <View style={styles.categoryDropdownWrap}>
            <TouchableOpacity
              style={[styles.categoryDropdownTrigger, categoryDropdownOpen && styles.categoryDropdownTriggerActive]}
              onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              activeOpacity={0.8}
            >
              <View style={styles.categoryDropdownTriggerLeft}>
                <Ionicons name="filter" size={14} color={BRAND.burgundy} />
                <Text style={styles.categoryDropdownSelectedLabel}>
                  {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                </Text>
                <View style={styles.categoryPillCount}>
                  <Text style={styles.categoryPillCountText}>
                    {selectedCategory === 'all'
                      ? menuItems.length
                      : menuItems.filter((m) => m.category === selectedCategory).length}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={BRAND.muted}
              />
            </TouchableOpacity>

            {categoryDropdownOpen && (
              <View style={styles.categoryDropdownMenu}>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  <TouchableOpacity
                    style={[
                      styles.categoryDropdownItem,
                      selectedCategory === 'all' && styles.categoryDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory('all');
                      setCategoryDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {selectedCategory === 'all' && (
                        <Ionicons name="checkmark" size={14} color={BRAND.burgundy} />
                      )}
                      <Text
                        style={[
                          styles.categoryDropdownItemText,
                          selectedCategory === 'all' && styles.categoryDropdownItemTextActive,
                        ]}
                      >
                        All Categories
                      </Text>
                    </View>
                    <Text style={styles.categoryDropdownItemCount}>({menuItems.length})</Text>
                  </TouchableOpacity>

                  {categories.map((c) => {
                    const count = menuItems.filter((m) => m.category === c).length;
                    const isSelected = selectedCategory === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.categoryDropdownItem,
                          isSelected && styles.categoryDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSelectedCategory(c);
                          setCategoryDropdownOpen(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isSelected && <Ionicons name="checkmark" size={14} color={BRAND.burgundy} />}
                          <Text
                            style={[
                              styles.categoryDropdownItemText,
                              isSelected && styles.categoryDropdownItemTextActive,
                            ]}
                          >
                            {c}
                          </Text>
                        </View>
                        <Text style={styles.categoryDropdownItemCount}>({count})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Dish list */}
          <ScrollView style={styles.dishList} showsVerticalScrollIndicator={false}>
            {filteredMenuItems.map((item) => {
              const itemRecipes = recipes.filter((r) => r.menuItemId === item.id);
              const hasRecipe = itemRecipes.length > 0;
              const isSelected = activeDish?.id === item.id;
              const recipeCount = itemRecipes.length;
              const primaryRecipe = itemRecipes[0];

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.dishItem, isSelected && styles.dishItemActive]}
                  onPress={() => {
                    setSelectedMenuId(item.id);
                    setSelectedVariant(item.variants?.[0]?.name);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dishName, isSelected && styles.dishNameActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.dishMetaRow}>
                      <Text style={styles.dishCat}>{item.category}</Text>
                      <Text style={styles.dishDot}>•</Text>
                      <Text style={styles.dishPrice}>{money(item.price)}</Text>
                      {primaryRecipe?.prepTimeMin ? (
                        <>
                          <Text style={styles.dishDot}>•</Text>
                          <Ionicons name="time-outline" size={11} color={BRAND.muted} />
                          <Text style={styles.dishPrepTime}>{primaryRecipe.prepTimeMin}m</Text>
                        </>
                      ) : null}
                      {item.variants && item.variants.length > 0 && (
                        <Text style={styles.dishVariantPill}>{item.variants.length} sizes</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.dishStatusPill}>
                    {hasRecipe ? (
                      <View style={styles.badgeConfigured}>
                        <Ionicons name="checkmark-circle" size={13} color={BRAND.success} />
                        <Text style={styles.badgeConfiguredText}>
                          {recipeCount > 1 ? `${recipeCount} BOMs` : 'BOM Set'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.badgeMissing}>
                        <Ionicons name="alert-circle" size={13} color={BRAND.warn} />
                        <Text style={styles.badgeMissingText}>No BOM</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Column: Recipe Details & Grams Editor */}
        <View style={styles.rightPane}>
          {activeDish ? (
            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              {/* Dish Header Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={styles.detailDishName}>{activeDish.name}</Text>
                      <Text style={styles.detailCategory}>{activeDish.category}</Text>
                      {currentRecipe?.prepTimeMin ? (
                        <View style={styles.prepBadge}>
                          <Ionicons name="time-outline" size={12} color={BRAND.burgundy} />
                          <Text style={styles.prepBadgeText}>Prep: {currentRecipe.prepTimeMin} min</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.detailSellingPrice}>Menu Price: {money(currentPrice)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {currentRecipe && (
                      <TouchableOpacity
                        style={styles.deleteRecipeBtn}
                        onPress={handleDeleteRecipe}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => handleOpenEditor(currentRecipe)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={currentRecipe ? 'create-outline' : 'add-outline'} size={18} color="#FFFFFF" />
                      <Text style={styles.primaryActionText}>
                        {currentRecipe ? 'Edit Recipe (BOM)' : 'Create Recipe (BOM)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Variant Selector Dropdown if dish has sizes/variants */}
                {activeDish.variants && activeDish.variants.length > 0 && (
                  <View style={{ marginVertical: 10 }}>
                    <RoyalDropdown
                      label="Select Size / Variant:"
                      options={activeDish.variants.map((v) => {
                        const vRecipe = findRecipe(recipes, activeDish.id, v.name);
                        return {
                          label: `${v.name} (${money(v.price)})`,
                          value: v.name,
                          badge: vRecipe ? 'BOM Ready' : 'No BOM',
                          sublabel: vRecipe ? 'Recipe defined' : 'Missing Recipe BOM',
                        };
                      })}
                      value={currentVariantName || activeDish.variants[0]?.name || ''}
                      onSelect={(val) => setSelectedVariant(val)}
                      icon="layers-outline"
                    />
                  </View>
                )}

                {/* Missing variant recipe banner */}
                {!currentRecipe && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning-outline" size={20} color={BRAND.warn} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.warningBannerTitle}>
                        No Recipe BOM defined for {activeDish.name}
                        {currentVariantName ? ` (${currentVariantName})` : ''}
                      </Text>
                      <Text style={styles.warningBannerSub}>
                        Kitchen KOTs cannot auto-deduct store ingredients, and dish food cost cannot be tracked until grams are configured.
                      </Text>
                    </View>
                    {/* If another variant has a recipe, allow 1-tap copy */}
                    {activeDish.variants &&
                      activeDish.variants.some((v) => v.name !== currentVariantName && findRecipe(recipes, activeDish.id, v.name)) && (
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => {
                            const source = activeDish.variants?.find((v) => findRecipe(recipes, activeDish.id, v.name));
                            if (source) {
                              const srcRecipe = findRecipe(recipes, activeDish.id, source.name);
                              if (srcRecipe && currentVariantName) {
                                handleCopyToVariant(currentVariantName);
                              }
                            }
                          }}
                        >
                          <Ionicons name="copy-outline" size={14} color={BRAND.goldDark} />
                          <Text style={styles.copyBtnText}>Copy from other size</Text>
                        </TouchableOpacity>
                      )}
                  </View>
                )}
              </View>

              {/* Recipe Ingredients & Costing if recipe exists */}
              {currentRecipe && currentCost && (
                <>
                  {/* Top KPI Cards: Food Cost, Gross Profit, Food Cost %, Margin % */}
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Total Cost Price</Text>
                      <Text style={styles.kpiValue}>{money(currentCost.totalCost)}</Text>
                      <Text style={styles.kpiSub}>
                        Ingredients: {money(currentCost.ingredientCost)} + Pack: {money(currentCost.packagingCost)}
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Selling Price</Text>
                      <Text style={styles.kpiValue}>{money(currentPrice)}</Text>
                      <Text style={styles.kpiSub}>Menu Listed Price</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Gross Profit / Dish</Text>
                      <Text style={[styles.kpiValue, { color: BRAND.success }]}>
                        {money(currentPrice - currentCost.totalCost)}
                      </Text>
                      <Text style={styles.kpiSub}>Per portion revenue</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Gross Margin %</Text>
                      <Text
                        style={[
                          styles.kpiValue,
                          {
                            color:
                              marginPct(currentPrice, currentCost.totalCost) >= kitchenSettings.targetMarginPct
                                ? BRAND.success
                                : BRAND.warn,
                          },
                        ]}
                      >
                        {marginPct(currentPrice, currentCost.totalCost).toFixed(1)}%
                      </Text>
                      <Text style={styles.kpiSub}>Target: {kitchenSettings.targetMarginPct}%</Text>
                    </View>
                  </View>

                  {/* Ingredients Breakdown Table */}
                  <View style={styles.detailCard}>
                    <View style={styles.sectionTitleRow}>
                      <View>
                        <Text style={styles.sectionTitle}>Bill of Materials (BOM) — Ingredients & Grams</Text>
                        <Text style={styles.sectionSubtitle}>
                          Batch Yield: {currentRecipe.yieldPortions} portion(s) • Wastage & Spices calibrated
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addIngSmallBtn}
                        onPress={() => {
                          handleOpenEditor(currentRecipe);
                        }}
                      >
                        <Ionicons name="pencil" size={14} color={BRAND.burgundy} />
                        <Text style={styles.addIngSmallBtnText}>Modify Ingredients</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Interactive Batch Scaling Selector */}
                    <View style={styles.batchScaleBar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calculator-outline" size={16} color={BRAND.burgundy} />
                        <Text style={styles.batchScaleLabel}>Batch Scaling Calculator:</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { scale: 1, label: '1x Single' },
                          { scale: 5, label: '5x Platter' },
                          { scale: 10, label: '10x Party' },
                          { scale: 25, label: '25x Handi' },
                          { scale: 50, label: '50x Bulk Deg' },
                        ].map((b) => (
                          <TouchableOpacity
                            key={b.scale}
                            style={[styles.batchScaleChip, batchScale === b.scale && styles.batchScaleChipActive]}
                            onPress={() => setBatchScale(b.scale)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.batchScaleChipText, batchScale === b.scale && styles.batchScaleChipTextActive]}>
                              {b.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {batchScale > 1 && (
                        <View style={styles.batchCostHighlight}>
                          <Text style={styles.batchCostHighlightText}>
                            Total {batchScale}x Prep Cost: <Text style={{ fontWeight: '900' }}>{money(currentCost.totalCost * batchScale)}</Text>
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 3 }]}>Ingredient & Role</Text>
                      <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>
                        {batchScale > 1 ? `Scaled Qty (${batchScale}x)` : 'Qty / Dish'}
                      </Text>
                      <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Trim/Waste</Text>
                      <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Store Unit Cost</Text>
                      <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>
                        {batchScale > 1 ? `Batch Cost (${batchScale}x)` : 'Dish Cost'}
                      </Text>
                      <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>% Share</Text>
                    </View>

                    {currentCost.lines.map((line, idx) => {
                      const ing = currentRecipe.ingredients[idx];
                      const roleMeta = INGREDIENT_ROLES.find((r) => r.id === ing?.role);
                      const scaledQty = line.portionQty * batchScale;
                      const scaledCost = line.cost * batchScale;

                      return (
                        <View key={`${line.inventoryItemId}-${idx}`} style={styles.tableRow}>
                          <View style={{ flex: 3 }}>
                            <Text style={styles.tdItemName}>{line.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              {roleMeta && (
                                <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + '15' }]}>
                                  <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                                </View>
                              )}
                              {ing?.tasteAdjustPct !== 0 && (
                                <Text
                                  style={[
                                    styles.tastePill,
                                    { color: (ing?.tasteAdjustPct || 0) > 0 ? BRAND.danger : BRAND.success },
                                  ]}
                                >
                                  {(ing?.tasteAdjustPct || 0) > 0 ? `+${ing.tasteAdjustPct}%` : `${ing.tasteAdjustPct}%`} spice
                                </Text>
                              )}
                            </View>
                          </View>

                          <View style={{ flex: 2, alignItems: 'flex-end' }}>
                            <Text style={[styles.td, { fontWeight: '700' }]}>
                              {scaledQty >= 1000 && (line.unit === 'g' || line.unit === 'ml')
                                ? `${(scaledQty / 1000).toFixed(2)} ${line.unit === 'g' ? 'kg' : 'L'}`
                                : `${scaledQty.toFixed(1)} ${line.unit}`}
                            </Text>
                            {batchScale > 1 && (
                              <Text style={{ fontSize: 9, color: BRAND.muted }}>
                                {line.portionQty.toFixed(1)} {line.unit} / plate
                              </Text>
                            )}
                          </View>

                          <Text style={[styles.td, { flex: 1.5, textAlign: 'right', color: BRAND.muted }]}>
                            {ing?.wastagePct ? `+${ing.wastagePct}%` : '0%'}
                          </Text>

                          <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>
                            {line.unitCost ? `${money(line.unitCost)}/${line.unit === 'g' || line.unit === 'kg' ? 'kg' : line.unit}` : 'Not set'}
                          </Text>

                          <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: '700', color: BRAND.ink }]}>
                            {money(scaledCost)}
                          </Text>

                          <Text style={[styles.td, { flex: 1.5, textAlign: 'right', color: BRAND.burgundy, fontWeight: '600' }]}>
                            {line.pct.toFixed(1)}%
                          </Text>
                        </View>
                      );
                    })}

                    {/* Packaging & Overhead Rows */}
                    <View style={[styles.tableRow, styles.extraCostRow]}>
                      <View style={{ flex: 3 }}>
                        <Text style={styles.tdExtraName}>Packaging & Serving Disposables</Text>
                        <Text style={styles.tdExtraSub}>Boxes, foil wraps, sauce cups, napkins</Text>
                      </View>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>—</Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>—</Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>Fixed</Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: '700' }]}>
                        {money(currentCost.packagingCost)}
                      </Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>
                        {currentCost.totalCost > 0 ? ((currentCost.packagingCost / currentCost.totalCost) * 100).toFixed(1) : 0}%
                      </Text>
                    </View>

                    <View style={[styles.tableRow, styles.extraCostRow]}>
                      <View style={{ flex: 3 }}>
                        <Text style={styles.tdExtraName}>Kitchen Overhead Allocation ({kitchenSettings.overheadPct}%)</Text>
                        <Text style={styles.tdExtraSub}>Fuel gas, tandoor coal, electricity share</Text>
                      </View>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>—</Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>—</Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>{kitchenSettings.overheadPct}%</Text>
                      <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: '700' }]}>
                        {money(currentCost.overheadCost)}
                      </Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>
                        {currentCost.totalCost > 0 ? ((currentCost.overheadCost / currentCost.totalCost) * 100).toFixed(1) : 0}%
                      </Text>
                    </View>

                    {/* Total Summary Row */}
                    <View style={[styles.tableRow, styles.totalCostRow]}>
                      <Text style={[styles.totalLabel, { flex: 3 }]}>Total Recipe Cost (Portion Cost)</Text>
                      <Text style={[styles.td, { flex: 2 }]}>—</Text>
                      <Text style={[styles.td, { flex: 1.5 }]}>—</Text>
                      <Text style={[styles.td, { flex: 2 }]}>—</Text>
                      <Text style={[styles.totalValue, { flex: 2, textAlign: 'right' }]}>{money(currentCost.totalCost)}</Text>
                      <Text style={[styles.totalValue, { flex: 1.5, textAlign: 'right' }]}>100%</Text>
                    </View>
                  </View>

                  {/* Target Margin & Recommended Price Simulator Card */}
                  <View style={styles.detailCard}>
                    <Text style={styles.sectionTitle}>Price Optimizer & Margin Recommendation</Text>
                    <Text style={styles.sectionSubtitle}>
                      Based on current raw materials cost from Store Inventory ({money(currentCost.totalCost)})
                    </Text>

                    <View style={styles.pricingSimRow}>
                      <View style={styles.simInputBox}>
                        <Text style={styles.simLabel}>Target Profit Margin %</Text>
                        <View style={styles.simStepperRow}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => setCalcMarginPct(Math.max(30, calcMarginPct - 5))}
                          >
                            <Ionicons name="remove" size={16} color={BRAND.burgundy} />
                          </TouchableOpacity>
                          <Text style={styles.stepValue}>{calcMarginPct}%</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => setCalcMarginPct(Math.min(90, calcMarginPct + 5))}
                          >
                            <Ionicons name="add" size={16} color={BRAND.burgundy} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.simResultBox}>
                        <Text style={styles.simLabel}>Suggested Selling Price</Text>
                        <Text style={styles.simPrice}>
                          {money(suggestPrice(currentCost.totalCost, calcMarginPct, kitchenSettings.priceRounding))}
                        </Text>
                        <Text style={styles.simProfit}>
                          Profit:{' '}
                          {money(
                            suggestPrice(currentCost.totalCost, calcMarginPct, kitchenSettings.priceRounding) -
                              currentCost.totalCost
                          )}{' '}
                          / dish
                        </Text>
                      </View>

                      <View style={styles.simCurrentBox}>
                        <Text style={styles.simLabel}>Current Menu Price</Text>
                        <Text style={styles.simPrice}>{money(currentPrice)}</Text>
                        <Text
                          style={[
                            styles.simProfit,
                            {
                              color:
                                currentPrice >= suggestPrice(currentCost.totalCost, calcMarginPct, kitchenSettings.priceRounding)
                                  ? BRAND.success
                                  : BRAND.danger,
                            },
                          ]}
                        >
                          {currentPrice >= suggestPrice(currentCost.totalCost, calcMarginPct, kitchenSettings.priceRounding)
                            ? 'Above target margin'
                            : `Underpriced by ${money(
                                suggestPrice(currentCost.totalCost, calcMarginPct, kitchenSettings.priceRounding) - currentPrice
                              )}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={54} color={BRAND.border} />
              <Text style={styles.emptyStateTitle}>Select a dish to view or edit its recipe</Text>
              <Text style={styles.emptyStateSub}>
                Every menu dish can have its exact grams, spices, wastage, and cost mapped.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* MODAL: Full Recipe Editor */}
      <Modal visible={editModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingRecipe ? 'Edit Recipe (BOM)' : 'Create Recipe (BOM)'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {activeDish?.name} {currentVariantName ? `• ${currentVariantName}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                <Ionicons name="close-circle" size={26} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Batch Yield, Packaging & Prep Time inputs */}
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Batch Yield (Portions)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftYield}
                    onChangeText={setDraftYield}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                  <Text style={styles.inputHint}>Plates per batch</Text>
                </View>

                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Packaging (Rs.)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftPackaging}
                    onChangeText={setDraftPackaging}
                    keyboardType="numeric"
                    placeholder="15"
                  />
                  <Text style={styles.inputHint}>Box, sauces per dish</Text>
                </View>

                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Prep Time (Min)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftPrepTime}
                    onChangeText={setDraftPrepTime}
                    keyboardType="numeric"
                    placeholder="15"
                  />
                  <Text style={styles.inputHint}>Kitchen cooking time</Text>
                </View>
              </View>

              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Preparation / Marination Notes</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={draftNotes}
                  onChangeText={setDraftNotes}
                  multiline
                  placeholder="e.g. Marinate chicken 4 hours with papaya paste & ginger garlic before skewering..."
                />
              </View>

              {/* Ingredients List */}
              <View style={styles.ingSectionHeader}>
                <View>
                  <Text style={styles.ingSectionTitle}>Ingredients & Gram Weights ({draftIngredients.length})</Text>
                  <Text style={styles.ingSectionSub}>Store inventory items required per batch</Text>
                </View>
                <TouchableOpacity
                  style={styles.addIngBtn}
                  onPress={() => handleOpenIngModal()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.addIngBtnText}>Add Ingredient</Text>
                </TouchableOpacity>
              </View>

              {draftIngredients.length === 0 ? (
                <View style={styles.noIngBox}>
                  <Ionicons name="nutrition-outline" size={32} color={BRAND.muted} />
                  <Text style={styles.noIngTitle}>No ingredients added yet</Text>
                  <Text style={styles.noIngSub}>Click &ldquo;+ Add Ingredient&rdquo; to specify grams of meat, spices, oil, etc.</Text>
                </View>
              ) : (
                draftIngredients.map((ing, idx) => {
                  const inv = inventory.find((i) => i.id === ing.inventoryItemId);
                  const roleMeta = INGREDIENT_ROLES.find((r) => r.id === ing.role);

                  return (
                    <View key={`${ing.inventoryItemId}-${idx}`} style={styles.ingDraftRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.ingDraftName}>{inv?.name || ing.name}</Text>
                          {roleMeta && (
                            <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + '15' }]}>
                              <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.ingDraftMeta}>
                          {ing.qty} {ing.unit} {ing.wastagePct > 0 ? `• +${ing.wastagePct}% wastage` : ''}{' '}
                          {ing.tasteAdjustPct !== 0 ? `• ${ing.tasteAdjustPct}% spice` : ''}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleOpenIngModal(idx)}
                        >
                          <Ionicons name="pencil" size={16} color={BRAND.burgundy} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleRemoveIngredient(idx)}
                        >
                          <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveRecipe}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save Recipe BOM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUB-MODAL: Add / Edit Ingredient Item */}
      <Modal visible={ingModalOpen} animationType="fade" transparent>
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIngIndex !== null ? 'Edit Ingredient' : 'Add Ingredient to Recipe'}
              </Text>
              <TouchableOpacity onPress={() => setIngModalOpen(false)}>
                <Ionicons name="close" size={22} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Select Inventory Item */}
              <Text style={styles.inputLabel}>Select Store Inventory Item</Text>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder="Filter ingredients..."
                value={invSearch}
                onChangeText={setInvSearch}
              />

              <ScrollView style={{ maxHeight: 140, borderWidth: 1, borderColor: BRAND.border, borderRadius: 8, marginBottom: 12 }}>
                {filteredInventory.map((item) => {
                  const isSel = selectedInvId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.invPickItem, isSel && styles.invPickItemActive]}
                      onPress={() => {
                        setSelectedInvId(item.id);
                        setIngUnit(defaultRecipeUnit(item.unit));
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.invPickName, isSel && styles.invPickNameActive]}>{item.name}</Text>
                        <Text style={styles.invPickSub}>
                          Stock: {formatQty(item.stock, item.unit)} • Cost: {money(item.costPerUnit || 0)}/{item.unit}
                        </Text>
                      </View>
                      {isSel && <Ionicons name="checkmark" size={16} color={BRAND.burgundy} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Quantity and Unit */}
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>Quantity per Batch</Text>
                  <TextInput
                    style={styles.input}
                    value={ingQty}
                    onChangeText={setIngQty}
                    keyboardType="numeric"
                    placeholder="e.g. 250"
                  />
                </View>

                <View style={[styles.formCol, { flex: 1.5 }]}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <View style={styles.unitSelector}>
                    {RECIPE_UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, ingUnit === u && styles.unitChipActive]}
                        onPress={() => setIngUnit(u)}
                      >
                        <Text style={[styles.unitChipText, ingUnit === u && styles.unitChipTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Ingredient Role */}
              <Text style={styles.inputLabel}>Ingredient Role / Purpose</Text>
              <View style={styles.roleChips}>
                {INGREDIENT_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleChip, ingRole === r.id && { backgroundColor: r.color, borderColor: r.color }]}
                    onPress={() => setIngRole(r.id)}
                  >
                    <Text style={[styles.roleChipText, ingRole === r.id && { color: '#FFFFFF' }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Trimming Wastage % and Taste Adjustment % */}
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Trimming / Cooking Wastage %</Text>
                  <TextInput
                    style={styles.input}
                    value={ingWastage}
                    onChangeText={setIngWastage}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.inputHint}>e.g. 15% bone/fat trim</Text>
                </View>

                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Taste / Spiciness Default %</Text>
                  <TextInput
                    style={styles.input}
                    value={ingTaste}
                    onChangeText={setIngTaste}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.inputHint}>+10% for spicier, 0 standard</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIngModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveIngredient}
              >
                <Text style={styles.saveBtnText}>
                  {editingIngIndex !== null ? 'Update Ingredient' : 'Add to Recipe'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    width: 380,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: BRAND.border,
    display: 'flex',
    flexDirection: 'column',
  },
  leftPaneMobile: {
    width: '100%',
  },
  paneHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  seedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: BRAND.goldLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.gold,
  },
  seedBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.goldDark,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EE',
    borderRadius: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: BRAND.ink,
  },
  categoryDropdownWrap: {
    marginHorizontal: 14,
    marginBottom: 8,
    zIndex: 30,
    position: 'relative',
  },
  categoryDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F4EE',
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryDropdownTriggerActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FFFFFF',
  },
  categoryDropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDropdownSelectedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  categoryPillCount: {
    backgroundColor: BRAND.goldLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  categoryPillCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.goldDark,
  },
  categoryDropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingVertical: 4,
    zIndex: 99,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  categoryDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryDropdownItemActive: {
    backgroundColor: '#F6F3EC',
  },
  categoryDropdownItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  categoryDropdownItemTextActive: {
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  categoryDropdownItemCount: {
    fontSize: 11,
    color: BRAND.muted,
  },
  dishList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  dishItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 8,
  },
  dishItemActive: {
    borderColor: BRAND.gold,
    backgroundColor: BRAND.cream,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.burgundy,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
  },
  dishNameActive: {
    color: BRAND.burgundy,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  dishCat: {
    fontSize: 11,
    color: BRAND.muted,
  },
  dishDot: {
    fontSize: 11,
    color: BRAND.muted,
  },
  dishPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.goldDark,
  },
  dishVariantPill: {
    fontSize: 10,
    color: BRAND.info,
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dishStatusPill: {
    marginLeft: 10,
  },
  badgeConfigured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  badgeConfiguredText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.success,
  },
  badgeMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  badgeMissingText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.warn,
  },
  rightPane: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  detailsScroll: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailDishName: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  detailCategory: {
    fontSize: 12,
    color: BRAND.muted,
    backgroundColor: '#F0ECE1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailSellingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.goldDark,
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteRecipeBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  variantBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  variantBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
    marginBottom: 8,
  },
  variantTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0ECE1',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  variantTabActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  variantTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.ink,
  },
  variantTabTextActive: {
    color: '#FFFFFF',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderColor: BRAND.gold,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  warningBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.ink,
  },
  warningBannerSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.gold,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.goldDark,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.burgundy,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  addIngSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
  },
  addIngSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  td: {
    fontSize: 12,
    color: BRAND.ink,
  },
  tdItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tastePill: {
    fontSize: 10,
    fontWeight: '700',
  },
  extraCostRow: {
    backgroundColor: '#FDFBF7',
  },
  tdExtraName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  tdExtraSub: {
    fontSize: 10,
    color: BRAND.muted,
  },
  totalCostRow: {
    backgroundColor: '#F5E6BE33',
    borderTopWidth: 2,
    borderTopColor: BRAND.gold,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  pricingSimRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  simInputBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FAF7F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  simResultBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  simCurrentBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FAF7F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  simLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  simStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  stepValue: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  simPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 6,
  },
  simProfit: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.success,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 360,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalCardMobile: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: '#FAF7F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: BRAND.ink,
  },
  inputHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  ingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  ingSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  ingSectionSub: {
    fontSize: 11,
    color: BRAND.muted,
  },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  addIngBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noIngBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAF7F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderStyle: 'dashed',
  },
  noIngTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: 8,
  },
  noIngSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  ingDraftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FAF7F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 8,
  },
  ingDraftName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  ingDraftMeta: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FAF7F0',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.muted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  subModalCard: {
    width: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  invPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  invPickItemActive: {
    backgroundColor: BRAND.goldLight,
  },
  invPickName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  invPickNameActive: {
    color: BRAND.burgundy,
  },
  invPickSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  unitChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
  },
  unitChipActive: {
    backgroundColor: BRAND.burgundy,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  unitChipTextActive: {
    color: '#FFFFFF',
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  batchScaleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FAF7F0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  batchScaleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  batchScaleChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  batchScaleChipActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  batchScaleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  batchScaleChipTextActive: {
    color: '#FFFFFF',
  },
  batchCostHighlight: {
    backgroundColor: BRAND.goldLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.gold,
    marginLeft: 'auto',
  },
  batchCostHighlightText: {
    fontSize: 11,
    color: BRAND.goldDark,
  },
  dishPrepTime: {
    fontSize: 11,
    color: BRAND.burgundy,
    fontWeight: '600',
  },
  prepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  prepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
});
