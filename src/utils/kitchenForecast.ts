import type { InventoryItem } from '../store/opsStore';
import { getExpiryStatus } from '../store/opsStore';
import type {
  ConsumptionEntry,
  KitchenSession,
  KitchenSettings,
  ManualUsage,
  Recipe,
} from '../types/kitchen';
import { computeLiveLines, formatQty } from './kitchenMath';

/**
 * Forecast + alert engine for kitchen handovers.
 *
 * Idea: every handover (shift) knows what the chef received and, thanks to POS
 * auto-deduction, how much has been used so far. From that we project the rest of
 * the day (until closing time) and tell the manager:
 *   - how much of each ingredient should still be left in the evening (return),
 *   - how much MORE is needed beyond what was handed over (extra issue),
 *   - the expected revenue / cost / gross profit for the shift.
 */

export type RiskLevel = 'ok' | 'watch' | 'low' | 'critical' | 'out';

export type ForecastLine = {
  itemId: string;
  itemName: string;
  unit: string;
  category: string;
  costPerUnit: number;
  /** Everything the chef received (issued + top-ups + local purchases). */
  totalIn: number;
  /** Used so far (POS auto-deduction + manual taste / wastage entries). */
  usedSoFar: number;
  /** What should physically be in the kitchen right now. */
  expectedOnHand: number;
  pctLeft: number;
  /** Projected additional usage until closing time. */
  futureUse: number;
  /** Projected stock at closing. Negative = we will run short by that much. */
  projectedRemaining: number;
  /** Extra needed beyond the handover (>= 0). */
  shortfall: number;
  /** Expected to be handed back in the evening (>= 0). */
  leftover: number;
  /** Minutes until this item runs out at the current pace (null = no usage yet). */
  minutesToEmpty: number | null;
  risk: RiskLevel;
};

export type SessionForecast = {
  session: KitchenSession;
  lines: ForecastLine[];
  elapsedHours: number;
  hoursToClose: number;
  closeAt: number;
  /** True when the projection is shaped by past busy / quiet hours (otherwise a flat pace is used). */
  usedHourlyPattern: boolean;
  /** True when closed shifts were available to stabilise the estimate. */
  usedHistory: boolean;

  dishesSold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;

  projectedDishes: number;
  projectedRevenue: number;
  projectedCost: number;
  projectedProfit: number;

  /** Cost value of everything expected back in the evening. */
  expectedReturnValue: number;
  /** Cost value of the extra stock that will be needed. */
  extraNeededValue: number;
  /** Items that are out / critical / low / will run short before closing. */
  attentionCount: number;
  outCount: number;
  missingRecipeCount: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r3 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 1000) / 1000;
const HOUR = 3600000;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Timestamp of the next closing time. Handles closing after midnight (e.g. open 11, close 2). */
export function closingTimestamp(now: number, openingHour: number, closingHour: number): number {
  const d = new Date(now);
  d.setHours(closingHour, 0, 0, 0);
  const wraps = closingHour <= openingHour;
  if (wraps && new Date(now).getHours() >= closingHour) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function hourOfDayWeights(consumption: ConsumptionEntry[], now: number, days = 14): number[] | null {
  const since = now - days * 24 * HOUR;
  const w = new Array<number>(24).fill(0);
  let total = 0;
  for (const c of consumption) {
    if (c.at < since || c.missingRecipe) continue;
    w[new Date(c.at).getHours()] += c.qty;
    total += c.qty;
  }
  // Not enough history to describe busy / quiet hours.
  if (total < 40) return null;
  // Light smoothing so a single busy hour does not dominate.
  return w.map((v, i) => (v + (w[(i + 23) % 24] + w[(i + 1) % 24]) * 0.25) / 1.5);
}

function windowWeight(w: number[], from: number, to: number): number {
  if (to <= from) return 0;
  let acc = 0;
  let t = from;
  let guard = 0;
  while (t < to && guard++ < 60) {
    const d = new Date(t);
    const nextHour = new Date(t);
    nextHour.setHours(d.getHours() + 1, 0, 0, 0);
    const end = Math.min(nextHour.getTime(), to);
    acc += w[d.getHours()] * ((end - t) / HOUR);
    t = end;
  }
  return acc;
}

// ---------------------------------------------------------------------------
// History (closed shifts) used to stabilise early-day estimates
// ---------------------------------------------------------------------------

type History = {
  usageRate: Map<string, number>;
  revenueRate: number;
  costRate: number;
  dishRate: number;
};

function buildHistory(
  session: KitchenSession,
  sessions: KitchenSession[],
  consumption: ConsumptionEntry[]
): History | null {
  const station = session.station || 'all';
  const closed = sessions
    .filter((s) => s.status === 'closed' && s.issuedAt && (s.closingSubmittedAt || s.approvedAt))
    .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));
  const same = closed.filter((s) => (s.station || 'all') === station);
  const pick = (same.length > 0 ? same : closed).slice(0, 3);
  if (pick.length === 0) return null;

  const ids = new Set(pick.map((s) => s.id));
  const hours = pick.reduce(
    (a, s) => a + Math.max(0.5, ((s.closingSubmittedAt || s.approvedAt || 0) - (s.issuedAt || 0)) / HOUR),
    0
  );
  if (hours <= 0) return null;

  const usage = new Map<string, number>();
  let revenue = 0;
  let cost = 0;
  let dishes = 0;
  for (const c of consumption) {
    if (!ids.has(c.sessionId)) continue;
    revenue += c.revenue;
    cost += c.cost;
    dishes += c.qty;
    c.usage.forEach((u) => usage.set(u.itemId, (usage.get(u.itemId) || 0) + u.qty));
  }
  const usageRate = new Map<string, number>();
  usage.forEach((v, k) => usageRate.set(k, v / hours));
  return { usageRate, revenueRate: revenue / hours, costRate: cost / hours, dishRate: dishes / hours };
}

// ---------------------------------------------------------------------------
// Projection core
// ---------------------------------------------------------------------------

type ProjectArgs = {
  used: number;
  elapsedH: number;
  remainingH: number;
  histRate: number | null;
  patternFactor: number | null;
};

/** Returns projected additional usage until closing and the average pace (per hour) it implies. */
function projectFuture({ used, elapsedH, remainingH, histRate, patternFactor }: ProjectArgs): {
  future: number;
  rate: number;
} {
  const liveRate = used > 0 ? used / elapsedH : 0;
  if (remainingH <= 0) return { future: 0, rate: liveRate };

  const live = patternFactor != null ? Math.max(0, used) * patternFactor : liveRate * remainingH;
  if (histRate == null) return { future: live, rate: live / remainingH };

  // Trust the live pace more as the day goes on (full trust after ~4 hours).
  const w = clamp(elapsedH / 4, 0.2, 1);
  const future = w * live + (1 - w) * histRate * remainingH;
  return { future, rate: future / remainingH };
}

export function computeSessionForecast(
  session: KitchenSession,
  sessions: KitchenSession[],
  consumption: ConsumptionEntry[],
  manual: ManualUsage[],
  settings: Pick<KitchenSettings, 'openingHour' | 'closingHour' | 'shiftLowPct' | 'shiftCriticalPct' | 'runwayAlertMin'>,
  now: number = Date.now()
): SessionForecast {
  const issuedAt = session.issuedAt || session.createdAt;
  const elapsedHours = Math.max(0.5, (now - issuedAt) / HOUR);
  const closeAt = closingTimestamp(now, settings.openingHour, settings.closingHour);
  const hoursToClose = Math.max(0, (closeAt - now) / HOUR);

  const live = computeLiveLines(session, consumption, manual);
  const history = buildHistory(session, sessions, consumption);

  // Busy / quiet hours pattern -> how much more volume is expected vs what we have already seen.
  const pattern = hourOfDayWeights(consumption, now);
  let patternFactor: number | null = null;
  if (pattern && hoursToClose > 0) {
    const total = pattern.reduce((a, b) => a + b, 0);
    const wElapsed = windowWeight(pattern, issuedAt, now);
    const wRemain = windowWeight(pattern, now, closeAt);
    if (total > 0 && wElapsed / total >= 0.05) patternFactor = clamp(wRemain / wElapsed, 0, 8);
  }

  const lowPct = settings.shiftLowPct / 100;
  const critPct = settings.shiftCriticalPct / 100;

  const lines: ForecastLine[] = live.map((l) => {
    const usedSoFar = l.theoreticalUsed + l.manualUsed;
    const proj = projectFuture({
      used: usedSoFar,
      elapsedH: elapsedHours,
      remainingH: hoursToClose,
      histRate: history ? history.usageRate.get(l.itemId) ?? 0 : null,
      patternFactor,
    });
    const projectedRemaining = r3(l.expectedOnHand - proj.future);
    const pctLeft = l.totalIn > 0 ? l.expectedOnHand / l.totalIn : 0;
    const liveRate = usedSoFar > 0 ? usedSoFar / elapsedHours : 0;
    const etaRate = Math.max(proj.rate, hoursToClose <= 0 ? liveRate : 0);
    const minutesToEmpty =
      l.expectedOnHand <= 0 ? 0 : etaRate > 0 ? (l.expectedOnHand / etaRate) * 60 : null;

    let risk: RiskLevel = 'ok';
    if (l.expectedOnHand <= 0) risk = 'out';
    else if (pctLeft <= critPct || (minutesToEmpty != null && minutesToEmpty <= 30)) risk = 'critical';
    else if (pctLeft <= lowPct || (minutesToEmpty != null && minutesToEmpty <= settings.runwayAlertMin)) risk = 'low';
    else if (projectedRemaining < 0) risk = 'watch';

    return {
      itemId: l.itemId,
      itemName: l.itemName,
      unit: l.unit,
      category: l.category,
      costPerUnit: l.costPerUnit || 0,
      totalIn: l.totalIn,
      usedSoFar: r3(usedSoFar),
      expectedOnHand: r3(l.expectedOnHand),
      pctLeft,
      futureUse: r3(proj.future),
      projectedRemaining,
      shortfall: Math.max(0, -projectedRemaining),
      leftover: Math.max(0, projectedRemaining),
      minutesToEmpty,
      risk,
    };
  });

  // Sales side (POS tickets already matched to this shift).
  const mine = consumption.filter((c) => c.sessionId === session.id);
  const dishesSold = mine.reduce((a, c) => a + c.qty, 0);
  const revenue = mine.reduce((a, c) => a + c.revenue, 0);
  const cost = mine.reduce((a, c) => a + c.cost, 0);
  const missingRecipeCount = mine.filter((c) => c.missingRecipe).length;

  const proj = (used: number, hist: number | undefined) =>
    projectFuture({
      used,
      elapsedH: elapsedHours,
      remainingH: hoursToClose,
      histRate: history ? hist ?? 0 : null,
      patternFactor,
    }).future;

  const projectedDishes = dishesSold + proj(dishesSold, history?.dishRate);
  const projectedRevenue = revenue + proj(revenue, history?.revenueRate);
  const projectedCost = cost + proj(cost, history?.costRate);

  const expectedReturnValue = lines.reduce((a, l) => a + l.leftover * l.costPerUnit, 0);
  const extraNeededValue = lines.reduce((a, l) => a + l.shortfall * l.costPerUnit, 0);

  return {
    session,
    lines,
    elapsedHours,
    hoursToClose,
    closeAt,
    usedHourlyPattern: patternFactor != null,
    usedHistory: !!history,
    dishesSold,
    revenue,
    cost,
    grossProfit: revenue - cost,
    marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    projectedDishes,
    projectedRevenue,
    projectedCost,
    projectedProfit: projectedRevenue - projectedCost,
    expectedReturnValue,
    extraNeededValue,
    attentionCount: lines.filter((l) => l.risk !== 'ok').length,
    outCount: lines.filter((l) => l.risk === 'out').length,
    missingRecipeCount,
  };
}

export type CombinedForecast = {
  count: number;
  dishesSold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  projectedRevenue: number;
  projectedProfit: number;
  expectedReturnValue: number;
  extraNeededValue: number;
  attentionCount: number;
};

export function combineForecasts(list: SessionForecast[]): CombinedForecast {
  const sum = (pick: (f: SessionForecast) => number) => list.reduce((a, f) => a + pick(f), 0);
  return {
    count: list.length,
    dishesSold: sum((f) => f.dishesSold),
    revenue: sum((f) => f.revenue),
    cost: sum((f) => f.cost),
    grossProfit: sum((f) => f.grossProfit),
    projectedRevenue: sum((f) => f.projectedRevenue),
    projectedProfit: sum((f) => f.projectedProfit),
    expectedReturnValue: sum((f) => f.expectedReturnValue),
    extraNeededValue: sum((f) => f.extraNeededValue),
    attentionCount: sum((f) => f.attentionCount),
  };
}

export function formatEta(minutes: number | null): string {
  if (minutes == null) return 'No usage yet';
  if (minutes <= 0) return 'Finished';
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: '#2E7D32', bg: '#E8F5E9' },
  watch: { label: 'Short by close', color: '#6A1B9A', bg: '#F3E5F5' },
  low: { label: 'Low', color: '#E65100', bg: '#FFF3E0' },
  critical: { label: 'Critical', color: '#C62828', bg: '#FFEBEE' },
  out: { label: 'Finished', color: '#FFFFFF', bg: '#C62828' },
};

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertKind =
  | 'shift_out'
  | 'shift_low'
  | 'shift_short'
  | 'store_out'
  | 'store_low'
  | 'store_cannot_cover'
  | 'expiry'
  | 'no_recipe';

export type StockAlert = {
  /** Stable id: same condition keeps the same id so it can be snoozed. */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  itemId?: string;
  sessionId?: string;
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function buildAlerts(input: {
  sessions: KitchenSession[];
  consumption: ConsumptionEntry[];
  manual: ManualUsage[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  settings: KitchenSettings;
  now?: number;
}): StockAlert[] {
  const { sessions, consumption, manual, inventory, settings } = input;
  const now = input.now ?? Date.now();
  const alerts: StockAlert[] = [];
  const active = sessions.filter((s) => s.status === 'issued');
  const invById = new Map(inventory.map((i) => [i.id, i]));

  // 1) Handed-over stock running out inside the kitchen.
  for (const s of active) {
    const f = computeSessionForecast(s, sessions, consumption, manual, settings, now);
    const who = `${s.headChef}${s.shift ? ` (${s.shift})` : ''}`;
    for (const l of f.lines) {
      const left = formatQty(Math.max(0, l.expectedOnHand), l.unit);
      if (l.risk === 'out') {
        alerts.push({
          id: `shift_out:${s.id}:${l.itemId}`,
          kind: 'shift_out',
          severity: 'critical',
          title: `${l.itemName} finished in kitchen`,
          detail: `${who}: all handed-over ${l.itemName} is used up. Issue a top-up now.`,
          itemId: l.itemId,
          sessionId: s.id,
        });
      } else if (l.risk === 'critical') {
        alerts.push({
          id: `shift_low:${s.id}:${l.itemId}:c`,
          kind: 'shift_low',
          severity: 'critical',
          title: `${l.itemName} almost finished`,
          detail: `${who}: only ${left} left (${Math.round(l.pctLeft * 100)}%), runs out ${formatEta(l.minutesToEmpty)}.`,
          itemId: l.itemId,
          sessionId: s.id,
        });
      } else if (l.risk === 'low') {
        alerts.push({
          id: `shift_low:${s.id}:${l.itemId}:w`,
          kind: 'shift_low',
          severity: 'warning',
          title: `${l.itemName} running low`,
          detail: `${who}: ${left} left (${Math.round(l.pctLeft * 100)}%), runs out ${formatEta(l.minutesToEmpty)}.`,
          itemId: l.itemId,
          sessionId: s.id,
        });
      } else if (l.risk === 'watch') {
        alerts.push({
          id: `shift_short:${s.id}:${l.itemId}`,
          kind: 'shift_short',
          severity: 'info',
          title: `${l.itemName} may fall short before closing`,
          detail: `${who}: about ${formatQty(l.shortfall, l.unit)} more will be needed by closing.`,
          itemId: l.itemId,
          sessionId: s.id,
        });
      }

      // Store cannot cover the extra the kitchen is going to need.
      if (l.shortfall > 0) {
        const inv = invById.get(l.itemId);
        if (inv && inv.stock < l.shortfall) {
          alerts.push({
            id: `store_cannot_cover:${s.id}:${l.itemId}`,
            kind: 'store_cannot_cover',
            severity: 'critical',
            title: `Store cannot cover ${l.itemName}`,
            detail: `Kitchen needs ~${formatQty(l.shortfall, l.unit)} more but store has ${formatQty(inv.stock, inv.unit)}. Buy or order now.`,
            itemId: l.itemId,
            sessionId: s.id,
          });
        }
      }
    }
  }

  // 2) Main store inventory.
  for (const item of inventory) {
    const threshold = item.threshold || 0;
    if (item.stock <= 0) {
      alerts.push({
        id: `store_out:${item.id}`,
        kind: 'store_out',
        severity: 'critical',
        title: `${item.name} out of stock`,
        detail: `Store has none left.${item.supplier ? ` Supplier: ${item.supplier}.` : ''}`,
        itemId: item.id,
      });
    } else if (threshold > 0 && item.stock <= threshold) {
      alerts.push({
        id: `store_low:${item.id}`,
        kind: 'store_low',
        severity: 'warning',
        title: `${item.name} low in store`,
        detail: `${formatQty(item.stock, item.unit)} left (reorder level ${formatQty(threshold, item.unit)}).${
          item.supplier ? ` Supplier: ${item.supplier}.` : ''
        }`,
        itemId: item.id,
      });
    }

    if (item.stock > 0) {
      const ex = getExpiryStatus(item);
      if (ex.status === 'expired' || ex.status === 'critical') {
        alerts.push({
          id: `expiry:${item.id}:${ex.status}`,
          kind: 'expiry',
          severity: ex.status === 'expired' ? 'critical' : 'warning',
          title: `${item.name}: ${ex.label}`,
          detail: `${formatQty(item.stock, item.unit)} in store${item.batchNumber ? ` (batch ${item.batchNumber})` : ''}.`,
          itemId: item.id,
        });
      }
    }
  }

  // 3) Dishes sold in a live shift without a recipe (cannot auto-deduct).
  const byDish = new Map<string, number>();
  for (const s of active) {
    consumption
      .filter((c) => c.sessionId === s.id && c.missingRecipe)
      .forEach((c) => byDish.set(c.menuItemName, (byDish.get(c.menuItemName) || 0) + c.qty));
  }
  byDish.forEach((qty, dish) => {
    alerts.push({
      id: `no_recipe:${dish}`,
      kind: 'no_recipe',
      severity: 'warning',
      title: `${dish} sold without recipe`,
      detail: `${qty} plate(s) could not auto-deduct stock. Add its recipe so stock and profit stay accurate.`,
    });
  });

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
