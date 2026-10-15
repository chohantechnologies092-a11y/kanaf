import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ReportsScreen from '../admin/reports';
import { useRolePermissions } from '../../store/roleStore';

export default function ManagerReports() {
  const router = useRouter();
  const { can } = useRolePermissions();
  const canAccessReports = can('canAccessReports');
  const canViewRevenue = can('canViewRevenue');

  if (!canAccessReports || !canViewRevenue) {
    return (
      <View style={styles.restrictedContainer}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="eye-off-outline" size={44} color="#52171B" />
          </View>
          <Text style={styles.badge}>ACCESS RESTRICTED</Text>
          <Text style={styles.title}>Financial Reports Restricted</Text>
          <Text style={styles.urduTitle}>مالیاتی اور ریونیو رپورٹس تک رسائی ایڈمن کی طرف سے بند ہے</Text>
          <Text style={styles.description}>
            Your assigned role does not have authorization to view financial analytics, revenue data, or cash reports.
            To modify these permissions, contact the Executive Admin.
          </Text>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.replace('/manager/dashboard')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.backBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <ReportsScreen />;
}

const styles = StyleSheet.create({
  restrictedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(82, 23, 27, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(82, 23, 27, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#E11D48',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  urduTitle: {
    fontSize: 14,
    color: '#52171B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52171B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

