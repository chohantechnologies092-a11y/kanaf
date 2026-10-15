import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useOpsStore } from '../store/opsStore';
import { useKitchenStore } from '../store/kitchenStore';
import { useAlertStore } from '../store/alertStore';
import { buildAlerts, type AlertSeverity, type StockAlert } from '../utils/kitchenForecast';

/**
 * Global alarm host (mounted once in the root layout).
 * Watches kitchen handovers + store inventory, shows a floating bell with the live alert count,
 * pops a banner and beeps / vibrates when something new becomes critical, and repeats the
 * alarm every few minutes until it is fixed or snoozed.
 */

const BRAND = {
  burgundy: '#52171B',
  gold: '#D5A943',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
};

const SEV: Record<AlertSeverity, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  critical: { color: '#C62828', bg: '#FFEBEE', icon: 'alert-circle', label: 'URGENT' },
  warning: { color: '#E65100', bg: '#FFF3E0', icon: 'warning', label: 'LOW' },
  info: { color: '#6A1B9A', bg: '#F3E5F5', icon: 'information-circle', label: 'HEADS-UP' },
};

const REPEAT_CRITICAL_MS = 5 * 60 * 1000;
const SNOOZE_MIN = 30;

function playAlarm(severity: AlertSeverity) {
  if (Platform.OS === 'web') {
    try {
      const g = globalThis as unknown as {
        AudioContext?: new () => AudioContext;
        webkitAudioContext?: new () => AudioContext;
      };
      const Ctx = g.AudioContext || g.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const freqs = severity === 'critical' ? [880, 660, 880, 660] : [660, 520];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.28;
        osc.start(t);
        osc.stop(t + 0.2);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1800);
    } catch {
      // Browsers block audio until the user has interacted with the page - ignore.
    }
  } else {
    Vibration.vibrate(severity === 'critical' ? [0, 500, 200, 500, 200, 500] : [0, 300, 150, 300]);
  }
}

function routeFor(alert: StockAlert, role: string | null | undefined): string {
  if (role === 'kitchen') return '/kitchen/day';
  const base = role === 'manager' ? '/manager' : '/admin';
  switch (alert.kind) {
    case 'shift_out':
    case 'shift_low':
    case 'shift_short':
      return `${base}/kitchen-handover`;
    case 'no_recipe':
      return `${base}/recipes`;
    default:
      return `${base}/inventory`;
  }
}

export default function StockAlarmHost() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const bottomOffset = (isMobile ? 76 : 24) + insets.bottom;

  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const enabled = role === 'admin' || role === 'manager' || role === 'kitchen';

  const sessions = useKitchenStore((s) => s.kitchenSessions);
  const consumption = useKitchenStore((s) => s.kitchenConsumption);
  const manual = useKitchenStore((s) => s.kitchenManualUsage);
  const recipes = useKitchenStore((s) => s.recipes);
  const settings = useKitchenStore((s) => s.kitchenSettings);
  const updateSettings = useKitchenStore((s) => s.updateSettings);
  const inventory = useOpsStore((s) => s.inventory);

  const snoozedUntil = useAlertStore((s) => s.snoozedUntil);
  const snooze = useAlertStore((s) => s.snooze);
  const prune = useAlertStore((s) => s.prune);

  // Time-based rules (runway, expiry) need a clock; keep it in state so render stays pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const alerts = useMemo(
    () =>
      enabled
        ? buildAlerts({ sessions, consumption, manual, recipes, inventory, settings, now })
        : [],
    [enabled, sessions, consumption, manual, recipes, inventory, settings, now]
  );

  const visible = useMemo(() => alerts.filter((a) => (snoozedUntil[a.id] || 0) <= now), [alerts, snoozedUntil, now]);
  const criticalCount = visible.filter((a) => a.severity === 'critical').length;
  const topSeverity: AlertSeverity | null = criticalCount > 0 ? 'critical' : visible.some((a) => a.severity === 'warning') ? 'warning' : visible.length > 0 ? 'info' : null;

  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<StockAlert | null>(null);

  // Announce new alerts + repeat unresolved critical ones.
  const knownRef = useRef<Set<string>>(new Set());
  const initialisedRef = useRef(false);
  const lastCriticalBeepRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const known = knownRef.current;
    const fresh = visible.filter((a) => a.severity !== 'info' && !known.has(a.id));
    // On first load only announce if something is already critical.
    const toAnnounce = initialisedRef.current ? fresh : fresh.filter((a) => a.severity === 'critical');
    initialisedRef.current = true;
    known.clear();
    visible.forEach((a) => known.add(a.id));

    const repeatDue = criticalCount > 0 && now - lastCriticalBeepRef.current >= REPEAT_CRITICAL_MS;
    if (toAnnounce.length > 0 || repeatDue) {
      const top = toAnnounce.find((a) => a.severity === 'critical') || toAnnounce[0] || visible.find((a) => a.severity === 'critical');
      if (settings.alarmSound) playAlarm(top?.severity === 'critical' || repeatDue ? 'critical' : 'warning');
      if (top) setToast(top);
      if (top?.severity === 'critical') lastCriticalBeepRef.current = now;
    }
  }, [visible, criticalCount, enabled, now, settings.alarmSound]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    prune();
  }, [now, prune]);

  // Bell pulse
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (topSeverity !== 'critical') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [topSeverity, pulse]);

  if (!enabled || visible.length === 0) return null;

  const snoozeAll = () => {
    snooze(visible.map((a) => a.id), SNOOZE_MIN);
    setPanelOpen(false);
    setToast(null);
  };

  const openFix = (a: StockAlert) => {
    setPanelOpen(false);
    setToast(null);
    router.push(routeFor(a, role) as never);
  };

  const sev = topSeverity ? SEV[topSeverity] : SEV.info;

  return (
    <>
      {/* Banner for newly raised alarms */}
      {toast && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setToast(null);
            setPanelOpen(true);
          }}
          style={[styles.toast, { top: insets.top + 8, borderLeftColor: SEV[toast.severity].color }]}
        >
          <Ionicons name={SEV[toast.severity].icon} size={22} color={SEV[toast.severity].color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle} numberOfLines={1}>
              {toast.title}
            </Text>
            <Text style={styles.toastDetail} numberOfLines={2}>
              {toast.detail}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={BRAND.muted} />
        </TouchableOpacity>
      )}

      {/* Floating bell */}
      <Animated.View style={[styles.fabWrap, { bottom: bottomOffset, transform: [{ scale: pulse }] }]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: sev.color }]}
          onPress={() => setPanelOpen(true)}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="notifications" size={26} color="#FFFFFF" />
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{visible.length > 99 ? '99+' : visible.length}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Alert panel */}
      <Modal visible={panelOpen} animationType="slide" transparent onRequestClose={() => setPanelOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Stock & Kitchen Alarms</Text>
                <Text style={styles.panelSub}>
                  {criticalCount} urgent • {visible.length} active
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPanelOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.panelToolbar}>
              <View style={styles.soundRow}>
                <Ionicons name={settings.alarmSound ? 'volume-high' : 'volume-mute'} size={18} color={BRAND.burgundy} />
                <Text style={styles.soundText}>Alarm sound / vibration</Text>
                <Switch
                  value={settings.alarmSound}
                  onValueChange={(v) => updateSettings({ alarmSound: v })}
                  trackColor={{ true: BRAND.gold, false: '#CFCFCF' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity style={styles.snoozeAllBtn} onPress={snoozeAll} activeOpacity={0.85}>
                <Ionicons name="alarm-outline" size={16} color="#FFFFFF" />
                <Text style={styles.snoozeAllText}>Snooze all {SNOOZE_MIN} min</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
              {visible.map((a) => {
                const m = SEV[a.severity];
                return (
                  <View key={a.id} style={[styles.card, { borderLeftColor: m.color }]}>
                    <View style={[styles.cardIcon, { backgroundColor: m.bg }]}>
                      <Ionicons name={m.icon} size={20} color={m.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.sevTag, { color: m.color, backgroundColor: m.bg }]}>{m.label}</Text>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {a.title}
                        </Text>
                      </View>
                      <Text style={styles.cardDetail}>{a.detail}</Text>
                      <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.fixBtn} onPress={() => openFix(a)} activeOpacity={0.85}>
                          <Text style={styles.fixBtnText}>Fix now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.snoozeBtn}
                          onPress={() => snooze([a.id], SNOOZE_MIN)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.snoozeBtnText}>Snooze {SNOOZE_MIN}m</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: 560,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  toastTitle: { fontSize: 14, fontWeight: '800', color: BRAND.ink },
  toastDetail: { fontSize: 12, color: BRAND.muted, marginTop: 2 },
  fabWrap: { position: 'absolute', right: 16, zIndex: 9998, elevation: 19 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BRAND.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fabBadgeText: { fontSize: 11, fontWeight: '900', color: BRAND.burgundy },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  panel: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    backgroundColor: '#FDFBF7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.burgundy,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  panelSub: { color: BRAND.gold, fontSize: 12, fontWeight: '700', marginTop: 2 },
  panelToolbar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: '#FFFFFF',
  },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soundText: { flex: 1, fontSize: 13, fontWeight: '700', color: BRAND.ink },
  snoozeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    borderRadius: 8,
    paddingVertical: 9,
    minHeight: 40,
  },
  snoozeAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderLeftWidth: 5,
    padding: 12,
  },
  cardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sevTag: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: BRAND.ink },
  cardDetail: { fontSize: 12, color: BRAND.muted, marginTop: 4, lineHeight: 17 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  fixBtn: {
    backgroundColor: BRAND.burgundy,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  fixBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  snoozeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  snoozeBtnText: { color: BRAND.muted, fontWeight: '700', fontSize: 12 },
});
