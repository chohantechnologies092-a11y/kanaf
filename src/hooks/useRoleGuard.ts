import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore, Role } from '../store';
import { useRoleStore } from '../store/roleStore';

/**
 * Protects a role section. Waits for the saved session to load,
 * then redirects to /login if the user is not allowed here.
 */
export function useRoleGuard(allowed: Exclude<Role, null>[]) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const logoutStore = useAuthStore((s) => s.logout);
  const allRoles = useRoleStore((s) => s.roles);

  const isAllowed = useMemo(() => {
    if (!isAuthenticated || !user?.role) return false;
    const cleanUserRole = user.role.toLowerCase().replace(/[\s_-]/g, '');

    // Executive Admin has unrestricted universal access
    if (cleanUserRole === 'admin') return true;

    // Check custom role baseRole
    const matchedCustomRole = allRoles.find(
      (r) =>
        r.id === user.customRoleId ||
        r.id === user.role ||
        r.name.toLowerCase() === user.role?.toLowerCase()
    );
    const baseRole = matchedCustomRole ? matchedCustomRole.baseRole.toLowerCase() : cleanUserRole;

    const cleanAllowed = allowed.map((a) => (a || '').toLowerCase().replace(/[\s_-]/g, ''));
    return (
      cleanAllowed.includes(cleanUserRole) ||
      cleanAllowed.includes(baseRole) ||
      (cleanAllowed.includes('juicebar') && (cleanUserRole.includes('juice') || baseRole.includes('juice'))) ||
      (cleanAllowed.includes('kitchen') && (cleanUserRole.includes('kitchen') || baseRole.includes('kitchen')))
    );
  }, [isAuthenticated, user?.role, user?.customRoleId, allowed, allRoles]);

  useEffect(() => {
    if (hasHydrated && !isAllowed) {
      router.replace('/login');
    }
  }, [hasHydrated, isAllowed, router]);

  const logout = () => {
    logoutStore();
    router.replace('/');
  };

  return { ready: hasHydrated && isAllowed, user, logout };
}
