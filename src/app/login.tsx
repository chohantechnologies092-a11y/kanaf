import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useAuthStore, Role, ROLE_HOME, getRoleHome, useRestaurantStore, StaffMember } from '../store';
import { useRoleStore, CustomRole } from '../store/roleStore';
import SultanLogo from '../components/SultanLogo';
import IslamicBackground from '../components/IslamicBackground';

const roles: {
  label: string;
  urdu: string;
  value: Role;
  icon: keyof typeof Ionicons.glyphMap;
  desc: string;
}[] = [
  { label: 'Admin', urdu: 'ایڈمن کنٹرول', value: 'admin', icon: 'shield-checkmark-outline', desc: 'Full System & POS' },
  { label: 'Manager', urdu: 'منیجر ڈیش بورڈ', value: 'manager', icon: 'business-outline', desc: '5-Floor & Ledger' },
  { label: 'Order Taker', urdu: 'آرڈر ٹیکر', value: 'waiter', icon: 'walk-outline', desc: 'Floor Tables & KOT' },
  { label: 'Kitchen', urdu: 'باورچی خانہ KDS', value: 'kitchen', icon: 'restaurant-outline', desc: 'Live Station Display' },
  { label: 'Juice Bar', urdu: 'جوس بار', value: 'juicebar', icon: 'cafe-outline', desc: 'Live Beverages' },
  { label: 'Playland', urdu: 'پلے لینڈ', value: 'playland', icon: 'game-controller-outline', desc: 'Basement Rides & Fun' },
];

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; all?: string }>();
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const staff = useRestaurantStore((state) => state.staff) || [];
  const allRoles = useRoleStore((state) => state.roles);
  const customRoles = allRoles.filter((r) => !r.isSystem);

  // Unified roles: standard roles + custom roles in the EXACT SAME grid
  const displayRoles = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      urdu: string;
      desc: string;
      icon: keyof typeof Ionicons.glyphMap;
      badgeColor?: string;
      isCustom: boolean;
      customRole?: CustomRole;
      value?: Role;
      count: number;
    }> = [];

    // Standard system roles
    roles.forEach((r) => {
      const count = staff.filter(
        (s) => s.role.toLowerCase() === r.value?.toLowerCase()
      ).length;
      list.push({
        key: r.value || r.label,
        label: r.label,
        urdu: r.urdu,
        desc: r.desc,
        icon: r.icon,
        value: r.value,
        isCustom: false,
        count,
      });
    });

    // Custom roles directly merged into the SAME grid
    customRoles.forEach((cr) => {
      const count = staff.filter(
        (s) =>
          s.customRoleId === cr.id ||
          s.role.toLowerCase() === cr.name.toLowerCase()
      ).length;
      list.push({
        key: cr.id,
        label: cr.name,
        urdu: cr.urduName && cr.urduName.trim() ? cr.urduName : 'کسٹم رول',
        desc: cr.description || `Staff role on ${cr.baseRole}`,
        icon: (cr.icon || 'person-outline') as any,
        badgeColor: cr.badgeColor,
        isCustom: true,
        customRole: cr,
        count,
      });
    });

    return list;
  }, [staff, customRoles]);

  const isWaiterApp = (Platform.OS !== 'web' || params.role === 'waiter') && params.all !== 'true';

  const { width: screenWidth } = useWindowDimensions();
  // Keep strictly 2 rows: 3 per row for <=6 roles, 4 per row for 7-8 roles
  const isDesktopOrTablet = screenWidth >= 640;
  const targetCols = displayRoles.length <= 6 ? 3 : displayRoles.length <= 8 ? 4 : 5;
  const cardWidth = !isDesktopOrTablet
    ? '48%'
    : targetCols === 5
    ? '18.8%'
    : targetCols === 4
    ? '23.5%'
    : '31.8%';

  const defaultWaiter = isWaiterApp
    ? staff.find((s) => s.role.toLowerCase() === 'waiter' && s.status === 'Active')
    : undefined;

  const [selectedRole, setSelectedRole] = useState<Role>(isWaiterApp ? 'waiter' : null);
  const [selectedCustomRole, setSelectedCustomRole] = useState<CustomRole | null>(null);
  const [name, setName] = useState(defaultWaiter?.name || '');
  const [pin, setPin] = useState(defaultWaiter?.pin || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Live Clock & Date for header widget
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const now = currentTime;
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const hoursStr = String(h).padStart(2, '0');
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const secondsStr = String(now.getSeconds()).padStart(2, '0');

  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
  const dateFormatted = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const urduDay = urduDays[now.getDay()];

  // Already signed in? Go straight to role's home.
  useEffect(() => {
    if (hasHydrated && user?.role) {
      const dest = getRoleHome(user.role, user.customRoleId);
      router.replace(dest as Href);
    }
  }, [hasHydrated, user, router]);

  // Filter staff matching selected role or custom role
  const roleStaff = staff.filter((s) => {
    if (!selectedRole || s.status === 'Inactive') return false;
    if (selectedCustomRole) {
      return (
        s.customRoleId === selectedCustomRole.id ||
        s.role.toLowerCase() === selectedCustomRole.name.toLowerCase()
      );
    }
    // Match base role or custom role with this baseRole
    if (s.role.toLowerCase() === selectedRole.toLowerCase()) return true;
    const memberCustomRole = allRoles.find(
      (r) => r.id === s.customRoleId || r.name.toLowerCase() === s.role.toLowerCase()
    );
    return memberCustomRole && memberCustomRole.baseRole === selectedRole;
  });

  const handleRoleSelect = (roleValue: Role) => {
    setSelectedCustomRole(null);
    setSelectedRole(roleValue);
    setErrorMessage('');
    const matching = staff.filter(
      (s) => s.role.toLowerCase() === roleValue?.toLowerCase() && s.status === 'Active'
    );
    if (matching.length > 0) {
      setName(matching[0].name);
      setPin(matching[0].pin);
    } else {
      setName(roleValue ? roleValue.charAt(0).toUpperCase() + roleValue.slice(1) + ' User' : '');
      setPin('1234');
    }
  };

  const handleCustomRoleSelect = (cr: CustomRole) => {
    setSelectedCustomRole(cr);
    const base = (cr.baseRole === 'custom' ? 'manager' : cr.baseRole) as Role;
    setSelectedRole(base);
    setErrorMessage('');
    const matching = staff.filter(
      (s) =>
        (s.customRoleId === cr.id || s.role.toLowerCase() === cr.name.toLowerCase()) &&
        s.status === 'Active'
    );
    if (matching.length > 0) {
      setName(matching[0].name);
      setPin(matching[0].pin);
    } else {
      setName(cr.name + ' Staff');
      setPin('1234');
    }
  };

  const selectStaffMember = (member: StaffMember) => {
    setName(member.name);
    setPin(member.pin);
    setErrorMessage('');
  };

  const closeModal = () => {
    setSelectedRole(null);
    setSelectedCustomRole(null);
    setErrorMessage('');
  };

  const handleLogin = () => {
    if (!selectedRole || !name.trim()) {
      setErrorMessage('Please select a staff role.');
      return;
    }

    if (!pin.trim()) {
      setErrorMessage('Please enter your 4-digit PIN.');
      return;
    }

    // Check against store staff if present
    const matchedMember = staff.find((s) => {
      if (s.name.toLowerCase() !== name.trim().toLowerCase()) return false;
      if (selectedCustomRole) {
        return (
          s.customRoleId === selectedCustomRole.id ||
          s.role.toLowerCase() === selectedCustomRole.name.toLowerCase()
        );
      }
      if (s.role.toLowerCase() === selectedRole.toLowerCase()) return true;
      const memberCustomRole = allRoles.find(
        (r) => r.id === s.customRoleId || r.name.toLowerCase() === s.role.toLowerCase()
      );
      return memberCustomRole && memberCustomRole.baseRole === selectedRole;
    });

    // If matched staff member exists, verify their PIN (or master PIN 1234)
    if (matchedMember && matchedMember.pin !== pin && pin !== '1234') {
      setErrorMessage(`Incorrect PIN for ${matchedMember.name}. Please enter correct PIN.`);
      return;
    }

    const dest = getRoleHome(selectedRole, selectedCustomRole?.baseRole);
    setErrorMessage('');
    login(name.trim(), (selectedRole || '').toLowerCase(), {
      staffId: matchedMember?.id,
      customRoleId: selectedCustomRole?.id || matchedMember?.customRoleId,
      assignedZone: matchedMember?.assignedZone,
      assignedZones: matchedMember?.assignedZones,
    });
    closeModal();
    router.replace(dest as Href);
  };

  const selectedRoleObj = roles.find((r) => r.value === selectedRole);

  return (
    <IslamicBackground theme="burgundy" showCorners={true} showCenterLattice={true}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={[styles.mainLoginCard, isWaiterApp && styles.mainLoginCardWaiter]}>
              {/* Back to Welcome Screen */}
              <TouchableOpacity
                style={styles.backToWelcomeBtn}
                onPress={() => router.replace('/' as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={16} color="#D5A943" style={{ marginRight: 6 }} />
                <Text style={styles.backToWelcomeText}>Welcome Screen / خوش آمدید</Text>
              </TouchableOpacity>

              {/* Header with HD Logo on Left, Details, and Live Clock on Right */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.logoBadgeOuter}>
                    <SultanLogo size="md" width={isDesktopOrTablet ? 116 : 86} height={isDesktopOrTablet ? 98 : 74} style={styles.logoDropShadow} />
                  </View>
                  <View style={styles.headerDetails}>
                    <Text style={styles.title}>
                      {isWaiterApp ? 'Kanaf Order Taker Terminal' : 'KANAF STAFF PORTAL'}
                    </Text>
                    <Text style={styles.urduSubtitle}>
                      {isWaiterApp ? 'آرڈر ٹیکر ٹرمینل • فلور ٹیبلز اور لائیو پنچ' : 'کناف کیفے اینڈ بیکری • لاگ ان ٹرمینل منتخب کریں'}
                    </Text>
                    <Text style={styles.subtitle}>
                      {isWaiterApp ? 'Floor Tables & Live Order Punch' : 'Select your operational terminal to sign in'}
                    </Text>
                  </View>
                </View>

                {/* Luxury Royal Timepiece Widget on Right */}
                {isDesktopOrTablet && (
                  <View style={styles.clockCard}>
                    {/* Time Cluster with Digital Digit Boxes */}
                    <View style={styles.timeCluster}>
                      <View style={styles.timeDigitBox}>
                        <Text style={styles.timeDigitText}>{hoursStr}</Text>
                      </View>
                      <Text style={styles.timeColon}>:</Text>
                      <View style={styles.timeDigitBox}>
                        <Text style={styles.timeDigitText}>{minutesStr}</Text>
                      </View>
                      <View style={styles.timeSecCol}>
                        <View style={styles.timeAmPmBadge}>
                          <Text style={styles.timeAmPmText}>{ampm}</Text>
                        </View>
                        <Text style={styles.timeSecText}>:{secondsStr}</Text>
                      </View>
                    </View>

                    {/* Golden Vertical Divider */}
                    <View style={styles.clockDivider} />

                    {/* Date & Terminal Info Column */}
                    <View style={styles.clockDateCol}>
                      <View style={styles.clockTopStatusRow}>
                        <View style={styles.clockLiveDot} />
                        <Text style={styles.clockStatusText}>KANAF TIME • {urduDay}</Text>
                      </View>
                      <View style={styles.clockDateRow}>
                        <Ionicons name="calendar-outline" size={13} color="#D5A943" style={{ marginRight: 5 }} />
                        <Text style={styles.clockDate}>{dayName}, {dateFormatted}</Text>
                      </View>
                      <View style={styles.clockShiftPill}>
                        <Text style={styles.clockShiftText}>🟢 POS & Kitchen Active</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

            {isWaiterApp ? (
              <View style={styles.modalCard}>
                {/* Card Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <View style={styles.modalRoleIconCircle}>
                      <Ionicons name="walk" size={22} color="#451014" />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Order Taker Sign In</Text>
                      <Text style={styles.modalSubtitle}>Floor Tables & Live KOT Dispatch</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                {/* Quick Pick Staff Pills */}
                {roleStaff.length > 0 && (
                  <View style={styles.quickPickContainer}>
                    <Text style={styles.quickPickLabel}>Active Order Takers on Shift:</Text>
                    <View style={styles.quickPickPills}>
                      {roleStaff.map((member) => {
                        const isChosen = name.toLowerCase() === member.name.toLowerCase();
                        const floorText = member.assignedZone || (member.assignedZones && member.assignedZones.length > 0 ? member.assignedZones.join(', ') : 'All Floors');
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={[
                              styles.staffPill,
                              isChosen && styles.staffPillActive,
                            ]}
                            onPress={() => selectStaffMember(member)}
                          >
                            <Text
                              style={[
                                styles.staffPillText,
                                isChosen && styles.staffPillTextActive,
                              ]}
                            >
                              {member.name} • 🏢 {floorText} ({member.shift})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Error Banner */}
                {errorMessage.length > 0 && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#FF6B6B" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Order Taker Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Order Taker Name / ID</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color="#D5A943" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter order taker name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                  </View>
                </View>

                {/* PIN Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.pinLabelRow}>
                    <Text style={styles.inputLabel}>4-Digit Security PIN</Text>
                    <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                      <Text style={styles.showPinText}>{showPin ? 'Hide PIN' : 'Show PIN'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={18} color="#D5A943" style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.input, styles.pinInput]}
                      placeholder="••••"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showPin}
                      keyboardType="number-pad"
                      maxLength={4}
                      value={pin}
                      onChangeText={(val) => {
                        setPin(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                  </View>
                </View>

                {/* Login Button */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      (!name.trim() || !pin.trim()) && styles.loginButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={!name.trim() || !pin.trim()}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="log-in-outline" size={20} color="#451014" />
                    <Text style={styles.loginButtonText}>Enter Floor Plan & Tables</Text>
                  </TouchableOpacity>
                </View>

                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={{ marginTop: 16, alignItems: 'center' }}
                    onPress={() => router.push('/login?all=true' as any)}
                  >
                    <Text style={{ color: '#D5A943', fontSize: 13, textDecorationLine: 'underline' }}>
                      Switch to Full Staff Portal
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Unified Role Cards Grid (Standard & Custom Roles all in the same 2 rows!)
              <View style={styles.rolesGrid}>
                  {displayRoles.map((item) => {
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.roleCard,
                          { width: cardWidth },
                          item.isCustom && { borderColor: (item.badgeColor || '#D5A943') + '65' },
                        ]}
                        onPress={() => {
                          if (item.isCustom && item.customRole) {
                            handleCustomRoleSelect(item.customRole);
                          } else if (item.value) {
                            handleRoleSelect(item.value);
                          }
                        }}
                        activeOpacity={0.82}
                      >
                        <View
                          style={[
                            styles.roleIconCircle,
                            item.isCustom && {
                              backgroundColor: (item.badgeColor || '#D5A943') + '20',
                              borderColor: item.badgeColor || '#D5A943',
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={item.isCustom ? item.badgeColor || '#D5A943' : '#D5A943'}
                          />
                        </View>
                        <Text style={styles.roleText} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            styles.roleUrduText,
                            item.isCustom && { color: item.badgeColor || '#D5A943' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.urdu}
                        </Text>
                        <Text style={styles.roleDesc} numberOfLines={1}>
                          {item.desc}
                        </Text>
                        <View
                          style={[
                            styles.staffCountBadge,
                            item.isCustom && { borderColor: (item.badgeColor || '#D5A943') + '40' },
                          ]}
                        >
                          <View
                            style={[
                              styles.onlineDot,
                              item.isCustom && { backgroundColor: item.badgeColor || '#10B981' },
                            ]}
                          />
                          <Text
                            style={[
                              styles.staffCountText,
                              item.isCustom && { color: item.badgeColor || '#D5A943' },
                            ]}
                          >
                            {item.count} Active
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
            )}
            </View>
          </View>
        </ScrollView>

        {/* Modal Popup for Role Credentials */}
        <Modal
          visible={!isWaiterApp && !!selectedRole}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalContentWrapper}
            >
              <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <View
                      style={[
                        styles.modalRoleIconCircle,
                        selectedCustomRole && { backgroundColor: selectedCustomRole.badgeColor + '25' },
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedCustomRole
                            ? ((selectedCustomRole.icon || 'person-outline') as any)
                            : (selectedRoleObj?.icon || 'shield-checkmark-outline')
                        }
                        size={22}
                        color={selectedCustomRole ? selectedCustomRole.badgeColor : '#451014'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>
                        {selectedCustomRole ? selectedCustomRole.name : selectedRoleObj?.label} Sign In
                      </Text>
                      <Text style={styles.modalSubtitle} numberOfLines={1}>
                        {selectedCustomRole
                          ? (selectedCustomRole.urduName ? `${selectedCustomRole.urduName} • ` : '') +
                            (selectedCustomRole.description || 'Custom Staff Role')
                          : selectedRoleObj?.desc}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={closeModal}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#D5A943" />
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.modalDivider} />

                {/* Quick Pick Staff Pills */}
                {roleStaff.length > 0 && (
                  <View style={styles.quickPickContainer}>
                    <Text style={styles.quickPickLabel}>Select Profile:</Text>
                    <View style={styles.quickPickPills}>
                      {roleStaff.map((member) => {
                        const isChosen = name.toLowerCase() === member.name.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={[
                              styles.staffPill,
                              isChosen && styles.staffPillActive,
                            ]}
                            onPress={() => selectStaffMember(member)}
                          >
                            <Text
                              style={[
                                styles.staffPillText,
                                isChosen && styles.staffPillTextActive,
                              ]}
                            >
                              {member.name}{member.assignedZone ? ` • 🏢 ${member.assignedZone}` : ''} • ({member.shift})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Error Banner */}
                {errorMessage.length > 0 && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#FF6B6B" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Staff Name / ID</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color="#D5A943" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter full name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                  </View>
                </View>

                {/* PIN Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.pinLabelRow}>
                    <Text style={styles.inputLabel}>Security PIN</Text>
                    <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                      <Text style={styles.showPinText}>{showPin ? 'Hide PIN' : 'Show PIN'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={18} color="#D5A943" style={styles.fieldIcon} />
                    <TextInput
                      style={[styles.input, styles.pinInput]}
                      placeholder="••••"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showPin}
                      keyboardType="number-pad"
                      value={pin}
                      onChangeText={(val) => {
                        setPin(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      (!name.trim() || !pin.trim()) && styles.loginButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={!name.trim() || !pin.trim()}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="log-in-outline" size={20} color="#451014" />
                    <Text style={styles.loginButtonText}>Enter Portal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={closeModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </IslamicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  content: {
    paddingHorizontal: 16,
    maxWidth: 1420,
    width: '96%',
    alignSelf: 'center',
  },
  mainLoginCard: {
    backgroundColor: 'rgba(44, 1, 12, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.35)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 16px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      } as any,
    }),
  },
  mainLoginCardWaiter: {
    maxWidth: 540,
    alignSelf: 'center',
  },
  backToWelcomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 224, 203, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 203, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
    ...Platform.select({
      web: { cursor: 'pointer' } as any
    }),
  },
  backToWelcomeText: {
    color: '#FFE0CB',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  logoBadgeOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoDropShadow: {
    ...Platform.select({
      web: {
        filter: 'drop-shadow(0px 6px 18px rgba(213, 169, 67, 0.45))',
      } as any,
    }),
  },
  headerDetails: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'left',
    marginBottom: 2,
    letterSpacing: 0.6,
  },
  urduSubtitle: {
    fontSize: 13,
    color: '#FFE0CB',
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'left',
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 1, 9, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.38)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 225, 130, 0.22)',
      } as any,
    }),
  },
  timeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDigitBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.42)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigitText: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFF3CA',
    letterSpacing: 0.5,
    ...Platform.select({
      web: {
        fontVariantNumeric: 'tabular-nums',
      } as any,
    }),
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D5A943',
    marginHorizontal: 3,
  },
  timeSecCol: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  timeAmPmBadge: {
    backgroundColor: 'rgba(213, 169, 67, 0.22)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(213, 169, 67, 0.5)',
    marginBottom: 2,
  },
  timeAmPmText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#D5A943',
    letterSpacing: 0.6,
  },
  timeSecText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    ...Platform.select({
      web: {
        fontVariantNumeric: 'tabular-nums',
      } as any,
    }),
  },
  clockDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(213, 169, 67, 0.28)',
  },
  clockDateCol: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  clockTopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  clockLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px #10B981',
      } as any,
    }),
  },
  clockStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D5A943',
    letterSpacing: 0.8,
  },
  clockDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  clockDate: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  clockShiftPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  clockShiftText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6EE7B7',
    letterSpacing: 0.3,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 4,
    width: '100%',
  },
  roleCard: {
    backgroundColor: 'rgba(25, 5, 8, 0.90)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(213, 169, 67, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.16s ease-in-out',
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.25)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(213, 169, 67, 0.14)',
    borderWidth: 1.2,
    borderColor: '#D5A943',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  roleUrduText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D5A943',
    marginTop: 1,
    marginBottom: 2,
    textAlign: 'center',
  },
  roleDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 13,
  },
  staffCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    backgroundColor: 'rgba(213, 169, 67, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
    gap: 4,
  },
  onlineDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  staffCountText: {
    fontSize: 9.5,
    color: '#D5A943',
    fontWeight: '700',
  },
  backButton: {
    marginTop: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#D5A943',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Modal Popup Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 2, 3, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#2A070B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.8,
    borderColor: '#D5A943',
    gap: 14,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalRoleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D5A943',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#D5A943',
    fontWeight: '600',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(213, 169, 67, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(213, 169, 67, 0.25)',
    marginVertical: 2,
  },
  quickPickContainer: {
    marginBottom: 4,
  },
  quickPickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D5A943',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  quickPickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
  },
  staffPillActive: {
    backgroundColor: '#D5A943',
    borderColor: '#D5A943',
  },
  staffPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E5EA',
  },
  staffPillTextActive: {
    color: '#451014',
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D5A943',
  },
  pinLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showPinText: {
    fontSize: 12,
    color: '#D5A943',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(213, 169, 67, 0.35)',
    paddingHorizontal: 12,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  pinInput: {
    letterSpacing: 5,
    fontWeight: '700',
  },
  modalActions: {
    gap: 10,
    marginTop: 4,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5A943',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E8C76D',
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#5C4A28',
    borderColor: '#4A3B20',
  },
  loginButtonText: {
    color: '#451014',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  customRolesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  customRolesSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D5A943',
    letterSpacing: 0.5,
  },
});
