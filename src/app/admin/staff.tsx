import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useRestaurantStore,
  StaffMember,
  StaffRole,
  StaffShift,
  StaffStatus,
} from '../../store/restaurantStore';
import { 
  useRoleStore, 
  CustomRole, 
  RolePermissions, 
  BaseRoleType,
  ADMIN_PERMISSIONS,
  DEFAULT_ROLES,
} from '../../store/roleStore';
import { sortFloors } from '../../constants/floors';
import { broadcastImmediately } from '../../services/syncService';

const SHIFTS: StaffShift[] = ['Morning', 'Evening', 'Night'];
const STATUSES: StaffStatus[] = ['Active', 'On Leave', 'Inactive'];

export const formatRoleName = (role: StaffRole | string) => {
  if (role === 'Waiter') return 'Order Taker';
  return role;
};

const BRAND = {
  burgundy: '#52171B',
  burgundyLight: '#6B1F24',
  gold: '#B48214',
  goldLight: '#FEF3C7',
  ink: '#1A1A1A',
  muted: '#64748B',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  cardBg: '#FFFFFF',
  success: '#10B981',
  successLight: '#ECFDF5',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
};

const ROLE_COLORS = [
  '#52171B', // Burgundy
  '#B48214', // Gold
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Emerald
  '#DC2626', // Red
  '#D97706', // Amber
  '#475569', // Slate
];

export default function StaffManagementScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const staff = useRestaurantStore((state) => state.staff) || [];
  const tables = useRestaurantStore((state) => state.tables) || [];
  const zones = useRestaurantStore((state) => state.zones) || [];
  const addStaff = useRestaurantStore((state) => state.addStaff);
  const updateStaff = useRestaurantStore((state) => state.updateStaff);
  const deleteStaff = useRestaurantStore((state) => state.deleteStaff);

  const {
    roles,
    addRole,
    updateRole,
    deleteRole,
    togglePermission,
    setPermission,
  } = useRoleStore();

  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');

  const availableFloors = sortFloors(
    Array.from(
      new Set([
        ...zones,
        ...tables.map((t) => t.zone),
        'Ground Floor',
        '1st Floor',
        '2nd Floor',
        '3rd Floor',
        'Rooftop',
      ].filter(Boolean))
    )
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('All');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Staff Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Staff Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<string>('Order Taker');
  const [formCustomRoleId, setFormCustomRoleId] = useState<string>('role-waiter');
  const [formShift, setFormShift] = useState<StaffShift>('Morning');
  const [formStatus, setFormStatus] = useState<StaffStatus>('Active');
  const [formPin, setFormPin] = useState('');
  const [formAssignedZones, setFormAssignedZones] = useState<string[]>(['Ground Floor']);
  const [formError, setFormError] = useState('');

  // Role Modal & Form State
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormUrdu, setRoleFormUrdu] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormColor, setRoleFormColor] = useState('#B48214');
  const [roleFormBase, setRoleFormBase] = useState<BaseRoleType>('manager');
  const [roleFormPermissions, setRoleFormPermissions] = useState<RolePermissions>({
    canViewRevenue: false, // Default to hidden revenue for custom roles!
    canViewCostPrice: false,
    canViewCustomerContacts: false,
    canExportReports: false,
    canAccessPOS: true,
    canAccessInvoices: true,
    canAccessReports: false,
    canAccessInventory: false,
    canAccessKitchenHandover: false,
    canAccessRecipes: false,
    canAccessDiscounts: false,
    canAccessStaff: false,
    canAccessExpenses: false,
    canAccessFloorPlan: false,
    canAccessDamages: false,
    canAccessAssets: false,
    canApplyCustomDiscount: false,
    canVoidInvoice: false,
    canProcessReturns: false,
    canStartCloseShift: true,
    canModifyMenuPrices: false,
  });
  const [roleFormError, setRoleFormError] = useState('');

  // Stats
  const totalStaff = staff.length;
  const activeCount = staff.filter((s) => s.status === 'Active').length;
  const onLeaveCount = staff.filter((s) => s.status === 'On Leave').length;
  const waiterCount = staff.filter((s) => s.role === 'Waiter' || s.role === 'Order Taker').length;
  const kitchenCount = staff.filter((s) => s.role === 'Kitchen').length;
  const juiceBarCount = staff.filter((s) => s.role === 'JuiceBar').length;

  // Role list for filters & selection
  const allRoleNames = Array.from(new Set(['All', ...roles.map((r) => r.name).filter(Boolean)]));

  // Filtered Staff List
  const filteredStaff = staff.filter((s) => {
    const matchesRole =
      activeRoleFilter === 'All' ||
      s.role.toLowerCase() === activeRoleFilter.toLowerCase() ||
      (activeRoleFilter === 'Order Taker' && s.role === 'Waiter');
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      s.name.toLowerCase().includes(query) ||
      (s.phone && s.phone.toLowerCase().includes(query)) ||
      s.role.toLowerCase().includes(query) ||
      (s.role === 'Waiter' && 'order taker'.includes(query)) ||
      s.shift.toLowerCase().includes(query) ||
      (s.assignedZone && s.assignedZone.toLowerCase().includes(query)) ||
      (s.assignedZones && s.assignedZones.some((z) => z.toLowerCase().includes(query)));
    return matchesRole && matchesSearch;
  });

  const getRoleColor = (roleStr: string) => {
    const matched = roles.find(
      (r) =>
        r.name.toLowerCase() === (roleStr || '').toLowerCase() ||
        r.id === roleStr ||
        (roleStr === 'Waiter' && r.name === 'Order Taker')
    );
    if (matched && matched.badgeColor) return matched.badgeColor;
    switch (roleStr) {
      case 'Manager':
        return '#B48214';
      case 'Waiter':
      case 'Order Taker':
        return '#2563EB';
      case 'Kitchen':
        return '#DC2626';
      case 'JuiceBar':
        return '#059669';
      case 'Admin':
        return '#52171B';
      default:
        return '#64748B';
    }
  };

  const getShiftIcon = (shift: StaffShift) => {
    switch (shift) {
      case 'Morning':
        return 'sunny-outline';
      case 'Evening':
        return 'partly-sunny-outline';
      case 'Night':
        return 'moon-outline';
      default:
        return 'time-outline';
    }
  };

  const togglePinReveal = (id: string) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Staff Modal Actions
  const openAddModal = () => {
    setEditingStaff(null);
    setFormName('');
    setFormPhone('');
    const defaultR = roles.find((r) => r.name === 'Order Taker') || roles[0];
    setFormRole(defaultR.name);
    setFormCustomRoleId(defaultR.id);
    setFormShift('Morning');
    setFormStatus('Active');
    setFormPin(Math.floor(1000 + Math.random() * 9000).toString());
    setFormAssignedZones(['Ground Floor']);
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setFormName(member.name);
    setFormPhone(member.phone || '');
    setFormRole(member.role);
    const matchedR = roles.find(
      (r) =>
        r.id === member.customRoleId ||
        r.name.toLowerCase() === member.role.toLowerCase() ||
        (member.role === 'Waiter' && r.name === 'Order Taker')
    );
    setFormCustomRoleId(matchedR ? matchedR.id : member.customRoleId || 'role-waiter');
    setFormShift(member.shift);
    setFormStatus(member.status);
    setFormPin(member.pin);
    const initialZones =
      member.assignedZones && member.assignedZones.length > 0
        ? member.assignedZones
        : member.assignedZone
        ? [member.assignedZone]
        : ['All Floors'];
    setFormAssignedZones(initialZones);
    setFormError('');
    setModalVisible(true);
  };

  const handleSaveStaff = () => {
    if (!formName.trim()) {
      setFormError('Please enter an employee name');
      return;
    }
    if (!formPin.trim() || formPin.trim().length < 4) {
      setFormError('PIN must be at least 4 digits');
      return;
    }

    const primaryZone = formAssignedZones.includes('All Floors')
      ? 'All Floors'
      : formAssignedZones[0] || 'All Floors';

    const staffPayload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      role: formRole,
      customRoleId: formCustomRoleId,
      shift: formShift,
      status: formStatus,
      pin: formPin.trim(),
      assignedZone: formRole === 'Waiter' || formRole === 'Order Taker' ? primaryZone : undefined,
      assignedZones: formRole === 'Waiter' || formRole === 'Order Taker' ? formAssignedZones : undefined,
    };

    if (editingStaff) {
      updateStaff(editingStaff.id, staffPayload);
    } else {
      addStaff({
        ...staffPayload,
        joinedDate: new Date().toISOString().split('T')[0],
      });
    }

    setModalVisible(false);
  };

  const handleDeleteStaff = (member: StaffMember) => {
    const confirmMessage = `Are you sure you want to remove "${member.name}" (${member.role})?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(confirmMessage)) {
        deleteStaff(member.id);
      }
    } else {
      Alert.alert('Remove Employee', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteStaff(member.id) },
      ]);
    }
  };

  // Role Modal Actions
  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormUrdu('');
    setRoleFormDesc('');
    setRoleFormColor('#B48214');
    setRoleFormBase('manager');
    setRoleFormPermissions({
      canViewRevenue: false, // Default to hidden revenue for custom roles!
      canViewCostPrice: false,
      canViewCustomerContacts: false,
      canExportReports: false,
      canAccessPOS: true,
      canAccessInvoices: true,
      canAccessReports: false,
      canAccessInventory: false,
      canAccessKitchenHandover: false,
      canAccessRecipes: false,
      canAccessDiscounts: false,
      canAccessStaff: false,
      canAccessExpenses: false,
      canAccessFloorPlan: false,
      canAccessDamages: false,
      canAccessAssets: false,
      canApplyCustomDiscount: false,
      canVoidInvoice: false,
      canProcessReturns: false,
      canStartCloseShift: true,
      canModifyMenuPrices: false,
    });
    setRoleFormError('');
    setRoleModalVisible(true);
  };

  const openEditRoleModal = (roleItem: CustomRole) => {
    setEditingRole(roleItem);
    setRoleFormName(roleItem.name);
    setRoleFormUrdu(roleItem.urduName || '');
    setRoleFormDesc(roleItem.description || '');
    setRoleFormColor(roleItem.badgeColor || '#B48214');
    setRoleFormBase(roleItem.baseRole || 'manager');
    const baseDefaults = roleItem.id === 'role-admin' ? ADMIN_PERMISSIONS : DEFAULT_ROLES[1].permissions;
    setRoleFormPermissions({
      ...baseDefaults,
      ...roleItem.permissions,
    });
    setRoleFormError('');
    setRoleModalVisible(true);
  };

  const handleSaveRole = () => {
    if (!roleFormName.trim()) {
      setRoleFormError('Please enter a role title (e.g. Senior Cashier)');
      return;
    }

    if (editingRole) {
      updateRole(editingRole.id, {
        name: roleFormName.trim(),
        urduName: roleFormUrdu.trim(),
        description: roleFormDesc.trim(),
        badgeColor: roleFormColor,
        baseRole: roleFormBase,
        permissions: roleFormPermissions,
      });
      broadcastImmediately();
      const msg = `Role "${roleFormName}" permissions updated!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Role Updated', msg);
    } else {
      addRole({
        name: roleFormName.trim(),
        urduName: roleFormUrdu.trim(),
        description: roleFormDesc.trim(),
        badgeColor: roleFormColor,
        icon: 'person',
        baseRole: roleFormBase,
        permissions: roleFormPermissions,
      });
      broadcastImmediately();
      const msg = `New role "${roleFormName}" created successfully!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Role Created', msg);
    }

    setRoleModalVisible(false);
  };

  const handleDeleteRole = (roleItem: CustomRole) => {
    if (roleItem.isSystem || roleItem.id === 'role-admin') {
      const msg = 'System core roles (Admin, Manager, Order Taker, Kitchen) cannot be deleted.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Cannot Delete', msg);
      return;
    }

    const assignedCount = staff.filter(
      (s) =>
        s.role.toLowerCase() === roleItem.name.toLowerCase() || s.customRoleId === roleItem.id
    ).length;
    if (assignedCount > 0) {
      const msg = `Cannot delete role "${roleItem.name}" because ${assignedCount} active employee(s) are currently assigned to it. Please reassign them first.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Staff Assigned', msg);
      return;
    }

    const confirmMsg = `Are you sure you want to delete custom role "${roleItem.name}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        deleteRole(roleItem.id);
      }
    } else {
      Alert.alert('Confirm Delete', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRole(roleItem.id) },
      ]);
    }
  };

  const toggleRolePermissionInForm = (key: keyof RolePermissions) => {
    setRoleFormPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/dashboard'))}
          >
            <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>Staff & Roles</Text>
            {Boolean(!isMobile) && (
              <Text style={styles.headerSubtitle}>
                Manage staff credentials, custom roles, revenue visibility & permissions
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {activeTab === 'roles' ? (
            <TouchableOpacity style={styles.addButton} onPress={openAddRoleModal}>
              <Ionicons name="add-circle" size={17} color="#fff" />
              <Text style={styles.addButtonText}>Create New Role</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Ionicons name="person-add" size={17} color="#fff" />
              <Text style={styles.addButtonText}>{isMobile ? 'Add' : 'Add Employee'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Top Segmented Sub-Tab Switcher */}
      <View style={styles.viewTabContainer}>
        <TouchableOpacity
          style={[styles.viewTabBtn, activeTab === 'staff' && styles.viewTabBtnActive]}
          onPress={() => setActiveTab('staff')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'staff' ? BRAND.burgundy : BRAND.muted}
          />
          <Text style={[styles.viewTabText, activeTab === 'staff' && styles.viewTabTextActive]}>
            Staff Directory ({totalStaff})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewTabBtn, activeTab === 'roles' && styles.viewTabBtnActive]}
          onPress={() => setActiveTab('roles')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={activeTab === 'roles' ? BRAND.burgundy : BRAND.muted}
          />
          <Text style={[styles.viewTabText, activeTab === 'roles' && styles.viewTabTextActive]}>
            Roles & Permissions Matrix ({roles.length})
          </Text>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>ACCESS</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.content, isMobile && { padding: 14 }]} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* TAB 1: STAFF DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === 'staff' && (
          <>
            {/* KPI Summary Cards */}
            <View style={styles.kpiContainer}>
              <View style={[styles.kpiCard, isMobile && styles.kpiCardMobile]}>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#EBF3FF' }]}>
                  <Ionicons name="people" size={20} color="#007AFF" />
                </View>
                <View>
                  <Text style={styles.kpiValue}>{totalStaff}</Text>
                  <Text style={styles.kpiLabel}>Total Staff</Text>
                </View>
              </View>

              <View style={[styles.kpiCard, isMobile && styles.kpiCardMobile]}>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#E8F9EE' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                </View>
                <View>
                  <Text style={styles.kpiValue}>{activeCount}</Text>
                  <Text style={styles.kpiLabel}>Active Duty</Text>
                </View>
              </View>

              <View style={[styles.kpiCard, isMobile && styles.kpiCardMobile]}>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#FFF4E5' }]}>
                  <Ionicons name="time" size={20} color="#FF9500" />
                </View>
                <View>
                  <Text style={styles.kpiValue}>{onLeaveCount}</Text>
                  <Text style={styles.kpiLabel}>On Leave</Text>
                </View>
              </View>

              <View style={[styles.kpiCard, isMobile && styles.kpiCardMobile]}>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#F4EFFE' }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#5856D6" />
                </View>
                <View>
                  <Text style={styles.kpiValue}>{roles.length} Roles</Text>
                  <Text style={styles.kpiLabel}>Configured Roles</Text>
                </View>
              </View>
            </View>

            {/* Search & Filters */}
            <View style={styles.filterSection}>
              <View style={styles.searchBar}>
                <View style={styles.searchIconOrb}>
                  <Ionicons name="search" size={15} color={BRAND.burgundy} />
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search employee name, role, floor, phone..."
                  placeholderTextColor="#8A7A70"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery.length > 0) ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.searchClearBtn}>
                    <Ionicons name="close-circle" size={18} color={BRAND.gold} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.searchShortcutBadge}>
                    <Ionicons name="sparkles" size={10} color="#B45309" style={{ marginRight: 3 }} />
                    <Text style={styles.searchShortcutText}>STAFF</Text>
                  </View>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleTabs}>
                {allRoleNames.filter(Boolean).map((rName) => (
                  <TouchableOpacity
                    key={rName}
                    style={[styles.roleTab, activeRoleFilter === rName && styles.roleTabActive]}
                    onPress={() => setActiveRoleFilter(rName)}
                  >
                    <Text
                      style={[
                        styles.roleTabText,
                        activeRoleFilter === rName && styles.roleTabTextActive,
                      ]}
                    >
                      {formatRoleName(rName)}{' '}
                      {rName === 'All'
                        ? `(${totalStaff})`
                        : `(${staff.filter((s) => s.role && s.role.toLowerCase() === rName.toLowerCase()).length})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Staff Presentation: Mobile Cards vs Desktop Table */}
            {isMobile ? (
              <View style={styles.mobileListContainer}>
                {filteredStaff.map((member) => {
                  const isPinRevealed = !!revealedPins[member.id];
                  const color = getRoleColor(member.role);
                  return (
                    <View key={member.id} style={styles.mobileCard}>
                      <View style={styles.mobileCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[styles.avatarBox, { backgroundColor: color + '18' }]}>
                            <Text style={[styles.avatarText, { color: color }]}>
                              {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.staffName}>{member.name || 'Staff'}</Text>
                            <Text style={styles.staffPhone}>{member.phone || 'No phone'}</Text>
                          </View>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: color + '15' }]}>
                          <Text style={[styles.roleBadgeText, { color: color }]}>
                            {formatRoleName(member.role)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.mobileCardDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Assigned Floor:</Text>
                          <Text style={styles.detailValue}>
                            {member.assignedZones && member.assignedZones.length > 0
                              ? member.assignedZones.join(', ')
                              : member.assignedZone || 'All Floors'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Shift:</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name={getShiftIcon(member.shift)} size={14} color="#666" />
                            <Text style={styles.detailValue}>{member.shift}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Status:</Text>
                          <Text
                            style={[
                              styles.detailValue,
                              { color: member.status === 'Active' ? '#34C759' : '#FF9500' },
                            ]}
                          >
                            {member.status}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Secret PIN:</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.pinCodeText}>
                              {isPinRevealed ? member.pin : '••••'}
                            </Text>
                            <TouchableOpacity onPress={() => togglePinReveal(member.id)}>
                              <Ionicons
                                name={isPinRevealed ? 'eye-off-outline' : 'eye-outline'}
                                size={16}
                                color="#007AFF"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      <View style={styles.mobileCardActions}>
                        <TouchableOpacity
                          style={styles.mobileActionBtn}
                          onPress={() => openEditModal(member)}
                        >
                          <Ionicons name="create-outline" size={17} color="#007AFF" />
                          <Text style={[styles.mobileActionText, { color: '#007AFF' }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.mobileActionBtn}
                          onPress={() => handleDeleteStaff(member)}
                        >
                          <Ionicons name="trash-outline" size={17} color="#FF3B30" />
                          <Text style={[styles.mobileActionText, { color: '#FF3B30' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              /* Desktop Table View */
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, { flex: 2.2 }]}>EMPLOYEE</Text>
                  <Text style={[styles.thText, { flex: 1.6 }]}>ROLE</Text>
                  <Text style={[styles.thText, { flex: 2.2 }]}>ASSIGNED FLOOR / ZONE</Text>
                  <Text style={[styles.thText, { flex: 1.1 }]}>SHIFT</Text>
                  <Text style={[styles.thText, { flex: 1.2 }]}>STATUS</Text>
                  <Text style={[styles.thText, { flex: 1.4 }]}>4-DIGIT PIN</Text>
                  <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {filteredStaff.map((member) => {
                  const isPinRevealed = !!revealedPins[member.id];
                  const color = getRoleColor(member.role);
                  return (
                    <View key={member.id} style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={[styles.avatarBox, { backgroundColor: color + '18' }]}>
                          <Text style={[styles.avatarText, { color: color }]}>
                            {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.staffName}>{member.name || 'Staff'}</Text>
                          <Text style={styles.staffPhone}>{member.phone || 'No phone'}</Text>
                        </View>
                      </View>

                      <View style={[styles.tableCell, { flex: 1.6 }]}>
                        <View style={[styles.roleBadge, { backgroundColor: color + '15' }]}>
                          <Text style={[styles.roleBadgeText, { color: color }]}>
                            {formatRoleName(member.role)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tableCell, { flex: 2.2 }]}>
                        <Text style={styles.zoneText}>
                          {member.assignedZones && member.assignedZones.length > 0
                            ? member.assignedZones.join(', ')
                            : member.assignedZone || 'All Floors'}
                        </Text>
                      </View>

                      <View style={[styles.tableCell, { flex: 1.1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        <Ionicons name={getShiftIcon(member.shift)} size={16} color="#666" />
                        <Text style={styles.shiftText}>{member.shift}</Text>
                      </View>

                      <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', alignItems: 'center' }]}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: member.status === 'Active' ? '#34C759' : '#FF9500' },
                          ]}
                        />
                        <Text style={styles.statusText}>{member.status}</Text>
                      </View>

                      <View style={[styles.tableCell, { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                        <Text style={styles.pinCodeText}>{isPinRevealed ? member.pin : '••••'}</Text>
                        <TouchableOpacity onPress={() => togglePinReveal(member.id)}>
                          <Ionicons
                            name={isPinRevealed ? 'eye-off-outline' : 'eye-outline'}
                            size={17}
                            color="#007AFF"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }]}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(member)}>
                          <Ionicons name="create-outline" size={19} color="#007AFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteStaff(member)}>
                          <Ionicons name="trash-outline" size={19} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {Boolean(filteredStaff.length === 0) && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={42} color="#C7C7CC" />
                    <Text style={styles.emptyTitle}>No staff members found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your search query or role filter.</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
        {/* ========================================================================= */}
        {activeTab === 'roles' && (
          <View style={styles.rolesTabWrapper}>
            {/* Informational Guidance Banner */}
            <View style={styles.roleInfoBanner}>
              <View style={styles.roleInfoIcon}>
                <Ionicons name="shield-checkmark" size={24} color={BRAND.burgundy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleInfoTitle}>
                  Granular Role Creation & Sensitive Revenue Visibility
                </Text>
                <Text style={styles.roleInfoDesc}>
                  Define exactly what each role can access and see. For instance, you can create a custom
                  role (e.g. Senior Cashier or Floor Supervisor) and choose whether they can view daily
                  sales revenue numbers, raw food costs, customer contacts, or perform blind shift closing.
                </Text>
              </View>
            </View>

            {/* Roles Cards Grid */}
            <View style={styles.rolesGrid}>
              {roles.map((roleItem) => {
                const assignedStaffCount = staff.filter(
                  (s) =>
                    s.role.toLowerCase() === roleItem.name.toLowerCase() ||
                    s.customRoleId === roleItem.id ||
                    (roleItem.name === 'Order Taker' && s.role === 'Waiter')
                ).length;

                const isSystemAdmin = roleItem.id === 'role-admin';

                return (
                  <View key={roleItem.id} style={styles.roleMatrixCard}>
                    {/* Role Card Header */}
                    <View style={styles.roleMatrixHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.roleMatrixIconBox, { backgroundColor: roleItem.badgeColor + '18' }]}>
                          <Ionicons
                            name={(roleItem.icon || 'shield') as any}
                            size={20}
                            color={roleItem.badgeColor}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.roleMatrixTitle}>{roleItem.name || 'Role'}</Text>
                            {Boolean(roleItem.isSystem) && (
                              <View style={styles.systemTag}>
                                <Text style={styles.systemTagText}>SYSTEM</Text>
                              </View>
                            )}
                          </View>
                          {Boolean(typeof roleItem.urduName === 'string' && roleItem.urduName.trim().length > 0) && (
                            <Text style={styles.roleMatrixUrdu}>{roleItem.urduName}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.assignedBadge}>
                        <Ionicons name="people" size={12} color={BRAND.muted} />
                        <Text style={styles.assignedBadgeText}>{assignedStaffCount} Staff</Text>
                      </View>
                    </View>

                    <Text style={styles.roleMatrixDesc} numberOfLines={2}>
                      {roleItem.description || 'Custom staff role at Kanaf Cafe & Bakery.'}
                    </Text>

                    {/* Quick Access & Visibility Controls */}
                    <View style={{ gap: 8, marginVertical: 4 }}>
                      {/* 1. Invoices & Orders Quick Toggle */}
                      <View style={styles.quickRevenueRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.quickRevenueTitle}>Invoices & Orders Screen:</Text>
                          <Text style={styles.quickRevenueSub}>
                            {roleItem.permissions?.canAccessInvoices
                              ? '✓ Order history, settlements & receipts enabled'
                              : '✕ Invoices and orders strictly blocked'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.revToggleBtn,
                            roleItem.permissions?.canAccessInvoices
                              ? styles.revToggleBtnOn
                              : styles.revToggleBtnOff,
                          ]}
                          onPress={() => {
                            togglePermission(roleItem.id, 'canAccessInvoices');
                            broadcastImmediately();
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.revToggleBtnText,
                              roleItem.permissions?.canAccessInvoices
                                ? { color: '#15803D' }
                                : { color: '#B91C1C' },
                            ]}
                          >
                            {roleItem.permissions?.canAccessInvoices ? 'Allowed' : 'Blocked'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 2. Financial Reports Quick Toggle */}
                      <View style={styles.quickRevenueRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.quickRevenueTitle}>Financial & Shift Reports:</Text>
                          <Text style={styles.quickRevenueSub}>
                            {roleItem.permissions?.canAccessReports
                              ? '✓ P&L, sales charts & shift audit enabled'
                              : '✕ Financial reports & analytics blocked'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.revToggleBtn,
                            roleItem.permissions?.canAccessReports
                              ? styles.revToggleBtnOn
                              : styles.revToggleBtnOff,
                          ]}
                          onPress={() => {
                            togglePermission(roleItem.id, 'canAccessReports');
                            broadcastImmediately();
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.revToggleBtnText,
                              roleItem.permissions?.canAccessReports
                                ? { color: '#15803D' }
                                : { color: '#B91C1C' },
                            ]}
                          >
                            {roleItem.permissions?.canAccessReports ? 'Allowed' : 'Blocked'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 3. Sales Revenue Figures Visibility */}
                      <View style={styles.quickRevenueRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.quickRevenueTitle}>Show Sales Revenue Figures:</Text>
                          <Text style={styles.quickRevenueSub}>
                            {roleItem.permissions?.canViewRevenue
                              ? '✓ Shift earnings & PKR totals visible'
                              : '✕ PKR sales amounts masked as ••••••'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.revToggleBtn,
                            roleItem.permissions?.canViewRevenue
                              ? styles.revToggleBtnOn
                              : styles.revToggleBtnOff,
                          ]}
                          onPress={() => {
                            togglePermission(roleItem.id, 'canViewRevenue');
                            broadcastImmediately();
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.revToggleBtnText,
                              roleItem.permissions?.canViewRevenue
                                ? { color: '#15803D' }
                                : { color: '#B91C1C' },
                            ]}
                          >
                            {roleItem.permissions?.canViewRevenue ? 'Visible' : 'Masked'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Permission Chips Summary (Clickable Quick Toggles) */}
                    <View style={styles.permChipsWrap}>
                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canAccessInvoices ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canAccessInvoices');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Invoices: {roleItem.permissions?.canAccessInvoices ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canAccessReports ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canAccessReports');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Reports: {roleItem.permissions?.canAccessReports ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canViewRevenue ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canViewRevenue');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Revenue: {roleItem.permissions?.canViewRevenue ? 'Visible' : 'Masked'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canAccessPOS ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canAccessPOS');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          POS: {roleItem.permissions?.canAccessPOS ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canApplyCustomDiscount ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canApplyCustomDiscount');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Discounts: {roleItem.permissions?.canApplyCustomDiscount ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canVoidInvoice ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canVoidInvoice');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Void Orders: {roleItem.permissions?.canVoidInvoice ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canStartCloseShift ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canStartCloseShift');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Shift Close: {roleItem.permissions?.canStartCloseShift ? 'Allowed' : 'Off'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.permChip,
                          roleItem.permissions?.canViewCostPrice ? styles.permChipAllowed : styles.permChipDenied,
                        ]}
                        onPress={() => {
                          togglePermission(roleItem.id, 'canViewCostPrice');
                          broadcastImmediately();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.permChipText}>
                          Food Costs: {roleItem.permissions?.canViewCostPrice ? 'Visible' : 'Hidden'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Card Actions Footer */}
                    <View style={styles.roleCardActions}>
                      <TouchableOpacity
                        style={styles.configPermsBtn}
                        onPress={() => openEditRoleModal(roleItem)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="settings-outline" size={14} color={BRAND.burgundy} />
                        <Text style={styles.configPermsBtnText}>Configure All Permissions</Text>
                      </TouchableOpacity>

                      {Boolean(!roleItem.isSystem && roleItem.id !== 'role-admin') && (
                        <TouchableOpacity
                          style={styles.roleDeleteBtn}
                          onPress={() => handleDeleteRole(roleItem)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={16} color={BRAND.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT EMPLOYEE */}
      {/* ========================================================================= */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { padding: 18, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name={editingStaff ? 'create' : 'person-add'} size={20} color={BRAND.burgundy} />
                </View>
                <Text style={styles.modalTitle}>{editingStaff ? 'Edit Staff Member' : 'Add New Employee'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {Boolean(formError.trim().length > 0) && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={styles.errorAlertText}>{formError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Full Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Tariq Mehmood"
                  placeholderTextColor="#A0A0A5"
                  value={formName}
                  onChangeText={(val) => {
                    setFormName(val);
                    if (formError) setFormError('');
                  }}
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. +92 300 1234567"
                  placeholderTextColor="#A0A0A5"
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Dynamic Role Selection (Built-in + Custom Roles) */}
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.formLabel}>Assigned Role *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      setActiveTab('roles');
                      openAddRoleModal();
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND.burgundy }}>
                      + Create Custom Role
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.pillsRow}>
                  {roles.map((r) => {
                    const isSelected = formCustomRoleId === r.id || formRole.toLowerCase() === r.name.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.formPill,
                          isSelected && {
                            backgroundColor: r.badgeColor,
                            borderColor: r.badgeColor,
                          },
                        ]}
                        onPress={() => {
                          setFormRole(r.name);
                          setFormCustomRoleId(r.id);
                        }}
                      >
                        <Text style={[styles.formPillText, isSelected && styles.formPillTextActive]}>
                          {formatRoleName(r.name)}
                          {!r.permissions?.canViewRevenue ? ' 🔒' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Floor / Zone Assignment for Order Takers */}
              {Boolean(formRole === 'Waiter' || formRole === 'Order Taker') && (
                <View style={[styles.formGroup, styles.floorAssignmentBox]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="business" size={16} color="#007AFF" />
                      <Text style={styles.formLabelHighlighted}>Assigned Floor / Zone *</Text>
                    </View>
                    <View style={styles.floorAccessBadge}>
                      <Text style={styles.floorAccessBadgeText}>Order Taker Access</Text>
                    </View>
                  </View>
                  <Text style={styles.formSubLabel}>
                    This employee will ONLY see and take orders for dining tables belonging to their assigned floor.
                  </Text>

                  <View style={styles.floorChipsWrap}>
                    <TouchableOpacity
                      style={[
                        styles.floorChip,
                        formAssignedZones.includes('All Floors') && styles.floorChipActiveAll,
                      ]}
                      onPress={() => setFormAssignedZones(['All Floors'])}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={14}
                        color={formAssignedZones.includes('All Floors') ? '#fff' : '#4a121a'}
                      />
                      <Text
                        style={[
                          styles.floorChipText,
                          formAssignedZones.includes('All Floors') && styles.floorChipTextActive,
                        ]}
                      >
                        All Floors (Full Access)
                      </Text>
                    </TouchableOpacity>

                    {availableFloors.map((fl) => {
                      const isChecked = formAssignedZones.includes(fl);
                      return (
                        <TouchableOpacity
                          key={fl}
                          style={[styles.floorChip, isChecked && styles.floorChipActive]}
                          onPress={() => {
                            if (formAssignedZones.includes('All Floors')) {
                              setFormAssignedZones([fl]);
                            } else if (isChecked) {
                              const remaining = formAssignedZones.filter((z) => z !== fl);
                              setFormAssignedZones(remaining.length > 0 ? remaining : ['Ground Floor']);
                            } else {
                              setFormAssignedZones([...formAssignedZones, fl]);
                            }
                          }}
                        >
                          <Ionicons
                            name={isChecked ? 'checkmark-circle' : 'business-outline'}
                            size={14}
                            color={isChecked ? '#fff' : '#666'}
                          />
                          <Text style={[styles.floorChipText, isChecked && styles.floorChipTextActive]}>
                            {fl}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Shift Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Work Shift</Text>
                <View style={styles.pillsRow}>
                  {SHIFTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.formPill, formShift === s && styles.formPillActive]}
                      onPress={() => setFormShift(s)}
                    >
                      <Ionicons
                        name={getShiftIcon(s)}
                        size={14}
                        color={formShift === s ? '#fff' : '#666'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.formPillText, formShift === s && styles.formPillTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Employment Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status</Text>
                <View style={styles.pillsRow}>
                  {STATUSES.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.formPill, formStatus === st && styles.formPillActive]}
                      onPress={() => setFormStatus(st)}
                    >
                      <Text style={[styles.formPillText, formStatus === st && styles.formPillTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 4-Digit Secret PIN */}
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.formLabel}>4-Digit POS Login PIN *</Text>
                  <TouchableOpacity
                    onPress={() => setFormPin(Math.floor(1000 + Math.random() * 9000).toString())}
                  >
                    <Text style={{ fontSize: 11, color: '#007AFF', fontWeight: '700' }}>
                      Auto Generate
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.formInput, { letterSpacing: 3, fontWeight: '800', fontSize: 16 }]}
                  placeholder="e.g. 1234"
                  placeholderTextColor="#A0A0A5"
                  value={formPin}
                  onChangeText={(val) => {
                    setFormPin(val);
                    if (formError) setFormError('');
                  }}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveStaff}>
                <Text style={styles.modalSaveText}>{editingStaff ? 'Save Changes' : 'Add Employee'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE / EDIT ROLE & PERMISSIONS MATRIX */}
      {/* ========================================================================= */}
      <Modal visible={roleModalVisible} transparent animationType="slide" onRequestClose={() => setRoleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentLarge, isMobile && { width: '95%', maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingRole ? `Configure Role: ${editingRole.name}` : 'Create New Custom Role'}
                </Text>
                <Text style={styles.modalHeaderSub}>
                  Define role identity, visibility limits, and operational authority
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {Boolean(roleFormError.trim().length > 0) && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={styles.errorAlertText}>{roleFormError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520, paddingHorizontal: 4 }}>
              {/* 1. Role Identity */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>1. Role Identity & Template</Text>

                <View style={styles.formRow}>
                  <View style={{ flex: 1.5, marginRight: 10 }}>
                    <Text style={styles.formLabel}>Role Title *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Senior Cashier or Floor Supervisor"
                      value={roleFormName}
                      onChangeText={(t) => {
                        setRoleFormName(t);
                        if (roleFormError) setRoleFormError('');
                      }}
                      editable={editingRole?.id !== 'role-admin'}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Urdu Title</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. کیشیئر"
                      value={roleFormUrdu}
                      onChangeText={setRoleFormUrdu}
                    />
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.formLabel}>Badge Color Theme</Text>
                  <View style={styles.colorPickerRow}>
                    {ROLE_COLORS.map((clr) => (
                      <TouchableOpacity
                        key={clr}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: clr },
                          roleFormColor === clr && styles.colorCircleActive,
                        ]}
                        onPress={() => setRoleFormColor(clr)}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.formLabel}>Role Description & Duties</Text>
                  <TextInput
                    style={[styles.formInput, { height: 50 }]}
                    multiline
                    placeholder="Short description of this role's authority and responsibilities..."
                    value={roleFormDesc}
                    onChangeText={setRoleFormDesc}
                  />
                </View>
              </View>

              {/* 2. Financial & Sensitive Data Visibility (Key User Requirement!) */}
              <View style={styles.formSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="eye" size={16} color={BRAND.burgundy} />
                  <Text style={styles.sectionTitle}>2. Financial & Data Visibility Controls</Text>
                </View>
                <Text style={styles.sectionSub}>
                  Control whether this role can see revenue amounts, raw food margins, and customer data
                </Text>

                <View style={styles.permList}>
                  {/* Revenue Visibility */}
                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canViewRevenue')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Show Daily & Shift Revenue Numbers</Text>
                      <Text style={styles.permDesc}>
                        If disabled, total revenue, gross sales, and profit figures are masked as •••••• (Restricted).
                        Ideal for Cashiers or Floor staff.
                      </Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canViewRevenue ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canViewRevenue ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  {/* Cost Prices */}
                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canViewCostPrice')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Show Recipe Food Costs & Margins</Text>
                      <Text style={styles.permDesc}>
                        Allows viewing raw ingredient purchase costs, BOM costing, and profit margin percentages.
                      </Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canViewCostPrice ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canViewCostPrice ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  {/* Customer CRM */}
                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canViewCustomerContacts')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Show Customer Phone Numbers & Addresses</Text>
                      <Text style={styles.permDesc}>
                        Protects guest privacy by masking phone numbers on POS and history.
                      </Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canViewCustomerContacts ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canViewCustomerContacts ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  {/* Export Reports */}
                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canExportReports')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Can Export CSV & Print Audit Reports</Text>
                      <Text style={styles.permDesc}>
                        Allows downloading ledger spreadsheets and sales audit logs.
                      </Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canExportReports ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canExportReports ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Module & Navigation Access */}
              <View style={styles.formSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="apps" size={16} color={BRAND.burgundy} />
                  <Text style={styles.sectionTitle}>3. Module & Section Access</Text>
                </View>
                <Text style={styles.sectionSub}>Choose which screens appear in their sidebar navigation</Text>

                <View style={styles.permGrid}>
                  {[
                    { key: 'canAccessPOS', label: 'POS Terminal', icon: 'calculator' },
                    { key: 'canAccessInvoices', label: 'Invoices & Orders', icon: 'receipt' },
                    { key: 'canAccessReports', label: 'Financial Reports', icon: 'bar-chart' },
                    { key: 'canAccessInventory', label: 'Inventory & Stock', icon: 'cube' },
                    { key: 'canAccessKitchenHandover', label: 'Kitchen Handover', icon: 'clipboard' },
                    { key: 'canAccessRecipes', label: 'Recipes & BOM', icon: 'restaurant' },
                    { key: 'canAccessDiscounts', label: 'Events & Discounts', icon: 'pricetag' },
                    { key: 'canAccessExpenses', label: 'Live Expenses', icon: 'wallet' },
                    { key: 'canAccessFloorPlan', label: 'Floor Plan & Command', icon: 'business' },
                    { key: 'canAccessDamages', label: 'Damage Control', icon: 'shield' },
                    { key: 'canAccessAssets', label: 'Assets & Capex', icon: 'diamond' },
                    { key: 'canAccessStaff', label: 'Staff & Roles', icon: 'people' },
                  ].map((mod) => {
                    const isAllowed = roleFormPermissions[mod.key as keyof RolePermissions];
                    return (
                      <TouchableOpacity
                        key={mod.key}
                        style={[styles.permGridCard, isAllowed && styles.permGridCardActive]}
                        onPress={() => toggleRolePermissionInForm(mod.key as keyof RolePermissions)}
                        disabled={editingRole?.id === 'role-admin' && mod.key === 'canAccessStaff'}
                      >
                        <Ionicons
                          name={mod.icon as any}
                          size={18}
                          color={isAllowed ? BRAND.burgundy : '#94A3B8'}
                        />
                        <Text style={[styles.permGridLabel, isAllowed && styles.permGridLabelActive]}>
                          {mod.label}
                        </Text>
                        <Ionicons
                          name={isAllowed ? 'checkmark-circle' : 'close-circle'}
                          size={16}
                          color={isAllowed ? '#10B981' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 4. Transactional & Operational Authorities */}
              <View style={[styles.formSection, { borderBottomWidth: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="flash" size={16} color={BRAND.burgundy} />
                  <Text style={styles.sectionTitle}>4. Operational & Transaction Authority</Text>
                </View>
                <Text style={styles.sectionSub}>Critical actions that require managerial authorization</Text>

                <View style={styles.permList}>
                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canApplyCustomDiscount')}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Apply Manual / Custom Discounts in POS</Text>
                      <Text style={styles.permDesc}>Can type custom percentage or cash discounts on bills.</Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canApplyCustomDiscount ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canApplyCustomDiscount ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canVoidInvoice')}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Void / Cancel Settled Invoices</Text>
                      <Text style={styles.permDesc}>Authority to cancel paid invoices and log audit reasons.</Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canVoidInvoice ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canVoidInvoice ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canProcessReturns')}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Process Sales Returns & Cash Refunds</Text>
                      <Text style={styles.permDesc}>Can approve food returns and disburse refund cash.</Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canProcessReturns ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canProcessReturns ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canStartCloseShift')}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Perform Shift Start & Blind Shift Close</Text>
                      <Text style={styles.permDesc}>
                        Count physical cash notes at shift close and submit cash register reconciliation.
                      </Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canStartCloseShift ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canStartCloseShift ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.permRow}
                    onPress={() => toggleRolePermissionInForm('canModifyMenuPrices')}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.permName}>Modify Menu Dishes & Selling Prices</Text>
                      <Text style={styles.permDesc}>Can edit dish catalog, recipe BOM, and price points.</Text>
                    </View>
                    <Ionicons
                      name={roleFormPermissions.canModifyMenuPrices ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={roleFormPermissions.canModifyMenuPrices ? BRAND.burgundy : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRoleModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveRole}>
                <Text style={styles.modalSaveText}>
                  {editingRole ? 'Save Changes' : 'Create & Apply Role'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerMobile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: BRAND.burgundy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  viewTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  viewTabBtnActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  viewTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  viewTabTextActive: {
    color: BRAND.burgundy,
    fontWeight: '900',
  },
  newBadge: {
    backgroundColor: BRAND.burgundy,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardMobile: {
    minWidth: '47%',
  },
  kpiIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    paddingHorizontal: 8,
    paddingRight: 10,
    height: 46,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(82, 20, 28, 0.06), 0 2px 6px rgba(212, 175, 55, 0.12), inset 0 1px 0 #FFFFFF',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  searchIconOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(82, 20, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any,
    }),
  },
  searchClearBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchShortcutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  searchShortcutText: {
    color: '#92400E',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  roleTabs: {
    flexDirection: 'row',
  },
  roleTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  roleTabActive: {
    backgroundColor: BRAND.burgundy,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCell: {
    justifyContent: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
  },
  staffName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  zoneText: {
    fontSize: 12,
    color: '#334155',
  },
  shiftText: {
    fontSize: 12,
    color: '#334155',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#334155',
  },
  pinCodeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#0F172A',
  },
  actionBtn: {
    padding: 6,
  },
  mobileListContainer: {
    gap: 12,
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mobileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mobileCardDetails: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  mobileCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  mobileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  mobileActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  rolesTabWrapper: {
    gap: 16,
  },
  roleInfoBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.burgundy,
    marginBottom: 4,
  },
  roleInfoDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  rolesGrid: {
    gap: 14,
  },
  roleMatrixCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  roleMatrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleMatrixIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMatrixTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  roleMatrixUrdu: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  systemTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  systemTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleMatrixDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  quickRevenueRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickRevenueTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickRevenueSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lockedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  revToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  revToggleBtnOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  revToggleBtnOff: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  revToggleBtnText: {
    fontSize: 11,
    fontWeight: '900',
  },
  permChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  permChipAllowed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  permChipDenied: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  permChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  roleCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  configPermsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  configPermsBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  roleDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalContentLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FDF2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorAlertText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  formPillActive: {
    backgroundColor: BRAND.burgundy,
    borderColor: BRAND.burgundy,
  },
  formPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  formPillTextActive: {
    color: '#FFFFFF',
  },
  floorAssignmentBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CCE4FF',
  },
  formLabelHighlighted: {
    fontSize: 12,
    fontWeight: '800',
    color: '#007AFF',
  },
  floorAccessBadge: {
    backgroundColor: '#CCE4FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floorAccessBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#007AFF',
  },
  formSubLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 10,
    lineHeight: 15,
  },
  floorChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  floorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8DAFF',
  },
  floorChipActiveAll: {
    backgroundColor: '#4a121a',
    borderColor: '#4a121a',
  },
  floorChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  floorChipText: {
    fontSize: 11,
    color: '#4a121a',
    fontWeight: '700',
  },
  floorChipTextActive: {
    color: '#FFFFFF',
  },
  formSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: '#000',
  },
  permList: {
    gap: 10,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  permDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  permGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permGridCard: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 4,
  },
  permGridCardActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  permGridLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  permGridLabelActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
