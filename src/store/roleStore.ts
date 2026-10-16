import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';
import { useAuthStore } from './authStore';
import { useRestaurantStore } from './restaurantStore';
import { usePathname } from 'expo-router';

function notifySync() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('sultan_role_sync_channel');
      channel.postMessage({
        type: 'ROLES_UPDATED',
        roles: useRoleStore.getState().roles,
      });
      channel.close();
    }
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { broadcastImmediately } = require('../services/syncService');
    if (typeof broadcastImmediately === 'function') {
      broadcastImmediately();
    }
  } catch {}
}

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
  canAccessExpenses: boolean; // Live Expenses
  canAccessFloorPlan: boolean; // Floor Plan & Floor Command (table layout)
  canAccessDamages: boolean; // Damage Control log
  canAccessAssets: boolean; // Assets & Capex register

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
  canAccessFloorPlan: true,
  canAccessDamages: true,
  canAccessAssets: true,
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
      canAccessFloorPlan: true,
      canAccessDamages: true,
      canAccessAssets: true,
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
      canAccessFloorPlan: true,
      canAccessDamages: false,
      canAccessAssets: false,
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
      canAccessFloorPlan: false,
      canAccessDamages: false,
      canAccessAssets: false,
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
      canAccessFloorPlan: false,
      canAccessDamages: false,
      canAccessAssets: false,
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
      canAccessFloorPlan: false,
      canAccessDamages: false,
      canAccessAssets: false,
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
      canAccessFloorPlan: false,
      canAccessDamages: false,
      canAccessAssets: false,
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
  syncFromServer: (remoteState: any) => void;
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
        notifySync();

        return id;
      },

      updateRole: (id, updates) => {
        const normId = id.toLowerCase().trim();
        set((state) => ({
          roles: state.roles.map((r) => {
            const isTarget =
              r.id === id ||
              r.id === `role-${normId}` ||
              r.name.toLowerCase() === normId;
            if (!isTarget) return r;

            return {
              ...r,
              ...updates,
              permissions: updates.permissions
                ? {
                    ...r.permissions,
                    ...updates.permissions,
                    // Safeguard: role-admin preserves canAccessStaff to avoid permanent lockout
                    ...(r.id === 'role-admin' ? { canAccessStaff: true } : {}),
                  }
                : r.permissions,
              updatedAt: Date.now(),
            };
          }),
        }));
        notifySync();
      },

      deleteRole: (id) => {
        const target = get().roles.find((r) => r.id === id);
        if (!target || target.isSystem || target.id === 'role-admin') {
          return false;
        }

        set((state) => ({
          roles: state.roles.filter((r) => r.id !== id),
        }));
        notifySync();
        return true;
      },

      togglePermission: (roleId, permissionKey) => {
        const normId = roleId.toLowerCase().trim();
        // Protect canAccessStaff for role-admin so admin never gets permanently locked out
        if ((normId === 'admin' || normId === 'role-admin') && permissionKey === 'canAccessStaff') return;

        set((state) => ({
          roles: state.roles.map((r) => {
            const isTarget =
              r.id === roleId ||
              r.id === `role-${normId}` ||
              r.name.toLowerCase() === normId;
            if (!isTarget) return r;

            const currentVal = !!r.permissions[permissionKey];
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
        notifySync();
      },

      setPermission: (roleId, permissionKey, value) => {
        const normId = roleId.toLowerCase().trim();
        if ((normId === 'admin' || normId === 'role-admin') && permissionKey === 'canAccessStaff') return;

        set((state) => ({
          roles: state.roles.map((r) => {
            const isTarget =
              r.id === roleId ||
              r.id === `role-${normId}` ||
              r.name.toLowerCase() === normId;
            if (!isTarget) return r;

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
        notifySync();
      },

      getRoleById: (id) => {
        return get().roles.find((r) => r.id === id);
      },

      getEffectivePermissions: (roleIdentifier) => {
        if (!roleIdentifier) return DEFAULT_ROLES[3].permissions;

        const normalized = roleIdentifier.toLowerCase().trim();
        const found = get().roles.find(
          (r) =>
            r.id === roleIdentifier ||
            r.id === `role-${normalized}` ||
            r.name.toLowerCase() === normalized ||
            r.baseRole === normalized
        );

        if (found) return found.permissions;
        if (normalized === 'admin' || roleIdentifier === 'role-admin') {
          const adminRole = get().roles.find((r) => r.id === 'role-admin');
          return adminRole ? adminRole.permissions : ADMIN_PERMISSIONS;
        }

        return DEFAULT_ROLES[3].permissions;
      },

      resetToDefaultRoles: () => {
        set({ roles: DEFAULT_ROLES });
        notifySync();
      },

      syncFromServer: (remoteState: any) => {
        if (!remoteState || typeof remoteState !== 'object') return;
        const incoming = remoteState.roles;
        if (!Array.isArray(incoming) || incoming.length === 0) return;

        set((current) => {
          try {
            if (JSON.stringify(current.roles) === JSON.stringify(incoming)) {
              return current;
            }
          } catch {}
          return { roles: incoming };
        });
      },
    }),
    {
      name: 'sultan-roles-permissions-store',
      storage: appStorage,
      version: 2,
      // v2: added canAccessFloorPlan / canAccessDamages / canAccessAssets.
      // Fill any missing keys on saved roles from the matching system default.
      migrate: (persistedState: any) => {
        const state = persistedState || {};
        const savedRoles: CustomRole[] = Array.isArray(state.roles) ? state.roles : DEFAULT_ROLES;
        const roles = savedRoles.map((r) => {
          const sysDefault =
            r.id === 'role-admin'
              ? { permissions: ADMIN_PERMISSIONS }
              : DEFAULT_ROLES.find((d) => d.id === r.id) ||
                DEFAULT_ROLES.find((d) => d.baseRole === r.baseRole && d.isSystem);
          const fallback: Partial<RolePermissions> = sysDefault
            ? sysDefault.permissions
            : { canAccessFloorPlan: false, canAccessDamages: false, canAccessAssets: false };
          return { ...r, permissions: { ...fallback, ...r.permissions } as RolePermissions };
        });
        return { ...state, roles };
      },
    }
  )
);

// Cross-tab synchronization on web browsers (so manager tab updates immediately when admin tab toggles permissions)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    if (typeof (window as any).BroadcastChannel !== 'undefined') {
      const roleChannel = new BroadcastChannel('sultan_role_sync_channel');
      roleChannel.onmessage = (event) => {
        if (event.data?.type === 'ROLES_UPDATED' && Array.isArray(event.data?.roles)) {
          const incoming = event.data.roles;
          const current = useRoleStore.getState().roles;
          try {
            if (JSON.stringify(current) !== JSON.stringify(incoming)) {
              useRoleStore.setState({ roles: incoming });
            }
          } catch {
            useRoleStore.setState({ roles: incoming });
          }
        }
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'sultan-roles-permissions-store' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const incoming = parsed?.state?.roles;
          if (Array.isArray(incoming) && incoming.length > 0) {
            const current = useRoleStore.getState().roles;
            if (JSON.stringify(current) !== JSON.stringify(incoming)) {
              useRoleStore.setState({ roles: incoming });
            }
          }
        } catch {}
      }
    });
  } catch {}
}

/**
 * Hook to retrieve effective permissions of currently logged-in user,
 * or inspect permissions of a specific role context (e.g. 'manager' when viewing manager screens).
 */
export function useRolePermissions(targetRoleOverride?: string) {
  const user = useAuthStore((s) => s.user);
  const roles = useRoleStore((s) => s.roles);
  const staff = useRestaurantStore((s) => s.staff);

  // Safely detect active route path across Web & Native
  let currentPath = '';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    currentPath = usePathname() || '';
  } catch {
    currentPath = '';
  }
  if (!currentPath && typeof window !== 'undefined') {
    currentPath = (window.location?.pathname || '') + (window.location?.hash || '');
  }

  // 1. Dynamically resolve active employee's assigned role if staffId exists
  const activeStaff = user?.staffId ? staff.find((s) => s.id === user.staffId) : null;
  const effectiveCustomRoleId = activeStaff?.customRoleId || user?.customRoleId;
  const effectiveRole = (activeStaff?.role || user?.role || '').toLowerCase();

  // Target override: only when explicitly requested (e.g. admin previewing manager policy)
  const resolvedTargetOverride = (() => {
    if (targetRoleOverride) {
      if (effectiveRole && effectiveRole !== 'admin' && targetRoleOverride.toLowerCase() === 'manager') {
        return undefined;
      }
      return targetRoleOverride;
    }
    return undefined;
  })();

  const resolvedRole = (() => {
    // A. Explicit targetRoleOverride (e.g. on /manager preview)
    if (resolvedTargetOverride) {
      const overrideNorm = resolvedTargetOverride.toLowerCase().trim();
      const targetMatch = roles.find(
        (r) =>
          r.id === resolvedTargetOverride ||
          r.id === `role-${overrideNorm}` ||
          r.name.toLowerCase() === overrideNorm ||
          r.baseRole === overrideNorm
      );
      if (targetMatch) return targetMatch;
      if (overrideNorm === 'manager') {
        const liveManager = roles.find((r) => r.id === 'role-manager' || r.baseRole === 'manager');
        return liveManager || DEFAULT_ROLES[1];
      }
    }

    if (!user) return DEFAULT_ROLES[3];

    // B. Check customRoleId first (assigned custom role)
    if (effectiveCustomRoleId) {
      const customMatch = roles.find((r) => r.id === effectiveCustomRoleId);
      if (customMatch) return customMatch;
    }

    // C. Match by role name or baseRole
    const matched = roles.find(
      (r) =>
        r.id === user.role ||
        r.id === `role-${effectiveRole}` ||
        r.name.toLowerCase() === effectiveRole ||
        r.baseRole === effectiveRole
    );
    if (matched) return matched;

    // D. If role is admin, use role-admin from store
    if (effectiveRole === 'admin') {
      const adminRole = roles.find((r) => r.id === 'role-admin');
      if (adminRole) return adminRole;
    }

    return DEFAULT_ROLES[3];
  })();

  // Fill in any permission keys missing from older persisted roles using the
  // matching system default (so newly added permissions don't silently become `false`).
  const baseDefaults: RolePermissions = (() => {
    if (!resolvedRole) return DEFAULT_ROLES[3].permissions;
    if (resolvedRole.id === 'role-admin') return ADMIN_PERMISSIONS;
    const sysDefault =
      DEFAULT_ROLES.find((r) => r.id === resolvedRole.id) ||
      DEFAULT_ROLES.find((r) => r.baseRole === resolvedRole.baseRole && r.isSystem);
    return sysDefault ? sysDefault.permissions : DEFAULT_ROLES[3].permissions;
  })();
  const permissions: RolePermissions = {
    ...baseDefaults,
    ...(resolvedRole?.permissions || {}),
  };

  // Hierarchy: every non-admin role (incl. Manager) works UNDER the Admin role.
  // A role can never hold a permission that the Admin role itself does not have.
  const adminRolePerms: RolePermissions = {
    ...ADMIN_PERMISSIONS,
    ...(roles.find((r) => r.id === 'role-admin')?.permissions || {}),
  };
  const isEvaluatingAdminRole = resolvedRole?.id === 'role-admin';

  const can = (perm: keyof RolePermissions): boolean => {
    // If Admin is logged in and no specific target role is being inspected, Admin has full rights
    if (!resolvedTargetOverride && (effectiveRole === 'admin' || user?.role === 'admin')) {
      return true;
    }
    // Root safety: Admin can ALWAYS access Staff & Roles so they can never lock themselves out
    if (perm === 'canAccessStaff' && (effectiveRole === 'admin' || user?.role === 'admin')) {
      return true;
    }
    if (isEvaluatingAdminRole) return !!permissions[perm];
    return !!permissions[perm] && !!adminRolePerms[perm];
  };

  return {
    permissions,
    can,
    roleName: resolvedRole?.name || user?.role || 'Staff',
    roleBadgeColor: resolvedRole?.badgeColor || '#701A26',
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
    canAccessFloorPlan: can('canAccessFloorPlan'),
    canAccessDamages: can('canAccessDamages'),
    canAccessAssets: can('canAccessAssets'),
    canApplyCustomDiscount: can('canApplyCustomDiscount'),
    canVoidInvoice: can('canVoidInvoice'),
    canProcessReturns: can('canProcessReturns'),
    canStartCloseShift: can('canStartCloseShift'),
    canModifyMenuPrices: can('canModifyMenuPrices'),
  };
}
