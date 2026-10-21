import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { initSyncService } from '../services/syncService';
import StockAlarmHost from '../components/StockAlarmHost';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Global Web Error Guard against fontfaceobserver 12000ms timeouts
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event?.reason || '');
    if (reasonStr.includes('timeout exceeded') || reasonStr.includes('fontfaceobserver')) {
      event.preventDefault();
    }
  });
}

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    // Safely warm-up vector icons on web
    if (Platform.OS === 'web') {
      Font.loadAsync(Ionicons.font).catch(() => {});
    }

    // Initialize real-time cross-device sync hub
    initSyncService();

    // Hide splash screen after a short delay to ensure fonts/assets are loaded
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);

    // Universal Web Auto-Interactive Engine:
    // Ensures EVERY card, box, tile, table row, pill, button, and widget animates on hover
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const scanAndMarkElements = () => {
        try {
          const elements = document.querySelectorAll<HTMLElement>(
            '.css-view-175oi2r, [role="button"], button, a, [tabindex="0"]'
          );
          elements.forEach((el) => {
            // Already marked or explicitly opt-out
            if (el.dataset.hover || el.dataset.noHover === 'true') return;

            // Exclude huge containers, root wrappers, modals backdrop
            if (
              el.id === 'root' ||
              el.id === 'sultan-screen-wrapper' ||
              el.offsetHeight > window.innerHeight * 0.88 ||
              el.offsetWidth > window.innerWidth * 0.88
            ) {
              return;
            }

            const style = window.getComputedStyle(el);
            const br = parseFloat(style.borderRadius || '0');
            const hasBg =
              style.backgroundColor &&
              style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
              style.backgroundColor !== 'transparent';
            const hasBorder =
              parseFloat(style.borderWidth || '0') > 0 &&
              style.borderColor !== 'transparent' &&
              style.borderColor !== 'rgba(0, 0, 0, 0)';
            const hasShadow = style.boxShadow && style.boxShadow !== 'none';
            const isPointer = style.cursor === 'pointer';
            const isClickable =
              el.getAttribute('role') === 'button' ||
              el.getAttribute('tabindex') === '0' ||
              el.tagName === 'BUTTON' ||
              el.tagName === 'A';

            // Mark any card, box, button, tile, pill, chip, or interactive row
            if (isClickable || isPointer || (br >= 6 && (hasBg || hasBorder || hasShadow))) {
              el.setAttribute('data-hover', 'true');
            }
          });
        } catch (_) {}
      };

      scanAndMarkElements();
      const interval = setInterval(scanAndMarkElements, 600);

      const observer = new MutationObserver(() => {
        scanAndMarkElements();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        clearInterval(interval);
        observer.disconnect();
      };
    }
  }, []);

  return (
    <>
      {Platform.OS === 'web' && (
        <style>{`
          /* ========================================================
             SULTAN RESTAURANT UNIVERSAL ANIMATION & HOVER ENGINE
             ======================================================== */

          /* 1. Page Landing Entrance Animation */
          @keyframes sultanPageLanding {
            0% {
              opacity: 0;
              transform: translateY(14px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pulseBeacon {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
              box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
            }
            50% {
              transform: scale(1.15);
              opacity: 0.85;
              box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
            }
          }

          @keyframes pulseGlowGold {
            0%, 100% {
              box-shadow: 0 0 12px rgba(212, 175, 55, 0.28);
            }
            50% {
              box-shadow: 0 0 26px rgba(212, 175, 55, 0.65);
            }
          }

          @keyframes shieldGlow {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4), 0 8px 24px rgba(220, 38, 38, 0.15);
              transform: scale(1);
            }
            50% {
              box-shadow: 0 0 0 12px rgba(220, 38, 38, 0), 0 14px 32px rgba(220, 38, 38, 0.28);
              transform: scale(1.04);
            }
          }

          /* Every screen entry / page landing */
          .sultan-page-enter,
          [data-page-enter="true"],
          [data-page-landing="true"],
          #sultan-screen-wrapper {
            animation: sultanPageLanding 0.35s cubic-bezier(0.16, 1, 0.3, 1) both !important;
          }

          /* 2. UNIVERSAL HOVER: Every Button, Card, Tile, Chip, Box, Row */
          [role="button"],
          button,
          a,
          [tabindex="0"],
          [data-card],
          [data-hover],
          [data-interactive],
          [data-tile],
          [data-box],
          [data-pill],
          [data-row],
          [data-stagger],
          .interactive-card,
          .kpi-jewel-card,
          .stat-card,
          .info-box {
            transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                        box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                        filter 0.22s ease,
                        border-color 0.22s ease !important;
          }

          /* Smooth hover lift + shadow + gold accent rim */
          [role="button"]:hover,
          button:hover,
          a:hover,
          [tabindex="0"]:hover,
          [data-card]:hover,
          [data-hover]:hover,
          [data-interactive]:hover,
          [data-tile]:hover,
          [data-box]:hover,
          [data-pill]:hover,
          [data-row]:hover,
          [data-stagger]:hover,
          .interactive-card:hover,
          .kpi-jewel-card:hover,
          .stat-card:hover,
          .info-box:hover {
            transform: translateY(-3.5px) scale(1.008) !important;
            filter: brightness(1.04) !important;
            box-shadow: 0 14px 32px rgba(82, 20, 28, 0.14), 0 0 0 1.5px rgba(212, 175, 55, 0.5) !important;
            z-index: 5 !important;
          }

          /* Micro-scale feedback on click / tap */
          [role="button"]:active,
          button:active,
          a:active,
          [tabindex="0"]:active,
          [data-card]:active,
          [data-hover]:active,
          [data-interactive]:active,
          [data-tile]:active,
          [data-box]:active,
          [data-pill]:active,
          [data-row]:active,
          .interactive-card:active {
            transform: translateY(-0.5px) scale(0.975) !important;
            filter: brightness(0.98) !important;
          }

          /* Sidebar item slide effect */
          [data-nav="item"]:hover {
            transform: translateX(4px) scale(1.01) !important;
            background: rgba(212, 175, 55, 0.14) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(212, 175, 55, 0.4) !important;
          }

          /* Input subtle glow on focus */
          input:focus, textarea:focus, select:focus {
            outline: none !important;
            border-color: rgba(212, 175, 55, 0.8) !important;
            box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25) !important;
          }

          /* Beacons and shields */
          [data-pulse="beacon"],
          .pulse-beacon {
            animation: pulseBeacon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
          }

          [data-shield-ring="true"],
          .animated-shield-ring {
            animation: shieldGlow 2.8s infinite ease-in-out !important;
          }
        `}</style>
      )}

      {/* Screen container with key={pathname} to trigger page landing animation on every route change */}
      <View
        id="sultan-screen-wrapper"
        key={pathname}
        style={{ flex: 1 }}
        {...(Platform.OS === 'web' ? ({ dataSet: { pageLanding: 'true', pageEnter: 'true' } } as any) : {})}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>

      {/* Live stock / kitchen handover alarms for admin, manager and kitchen roles */}
      <StockAlarmHost />
    </>
  );
}
