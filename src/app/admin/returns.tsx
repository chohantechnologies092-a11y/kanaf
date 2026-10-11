import React from 'react';
import SalesReturnsScreen from '../../screens/SalesReturnsScreen';

export default function AdminReturnsRoute() {
  return <SalesReturnsScreen userRole="admin" backRoute="/admin/dashboard" />;
}
