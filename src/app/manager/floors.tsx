import React from 'react';
import FloorsManagementScreen from '../../screens/FloorsManagementScreen';

export default function ManagerFloorsRoute() {
  return (
    <FloorsManagementScreen
      role="manager"
      backRoute="/manager/dashboard"
      tablesRoute="/manager/floor-plan"
    />
  );
}
