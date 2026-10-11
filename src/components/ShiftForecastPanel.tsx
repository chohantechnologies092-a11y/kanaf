import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKitchenStore } from '../store/kitchenStore';
import type { KitchenSession } from '../types/kitchen';
import { SHIFT_KIND_META, SHIFT_STATION_META } from '../types/kitchen';
import { formatQty, money } from '../utils/kitchenMath';
import {
  computeSessionForecast,
  formatEta,
  RISK_META,
  type ForecastLine,
  type RiskLevel,
} from '../utils/kitchenForecast';

const BRAND = {
  burgundy: '#52171B',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  cream: '#FDFBF7',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
};

const RISK_RANK: Record<RiskLevel, number> = { out: 0, critical: 1, low: 2, watch: 3, ok: 4 };

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const fmtHour = (h: number) => {
  const hr = ((h % 24) + 24) % 24;
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:00 ${suffix}`;
};

/** Short label for a shift: "Morning • Main Kitchen • Chef Omar". */
export function shiftTitle(s: KitchenSession): string {
  const parts: string[] = [];
  if (s.shift) parts.push(SHIFT_KIND_META[s.shift].label);
  if (s.station && s.station !== 'all') parts.push(SHIFT_STATION_META[s.station].label);
  parts.push(s.headChef);
  return parts.join(' • ');
}

// ---------------------------------------------------------------------------
// Forecast panel
// ---------------------------------------------------------------------------

export default function ShiftForecastPanel({
  session,
  onOpenSettings,
}: {
  session: KitchenSession;
  onOpenSettings?: () => void;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const sessions = useKitchenStore((s) => s.kitchenSessions);
  const consumption = useKitchenStore((s) => s.kitchenConsumption);
  const manual = useKitchenStore((s) => s.kitchenManualUsage);
  const settings = useKitchenStore((s) => s.kitchenSettings);

  // Clock lives in state (not Date.now() during render).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const [showAll, setShowAll] = useState(false);

  const f = useMemo(
    () => computeSessionForecast(session, sessions, consumption, manual, settings, now),
    [session, sessions, consumption, manual, settings, now]
  );

  const sorted = useMemo(
    () => [...f.lines].sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.pctLeft - b.pctLeft),
    [f.lines]
  );
  const shown = showAll ? sorted : sorted.slice(0, 8);

  const shortLines = f.lines.filter((l) => l.shortfall > 0);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="analytics" size={18} color={BRAND.burgundy} />
            <Text style={styles.title}>Evening Forecast</Text>
            <Text style={styles.titleSub} numberOfLines={1}>
              {shiftTitle(session)}
            </Text>
          </View>
          <Text style={styles.subline}>
            Live from POS • updated {fmtTime(now)} •{' '}
            {f.hoursToClose > 0
              ? `${f.hoursToClose.toFixed(1)} h until closing (${fmtHour(settings.closingHour)})`
              : 'past closing time'}
          </Text>
        </View>
        {onOpenSettings && (
          <TouchableOpacity style={styles.gearBtn} onPress={onOpenSettings} activeOpacity={0.8}>
            <Ionicons name="settings-outline" size={18} color={BRAND.burgundy} />
          </TouchableOpacity>
        )}
      </View>

      {/* Money row */}
      <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Sales so far</Text>
          <Text style={styles.kpiValue}>{money(f.revenue)}</Text>
          <Text style={styles.kpiSub}>{f.dishesSold} plates</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Profit so far</Text>
          <Text style={[styles.kpiValue, { color: f.grossProfit >= 0 ? BRAND.success : BRAND.danger }]}>
            {money(f.grossProfit)}
          </Text>
          <Text style={styles.kpiSub}>{f.marginPct.toFixed(0)}% margin • cost {money(f.cost)}</Text>
        </View>
        <View style={[styles.kpi, styles.kpiHighlight]}>
          <Text style={styles.kpiLabel}>Expected sales by closing</Text>
          <Text style={styles.kpiValue}>{money(f.projectedRevenue)}</Text>
          <Text style={styles.kpiSub}>~{Math.round(f.projectedDishes)} plates</Text>
        </View>
        <View style={[styles.kpi, styles.kpiHighlight]}>
          <Text style={styles.kpiLabel}>Expected profit by closing</Text>
          <Text style={[styles.kpiValue, { color: f.projectedProfit >= 0 ? BRAND.success : BRAND.danger }]}>
            {money(f.projectedProfit)}
          </Text>
          <Text style={styles.kpiSub}>after ingredient cost</Text>
        </View>
      </View>

      {/* Return vs extra */}
      <View style={[styles.splitRow, isMobile && { flexDirection: 'column' }]}>
        <View style={[styles.splitCard, { borderLeftColor: BRAND.success, backgroundColor: '#F1F8F2' }]}>
          <Ionicons name="return-down-back" size={22} color={BRAND.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.splitLabel}>Chef should return in the evening</Text>
            <Text style={[styles.splitValue, { color: BRAND.success }]}>{money(f.expectedReturnValue)}</Text>
            <Text style={styles.splitSub}>
              {f.lines.filter((l) => l.leftover > 0).length} items expected back (cost value)
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.splitCard,
            { borderLeftColor: BRAND.danger, backgroundColor: f.extraNeededValue > 0 ? '#FDF1F1' : '#F7F7F7' },
          ]}
        >
          <Ionicons name="add-circle" size={22} color={f.extraNeededValue > 0 ? BRAND.danger : BRAND.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.splitLabel}>Extra needed beyond handover</Text>
            <Text style={[styles.splitValue, { color: f.extraNeededValue > 0 ? BRAND.danger : BRAND.muted }]}>
              {money(f.extraNeededValue)}
            </Text>
            <Text style={styles.splitSub}>
              {shortLines.length === 0
                ? 'Handover looks enough for today'
                : `${shortLines.length} items will run short - top up from store`}
            </Text>
          </View>
        </View>
      </View>

      {f.missingRecipeCount > 0 && (
        <View style={styles.warnBox}>
          <Ionicons name="warning" size={16} color={BRAND.warn} />
          <Text style={styles.warnText}>
            {f.missingRecipeCount} sold item(s) have no recipe - their stock use and cost are not counted. Add recipes
            for accurate numbers.
          </Text>
        </View>
      )}

      {/* Items */}
      <Text style={styles.sectionTitle}>
        Ingredients ({f.lines.length}) {f.attentionCount > 0 ? `• ${f.attentionCount} need attention` : '• all healthy'}
      </Text>

      {shown.map((l) => (
        <LineRow key={l.itemId} line={l} />
      ))}

      {sorted.length > 8 && (
        <TouchableOpacity style={styles.showAllBtn} onPress={() => setShowAll(!showAll)} activeOpacity={0.8}>
          <Text style={styles.showAllText}>{showAll ? 'Show fewer' : `Show all ${sorted.length} items`}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footnote}>
        Estimate method: {f.usedHourlyPattern ? 'busy / quiet hours from past days' : 'current POS pace'}
        {f.usedHistory ? ' + your last closed shifts' : ' (no closed shifts yet - accuracy improves after a few days)'}.
      </Text>
    </View>
  );
}

function LineRow({ line: l }: { line: ForecastLine }) {
  const meta = RISK_META[l.risk];
  const closing =
    l.shortfall > 0
      ? { text: `Short ~${formatQty(l.shortfall, l.unit)} by closing`, color: BRAND.danger }
      : { text: `Return ~${formatQty(l.leftover, l.unit)} in evening`, color: BRAND.success };
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.lineName}>{l.itemName}</Text>
          <View style={[styles.pill, { backgroundColor: meta.bg }]}>
            <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.lineMeta}>
          In kitchen now {formatQty(Math.max(0, l.expectedOnHand), l.unit)} of {formatQty(l.totalIn, l.unit)} •{' '}
          {Math.round(Math.max(0, l.pctLeft) * 100)}% left • runs out {formatEta(l.minutesToEmpty)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: '45%' }}>
        <Text style={[styles.lineClosing, { color: closing.color }]}>{closing.text}</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.round(Math.min(1, Math.max(0, l.pctLeft)) * 100)}%`,
                backgroundColor: l.risk === 'ok' ? BRAND.success : l.risk === 'low' ? BRAND.warn : BRAND.danger,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Automation settings (closing time, alarm thresholds)
// ---------------------------------------------------------------------------

function KitchenAutomationSettingsBody({ onClose }: { onClose: () => void }) {
  const settings = useKitchenStore((s) => s.kitchenSettings);
  const updateSettings = useKitchenStore((s) => s.updateSettings);

  const [openH, setOpenH] = useState(String(settings.openingHour));
  const [closeH, setCloseH] = useState(String(settings.closingHour));
  const [lowPct, setLowPct] = useState(String(settings.shiftLowPct));
  const [critPct, setCritPct] = useState(String(settings.shiftCriticalPct));
  const [runway, setRunway] = useState(String(settings.runwayAlertMin));
  const [sound, setSound] = useState(settings.alarmSound);

  const save = () => {
    const o = parseInt(openH, 10);
    const c = parseInt(closeH, 10);
    const lo = parseFloat(lowPct);
    const cr = parseFloat(critPct);
    const rw = parseFloat(runway);
    const bad = (msg: string) => {
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Check values', msg);
    };
    if (!(o >= 0 && o <= 23) || !(c >= 0 && c <= 23)) return bad('Opening and closing hour must be between 0 and 23.');
    if (!(lo > 0 && lo <= 100) || !(cr > 0 && cr <= 100)) return bad('Low / critical % must be between 1 and 100.');
    if (cr >= lo) return bad('Critical % must be smaller than Low %.');
    if (!(rw >= 10 && rw <= 600)) return bad('Run-out warning must be between 10 and 600 minutes.');
    updateSettings({
      openingHour: o,
      closingHour: c,
      shiftLowPct: lo,
      shiftCriticalPct: cr,
      runwayAlertMin: rw,
      alarmSound: sound,
    });
    onClose();
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>Kitchen Automation Settings</Text>
            <Text style={styles.modalSub}>Used for the evening forecast and low-stock alarms</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={26} color={BRAND.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={styles.fieldRow}>
            <Field label="Opens at (hour 0-23)" value={openH} onChange={setOpenH} hint={`Now: ${fmtHour(parseInt(openH, 10) || 0)}`} />
            <Field label="Closes at (hour 0-23)" value={closeH} onChange={setCloseH} hint={`Now: ${fmtHour(parseInt(closeH, 10) || 0)} (e.g. 2 = 2 AM)`} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Low alarm at (% left)" value={lowPct} onChange={setLowPct} hint="Warning when an item drops to this % of the handover" />
            <Field label="Critical alarm at (% left)" value={critPct} onChange={setCritPct} hint="Urgent alarm (repeats every 5 min)" />
          </View>
          <Field label="Run-out warning (minutes)" value={runway} onChange={setRunway} hint="Alarm if an item is forecast to finish within this time" />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Alarm sound / vibration</Text>
              <Text style={styles.fieldHint}>Beep on web, vibrate on phones</Text>
            </View>
            <Switch value={sound} onValueChange={setSound} trackColor={{ true: BRAND.gold, false: '#CFCFCF' }} thumbColor="#FFFFFF" />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
            <Ionicons name="save-outline" size={16} color="#FFFFFF" />
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function KitchenAutomationSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KitchenAutomationSettingsBody onClose={onClose} />
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="numeric" />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '900', color: BRAND.burgundy },
  titleSub: { fontSize: 12, fontWeight: '700', color: BRAND.goldDark, flexShrink: 1 },
  subline: { fontSize: 11, color: BRAND.muted, marginTop: 3 },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5EBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiGrid: { flexDirection: 'row', gap: 8 },
  kpiGridMobile: { flexWrap: 'wrap' },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: BRAND.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
  },
  kpiHighlight: { backgroundColor: '#FFF8E6', borderColor: BRAND.goldLight },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: BRAND.muted },
  kpiValue: { fontSize: 18, fontWeight: '900', color: BRAND.ink, marginTop: 2 },
  kpiSub: { fontSize: 10, color: BRAND.muted, marginTop: 2 },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderLeftWidth: 5,
    padding: 12,
  },
  splitLabel: { fontSize: 12, fontWeight: '700', color: BRAND.ink },
  splitValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  splitSub: { fontSize: 11, color: BRAND.muted, marginTop: 2 },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 10,
  },
  warnText: { flex: 1, fontSize: 12, color: BRAND.warn, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: BRAND.ink },
  lineRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  lineName: { fontSize: 13, fontWeight: '800', color: BRAND.ink },
  lineMeta: { fontSize: 11, color: BRAND.muted, marginTop: 3, lineHeight: 15 },
  lineClosing: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '900' },
  barTrack: { width: 110, height: 6, borderRadius: 3, backgroundColor: '#EEE', marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  showAllBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  showAllText: { fontSize: 12, fontWeight: '800', color: BRAND.burgundy },
  footnote: { fontSize: 10, color: BRAND.muted, fontStyle: 'italic' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: BRAND.burgundy },
  modalSub: { fontSize: 12, color: BRAND.muted, marginTop: 2 },
  fieldRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: BRAND.ink, marginBottom: 4 },
  fieldHint: { fontSize: 10, color: BRAND.muted, marginTop: 3 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.ink,
    backgroundColor: BRAND.cream,
    minHeight: 40,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    minHeight: 40,
    justifyContent: 'center',
  },
  cancelText: { fontWeight: '700', color: BRAND.muted },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: BRAND.burgundy,
    minHeight: 40,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
});
