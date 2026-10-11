import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../store';
import IslamicBackground from '../components/IslamicBackground';
import SultanLogo from '../components/SultanLogo';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  // On Native Mobile APK, launch straight into Waiter Terminal
  useEffect(() => {
    if (hasHydrated) {
      if (user?.role === 'waiter') {
        router.replace('/waiter');
      } else if (Platform.OS !== 'web') {
        router.replace('/login?role=waiter' as any);
      }
    }
  }, [hasHydrated, user, router]);

  return (
    <IslamicBackground theme="burgundy" showCorners={true} showCenterLattice={true}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#451014" />

        <View style={styles.content}>
          <View style={styles.cardContainer}>
            {/* Ultra Crisp Sultan Logo */}
            <View style={styles.logoContainer}>
              <SultanLogo
                size={isMobile ? 'xl' : 'hero'}
                width={isMobile ? 260 : 360}
                height={isMobile ? 220 : 300}
              />
            </View>

            {/* Title & Tagline */}
            <View style={styles.welcomeTextContainer}>
              <View style={styles.royalDivider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerStar}>
                  <Ionicons name="sparkles" size={14} color="#D5A943" />
                </View>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.welcomeTitle}>Authentic Dining Experience</Text>
              <Text style={styles.welcomeSubtitle}>
                Taste the royal flavors of the finest Arabian & Continental cuisine crafted with passion and heritage.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Link href="/login?role=waiter" asChild>
                <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88}>
                  <Ionicons name="walk" size={20} color="#451014" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Order Taker Terminal Login</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/menu" asChild>
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88}>
                  <Ionicons name="restaurant-outline" size={19} color="#D5A943" style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryButtonText}>View Digital Menu</Text>
                </TouchableOpacity>
              </Link>

              <View style={styles.quickRow}>
                <Link href="/kitchen/kds" asChild style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.compactPortalBtn} activeOpacity={0.88}>
                    <Ionicons name="flame-outline" size={16} color="#FF6B6B" style={{ marginRight: 5 }} />
                    <Text style={styles.compactPortalText}>Kitchen KDS</Text>
                  </TouchableOpacity>
                </Link>

                <Link href="/juicebar/kds" asChild style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.compactPortalBtn} activeOpacity={0.88}>
                    <Ionicons name="cafe-outline" size={16} color="#FFA94D" style={{ marginRight: 5 }} />
                    <Text style={styles.compactPortalText}>Juice Bar</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <Link href="/login?all=true" asChild>
                <TouchableOpacity style={styles.adminPortalButton} activeOpacity={0.88}>
                  <Ionicons name="key-outline" size={16} color="#A38F78" style={{ marginRight: 6 }} />
                  <Text style={styles.adminPortalButtonText}>Admin & Management Portal</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Footer Royal Badge */}
            <View style={styles.footerNote}>
              <Text style={styles.footerText}>⚡ LAN Multi-Screen Realtime Order Hub Active</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </IslamicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 540,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  welcomeTextContainer: {
    alignItems: 'center',
    marginVertical: 18,
    paddingHorizontal: 12,
  },
  royalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 220,
    marginBottom: 14,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(213, 169, 67, 0.4)',
  },
  dividerStar: {
    paddingHorizontal: 4,
  },
  welcomeTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 440,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
    marginTop: 10,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#D5A943',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8C76D',
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#451014',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(69, 16, 20, 0.75)',
    borderWidth: 1.8,
    borderColor: '#D5A943',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  secondaryButtonText: {
    color: '#D5A943',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  compactPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(69, 16, 20, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(213, 169, 67, 0.4)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  compactPortalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  adminPortalButton: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1.8,
    borderColor: 'rgba(213, 169, 67, 0.25)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  adminPortalButtonText: {
    color: '#A38F78',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  footerNote: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(213, 169, 67, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
  },
  footerText: {
    fontSize: 12,
    color: '#D5A943',
    fontWeight: '600',
  },
});
