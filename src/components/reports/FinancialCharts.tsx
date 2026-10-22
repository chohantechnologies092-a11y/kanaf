import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Line,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { money } from '../../utils/format';

interface DonutItem {
  label: string;
  value: number;
  color: string;
  count?: number;
}

interface BarItem {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
  badge?: string;
}

// -------------------------------------------------------------
// 1. SvgDonutChart: Pixel-perfect circular segment donut
// -------------------------------------------------------------
export function SvgDonutChart({
  data,
  size = 200,
  thickness = 26,
  centerTitle,
  centerSubtitle,
}: {
  data: DonutItem[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerSubtitle?: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const total = data.reduce((acc, item) => acc + (item.value > 0 ? item.value : 0), 0);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulatedPercent = 0;

  return (
    <View style={styles.donutContainer}>
      <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {total === 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#E2E8F0"
              strokeWidth={thickness}
              fill="transparent"
            />
          ) : (
            <G>
              {data.map((item, idx) => {
                if (item.value <= 0) return null;
                const percent = item.value / total;
                const strokeDasharray = `${percent * circumference} ${circumference}`;
                const strokeDashoffset = -(accumulatedPercent * circumference);
                accumulatedPercent += percent;

                const isSelected = selectedIdx === idx;

                return (
                  <Circle
                    key={idx}
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={isSelected ? thickness + 4 : thickness}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    fill="transparent"
                    strokeLinecap="butt"
                    opacity={selectedIdx !== null && !isSelected ? 0.45 : 1}
                  />
                );
              })}
            </G>
          )}
        </Svg>

        {/* Center Text Overlay */}
        <View style={[styles.donutCenterContent, { maxWidth: size - thickness * 2 - 16 }]}>
          <Text style={styles.donutCenterSub} numberOfLines={1}>
            {selectedIdx !== null ? data[selectedIdx]?.label : centerSubtitle || 'TOTAL'}
          </Text>
          <Text style={styles.donutCenterTitle} numberOfLines={1}>
            {selectedIdx !== null ? money(data[selectedIdx]?.value || 0) : centerTitle || money(total)}
          </Text>
          {selectedIdx !== null && total > 0 && (
            <Text style={styles.donutCenterPercent}>
              {((data[selectedIdx].value / total) * 100).toFixed(1)}%
            </Text>
          )}
        </View>
      </View>

      {/* Legend List */}
      <View style={styles.legendContainer}>
        {data.map((item, idx) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
          const isSelected = selectedIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.legendItem, isSelected && styles.legendItemActive]}
              onPress={() => setSelectedIdx(isSelected ? null : idx)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View style={styles.legendTextCol}>
                <View style={styles.legendHeaderRow}>
                  <Text style={styles.legendLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.legendPct}>{pct}%</Text>
                </View>
                <View style={styles.legendSubRow}>
                  <Text style={styles.legendValue}>{money(item.value)}</Text>
                  {item.count !== undefined && (
                    <Text style={styles.legendCount}>({item.count} orders)</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// 2. SvgVerticalBarChart: Clean multi-bar chart with gridlines
// -------------------------------------------------------------
export function SvgVerticalBarChart({
  data,
  height = 200,
  barWidth = 42,
  valuePrefix = 'Rs. ',
  showPercentages = true,
}: {
  data: BarItem[];
  height?: number;
  barWidth?: number;
  valuePrefix?: string;
  showPercentages?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const chartHeight = height - 50; // leave room for top value & bottom label
  const totalPositive = data.reduce((sum, d) => sum + (d.value > 0 ? d.value : 0), 0);

  return (
    <View style={styles.barChartContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barChartScroll}>
        <View style={{ height, minWidth: Math.max(data.length * (barWidth + 24), width - 80) }}>
          {/* Subtle Gridlines */}
          <Svg width="100%" height={chartHeight} style={StyleSheet.absoluteFill}>
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartHeight * (1 - ratio) + 20;
              return (
                <Line
                  key={ratio}
                  x1="0"
                  y1={y}
                  x2="100%"
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}
          </Svg>

          {/* Bars Row */}
          <View style={[styles.barsRow, { height: chartHeight + 20, paddingTop: 10 }]}>
            {data.map((item, idx) => {
              const barH = Math.max((Math.abs(item.value) / maxValue) * (chartHeight - 30), 4);
              const color = item.color || '#2563EB';
              const isSelected = selectedIdx === idx;
              const pct = totalPositive > 0 && item.value > 0 ? ((item.value / totalPositive) * 100).toFixed(0) : null;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.barCol, { width: barWidth + 20 }]}
                  onPress={() => setSelectedIdx(isSelected ? null : idx)}
                  activeOpacity={0.8}
                >
                  {/* Value Above Bar */}
                  <View style={styles.barTopBadge}>
                    <Text style={[styles.barTopValue, isSelected && { color, fontWeight: '800' }]} numberOfLines={1}>
                      {item.value >= 1000 ? `${(item.value / 1000).toFixed(item.value >= 10000 ? 0 : 1)}k` : item.value}
                    </Text>
                    {showPercentages && pct && (
                      <Text style={styles.barTopPct}>{pct}%</Text>
                    )}
                  </View>

                  {/* Visual Bar */}
                  <View style={[styles.barTrack, { height: chartHeight - 20 }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barH,
                          width: barWidth,
                          backgroundColor: color,
                          opacity: selectedIdx !== null && !isSelected ? 0.4 : 1,
                        },
                        isSelected && { borderColor: '#0F172A', borderWidth: 2 },
                      ]}
                    />
                  </View>

                  {/* Label Below Bar */}
                  <Text style={[styles.barLabel, isSelected && { color: '#0F172A', fontWeight: '700' }]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {item.sublabel && (
                    <Text style={styles.barSublabel} numberOfLines={1}>{item.sublabel}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Selected Indicator Detail Pill */}
      {selectedIdx !== null && (
        <View style={styles.barDetailPill}>
          <View style={[styles.legendDot, { backgroundColor: data[selectedIdx].color || '#2563EB' }]} />
          <Text style={styles.barDetailTitle}>{data[selectedIdx].label}:</Text>
          <Text style={styles.barDetailValue}>{money(data[selectedIdx].value)}</Text>
          {data[selectedIdx].sublabel && (
            <Text style={styles.barDetailSub}>• {data[selectedIdx].sublabel}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// -------------------------------------------------------------
// 3. SvgHourlyVelocityChart: 24-hr area curve with peak marker
// -------------------------------------------------------------
export function SvgHourlyVelocityChart({
  hourlyData,
  height = 180,
  accentColor = '#52171B',
}: {
  hourlyData: Record<number, { count: number; revenue: number }>;
  height?: number;
  accentColor?: string;
}) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxRevenue = Math.max(...hours.map((h) => hourlyData[h]?.revenue || 0), 100);
  const totalRevenue = hours.reduce((acc, h) => acc + (hourlyData[h]?.revenue || 0), 0);
  const totalOrders = hours.reduce((acc, h) => acc + (hourlyData[h]?.count || 0), 0);

  // Peak hour
  let peakHour = 0;
  let peakRev = 0;
  hours.forEach((h) => {
    if ((hourlyData[h]?.revenue || 0) > peakRev) {
      peakRev = hourlyData[h]?.revenue || 0;
      peakHour = h;
    }
  });

  const chartWidth = 580;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  // Build Points
  const points = hours.map((h) => {
    const x = paddingLeft + (h / 23) * innerW;
    const rev = hourlyData[h]?.revenue || 0;
    const y = paddingTop + innerH - (rev / maxRevenue) * innerH;
    return { x, y, hour: h, revenue: rev, count: hourlyData[h]?.count || 0 };
  });

  // Area Path
  const linePath = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaPath = `${linePath} L ${paddingLeft + innerW} ${paddingTop + innerH} L ${paddingLeft} ${paddingTop + innerH} Z`;

  return (
    <View style={styles.hourlyContainer}>
      <View style={styles.hourlyHeader}>
        <View>
          <Text style={styles.hourlyTitle}>24-Hour Revenue & Rush Curve</Text>
          <Text style={styles.hourlySubtitle}>
            Total: {money(totalRevenue)} ({totalOrders} orders)
          </Text>
        </View>
        {peakRev > 0 && (
          <View style={styles.peakBadge}>
            <Text style={styles.peakBadgeLabel}>⚡ Peak Rush: </Text>
            <Text style={styles.peakBadgeVal}>
              {peakHour.toString().padStart(2, '0')}:00 ({money(peakRev)})
            </Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth, height }}>
          <Svg width={chartWidth} height={height}>
            <Defs>
              <LinearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Horizontal Grid lines */}
            {[0, 0.5, 1].map((r) => {
              const y = paddingTop + innerH * (1 - r);
              return (
                <G key={r}>
                  <Line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <SvgText
                    x={paddingLeft - 6}
                    y={y + 4}
                    fontSize="9"
                    fill="#94A3B8"
                    textAnchor="end"
                  >
                    {money(maxRevenue * r)}
                  </SvgText>
                </G>
              );
            })}

            {/* Gradient Area */}
            <Path d={areaPath} fill="url(#velocityGrad)" />

            {/* Stroke Line */}
            <Path d={linePath} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />

            {/* Data Dots & Clickable zones */}
            {points.map((pt) => {
              const isPeak = pt.hour === peakHour && peakRev > 0;
              const isSelected = selectedHour === pt.hour;
              if (pt.revenue === 0 && !isSelected) return null;

              return (
                <G key={pt.hour}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : isPeak ? 5 : 3.5}
                    fill={isSelected ? '#0F172A' : isPeak ? '#B48214' : '#FFFFFF'}
                    stroke={isSelected ? '#FFFFFF' : accentColor}
                    strokeWidth="2"
                  />
                </G>
              );
            })}

            {/* X-Axis Hour Labels */}
            {[0, 4, 8, 12, 16, 20, 23].map((h) => {
              const x = paddingLeft + (h / 23) * innerW;
              const formattedH = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
              return (
                <SvgText
                  key={h}
                  x={x}
                  y={height - 8}
                  fontSize="10"
                  fill="#64748B"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {formattedH}
                </SvgText>
              );
            })}
          </Svg>
        </View>
      </ScrollView>

      {/* Hourly Quick Selector Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourChipScroll}>
        {hours
          .filter((h) => (hourlyData[h]?.count || 0) > 0)
          .map((h) => {
            const isSelected = selectedHour === h;
            const isPeak = h === peakHour && peakRev > 0;
            return (
              <TouchableOpacity
                key={h}
                style={[
                  styles.hourChip,
                  isSelected && styles.hourChipSelected,
                  isPeak && !isSelected && styles.hourChipPeak,
                ]}
                onPress={() => setSelectedHour(isSelected ? null : h)}
              >
                <Text style={[styles.hourChipTime, (isSelected || isPeak) && { color: '#0F172A', fontWeight: '700' }]}>
                  {h}:00
                </Text>
                <Text style={styles.hourChipRev}>{money(hourlyData[h]?.revenue || 0)}</Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------
// 4. HorizontalRankedBars: Sleek ranked comparative bars
// -------------------------------------------------------------
export function HorizontalRankedBars({
  items,
  title,
  subtitle,
  valuePrefix = 'Rs. ',
}: {
  items: Array<{ label: string; value: number; color?: string; count?: number; secondary?: string }>;
  title?: string;
  subtitle?: string;
  valuePrefix?: string;
}) {
  const maxValue = Math.max(...items.map((it) => it.value), 1);
  const totalValue = items.reduce((sum, it) => sum + it.value, 0);

  return (
    <View style={styles.rankedCard}>
      {title && (
        <View style={styles.rankedHeader}>
          <Text style={styles.rankedTitle}>{title}</Text>
          {subtitle && <Text style={styles.rankedSub}>{subtitle}</Text>}
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.emptyText}>No data recorded for this period.</Text>
      ) : (
        items.map((it, idx) => {
          const pct = totalValue > 0 ? ((it.value / totalValue) * 100).toFixed(1) : '0';
          const barW = Math.max((it.value / maxValue) * 100, 2);
          const color = it.color || (idx === 0 ? '#B48214' : idx === 1 ? '#52171B' : '#2563EB');

          return (
            <View key={idx} style={styles.rankedRow}>
              <View style={styles.rankedLabelCol}>
                <View style={styles.rankedNameRow}>
                  <View style={[styles.rankBadge, { backgroundColor: `${color}15` }]}>
                    <Text style={[styles.rankBadgeText, { color }]}>#{idx + 1}</Text>
                  </View>
                  <Text style={styles.rankedName} numberOfLines={1}>{it.label}</Text>
                </View>
                <View style={styles.rankedValRow}>
                  <Text style={styles.rankedValText}>{money(it.value)}</Text>
                  <Text style={styles.rankedPctText}>({pct}%)</Text>
                  {it.count !== undefined && (
                    <Text style={styles.rankedCountText}>• {it.count} units</Text>
                  )}
                </View>
              </View>

              {/* Bar Fill */}
              <View style={styles.rankedBarTrack}>
                <View style={[styles.rankedBarFill, { width: `${barW}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// -------------------------------------------------------------
// 5. PnLFlowWaterfallChart: Visual Flow from Gross to Net
// -------------------------------------------------------------
export function PnLFlowWaterfallChart({
  grossRevenue,
  cogs,
  opex,
  damageLoss,
  netProfit,
}: {
  grossRevenue: number;
  cogs: number;
  opex: number;
  damageLoss: number;
  netProfit: number;
}) {
  const steps = [
    { label: 'Gross Revenue', value: grossRevenue, color: '#059669', type: 'inflow', sub: 'Total Inflows' },
    { label: 'Cost of Goods', value: cogs, color: '#D97706', type: 'outflow', sub: 'Procurement / Raw' },
    { label: 'Operating Opex', value: opex, color: '#E11D48', type: 'outflow', sub: 'Salaries, Utilities, Rent' },
    { label: 'Damage Losses', value: damageLoss, color: '#9333EA', type: 'outflow', sub: 'Breakage & Shrinkage' },
    {
      label: 'Net EBITDA',
      value: netProfit,
      color: netProfit >= 0 ? '#059669' : '#BE123C',
      type: 'result',
      sub: netProfit >= 0 ? 'Operating Profit' : 'Operating Deficit',
    },
  ];

  return (
    <View style={styles.waterfallCard}>
      <View style={styles.waterfallHeader}>
        <Text style={styles.waterfallTitle}>P&L Capital Flow Breakdown</Text>
        <Text style={styles.waterfallSub}>How topline gross turnover filters down to net profit</Text>
      </View>

      <View style={styles.waterfallSteps}>
        {steps.map((st, i) => {
          const isResult = st.type === 'result';
          const isOutflow = st.type === 'outflow';
          const pctOfGross = grossRevenue > 0 ? ((Math.abs(st.value) / grossRevenue) * 100).toFixed(1) : '0';

          return (
            <View key={i} style={[styles.waterfallStep, isResult && styles.waterfallStepResult]}>
              <View style={styles.waterfallTopRow}>
                <View style={styles.waterfallTitleCol}>
                  <View style={[styles.waterfallIndicator, { backgroundColor: st.color }]} />
                  <Text style={[styles.waterfallLabel, isResult && styles.waterfallLabelResult]}>
                    {st.label}
                  </Text>
                </View>
                <View style={styles.waterfallAmountCol}>
                  <Text
                    style={[
                      styles.waterfallAmount,
                      { color: isOutflow ? '#BE123C' : st.color },
                      isResult && styles.waterfallAmountResult,
                    ]}
                  >
                    {isOutflow ? `- ${money(st.value)}` : money(st.value)}
                  </Text>
                  <Text style={styles.waterfallPct}>
                    {isResult ? `${((netProfit / (grossRevenue || 1)) * 100).toFixed(1)}% margin` : `${pctOfGross}% of sales`}
                  </Text>
                </View>
              </View>

              {/* Progress Proportion Bar */}
              <View style={styles.waterfallTrack}>
                <View
                  style={[
                    styles.waterfallFill,
                    {
                      width: `${Math.min(Math.max((Math.abs(st.value) / (grossRevenue || 1)) * 100, 2), 100)}%`,
                      backgroundColor: st.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.waterfallSubtext}>{st.sub}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  donutCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  donutCenterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  donutCenterPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  legendContainer: {
    width: '100%',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  legendItemActive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendTextCol: {
    flex: 1,
  },
  legendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
  },
  legendSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  legendCount: {
    fontSize: 11,
    color: '#94A3B8',
  },

  // Bar Chart
  barChartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  barChartScroll: {
    paddingVertical: 4,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTopBadge: {
    alignItems: 'center',
    marginBottom: 6,
  },
  barTopValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  barTopPct: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  barTrack: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  barSublabel: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  barDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  barDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  barDetailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  barDetailSub: {
    fontSize: 12,
    color: '#64748B',
  },

  // Hourly Chart
  hourlyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  hourlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourlyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  hourlySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  peakBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  peakBadgeVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78350F',
  },
  hourChipScroll: {
    gap: 6,
    paddingTop: 4,
  },
  hourChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  hourChipSelected: {
    backgroundColor: '#F1F5F9',
    borderColor: '#0F172A',
  },
  hourChipPeak: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  hourChipTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  hourChipRev: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },

  // Ranked Bars
  rankedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  rankedHeader: {
    marginBottom: 4,
  },
  rankedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  rankedSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rankedRow: {
    gap: 6,
  },
  rankedLabelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  rankedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 140,
  },
  rankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rankedName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  rankedValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankedValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  rankedPctText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  rankedCountText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  rankedBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rankedBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },

  // Waterfall
  waterfallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
  },
  waterfallHeader: {
    marginBottom: 2,
  },
  waterfallTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  waterfallSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  waterfallSteps: {
    gap: 12,
  },
  waterfallStep: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  waterfallStepResult: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  waterfallTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterfallTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterfallIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  waterfallLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  waterfallLabelResult: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  waterfallAmountCol: {
    alignItems: 'flex-end',
  },
  waterfallAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  waterfallAmountResult: {
    fontSize: 15,
    fontWeight: '900',
  },
  waterfallPct: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  waterfallTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  waterfallFill: {
    height: '100%',
    borderRadius: 3,
  },
  waterfallSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
});
