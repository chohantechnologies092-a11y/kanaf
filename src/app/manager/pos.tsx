import React from 'react';
import POSTerminalScreen from '../../screens/POSTerminalScreen';

export default function ManagerPOS() {
  return (
    <POSTerminalScreen
      role="manager"
      backRoute="/manager/dashboard"
      shiftRoute="/manager/shift"
    />
  );
}
