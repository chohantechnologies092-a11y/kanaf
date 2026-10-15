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
import { useRouter } from 'expo-router';
import KitchenOpsNav from '../components/KitchenOpsNav';
import { useKitchenStore } from '../store/kitchenStore';
import { useOpsStore } from '../store/opsStore';
import { useRestaurantStore, MenuItem } from '../store/restaurantStore';
import {
  computeRecipeCost,
  findRecipe,
  marginPct,
  money,
  suggestPrice,
} from '../utils/kitchenMath';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
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

import { usePortalBase } from '../hooks/usePortalBase';

export default function CostingScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const router = useRouter();
  const portalBase = usePortalBase();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const { inventory } = useOpsStore();
  const { menuItems, updateMenuItem, categories } = useRestaurantStore();
  const { recipes, kitchenSettings, updateSettings } = useKitchenStore();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [marginFilter, setMarginFilter] = useState<'all' | 'healthy' | 'low' | 'no_recipe'>('all');

  // Settings modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [draftOverhead, setDraftOverhead] = useState(String(kitchenSettings.overheadPct || 12));
  const [draftTargetMargin, setDraftTargetMargin] = useState(String(kitchenSettings.targetMarginPct || 65));
  const [draftRounding, setDraftRounding] = useState(String(kitchenSettings.priceRounding || 10));

  // Quick Price Adjuster Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<{
    menu: MenuItem;
    variantName?: string;
    cost: number;
    currentPrice: number;
    suggestedPrice: number;
  } | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Compute cost & margin for every menu item (including variants)
  const costedItems = useMemo(() => {
    const list: {
      key: string;
      menu: MenuItem;
      variantName?: string;
      name: string;
      category: string;
      salePrice: number;
      ingredientCost: number;
      packagingCost: number;
      overheadCost: number;
      totalCost: number;
      profitRs: number;
      foodCostPct: number;
      marginPercent: number;
      hasRecipe: boolean;
      status: 'healthy' | 'low' | 'no_recipe';
    }[] = [];

    for (const item of menuItems) {
      if (item.isDeal) continue; // combos handled separately

      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          const recipe = findRecipe(recipes, item.id, v.name);
          if (recipe) {
            const rc = computeRecipeCost(recipe, inventory, kitchenSettings);
            const salePrice = v.price;
            const margin = marginPct(salePrice, rc.totalCost);
            const foodCostPct = salePrice > 0 ? (rc.totalCost / salePrice) * 100 : 0;
            list.push({
              key: `${item.id}-${v.name}`,
              menu: item,
              variantName: v.name,
              name: `${item.name} (${v.name})`,
              category: item.category,
              salePrice,
              ingredientCost: rc.ingredientCost,
              packagingCost: rc.packagingCost,
              overheadCost: rc.overheadCost,
              totalCost: rc.totalCost,
              profitRs: salePrice - rc.totalCost,
              foodCostPct,
              marginPercent: margin,
              hasRecipe: true,
              status: margin >= kitchenSettings.targetMarginPct ? 'healthy' : 'low',
            });
          } else {
            list.push({
              key: `${item.id}-${v.name}`,
              menu: item,
              variantName: v.name,
              name: `${item.name} (${v.name})`,
              category: item.category,
              salePrice: v.price,
              ingredientCost: 0,
              packagingCost: 0,
              overheadCost: 0,
              totalCost: 0,
              profitRs: 0,
              foodCostPct: 0,
              marginPercent: 0,
              hasRecipe: false,
              status: 'no_recipe',
            });
          }
        }
      } else {
        const recipe = findRecipe(recipes, item.id);
        if (recipe) {
          const rc = computeRecipeCost(recipe, inventory, kitchenSettings);
          const salePrice = item.price;
          const margin = marginPct(salePrice, rc.totalCost);
          const foodCostPct = salePrice > 0 ? (rc.totalCost / salePrice) * 100 : 0;
          list.push({
            key: item.id,
            menu: item,
            name: item.name,
            category: item.category,
            salePrice,
            ingredientCost: rc.ingredientCost,
            packagingCost: rc.packagingCost,
            overheadCost: rc.overheadCost,
            totalCost: rc.totalCost,
            profitRs: salePrice - rc.totalCost,
            foodCostPct,
            marginPercent: margin,
            hasRecipe: true,
            status: margin >= kitchenSettings.targetMarginPct ? 'healthy' : 'low',
          });
        } else {
          list.push({
            key: item.id,
            menu: item,
            name: item.name,
            category: item.category,
            salePrice: item.price,
            ingredientCost: 0,
            packagingCost: 0,
            overheadCost: 0,
            totalCost: 0,
            profitRs: 0,
            foodCostPct: 0,
            marginPercent: 0,
            hasRecipe: false,
            status: 'no_recipe',
          });
        }
      }
    }

    return list;
  }, [menuItems, recipes, inventory, kitchenSettings]);

  // Filtered list
  const filteredList = useMemo(() => {
    return costedItems.filter((i) => {
      if (selectedCat !== 'all' && i.category !== selectedCat) return false;
      if (marginFilter === 'healthy' && i.status !== 'healthy') return false;
      if (marginFilter === 'low' && i.status !== 'low') return false;
      if (marginFilter === 'no_recipe' && i.status !== 'no_recipe') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [costedItems, selectedCat, marginFilter, search]);

  // High level KPIs
  const withRecipes = useMemo(() => costedItems.filter((i) => i.hasRecipe), [costedItems]);
  const avgMargin = useMemo(() => {
    if (withRecipes.length === 0) return 0;
    return withRecipes.reduce((s, i) => s + i.marginPercent, 0) / withRecipes.length;
  }, [withRecipes]);
  const avgFoodCost = useMemo(() => {
    if (withRecipes.length === 0) return 0;
    return withRecipes.reduce((s, i) => s + i.foodCostPct, 0) / withRecipes.length;
  }, [withRecipes]);

  // Top profit heroes
  const topProfitHeroes = useMemo(() => {
    return [...withRecipes].sort((a, b) => b.profitRs - a.profitRs).slice(0, 3);
  }, [withRecipes]);

  // Low margin alerts
  const lowMarginCount = useMemo(() => {
    return withRecipes.filter((i) => i.status === 'low').length;
  }, [withRecipes]);

  // Handlers
  const handleOpenPriceAdjuster = (item: (typeof costedItems)[0]) => {
    const suggested = suggestPrice(item.totalCost, kitchenSettings.targetMarginPct, kitchenSettings.priceRounding);
    setSelectedDish({
      menu: item.menu,
      variantName: item.variantName,
      cost: item.totalCost,
      currentPrice: item.salePrice,
      suggestedPrice: suggested,
    });
    setCustomPriceInput(String(suggested));
    setAdjustModalOpen(true);
  };

  const handleApplyPriceToMenu = () => {
    if (!selectedDish) return;
    const newPrice = parseFloat(customPriceInput);
    if (!newPrice || newPrice <= 0) {
      Alert.alert('Validation', 'Please enter a valid price.');
      return;
    }

    if (selectedDish.variantName && selectedDish.menu.variants) {
      const updatedVariants = selectedDish.menu.variants.map((v) =>
        v.name === selectedDish.variantName ? { ...v, price: newPrice } : v
      );
      updateMenuItem(selectedDish.menu.id, {
        variants: updatedVariants,
        costPrice: Math.round(selectedDish.cost),
      });
    } else {
      updateMenuItem(selectedDish.menu.id, {
        price: newPrice,
        costPrice: Math.round(selectedDish.cost),
      });
    }

    setAdjustModalOpen(false);
    Alert.alert(
      'Menu Price Updated',
      `Selling price for "${selectedDish.menu.name}${
        selectedDish.variantName ? ` (${selectedDish.variantName})` : ''
      }" has been set to ${money(newPrice)}. Synced live across POS and bills!`
    );
  };

  const handleSaveSettings = () => {
    const oh = parseFloat(draftOverhead);
    const tm = parseFloat(draftTargetMargin);
    const rnd = parseFloat(draftRounding);

    updateSettings({
      overheadPct: Number.isFinite(oh) ? oh : 12,
      targetMarginPct: Number.isFinite(tm) ? tm : 65,
      priceRounding: Number.isFinite(rnd) ? rnd : 10,
    });

    setSettingsModalOpen(false);
    Alert.alert('Updated', 'Kitchen food costing parameters updated.');
  };

  return (
    <View style={styles.container}>
      <KitchenOpsNav backRoute={backRoute} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI DASHBOARD CARDS */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Average Gross Margin</Text>
            <Text style={[styles.kpiValue, { color: avgMargin >= 60 ? BRAND.success : BRAND.warn }]}>
              {avgMargin.toFixed(1)}%
            </Text>
            <Text style={styles.kpiSub}>Target: {kitchenSettings.targetMarginPct}%</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Average Food Cost</Text>
            <Text style={[styles.kpiValue, { color: avgFoodCost <= 35 ? BRAND.success : BRAND.danger }]}>
              {avgFoodCost.toFixed(1)}%
            </Text>
            <Text style={styles.kpiSub}>Raw materials + pack share</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Costed Menu Dishes</Text>
            <Text style={styles.kpiValue}>
              {withRecipes.length} / {costedItems.length}
            </Text>
            <Text style={styles.kpiSub}>
              {costedItems.length - withRecipes.length} dishes missing BOM
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Low Margin Alerts</Text>
            <Text style={[styles.kpiValue, { color: lowMarginCount > 0 ? BRAND.warn : BRAND.success }]}>
              {lowMarginCount} dishes
            </Text>
            <Text style={styles.kpiSub}>Below {kitchenSettings.targetMarginPct}% gross margin</Text>
          </View>

          <TouchableOpacity
            style={styles.settingsTriggerCard}
            onPress={() => setSettingsModalOpen(true)}
          >
            <Ionicons name="settings-outline" size={20} color={BRAND.burgundy} />
            <Text style={styles.settingsTriggerTitle}>Costing Settings</Text>
            <Text style={styles.settingsTriggerSub}>Overhead: {kitchenSettings.overheadPct}%</Text>
          </TouchableOpacity>
        </View>

        {/* HERO ITEMS & UNDERPRICED ALERTS */}
        {topProfitHeroes.length > 0 && (
          <View style={styles.heroRow}>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Ionicons name="trophy" size={16} color={BRAND.goldDark} />
                <Text style={styles.heroTitle}>Top 3 Profit Generator Dishes (Highest Profit / Portion)</Text>
              </View>
              <View style={styles.heroList}>
                {topProfitHeroes.map((h, i) => (
                  <View key={h.key} style={styles.heroItem}>
                    <Text style={styles.heroRank}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroName}>{h.name}</Text>
                      <Text style={styles.heroSub}>
                        Cost: {money(h.totalCost)} → Sale: {money(h.salePrice)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.heroProfit}>+{money(h.profitRs)} / dish</Text>
                      <Text style={styles.heroMargin}>{h.marginPercent.toFixed(1)}% margin</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* MAIN COSTING & PRICING TABLE */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <View>
              <Text style={styles.tableTitle}>Dish Food Cost & Profit Margin Analysis</Text>
              <Text style={styles.tableSub}>
                Exact ingredient weights from BOM × Current Store Inventory rates + {kitchenSettings.overheadPct}% overhead
              </Text>
            </View>

            {/* Filter buttons */}
            <View style={styles.filterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={14} color={BRAND.muted} style={{ marginLeft: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search dish or category..."
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View style={styles.statusFilters}>
                <TouchableOpacity
                  style={[styles.statusFilterBtn, marginFilter === 'all' && styles.statusFilterBtnActive]}
                  onPress={() => setMarginFilter('all')}
                >
                  <Text style={[styles.statusFilterText, marginFilter === 'all' && styles.statusFilterTextActive]}>
                    All ({costedItems.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusFilterBtn, marginFilter === 'healthy' && styles.statusFilterBtnActive]}
                  onPress={() => setMarginFilter('healthy')}
                >
                  <Text style={[styles.statusFilterText, marginFilter === 'healthy' && styles.statusFilterTextActive]}>
                    Healthy ({costedItems.filter((i) => i.status === 'healthy').length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusFilterBtn, marginFilter === 'low' && styles.statusFilterBtnActive]}
                  onPress={() => setMarginFilter('low')}
                >
                  <Text style={[styles.statusFilterText, marginFilter === 'low' && styles.statusFilterTextActive]}>
                    Low Margin ({costedItems.filter((i) => i.status === 'low').length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusFilterBtn, marginFilter === 'no_recipe' && styles.statusFilterBtnActive]}
                  onPress={() => setMarginFilter('no_recipe')}
                >
                  <Text style={[styles.statusFilterText, marginFilter === 'no_recipe' && styles.statusFilterTextActive]}>
                    No BOM ({costedItems.filter((i) => i.status === 'no_recipe').length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catChipsScroll}
            contentContainerStyle={styles.catChips}
          >
            <TouchableOpacity
              style={[styles.catChip, selectedCat === 'all' && styles.catChipActive]}
              onPress={() => setSelectedCat('all')}
            >
              <Text style={[styles.catChipText, selectedCat === 'all' && styles.catChipTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, selectedCat === c && styles.catChipActive]}
                onPress={() => setSelectedCat(c)}
              >
                <Text style={[styles.catChipText, selectedCat === c && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Table */}
          <View style={styles.tableWrap}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { flex: 3 }]}>Menu Dish & Size</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Raw Ing. Cost</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Pack+Ovh</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Total Cost Price</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Menu Sale Price</Text>
              <Text style={[styles.th, { flex: 1.6, textAlign: 'right' }]}>Gross Profit</Text>
              <Text style={[styles.th, { flex: 1.6, textAlign: 'right' }]}>Margin %</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Price Action</Text>
            </View>

            {filteredList.map((item) => {
              const isLow = item.status === 'low';
              const isNoRecipe = item.status === 'no_recipe';

              return (
                <View key={item.key} style={[styles.trRow, isLow && styles.trRowLow]}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.trDishName}>{item.name}</Text>
                    <Text style={styles.trCategory}>{item.category}</Text>
                  </View>

                  <Text style={[styles.tr, { flex: 1.5, textAlign: 'right' }]}>
                    {item.hasRecipe ? money(item.ingredientCost) : '—'}
                  </Text>

                  <Text style={[styles.tr, { flex: 1.2, textAlign: 'right', color: BRAND.muted }]}>
                    {item.hasRecipe ? money(item.packagingCost + item.overheadCost) : '—'}
                  </Text>

                  <Text
                    style={[
                      styles.tr,
                      {
                        flex: 1.8,
                        textAlign: 'right',
                        fontWeight: '800',
                        color: item.hasRecipe ? BRAND.ink : BRAND.muted,
                      },
                    ]}
                  >
                    {item.hasRecipe ? money(item.totalCost) : 'Not Costed'}
                  </Text>

                  <Text style={[styles.tr, { flex: 1.8, textAlign: 'right', fontWeight: '800', color: BRAND.goldDark }]}>
                    {money(item.salePrice)}
                  </Text>

                  <Text
                    style={[
                      styles.tr,
                      {
                        flex: 1.6,
                        textAlign: 'right',
                        fontWeight: '700',
                        color: item.hasRecipe ? (item.profitRs > 0 ? BRAND.success : BRAND.danger) : BRAND.muted,
                      },
                    ]}
                  >
                    {item.hasRecipe ? money(item.profitRs) : '—'}
                  </Text>

                  <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
                    {item.hasRecipe ? (
                      <View
                        style={[
                          styles.marginBadge,
                          item.marginPercent >= kitchenSettings.targetMarginPct
                            ? styles.marginBadgeHealthy
                            : styles.marginBadgeLow,
                        ]}
                      >
                        <Text
                          style={[
                            styles.marginBadgeText,
                            item.marginPercent >= kitchenSettings.targetMarginPct
                              ? { color: BRAND.success }
                              : { color: BRAND.warn },
                          ]}
                        >
                          {item.marginPercent.toFixed(1)}%
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBOMBadge}
                        onPress={() => router.push(`${portalBase}/recipes` as any)}
                      >
                        <Text style={styles.addBOMText}>Set BOM</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flex: 1.5, alignItems: 'center' }}>
                    {item.hasRecipe ? (
                      <TouchableOpacity
                        style={styles.optimizePriceBtn}
                        onPress={() => handleOpenPriceAdjuster(item)}
                      >
                        <Ionicons name="sparkles" size={12} color={BRAND.burgundy} />
                        <Text style={styles.optimizePriceBtnText}>Adjust</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 11, color: BRAND.muted }}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* MODAL 1: PRICE ADJUSTER & 1-TAP APPLY TO MENU */}
      <Modal visible={adjustModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Menu Price Optimizer</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedDish?.menu.name} {selectedDish?.variantName ? `(${selectedDish.variantName})` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAdjustModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.priceCompareRow}>
                <View style={styles.priceCol}>
                  <Text style={styles.priceColLabel}>Total Recipe Cost</Text>
                  <Text style={styles.priceColVal}>{money(selectedDish?.cost || 0)}</Text>
                  <Text style={styles.priceColSub}>BOM raw materials + pack</Text>
                </View>

                <View style={styles.priceCol}>
                  <Text style={styles.priceColLabel}>Current Menu Price</Text>
                  <Text style={styles.priceColVal}>{money(selectedDish?.currentPrice || 0)}</Text>
                  <Text style={styles.priceColSub}>
                    Margin: {marginPct(selectedDish?.currentPrice || 0, selectedDish?.cost || 0).toFixed(1)}%
                  </Text>
                </View>

                <View style={[styles.priceCol, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                  <Text style={styles.priceColLabel}>Recommended ({kitchenSettings.targetMarginPct}% Target)</Text>
                  <Text style={[styles.priceColVal, { color: BRAND.success }]}>
                    {money(selectedDish?.suggestedPrice || 0)}
                  </Text>
                  <Text style={styles.priceColSub}>
                    Profit: {money((selectedDish?.suggestedPrice || 0) - (selectedDish?.cost || 0))}/dish
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>Set New Menu Selling Price (Rs.)</Text>
                <TextInput
                  style={[styles.input, { fontSize: 18, fontWeight: '900', color: BRAND.burgundy }]}
                  value={customPriceInput}
                  onChangeText={setCustomPriceInput}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHint}>
                  Changes will immediately sync across all POS ordering screens and printed guest checks.
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdjustModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleApplyPriceToMenu}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Apply Price to Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: COSTING PARAMETERS SETTINGS */}
      <Modal visible={settingsModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Kitchen Food Costing Settings</Text>
                <Text style={styles.modalSubtitle}>Configure restaurant-wide overhead and target margins</Text>
              </View>
              <TouchableOpacity onPress={() => setSettingsModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Kitchen Overhead Allocation %</Text>
                <TextInput
                  style={styles.input}
                  value={draftOverhead}
                  onChangeText={setDraftOverhead}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHint}>
                  Gas fuel, tandoor coal, electricity share as % of raw ingredient cost (typically 10-15%)
                </Text>
              </View>

              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Default Target Gross Margin %</Text>
                <TextInput
                  style={styles.input}
                  value={draftTargetMargin}
                  onChangeText={setDraftTargetMargin}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHint}>
                  Standard target profit margin for pricing simulator (default 65%)
                </Text>
              </View>

              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Price Rounding Step (Rs.)</Text>
                <TextInput
                  style={styles.input}
                  value={draftRounding}
                  onChangeText={setDraftRounding}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHint}>
                  Round suggested menu prices to nearest step (e.g. 10 or 50 Rs.)
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save Settings</Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  settingsTriggerCard: {
    minWidth: 150,
    backgroundColor: '#FAF7F0',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsTriggerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginTop: 4,
  },
  settingsTriggerSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  heroRow: {
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.gold,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  heroList: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroItem: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BRAND.cream,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  heroRank: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.goldDark,
  },
  heroName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  heroSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  heroProfit: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND.success,
  },
  heroMargin: {
    fontSize: 10,
    color: BRAND.muted,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  tableSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    width: 200,
  },
  searchInput: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: BRAND.ink,
    flex: 1,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 4,
  },
  statusFilterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
  },
  statusFilterBtnActive: {
    backgroundColor: BRAND.burgundy,
  },
  statusFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.ink,
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
  },
  catChipsScroll: {
    flexGrow: 0,
    height: 38,
    maxHeight: 38,
    marginBottom: 8,
  },
  catChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F0ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: BRAND.burgundy,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  trRowLow: {
    backgroundColor: '#FFF8E133',
  },
  tr: {
    fontSize: 12,
    color: BRAND.ink,
  },
  trDishName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  trCategory: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 1,
  },
  marginBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  marginBadgeHealthy: {
    backgroundColor: '#E8F5E9',
  },
  marginBadgeLow: {
    backgroundColor: '#FFF3E0',
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  addBOMBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#F0ECE1',
  },
  addBOMText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
  },
  optimizePriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  optimizePriceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FAF7F0',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalBody: {
    padding: 18,
  },
  priceCompareRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priceCol: {
    flex: 1,
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  priceColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  priceColVal: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 4,
  },
  priceColSub: {
    fontSize: 9,
    color: BRAND.muted,
    marginTop: 4,
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
    paddingVertical: 9,
    fontSize: 13,
    color: BRAND.ink,
  },
  inputHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 3,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FAF7F0',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
