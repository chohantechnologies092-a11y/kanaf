import React from 'react';
import TablesBlueprintScreen from '../../screens/TablesBlueprintScreen';

export default function ManagerFloorPlanRoute() {
  return (
    <TablesBlueprintScreen
      role="manager"
      backRoute="/manager/dashboard"
      posRoute="/manager/pos"
      floorsRoute="/manager/floors"
    />
  );
}
