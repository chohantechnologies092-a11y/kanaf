import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useAuthStore, Role, ROLE_HOME, useRestaurantStore, StaffMember } from '../store';
import { useRoleStore, CustomRole } from '../store/roleStore';
import SultanLogo from '../components/SultanLogo';
import IslamicBackground from '../components/IslamicBackground';

const roles: { label: string; value: Role; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { label: 'Admin', value: 'admin', icon: 'shield-checkmark-outline', desc: 'Full System & POS' },
  { label: 'Manager', value: 'manager', icon: 'business-outline', desc: '5-Floor & Ledger' },
  { label: 'Order Taker', value: 'waiter', icon: 'walk-outline', desc: 'Floor Tables & KOT Punch' },
  { label: 'Kitchen', value: 'kitchen', icon: 'restaurant-outline', desc: 'Live KDS Display' },
  { label: 'Juice Bar', value: 'juicebar', icon: 'cafe-outline', desc: 'Live Beverage Orders' },
  { label: 'Playland', value: 'playland', icon: 'game-controller-outline', desc: 'Basement Rides & Tickets' },
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

  const isWaiterApp = (Platform.OS !== 'web' || params.role === 'waiter') && params.all !== 'true';

  const defaultWaiter = isWaiterApp
    ? staff.find((s) => s.role.toLowerCase() === 'waiter' && s.status === 'Active')
    : undefined;

  const [selectedRole, setSelectedRole] = useState<Role>(isWaiterApp ? 'waiter' : null);
  const [selectedCustomRole, setSelectedCustomRole] = useState<CustomRole | null>(null);
  const [name, setName] = useState(defaultWaiter?.name || '');
  const [pin, setPin] = useState(defaultWaiter?.pin || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Already signed in? Go straight to role's home.
  useEffect(() => {
    if (hasHydrated && user?.role) {
      router.replace(ROLE_HOME[user.role] as Href);
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

    setErrorMessage('');
    login(name.trim(), selectedRole, {
      staffId: matchedMember?.id,
      customRoleId: selectedCustomRole?.id || matchedMember?.customRoleId,
      assignedZone: matchedMember?.assignedZone,
      assignedZones: matchedMember?.assignedZones,
    });
    router.replace(ROLE_HOME[selectedRole] as Href);
  };

  const selectedRoleObj = roles.find((r) => r.value === selectedRole);

  return (
    <IslamicBackground theme="burgundy" showCorners={true} showCenterLattice={true}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header with HD Logo */}
            <View style={styles.header}>
              <View style={styles.logoBadgeOuter}>
                <SultanLogo size="xl" width={130} height={130} />
              </View>
              <Text style={styles.title}>
                {isWaiterApp ? 'Sultan Order Taker Terminal' : 'Sultan Staff Portal'}
              </Text>
              <Text style={styles.subtitle}>
                {isWaiterApp ? 'Floor Tables & Live Order Punch' : 'Select your operational role to sign in'}
              </Text>
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
              <>
                {/* Role Cards Grid */}
                <View style={styles.rolesGrid}>
                  {roles.map((r) => {
                    const count = staff.filter(
                      (s) => s.role.toLowerCase() === r.value?.toLowerCase()
                    ).length;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={styles.roleCard}
                        onPress={() => handleRoleSelect(r.value)}
                        activeOpacity={0.82}
                      >
                        <View style={styles.roleIconCircle}>
                          <Ionicons
                            name={r.icon}
                            size={26}
                            color="#D5A943"
                          />
                        </View>
                        <Text style={styles.roleText}>
                          {r.label}
                        </Text>
                        <Text style={styles.roleDesc}>
                          {r.desc}
                        </Text>
                        <View style={styles.staffCountBadge}>
                          <Text style={styles.staffCountText}>
                            {count} Staff Active
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Roles Section if created */}
                {customRoles.length > 0 && (
                  <View style={{ marginTop: 20, width: '100%' }}>
                    <View style={styles.customRolesHeader}>
                      <Ionicons name="shield-outline" size={15} color="#D5A943" />
                      <Text style={styles.customRolesSectionTitle}>
                        Custom Staff Roles ({customRoles.length})
                      </Text>
                    </View>
                    <View style={styles.rolesGrid}>
                      {customRoles.map((cr) => {
                        const count = staff.filter(
                          (s) =>
                            s.customRoleId === cr.id ||
                            s.role.toLowerCase() === cr.name.toLowerCase()
                        ).length;
                        return (
                          <TouchableOpacity
                            key={cr.id}
                            style={[styles.roleCard, { borderColor: cr.badgeColor + '50' }]}
                            onPress={() => handleCustomRoleSelect(cr)}
                            activeOpacity={0.82}
                          >
                            <View
                              style={[
                                styles.roleIconCircle,
                                { backgroundColor: cr.badgeColor + '20' },
                              ]}
                            >
                              <Ionicons
                                name={(cr.icon || 'person-outline') as any}
                                size={26}
                                color={cr.badgeColor}
                              />
                            </View>
                            <Text style={styles.roleText}>{cr.name}</Text>
                            {Boolean(cr.urduName && cr.urduName.trim()) && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: '#D5A943',
                                  marginTop: 1,
                                  fontWeight: '600',
                                }}
                              >
                                {cr.urduName}
                              </Text>
                            )}
                            <Text style={styles.roleDesc} numberOfLines={2}>
                              {cr.description || `Staff role on ${cr.baseRole} portal.`}
                            </Text>
                            <View
                              style={[
                                styles.staffCountBadge,
                                { borderColor: cr.badgeColor + '40' },
                              ]}
                            >
                              <Text style={[styles.staffCountText, { color: cr.badgeColor }]}>
                                {count} Staff Active
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                >
                  <Ionicons name="arrow-back" size={16} color="#D5A943" style={{ marginRight: 6 }} />
                  <Text style={styles.backButtonText}>Back to Welcome Screen</Text>
                </TouchableOpacity>
              </>
            )}
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
    paddingVertical: 24,
  },
  content: {
    paddingHorizontal: 20,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadgeOuter: {
    padding: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(213, 169, 67, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(213, 169, 67, 0.35)',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  roleCard: {
    width: '48%',
    backgroundColor: 'rgba(30, 7, 9, 0.85)',
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(213, 169, 67, 0.3)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(213, 169, 67, 0.18)',
    borderWidth: 1.2,
    borderColor: '#D5A943',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  staffCountBadge: {
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(213, 169, 67, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
  },
  staffCountText: {
    fontSize: 10,
    color: '#D5A943',
    fontWeight: '600',
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
