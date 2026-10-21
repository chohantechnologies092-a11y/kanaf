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
      {/* Web Keyframe Animations & Micro-Interactions */}
      {Platform.OS === 'web' && (
        <style>{`
          @keyframes shieldGlow {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4), 0 8px 24px rgba(220, 38, 38, 0.15);
              transform: scale(1);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(220, 38, 38, 0), 0 12px 32px rgba(220, 38, 38, 0.25);
              transform: scale(1.03);
            }
          }
          @keyframes cardEntrance {
            0% { opacity: 0; transform: translateY(12px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          [data-shield-ring="true"],
          .animated-shield-ring {
            animation: shieldGlow 3s infinite ease-in-out !important;
          }
          [data-denied-card="true"],
          .animated-denied-card {
            animation: cardEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          }
        `}</style>
      )}

      <View 
        style={[styles.card, isMobile && styles.cardMobile]}
        {...(Platform.OS === 'web' ? ({ dataSet: { card: 'true', deniedCard: 'true', pageEnter: 'true' } } as any) : {})}
      >
        {/* Animated Shield Icon with glowing ring */}
        <View 
          style={styles.iconOuter}
          {...(Platform.OS === 'web' ? ({ dataSet: { shieldRing: 'true' } } as any) : {})}
        >
          <View style={styles.iconInner}>
            <Ionicons name="shield-outline" size={44} color="#DC2626" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Security Badge Pill */}
        <View style={styles.badgePill} {...(Platform.OS === 'web' ? ({ dataSet: { hover: 'true' } } as any) : {})}>
          <Ionicons name="warning" size={12} color="#991B1B" style={{ marginRight: 5 }} />
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

        {/* Properly Styled Luminous Security Info Box */}
        {requiredPermission ? (
          <View style={styles.securityInfoBox} {...(Platform.OS === 'web' ? ({ dataSet: { card: 'true' } } as any) : {})}>
            <View style={styles.infoBoxLeftAccent} />
            <View style={styles.infoBoxIconOrb}>
              <Ionicons name="key" size={15} color="#B45309" />
            </View>
            <View style={styles.infoBoxContent}>
              <Text style={styles.infoBoxHeader}>REQUIRED ACCESS KEY</Text>
              <Text style={styles.infoBoxKeyText}>{requiredPermission}</Text>
              <Text style={styles.infoBoxSub}>Contact an Executive Admin to enable this toggle in Staff Permissions.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.securityInfoBox} {...(Platform.OS === 'web' ? ({ dataSet: { card: 'true' } } as any) : {})}>
            <View style={styles.infoBoxLeftAccent} />
            <View style={styles.infoBoxIconOrb}>
              <Ionicons name="information-circle" size={16} color="#B45309" />
            </View>
            <View style={styles.infoBoxContent}>
              <Text style={styles.infoBoxHeader}>ACCESS RESTRICTED</Text>
              <Text style={styles.infoBoxSub}>This section is reserved for higher administrative tiers.</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={handleBack} 
            activeOpacity={0.8}
            {...(Platform.OS === 'web' ? ({ dataSet: { hover: 'true' } } as any) : {})}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>

          {can('canAccessStaff') && (
            <TouchableOpacity
              style={styles.adminConfigBtn}
              onPress={() => router.replace('/admin/staff')}
              activeOpacity={0.8}
              {...(Platform.OS === 'web' ? ({ dataSet: { hover: 'true' } } as any) : {})}
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
    backgroundColor: '#F5F1E8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(220, 38, 38, 0.08) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(112, 26, 38, 0.08) 0%, transparent 45%), linear-gradient(135deg, #FBF8F2 0%, #F3EDE2 100%)',
      } as any
    }),
  },
  card: {
    maxWidth: 520,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 24px 60px rgba(82, 20, 28, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
      } as any
    }),
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
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(254, 205, 211, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.16)',
      } as any
    }),
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
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
      } as any,
    }),
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(254, 205, 211, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
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
    fontSize: 23,
    fontWeight: '900',
    color: '#1E0408',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  urduTitle: {
    fontSize: 14.5,
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

  // Security Info Box with Rich Liquid Glass Colors
  securityInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(254, 243, 199, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.12)',
      } as any,
    }),
  },
  infoBoxLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#D97706',
  },
  infoBoxIconOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginLeft: 4,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoBoxKeyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 3,
  },
  infoBoxSub: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 15,
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
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #701A26 0%, #8E2031 100%)',
        boxShadow: '0 4px 14px rgba(112, 26, 38, 0.3)',
      } as any
    }),
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  adminConfigBtn: {
    backgroundColor: 'rgba(253, 242, 244, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(251, 207, 232, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      } as any
    }),
  },
  adminConfigBtnText: {
    color: '#701A26',
    fontWeight: '700',
    fontSize: 13,
  },
});
