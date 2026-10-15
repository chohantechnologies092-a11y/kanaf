import { EventDiscount } from '../types/discount';

export type DiscountCalculationResult = {
  eligible: boolean;
  discountAmount: number;
  applicableSubtotal: number;
  matchedItemNames: string[];
  reason?: string;
};

/**
 * Checks if a campaign is valid and active right now based on date, days of week, and time.
 */
export function checkCampaignValidity(
  campaign: EventDiscount,
  now: Date = new Date()
): { isValid: boolean; reason?: string; autoStatus: 'active' | 'scheduled' | 'expired' | 'paused' } {
  if (campaign.status === 'paused') {
    return { isValid: false, reason: 'Campaign is paused by manager', autoStatus: 'paused' };
  }

  // Format today's YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (todayStr < campaign.startDate) {
    return { isValid: false, reason: `Starts on ${campaign.startDate}`, autoStatus: 'scheduled' };
  }

  if (todayStr > campaign.endDate) {
    return { isValid: false, reason: `Expired on ${campaign.endDate}`, autoStatus: 'expired' };
  }

  // Check Active Days of Week
  const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
  if (campaign.activeDays && campaign.activeDays.length > 0 && !campaign.activeDays.includes(dayOfWeek)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeDayLabels = campaign.activeDays.map(d => dayNames[d]).join(', ');
    return { isValid: false, reason: `Only active on: ${activeDayLabels}`, autoStatus: 'active' };
  }

  // Check Time of Day
  if (!campaign.allDay && campaign.startTime && campaign.endTime) {
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = campaign.startTime.split(':').map(Number);
    const [endH, endM] = campaign.endTime.split(':').map(Number);
    const startTimeMinutes = (startH || 0) * 60 + (startM || 0);
    const endTimeMinutes = (endH || 0) * 60 + (endM || 0);

    if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) {
      return {
        isValid: false,
        reason: `Active only between ${campaign.startTime} - ${campaign.endTime}`,
        autoStatus: 'active'
      };
    }
  }

  // Check Redemptions Cap
  if (campaign.maxRedemptions && campaign.maxRedemptions > 0 && campaign.redemptionsCount >= campaign.maxRedemptions) {
    return { isValid: false, reason: 'Campaign redemption limit reached', autoStatus: 'expired' };
  }

  // Check Budget Subsidy Cap
  if (campaign.budgetLimit && campaign.budgetLimit > 0 && campaign.totalDiscountGiven >= campaign.budgetLimit) {
    return { isValid: false, reason: 'Campaign promotional budget exhausted', autoStatus: 'expired' };
  }

  return { isValid: true, autoStatus: 'active' };
}

/**
 * Calculates discount for given cart items & subtotal under a specific campaign
 */
export function calculateOrderDiscount(
  campaign: EventDiscount,
  cartItems: { id: string; name: string; price: number; qty: number; category?: string }[],
  orderSubtotal: number
): DiscountCalculationResult {
  const validity = checkCampaignValidity(campaign);
  if (!validity.isValid) {
    return {
      eligible: false,
      discountAmount: 0,
      applicableSubtotal: 0,
      matchedItemNames: [],
      reason: validity.reason
    };
  }

  // Check Minimum Order Spend Threshold
  if (campaign.minSpend && campaign.minSpend > 0 && orderSubtotal < campaign.minSpend) {
    return {
      eligible: false,
      discountAmount: 0,
      applicableSubtotal: 0,
      matchedItemNames: [],
      reason: `Requires minimum bill of Rs. ${campaign.minSpend.toLocaleString()} (Current: Rs. ${orderSubtotal.toLocaleString()})`
    };
  }

  let applicableSubtotal = 0;
  const matchedItemNames: string[] = [];

  if (campaign.scope === 'order') {
    applicableSubtotal = orderSubtotal;
    matchedItemNames.push('All Order Items');
  } else if (campaign.scope === 'category') {
    cartItems.forEach(item => {
      const itemCat = item.category || '';
      if (campaign.targetCategories.includes(itemCat)) {
        applicableSubtotal += item.price * item.qty;
        matchedItemNames.push(item.name);
      }
    });

    if (applicableSubtotal === 0) {
      return {
        eligible: false,
        discountAmount: 0,
        applicableSubtotal: 0,
        matchedItemNames: [],
        reason: `Valid for categories: ${campaign.targetCategories.join(', ')} (None in current cart)`
      };
    }
  } else if (campaign.scope === 'item') {
    cartItems.forEach(item => {
      const baseId = item.id.split('-')[0];
      if (campaign.targetItemIds.includes(item.id) || campaign.targetItemIds.includes(baseId)) {
        applicableSubtotal += item.price * item.qty;
        matchedItemNames.push(item.name);
      }
    });

    if (applicableSubtotal === 0) {
      return {
        eligible: false,
        discountAmount: 0,
        applicableSubtotal: 0,
        matchedItemNames: [],
        reason: `Valid for selected dishes only (None in current cart)`
      };
    }
  }

  // Calculate Discount Amount
  let rawDiscount = 0;
  if (campaign.type === 'percentage') {
    rawDiscount = Math.round((applicableSubtotal * campaign.value) / 100);
  } else {
    // Fixed PKR discount
    rawDiscount = Math.min(campaign.value, applicableSubtotal);
  }

  // Apply Max Discount Cap
  if (campaign.maxDiscountCap && campaign.maxDiscountCap > 0) {
    rawDiscount = Math.min(rawDiscount, campaign.maxDiscountCap);
  }

  // Ensure discount does not exceed total order subtotal
  const finalDiscount = Math.min(rawDiscount, orderSubtotal);

  return {
    eligible: finalDiscount > 0,
    discountAmount: finalDiscount,
    applicableSubtotal,
    matchedItemNames,
    reason: undefined
  };
}

/**
 * Format date range into friendly readable string
 */
export function formatTenureDisplay(startDate: string, endDate: string): string {
  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${s.toLocaleDateString('en-GB', opt)} - ${e.toLocaleDateString('en-GB', opt)}`;
  } catch {
    return `${startDate} - ${endDate}`;
  }
}
