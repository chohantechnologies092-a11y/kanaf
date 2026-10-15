import QRCode from 'qrcode';
import { Platform } from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';

/**
 * Local Wi-Fi IPv4 address of the host machine.
 * Accessible by any mobile device on the same restaurant Wi-Fi router / mobile hotspot.
 */
export const DEFAULT_LAN_IP = '192.168.1.17';
export const DEFAULT_PORT = '8081';
export const DEFAULT_STABLE_URL = `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;

/**
 * Validates that a feedback URL is reachable and not a dead placeholder, dropped tunnel, or localhost.
 */
function isValidFeedbackUrl(url?: string): boolean {
  if (!url || !url.trim()) return false;
  const clean = url.trim().toLowerCase();
  if (clean.includes('localhost') || clean.includes('127.0.0.1')) return false;
  // Discard dropped/dead ephemeral tunnels and 404 placeholders
  if (clean.includes('sultan-resturant.web.app') || clean.includes('.lhr.life')) return false;
  return true;
}

/**
 * Resolves the online or local network base address for customer-facing portals
 * (QR Codes, WhatsApp Links, Invoices).
 *
 * CRITICAL: Never generates 'localhost', dropped tunnels, or dead undeployed domains!
 */
export function getBaseFeedbackUrl(customOverride?: string): string {
  // 1. Explicit override passed as argument
  if (customOverride && isValidFeedbackUrl(customOverride)) {
    return customOverride.trim().replace(/\/+$/, '');
  }

  // 2. Check environment variable (.env)
  if (process.env.EXPO_PUBLIC_FEEDBACK_ONLINE_URL && isValidFeedbackUrl(process.env.EXPO_PUBLIC_FEEDBACK_ONLINE_URL)) {
    return process.env.EXPO_PUBLIC_FEEDBACK_ONLINE_URL.trim().replace(/\/+$/, '');
  }

  // 3. Check user-configured URL stored in Zustand Store (persisted)
  try {
    const storeUrl = useRestaurantStore.getState().onlineFeedbackUrl;
    if (storeUrl && isValidFeedbackUrl(storeUrl)) {
      return storeUrl.trim().replace(/\/+$/, '');
    }
  } catch {
    // Zustand store may not be ready during early init
  }

  // 4. In Web Browser: Check localStorage
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('sultan_feedback_online_url');
      if (stored && isValidFeedbackUrl(stored)) {
        return stored.trim().replace(/\/+$/, '');
      } else if (stored && (stored.includes('sultan-resturant.web.app') || stored.includes('.lhr.life'))) {
        window.localStorage.removeItem('sultan_feedback_online_url');
      }
    } catch {
      // Ignore
    }

    // If page is accessed via an external public domain (e.g. *.ngrok*, *.exp.direct)
    // or via a LAN IP (e.g. 192.168.x.x), use that exact origin!
    if (window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        host !== '0.0.0.0' &&
        !host.includes('sultan-resturant.web.app') &&
        !host.includes('.lhr.life')
      ) {
        return window.location.origin.replace(/\/+$/, '');
      }
    }
  }

  // 5. Default Fallback: Host Machine Network IP (accessible to all phones on Wi-Fi router)
  return DEFAULT_STABLE_URL;
}

/**
 * Builds the direct URL to the item-wise feedback page for a specific invoice.
 */
export function getInvoiceFeedbackUrl(invoiceId: string, customBaseUrl?: string): string {
  const base = getBaseFeedbackUrl(customBaseUrl);
  return `${base}/feedback?invoiceId=${encodeURIComponent(invoiceId)}`;
}

/**
 * Generates a Base64 PNG Data URL for a scannable QR Code that links directly
 * to the invoice item-wise feedback & review portal.
 */
export async function generateInvoiceQrCode(
  invoiceId: string,
  customBaseUrl?: string
): Promise<string> {
  const targetUrl = getInvoiceFeedbackUrl(invoiceId, customBaseUrl);
  try {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: {
        dark: '#140306', // Royal deep burgundy/black for luxury contrast
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (err) {
    console.warn('Failed to generate QR Code:', err);
    return '';
  }
}
