import React from 'react';
import SalesReturnsScreen from '../../screens/SalesReturnsScreen';

export default function ManagerReturnsRoute() {
  return <SalesReturnsScreen userRole="manager" backRoute="/manager/dashboard" />;
}
