import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Platform,
  ScrollView,
  DimensionValue,
} from 'react-native';
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
  const { width, height } = useWindowDimensions();

  // Screen classification for responsiveness
  const isCompactMobile = width < 380;
  const isMobile = width < 600;
  const isTablet = width >= 600 && width < 1024;
  const isShortScreen = height < 700;

  // Dynamically compute dimensions based on screen resolution
  const dynamicMetrics = useMemo(() => {
    // Logo responsive dimensions
    let logoWidth = 360;
    let logoHeight = 300;
    let logoSize: 'sm' | 'md' | 'lg' | 'xl' | 'hero' = 'hero';

    if (isCompactMobile || (isMobile && isShortScreen)) {
      logoWidth = Math.min(200, Math.round(width * 0.58));
      logoHeight = Math.round(logoWidth * 0.82);
      logoSize = 'lg';
    } else if (isMobile) {
      logoWidth = Math.min(270, Math.round(width * 0.72));
      logoHeight = Math.round(logoWidth * 0.82);
      logoSize = 'xl';
    } else if (isShortScreen) {
      logoWidth = 280;
      logoHeight = 230;
      logoSize = 'xl';
    } else if (isTablet) {
      logoWidth = 320;
      logoHeight = 265;
      logoSize = 'hero';
    } else {
      logoWidth = 380;
      logoHeight = 310;
      logoSize = 'hero';
    }

    const titleFontSize = isCompactMobile ? 21 : isMobile ? 24 : isTablet ? 27 : 30;
    const subtitleFontSize = isCompactMobile ? 13 : isMobile ? 14 : 15;
    const buttonPaddingVertical = isShortScreen || isCompactMobile ? 13 : 16;
    const containerMaxWidth = isMobile ? Math.min(480, width - 24) : isTablet ? 530 : 580;
    const buttonMaxWidth: DimensionValue = isMobile ? '100%' : isTablet ? 430 : 460;
    const verticalGap = isShortScreen ? 10 : 13;

    return {
      logoWidth,
      logoHeight,
      logoSize,
      titleFontSize,
      subtitleFontSize,
      buttonPaddingVertical,
      containerMaxWidth,
      buttonMaxWidth,
      verticalGap,
    };
  }, [width, isCompactMobile, isMobile, isTablet, isShortScreen]);

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

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingVertical: isShortScreen ? 14 : 28,
              paddingHorizontal: isCompactMobile ? 12 : 20,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.cardContainer, { maxWidth: dynamicMetrics.containerMaxWidth }]}>
            {/* Ultra Crisp Sultan Logo */}
            <View style={[styles.logoContainer, { marginVertical: isShortScreen ? 4 : 10 }]}>
              <SultanLogo
                size={dynamicMetrics.logoSize}
                width={dynamicMetrics.logoWidth}
                height={dynamicMetrics.logoHeight}
              />
            </View>

            {/* Title & Tagline */}
            <View style={[styles.welcomeTextContainer, { marginVertical: isShortScreen ? 8 : 14 }]}>
              <View style={styles.royalDivider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerStar}>
                  <Ionicons name="sparkles" size={isMobile ? 12 : 14} color="#D5A943" />
                </View>
                <View style={styles.dividerLine} />
              </View>

              <Text style={[styles.welcomeTitle, { fontSize: dynamicMetrics.titleFontSize }]}>
                Authentic Dining Experience
              </Text>
              <Text style={[styles.welcomeSubtitle, { fontSize: dynamicMetrics.subtitleFontSize }]}>
                Taste the royal flavors of the finest Arabian & Continental cuisine crafted with passion and heritage.
              </Text>
            </View>

            {/* Action Buttons */}
            <View
              style={[
                styles.buttonContainer,
                {
                  maxWidth: dynamicMetrics.buttonMaxWidth,
                  gap: dynamicMetrics.verticalGap,
                },
              ]}
            >
              <Link href="/login?role=waiter" asChild>
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.primaryButton,
                    { paddingVertical: dynamicMetrics.buttonPaddingVertical },
                  ])}
                  activeOpacity={0.88}
                >
                  <Ionicons name="walk" size={isMobile ? 18 : 20} color="#451014" style={{ marginRight: 8 }} />
                  <Text style={[styles.primaryButtonText, isMobile && { fontSize: 16 }]}>Order Taker Terminal Login</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/menu" asChild>
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.secondaryButton,
                    { paddingVertical: dynamicMetrics.buttonPaddingVertical },
                  ])}
                  activeOpacity={0.88}
                >
                  <Ionicons name="restaurant-outline" size={isMobile ? 18 : 19} color="#D5A943" style={{ marginRight: 8 }} />
                  <Text style={[styles.secondaryButtonText, isMobile && { fontSize: 15 }]}>View Digital Menu</Text>
                </TouchableOpacity>
              </Link>

              <View style={styles.quickRow}>
                <Link href="/kitchen/kds" asChild>
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      styles.compactPortalBtn,
                      { paddingVertical: isShortScreen ? 10 : 12 },
                    ])}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="flame-outline" size={16} color="#FF6B6B" style={{ marginRight: 5 }} />
                    <Text style={styles.compactPortalText}>Kitchen KDS</Text>
                  </TouchableOpacity>
                </Link>

                <Link href="/juicebar/kds" asChild>
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      styles.compactPortalBtn,
                      { paddingVertical: isShortScreen ? 10 : 12 },
                    ])}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="cafe-outline" size={16} color="#FFA94D" style={{ marginRight: 5 }} />
                    <Text style={styles.compactPortalText}>Juice Bar</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <Link href="/login?all=true" asChild>
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.adminPortalButton,
                    { paddingVertical: dynamicMetrics.buttonPaddingVertical },
                  ])}
                  activeOpacity={0.88}
                >
                  <Ionicons name="key-outline" size={15} color="#A38F78" style={{ marginRight: 6 }} />
                  <Text style={styles.adminPortalButtonText}>Admin & Management Portal</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Footer Royal Badge */}
            <View style={styles.footerNote}>
              <Text style={styles.footerText}>⚡ LAN Multi-Screen Realtime Order Hub Active</Text>
            </View>
          </View>
        </ScrollView>
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
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTextContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  royalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 220,
    marginBottom: 12,
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
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  welcomeSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 460,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#D5A943',
    paddingHorizontal: 22,
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
    paddingHorizontal: 22,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(69, 16, 20, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(213, 169, 67, 0.4)',
    paddingHorizontal: 10,
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
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  adminPortalButtonText: {
    color: '#A38F78',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  footerNote: {
    marginTop: 10,
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
