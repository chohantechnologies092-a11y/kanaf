import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchenStore, getActiveSessions } from '../store/kitchenStore';

import { usePortalBase } from '../hooks/usePortalBase';

const BRAND = {
  burgundy: '#52171B',
  gold: '#D5A943',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
};

type TabDef = {
  id: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
};

export default function KitchenOpsNav({ backRoute }: { backRoute?: string }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const portalBase = usePortalBase();
  const resolvedBackRoute = backRoute || `${portalBase}/dashboard`;
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const { kitchenSessions, recipes } = useKitchenStore();
  const liveSessions = getActiveSessions(kitchenSessions);
  const activeSession = liveSessions[0];
  const pendingApproval = kitchenSessions.find((s) => s.status === 'pending_approval');
  const draftSession = kitchenSessions.find((s) => s.status === 'draft');

  const tabs: TabDef[] = [
    {
      id: 'handover',
      label: '1. Handover & Requisition',
      route: `${portalBase}/kitchen-handover`,
      icon: 'clipboard-outline',
      badge: draftSession ? 'Draft' : activeSession ? (liveSessions.length > 1 ? `${liveSessions.length} Live` : 'Issued') : undefined,
    },
    {
      id: 'recipes',
      label: '2. Recipe BOM (Grams)',
      route: `${portalBase}/recipes`,
      icon: 'restaurant-outline',
      badge: `${recipes.length}`,
    },
    {
      id: 'day',
      label: '3. Chef Day Console',
      route: '/kitchen/day',
      icon: 'flame-outline',
      badge: activeSession ? 'Live' : undefined,
    },
    {
      id: 'returns',
      label: '4. EOD Returns & Approval',
      route: `${portalBase}/kitchen-returns`,
      icon: 'checkmark-done-circle-outline',
      badge: pendingApproval ? 'Pending' : undefined,
    },
    {
      id: 'costing',
      label: '5. Costing & Profit',
      route: `${portalBase}/costing`,
      icon: 'calculator-outline',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleWrap}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(resolvedBackRoute as any))}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={BRAND.burgundy} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.suiteTitle}>Sultan Kitchen Operations Suite</Text>
              {activeSession && (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>
                    {liveSessions.length > 1 ? `${liveSessions.length} live shifts` : activeSession.headChef}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.suiteSub}>
              Store Requisition • Recipes BOM • Auto KOT Deduct • Chef Adjustments • EOD Restock • Food Costing
            </Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {tabs.map((tab) => {
          const isActive = pathname.includes(tab.id) || (tab.id === 'day' && pathname === '/kitchen/day');
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? '#FFFFFF' : BRAND.burgundy}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              {tab.badge && (
                <View
                  style={[
                    styles.badge,
                    isActive ? styles.badgeActive : styles.badgeInactive,
                    tab.badge === 'Pending' && { backgroundColor: '#C62828' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isActive && styles.badgeTextActive,
                      tab.badge === 'Pending' && { color: '#FFFFFF' },
                    ]}
                  >
                    {tab.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F5EBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suiteTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND.burgundy,
    letterSpacing: 0.3,
  },
  suiteSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D32',
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D32',
  },
  tabScroll: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  tabBtnActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeInactive: {
    backgroundColor: '#EFEBE9',
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});
