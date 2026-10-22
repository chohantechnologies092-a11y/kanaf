import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuthStore, ROLE_HOME, getRoleHome } from '../store';
import IslamicBackground from '../components/IslamicBackground';
import SultanLogo from '../components/SultanLogo';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { width, height } = useWindowDimensions();

  // Screen classification for responsiveness
  const isCompactMobile = width < 420;
  const isMobile = width < 860;
  const isShortScreen = height < 720;

  // -------------------------------------------------------------
  // Splash & Transition States
  // -------------------------------------------------------------
  const [showSplash, setShowSplash] = useState(true);
  const [splashStatusIndex, setSplashStatusIndex] = useState(0);

  const splashMessages = [
    'Initializing Artisan Bakery & Coffee Suite...',
    'Connecting Realtime Multi-Floor Hub...',
    'Loading Kanaf POS & Kitchen KDS...',
    'Welcome to Kanaf Cafe & Bakery ✨',
  ];

  // Animation values
  const splashFadeAnim = useRef(new Animated.Value(1)).current;
  const splashScaleAnim = useRef(new Animated.Value(0.9)).current;
  const splashPulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeSlideAnim = useRef(new Animated.Value(20)).current;

  // -------------------------------------------------------------
  // Splash Lifecycle & Animation Sequence
  // -------------------------------------------------------------
  useEffect(() => {
    // 1. Entrance spring & logo pulse loop
    Animated.spring(splashScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(splashPulseAnim, {
          toValue: 1.05,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(splashPulseAnim, {
          toValue: 0.98,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 2. Linear smooth progress bar (2100ms)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2100,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();

    // 3. Status text stepper
    const t1 = setTimeout(() => setSplashStatusIndex(1), 600);
    const t2 = setTimeout(() => setSplashStatusIndex(2), 1250);
    const t3 = setTimeout(() => setSplashStatusIndex(3), 1800);

    // 4. Smooth Transition from Splash to Welcome Screen
    const tFinish = setTimeout(() => {
      finishSplash();
    }, 2300);

    return () => {
      pulseLoop.stop();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tFinish);
    };
  }, []);

  const finishSplash = () => {
    Animated.timing(splashFadeAnim, {
      toValue: 0,
      duration: 450,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setShowSplash(false);
      Animated.parallel([
        Animated.timing(welcomeFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(welcomeSlideAnim, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Dynamically compute dimensions based on screen resolution
  const dynamicMetrics = useMemo(() => {
    let logoWidth = 320;
    let logoHeight = 270;
    let logoSize: 'sm' | 'md' | 'lg' | 'xl' | 'hero' = 'hero';

    if (isCompactMobile) {
      logoWidth = 200;
      logoHeight = 165;
      logoSize = 'lg';
    } else if (isMobile) {
      logoWidth = 250;
      logoHeight = 210;
      logoSize = 'xl';
    } else {
      logoWidth = 340;
      logoHeight = 285;
      logoSize = 'hero';
    }

    const titleFontSize = isCompactMobile ? 22 : isMobile ? 26 : 30;
    const subtitleFontSize = isCompactMobile ? 12 : isMobile ? 13 : 14;

    return {
      logoWidth,
      logoHeight,
      logoSize,
      titleFontSize,
      subtitleFontSize,
    };
  }, [isCompactMobile, isMobile]);

  return (
    <IslamicBackground theme="burgundy" showCorners={true} showCenterLattice={true}>
      <StatusBar barStyle="light-content" backgroundColor="#2A060B" />

      {/* ============================================================
          PHASE 1: SULTAN ROYAL ANIMATED SPLASH SCREEN
          ============================================================ */}
      {showSplash && (
        <Animated.View
          style={[
            styles.splashOverlay,
            {
              opacity: splashFadeAnim,
            },
          ]}
        >
          {/* Skip Button */}
          <TouchableOpacity
            style={styles.splashSkipBtn}
            onPress={finishSplash}
            activeOpacity={0.75}
          >
            <Text style={styles.splashSkipText}>Skip ➔</Text>
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.splashContent,
              {
                transform: [
                  { scale: splashScaleAnim },
                  { scale: splashPulseAnim },
                ],
              },
            ]}
          >
            {/* Clean Logo Badge */}
            <View style={styles.splashLogoAura}>
              <SultanLogo
                size="hero"
                width={dynamicMetrics.logoWidth}
                height={dynamicMetrics.logoHeight}
                style={styles.logoDropShadow}
              />
            </View>

            {/* Urdu & English Kanaf Typography */}
            <View style={styles.splashTitleBox}>
              <Text style={styles.splashUrduCalligraphy}>کناف کیفے اینڈ بیکری</Text>
              <Text style={styles.splashEnglishTitle}>KANAF CAFE & BAKERY</Text>
              <Text style={styles.splashTagline}>Artisan Bakery • Specialty Coffee • Smart POS</Text>
            </View>

            {/* Gold Shimmer Loading Bar */}
            <View style={styles.splashProgressWrapper}>
              <View style={styles.splashProgressTrack}>
                <Animated.View
                  style={[
                    styles.splashProgressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.splashStatusText}>
                {splashMessages[splashStatusIndex]}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* ============================================================
          PHASE 2: GRAND SULTAN WELCOME SCREEN (SPLIT 2-COLUMN LAYOUT)
          [LEFT COLUMN: Grand Logo & Aura] [RIGHT COLUMN: Info & Actions]
          ============================================================ */}
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.animatedWelcomeContainer,
            {
              opacity: welcomeFadeAnim,
              transform: [{ translateY: welcomeSlideAnim }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingVertical: isShortScreen ? 14 : 28,
                paddingHorizontal: isCompactMobile ? 12 : 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.splitMainCard, isMobile && styles.splitMainCardMobile]}>
              
              {/* ----------------------------------------------------
                  LEFT SIDE: GRAND SULTAN LOGO & ROYAL AURA
                  ---------------------------------------------------- */}
              <View style={[styles.leftColumnLogoBox, isMobile && styles.leftColumnLogoBoxMobile]}>
                <View style={styles.logoCardWrapper}>
                  {/* Clean Logo without background box */}
                  <View style={styles.logoAuraRing}>
                    <SultanLogo
                      size={dynamicMetrics.logoSize}
                      width={isMobile ? dynamicMetrics.logoWidth : 330}
                      height={isMobile ? dynamicMetrics.logoHeight : 280}
                      style={styles.logoDropShadow}
                    />
                  </View>

                  {/* Urdu Calligraphy & Royal Crest Subtitle */}
                  <Text style={styles.leftUrduCalligraphy}>کناف کیفے اینڈ بیکری</Text>

                  <View style={styles.leftRoyalDivider}>
                    <View style={styles.leftDividerLine} />
                    <Ionicons name="sparkles" size={12} color="#FFE0CB" style={{ marginHorizontal: 6 }} />
                    <View style={styles.leftDividerLine} />
                  </View>

                  <Text style={styles.leftSubBadgeText}>
                    ARTISAN BAKERY & SPECIALTY COFFEE
                  </Text>
                  <Text style={styles.leftEstText}>
                    Handcrafted Bakes • Espresso Bar • Smart Operations
                  </Text>
                </View>
              </View>

              {/* ----------------------------------------------------
                  RIGHT SIDE: WELCOME TITLE, FEATURES & LOGIN GATEWAY
                  ---------------------------------------------------- */}
              <View style={[styles.rightColumnContent, isMobile && styles.rightColumnContentMobile]}>
                
                {/* Header Welcome Badges */}
                <View style={[styles.welcomeHeaderBox, isMobile && { alignItems: 'center' }]}>
                  <View style={styles.welcomeUrduBadge}>
                    <Ionicons name="sparkles" size={13} color="#B45309" style={{ marginRight: 5 }} />
                    <Text style={styles.welcomeUrduText}>خوش آمدید</Text>
                  </View>

                  <Text style={[styles.welcomeTitle, { fontSize: dynamicMetrics.titleFontSize }, isMobile && { textAlign: 'center' }]}>
                    KANAF CAFE & BAKERY
                  </Text>
                  
                  <Text style={[styles.welcomeSubtitle, { fontSize: dynamicMetrics.subtitleFontSize }, isMobile && { textAlign: 'center' }]}>
                    Welcome to Kanaf Cafe & Bakery. Experience handcrafted bakes, specialty artisanal brews, and seamless automated management.
                  </Text>
                </View>

                {/* 4 Feature Cards Grid */}
                <View style={styles.featuresGrid}>
                  <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(212, 175, 55, 0.16)' }]}>
                      <Ionicons name="restaurant" size={17} color="#D5A943" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Royal Dine-In</Text>
                      <Text style={styles.featureDesc}>5-Floor Tables & VIP Cabins</Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.16)' }]}>
                      <Ionicons name="flash" size={17} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Express POS</Text>
                      <Text style={styles.featureDesc}>Touch Billing & Thermal Receipts</Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(244, 63, 94, 0.16)' }]}>
                      <Ionicons name="flame" size={17} color="#FB7185" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Kitchen & Bar KDS</Text>
                      <Text style={styles.featureDesc}>Multi-Station Live LAN Routing</Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(52, 211, 153, 0.16)' }]}>
                      <Ionicons name="diamond" size={17} color="#34D399" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>VIP Guest CRM</Text>
                      <Text style={styles.featureDesc}>Points & WhatsApp Invoicing</Text>
                    </View>
                  </View>
                </View>

                {/* Active Session Alert (If signed in) */}
                {hasHydrated && user?.role && (
                  <View style={styles.activeSessionBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                      <Text style={styles.activeSessionText}>
                        Signed in as <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>{user.name}</Text> ({user.role.toUpperCase()})
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resumeDashboardBtn}
                      onPress={() => {
                        const target = getRoleHome(user.role, user.customRoleId);
                        router.replace(target as any);
                      }}
                    >
                      <Text style={styles.resumeDashboardText}>Dashboard ➔</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Buttons Section */}
                <View style={styles.buttonContainer}>
                  {/* 1. PRIMARY: Proceed to Staff Login */}
                  <TouchableOpacity
                    style={styles.primaryLoginBtn}
                    onPress={() => router.push('/login?all=true' as any)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.btnIconPod}>
                      <Ionicons name="log-in" size={18} color="#451014" />
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={styles.primaryLoginBtnText}>PROCEED TO LOGIN</Text>
                      <Text style={styles.primaryLoginBtnSub}>لاگ ان کرنے کے لیے یہاں کلک کریں</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color="#451014" />
                  </TouchableOpacity>

                  {/* 2. SECONDARY: Digital Menu */}
                  <TouchableOpacity
                    style={styles.secondaryMenuBtn}
                    onPress={() => router.push('/menu' as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="book-outline" size={17} color="#D5A943" style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryMenuBtnText}>EXPLORE GUEST DIGITAL MENU</Text>
                  </TouchableOpacity>

                  {/* 3. Direct Department Shortcuts */}
                  <Text style={styles.quickPortalsHeading}>Direct Role Terminals:</Text>
                  <View style={styles.quickPortalsRow}>
                    <Link href="/login?role=admin&all=true" asChild>
                      <TouchableOpacity style={styles.quickPortalChip}>
                        <Ionicons name="shield-checkmark-outline" size={12} color="#D5A943" />
                        <Text style={styles.quickPortalChipText}>Cashier / Admin</Text>
                      </TouchableOpacity>
                    </Link>

                    <Link href="/login?role=waiter" asChild>
                      <TouchableOpacity style={styles.quickPortalChip}>
                        <Ionicons name="walk-outline" size={12} color="#D5A943" />
                        <Text style={styles.quickPortalChipText}>Order Taker</Text>
                      </TouchableOpacity>
                    </Link>

                    <Link href="/kitchen/kds" asChild>
                      <TouchableOpacity style={styles.quickPortalChip}>
                        <Ionicons name="flame-outline" size={12} color="#FB7185" />
                        <Text style={styles.quickPortalChipText}>Kitchen KDS</Text>
                      </TouchableOpacity>
                    </Link>

                    <Link href="/juicebar/kds" asChild>
                      <TouchableOpacity style={styles.quickPortalChip}>
                        <Ionicons name="cafe-outline" size={12} color="#FFA94D" />
                        <Text style={styles.quickPortalChipText}>Juice Bar</Text>
                      </TouchableOpacity>
                    </Link>
                  </View>
                </View>

                {/* Footer Note */}
                <View style={styles.footerNote}>
                  <Text style={styles.footerText}>⚡ Kanaf Automated Cafe, Bakery & Multi-Screen Suite</Text>
                </View>

              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </IslamicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedWelcomeContainer: {
    flex: 1,
  },

  /* ------------------------------------------------------------
     SPLASH OVERLAY STYLES
     ------------------------------------------------------------ */
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#34010E', // Kanaf Deep Wine Burgundy
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  splashSkipBtn: {
    position: 'absolute',
    top: 40,
    right: 24,
    backgroundColor: 'rgba(213, 169, 67, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
  },
  splashSkipText: {
    color: '#D5A943',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
  },
  splashLogoAura: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashTitleBox: {
    alignItems: 'center',
    marginVertical: 10,
  },
  splashUrduCalligraphy: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFE0CB',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 4,
  },
  splashEnglishTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  splashTagline: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  splashProgressWrapper: {
    width: '82%',
    maxWidth: 320,
    marginTop: 30,
    alignItems: 'center',
  },
  splashProgressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(213, 169, 67, 0.3)',
  },
  splashProgressBar: {
    height: '100%',
    backgroundColor: '#FFE0CB',
    borderRadius: 4,
  },
  splashStatusText: {
    color: 'rgba(213, 169, 67, 0.9)',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.4,
  },

  /* ------------------------------------------------------------
     WELCOME SCREEN 2-COLUMN SPLIT STYLES
     ------------------------------------------------------------ */
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitMainCard: {
    width: '100%',
    maxWidth: 1140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(44, 1, 12, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.35)',
    borderRadius: 28,
    padding: 28,
    gap: 32,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      } as any,
    }),
  },
  splitMainCardMobile: {
    flexDirection: 'column',
    padding: 16,
    gap: 18,
    borderRadius: 20,
  },

  /* LEFT COLUMN: LOGO & BRANDING */
  leftColumnLogoBox: {
    width: '42%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftColumnLogoBoxMobile: {
    width: '100%',
  },
  logoCardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  logoAuraRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoDropShadow: {
    ...Platform.select({
      web: {
        filter: 'drop-shadow(0px 8px 24px rgba(213, 169, 67, 0.42))',
      } as any,
    }),
  },
  leftUrduCalligraphy: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFE0CB',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  leftRoyalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 180,
    marginVertical: 10,
  },
  leftDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
  },
  leftSubBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  leftEstText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },

  /* RIGHT COLUMN: WELCOME, FEATURES & ACTIONS */
  rightColumnContent: {
    flex: 1,
    width: '100%',
  },
  rightColumnContentMobile: {
    width: '100%',
  },
  welcomeHeaderBox: {
    marginBottom: 16,
  },
  welcomeUrduBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 243, 199, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  welcomeUrduText: {
    color: '#92400E',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  welcomeTitle: {
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  welcomeSubtitle: {
    color: 'rgba(255, 255, 255, 0.86)',
    lineHeight: 20,
    fontWeight: '500',
  },

  /* Feature Showcase Grid */
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  featureCard: {
    width: '48%',
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.25)',
    borderRadius: 14,
    padding: 10,
    gap: 9,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
      } as any,
    }),
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  featureDesc: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },

  /* Active Session Banner */
  activeSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  activeSessionText: {
    fontSize: 11.5,
    color: '#D1FAE5',
  },
  resumeDashboardBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resumeDashboardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Action Buttons Container */
  buttonContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 6,
  },
  primaryLoginBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFE0CB',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FFF0E5',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 24px rgba(255, 224, 203, 0.35)',
        cursor: 'pointer',
        transition: 'transform 0.18s ease',
      } as any,
      ios: {
        shadowColor: '#FFE0CB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  btnIconPod: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(68, 1, 18, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLoginBtnText: {
    color: '#440112',
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  primaryLoginBtnSub: {
    color: '#5C021A',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  secondaryMenuBtn: {
    flexDirection: 'row',
    backgroundColor: 'rgba(68, 1, 18, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 203, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
        cursor: 'pointer',
      } as any,
    }),
  },
  secondaryMenuBtnText: {
    color: '#FFE0CB',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* Quick Portals Chips */
  quickPortalsHeading: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  quickPortalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
  },
  quickPortalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  quickPortalChipText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Footer Note */
  footerNote: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(213, 169, 67, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(213, 169, 67, 0.22)',
    alignSelf: 'center',
  },
  footerText: {
    fontSize: 10.5,
    color: '#D5A943',
    fontWeight: '700',
    textAlign: 'center',
  },
});
