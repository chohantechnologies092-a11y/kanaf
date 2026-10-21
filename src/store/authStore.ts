import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

export type Role = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'juicebar' | 'playland' | string | null;

export interface User {
  id: string;
  name: string;
  role: Role;
  staffId?: string;
  customRoleId?: string;
  assignedZone?: string;
  assignedZones?: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True once the saved session has been loaded from storage. */
  hasHydrated: boolean;
  login: (
    name: string,
    role: Role,
    meta?: { staffId?: string; customRoleId?: string; assignedZone?: string; assignedZones?: string[] }
  ) => void;
  updateUserZones: (assignedZone?: string, assignedZones?: string[]) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (name, role, meta) =>
        set({
          user: {
            id: meta?.staffId || Date.now().toString(),
            name,
            role,
            staffId: meta?.staffId,
            customRoleId: meta?.customRoleId,
            assignedZone: meta?.assignedZone,
            assignedZones: meta?.assignedZones,
          },
          isAuthenticated: true,
        }),
      updateUserZones: (assignedZone, assignedZones) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                assignedZone: assignedZone ?? state.user.assignedZone,
                assignedZones: assignedZones ?? state.user.assignedZones,
              }
            : null,
        })),
      logout: () => set({ user: null, isAuthenticated: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'auth-storage',
      storage: appStorage,
      // Only persist the session, not the runtime hydration flag
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => () => {
        useAuthStore.getState().setHasHydrated(true);
      },
    }
  )
);

/** Where each role lands after login. */
export const ROLE_HOME: Record<string, string> = {
  admin: '/admin/dashboard',
  Admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  Manager: '/manager/dashboard',
  waiter: '/waiter',
  Waiter: '/waiter',
  kitchen: '/kitchen/kds',
  Kitchen: '/kitchen/kds',
  juicebar: '/juicebar/kds',
  JuiceBar: '/juicebar/kds',
  Juicebar: '/juicebar/kds',
  playland: '/playland',
  Playland: '/playland',
};

export function getRoleHome(role?: Role | null, baseRole?: string | null): string {
  if (!role) return '/login';
  const r = (baseRole || role).toLowerCase().replace(/[\s_-]/g, '');
  if (r.includes('admin')) return '/admin/dashboard';
  if (r.includes('manager')) return '/manager/dashboard';
  if (r.includes('waiter') || r.includes('ordertaker')) return '/waiter';
  if (r.includes('kitchen') || r.includes('kds') || r.includes('chef') || r.includes('cook')) return '/kitchen/kds';
  if (r.includes('juice') || r.includes('bar') || r.includes('beverage')) return '/juicebar/kds';
  if (r.includes('playland') || r.includes('ride')) return '/playland';
  return ROLE_HOME[role] || (baseRole ? ROLE_HOME[baseRole] : '') || '/manager/dashboard';
}
