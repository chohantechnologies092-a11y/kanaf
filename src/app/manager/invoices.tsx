import React from 'react';
import InvoicesScreen from '../../screens/InvoicesScreen';
import { useAuthStore } from '../../store/authStore';

export default function ManagerInvoicesRoute() {
  const user = useAuthStore((state) => state.user);
  return (
    <InvoicesScreen
      userRole="manager"
      targetRoleOverride={user?.role === 'admin' ? 'manager' : undefined}
      backRoute="/manager/dashboard"
    />
  );
}
