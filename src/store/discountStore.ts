import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';
export * from '../types/discount';
import { 
  EventDiscount, 
  CampaignFormData, 
  CampaignRedemption, 
  TopDishPerformance 
} from '../types/discount';
import { checkCampaignValidity } from '../utils/discountCalculator';

const SEED_CAMPAIGNS: EventDiscount[] = [
  {
    id: 'EVENT-BBQ-2026',
    title: 'Weekend BBQ & Karahi Fiesta',
    urduTitle: 'ویک اینڈ باربی کیو اور کڑاہی فیسٹیول',
    code: 'BBQ15',
    description: 'Special 15% flat off on our signature royal charcoal kebabs and fresh desi ghee karahis during peak weekend evenings.',
    type: 'percentage',
    value: 15,
    scope: 'item',
    targetItemIds: ['m1', 'm2'], // Sultan Kebab & Chicken Karahi
    targetCategories: ['Mains'],
    startDate: '2026-10-10',
    endDate: '2026-10-26',
    activeDays: [0, 5, 6], // Sun, Fri, Sat
    allDay: false,
    startTime: '17:00',
    endTime: '23:59',
    minSpend: 2000,
    maxDiscountCap: 1000,
    budgetLimit: 50000,
    maxRedemptions: 150,
    status: 'active',
    bannerTheme: 'burgundy',
    createdAt: Date.now() - 6 * 86400000,
    updatedAt: Date.now() - 86400000,
    redemptionsCount: 48,
    totalGrossSales: 216400,
    totalDiscountGiven: 28500,
    netRevenue: 187900,
    topDishes: [
      { itemId: 'm1', itemName: 'Sultan Kebab', category: 'Mains', qtySold: 64, grossSales: 92800, discountAmount: 13920 },
      { itemId: 'm2', itemName: 'Chicken Karahi', category: 'Mains', qtySold: 42, grossSales: 77700, discountAmount: 11655 }
    ],
    recentRedemptions: [
      {
        id: 'RED-101',
        invoiceId: 'INV-72911',
        timestamp: Date.now() - 3600000 * 2,
        orderType: 'dine-in',
        tableName: 'T-04 (Majlis-1)',
        customerName: 'Hamza Tariq',
        customerPhone: '0321-4455667',
        grossSales: 6450,
        discountApplied: 742,
        netPaid: 5708,
        itemsCount: 4,
        itemsSummary: '2x Sultan Kebab, 1x Chicken Karahi, 2x Naan'
      },
      {
        id: 'RED-102',
        invoiceId: 'INV-72895',
        timestamp: Date.now() - 3600000 * 5,
        orderType: 'dine-in',
        tableName: 'T-02',
        customerName: 'Usman Ali',
        customerPhone: '0300-8812345',
        grossSales: 4750,
        discountApplied: 510,
        netPaid: 4240,
        itemsCount: 3,
        itemsSummary: '1x Chicken Karahi, 1x Sultan Kebab, Drinks'
      },
      {
        id: 'RED-103',
        invoiceId: 'INV-72820',
        timestamp: Date.now() - 86400000,
        orderType: 'takeaway',
        customerName: 'Dr. Bilal Qureshi',
        customerPhone: '0333-9988771',
        grossSales: 5800,
        discountApplied: 650,
        netPaid: 5150,
        itemsCount: 4,
        itemsSummary: '2x Sultan Kebab, 1x Chicken Karahi'
      }
    ]
  },
  {
    id: 'EVENT-DESSERT-OCT',
    title: 'Sweet Treats Dessert Hour',
    urduTitle: 'شاہی میٹھے اور کنافہ آور',
    code: 'SWEET20',
    description: 'Indulge your sweet tooth! Enjoy 20% off all Turkish Kunafas and royal desserts on evening family dinners.',
    type: 'percentage',
    value: 20,
    scope: 'category',
    targetItemIds: ['m4'],
    targetCategories: ['Desserts'],
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    allDay: false,
    startTime: '16:00',
    endTime: '22:30',
    minSpend: 1500,
    maxDiscountCap: 500,
    budgetLimit: 30000,
    maxRedemptions: 200,
    status: 'active',
    bannerTheme: 'gold',
    createdAt: Date.now() - 15 * 86400000,
    updatedAt: Date.now() - 3600000,
    redemptionsCount: 34,
    totalGrossSales: 98200,
    totalDiscountGiven: 14200,
    netRevenue: 84000,
    topDishes: [
      { itemId: 'm4', itemName: 'Kunafa', category: 'Desserts', qtySold: 52, grossSales: 44200, discountAmount: 8840 }
    ],
    recentRedemptions: [
      {
        id: 'RED-201',
        invoiceId: 'INV-72904',
        timestamp: Date.now() - 3600000 * 3,
        orderType: 'dine-in',
        tableName: 'T-06 (Family Hall)',
        customerName: 'Mrs. Farooq',
        customerPhone: '0312-5544332',
        grossSales: 3550,
        discountApplied: 340,
        netPaid: 3210,
        itemsCount: 3,
        itemsSummary: '2x Kunafa, 1x Mint Margarita'
      }
    ]
  },
  {
    id: 'EVENT-EID-FEAST',
    title: 'Grand Sultan Family Feast',
    urduTitle: 'گرینڈ فیملی عید میلہ - 500 کی بچت',
    code: 'FEAST500',
    description: 'Flat Rs. 500 cash back discount on all royal family dining banquets with subtotal above Rs. 4,000.',
    type: 'fixed',
    value: 500,
    scope: 'order',
    targetItemIds: [],
    targetCategories: [],
    startDate: '2026-10-28',
    endDate: '2026-11-08',
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    allDay: true,
    minSpend: 4000,
    maxDiscountCap: 500,
    budgetLimit: 75000,
    maxRedemptions: 150,
    status: 'scheduled',
    bannerTheme: 'emerald',
    createdAt: Date.now() - 2 * 86400000,
    updatedAt: Date.now() - 2 * 86400000,
    redemptionsCount: 0,
    totalGrossSales: 0,
    totalDiscountGiven: 0,
    netRevenue: 0,
    topDishes: [],
    recentRedemptions: []
  },
  {
    id: 'EVENT-LUNCH-SEP',
    title: 'Executive Lunch Booster',
    urduTitle: 'ایگزیکٹو لنچ ڈسکاؤنٹ',
    code: 'LUNCH10',
    description: '10% discount on entire corporate lunch orders during September peak work hours.',
    type: 'percentage',
    value: 10,
    scope: 'category',
    targetItemIds: [],
    targetCategories: ['Mains', 'Appetizers'],
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    activeDays: [1, 2, 3, 4, 5],
    allDay: false,
    startTime: '12:00',
    endTime: '16:00',
    minSpend: 1500,
    maxDiscountCap: 800,
    status: 'expired',
    bannerTheme: 'sapphire',
    createdAt: Date.now() - 45 * 86400000,
    updatedAt: Date.now() - 15 * 86400000,
    redemptionsCount: 62,
    totalGrossSales: 170400,
    totalDiscountGiven: 17040,
    netRevenue: 153360,
    topDishes: [
      { itemId: 'm2', itemName: 'Chicken Karahi', category: 'Mains', qtySold: 45, grossSales: 83250, discountAmount: 8325 },
      { itemId: 'm3', itemName: 'Hummus & Pita', category: 'Appetizers', qtySold: 38, grossSales: 24700, discountAmount: 2470 }
    ],
    recentRedemptions: []
  }
];

export interface DiscountState {
  campaigns: EventDiscount[];
  
  // Actions
  addCampaign: (data: CampaignFormData) => string;
  updateCampaign: (id: string, updates: Partial<CampaignFormData>) => void;
  toggleCampaignStatus: (id: string, newStatus?: 'active' | 'paused' | 'expired') => void;
  deleteCampaign: (id: string) => void;
  recordRedemption: (params: {
    campaignId: string;
    invoiceId: string;
    orderType: 'dine-in' | 'takeaway' | 'delivery';
    tableName?: string;
    customerName?: string;
    customerPhone?: string;
    grossSales: number;
    discountApplied: number;
    items: { id: string; name: string; price: number; qty: number; category?: string }[];
  }) => void;
  resetToDefaultCampaigns: () => void;
}

export const useDiscountStore = create<DiscountState>()(
  persist(
    (set, get) => ({
      campaigns: SEED_CAMPAIGNS,

      addCampaign: (data) => {
        const id = `EVENT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;
        const now = Date.now();
        const newCampaign: EventDiscount = {
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          redemptionsCount: 0,
          totalGrossSales: 0,
          totalDiscountGiven: 0,
          netRevenue: 0,
          topDishes: [],
          recentRedemptions: []
        };

        set(state => ({
          campaigns: [newCampaign, ...state.campaigns]
        }));

        return id;
      },

      updateCampaign: (id, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(camp => 
            camp.id === id 
              ? { ...camp, ...updates, updatedAt: Date.now() }
              : camp
          )
        }));
      },

      toggleCampaignStatus: (id, newStatus) => {
        set(state => ({
          campaigns: state.campaigns.map(camp => {
            if (camp.id !== id) return camp;
            const targetStatus = newStatus || (camp.status === 'active' ? 'paused' : 'active');
            return {
              ...camp,
              status: targetStatus,
              updatedAt: Date.now()
            };
          })
        }));
      },

      deleteCampaign: (id) => {
        set(state => ({
          campaigns: state.campaigns.filter(c => c.id !== id)
        }));
      },

      recordRedemption: ({
        campaignId,
        invoiceId,
        orderType,
        tableName,
        customerName,
        customerPhone,
        grossSales,
        discountApplied,
        items
      }) => {
        set(state => {
          const campaign = state.campaigns.find(c => c.id === campaignId);
          if (!campaign) return state;

          const redemptionItem: CampaignRedemption = {
            id: `RED-${Date.now().toString(36).toUpperCase()}`,
            invoiceId,
            timestamp: Date.now(),
            orderType,
            tableName,
            customerName: customerName || 'Walk-in Guest',
            customerPhone,
            grossSales,
            discountApplied,
            netPaid: Math.max(0, grossSales - discountApplied),
            itemsCount: items.reduce((s, it) => s + it.qty, 0),
            itemsSummary: items.map(it => `${it.qty}x ${it.name}`).slice(0, 3).join(', ')
          };

          // Update dish breakdown
          const dishMap = new Map<string, TopDishPerformance>();
          campaign.topDishes.forEach(td => dishMap.set(td.itemId, { ...td }));

          items.forEach(it => {
            const baseId = it.id.split('-')[0];
            const isTarget = campaign.scope === 'order' || 
              (campaign.scope === 'item' && (campaign.targetItemIds.includes(it.id) || campaign.targetItemIds.includes(baseId))) ||
              (campaign.scope === 'category' && it.category && campaign.targetCategories.includes(it.category));

            if (isTarget) {
              const existing = dishMap.get(baseId) || {
                itemId: baseId,
                itemName: it.name,
                category: it.category || 'Mains',
                qtySold: 0,
                grossSales: 0,
                discountAmount: 0
              };
              existing.qtySold += it.qty;
              existing.grossSales += it.price * it.qty;
              const dishDiscountRatio = grossSales > 0 ? (it.price * it.qty) / grossSales : 0;
              existing.discountAmount += Math.round(discountApplied * dishDiscountRatio);
              dishMap.set(baseId, existing);
            }
          });

          const updatedTopDishes = Array.from(dishMap.values())
            .sort((a, b) => b.qtySold - a.qtySold);

          const updatedCampaign: EventDiscount = {
            ...campaign,
            redemptionsCount: campaign.redemptionsCount + 1,
            totalGrossSales: campaign.totalGrossSales + grossSales,
            totalDiscountGiven: campaign.totalDiscountGiven + discountApplied,
            netRevenue: campaign.netRevenue + (grossSales - discountApplied),
            topDishes: updatedTopDishes,
            recentRedemptions: [redemptionItem, ...(campaign.recentRedemptions || [])].slice(0, 20),
            updatedAt: Date.now()
          };

          return {
            campaigns: state.campaigns.map(c => c.id === campaignId ? updatedCampaign : c)
          };
        });
      },

      resetToDefaultCampaigns: () => {
        set({ campaigns: SEED_CAMPAIGNS });
      }
    }),
    {
      name: 'sultan-events-discount-store',
      storage: appStorage
    }
  )
);
