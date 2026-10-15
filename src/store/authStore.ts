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
export const ROLE_HOME: Record<Exclude<Role, null>, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  waiter: '/waiter',
  kitchen: '/kitchen/kds',
  juicebar: '/juicebar/kds',
  playland: '/playland',
};
