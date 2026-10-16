import React from 'react';
import FloorsManagementScreen from '../../screens/FloorsManagementScreen';

export default function AdminFloorsRoute() {
  return (
    <FloorsManagementScreen
      role="admin"
      backRoute="/admin/dashboard"
      tablesRoute="/admin/tables"
    />
  );
}
