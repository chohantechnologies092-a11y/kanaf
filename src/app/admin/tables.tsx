import React from 'react';
import TablesBlueprintScreen from '../../screens/TablesBlueprintScreen';

export default function AdminTablesRoute() {
  return (
    <TablesBlueprintScreen
      role="admin"
      backRoute="/admin/dashboard"
      posRoute="/admin/pos"
      floorsRoute="/admin/floors"
    />
  );
}
