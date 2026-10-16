import type { RolePermissions } from '../store/roleStore';

type PermKey = keyof RolePermissions;

export interface ManagerRouteRule {
  /** Every listed permission must be granted by Admin for the route to open. */
  requires: PermKey[];
  moduleName: string;
  urduModuleName: string;
}

/**
 * Single source of truth: which Admin-granted permission(s) each Manager screen needs.
 * Used by the manager sidebar/drawer, bottom nav AND the route guard in manager/_layout,
 * so a screen hidden from the menu can never be opened by direct URL either.
 *
 * Routes not listed here (only `/manager/dashboard` and `/manager`) are always open.
 */
export const MANAGER_ROUTE_RULES: Record<string, ManagerRouteRule> = {
  '/manager/pos': { requires: ['canAccessPOS'], moduleName: 'POS Terminal', urduModuleName: 'پی او ایس ٹرمینل' },
  '/manager/floor-plan': { requires: ['canAccessFloorPlan'], moduleName: 'Floor Plan', urduModuleName: 'فلور پلان' },
  '/manager/floors': { requires: ['canAccessFloorPlan'], moduleName: 'Floor Command', urduModuleName: 'فلور کمانڈ' },
  '/manager/shift': { requires: ['canStartCloseShift'], moduleName: 'Live Shift & Cash', urduModuleName: 'شفٹ اور کیش' },
  '/manager/invoices': { requires: ['canAccessInvoices'], moduleName: 'Invoices & Orders', urduModuleName: 'انوائسز اور آرڈرز' },
  '/manager/returns': { requires: ['canProcessReturns'], moduleName: 'Sales Returns & Refunds', urduModuleName: 'سیلز ریٹرن' },
  '/manager/discounts': { requires: ['canAccessDiscounts'], moduleName: 'Events & Discounts', urduModuleName: 'ایونٹس اور ڈسکاؤنٹس' },
  '/manager/inventory': { requires: ['canAccessInventory'], moduleName: 'Inventory', urduModuleName: 'انوینٹری' },
  '/manager/suppliers': { requires: ['canAccessInventory'], moduleName: 'Suppliers', urduModuleName: 'سپلائرز' },
  '/manager/expenses': { requires: ['canAccessExpenses'], moduleName: 'Live Expenses', urduModuleName: 'اخراجات' },
  '/manager/reports': { requires: ['canAccessReports', 'canViewRevenue'], moduleName: 'Financial Reports', urduModuleName: 'مالیاتی رپورٹس' },
  '/manager/damages': { requires: ['canAccessDamages'], moduleName: 'Damage Control', urduModuleName: 'ڈیمیج کنٹرول' },
  '/manager/assets': { requires: ['canAccessAssets'], moduleName: 'Assets & Capex', urduModuleName: 'اثاثہ جات' },
  '/manager/kitchen-handover': { requires: ['canAccessKitchenHandover'], moduleName: 'Kitchen Handover', urduModuleName: 'کچن ہینڈ اوور' },
  '/manager/kitchen-returns': { requires: ['canAccessKitchenHandover'], moduleName: 'Kitchen Returns', urduModuleName: 'کچن ریٹرنز' },
  '/manager/recipes': { requires: ['canAccessRecipes'], moduleName: 'Recipe BOM', urduModuleName: 'ریسپی' },
  '/manager/costing': { requires: ['canAccessRecipes', 'canViewCostPrice'], moduleName: 'Dish Costing', urduModuleName: 'ڈش کاسٹنگ' },
};

/** Finds the rule for a pathname (also matches nested paths like `/manager/inventory/123`). */
export function getManagerRouteRule(pathname: string | null | undefined): ManagerRouteRule | undefined {
  if (!pathname) return undefined;
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  if (MANAGER_ROUTE_RULES[clean]) return MANAGER_ROUTE_RULES[clean];
  const key = Object.keys(MANAGER_ROUTE_RULES).find((r) => clean.startsWith(r + '/'));
  return key ? MANAGER_ROUTE_RULES[key] : undefined;
}

export function isManagerRouteAllowed(
  pathname: string | null | undefined,
  can: (perm: PermKey) => boolean
): boolean {
  const rule = getManagerRouteRule(pathname);
  if (!rule) return true;
  return rule.requires.every((perm) => can(perm));
}
