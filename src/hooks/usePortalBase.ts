import { usePathname } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Admin and manager share the same kitchen screens under different route prefixes
 * (/admin/... and /manager/...). Linking to the wrong prefix bounces the user to /login
 * because each portal has its own role guard, so screens build their links from this.
 */
export function usePortalBase(): '/admin' | '/manager' {
  const pathname = usePathname() || '';
  const role = useAuthStore((s) => s.user?.role);
  if (pathname.startsWith('/manager')) return '/manager';
  if (pathname.startsWith('/admin')) return '/admin';
  return role === 'manager' ? '/manager' : '/admin';
}
