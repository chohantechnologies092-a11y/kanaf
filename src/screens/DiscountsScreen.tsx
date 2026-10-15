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
  Platform,
  Share,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDiscountStore } from '../store/discountStore';
import { useRestaurantStore, MenuItem } from '../store/restaurantStore';
import { 
  EventDiscount, 
  CampaignFormData, 
  DiscountScope, 
  DiscountType, 
  BannerTheme 
} from '../types/discount';
import { 
  checkCampaignValidity, 
  formatTenureDisplay 
} from '../utils/discountCalculator';

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
  surface: '#FDFBF7',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  warn: '#E65100',
  warnLight: '#FFF3E0',
  info: '#0277BD',
  infoLight: '#E1F5FE',
};

const THEME_COLORS: Record<BannerTheme, { primary: string; light: string; text: string; badge: string }> = {
  burgundy: { primary: '#52171B', light: '#FFF0F2', text: '#52171B', badge: '#52171B' },
  gold: { primary: '#B48214', light: '#FFF9E6', text: '#8F660B', badge: '#B48214' },
  emerald: { primary: '#1B5E20', light: '#E8F5E9', text: '#1B5E20', badge: '#1B5E20' },
  amber: { primary: '#D84315', light: '#FBE9E7', text: '#BF360C', badge: '#D84315' },
  sapphire: { primary: '#0D47A1', light: '#E3F2FD', text: '#0D47A1', badge: '#0D47A1' },
  violet: { primary: '#4A148C', light: '#F3E5F5', text: '#4A148C', badge: '#4A148C' },
};

const DAYS_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DiscountsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const {
    campaigns,
    addCampaign,
    updateCampaign,
    toggleCampaignStatus,
    deleteCampaign,
    resetToDefaultCampaigns,
  } = useDiscountStore();

  const { menuItems, categories } = useRestaurantStore();

  // Filter States
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'item' | 'category' | 'order'>('all');

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<EventDiscount | null>(null);

  // Form State
  const initialFormState: CampaignFormData = {
    title: '',
    urduTitle: '',
    code: '',
    description: '',
    type: 'percentage',
    value: 15,
    scope: 'item',
    targetItemIds: [],
    targetCategories: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    allDay: true,
    startTime: '17:00',
    endTime: '23:30',
    minSpend: 0,
    maxDiscountCap: 0,
    budgetLimit: 0,
    maxRedemptions: 0,
    status: 'active',
    bannerTheme: 'burgundy',
  };

  const [formData, setFormData] = useState<CampaignFormData>(initialFormState);
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [itemPickerCat, setItemPickerCat] = useState('All');

  // Overall Financial & Redemption KPI aggregates
  const kpis = useMemo(() => {
    let activeCount = 0;
    let scheduledCount = 0;
    let expiredCount = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalRedemptions = 0;

    campaigns.forEach((camp) => {
      const validity = checkCampaignValidity(camp);
      if (validity.isValid) activeCount++;
      else if (validity.autoStatus === 'scheduled') scheduledCount++;
      else expiredCount++;

      totalGross += camp.totalGrossSales || 0;
      totalDiscount += camp.totalDiscountGiven || 0;
      totalRedemptions += camp.redemptionsCount || 0;
    });

    const netRevenue = Math.max(0, totalGross - totalDiscount);
    const avgTicket = totalRedemptions > 0 ? Math.round(totalGross / totalRedemptions) : 0;
    const discountRate = totalGross > 0 ? ((totalDiscount / totalGross) * 100).toFixed(1) : '0';

    return {
      activeCount,
      scheduledCount,
      expiredCount,
      totalGross,
      totalDiscount,
      netRevenue,
      totalRedemptions,
      avgTicket,
      discountRate,
    };
  }, [campaigns]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((camp) => {
      const validity = checkCampaignValidity(camp);
      const currentEffectiveStatus = validity.isValid ? 'active' : validity.autoStatus;

      // Status Tab filter
      if (statusTab === 'active' && currentEffectiveStatus !== 'active') return false;
      if (statusTab === 'scheduled' && currentEffectiveStatus !== 'scheduled') return false;
      if (statusTab === 'expired' && (currentEffectiveStatus === 'active' || currentEffectiveStatus === 'scheduled')) return false;

      // Scope filter
      if (scopeFilter !== 'all' && camp.scope !== scopeFilter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesTitle = camp.title.toLowerCase().includes(q);
        const matchesUrdu = (camp.urduTitle || '').toLowerCase().includes(q);
        const matchesCode = camp.code.toLowerCase().includes(q);
        const matchesDesc = (camp.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesUrdu && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [campaigns, statusTab, scopeFilter, search]);

  // Handle Edit Action
  const handleOpenEditor = (campaign?: EventDiscount) => {
    if (campaign) {
      setEditingCampaignId(campaign.id);
      setFormData({
        title: campaign.title,
        urduTitle: campaign.urduTitle || '',
        code: campaign.code,
        description: campaign.description || '',
        type: campaign.type,
        value: campaign.value,
        scope: campaign.scope,
        targetItemIds: [...campaign.targetItemIds],
        targetCategories: [...campaign.targetCategories],
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        activeDays: [...campaign.activeDays],
        allDay: campaign.allDay,
        startTime: campaign.startTime || '17:00',
        endTime: campaign.endTime || '23:30',
        minSpend: campaign.minSpend || 0,
        maxDiscountCap: campaign.maxDiscountCap || 0,
        budgetLimit: campaign.budgetLimit || 0,
        maxRedemptions: campaign.maxRedemptions || 0,
        status: campaign.status,
        bannerTheme: campaign.bannerTheme || 'burgundy',
      });
    } else {
      setEditingCampaignId(null);
      setFormData({
        ...initialFormState,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
    }
    setIsEditorOpen(true);
  };

  const handleSaveCampaign = () => {
    if (!formData.title.trim()) {
      const msg = 'Please enter a Campaign Event Title (e.g. Weekend BBQ Rush).';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Missing Field', msg);
      return;
    }

    if (!formData.code.trim()) {
      const msg = 'Please specify a promo code (e.g. BBQ15).';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Missing Field', msg);
      return;
    }

    if (formData.value <= 0) {
      const msg = 'Discount value must be greater than zero.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Value', msg);
      return;
    }

    if (formData.scope === 'item' && formData.targetItemIds.length === 0) {
      const msg = 'Please select at least one menu item for Item-wise discount.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('No Items Selected', msg);
      return;
    }

    if (formData.scope === 'category' && formData.targetCategories.length === 0) {
      const msg = 'Please select at least one category for Category-wise discount.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('No Categories Selected', msg);
      return;
    }

    if (formData.startDate > formData.endDate) {
      const msg = 'End Date cannot be earlier than Start Date.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Dates', msg);
      return;
    }

    if (editingCampaignId) {
      updateCampaign(editingCampaignId, formData);
      const msg = `Campaign "${formData.title}" updated successfully!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Campaign Updated', msg);
    } else {
      addCampaign(formData);
      const msg = `New promotional campaign "${formData.title}" created successfully!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Campaign Created', msg);
    }

    setIsEditorOpen(false);
  };

  const handleDeleteCampaign = (campaign: EventDiscount) => {
    const confirmMsg = `Are you sure you want to delete campaign "${campaign.title}"? Historical sales attribution for this promotion will be removed.`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        deleteCampaign(campaign.id);
      }
    } else {
      Alert.alert('Confirm Delete', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCampaign(campaign.id) },
      ]);
    }
  };

  // Toggle Day selection in Form
  const toggleDay = (dayIndex: number) => {
    setFormData((prev) => {
      const exists = prev.activeDays.includes(dayIndex);
      const newDays = exists ? prev.activeDays.filter((d) => d !== dayIndex) : [...prev.activeDays, dayIndex];
      return { ...prev, activeDays: newDays.sort() };
    });
  };

  // Toggle Item selection in Form
  const toggleItem = (itemId: string) => {
    setFormData((prev) => {
      const exists = prev.targetItemIds.includes(itemId);
      const newItems = exists ? prev.targetItemIds.filter((id) => id !== itemId) : [...prev.targetItemIds, itemId];
      return { ...prev, targetItemIds: newItems };
    });
  };

  // Toggle Category selection in Form
  const toggleCategory = (catName: string) => {
    setFormData((prev) => {
      const exists = prev.targetCategories.includes(catName);
      const newCats = exists ? prev.targetCategories.filter((c) => c !== catName) : [...prev.targetCategories, catName];
      return { ...prev, targetCategories: newCats };
    });
  };

  // Preset Date range helpers
  const applyDatePreset = (daysAhead: number) => {
    const now = new Date();
    const startStr = now.toISOString().split('T')[0];
    const end = new Date(now.getTime() + daysAhead * 86400000);
    const endStr = end.toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, startDate: startStr, endDate: endStr }));
  };

  // Export Performance CSV
  const handleExportCSV = () => {
    if (campaigns.length === 0) {
      const msg = 'No campaigns available to export.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Notice', msg);
      return;
    }

    const headers =
      'Campaign ID,Title,Urdu Title,Code,Status,Scope,Discount Type,Value,Start Date,End Date,Active Days,Min Spend,Redemptions,Gross Sales (PKR),Discount Given (PKR),Net Revenue (PKR)\n';
    const rows = campaigns
      .map((c) => {
        const daysStr = c.activeDays.map((d) => DAYS_NAMES[d]).join('|');
        const valStr = c.type === 'percentage' ? `${c.value}%` : `Rs.${c.value}`;
        return `"${c.id}","${c.title}","${c.urduTitle || ''}","${c.code}","${c.status}","${c.scope}","${c.type}","${valStr}","${c.startDate}","${c.endDate}","${daysStr}","${c.minSpend || 0}","${c.redemptionsCount || 0}","${c.totalGrossSales || 0}","${c.totalDiscountGiven || 0}","${c.netRevenue || 0}"`;
      })
      .join('\n');

    const csvContent = headers + rows;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sultan_events_discounts_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Share.share({
        message: csvContent,
        title: `sultan_events_discounts_${Date.now()}.csv`,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="pricetags" size={16} color={BRAND.burgundy} />
            </View>
            <Text style={styles.headerEyebrow}>MARKETING & PROMOTIONS ENGINE</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.liveIndicatorText}>{kpis.activeCount} ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Events & Promotional Discounts</Text>
          <Text style={styles.headerSubtitle}>
            Item-wise, category-wise and tenure-based promotional campaigns with real-time sales attribution
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportCSV}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color={BRAND.burgundy} />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => handleOpenEditor()}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create New Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* 2. Executive KPI Cards */}
        <View style={styles.kpiGrid}>
          {/* Active Campaigns */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Active Events</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: BRAND.successLight }]}>
                <Ionicons name="flash" size={16} color={BRAND.success} />
              </View>
            </View>
            <Text style={styles.kpiValue}>{kpis.activeCount}</Text>
            <Text style={styles.kpiSub}>
              {kpis.scheduledCount} Scheduled • {kpis.expiredCount} Ended
            </Text>
          </View>

          {/* Gross Sales Influenced */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Promo Gross Sales</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="trending-up" size={16} color="#0369A1" />
              </View>
            </View>
            <Text style={styles.kpiValue}>Rs. {kpis.totalGross.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>Generated via campaign orders</Text>
          </View>

          {/* Discounts Subsidized */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Discounts Subsidized</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: BRAND.dangerLight }]}>
                <Ionicons name="gift" size={16} color={BRAND.danger} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: BRAND.danger }]}>
              - Rs. {kpis.totalDiscount.toLocaleString()}
            </Text>
            <Text style={styles.kpiSub}>{kpis.discountRate}% avg bill subsidy</Text>
          </View>

          {/* Net Campaign Revenue */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Net Promo Revenue</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: BRAND.goldLight }]}>
                <Ionicons name="cash" size={16} color={BRAND.goldDark} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: BRAND.burgundy }]}>
              Rs. {kpis.netRevenue.toLocaleString()}
            </Text>
            <Text style={styles.kpiSub}>Net earnings into register</Text>
          </View>

          {/* Redemptions Count */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Redemptions</Text>
              <View style={[styles.kpiIconBox, { backgroundColor: BRAND.infoLight }]}>
                <Ionicons name="receipt" size={16} color={BRAND.info} />
              </View>
            </View>
            <Text style={styles.kpiValue}>{kpis.totalRedemptions}</Text>
            <Text style={styles.kpiSub}>Avg: Rs. {kpis.avgTicket.toLocaleString()} / bill</Text>
          </View>
        </View>

        {/* 3. Controls & Filter Bar */}
        <View style={styles.filterSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={BRAND.muted} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search event name, Urdu title, or promo code (e.g. BBQ15)..."
              placeholderTextColor={BRAND.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color={BRAND.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status Tabs */}
          <View style={styles.statusTabs}>
            {[
              { key: 'all', label: `All (${campaigns.length})` },
              { key: 'active', label: `Active (${kpis.activeCount})` },
              { key: 'scheduled', label: `Scheduled (${kpis.scheduledCount})` },
              { key: 'expired', label: `Ended (${kpis.expiredCount})` },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.statusTabBtn, statusTab === tab.key && styles.statusTabBtnActive]}
                onPress={() => setStatusTab(tab.key as any)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    statusTab === tab.key && styles.statusTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scope Filters */}
          <View style={styles.scopeFiltersRow}>
            <Text style={styles.scopeFilterLabel}>Target Scope:</Text>
            {[
              { key: 'all', label: 'All Scopes' },
              { key: 'item', label: 'Dish / Item-Wise' },
              { key: 'category', label: 'Category-Wise' },
              { key: 'order', label: 'Store-Wide / Bill' },
            ].map((sc) => (
              <TouchableOpacity
                key={sc.key}
                style={[styles.scopePill, scopeFilter === sc.key && styles.scopePillActive]}
                onPress={() => setScopeFilter(sc.key as any)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.scopePillText,
                    scopeFilter === sc.key && styles.scopePillTextActive,
                  ]}
                >
                  {sc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 4. Campaigns Cards Ledger */}
        {filteredCampaigns.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="pricetag-outline" size={48} color={BRAND.muted} />
            </View>
            <Text style={styles.emptyTitle}>No Campaigns Found</Text>
            <Text style={styles.emptySubtitle}>
              {search.trim()
                ? `No event promotions matched "${search}". Try resetting search filter.`
                : 'No promotional events configured under this view. Click below to launch your first event.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => handleOpenEditor()}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyBtnText}>Create Event Campaign</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.campaignsGrid}>
            {filteredCampaigns.map((camp) => {
              const theme = THEME_COLORS[camp.bannerTheme || 'burgundy'];
              const validity = checkCampaignValidity(camp);
              const isLive = validity.isValid;
              const effectiveStatus = isLive ? 'active' : validity.autoStatus;

              return (
                <View key={camp.id} style={styles.campaignCard}>
                  {/* Card Banner Header */}
                  <View style={[styles.cardHeader, { backgroundColor: theme.primary }]}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.cardHeaderBadgeRow}>
                        <View style={styles.codeTag}>
                          <Ionicons name="ticket" size={12} color="#FFFFFF" />
                          <Text style={styles.codeTagText}>{camp.code}</Text>
                        </View>
                        <View style={styles.scopeTag}>
                          <Text style={styles.scopeTagText}>
                            {camp.scope === 'item'
                              ? 'Dish-Wise'
                              : camp.scope === 'category'
                              ? 'Category-Wise'
                              : 'Store-Wide Bill'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle}>{camp.title}</Text>
                      {camp.urduTitle ? (
                        <Text style={styles.cardUrduTitle}>{camp.urduTitle}</Text>
                      ) : null}
                    </View>

                    <View style={styles.cardHeaderRight}>
                      {effectiveStatus === 'active' && (
                        <View style={styles.statusLivePill}>
                          <View style={styles.statusLiveDot} />
                          <Text style={styles.statusLiveText}>LIVE NOW</Text>
                        </View>
                      )}
                      {effectiveStatus === 'scheduled' && (
                        <View style={styles.statusScheduledPill}>
                          <Ionicons name="calendar" size={12} color="#854D0E" />
                          <Text style={styles.statusScheduledText}>SCHEDULED</Text>
                        </View>
                      )}
                      {effectiveStatus === 'expired' && (
                        <View style={styles.statusExpiredPill}>
                          <Text style={styles.statusExpiredText}>ENDED</Text>
                        </View>
                      )}
                      {effectiveStatus === 'paused' && (
                        <View style={styles.statusPausedPill}>
                          <Text style={styles.statusPausedText}>PAUSED</Text>
                        </View>
                      )}

                      <View style={styles.cardDiscountBadge}>
                        <Text style={styles.cardDiscountVal}>
                          {camp.type === 'percentage' ? `${camp.value}%` : `Rs. ${camp.value}`}
                        </Text>
                        <Text style={styles.cardDiscountUnit}>OFF</Text>
                      </View>
                    </View>
                  </View>

                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    {/* Description */}
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {camp.description || 'Promotional deal for Sultan Restaurant guests.'}
                    </Text>

                    {/* Target Scope Tags */}
                    <View style={styles.targetSection}>
                      <Text style={styles.targetSectionTitle}>
                        {camp.scope === 'item'
                          ? `Target Dishes (${camp.targetItemIds.length}):`
                          : camp.scope === 'category'
                          ? `Target Categories (${camp.targetCategories.length}):`
                          : 'Order Scope:'}
                      </Text>

                      <View style={styles.targetTagsRow}>
                        {camp.scope === 'item' &&
                          camp.targetItemIds.map((itemId) => {
                            const dish = menuItems.find((m) => m.id === itemId);
                            return (
                              <View key={itemId} style={styles.dishTag}>
                                <Ionicons name="restaurant" size={12} color={BRAND.burgundy} />
                                <Text style={styles.dishTagText}>
                                  {dish ? dish.name : itemId}
                                </Text>
                              </View>
                            );
                          })}

                        {camp.scope === 'category' &&
                          camp.targetCategories.map((cat) => (
                            <View key={cat} style={styles.categoryTag}>
                              <Ionicons name="layers" size={12} color={BRAND.goldDark} />
                              <Text style={styles.categoryTagText}>{cat}</Text>
                            </View>
                          ))}

                        {camp.scope === 'order' && (
                          <View style={styles.orderTag}>
                            <Ionicons name="cart" size={12} color="#0D47A1" />
                            <Text style={styles.orderTagText}>
                              All menu items • Min. Spend Rs. {(camp.minSpend || 0).toLocaleString()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Timing & Tenure Box */}
                    <View style={styles.timingBox}>
                      <View style={styles.timingRow}>
                        <Ionicons name="calendar-outline" size={15} color={BRAND.burgundy} />
                        <Text style={styles.timingLabel}>Tenure Period:</Text>
                        <Text style={styles.timingValue}>
                          {formatTenureDisplay(camp.startDate, camp.endDate)}
                        </Text>
                      </View>

                      <View style={styles.timingRow}>
                        <Ionicons name="time-outline" size={15} color={BRAND.burgundy} />
                        <Text style={styles.timingLabel}>Active Hours:</Text>
                        <Text style={styles.timingValue}>
                          {camp.allDay
                            ? 'All Day (24 Hours)'
                            : `${camp.startTime || '17:00'} - ${camp.endTime || '23:30'}`}
                        </Text>
                      </View>

                      <View style={styles.timingRow}>
                        <Ionicons name="repeat-outline" size={15} color={BRAND.burgundy} />
                        <Text style={styles.timingLabel}>Active Days:</Text>
                        <Text style={styles.timingValue}>
                          {camp.activeDays.length === 7
                            ? 'Every Day'
                            : camp.activeDays.map((d) => DAYS_NAMES[d]).join(', ')}
                        </Text>
                      </View>

                      {camp.maxDiscountCap ? (
                        <View style={styles.timingRow}>
                          <Ionicons name="shield-checkmark-outline" size={15} color={BRAND.burgundy} />
                          <Text style={styles.timingLabel}>Max Discount Cap:</Text>
                          <Text style={styles.timingValue}>
                            Rs. {camp.maxDiscountCap.toLocaleString()}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Performance & Sales Summary Strip */}
                    <View style={styles.salesStrip}>
                      <View style={styles.salesMetric}>
                        <Text style={styles.salesMetricLabel}>Redemptions</Text>
                        <Text style={styles.salesMetricVal}>{camp.redemptionsCount || 0}</Text>
                      </View>
                      <View style={styles.salesMetricDivider} />

                      <View style={styles.salesMetric}>
                        <Text style={styles.salesMetricLabel}>Gross Sales</Text>
                        <Text style={styles.salesMetricVal}>
                          Rs. {(camp.totalGrossSales || 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.salesMetricDivider} />

                      <View style={styles.salesMetric}>
                        <Text style={styles.salesMetricLabel}>Discount Given</Text>
                        <Text style={[styles.salesMetricVal, { color: BRAND.danger }]}>
                          - Rs. {(camp.totalDiscountGiven || 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.salesMetricDivider} />

                      <View style={styles.salesMetric}>
                        <Text style={styles.salesMetricLabel}>Net Revenue</Text>
                        <Text style={[styles.salesMetricVal, { color: BRAND.success }]}>
                          Rs. {(camp.netRevenue || 0).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Card Actions Footer */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.drilldownBtn}
                        onPress={() => setAnalyticsCampaign(camp)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="bar-chart" size={15} color={BRAND.burgundy} />
                        <Text style={styles.drilldownBtnText}>Sales Data & Drilldown</Text>
                      </TouchableOpacity>

                      <View style={styles.cardButtonsRight}>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleOpenEditor(camp)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="pencil" size={16} color={BRAND.ink} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => toggleCampaignStatus(camp.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={camp.status === 'paused' ? 'play' : 'pause'}
                            size={16}
                            color={camp.status === 'paused' ? BRAND.success : BRAND.warn}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.iconActionBtn, { borderColor: '#FCA5A5' }]}
                          onPress={() => handleDeleteCampaign(camp)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* 5. Campaign Editor Modal (Create / Edit) */}
      <Modal visible={isEditorOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, isMobile && { width: '95%', maxHeight: '92%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>
                  {editingCampaignId ? 'Edit Event Campaign' : 'Create Promotional Event'}
                </Text>
                <Text style={styles.modalHeaderSub}>
                  Configure item/category discount rules, date tenure, and budget limits
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditorOpen(false)}
              >
                <Ionicons name="close" size={22} color={BRAND.ink} />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Form */}
            <ScrollView style={styles.modalFormScroll} showsVerticalScrollIndicator={false}>
              {/* Section 1: Campaign Identity */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeading}>1. Event Identity & Banner</Text>

                <View style={styles.formRow}>
                  <View style={{ flex: 2, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>Event Campaign Title *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Weekend BBQ & Karahi Fiesta"
                      value={formData.title}
                      onChangeText={(t) => setFormData({ ...formData, title: t })}
                    />
                  </View>

                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.inputLabel}>Urdu Subtitle</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. ویک اینڈ باربی کیو فیسٹیول"
                      value={formData.urduTitle}
                      onChangeText={(t) => setFormData({ ...formData, urduTitle: t })}
                    />
                  </View>
                </View>

                <View style={[styles.formRow, { marginTop: 12 }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.inputLabel}>Promo / Voucher Code *</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const autoCode = `${formData.title.substring(0, 3).toUpperCase() || 'SUL'}${formData.value || 15}`;
                          setFormData({ ...formData, code: autoCode });
                        }}
                      >
                        <Text style={{ fontSize: 11, color: BRAND.burgundy, fontWeight: '700' }}>
                          Auto-Generate
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.textInput, { fontWeight: '700', letterSpacing: 1 }]}
                      placeholder="e.g. BBQ15"
                      value={formData.code}
                      onChangeText={(t) => setFormData({ ...formData, code: t.toUpperCase() })}
                    />
                  </View>

                  <View style={{ flex: 2 }}>
                    <Text style={styles.inputLabel}>Campaign Banner Theme</Text>
                    <View style={styles.themePickerRow}>
                      {(['burgundy', 'gold', 'emerald', 'amber', 'sapphire', 'violet'] as BannerTheme[]).map(
                        (th) => (
                          <TouchableOpacity
                            key={th}
                            style={[
                              styles.themeCircle,
                              { backgroundColor: THEME_COLORS[th].primary },
                              formData.bannerTheme === th && styles.themeCircleActive,
                            ]}
                            onPress={() => setFormData({ ...formData, bannerTheme: th })}
                          />
                        )
                      )}
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Campaign Description & Tagline</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60 }]}
                    multiline
                    placeholder="Short description of the offer for waitstaff, billing receipts, and online menu..."
                    value={formData.description}
                    onChangeText={(t) => setFormData({ ...formData, description: t })}
                  />
                </View>
              </View>

              {/* Section 2: Discount Structure */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeading}>2. Discount Value & Caps</Text>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>Discount Type</Text>
                    <View style={styles.typeSelectorRow}>
                      <TouchableOpacity
                        style={[
                          styles.typeSelectorBtn,
                          formData.type === 'percentage' && styles.typeSelectorBtnActive,
                        ]}
                        onPress={() => setFormData({ ...formData, type: 'percentage' })}
                      >
                        <Text
                          style={[
                            styles.typeSelectorBtnText,
                            formData.type === 'percentage' && styles.typeSelectorBtnTextActive,
                          ]}
                        >
                          % Percentage
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeSelectorBtn,
                          formData.type === 'fixed' && styles.typeSelectorBtnActive,
                        ]}
                        onPress={() => setFormData({ ...formData, type: 'fixed' })}
                      >
                        <Text
                          style={[
                            styles.typeSelectorBtnText,
                            formData.type === 'fixed' && styles.typeSelectorBtnTextActive,
                          ]}
                        >
                          Flat PKR (Rs.)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>
                      {formData.type === 'percentage' ? 'Percentage Off (%)' : 'Flat Cash Off (Rs.)'} *
                    </Text>
                    <TextInput
                      style={[styles.textInput, { fontWeight: '800', fontSize: 16 }]}
                      keyboardType="numeric"
                      value={formData.value ? formData.value.toString() : ''}
                      onChangeText={(t) =>
                        setFormData({ ...formData, value: parseFloat(t) || 0 })
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Max Discount Cap (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="0 for No Limit"
                      value={formData.maxDiscountCap ? formData.maxDiscountCap.toString() : ''}
                      onChangeText={(t) =>
                        setFormData({ ...formData, maxDiscountCap: parseFloat(t) || 0 })
                      }
                    />
                  </View>
                </View>

                <View style={[styles.formRow, { marginTop: 12 }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>Minimum Bill Spend (PKR)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 2000 (0 for none)"
                      value={formData.minSpend ? formData.minSpend.toString() : ''}
                      onChangeText={(t) =>
                        setFormData({ ...formData, minSpend: parseFloat(t) || 0 })
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Campaign Budget Limit (PKR)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 50000 (optional)"
                      value={formData.budgetLimit ? formData.budgetLimit.toString() : ''}
                      onChangeText={(t) =>
                        setFormData({ ...formData, budgetLimit: parseFloat(t) || 0 })
                      }
                    />
                  </View>
                </View>
              </View>

              {/* Section 3: Target Scope Selection */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeading}>3. Target Scope (Item / Category / Bill)</Text>
                <Text style={styles.sectionSub}>
                  Choose which dishes or groups qualify for this event discount
                </Text>

                <View style={styles.scopeTabsRow}>
                  {[
                    {
                      id: 'item',
                      title: 'Dish / Item-Wise',
                      icon: 'restaurant',
                      desc: 'Specific menu dishes',
                    },
                    {
                      id: 'category',
                      title: 'Category-Wise',
                      icon: 'layers',
                      desc: 'All items in chosen category',
                    },
                    {
                      id: 'order',
                      title: 'Entire Bill / Store',
                      icon: 'cart',
                      desc: 'Applies to total order',
                    },
                  ].map((sc) => (
                    <TouchableOpacity
                      key={sc.id}
                      style={[
                        styles.scopeCardBtn,
                        formData.scope === sc.id && styles.scopeCardBtnActive,
                      ]}
                      onPress={() => setFormData({ ...formData, scope: sc.id as DiscountScope })}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={sc.icon as any}
                        size={20}
                        color={formData.scope === sc.id ? BRAND.burgundy : BRAND.muted}
                      />
                      <Text
                        style={[
                          styles.scopeCardBtnTitle,
                          formData.scope === sc.id && styles.scopeCardBtnTitleActive,
                        ]}
                      >
                        {sc.title}
                      </Text>
                      <Text style={styles.scopeCardBtnDesc}>{sc.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Scope Picker: Item-Wise */}
                {formData.scope === 'item' && (
                  <View style={styles.scopePickerContainer}>
                    <View style={styles.pickerHeaderRow}>
                      <Text style={styles.pickerSectionTitle}>
                        Select Menu Dishes ({formData.targetItemIds.length} Selected)
                      </Text>
                      <View style={styles.pickerSearchRow}>
                        <TextInput
                          style={styles.pickerSearchInput}
                          placeholder="Search dish name..."
                          value={itemPickerSearch}
                          onChangeText={setItemPickerSearch}
                        />
                      </View>
                    </View>

                    {/* Category Filter Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                      {['All', ...categories].map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.catFilterPill,
                            itemPickerCat === c && styles.catFilterPillActive,
                          ]}
                          onPress={() => setItemPickerCat(c)}
                        >
                          <Text
                            style={[
                              styles.catFilterPillText,
                              itemPickerCat === c && styles.catFilterPillTextActive,
                            ]}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Dishes Grid */}
                    <View style={styles.dishesGrid}>
                      {menuItems
                        .filter((m) => {
                          if (itemPickerCat !== 'All' && m.category !== itemPickerCat) return false;
                          if (
                            itemPickerSearch &&
                            !m.name.toLowerCase().includes(itemPickerSearch.toLowerCase())
                          )
                            return false;
                          return true;
                        })
                        .map((dish) => {
                          const isSelected = formData.targetItemIds.includes(dish.id);
                          const discountedPrice =
                            formData.type === 'percentage'
                              ? Math.round(dish.price * (1 - formData.value / 100))
                              : Math.max(0, dish.price - formData.value);

                          return (
                            <TouchableOpacity
                              key={dish.id}
                              style={[
                                styles.dishSelectCard,
                                isSelected && styles.dishSelectCardActive,
                              ]}
                              onPress={() => toggleItem(dish.id)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.dishSelectHeader}>
                                <Text style={styles.dishSelectName} numberOfLines={1}>
                                  {dish.name}
                                </Text>
                                <Ionicons
                                  name={isSelected ? 'checkbox' : 'square-outline'}
                                  size={18}
                                  color={isSelected ? BRAND.burgundy : BRAND.muted}
                                />
                              </View>
                              <View style={styles.dishPriceRow}>
                                <Text style={styles.dishOrigPrice}>Rs. {dish.price}</Text>
                                {isSelected && (
                                  <Text style={styles.dishDiscPrice}>
                                    → Rs. {discountedPrice}
                                  </Text>
                                )}
                              </View>
                              <Text style={styles.dishCatBadge}>{dish.category}</Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                )}

                {/* Scope Picker: Category-Wise */}
                {formData.scope === 'category' && (
                  <View style={styles.scopePickerContainer}>
                    <Text style={styles.pickerSectionTitle}>
                      Select Target Categories ({formData.targetCategories.length} Selected)
                    </Text>
                    <Text style={styles.pickerSectionSub}>
                      All dishes under these categories will automatically enjoy the discount
                    </Text>

                    <View style={styles.catGrid}>
                      {categories.map((cat) => {
                        const isSelected = formData.targetCategories.includes(cat);
                        const itemsInCat = menuItems.filter((m) => m.category === cat).length;
                        return (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.catSelectCard,
                              isSelected && styles.catSelectCardActive,
                            ]}
                            onPress={() => toggleCategory(cat)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.catSelectHeader}>
                              <Text style={styles.catSelectTitle}>{cat}</Text>
                              <Ionicons
                                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={isSelected ? BRAND.burgundy : BRAND.muted}
                              />
                            </View>
                            <Text style={styles.catSelectCount}>{itemsInCat} dishes in category</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Scope Picker: Entire Bill */}
                {formData.scope === 'order' && (
                  <View style={styles.scopeOrderContainer}>
                    <View style={styles.scopeOrderIcon}>
                      <Ionicons name="sparkles" size={24} color={BRAND.burgundy} />
                    </View>
                    <Text style={styles.scopeOrderTitle}>Store-Wide Discount Active</Text>
                    <Text style={styles.scopeOrderSub}>
                      Applies across the entire bill when the customer's order subtotal meets the
                      minimum spend requirement of Rs. {(formData.minSpend || 0).toLocaleString()}.
                    </Text>
                  </View>
                )}
              </View>

              {/* Section 4: Tenure & Timing Selection */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeading}>4. Tenure & Timing Selection</Text>
                <Text style={styles.sectionSub}>
                  Specify exactly from which date to which date this event discount will be active
                </Text>

                {/* Quick Presets */}
                <View style={styles.presetButtonsRow}>
                  <Text style={styles.presetLabel}>Quick Presets:</Text>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyDatePreset(3)}
                  >
                    <Text style={styles.presetBtnText}>Weekend (3 Days)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyDatePreset(7)}
                  >
                    <Text style={styles.presetBtnText}>1 Week (7 Days)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyDatePreset(30)}
                  >
                    <Text style={styles.presetBtnText}>1 Month (30 Days)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyDatePreset(10)}
                  >
                    <Text style={styles.presetBtnText}>Festival Deal (10 Days)</Text>
                  </TouchableOpacity>
                </View>

                {/* Start & End Date Inputs */}
                <View style={[styles.formRow, { marginTop: 12 }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="2026-10-15"
                      value={formData.startDate}
                      onChangeText={(t) => setFormData({ ...formData, startDate: t })}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>End Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="2026-10-25"
                      value={formData.endDate}
                      onChangeText={(t) => setFormData({ ...formData, endDate: t })}
                    />
                  </View>
                </View>

                {/* Days of Week Selection */}
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.inputLabel}>Active Days of the Week</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, activeDays: [0, 1, 2, 3, 4, 5, 6] })}
                      >
                        <Text style={styles.quickDayText}>All Days</Text>
                      </TouchableOpacity>
                      <Text style={{ color: BRAND.muted }}>•</Text>
                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, activeDays: [5, 6, 0] })}
                      >
                        <Text style={styles.quickDayText}>Weekends Only (Fri-Sun)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.daysPickerRow}>
                    {DAYS_NAMES.map((dName, idx) => {
                      const isSelected = formData.activeDays.includes(idx);
                      return (
                        <TouchableOpacity
                          key={dName}
                          style={[
                            styles.dayCircle,
                            isSelected && styles.dayCircleActive,
                          ]}
                          onPress={() => toggleDay(idx)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCircleText,
                              isSelected && styles.dayCircleTextActive,
                            ]}
                          >
                            {dName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* All-Day vs Time Slots */}
                <View style={[styles.formRow, { marginTop: 16, alignItems: 'center' }]}>
                  <TouchableOpacity
                    style={styles.allDayCheckbox}
                    onPress={() => setFormData({ ...formData, allDay: !formData.allDay })}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={formData.allDay ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={BRAND.burgundy}
                    />
                    <Text style={styles.allDayText}>Active All Day (24/7 during tenure)</Text>
                  </TouchableOpacity>

                  {!formData.allDay && (
                    <View style={{ flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                      <View style={{ width: 100 }}>
                        <Text style={styles.inputLabel}>Start Time</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="17:00"
                          value={formData.startTime}
                          onChangeText={(t) => setFormData({ ...formData, startTime: t })}
                        />
                      </View>
                      <View style={{ width: 100 }}>
                        <Text style={styles.inputLabel}>End Time</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="23:30"
                          value={formData.endTime}
                          onChangeText={(t) => setFormData({ ...formData, endTime: t })}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditorOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveCampaign}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>
                  {editingCampaignId ? 'Save Changes' : 'Publish & Activate Campaign'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Campaign Analytics & Sales Drilldown Modal */}
      <Modal visible={!!analyticsCampaign} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 780, maxHeight: '90%' }]}>
            {analyticsCampaign && (
              <>
                {/* Analytics Modal Header */}
                <View style={styles.analyticsHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.analyticsTitle}>{analyticsCampaign.title}</Text>
                      <View style={styles.analyticsCodeBadge}>
                        <Text style={styles.analyticsCodeBadgeText}>
                          {analyticsCampaign.code}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.analyticsSub}>
                      Tenure: {formatTenureDisplay(analyticsCampaign.startDate, analyticsCampaign.endDate)} •{' '}
                      {analyticsCampaign.scope === 'item'
                        ? 'Item-Wise Promo'
                        : analyticsCampaign.scope === 'category'
                        ? 'Category-Wise Promo'
                        : 'Store-Wide Promo'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setAnalyticsCampaign(null)}
                  >
                    <Ionicons name="close" size={22} color={BRAND.ink} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.analyticsScroll} showsVerticalScrollIndicator={false}>
                  {/* Big Performance Strip */}
                  <View style={styles.analyticsKpiStrip}>
                    <View style={styles.analyticsKpiBox}>
                      <Text style={styles.analyticsKpiLabel}>Redemptions</Text>
                      <Text style={styles.analyticsKpiValue}>
                        {analyticsCampaign.redemptionsCount || 0}
                      </Text>
                      <Text style={styles.analyticsKpiHint}>Orders applied</Text>
                    </View>

                    <View style={styles.analyticsKpiBox}>
                      <Text style={styles.analyticsKpiLabel}>Gross Sales</Text>
                      <Text style={styles.analyticsKpiValue}>
                        Rs. {(analyticsCampaign.totalGrossSales || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.analyticsKpiHint}>Order volume</Text>
                    </View>

                    <View style={styles.analyticsKpiBox}>
                      <Text style={styles.analyticsKpiLabel}>Discount Subsidized</Text>
                      <Text style={[styles.analyticsKpiValue, { color: BRAND.danger }]}>
                        Rs. {(analyticsCampaign.totalDiscountGiven || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.analyticsKpiHint}>Restaurant subsidy</Text>
                    </View>

                    <View style={styles.analyticsKpiBox}>
                      <Text style={styles.analyticsKpiLabel}>Net Revenue</Text>
                      <Text style={[styles.analyticsKpiValue, { color: BRAND.success }]}>
                        Rs. {(analyticsCampaign.netRevenue || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.analyticsKpiHint}>Net cash flow</Text>
                    </View>
                  </View>

                  {/* Top Dishes Sold Under This Promo */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionHeading}>
                      Dishes Sold Under This Event ({analyticsCampaign.topDishes?.length || 0})
                    </Text>

                    {analyticsCampaign.topDishes && analyticsCampaign.topDishes.length > 0 ? (
                      <View style={styles.tableContainer}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Dish Name</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Category</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                            Qty Sold
                          </Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>
                            Gross Sales
                          </Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>
                            Discount Subsidized
                          </Text>
                        </View>

                        {analyticsCampaign.topDishes.map((td) => (
                          <View key={td.itemId} style={styles.tableBodyRow}>
                            <Text style={[styles.tableBodyCell, { flex: 2, fontWeight: '700' }]}>
                              {td.itemName}
                            </Text>
                            <Text style={[styles.tableBodyCell, { flex: 1, color: BRAND.muted }]}>
                              {td.category}
                            </Text>
                            <Text
                              style={[
                                styles.tableBodyCell,
                                { flex: 1, textAlign: 'center', fontWeight: '700' },
                              ]}
                            >
                              {td.qtySold} portions
                            </Text>
                            <Text
                              style={[
                                styles.tableBodyCell,
                                { flex: 1.5, textAlign: 'right', fontWeight: '700' },
                              ]}
                            >
                              Rs. {td.grossSales.toLocaleString()}
                            </Text>
                            <Text
                              style={[
                                styles.tableBodyCell,
                                { flex: 1.5, textAlign: 'right', color: BRAND.danger },
                              ]}
                            >
                              - Rs. {td.discountAmount.toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noDataHint}>
                        No specific dish breakdown recorded for this event yet.
                      </Text>
                    )}
                  </View>

                  {/* Recent Order Redemptions */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionHeading}>
                      Recent Invoice Redemptions ({analyticsCampaign.recentRedemptions?.length || 0})
                    </Text>

                    {analyticsCampaign.recentRedemptions &&
                    analyticsCampaign.recentRedemptions.length > 0 ? (
                      <View style={styles.redemptionsList}>
                        {analyticsCampaign.recentRedemptions.map((red) => (
                          <View key={red.id} style={styles.redemptionCard}>
                            <View style={styles.redemptionHeader}>
                              <View>
                                <Text style={styles.redemptionInvoice}>{red.invoiceId}</Text>
                                <Text style={styles.redemptionCustomer}>
                                  {red.customerName || 'Walk-in Guest'}{' '}
                                  {red.tableName ? `• ${red.tableName}` : `• ${red.orderType}`}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.redemptionGross}>
                                  Gross: Rs. {red.grossSales.toLocaleString()}
                                </Text>
                                <Text style={styles.redemptionDiscount}>
                                  Disc: - Rs. {red.discountApplied.toLocaleString()}
                                </Text>
                                <Text style={styles.redemptionNet}>
                                  Paid: Rs. {red.netPaid.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                            {red.itemsSummary ? (
                              <Text style={styles.redemptionItems}>
                                Items: {red.itemsSummary}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noDataHint}>
                        No individual order redemptions logged yet. Use this code in POS to start
                        tracking.
                      </Text>
                    )}
                  </View>

                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 280,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.burgundy,
    letterSpacing: 0.8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.ink,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#FFFFFF',
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
    shadowColor: BRAND.burgundy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
    padding: 20,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.ink,
    letterSpacing: -0.3,
  },
  kpiSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 4,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: BRAND.ink,
  },
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  statusTabBtnActive: {
    backgroundColor: BRAND.burgundy,
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  scopeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scopeFilterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
    marginRight: 4,
  },
  scopePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  scopePillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: BRAND.goldDark,
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.muted,
  },
  scopePillTextActive: {
    color: BRAND.goldDark,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: 6,
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  campaignsGrid: {
    gap: 16,
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  codeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scopeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scopeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cardUrduTitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusLiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
  },
  statusScheduledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusScheduledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854D0E',
  },
  statusExpiredPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusExpiredText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusPausedPill: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPausedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  cardDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cardDiscountVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cardDiscountUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  cardDesc: {
    fontSize: 13,
    color: BRAND.ink,
    lineHeight: 18,
  },
  targetSection: {
    gap: 6,
  },
  targetSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.muted,
  },
  targetTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dishTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dishTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.goldDark,
  },
  orderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  timingBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  timingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  salesStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
  },
  salesMetric: {
    alignItems: 'center',
    flex: 1,
  },
  salesMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    marginBottom: 2,
  },
  salesMetricVal: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND.ink,
  },
  salesMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  drilldownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  drilldownBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  cardButtonsRight: {
    flexDirection: 'row',
    gap: 6,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 760,
    maxHeight: '94%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
  },
  modalHeaderSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalFormScroll: {
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.burgundy,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: BRAND.ink,
  },
  themePickerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    height: 40,
  },
  themeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  themeCircleActive: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  typeSelectorBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeSelectorBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  typeSelectorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  typeSelectorBtnTextActive: {
    color: BRAND.burgundy,
  },
  scopeTabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  scopeCardBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  scopeCardBtnActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  scopeCardBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
  },
  scopeCardBtnTitleActive: {
    color: BRAND.burgundy,
  },
  scopeCardBtnDesc: {
    fontSize: 10,
    color: BRAND.muted,
    textAlign: 'center',
  },
  scopePickerContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.ink,
  },
  pickerSectionSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginBottom: 10,
  },
  pickerSearchRow: {
    width: 200,
  },
  pickerSearchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
  },
  catFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    marginRight: 6,
  },
  catFilterPillActive: {
    backgroundColor: BRAND.burgundy,
  },
  catFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  catFilterPillTextActive: {
    color: '#FFFFFF',
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxHeight: 220,
    overflow: 'scroll',
  },
  dishSelectCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dishSelectCardActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  dishSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dishSelectName: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    flex: 1,
  },
  dishPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishOrigPrice: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
  },
  dishDiscPrice: {
    fontSize: 11,
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  dishCatBadge: {
    fontSize: 9,
    color: BRAND.muted,
    marginTop: 4,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catSelectCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catSelectCardActive: {
    borderColor: BRAND.burgundy,
    backgroundColor: '#FEF2F2',
  },
  catSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catSelectTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.ink,
  },
  catSelectCount: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 4,
  },
  scopeOrderContainer: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  scopeOrderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scopeOrderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
  },
  scopeOrderSub: {
    fontSize: 12,
    color: '#3B82F6',
    textAlign: 'center',
    maxWidth: 480,
    marginTop: 4,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.muted,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.ink,
  },
  quickDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.burgundy,
  },
  daysPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dayCircle: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  dayCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.ink,
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  allDayCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  analyticsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
  },
  analyticsCodeBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  analyticsCodeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  analyticsSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 4,
  },
  analyticsScroll: {
    padding: 20,
  },
  analyticsKpiStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  analyticsKpiBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  analyticsKpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  analyticsKpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 4,
  },
  analyticsKpiHint: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 2,
  },
  analyticsSection: {
    marginBottom: 20,
  },
  analyticsSectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
    marginBottom: 10,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.muted,
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  tableBodyCell: {
    fontSize: 12,
    color: BRAND.ink,
  },
  noDataHint: {
    fontSize: 12,
    color: BRAND.muted,
    fontStyle: 'italic',
    padding: 10,
  },
  redemptionsList: {
    gap: 8,
  },
  redemptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  redemptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  redemptionInvoice: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.ink,
  },
  redemptionCustomer: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  redemptionGross: {
    fontSize: 11,
    color: BRAND.muted,
  },
  redemptionDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.danger,
  },
  redemptionNet: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.success,
  },
  redemptionItems: {
    fontSize: 11,
    color: BRAND.ink,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});
