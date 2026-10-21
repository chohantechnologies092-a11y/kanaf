import React from 'react';
import POSTerminalScreen from '../../screens/POSTerminalScreen';

export default function AdminPOS() {
  return (
    <POSTerminalScreen
      role="admin"
      backRoute="/admin/dashboard"
      shiftRoute="/admin/shift"
    />
  );
}
