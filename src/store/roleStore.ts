import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';
import { useAuthStore } from './authStore';

export interface RolePermissions {
  // 1. Financial & Sensitive Data Visibility (Key User Request!)
  canViewRevenue: boolean; // Show revenue, sales gross numbers & net figures
  canViewCostPrice: boolean; // Show recipe ingredient costs & profit margins
  canViewCustomerContacts: boolean; // Show customer phone numbers & personal CRM data
  canExportReports: boolean; // Download CSV / print business reports

  // 2. Module & Section Access
  canAccessPOS: boolean; // POS Billing Terminal
  canAccessInvoices: boolean; // Invoices & Orders history
  canAccessReports: boolean; // Financial & Shift Reporting screens
  canAccessInventory: boolean; // Stock, Inventory, & Suppliers
  canAccessKitchenHandover: boolean; // Kitchen Handover & Return Console
  canAccessRecipes: boolean; // Recipe BOM & Dish Costing
  canAccessDiscounts: boolean; // Events & Promotional Discounts
  canAccessStaff: boolean; // Staff & Roles Management
  canAccessExpenses: boolean; // Live Expenses & Asset Capex

  // 3. Operational & Transactional Authority
  canApplyCustomDiscount: boolean; // Punch manual discounts in POS
  canVoidInvoice: boolean; // Void settled invoices
  canProcessReturns: boolean; // Authorize cash refunds & sales returns
  canStartCloseShift: boolean; // Open shifts and perform Blind Closing
  canModifyMenuPrices: boolean; // Change dish selling prices & variants
}

export type BaseRoleType = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'juicebar' | 'playland' | 'custom';

export interface CustomRole {
  id: string; // e.g. 'role-admin', 'role-manager', 'role-cashier-1'
  name: string; // e.g. 'Admin', 'Floor Manager', 'Senior Cashier'
  urduName?: string; // 'ایڈمن', 'فلور منیجر'
  description: string;
  badgeColor: string; // Hex color code
  icon: string; // Ionicons glyph name
  isSystem?: boolean; // System roles cannot be deleted
  baseRole: BaseRoleType;
  permissions: RolePermissions;
  createdAt: number;
  updatedAt: number;
}

export const ADMIN_PERMISSIONS: RolePermissions = {
  canViewRevenue: true,
  canViewCostPrice: true,
  canViewCustomerContacts: true,
  canExportReports: true,
  canAccessPOS: true,
  canAccessInvoices: true,
  canAccessReports: true,
  canAccessInventory: true,
  canAccessKitchenHandover: true,
  canAccessRecipes: true,
  canAccessDiscounts: true,
  canAccessStaff: true,
  canAccessExpenses: true,
  canApplyCustomDiscount: true,
  canVoidInvoice: true,
  canProcessReturns: true,
  canStartCloseShift: true,
  canModifyMenuPrices: true,
};

export const DEFAULT_ROLES: CustomRole[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    urduName: 'ایگزیکٹو ایڈمن',
    description: 'Full unconstrained system authority over finance, staff, menu, and operations.',
    badgeColor: '#52171B',
    icon: 'shield-checkmark',
    isSystem: true,
    baseRole: 'admin',
    permissions: { ...ADMIN_PERMISSIONS },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-manager',
    name: 'Manager',
    urduName: 'جنرل منیجر',
    description: 'Floor command, shift operations, stock auditing, and table seating management.',
    badgeColor: '#B48214',
    icon: 'business',
    isSystem: true,
    baseRole: 'manager',
    permissions: {
      canViewRevenue: true, // Can be toggled OFF by Admin if revenue numbers should be hidden!
      canViewCostPrice: true,
      canViewCustomerContacts: true,
      canExportReports: true,
      canAccessPOS: true,
      canAccessInvoices: true,
      canAccessReports: true,
      canAccessInventory: true,
      canAccessKitchenHandover: true,
      canAccessRecipes: true,
      canAccessDiscounts: true,
      canAccessStaff: false,
      canAccessExpenses: true,
      canApplyCustomDiscount: true,
      canVoidInvoice: true,
      canProcessReturns: true,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-cashier',
    name: 'Cashier',
    urduName: 'کاؤنٹر کیشیئر',
    description: 'Dedicated POS billing, invoice generation, and shift cash reconciliation.',
    badgeColor: '#7C3AED',
    icon: 'calculator',
    isSystem: false,
    baseRole: 'manager',
    permissions: {
      canViewRevenue: false, // Blind cash counting — no revenue visibility
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: true,
      canAccessInvoices: true,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: false,
      canAccessRecipes: false,
      canAccessDiscounts: true,
      canAccessStaff: false,
      canAccessExpenses: false,
      canApplyCustomDiscount: true,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-waiter',
    name: 'Order Taker',
    urduName: 'آرڈر ٹیکر / ویٹر',
    description: 'Takes table orders, generates KOT tickets, and manages assigned dining zones.',
    badgeColor: '#2563EB',
    icon: 'person',
    isSystem: true,
    baseRole: 'waiter',
    permissions: {
      canViewRevenue: false,
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: false,
      canAccessInvoices: false,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: false,
      canAccessRecipes: false,
      canAccessDiscounts: false,
      canAccessStaff: false,
      canAccessExpenses: false,
      canApplyCustomDiscount: false,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: false,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-kitchen',
    name: 'Kitchen',
    urduName: 'شیف / کچن ماسٹر',
    description: 'Culinary preparation console, recipe execution, and raw materials handover.',
    badgeColor: '#DC2626',
    icon: 'restaurant',
    isSystem: true,
    baseRole: 'kitchen',
    permissions: {
      canViewRevenue: false,
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: false,
      canAccessInvoices: false,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: true,
      canAccessRecipes: true,
      canAccessDiscounts: false,
      canAccessStaff: false,
      canAccessExpenses: false,
      canApplyCustomDiscount: false,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-juicebar',
    name: 'Juice Bar',
    urduName: 'جوس بار انچارج',
    description: 'Beverages preparation, mocktails station, and fruit inventory monitoring.',
    badgeColor: '#059669',
    icon: 'wine',
    isSystem: true,
    baseRole: 'juicebar',
    permissions: {
      canViewRevenue: false,
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: false,
      canAccessInvoices: false,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: true,
      canAccessRecipes: true,
      canAccessDiscounts: false,
      canAccessStaff: false,
      canAccessExpenses: false,
      canApplyCustomDiscount: false,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'role-playland',
    name: 'Playland',
    urduName: 'پلے لینڈ انچارج',
    description: 'Kids playland tokens, wristband check-in, and attraction safety.',
    badgeColor: '#D97706',
    icon: 'balloon',
    isSystem: true,
    baseRole: 'playland',
    permissions: {
      canViewRevenue: false,
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: false,
      canAccessInvoices: false,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: false,
      canAccessRecipes: false,
      canAccessDiscounts: false,
      canAccessStaff: false,
      canAccessExpenses: false,
      canApplyCustomDiscount: false,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

interface RoleState {
  roles: CustomRole[];
  addRole: (role: Omit<CustomRole, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRole: (id: string, updates: Partial<CustomRole>) => void;
  deleteRole: (id: string) => boolean;
  togglePermission: (roleId: string, permissionKey: keyof RolePermissions) => void;
  setPermission: (roleId: string, permissionKey: keyof RolePermissions, value: boolean) => void;
  getRoleById: (id: string) => CustomRole | undefined;
  getEffectivePermissions: (roleIdentifier?: string) => RolePermissions;
  resetToDefaultRoles: () => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,

      addRole: (data) => {
        const id = `role-${Date.now().toString(36)}-${Math.floor(Math.random() * 899 + 100)}`;
        const now = Date.now();
        const newRole: CustomRole = {
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          roles: [...state.roles, newRole],
        }));

        return id;
      },

      updateRole: (id, updates) => {
        set((state) => ({
          roles: state.roles.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...updates,
                  // System admin role always preserves root permissions
                  permissions: r.id === 'role-admin' ? { ...ADMIN_PERMISSIONS } : (updates.permissions || r.permissions),
                  updatedAt: Date.now(),
                }
              : r
          ),
        }));
      },

      deleteRole: (id) => {
        const target = get().roles.find((r) => r.id === id);
        if (!target || target.isSystem || target.id === 'role-admin') {
          return false;
        }

        set((state) => ({
          roles: state.roles.filter((r) => r.id !== id),
        }));
        return true;
      },

      togglePermission: (roleId, permissionKey) => {
        if (roleId === 'role-admin') return; // Admin permissions cannot be turned off

        set((state) => ({
          roles: state.roles.map((r) => {
            if (r.id !== roleId) return r;
            const currentVal = r.permissions[permissionKey];
            return {
              ...r,
              permissions: {
                ...r.permissions,
                [permissionKey]: !currentVal,
              },
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      setPermission: (roleId, permissionKey, value) => {
        if (roleId === 'role-admin') return;

        set((state) => ({
          roles: state.roles.map((r) => {
            if (r.id !== roleId) return r;
            return {
              ...r,
              permissions: {
                ...r.permissions,
                [permissionKey]: value,
              },
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      getRoleById: (id) => {
        return get().roles.find((r) => r.id === id);
      },

      getEffectivePermissions: (roleIdentifier) => {
        if (!roleIdentifier) return DEFAULT_ROLES[3].permissions; // Default to waiter / restricted

        const normalized = roleIdentifier.toLowerCase().trim();
        if (normalized === 'admin' || roleIdentifier === 'role-admin') {
          return ADMIN_PERMISSIONS;
        }

        const found = get().roles.find(
          (r) =>
            r.id === roleIdentifier ||
            r.name.toLowerCase() === normalized ||
            r.baseRole === normalized
        );

        return found ? found.permissions : DEFAULT_ROLES[3].permissions;
      },

      resetToDefaultRoles: () => {
        set({ roles: DEFAULT_ROLES });
      },
    }),
    {
      name: 'sultan-roles-permissions-store',
      storage: appStorage,
    }
  )
);

/**
 * Hook to retrieve effective permissions of currently logged-in user,
 * or inspect permissions of a specific role context (e.g. 'manager' when viewing manager screens).
 */
export function useRolePermissions(targetRoleOverride?: string) {
  const user = useAuthStore((s) => s.user);
  const roles = useRoleStore((s) => s.roles);

  const permissions: RolePermissions = (() => {
    // 1. If targetRoleOverride is provided (e.g. on /manager screens), inspect that target role directly
    if (targetRoleOverride) {
      const targetMatch = roles.find(
        (r) =>
          r.id === targetRoleOverride ||
          r.name.toLowerCase() === targetRoleOverride.toLowerCase() ||
          r.baseRole === targetRoleOverride.toLowerCase()
      );
      if (targetMatch) return targetMatch.permissions;
    }

    if (!user) return DEFAULT_ROLES[3].permissions;

    // 2. If user is admin and not assigned a specific custom role, grant full permissions
    if (user.role === 'admin' && !user.customRoleId) return ADMIN_PERMISSIONS;

    // 3. Check customRoleId first
    if (user.customRoleId) {
      const customMatch = roles.find((r) => r.id === user.customRoleId);
      if (customMatch) return customMatch.permissions;
    }

    // 4. Match by role name or baseRole
    const normalizedRole = (user.role || '').toLowerCase();
    const matched = roles.find(
      (r) =>
        r.id === user.role ||
        r.name.toLowerCase() === normalizedRole ||
        r.baseRole === normalizedRole
    );

    return matched ? matched.permissions : DEFAULT_ROLES[3].permissions;
  })();

  const can = (perm: keyof RolePermissions): boolean => {
    if (targetRoleOverride) return !!permissions[perm];
    if (user?.role === 'admin' && !user.customRoleId) return true;
    return !!permissions[perm];
  };

  return {
    permissions,
    can,
    canViewRevenue: can('canViewRevenue'),
    canViewCostPrice: can('canViewCostPrice'),
    canViewCustomerContacts: can('canViewCustomerContacts'),
    canExportReports: can('canExportReports'),
    canAccessPOS: can('canAccessPOS'),
    canAccessInvoices: can('canAccessInvoices'),
    canAccessReports: can('canAccessReports'),
    canAccessInventory: can('canAccessInventory'),
    canAccessKitchenHandover: can('canAccessKitchenHandover'),
    canAccessRecipes: can('canAccessRecipes'),
    canAccessDiscounts: can('canAccessDiscounts'),
    canAccessStaff: can('canAccessStaff'),
    canAccessExpenses: can('canAccessExpenses'),
    canApplyCustomDiscount: can('canApplyCustomDiscount'),
    canVoidInvoice: can('canVoidInvoice'),
    canProcessReturns: can('canProcessReturns'),
    canStartCloseShift: can('canStartCloseShift'),
  };
}
