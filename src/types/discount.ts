export type DiscountScope = 'item' | 'category' | 'order';

export type DiscountType = 'percentage' | 'fixed';

export type DiscountCampaignStatus = 'active' | 'scheduled' | 'expired' | 'paused';

export type BannerTheme = 'burgundy' | 'gold' | 'emerald' | 'amber' | 'sapphire' | 'violet';

export type TopDishPerformance = {
  itemId: string;
  itemName: string;
  category: string;
  qtySold: number;
  grossSales: number;
  discountAmount: number;
};

export type CampaignRedemption = {
  id: string;
  invoiceId: string;
  timestamp: number;
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  grossSales: number;
  discountApplied: number;
  netPaid: number;
  itemsCount: number;
  itemsSummary: string;
};

export type EventDiscount = {
  id: string;
  title: string;
  urduTitle?: string;
  code: string; // e.g. "BBQ15", "EID2026", "SWEET20"
  description: string;
  type: DiscountType; // 'percentage' | 'fixed'
  value: number; // e.g. 15 for 15% or 300 for Rs. 300
  scope: DiscountScope; // 'item' | 'category' | 'order'
  targetItemIds: string[]; // Specific menu item IDs
  targetCategories: string[]; // Category names (e.g. 'Desserts', 'Mains')
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  activeDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  allDay: boolean;
  startTime?: string; // HH:mm format, e.g. "17:00"
  endTime?: string; // HH:mm format, e.g. "23:00"
  minSpend: number; // Minimum order subtotal required (PKR)
  maxDiscountCap?: number; // Cap for percentage discounts (PKR)
  budgetLimit?: number; // Total promotional subsidy limit in PKR (optional)
  maxRedemptions?: number; // Total usages limit (optional)
  status: DiscountCampaignStatus;
  bannerTheme: BannerTheme;
  createdAt: number;
  updatedAt: number;
  
  // Real-time Sales & Performance Tracking
  redemptionsCount: number;
  totalGrossSales: number; // Gross sales of orders redeeming this discount
  totalDiscountGiven: number; // Total discount amount subsidized by restaurant
  netRevenue: number; // totalGrossSales - totalDiscountGiven
  topDishes: TopDishPerformance[];
  recentRedemptions: CampaignRedemption[];
};

export type CampaignFormData = Omit<
  EventDiscount,
  'id' | 'createdAt' | 'updatedAt' | 'redemptionsCount' | 'totalGrossSales' | 'totalDiscountGiven' | 'netRevenue' | 'topDishes' | 'recentRedemptions'
>;
