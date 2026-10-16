import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRolePermissions } from '../store/roleStore';

interface PermissionDeniedScreenProps {
  moduleName: string;
  urduModuleName?: string;
  requiredPermission?: string;
  backRoute?: string;
}

export default function PermissionDeniedScreen({
  moduleName,
  urduModuleName,
  requiredPermission,
  backRoute,
}: PermissionDeniedScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const user = useAuthStore((s) => s.user);
  const { roleName, can } = useRolePermissions();

  const handleBack = () => {
    if (backRoute) {
      router.replace(backRoute as any);
    } else if (user?.role === 'admin') {
      router.replace('/admin/dashboard');
    } else if (user?.role === 'manager') {
      router.replace('/manager/dashboard');
    } else {
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, isMobile && styles.cardMobile]}>
        {/* Shield Icon with glowing ring */}
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Ionicons name="shield-outline" size={42} color="#DC2626" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Security Badge */}
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>SECURITY RESTRICTION</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{moduleName} Restricted</Text>
        {urduModuleName ? (
          <Text style={styles.urduTitle}>{urduModuleName} تک رسائی محدود ہے</Text>
        ) : (
          <Text style={styles.urduTitle}>اس ماڈیول تک رسائی ایڈمن کی پالیسی کے تحت بند ہے</Text>
        )}

        {/* Description */}
        <Text style={styles.description}>
          Your operational role <Text style={styles.boldText}>({roleName})</Text> has not been granted
          access to the <Text style={styles.boldText}>{moduleName}</Text> module.
        </Text>

        {requiredPermission && (
          <View style={styles.permTag}>
            <Ionicons name="key-outline" size={12} color="#64748B" />
            <Text style={styles.permTagText}>Required Permission: {requiredPermission}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>

          {can('canAccessStaff') && (
            <TouchableOpacity
              style={styles.adminConfigBtn}
              onPress={() => router.replace('/admin/staff')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={16} color="#701A26" style={{ marginRight: 6 }} />
              <Text style={styles.adminConfigBtnText}>Configure Role Permissions</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 520,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  cardMobile: {
    padding: 24,
    borderRadius: 18,
  },
  iconOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  urduTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#701A26',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '800',
    color: '#1E293B',
  },
  permTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 24,
  },
  permTagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  btnRow: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#701A26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  adminConfigBtn: {
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  adminConfigBtnText: {
    color: '#701A26',
    fontWeight: '700',
    fontSize: 13,
  },
});
